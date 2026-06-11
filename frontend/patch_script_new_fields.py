import sys
import codecs
import re

path = 'c:/Users/hassa/Documents/ali/Factory-ERP/frontend/script.js'

with codecs.open(path, 'r', 'utf-8') as f:
    content = f.read()

# 1. Update addProjectDetailRow
old_add_row = r'''        <td class="p-2 text-center"><input type="checkbox" class="w-4 h-4"></td>
        <td class="p-2"><input type="text" class="w-full px-2 py-1 border rounded" placeholder="الشباك"></td>'''
new_add_row = '''        <td class="p-2 text-center"><input type="checkbox" class="w-4 h-4"></td>
        <td class="p-2"><input type="text" class="w-full px-2 py-1 border rounded" placeholder="الكشفة"></td>
        <td class="p-2"><input type="text" class="w-full px-2 py-1 border rounded" placeholder="الكشفة 2"></td>
        <td class="p-2"><input type="text" class="w-full px-2 py-1 border rounded" placeholder="تحت البلاط"></td>
        <td class="p-2"><input type="text" class="w-full px-2 py-1 border rounded" placeholder="ملاحظات"></td>
        <td class="p-2"><input type="text" class="w-full px-2 py-1 border rounded" placeholder="الشباك"></td>'''
content = content.replace(old_add_row, new_add_row)

# 2. Update editProject
old_edit_row = r'''                    <td class="p-2 text-center"><input type="checkbox" class="w-5 h-5 text-indigo-600 rounded" ${d.fire_resistance === 'نعم' ? 'checked' : ''}></td>
                    <td class="p-2"><input type="text" class="w-full p-2 border border-slate-300 rounded-lg text-sm" value="${d.window_details || ''}"></td>'''
new_edit_row = '''                    <td class="p-2 text-center"><input type="checkbox" class="w-5 h-5 text-indigo-600 rounded" ${d.fire_resistance === 'نعم' ? 'checked' : ''}></td>
                    <td class="p-2"><input type="text" class="w-full p-2 border border-slate-300 rounded-lg text-sm" value="${d.architrave || ''}"></td>
                    <td class="p-2"><input type="text" class="w-full p-2 border border-slate-300 rounded-lg text-sm" value="${d.architrave_2 || ''}"></td>
                    <td class="p-2"><input type="text" class="w-full p-2 border border-slate-300 rounded-lg text-sm" value="${d.under_tile || ''}"></td>
                    <td class="p-2"><input type="text" class="w-full p-2 border border-slate-300 rounded-lg text-sm" value="${d.notes || ''}"></td>
                    <td class="p-2"><input type="text" class="w-full p-2 border border-slate-300 rounded-lg text-sm" value="${d.window_details || ''}"></td>'''
content = content.replace(old_edit_row, new_edit_row)

# 3. Update viewProjectDetails to display new columns
old_view_row = r'''                                <td class="p-3 text-center">
                                    <span class="px-2 py-1 rounded-full text-xs font-bold ${d.fire_resistance === 'نعم' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}">${d.fire_resistance || 'لا'}</span>
                                </td>
                                <td class="p-3">${d.window_details || '-'}</td>'''
new_view_row = '''                                <td class="p-3 text-center">
                                    <span class="px-2 py-1 rounded-full text-xs font-bold ${d.fire_resistance === 'نعم' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}">${d.fire_resistance || 'لا'}</span>
                                </td>
                                <td class="p-3">${d.architrave || '-'}</td>
                                <td class="p-3">${d.architrave_2 || '-'}</td>
                                <td class="p-3">${d.under_tile || '-'}</td>
                                <td class="p-3">${d.notes || '-'}</td>
                                <td class="p-3">${d.window_details || '-'}</td>'''
content = content.replace(old_view_row, new_view_row)

# 4. Extract Project Notes in editProject (pwNotes)
# Find the line: document.getElementById('pwPaintColor').value = p.paint_color || '';
old_pw_paint = r'''        document.getElementById('pwPaintColor').value = p.paint_color || '';'''
new_pw_paint = '''        document.getElementById('pwPaintColor').value = p.paint_color || '';
        if(document.getElementById('pwNotes')) document.getElementById('pwNotes').value = p.notes || '';'''
content = content.replace(old_pw_paint, new_pw_paint)

# 5. Show Project Notes in viewProjectDetails (pdNotes)
# Find: document.getElementById('pdAssignee').textContent = p.executive_manager ...
old_pd_assignee = r'''        document.getElementById('pdAssignee').textContent = p.executive_manager ? p.executive_manager.username : '-';'''
new_pd_assignee = '''        document.getElementById('pdAssignee').textContent = p.executive_manager ? p.executive_manager.username : '-';
        if(document.getElementById('pdNotes')) document.getElementById('pdNotes').textContent = p.notes || '-';'''
content = content.replace(old_pd_assignee, new_pd_assignee)

# 6. Extraction on Submit (payload extraction)
old_payload = r'''                executive_manager_id: document.getElementById('pwAssignee').value ? parseInt(document.getElementById('pwAssignee').value) : null,
                paint_color: document.getElementById('pwPaintColor').value,
                status: document.querySelector('input[name="pwStatus"]:checked').value'''
new_payload = '''                executive_manager_id: document.getElementById('pwAssignee').value ? parseInt(document.getElementById('pwAssignee').value) : null,
                paint_color: document.getElementById('pwPaintColor').value,
                notes: document.getElementById('pwNotes') ? document.getElementById('pwNotes').value : null,
                status: document.querySelector('input[name="pwStatus"]:checked').value'''
content = content.replace(old_payload, new_payload)

# 7. Details extraction on Submit
old_details_payload = r'''                    door_type: inputs[6].value || null,
                    fire_resistance: inputs[7].checked ? 'نعم' : 'لا',
                    window_details: inputs[8].value || null
                };'''
new_details_payload = '''                    door_type: inputs[6].value || null,
                    fire_resistance: inputs[7].checked ? 'نعم' : 'لا',
                    architrave: inputs[8].value || null,
                    architrave_2: inputs[9].value || null,
                    under_tile: inputs[10].value || null,
                    notes: inputs[11].value || null,
                    window_details: inputs[12].value || null
                };'''
content = content.replace(old_details_payload, new_details_payload)

with codecs.open(path, 'w', 'utf-8') as f:
    f.write(content)

print("Patched script.js with new fields")
