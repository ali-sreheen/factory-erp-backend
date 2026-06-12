const API_HOST = window.location.protocol === 'file:' ? 'http://localhost:8000' : window.location.origin;
const API_URL = `${API_HOST}/api/items`;
const AUTH_URL = `${API_HOST}/api/auth`;
const USERS_URL = `${API_HOST}/api/users`;
const USERS_BASIC_URL = `${API_HOST}/api/users/basic`;

// State
let currentDepartment = '';
let currentSubcategory = '';
let allItems = [];
let activeLogItemId = null; // Track current item open in log modal

// DOM Views
const authContainer = document.getElementById('authContainer');
const appContainer = document.getElementById('appContainer');
const departmentsView = document.getElementById('departmentsView');
const accessoriesSubDeptView = document.getElementById('subDeptView');
const departmentDetailView = document.getElementById('departmentDetailView');
const adminView = document.getElementById('adminView');

// Detail Header Elements
const currentDeptTitle = document.getElementById('currentDeptTitle');
const currentSubDeptBadge = document.getElementById('currentSubDeptBadge');
const itemsGrid = document.getElementById('itemsGrid');
const deptLoadingIndicator = document.getElementById('deptLoadingIndicator');
const deptEmptyState = document.getElementById('deptEmptyState');
const activeUserDisplay = document.getElementById('activeUserDisplay');
const userMenuDropdown = document.getElementById('userMenuDropdown');
const adminPanelLink = document.getElementById('adminPanelLink');

// Auth Forms
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const authTitle = document.getElementById('authTitle');
const authSubTitle = document.getElementById('authSubTitle');

// Modals
const addItemModal = document.getElementById('addItemModal');
const addItemForm = document.getElementById('addItemForm');
const addItemModalDeptTitle = document.getElementById('addItemModalDeptTitle');
const subcategoryFieldContainer = document.getElementById('subcategoryFieldContainer');

const txModal = document.getElementById('txModal');
const txForm = document.getElementById('txForm');
const txItemName = document.getElementById('txItemName');
const txItemId = document.getElementById('txItemId');

const logModal = document.getElementById('logModal');
const logItemName = document.getElementById('logItemName');
const logTableBody = document.getElementById('logTableBody');
const logLoading = document.getElementById('logLoading');
const logEmpty = document.getElementById('logEmpty');
const btnRevertLastTx = document.getElementById('btnRevertLastTx');

const editUserModal = document.getElementById('editUserModal');
const editUserForm = document.getElementById('editUserForm');
const editUserId = document.getElementById('editUserId');
const editUsername = document.getElementById('editUsername');
const editPassword = document.getElementById('editPassword');

const usersTableBody = document.getElementById('usersTableBody');
const adminLoading = document.getElementById('adminLoading');

const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toastMessage');
const toastIcon = document.getElementById('toastIcon');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    checkAuthStatus();
    setupAuthForms();
    setupTxTypeToggle();
    setupRevertAction();
    setupEditImageAction();
    setupDescriptionEditAction();
    setupEditUserAction();
    
    // Close dropdown on click outside
    document.addEventListener('click', (e) => {
        const userMenu = document.getElementById('userMenuDropdownContainer');
        if (userMenu && !userMenu.contains(e.target)) {
            userMenuDropdown.classList.add('hidden');
        }
    });
});

// ----------------- USER MENU DROPDOWN -----------------

function toggleUserMenu() {
    userMenuDropdown.classList.toggle('hidden');
}

// ----------------- AUTHENTICATION FLOW -----------------

function checkAuthStatus() {
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');
    
    if (token && username) {
        showAppView(username);
    } else {
        showAuthView();
    }
}

function showAuthView() {
    const _pView = document.getElementById('purchasingView');
    if(_pView) _pView.classList.add('hidden');
    const _prdView = document.getElementById('purchaseRequestDetailView');
    if(_prdView) _prdView.classList.add('hidden');

    authContainer.classList.remove('hidden');
    appContainer.classList.add('hidden');
    toggleAuthMode('login');
}

function showAppView(username) {
    const _pView = document.getElementById('purchasingView');
    if(_pView) _pView.classList.add('hidden');
    const _prdView = document.getElementById('purchaseRequestDetailView');
    if(_prdView) _prdView.classList.add('hidden');

    authContainer.classList.add('hidden');
    appContainer.classList.remove('hidden');
    activeUserDisplay.textContent = username;
    
    // If user is 'admin', show the Admin Panel link in dropdown
    if (username === 'admin') {
        adminPanelLink.classList.remove('hidden');
    } else {
        adminPanelLink.classList.add('hidden');
    }
    
    showModuleSelectorView();
}

function toggleAuthMode(mode) {
    if (mode === 'login') {
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
        authTitle.textContent = "نظام إدارة مستودعات المصنع";
        authSubTitle.textContent = "يرجى تسجيل الدخول للوصول إلى لوحة التحكم";
    } else {
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
        authTitle.textContent = "إنشاء حساب جديد";
        authSubTitle.textContent = "سجل حسابك للبدء في إدارة المستودعات";
    }
}

function setupAuthForms() {
    // Login
    loginForm.onsubmit = async (e) => {
        e.preventDefault();
        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;
        
        const formData = new URLSearchParams();
        formData.append('username', username);
        formData.append('password', password);
        
        try {
            const response = await fetch(`${AUTH_URL}/token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formData
            });
            
            if (!response.ok) throw new Error('اسم المستخدم أو كلمة المرور غير صحيحة');
            
            const data = await response.json();
            localStorage.setItem('token', data.access_token);
            localStorage.setItem('username', username);
            
            showToast('تم تسجيل الدخول بنجاح', 'bg-emerald-500', '✓');
            showAppView(username);
        } catch (error) {
            console.error('Login error:', error);
            showToast(error.message || 'خطأ أثناء تسجيل الدخول', 'bg-rose-500', '✗');
        }
    };

    // Register
    registerForm.onsubmit = async (e) => {
        e.preventDefault();
        const username = document.getElementById('regUsername').value;
        const password = document.getElementById('regPassword').value;
        
        try {
            const response = await fetch(`${AUTH_URL}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            
            if (response.status === 400) throw new Error('اسم المستخدم مسجل بالفعل');
            if (!response.ok) throw new Error('خطأ في إعدادات التسجيل');
            
            showToast('تم إنشاء الحساب بنجاح! يرجى تسجيل الدخول', 'bg-emerald-500', '✓');
            toggleAuthMode('login');
            document.getElementById('loginUsername').value = username;
            document.getElementById('loginPassword').value = '';
        } catch (error) {
            console.error('Registration error:', error);
            showToast(error.message || 'خطأ في عملية التسجيل', 'bg-rose-500', '✗');
        }
    };
}

function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    showToast('تم تسجيل الخروج بنجاح', 'bg-slate-700', '✓');
    showAuthView();
}

// Request Helper to automatically append Authorization Header & handle 401s
async function authFetch(url, options = {}) {
    const token = localStorage.getItem('token');
    if (!options.headers) {
        options.headers = {};
    }
    
    if (token) {
        options.headers['Authorization'] = `Bearer ${token}`;
    }
    
    try {
        const response = await fetch(url, options);
        if (response.status === 401) {
            handleLogout();
            throw new Error('انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجدداً');
        }
        return response;
    } catch (err) {
        throw err;
    }
}

async function handleBadResponse(response, defaultMsg) {
    let detail = '';
    try {
        const text = await response.text();
        try {
            const json = JSON.parse(text);
            detail = json.detail || text;
        } catch (e) {
            detail = text;
        }
    } catch (e) {
        detail = response.statusText;
    }
    return new Error(`${defaultMsg} (${response.status}): ${detail}`);
}

// Setup Transaction Type UI Toggle styling
function setupTxTypeToggle() {
    const radios = document.querySelectorAll('input[name="txType"]');
    radios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const parentLabels = document.querySelectorAll('input[name="txType"]');
            parentLabels.forEach(p => {
                const label = p.parentElement;
                label.className = "flex items-center justify-center p-3 border rounded-xl cursor-pointer hover:bg-slate-50 transition border-slate-200 text-slate-700 font-medium focus-within:ring-2";
            });
            
            const checkedLabel = e.target.parentElement;
            if (e.target.value === 'add') {
                checkedLabel.className = "flex items-center justify-center p-3 border rounded-xl cursor-pointer hover:bg-slate-50 transition border-emerald-500 bg-emerald-50 text-emerald-800 font-bold focus-within:ring-2 focus-within:ring-emerald-500";
            } else {
                checkedLabel.className = "flex items-center justify-center p-3 border rounded-xl cursor-pointer hover:bg-slate-50 transition border-red-500 bg-red-50 text-red-800 font-bold focus-within:ring-2 focus-within:ring-red-500";
            }
        });
    });
}

// Setup Revert Last Transaction Action
function setupRevertAction() {
    btnRevertLastTx.onclick = async () => {
        if (!activeLogItemId) return;
        if (!confirm('هل أنت متأكد من رغبتك في حذف آخر حركة تم تسجيلها والتراجع عن تعديل الكمية؟')) return;
        
        try {
            const response = await authFetch(`${API_URL}/${activeLogItemId}/transactions/last`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || 'Failed to revert transaction');
            }
            
            showToast('تم التراجع عن الحركة الأخيرة بنجاح وإعادة رصيد البند', 'bg-emerald-500', '✓');
            
            // Refresh Log
            const txResponse = await authFetch(`${API_URL}/${activeLogItemId}/transactions/`);
            if (txResponse.ok) {
                const txs = await txResponse.json();
                renderLogTable(txs);
            }
            
            // Refresh Items Grid
            await loadItems();
            
        } catch (error) {
            console.error('Error reverting transaction:', error);
            showToast(error.message || 'خطأ أثناء التراجع عن الحركة', 'bg-rose-500', '✗');
        }
    };
}

// Setup Edit Item Image Action
function setupEditImageAction() {
    const editItemImageInput = document.getElementById('editItemImageInput');
    editItemImageInput.onchange = async (e) => {
        if (!activeLogItemId) return;
        const file = e.target.files[0];
        if (!file) return;
        
        const formData = new FormData();
        formData.append('image', file);
        
        try {
            const response = await authFetch(`${API_URL}/${activeLogItemId}/image`, {
                method: 'PUT',
                body: formData
            });
            
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || 'Failed to upload image');
            }
            
            showToast('تم تحديث صورة البند بنجاح', 'bg-emerald-500', '✓');
            
            // Refresh Items Grid
            await loadItems();
            
        } catch (error) {
            console.error('Error updating image:', error);
            showToast(error.message || 'خطأ أثناء تحديث صورة البند', 'bg-rose-500', '✗');
        } finally {
            editItemImageInput.value = '';
        }
    };
}

// Setup Edit Item Description Action
function setupDescriptionEditAction() {
    const btnSaveDescription = document.getElementById('btnSaveDescription');
    const logItemDescriptionInput = document.getElementById('logItemDescriptionInput');
    
    btnSaveDescription.onclick = async () => {
        if (!activeLogItemId) return;
        const newDesc = logItemDescriptionInput.value;
        
        try {
            const response = await authFetch(`${API_URL}/${activeLogItemId}/description`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ description: newDesc || null })
            });
            
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || 'Failed to update description');
            }
            
            showToast('تم تحديث وصف البند بنجاح', 'bg-emerald-500', '✓');
            await loadItems();
        } catch (error) {
            console.error('Error updating description:', error);
            showToast(error.message || 'خطأ أثناء تحديث الوصف', 'bg-rose-500', '✗');
        }
    };
}

// ----------------- VIEW ROUTING -----------------

async function showDepartmentsView() {
    const _pView = document.getElementById('purchasingView');
    if(_pView) _pView.classList.add('hidden');
    const _prdView = document.getElementById('purchaseRequestDetailView');
    if(_prdView) _prdView.classList.add('hidden');

    currentDepartment = '';
    currentSubcategory = '';
    
    document.getElementById('moduleSelectorView').classList.add('hidden');
    document.getElementById('projectsView').classList.add('hidden');
    departmentsView.classList.remove('hidden');
    accessoriesSubDeptView.classList.add('hidden');
    departmentDetailView.classList.add('hidden');
    adminView.classList.add('hidden');
    
    await fetchDepartmentCounts();
}

