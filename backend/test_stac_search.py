import asyncio
import httpx
import json

async def main():
    product_name = "S2A_MSIL2A_20241229T085401_N0511_R107_T35RML_20241229T131407.SAFE"
    stac_search_url = "https://stac.dataspace.copernicus.eu/v1/search"
    
    # Search globally without collection filter
    payload = {
        "query": {
            "title": {"eq": product_name}
        }
    }
    
    async with httpx.AsyncClient() as client:
        print(f"Searching STAC API globally for {product_name}...")
        resp = await client.post(stac_search_url, json=payload, timeout=30)
        
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            features = data.get("features", [])
            print(f"Found {len(features)} STAC items.")
            
            if features:
                item = features[0]
                print(f"Collection: {item.get('collection')}")
                print(f"STAC ID: {item.get('id')}")
                assets = item.get("assets", {})
                print(f"Assets: {list(assets.keys())}")
                
                # Print B04 URL as an example
                b4 = assets.get("B04", {})
                print(f"B04 URL: {b4.get('href')}")
        else:
            print(f"Error: {resp.text}")

if __name__ == "__main__":
    asyncio.run(main())
