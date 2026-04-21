import asyncio, httpx, os, json
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

async def main():
    username = os.getenv('COPERNICUS_USERNAME')
    password = os.getenv('COPERNICUS_PASSWORD')
    
    async with httpx.AsyncClient() as c:
        resp = await c.post(
            'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token',
            data={'client_id': 'cdse-public', 'grant_type': 'password', 'username': username, 'password': password}
        )
        try:
            token = resp.json().get('access_token')
            print('Got token:', token is not None)
        except json.JSONDecodeError:
            print("Token fetch failed. Status:", resp.status_code, "Text:", resp.text)
            return
        
        prod_id = '2b295c5f-25cd-5410-43e4-835c-bb991f851f20'
        
        # Method 1: Get Nodes
        nodes_url = f"https://catalogue.dataspace.copernicus.eu/odata/v1/Products({prod_id})/Nodes"
        nr = await c.get(nodes_url, headers={'Authorization': f'Bearer {token}'}, follow_redirects=True)
        print('Nodes status:', nr.status_code)
        
        # Method 2: Get product with expand
        prod_url = f"https://catalogue.dataspace.copernicus.eu/odata/v1/Products({prod_id})?$expand=Attributes,Nodes"
        pr = await c.get(prod_url, headers={'Authorization': f'Bearer {token}'}, follow_redirects=True)
        print('Product status:', pr.status_code)
        try:
            print('Product JSON keys:', list(pr.json().keys()))
            
            # Let's check if there is a Quicklook in the product metadata directly
            pdata = pr.json()
            print('Product metadata:', json.dumps({k: v for k, v in pdata.items() if k not in ['Attributes', 'Nodes']}, indent=2))
            
            if 'Nodes' in pdata:
                nodes = pdata['Nodes']
                for node in nodes:
                    print(f"Node: {node.get('Name')}")
        except json.JSONDecodeError:
            print("Failed to decode JSON. Text:", pr.text[:500])

asyncio.run(main())
