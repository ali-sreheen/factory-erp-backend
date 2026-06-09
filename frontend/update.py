import sys
import codecs

path = 'c:/Users/hassa/Documents/ali/Factory-ERP/frontend/script.js'

with codecs.open(path, 'r', 'utf-8') as f:
    content = f.read()

content = content.replace('    showDepartmentsView();', '    showModuleSelectorView();', 1)

target = 'async function showDepartmentsView() {'
replacement = '''async function showDepartmentsView() {
    currentDepartment = '';
    currentSubcategory = '';
    
    const moduleSelector = document.getElementById('moduleSelectorView');
    if(moduleSelector) moduleSelector.classList.add('hidden');
    const projectsView = document.getElementById('projectsView');
    if(projectsView) projectsView.classList.add('hidden');
    const projectWizardView = document.getElementById('projectWizardView');
    if(projectWizardView) projectWizardView.classList.add('hidden');
'''

content = content.replace(target + '\n    currentDepartment = \'\';\n    currentSubcategory = \'\';\n', replacement)

new_code = '''
// ==========================================
//           PROJECTS MODULE LOGIC
// ==========================================

const PROJECTS_URL = `${API_HOST}/api/projects`;

function showModuleSelectorView() {
    document.getElementById('moduleSelectorView').classList.remove('hidden');
    document.getElementById('projectsView').classList.add('hidden');
    document.getElementById('projectWizardView').classList.add('hidden');
    departmentsView.classList.add('hidden');
    accessoriesSubDeptView.classList.add('hidden');
    departmentDetailView.classList.add('hidden');
    adminView.classList.add('hidden');
}

function showProjectsView() {
    document.getElementById('moduleSelectorView').classList.add('hidden');
    document.getElementById('projectsView').classList.remove('hidden');
    document.getElementById('projectWizardView').classList.add('hidden');
    departmentsView.classList.add('hidden');
    accessoriesSubDeptView.classList.add('hidden');
    departmentDetailView.classList.add('hidden');
    adminView.classList.add('hidden');
    loadProjects();
}

function openProjectWizard() {
    document.getElementById('moduleSelectorView').classList.add('hidden');
    document.getElementById('projectsView').classList.add('hidden');
    document.getElementById('projectWizardView').classList.remove('hidden');
    departmentsView.classList.add('hidden');
    accessoriesSubDeptView.classList.add('hidden');
    departmentDetailView.classList.add('hidden');
    adminView.classList.add('hidden');
    
    document.getElementById('projectWizardForm').reset();
    document.getElementById('projectDetailsTableBody').innerHTML = '';
    document.getElementById('attachmentsList').innerHTML = '';
    goToWizardStep(1);
    loadAssignees();
}

function goToWizardStep(stepNumber) {
    document.querySelectorAll('.wizard-step-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(`wizardStep${stepNumber}`).classList.remove('hidden');
    
    const progressLine = document.getElementById('wizardProgressLine');
    const progressMap = { 1: '0%', 2: '33.33%', 3: '66.66%', 4: '100%' };
    progressLine.style.width = progressMap[stepNumber];
    
    document.querySelectorAll('.wizard-step-indicator').forEach(el => {
        const s = parseInt(el.dataset.step);
        if (s < stepNumber) {
            el.className = 'w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm bg-emerald-500 text-white shadow-md wizard-step-indicator transition-colors';
            el.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" /></svg>';
        } else if (s === stepNumber) {
            el.className = 'w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm bg-emerald-600 text-white shadow-md wizard-step-indicator transition-colors scale-110 transform';
            el.innerHTML = s;
        } else {
            el.className = 'w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm bg-slate-200 text-slate-500 wizard-step-indicator transition-colors';
            el.innerHTML = s;
        }
    });
}

function updateStatusStyling(status) {
    const pendingLabel = document.getElementById('statusLabelPending');
    const activeLabel = document.getElementById('statusLabelActive');
    
    if (status === 'pending') {
        pendingLabel.className = 'border-2 rounded-2xl p-6 cursor-pointer transition focus-within:ring-2 hover:bg-slate-50 border-amber-500 bg-amber-50';
        activeLabel.className = 'border-2 rounded-2xl p-6 cursor-pointer transition focus-within:ring-2 hover:bg-slate-50 border-slate-200 bg-white';
    } else {
        pendingLabel.className = 'border-2 rounded-2xl p-6 cursor-pointer transition focus-within:ring-2 hover:bg-slate-50 border-slate-200 bg-white';
        activeLabel.className = 'border-2 rounded-2xl p-6 cursor-pointer transition focus-within:ring-2 hover:bg-slate-50 border-emerald-500 bg-emerald-50';
    }
}

let projectDetailsCount = 0;
function addProjectDetailRow() {
    projectDetailsCount++;
    const tbody = document.getElementById('projectDetailsTableBody');
    const tr = document.createElement('tr');
    tr.className = 'border-b hover:bg-slate-50';
    tr.innerHTML = `
        <td class="p-2"><input type="text" class="w-full px-2 py-1 border rounded" placeholder="رقم"></td>
        <td class="p-2"><input type="number" step="0.01" class="w-full px-2 py-1 border rounded" placeholder="عرض"></td>
        <td class="p-2"><input type="number" step="0.01" class="w-full px-2 py-1 border rounded" placeholder="طول"></td>
        <td class="p-2"><input type="number" step="0.01" class="w-full px-2 py-1 border rounded" placeholder="عمق"></td>
        <td class="p-2"><input type="text" class="w-full px-2 py-1 border rounded" placeholder="الزرفيل"></td>
        <td class="p-2"><input type="text" class="w-full px-2 py-1 border rounded" placeholder="المقطع"></td>
        <td class="p-2"><input type="text" class="w-full px-2 py-1 border rounded" placeholder="نوع الباب"></td>
        <td class="p-2 text-center"><input type="checkbox" class="w-4 h-4"></td>
        <td class="p-2"><input type="text" class="w-full px-2 py-1 border rounded" placeholder="الشباك"></td>
        <td class="p-2 text-center"><button type="button" onclick="this.closest('tr').remove()" class="text-rose-500 hover:text-rose-700 font-bold p-1">&times;</button></td>
    `;
    tbody.appendChild(tr);
}

function updateAttachmentsList(input) {
    const list = document.getElementById('attachmentsList');
    list.innerHTML = '';
    if (input.files.length > 0) {
        Array.from(input.files).forEach(file => {
            const div = document.createElement('div');
            div.className = 'flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700';
            div.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> <span class="truncate">${file.name}</span> <span class="text-xs text-slate-400">(${(file.size/1024).toFixed(1)} KB)</span>`;
            list.appendChild(div);
        });
    }
}

async function loadAssignees() {
    try {
        const response = await authFetch(USERS_URL);
        if (response.ok) {
            const users = await response.json();
            const select = document.getElementById('pwAssignee');
            select.innerHTML = '<option value="">-- اختر مستخدم --</option>';
            users.forEach(u => {
                const opt = document.createElement('option');
                opt.value = u.id;
                opt.textContent = u.username;
                select.appendChild(opt);
            });
        }
    } catch (e) {
        console.error('Failed to load assignees', e);
    }
}

async function loadProjects() {
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
                    <td class="p-4 font-bold text-slate-800">${p.project_number}</td>
                    <td class="p-4">${p.name}</td>
                    <td class="p-4 text-slate-500">${p.contractor || '-'}</td>
                    <td class="p-4 text-slate-500" dir="ltr">${p.expected_delivery_date ? new Date(p.expected_delivery_date).toLocaleDateString() : '-'}</td>
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

function viewProjectDetails(id) {
    showToast('تفاصيل المشروع قيد التطوير...', 'bg-indigo-500', 'ℹ');
}

const projectWizardForm = document.getElementById('projectWizardForm');
if (projectWizardForm) {
    projectWizardForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const btnSubmit = document.getElementById('btnSubmitProject');
        const originalText = btnSubmit.innerHTML;
        btnSubmit.innerHTML = '<div class="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> جاري الحفظ...';
        btnSubmit.disabled = true;
        
        try {
            const details = [];
            const rows = document.querySelectorAll('#projectDetailsTableBody tr');
            rows.forEach(tr => {
                const inputs = tr.querySelectorAll('input');
                details.push({
                    door_number: inputs[0].value,
                    width: inputs[1].value ? parseFloat(inputs[1].value) : null,
                    height: inputs[2].value ? parseFloat(inputs[2].value) : null,
                    depth: inputs[3].value ? parseFloat(inputs[3].value) : null,
                    lock_type: inputs[4].value,
                    profile: inputs[5].value,
                    door_type: inputs[6].value,
                    fire_resistant: inputs[7].checked,
                    window_type: inputs[8].value
                });
            });
            
            const payload = {
                name: document.getElementById('pwName').value,
                project_number: document.getElementById('pwProjectNumber').value,
                contractor: document.getElementById('pwContractor').value,
                expected_delivery_date: document.getElementById('pwDeliveryDate').value || null,
                engineer_name: document.getElementById('pwEngineerName').value,
                engineer_phone: document.getElementById('pwEngineerPhone').value,
                location: document.getElementById('pwLocation').value,
                assignee_id: document.getElementById('pwAssignee').value ? parseInt(document.getElementById('pwAssignee').value) : null,
                paint_color: document.getElementById('pwPaintColor').value,
                status: document.querySelector('input[name="pwStatus"]:checked').value,
                engineering_details: details
            };
            
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
            
            const attachmentsInput = document.getElementById('pwAttachments');
            if (attachmentsInput.files.length > 0) {
                const formData = new FormData();
                Array.from(attachmentsInput.files).forEach(file => {
                    formData.append('files', file);
                });
                await authFetch(`${PROJECTS_URL}/${createdProject.id}/attachments`, {
                    method: 'POST',
                    body: formData
                });
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

content += new_code

with codecs.open(path, 'w', 'utf-8') as f:
    f.write(content)

print("Successfully appended to script.js")
