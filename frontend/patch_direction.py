import codecs

# Patch index.html
path = 'c:/Users/hassa/Documents/ali/Factory-ERP/frontend/index.html'
with codecs.open(path, 'r', 'utf-8') as f:
    content = f.read()

# 1. Wizard Table Headers
old_wizard_th = r'''                                            <th class="p-2 border-b w-20">العمق</th>
                                            <th class="p-2 border-b">نوع الزرفيل</th>'''
new_wizard_th = '''                                            <th class="p-2 border-b w-20">العمق</th>
                                            <th class="p-2 border-b w-20">الاتجاه</th>
                                            <th class="p-2 border-b">نوع الزرفيل</th>'''
content = content.replace(old_wizard_th, new_wizard_th)

# 2. View Table Headers
old_view_th = r'''                                            <th class="p-3">العمق</th>
                                            <th class="p-3">الزرفيل</th>'''
new_view_th = '''                                            <th class="p-3">العمق</th>
                                            <th class="p-3">الاتجاه</th>
                                            <th class="p-3">الزرفيل</th>'''
content = content.replace(old_view_th, new_view_th)

# Increment cache string
content = content.replace('script.js?v=17', 'script.js?v=18')

with codecs.open(path, 'w', 'utf-8') as f:
    f.write(content)


# Patch script.js
path_js = 'c:/Users/hassa/Documents/ali/Factory-ERP/frontend/script.js'
with codecs.open(path_js, 'r', 'utf-8') as f:
    js_content = f.read()

# 1. addProjectDetailRow
old_add_row = r'''        <td class="p-2"><input type="number" class="w-full px-2 py-1 border rounded no-spinners" placeholder="عمق"></td>
        <td class="p-2">'''
new_add_row = '''        <td class="p-2"><input type="number" class="w-full px-2 py-1 border rounded no-spinners" placeholder="عمق"></td>
        <td class="p-2">
            <select class="w-full px-2 py-1 border rounded bg-white">
                <option value=""></option>
                <option value="RH">RH</option>
                <option value="LH">LH</option>
            </select>
        </td>
        <td class="p-2">'''
js_content = js_content.replace(old_add_row, new_add_row)

# 2. editProject
old_edit_row = r'''                    <td class="p-2"><input type="number" class="w-full p-2 border border-slate-300 rounded-lg text-sm no-spinners" value="${d.depth || ''}"></td>
                    <td class="p-2">'''
new_edit_row = '''                    <td class="p-2"><input type="number" class="w-full p-2 border border-slate-300 rounded-lg text-sm no-spinners" value="${d.depth || ''}"></td>
                    <td class="p-2">
                        <select class="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white">
                            <option value=""></option>
                            <option value="RH" ${d.direction === 'RH' ? 'selected' : ''}>RH</option>
                            <option value="LH" ${d.direction === 'LH' ? 'selected' : ''}>LH</option>
                        </select>
                    </td>
                    <td class="p-2">'''
js_content = js_content.replace(old_edit_row, new_edit_row)

# 3. viewProjectDetails
old_view_row = r'''                                <td class="p-3">${d.depth || '-'}</td>
                                <td class="p-3">${d.lock_type || '-'}</td>'''
new_view_row = '''                                <td class="p-3">${d.depth || '-'}</td>
                                <td class="p-3">${d.direction || '-'}</td>
                                <td class="p-3">${d.lock_type || '-'}</td>'''
js_content = js_content.replace(old_view_row, new_view_row)

# 4. Save Project Details Extraction
old_extraction = r'''                    depth: inputs[3].value || null,
                    lock_type: inputs[4].value || null,
                    profile_type: inputs[5].value || null,
                    door_type: inputs[6].value || null,
                    fire_resistance: inputs[7].checked ? 'نعم' : 'لا',
                    architrave: inputs[8].value || null,
                    architrave_2: inputs[9].value || null,
                    under_tile: inputs[10].value || null,
                    window_details: inputs[11].value || null,
                    notes: inputs[12].value || null'''
new_extraction = '''                    depth: inputs[3].value || null,
                    direction: inputs[4].value || null,
                    lock_type: inputs[5].value || null,
                    profile_type: inputs[6].value || null,
                    door_type: inputs[7].value || null,
                    fire_resistance: inputs[8].checked ? 'نعم' : 'لا',
                    architrave: inputs[9].value || null,
                    architrave_2: inputs[10].value || null,
                    under_tile: inputs[11].value || null,
                    window_details: inputs[12].value || null,
                    notes: inputs[13].value || null'''
js_content = js_content.replace(old_extraction, new_extraction)

with codecs.open(path_js, 'w', 'utf-8') as f:
    f.write(js_content)

print("Patch applied to add direction column")
