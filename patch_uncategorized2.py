import re

with open('frontend/script.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Let's find the block in enterSubDeptView:
#     if (dept && dept.subdepartments) {
#         dept.subdepartments.forEach(sub => {
#             ...
#             subGrid.appendChild(card);
#         });
#     }

pattern = re.compile(r'(subGrid\.appendChild\(card\);\s*\n\s*\}\);\s*\n)', re.DOTALL)

# Find the specific one inside enterSubDeptView
# We know it's around line 428. Let's just find the first match of this pattern 
# after "function enterSubDeptView"

def replacer(match):
    return match.group(1) + '''        
        const uncategorizedItems = globalItems.filter(i => i.category === deptName && (!i.subcategory || i.subcategory.trim() === ''));
        if (uncategorizedItems.length > 0) {
            const card = document.createElement('div');
            card.onclick = () => enterSubDepartment('');
            card.className = "group cursor-pointer bg-slate-50 rounded-xl shadow-sm hover:shadow-lg border-2 border-dashed border-slate-300 p-6 transition-all text-center flex flex-col items-center justify-center h-40 relative";
            card.innerHTML = `
                <div class="h-12 w-12 rounded-xl bg-slate-200 text-slate-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                </div>
                <h3 class="font-bold text-slate-700">بنود عامة / غير مصنفة</h3>
            `;
            subGrid.appendChild(card);
        }\n'''

parts = content.split('function enterSubDeptView(deptName)')
if len(parts) > 1:
    new_part = pattern.sub(replacer, parts[1], count=1)
    content = parts[0] + 'function enterSubDeptView(deptName)' + new_part

with open('frontend/script.js', 'w', encoding='utf-8') as f:
    f.write(content)
