import asyncio
import httpx
import os
import json
from dotenv import load_dotenv

load_dotenv()

async def check_landsat_thumb():
    client = httpx.AsyncClient(timeout=30)
    
    username = os.environ.get("COPERNICUS_USERNAME")
    password = os.environ.get("COPERNICUS_PASSWORD")
    resp = await client.post(
        "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token",
        data={"grant_type": "password", "username": username, "password": password, "client_id": "cdse-public"},
    )
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    pid = "57c7e0c4-c2a3-4048-abd7-4dfecc42272a"
    
    # Check Assets for this product
    assets_url = f"https://catalogue.dataspace.copernicus.eu/odata/v1/Products({pid})?$expand=Assets"
    r = await client.get(assets_url, headers=headers, timeout=15)
    data = r.json()
    assets = data.get("Assets", [])
    print(f"Assets count: {len(assets)}")
    for a in assets:
        print(f"  Type={a.get('Type')}, DownloadLink={a.get('DownloadLink', 'N/A')}")
    
    # Also list all files to see if there's a thumb/browse file
    nodes_url = f"https://download.dataspace.copernicus.eu/odata/v1/Products({pid})/Nodes"
    nr = await client.get(nodes_url, headers=headers, timeout=15)
    l1 = nr.json().get("result", [])
    if l1:
        l2_url = l1[0].get("Nodes", {}).get("uri")
        if l2_url:
            l2r = await client.get(l2_url, headers=headers, timeout=15)
            files = l2r.json().get("result", [])
            print(f"\nAll files ({len(files)}):")
            for f in files:
                print(f"  {f['Name']}  (size={f.get('ContentLength', 0)})")
    
    await client.aclose()

if __name__ == "__main__":
    asyncio.run(check_landsat_thumb())
