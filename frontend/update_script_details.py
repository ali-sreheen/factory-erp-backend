import sys
import codecs

path = 'c:/Users/hassa/Documents/ali/Factory-ERP/frontend/script.js'

with codecs.open(path, 'r', 'utf-8') as f:
    content = f.read()

target = '''function viewProjectDetails(id) {
    showToast('تفاصيل المشروع قيد التطوير...', 'bg-indigo-500', 'ℹ');
}'''

replacement = '''async function viewProjectDetails(id) {
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
        document.getElementById('pdSubtitle').textContent = p.expected_delivery_date ? `تاريخ التسليم المتوقع: ${new Date(p.expected_delivery_date).toLocaleDateString()}` : '';
        
        document.getElementById('pdNumber').textContent = p.project_number;
        document.getElementById('pdContractor').textContent = p.contractor || '-';
        document.getElementById('pdDelivery').textContent = p.expected_delivery_date ? new Date(p.expected_delivery_date).toLocaleDateString() : '-';
        document.getElementById('pdEngineer').textContent = p.engineer_name || '-';
        document.getElementById('pdEngineerPhone').textContent = p.engineer_phone || '-';
        document.getElementById('pdLocation').textContent = p.location || '-';
        document.getElementById('pdPaint').textContent = p.paint_color || '-';
        document.getElementById('pdAssignee').textContent = p.assignee ? p.assignee.username : '-';
        
        const badge = document.getElementById('pdStatusBadge');
        if (p.status === 'active') {
            badge.innerHTML = '<span class="px-4 py-2 bg-emerald-100 text-emerald-800 rounded-xl font-bold border border-emerald-200">مشروع فعال</span>';
        } else {
            badge.innerHTML = '<span class="px-4 py-2 bg-amber-100 text-amber-800 rounded-xl font-bold border border-amber-200">قيد الانتظار</span>';
        }
        
        const tbody = document.getElementById('pdEngineeringTableBody');
        tbody.innerHTML = '';
        if (p.engineering_details && p.engineering_details.length > 0) {
            p.engineering_details.forEach(d => {
                const tr = document.createElement('tr');
                tr.className = 'border-b hover:bg-slate-50 transition text-sm';
                tr.innerHTML = `
                    <td class="p-3 font-bold">${d.door_number}</td>
                    <td class="p-3">${d.width || '-'}</td>
                    <td class="p-3">${d.height || '-'}</td>
                    <td class="p-3">${d.depth || '-'}</td>
                    <td class="p-3">${d.lock_type || '-'}</td>
                    <td class="p-3">${d.profile || '-'}</td>
                    <td class="p-3">${d.door_type || '-'}</td>
                    <td class="p-3">${d.fire_resistant ? '✔️' : '❌'}</td>
                    <td class="p-3">${d.window_type || '-'}</td>
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
                link.href = `${API_HOST}${a.file_path}`;
                link.target = '_blank';
                link.className = 'flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition text-slate-700 font-bold text-sm';
                link.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                    <span class="truncate">${a.filename}</span>
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
}'''

if target in content:
    content = content.replace(target, replacement)
else:
    print("Could not find the target viewProjectDetails function.")

# Now I also need to ensure showProjectsView and showModuleSelectorView hide the projectDetailView.
hide_stmt = "    const pdView = document.getElementById('projectDetailView');\n    if(pdView) pdView.classList.add('hidden');\n"

content = content.replace("    adminView.classList.add('hidden');\n}", "    adminView.classList.add('hidden');\n" + hide_stmt + "}")

with codecs.open(path, 'w', 'utf-8') as f:
    f.write(content)

print("Successfully updated script.js with project details logic.")
