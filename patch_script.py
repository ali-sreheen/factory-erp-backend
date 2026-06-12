import sys
import re

with open('frontend/script.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Rename enterAccessoriesMenu to enterSubDeptView
content = content.replace('enterAccessoriesMenu', 'enterSubDeptView')

# Remove hardcoded "إكسسوارات" in item rendering
old_badge = '''        let badgeHTML = `<span class="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 mb-4">${item.category}</span>`;
        if (item.category === 'إكسسوارات' && item.subcategory) {
            badgeHTML = `<span class="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-100 mb-4">${item.category} / ${item.subcategory}</span>`;
        }'''

new_badge = '''        let badgeHTML = `<span class="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 mb-4">${item.category}</span>`;
        if (item.subcategory) {
            badgeHTML = `<span class="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-100 mb-4">${item.category} / ${item.subcategory}</span>`;
        }'''
content = content.replace(old_badge, new_badge)

# Add move item logic to JS
move_js = '''
// ------------- MOVE ITEM LOGIC -------------
let currentMovingItemId = null;

function openMoveItemModal(itemId) {
    currentMovingItemId = itemId;
    const item = globalItems.find(i => i.id === itemId);
    if (!item) return;

    const modal = document.getElementById('moveItemModal');
    const catSelect = document.getElementById('moveItemCategory');
    const subSelect = document.getElementById('moveItemSubcategory');
    const subContainer = document.getElementById('moveItemSubcategoryContainer');

    catSelect.innerHTML = '<option value="">-- اختر القسم الرئيسي --</option>';
    globalDepartments.forEach(dept => {
        const option = document.createElement('option');
        option.value = dept.name;
        option.textContent = dept.name;
        if(dept.name === item.category) option.selected = true;
        catSelect.appendChild(option);
    });

    updateMoveItemSubcategories(item.subcategory);
    modal.classList.remove('hidden');
}

function closeMoveItemModal() {
    document.getElementById('moveItemModal').classList.add('hidden');
    currentMovingItemId = null;
}

window.updateMoveItemSubcategories = function(defaultSub = null) {
    const catSelect = document.getElementById('moveItemCategory');
    const subSelect = document.getElementById('moveItemSubcategory');
    const subContainer = document.getElementById('moveItemSubcategoryContainer');
    const selectedDept = catSelect.value;
    
    subSelect.innerHTML = '<option value="">بدون قسم فرعي (رئيسي)</option>';
    
    if (selectedDept) {
        const dept = globalDepartments.find(d => d.name === selectedDept);
        if (dept && dept.subdepartments && dept.subdepartments.length > 0) {
            dept.subdepartments.forEach(sub => {
                const option = document.createElement('option');
                option.value = sub.name;
                option.textContent = sub.name;
                if(defaultSub && sub.name === defaultSub) option.selected = true;
                subSelect.appendChild(option);
            });
            subContainer.classList.remove('hidden');
        } else {
            subContainer.classList.add('hidden');
        }
    } else {
        subContainer.classList.add('hidden');
    }
}

document.getElementById('moveItemForm').onsubmit = async (e) => {
    e.preventDefault();
    if (!currentMovingItemId) return;
    
    const newCategory = document.getElementById('moveItemCategory').value;
    const newSubcategory = document.getElementById('moveItemSubcategory').value;
    
    if(!newCategory) return;
    
    try {
        const response = await authFetch(`${API_URL}/${currentMovingItemId}/move`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                new_category: newCategory,
                new_subcategory: newSubcategory || null
            })
        });
        
        if (response.ok) {
            showToast('تم نقل البند بنجاح', 'bg-emerald-500', '✓');
            closeMoveItemModal();
            await fetchDepartmentCounts();
            enterDepartment(currentDepartment, currentSubcategory); // reload current view
        } else {
            const data = await response.json();
            showToast(data.detail || 'حدث خطأ أثناء نقل البند', 'bg-rose-500', '✗');
        }
    } catch (e) {
        showToast('حدث خطأ أثناء نقل البند', 'bg-rose-500', '✗');
    }
};
'''

if 'function openMoveItemModal' not in content:
    content += '\n' + move_js

# Add "Move Item" button to item menu
old_admin_menu = '''                    <button onclick="deleteItem(${item.id})" class="w-full text-right px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 font-semibold transition">
                        حذف البند
                    </button>'''

new_admin_menu = '''                    <button onclick="openMoveItemModal(${item.id})" class="w-full text-right px-4 py-2 text-sm text-indigo-600 hover:bg-indigo-50 font-semibold transition border-b border-slate-100">
                        نقل البند
                    </button>
                    <button onclick="deleteItem(${item.id})" class="w-full text-right px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 font-semibold transition">
                        حذف البند
                    </button>'''

if 'openMoveItemModal(${item.id})' not in content:
    content = content.replace(old_admin_menu, new_admin_menu)

# Update showAddItemModal logic
old_add_item_subcat = '''    if (currentDepartment === 'إكسسوارات') {
        subcategoryFieldContainer.classList.remove('hidden');
        if (currentSubcategory) {
            document.getElementById('itemSubcategory').value = currentSubcategory;
            document.getElementById('itemSubcategory').disabled = true;
        } else {
            document.getElementById('itemSubcategory').value = '';
            document.getElementById('itemSubcategory').disabled = false;
        }
    } else {
        subcategoryFieldContainer.classList.add('hidden');
    }'''

new_add_item_subcat = '''    const dept = globalDepartments.find(d => d.name === currentDepartment);
    const subSelect = document.getElementById('itemSubcategory');
    subSelect.innerHTML = '<option value="">بدون قسم فرعي (رئيسي)</option>';
    
    if (dept && dept.subdepartments && dept.subdepartments.length > 0) {
        subcategoryFieldContainer.classList.remove('hidden');
        dept.subdepartments.forEach(sub => {
            const option = document.createElement('option');
            option.value = sub.name;
            option.textContent = sub.name;
            subSelect.appendChild(option);
        });
        
        if (currentSubcategory) {
            subSelect.value = currentSubcategory;
            subSelect.disabled = true;
        } else {
            subSelect.value = '';
            subSelect.disabled = false;
        }
    } else {
        subcategoryFieldContainer.classList.add('hidden');
    }'''

content = content.replace(old_add_item_subcat, new_add_item_subcat)


# Update addItemForm logic
old_add_item_submit_subcat = '''    if (currentDepartment === 'إكسسوارات') {
        const subcategory = document.getElementById('itemSubcategory').value;
        formData.append('subcategory', subcategory);
    }'''

new_add_item_submit_subcat = '''    const dept = globalDepartments.find(d => d.name === currentDepartment);
    if (dept && dept.subdepartments && dept.subdepartments.length > 0) {
        const subcategory = document.getElementById('itemSubcategory').value;
        if(subcategory) formData.append('subcategory', subcategory);
    }'''

content = content.replace(old_add_item_submit_subcat, new_add_item_submit_subcat)


with open('frontend/script.js', 'w', encoding='utf-8') as f:
    f.write(content)
