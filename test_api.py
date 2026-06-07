import urllib.request
import urllib.parse
import json

base_url = "http://127.0.0.1:8000"
data = urllib.parse.urlencode({"username": "admin", "password": "admin123"}).encode('utf-8')
req = urllib.request.Request(f"{base_url}/api/auth/token", data=data)
resp = urllib.request.urlopen(req)
token = json.loads(resp.read().decode())["access_token"]
headers = {"Authorization": f"Bearer {token}"}

try:
    print("Items Status:", urllib.request.urlopen(urllib.request.Request(f"{base_url}/api/items/", headers=headers)).getcode())
except urllib.error.HTTPError as e:
    print("Items Error:", e.code, e.read().decode())
