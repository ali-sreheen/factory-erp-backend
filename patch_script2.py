import sys
import re

with open('frontend/script.js', 'r', encoding='utf-8') as f:
    content = f.read()

# The button in renderItems:
old_btns = '''                <button onclick="deleteItem(${item.id}, '${item.name.replace(/'/g, "\\'")}')" class="w-full bg-rose-500 hover:bg-rose-600 text-white font-bold py-2 px-4 rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-sm hover:shadow mt-1">
                    حذف البند
                </button>'''

new_btns = '''                <button onclick="openMoveItemModal(${item.id})" class="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2 px-4 rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-sm hover:shadow mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                    نقل البند
                </button>
                <button onclick="deleteItem(${item.id}, '${item.name.replace(/'/g, "\\'")}')" class="w-full bg-rose-500 hover:bg-rose-600 text-white font-bold py-2 px-4 rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-sm hover:shadow mt-1">
                    حذف البند
                </button>'''

if 'openMoveItemModal(${item.id})' not in content:
    content = content.replace(old_btns, new_btns)

with open('frontend/script.js', 'w', encoding='utf-8') as f:
    f.write(content)
