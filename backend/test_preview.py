import asyncio, httpx, os, json
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

async def main():
    username = os.getenv('COPERNICUS_USERNAME')
    password = os.getenv('COPERNICUS_PASSWORD')
    
    async with httpx.AsyncClient() as c:
        # 1. Get token
        print("Getting token...")
        resp = await c.post(
            'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token',
            data={'client_id': 'cdse-public', 'grant_type': 'password', 'username': username, 'password': password}
        )
        if resp.status_code != 200:
            print("Token fetch failed:", resp.status_code)
            with open("error.html", "w", encoding="utf-8") as f:
                f.write(resp.text)
            print("Wrote error to error.html")
            return
            
        token = resp.json().get('access_token')
        print('Got token:', token is not None)
        
        # 2. Get random latest product
        search_url = "https://catalogue.dataspace.copernicus.eu/odata/v1/Products"
        # Search for SENTINEL-2 products
        params = {
            "$filter": "Collection/Name eq 'SENTINEL-2'",
            "$top": "1",
            "$orderby": "ContentDate/Start desc"
        }
        
        sr = await c.get(search_url, params=params, timeout=30)
        print('Search status:', sr.status_code)
        
        products = sr.json().get('value', [])
        if not products:
            print('No products found.')
            return
            
        prod = products[0]
        prod_id = prod['Id']
        prod_name = prod.get('Name', '')
        print(f'Product: {prod_name} (ID: {prod_id})')
        
        # 3. Try Quicklook Endpoint directly
        quicklook_url = f"https://catalogue.dataspace.copernicus.eu/odata/v1/Products({prod_id})/Quicklook"
        print(f"Trying Quicklook Endpoint: {quicklook_url}")
        
        # with auth
        r_auth = await c.get(quicklook_url, headers={'Authorization': f'Bearer {token}'}, follow_redirects=True)
        print(f'Auth Status: {r_auth.status_code}, Content-Type: {r_auth.headers.get("content-type")}, Size: {len(r_auth.content)}')
        
        # without auth
        r_noauth = await c.get(quicklook_url, follow_redirects=True)
        print(f'NoAuth Status: {r_noauth.status_code}, Content-Type: {r_noauth.headers.get("content-type")}, Size: {len(r_noauth.content)}')
        
        # 4. Try Nodes Endpoint
        nodes_url = f"https://catalogue.dataspace.copernicus.eu/odata/v1/Products({prod_id})/Nodes"
        print(f"Trying Nodes Endpoint: {nodes_url}")
        r_nodes = await c.get(nodes_url, headers={'Authorization': f'Bearer {token}'}, follow_redirects=True)
        print(f'Nodes Status: {r_nodes.status_code}')
        if r_nodes.status_code == 200:
            nodes = r_nodes.json().get('value', [])
            for node in nodes:
                node_name = node.get('Name')
                if 'quicklook' in node_name.lower() or 'thumbnail' in node_name.lower() or 'inspire' in node_name.lower() or node_name.endswith('.jpeg') or node_name.endswith('.jpg'):
                    print(f"  Found potential quicklook node: {node_name} (ID: {node.get('Id')})")
                    node_id = node.get('Id')
                    # Try to download node value
                    node_val_url = f"https://catalogue.dataspace.copernicus.eu/odata/v1/Products({prod_id})/Nodes({node_id})/$value"
                    print(f"  Downloading node: {node_val_url}")
                    r_val = await c.get(node_val_url, headers={'Authorization': f'Bearer {token}'}, follow_redirects=True)
                    print(f'  Node download status: {r_val.status_code}, type: {r_val.headers.get("content-type")}, size: {len(r_val.content)}')

asyncio.run(main())
