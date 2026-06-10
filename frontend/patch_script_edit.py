import sys
import codecs
import re

path = 'c:/Users/hassa/Documents/ali/Factory-ERP/frontend/script.js'

with codecs.open(path, 'r', 'utf-8') as f:
    content = f.read()

# 1. Add currentEditingProjectId and editProject function, and update openProjectWizard
open_wizard_old = r'''function openProjectWizard\(\) \{
    document\.getElementById\('moduleSelectorView'\)\.classList\.add\('hidden'\);'''

open_wizard_new = '''let currentEditingProjectId = null;

function openProjectWizard() {
    currentEditingProjectId = null;
    const title = document.getElementById('wizardTitle');
    if (title) title.textContent = 'إضافة مشروع جديد';
    
    const existAtt = document.getElementById('existingAttachmentsContainer');
    if (existAtt) existAtt.classList.add('hidden');

    document.getElementById('moduleSelectorView').classList.add('hidden');'''

content = content.replace('function openProjectWizard() {\n    document.getElementById(\'moduleSelectorView\').classList.add(\'hidden\');', open_wizard_new)


# Add editProject and delete attachment function at the end
if 'window.editProject =' not in content:
    content += '''

window.deleteExistingAttachment = async function(attachmentId, element) {
    if (confirm("هل أنت متأكد من حذف هذا المرفق؟ لا يمكن التراجع.")) {
        try {
            const response = await authFetch(`${API_HOST}/api/projects/attachments/${attachmentId}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('فشل الحذف');
            element.remove();
            showToast('تم حذف المرفق', 'bg-emerald-500', '✓');
        } catch (e) {
            showToast(e.message, 'bg-rose-500', '✗');
        }
    }
};

window.editProject = async function(projectId) {
    try {
        const response = await authFetch(`${PROJECTS_URL}/${projectId}`);
        if (!response.ok) throw new Error('فشل جلب تفاصيل المشروع');
        const p = await response.json();
        
        currentEditingProjectId = p.id;
        const title = document.getElementById('wizardTitle');
        if (title) title.textContent = 'تعديل مشروع';
        
        document.getElementById('moduleSelectorView').classList.add('hidden');
        document.getElementById('projectsView').classList.add('hidden');
        document.getElementById('projectDetailView').classList.add('hidden');
        document.getElementById('projectWizardView').classList.remove('hidden');
        
        document.getElementById('projectWizardForm').reset();
        await loadAssignees();
        
        // Fill basic info
        document.getElementById('pwName').value = p.name || '';
        document.getElementById('pwProjectNumber').value = p.project_number || '';
        document.getElementById('pwContractor').value = p.contractor_name || '';
        if (p.delivery_date) {
            document.getElementById('pwDeliveryDate').value = p.delivery_date.split('T')[0];
        }
        document.getElementById('pwEngineerName').value = p.engineer_name || '';
        document.getElementById('pwEngineerPhone').value = p.engineer_phone || '';
        document.getElementById('pwLocation').value = p.location || '';
        document.getElementById('pwAssignee').value = p.executive_manager_id || '';
        document.getElementById('pwPaintColor').value = p.paint_color || '';
        
        const statusRadios = document.querySelectorAll('input[name="pwStatus"]');
        statusRadios.forEach(r => {
            if (r.value === p.status) r.checked = true;
        });
        
        // Fill details
        const tbody = document.getElementById('projectDetailsTableBody');
        tbody.innerHTML = '';
        if (p.details && p.details.length > 0) {
            p.details.forEach(d => {
                const tr = document.createElement('tr');
                tr.className = 'border-b hover:bg-slate-50 transition';
                tr.innerHTML = `
                    <td class="p-2"><input type="text" class="w-20 p-2 border border-slate-300 rounded-lg text-sm text-center font-bold" value="${d.door_number || ''}"></td>
                    <td class="p-2"><input type="number" step="0.1" class="w-20 p-2 border border-slate-300 rounded-lg text-sm text-center" value="${d.width || ''}"></td>
                    <td class="p-2"><input type="number" step="0.1" class="w-20 p-2 border border-slate-300 rounded-lg text-sm text-center" value="${d.height || ''}"></td>
                    <td class="p-2"><input type="number" step="0.1" class="w-20 p-2 border border-slate-300 rounded-lg text-sm text-center" value="${d.depth || ''}"></td>
                    <td class="p-2"><input type="text" class="w-full p-2 border border-slate-300 rounded-lg text-sm" value="${d.lock_type || ''}"></td>
                    <td class="p-2"><input type="text" class="w-full p-2 border border-slate-300 rounded-lg text-sm" value="${d.profile_type || ''}"></td>
                    <td class="p-2"><input type="text" class="w-full p-2 border border-slate-300 rounded-lg text-sm" value="${d.door_type || ''}"></td>
                    <td class="p-2 text-center"><input type="checkbox" class="w-5 h-5 text-indigo-600 rounded" ${d.fire_resistance === 'نعم' ? 'checked' : ''}></td>
                    <td class="p-2"><input type="text" class="w-full p-2 border border-slate-300 rounded-lg text-sm" value="${d.window_details || ''}"></td>
                    <td class="p-2 text-center">
                        <button type="button" onclick="this.closest('tr').remove()" class="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition" title="حذف السطر">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }
        
        // Fill attachments
        const existAttContainer = document.getElementById('existingAttachmentsContainer');
        const existAttList = document.getElementById('existingAttachmentsList');
        if (existAttContainer && existAttList) {
            existAttList.innerHTML = '';
            if (p.attachments && p.attachments.length > 0) {
                existAttContainer.classList.remove('hidden');
                p.attachments.forEach(a => {
                    const div = document.createElement('div');
                    div.className = 'flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg shadow-sm';
                    div.innerHTML = `
                        <div class="flex items-center gap-2 overflow-hidden">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-indigo-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                            <a href="${API_HOST}${a.file_url}" target="_blank" class="text-sm font-bold text-slate-700 truncate hover:text-indigo-600 transition">${a.file_name}</a>
                        </div>
                        <button type="button" onclick="deleteExistingAttachment(${a.id}, this.closest('div.flex'))" class="text-rose-500 hover:text-rose-700 p-1 bg-rose-50 hover:bg-rose-100 rounded transition flex-shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    `;
                    existAttList.appendChild(div);
                });
            } else {
                existAttContainer.classList.add('hidden');
            }
        }
        
        goToWizardStep(1);
    } catch(e) {
        showToast(e.message, 'bg-rose-500', '✗');
    }
};
'''

