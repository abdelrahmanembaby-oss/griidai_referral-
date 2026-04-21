"""Test the OData Nodes API - print raw JSON response."""
import asyncio
import httpx
import os
import json
from dotenv import load_dotenv

load_dotenv("backend/.env")

COPERNICUS_CATALOGUE_URL = "https://catalogue.dataspace.copernicus.eu/odata/v1/Products"

async def main():
    product_id = "68961f71-902f-448e-874e-d1a78b6fe660"
    
    async with httpx.AsyncClient() as client:
        # Test 1: Get product metadata to see the Name (SAFE folder name)
        print("=== Product Metadata ===")
        resp = await client.get(f"{COPERNICUS_CATALOGUE_URL}({product_id})", timeout=30, follow_redirects=True)
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            meta = resp.json()
            print(f"Name: {meta.get('Name')}")
            print(f"S3Path: {meta.get('S3Path')}")
            print(f"ContentType: {meta.get('ContentType')}")
        
        # Test 2: Nodes endpoint - print raw JSON
        print("\n=== Nodes (raw JSON) ===")
        url = f"{COPERNICUS_CATALOGUE_URL}({product_id})/Nodes"
        resp = await client.get(url, timeout=30, follow_redirects=True)
        print(f"Status: {resp.status_code}")
        print(f"Content-Type: {resp.headers.get('content-type')}")
        raw = resp.text
        print(f"Raw response (first 2000 chars): {raw[:2000]}")
        
        # Test 3: Try with the product name in the path
        if resp.status_code == 200:
            data = resp.json()
            print(f"\nKeys: {list(data.keys())}")
            print(f"Full JSON: {json.dumps(data, indent=2)[:3000]}")

if __name__ == "__main__":
    asyncio.run(main())
