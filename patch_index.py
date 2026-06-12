import sys

with open('frontend/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add "إدارة الأقسام الفرعية" button to departmentDetailView
dept_detail_header = '''                <div class="flex items-center gap-4 border-b border-slate-200 pb-5">
                    <button onclick="showDepartmentsView()" class="p-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 transition flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                    </button>
                    <div class="flex-grow flex justify-between items-center">
                        <div>
                            <h2 id="deptTitle" class="text-3xl font-extrabold text-slate-900">...</h2>
                            <p class="text-slate-500 text-sm mt-0.5">تصفح البنود المتاحة وإدارة تفاصيلها.</p>
                        </div>
                        <button id="btnManageSubDepts" onclick="enterSubDeptView(currentDepartment)" class="hidden bg-indigo-100 text-indigo-700 hover:bg-indigo-200 px-4 py-2 rounded-xl text-sm font-bold transition flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                            الأقسام الفرعية
                        </button>
                    </div>
                </div>'''

if 'id="btnManageSubDepts"' not in content:
    # replace the old header
    old_header = '''                <div class="flex items-center gap-4 border-b border-slate-200 pb-5">
                    <button onclick="showDepartmentsView()" class="p-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 transition flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                    </button>
                    <div>
                        <h2 id="deptTitle" class="text-3xl font-extrabold text-slate-900">...</h2>
                        <p class="text-slate-500 text-sm mt-0.5">تصفح البنود المتاحة وإدارة تفاصيلها.</p>
                    </div>
                </div>'''
    content = content.replace(old_header, dept_detail_header)


# 2. Add MoveItemModal
move_modal = '''
    <!-- Move Item Modal -->
    <div id="moveItemModal" class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm hidden z-50 flex items-center justify-center">
        <div class="bg-white w-full max-w-md rounded-2xl shadow-2xl animate-fade-in mx-4 overflow-hidden">
            <div class="bg-indigo-600 px-6 py-4 flex justify-between items-center text-white">
                <h3 class="text-xl font-bold">نقل البند</h3>
                <button onclick="closeMoveItemModal()" class="text-indigo-200 hover:text-white transition">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
            <form id="moveItemForm" class="p-6 space-y-5">
                <div>
                    <label class="block text-sm font-bold text-slate-700 mb-2">القسم الرئيسي الجديد</label>
                    <select id="moveItemCategory" onchange="updateMoveItemSubcategories()" required class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    </select>
                </div>
                <div id="moveItemSubcategoryContainer" class="hidden">
                    <label class="block text-sm font-bold text-slate-700 mb-2">القسم الفرعي الجديد (اختياري)</label>
                    <select id="moveItemSubcategory" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    </select>
                </div>
                <button type="submit" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition shadow-md">
                    تأكيد النقل
                </button>
            </form>
        </div>
    </div>
'''

if 'id="moveItemModal"' not in content:
    content = content.replace('</body>', move_modal + '\n</body>')

with open('frontend/index.html', 'w', encoding='utf-8') as f:
    f.write(content)
