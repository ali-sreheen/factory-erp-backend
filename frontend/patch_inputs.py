import sys
import codecs
import re

path = 'c:/Users/hassa/Documents/ali/Factory-ERP/frontend/script.js'

with codecs.open(path, 'r', 'utf-8') as f:
    content = f.read()

# Replace the w-full inside addProjectDetailRow
old_row = r'''        <td class="p-2"><input type="text" class="w-full px-2 py-1 border rounded" placeholder="رقم"></td>
        <td class="p-2"><input type="number" step="0.01" class="w-full px-2 py-1 border rounded" placeholder="عرض"></td>
        <td class="p-2"><input type="number" step="0.01" class="w-full px-2 py-1 border rounded" placeholder="طول"></td>
        <td class="p-2"><input type="number" step="0.01" class="w-full px-2 py-1 border rounded" placeholder="عمق"></td>'''
new_row = '''        <td class="p-2"><input type="text" class="w-16 px-2 py-1 border rounded text-center font-bold" placeholder="رقم"></td>
        <td class="p-2"><input type="number" step="0.01" class="w-16 px-2 py-1 border rounded text-center" placeholder="عرض"></td>
        <td class="p-2"><input type="number" step="0.01" class="w-16 px-2 py-1 border rounded text-center" placeholder="طول"></td>
        <td class="p-2"><input type="number" step="0.01" class="w-16 px-2 py-1 border rounded text-center" placeholder="عمق"></td>'''

content = content.replace(old_row, new_row)

# Also update the w-20 in editProject to w-16 to be consistent and small
old_edit_row = r'''                    <td class="p-2"><input type="text" class="w-20 p-2 border border-slate-300 rounded-lg text-sm text-center font-bold" value="${d.door_number || ''}"></td>
                    <td class="p-2"><input type="number" step="0.1" class="w-20 p-2 border border-slate-300 rounded-lg text-sm text-center" value="${d.width || ''}"></td>
                    <td class="p-2"><input type="number" step="0.1" class="w-20 p-2 border border-slate-300 rounded-lg text-sm text-center" value="${d.height || ''}"></td>
                    <td class="p-2"><input type="number" step="0.1" class="w-20 p-2 border border-slate-300 rounded-lg text-sm text-center" value="${d.depth || ''}"></td>'''
new_edit_row = '''                    <td class="p-2"><input type="text" class="w-16 px-2 py-2 border border-slate-300 rounded-lg text-sm text-center font-bold" value="${d.door_number || ''}"></td>
                    <td class="p-2"><input type="number" step="0.1" class="w-16 px-1 py-2 border border-slate-300 rounded-lg text-sm text-center" value="${d.width || ''}"></td>
                    <td class="p-2"><input type="number" step="0.1" class="w-16 px-1 py-2 border border-slate-300 rounded-lg text-sm text-center" value="${d.height || ''}"></td>
                    <td class="p-2"><input type="number" step="0.1" class="w-16 px-1 py-2 border border-slate-300 rounded-lg text-sm text-center" value="${d.depth || ''}"></td>'''

content = content.replace(old_edit_row, new_edit_row)

with codecs.open(path, 'w', 'utf-8') as f:
    f.write(content)

print("Patched script.js inputs")
