import requests

API_URL = 'https://factory-erp-backend-wcs1.onrender.com'

auth_res = requests.post(f'{API_URL}/api/auth/login', data={'username': 'admin', 'password': '1'})
if auth_res.status_code == 200:
    token = auth_res.json()['access_token']
    headers = {'Authorization': f'Bearer {token}'}
    
    items_res = requests.get(f'{API_URL}/api/items/', headers=headers)
    items = items_res.json()
    
    for item in items:
        if item['category'] == 'ألواح صاج':
            print(f"ID: {item['id']}, Name: {item['name']}, Sub: {item['subcategory']}")
            if not item.get('subcategory'):
                print(f"Deleting item {item['id']}...")
                del_res = requests.delete(f'{API_URL}/api/items/{item["id"]}', headers=headers)
                print(del_res.status_code)
