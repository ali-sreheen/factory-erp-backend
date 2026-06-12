import sys

with open('frontend/script.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Define globalItems if not exists
if 'let globalItems = [];' not in content:
    content = content.replace('let globalDepartments = [];', 'let globalDepartments = [];\nlet globalItems = [];')

# 2. Set globalItems = items; in fetchDepartmentCounts
old_fetch = 'const items = await itemsResponse.json();'
new_fetch = 'const items = await itemsResponse.json();\n        globalItems = items;'
if new_fetch not in content:
    content = content.replace(old_fetch, new_fetch, 1) # First occurrence is in fetchDepartmentCounts

# 3. Set globalItems = items; in loadItems
old_load = 'const items = await response.json();\n        renderItems(items);'
new_load = 'const items = await response.json();\n        globalItems = items;\n        renderItems(items);'
if new_load not in content:
    content = content.replace(old_load, new_load)

with open('frontend/script.js', 'w', encoding='utf-8') as f:
    f.write(content)
