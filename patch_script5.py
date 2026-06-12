import sys

with open('frontend/script.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    if "onclick=\"deleteItem(${item.id}" in line and "bg-rose-500" in line:
        new_lines.append('''                <button onclick="openMoveItemModal(${item.id})" class="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2 px-4 rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-sm hover:shadow mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                    نقل البند
                </button>\n''')
    new_lines.append(line)

with open('frontend/script.js', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
