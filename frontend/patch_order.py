import codecs

# Patch index.html
path = 'c:/Users/hassa/Documents/ali/Factory-ERP/frontend/index.html'
with codecs.open(path, 'r', 'utf-8') as f:
    content = f.read()

# 1. Wizard Table Headers
old_wizard_th = r'''                                            <th class="p-2 border-b">الكشفة</th>
                                            <th class="p-2 border-b">الكشفة 2</th>
                                            <th class="p-2 border-b">تحت البلاط</th>
                                            <th class="p-2 border-b">ملاحظات</th>
                                            <th class="p-2 border-b">الشباك</th>'''
new_wizard_th = '''                                            <th class="p-2 border-b w-16">الكشفة</th>
                                            <th class="p-2 border-b w-16">الكشفة 2</th>
                                            <th class="p-2 border-b">تحت البلاط</th>
                                            <th class="p-2 border-b">الشباك</th>
                                            <th class="p-2 border-b">ملاحظات</th>'''
content = content.replace(old_wizard_th, new_wizard_th)

# 2. View Table Headers
old_view_th = r'''                                            <th class="p-3">الكشفة</th>
                                            <th class="p-3">الكشفة 2</th>
                                            <th class="p-3">تحت البلاط</th>
                                            <th class="p-3">ملاحظات</th>
                                            <th class="p-3">تفصيل الشباك</th>'''
new_view_th = '''                                            <th class="p-3 w-16">الكشفة</th>
                                            <th class="p-3 w-16">الكشفة 2</th>
                                            <th class="p-3">تحت البلاط</th>
                                            <th class="p-3">تفصيل الشباك</th>
                                            <th class="p-3">ملاحظات</th>'''
content = content.replace(old_view_th, new_view_th)

# Increment cache string
content = content.replace('script.js?v=14', 'script.js?v=15')

with codecs.open(path, 'w', 'utf-8') as f:
    f.write(content)


# Patch script.js
path_js = 'c:/Users/hassa/Documents/ali/Factory-ERP/frontend/script.js'
with codecs.open(path_js, 'r', 'utf-8') as f:
    js_content = f.read()

# 1. addProjectDetailRow
old_add_row = r'''        <td class="p-2"><input type="text" class="w-full px-2 py-1 border rounded" placeholder="الكشفة"></td>
        <td class="p-2"><input type="text" class="w-full px-2 py-1 border rounded" placeholder="الكشفة 2"></td>
        <td class="p-2"><input type="text" class="w-full px-2 py-1 border rounded" placeholder="تحت البلاط"></td>
        <td class="p-2"><input type="text" class="w-full px-2 py-1 border rounded" placeholder="ملاحظات"></td>
        <td class="p-2"><input type="text" class="w-full px-2 py-1 border rounded" placeholder="الشباك"></td>'''
new_add_row = '''        <td class="p-2"><input type="text" class="w-full px-2 py-1 border rounded" placeholder="الكشفة"></td>
        <td class="p-2"><input type="text" class="w-full px-2 py-1 border rounded" placeholder="الكشفة 2"></td>
        <td class="p-2"><input type="text" class="w-full px-2 py-1 border rounded" placeholder="تحت البلاط"></td>
        <td class="p-2"><input type="text" class="w-full px-2 py-1 border rounded" placeholder="الشباك"></td>
        <td class="p-2"><input type="text" class="w-full px-2 py-1 border rounded" placeholder="ملاحظات"></td>'''
js_content = js_content.replace(old_add_row, new_add_row)

# 2. editProject
old_edit_row = r'''                    <td class="p-2"><input type="text" class="w-full p-2 border border-slate-300 rounded-lg text-sm" value="${d.architrave || ''}"></td>
                    <td class="p-2"><input type="text" class="w-full p-2 border border-slate-300 rounded-lg text-sm" value="${d.architrave_2 || ''}"></td>
                    <td class="p-2"><input type="text" class="w-full p-2 border border-slate-300 rounded-lg text-sm" value="${d.under_tile || ''}"></td>
                    <td class="p-2"><input type="text" class="w-full p-2 border border-slate-300 rounded-lg text-sm" value="${d.notes || ''}"></td>
                    <td class="p-2"><input type="text" class="w-full p-2 border border-slate-300 rounded-lg text-sm" value="${d.window_details || ''}"></td>'''
new_edit_row = '''                    <td class="p-2"><input type="text" class="w-full p-2 border border-slate-300 rounded-lg text-sm" value="${d.architrave || ''}"></td>
                    <td class="p-2"><input type="text" class="w-full p-2 border border-slate-300 rounded-lg text-sm" value="${d.architrave_2 || ''}"></td>
                    <td class="p-2"><input type="text" class="w-full p-2 border border-slate-300 rounded-lg text-sm" value="${d.under_tile || ''}"></td>
                    <td class="p-2"><input type="text" class="w-full p-2 border border-slate-300 rounded-lg text-sm" value="${d.window_details || ''}"></td>
                    <td class="p-2"><input type="text" class="w-full p-2 border border-slate-300 rounded-lg text-sm" value="${d.notes || ''}"></td>'''
js_content = js_content.replace(old_edit_row, new_edit_row)

# 3. viewProjectDetails
old_view_row = r'''                                <td class="p-3">${d.architrave || '-'}</td>
                                <td class="p-3">${d.architrave_2 || '-'}</td>
                                <td class="p-3">${d.under_tile || '-'}</td>
                                <td class="p-3">${d.notes || '-'}</td>
                                <td class="p-3">${d.window_details || '-'}</td>'''
new_view_row = '''                                <td class="p-3">${d.architrave || '-'}</td>
                                <td class="p-3">${d.architrave_2 || '-'}</td>
                                <td class="p-3">${d.under_tile || '-'}</td>
                                <td class="p-3">${d.window_details || '-'}</td>
                                <td class="p-3">${d.notes || '-'}</td>'''
js_content = js_content.replace(old_view_row, new_view_row)

# 4. Save Project Details Extraction
old_extraction = r'''                    architrave: inputs[8].value || null,
                    architrave_2: inputs[9].value || null,
                    under_tile: inputs[10].value || null,
                    notes: inputs[11].value || null,
                    window_details: inputs[12].value || null'''
new_extraction = '''                    architrave: inputs[8].value || null,
                    architrave_2: inputs[9].value || null,
                    under_tile: inputs[10].value || null,
                    window_details: inputs[11].value || null,
                    notes: inputs[12].value || null'''
js_content = js_content.replace(old_extraction, new_extraction)

with codecs.open(path_js, 'w', 'utf-8') as f:
    f.write(js_content)

print("Patch applied to rearrange headers and index width")