async function enterSubDeptView(deptName) {
    const _pView = document.getElementById('purchasingView');
    if(_pView) _pView.classList.add('hidden');
    const _prdView = document.getElementById('purchaseRequestDetailView');
    if(_prdView) _prdView.classList.add('hidden');

    currentDepartment = deptName;
    currentSubcategory = '';
    
    document.getElementById('subDeptTitle').textContent = `قسم ${deptName}`;
    
    // Find subdepartments
    const dept = globalDepartments.find(d => d.name === deptName);
    const subGrid = document.getElementById('subDeptGrid');
    subGrid.innerHTML = '';
    
    if (dept && dept.subdepartments) {
        dept.subdepartments.forEach(sub => {
            const card = document.createElement('div');
            card.onclick = () => enterSubDepartment(sub.name);
            card.className = "group cursor-pointer bg-white rounded-xl shadow-sm hover:shadow-lg border border-slate-100 p-6 transition-all text-center flex flex-col items-center justify-center h-40 relative";
            
            // Delete sub-department button for admin
            const deleteBtnHtml = localStorage.getItem('username') === 'admin' ? 
                `<button onclick="event.stopPropagation(); deleteSubDepartment(${sub.id})" class="absolute top-2 left-2 text-rose-300 hover:text-rose-600 transition" title="حذف القسم الفرعي">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>` : '';

            card.innerHTML = `
                ${deleteBtnHtml}
                <div class="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                </div>
                <h4 class="font-bold text-slate-800">${sub.name}</h4>
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
    }
    
    const username = localStorage.getItem('username');
    if (username === 'admin') {
        document.getElementById('adminSubDepartmentControls').classList.remove('hidden');
        document.getElementById('deleteDepartmentBtn').classList.remove('hidden');
    } else {
        document.getElementById('adminSubDepartmentControls').classList.add('hidden');
        document.getElementById('deleteDepartmentBtn').classList.add('hidden');
    }
    
    departmentsView.classList.add('hidden');
    // Using accessoriesSubDeptView as the generic sub dept view
    accessoriesSubDeptView.classList.remove('hidden');
    departmentDetailView.classList.add('hidden');
    adminView.classList.add('hidden');
}

async function enterSubDepartment(subDept) {
    const _pView = document.getElementById('purchasingView');
    if(_pView) _pView.classList.add('hidden');
    const _prdView = document.getElementById('purchaseRequestDetailView');
    if(_prdView) _prdView.classList.add('hidden');

    currentSubcategory = subDept;
    
    currentDeptTitle.textContent = currentDepartment;
    currentSubDeptBadge.textContent = subDept;
    currentSubDeptBadge.classList.remove('hidden');
    
    if (localStorage.getItem('username') === 'admin') {
        const btn = document.getElementById('btnManageSubDepts');
        if(btn) btn.classList.remove('hidden');
    } else {
        const btn = document.getElementById('btnManageSubDepts');
        if(btn) btn.classList.add('hidden');
    }
    
    departmentsView.classList.add('hidden');
    accessoriesSubDeptView.classList.add('hidden');
    departmentDetailView.classList.remove('hidden');
    adminView.classList.add('hidden');
    
    await loadItems();
}

async function enterDepartment(deptName) {
    const _pView = document.getElementById('purchasingView');
    if(_pView) _pView.classList.add('hidden');
    const _prdView = document.getElementById('purchaseRequestDetailView');
    if(_prdView) _prdView.classList.add('hidden');

    currentDepartment = deptName;
    currentSubcategory = '';
    
    currentDeptTitle.textContent = deptName;
    if (localStorage.getItem('username') === 'admin') {
        const btn = document.getElementById('btnManageSubDepts');
        if(btn) btn.classList.remove('hidden');
    } else {
        const btn = document.getElementById('btnManageSubDepts');
        if(btn) btn.classList.add('hidden');
    }

    currentSubDeptBadge.classList.add('hidden');
    
    departmentsView.classList.add('hidden');
    accessoriesSubDeptView.classList.add('hidden');
    departmentDetailView.classList.remove('hidden');
    adminView.classList.add('hidden');
    
    await loadItems();
}

function handleDetailBackNavigation() {
    const dept = globalDepartments.find(d => d.name === currentDepartment);
    if (dept && dept.subdepartments && dept.subdepartments.length > 0) {
        enterSubDeptView(currentDepartment);
    } else {
        showDepartmentsView();
    }
}

let globalDepartments = [];
let globalItems = [];
let userPermissionsList = [];

async function fetchDepartmentCounts() {
    try {
        // Fetch departments and items
        const [deptsResponse, itemsResponse] = await Promise.all([
            authFetch(`${API_URL.replace('/items', '/departments')}/`),
            authFetch(`${API_URL}/`)
        ]);
        
        if (!deptsResponse.ok) {
            throw await handleBadResponse(deptsResponse, 'فشل جلب الأقسام الرئيسية');
        }
        if (!itemsResponse.ok) {
            throw await handleBadResponse(itemsResponse, 'فشل جلب البنود');
        }
        
        globalDepartments = await deptsResponse.json();
        const items = await itemsResponse.json();
        globalItems = items;
        
        // Fetch permissions if not admin
        const username = localStorage.getItem('username');
        if (username === 'admin') {
            document.getElementById('adminDepartmentControls').classList.remove('hidden');
        } else {
            document.getElementById('adminDepartmentControls').classList.add('hidden');
            const permUrl = `${API_URL.replace('/items', '/users')}/me/permissions`;
            console.log('[DEBUG] Fetching permissions from:', permUrl);
            const permsResponse = await authFetch(permUrl);
            console.log('[DEBUG] Permissions response status:', permsResponse.status);
            if (permsResponse.ok) {
                userPermissionsList = await permsResponse.json();
                console.log('[DEBUG] userPermissionsList loaded:', JSON.stringify(userPermissionsList));
            } else {
                const errText = await permsResponse.text();
                console.error('[DEBUG] Permissions fetch failed:', errText);
            }
        }
        
        // Calculate counts
        const counts = {};
        const subCounts = {};
        items.forEach(item => {
            counts[item.category] = (counts[item.category] || 0) + 1;
            if (item.subcategory) {
                subCounts[`${item.category}-${item.subcategory}`] = (subCounts[`${item.category}-${item.subcategory}`] || 0) + 1;
            }
        });
        
        // Render Main Departments Grid
        const departmentsGrid = document.getElementById('departmentsGrid');
        departmentsGrid.innerHTML = '';
        
        const colors = ['blue', 'purple', 'amber', 'emerald', 'rose', 'cyan'];
        
        globalDepartments.forEach((dept, index) => {
            const c = colors[index % colors.length];
            const hasSubDepts = dept.subdepartments && dept.subdepartments.length > 0;
            const clickHandler = hasSubDepts ? `enterSubDeptView('${dept.name}')` : `enterDepartment('${dept.name}')`;
            
            const card = document.createElement('div');
            card.onclick = () => eval(clickHandler);
            card.className = `group cursor-pointer bg-white rounded-2xl shadow-md hover:shadow-xl border border-slate-100 p-8 transition-all duration-300 transform hover:-translate-y-1 flex flex-col justify-between min-h-[250px] relative overflow-hidden`;
            
            card.innerHTML = `
                <div class="absolute -right-10 -top-10 w-32 h-32 bg-${c}-500/5 rounded-full group-hover:scale-125 transition-transform duration-500"></div>
                <div>
                    <div class="w-12 h-12 rounded-xl bg-${c}-500/10 text-${c}-600 flex items-center justify-center mb-6">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                        </svg>
                    </div>
                    <h3 class="text-2xl font-bold text-slate-800 mb-2">${dept.name}</h3>
                    <p class="text-slate-500 text-sm">${hasSubDepts ? 'يحتوي على أقسام فرعية' : 'إدارة بنود القسم مباشرة'}</p>
                </div>
                <div class="mt-6 flex justify-between items-center">
                    <span class="text-xs font-semibold px-3 py-1 bg-${c}-50 text-${c}-700 rounded-full border border-${c}-100">${counts[dept.name] || 0} بند</span>
                    <span class="text-${c}-600 group-hover:translate-x-[-4px] transition-transform font-bold text-sm flex items-center gap-1">
                        ${hasSubDepts ? 'تصفح الأقسام الفرعية' : 'دخول القسم'}
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                        </svg>
                    </span>
                </div>
            `;
            departmentsGrid.appendChild(card);
        });
        
    } catch (error) {
        console.error('Error fetching data:', error);
        showToast('خطأ أثناء تحميل الأقسام: ' + error.message, 'bg-rose-500', '✗');
    }
}

// ----------------- ADMIN VIEW LOGIC -----------------

async function showAdminView() {
    const _pView = document.getElementById('purchasingView');
    if(_pView) _pView.classList.add('hidden');
    const _prdView = document.getElementById('purchaseRequestDetailView');
    if(_prdView) _prdView.classList.add('hidden');

    userMenuDropdown.classList.add('hidden'); // Close dropdown
    
    departmentsView.classList.add('hidden');
    accessoriesSubDeptView.classList.add('hidden');
    departmentDetailView.classList.add('hidden');
    adminView.classList.remove('hidden');
    
    await loadUsers();
}

async function loadUsers() {
    usersTableBody.innerHTML = '';
    adminLoading.classList.remove('hidden');
    
    try {
        const response = await authFetch(USERS_URL);
        if (!response.ok) {
            throw await handleBadResponse(response, 'فشلت عملية جلب المستخدمين');
        }
        const users = await response.json();
        
        users.forEach(user => {
            const row = document.createElement('tr');
            row.className = 'border-b hover:bg-slate-50 transition text-sm';
            
            row.innerHTML = `
                <td class="p-4 text-slate-500 font-semibold">#${user.id}</td>
                <td class="p-4 font-bold text-slate-800">${user.username}</td>
                <td class="p-4">
                    <div class="flex justify-center gap-2">
                        <button onclick="openEditUserModal(${user.id}, '${user.username}')" class="px-3.5 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl transition text-xs font-bold border border-indigo-200">
                            ⚙️ الحساب
                        </button>
                        ${user.username !== 'admin' ? `
                        <button onclick="openPermissionsModal(${user.id}, '${user.username}')" class="px-3.5 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-xl transition text-xs font-bold border border-amber-200">
                            🛡️ الصلاحيات
                        </button>
                        ` : ''}
                    </div>
                </td>
            `;
            usersTableBody.appendChild(row);
        });
    } catch (error) {
        console.error('Admin load users error:', error);
        showToast('خطأ أثناء تحميل الحسابات: ' + error.message, 'bg-rose-500', '✗');
    } finally {
        adminLoading.classList.add('hidden');
    }
}

function openEditUserModal(id, usernameVal) {
    editUserId.value = id;
    editUsername.value = usernameVal;
    editPassword.value = ''; // keep blank by default
    
    editUserModal.classList.remove('hidden');
    void editUserModal.offsetWidth;
    editUserModal.classList.remove('opacity-0');
    editUserModal.querySelector('.transform').classList.remove('scale-95');
}

function closeEditUserModal() {
    editUserModal.classList.add('opacity-0');
    editUserModal.querySelector('.transform').classList.add('scale-95');
    setTimeout(() => {
        editUserModal.classList.add('hidden');
    }, 300);
}

function setupEditUserAction() {
    editUserForm.onsubmit = async (e) => {
        e.preventDefault();
        
        const id = editUserId.value;
        const usernameVal = editUsername.value;
        const passwordVal = editPassword.value;
        
        const payload = {
            username: usernameVal,
            password: passwordVal || null
        };
        
        try {
            const response = await authFetch(`${USERS_URL}/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) throw new Error('فشل تعديل بيانات الحساب');
            
            showToast('تم تعديل بيانات الحساب بنجاح', 'bg-emerald-500', '✓');
            closeEditUserModal();
            
            // If the admin changed their own username/password, they might need to log in again,
            // but for simplicity, we just reload the users table:
            await loadUsers();
            
            // Update logged-in user display if editing 'admin' username
            if (id === '1') { // admin is id 1
                localStorage.setItem('username', usernameVal);
                activeUserDisplay.textContent = usernameVal;
            }
        } catch (error) {
            console.error('Edit user error:', error);
            showToast(error.message || 'حدث خطأ أثناء التعديل', 'bg-rose-500', '✗');
        }
    };
}

// ----------------- ITEM MANAGEMENT -----------------

