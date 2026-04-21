"""
Imagery Search API Router
Supports two providers:
  - USGS (Landsat)  → default
  - Copernicus Data Space (Sentinel-2)
"""
import os
import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional, List

router = APIRouter(tags=["imagery"])

# ─── Provider constants ──────────────────────────────────────────────────────
USGS_API_URL = "https://m2m.cr.usgs.gov/api/api/json/stable"
COPERNICUS_CATALOGUE_URL = "https://catalogue.dataspace.copernicus.eu/odata/v1/Products"
COPERNICUS_DOWNLOAD_URL = "https://download.dataspace.copernicus.eu/odata/v1/Products"
COPERNICUS_ZIPPER_URL = "https://zipper.dataspace.copernicus.eu/odata/v1/Products"
COPERNICUS_TOKEN_URL = (
    "https://identity.dataspace.copernicus.eu/auth/realms/CDSE"
    "/protocol/openid-connect/token"
)


# ─── Request / Response Models ───────────────────────────────────────────────
class SearchRequest(BaseModel):
    south: float
    north: float
    west: float
    east: float
    startDate: str
    endDate: str
    maxCloudCover: float = 100
    dataset: Optional[str] = None          # USGS dataset name
    maxResults: int = 50
    startingNumber: int = 1
    provider: str = "usgs"                 # "usgs" or "copernicus"
    collection: str = "SENTINEL-2"         # Copernicus collection name


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
    provider: str = "usgs"                 # which provider returned this result


class SearchResponse(BaseModel):
    results: List[ImageryResult] = []
    totalHits: int = 0
    error: Optional[str] = None


# ─── Download models ─────────────────────────────────────────────────────────
class DownloadRequest(BaseModel):
    entityId: str
    dataset: str = "landsat_ot_c2_l2"
    provider: str = "usgs"                 # "usgs" or "copernicus"


class DownloadItem(BaseModel):
    url: str
    productName: str
    filesize: Optional[int] = None
    headers: Optional[dict] = None         # auth headers for direct download


class DownloadResponse(BaseModel):
    downloads: List[DownloadItem] = []
    error: Optional[str] = None


# ═════════════════════════════════════════════════════════════════════════════
#  USGS helpers  (unchanged)
# ═════════════════════════════════════════════════════════════════════════════
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
        resp = await client.post(url, json=body, headers=headers, timeout=30, follow_redirects=True)

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


# ═════════════════════════════════════════════════════════════════════════════
#  Copernicus helpers
# ═════════════════════════════════════════════════════════════════════════════
import time
import asyncio

_copernicus_token_cache = {
    "token": None,
    "expires_at": 0,
}
_copernicus_token_lock = asyncio.Lock()

