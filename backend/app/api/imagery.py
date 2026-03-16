"""
USGS Imagery Search API Router
Translates geoscape-explorer's Supabase Edge Function into a FastAPI endpoint.
"""
import os
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List

router = APIRouter(tags=["imagery"])

USGS_API_URL = "https://m2m.cr.usgs.gov/api/api/json/stable"


# ─── Request / Response Models ───────────────────────────────────────────────
class SearchRequest(BaseModel):
    south: float
    north: float
    west: float
    east: float
    startDate: str
    endDate: str
    maxCloudCover: float = 100
    dataset: Optional[str] = "landsat_ot_c2_l2"
    maxResults: int = 50
    startingNumber: int = 1


class SpatialBounds(BaseModel):
    north: float = 0
    south: float = 0
    east: float = 0
    west: float = 0


class ImageryResult(BaseModel):
    entityId: str
    displayId: str
    acquisitionDate: str
    cloudCover: float
    browseUrl: Optional[str] = None
    spatialBounds: SpatialBounds
    sensor: str
    dataset: str


class SearchResponse(BaseModel):
    results: List[ImageryResult] = []
    totalHits: int = 0
    error: Optional[str] = None


# ─── USGS helpers ────────────────────────────────────────────────────────────
async def _usgs_request(
    client: httpx.AsyncClient,
    endpoint: str,
    body: dict,
    api_key: Optional[str] = None,
) -> dict:
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["X-Auth-Token"] = api_key

    try:
        url = f"{USGS_API_URL}/{endpoint}"
        print(f"DEBUG: USGS Request to {endpoint}...", flush=True)
        resp = await client.post(url, json=body, headers=headers, timeout=30)
        
        if resp.status_code != 200:
            print(f"DEBUG: USGS {endpoint} failed with HTTP {resp.status_code}: {resp.text}", flush=True)
            raise HTTPException(
                status_code=502,
                detail=f"USGS {endpoint} failed with HTTP {resp.status_code}",
            )

        data = resp.json()
        if data.get("errorCode"):
            print(f"DEBUG: USGS {endpoint} returned error: {data.get('errorMessage')}", flush=True)
            raise HTTPException(
                status_code=502,
                detail=f"USGS {endpoint} API error [{data['errorCode']}]: {data.get('errorMessage', '')}",
            )
        
        return data.get("data")
    except httpx.RequestError as e:
        print(f"DEBUG: USGS {endpoint} network error: {str(e)}", flush=True)
        raise HTTPException(status_code=502, detail=f"USGS network error: {str(e)}")
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        print(f"DEBUG: USGS {endpoint} unexpected error: {str(e)}", flush=True)
        raise HTTPException(status_code=502, detail=f"Unexpected error: {str(e)}")


# ─── Geocoding (Nominatim proxy) ────────────────────────────────────────────
class GeocodingResult(BaseModel):
    displayName: str
    lat: float
    lon: float
    boundingBox: List[float]  # [south, north, west, east]