function normalizeArabic(str) {
    if (!str) return '';
    return String(str)
        .trim()
        .replace(/[أإآا]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي');
}

async function loadItems() {
    showDeptLoading();
    try {
        const username = localStorage.getItem('username');
        if (username && username !== 'admin') {
            try {
                const permUrl = `${API_URL.replace('/items', '/users')}/me/permissions`;
                console.log('[DEBUG] loadItems: Fetching permissions from:', permUrl);
                const permsResponse = await authFetch(permUrl);
                console.log('[DEBUG] loadItems: Permissions response status:', permsResponse.status);
                if (permsResponse.ok) {
                    userPermissionsList = await permsResponse.json();
                    console.log('[DEBUG] loadItems: userPermissionsList:', JSON.stringify(userPermissionsList));
                } else {
                    const errText = await permsResponse.text();
                    console.error('[DEBUG] loadItems: Permissions fetch failed:', errText);
                }
            } catch (err) {
                console.error('Error loading user permissions in loadItems:', err);
            }
        }
        
        let url = `${API_URL}/?category=${encodeURIComponent(currentDepartment)}`;
        if (currentSubcategory) {
            url += `&subcategory=${encodeURIComponent(currentSubcategory)}`;
        }
        
        const response = await authFetch(url);
        if (!response.ok) throw new Error('Failed to fetch items');
        allItems = await response.json();
        renderItemsGrid();
    } catch (error) {
        console.error('Error fetching items:', error);
        showToast('خطأ في جلب بيانات البنود', 'bg-red-500', '✗');
    } finally {
        hideDeptLoading();
    }
}

function renderItemsGrid() {
    itemsGrid.innerHTML = '';
    
    const username = localStorage.getItem('username');
    const hasEditPermission = username === 'admin' || userPermissionsList.some(p => normalizeArabic(p.department_name) === normalizeArabic(currentDepartment) && (p.can_edit == 1 || p.can_edit === true));
    console.log('[DEBUG] renderItemsGrid: username=', username, ' currentDepartment=', currentDepartment, ' userPermissionsList=', JSON.stringify(userPermissionsList), ' hasEditPermission=', hasEditPermission);
    
    const mainAddBtn = document.getElementById('mainAddItemBtn');
    if (mainAddBtn) {
        if (hasEditPermission) {
            mainAddBtn.classList.remove('hidden');
        } else {
            mainAddBtn.classList.add('hidden');
        }
    }
    
    if (allItems.length === 0) {
        deptEmptyState.classList.remove('hidden');
        return;
    }
    
    deptEmptyState.classList.add('hidden');
    
    allItems.forEach(item => {
        const card = document.createElement('div');
        card.className = 'bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden flex flex-col justify-between hover:shadow-lg transition duration-200';
        
        const imageHTML = item.image_url 
            ? `<img src="${API_HOST}${item.image_url}" alt="${item.name}" class="w-full h-full object-cover">`
            : ''; // Blank background instead of question marks
        
        let badgeHTML = `<span class="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 mb-4">${item.category}</span>`;
        if (item.subcategory) {
            badgeHTML = `<span class="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-100 mb-4">${item.category} / ${item.subcategory}</span>`;
        }

        const descriptionHTML = item.description 
            ? `<p class="text-xs text-slate-500 mt-0.5 mb-3">${item.description}</p>`
            : '';

        card.innerHTML = `
            <div>
                <!-- Item Image -->
                <div class="h-48 w-full bg-slate-100 relative overflow-hidden border-b border-slate-100 flex items-center justify-center">
                    ${imageHTML}
                </div>
                <!-- Content -->
                <div class="p-5">
                    <h4 class="text-lg font-bold text-slate-800 mb-1">${item.name}</h4>
                    ${descriptionHTML}
                    ${badgeHTML}
                    <div class="flex justify-between items-center bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                        <span class="text-sm text-slate-500 font-medium">الكمية المتوفرة:</span>
                        <span class="text-2xl font-black ${item.quantity > 0 ? 'text-slate-800' : 'text-rose-500'}">${item.quantity}</span>
                    </div>
                    <!-- Reservations Summary display -->
                    ${(() => {
                        if (item.reservations && item.reservations.length > 0) {
                            const resTexts = item.reservations.map(r => `تم حجز ${r.quantity} قطع لمشروع ${r.project_name}`).join('، ');
                            return `
                                <div class="mt-2 text-right">
                                    <span class="text-xs text-slate-500 font-medium font-tajawal">
                                        (${resTexts})
                                    </span>
                                </div>
                            `;
                        }
                        return '';
                    })()}
                </div>
            </div>
            <!-- Actions -->
            <div class="p-5 pt-0 flex flex-col gap-2">
                ${hasEditPermission ? `
                <div class="grid grid-cols-2 gap-2">
                    <button onclick="openTxModal(${item.id}, '${item.name.replace(/'/g, "\\'")}')" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-sm hover:shadow">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                        تعديل الكمية
                    </button>
                    <button onclick="openLogModal(${item.id}, '${item.name.replace(/'/g, "\\'")}')" class="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-4 rounded-xl text-xs transition flex items-center justify-center gap-1.5 border border-slate-200">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                        </svg>
                        سجل الحركة
                    </button>
                </div>
                <button onclick="openReservationModal(${item.id}, '${item.name.replace(/'/g, "\\'")}')" class="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 px-4 rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-sm hover:shadow">
                    📌 حجز كمية للمشروع
                </button>
                ${username === 'admin' ? `
                <button onclick="openMoveItemModal(${item.id})" class="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2 px-4 rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-sm hover:shadow mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                    نقل البند
                </button>
                <button onclick="deleteItem(${item.id}, '${item.name.replace(/'/g, "\\'")}')" class="w-full bg-rose-500 hover:bg-rose-600 text-white font-bold py-2 px-4 rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-sm hover:shadow mt-1">
                    🗑️ حذف البند
                </button>
                <button onclick="openEditItemModal(${item.id}, '${item.name.replace(/'/g, "\\'")}', '${(item.description || '').replace(/'/g, "\\'")}')" class="w-full bg-teal-500 hover:bg-teal-600 text-white font-bold py-2 px-4 rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-sm hover:shadow mt-1">
                    ✏️ تعديل معلومات البند
                </button>
                ` : ''}
                ` : `
                <button onclick="openLogModal(${item.id}, '${item.name.replace(/'/g, "\\'")}')" class="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-4 rounded-xl text-xs transition flex items-center justify-center gap-1.5 border border-slate-200">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                    عرض السجل فقط
                </button>
                `}
            </div>
        `;
        itemsGrid.appendChild(card);
    });
}

// ----------------- ADD ITEM MODAL LOGIC -----------------

function openAddItemModal() {
    addItemModalDeptTitle.textContent = currentDepartment;
    
    if (currentDepartment === 'إكسسوارات') {
        subcategoryFieldContainer.classList.remove('hidden');
        if (currentSubcategory) {
            document.getElementById('itemSubcategory').value = currentSubcategory;
        }
    } else {
        subcategoryFieldContainer.classList.add('hidden');
    }

    addItemModal.classList.remove('hidden');
    void addItemModal.offsetWidth;
    addItemModal.classList.remove('opacity-0');
    addItemModal.querySelector('.transform').classList.remove('scale-95');
}

function closeAddItemModal() {
    addItemModal.classList.add('opacity-0');
    addItemModal.querySelector('.transform').classList.add('scale-95');
    setTimeout(() => {
        addItemModal.classList.add('hidden');
        addItemForm.reset();
        document.getElementById('imageUploadName').textContent = 'اضغط هنا لرفع صورة البند';
    }, 300);
}

// File Change Helper
function handleFileChange(input, labelId) {
    const label = document.getElementById(labelId);
    if (input.files && input.files.length > 0) {
        label.textContent = `مستعد للرفع: ${input.files[0].name}`;
        label.classList.add('text-indigo-600', 'font-semibold');
    } else {
        label.textContent = 'اضغط هنا لرفع صورة البند';
        label.classList.remove('text-indigo-600', 'font-semibold');
    }
}

addItemForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('itemName').value;
    const description = document.getElementById('itemDescription').value;
    const quantity = parseInt(document.getElementById('itemQuantity').value) || 0;
    const imageFile = document.getElementById('itemImage').files[0];
    
    const formData = new FormData();
    formData.append('name', name);
    formData.append('category', currentDepartment);
    formData.append('quantity', quantity);
    
    if (description) {
        formData.append('description', description);
    }
    
    const dept = globalDepartments.find(d => d.name === currentDepartment);
    if (dept && dept.subdepartments && dept.subdepartments.length > 0) {
        const subcategory = document.getElementById('itemSubcategory').value;
        if(subcategory) formData.append('subcategory', subcategory);
    }
    
    if (imageFile) {
        formData.append('image', imageFile);
    }
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn ? submitBtn.innerHTML : '';
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = 'جاري الحفظ...';
    }
    
    try {
        const response = await authFetch(`${API_URL}/`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) throw new Error('Failed to create item');
        
        showToast('تم حفظ البند بنجاح', 'bg-emerald-500', '✓');
        closeAddItemModal();
        await loadItems();
    } catch (error) {
        console.error('Error adding item:', error);
        showToast('خطأ أثناء حفظ البند', 'bg-rose-500', '✗');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    }
});

async function deleteItem(itemId, itemName) {
    if (!confirm(`هل أنت متأكد من رغبتك في حذف البند "${itemName}" بالكامل؟ سيتم حذف جميع الحركات والحجوزات المرتبطة به. لا يمكن التراجع عن هذا الإجراء.`)) {
        return;
    }
    
    try {
        const response = await authFetch(`${API_HOST}/api/items/${itemId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.detail || 'فشل حذف البند');
        }
        
        showToast('تم حذف البند بنجاح', 'bg-emerald-500', '✓');
        await loadItems(); // Refresh the items list
        fetchDepartmentCounts(); // Refresh the counts on the home page
    } catch (error) {
        console.error('Error deleting item:', error);
        showToast(error.message || 'خطأ أثناء حذف البند', 'bg-rose-500', '✗');
    }
}

// ----------------- EDIT ITEM INFO LOGIC -----------------

const editItemModal = document.getElementById('editItemModal');
const editItemForm = document.getElementById('editItemForm');

function openEditItemModal(itemId, currentName, currentDesc) {
    document.getElementById('editItemId').value = itemId;
    document.getElementById('editItemName').value = currentName || '';
    document.getElementById('editItemDescription').value = currentDesc || '';
    
    editItemModal.classList.remove('hidden');
    void editItemModal.offsetWidth;
    editItemModal.classList.remove('opacity-0');
    editItemModal.querySelector('.transform').classList.remove('scale-95');
}

function closeEditItemModal() {
    editItemModal.classList.add('opacity-0');
    editItemModal.querySelector('.transform').classList.add('scale-95');
    setTimeout(() => {
        editItemModal.classList.add('hidden');
        if (editItemForm) editItemForm.reset();
    }, 300);
}

if (editItemForm) {
    editItemForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const submitBtn = editItemForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="inline-block animate-spin mr-2">⟳</span> جاري الحفظ...';
        
        try {
            const itemId = document.getElementById('editItemId').value;
            const name = document.getElementById('editItemName').value;
            const description = document.getElementById('editItemDescription').value;
            
            const response = await authFetch(`${API_HOST}/api/items/${itemId}/info`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name, description })
            });
            
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.detail || 'فشل تحديث بيانات البند');
            }
            
            showToast('تم تحديث معلومات البند بنجاح', 'bg-emerald-500', '✓');
            closeEditItemModal();
            await loadItems();
        } catch (error) {
            console.error('Error updating item info:', error);
            showToast(error.message || 'خطأ أثناء تحديث معلومات البند', 'bg-rose-500', '✗');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    });
}

// ----------------- TRANSACTION MODAL LOGIC -----------------


function openTxModal(itemId, itemName) {
    txItemId.value = itemId;
    txItemName.textContent = itemName;
    
    // reset form
    txForm.reset();
    document.querySelector('input[value="add"]').checked = true;
    document.querySelector('input[value="add"]').dispatchEvent(new Event('change'));

    txModal.classList.remove('hidden');
    void txModal.offsetWidth;
    txModal.classList.remove('opacity-0');
    txModal.querySelector('.transform').classList.remove('scale-95');
}

function closeTxModal() {
    txModal.classList.add('opacity-0');
    txModal.querySelector('.transform').classList.add('scale-95');
    setTimeout(() => {
        txModal.classList.add('hidden');
    }, 300);
}

txForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const itemId = txItemId.value;
    const amount = parseInt(document.getElementById('txAmount').value);
    const txType = document.querySelector('input[name="txType"]:checked').value;
    const project = document.getElementById('txProject').value;
    const notes = document.getElementById('txNotes').value;
    
    const finalChange = txType === 'add' ? amount : -amount;
    
    const payload = {
        change: finalChange,
        project_name: project || null,
        notes: notes || null
    };
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn ? submitBtn.innerHTML : '';
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = 'جاري الحفظ...';
    }
    
    try {
        const response = await authFetch(`${API_URL}/${itemId}/transactions/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.detail || 'Failed to log transaction');
        }
        
        showToast('تم تعديل الكمية بنجاح', 'bg-emerald-500', '✓');
        closeTxModal();
        await loadItems();
    } catch (error) {
        console.error('Error recording transaction:', error);
        showToast(error.message || 'خطأ في تعديل الكمية. تأكد من أن الرصيد يكفي للخصم.', 'bg-rose-500', '✗');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    }
});

// ----------------- LOG/HISTORY MODAL LOGIC -----------------

async function openLogModal(itemId, itemName) {
    activeLogItemId = itemId;
    logItemName.textContent = itemName;
    logTableBody.innerHTML = '';
    
    // Populate description input & handle admin-only controls visibility
    const item = allItems.find(i => i.id === itemId);
    const username = localStorage.getItem('username');
    const descriptionEditContainer = document.getElementById('logDescriptionEditContainer');
    const descriptionReadOnlyContainer = document.getElementById('logDescriptionReadOnlyContainer');
    const descriptionText = document.getElementById('logItemDescriptionText');
    const imageUploadLabel = document.getElementById('logImageUploadLabel');
    
    if (username === 'admin') {
        if (descriptionEditContainer) descriptionEditContainer.classList.remove('hidden');
        if (descriptionReadOnlyContainer) descriptionReadOnlyContainer.classList.add('hidden');
        if (imageUploadLabel) imageUploadLabel.classList.remove('hidden');
        
        if (item) {
            document.getElementById('logItemDescriptionInput').value = item.description || '';
        } else {
            document.getElementById('logItemDescriptionInput').value = '';
        }
    } else {
        if (descriptionEditContainer) descriptionEditContainer.classList.add('hidden');
        if (descriptionReadOnlyContainer) descriptionReadOnlyContainer.classList.remove('hidden');
        if (imageUploadLabel) imageUploadLabel.classList.add('hidden');
        
        if (item && item.description) {
            descriptionText.textContent = item.description;
        } else {
            descriptionText.textContent = 'لا يوجد وصف لهذا البند';
        }
    }
    
    // Render active reservations
    const reservationsContainer = document.getElementById('activeReservationsContainer');
    const reservationsList = document.getElementById('activeReservationsList');
    reservationsList.innerHTML = '';
    
    if (item && item.reservations && item.reservations.length > 0) {
        reservationsContainer.classList.remove('hidden');
        item.reservations.forEach(res => {
            const row = document.createElement('div');
            row.className = 'flex justify-between items-center bg-white p-2.5 rounded-lg border border-slate-100 shadow-sm text-xs';
            row.innerHTML = `
                <div>
                    <span class="font-bold text-slate-800">حجز ${res.quantity} قطع</span>
                    <span class="text-slate-500">لمشروع</span>
                    <span class="font-black text-indigo-700">${res.project_name}</span>
                    <span class="text-slate-400"> (بواسطة: ${res.username || 'النظام'})</span>
                </div>
                <button onclick="cancelReservation(${res.id})" class="text-rose-600 hover:text-rose-800 font-bold hover:underline transition">
                    ❌ إلغاء الحجز
                </button>
            `;
            reservationsList.appendChild(row);
        });
    } else {
        reservationsContainer.classList.add('hidden');
    }
    
    logModal.classList.remove('hidden');
    void logModal.offsetWidth;
    logModal.classList.remove('opacity-0');
    logModal.querySelector('.transform').classList.remove('scale-95');
    
    showLogLoading();
    
    try {
        const response = await authFetch(`${API_URL}/${itemId}/transactions/`);
        if (!response.ok) throw new Error('Failed to fetch transactions');
        const txs = await response.json();
        renderLogTable(txs);
    } catch (error) {
        console.error('Error fetching logs:', error);
        showToast('خطأ أثناء جلب سجل الحركات', 'bg-rose-500', '✗');
    } finally {
        hideLogLoading();
    }
}

