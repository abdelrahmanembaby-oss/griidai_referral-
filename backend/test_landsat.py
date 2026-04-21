import asyncio
import httpx
import os
import json
from dotenv import load_dotenv

load_dotenv()

async def list_landsat_nodes():
    client = httpx.AsyncClient(timeout=30)
    
    # 1. Get token
    username = os.environ.get("COPERNICUS_USERNAME")
    password = os.environ.get("COPERNICUS_PASSWORD")
    resp = await client.post(
        "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token",
        data={
            "grant_type": "password",
            "username": username,
            "password": password,
            "client_id": "cdse-public",
        },
    )
    token = resp.json()["access_token"]
    
    # 2. Search for 1 Landsat 8 product
    search_url = "https://catalogue.dataspace.copernicus.eu/odata/v1/Products"
    search_params = {
        "$filter": "Collection/Name eq 'LANDSAT-8'",
        "$top": "1",
        "$orderby": "ContentDate/Start desc"
    }
    s_resp = await client.get(search_url, params=search_params)
    data = s_resp.json()
    if not data.get("value"):
        print("No Landsat 8 found")
        return
        
    product = data["value"][0]
    pid = product["Id"]
    name = product["Name"]
    print(f"Product: {name} (ID: {pid})")
    
    # 3. List Nodes Level 1
    nodes_url = f"https://download.dataspace.copernicus.eu/odata/v1/Products({pid})/Nodes"
    n_resp = await client.get(nodes_url, headers={"Authorization": f"Bearer {token}"})
    n_data = n_resp.json()
    print("\nLevel 1 Nodes:", json.dumps(n_data, indent=2))
    
    # 4. List Nodes Level 2 (if any)
    for node in n_data.get("result", []):
        uri = node.get("Nodes", {}).get("uri")
        if uri:
            l2_resp = await client.get(uri, headers={"Authorization": f"Bearer {token}"})
            print(f"\nLevel 2 Nodes for {node['Name']}:", json.dumps(l2_resp.json(), indent=2))
            break # just check the first one

    await client.aclose()

if __name__ == "__main__":
    asyncio.run(list_landsat_nodes())
