import asyncio
import httpx
import os
from dotenv import load_dotenv

load_dotenv("backend/.env")

COPERNICUS_CATALOGUE_URL = "https://catalogue.dataspace.copernicus.eu/odata/v1/Products"
COPERNICUS_DOWNLOAD_URL = "https://download.dataspace.copernicus.eu/odata/v1/Products"
COPERNICUS_ZIPPER_URL = "https://zipper.dataspace.copernicus.eu/odata/v1/Products"
COPERNICUS_TOKEN_URL = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token"

async def get_token(client):
    username = os.environ.get("COPERNICUS_USERNAME")
    password = os.environ.get("COPERNICUS_PASSWORD")
    resp = await client.post(
        COPERNICUS_TOKEN_URL,
        data={
            "grant_type": "password",
            "username": username,
            "password": password,
            "client_id": "cdse-public",
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    if resp.status_code != 200:
        print(f"Token error: {resp.text}")
        return None
    return resp.json()["access_token"]

async def test_download():
    product_id = "68961f71-902f-448e-874e-d1a78b6fe660"
    
    async with httpx.AsyncClient() as client:
        token = await get_token(client)
        if not token:
            return
            
        urls = [
            f"{COPERNICUS_ZIPPER_URL}({product_id})/$value",
            f"{COPERNICUS_DOWNLOAD_URL}({product_id})/$value",
        ]
        
        for url in urls:
            print(f"Testing URL: {url}")
            # Try a HEAD request first
            req = client.build_request("HEAD", url, headers={"Authorization": f"Bearer {token}"})
            resp = await client.send(req, follow_redirects=True)
            print(f"HEAD Status: {resp.status_code}")
            print(f"HEAD Headers: {resp.headers}")
            if resp.status_code != 200:
                print(f"HEAD Text: {resp.text[:200]}")
            
            # Try GET stream
            req = client.build_request("GET", url, headers={"Authorization": f"Bearer {token}"})
            resp = await client.send(req, stream=True, follow_redirects=True)
            print(f"GET Status: {resp.status_code}")
            if resp.status_code == 200:
                print(f"GET Headers: {resp.headers}")
                await resp.aclose()
                print("Success! Can download.")
                break
            else:
                text = await resp.aread()
                print(f"GET Text: {text.decode('utf-8', errors='ignore')[:200]}")
                await resp.aclose()

if __name__ == "__main__":
    asyncio.run(test_download())