@router.get("/imagery/geocode", response_model=List[GeocodingResult])
async def geocode(q: str):
    """Proxy to Nominatim so the frontend avoids CORS issues."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://nominatim.openstreetmap.org/search",
            params={
                "q": q, 
                "format": "json", 
                "limit": "5", 
                "bounded": "0",
                "accept-language": "en"
            },
            headers={
                "User-Agent": "GriidAi/1.0",
                "Accept-Language": "en"
            },
            timeout=10,
        )
        resp.raise_for_status()
        items = resp.json()

    return [
        GeocodingResult(
            displayName=item["display_name"],
            lat=float(item["lat"]),
            lon=float(item["lon"]),
            boundingBox=[
                float(item["boundingbox"][0]),
                float(item["boundingbox"][1]),
                float(item["boundingbox"][2]),
                float(item["boundingbox"][3]),
            ],
        )
        for item in items
    ]


# ─── Main search endpoint ───────────────────────────────────────────────────
@router.post("/imagery/search", response_model=SearchResponse)
async def search_imagery(req: SearchRequest):
    app_token = os.environ.get("USGS_APP_TOKEN")
    username = os.environ.get("USGS_USERNAME")
    password = os.environ.get("USGS_PASSWORD")

    if not app_token and (not username or not password):
        return SearchResponse(error="USGS credentials not configured. Set USGS_APP_TOKEN in .env")

    dataset = req.dataset or "landsat_ot_c2_l2"
    api_key = None

    async with httpx.AsyncClient() as client:
        # 1) Login — use login-token with app token (new API), fallback to login with user/pass
        if app_token:
            print(f"DEBUG: Using login-token with app token", flush=True)
            api_key = await _usgs_request(client, "login-token", {"username": username, "token": app_token})
        else:
            print(f"DEBUG: Using legacy login with username/password", flush=True)
            api_key = await _usgs_request(client, "login", {"username": username, "password": password})

        try:
            # 2) Scene search
            search_result = await _usgs_request(
                client,
                "scene-search",
                {
                    "datasetName": dataset,
                    "sceneFilter": {
                        "spatialFilter": {
                            "filterType": "mbr",
                            "lowerLeft": {"latitude": req.south, "longitude": req.west},
                            "upperRight": {"latitude": req.north, "longitude": req.east},
                        },
                        "acquisitionFilter": {
                            "start": req.startDate,
                            "end": req.endDate,
                        },
                        "cloudCoverFilter": {
                            "min": 0,
                            "max": req.maxCloudCover,
                            "includeUnknown": False,
                        },
                    },
                    "maxResults": req.maxResults,
                    "startingNumber": req.startingNumber,
                    "sortDirection": "DESC",
                    "sortField": "acquisitionDate",
                },
                api_key,
            )

            # 3) Format results
            results: List[ImageryResult] = []
            for scene in search_result.get("results", []):
                bounds = scene.get("spatialBounds") or scene.get("spatialCoverage")
                coords = bounds.get("coordinates", [[]])[0] if bounds else []
                results.append(
                    ImageryResult(
                        entityId=scene.get("entityId", ""),
                        displayId=scene.get("displayId", ""),
                        acquisitionDate=(scene.get("temporalCoverage", {}).get("startDate", "") or "Unknown").split(" ")[0],
                        cloudCover=scene.get("cloudCover", 0),
                        browseUrl=(scene.get("browse") or [{}])[0].get("browsePath")
                        or (scene.get("browse") or [{}])[0].get("thumbnailPath"),
                        spatialBounds=SpatialBounds(
                            north=coords[0][1] if len(coords) > 0 else 0,
                            south=coords[2][1] if len(coords) > 2 else 0,
                            east=coords[1][0] if len(coords) > 1 else 0,
                            west=coords[3][0] if len(coords) > 3 else 0,
                        ),
                        sensor=scene.get("displayId", "").split("_")[0] or "Unknown",
                        dataset=dataset,
                    )
                )

            return SearchResponse(results=results, totalHits=search_result.get("totalHits", 0))

        finally:
            # 4) Always logout
            try:
                await _usgs_request(client, "logout", {}, api_key)
            except Exception:
                pass


# ─── Download endpoint ──────────────────────────────────────────────────────
class DownloadRequest(BaseModel):
    entityId: str
    dataset: str = "landsat_ot_c2_l2"


class DownloadItem(BaseModel):
    url: str
    productName: str
    filesize: Optional[int] = None


class DownloadResponse(BaseModel):
    downloads: List[DownloadItem] = []
    error: Optional[str] = None


@router.post("/imagery/download", response_model=DownloadResponse)
async def get_download_urls(req: DownloadRequest):
    """Get download URLs for a scene's band files from USGS."""
    app_token = os.environ.get("USGS_APP_TOKEN")
    username = os.environ.get("USGS_USERNAME")
    password = os.environ.get("USGS_PASSWORD")

    if not app_token and (not username or not password):
        return DownloadResponse(error="USGS credentials not configured.")

    api_key = None
    async with httpx.AsyncClient() as client:
        # 1) Login
        if app_token:
            api_key = await _usgs_request(client, "login-token", {"username": username, "token": app_token})
        else:
            api_key = await _usgs_request(client, "login", {"username": username, "password": password})

        try:
            # 2) Get download options for this scene
            options = await _usgs_request(
                client,
                "download-options",
                {
                    "datasetName": req.dataset,
                    "entityIds": [req.entityId],
                },
                api_key,
            )

            if not options:
                return DownloadResponse(error="No download options available for this scene.")

            print(f"DEBUG: download-options returned {len(options)} options", flush=True)
            for i, opt in enumerate(options[:5]):  # Print first 5
                print(f"DEBUG:   opt[{i}]: id={opt.get('id')} productName={opt.get('productName')} available={opt.get('available')} downloadSystem={opt.get('downloadSystem')}", flush=True)

            # 3) Filter to available products and build download list
            available = [
                opt for opt in options
                if opt.get("available", False) and opt.get("downloadSystem") != "dds"
            ]

            print(f"DEBUG: {len(available)} available (non-dds) options", flush=True)

            if not available:
                # Try including all options if none are immediately available
                available = [opt for opt in options if opt.get("productName")]
                print(f"DEBUG: Fallback: {len(available)} options with productName", flush=True)

            if not available:
                return DownloadResponse(error="No downloadable products found for this scene.")

            # 4) Request download URLs
            downloads_input = [
                {"entityId": opt["entityId"], "productId": opt["id"]}
                for opt in available
            ]

            print(f"DEBUG: Requesting download for {len(downloads_input)} products", flush=True)

            download_result = await _usgs_request(
                client,
                "download-request",
                {"downloads": downloads_input, "label": f"griidai-{req.entityId[:20]}"},
                api_key,
            )

            print(f"DEBUG: download-request result keys: {list(download_result.keys()) if isinstance(download_result, dict) else type(download_result)}", flush=True)

            # 5) Build response from available downloads
            items: List[DownloadItem] = []

            # availableDownloads are ready immediately
            for dl in download_result.get("availableDownloads", []):
                print(f"DEBUG: availableDownload: url={dl.get('url', 'NONE')[:80] if dl.get('url') else 'NONE'}", flush=True)
                if dl.get("url"):
                    items.append(DownloadItem(
                        url=dl["url"],
                        productName=dl.get("productName", dl.get("displayId", "Download")),
                        filesize=dl.get("filesize"),
                    ))

            # preparingDownloads need time but we give their urls if present
            for dl in download_result.get("preparingDownloads", []):
                print(f"DEBUG: preparingDownload: url={dl.get('url', 'NONE')[:80] if dl.get('url') else 'NONE'}", flush=True)
                if dl.get("url"):
                    items.append(DownloadItem(
                        url=dl["url"],
                        productName=dl.get("productName", dl.get("displayId", "Download (preparing)")),
                        filesize=dl.get("filesize"),
                    ))

            print(f"DEBUG: Total download items: {len(items)}", flush=True)

            if not items:
                return DownloadResponse(error="Downloads are being prepared. Try again in a few minutes.")

            return DownloadResponse(downloads=items)

        finally:
            try:
                await _usgs_request(client, "logout", {}, api_key)
            except Exception:
                pass
