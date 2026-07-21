const API_HOST = window.location.protocol === 'file:' ? 'http://localhost:8000' : window.location.origin;
const API_URL = `${API_HOST}/api/items`;
const AUTH_URL = `${API_HOST}/api/auth`;
const USERS_URL = `${API_HOST}/api/users`;
const USERS_BASIC_URL = `${API_HOST}/api/users/basic`;

// State
let currentDepartment = '';
let currentSubcategory = '';
let allItems = [];
let isReorderMode = false;
let dbLockOptions = [];
let dbHingeOptions = [];
let dbProfileOptions = [];
let dbDoorTypeOptions = [];
let dbSpecOptions = [];
let dbSheetSizes = [];
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

window.currentUser = null;

async function fetchCurrentUser() {
    try {
        const response = await authFetch(`${API_HOST}/api/users/me`);
        if (response.ok) {
            window.currentUser = await response.json();
        } else {
            window.currentUser = null;
        }
    } catch (e) {
        console.error('Failed to fetch current user', e);
        window.currentUser = null;
    }
}

async function checkAuthStatus() {
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');
    
    if (token && username) {
        await showAppView(username);
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

async function loadProjectOptions() {
    try {
        const response = await authFetch(`${API_HOST}/api/project-options/`);
        if (response.ok) {
            const allOpts = await response.json();
            dbLockOptions = allOpts.filter(o => o.option_type === 'lock');
            dbHingeOptions = allOpts.filter(o => o.option_type === 'hinge');
            dbProfileOptions = allOpts.filter(o => o.option_type === 'profile');
            dbDoorTypeOptions = allOpts.filter(o => o.option_type === 'door_type');
            dbSpecOptions = allOpts.filter(o => o.option_type === 'specification');
        }
    } catch (e) {
        console.error('Failed to load project options', e);
    }
}

async function loadSheetSizes() {
    try {
        const response = await authFetch(`${API_HOST}/api/sheet-sizes/`);
        if (response.ok) {
            dbSheetSizes = await response.json();
        }
    } catch (e) {
        console.error('Failed to load sheet sizes', e);
    }
}

async function showAppView(username) {
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
    
    await fetchCurrentUser();
    
    // Fetch permissions if not admin
    if (username !== 'admin') {
        try {
            const permUrl = `${API_HOST}/api/users/me/permissions`;
            console.log('[DEBUG] showAppView: Fetching permissions from:', permUrl);
            const permsResponse = await authFetch(permUrl);
            if (permsResponse.ok) {
                userPermissionsList = await permsResponse.json();
                console.log('[DEBUG] showAppView: userPermissionsList loaded:', JSON.stringify(userPermissionsList));
            }
        } catch (e) {
            console.error('[DEBUG] showAppView: Failed to fetch permissions', e);
        }
    }

    loadProjectOptions();
    loadSheetSizes();
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
            
            if (!response.ok) {
                if (response.status === 403) {
                    try {
                        const errData = await response.json();
                        throw new Error(errData.detail || 'الحساب معلق وبانتظار موافقة الإدارة');
                    } catch (e) {
                        throw new Error(e.message || 'الحساب معلق وبانتظار موافقة الإدارة');
                    }
                }
                throw new Error('اسم المستخدم أو كلمة المرور غير صحيحة');
            }
            
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
            
            showToast('تم إنشاء الحساب بنجاح! بانتظار موافقة مدير النظام لتتمكن من تسجيل الدخول', 'bg-emerald-500', '✓');
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
    const username = localStorage.getItem('username');
    if (username !== 'admin' && !userPermissionsList.some(p => p.department_name === 'system_inventory' && (p.can_edit == 1 || p.can_edit === true))) {
        showToast('غير مصرح لك بالوصول لنظام إدارة المخازن', 'bg-rose-500', '✗');
        return;
    }

    const hrView = document.getElementById('hrView');
    if(hrView) hrView.classList.add('hidden');

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
            applyPermissionsToUI();
        } else {
            document.getElementById('adminDepartmentControls').classList.add('hidden');
            const permUrl = `${API_URL.replace('/items', '/users')}/me/permissions`;
            console.log('[DEBUG] Fetching permissions from:', permUrl);
            const permsResponse = await authFetch(permUrl);
            console.log('[DEBUG] Permissions response status:', permsResponse.status);
            if (permsResponse.ok) {
                userPermissionsList = await permsResponse.json();
                console.log('[DEBUG] userPermissionsList loaded:', JSON.stringify(userPermissionsList));
                applyPermissionsToUI();
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
    const hrView = document.getElementById('hrView');
    if(hrView) hrView.classList.add('hidden');

    const _pView = document.getElementById('purchasingView');
    if(_pView) _pView.classList.add('hidden');
    const _prdView = document.getElementById('purchaseRequestDetailView');
    if(_prdView) _prdView.classList.add('hidden');

    const pView = document.getElementById('projectsView');
    if(pView) pView.classList.add('hidden');
    const pwView = document.getElementById('projectWizardView');
    if(pwView) pwView.classList.add('hidden');
    const pdView = document.getElementById('projectDetailView');
    if(pdView) pdView.classList.add('hidden');

    userMenuDropdown.classList.add('hidden'); // Close dropdown
    
    const msView = document.getElementById('moduleSelectorView');
    if(msView) msView.classList.add('hidden');
    departmentsView.classList.add('hidden');
    accessoriesSubDeptView.classList.add('hidden');
    departmentDetailView.classList.add('hidden');
    adminView.classList.remove('hidden');
    
    await loadUsers();
    await loadProjectOptions();
    renderProjectOptionsAdmin();
    await loadSheetSizes();
    renderSheetSizesAdmin();
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
            
            const isApproved = user.is_approved === 1;
            const statusLabel = isApproved 
                ? '<span class="inline-block px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold border border-emerald-200">مقبول</span>'
                : '<span class="inline-block px-2.5 py-1 bg-rose-50 text-rose-700 rounded-full text-xs font-bold border border-rose-200">بانتظار الموافقة</span>';

            row.innerHTML = `
                <td class="p-4 text-slate-500 font-semibold">#${user.id}</td>
                <td class="p-4 font-bold text-slate-800">${user.username}</td>
                <td class="p-4 text-center">${statusLabel}</td>
                <td class="p-4">
                    <div class="flex justify-center gap-2">
                        <button onclick="openEditUserModal(${user.id}, '${user.username}')" class="px-3.5 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl transition text-xs font-bold border border-indigo-200">
                            ⚙️ الحساب
                        </button>
                        ${user.username !== 'admin' ? `
                        <button onclick="openPermissionsModal(${user.id}, '${user.username}')" class="px-3.5 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-xl transition text-xs font-bold border border-amber-200">
                            🛡️ الصلاحيات
                        </button>
                        <button onclick="toggleUserApproval(${user.id})" class="px-3.5 py-1.5 ${isApproved ? 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200'} rounded-xl transition text-xs font-bold border">
                            ${isApproved ? '🚫 تعطيل' : '✓ تفعيل'}
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

async function toggleUserApproval(userId) {
    try {
        const response = await authFetch(`${USERS_URL}/${userId}/toggle-approval`, {
            method: 'PUT'
        });
        if (!response.ok) {
            throw await handleBadResponse(response, 'فشلت عملية تعديل حالة الحساب');
        }
        showToast('تم تحديث حالة الحساب بنجاح', 'bg-emerald-500', '✓');
        await loadUsers();
    } catch (error) {
        console.error('Toggle approval error:', error);
        showToast(error.message || 'حدث خطأ أثناء تعديل حالة الحساب', 'bg-rose-500', '✗');
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

function applyPermissionsToUI() {
    const username = localStorage.getItem('username');
    const isCreatePRAuthorized = username === 'admin' || userPermissionsList.some(p => p.department_name === 'purchasing_create' && (p.can_edit == 1 || p.can_edit === true));
    const isSupplierEditAuthorized = username === 'admin' || userPermissionsList.some(p => p.department_name === 'purchasing_suppliers' && (p.can_edit == 1 || p.can_edit === true));
    const hasProjectMgmt = username === 'admin' || userPermissionsList.some(p => p.department_name === 'project_management' && (p.can_edit == 1 || p.can_edit === true));

    const hasInventoryAccess = username === 'admin' || userPermissionsList.some(p => p.department_name === 'system_inventory' && (p.can_edit == 1 || p.can_edit === true));
    const hasProjectsAccess = username === 'admin' || userPermissionsList.some(p => p.department_name === 'system_projects' && (p.can_edit == 1 || p.can_edit === true));
    const hasPurchasingAccess = username === 'admin' || userPermissionsList.some(p => p.department_name === 'system_purchasing' && (p.can_edit == 1 || p.can_edit === true));
    const hasHrAccess = username === 'admin' || userPermissionsList.some(p => p.department_name === 'system_hr' && (p.can_edit == 1 || p.can_edit === true));

    const modInv = document.getElementById('moduleInventory');
    if (modInv) {
        if (hasInventoryAccess) {
            modInv.classList.remove('opacity-40');
        } else {
            modInv.classList.add('opacity-40');
        }
    }
    const modProj = document.getElementById('moduleProjects');
    if (modProj) {
        if (hasProjectsAccess) {
            modProj.classList.remove('opacity-40');
        } else {
            modProj.classList.add('opacity-40');
        }
    }
    const modPurch = document.getElementById('modulePurchasing');
    if (modPurch) {
        if (hasPurchasingAccess) {
            modPurch.classList.remove('opacity-40');
        } else {
            modPurch.classList.add('opacity-40');
        }
    }
    const modHR = document.getElementById('moduleHR');
    if (modHR) {
        if (hasHrAccess) {
            modHR.classList.remove('opacity-40');
        } else {
            modHR.classList.add('opacity-40');
        }
    }

    const btnCreatePR = document.getElementById('btnCreatePurchaseRequest');
    if (btnCreatePR) {
        if (isCreatePRAuthorized) {
            btnCreatePR.classList.remove('hidden');
        } else {
            btnCreatePR.classList.add('hidden');
        }
    }

    const btnCreateSupplier = document.getElementById('btnCreateSupplier');
    if (btnCreateSupplier) {
        if (isSupplierEditAuthorized) {
            btnCreateSupplier.classList.remove('hidden');
        } else {
            btnCreateSupplier.classList.add('hidden');
        }
    }

    const btnFireDoors = document.getElementById('btnFireDoors');
    if (btnFireDoors) {
        if (hasProjectMgmt) {
            btnFireDoors.classList.remove('hidden');
        } else {
            btnFireDoors.classList.add('hidden');
        }
    }
}

async function loadItems() {
    isReorderMode = false;
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
                    applyPermissionsToUI();
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
    
    // Manage Toggle Reorder button and banner visibility
    const reorderBtn = document.getElementById('btnToggleReorder');
    const reorderBtnText = document.getElementById('reorderBtnText');
    const reorderAlertBanner = document.getElementById('reorderAlertBanner');
    const mainAddBtn = document.getElementById('mainAddItemBtn');

    if (reorderBtn) {
        if (hasEditPermission) {
            reorderBtn.classList.remove('hidden');
        } else {
            reorderBtn.classList.add('hidden');
        }
    }

    if (isReorderMode) {
        if (reorderBtnText) reorderBtnText.textContent = 'حفظ الترتيب';
        if (reorderBtn) {
            reorderBtn.classList.replace('bg-slate-100', 'bg-emerald-600');
            reorderBtn.classList.replace('text-slate-700', 'text-white');
            reorderBtn.classList.replace('hover:bg-slate-200', 'hover:bg-emerald-700');
            reorderBtn.classList.replace('border-slate-300', 'border-emerald-700');
        }
        if (reorderAlertBanner) reorderAlertBanner.classList.remove('hidden');
        if (mainAddBtn) mainAddBtn.classList.add('hidden');
    } else {
        if (reorderBtnText) reorderBtnText.textContent = 'تعديل الترتيب';
        if (reorderBtn) {
            reorderBtn.classList.replace('bg-emerald-600', 'bg-slate-100');
            reorderBtn.classList.replace('text-white', 'text-slate-700');
            reorderBtn.classList.replace('hover:bg-emerald-700', 'hover:bg-slate-200');
            reorderBtn.classList.replace('border-emerald-700', 'border-slate-300');
        }
        if (reorderAlertBanner) reorderAlertBanner.classList.add('hidden');
        if (mainAddBtn) {
            if (hasEditPermission) {
                mainAddBtn.classList.remove('hidden');
            } else {
                mainAddBtn.classList.add('hidden');
            }
        }
    }
    
    if (allItems.length === 0) {
        deptEmptyState.classList.remove('hidden');
        return;
    }
    
    deptEmptyState.classList.add('hidden');
    
    let itemsToRender = allItems;
    // Disable search filtering in reorder mode to prevent missing items in sequence
    const searchInput = document.getElementById('itemSearchInput');
    if (!isReorderMode && searchInput && searchInput.value.trim() !== '') {
        const query = searchInput.value.trim().toLowerCase();
        itemsToRender = allItems.filter(item => {
            const skuMatch = item.sku && item.sku.toLowerCase().includes(query);
            const nameMatch = item.name && item.name.toLowerCase().includes(query);
            return skuMatch || nameMatch;
        });
    }
    
    if (itemsToRender.length === 0 && allItems.length > 0) {
        itemsGrid.innerHTML = '<div class="col-span-full text-center py-10 text-slate-500">لا توجد نتائج مطابقة للبحث</div>';
        return;
    }
    
    itemsToRender.forEach(item => {
        const card = document.createElement('div');
        card.dataset.itemId = item.id;
        
        if (isReorderMode) {
            card.setAttribute('draggable', 'true');
            card.className = 'bg-white rounded-2xl shadow-md border-2 border-amber-400/60 overflow-hidden flex flex-col justify-between hover:shadow-lg transition duration-200 cursor-move bg-amber-50/10 relative';
            card.addEventListener('dragstart', handleDragStart);
            card.addEventListener('dragover', handleDragOver);
            card.addEventListener('dragenter', handleDragEnter);
            card.addEventListener('drop', handleDrop);
            card.addEventListener('dragend', handleDragEnd);
        } else {
            card.className = 'bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden flex flex-col justify-between hover:shadow-lg transition duration-200';
        }
        
        const imageHTML = item.image_url 
            ? `<img src="${API_HOST}${item.image_url}" alt="${item.name}" class="w-full h-full object-contain p-1">`
            : ''; 
            
        const skuHTML = item.sku 
            ? `<div class="absolute top-3 left-3 bg-white/95 backdrop-blur-sm px-2.5 py-1 rounded-lg text-xs font-black text-slate-800 shadow-sm border border-slate-200 tracking-wider z-10 font-mono" dir="ltr">#${item.sku}</div>`
            : '';
        
        let dragHandleHTML = '';
        if (isReorderMode) {
            dragHandleHTML = `
                <div class="absolute top-3 right-3 bg-amber-500 text-white px-2.5 py-1 rounded-lg text-xs font-bold shadow-sm z-20 flex items-center gap-1 cursor-move animate-pulse">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                    اسحب للترتيب
                </div>
            `;
        }

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
                <div class="h-44 w-full bg-slate-100 relative overflow-hidden border-b border-slate-100 flex items-center justify-center">
                    ${skuHTML}
                    ${dragHandleHTML}
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
            <div class="p-5 pt-0 flex flex-col gap-2 ${isReorderMode ? 'hidden' : ''}">
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

// ----------------- DRAG & DROP AND REORDER LOGIC -----------------

let draggedCard = null;

function handleDragStart(e) {
    draggedCard = this;
    this.classList.add('opacity-40', 'scale-95');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.dataset.itemId);
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleDragEnter(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    if (draggedCard && draggedCard !== this) {
        const grid = document.getElementById('itemsGrid');
        const children = Array.from(grid.children);
        const draggedIndex = children.indexOf(draggedCard);
        const targetIndex = children.indexOf(this);
        
        if (draggedIndex < targetIndex) {
            grid.insertBefore(draggedCard, this.nextSibling);
        } else {
            grid.insertBefore(draggedCard, this);
        }
    }
    return false;
}

function handleDragEnd(e) {
    this.classList.remove('opacity-40', 'scale-95');
    draggedCard = null;
}

function toggleReorderMode() {
    isReorderMode = !isReorderMode;
    if (!isReorderMode) {
        saveNewOrder();
        return;
    }
    renderItemsGrid();
}

function cancelReorderMode() {
    isReorderMode = false;
    renderItemsGrid();
}

async function saveNewOrder() {
    const cards = Array.from(itemsGrid.children);
    const itemIds = cards.map(c => parseInt(c.dataset.itemId)).filter(id => !isNaN(id));
    
    if (itemIds.length === 0) {
        cancelReorderMode();
        return;
    }
    
    try {
        const response = await authFetch(`${API_HOST}/api/items/reorder`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(itemIds)
        });
        
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || 'Failed to save order');
        }
        
        showToast('تم حفظ الترتيب الجديد بنجاح', 'bg-emerald-500', '✓');
        await loadItems();
    } catch (error) {
        console.error('Error saving item order:', error);
        showToast(error.message || 'خطأ أثناء حفظ الترتيب', 'bg-rose-500', '✗');
        cancelReorderMode();
    }
}

// ----------------- ADD ITEM MODAL LOGIC -----------------

function openAddItemModal() {
    addItemModalDeptTitle.textContent = currentDepartment;
    
    const subSelect = document.getElementById('itemSubcategory');
    const subContainer = document.getElementById('subcategoryFieldContainer');
    
    // Find current department details
    const dept = globalDepartments.find(d => normalizeArabic(d.name) === normalizeArabic(currentDepartment));
    
    if (dept && dept.subdepartments && dept.subdepartments.length > 0) {
        // Show subcategory dropdown
        subContainer.classList.remove('hidden');
        
        // Update label text dynamically
        const subLabel = subContainer.querySelector('label');
        if (subLabel) {
            subLabel.textContent = `القسم الفرعي لـ ${currentDepartment}`;
        }
        
        // Populate options
        subSelect.innerHTML = '<option value="">-- عام / غير مصنف --</option>';
        dept.subdepartments.forEach(sub => {
            const opt = document.createElement('option');
            opt.value = sub.name;
            opt.textContent = sub.name;
            subSelect.appendChild(opt);
        });
        
        // If we are currently inside a specific subdepartment, pre-select it
        if (currentSubcategory) {
            subSelect.value = currentSubcategory;
        }
    } else {
        // Hide subcategory dropdown if no subdepartments exist
        subContainer.classList.add('hidden');
        subSelect.innerHTML = '';
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
    
    const dept = globalDepartments.find(d => normalizeArabic(d.name) === normalizeArabic(currentDepartment));
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
                <div class="flex gap-2">
                    <button onclick="consumeReservation(${res.id})" class="text-emerald-600 hover:text-emerald-800 font-bold hover:underline transition">
                        📥 سحب
                    </button>
                    <span class="text-slate-300">|</span>
                    <button onclick="cancelReservation(${res.id})" class="text-rose-600 hover:text-rose-800 font-bold hover:underline transition">
                        ❌ إلغاء الحجز
                    </button>
                </div>
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
    const projectName = document.getElementById('resProject').value.trim();
    const projectNumber = document.getElementById('resProjectNumber').value.trim();
    
    const project = `${projectName} - ${projectNumber}`;
    
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

async function consumeReservation(reservationId) {
    if (!confirm('هل أنت متأكد من رغبتك في سحب الكمية المحجوزة من المخزن؟ سيتم خصم الكمية نهائياً وحذف الحجز.')) return;
    
    try {
        const response = await authFetch(`${API_HOST}/api/reservations/${reservationId}/consume`, {
            method: 'POST'
        });
        
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.detail || 'Failed to consume reservation');
        }
        
        showToast('تم سحب الكمية بنجاح وتحديث رصيد المخزن', 'bg-emerald-500', '✓');
        closeLogModal();
        await loadItems();
        
    } catch (error) {
        console.error('Error consuming reservation:', error);
        showToast(error.message || 'خطأ أثناء سحب الكمية', 'bg-rose-500', '✗');
    }
}

// ----------------- AUTOMATIC SYNC POLLING -----------------

setInterval(() => {
    const token = localStorage.getItem('token');
    // Poll only if logged in, in app view, not in admin panel, no active dialog modals are open, and not in reorder mode
    if (token && 
        !appContainer.classList.contains('hidden') && 
        adminView.classList.contains('hidden') &&
        addItemModal.classList.contains('hidden') &&
        txModal.classList.contains('hidden') &&
        logModal.classList.contains('hidden') &&
        reservationModal.classList.contains('hidden') &&
        editUserModal.classList.contains('hidden') &&
        !isReorderMode &&
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
        
        // Section 0: System Access Permissions (صلاحيات دخول الأنظمة الرئيسية)
        const sysInvPerm = user.permissions.find(p => p.department_name === 'system_inventory');
        const sysInvCanEdit = sysInvPerm && (sysInvPerm.can_edit == 1 || sysInvPerm.can_edit === true);

        const sysProjPerm = user.permissions.find(p => p.department_name === 'system_projects');
        const sysProjCanEdit = sysProjPerm && (sysProjPerm.can_edit == 1 || sysProjPerm.can_edit === true);

        const sysPurchPerm = user.permissions.find(p => p.department_name === 'system_purchasing');
        const sysPurchCanEdit = sysPurchPerm && (sysPurchPerm.can_edit == 1 || sysPurchPerm.can_edit === true);

        const sysHrPerm = user.permissions.find(p => p.department_name === 'system_hr');
        const sysHrCanEdit = sysHrPerm && (sysHrPerm.can_edit == 1 || sysHrPerm.can_edit === true);

        const hrMgmtPerm = user.permissions.find(p => p.department_name === 'hr_management');
        const hrMgmtCanEdit = hrMgmtPerm && (hrMgmtPerm.can_edit == 1 || hrMgmtPerm.can_edit === true);

        let systemsHtml = `
            <div class="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                <h4 class="font-bold text-sm text-indigo-700 border-b pb-2 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    صلاحيات دخول الأنظمة الرئيسية
                </h4>
                <div class="space-y-3">
                    <div class="flex items-center justify-between p-2.5 border border-slate-100 rounded-xl bg-white">
                        <div>
                            <p class="font-bold text-slate-800 text-sm">نظام إدارة المخازن</p>
                            <p class="text-xs text-slate-500">منح صلاحية الدخول لنظام إدارة المخازن</p>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" ${sysInvCanEdit ? 'checked' : ''} onchange="togglePermission(${userId}, 'system_inventory', this.checked)" class="sr-only peer">
                            <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                    </div>
                    <div class="flex items-center justify-between p-2.5 border border-slate-100 rounded-xl bg-white">
                        <div>
                            <p class="font-bold text-slate-800 text-sm">نظام إدارة المشاريع</p>
                            <p class="text-xs text-slate-500">منح صلاحية الدخول لنظام إدارة المشاريع</p>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" ${sysProjCanEdit ? 'checked' : ''} onchange="togglePermission(${userId}, 'system_projects', this.checked)" class="sr-only peer">
                            <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                    </div>
                    <div class="flex items-center justify-between p-2.5 border border-slate-100 rounded-xl bg-white">
                        <div>
                            <p class="font-bold text-slate-800 text-sm">نظام إدارة المشتريات</p>
                            <p class="text-xs text-slate-500">منح صلاحية الدخول لنظام إدارة المشتريات</p>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" ${sysPurchCanEdit ? 'checked' : ''} onchange="togglePermission(${userId}, 'system_purchasing', this.checked)" class="sr-only peer">
                            <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                    </div>
                    <div class="flex items-center justify-between p-2.5 border border-slate-100 rounded-xl bg-white">
                        <div>
                            <p class="font-bold text-slate-800 text-sm">نظام إدارة شؤون الموظفين</p>
                            <p class="text-xs text-slate-500">منح صلاحية الدخول لنظام إدارة شؤون الموظفين</p>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" ${sysHrCanEdit ? 'checked' : ''} onchange="togglePermission(${userId}, 'system_hr', this.checked)" class="sr-only peer">
                            <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                    </div>
                    <div class="flex items-center justify-between p-2.5 border border-slate-100 rounded-xl bg-white">
                        <div>
                            <p class="font-bold text-slate-800 text-sm">إدارة الموظفين</p>
                            <p class="text-xs text-slate-500">منح صلاحية إدارة واعتماد طلبات الموظفين</p>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" ${hrMgmtCanEdit ? 'checked' : ''} onchange="togglePermission(${userId}, 'hr_management', this.checked)" class="sr-only peer">
                            <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                    </div>
                </div>
            </div>
        `;

        // Section 1: Store/Inventory Management (نظام إدارة المخازن)
        let inventoryHtml = `
            <div class="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                <h4 class="font-bold text-sm text-indigo-700 border-b pb-2 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                    نظام إدارة المخازن
                </h4>
                <div class="space-y-3">
        `;
        globalDepartments.forEach(dept => {
            const perm = user.permissions.find(p => normalizeArabic(p.department_name) === normalizeArabic(dept.name));
            const canEdit = perm && (perm.can_edit == 1 || perm.can_edit === true);
            inventoryHtml += `
                <div class="flex items-center justify-between p-2.5 border border-slate-100 rounded-xl bg-white">
                    <div>
                        <p class="font-bold text-slate-800 text-sm">${dept.name}</p>
                        <p class="text-xs text-slate-500">منح صلاحية الإضافة والتعديل</p>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" ${canEdit ? 'checked' : ''} onchange="togglePermission(${userId}, '${dept.name}', this.checked)" class="sr-only peer">
                        <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                </div>
            `;
        });
        inventoryHtml += `</div></div>`;

        // Section 2: Project Management (نظام إدارة المشاريع)
        const pmPerm = user.permissions.find(p => p.department_name === 'project_management');
        const pmCanEdit = pmPerm && (pmPerm.can_edit == 1 || pmPerm.can_edit === true);
        let projectHtml = `
            <div class="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                <h4 class="font-bold text-sm text-indigo-700 border-b pb-2 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                    نظام إدارة المشاريع
                </h4>
                <div class="space-y-3">
                    <div class="flex items-center justify-between p-2.5 border border-slate-100 rounded-xl bg-white">
                        <div>
                            <p class="font-bold text-slate-800 text-sm">صلاحية إدارة المشاريع</p>
                            <p class="text-xs text-slate-500">منح صلاحيات المسؤول التنفيذي لجميع المشاريع</p>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" ${pmCanEdit ? 'checked' : ''} onchange="togglePermission(${userId}, 'project_management', this.checked)" class="sr-only peer">
                            <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                    </div>
                </div>
            </div>
        `;

        // Section 3: Purchasing Management (نظام إدارة المشتريات)
        const pCreatePerm = user.permissions.find(p => p.department_name === 'purchasing_create');
        const pCreateCanEdit = pCreatePerm && (pCreatePerm.can_edit == 1 || pCreatePerm.can_edit === true);

        const pStatusPerm = user.permissions.find(p => p.department_name === 'purchasing_status');
        const pStatusCanEdit = pStatusPerm && (pStatusPerm.can_edit == 1 || pStatusPerm.can_edit === true);

        const pSuppliersPerm = user.permissions.find(p => p.department_name === 'purchasing_suppliers');
        const pSuppliersCanEdit = pSuppliersPerm && (pSuppliersPerm.can_edit == 1 || pSuppliersPerm.can_edit === true);

        let purchasingHtml = `
            <div class="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                <h4 class="font-bold text-sm text-indigo-700 border-b pb-2 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                    نظام إدارة المشتريات
                </h4>
                <div class="space-y-3">
                    <div class="flex items-center justify-between p-2.5 border border-slate-100 rounded-xl bg-white">
                        <div>
                            <p class="font-bold text-slate-800 text-sm">إنشاء طلب شراء</p>
                            <p class="text-xs text-slate-500">منح صلاحية إضافة وتعديل طلبات الشراء</p>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" ${pCreateCanEdit ? 'checked' : ''} onchange="togglePermission(${userId}, 'purchasing_create', this.checked)" class="sr-only peer">
                            <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                    </div>
                    <div class="flex items-center justify-between p-2.5 border border-slate-100 rounded-xl bg-white">
                        <div>
                            <p class="font-bold text-slate-800 text-sm">تحويل حالة طلب الشراء</p>
                            <p class="text-xs text-slate-500">منح صلاحية اعتماد الطلبات وإتمام عملية الشراء</p>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" ${pStatusCanEdit ? 'checked' : ''} onchange="togglePermission(${userId}, 'purchasing_status', this.checked)" class="sr-only peer">
                            <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                    </div>
                    <div class="flex items-center justify-between p-2.5 border border-slate-100 rounded-xl bg-white">
                        <div>
                            <p class="font-bold text-slate-800 text-sm">تعديل قائمة الموردين</p>
                            <p class="text-xs text-slate-500">منح صلاحية إضافة وتعديل وحذف الموردين</p>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" ${pSuppliersCanEdit ? 'checked' : ''} onchange="togglePermission(${userId}, 'purchasing_suppliers', this.checked)" class="sr-only peer">
                            <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                    </div>
                </div>
            </div>
        `;
        
        permissionsList.innerHTML = systemsHtml + inventoryHtml + projectHtml + purchasingHtml;
        
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

let currentDefaultLock = "devon mortice lock";
let currentDefaultHinge = "Devon";
let currentDefaultArchitrave = "4";
let currentDefaultProfile = "single rabbit with rubber";
let currentDefaultUnderTile = "0";
let currentDefaultDoorType = "Single leaf metal";
let currentDefaultLeafThickness = "4.5";
let currentDefaultSpec = "Flush";
let ignoreFireDoorValidation = false;

let firstRowLockChangeCount = 0;
let firstRowHingeChangeCount = 0;
let firstRowArchitraveChangeCount = 0;
let firstRowProfileChangeCount = 0;
let firstRowUnderTileChangeCount = 0;
let firstRowDoorTypeChangeCount = 0;
let firstRowLeafThicknessChangeCount = 0;
let firstRowSpecChangeCount = 0;

function showModuleSelectorView() {
    const hrView = document.getElementById('hrView');
    if(hrView) hrView.classList.add('hidden');

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
    const username = localStorage.getItem('username');
    if (username !== 'admin' && !userPermissionsList.some(p => p.department_name === 'system_projects' && (p.can_edit == 1 || p.can_edit === true))) {
        showToast('غير مصرح لك بالوصول لنظام إدارة المشاريع', 'bg-rose-500', '✗');
        return;
    }

    const hrView = document.getElementById('hrView');
    if(hrView) hrView.classList.add('hidden');

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
    applyPermissionsToUI();
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
    
    // Reset defaults and first row change counters
    currentDefaultLock = "devon mortice lock";
    if (typeof dbLockOptions !== 'undefined') {
        const hasDevonLock = dbLockOptions.some(opt => opt.name.toLowerCase() === "devon mortise lock" || opt.name.toLowerCase() === "devon mortice lock");
        if (hasDevonLock) {
            const found = dbLockOptions.find(opt => opt.name.toLowerCase() === "devon mortise lock" || opt.name.toLowerCase() === "devon mortice lock");
            currentDefaultLock = found.name;
        }
    }
    
    currentDefaultHinge = "Devon";
    if (typeof dbHingeOptions !== 'undefined') {
        const hasDevonHinge = dbHingeOptions.some(opt => opt.name.toLowerCase() === "devon");
        if (hasDevonHinge) {
            const found = dbHingeOptions.find(opt => opt.name.toLowerCase() === "devon");
            currentDefaultHinge = found.name;
        }
    }
    
    currentDefaultArchitrave = "4";
    currentDefaultProfile = "single rabbit with rubber";
    currentDefaultUnderTile = "0";
    currentDefaultDoorType = "Single leaf metal";
    currentDefaultLeafThickness = "4.5";
    currentDefaultSpec = "Flush";
    if (typeof dbSpecOptions !== 'undefined') {
        const hasFlushSpec = dbSpecOptions.some(opt => opt.name.toLowerCase() === "flush");
        if (hasFlushSpec) {
            const found = dbSpecOptions.find(opt => opt.name.toLowerCase() === "flush");
            currentDefaultSpec = found.name;
        }
    }
    ignoreFireDoorValidation = false;
    
    firstRowLockChangeCount = 0;
    firstRowHingeChangeCount = 0;
    firstRowArchitraveChangeCount = 0;
    firstRowProfileChangeCount = 0;
    firstRowUnderTileChangeCount = 0;
    firstRowDoorTypeChangeCount = 0;
    firstRowLeafThicknessChangeCount = 0;
    firstRowSpecChangeCount = 0;

    document.getElementById('attachmentsList').innerHTML = '';
    goToWizardStep(1);

    // Auto-calculate next project number and pre-select previous executive manager
    (async () => {
        try {
            let lastExecutiveManagerId = localStorage.getItem('last_executive_manager_id');
            const response = await authFetch(PROJECTS_URL + '/');
            if (response.ok) {
                const projects = await response.json();
                let maxNum = 0;
                projects.forEach(p => {
                    if (p.project_number) {
                        const num = parseInt(p.project_number.trim(), 10);
                        if (!isNaN(num) && num > maxNum) {
                            maxNum = num;
                        }
                    }
                });
                document.getElementById('pwProjectNumber').value = maxNum + 1;
                
                if (!lastExecutiveManagerId && projects.length > 0) {
                    const lastProjWithMgr = projects.find(p => p.executive_manager_id);
                    if (lastProjWithMgr) {
                        lastExecutiveManagerId = lastProjWithMgr.executive_manager_id;
                    }
                }
            }
            await loadAssignees(lastExecutiveManagerId);
        } catch (err) {
            console.error("Failed to auto-detect next project number:", err);
            await loadAssignees();
        }
    })();
}

function goToWizardStep(stepNumber) {
    if (stepNumber === 2) {
        ignoreFireDoorValidation = false;
    }
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
    
    let nextDoorNumber = 'A1';
    const lastRow = tbody.querySelector('tr:last-child');
    if (lastRow) {
        const lastInput = lastRow.querySelector('td:first-child input');
        if (lastInput && lastInput.value) {
            const prevVal = lastInput.value.trim();
            const match = prevVal.match(/^(.*?)(\d+)$/);
            if (match) {
                const prefix = match[1];
                const num = parseInt(match[2], 10) + 1;
                nextDoorNumber = prefix + num;
            } else {
                nextDoorNumber = prevVal + '1';
            }
        }
    }

    const tr = document.createElement('tr');
    tr.className = 'border-b hover:bg-slate-50';
    
    let lockSelectOpts = `<option value="" disabled ${!currentDefaultLock ? 'selected' : ''}>الزرفيل</option>`;
    dbLockOptions.forEach(opt => {
        const isSelected = opt.name === currentDefaultLock;
        lockSelectOpts += `<option value="${opt.name}" ${isSelected ? 'selected' : ''}>${opt.name}</option>`;
    });
    if (dbLockOptions.length === 0) {
        lockSelectOpts += `
            <option value="devon mortice lock" ${currentDefaultLock === 'devon mortice lock' ? 'selected' : ''}>devon mortice lock</option>
            <option value="euroart mortice lock" ${currentDefaultLock === 'euroart mortice lock' ? 'selected' : ''}>euroart mortice lock</option>
            <option value="euroart roller" ${currentDefaultLock === 'euroart roller' ? 'selected' : ''}>euroart roller</option>
            <option value="consort mortice lock" ${currentDefaultLock === 'consort mortice lock' ? 'selected' : ''}>consort mortice lock</option>
            <option value="special" ${currentDefaultLock === 'special' ? 'selected' : ''}>special</option>
        `;
    }

    let hingeSelectOpts = `<option value="" disabled ${!currentDefaultHinge ? 'selected' : ''}>فصالات</option>`;
    dbHingeOptions.forEach(opt => {
        const isSelected = opt.name === currentDefaultHinge;
        hingeSelectOpts += `<option value="${opt.name}" ${isSelected ? 'selected' : ''}>${opt.name}</option>`;
    });
    if (dbHingeOptions.length === 0) {
        hingeSelectOpts += `
            <option value="Devon" ${currentDefaultHinge === 'Devon' ? 'selected' : ''}>Devon</option>
            <option value="vantage" ${currentDefaultHinge === 'vantage' ? 'selected' : ''}>vantage</option>
            <option value="euroart" ${currentDefaultHinge === 'euroart' ? 'selected' : ''}>euroart</option>
            <option value="consort" ${currentDefaultHinge === 'consort' ? 'selected' : ''}>consort</option>
            <option value="conseld" ${currentDefaultHinge === 'conseld' ? 'selected' : ''}>conseld</option>
            <option value="spical" ${currentDefaultHinge === 'spical' ? 'selected' : ''}>spical</option>
        `;
    }

    let profileSelectOpts = `<option value="" disabled ${!currentDefaultProfile ? 'selected' : ''}>المقطع</option>`;
    dbProfileOptions.forEach(opt => {
        const isSelected = opt.name === currentDefaultProfile;
        profileSelectOpts += `<option value="${opt.name}" ${isSelected ? 'selected' : ''}>${opt.name}</option>`;
    });
    if (dbProfileOptions.length === 0) {
        profileSelectOpts += `
            <option value="single rabbit with rubber" ${currentDefaultProfile === 'single rabbit with rubber' ? 'selected' : ''}>single rabbit with rubber</option>
            <option value="double rabbit with rubber" ${currentDefaultProfile === 'double rabbit with rubber' ? 'selected' : ''}>double rabbit with rubber</option>
            <option value="single rabbit" ${currentDefaultProfile === 'single rabbit' ? 'selected' : ''}>single rabbit</option>
            <option value="double rabbit" ${currentDefaultProfile === 'double rabbit' ? 'selected' : ''}>double rabbit</option>
        `;
    }

    let doorTypeSelectOpts = `<option value="" disabled ${!currentDefaultDoorType ? 'selected' : ''}>نوع الدرفة</option>`;
    dbDoorTypeOptions.forEach(opt => {
        const isSelected = opt.name === currentDefaultDoorType;
        doorTypeSelectOpts += `<option value="${opt.name}" ${isSelected ? 'selected' : ''}>${opt.name}</option>`;
    });
    if (dbDoorTypeOptions.length === 0) {
        doorTypeSelectOpts += `
            <option value="Single leaf metal" ${currentDefaultDoorType === 'Single leaf metal' ? 'selected' : ''}>Single leaf metal</option>
            <option value="Double leaf metal" ${currentDefaultDoorType === 'Double leaf metal' ? 'selected' : ''}>Double leaf metal</option>
            <option value="single leaf wood" ${currentDefaultDoorType === 'single leaf wood' ? 'selected' : ''}>single leaf wood</option>
            <option value="double leaf wood" ${currentDefaultDoorType === 'double leaf wood' ? 'selected' : ''}>double leaf wood</option>
        `;
    }

    let specSelectOpts = `<option value="" disabled ${!currentDefaultSpec ? 'selected' : ''}>المواصفات</option>`;
    dbSpecOptions.forEach(opt => {
        const isSelected = opt.name === currentDefaultSpec;
        specSelectOpts += `<option value="${opt.name}" ${isSelected ? 'selected' : ''}>${opt.name}</option>`;
    });
    if (dbSpecOptions.length === 0) {
        specSelectOpts += `
            <option value="Flush" ${currentDefaultSpec === 'Flush' ? 'selected' : ''}>Flush</option>
            <option value="louver" ${currentDefaultSpec === 'louver' ? 'selected' : ''}>louver</option>
            <option value="VP" ${currentDefaultSpec === 'VP' ? 'selected' : ''}>VP</option>
            <option value="GMB" ${currentDefaultSpec === 'GMB' ? 'selected' : ''}>GMB</option>
        `;
    }

    tr.innerHTML = `
        <td class="p-2"><input type="text" class="w-16 px-2 py-1 border rounded text-center font-bold" placeholder="رقم" value="${nextDoorNumber}"></td>
        <td class="p-2"><input type="number" class="w-16 px-2 py-1 border rounded text-center" placeholder="العدد" value="1" min="1"></td>
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
                ${lockSelectOpts}
            </select>
        </td>
        <td class="p-2">
            <select class="w-full px-2 py-1 border rounded bg-white text-sm">
                ${hingeSelectOpts}
            </select>
        </td>
        <td class="p-2">
            <select class="w-full px-2 py-1 border rounded bg-white text-sm font-bold text-center">
                <option value="3">3</option>
                <option value="4" selected>4</option>
                <option value="5">5</option>
                <option value="6">6</option>
                <option value="7">7</option>
            </select>
        </td>
        <td class="p-2">
            <select class="w-full px-2 py-1 border rounded bg-white text-sm">
                ${profileSelectOpts}
            </select>
        </td>
        <td class="p-2">
            <select class="w-full px-2 py-1 border rounded bg-white text-sm">
                ${doorTypeSelectOpts}
            </select>
        </td>
        <td class="p-2">
            <select class="w-full px-2 py-1 border rounded bg-white text-sm">
                ${specSelectOpts}
            </select>
        </td>
        <td class="p-2">
            <select class="w-full px-2 py-1 border rounded bg-white text-sm font-bold text-center">
                <option value="4.5" ${currentDefaultLeafThickness === '4.5' ? 'selected' : ''}>4.5</option>
                <option value="5.5" ${currentDefaultLeafThickness === '5.5' ? 'selected' : ''}>5.5</option>
                <option value="6.5" ${currentDefaultLeafThickness === '6.5' ? 'selected' : ''}>6.5</option>
            </select>
        </td>
        <td class="p-2 text-center"><input type="checkbox" class="w-4 h-4"></td>
        <td class="p-2 text-center"><input type="checkbox" class="w-4 h-4"></td>
        <td class="p-2"><input type="text" class="w-full px-2 py-1 border rounded" placeholder="الكشفة" oninput="autoCalculateArchitrave2(this)" value="${currentDefaultArchitrave || ''}"></td>
        <td class="p-2"><input type="text" class="w-full px-2 py-1 border rounded" placeholder="الكشفة 2" value="${currentDefaultArchitrave ? (parseFloat(currentDefaultArchitrave) + 2.2).toFixed(1) : ''}"></td>
        <td class="p-2"><input type="text" class="w-full px-2 py-1 border rounded" placeholder="تحت البلاط" value="${currentDefaultUnderTile || ''}"></td>
        <td class="p-2"><input type="text" class="w-full px-2 py-1 border rounded" placeholder="الشباك"></td>
        <td class="p-2 text-center"><input type="checkbox" class="w-4 h-4"></td>
        <td class="p-2"><input type="text" class="w-full px-2 py-1 border rounded" placeholder="ملاحظات"></td>
        <td class="p-2 text-center"><button type="button" onclick="this.closest('tr').remove()" class="text-rose-500 hover:text-rose-700 font-bold p-1">&times;</button></td>
    `;
    
    // Set change listeners
    const selects = tr.querySelectorAll('select');
    const inputs = tr.querySelectorAll('input');
    
    // Lock Type select (selects[1])
    selects[1].addEventListener('change', function() {
        const isFirstRow = (tr.previousElementSibling === null);
        if (isFirstRow) {
            firstRowLockChangeCount++;
            if (firstRowLockChangeCount === 1) {
                currentDefaultLock = this.value;
                const rows = tbody.querySelectorAll('tr');
                rows.forEach((row, idx) => {
                    if (idx > 0) {
                        const rowSelects = row.querySelectorAll('select');
                        if (rowSelects[1]) {
                            rowSelects[1].value = currentDefaultLock;
                        }
                    }
                });
            }
        }
    });

    // Hinges select (selects[2])
    selects[2].addEventListener('change', function() {
        const isFirstRow = (tr.previousElementSibling === null);
        if (isFirstRow) {
            firstRowHingeChangeCount++;
            if (firstRowHingeChangeCount === 1) {
                currentDefaultHinge = this.value;
                const rows = tbody.querySelectorAll('tr');
                rows.forEach((row, idx) => {
                    if (idx > 0) {
                        const rowSelects = row.querySelectorAll('select');
                        if (rowSelects[2]) {
                            rowSelects[2].value = currentDefaultHinge;
                        }
                    }
                });
            }
        }
    });

    // Architrave input (inputs[7])
    inputs[7].addEventListener('change', function() {
        const isFirstRow = (tr.previousElementSibling === null);
        if (isFirstRow) {
            firstRowArchitraveChangeCount++;
            if (firstRowArchitraveChangeCount === 1) {
                currentDefaultArchitrave = this.value;
                const rows = tbody.querySelectorAll('tr');
                rows.forEach((row, idx) => {
                    if (idx > 0) {
                        const rowInputs = row.querySelectorAll('input');
                        if (rowInputs[7]) {
                            rowInputs[7].value = currentDefaultArchitrave;
                            window.autoCalculateArchitrave2(rowInputs[7]);
                        }
                    }
                });
            }
        }
    });

    // Profile select (selects[4])
    selects[4].addEventListener('change', function() {
        const isFirstRow = (tr.previousElementSibling === null);
        if (isFirstRow) {
            firstRowProfileChangeCount++;
            if (firstRowProfileChangeCount === 1) {
                currentDefaultProfile = this.value;
                const rows = tbody.querySelectorAll('tr');
                rows.forEach((row, idx) => {
                    if (idx > 0) {
                        const rowSelects = row.querySelectorAll('select');
                        if (rowSelects[4]) {
                            rowSelects[4].value = currentDefaultProfile;
                        }
                    }
                });
            }
        }
    });

    // Under Tile input (inputs[9])
    inputs[9].addEventListener('change', function() {
        const isFirstRow = (tr.previousElementSibling === null);
        if (isFirstRow) {
            firstRowUnderTileChangeCount++;
            if (firstRowUnderTileChangeCount === 1) {
                currentDefaultUnderTile = this.value;
                const rows = tbody.querySelectorAll('tr');
                rows.forEach((row, idx) => {
                    if (idx > 0) {
                        const rowInputs = row.querySelectorAll('input');
                        if (rowInputs[9]) {
                            rowInputs[9].value = currentDefaultUnderTile;
                        }
                    }
                });
            }
        }
    });

    // Door Type select (selects[5])
    selects[5].addEventListener('change', function() {
        const isFirstRow = (tr.previousElementSibling === null);
        if (isFirstRow) {
            firstRowDoorTypeChangeCount++;
            if (firstRowDoorTypeChangeCount === 1) {
                currentDefaultDoorType = this.value;
                const rows = tbody.querySelectorAll('tr');
                rows.forEach((row, idx) => {
                    if (idx > 0) {
                        const rowSelects = row.querySelectorAll('select');
                        if (rowSelects[5]) {
                            rowSelects[5].value = currentDefaultDoorType;
                        }
                    }
                });
            }
        }
    });

    // Specifications select (selects[6])
    selects[6].addEventListener('change', function() {
        const isFirstRow = (tr.previousElementSibling === null);
        if (isFirstRow) {
            firstRowSpecChangeCount++;
            if (firstRowSpecChangeCount === 1) {
                currentDefaultSpec = this.value;
                const rows = tbody.querySelectorAll('tr');
                rows.forEach((row, idx) => {
                    if (idx > 0) {
                        const rowSelects = row.querySelectorAll('select');
                        if (rowSelects[6]) {
                            rowSelects[6].value = currentDefaultSpec;
                        }
                    }
                });
            }
        }
    });

    // Leaf Thickness select (selects[7])
    selects[7].addEventListener('change', function() {
        const isFirstRow = (tr.previousElementSibling === null);
        if (isFirstRow) {
            firstRowLeafThicknessChangeCount++;
            if (firstRowLeafThicknessChangeCount === 1) {
                currentDefaultLeafThickness = this.value;
                const rows = tbody.querySelectorAll('tr');
                rows.forEach((row, idx) => {
                    if (idx > 0) {
                        const rowSelects = row.querySelectorAll('select');
                        if (rowSelects[7]) {
                            rowSelects[7].value = currentDefaultLeafThickness;
                        }
                    }
                });
            }
        }
    });

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

async function loadAssignees(selectedId = null) {
    try {
        const response = await authFetch(USERS_BASIC_URL);
        if (response.ok) {
            const users = await response.json();
            const select = document.getElementById('pwAssignee');
            if (select) {
                select.innerHTML = '<option value="">-- اختر مسؤول التنفيذ --</option>';
                users.forEach(u => {
                    const opt = document.createElement('option');
                    opt.value = u.id;
                    opt.textContent = u.full_name ? `${u.username} (${u.full_name})` : u.username;
                    select.appendChild(opt);
                });
                if (selectedId) {
                    select.value = selectedId;
                }
            }
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
                tr.className = 'border-b hover:bg-slate-50 transition text-sm cursor-pointer';
                tr.onclick = (e) => {
                    if (e.target.closest('button') || e.target.closest('a')) return;
                    viewProjectDetails(p.id);
                };
                
                let statusBadge = '<span class="px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg font-bold text-xs">قيد الانتظار</span>';
                if (p.status === 'active') {
                    statusBadge = '<span class="px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg font-bold text-xs">فعال</span>';
                } else if (p.status === 'completed') {
                    statusBadge = '<span class="px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg font-bold text-xs">منتهي</span>';
                }
                
                tr.innerHTML = `
                    <td class="p-4 font-bold text-slate-800">${p.project_number || '-'}</td>
                    <td class="p-4 font-semibold text-slate-700 hover:text-indigo-600 transition">${p.name || '-'}</td>
                    <td class="p-4 text-slate-500">${p.contractor_name || '-'}</td>
                    <td class="p-4 text-slate-500" dir="ltr">${p.delivery_date ? new Date(p.delivery_date).toLocaleDateString() : '-'}</td>
                    <td class="p-4">${statusBadge}</td>
                    <td class="p-4 text-center">
                        <button onclick="openProjectTracking(${p.id})" class="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg transition font-bold text-xs border border-indigo-200">متابعة</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
            if(projects.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-400">لا يوجد مشاريع مسجلة حالياً.</td></tr>`;
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
    document.getElementById('pdEngineeringTableBody').innerHTML = '<tr><td colspan="16" class="p-4 text-center">جاري التحميل...</td></tr>';
    
    try {
        const response = await authFetch(`${PROJECTS_URL}/${id}`);
        if (!response.ok) throw new Error('فشل جلب تفاصيل المشروع');
        
        const p = await response.json();
        window.currentProjectData = p;
        
        document.getElementById('pdTitle').textContent = p.name;
        document.getElementById('pdSubtitle').textContent = p.delivery_date ? `تاريخ التسليم المتوقع: ${new Date(p.delivery_date).toLocaleDateString()}` : '';
        
        document.getElementById('pdNumber').textContent = p.project_number;
        document.getElementById('pdContractor').textContent = p.contractor_name || '-';
        const receiptDateVal = p.activated_at || p.created_at;
        if (document.getElementById('pdReceipt')) {
            document.getElementById('pdReceipt').textContent = receiptDateVal ? new Date(receiptDateVal).toLocaleDateString() : '-';
        }
        document.getElementById('pdDelivery').textContent = p.delivery_date ? new Date(p.delivery_date).toLocaleDateString() : '-';
        document.getElementById('pdEngineer').textContent = p.engineer_name || '-';
        document.getElementById('pdEngineerPhone').textContent = p.engineer_phone || '-';
        document.getElementById('pdLocation').textContent = p.location || '-';
        const mapUrlContainer = document.getElementById('pdMapUrlContainer');
        if (mapUrlContainer) {
            if (p.map_url) {
                mapUrlContainer.innerHTML = `<a href="${p.map_url}" target="_blank" class="text-indigo-600 hover:text-indigo-800 font-bold underline flex items-center gap-1">عرض على الخريطة <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg></a>`;
            } else {
                mapUrlContainer.textContent = '-';
            }
        }
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
        let isAuthorized = (currentUser === 'admin') || userPermissionsList.some(perm => perm.department_name === 'project_management' && (perm.can_edit == 1 || perm.can_edit === true));
        
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
                    const deleteHtml = p.status === 'pending' ? `
                        <button onclick="deleteProjectWithConfirmation(${p.id})" class="mr-3 px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl transition font-bold flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            حذف المشروع
                        </button>
                    ` : '';
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
            const editHtml = `
                <button onclick="editProject(${p.id})" class="mr-3 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 rounded-xl transition font-bold flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    تعديل المشروع
                </button>
            `;
            const deleteHtml = p.status === 'pending' ? `
                <button onclick="deleteProjectWithConfirmation(${p.id})" class="mr-3 px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl transition font-bold flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    حذف المشروع
                </button>
            ` : '';
            badge.innerHTML = `<div class="flex items-center">` + selectHtml + trackHtml + editHtml + deleteHtml + `</div>`;
        }
        
        const tbody = document.getElementById('pdEngineeringTableBody');
        tbody.innerHTML = '';
        if (p.details && p.details.length > 0) {
            p.details.forEach(d => {
                const tr = document.createElement('tr');
                tr.className = 'border-b hover:bg-slate-50 transition text-sm';
                tr.innerHTML = `
                    <td class="p-3 font-bold">${d.door_number || '-'}</td>
                    <td class="p-3">${d.quantity !== null && d.quantity !== undefined ? d.quantity : 1}</td>
                    <td class="p-3">${d.width || '-'}</td>
                    <td class="p-3">${d.height || '-'}</td>
                    <td class="p-3">${d.depth || '-'}</td>
                    <td class="p-3">${d.direction || '-'}</td>
                    <td class="p-3">${d.lock_type || '-'}</td>
                    <td class="p-3">${d.hinges || '-'}</td>
                    <td class="p-3 font-bold text-slate-700">${d.hinges_count || '4'}</td>
                    <td class="p-3">${d.profile_type || '-'}</td>
                    <td class="p-3">${d.door_type || '-'}</td>
                    <td class="p-3">${d.specifications || '-'}</td>
                    <td class="p-3 font-semibold text-slate-700">${d.leaf_thickness || '4.5'}</td>
                    <td class="p-3 text-center">${d.qashatah === 'YES' ? 'نعم' : 'لا'}</td>
                    <td class="p-3 text-center">${d.fire_resistance || '-'}</td>
                    <td class="p-3">${d.architrave || '-'}</td>
                    <td class="p-3">${d.architrave_2 || '-'}</td>
                    <td class="p-3">${d.under_tile || '-'}</td>
                    <td class="p-3">${d.window_details || '-'}</td>
                    <td class="p-3 text-center">${d.raddad === 'YES' ? 'نعم' : 'لا'}</td>
                    <td class="p-3">${d.notes || '-'}</td>
                `;
                tbody.appendChild(tr);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="20" class="p-4 text-center text-slate-500">لا يوجد تفاصيل هندسية مسجلة</td></tr>';
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
        const resActions = document.getElementById('projectReservationActions');
        if (resActions) resActions.classList.add('hidden');
        
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
                map_url: document.getElementById('pwMapUrl').value || null,
                executive_manager_id: document.getElementById('pwAssignee').value ? parseInt(document.getElementById('pwAssignee').value) : null,
                paint_color: document.getElementById('pwPaintColor').value,
                manufacturing_type: document.getElementById('pwManufacturingType') ? document.getElementById('pwManufacturingType').value : null,
                installation_type: document.getElementById('pwInstallationType') ? document.getElementById('pwInstallationType').value : null,
                notes: document.getElementById('pwNotes') ? document.getElementById('pwNotes').value : null,
                status: document.querySelector('input[name="pwStatus"]:checked').value
            };
            
            if (payload.executive_manager_id) {
                localStorage.setItem('last_executive_manager_id', payload.executive_manager_id);
            }
            
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
                const qtyVal = parseInt(inputs[1].value);
                const hingesCountVal = parseInt(inputs[8].value);
                const detailPayload = {
                    door_number: inputs[0].value || null,
                    quantity: isNaN(qtyVal) ? 1 : qtyVal,
                    width: inputs[2].value || null,
                    height: inputs[3].value || null,
                    depth: inputs[4].value || null,
                    direction: inputs[5].value || null,
                    lock_type: inputs[6].value || null,
                    hinges: inputs[7].value || null,
                    hinges_count: isNaN(hingesCountVal) ? 4 : hingesCountVal,
                    profile_type: inputs[9].value || null,
                    door_type: inputs[10].value || null,
                    specifications: inputs[11].value || null,
                    leaf_thickness: inputs[12].value || "4.5",
                    qashatah: inputs[13].checked ? 'YES' : 'NO',
                    fire_resistance: inputs[14].checked ? 'Yes' : 'No',
                    architrave: inputs[15].value || null,
                    architrave_2: inputs[16].value || null,
                    under_tile: inputs[17].value || null,
                    window_details: inputs[18].value || null,
                    raddad: inputs[19].checked ? 'YES' : 'NO',
                    notes: inputs[20].value || null
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
    
    const multiplyBy10 = (val) => {
        if (val === null || val === undefined || val === '') return '';
        const num = parseFloat(val);
        return isNaN(num) ? val : num * 10;
    };

    const headers = [
        "Name", "width", "Hight", "Depth", "Direction", "Profile", "Lock set", 
        "Drop Seal", "Over Lap", "Over lap2", "Under flow", "FR"
    ];
    
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += headers.join(",") + "\r\n";
    
    window.currentProjectData.details.forEach(d => {
        const row = [
            `${window.currentProjectData.project_number || ''} - ${d.door_number || ''}`,
            multiplyBy10(d.width),
            multiplyBy10(d.height),
            multiplyBy10(d.depth),
            d.direction || '',
            d.profile_type || '',
            d.lock_type || '',
            d.qashatah || 'NO',
            multiplyBy10(d.architrave),
            multiplyBy10(d.architrave_2),
            multiplyBy10(d.under_tile),
            d.fire_resistance || ''
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
                if (!response.ok) {
                    const errData = await response.json().catch(() => ({}));
                    throw new Error(errData.detail || 'فشل حذف المشروع');
                }
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
        document.getElementById('pwMapUrl').value = p.map_url || '';
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
                let lockSelectOpts = `<option value="" disabled ${!d.lock_type ? 'selected' : ''}>الزرفيل</option>`;
                dbLockOptions.forEach(opt => {
                    lockSelectOpts += `<option value="${opt.name}" ${d.lock_type === opt.name ? 'selected' : ''}>${opt.name}</option>`;
                });
                if (dbLockOptions.length === 0) {
                    lockSelectOpts += `
                        <option value="devon mortice lock" ${d.lock_type === 'devon mortice lock' ? 'selected' : ''}>devon mortice lock</option>
                        <option value="euroart mortice lock" ${d.lock_type === 'euroart mortice lock' ? 'selected' : ''}>euroart mortice lock</option>
                        <option value="euroart roller" ${d.lock_type === 'euroart roller' ? 'selected' : ''}>euroart roller</option>
                        <option value="consort mortice lock" ${d.lock_type === 'consort mortice lock' ? 'selected' : ''}>consort mortice lock</option>
                        <option value="special" ${d.lock_type === 'special' ? 'selected' : ''}>special</option>
                    `;
                }

                let hingeSelectOpts = `<option value="" disabled ${!d.hinges ? 'selected' : ''}>فصالات</option>`;
                dbHingeOptions.forEach(opt => {
                    hingeSelectOpts += `<option value="${opt.name}" ${d.hinges === opt.name ? 'selected' : ''}>${opt.name}</option>`;
                });
                if (dbHingeOptions.length === 0) {
                    hingeSelectOpts += `
                        <option value="Devon" ${d.hinges === 'Devon' ? 'selected' : ''}>Devon</option>
                        <option value="vantage" ${d.hinges === 'vantage' ? 'selected' : ''}>vantage</option>
                        <option value="euroart" ${d.hinges === 'euroart' ? 'selected' : ''}>euroart</option>
                        <option value="consort" ${d.hinges === 'consort' ? 'selected' : ''}>consort</option>
                        <option value="conseld" ${d.hinges === 'conseld' ? 'selected' : ''}>conseld</option>
                        <option value="spical" ${d.hinges === 'spical' ? 'selected' : ''}>spical</option>
                    `;
                }

                let profileSelectOpts = `<option value="" disabled ${!d.profile_type ? 'selected' : ''}>المقطع</option>`;
                dbProfileOptions.forEach(opt => {
                    profileSelectOpts += `<option value="${opt.name}" ${d.profile_type === opt.name ? 'selected' : ''}>${opt.name}</option>`;
                });
                if (dbProfileOptions.length === 0) {
                    profileSelectOpts += `
                        <option value="single rabbit with rubber" ${d.profile_type === 'single rabbit with rubber' ? 'selected' : ''}>single rabbit with rubber</option>
                        <option value="double rabbit with rubber" ${d.profile_type === 'double rabbit with rubber' ? 'selected' : ''}>double rabbit with rubber</option>
                        <option value="single rabbit" ${d.profile_type === 'single rabbit' ? 'selected' : ''}>single rabbit</option>
                        <option value="double rabbit" ${d.profile_type === 'double rabbit' ? 'selected' : ''}>double rabbit</option>
                    `;
                }

                let doorTypeSelectOpts = `<option value="" disabled ${!d.door_type ? 'selected' : ''}>نوع الدرفة</option>`;
                dbDoorTypeOptions.forEach(opt => {
                    doorTypeSelectOpts += `<option value="${opt.name}" ${d.door_type === opt.name ? 'selected' : ''}>${opt.name}</option>`;
                });
                if (dbDoorTypeOptions.length === 0) {
                    doorTypeSelectOpts += `
                        <option value="Single leaf metal" ${d.door_type === 'Single leaf metal' || !d.door_type ? 'selected' : ''}>Single leaf metal</option>
                        <option value="Double leaf metal" ${d.door_type === 'Double leaf metal' ? 'selected' : ''}>Double leaf metal</option>
                        <option value="single leaf wood" ${d.door_type === 'single leaf wood' ? 'selected' : ''}>single leaf wood</option>
                        <option value="double leaf wood" ${d.door_type === 'double leaf wood' ? 'selected' : ''}>double leaf wood</option>
                    `;
                }

                let specSelectOpts = `<option value="" disabled ${!d.specifications ? 'selected' : ''}>المواصفات</option>`;
                dbSpecOptions.forEach(opt => {
                    specSelectOpts += `<option value="${opt.name}" ${d.specifications === opt.name ? 'selected' : ''}>${opt.name}</option>`;
                });
                if (dbSpecOptions.length === 0) {
                    specSelectOpts += `
                        <option value="Flush" ${d.specifications === 'Flush' ? 'selected' : ''}>Flush</option>
                        <option value="louver" ${d.specifications === 'louver' ? 'selected' : ''}>louver</option>
                        <option value="VP" ${d.specifications === 'VP' ? 'selected' : ''}>VP</option>
                        <option value="GMB" ${d.specifications === 'GMB' ? 'selected' : ''}>GMB</option>
                    `;
                }

                const tr = document.createElement('tr');
                tr.className = 'border-b hover:bg-slate-50 transition';
                tr.innerHTML = `
                    <td class="p-2"><input type="text" class="w-16 px-2 py-2 border border-slate-300 rounded-lg text-sm text-center font-bold" value="${d.door_number || ''}"></td>
                    <td class="p-2"><input type="number" class="w-16 px-2 py-2 border border-slate-300 rounded-lg text-sm text-center" value="${d.quantity !== null && d.quantity !== undefined ? d.quantity : 1}"></td>
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
                            ${lockSelectOpts}
                        </select>
                    </td>
                    <td class="p-2">
                        <select class="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white">
                            ${hingeSelectOpts}
                        </select>
                    </td>
                    <td class="p-2">
                        <select class="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white font-bold text-center">
                            <option value="3" ${d.hinges_count === 3 ? 'selected' : ''}>3</option>
                            <option value="4" ${d.hinges_count === 4 || !d.hinges_count ? 'selected' : ''}>4</option>
                            <option value="5" ${d.hinges_count === 5 ? 'selected' : ''}>5</option>
                            <option value="6" ${d.hinges_count === 6 ? 'selected' : ''}>6</option>
                            <option value="7" ${d.hinges_count === 7 ? 'selected' : ''}>7</option>
                        </select>
                    </td>
                    <td class="p-2">
                        <select class="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white">
                            ${profileSelectOpts}
                        </select>
                    </td>
                    <td class="p-2">
                        <select class="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white">
                            ${doorTypeSelectOpts}
                        </select>
                    </td>
                    <td class="p-2">
                        <select class="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white">
                            ${specSelectOpts}
                        </select>
                    </td>
                    <td class="p-2">
                        <select class="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white font-bold text-center">
                            <option value="4.5" ${d.leaf_thickness === '4.5' || !d.leaf_thickness ? 'selected' : ''}>4.5</option>
                            <option value="5.5" ${d.leaf_thickness === '5.5' ? 'selected' : ''}>5.5</option>
                            <option value="6.5" ${d.leaf_thickness === '6.5' ? 'selected' : ''}>6.5</option>
                        </select>
                    </td>
                    <td class="p-2 text-center"><input type="checkbox" class="w-5 h-5 text-indigo-600 rounded" ${d.qashatah === 'YES' ? 'checked' : ''}></td>
                    <td class="p-2 text-center"><input type="checkbox" class="w-5 h-5 text-indigo-600 rounded" ${d.fire_resistance === 'Yes' || d.fire_resistance === 'نعم' ? 'checked' : ''}></td>
                    <td class="p-2"><input type="text" class="w-full p-2 border border-slate-300 rounded-lg text-sm" placeholder="الكشفة" value="${d.architrave || ''}" oninput="autoCalculateArchitrave2(this)"></td>
                    <td class="p-2"><input type="text" class="w-full p-2 border border-slate-300 rounded-lg text-sm" placeholder="الكشفة 2" value="${d.architrave_2 || ''}"></td>
                    <td class="p-2"><input type="text" class="w-full p-2 border border-slate-300 rounded-lg text-sm" value="${d.under_tile || ''}"></td>
                    <td class="p-2"><input type="text" class="w-full p-2 border border-slate-300 rounded-lg text-sm" value="${d.window_details || ''}"></td>
                    <td class="p-2 text-center"><input type="checkbox" class="w-5 h-5 text-indigo-600 rounded" ${d.raddad === 'YES' ? 'checked' : ''}></td>
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

async function updateTrackingStep(field, selectEl, explicitProjectId = null) {
    const newVal = selectEl.value;
    selectEl.className = `w-full max-w-[200px] border rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 transition-colors ${getStepColorClasses(newVal)}`;
    
    const targetProjectId = explicitProjectId || currentTrackingProjectId;
    if (!targetProjectId) return;
    
    try {
        const payload = {};
        payload[field] = newVal;
        
        const response = await authFetch(`${PROJECTS_URL}/${targetProjectId}`, {
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
    const username = localStorage.getItem('username');
    if (username !== 'admin' && !userPermissionsList.some(p => p.department_name === 'system_purchasing' && (p.can_edit == 1 || p.can_edit === true))) {
        showToast('غير مصرح لك بالوصول لنظام إدارة المشتريات', 'bg-rose-500', '✗');
        return;
    }

    const hrView = document.getElementById('hrView');
    if(hrView) hrView.classList.add('hidden');

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
    applyPermissionsToUI();
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
        
        const isSupplierEditAuthorized = localStorage.getItem('username') === 'admin' || userPermissionsList.some(p => p.department_name === 'purchasing_suppliers' && (p.can_edit == 1 || p.can_edit === true));

        suppliers.forEach(s => {
            const mapsLink = s.maps_url ? `<a href="${s.maps_url}" target="_blank" class="text-blue-500 hover:underline">عرض الخريطة</a>` : '-';
            
            let actionsHtml = '';
            if (isSupplierEditAuthorized) {
                actionsHtml = `
                    <button onclick="editSupplier(${s.id})" class="text-indigo-600 hover:text-indigo-800 p-1"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>
                    <button onclick="deleteSupplier(${s.id})" class="text-rose-600 hover:text-rose-800 p-1"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                `;
            } else {
                actionsHtml = '-';
            }

            tbody.innerHTML += `
                <tr class="border-b hover:bg-slate-50 transition">
                    <td class="p-4 font-bold text-slate-800">${s.name}</td>
                    <td class="p-4" dir="ltr">${s.phone || '-'}</td>
                    <td class="p-4 text-slate-600">${s.supply_type || '-'}</td>
                    <td class="p-4">${s.location || '-'} <br> ${mapsLink}</td>
                    <td class="p-4 text-center">
                        ${actionsHtml}
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
            
            const hasStatusPermission = localStorage.getItem('username') === 'admin' || userPermissionsList.some(p => p.department_name === 'purchasing_status' && (p.can_edit == 1 || p.can_edit === true));
            const hasCreatePermission = localStorage.getItem('username') === 'admin' || userPermissionsList.some(p => p.department_name === 'purchasing_create' && (p.can_edit == 1 || p.can_edit === true));

            if (r.status === 'Pending') {
                statusBadge = '<span class="bg-amber-100 text-amber-800 px-2 py-1 rounded-md text-xs font-bold border border-amber-200">قيد الانتظار</span>';
                if (hasStatusPermission) {
                    actionButtons += `<button onclick="approvePurchaseRequest(${r.id})" class="text-xs bg-emerald-100 hover:bg-emerald-200 text-emerald-700 px-2 py-1 rounded font-bold mx-1">موافقة</button>`;
                }
            } else if (r.status === 'Active') {
                statusBadge = '<span class="bg-blue-100 text-blue-800 px-2 py-1 rounded-md text-xs font-bold border border-blue-200">مُعتمد</span>';
                if (hasStatusPermission) {
                    actionButtons += `<button onclick="openMarkPurchasedModal(${r.id})" class="text-xs bg-indigo-100 hover:bg-indigo-200 text-indigo-700 px-2 py-1 rounded font-bold mx-1 border border-indigo-200">إتمام الشراء</button>`;
                }
            } else if (r.status === 'Purchased') {
                statusBadge = '<span class="bg-emerald-100 text-emerald-800 px-2 py-1 rounded-md text-xs font-bold border border-emerald-200">تم الشراء</span>';
                if(r.invoice_image_url) actionButtons += `<a href="${API_HOST}${r.invoice_image_url}" target="_blank" class="text-xs text-blue-600 hover:underline mx-1">الفاتورة</a>`;
                if(r.items_image_url) actionButtons += `<a href="${API_HOST}${r.items_image_url}" target="_blank" class="text-xs text-blue-600 hover:underline mx-1">المشتريات</a>`;
            }

            const dateStr = new Date(r.created_at).toLocaleDateString('ar-SA');
            const ownerName = r.requested_by ? r.requested_by.username : 'غير معروف';

            let deleteBtn = '';
            if (hasCreatePermission || r.requested_by_id === (window.currentUser ? window.currentUser.id : null)) {
                deleteBtn = `<button onclick="deletePurchaseRequest(${r.id})" class="text-rose-600 hover:text-rose-800 p-1 align-middle"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>`;
            }

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
                        ${deleteBtn}
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
    
    const hasStatusPermission = localStorage.getItem('username') === 'admin' || userPermissionsList.some(p => p.department_name === 'purchasing_status' && (p.can_edit == 1 || p.can_edit === true));
    const hasCreatePermission = localStorage.getItem('username') === 'admin' || userPermissionsList.some(p => p.department_name === 'purchasing_create' && (p.can_edit == 1 || p.can_edit === true));

    if (r.status === 'Pending' && hasStatusPermission) {
        actionsContainer.innerHTML += `<button onclick="approvePurchaseRequestDetails(${r.id})" class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-bold shadow flex items-center gap-2 transition"><svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>موافقة على الطلب</button>`;
    } else if (r.status === 'Active' && hasStatusPermission) {
        actionsContainer.innerHTML += `<button onclick="openMarkPurchasedModal(${r.id})" class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold shadow flex items-center gap-2 transition">إتمام عملية الشراء</button>`;
    }
    
    if (hasCreatePermission || r.requested_by_id === (window.currentUser ? window.currentUser.id : null)) {
        actionsContainer.innerHTML += `<button onclick="openPurchaseRequestModal(${r.id})" class="bg-blue-50 hover:bg-blue-100 text-blue-700 px-4 py-2 rounded-lg font-bold shadow transition text-sm">تعديل</button>`;
        actionsContainer.innerHTML += `<button onclick="deletePurchaseRequestDetails(${r.id})" class="bg-rose-100 hover:bg-rose-200 text-rose-700 px-4 py-2 rounded-lg font-bold shadow transition text-sm">حذف</button>`;
    }

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
            const resActions = document.getElementById('projectReservationActions');
            if (resActions) resActions.classList.add('hidden');
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
            
            // Show reservation actions if authorized
            const resActions = document.getElementById('projectReservationActions');
            if (resActions) {
                const currentUsername = localStorage.getItem('username');
                const isManager = (window.currentUser && (
                    window.currentUser.username === 'admin' ||
                    window.currentUser.id === window.currentProjectData.executive_manager_id
                )) || currentUsername === 'admin' || (window.currentProjectData && window.currentProjectData.executive_manager_username === currentUsername);
                
                // Also load details from users if not matching but check fallback or check if the local user is indeed authorized
                // Let's do a reliable fallback check:
                let authorized = false;
                const hasProjMgmt = userPermissionsList.some(perm => perm.department_name === 'project_management' && (perm.can_edit == 1 || perm.can_edit === true));
                if (currentUsername === 'admin' || hasProjMgmt) {
                    authorized = true;
                } else if (window.currentUser && window.currentProjectData && window.currentUser.id === window.currentProjectData.executive_manager_id) {
                    authorized = true;
                } else if (window.currentProjectData && window.currentProjectData.executive_manager_id) {
                    // if current user is not loaded yet or async fetch did not finish, we can compare local username with the executive manager's name
                    const pdAssigneeEl = document.getElementById('pdAssignee');
                    if (pdAssigneeEl && pdAssigneeEl.textContent.trim() === currentUsername) {
                        authorized = true;
                    }
                }
                
                if (authorized) {
                    resActions.classList.remove('hidden');
                } else {
                    resActions.classList.add('hidden');
                }
            }
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

// ------------- PROJECT OPTIONS MANAGEMENT -------------

window.openAddOptionModal = function(type) {
    let title = 'إضافة خيار جديد';
    if (type === 'lock') title = 'إضافة خيار زرفيل جديد';
    else if (type === 'hinge') title = 'إضافة خيار فصالة جديد';
    else if (type === 'profile') title = 'إضافة خيار مقطع جديد';
    else if (type === 'door_type') title = 'إضافة خيار نوع درفة جديد';
    else if (type === 'specification') title = 'إضافة خيار مواصفات جديد';

    document.getElementById('optionModalTitle').textContent = title;
    document.getElementById('optFormId').value = '';
    document.getElementById('optFormType').value = type;
    document.getElementById('optFormName').value = '';
    document.getElementById('optFormSku').value = '';
    document.getElementById('projectOptionModal').classList.remove('hidden');
};

window.openEditOptionModal = function(id, type) {
    let list = [];
    if (type === 'lock') list = dbLockOptions;
    else if (type === 'hinge') list = dbHingeOptions;
    else if (type === 'profile') list = dbProfileOptions;
    else if (type === 'door_type') list = dbDoorTypeOptions;
    else if (type === 'specification') list = dbSpecOptions;

    const opt = list.find(o => o.id === id);
    if (!opt) return;

    let title = 'تعديل الخيار';
    if (type === 'lock') title = 'تعديل خيار الزرفيل';
    else if (type === 'hinge') title = 'تعديل خيار الفصالة';
    else if (type === 'profile') title = 'تعديل خيار المقطع';
    else if (type === 'door_type') title = 'تعديل خيار نوع الدرفة';
    else if (type === 'specification') title = 'تعديل خيار المواصفات';

    document.getElementById('optionModalTitle').textContent = title;
    document.getElementById('optFormId').value = id;
    document.getElementById('optFormType').value = type;
    document.getElementById('optFormName').value = opt.name;
    document.getElementById('optFormSku').value = opt.sku || '';
    document.getElementById('projectOptionModal').classList.remove('hidden');
};

window.closeProjectOptionModal = function() {
    document.getElementById('projectOptionModal').classList.add('hidden');
};

window.handleOptionFormSubmit = async function(e) {
    e.preventDefault();
    const id = document.getElementById('optFormId').value;
    const type = document.getElementById('optFormType').value;
    const name = document.getElementById('optFormName').value.trim();
    const sku = document.getElementById('optFormSku').value.trim();

    if (!name) {
        showToast('الرجاء إدخال الاسم', 'bg-rose-500', '✗');
        return;
    }

    const payload = {
        option_type: type,
        name: name,
        sku: sku || null
    };

    let url = `${API_HOST}/api/project-options/`;
    let method = 'POST';

    if (id) {
        url = `${API_HOST}/api/project-options/${id}`;
        method = 'PUT';
    }

    try {
        showToast('جار الحفظ...', 'bg-blue-500', 'ℹ');
        const response = await authFetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            showToast('تم حفظ الخيار بنجاح', 'bg-emerald-500', '✓');
            closeProjectOptionModal();
            await loadProjectOptions();
            renderProjectOptionsAdmin();
        } else {
            const data = await response.json();
            showToast(data.detail || 'حدث خطأ أثناء الحفظ', 'bg-rose-500', '✗');
        }
    } catch (err) {
        console.error(err);
        showToast('حدث خطأ أثناء حفظ الخيار', 'bg-rose-500', '✗');
    }
};

window.deleteProjectOption = async function(id) {
    if (!confirm('هل أنت متأكد من رغبتك في حذف هذا الخيار؟')) return;

    try {
        showToast('جار الحذف...', 'bg-blue-500', 'ℹ');
        const response = await authFetch(`${API_HOST}/api/project-options/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showToast('تم حذف الخيار بنجاح', 'bg-emerald-500', '✓');
            await loadProjectOptions();
            renderProjectOptionsAdmin();
        } else {
            const data = await response.json();
            showToast(data.detail || 'حدث خطأ أثناء الحذف', 'bg-rose-500', '✗');
        }
    } catch (err) {
        console.error(err);
        showToast('حدث خطأ أثناء الحذف', 'bg-rose-500', '✗');
    }
};

window.renderProjectOptionsAdmin = function() {
    const lockTbody = document.getElementById('lockOptionsTableBody');
    const hingeTbody = document.getElementById('hingeOptionsTableBody');
    const profileTbody = document.getElementById('profileOptionsTableBody');
    const doorTypeTbody = document.getElementById('doorTypeOptionsTableBody');
    const specTbody = document.getElementById('specOptionsTableBody');
    
    if (lockTbody) {
        lockTbody.innerHTML = '';
        dbLockOptions.forEach(opt => {
            const tr = document.createElement('tr');
            tr.className = 'border-b hover:bg-slate-50 transition';
            tr.innerHTML = `
                <td class="p-4 font-semibold text-slate-800">${opt.name}</td>
                <td class="p-4 text-slate-500 font-mono">${opt.sku || '---'}</td>
                <td class="p-4 text-center">
                    <div class="flex justify-center gap-2">
                        <button onclick="openEditOptionModal(${opt.id}, 'lock')" class="px-2.5 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg transition text-xs font-bold border border-indigo-100">تعديل</button>
                        <button onclick="deleteProjectOption(${opt.id})" class="px-2.5 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg transition text-xs font-bold border border-rose-100">حذف</button>
                    </div>
                </td>
            `;
            lockTbody.appendChild(tr);
        });
    }

    if (hingeTbody) {
        hingeTbody.innerHTML = '';
        dbHingeOptions.forEach(opt => {
            const tr = document.createElement('tr');
            tr.className = 'border-b hover:bg-slate-50 transition';
            tr.innerHTML = `
                <td class="p-4 font-semibold text-slate-800">${opt.name}</td>
                <td class="p-4 text-slate-500 font-mono">${opt.sku || '---'}</td>
                <td class="p-4 text-center">
                    <div class="flex justify-center gap-2">
                        <button onclick="openEditOptionModal(${opt.id}, 'hinge')" class="px-2.5 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg transition text-xs font-bold border border-indigo-100">تعديل</button>
                        <button onclick="deleteProjectOption(${opt.id})" class="px-2.5 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg transition text-xs font-bold border border-rose-100">حذف</button>
                    </div>
                </td>
            `;
            hingeTbody.appendChild(tr);
        });
    }

    if (profileTbody) {
        profileTbody.innerHTML = '';
        dbProfileOptions.forEach(opt => {
            const tr = document.createElement('tr');
            tr.className = 'border-b hover:bg-slate-50 transition';
            tr.innerHTML = `
                <td class="p-4 font-semibold text-slate-800">${opt.name}</td>
                <td class="p-4 text-center">
                    <div class="flex justify-center gap-2">
                        <button onclick="openEditOptionModal(${opt.id}, 'profile')" class="px-2.5 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg transition text-xs font-bold border border-indigo-100">تعديل</button>
                        <button onclick="deleteProjectOption(${opt.id})" class="px-2.5 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg transition text-xs font-bold border border-rose-100">حذف</button>
                    </div>
                </td>
            `;
            profileTbody.appendChild(tr);
        });
    }

    if (doorTypeTbody) {
        doorTypeTbody.innerHTML = '';
        dbDoorTypeOptions.forEach(opt => {
            const tr = document.createElement('tr');
            tr.className = 'border-b hover:bg-slate-50 transition';
            tr.innerHTML = `
                <td class="p-4 font-semibold text-slate-800">${opt.name}</td>
                <td class="p-4 text-center">
                    <div class="flex justify-center gap-2">
                        <button onclick="openEditOptionModal(${opt.id}, 'door_type')" class="px-2.5 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg transition text-xs font-bold border border-indigo-100">تعديل</button>
                        <button onclick="deleteProjectOption(${opt.id})" class="px-2.5 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg transition text-xs font-bold border border-rose-100">حذف</button>
                    </div>
                </td>
            `;
            doorTypeTbody.appendChild(tr);
        });
    }

    if (specTbody) {
        specTbody.innerHTML = '';
        dbSpecOptions.forEach(opt => {
            const tr = document.createElement('tr');
            tr.className = 'border-b hover:bg-slate-50 transition';
            tr.innerHTML = `
                <td class="p-4 font-semibold text-slate-800">${opt.name}</td>
                <td class="p-4 text-center">
                    <div class="flex justify-center gap-2">
                        <button onclick="openEditOptionModal(${opt.id}, 'specification')" class="px-2.5 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg transition text-xs font-bold border border-indigo-100">تعديل</button>
                        <button onclick="deleteProjectOption(${opt.id})" class="px-2.5 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg transition text-xs font-bold border border-rose-100">حذف</button>
                    </div>
                </td>
            `;
            specTbody.appendChild(tr);
        });
    }
};

// ------------- AUTOMATIC ARCHITRAVE 2 CALCULATION -------------

window.autoCalculateArchitrave2 = function(input) {
    const tr = input.closest('tr');
    if (!tr) return;
    const architrave2Input = tr.querySelector('input[placeholder="الكشفة 2"]') || tr.querySelectorAll('input')[7];
    if (!architrave2Input) return;
    const val = parseFloat(input.value);
    if (!isNaN(val)) {
        architrave2Input.value = (val + 2.2).toFixed(1);
    } else {
        architrave2Input.value = '';
    }
};

// ------------- SHEET SIZES MANAGEMENT -------------

window.openAddSheetSizeModal = function() {
    document.getElementById('sheetSizeModalTitle').textContent = 'إضافة قياس لوح صاج جديد';
    document.getElementById('sheetSizeFormId').value = '';
    document.getElementById('sheetSizeFormThickness').value = '1.5';
    document.getElementById('sheetSizeFormWidth').value = '';
    document.getElementById('sheetSizeFormHeight').value = '';
    document.getElementById('sheetSizeFormSku').value = '';
    document.getElementById('sheetSizeModal').classList.remove('hidden');
};

window.openEditSheetSizeModal = function(id) {
    const opt = dbSheetSizes.find(o => o.id === id);
    if (!opt) return;

    document.getElementById('sheetSizeModalTitle').textContent = 'تعديل قياس لوح صاج';
    document.getElementById('sheetSizeFormId').value = id;
    document.getElementById('sheetSizeFormThickness').value = opt.thickness;
    document.getElementById('sheetSizeFormWidth').value = opt.width;
    document.getElementById('sheetSizeFormHeight').value = opt.height;
    document.getElementById('sheetSizeFormSku').value = opt.sku || '';
    document.getElementById('sheetSizeModal').classList.remove('hidden');
};

window.closeSheetSizeModal = function() {
    document.getElementById('sheetSizeModal').classList.add('hidden');
};

window.handleSheetSizeFormSubmit = async function(e) {
    e.preventDefault();
    const id = document.getElementById('sheetSizeFormId').value;
    const thickness = parseFloat(document.getElementById('sheetSizeFormThickness').value);
    const width = parseFloat(document.getElementById('sheetSizeFormWidth').value);
    const height = parseFloat(document.getElementById('sheetSizeFormHeight').value);
    const sku = document.getElementById('sheetSizeFormSku').value.trim();

    if (isNaN(thickness) || isNaN(width) || isNaN(height)) {
        showToast('الرجاء إدخال قيم صالحة', 'bg-rose-500', '✗');
        return;
    }

    const payload = {
        thickness: thickness,
        width: width,
        height: height,
        sku: sku || null
    };

    let url = `${API_HOST}/api/sheet-sizes/`;
    let method = 'POST';

    if (id) {
        url = `${API_HOST}/api/sheet-sizes/${id}`;
        method = 'PUT';
    }

    try {
        showToast('جار الحفظ...', 'bg-blue-500', 'ℹ');
        const response = await authFetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            showToast('تم حفظ القياس بنجاح', 'bg-emerald-500', '✓');
            closeSheetSizeModal();
            await loadSheetSizes();
            renderSheetSizesAdmin();
        } else {
            const data = await response.json();
            showToast(data.detail || 'حدث خطأ أثناء الحفظ', 'bg-rose-500', '✗');
        }
    } catch (err) {
        console.error(err);
        showToast('حدث خطأ أثناء حفظ القياس', 'bg-rose-500', '✗');
    }
};

window.deleteSheetSize = async function(id) {
    if (!confirm('هل أنت متأكد من رغبتك في حذف هذا القياس؟')) return;

    try {
        showToast('جار الحذف...', 'bg-blue-500', 'ℹ');
        const response = await authFetch(`${API_HOST}/api/sheet-sizes/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showToast('تم حذف القياس بنجاح', 'bg-emerald-500', '✓');
            await loadSheetSizes();
            renderSheetSizesAdmin();
        } else {
            const data = await response.json();
            showToast(data.detail || 'حدث خطأ أثناء الحذف', 'bg-rose-500', '✗');
        }
    } catch (err) {
        console.error(err);
        showToast('حدث خطأ أثناء الحذف', 'bg-rose-500', '✗');
    }
};

window.renderSheetSizesAdmin = function() {
    const tbody = document.getElementById('sheetSizesTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';
    dbSheetSizes.forEach(opt => {
        const tr = document.createElement('tr');
        tr.className = 'border-b hover:bg-slate-50 transition';
        tr.innerHTML = `
            <td class="p-4 font-semibold text-slate-800">${opt.thickness} مم</td>
            <td class="p-4 text-slate-800">${opt.width} سم</td>
            <td class="p-4 text-slate-800">${opt.height} سم</td>
            <td class="p-4 text-slate-500 font-mono">${opt.sku || '---'}</td>
            <td class="p-4 text-center">
                <div class="flex justify-center gap-2">
                    <button onclick="openEditSheetSizeModal(${opt.id})" class="px-2.5 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg transition text-xs font-bold border border-indigo-100">تعديل</button>
                    <button onclick="deleteSheetSize(${opt.id})" class="px-2.5 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg transition text-xs font-bold border border-rose-100">حذف</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
};

// ------------- RESERVATION SYSTEM -------------
window.currentReservationCategory = null;
window.currentReservationCheckedData = null;

window.closeReservationWarningModal = function() {
    document.getElementById('reservationWarningModal').classList.add('hidden');
    const cancelBtn = document.querySelector('#reservationWarningModal button[onclick="closeReservationWarningModal()"]');
    if (cancelBtn) {
        cancelBtn.textContent = 'إلغاء';
    }
};

window.closeReservationConfirmModal = function() {
    document.getElementById('reservationConfirmModal').classList.add('hidden');
};

window.reserveProjectSheets = function() {
    startReservation('sheets');
};

window.reserveProjectAccessories = function() {
    openAccessoryChoiceModal();
};

window.openAccessoryChoiceModal = function() {
    document.getElementById('accessoryChoiceModal').classList.remove('hidden');
};

window.closeAccessoryChoiceModal = function() {
    document.getElementById('accessoryChoiceModal').classList.add('hidden');
};

window.reserveProjectLocks = function() {
    closeAccessoryChoiceModal();
    startReservation('locks');
};

window.reserveProjectHinges = function() {
    closeAccessoryChoiceModal();
    startReservation('hinges');
};

async function startReservation(category) {
    if (!window.currentProjectData) return;
    window.currentReservationCategory = category;
    
    showToast('جاري التحقق من المخزون...', 'bg-indigo-500', 'ℹ');
    
    try {
        const response = await authFetch(`${PROJECTS_URL}/${window.currentProjectData.id}/reserve-check?category=${category}`);
        if (!response.ok) throw new Error('فشل التحقق من المواد');
        
        const data = await response.json();
        window.currentReservationCheckedData = data;
        
        if (data.already_reserved) {
            showAlreadyReservedWarning(category);
            return;
        }
        
        if (data.has_issues) {
            // Display warning modal
            showReservationWarning(data.items);
        } else {
            // Confirm direct reservation via custom confirm modal
            showReservationConfirm(category);
        }
    } catch (e) {
        showToast(e.message, 'bg-rose-500', '✗');
    }
}

function showReservationConfirm(category) {
    let text = 'حجز الأكسسوارات';
    if (category === 'sheets') text = 'حجز ألواح الصاج';
    else if (category === 'locks') text = 'حجز الزرافيل';
    else if (category === 'hinges') text = 'حجز الفصالات';
    
    // Set text dynamically
    document.getElementById('resConfirmTitle').textContent = `تأكيد ${text}`;
    document.getElementById('resConfirmMessage').textContent = `هل أنت متأكد من حجز كامل كميات ${text} المطلوبة للمشروع من المستودع؟`;
    
    // Get header and confirm button elements to color them dynamically
    const header = document.querySelector('#reservationConfirmModal .bg-emerald-600') || 
                   document.querySelector('#reservationConfirmModal .bg-indigo-600');
    const btn = document.getElementById('btnResConfirmYes');
    
    if (category === 'sheets') {
        if (header) {
            header.className = 'bg-emerald-600 text-white p-5 flex justify-between items-center rounded-t-2xl';
        }
        if (btn) {
            btn.className = 'flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl transition shadow flex items-center justify-center gap-2';
        }
    } else {
        if (header) {
            header.className = 'bg-indigo-600 text-white p-5 flex justify-between items-center rounded-t-2xl';
        }
        if (btn) {
            btn.className = 'flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl transition shadow flex items-center justify-center gap-2';
        }
    }
    
    btn.onclick = async () => {
        closeReservationConfirmModal();
        await commitReservation();
    };
    
    document.getElementById('reservationConfirmModal').classList.remove('hidden');
}

function showAlreadyReservedWarning(category) {
    const tbody = document.getElementById('resWarningTableBody');
    let catText = 'الأكسسوارات';
    if (category === 'sheets') catText = 'ألواح الصاج';
    else if (category === 'locks') catText = 'الزرافيل';
    else if (category === 'hinges') catText = 'الفصالات';
    
    tbody.innerHTML = `
        <tr>
            <td colspan="6" class="py-8 text-center text-rose-600 font-bold text-base">
                لقد تم حجز ${catText} المطلوبة لهذا المشروع مسبقاً!
                <br>
                <span class="text-sm text-slate-500 font-normal mt-2 block">
                    لتجنب تكرار الحجز وتضارب الكميات في المخازن، لا يمكن إجراء الحجز أكثر من مرة لنفس المشروع.
                </span>
            </td>
        </tr>
    `;
    
    // Hide standard description paragraph
    const warningDesc = document.querySelector('#reservationWarningModal p');
    if (warningDesc) {
        warningDesc.classList.add('hidden');
    }
    
    // Hide reservation actions
    document.getElementById('btnResCreatePurchase').classList.add('hidden');
    document.getElementById('btnResSkip').classList.add('hidden');
    
    // Change cancel button text to 'موافق' (OK)
    const cancelBtn = document.querySelector('#reservationWarningModal button[onclick="closeReservationWarningModal()"]');
    if (cancelBtn) {
        cancelBtn.textContent = 'موافق';
    }
    
    document.getElementById('reservationWarningModal').classList.remove('hidden');
}

function showReservationWarning(items) {
    const tbody = document.getElementById('resWarningTableBody');
    tbody.innerHTML = '';
    
    // Make sure warning text description is restored
    const warningDesc = document.querySelector('#reservationWarningModal p');
    if (warningDesc) {
        warningDesc.classList.remove('hidden');
    }
    
    // Restore buttons
    document.getElementById('btnResCreatePurchase').classList.remove('hidden');
    document.getElementById('btnResSkip').classList.remove('hidden');
    
    // Restore cancel button text
    const cancelBtn = document.querySelector('#reservationWarningModal button[onclick="closeReservationWarningModal()"]');
    if (cancelBtn) {
        cancelBtn.textContent = 'إلغاء';
    }
    
    items.forEach(item => {
        let statusText = '';
        let statusClass = '';
        
        if (item.status === 'OK') {
            statusText = 'متوفر بالكامل';
            statusClass = 'text-emerald-600 font-semibold';
        } else if (item.status === 'NO_SKU') {
            statusText = 'رمز SKU غير مربوط بالبند';
            statusClass = 'text-rose-600 font-semibold';
        } else if (item.status === 'NO_ITEM') {
            statusText = 'البند غير موجود بالمخزن';
            statusClass = 'text-rose-600 font-semibold';
        } else if (item.status === 'INSUFFICIENT_STOCK') {
            statusText = 'عجز في الكمية';
            statusClass = 'text-amber-600 font-semibold';
        }
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="py-2 px-3">${item.name}</td>
            <td class="py-2 px-3">${item.sku || '-'}</td>
            <td class="py-2 px-3 font-bold">${item.required}</td>
            <td class="py-2 px-3">${item.available}</td>
            <td class="py-2 px-3 text-rose-600 font-bold">${item.missing}</td>
            <td class="py-2 px-3 ${statusClass}">${statusText}</td>
        `;
        tbody.appendChild(tr);
    });
    
    // Wire up buttons
    document.getElementById('btnResSkip').onclick = async () => {
        await commitReservation();
        closeReservationWarningModal();
    };
    
    document.getElementById('btnResCreatePurchase').onclick = async () => {
        // 1. Commit available reservations first
        await commitReservation(true);
        closeReservationWarningModal();
        
        // 2. Open prefilled Purchase Request Modal
        openPrefilledPurchaseRequest();
    };
    
    document.getElementById('reservationWarningModal').classList.remove('hidden');
}

async function commitReservation(silent = false) {
    if (!window.currentProjectData || !window.currentReservationCategory) return;
    
    try {
        const response = await authFetch(`${PROJECTS_URL}/${window.currentProjectData.id}/reserve-commit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category: window.currentReservationCategory })
        });
        
        if (!response.ok) throw new Error('فشل تسجيل الحجز');
        
        const result = await response.json();
        
        if (!silent) {
            let msg = `تم الحجز بنجاح: تم حجز ${result.reserved.length} بند.`;
            if (result.skipped.length > 0) {
                msg += ` وتخطي ${result.skipped.length} بند ناقص.`;
            }
            showToast(msg, 'bg-emerald-500', '✓');
        }
    } catch (e) {
        if (!silent) {
            showToast(e.message, 'bg-rose-500', '✗');
        }
    }
}

function openPrefilledPurchaseRequest() {
    if (!window.currentProjectData || !window.currentReservationCheckedData) return;
    
    const project = window.currentProjectData;
    const checked = window.currentReservationCheckedData;
    
    // Find missing items
    const missingItems = checked.items.filter(i => i.status !== 'OK');
    if (missingItems.length === 0) return;
    
    // Prepare title
    const title = `طلب شراء مواد ناقصة لمشروع ${project.name} - ${project.project_number}`;
    
    // Prepare description
    let description = `المواد الناقصة للمشروع:\n`;
    description += `اسم المشروع: ${project.name}\n`;
    description += `رقم المشروع: ${project.project_number}\n\n`;
    description += `البنود المطلوب تأمينها:\n`;
    
    missingItems.forEach((item, idx) => {
        description += `${idx + 1}. ${item.name} (SKU: ${item.sku || 'غير معرف'}) - الكمية الناقصة: ${item.missing}\n`;
    });
    
    // Prefill quantity
    let quantity = '';
    if (missingItems.length === 1) {
        quantity = missingItems[0].missing;
    }
    
    // Open modal with prefilled data
    document.getElementById('purchaseRequestForm').reset();
    currentEditingPurchaseRequestId = null;
    document.getElementById('prCustomIdContainer').classList.remove('hidden');
    document.getElementById('purchaseRequestModalTitle').innerText = 'إنشاء طلب شراء جديد (من حجز المواد)';
    
    document.getElementById('prTitle').value = title;
    document.getElementById('prQuantity').value = quantity;
    document.getElementById('prDescription').value = description;
    
    document.getElementById('purchaseRequestModal').classList.remove('hidden');
}

// ================= ALL PROJECTS TRACKING DASHBOARD =================
window.openAllProjectsTrackingModal = async function() {
    const modal = document.getElementById('allProjectsTrackingModal');
    const tbody = document.getElementById('allProjectsTrackingTableBody');
    
    tbody.innerHTML = '<tr><td colspan="8" class="p-8 text-center text-slate-500">جاري تحميل المشاريع النشطة...</td></tr>';
    modal.classList.remove('hidden');
    
    try {
        const response = await authFetch(PROJECTS_URL + '/');
        if (!response.ok) throw new Error('فشل تحميل المشاريع');
        
        const projects = await response.json();
        const activeProjects = projects.filter(p => p.status === 'active');
        
        tbody.innerHTML = '';
        if (activeProjects.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="p-8 text-center text-slate-500">لا يوجد مشاريع نشطة حالياً.</td></tr>';
            return;
        }
        
        const steps = [
            'step_design',
            'step_cutting',
            'step_forming',
            'step_assembly',
            'step_painting',
            'step_accessories',
            'step_installation'
        ];
        
        activeProjects.forEach(p => {
            const tr = document.createElement('tr');
            tr.className = 'border-b hover:bg-slate-50 transition';
            
            // Build the name cell with sticky right for scrollability
            let nameCell = `<td class="p-3 font-bold sticky right-0 bg-white shadow-sm border-l border-slate-100 z-10 text-slate-800">${p.name || '-'} <span class="text-slate-400 text-xs font-normal">(${p.project_number})</span></td>`;
            
            // Build the step select cells
            let stepsCells = '';
            steps.forEach(stepKey => {
                const currentValue = p[stepKey] || 'لم يتم البدء';
                stepsCells += `
                    <td class="p-3 text-center min-w-[140px]">
                        <select onchange="updateTrackingStep('${stepKey}', this, ${p.id})" class="w-full border rounded-lg px-2 py-1.5 text-xs font-bold focus:outline-none focus:ring-2 transition-colors ${getStepColorClasses(currentValue)}">
                            <option value="لم يتم البدء" ${currentValue === 'لم يتم البدء' ? 'selected' : ''}>لم يتم البدء</option>
                            <option value="جاري العمل" ${currentValue === 'جاري العمل' ? 'selected' : ''}>جاري العمل</option>
                            <option value="تم الانتهاء" ${currentValue === 'تم الانتهاء' ? 'selected' : ''}>تم الانتهاء</option>
                        </select>
                    </td>
                `;
            });
            
            tr.innerHTML = nameCell + stepsCells;
            tbody.appendChild(tr);
        });
        
    } catch (e) {
        showToast(e.message, 'bg-rose-500', '✗');
        tbody.innerHTML = '<tr><td colspan="8" class="p-8 text-center text-rose-500">حدث خطأ أثناء تحميل البيانات.</td></tr>';
    }
};

window.closeAllProjectsTrackingModal = function() {
    document.getElementById('allProjectsTrackingModal').classList.add('hidden');
};

// ================= FIRE DOORS MODAL LOGIC =================
let globalFireDoors = [];

window.openFireDoorsModal = async function() {
    const modal = document.getElementById('fireDoorsModal');
    const tbody = document.getElementById('fireDoorsTableBody');
    const emptyEl = document.getElementById('fireDoorsEmpty');
    const loadingEl = document.getElementById('fireDoorsLoading');
    
    tbody.innerHTML = '';
    emptyEl.classList.add('hidden');
    loadingEl.classList.remove('hidden');
    
    modal.classList.remove('hidden');
    void modal.offsetWidth;
    modal.classList.remove('opacity-0');
    modal.querySelector('.transform').classList.remove('scale-95');
    
    try {
        const response = await authFetch(`${API_HOST}/api/fire-doors/`);
        if (!response.ok) throw new Error('فشل تحميل أبواب الحريق');
        
        globalFireDoors = await response.json();
        loadingEl.classList.add('hidden');
        
        if (globalFireDoors.length === 0) {
            emptyEl.classList.remove('hidden');
            return;
        }
        
        globalFireDoors.forEach(d => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-slate-50 transition border-b border-slate-100';
            tr.innerHTML = `
                <td class="p-3 text-slate-800 font-bold">${d.project_name}</td>
                <td class="p-3 text-slate-500 font-bold">${d.project_number}</td>
                <td class="p-3 text-slate-700">${d.door_number}</td>
                <td class="p-3">
                    <input type="text" value="${d.sticker_number || ''}" onchange="updateStickerNumber(${d.id}, ${d.index}, this)" class="w-full px-3 py-1.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none transition" placeholder="أدخل رقم الملصق..." />
                </td>
                <td class="p-3 text-center">
                    <button onclick="saveSingleStickerNumber(${d.id}, ${d.index}, this)" class="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-3 py-1.5 rounded-xl transition text-xs font-bold flex items-center gap-1 mx-auto">
                        💾 حفظ
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
        
    } catch (e) {
        showToast(e.message, 'bg-rose-500', '✗');
        loadingEl.classList.add('hidden');
        tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-rose-500 font-bold">${e.message}</td></tr>`;
    }
};

window.closeFireDoorsModal = function() {
    const modal = document.getElementById('fireDoorsModal');
    modal.classList.add('opacity-0');
    modal.querySelector('.transform').classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
};

window.updateStickerNumber = async function(detailId, index, inputEl) {
    const val = inputEl.value;
    try {
        const response = await authFetch(`${API_HOST}/api/projects/details/${detailId}/sticker`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ index: index, sticker_number: val })
        });
        if (!response.ok) throw new Error('فشل تحديث رقم الملصق');
        showToast('تم تحديث رقم الملصق تلقائياً', 'bg-emerald-500', '✓');
    } catch (e) {
        showToast(e.message, 'bg-rose-500', '✗');
    }
};

window.saveSingleStickerNumber = async function(detailId, index, btnEl) {
    const inputEl = btnEl.closest('tr').querySelector('input');
    const val = inputEl.value;
    try {
        const response = await authFetch(`${API_HOST}/api/projects/details/${detailId}/sticker`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ index: index, sticker_number: val })
        });
        if (!response.ok) throw new Error('فشل حفظ رقم الملصق');
        showToast('تم حفظ رقم الملصق بنجاح', 'bg-emerald-500', '✓');
    } catch (e) {
        showToast(e.message, 'bg-rose-500', '✗');
    }
};

window.exportFireDoorsToExcel = function() {
    if (globalFireDoors.length === 0) {
        showToast('لا يوجد بيانات لتصديرها', 'bg-amber-500', '⚠');
        return;
    }
    
    // Create CSV content representing Excel sheet
    let csvContent = "\ufeff"; // BOM for UTF-8 compatibility in Excel
    csvContent += "اسم المشروع,رقم المشروع,رقم الباب,رقم الملصق\n";
    
    globalFireDoors.forEach(d => {
        const row = [
            `"${d.project_name.replace(/"/g, '""')}"`,
            `"${String(d.project_number).replace(/"/g, '""')}"`,
            `"${d.door_number.replace(/"/g, '""')}"`,
            `"${(d.sticker_number || '').replace(/"/g, '""')}"`
        ];
        csvContent += row.join(",") + "\n";
    });
    
    // Create download link and trigger click
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `أبواب_الحريق_${new Date().toLocaleDateString('ar-SA').replace(/\//g, '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('تم تصدير ملف أبواب الحريق بنجاح', 'bg-emerald-500', '✓');
};

window.proceedFromStep2 = function() {
    if (ignoreFireDoorValidation) {
        goToWizardStep(3);
        return;
    }

    const rows = document.querySelectorAll('#projectDetailsTableBody tr');
    let errors = [];

    rows.forEach(tr => {
        const inputs = tr.querySelectorAll('input, select');
        if (inputs.length < 21) return; // safety check

        const doorNum = inputs[0].value || 'بدون رقم';
        const isFireResistant = inputs[14].checked;

        if (isFireResistant) {
            const width = parseFloat(inputs[2].value);
            const height = parseFloat(inputs[3].value);
            const depth = parseFloat(inputs[4].value);
            const profile = inputs[9].value;

            let doorErrors = [];

            // 1. Width <= 140
            if (isNaN(width) || width > 140) {
                doorErrors.push("العرض يجب ألا يزيد عن 140 سم");
            }
            // 2. Height <= 280
            if (isNaN(height) || height > 280) {
                doorErrors.push("الطول يجب ألا يزيد عن 280 سم");
            }
            // 3. Depth and Profile validation
            if (profile === "single rabbit with rubber") {
                if (isNaN(depth) || depth !== 15) {
                    doorErrors.push("العمق يجب أن يكون 15 سم");
                }
            } else if (profile === "double rabbit with rubber") {
                if (isNaN(depth) || depth < 15 || depth > 33) {
                    doorErrors.push("العمق يجب ألا يقل عن 15 سم وألا يزيد عن 33 سم");
                }
            } else {
                doorErrors.push("المقطع المختار غير مطابق (يجب اختيار single rabbit with rubber أو Double rabbit with rubber)");
            }

            if (doorErrors.length > 0) {
                errors.push(`الباب رقم (${doorNum}): ${doorErrors.join('، ')}`);
            }
        }
    });

    if (errors.length > 0) {
        const errorsContainer = document.getElementById('fireDoorValidationErrors');
        if (errorsContainer) {
            errorsContainer.innerHTML = errors.map(err => `<div class="p-2 bg-rose-50 text-rose-800 border-r-4 border-rose-500 rounded-l-md font-bold mb-1">${err}</div>`).join('');
        }
        const modal = document.getElementById('fireDoorValidationModal');
        if (modal) {
            modal.classList.remove('hidden');
        }
        return;
    }

    goToWizardStep(3);
};

window.closeFireDoorValidationModal = function() {
    const modal = document.getElementById('fireDoorValidationModal');
    if (modal) {
        modal.classList.add('hidden');
    }
};

window.bypassFireDoorValidation = function() {
    ignoreFireDoorValidation = true;
    closeFireDoorValidationModal();
    goToWizardStep(3);
};

window.exportManufacturingTableToExcel = function() {
    if (!window.currentProjectData) {
        showToast('لا يوجد بيانات للمشروع', 'bg-amber-500', '⚠');
        return;
    }
    
    // Load xlsx-js-style dynamically if not loaded or if standard unstyled XLSX is present
    if (typeof XLSX === 'undefined' || !XLSX.style) {
        const script = document.createElement('script');
        script.src = "https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js";
        script.onload = () => doExportManufacturing(window.currentProjectData);
        document.head.appendChild(script);
    } else {
        doExportManufacturing(window.currentProjectData);
    }
};

function doExportManufacturing(project) {
    const wb = XLSX.utils.book_new();
    const data = [];
    
    // Row 1 (Index 0): Empty spacer
    data.push([]);
    
    const formatDate = (dStr) => {
        if (!dStr) return "-";
        const d = new Date(dStr);
        if (isNaN(d.getTime())) return dStr;
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}/${mm}/${dd}`;
    };
    
    const pNumber = project.project_number || "-";
    const execMgr = project.executive_manager_name || project.executive_manager_username || "-";
    const pName = project.name || "-";
    const engName = project.engineer_name || "-";
    const recvDate = formatDate(project.created_at || project.receipt_date);
    const delivDate = formatDate(project.delivery_date);
    const pLoc = project.location || "-";
    const contractor = project.contractor_name || "-";
    
    // Rows 2-6 (Indices 1-5): Built strictly per user specifications
    // Row 2 (Index 1 - Excel Row 2)
    // A2:B2 -> "تاريخ الاستلام", C2:E2 -> recvDate, G2:H3 -> "اسم المشروع", I2:K3 -> pName, M2:T5 -> "Production Order"
    const row2 = Array(27).fill("");
    row2[0] = "تاريخ الاستلام"; // A2
    row2[2] = recvDate; // C2
    row2[6] = "اسم المشروع"; // G2
    row2[8] = pName; // I2
    row2[12] = "Production Order"; // M2
    data.push(row2);
    
    // Row 3 (Index 2 - Excel Row 3)
    // A3:B3 -> "تاريخ التسليم", C3:E3 -> delivDate
    const row3 = Array(27).fill("");
    row3[0] = "تاريخ التسليم"; // A3
    row3[2] = delivDate; // C3
    data.push(row3);
    
    // Row 4 (Index 3 - Excel Row 4)
    data.push(Array(27).fill(""));
    
    // Row 5 (Index 4 - Excel Row 5)
    // A5:B5 -> "الموقع", C5:E5 -> pLoc, G5:H5 -> "رقم المشروع", I5:K5 -> pNumber
    const row5 = Array(27).fill("");
    row5[0] = "الموقع"; // A5
    row5[2] = pLoc; // C5
    row5[6] = "رقم المشروع"; // G5
    row5[8] = pNumber; // I5
    data.push(row5);
    
    // Row 6 (Index 5 - Excel Row 6)
    // A6:B6 -> "مسؤول الموقع", C6:E6 -> contractor, G6:H6 -> "مسؤول التنفيذ", I6:K6 -> execMgr
    const row6 = Array(27).fill("");
    row6[0] = "مسؤول الموقع"; // A6
    row6[2] = contractor; // C6
    row6[6] = "مسؤول التنفيذ"; // G6
    row6[8] = execMgr; // I6
    data.push(row6);
    
    // Row 7 & 8 (Indices 6 & 7): Empty spacers
    data.push(Array(27).fill(""));
    data.push(Array(27).fill(""));
    
    // Row 9 (Index 8 - Excel Row 9): Group Headers
    data.push([
        "", "",
        "قياس الحلق", "", "", "", "", "", "", "", "", "",
        "قياس الدرفة", "", "", "", "", "", "", "",
        "", "", "", "", "", "", ""
    ]);
    
    // Row 10 (Index 9 - Excel Row 10): Sub Headers
    data.push([
        "الرقم", 
        "العدد", 
        "الاتجاه", "العرض", "الارتفاع", "الخمالة", "السماكة", "تحت الأرض", "شكل المقطع", "نوع المقطع", "كاوتشوك", "عرض الكشفة",
        "الاتجاه", "العرض", "الارتفاع", "الخمالة", "السماكة", "المواصفات", "النوع", "العدد",
        "FR/NFR", "نوع الزرافيل", "نوع الحديد", "الفصالات", "البروفيل", "اللون", "ملاحظات"
    ]);
    
    let totalQty = 0;
    
    // Rows 9+ (Index 8+): Data Rows
    if (project.details && project.details.length > 0) {
        project.details.forEach((d, index) => {
            const qty = parseInt(d.quantity) || 1;
            totalQty += qty;
            
            const frameWidth = parseFloat(d.width) || 0;
            const frameHeight = parseFloat(d.height) || 0;
            const dir = d.direction || "";
            const isDouble = dir.toUpperCase().includes("D/RA") || dir.includes("دبل") || dir.toUpperCase().includes("DOUBLE");
            
            let leafWidth = "";
            if (frameWidth > 0) {
                leafWidth = isDouble ? ((frameWidth - 11.5) / 2).toFixed(1) : (frameWidth - 10.8).toFixed(1);
            }
            let leafHeight = frameHeight > 0 ? (frameHeight - 6).toFixed(1) : "";
            
            const isFire = d.fire_resistance && (d.fire_resistance.toUpperCase().startsWith("Y") || d.fire_resistance.startsWith("نعم"));
            const frLabel = isFire ? "FR" : "NFR";
            
            const hasRubber = d.profile_type && (d.profile_type.toLowerCase().includes("rubber") || d.profile_type.includes("كاوتشوك")) ? "كاوتشوك" : "كاوتشوك";
            
            let leafDir = dir;
            if (dir.toUpperCase().includes("D/RA")) {
                leafDir = "RH";
            }
            
            data.push([
                d.door_number || `A207-${index+1}`,
                qty,
                dir || "RH",
                frameWidth || "-",
                frameHeight || "-",
                d.depth || "15",
                "1.5",
                d.under_tile || "0",
                "Single",
                "ستاندر",
                hasRubber,
                d.architrave || "5",
                leafDir || "RH",
                leafWidth || "-",
                leafHeight || "-",
                "4.5",
                "1.2",
                d.specifications || "FLUSH",
                d.door_type || "METAL",
                qty,
                frLabel,
                d.lock_type || "Mortice",
                "Galv",
                d.hinges || "Vantage",
                d.profile_type || "Vantage",
                project.paint_color || "7024",
                d.notes || ""
            ]);
        });
    }
    
    // Total Row
    const dataEndRow = 10 + (project.details ? project.details.length : 0);
    const totalRow = Array(27).fill("");
    totalRow[1] = totalQty;
    totalRow[19] = totalQty;
    data.push(totalRow);
    
    // Spacer & Footer rows
    data.push([]);
    data.push(Array(27).fill(""));
    data.push(Array(27).fill(""));
    
    const ws = XLSX.utils.aoa_to_sheet(data);
    
    // Right To Left View
    ws['!views'] = [{ RTL: true }];
    
    // Merges strictly defined as instructed by user:
    ws['!merges'] = [
        // A2:B2 (Row 1, Cols 0-1) - تاريخ الاستلام Label
        { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } },
        // C2:E2 (Row 1, Cols 2-4) - تاريخ الاستلام Value
        { s: { r: 1, c: 2 }, e: { r: 1, c: 4 } },
        
        // A3:B3 (Row 2, Cols 0-1) - تاريخ التسليم Label
        { s: { r: 2, c: 0 }, e: { r: 2, c: 1 } },
        // C3:E3 (Row 2, Cols 2-4) - تاريخ التسليم Value
        { s: { r: 2, c: 2 }, e: { r: 2, c: 4 } },
        
        // A5:B5 (Row 4, Cols 0-1) - الموقع Label
        { s: { r: 4, c: 0 }, e: { r: 4, c: 1 } },
        // C5:E5 (Row 4, Cols 2-4) - الموقع Value
        { s: { r: 4, c: 2 }, e: { r: 4, c: 4 } },
        
        // A6:B6 (Row 5, Cols 0-1) - مسؤول الموقع Label
        { s: { r: 5, c: 0 }, e: { r: 5, c: 1 } },
        // C6:E6 (Row 5, Cols 2-4) - مسؤول الموقع Value
        { s: { r: 5, c: 2 }, e: { r: 5, c: 4 } },
        
        // G2:H3 (Rows 1-2, Cols 6-7) - اسم المشروع Label
        { s: { r: 1, c: 6 }, e: { r: 2, c: 7 } },
        // I2:K3 (Rows 1-2, Cols 8-10) - اسم المشروع Value
        { s: { r: 1, c: 8 }, e: { r: 2, c: 10 } },
        
        // G5:H5 (Row 4, Cols 6-7) - رقم المشروع Label
        { s: { r: 4, c: 6 }, e: { r: 4, c: 7 } },
        // I5:K5 (Row 4, Cols 8-10) - رقم المشروع Value
        { s: { r: 4, c: 8 }, e: { r: 4, c: 10 } },
        
        // G6:H6 (Row 5, Cols 6-7) - مسؤول التنفيذ Label
        { s: { r: 5, c: 6 }, e: { r: 5, c: 7 } },
        // I6:K6 (Row 5, Cols 8-10) - مسؤول التنفيذ Value
        { s: { r: 5, c: 8 }, e: { r: 5, c: 10 } },
        
        // M2:T5 (Rows 1-4, Cols 12-19) - Production Order Title (Size 20 Bold)
        { s: { r: 1, c: 12 }, e: { r: 4, c: 19 } },
        
        // Group Headers Row 9 (Index 8)
        { s: { r: 8, c: 2 }, e: { r: 8, c: 11 } }, // قياس الحلق (C to L)
        { s: { r: 8, c: 12 }, e: { r: 8, c: 19 } }  // قياس الدرفة (M to T)
    ];
    
    // Add Footer merges below table
    const fRow1 = dataEndRow + 2;
    const fRow2 = dataEndRow + 3;
    ws['!merges'].push(
        { s: { r: fRow1, c: 17 }, e: { r: fRow1, c: 19 } }, // Value Box 1
        { s: { r: fRow1, c: 20 }, e: { r: fRow1, c: 25 } }, // Label Box 1
        { s: { r: fRow2, c: 17 }, e: { r: fRow2, c: 19 } }, // Value Box 2
        { s: { r: fRow2, c: 20 }, e: { r: fRow2, c: 25 } }  // Label Box 2
    );
    
    // Set values for footer boxes
    const fCellVal1 = XLSX.utils.encode_cell({ r: fRow1, c: 17 });
    const fCellLbl1 = XLSX.utils.encode_cell({ r: fRow1, c: 20 });
    const fCellVal2 = XLSX.utils.encode_cell({ r: fRow2, c: 17 });
    const fCellLbl2 = XLSX.utils.encode_cell({ r: fRow2, c: 20 });
    
    ws[fCellVal1] = { t: 'n', v: 4 };
    ws[fCellLbl1] = { t: 's', v: "عدد الفصالات بالدرفة :" };
    ws[fCellVal2] = { t: 's', v: "" };
    ws[fCellLbl2] = { t: 's', v: "ملاحظات خاصة:" };
    
    // STYLES DEFINITION
    const borderThin = {
        top: { style: "thin", color: { rgb: "000000" } },
        bottom: { style: "thin", color: { rgb: "000000" } },
        left: { style: "thin", color: { rgb: "000000" } },
        right: { style: "thin", color: { rgb: "000000" } }
    };
    const borderThick = {
        top: { style: "medium", color: { rgb: "000000" } },
        bottom: { style: "medium", color: { rgb: "000000" } },
        left: { style: "medium", color: { rgb: "000000" } },
        right: { style: "medium", color: { rgb: "000000" } }
    };
    
    const styleLogo = {
        font: { name: "Calibri", sz: 10, bold: true, color: { rgb: "333333" } },
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
        border: borderThick
    };
    const styleTitle = {
        font: { name: "Calibri", sz: 18, bold: true, color: { rgb: "000000" } },
        alignment: { horizontal: "center", vertical: "center" },
        border: borderThick
    };
    const styleInfoLabel = {
        font: { name: "Calibri", sz: 10, bold: true, color: { rgb: "000000" } },
        alignment: { horizontal: "center", vertical: "center" },
        border: borderThin
    };
    const styleInfoVal = {
        font: { name: "Calibri", sz: 10, color: { rgb: "000000" } },
        alignment: { horizontal: "center", vertical: "center" },
        border: borderThin
    };
    
    const styleGroupHeader = {
        fill: { fgColor: { rgb: "FFC000" } }, // Gold/Orange
        font: { name: "Calibri", sz: 12, bold: true, color: { rgb: "000000" } },
        alignment: { horizontal: "center", vertical: "center" },
        border: borderThin
    };
    const styleSubHeader = {
        fill: { fgColor: { rgb: "FFFF00" } }, // Yellow
        font: { name: "Calibri", sz: 10, bold: true, color: { rgb: "000000" } },
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
        border: borderThin
    };
    
    const styleCellNormal = {
        font: { name: "Calibri", sz: 10, color: { rgb: "000000" } },
        alignment: { horizontal: "center", vertical: "center" },
        border: borderThin
    };
    const styleCellBold = {
        font: { name: "Calibri", sz: 10, bold: true, color: { rgb: "000000" } },
        alignment: { horizontal: "center", vertical: "center" },
        border: borderThin
    };
    const styleCellRed = {
        font: { name: "Calibri", sz: 10, bold: true, color: { rgb: "C00000" } },
        alignment: { horizontal: "center", vertical: "center" },
        border: borderThin
    };
    
    const styleTotalBox = {
        font: { name: "Calibri", sz: 11, bold: true, color: { rgb: "C00000" } },
        alignment: { horizontal: "center", vertical: "center" },
        border: borderThick
    };
    const styleFooterLabel = {
        fill: { fgColor: { rgb: "FFFF00" } },
        font: { name: "Calibri", sz: 10, bold: true, color: { rgb: "000000" } },
        alignment: { horizontal: "center", vertical: "center" },
        border: borderThin
    };
    const styleFooterVal = {
        fill: { fgColor: { rgb: "B4C6E7" } },
        font: { name: "Calibri", sz: 10, bold: true, color: { rgb: "000000" } },
        alignment: { horizontal: "center", vertical: "center" },
        border: borderThin
    };

    // Helper to apply style to a rectangular range
    function styleRange(startRow, endRow, startCol, endCol, style) {
        for (let r = startRow; r <= endRow; r++) {
            for (let c = startCol; c <= endCol; c++) {
                const ref = XLSX.utils.encode_cell({ r, c });
                if (!ws[ref]) ws[ref] = { t: 's', v: '' };
                ws[ref].s = style;
            }
        }
    }

    const styleTitle20 = {
        font: { name: "Calibri", sz: 20, bold: true, color: { rgb: "000000" } },
        alignment: { horizontal: "center", vertical: "center" },
        border: borderThick
    };

    // Apply styles to Top Block per user layout instructions:
    styleRange(1, 1, 0, 1, styleInfoLabel);   // A2:B2 -> "تاريخ الاستلام"
    styleRange(1, 1, 2, 4, styleInfoVal);     // C2:E2 -> recvDate
    styleRange(2, 2, 0, 1, styleInfoLabel);   // A3:B3 -> "تاريخ التسليم"
    styleRange(2, 2, 2, 4, styleInfoVal);     // C3:E3 -> delivDate
    styleRange(4, 4, 0, 1, styleInfoLabel);   // A5:B5 -> "الموقع"
    styleRange(4, 4, 2, 4, styleInfoVal);     // C5:E5 -> pLoc
    styleRange(5, 5, 0, 1, styleInfoLabel);   // A6:B6 -> "مسؤول الموقع"
    styleRange(5, 5, 2, 4, styleInfoVal);     // C6:E6 -> contractor
    
    styleRange(1, 2, 6, 7, styleInfoLabel);   // G2:H3 -> "اسم المشروع"
    styleRange(1, 2, 8, 10, styleInfoVal);    // I2:K3 -> pName
    styleRange(4, 4, 6, 7, styleInfoLabel);   // G5:H5 -> "رقم المشروع"
    styleRange(4, 4, 8, 10, styleInfoVal);    // I5:K5 -> pNumber
    styleRange(5, 5, 6, 7, styleInfoLabel);   // G6:H6 -> "مسؤول التنفيذ"
    styleRange(5, 5, 8, 10, styleInfoVal);    // I6:K6 -> execMgr
    
    styleRange(1, 4, 12, 19, styleTitle20);   // M2:T5 -> "Production Order" (Size 20 Bold)
    
    // 5. Row 9 Group Headers (Row index 8)
    for (let c = 0; c <= 26; c++) {
        const ref = XLSX.utils.encode_cell({ r: 8, c });
        if (!ws[ref]) ws[ref] = { t: 's', v: '' };
        if (c >= 2 && c <= 19) {
            ws[ref].s = styleGroupHeader;
        } else {
            ws[ref].s = styleSubHeader;
        }
    }
    
    // 6. Row 10 Sub Headers (Row index 9)
    for (let c = 0; c <= 26; c++) {
        const ref = XLSX.utils.encode_cell({ r: 9, c });
        if (!ws[ref]) ws[ref] = { t: 's', v: '' };
        ws[ref].s = styleSubHeader;
    }
    
    // 7. Data Rows (Row index 10 to dataEndRow - 1)
    for (let r = 10; r < dataEndRow; r++) {
        for (let c = 0; c <= 26; c++) {
            const ref = XLSX.utils.encode_cell({ r, c });
            if (!ws[ref]) ws[ref] = { t: 's', v: '' };
            
            if (c === 11 || c === 15) {
                ws[ref].s = styleCellRed;
            } else if (c === 26 && ws[ref].v && ws[ref].v !== "") {
                ws[ref].s = styleCellRed;
            } else if (c === 0 || c === 13) {
                ws[ref].s = styleCellBold;
            } else {
                ws[ref].s = styleCellNormal;
            }
        }
    }
    
    // 8. Total Row (Row index dataEndRow)
    for (let c = 0; c <= 26; c++) {
        const ref = XLSX.utils.encode_cell({ r: dataEndRow, c });
        if (!ws[ref]) ws[ref] = { t: 's', v: '' };
        if (c === 1 || c === 19) {
            ws[ref].s = styleTotalBox;
        } else {
            ws[ref].s = styleCellNormal;
        }
    }
    
    // 9. Footer Blocks (fRow1, fRow2)
    for (let c = 17; c <= 19; c++) {
        const ref1 = XLSX.utils.encode_cell({ r: fRow1, c });
        const ref2 = XLSX.utils.encode_cell({ r: fRow2, c });
        if (!ws[ref1]) ws[ref1] = { t: 's', v: '' };
        if (!ws[ref2]) ws[ref2] = { t: 's', v: '' };
        ws[ref1].s = styleFooterVal;
        ws[ref2].s = styleFooterVal;
    }
    for (let c = 20; c <= 25; c++) {
        const ref1 = XLSX.utils.encode_cell({ r: fRow1, c });
        const ref2 = XLSX.utils.encode_cell({ r: fRow2, c });
        if (!ws[ref1]) ws[ref1] = { t: 's', v: '' };
        if (!ws[ref2]) ws[ref2] = { t: 's', v: '' };
        ws[ref1].s = styleFooterLabel;
        ws[ref2].s = styleFooterLabel;
    }
    
    // Column Widths
    ws['!cols'] = [
        { wch: 10 }, // A: الرقم
        { wch: 6 },  // B: العدد
        { wch: 8 },  // C: الاتجاه
        { wch: 8 },  // D: العرض
        { wch: 8 },  // E: الارتفاع
        { wch: 8 },  // F: الخمالة
        { wch: 8 },  // G: السماكة
        { wch: 8 },  // H: تحت الأرض
        { wch: 10 }, // I: شكل المقطع
        { wch: 12 }, // J: نوع المقطع
        { wch: 10 }, // K: كاوتشوك
        { wch: 10 }, // L: عرض الكشفة
        { wch: 8 },  // M: الاتجاه
        { wch: 8 },  // N: العرض
        { wch: 8 },  // O: الارتفاع
        { wch: 8 },  // P: الخمالة
        { wch: 8 },  // Q: السماكة
        { wch: 12 }, // R: المواصفات
        { wch: 10 }, // S: النوع
        { wch: 6 },  // T: العدد
        { wch: 8 },  // U: FR/NFR
        { wch: 12 }, // V: نوع الزرافيل
        { wch: 10 }, // W: نوع الحديد
        { wch: 10 }, // X: الفصالات
        { wch: 10 }, // Y: البروفيل
        { wch: 8 },  // Z: اللون
        { wch: 22 }  // AA: ملاحظات
    ];
    
    ws['!views'] = [{ rightToLeft: true, RTL: true, tabSelected: true }];
    ws['!RTL'] = true;
    
    if (!wb.Workbook) wb.Workbook = {};
    wb.Workbook.Views = [{ rightToLeft: true, RTL: true }];
    
    XLSX.utils.book_append_sheet(wb, ws, "جدول التصنيع");
    
    const fileName = `جدول_تصنيع_${project.name.replace(/\s+/g, '_')}_${new Date().toLocaleDateString('ar-SA').replace(/\//g, '-')}.xlsx`;
    XLSX.writeFile(wb, fileName);
    showToast('تم تصدير جدول التصنيع بنجاح بنمط مطابق تماماً 👍', 'bg-emerald-500', '✓');
}

// ==================== HR SYSTEM FRONTEND ====================
let hrCurrentSection = 'menu';

async function showHRView() {
    const currentUsername = localStorage.getItem('username');
    const hasHrAccess = currentUsername === 'admin' || userPermissionsList.some(p => p.department_name === 'system_hr' && (p.can_edit == 1 || p.can_edit === true));
    if (!hasHrAccess) {
        showToast('غير مصرح لك بالوصول لنظام إدارة شؤون الموظفين', 'bg-rose-500', '✗');
        return;
    }

    const views = [
        'moduleSelectorView', 'departmentsView', 'accessoriesSubDeptView', 
        'departmentDetailView', 'adminView', 'purchasingView', 
        'purchaseRequestDetailView', 'projectsView', 'projectWizardView', 
        'projectDetailView'
    ];
    views.forEach(v => {
        const el = document.getElementById(v);
        if (el) el.classList.add('hidden');
    });

    const hrView = document.getElementById('hrView');
    if (hrView) hrView.classList.remove('hidden');

    // Check permissions
    const hasHrMgmt = currentUsername === 'admin' || userPermissionsList.some(p => p.department_name === 'hr_management' && (p.can_edit == 1 || p.can_edit === true));
    
    const adminBtn = document.getElementById('hrAdminRequestsBtn');
    if (adminBtn) {
        if (hasHrMgmt) {
            adminBtn.classList.remove('hidden');
        } else {
            adminBtn.classList.add('hidden');
        }
    }

    // Default to main menu
    hrCurrentSection = 'menu';
    document.getElementById('hrMainMenuSection').classList.remove('hidden');
    document.getElementById('hrMainMenuSection').classList.add('grid');
    document.getElementById('hrProfileSection').classList.add('hidden');
    document.getElementById('hrProfileSection').classList.remove('block');
    document.getElementById('hrFormsSection').classList.add('hidden');
    document.getElementById('hrFormsSection').classList.remove('block');
    document.getElementById('hrAttendanceSection').classList.add('hidden');
    document.getElementById('hrAttendanceSection').classList.remove('block');

    // Load Data
    await loadHrProfile();
    await loadHrRequests();
    await loadHrAttendance();
}

function enterHrSubSection(section) {
    hrCurrentSection = section;
    
    // Hide main menu
    document.getElementById('hrMainMenuSection').classList.add('hidden');
    document.getElementById('hrMainMenuSection').classList.remove('grid');

    // Show selected section
    const sections = ['profile', 'forms', 'attendance'];
    sections.forEach(s => {
        const el = document.getElementById('hr' + s.charAt(0).toUpperCase() + s.slice(1) + 'Section');
        if (el) {
            if (s === section) {
                el.classList.remove('hidden');
                el.classList.add('block');
            } else {
                el.classList.remove('block');
                el.classList.add('hidden');
            }
        }
    });

    if (section === 'profile') {
        loadHrProfile();
    }
}

function handleHrBackNavigation() {
    if (hrCurrentSection === 'menu') {
        showModuleSelectorView();
    } else {
        // Go back to main HR menu
        hrCurrentSection = 'menu';
        document.getElementById('hrMainMenuSection').classList.remove('hidden');
        document.getElementById('hrMainMenuSection').classList.add('grid');
        
        document.getElementById('hrProfileSection').classList.add('hidden');
        document.getElementById('hrProfileSection').classList.remove('block');
        document.getElementById('hrFormsSection').classList.add('hidden');
        document.getElementById('hrFormsSection').classList.remove('block');
        document.getElementById('hrAttendanceSection').classList.add('hidden');
        document.getElementById('hrAttendanceSection').classList.remove('block');
    }
}

async function loadHrProfile() {
    try {
        const currentUsername = localStorage.getItem('username');
        if (currentUsername !== 'admin') {
            try {
                const permUrl = `${API_HOST}/api/users/me/permissions`;
                const permsResponse = await authFetch(permUrl);
                if (permsResponse.ok) {
                    userPermissionsList = await permsResponse.json();
                }
            } catch (e) {
                console.error('[DEBUG] loadHrProfile: Failed to fetch permissions', e);
            }
        }

        const res = await authFetch('/api/users/me');
        if (!res.ok) throw new Error('Failed to load user profile');
        const user = await res.json();
        
        document.getElementById('hrProfileName').value = user.full_name || '';
        document.getElementById('hrProfileJobTitle').value = user.job_title || '';
        document.getElementById('hrProfileEmpId').value = user.employment_id || '';
        document.getElementById('hrProfileDepartment').value = user.department || '';

        const previewImg = document.getElementById('hrProfileAvatarPreview');
        const placeholder = document.getElementById('hrProfileAvatarPlaceholder');

        if (user.avatar_url) {
            previewImg.src = user.avatar_url;
            previewImg.classList.remove('hidden');
            placeholder.classList.add('hidden');
        } else {
            previewImg.src = '';
            previewImg.classList.add('hidden');
            placeholder.classList.remove('hidden');
        }

        // Apply read-only restriction based on permission
        const hasHrMgmt = currentUsername === 'admin' || userPermissionsList.some(p => p.department_name === 'hr_management' && (p.can_edit == 1 || p.can_edit === true));

        const nameInput = document.getElementById('hrProfileName');
        const jobTitleInput = document.getElementById('hrProfileJobTitle');
        const empIdInput = document.getElementById('hrProfileEmpId');
        const deptInput = document.getElementById('hrProfileDepartment');
        const avatarInput = document.getElementById('hrProfileAvatarInput');
        const avatarLabel = document.getElementById('hrProfileAvatarLabel');
        const saveBtn = document.getElementById('hrProfileSaveBtn');

        if (hasHrMgmt) {
            nameInput.disabled = false;
            jobTitleInput.disabled = false;
            empIdInput.disabled = false;
            deptInput.disabled = false;
            avatarInput.disabled = false;
            if (avatarLabel) avatarLabel.classList.remove('hidden');
            if (saveBtn) saveBtn.classList.remove('hidden');
        } else {
            nameInput.disabled = true;
            jobTitleInput.disabled = true;
            empIdInput.disabled = true;
            deptInput.disabled = true;
            avatarInput.disabled = true;
            if (avatarLabel) avatarLabel.classList.add('hidden');
            if (saveBtn) saveBtn.classList.add('hidden');
        }
    } catch (err) {
        console.error(err);
        showToast('خطأ أثناء تحميل الملف الشخصي: ' + err.message, 'bg-rose-500', '✗');
    }
}

function previewHrAvatar(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const previewImg = document.getElementById('hrProfileAvatarPreview');
            const placeholder = document.getElementById('hrProfileAvatarPlaceholder');
            previewImg.src = e.target.result;
            previewImg.classList.remove('hidden');
            placeholder.classList.add('hidden');
        }
        reader.readAsDataURL(input.files[0]);
    }
}

async function saveHrProfile(event) {
    event.preventDefault();
    const formData = new FormData();
    formData.append('full_name', document.getElementById('hrProfileName').value);
    formData.append('job_title', document.getElementById('hrProfileJobTitle').value);
    formData.append('employment_id', document.getElementById('hrProfileEmpId').value);
    formData.append('department', document.getElementById('hrProfileDepartment').value);

    const avatarInput = document.getElementById('hrProfileAvatarInput');
    if (avatarInput.files && avatarInput.files[0]) {
        formData.append('avatar', avatarInput.files[0]);
    }

    try {
        const res = await authFetch('/api/users/me/profile', {
            method: 'PUT',
            body: formData
        });
        if (!res.ok) throw new Error('Failed to save profile changes');
        showToast('تم حفظ الملف الشخصي بنجاح', 'bg-emerald-500', '✓');
        await loadHrProfile();
    } catch (err) {
        console.error(err);
        showToast('خطأ أثناء حفظ الملف الشخصي: ' + err.message, 'bg-rose-500', '✗');
    }
}

// Modal Toggle Functions
function openHrLeaveModal() {
    document.getElementById('hrLeaveRequestModal').classList.remove('hidden');
    // Set default date to today
    document.getElementById('hrLeaveDate').value = new Date().toISOString().split('T')[0];
    // Set default start time to current time
    document.getElementById('hrLeaveStartTime').value = new Date().toTimeString().split(' ')[0].substring(0, 5);
    document.getElementById('hrLeaveEndTime').value = '';
    document.getElementById('hrLeaveReason').value = '';
    document.getElementById('hrLeaveAttachment').value = '';
}
function closeHrLeaveModal() {
    document.getElementById('hrLeaveRequestModal').classList.add('hidden');
}

function openHrVacationModal() {
    document.getElementById('hrVacationRequestModal').classList.remove('hidden');
    document.getElementById('hrVacationStartDate').value = '';
    document.getElementById('hrVacationEndDate').value = '';
    document.getElementById('hrVacationReason').value = '';
    document.getElementById('hrVacationAttachment').value = '';
}
function closeHrVacationModal() {
    document.getElementById('hrVacationRequestModal').classList.add('hidden');
}

function openHrInquiryModal() {
    document.getElementById('hrInquiryRequestModal').classList.remove('hidden');
    document.getElementById('hrInquiryReason').value = '';
}
function closeHrInquiryModal() {
    document.getElementById('hrInquiryRequestModal').classList.add('hidden');
}

// Forms Submissions
async function submitHrLeaveForm(event) {
    event.preventDefault();
    const formData = new FormData();
    formData.append('request_type', 'مغادرة');
    formData.append('reason', document.getElementById('hrLeaveReason').value);
    formData.append('start_date', document.getElementById('hrLeaveDate').value);
    formData.append('start_time', document.getElementById('hrLeaveStartTime').value);
    formData.append('end_time', document.getElementById('hrLeaveEndTime').value);
    
    const fileInput = document.getElementById('hrLeaveAttachment');
    if (fileInput.files.length > 0) {
        formData.append('attachment', fileInput.files[0]);
    }

    try {
        const res = await authFetch('/api/hr/requests/', {
            method: 'POST',
            body: formData
        });
        if (!res.ok) throw new Error('Failed to submit leave request');
        showToast('تم تقديم طلب المغادرة بنجاح', 'bg-emerald-500', '✓');
        closeHrLeaveModal();
        await loadHrRequests();
    } catch (err) {
        console.error(err);
        showToast('خطأ في إرسال طلب المغادرة: ' + err.message, 'bg-rose-500', '✗');
    }
}

async function submitHrVacationForm(event) {
    event.preventDefault();
    const formData = new FormData();
    formData.append('request_type', 'اجازة');
    formData.append('reason', document.getElementById('hrVacationReason').value);
    formData.append('start_date', document.getElementById('hrVacationStartDate').value);
    formData.append('end_date', document.getElementById('hrVacationEndDate').value);
    
    const fileInput = document.getElementById('hrVacationAttachment');
    if (fileInput.files.length > 0) {
        formData.append('attachment', fileInput.files[0]);
    }

    try {
        const res = await authFetch('/api/hr/requests/', {
            method: 'POST',
            body: formData
        });
        if (!res.ok) throw new Error('Failed to submit vacation request');
        showToast('تم تقديم طلب الإجازة بنجاح', 'bg-emerald-500', '✓');
        closeHrVacationModal();
        await loadHrRequests();
    } catch (err) {
        console.error(err);
        showToast('خطأ في إرسال طلب الإجازة: ' + err.message, 'bg-rose-500', '✗');
    }
}

async function submitHrInquiryForm(event) {
    event.preventDefault();
    const formData = new FormData();
    formData.append('request_type', 'استفسار');
    formData.append('reason', document.getElementById('hrInquiryReason').value);

    try {
        const res = await authFetch('/api/hr/requests/', {
            method: 'POST',
            body: formData
        });
        if (!res.ok) throw new Error('Failed to submit inquiry');
        showToast('تم تقديم الاستفسار بنجاح', 'bg-emerald-500', '✓');
        closeHrInquiryModal();
        await loadHrRequests();
    } catch (err) {
        console.error(err);
        showToast('خطأ في إرسال الاستفسار: ' + err.message, 'bg-rose-500', '✗');
    }
}

// Request logs loader
async function loadHrRequests() {
    try {
        const res = await authFetch('/api/hr/requests/me');
        if (!res.ok) throw new Error('Failed to load my requests');
        const list = await res.json();
        
        const tbody = document.getElementById('hrMyRequestsTableBody');
        tbody.innerHTML = '';
        
        if (list.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-slate-400">لا يوجد طلبات سابقة بعد</td></tr>`;
            return;
        }

        list.forEach(req => {
            let details = req.reason;
            if (req.request_type === 'مغادرة') {
                details += ` <span class="text-slate-400 text-[10px]">(${req.start_date} | ${req.start_time} - ${req.end_time})</span>`;
            } else if (req.request_type === 'اجازة') {
                details += ` <span class="text-slate-400 text-[10px]">(${req.start_date} إلى ${req.end_date})</span>`;
            }

            let attachmentCell = '-';
            if (req.attachment_url) {
                attachmentCell = `<a href="${req.attachment_url}" target="_blank" class="text-indigo-600 hover:underline font-bold">عرض المرفق 📎</a>`;
            }

            let statusClass = 'bg-slate-50 text-slate-700 border-slate-200';
            if (req.status === 'موافق') statusClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
            if (req.status === 'مرفوض') statusClass = 'bg-rose-50 text-rose-700 border-rose-200';

            const row = document.createElement('tr');
            row.className = 'border-b hover:bg-slate-50 transition';
            row.innerHTML = `
                <td class="p-4 text-slate-500 font-semibold">${new Date(req.request_date).toLocaleDateString()}</td>
                <td class="p-4 font-bold text-slate-800">${req.request_type}</td>
                <td class="p-4 text-slate-700">${details}</td>
                <td class="p-4 text-center">${attachmentCell}</td>
                <td class="p-4 text-center">
                    <span class="inline-block px-2.5 py-1 ${statusClass} rounded-full text-xs font-bold border">${req.status}</span>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (err) {
        console.error(err);
    }
}

// Attendance features
async function loadHrAttendance() {
    try {
        const todayStr = new Date().toISOString().split('T')[0];
        document.getElementById('attendanceCurrentDate').textContent = new Date().toLocaleDateString('ar-SA', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });

        const res = await authFetch('/api/hr/attendance/me');
        if (!res.ok) throw new Error('Failed to load attendance logs');
        const list = await res.json();

        const checkInBtn = document.getElementById('attendanceCheckInBtn');
        const checkOutBtn = document.getElementById('attendanceCheckOutBtn');
        
        // Reset buttons default enabled
        checkInBtn.disabled = false;
        checkInBtn.className = "w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition shadow flex items-center justify-center gap-2 cursor-pointer";
        
        checkOutBtn.disabled = false;
        checkOutBtn.className = "w-full py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition shadow flex items-center justify-center gap-2 cursor-pointer";

        // Find today's entry
        const todayRecord = list.find(r => r.record_date === todayStr);
        if (todayRecord) {
            if (todayRecord.check_in) {
                checkInBtn.disabled = true;
                checkInBtn.className = "w-full py-3 bg-slate-200 text-slate-400 rounded-xl font-bold transition flex items-center justify-center gap-2 cursor-not-allowed";
                checkInBtn.textContent = `✓ تم تسجيل الدخول (${todayRecord.check_in})`;
            }
            if (todayRecord.check_out) {
                checkOutBtn.disabled = true;
                checkOutBtn.className = "w-full py-3 bg-slate-200 text-slate-400 rounded-xl font-bold transition flex items-center justify-center gap-2 cursor-not-allowed";
                checkOutBtn.textContent = `✓ تم تسجيل الانصراف (${todayRecord.check_out})`;
            }
        } else {
            checkInBtn.textContent = '✓ تسجيل دخول';
            checkOutBtn.textContent = '🚫 تسجيل انصراف';
        }

        const tbody = document.getElementById('attendanceLogsTableBody');
        tbody.innerHTML = '';

        if (list.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="p-6 text-center text-slate-400">لا يوجد سجلات دوام للموظف بعد</td></tr>`;
            return;
        }

        list.forEach(record => {
            const row = document.createElement('tr');
            row.className = 'border-b hover:bg-slate-50 transition text-right';
            row.innerHTML = `
                <td class="p-3 font-semibold text-slate-500">${record.record_date}</td>
                <td class="p-3 text-center font-bold text-slate-700">${record.check_in || '-'}</td>
                <td class="p-3 text-center font-bold text-slate-700">${record.check_out || '-'}</td>
                <td class="p-3 text-center">
                    <span class="inline-block px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-[10px] font-bold">${record.status}</span>
                </td>
            `;
            tbody.appendChild(row);
        });

    } catch (err) {
        console.error(err);
    }
}

async function doAttendanceCheckIn() {
    const record_date = new Date().toISOString().split('T')[0];
    const check_in = new Date().toTimeString().split(' ')[0];
    
    const formData = new FormData();
    formData.append('record_date', record_date);
    formData.append('check_in', check_in);
    formData.append('status', 'حاضر');

    try {
        const res = await authFetch('/api/hr/attendance/log', {
            method: 'POST',
            body: formData
        });
        if (!res.ok) throw new Error('Failed to log check in');
        showToast('تم تسجيل الدخول للعمل بنجاح', 'bg-emerald-500', '✓');
        await loadHrAttendance();
    } catch (err) {
        console.error(err);
        showToast('فشل تسجيل الدخول: ' + err.message, 'bg-rose-500', '✗');
    }
}

async function doAttendanceCheckOut() {
    const record_date = new Date().toISOString().split('T')[0];
    const check_out = new Date().toTimeString().split(' ')[0];
    
    const formData = new FormData();
    formData.append('record_date', record_date);
    formData.append('check_out', check_out);
    formData.append('status', 'حاضر');

    try {
        const res = await authFetch('/api/hr/attendance/log', {
            method: 'POST',
            body: formData
        });
        if (!res.ok) throw new Error('Failed to log check out');
        showToast('تم تسجيل الخروج والانصراف بنجاح', 'bg-emerald-500', '✓');
        await loadHrAttendance();
    } catch (err) {
        console.error(err);
        showToast('فشل تسجيل الانصراف: ' + err.message, 'bg-rose-500', '✗');
    }
}

// Admin panel requests dashboard
async function openHrAdminRequestsModal() {
    document.getElementById('hrAdminRequestsModal').classList.remove('hidden');
    await loadHrAdminRequests();
}

function closeHrAdminRequestsModal() {
    document.getElementById('hrAdminRequestsModal').classList.add('hidden');
}

async function loadHrAdminRequests() {
    try {
        const res = await authFetch('/api/hr/requests/all');
        if (!res.ok) throw new Error('Failed to load all employee requests');
        const list = await res.json();

        const tbody = document.getElementById('hrAdminRequestsTableBody');
        tbody.innerHTML = '';

        if (list.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-slate-400">لا توجد طلبات مقدمة من الموظفين بعد</td></tr>`;
            return;
        }

        list.forEach(req => {
            const employeeName = req.user ? (req.user.full_name || req.user.username) : 'غير معروف';
            
            let details = req.reason;
            if (req.request_type === 'مغادرة') {
                details += ` <span class="text-slate-400 text-[10px]">(${req.start_date} | ${req.start_time} - ${req.end_time})</span>`;
            } else if (req.request_type === 'اجازة') {
                details += ` <span class="text-slate-400 text-[10px]">(${req.start_date} إلى ${req.end_date})</span>`;
            }

            let attachmentCell = '-';
            if (req.attachment_url) {
                attachmentCell = `<a href="${req.attachment_url}" target="_blank" class="text-indigo-600 hover:underline font-bold">عرض المرفق 📎</a>`;
            }

            let statusClass = 'bg-slate-50 text-slate-700 border-slate-200';
            if (req.status === 'موافق') statusClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
            if (req.status === 'مرفوض') statusClass = 'bg-rose-50 text-rose-700 border-rose-200';

            let actionsHtml = '-';
            if (req.status === 'قيد الانتظار') {
                actionsHtml = `
                    <div class="flex justify-center gap-1.5">
                        <button onclick="changeRequestStatus(${req.id}, 'موافق')" class="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-[10px] font-bold border border-emerald-200 transition">
                            ✓ موافقة
                        </button>
                        <button onclick="changeRequestStatus(${req.id}, 'مرفوض')" class="px-2.5 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg text-[10px] font-bold border border-rose-200 transition">
                            ✗ رفض
                        </button>
                    </div>
                `;
            }

            const row = document.createElement('tr');
            row.className = 'border-b hover:bg-slate-50 transition text-right';
            row.innerHTML = `
                <td class="p-3 font-bold text-slate-800">${employeeName}</td>
                <td class="p-3 font-bold text-indigo-700">${req.request_type}</td>
                <td class="p-3 text-slate-500 font-semibold">${new Date(req.request_date).toLocaleDateString()}</td>
                <td class="p-3 text-slate-700">${details}</td>
                <td class="p-3 text-center">${attachmentCell}</td>
                <td class="p-3 text-center">
                    <span class="inline-block px-2.5 py-1 ${statusClass} rounded-full text-[10px] font-bold border">${req.status}</span>
                </td>
                <td class="p-3 text-center">${actionsHtml}</td>
            `;
            tbody.appendChild(row);
        });

    } catch (err) {
        console.error(err);
        showToast('خطأ أثناء تحميل طلبات الموظفين: ' + err.message, 'bg-rose-500', '✗');
    }
}

async function changeRequestStatus(reqId, status) {
    try {
        const res = await authFetch(`/api/hr/requests/${reqId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: status })
        });
        if (!res.ok) throw new Error('Failed to update request status');
        showToast('تم تحديث حالة الطلب بنجاح', 'bg-emerald-500', '✓');
        await loadHrAdminRequests();
        await loadHrRequests();
    } catch (err) {
        console.error(err);
        showToast('خطأ في تحديث حالة الطلب: ' + err.message, 'bg-rose-500', '✗');
    }
}

