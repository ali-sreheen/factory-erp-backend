import sys

with open('frontend/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

old_header = '''                    <div class="flex items-center gap-4">
                        <button id="btnBackToDepts" onclick="handleDetailBackNavigation()" class="p-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 transition flex items-center justify-center" title="رجوع">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                        <div>
                            <div class="flex items-center gap-2">
                                <h2 id="currentDeptTitle" class="text-3xl font-extrabold text-slate-900">أسم القسم</h2>
                                <span id="currentSubDeptBadge" class="hidden px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">فرعي</span>
                            </div>
                            <p class="text-slate-500 text-sm mt-0.5">تصفح المنتجات وإجراء عمليات الصرف والإضافة.</p>
                        </div>
                    </div>'''

new_header = '''                    <div class="flex-grow flex justify-between items-center">
                        <div class="flex items-center gap-4">
                            <button id="btnBackToDepts" onclick="handleDetailBackNavigation()" class="p-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 transition flex items-center justify-center" title="رجوع">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                            <div>
                                <div class="flex items-center gap-2">
                                    <h2 id="currentDeptTitle" class="text-3xl font-extrabold text-slate-900">أسم القسم</h2>
                                    <span id="currentSubDeptBadge" class="hidden px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">فرعي</span>
                                </div>
                                <p class="text-slate-500 text-sm mt-0.5">تصفح المنتجات وإجراء عمليات الصرف والإضافة.</p>
                            </div>
                        </div>
                        <button id="btnManageSubDepts" onclick="enterSubDeptView(currentDepartment)" class="hidden bg-indigo-100 text-indigo-700 hover:bg-indigo-200 px-4 py-2 rounded-xl text-sm font-bold transition flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                            الأقسام الفرعية
                        </button>
                    </div>'''

if 'id="btnManageSubDepts"' not in content:
    content = content.replace(old_header, new_header)

with open('frontend/index.html', 'w', encoding='utf-8') as f:
    f.write(content)
