import sys

with open('frontend/script.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    new_lines.append(line)
    if "subGrid.appendChild(card);" in line and "const deleteBtnHtml" not in line and "enterSubDepartment(sub.name)" not in line:
        # Wait, this is tricky. Let's find the end of the forEach block in enterSubDeptView.
        pass

# A better approach is to replace using python's re or string split
with open('frontend/script.js', 'r', encoding='utf-8') as f:
    content = f.read()

old_code = '''            card.innerHTML = `
                ${deleteBtnHtml}
                <div class="h-12 w-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                </div>
                <h3 class="font-bold text-slate-800">${sub.name}</h3>
            `;
            subGrid.appendChild(card);
        });
    }'''

new_code = '''            card.innerHTML = `
                ${deleteBtnHtml}
                <div class="h-12 w-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                </div>
                <h3 class="font-bold text-slate-800">${sub.name}</h3>
            `;
            subGrid.appendChild(card);
        });
        
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
        }
    }'''

if 'بنود عامة / غير مصنفة' not in content:
    content = content.replace(old_code, new_code)

with open('frontend/script.js', 'w', encoding='utf-8') as f:
    f.write(content)