function renderLogTable(txs) {
    logTableBody.innerHTML = '';
    
    if (txs.length === 0) {
        logEmpty.classList.remove('hidden');
        btnRevertLastTx.disabled = true;
        btnRevertLastTx.classList.add('opacity-50', 'cursor-not-allowed');
        return;
    }
    
    logEmpty.classList.add('hidden');
    btnRevertLastTx.disabled = false;
    btnRevertLastTx.classList.remove('opacity-50', 'cursor-not-allowed');
    
    txs.forEach(tx => {
        const row = document.createElement('tr');
        row.className = 'border-b hover:bg-slate-50 transition text-sm';
        
        const dateStr = new Date(tx.timestamp).toLocaleString('ar-EG', {
            year: 'numeric', month: 'numeric', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
        
        const isAdd = tx.change > 0;
        const changeBadge = isAdd 
            ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">+${tx.change}</span>`
            : `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-100">${tx.change}</span>`;
            
        const userDisplay = tx.username || 'النظام';

        row.innerHTML = `
            <td class="p-3 text-slate-500 text-xs">${dateStr}</td>
            <td class="p-3 font-semibold text-slate-800">${isAdd ? 'إضافة للمخزن' : 'خصم من المخزن'}</td>
            <td class="p-3">${changeBadge}</td>
            <td class="p-3 text-slate-700">${tx.project_name || '-'}</td>
            <td class="p-3 text-slate-500 text-xs">${tx.notes || '-'}</td>
            <td class="p-3 text-indigo-600 font-bold text-xs">${userDisplay}</td>
        `;
        
        logTableBody.appendChild(row);
    });
}

function closeLogModal() {
    logModal.classList.add('opacity-0');
    logModal.querySelector('.transform').classList.add('scale-95');
    setTimeout(() => {
        logModal.classList.add('hidden');
        activeLogItemId = null;
    }, 300);
}

// ----------------- LOADING STATE HELPERS -----------------

function showDeptLoading() {
    itemsGrid.innerHTML = '';
    deptEmptyState.classList.add('hidden');
    deptLoadingIndicator.classList.remove('hidden');
}

function hideDeptLoading() {
    deptLoadingIndicator.classList.add('hidden');
}

function showLogLoading() {
    logEmpty.classList.add('hidden');
    logLoading.classList.remove('hidden');
}

function hideLogLoading() {
    logLoading.classList.add('hidden');
}

// Toast Helpers
let toastTimeout;
function showToast(message, bgColorClass = 'bg-emerald-500', icon = '✓') {
    toastMessage.textContent = message;
    toastIcon.textContent = icon;
    
    toast.className = `fixed bottom-4 left-4 right-auto text-white px-6 py-3.5 rounded-xl shadow-xl transform translate-y-20 opacity-0 transition-all duration-300 pointer-events-none z-50 text-sm font-semibold flex items-center gap-2 ${bgColorClass}`;
    
    void toast.offsetWidth;
    
    toast.classList.add('toast-visible');
    
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.classList.remove('toast-visible');
    }, 4000);
}

// ----------------- RESERVATION SYSTEM LOGIC -----------------

const reservationModal = document.getElementById('reservationModal');
const reservationForm = document.getElementById('reservationForm');
const resItemId = document.getElementById('resItemId');
const resItemName = document.getElementById('resItemName');

function openReservationModal(itemId, itemName) {
    resItemId.value = itemId;
    resItemName.textContent = itemName;
    reservationForm.reset();

    reservationModal.classList.remove('hidden');
    void reservationModal.offsetWidth;
    reservationModal.classList.remove('opacity-0');
    reservationModal.querySelector('.transform').classList.remove('scale-95');
}

function closeReservationModal() {
    reservationModal.classList.add('opacity-0');
    reservationModal.querySelector('.transform').classList.add('scale-95');
    setTimeout(() => {
        reservationModal.classList.add('hidden');
    }, 300);
}

reservationForm.onsubmit = async (e) => {
    e.preventDefault();
    
    const itemId = resItemId.value;
    const qty = parseInt(document.getElementById('resQuantity').value);
    const project = document.getElementById('resProject').value;
    
    const payload = {
        quantity: qty,
        project_name: project
    };
    
    try {
        const response = await authFetch(`${API_URL}/${itemId}/reservations/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.detail || 'فشل حجز الكمية');
        }
        
        showToast('تم حجز الكمية للمشروع بنجاح', 'bg-emerald-500', '✓');
        closeReservationModal();
        await loadItems();
    } catch (error) {
        console.error('Error reserving item:', error);
        showToast(error.message || 'خطأ أثناء الحجز. تأكد من توفر الكمية المطلوبة.', 'bg-rose-500', '✗');
    }
};

async function cancelReservation(reservationId) {
    if (!confirm('هل أنت متأكد من رغبتك في إلغاء هذا الحجز؟')) return;
    
    try {
        const response = await authFetch(`${API_HOST}/api/reservations/${reservationId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.detail || 'Failed to cancel reservation');
        }
        
        showToast('تم إلغاء الحجز بنجاح وإعادة إتاحة الكمية للجميع', 'bg-emerald-500', '✓');
        closeLogModal();
        await loadItems();
        
    } catch (error) {
        console.error('Error cancelling reservation:', error);
        showToast(error.message || 'خطأ أثناء إلغاء الحجز', 'bg-rose-500', '✗');
    }
}

// ----------------- AUTOMATIC SYNC POLLING -----------------

setInterval(() => {
    const token = localStorage.getItem('token');
    // Poll only if logged in, in app view, not in admin panel, and no active dialog modals are open
    if (token && 
        !appContainer.classList.contains('hidden') && 
        adminView.classList.contains('hidden') &&
        addItemModal.classList.contains('hidden') &&
        txModal.classList.contains('hidden') &&
        logModal.classList.contains('hidden') &&
        reservationModal.classList.contains('hidden') &&
        editUserModal.classList.contains('hidden') &&
        currentDepartment) {
        
        fetchDepartmentCounts();
        silentLoadItems();
    }
}, 5000);

async function silentLoadItems() {
    try {
        let url = `${API_URL}/?category=${encodeURIComponent(currentDepartment)}`;
        if (currentSubcategory) {
            url += `&subcategory=${encodeURIComponent(currentSubcategory)}`;
        }
        
        const response = await authFetch(url);
        if (response.ok) {
            allItems = await response.json();
            renderItemsGrid();
        }
    } catch (error) {
        console.error('Silent refresh failed:', error);
    }
}

// ----------------- ADMIN DEPARTMENTS LOGIC -----------------

const addDepartmentModal = document.getElementById('addDepartmentModal');
const addDepartmentForm = document.getElementById('addDepartmentForm');
const permissionsModal = document.getElementById('permissionsModal');

function openAddDepartmentModal() {
    addDepartmentForm.reset();
    addDepartmentModal.classList.remove('hidden');
    void addDepartmentModal.offsetWidth;
    addDepartmentModal.classList.remove('opacity-0');
    addDepartmentModal.querySelector('.transform').classList.remove('scale-95');
}

function closeAddDepartmentModal() {
    addDepartmentModal.classList.add('opacity-0');
    addDepartmentModal.querySelector('.transform').classList.add('scale-95');
    setTimeout(() => {
        addDepartmentModal.classList.add('hidden');
    }, 300);
}

if(addDepartmentForm) {
    addDepartmentForm.onsubmit = async (e) => {
        e.preventDefault();
        const deptName = document.getElementById('newDepartmentName').value;
        try {
            const response = await authFetch(`${API_URL.replace('/items', '/departments')}/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: deptName })
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || 'Failed to add department');
            }
            showToast('تمت إضافة القسم بنجاح', 'bg-emerald-500', '✓');
            closeAddDepartmentModal();
            fetchDepartmentCounts(); // Reload grid
        } catch (err) {
            showToast(err.message, 'bg-rose-500', '✗');
        }
    };
}

async function deleteCurrentDepartment() {
    if (!confirm(`هل أنت متأكد من حذف القسم ${currentDepartment}؟ سيتم الرفض إذا كان يحتوي على بنود.`)) return;
    try {
        const dept = globalDepartments.find(d => d.name === currentDepartment);
        if(!dept) throw new Error("Department not found");
        
        const response = await authFetch(`${API_URL.replace('/items', '/departments')}/${dept.id}`, {
            method: 'DELETE'
        });
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.detail || 'Failed to delete department');
        }
        showToast('تم الحذف بنجاح', 'bg-emerald-500', '✓');
        showDepartmentsView();
    } catch (err) {
        showToast(err.message, 'bg-rose-500', '✗');
    }
}

const addSubDeptForm = document.getElementById('addSubDeptForm');
if(addSubDeptForm) {
    addSubDeptForm.onsubmit = async (e) => {
        e.preventDefault();
        const subName = document.getElementById('newSubDeptName').value;
        const dept = globalDepartments.find(d => d.name === currentDepartment);
        if(!dept) return;
        
        try {
            const response = await authFetch(`${API_URL.replace('/items', '/departments')}/${dept.id}/sub/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: subName })
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || 'Failed to add sub-department');
            }
            showToast('تمت إضافة القسم الفرعي بنجاح', 'bg-emerald-500', '✓');
            document.getElementById('newSubDeptName').value = '';
            // Reload
            await fetchDepartmentCounts();
            enterSubDeptView(currentDepartment);
        } catch (err) {
            showToast(err.message, 'bg-rose-500', '✗');
        }
    };
}

async function deleteSubDepartment(subId) {
    if (!confirm(`هل أنت متأكد من حذف القسم الفرعي؟ سيتم الرفض إذا كان يحتوي على بنود.`)) return;
    try {
        const response = await authFetch(`${API_URL.replace('/items', '/subdepartments')}/${subId}`, {
            method: 'DELETE'
        });
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.detail || 'Failed to delete sub-department');
        }
        showToast('تم الحذف بنجاح', 'bg-emerald-500', '✓');
        await fetchDepartmentCounts();
        enterSubDeptView(currentDepartment);
    } catch (err) {
        showToast(err.message, 'bg-rose-500', '✗');
    }
}

// ----------------- ADMIN PERMISSIONS LOGIC -----------------

async function openPermissionsModal(userId, username) {
    document.getElementById('permissionsUserName').textContent = username;
    const permissionsList = document.getElementById('permissionsList');
    permissionsList.innerHTML = '<p class="text-slate-500 text-sm">جاري تحميل الصلاحيات...</p>';
    
    permissionsModal.classList.remove('hidden');
    void permissionsModal.offsetWidth;
    permissionsModal.classList.remove('opacity-0');
    permissionsModal.querySelector('.transform').classList.remove('scale-95');
    
    try {
        // Load all users and their permissions from USERS_URL which now returns permissions inside the user object
        const usersResp = await authFetch(USERS_URL);
        if (!usersResp.ok) {
            throw await handleBadResponse(usersResp, 'فشلت عملية جلب الحسابات');
        }
        const users = await usersResp.json();
        const user = users.find(u => u.id === userId);
        
        if (!user) throw new Error('User not found');
        
        // Ensure globalDepartments are loaded
        if (globalDepartments.length === 0) {
            const deptsResponse = await authFetch(`${API_URL.replace('/items', '/departments')}/`);
            globalDepartments = await deptsResponse.json();
        }
        
        permissionsList.innerHTML = '';
        
        globalDepartments.forEach(dept => {
            const perm = user.permissions.find(p => normalizeArabic(p.department_name) === normalizeArabic(dept.name));
            const canEdit = perm && (perm.can_edit == 1 || perm.can_edit === true);
            
            permissionsList.innerHTML += `
                <div class="flex items-center justify-between p-3 border border-slate-100 rounded-xl bg-slate-50">
                    <div>
                        <p class="font-bold text-slate-800">${dept.name}</p>
                        <p class="text-xs text-slate-500">منح صلاحية الإضافة والتعديل</p>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" ${canEdit ? 'checked' : ''} onchange="togglePermission(${userId}, '${dept.name}', this.checked)" class="sr-only peer">
                        <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                </div>
            `;
        });
        
    } catch (err) {
        permissionsList.innerHTML = `<p class="text-rose-500 text-sm">${err.message}</p>`;
    }
}

function closePermissionsModal() {
    permissionsModal.classList.add('opacity-0');
    permissionsModal.querySelector('.transform').classList.add('scale-95');
    setTimeout(() => {
        permissionsModal.classList.add('hidden');
    }, 300);
}

