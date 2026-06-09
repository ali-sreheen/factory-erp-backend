import sys
import codecs
import re

path = 'c:/Users/hassa/Documents/ali/Factory-ERP/frontend/script.js'

with codecs.open(path, 'r', 'utf-8') as f:
    content = f.read()

# 1. Replace loadProjects
load_projects_old = r'''async function loadProjects\(\) \{.*?(?=function viewProjectDetails)'''
load_projects_new = '''async function loadProjects() {
    const tbody = document.getElementById('projectsTableBody');
    const loading = document.getElementById('projectsLoadingIndicator');
    tbody.innerHTML = '';
    loading.classList.remove('hidden');
    
    try {
        const response = await authFetch(PROJECTS_URL + '/');
        if (response.ok) {
            const projects = await response.json();
            projects.forEach(p => {
                const tr = document.createElement('tr');
                tr.className = 'border-b hover:bg-slate-50 transition text-sm';
                
                const statusBadge = p.status === 'active' 
                    ? '<span class="px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg font-bold text-xs">فعال</span>'
                    : '<span class="px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg font-bold text-xs">قيد الانتظار</span>';
                
                tr.innerHTML = `
                    <td class="p-4 font-bold text-slate-800">${p.project_number || '-'}</td>
                    <td class="p-4">${p.name || '-'}</td>
                    <td class="p-4 text-slate-500">${p.contractor_name || '-'}</td>
                    <td class="p-4 text-slate-500" dir="ltr">${p.delivery_date ? new Date(p.delivery_date).toLocaleDateString() : '-'}</td>
                    <td class="p-4">${statusBadge}</td>
                    <td class="p-4 text-center">
                        <button onclick="viewProjectDetails(${p.id})" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition font-bold text-xs">التفاصيل</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
            if(projects.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-400">لا يوجد مشاريع مسجلة حالياً.</td></tr>`;
            }
        }
    } catch (e) {
        showToast('خطأ أثناء تحميل المشاريع', 'bg-rose-500', '✗');
    } finally {
        loading.classList.add('hidden');
    }
}

'''

content = re.sub(load_projects_old, load_projects_new, content, flags=re.DOTALL)


# 2. Replace viewProjectDetails
view_project_old = r'''async function viewProjectDetails\(id\) \{.*?(?=const projectWizardForm)'''
view_project_new = '''async function viewProjectDetails(id) {
    document.getElementById('moduleSelectorView').classList.add('hidden');
    document.getElementById('projectsView').classList.add('hidden');
    document.getElementById('projectWizardView').classList.add('hidden');
    const projectDetailView = document.getElementById('projectDetailView');
    if (projectDetailView) projectDetailView.classList.remove('hidden');
    
    document.getElementById('pdSubtitle').textContent = "جاري التحميل...";
    document.getElementById('pdEngineeringTableBody').innerHTML = '<tr><td colspan="9" class="p-4 text-center">جاري التحميل...</td></tr>';
    
    try {
        const response = await authFetch(`${PROJECTS_URL}/${id}`);
        if (!response.ok) throw new Error('فشل جلب تفاصيل المشروع');
        
        const p = await response.json();
        
        document.getElementById('pdTitle').textContent = p.name;
        document.getElementById('pdSubtitle').textContent = p.delivery_date ? `تاريخ التسليم المتوقع: ${new Date(p.delivery_date).toLocaleDateString()}` : '';
        
        document.getElementById('pdNumber').textContent = p.project_number;
        document.getElementById('pdContractor').textContent = p.contractor_name || '-';
        document.getElementById('pdDelivery').textContent = p.delivery_date ? new Date(p.delivery_date).toLocaleDateString() : '-';
        document.getElementById('pdEngineer').textContent = p.engineer_name || '-';
        document.getElementById('pdEngineerPhone').textContent = p.engineer_phone || '-';
        document.getElementById('pdLocation').textContent = p.location || '-';
        document.getElementById('pdPaint').textContent = p.paint_color || '-';
        
        // Let's just fetch all users and find the assignee by executive_manager_id
        document.getElementById('pdAssignee').textContent = '-';
        if (p.executive_manager_id) {
            authFetch(USERS_URL).then(res => res.json()).then(users => {
                const assignee = users.find(u => u.id === p.executive_manager_id);
                if (assignee) document.getElementById('pdAssignee').textContent = assignee.username;
            }).catch(() => {});
        }
        
        const badge = document.getElementById('pdStatusBadge');
        if (p.status === 'active') {
            badge.innerHTML = '<span class="px-4 py-2 bg-emerald-100 text-emerald-800 rounded-xl font-bold border border-emerald-200">مشروع فعال</span>';
        } else {
            badge.innerHTML = '<span class="px-4 py-2 bg-amber-100 text-amber-800 rounded-xl font-bold border border-amber-200">قيد الانتظار</span>';
        }
        
        const tbody = document.getElementById('pdEngineeringTableBody');
        tbody.innerHTML = '';
        if (p.details && p.details.length > 0) {
            p.details.forEach(d => {
                const tr = document.createElement('tr');
                tr.className = 'border-b hover:bg-slate-50 transition text-sm';
                tr.innerHTML = `
                    <td class="p-3 font-bold">${d.door_number || '-'}</td>
                    <td class="p-3">${d.width || '-'}</td>
                    <td class="p-3">${d.height || '-'}</td>
                    <td class="p-3">${d.depth || '-'}</td>
                    <td class="p-3">${d.lock_type || '-'}</td>
                    <td class="p-3">${d.profile_type || '-'}</td>
                    <td class="p-3">${d.door_type || '-'}</td>
                    <td class="p-3">${d.fire_resistance || '-'}</td>
                    <td class="p-3">${d.window_details || '-'}</td>
                `;
                tbody.appendChild(tr);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="9" class="p-4 text-center text-slate-500">لا يوجد تفاصيل هندسية مسجلة</td></tr>';
        }
        
        const attachContainer = document.getElementById('pdAttachments');
        attachContainer.innerHTML = '';
        if (p.attachments && p.attachments.length > 0) {
            p.attachments.forEach(a => {
                const link = document.createElement('a');
                link.href = `${API_HOST}${a.file_url}`;
                link.target = '_blank';
                link.className = 'flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition text-slate-700 font-bold text-sm';
                link.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                    <span class="truncate">${a.file_name}</span>
                `;
                attachContainer.appendChild(link);
            });
        } else {
            attachContainer.innerHTML = '<p class="text-sm text-slate-500 text-center py-4">لا يوجد مرفقات</p>';
        }
        
    } catch (e) {
        showToast(e.message, 'bg-rose-500', '✗');
        document.getElementById('pdSubtitle').textContent = "فشل التحميل";
    }
}

'''
content = re.sub(view_project_old, view_project_new, content, flags=re.DOTALL)


