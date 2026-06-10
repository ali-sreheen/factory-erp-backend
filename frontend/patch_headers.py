import sys
import codecs

path = 'c:/Users/hassa/Documents/ali/Factory-ERP/frontend/index.html'

with codecs.open(path, 'r', 'utf-8') as f:
    content = f.read()

# Replace the <th> tags inside the projectDetailsTableBody's thead
old_th = '''                                            <th class="p-2 border-b">رقم الباب</th>
                                            <th class="p-2 border-b">العرض</th>
                                            <th class="p-2 border-b">الطول</th>
                                            <th class="p-2 border-b">العمق</th>'''
new_th = '''                                            <th class="p-2 border-b w-16">رقم الباب</th>
                                            <th class="p-2 border-b w-16">العرض</th>
                                            <th class="p-2 border-b w-16">الطول</th>
                                            <th class="p-2 border-b w-16">العمق</th>'''

content = content.replace(old_th, new_th)

with codecs.open(path, 'w', 'utf-8') as f:
    f.write(content)

print("Patched index.html headers")
