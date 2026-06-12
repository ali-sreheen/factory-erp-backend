import sys
import re

with open('frontend/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

btn_html = '''<button id="btnManageSubDepts" onclick="enterSubDeptView(currentDepartment)" class="hidden bg-indigo-100 text-indigo-700 hover:bg-indigo-200 px-4 py-2 rounded-xl text-sm font-bold transition flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                            الأقسام الفرعية
                        </button>'''

if 'id="btnManageSubDepts"' not in content:
    content = re.sub(r'(<p class="text-slate-500 text-sm mt-0\.5">تصفح المنتجات وإجراء عمليات الصرف والإضافة\.</p>\s*</div>)', r'\1\n                        ' + btn_html, content)
    content = content.replace('<div class="flex items-center gap-4">\n                        <button id="btnBackToDepts"', '<div class="flex-grow flex justify-between items-center">\n                    <div class="flex items-center gap-4">\n                        <button id="btnBackToDepts"')
    content = content.replace(btn_html, btn_html + '\n                    </div>')

with open('frontend/index.html', 'w', encoding='utf-8') as f:
    f.write(content)