async def _get_copernicus_token(client: httpx.AsyncClient) -> str:
    """Obtain an OAuth2 access token from Copernicus Data Space with caching."""
    global _copernicus_token_cache
    
    # Check if we already have a valid token (with 60s buffer)
    if _copernicus_token_cache["token"] and time.time() < _copernicus_token_cache["expires_at"] - 60:
        return _copernicus_token_cache["token"]

    async with _copernicus_token_lock:
        # Double-check inside lock
        if _copernicus_token_cache["token"] and time.time() < _copernicus_token_cache["expires_at"] - 60:
            return _copernicus_token_cache["token"]
    username = os.environ.get("COPERNICUS_USERNAME")
    password = os.environ.get("COPERNICUS_PASSWORD")

    if not username or not password:
        raise HTTPException(
            status_code=500,
            detail="Copernicus credentials not configured. Set COPERNICUS_USERNAME and COPERNICUS_PASSWORD in .env",
        )

    try:
        resp = await client.post(
            COPERNICUS_TOKEN_URL,
            data={
                "grant_type": "password",
                "username": username,
                "password": password,
                "client_id": "cdse-public",
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=30,
        )

        if resp.status_code != 200:
            print(f"DEBUG: Copernicus token request failed HTTP {resp.status_code}: {resp.text}", flush=True)
            raise HTTPException(
                status_code=502,
                detail=f"Copernicus token request failed with HTTP {resp.status_code}",
            )

        token_data = resp.json()
        access_token = token_data.get("access_token")
        expires_in = token_data.get("expires_in", 600)  # default 10 mins if missing
        
        if not access_token:
            raise HTTPException(status_code=502, detail="No access_token in Copernicus response")

        # Cache the token
        _copernicus_token_cache["token"] = access_token
        _copernicus_token_cache["expires_at"] = time.time() + expires_in

        print("DEBUG: Copernicus token obtained successfully and cached", flush=True)
        return access_token

    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Copernicus token network error: {str(e)}")


async def _copernicus_search(
    client: httpx.AsyncClient,
    req: SearchRequest,
) -> SearchResponse:
    """Search Copernicus OData catalogue for Sentinel products."""

    # Build the bounding-box polygon (closed ring, counter-clockwise)
    polygon_wkt = (
        f"POLYGON(("
        f"{req.west} {req.south},"
        f"{req.east} {req.south},"
        f"{req.east} {req.north},"
        f"{req.west} {req.north},"
        f"{req.west} {req.south}"
        f"))"
    )

    # Build OData $filter
    filters = [
        f"Collection/Name eq '{req.collection}'",
        f"OData.CSC.Intersects(area=geography'SRID=4326;{polygon_wkt}')",
        f"ContentDate/Start gt {req.startDate}T00:00:00.000Z",
        f"ContentDate/Start lt {req.endDate}T23:59:59.999Z",
    ]

    # Cloud cover filter
    if req.maxCloudCover < 100:
        filters.append(
            f"Attributes/OData.CSC.DoubleAttribute/any("
            f"att:att/Name eq 'cloudCover' and "
            f"att/OData.CSC.DoubleAttribute/Value le {req.maxCloudCover:.2f})"
        )

    filter_str = " and ".join(filters)

    params = {
        "$filter": filter_str,
        "$orderby": "ContentDate/Start desc",
        "$top": str(req.maxResults),
        "$skip": str(max(0, req.startingNumber - 1)),
        "$count": "true",
        "$expand": "Attributes",
    }

    print(f"DEBUG: Copernicus search filter = {filter_str}", flush=True)

    try:
        resp = await client.get(
            COPERNICUS_CATALOGUE_URL,
            params=params,
            timeout=60,
        )

        if resp.status_code != 200:
            print(f"DEBUG: Copernicus search failed HTTP {resp.status_code}: {resp.text[:500]}", flush=True)
            return SearchResponse(error=f"Copernicus search failed with HTTP {resp.status_code}")

        data = resp.json()
        total_hits = data.get("@odata.count", 0)
        products = data.get("value", [])

        print(f"DEBUG: Copernicus search returned {len(products)} products, totalHits={total_hits}", flush=True)

        results: List[ImageryResult] = []
        for prod in products:
            # Extract spatial bounds from GeoFootprint
            geo = prod.get("GeoFootprint", {})
            coords = []
            if geo and geo.get("coordinates"):
                coords = geo["coordinates"][0] if geo.get("type") == "Polygon" else []

            # Calculate bounding box from polygon coordinates
            if coords:
                lons = [c[0] for c in coords]
                lats = [c[1] for c in coords]
                bounds = SpatialBounds(
                    north=max(lats),
                    south=min(lats),
                    east=max(lons),
                    west=min(lons),
                )
            else:
                bounds = SpatialBounds()

            # Extract cloud cover from Attributes
            cloud_cover = 0.0
            for attr in prod.get("Attributes", []):
                if attr.get("Name") == "cloudCover":
                    cloud_cover = float(attr.get("Value", 0))
                    break

            # Extract acquisition date
            content_date = prod.get("ContentDate", {})
            acq_date = (content_date.get("Start", "") or "")[:10]  # YYYY-MM-DD

            # Browse / quicklook URL (use local proxy to handle auth)
            prod_id = prod.get("Id", "")
            browse_url = None
            if prod_id:
                browse_url = f"http://localhost:8000/api/imagery/quicklook/{prod_id}"

            results.append(
                ImageryResult(
                    entityId=prod_id,
                    displayId=prod.get("Name", ""),
                    acquisitionDate=acq_date,
                    cloudCover=cloud_cover,
                    browseUrl=browse_url,
                    spatialBounds=bounds,
                    sensor=prod.get("Name", "").split("_")[0] or "Sentinel",
                    dataset=req.collection,
                    provider="copernicus",
                )
            )

        return SearchResponse(results=results, totalHits=total_hits)

    except httpx.RequestError as e:
        print(f"DEBUG: Copernicus search network error: {str(e)}", flush=True)
        return SearchResponse(error=f"Copernicus network error: {str(e)}")


async def _copernicus_download(
    client: httpx.AsyncClient,
    req: DownloadRequest,
) -> DownloadResponse:
    """Get download URL + auth header for a Copernicus product."""
    try:
        token = await _get_copernicus_token(client)
    except HTTPException as e:
        return DownloadResponse(error=e.detail)

    # Point to our new backend proxy endpoint
    download_url = f"http://localhost:8000/api/imagery/download_proxy/{req.entityId}"
    product_name = req.entityId  # will be overridden below if we can look it up

    # Optionally look up the product name from the catalogue
    try:
        meta_resp = await client.get(
            f"{COPERNICUS_CATALOGUE_URL}({req.entityId})",
            timeout=15,
        )
        if meta_resp.status_code == 200:
            meta = meta_resp.json()
            product_name = meta.get("Name", req.entityId)
    except Exception:
        pass  # non-critical

    return DownloadResponse(
        downloads=[
            DownloadItem(
                url=download_url,
                productName=product_name,
                headers={"Authorization": f"Bearer {token}"},
            )
        ]
    )


# ═════════════════════════════════════════════════════════════════════════════
#  Quicklook proxy  (streams image with auth for Copernicus)
# ═════════════════════════════════════════════════════════════════════════════
@router.get("/imagery/quicklook/{product_id}")
async def get_quicklook(product_id: str):
    """Proxy the Copernicus quicklook image so the browser can display it
    without needing OAuth2 headers on the <img> tag."""

    # Try multiple URL patterns — the catalogue /Quicklook endpoint often
    # returns 404 for Sentinel-2, so we try zipper and download endpoints too.
    quicklook_urls = [
        f"{COPERNICUS_ZIPPER_URL}({product_id})/Quicklook",
        f"{COPERNICUS_CATALOGUE_URL}({product_id})/Quicklook",
        f"{COPERNICUS_DOWNLOAD_URL}({product_id})/Quicklook",
    ]

    async with httpx.AsyncClient() as client:
        # Try to get a token (may fail if account is rate-limited)
        token = None
        try:
            token = await _get_copernicus_token(client)
        except HTTPException as e:
            print(f"DEBUG: Quicklook token failed: {e.detail}", flush=True)

        # Try each URL pattern
        for url in quicklook_urls:
            try:
                headers = {}
                if token:
                    headers["Authorization"] = f"Bearer {token}"

                resp = await client.get(
                    url,
                    headers=headers,
                    timeout=30,
                    follow_redirects=True,
                )
                print(f"DEBUG: Quicklook {url} -> {resp.status_code}, size={len(resp.content)}", flush=True)

                if resp.status_code == 200 and len(resp.content) > 100:
                    content_type = resp.headers.get("content-type", "image/jpeg")
                    return Response(
                        content=resp.content,
                        media_type=content_type,
                        headers={"Cache-Control": "public, max-age=86400"},
                    )
            except Exception as e:
                print(f"DEBUG: Quicklook {url} error: {e}", flush=True)
                continue

        # Fallback: try to get quicklook from the Assets endpoint
        try:
            assets_url = f"{COPERNICUS_CATALOGUE_URL}({product_id})?$expand=Assets"
            headers = {}
            if token:
                headers["Authorization"] = f"Bearer {token}"
            assets_resp = await client.get(assets_url, headers=headers, timeout=15, follow_redirects=True)
            if assets_resp.status_code == 200:
                assets_data = assets_resp.json()
                for asset in assets_data.get("Assets", []):
                    asset_type = (asset.get("Type") or "").lower()
                    if "quicklook" in asset_type or "thumbnail" in asset_type:
                        dl_link = asset.get("DownloadLink", "")
                        if dl_link:
                            print(f"DEBUG: Found quicklook asset: {dl_link}", flush=True)
                            img_resp = await client.get(
                                dl_link,
                                headers=headers,
                                timeout=30,
                                follow_redirects=True,
                            )
                            if img_resp.status_code == 200 and len(img_resp.content) > 100:
                                content_type = img_resp.headers.get("content-type", "image/jpeg")
                                return Response(
                                    content=img_resp.content,
                                    media_type=content_type,
                                    headers={"Cache-Control": "public, max-age=86400"},
                                )
        except Exception as e:
            print(f"DEBUG: Assets quicklook fallback error: {e}", flush=True)

        raise HTTPException(status_code=404, detail="Quicklook not available from any Copernicus endpoint")


# ═════════════════════════════════════════════════════════════════════════════
#  Download proxy (Streams Copernicus product archive to avoid browser header issues)
# ═════════════════════════════════════════════════════════════════════════════
@router.get("/imagery/download_proxy/{product_id}")
async def download_proxy(product_id: str):
    """Proxy the Copernicus download to avoid needing Authorization headers
    in the frontend browser download."""
    
    # We must construct a custom AsyncClient generator to keep it alive during streaming
    async def stream_generator():
        async with httpx.AsyncClient() as client:
            token = await _get_copernicus_token(client)
            download_url = f"{COPERNICUS_ZIPPER_URL}({product_id})/$value"
            
            # Using send with stream=True
            req = client.build_request("GET", download_url, headers={"Authorization": f"Bearer {token}"})
            resp = await client.send(req, stream=True, follow_redirects=True)
            
            if resp.status_code != 200:
                await resp.aclose()
                raise HTTPException(status_code=resp.status_code, detail="Download failed")
                
            async for chunk in resp.aiter_bytes(chunk_size=1024 * 1024):  # 1MB chunks
                yield chunk
            
            await resp.aclose()
            
    # Lookup product name for content-disposition header (optional)
    product_name = product_id
    async with httpx.AsyncClient() as client:
        try:
            meta_resp = await client.get(f"{COPERNICUS_CATALOGUE_URL}({product_id})", timeout=15)
            if meta_resp.status_code == 200:
                product_name = meta_resp.json().get("Name", product_id)
        except Exception:
            pass

    return StreamingResponse(
        stream_generator(),
        media_type="application/zip",
        headers={
            "Content-Disposition": f"attachment; filename=\"{product_name}.zip\""
        }
    )


# ═════════════════════════════════════════════════════════════════════════════
#  Copernicus Bands Listing + Individual Band Download
# ═════════════════════════════════════════════════════════════════════════════
import re

class BandInfo(BaseModel):
    name: str                # e.g. "B04"
    fullName: str            # e.g. "T35RML_20241229T085401_B04_10m.jp2"
    resolution: str          # e.g. "R10m"
    nodePath: str            # full Nodes() path for download
    size: int = 0


class BandsResponse(BaseModel):
    productId: str
    productName: str = ""
    bands: List[BandInfo] = []
    error: Optional[str] = None


async def _fetch_nodes(client: httpx.AsyncClient, url: str) -> list:
    """Fetch child nodes using an absolute Nodes API URL."""
    try:
        # Get token because deep nodes traversal on download.dataspace... requires auth
        token = await _get_copernicus_token(client)
        headers = {"Authorization": f"Bearer {token}"}
        
        resp = await client.get(url, headers=headers, timeout=30, follow_redirects=True)
        if resp.status_code != 200:
            print(f"DEBUG: Nodes API returned {resp.status_code} for {url}", flush=True)
            print(f"DEBUG: Nodes API text: {resp.text}", flush=True)
            return []
        data = resp.json()
        return data.get("result", [])
    except Exception as e:
        print(f"DEBUG: Nodes API error: {e}", flush=True)
        return []


async def _collect_bands(client: httpx.AsyncClient, product_id: str) -> tuple:
    """Recursively traverse the OData Nodes API to find all .jp2 band files.
    Returns (product_name, list_of_BandInfo)."""

    bands: List[BandInfo] = []
    product_name = ""

    # Level 1: Get the .SAFE folder
    root_url = f"{COPERNICUS_DOWNLOAD_URL}({product_id})/Nodes"
    level1 = await _fetch_nodes(client, root_url)
    if not level1:
        return product_name, bands

    safe_node = level1[0]
    safe_name = safe_node.get("Name", "")
    product_name = safe_name

    # Level 2: List contents of .SAFE folder
    safe_nodes_url = safe_node.get("Nodes", {}).get("uri")
    if not safe_nodes_url:
        return product_name, bands
    level2 = await _fetch_nodes(client, safe_nodes_url)

    granule_node = next((n for n in level2 if n.get("Name") == "GRANULE"), None)
    if not granule_node:
        return product_name, bands

    # Level 3: List GRANULE contents (the tile folder)
    granule_nodes_url = granule_node.get("Nodes", {}).get("uri")
    if not granule_nodes_url:
        return product_name, bands
    level3 = await _fetch_nodes(client, granule_nodes_url)
    if not level3:
        return product_name, bands

    tile_node = level3[0]
    tile_name = tile_node.get("Name", "")

    # Build the base Nodes path for download URLs
    base_nodes_path = f"Nodes({safe_name})/Nodes(GRANULE)/Nodes({tile_name})"

    # Level 4: List tile contents
    tile_nodes_url = tile_node.get("Nodes", {}).get("uri")
    if not tile_nodes_url:
        return product_name, bands
    level4 = await _fetch_nodes(client, tile_nodes_url)

    img_data_node = next((n for n in level4 if n.get("Name") == "IMG_DATA"), None)
    if not img_data_node:
        return product_name, bands

    # Level 5: List IMG_DATA contents
    img_data_nodes_url = img_data_node.get("Nodes", {}).get("uri")
    if not img_data_nodes_url:
        return product_name, bands
    level5 = await _fetch_nodes(client, img_data_nodes_url)

    for n5 in level5:
        name5 = n5.get("Name", "")
        children = n5.get("ChildrenNumber", 0)

        if children > 0 and name5.startswith("R"):
            # This is a resolution folder (R10m, R20m, R60m) → go one level deeper
            res_nodes_url = n5.get("Nodes", {}).get("uri")
            if res_nodes_url:
                level6 = await _fetch_nodes(client, res_nodes_url)
                for n6 in level6:
                    fname = n6.get("Name", "")
                    if fname.lower().endswith(".jp2"):
                        band_match = re.search(r'_(B\d{1,2}A?|TCI|AOT|WVP|SCL)_', fname)
                        band_name = band_match.group(1) if band_match else fname.split("_")[-1].replace(".jp2", "")
                        full_node_path = f"{base_nodes_path}/Nodes(IMG_DATA)/Nodes({name5})/Nodes({fname})"
                        bands.append(BandInfo(
                            name=f"{band_name} ({name5})",
                            fullName=fname,
                            resolution=name5,
                            nodePath=full_node_path,
                            size=n6.get("ContentLength", 0)
                        ))
        elif name5.lower().endswith(".jp2"):
            # Flat structure (L1C products)
            band_match = re.search(r'_(B\d{1,2}A?|TCI)_', name5)
            band_name = band_match.group(1) if band_match else name5.split("_")[-1].replace(".jp2", "")
            full_node_path = f"{base_nodes_path}/Nodes(IMG_DATA)/Nodes({name5})"
            bands.append(BandInfo(
                name=band_name,
                fullName=name5,
                resolution="native",
                nodePath=full_node_path,
                size=n5.get("ContentLength", 0)
            ))

    # Sort bands by name
    bands.sort(key=lambda b: (b.resolution, b.name))
    return product_name, bands


async def _collect_landsat_bands(client: httpx.AsyncClient, product_id: str):
    """Collect band files from a Landsat product on Copernicus (flat TIF structure)."""
    bands: list[BandInfo] = []

    # Level 1: Get product root node
    nodes_url = f"{COPERNICUS_DOWNLOAD_URL}({product_id})/Nodes"
    level1 = await _fetch_nodes(client, nodes_url)
    if not level1:
        return "", bands

    root_node = level1[0]
    product_name = root_node.get("Name", "")

    # Level 2: List all files inside the product folder
    root_nodes_url = root_node.get("Nodes", {}).get("uri")
    if not root_nodes_url:
        return product_name, bands
    level2 = await _fetch_nodes(client, root_nodes_url)

    # Landsat band naming: *_B1.TIF, *_B2.TIF, ..., *_BQA.TIF
    for node in level2:
        fname = node.get("Name", "")
        if not fname.upper().endswith(".TIF"):
            continue

        # Extract band name from filename like LC08_..._B4.TIF or LC08_..._BQA.TIF
        band_match = re.search(r'_(B\d{1,2}|BQA|SAA|SZA|VAA|VZA)\.TIF$', fname, re.IGNORECASE)
        if not band_match:
            continue

        band_name = band_match.group(1).upper()
        full_node_path = f"Nodes({product_name})/Nodes({fname})"

        bands.append(BandInfo(
            name=band_name,
            fullName=fname,
            resolution="30m" if band_name.startswith("B") else "metadata",
            nodePath=full_node_path,
            size=node.get("ContentLength", 0),
        ))

    bands.sort(key=lambda b: b.name)
    return product_name, bands


@router.get("/imagery/copernicus/bands/{product_id}", response_model=BandsResponse)
async def list_copernicus_bands(product_id: str):
    """List all available bands inside a Copernicus product (Sentinel or Landsat)."""
    async with httpx.AsyncClient() as client:
        try:
            # First, detect the product type from the product name
            token = await _get_copernicus_token(client)
            meta_url = f"{COPERNICUS_CATALOGUE_URL}({product_id})"
            meta_resp = await client.get(meta_url)
            product_name = meta_resp.json().get("Name", "") if meta_resp.status_code == 200 else ""

            # Route to the appropriate collector based on product name
            if product_name.startswith("LC08") or product_name.startswith("LC09"):
                product_name, bands = await _collect_landsat_bands(client, product_id)
            else:
                product_name, bands = await _collect_bands(client, product_id)

            return BandsResponse(
                productId=product_id,
                productName=product_name,
                bands=bands,
            )
        except Exception as e:
            print(f"DEBUG: list_copernicus_bands error: {e}", flush=True)
            return BandsResponse(
                productId=product_id,
                error=str(e),
            )


@router.get("/imagery/copernicus/download-band/{product_id}")
async def download_band_proxy(product_id: str, node_path: str):
    """Download a single band file from a Copernicus product via the zipper endpoint."""
    
    # Ensure no single quotes are in the path (handles cached frontend data)
    node_path = node_path.replace("'", "")

    # Extract filename from node_path for content-disposition
    filename_match = re.search(r"Nodes\(([^)]+)\)\s*$", node_path)
    filename = filename_match.group(1) if filename_match else f"band_{product_id}.jp2"

    client = httpx.AsyncClient(timeout=httpx.Timeout(300, connect=30))
    try:
        token = await _get_copernicus_token(client)
        download_url = f"{COPERNICUS_ZIPPER_URL}({product_id})/{node_path}/$value"
        print(f"DEBUG: Band download URL: {download_url}", flush=True)

        req = client.build_request("GET", download_url, headers={"Authorization": f"Bearer {token}"})
        resp = await client.send(req, stream=True, follow_redirects=True)

        if resp.status_code != 200:
            body = await resp.aread()
            await resp.aclose()
            await client.aclose()
            print(f"DEBUG: Band download failed: status={resp.status_code}, body={body[:500]}", flush=True)
            raise HTTPException(status_code=resp.status_code, detail=f"Band download failed: {body[:200].decode(errors='replace')}")

        # Stream the successful response
        async def stream_and_close():
            try:
                async for chunk in resp.aiter_bytes(chunk_size=1024 * 1024):
                    yield chunk
            finally:
                await resp.aclose()
                await client.aclose()

        return StreamingResponse(
            stream_and_close(),
            media_type="application/octet-stream",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        await client.aclose()
        print(f"DEBUG: Band download exception: {e}", flush=True)
        raise HTTPException(status_code=500, detail=str(e))


# ═════════════════════════════════════════════════════════════════════════════
#  Geocoding endpoint  (unchanged)
# ═════════════════════════════════════════════════════════════════════════════
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
                "accept-language": "en",
            },
            headers={
                "User-Agent": "GriidAi/1.0",
                "Accept-Language": "en",
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


# ═════════════════════════════════════════════════════════════════════════════
#  Main search endpoint  (now routes by provider)
# ═════════════════════════════════════════════════════════════════════════════
@router.post("/imagery/search", response_model=SearchResponse)
async def search_imagery(req: SearchRequest):
    # ── Copernicus path ──────────────────────────────────────────────────
    if req.provider == "copernicus":
        async with httpx.AsyncClient() as client:
            return await _copernicus_search(client, req)

    # ── USGS path (default) ──────────────────────────────────────────────
    app_token = os.environ.get("USGS_APP_TOKEN")
    username = os.environ.get("USGS_USERNAME")
    password = os.environ.get("USGS_PASSWORD")

    if not app_token and (not username or not password):
        return SearchResponse(error="USGS credentials not configured. Set USGS_APP_TOKEN in .env")

    dataset = req.dataset or "landsat_ot_c2_l2"
    api_key = None

    async with httpx.AsyncClient() as client:
        # 1) Login
        if app_token:
            print("DEBUG: Using login-token with app token", flush=True)
            api_key = await _usgs_request(client, "login-token", {"username": username, "token": app_token})
        else:
            print("DEBUG: Using legacy login with username/password", flush=True)
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
                        provider="usgs",
                    )
                )

            return SearchResponse(results=results, totalHits=search_result.get("totalHits", 0))

        finally:
            # 4) Always logout
            try:
                await _usgs_request(client, "logout", {}, api_key)
            except Exception:
                pass


