import asyncio, httpx, json

async def main():
    product_name = 'S2A_MSIL1C_20260318T075031_N0512_R135_T40VCN_20260318T080851.SAFE'
    # STAC IDs usually don't have .SAFE
    stac_id = product_name.replace('.SAFE', '')
    stac_url = f"https://catalogue.dataspace.copernicus.eu/stac/collections/SENTINEL-2/items/{stac_id}"
    
    async with httpx.AsyncClient() as c:
        print(f"Querying STAC API for {stac_id}...")
        r = await c.get(stac_url, timeout=30)
        print("Status:", r.status_code)
        if r.status_code == 200:
            feat = r.json()
            print("Product STAC ID:", feat.get('id'))
            assets = feat.get('assets', {})
            if 'thumbnail' in assets:
                print("Thumbnail URL:", assets['thumbnail'].get('href'))
            for k, v in assets.items():
                print(f"Asset {k}: {v.get('href')}")
        else:
            print("Failed:", r.text)

asyncio.run(main())