# 2. Modify projectWizardForm submit logic
submit_old = r'''            // POST to create project
            const response = await authFetch\(PROJECTS_URL \+ '/', \{
                method: 'POST',
                headers: \{ 'Content-Type': 'application/json' \},
                body: JSON\.stringify\(payload\)
            \}\);
            
            if \(\!response\.ok\) \{
                const err = await response\.json\(\);
                throw new Error\(err\.detail \|\| 'Failed to create project'\);
            \}
            const createdProject = await response\.json\(\);'''

submit_new = '''            let response, createdProject;
            if (currentEditingProjectId) {
                response = await authFetch(`${PROJECTS_URL}/${currentEditingProjectId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (!response.ok) throw new Error('Failed to update project');
                createdProject = await response.json();
                
                // Delete existing details before inserting new ones
                await authFetch(`${PROJECTS_URL}/${currentEditingProjectId}/details`, { method: 'DELETE' });
            } else {
                response = await authFetch(PROJECTS_URL + '/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.detail || 'Failed to create project');
                }
                createdProject = await response.json();
            }'''

content = re.sub(submit_old, submit_new, content)

# 3. Add Edit Button in viewProjectDetails
edit_btn_old = r'''                    const deleteHtml = `
                        <button onclick="deleteProjectWithConfirmation\(\$\{p\.id\}\)" class="mr-3 px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl transition font-bold flex items-center gap-2">'''

edit_btn_new = '''                    const editHtml = `
                        <button onclick="editProject(${p.id})" class="mr-3 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 rounded-xl transition font-bold flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            تعديل المشروع
                        </button>
                    `;
                    const deleteHtml = `
                        <button onclick="deleteProjectWithConfirmation(${p.id})" class="mr-3 px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl transition font-bold flex items-center gap-2">'''

content = content.replace(edit_btn_old, edit_btn_new)

# 4. update badge.innerHTML to include editHtml
badge_inner_old = r'''badge\.innerHTML = `<div class="flex items-center">` \+ selectHtml \+ deleteHtml \+ `</div>`;'''
badge_inner_new = '''badge.innerHTML = `<div class="flex items-center">` + selectHtml + editHtml + deleteHtml + `</div>`;'''
content = content.replace(badge_inner_old, badge_inner_new)

with codecs.open(path, 'w', 'utf-8') as f:
    f.write(content)

print("Patched script.js for full project editing")
