import asyncio, httpx, json

async def main():
    prod_id = '2b295c5f-25cd-5410-43e4-835c-bb991f851f20'
    async with httpx.AsyncClient() as c:
        # Try finding quicklook in nodes Without Auth
        nodes_url = f"https://catalogue.dataspace.copernicus.eu/odata/v1/Products({prod_id})/Nodes"
        print("Fetching:", nodes_url)
        nr = await c.get(nodes_url, follow_redirects=True)
        print("Status:", nr.status_code)
        if nr.status_code == 200:
            nodes = nr.json().get('value', [])
            quicklook_node = None
            for n in nodes:
                name = n.get('Name', '').lower()
                print("Node:", name)
                if 'quicklook' in name or name.endswith('.jpg') or name.endswith('.jpeg'):
                    quicklook_node = n
            
            if quicklook_node:
                node_id = quicklook_node['Id']
                val_url = f"https://catalogue.dataspace.copernicus.eu/odata/v1/Products({prod_id})/Nodes({node_id})/$value"
                print("Trying to download without auth:", val_url)
                vr = await c.get(val_url, follow_redirects=True)
                print("Download Status Without Auth:", vr.status_code)
                print("Content-Type:", vr.headers.get('content-type'))
                print("Preview Size:", len(vr.content))

asyncio.run(main())
