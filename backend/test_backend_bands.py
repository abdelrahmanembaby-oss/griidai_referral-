import asyncio
import httpx
from app.api.imagery import _collect_bands, _get_copernicus_token
import os

async def main():
    product_id = "68961f71-902f-448e-874e-d1a78b6fe660" 
    
    # Force dotenv if not running via main.py
    from dotenv import load_dotenv
    load_dotenv()
    
    print(f"Testing the _collect_bands internal function directly...")
    async with httpx.AsyncClient() as client:
        try:
            print(f"Has credentials: username={bool(os.environ.get('COPERNICUS_USERNAME'))}")
            product_name, bands = await _collect_bands(client, product_id)
            print(f"Product Name: {product_name}")
            print(f"Found {len(bands)} bands.")
            for b in bands:
                print(f" - {b.name} ({b.resolution}): {b.size} bytes -> {b.nodePath}")
        except Exception as e:
            print(f"Error during collection: {e}")

if __name__ == "__main__":
    asyncio.run(main())
