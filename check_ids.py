import re

with open('frontend/script.js', 'r', encoding='utf-8') as f:
    js_content = f.read()

with open('frontend/index.html', 'r', encoding='utf-8') as f:
    html_content = f.read()

html_ids = set(re.findall(r'id=["\']([^"\']+)["\']', html_content))
js_ids = set(re.findall(r"getElementById\(['\"]([^'\"]+)['\"]\)", js_content))

missing = js_ids - html_ids
if missing:
    print("IDs used in JS but not found in HTML:", missing)
else:
    print("All IDs used in JS exist in HTML.")
