import sys
import codecs
import re

path = 'c:/Users/hassa/Documents/ali/Factory-ERP/frontend/script.js'

with codecs.open(path, 'r', 'utf-8') as f:
    content = f.read()

# 1. Add the delete button inside the isAuthorized block in viewProjectDetails
auth_block_old = r'''                    const selectHtml = `
                        <select onchange="updateProjectStatus\(\$\{p\.id\}, this\.value\)" class="px-4 py-2 rounded-xl font-bold border focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer \$\{.*?
                        </select>
                    `;
                    badge\.innerHTML = selectHtml;'''

auth_block_new = '''                    const selectHtml = `
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
                    const deleteHtml = `
                        <button onclick="deleteProjectWithConfirmation(${p.id})" class="mr-3 px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl transition font-bold flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            حذف المشروع
                        </button>
                    `;
                    badge.innerHTML = `<div class="flex items-center">` + selectHtml + deleteHtml + `</div>`;'''

content = re.sub(auth_block_old, auth_block_new, content, flags=re.DOTALL)

# 2. Add deleteProjectWithConfirmation function
if 'function deleteProjectWithConfirmation' not in content:
    content += '''

// Delete Project With Confirmation
window.deleteProjectWithConfirmation = async function(projectId) {
    if (confirm("هل أنت متأكد أنك تريد حذف هذا المشروع بشكل نهائي؟ لا يمكن التراجع عن هذا الإجراء.")) {
        if (confirm("تأكيد أخير: هل أنت متأكد 100% من حذف هذا المشروع بجميع بياناته وملفاته؟")) {
            try {
                const response = await authFetch(`${PROJECTS_URL}/${projectId}`, {
                    method: 'DELETE'
                });
                if (!response.ok) throw new Error('فشل حذف المشروع');
                showToast('تم حذف المشروع بنجاح', 'bg-emerald-500', '✓');
                showProjectsView(); // Go back to projects list
            } catch (e) {
                showToast(e.message, 'bg-rose-500', '✗');
            }
        }
    }
};
'''

with codecs.open(path, 'w', 'utf-8') as f:
    f.write(content)

print("Patched script.js with delete project UI logic")