async function togglePermission(userId, deptName, canEdit) {
    try {
        const response = await authFetch(`${API_URL.replace('/items', '/users')}/${userId}/permissions/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ department_name: deptName, can_edit: canEdit ? 1 : 0 })
        });
        if (!response.ok) {
            throw new Error('Failed to update permission');
        }
        showToast('تم تحديث الصلاحية بنجاح', 'bg-emerald-500', '✓');
    } catch (err) {
        showToast(err.message, 'bg-rose-500', '✗');
    }
}

// ==========================================
//           PROJECTS MODULE LOGIC
// ==========================================

const PROJECTS_URL = `${API_HOST}/api/projects`;

function showModuleSelectorView() {
    const _pView = document.getElementById('purchasingView');
    if(_pView) _pView.classList.add('hidden');
    const _prdView = document.getElementById('purchaseRequestDetailView');
    if(_prdView) _prdView.classList.add('hidden');

    document.getElementById('moduleSelectorView').classList.remove('hidden');
    document.getElementById('projectsView').classList.add('hidden');
    document.getElementById('projectWizardView').classList.add('hidden');
    departmentsView.classList.add('hidden');
    accessoriesSubDeptView.classList.add('hidden');
    departmentDetailView.classList.add('hidden');
    adminView.classList.add('hidden');
    const pdView = document.getElementById('projectDetailView');
    if(pdView) pdView.classList.add('hidden');
}

function showProjectsView() {
    const _pView = document.getElementById('purchasingView');
    if(_pView) _pView.classList.add('hidden');
    const _prdView = document.getElementById('purchaseRequestDetailView');
    if(_prdView) _prdView.classList.add('hidden');

    document.getElementById('moduleSelectorView').classList.add('hidden');
    document.getElementById('projectsView').classList.remove('hidden');
    document.getElementById('projectWizardView').classList.add('hidden');
    departmentsView.classList.add('hidden');
    accessoriesSubDeptView.classList.add('hidden');
    departmentDetailView.classList.add('hidden');
    adminView.classList.add('hidden');
    const pdView = document.getElementById('projectDetailView');
    if(pdView) pdView.classList.add('hidden');
    loadProjects();
}

let currentEditingProjectId = null;

function openProjectWizard() {
    const _pView = document.getElementById('purchasingView');
    if(_pView) _pView.classList.add('hidden');
    const _prdView = document.getElementById('purchaseRequestDetailView');
    if(_prdView) _prdView.classList.add('hidden');

    currentEditingProjectId = null;
    const title = document.getElementById('wizardTitle');
    if (title) title.textContent = 'إضافة مشروع جديد';
    
    const existAtt = document.getElementById('existingAttachmentsContainer');
    if (existAtt) existAtt.classList.add('hidden');

    document.getElementById('moduleSelectorView').classList.add('hidden');
    document.getElementById('projectsView').classList.add('hidden');
    document.getElementById('projectWizardView').classList.remove('hidden');
    departmentsView.classList.add('hidden');
    accessoriesSubDeptView.classList.add('hidden');
    departmentDetailView.classList.add('hidden');
    adminView.classList.add('hidden');
    const pdView = document.getElementById('projectDetailView');
    if(pdView) pdView.classList.add('hidden');
    
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
        <td class="p-2"><input type="text" class="w-16 px-2 py-1 border rounded text-center font-bold" placeholder="رقم"></td>
        <td class="p-2"><input type="number" step="0.01" class="w-16 px-2 py-1 border rounded text-center" placeholder="عرض"></td>
        <td class="p-2"><input type="number" step="0.01" class="w-16 px-2 py-1 border rounded text-center" placeholder="طول"></td>
        <td class="p-2"><input type="number" step="0.01" class="w-16 px-2 py-1 border rounded text-center" placeholder="عمق"></td>
        <td class="p-2">
            <select class="w-full px-2 py-1 border rounded bg-white text-sm">
                <option value="" disabled selected>الاتجاه</option>
                <option value="RH">RH</option>
                <option value="LH">LH</option>
            </select>
        </td>
        <td class="p-2">
            <select class="w-full px-2 py-1 border rounded bg-white text-sm">
                <option value="" disabled selected>الزرفيل</option>
                <option value="devon mortice lock">devon mortice lock</option>
                <option value="euroart mortice lock">euroart mortice lock</option>
                <option value="euroart roller">euroart roller</option>
                <option value="consort mortice lock">consort mortice lock</option>
                <option value="special">special</option>
            </select>
        </td>
        <td class="p-2">
            <select class="w-full px-2 py-1 border rounded bg-white text-sm">
                <option value="" disabled selected>المقطع</option>
                <option value="single rabbit with rubber">single rabbit with rubber</option>
                <option value="double rabbit with rubber">double rabbit with rubber</option>
                <option value="single rabbit">single rabbit</option>
                <option value="double rabbit">double rabbit</option>
            </select>
        </td>
        <td class="p-2">
            <select class="w-full px-2 py-1 border rounded bg-white text-sm">
                <option value="" disabled selected>نوع الباب</option>
                <option value="single leaf">single leaf</option>
                <option value="double leaf">double leaf</option>
            </select>
        </td>
        <td class="p-2 text-center"><input type="checkbox" class="w-4 h-4"></td>
        <td class="p-2"><input type="text" class="w-full px-2 py-1 border rounded" placeholder="الكشفة"></td>
        <td class="p-2"><input type="text" class="w-full px-2 py-1 border rounded" placeholder="الكشفة 2"></td>
        <td class="p-2"><input type="text" class="w-full px-2 py-1 border rounded" placeholder="تحت البلاط"></td>
        <td class="p-2"><input type="text" class="w-full px-2 py-1 border rounded" placeholder="الشباك"></td>
        <td class="p-2"><input type="text" class="w-full px-2 py-1 border rounded" placeholder="ملاحظات"></td>
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
        const response = await authFetch(USERS_BASIC_URL);
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
                
                let statusBadge = '<span class="px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg font-bold text-xs">قيد الانتظار</span>';
                if (p.status === 'active') {
                    statusBadge = '<span class="px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg font-bold text-xs">فعال</span>';
                } else if (p.status === 'completed') {
                    statusBadge = '<span class="px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg font-bold text-xs">منتهي</span>';
                }
                
                tr.innerHTML = `
                    <td class="p-4 font-bold text-slate-800">${p.project_number || '-'}</td>
                    <td class="p-4">${p.name || '-'}</td>
                    <td class="p-4 text-slate-500">${p.contractor_name || '-'}</td>
                    <td class="p-4 text-slate-500" dir="ltr">${p.delivery_date ? new Date(p.delivery_date).toLocaleDateString() : '-'}</td>
                    <td class="p-4">${statusBadge}</td>
                    <td class="p-4 text-center">
                        <button onclick="viewProjectDetails(${p.id})" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition font-bold text-xs">التفاصيل</button>
                    </td>
                    <td class="p-4 text-center">
                        <button onclick="openProjectTracking(${p.id})" class="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg transition font-bold text-xs border border-indigo-200">متابعة</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
            if(projects.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-slate-400">لا يوجد مشاريع مسجلة حالياً.</td></tr>`;
            }
        }
    } catch (e) {
        showToast('خطأ أثناء تحميل المشاريع', 'bg-rose-500', '✗');
    } finally {
        loading.classList.add('hidden');
    }
}