# 3. Replace projectWizardForm submission
form_old = r'''const projectWizardForm = document.getElementById\('projectWizardForm'\);.*'''
form_new = '''const projectWizardForm = document.getElementById('projectWizardForm');
if (projectWizardForm) {
    projectWizardForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const btnSubmit = document.getElementById('btnSubmitProject');
        const originalText = btnSubmit.innerHTML;
        btnSubmit.innerHTML = '<div class="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> جاري الحفظ...';
        btnSubmit.disabled = true;
        
        try {
            // Collect basic info matching ProjectCreate schema
            const payload = {
                name: document.getElementById('pwName').value,
                project_number: document.getElementById('pwProjectNumber').value,
                contractor_name: document.getElementById('pwContractor').value,
                delivery_date: document.getElementById('pwDeliveryDate').value || null,
                engineer_name: document.getElementById('pwEngineerName').value,
                engineer_phone: document.getElementById('pwEngineerPhone').value,
                location: document.getElementById('pwLocation').value,
                executive_manager_id: document.getElementById('pwAssignee').value ? parseInt(document.getElementById('pwAssignee').value) : null,
                paint_color: document.getElementById('pwPaintColor').value,
                status: document.querySelector('input[name="pwStatus"]:checked').value
            };
            
            // POST to create project
            const response = await authFetch(PROJECTS_URL + '/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || 'Failed to create project');
            }
            const createdProject = await response.json();
            
            // Post details ONE by ONE matching ProjectDetailCreate
            const rows = document.querySelectorAll('#projectDetailsTableBody tr');
            for (let tr of rows) {
                const inputs = tr.querySelectorAll('input');
                const detailPayload = {
                    door_number: inputs[0].value || null,
                    width: inputs[1].value || null,
                    height: inputs[2].value || null,
                    depth: inputs[3].value || null,
                    lock_type: inputs[4].value || null,
                    profile_type: inputs[5].value || null,
                    door_type: inputs[6].value || null,
                    fire_resistance: inputs[7].checked ? 'نعم' : 'لا',
                    window_details: inputs[8].value || null
                };
                
                await authFetch(`${PROJECTS_URL}/${createdProject.id}/details/`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(detailPayload)
                });
            }
            
            // Post attachments ONE by ONE matching ProjectAttachmentCreate
            const attachmentsInput = document.getElementById('pwAttachments');
            if (attachmentsInput.files.length > 0) {
                for (let file of attachmentsInput.files) {
                    const formData = new FormData();
                    formData.append('file', file); // API expects singular 'file'
                    await authFetch(`${PROJECTS_URL}/${createdProject.id}/attachments/`, {
                        method: 'POST',
                        body: formData
                    });
                }
            }
            
            showToast('تم إضافة المشروع بنجاح!', 'bg-emerald-500', '✓');
            showProjectsView();
        } catch (error) {
            showToast(error.message, 'bg-rose-500', '✗');
        } finally {
            btnSubmit.innerHTML = originalText;
            btnSubmit.disabled = false;
        }
    });
}
'''
content = re.sub(form_old, form_new, content, flags=re.DOTALL)

with codecs.open(path, 'w', 'utf-8') as f:
    f.write(content)

print("Successfully fixed payload mappings in script.js")
