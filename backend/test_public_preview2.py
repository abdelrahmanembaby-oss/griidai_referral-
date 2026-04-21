import asyncio, httpx, json

async def main():
    prod_id = '010590cd-4b6e-417d-b441-51d07f1085d2'
    async with httpx.AsyncClient() as c:
        nodes_url = f"https://catalogue.dataspace.copernicus.eu/odata/v1/Products({prod_id})/Nodes"
        nr = await c.get(nodes_url, follow_redirects=True)
        print("Status:", nr.status_code)
        if nr.status_code == 200:
            nodes = nr.json().get('value', [])
            for n in nodes:
                print("Node:", n.get('Name'))
        
        # Test expand Attributes
        prod_url = f"https://catalogue.dataspace.copernicus.eu/odata/v1/Products({prod_id})?$expand=Attributes"
        pr = await c.get(prod_url, follow_redirects=True)
        if pr.status_code == 200:
            data = pr.json()
            print("Product properties:", {k: v for k, v in data.items() if k != 'Attributes' and k != 'GeoFootprint'})

asyncio.run(main())
