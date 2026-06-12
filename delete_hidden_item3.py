import urllib.request
import urllib.parse
import json

API_URL = 'https://factory-erp-backend-wcs1.onrender.com'

# Login
try:
    data = urllib.parse.urlencode({'username': 'admin', 'password': '1'}).encode('utf-8')
    req = urllib.request.Request(f'{API_URL}/api/auth/token', data=data)
    with urllib.request.urlopen(req) as res:
        auth_data = json.loads(res.read().decode())
        token = auth_data['access_token']
        headers = {'Authorization': f'Bearer {token}'}
except Exception as e:
    print(f"Login error: {e}")
    exit(1)
        
# Get items
try:
    req_items = urllib.request.Request(f'{API_URL}/api/items/', headers=headers)
    with urllib.request.urlopen(req_items) as res_items:
        items = json.loads(res_items.read().decode())
        
        for item in items:
            if item['category'] == 'ألواح صاج':
                print(f"ID: {item['id']}, Name: {item['name']}, Sub: {item['subcategory']}")
                if not item.get('subcategory'):
                    print(f"Deleting item {item['id']}...")
                    req_del = urllib.request.Request(f'{API_URL}/api/items/{item["id"]}', method='DELETE', headers=headers)
                    with urllib.request.urlopen(req_del) as res_del:
                        print(f"Deleted! Status: {res_del.status}")
except Exception as e:
    print(f"Items error: {e}")
