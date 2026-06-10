import sys
import codecs
import re

path = 'c:/Users/hassa/Documents/ali/Factory-ERP/frontend/script.js'

with codecs.open(path, 'r', 'utf-8') as f:
    content = f.read()

# Replace the status badge logic in viewProjectDetails
old_badge_logic = r'''        const badge = document.getElementById\('pdStatusBadge'\);.*?        const tbody = document.getElementById\('pdEngineeringTableBody'\);'''
new_badge_logic = '''        const badge = document.getElementById('pdStatusBadge');
        
        // Default static badge
        function renderStaticBadge(status) {
            if (status === 'active') return '<span class="px-4 py-2 bg-emerald-100 text-emerald-800 rounded-xl font-bold border border-emerald-200">مشروع فعال</span>';
            if (status === 'completed') return '<span class="px-4 py-2 bg-blue-100 text-blue-800 rounded-xl font-bold border border-blue-200">مشروع منتهي</span>';
            return '<span class="px-4 py-2 bg-amber-100 text-amber-800 rounded-xl font-bold border border-amber-200">قيد الانتظار</span>';
        }
        
        badge.innerHTML = renderStaticBadge(p.status);

        // Make interactive if current user is the assignee or admin
        const currentUser = localStorage.getItem('username');
        let isAuthorized = (currentUser === 'admin');
        
        if (p.executive_manager_id) {
            authFetch(USERS_BASIC_URL).then(res => res.json()).then(users => {
                const assignee = users.find(u => u.id === p.executive_manager_id);
                if (assignee && assignee.username === currentUser) {
                    isAuthorized = true;
                }
                
                if (isAuthorized) {
                    const selectHtml = `
                        <select onchange="updateProjectStatus(${p.id}, this.value)" class="px-4 py-2 rounded-xl font-bold border focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer ${
                            p.status === 'active' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 
                            p.status === 'completed' ? 'bg-blue-100 text-blue-800 border-blue-200' : 
                            'bg-amber-100 text-amber-800 border-amber-200'
                        }">
                            <option value="pending" ${p.status === 'pending' ? 'selected' : ''}>قيد الانتظار</option>
                            <option value="active" ${p.status === 'active' ? 'selected' : ''}>مشروع فعال</option>
                            <option value="completed" ${p.status === 'completed' ? 'selected' : ''}>مشروع منتهي</option>
                        </select>
                    `;
                    badge.innerHTML = selectHtml;
                }
            }).catch(() => {});
        } else if (isAuthorized) {
            const selectHtml = `
                <select onchange="updateProjectStatus(${p.id}, this.value)" class="px-4 py-2 rounded-xl font-bold border focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer ${
                    p.status === 'active' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 
                    p.status === 'completed' ? 'bg-blue-100 text-blue-800 border-blue-200' : 
                    'bg-amber-100 text-amber-800 border-amber-200'
                }">
                    <option value="pending" ${p.status === 'pending' ? 'selected' : ''}>قيد الانتظار</option>
                    <option value="active" ${p.status === 'active' ? 'selected' : ''}>مشروع فعال</option>
                    <option value="completed" ${p.status === 'completed' ? 'selected' : ''}>مشروع منتهي</option>
                </select>
            `;
            badge.innerHTML = selectHtml;
        }
        
        const tbody = document.getElementById('pdEngineeringTableBody');'''

content = re.sub(old_badge_logic, new_badge_logic, content, flags=re.DOTALL)

# Add updateProjectStatus function at the end
if 'function updateProjectStatus' not in content:
    content += '''

// Update Project Status
window.updateProjectStatus = async function(projectId, newStatus) {
    try {
        const response = await authFetch(`${PROJECTS_URL}/${projectId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        if (!response.ok) throw new Error('فشل تحديث حالة المشروع');
        showToast('تم تحديث حالة المشروع بنجاح', 'bg-emerald-500', '✓');
        // Refresh details view
        viewProjectDetails(projectId);
    } catch (e) {
        showToast(e.message, 'bg-rose-500', '✗');
    }
};
'''

with codecs.open(path, 'w', 'utf-8') as f:
    f.write(content)

print("Patched script.js with status update logic")
