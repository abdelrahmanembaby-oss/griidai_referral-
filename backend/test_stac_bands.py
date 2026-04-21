import asyncio
import httpx

async def main():
    # A known Sentinel-2 L2A product name
    product_name = "S2A_MSIL2A_20241229T085401_N0511_R107_T35RML_20241229T131407.SAFE"
    stac_id = product_name.replace(".SAFE", "")
    
    # STAC API endpoint for Sentinel-2 L2A
    stac_url = f"https://stac.dataspace.copernicus.eu/v1/collections/SENTINEL-2-L2A/items/{stac_id}"
    
    async with httpx.AsyncClient() as client:
        print(f"Fetching from STAC API: {stac_url}")
        resp = await client.get(stac_url, timeout=30)
        
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            assets = data.get("assets", {})
            print(f"Found {len(assets)} assets/bands:")
            
            for key, asset in list(assets.items())[:10]: # Print first 10
                title = asset.get("title", key)
                href = asset.get("href", "")
                roles = asset.get("roles", [])
                print(f"  - {key}: {title} | roles={roles}")
                print(f"    URL: {href}")
            print(f"... and {len(assets) - 10} more assets")
        else:
            print(f"Error: {resp.text}")

if __name__ == "__main__":
    asyncio.run(main())