# ═════════════════════════════════════════════════════════════════════════════
#  Download endpoint  (now routes by provider)
# ═════════════════════════════════════════════════════════════════════════════
@router.post("/imagery/download", response_model=DownloadResponse)
async def get_download_urls(req: DownloadRequest):
    """Get download URLs for a scene's files."""

    # ── Copernicus path ──────────────────────────────────────────────────
    if req.provider == "copernicus":
        async with httpx.AsyncClient() as client:
            return await _copernicus_download(client, req)

    # ── USGS path (default) ──────────────────────────────────────────────
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
            for i, opt in enumerate(options[:5]):
                print(f"DEBUG:   opt[{i}]: id={opt.get('id')} productName={opt.get('productName')} available={opt.get('available')} downloadSystem={opt.get('downloadSystem')}", flush=True)

            # 3) Filter to available products
            available = [
                opt for opt in options
                if opt.get("available", False) and opt.get("downloadSystem") != "dds"
            ]

            print(f"DEBUG: {len(available)} available (non-dds) options", flush=True)

            if not available:
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

            # 5) Build response
            items: List[DownloadItem] = []

            for dl in download_result.get("availableDownloads", []):
                if dl.get("url"):
                    items.append(DownloadItem(
                        url=dl["url"],
                        productName=dl.get("productName", dl.get("displayId", "Download")),
                        filesize=dl.get("filesize"),
                    ))

            for dl in download_result.get("preparingDownloads", []):
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