async function viewProjectDetails(id) {
    document.getElementById('moduleSelectorView').classList.add('hidden');
    document.getElementById('projectsView').classList.add('hidden');
    document.getElementById('projectWizardView').classList.add('hidden');
    const projectDetailView = document.getElementById('projectDetailView');
    if (projectDetailView) projectDetailView.classList.remove('hidden');
    
    document.getElementById('pdSubtitle').textContent = "جاري التحميل...";
    document.getElementById('pdEngineeringTableBody').innerHTML = '<tr><td colspan="14" class="p-4 text-center">جاري التحميل...</td></tr>';
    
    try {
        const response = await authFetch(`${PROJECTS_URL}/${id}`);
        if (!response.ok) throw new Error('فشل جلب تفاصيل المشروع');
        
        const p = await response.json();
        window.currentProjectData = p;
        
        document.getElementById('pdTitle').textContent = p.name;
        document.getElementById('pdSubtitle').textContent = p.delivery_date ? `تاريخ التسليم المتوقع: ${new Date(p.delivery_date).toLocaleDateString()}` : '';
        
        document.getElementById('pdNumber').textContent = p.project_number;
        document.getElementById('pdContractor').textContent = p.contractor_name || '-';
        document.getElementById('pdDelivery').textContent = p.delivery_date ? new Date(p.delivery_date).toLocaleDateString() : '-';
        document.getElementById('pdEngineer').textContent = p.engineer_name || '-';
        document.getElementById('pdEngineerPhone').textContent = p.engineer_phone || '-';
        document.getElementById('pdLocation').textContent = p.location || '-';
        document.getElementById('pdPaint').textContent = p.paint_color || '-';
        if(document.getElementById('pdManufacturingType')) document.getElementById('pdManufacturingType').textContent = p.manufacturing_type || '-';
        if(document.getElementById('pdInstallationType')) document.getElementById('pdInstallationType').textContent = p.installation_type || '-';
        if(document.getElementById('pdNotes')) document.getElementById('pdNotes').textContent = p.notes || 'لا توجد ملاحظات عامة مسجلة لهذا المشروع.';
        
        document.getElementById('pdAssignee').textContent = '-';
        if (p.executive_manager_id) {
            authFetch(USERS_BASIC_URL).then(res => res.json()).then(users => {
                const assignee = users.find(u => u.id === p.executive_manager_id);
                if (assignee) document.getElementById('pdAssignee').textContent = assignee.username;
            }).catch(() => {});
        }
        
        const badge = document.getElementById('pdStatusBadge');
        
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
                    const editHtml = `
                        <button onclick="editProject(${p.id})" class="mr-3 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 rounded-xl transition font-bold flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            تعديل المشروع
                        </button>
                    `;
                    const deleteHtml = `
                        <button onclick="deleteProjectWithConfirmation(${p.id})" class="mr-3 px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl transition font-bold flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            حذف المشروع
                        </button>
                    `;
                    const trackHtml = `
                        <button onclick="openProjectTracking(${p.id})" class="mr-3 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 rounded-xl transition font-bold flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                            متابعة
                        </button>
                    `;
                    badge.innerHTML = `<div class="flex items-center">` + selectHtml + trackHtml + editHtml + deleteHtml + `</div>`;
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
            const trackHtml = `
                <button onclick="openProjectTracking(${p.id})" class="mr-3 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 rounded-xl transition font-bold flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                    متابعة
                </button>
            `;
            badge.innerHTML = `<div class="flex items-center">` + selectHtml + trackHtml + `</div>`;
        }
        
        const tbody = document.getElementById('pdEngineeringTableBody');
        tbody.innerHTML = '';
        if (p.details && p.details.length > 0) {
            p.details.forEach(d => {
                const tr = document.createElement('tr');
                tr.className = 'border-b hover:bg-slate-50 transition text-sm';
                tr.innerHTML = `
                    <td class="p-3 font-bold">${d.door_number || '-'}</td>
                    <td class="p-3">${d.width || '-'}</td>
                    <td class="p-3">${d.height || '-'}</td>
                    <td class="p-3">${d.depth || '-'}</td>
                    <td class="p-3">${d.direction || '-'}</td>
                    <td class="p-3">${d.lock_type || '-'}</td>
                    <td class="p-3">${d.profile_type || '-'}</td>
                    <td class="p-3">${d.door_type || '-'}</td>
                    <td class="p-3 text-center">${d.fire_resistance || '-'}</td>
                    <td class="p-3">${d.architrave || '-'}</td>
                    <td class="p-3">${d.architrave_2 || '-'}</td>
                    <td class="p-3">${d.under_tile || '-'}</td>
                    <td class="p-3">${d.window_details || '-'}</td>
                    <td class="p-3">${d.notes || '-'}</td>
                `;
                tbody.appendChild(tr);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="14" class="p-4 text-center text-slate-500">لا يوجد تفاصيل هندسية مسجلة</td></tr>';
        }
        
        const attachContainer = document.getElementById('pdAttachments');
        attachContainer.innerHTML = '';
        if (p.attachments && p.attachments.length > 0) {
            p.attachments.forEach(a => {
                const link = document.createElement('a');
                link.href = `${API_HOST}${a.file_url}`;
                link.target = '_blank';
                link.className = 'flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition text-slate-700 font-bold text-sm';
                link.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                    <span class="truncate">${a.file_name}</span>
                `;
                attachContainer.appendChild(link);
            });
        } else {
            attachContainer.innerHTML = '<p class="text-sm text-slate-500 text-center py-4">لا يوجد مرفقات</p>';
        }
        
        // Reset sheet section
        document.getElementById('sheetCalculationSection').classList.remove('hidden');
        document.getElementById('sheetLoading').classList.add('hidden');
        document.getElementById('sheetResults').classList.add('hidden');
        document.getElementById('sheetEmpty').classList.add('hidden');
        
    } catch (e) {
        showToast(e.message, 'bg-rose-500', '✗');
        document.getElementById('pdSubtitle').textContent = "فشل التحميل";
    }
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
            // Collect basic info matching ProjectCreate schema
            const payload = {
                name: document.getElementById('pwName').value,
                project_number: document.getElementById('pwProjectNumber').value,
                contractor_name: document.getElementById('pwContractor').value,
                delivery_date: document.getElementById('pwDeliveryDate').value || null,
                engineer_name: document.getElementById('pwEngineerName').value,
                engineer_phone: document.getElementById('pwEngineerPhone').value,
                location: document.getElementById('pwLocation').value,
                executive_manager_id: document.getElementById('pwAssignee').value ? parseInt(document.getElementById('pwAssignee').value) : null,
                paint_color: document.getElementById('pwPaintColor').value,
                manufacturing_type: document.getElementById('pwManufacturingType') ? document.getElementById('pwManufacturingType').value : null,
                installation_type: document.getElementById('pwInstallationType') ? document.getElementById('pwInstallationType').value : null,
                notes: document.getElementById('pwNotes') ? document.getElementById('pwNotes').value : null,
                status: document.querySelector('input[name="pwStatus"]:checked').value
            };
            
            let response, createdProject;
            if (currentEditingProjectId) {
                response = await authFetch(`${PROJECTS_URL}/${currentEditingProjectId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (!response.ok) throw new Error('Failed to update project');
                createdProject = await response.json();
                
                // Delete existing details before inserting new ones
                await authFetch(`${PROJECTS_URL}/${currentEditingProjectId}/details`, { method: 'DELETE' });
            } else {
                response = await authFetch(PROJECTS_URL + '/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.detail || 'Failed to create project');
                }
                createdProject = await response.json();
            }
            
            // Post details ONE by ONE matching ProjectDetailCreate
            const rows = document.querySelectorAll('#projectDetailsTableBody tr');
            for (let tr of rows) {
                const inputs = tr.querySelectorAll('input, select');
                const detailPayload = {
                    door_number: inputs[0].value || null,
                    width: inputs[1].value || null,
                    height: inputs[2].value || null,
                    depth: inputs[3].value || null,
                    direction: inputs[4].value || null,
                    lock_type: inputs[5].value || null,
                    profile_type: inputs[6].value || null,
                    door_type: inputs[7].value || null,
                    fire_resistance: inputs[8].checked ? 'نعم' : 'لا',
                    architrave: inputs[9].value || null,
                    architrave_2: inputs[10].value || null,
                    under_tile: inputs[11].value || null,
                    window_details: inputs[12].value || null,
                    notes: inputs[13].value || null
                };
                
                await authFetch(`${PROJECTS_URL}/${createdProject.id}/details/`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(detailPayload)
                });
            }
            
            // Post attachments ONE by ONE matching ProjectAttachmentCreate
            const attachmentsInput = document.getElementById('pwAttachments');
            if (attachmentsInput.files.length > 0) {
                for (let file of attachmentsInput.files) {
                    const formData = new FormData();
                    formData.append('file', file); // API expects singular 'file'
                    await authFetch(`${PROJECTS_URL}/${createdProject.id}/attachments/`, {
                        method: 'POST',
                        body: formData
                    });
                }
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

function downloadEngineeringCSV() {
    if (!window.currentProjectData || !window.currentProjectData.details || window.currentProjectData.details.length === 0) {
        showToast('لا توجد تفاصيل هندسية لتحميلها', 'bg-rose-500', '✗');
        return;
    }
    
    const headers = [
        "رقم الباب", "العرض", "الطول", "العمق", "الاتجاه", "الزرفيل", 
        "المقطع", "نوع الباب", "حريق", "الكشفة", "الكشفة 2", 
        "تحت البلاط", "تفصيل الشباك", "ملاحظات"
    ];
    
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += headers.join(",") + "\r\n";
    
    window.currentProjectData.details.forEach(d => {
        const row = [
            d.door_number || '',
            d.width || '',
            d.height || '',
            d.depth || '',
            d.direction || '',
            d.lock_type || '',
            d.profile_type || '',
            d.door_type || '',
            d.fire_resistance || '',
            d.architrave || '',
            d.architrave_2 || '',
            d.under_tile || '',
            d.window_details || '',
            (d.notes || '').replace(/,/g, "،").replace(/\n/g, " ")
        ];
        csvContent += row.join(",") + "\r\n";
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `التفاصيل_الهندسية_${window.currentProjectData.project_number || 'مشروع'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

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


window.deleteExistingAttachment = async function(attachmentId, element) {
    if (confirm("هل أنت متأكد من حذف هذا المرفق؟ لا يمكن التراجع.")) {
        try {
            const response = await authFetch(`${API_HOST}/api/projects/attachments/${attachmentId}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('فشل الحذف');
            element.remove();
            showToast('تم حذف المرفق', 'bg-emerald-500', '✓');
        } catch (e) {
            showToast(e.message, 'bg-rose-500', '✗');
        }
    }
};

window.editProject = async function(projectId) {
    try {
        const response = await authFetch(`${PROJECTS_URL}/${projectId}`);
        if (!response.ok) throw new Error('فشل جلب تفاصيل المشروع');
        const p = await response.json();
        
        currentEditingProjectId = p.id;
        const title = document.getElementById('wizardTitle');
        if (title) title.textContent = 'تعديل مشروع';
        
        document.getElementById('moduleSelectorView').classList.add('hidden');
        document.getElementById('projectsView').classList.add('hidden');
        document.getElementById('projectDetailView').classList.add('hidden');
        document.getElementById('projectWizardView').classList.remove('hidden');
        
        document.getElementById('projectWizardForm').reset();
        await loadAssignees();
        
        // Fill basic info
        document.getElementById('pwName').value = p.name || '';
        document.getElementById('pwProjectNumber').value = p.project_number || '';
        document.getElementById('pwContractor').value = p.contractor_name || '';
        if (p.delivery_date) {
            document.getElementById('pwDeliveryDate').value = p.delivery_date.split('T')[0];
        }
        document.getElementById('pwEngineerName').value = p.engineer_name || '';
        document.getElementById('pwEngineerPhone').value = p.engineer_phone || '';
        document.getElementById('pwLocation').value = p.location || '';
        document.getElementById('pwAssignee').value = p.executive_manager_id || '';
        document.getElementById('pwPaintColor').value = p.paint_color || '';
        if(document.getElementById('pwManufacturingType')) document.getElementById('pwManufacturingType').value = p.manufacturing_type || '';
        if(document.getElementById('pwInstallationType')) document.getElementById('pwInstallationType').value = p.installation_type || '';
        if(document.getElementById('pwNotes')) document.getElementById('pwNotes').value = p.notes || '';
        
        const statusRadios = document.querySelectorAll('input[name="pwStatus"]');
        statusRadios.forEach(r => {
            if (r.value === p.status) r.checked = true;
        });
        
        // Fill details
        const tbody = document.getElementById('projectDetailsTableBody');
        tbody.innerHTML = '';
        if (p.details && p.details.length > 0) {
            p.details.forEach(d => {
                const tr = document.createElement('tr');
                tr.className = 'border-b hover:bg-slate-50 transition';
                tr.innerHTML = `
                    <td class="p-2"><input type="text" class="w-16 px-2 py-2 border border-slate-300 rounded-lg text-sm text-center font-bold" value="${d.door_number || ''}"></td>
                    <td class="p-2"><input type="number" step="0.1" class="w-16 px-1 py-2 border border-slate-300 rounded-lg text-sm text-center" value="${d.width || ''}"></td>
                    <td class="p-2"><input type="number" step="0.1" class="w-16 px-1 py-2 border border-slate-300 rounded-lg text-sm text-center" value="${d.height || ''}"></td>
                    <td class="p-2"><input type="number" step="0.1" class="w-16 px-1 py-2 border border-slate-300 rounded-lg text-sm text-center" value="${d.depth || ''}"></td>
                    <td class="p-2">
                        <select class="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white">
                            <option value="" disabled ${!d.direction ? 'selected' : ''}>الاتجاه</option>
                            <option value="RH" ${d.direction === 'RH' ? 'selected' : ''}>RH</option>
                            <option value="LH" ${d.direction === 'LH' ? 'selected' : ''}>LH</option>
                        </select>
                    </td>
                    <td class="p-2">
                        <select class="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white">
                            <option value="" disabled ${!d.lock_type ? 'selected' : ''}>الزرفيل</option>
                            <option value="devon mortice lock" ${d.lock_type === 'devon mortice lock' ? 'selected' : ''}>devon mortice lock</option>
                            <option value="euroart mortice lock" ${d.lock_type === 'euroart mortice lock' ? 'selected' : ''}>euroart mortice lock</option>
                            <option value="euroart roller" ${d.lock_type === 'euroart roller' ? 'selected' : ''}>euroart roller</option>
                            <option value="consort mortice lock" ${d.lock_type === 'consort mortice lock' ? 'selected' : ''}>consort mortice lock</option>
                            <option value="special" ${d.lock_type === 'special' ? 'selected' : ''}>special</option>
                        </select>
                    </td>
                    <td class="p-2">
                        <select class="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white">
                            <option value="" disabled ${!d.profile_type ? 'selected' : ''}>المقطع</option>
                            <option value="single rabbit with rubber" ${d.profile_type === 'single rabbit with rubber' ? 'selected' : ''}>single rabbit with rubber</option>
                            <option value="double rabbit with rubber" ${d.profile_type === 'double rabbit with rubber' ? 'selected' : ''}>double rabbit with rubber</option>
                            <option value="single rabbit" ${d.profile_type === 'single rabbit' ? 'selected' : ''}>single rabbit</option>
                            <option value="double rabbit" ${d.profile_type === 'double rabbit' ? 'selected' : ''}>double rabbit</option>
                        </select>
                    </td>
                    <td class="p-2">
                        <select class="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white">
                            <option value="" disabled ${!d.door_type ? 'selected' : ''}>نوع الباب</option>
                            <option value="single leaf" ${d.door_type === 'single leaf' ? 'selected' : ''}>single leaf</option>
                            <option value="double leaf" ${d.door_type === 'double leaf' ? 'selected' : ''}>double leaf</option>
                        </select>
                    </td>
                    <td class="p-2 text-center"><input type="checkbox" class="w-5 h-5 text-indigo-600 rounded" ${d.fire_resistance === 'نعم' ? 'checked' : ''}></td>
                    <td class="p-2"><input type="text" class="w-full p-2 border border-slate-300 rounded-lg text-sm" value="${d.architrave || ''}"></td>
                    <td class="p-2"><input type="text" class="w-full p-2 border border-slate-300 rounded-lg text-sm" value="${d.architrave_2 || ''}"></td>
                    <td class="p-2"><input type="text" class="w-full p-2 border border-slate-300 rounded-lg text-sm" value="${d.under_tile || ''}"></td>
                    <td class="p-2"><input type="text" class="w-full p-2 border border-slate-300 rounded-lg text-sm" value="${d.window_details || ''}"></td>
                    <td class="p-2"><input type="text" class="w-full p-2 border border-slate-300 rounded-lg text-sm" value="${d.notes || ''}"></td>
                    <td class="p-2 text-center">
                        <button type="button" onclick="this.closest('tr').remove()" class="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition" title="حذف السطر">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }
        
        // Fill attachments
        const existAttContainer = document.getElementById('existingAttachmentsContainer');
        const existAttList = document.getElementById('existingAttachmentsList');
        if (existAttContainer && existAttList) {
            existAttList.innerHTML = '';
            if (p.attachments && p.attachments.length > 0) {
                existAttContainer.classList.remove('hidden');
                p.attachments.forEach(a => {
                    const div = document.createElement('div');
                    div.className = 'flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg shadow-sm';
                    div.innerHTML = `
                        <div class="flex items-center gap-2 overflow-hidden">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-indigo-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                            <a href="${API_HOST}${a.file_url}" target="_blank" class="text-sm font-bold text-slate-700 truncate hover:text-indigo-600 transition">${a.file_name}</a>
                        </div>
                        <button type="button" onclick="deleteExistingAttachment(${a.id}, this.closest('div.flex'))" class="text-rose-500 hover:text-rose-700 p-1 bg-rose-50 hover:bg-rose-100 rounded transition flex-shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    `;
                    existAttList.appendChild(div);
                });
            } else {
                existAttContainer.classList.add('hidden');
            }
        }
        
        goToWizardStep(1);
    } catch(e) {
        showToast(e.message, 'bg-rose-500', '✗');
    }
};

// ================= PROJECT TRACKING =================
let currentTrackingProjectId = null;
let currentTrackingProjectData = null;

async function openProjectTracking(projectId) {
    try {
        const response = await authFetch(`${PROJECTS_URL}/${projectId}`);
        if (!response.ok) throw new Error('فشل جلب بيانات المشروع');
        
        currentTrackingProjectData = await response.json();
        currentTrackingProjectId = projectId;
        
        document.getElementById('ptProjectName').textContent = currentTrackingProjectData.name;
        document.getElementById('ptDeliveryDate').textContent = currentTrackingProjectData.delivery_date ? new Date(currentTrackingProjectData.delivery_date).toLocaleDateString() : 'غير محدد';
        
        const expDateInput = document.getElementById('ptExpectedDate');
        if (currentTrackingProjectData.expected_completion_date) {
            expDateInput.value = currentTrackingProjectData.expected_completion_date.split('T')[0];
        } else {
            expDateInput.value = '';
        }
        updateExpectedDateColor();
        
        const steps = [
            { key: 'step_design', label: 'التصميم' },
            { key: 'step_cutting', label: 'القص' },
            { key: 'step_forming', label: 'التشكيل' },
            { key: 'step_assembly', label: 'التجميع' },
            { key: 'step_painting', label: 'الدهان' },
            { key: 'step_accessories', label: 'الإكسسوارات' },
            { key: 'step_installation', label: 'التركيب / التسليم' }
        ];
        
        const tbody = document.getElementById('ptStepsBody');
        tbody.innerHTML = '';
        
        steps.forEach(step => {
            const tr = document.createElement('tr');
            tr.className = 'border-b hover:bg-slate-50 transition';
            
            const currentValue = currentTrackingProjectData[step.key] || 'لم يتم البدء';
            
            tr.innerHTML = `
                <td class="p-4 font-bold text-slate-800 text-base border-l border-slate-100">${step.label}</td>
                <td class="p-4">
                    <select onchange="updateTrackingStep('${step.key}', this)" class="w-full max-w-[200px] border rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 transition-colors ${getStepColorClasses(currentValue)}">
                        <option value="لم يتم البدء" ${currentValue === 'لم يتم البدء' ? 'selected' : ''}>لم يتم البدء</option>
                        <option value="جاري العمل" ${currentValue === 'جاري العمل' ? 'selected' : ''}>جاري العمل</option>
                        <option value="تم الانتهاء" ${currentValue === 'تم الانتهاء' ? 'selected' : ''}>تم الانتهاء</option>
                    </select>
                </td>
            `;
            tbody.appendChild(tr);
        });
        
        document.getElementById('projectTrackingView').classList.remove('hidden');
    } catch (e) {
        showToast(e.message, 'bg-rose-500', '✗');
    }
}

function getStepColorClasses(val) {
    if (val === 'تم الانتهاء') return 'bg-emerald-50 border-emerald-200 text-emerald-700 focus:ring-emerald-500';
    if (val === 'جاري العمل') return 'bg-amber-50 border-amber-200 text-amber-700 focus:ring-amber-500';
    return 'bg-slate-50 border-slate-200 text-slate-600 focus:ring-slate-500'; // لم يتم البدء
}

async function updateTrackingStep(field, selectEl) {
    const newVal = selectEl.value;
    selectEl.className = `w-full max-w-[200px] border rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 transition-colors ${getStepColorClasses(newVal)}`;
    
    if (!currentTrackingProjectId) return;
    
    try {
        const payload = {};
        payload[field] = newVal;
        
        const response = await authFetch(`${PROJECTS_URL}/${currentTrackingProjectId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) throw new Error('فشل الحفظ التلقائي');
        showToast('تم الحفظ تلقائياً', 'bg-emerald-500', '✓');
    } catch (e) {
        showToast(e.message, 'bg-rose-500', '✗');
    }
}

async function updateExpectedDate() {
    if (!currentTrackingProjectId) return;
    const dateVal = document.getElementById('ptExpectedDate').value;
    
    try {
        const payload = { expected_completion_date: dateVal ? new Date(dateVal).toISOString() : null };
        const response = await authFetch(`${PROJECTS_URL}/${currentTrackingProjectId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) throw new Error('فشل الحفظ التلقائي لتاريخ الانتهاء المتوقع');
        
        if (currentTrackingProjectData) {
             currentTrackingProjectData.expected_completion_date = payload.expected_completion_date;
        }
        updateExpectedDateColor();
        showToast('تم حفظ تاريخ الانتهاء المتوقع', 'bg-emerald-500', '✓');
    } catch (err) {
        console.error("Error calculating sheets:", err);
    } finally {
        document.getElementById('sheetLoading').classList.add('hidden');
    }
}

// ==========================================
//           PURCHASING MODULE
// ==========================================
const SUPPLIERS_URL = `${API_HOST}/api/suppliers`;
const PURCHASE_REQUESTS_URL = `${API_HOST}/api/purchase-requests`;

function showPurchasingView() {
    const _prdView = document.getElementById('purchaseRequestDetailView');
    if(_prdView) _prdView.classList.add('hidden');

    document.getElementById('moduleSelectorView').classList.add('hidden');
    document.getElementById('projectsView').classList.add('hidden');
    document.getElementById('projectWizardView').classList.add('hidden');
    document.getElementById('projectDetailView').classList.add('hidden');
    departmentsView.classList.add('hidden');
    accessoriesSubDeptView.classList.add('hidden');
    departmentDetailView.classList.add('hidden');
    adminView.classList.add('hidden');

    document.getElementById('purchasingView').classList.remove('hidden');
    switchPurchasingTab('requests'); // Default tab
}

function switchPurchasingTab(tab) {
    const reqTab = document.getElementById('purchaseRequestsTab');
    const supTab = document.getElementById('suppliersTab');
    const btnReq = document.getElementById('tabPurchaseRequests');
    const btnSup = document.getElementById('tabSuppliers');

    if (tab === 'requests') {
        reqTab.classList.remove('hidden');
        supTab.classList.add('hidden');
        btnReq.classList.replace('bg-white', 'bg-amber-600');
        btnReq.classList.replace('text-slate-700', 'text-white');
        btnReq.classList.add('shadow');
        btnSup.classList.replace('bg-amber-600', 'bg-white');
        btnSup.classList.replace('text-white', 'text-slate-700');
        btnSup.classList.remove('shadow');
        loadPurchaseRequests();
    } else {
        reqTab.classList.add('hidden');
        supTab.classList.remove('hidden');
        btnSup.classList.replace('bg-white', 'bg-amber-600');
        btnSup.classList.replace('text-slate-700', 'text-white');
        btnSup.classList.add('shadow');
        btnReq.classList.replace('bg-amber-600', 'bg-white');
        btnReq.classList.replace('text-white', 'text-slate-700');
        btnReq.classList.remove('shadow');
        loadSuppliers();
    }
}

// --- Suppliers Logic ---
async function loadSuppliers() {
    try {
        const response = await authFetch(`${SUPPLIERS_URL}/`);
        const suppliers = await response.json();
        const tbody = document.getElementById('suppliersTableBody');
        tbody.innerHTML = '';
        if (suppliers.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-slate-500">لا يوجد موردين مضافين بعد</td></tr>`;
            return;
        }
        suppliers.forEach(s => {
            const mapsLink = s.maps_url ? `<a href="${s.maps_url}" target="_blank" class="text-blue-500 hover:underline">عرض الخريطة</a>` : '-';
            tbody.innerHTML += `
                <tr class="border-b hover:bg-slate-50 transition">
                    <td class="p-4 font-bold text-slate-800">${s.name}</td>
                    <td class="p-4" dir="ltr">${s.phone || '-'}</td>
                    <td class="p-4 text-slate-600">${s.supply_type || '-'}</td>
                    <td class="p-4">${s.location || '-'} <br> ${mapsLink}</td>
                    <td class="p-4 text-center">
                        <button onclick="editSupplier(${s.id})" class="text-indigo-600 hover:text-indigo-800 p-1"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>
                        <button onclick="deleteSupplier(${s.id})" class="text-rose-600 hover:text-rose-800 p-1"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                    </td>
                </tr>
            `;
        });
    } catch (err) {
        showToast("فشل تحميل قائمة الموردين", "bg-rose-500", "✗");
    }
}

let allSuppliers = []; // cache
async function getSupplierDetails(id) {
    if(allSuppliers.length === 0) {
        const response = await authFetch(`${SUPPLIERS_URL}/`);
        allSuppliers = await response.json();
    }
    return allSuppliers.find(s => s.id === id);
}

function openSupplierModal() {
    document.getElementById('supplierForm').reset();
    document.getElementById('supplierId').value = '';
    document.getElementById('supplierModalTitle').innerText = 'إضافة مورد جديد';
    document.getElementById('supplierModal').classList.remove('hidden');
}

async function editSupplier(id) {
    const sup = await getSupplierDetails(id);
    if(sup) {
        document.getElementById('supplierId').value = sup.id;
        document.getElementById('supName').value = sup.name || '';
        document.getElementById('supPhone').value = sup.phone || '';
        document.getElementById('supType').value = sup.supply_type || '';
        document.getElementById('supLocation').value = sup.location || '';
        document.getElementById('supMapsUrl').value = sup.maps_url || '';
        document.getElementById('supplierModalTitle').innerText = 'تعديل بيانات المورد';
        document.getElementById('supplierModal').classList.remove('hidden');
    }
}

function closeSupplierModal() {
    document.getElementById('supplierModal').classList.add('hidden');
}

document.getElementById('supplierForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('supplierId').value;
    const data = {
        name: document.getElementById('supName').value,
        phone: document.getElementById('supPhone').value,
        supply_type: document.getElementById('supType').value,
        location: document.getElementById('supLocation').value,
        maps_url: document.getElementById('supMapsUrl').value
    };

    try {
        const method = id ? 'PUT' : 'POST';
        const url = id ? `${SUPPLIERS_URL}/${id}` : `${SUPPLIERS_URL}/`;
        const res = await authFetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error("فشل حفظ المورد");
        allSuppliers = []; // invalidate cache
        closeSupplierModal();
        loadSuppliers();
        showToast("تم الحفظ بنجاح", "bg-emerald-500", "✓");
    } catch (err) {
        showToast(err.message, "bg-rose-500", "✗");
    }
});

async function deleteSupplier(id) {
    if(!confirm("هل أنت متأكد من حذف هذا المورد؟")) return;
    try {
        const res = await authFetch(`${SUPPLIERS_URL}/${id}`, { method: 'DELETE' });
        if(!res.ok) throw new Error("فشل الحذف");
        allSuppliers = [];
        loadSuppliers();
        showToast("تم الحذف", "bg-emerald-500", "✓");
    } catch(err) {
        showToast(err.message, "bg-rose-500", "✗");
    }
}

// --- Purchase Requests Logic ---
let globalPurchaseRequests = [];

async function loadPurchaseRequests() {
    try {
        const response = await authFetch(`${PURCHASE_REQUESTS_URL}/`);
        const requests = await response.json();
        globalPurchaseRequests = requests;
        const tbody = document.getElementById('purchaseRequestsTableBody');
        tbody.innerHTML = '';
        if (requests.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="p-4 text-center text-slate-500">لا يوجد طلبات شراء حالياً</td></tr>`;
            return;
        }
        
        requests.forEach(r => {
            let statusBadge = '';
            let actionButtons = '';
            
            if (r.status === 'Pending') {
                statusBadge = '<span class="bg-amber-100 text-amber-800 px-2 py-1 rounded-md text-xs font-bold border border-amber-200">قيد الانتظار</span>';
                if (localStorage.getItem('username') === 'admin') {
                    actionButtons += `<button onclick="approvePurchaseRequest(${r.id})" class="text-xs bg-emerald-100 hover:bg-emerald-200 text-emerald-700 px-2 py-1 rounded font-bold mx-1">موافقة</button>`;
                }
            } else if (r.status === 'Active') {
                statusBadge = '<span class="bg-blue-100 text-blue-800 px-2 py-1 rounded-md text-xs font-bold border border-blue-200">مُعتمد</span>';
                actionButtons += `<button onclick="openMarkPurchasedModal(${r.id})" class="text-xs bg-indigo-100 hover:bg-indigo-200 text-indigo-700 px-2 py-1 rounded font-bold mx-1 border border-indigo-200">إتمام الشراء</button>`;
            } else if (r.status === 'Purchased') {
                statusBadge = '<span class="bg-emerald-100 text-emerald-800 px-2 py-1 rounded-md text-xs font-bold border border-emerald-200">تم الشراء</span>';
                if(r.invoice_image_url) actionButtons += `<a href="${API_HOST}${r.invoice_image_url}" target="_blank" class="text-xs text-blue-600 hover:underline mx-1">الفاتورة</a>`;
                if(r.items_image_url) actionButtons += `<a href="${API_HOST}${r.items_image_url}" target="_blank" class="text-xs text-blue-600 hover:underline mx-1">المشتريات</a>`;
            }

            const dateStr = new Date(r.created_at).toLocaleDateString('ar-SA');
            const ownerName = r.requested_by ? r.requested_by.username : 'غير معروف';

            tbody.innerHTML += `
                <tr class="border-b hover:bg-slate-50 transition cursor-pointer" onclick="openPurchaseRequestDetails(${r.id})">
                    <td class="p-4 font-bold text-slate-500">#${r.id}</td>
                    <td class="p-4 font-bold text-slate-800">${r.title}</td>
                    <td class="p-4">${r.quantity || '-'}</td>
                    <td class="p-4 text-emerald-700 font-bold">${r.expected_price || '-'}</td>
                    <td class="p-4 text-slate-600">${ownerName}</td>
                    <td class="p-4 text-sm text-slate-500" dir="ltr">${dateStr}</td>
                    <td class="p-4">${statusBadge}</td>
                    <td class="p-4 text-center" onclick="event.stopPropagation()">
                        ${actionButtons}
                        <button onclick="deletePurchaseRequest(${r.id})" class="text-rose-600 hover:text-rose-800 p-1 align-middle"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                    </td>
                </tr>
            `;
        });
    } catch (err) {
        showToast("فشل تحميل طلبات الشراء", "bg-rose-500", "✗");
    }
}

let currentEditingPurchaseRequestId = null;

function openPurchaseRequestModal(id = null) {
    document.getElementById('purchaseRequestForm').reset();
    currentEditingPurchaseRequestId = id;
    
    if (id) {
        document.getElementById('prCustomIdContainer').classList.add('hidden');
        document.getElementById('purchaseRequestModalTitle').innerText = 'تعديل طلب الشراء';
        const req = globalPurchaseRequests.find(r => r.id === id);
        if (req) {
            document.getElementById('prTitle').value = req.title || '';
            document.getElementById('prQuantity').value = req.quantity || '';
            document.getElementById('prExpectedPrice').value = req.expected_price || '';
            document.getElementById('prDescription').value = req.description || '';
        }
    } else {
        document.getElementById('prCustomIdContainer').classList.remove('hidden');
        document.getElementById('purchaseRequestModalTitle').innerText = 'إنشاء طلب شراء جديد';
    }
    
    document.getElementById('purchaseRequestModal').classList.remove('hidden');
}

function closePurchaseRequestModal() {
    document.getElementById('purchaseRequestModal').classList.add('hidden');
}

document.getElementById('purchaseRequestForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("title", document.getElementById('prTitle').value);
    
    const qty = document.getElementById('prQuantity').value;
    if(qty) formData.append("quantity", qty);
    
    const price = document.getElementById('prExpectedPrice').value;
    if(price) formData.append("expected_price", price);
    
    const desc = document.getElementById('prDescription').value;
    if(desc) formData.append("description", desc);

    if(!currentEditingPurchaseRequestId) {
        const customId = document.getElementById('prCustomId').value;
        if(customId) formData.append("req_id", customId);
    }

    const imageFile = document.getElementById('prAttachedImage').files[0];
    if(imageFile) formData.append("attached_image", imageFile);

    try {
        let res;
        if (currentEditingPurchaseRequestId) {
            res = await authFetch(`${PURCHASE_REQUESTS_URL}/${currentEditingPurchaseRequestId}/details`, {
                method: 'PUT',
                body: formData
            });
        } else {
            res = await authFetch(`${PURCHASE_REQUESTS_URL}/`, {
                method: 'POST',
                body: formData
            });
        }
        
        if (!res.ok) throw new Error("فشل الحفظ");
        closePurchaseRequestModal();
        await loadPurchaseRequests();
        
        if (currentEditingPurchaseRequestId && !document.getElementById('purchaseRequestDetailView').classList.contains('hidden')) {
            openPurchaseRequestDetails(currentEditingPurchaseRequestId);
        }
        
        showToast("تم الحفظ بنجاح", "bg-emerald-500", "✓");
    } catch (err) {
        showToast(err.message, "bg-rose-500", "✗");
    }
});

async function approvePurchaseRequest(id) {
    if(!confirm("هل أنت متأكد من الموافقة على طلب الشراء؟")) return;
    try {
        const res = await authFetch(`${PURCHASE_REQUESTS_URL}/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'Active' })
        });
        if (!res.ok) throw new Error("فشل الموافقة (يجب أن تكون مدير النظام)");
        loadPurchaseRequests();
        showToast("تم اعتماد الطلب بنجاح", "bg-emerald-500", "✓");
    } catch (err) {
        showToast(err.message, "bg-rose-500", "✗");
    }
}

function openMarkPurchasedModal(id) {
    document.getElementById('markPurchasedForm').reset();
    document.getElementById('markPrId').value = id;
    document.getElementById('markPurchasedModal').classList.remove('hidden');
}

function closeMarkPurchasedModal() {
    document.getElementById('markPurchasedModal').classList.add('hidden');
}

document.getElementById('markPurchasedForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('markPrId').value;
    const invoiceFile = document.getElementById('prInvoiceFile').files[0];
    const itemsFile = document.getElementById('prItemsFile').files[0];

    const formData = new FormData();
    if(invoiceFile) formData.append("invoice_image", invoiceFile);
    if(itemsFile) formData.append("items_image", itemsFile);

    try {
        const res = await authFetch(`${PURCHASE_REQUESTS_URL}/${id}/upload-images`, {
            method: 'POST',
            body: formData
        });
        if (!res.ok) throw new Error("فشل إتمام الشراء");
        closeMarkPurchasedModal();
        loadPurchaseRequests();
        showToast("تم تسجيل الشراء بنجاح", "bg-emerald-500", "✓");
    } catch (err) {
        showToast(err.message, "bg-rose-500", "✗");
    }
});

async function deletePurchaseRequest(id) {
    if(!confirm("هل أنت متأكد من حذف هذا الطلب؟")) return;
    try {
        const res = await authFetch(`${PURCHASE_REQUESTS_URL}/${id}`, { method: 'DELETE' });
        if(!res.ok) throw new Error("فشل الحذف أو ليس لديك صلاحية");
        loadPurchaseRequests();
        showToast("تم الحذف", "bg-emerald-500", "✓");
    } catch(err) {
        showToast(err.message, "bg-rose-500", "✗");
    }
}

// --- Purchase Request Details Logic ---
async function openPurchaseRequestDetails(id) {
    document.getElementById('purchasingView').classList.add('hidden');
    document.getElementById('purchaseRequestDetailView').classList.remove('hidden');
    document.getElementById('prdTitle').innerText = 'جاري التحميل...';
    
    try {
        const res = await authFetch(`${PURCHASE_REQUESTS_URL}/${id}`);
        if (!res.ok) throw new Error("فشل جلب تفاصيل الطلب");
        const data = await res.json();
        renderPurchaseRequestDetails(data);
    } catch (err) {
        showToast(err.message, "bg-rose-500", "✗");
    }
}

function closePurchaseRequestDetails() {
    document.getElementById('purchaseRequestDetailView').classList.add('hidden');
    document.getElementById('purchasingView').classList.remove('hidden');
    loadPurchaseRequests();
}

function renderPurchaseRequestDetails(r) {
    document.getElementById('prdId').innerText = r.id;
    document.getElementById('prdTitle').innerText = r.title;
    document.getElementById('prdOwner').innerText = r.requested_by ? r.requested_by.username : 'غير معروف';
    document.getElementById('prdQuantity').innerText = r.quantity || '-';
    document.getElementById('prdExpectedPrice').innerText = r.expected_price || '-';
    document.getElementById('prdDescription').innerText = r.description || 'لا يوجد تفاصيل';

    const statusBadge = document.getElementById('prdStatusBadge');
    statusBadge.className = 'text-sm px-3 py-1 rounded-full font-bold border ';
    if (r.status === 'Pending') {
        statusBadge.classList.add('bg-amber-100', 'text-amber-800', 'border-amber-200');
        statusBadge.innerText = 'قيد الانتظار';
    } else if (r.status === 'Active') {
        statusBadge.classList.add('bg-blue-100', 'text-blue-800', 'border-blue-200');
        statusBadge.innerText = 'مُعتمد (جاهز للشراء)';
    } else {
        statusBadge.classList.add('bg-emerald-100', 'text-emerald-800', 'border-emerald-200');
        statusBadge.innerText = 'تم الشراء';
    }

    const actionsContainer = document.getElementById('prdActionsContainer');
    actionsContainer.innerHTML = '';
    
    if (r.status === 'Pending' && localStorage.getItem('username') === 'admin') {
        actionsContainer.innerHTML += `<button onclick="approvePurchaseRequestDetails(${r.id})" class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-bold shadow flex items-center gap-2 transition"><svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>موافقة على الطلب</button>`;
    } else if (r.status === 'Active') {
        actionsContainer.innerHTML += `<button onclick="openMarkPurchasedModal(${r.id})" class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold shadow flex items-center gap-2 transition">إتمام عملية الشراء</button>`;
    }
    actionsContainer.innerHTML += `<button onclick="openPurchaseRequestModal(${r.id})" class="bg-blue-50 hover:bg-blue-100 text-blue-700 px-4 py-2 rounded-lg font-bold shadow transition text-sm">تعديل</button>`;
    actionsContainer.innerHTML += `<button onclick="deletePurchaseRequestDetails(${r.id})" class="bg-rose-100 hover:bg-rose-200 text-rose-700 px-4 py-2 rounded-lg font-bold shadow transition text-sm">حذف</button>`;

    const imagesContainer = document.getElementById('prdImagesContainer');
    imagesContainer.innerHTML = '';
    if(!r.attached_image_url && !r.invoice_image_url && !r.items_image_url) {
        imagesContainer.innerHTML = `<p class="col-span-full text-center py-4 text-slate-500 font-bold">لا يوجد صور مرفقة</p>`;
    } else {
        if(r.attached_image_url) {
            imagesContainer.innerHTML += `
                <a href="${API_HOST}${r.attached_image_url}" target="_blank" class="block border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition">
                    <img src="${API_HOST}${r.attached_image_url}" class="w-full h-32 object-cover" />
                    <div class="bg-slate-50 p-2 text-center text-sm font-bold text-slate-700">الصورة المرفقة</div>
                </a>`;
        }
        if(r.invoice_image_url) {
            imagesContainer.innerHTML += `
                <a href="${API_HOST}${r.invoice_image_url}" target="_blank" class="block border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition">
                    <img src="${API_HOST}${r.invoice_image_url}" class="w-full h-32 object-cover" />
                    <div class="bg-slate-50 p-2 text-center text-sm font-bold text-slate-700">صورة الفاتورة</div>
                </a>`;
        }
        if(r.items_image_url) {
            imagesContainer.innerHTML += `
                <a href="${API_HOST}${r.items_image_url}" target="_blank" class="block border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition">
                    <img src="${API_HOST}${r.items_image_url}" class="w-full h-32 object-cover" />
                    <div class="bg-slate-50 p-2 text-center text-sm font-bold text-slate-700">صورة المشتريات</div>
                </a>`;
        }
    }

    const timelineContainer = document.getElementById('prdTimeline');
    const dDate = new Date(r.created_at).toLocaleDateString('ar-SA') + ' ' + new Date(r.created_at).toLocaleTimeString('ar-SA', {hour: '2-digit', minute:'2-digit'});
    
    let timelineHTML = `
        <div class="relative">
            <span class="absolute -right-6 top-1.5 w-3 h-3 rounded-full bg-slate-300 ring-4 ring-white"></span>
            <p class="font-bold text-slate-800">إنشاء الطلب</p>
            <p class="text-xs text-slate-500 mt-1">${dDate} بواسطة ${document.getElementById('prdOwner').innerText}</p>
        </div>`;
        
    if(r.status === 'Active' || r.status === 'Purchased') {
        timelineHTML += `
        <div class="relative">
            <span class="absolute -right-6 top-1.5 w-3 h-3 rounded-full bg-blue-500 ring-4 ring-white shadow-sm"></span>
            <p class="font-bold text-slate-800">اعتماد الطلب</p>
            <p class="text-xs text-slate-500 mt-1">تم الموافقة من قبل الإدارة</p>
        </div>`;
    }
    
    if(r.status === 'Purchased') {
        timelineHTML += `
        <div class="relative">
            <span class="absolute -right-6 top-1.5 w-3 h-3 rounded-full bg-emerald-500 ring-4 ring-white shadow-sm shadow-emerald-200"></span>
            <p class="font-bold text-slate-800">إتمام الشراء</p>
            <p class="text-xs text-slate-500 mt-1">تم رفع الفواتير وإغلاق الطلب</p>
        </div>`;
    }
    
    timelineContainer.innerHTML = timelineHTML;
}

async function approvePurchaseRequestDetails(id) {
    if(!confirm("هل أنت متأكد من الموافقة على طلب الشراء؟")) return;
    try {
        const res = await authFetch(`${PURCHASE_REQUESTS_URL}/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'Active' })
        });
        if (!res.ok) throw new Error("فشل الموافقة (يجب أن تكون مدير النظام)");
        showToast("تم اعتماد الطلب بنجاح", "bg-emerald-500", "✓");
        // reload details
        openPurchaseRequestDetails(id);
    } catch (err) {
        showToast(err.message, "bg-rose-500", "✗");
    }
}

async function deletePurchaseRequestDetails(id) {
    if(!confirm("هل أنت متأكد من حذف هذا الطلب؟")) return;
    try {
        const res = await authFetch(`${PURCHASE_REQUESTS_URL}/${id}`, { method: 'DELETE' });
        if(!res.ok) throw new Error("فشل الحذف أو ليس لديك صلاحية");
        showToast("تم الحذف", "bg-emerald-500", "✓");
        closePurchaseRequestDetails();
    } catch(err) {
        showToast(err.message, "bg-rose-500", "✗");
    }
}


function updateExpectedDateColor() {
    const input = document.getElementById('ptExpectedDate');
    if (!input.value || !currentTrackingProjectData || !currentTrackingProjectData.delivery_date) {
        input.className = 'w-full border border-indigo-200 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-indigo-900';
        return;
    }
    
    // Compare dates ignoring time
    const expected = new Date(input.value);
    expected.setHours(0,0,0,0);
    const delivery = new Date(currentTrackingProjectData.delivery_date);
    delivery.setHours(0,0,0,0);
    
    if (expected <= delivery) {
        // Green
        input.className = 'w-full border border-emerald-300 bg-emerald-50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-emerald-700';
    } else {
        // Red
        input.className = 'w-full border border-rose-300 bg-rose-50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 font-bold text-rose-700';
    }
}

async function calculateSheetRequirements() {
    if (!window.currentProjectData) return;
    
    document.getElementById('sheetLoading').classList.remove('hidden');
    document.getElementById('sheetResults').classList.add('hidden');
    document.getElementById('sheetEmpty').classList.add('hidden');
    
    try {
        const response = await authFetch(`${PROJECTS_URL}/${window.currentProjectData.id}/sheet-requirements`);
        if (!response.ok) throw new Error('فشل حساب كميات الصاج');
        
        const data = await response.json();
        const t1_5 = data.thickness_1_5 || [];
        const t1_2 = data.thickness_1_2 || [];
        
        const tbody1_5 = document.getElementById('sheetBody1_5');
        const tbody1_2 = document.getElementById('sheetBody1_2');
        
        tbody1_5.innerHTML = '';
        tbody1_2.innerHTML = '';
        
        if (t1_5.length === 0 && t1_2.length === 0) {
            document.getElementById('sheetEmpty').classList.remove('hidden');
        } else {
            t1_5.forEach(item => {
                tbody1_5.innerHTML += `<tr><td class="py-2 px-3">${item.size}</td><td class="py-2 px-3 font-bold text-indigo-700">${item.count} ألواح</td></tr>`;
            });
            if (t1_5.length === 0) tbody1_5.innerHTML = '<tr><td colspan="2" class="py-2 text-slate-400">لا يوجد بيانات</td></tr>';
            
            t1_2.forEach(item => {
                tbody1_2.innerHTML += `<tr><td class="py-2 px-3">${item.size}</td><td class="py-2 px-3 font-bold text-indigo-700">${item.count} ألواح</td></tr>`;
            });
            if (t1_2.length === 0) tbody1_2.innerHTML = '<tr><td colspan="2" class="py-2 text-slate-400">لا يوجد بيانات</td></tr>';
            
            document.getElementById('sheetResults').classList.remove('hidden');
        }
    } catch (e) {
        showToast(e.message, 'bg-rose-500', '✗');
        document.getElementById('sheetEmpty').classList.remove('hidden');
        document.getElementById('sheetEmpty').textContent = 'حدث خطأ أثناء الحساب.';
    } finally {
        document.getElementById('sheetLoading').classList.add('hidden');
    }
}



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

window.submitMoveItemForm = async (e) => {
    e.preventDefault();
    showToast('جار معالجة النقل...', 'bg-blue-500', 'ℹ');
    if (!currentMovingItemId) {
        showToast('خطأ: لم يتم تحديد البند', 'bg-rose-500', '✖');
        return;
    }
    
    const newCategory = document.getElementById('moveItemCategory').value;
    const newSubcategory = document.getElementById('moveItemSubcategory').value;
    
    if(!newCategory) {
        showToast('الرجاء اختيار القسم الجديد', 'bg-rose-500', '✖');
        return;
    }
    
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
