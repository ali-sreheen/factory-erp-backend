const API_HOST = window.location.protocol === 'file:' ? 'http://localhost:8000' : window.location.origin;
const API_URL = `${API_HOST}/api/items`;
const AUTH_URL = `${API_HOST}/api/auth`;
const USERS_URL = `${API_HOST}/api/users`;
const USERS_BASIC_URL = `${API_HOST}/api/users/basic`;
const CONTRACTORS_URL = `${API_HOST}/api/contractors`;

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

    // History and Browser Back/Forward navigation support
    window.addEventListener('popstate', (e) => {
        handlePopState(e);
    });
});

// Helper to check and close any open modals
function closeAnyOpenModal() {
    const modalIds = [
        'sheetNestingModal', 'projectActivationModal', 'contractorModal', 'fireDoorsModal',
        'addItemModal', 'txModal', 'logModal', 'editUserModal', 'deleteUserModal',
        'moveItemModal', 'itemDetailsModal', 'addSubDeptModal', 'manageSubDeptsModal',
        'reservationModal', 'transferModal', 'returnModal', 'scrapModal',
        'hrLeaveRequestModal', 'hrVacationRequestModal', 'hrInquiryRequestModal',
        'editEmployeeModal', 'hrOfficialLeavesModal', 'serviceReportModal', 'serviceClientModal'
    ];
    for (const id of modalIds) {
        const el = document.getElementById(id);
        if (el && !el.classList.contains('hidden')) {
            el.classList.add('hidden');
            return true;
        }
    }
    return false;
}

// ----------------- USER MENU & NOTIFICATIONS DROPDOWN -----------------

let notificationPollingInterval = null;
let lastUnreadCount = null;
let isFirstNotificationCheck = true;

function playNotificationSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
        osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.35);
    } catch (e) {
        // AudioContext might be restricted until user gesture, ignore safely
    }
}

function toggleNotificationsMenu(event) {
    if (event) event.stopPropagation();
    const dropdown = document.getElementById('notificationsDropdown');
    if (!dropdown) return;
    const isHidden = dropdown.classList.contains('hidden');
    
    // Close user menu if open
    const userMenu = document.getElementById('userMenuDropdown');
    if (userMenu && !userMenu.classList.contains('hidden')) {
        userMenu.classList.add('hidden');
    }
    
    if (isHidden) {
        dropdown.classList.remove('hidden');
        loadNotifications();
    } else {
        dropdown.classList.add('hidden');
    }
}

function formatNotificationTime(dateStr) {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        const now = new Date();
        const diffSec = Math.floor((now - d) / 1000);
        if (diffSec < 60) return 'الآن';
        const diffMin = Math.floor(diffSec / 60);
        if (diffMin < 60) return `منذ ${diffMin} د`;
        const diffHours = Math.floor(diffMin / 60);
        if (diffHours < 24) return `منذ ${diffHours} س`;
        const diffDays = Math.floor(diffHours / 24);
        if (diffDays < 7) return `منذ ${diffDays} يوم`;
        return d.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
    } catch (e) {
        return dateStr;
    }
}

async function fetchUnreadNotificationsCount() {
    try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const res = await authFetch(`${API_HOST}/api/notifications/unread-count`);
        if (!res.ok) return;
        const data = await res.json();
        const count = data.unread_count || 0;
        
        const badge = document.getElementById('unreadNotificationsBadge');
        const headerCount = document.getElementById('notificationsHeaderCount');
        
        if (badge) {
            if (count > 0) {
                badge.textContent = count > 99 ? '99+' : count;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }
        if (headerCount) {
            headerCount.textContent = count;
        }

        // If count increased and not first check, alert user!
        if (!isFirstNotificationCheck && lastUnreadCount !== null && count > lastUnreadCount) {
            playNotificationSound();
            try {
                const listRes = await authFetch(`${API_HOST}/api/notifications/?limit=1`);
                if (listRes.ok) {
                    const items = await listRes.json();
                    if (items && items.length > 0) {
                        showToast(`🔔 ${items[0].title}: ${items[0].message}`, 'bg-indigo-600', '🔔');
                    }
                }
            } catch (err) {
                showToast(`🔔 لديك ${count - lastUnreadCount} إشعار جديد`, 'bg-indigo-600', '🔔');
            }
        }
        
        lastUnreadCount = count;
        isFirstNotificationCheck = false;
    } catch (e) {
        console.error('Failed to fetch unread count', e);
    }
}

async function loadNotifications() {
    const listEl = document.getElementById('notificationsList');
    if (!listEl) return;
    
    try {
        const res = await authFetch(`${API_HOST}/api/notifications/?limit=30`);
        if (!res.ok) throw new Error('فشل جلب الإشعارات');
        const items = await res.json();
        
        if (!items || items.length === 0) {
            listEl.innerHTML = `
                <div class="p-8 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                    <svg class="w-10 h-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    <p class="text-xs font-semibold">لا توجد إشعارات حتى الآن</p>
                </div>
            `;
            return;
        }
        
        listEl.innerHTML = items.map(n => {
            const isUnread = !n.is_read;
            const timeStr = formatNotificationTime(n.created_at);
            
            // Icon & colors based on type
            let iconSvg = '';
            let iconBg = 'bg-indigo-100 text-indigo-600';
            if (n.type === 'project_created') {
                iconBg = 'bg-emerald-100 text-emerald-600';
                iconSvg = `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>`;
            } else if (n.type === 'project_status_changed') {
                iconBg = 'bg-amber-100 text-amber-600';
                iconSvg = `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>`;
            } else if (n.type && n.type.startsWith('inventory_add')) {
                iconBg = 'bg-teal-100 text-teal-600';
                iconSvg = `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>`;
            } else if (n.type && n.type.startsWith('inventory_sub')) {
                iconBg = 'bg-rose-100 text-rose-600';
                iconSvg = `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"/></svg>`;
            } else if (n.type === 'low_stock_alert') {
                iconBg = 'bg-red-100 text-red-600';
                iconSvg = `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`;
            } else if (n.type && n.type.startsWith('purchase_request')) {
                iconBg = 'bg-blue-100 text-blue-600';
                iconSvg = `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>`;
            } else if (n.type && n.type.startsWith('service_job')) {
                iconBg = 'bg-purple-100 text-purple-600';
                iconSvg = `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>`;
            } else if (n.type && n.type.startsWith('hr_request')) {
                iconBg = 'bg-cyan-100 text-cyan-600';
                iconSvg = `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>`;
            } else {
                iconBg = 'bg-indigo-100 text-indigo-600';
                iconSvg = `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;
            }
            
            return `
                <div onclick="handleNotificationClick(${n.id}, '${n.type || 'info'}', ${n.reference_id || 'null'})" 
                     class="p-3.5 flex items-start gap-3 hover:bg-slate-50 transition cursor-pointer ${isUnread ? 'bg-indigo-50/50' : 'bg-white'}">
                    <div class="w-8 h-8 rounded-xl ${iconBg} flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                        ${iconSvg}
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center justify-between gap-1 mb-1">
                            <span class="text-xs font-bold text-slate-800 truncate">${n.title}</span>
                            <span class="text-[10px] text-slate-400 shrink-0">${timeStr}</span>
                        </div>
                        <p class="text-xs text-slate-600 leading-relaxed break-words">${n.message}</p>
                    </div>
                    ${isUnread ? '<span class="w-2 h-2 rounded-full bg-indigo-600 shrink-0 mt-2"></span>' : ''}
                </div>
            `;
        }).join('');
        
    } catch (e) {
        listEl.innerHTML = `
            <div class="p-6 text-center text-xs text-rose-500">
                ${e.message || 'حدث خطأ أثناء تحميل الإشعارات'}
            </div>
        `;
    }
}

async function handleNotificationClick(userNotifId, notifType, referenceId) {
    try {
        await authFetch(`${API_HOST}/api/notifications/${userNotifId}/read`, { method: 'PUT' });
        fetchUnreadNotificationsCount();
    } catch (e) {
        console.error('Failed to mark notification read', e);
    }
    
    // Close dropdown
    const dropdown = document.getElementById('notificationsDropdown');
    if (dropdown) dropdown.classList.add('hidden');
    
    // Navigation based on notification type and reference
    if (referenceId && (notifType === 'project_created' || notifType === 'project_status_changed' || String(notifType).startsWith('project'))) {
        try {
            if (typeof viewProjectDetails === 'function') {
                viewProjectDetails(referenceId);
            }
        } catch (err) {
            console.error('Failed to open project from notification', err);
        }
    }
}

async function markAllNotificationsAsRead(event) {
    if (event) event.stopPropagation();
    try {
        const res = await authFetch(`${API_HOST}/api/notifications/mark-all-read`, { method: 'POST' });
        if (res.ok) {
            showToast('تم تحديد جميع الإشعارات كمقروءة', 'bg-indigo-600', '✓');
            fetchUnreadNotificationsCount();
            loadNotifications();
        }
    } catch (e) {
        showToast('فشل تحديد الإشعارات كمقروءة', 'bg-rose-500', '✗');
    }
}

async function openNotificationSettingsModal(event) {
    if (event) event.stopPropagation();
    // Close notifications dropdown
    const dropdown = document.getElementById('notificationsDropdown');
    if (dropdown) dropdown.classList.add('hidden');

    const modal = document.getElementById('notificationSettingsModal');
    if (!modal) return;
    modal.classList.remove('hidden');

    const listEl = document.getElementById('notificationSettingsList');
    if (!listEl) return;
    listEl.innerHTML = '<div class="text-center py-8 text-xs text-slate-400">جاري تحميل الإعدادات...</div>';

    try {
        const res = await authFetch(`${API_HOST}/api/notifications/settings`);
        if (!res.ok) throw new Error('فشل تحميل تفضيلات الإشعارات');
        const data = await res.json();
        const settings = data.settings || [];

        // Group settings by category
        const groups = {};
        settings.forEach(s => {
            const grp = s.group || 'أخرى';
            if (!groups[grp]) groups[grp] = [];
            groups[grp].push(s);
        });

        // Category badges & icons
        const groupMeta = {
            'المستودعات والمخازن': { icon: '📦', color: 'text-amber-700 bg-amber-50 border-amber-200' },
            'المشاريع': { icon: '🏗️', color: 'text-blue-700 bg-blue-50 border-blue-200' },
            'المشتريات': { icon: '🛒', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
            'خدمات التشغيل': { icon: '⚙️', color: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
            'الموارد البشرية': { icon: '👥', color: 'text-purple-700 bg-purple-50 border-purple-200' }
        };

        let html = '';
        for (const [grpName, items] of Object.entries(groups)) {
            const meta = groupMeta[grpName] || { icon: '🔔', color: 'text-slate-700 bg-slate-50 border-slate-200' };
            html += `
                <div class="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-3.5 shadow-xs">
                    <div class="flex items-center gap-2 mb-2.5 pb-2 border-b border-slate-200/60">
                        <span class="text-sm">${meta.icon}</span>
                        <span class="text-xs font-bold text-slate-800">${grpName}</span>
                        <span class="text-[10px] px-2 py-0.5 rounded-full border ${meta.color} mr-auto font-medium">${items.length} خيارات</span>
                    </div>
                    <div class="space-y-2">
            `;

            items.forEach(item => {
                html += `
                    <label class="flex items-center justify-between p-2.5 rounded-xl bg-white hover:bg-slate-100/70 border border-slate-200/60 transition cursor-pointer select-none">
                        <span class="text-xs font-medium text-slate-700">${item.label}</span>
                        <div class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" 
                                   id="notif_pref_${item.key}" 
                                   data-setting-key="${item.key}" 
                                   class="notif-pref-toggle sr-only peer" 
                                   ${item.is_enabled ? 'checked' : ''}>
                            <div class="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                        </div>
                    </label>
                `;
            });

            html += `
                    </div>
                </div>
            `;
        }

        listEl.innerHTML = html;
    } catch (e) {
        console.error('Failed to load notification settings', e);
        listEl.innerHTML = `<div class="text-center py-6 text-xs text-rose-500 font-semibold">${e.message || 'تعذر تحميل الإعدادات'}</div>`;
    }
}

function closeNotificationSettingsModal() {
    const modal = document.getElementById('notificationSettingsModal');
    if (modal) modal.classList.add('hidden');
}

function setAllNotificationSettings(enableBoolean) {
    const toggles = document.querySelectorAll('.notif-pref-toggle');
    toggles.forEach(t => {
        t.checked = !!enableBoolean;
    });
}

async function saveNotificationSettings() {
    const btn = document.getElementById('btnSaveNotificationSettings');
    const toggles = document.querySelectorAll('.notif-pref-toggle');
    if (!toggles || toggles.length === 0) {
        closeNotificationSettingsModal();
        return;
    }

    const payload = {};
    toggles.forEach(t => {
        const key = t.getAttribute('data-setting-key');
        if (key) {
            payload[key] = t.checked;
        }
    });

    let origHtml = '';
    if (btn) {
        origHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span>جاري الحفظ...</span>';
    }

    try {
        const res = await authFetch(`${API_HOST}/api/notifications/settings`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ settings: payload })
        });
        if (!res.ok) throw new Error('فشل حفظ الإعدادات');
        showToast('تم حفظ إعدادات وتفضيلات الإشعارات بنجاح', 'bg-emerald-600', '✓');
        closeNotificationSettingsModal();
    } catch (e) {
        console.error('Failed to save notification settings', e);
        showToast('فشل حفظ الإعدادات: ' + (e.message || 'خطأ غير متوقع'), 'bg-rose-600', '✗');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = origHtml;
        }
    }
}

function startNotificationPolling() {
    stopNotificationPolling();
    isFirstNotificationCheck = true;
    fetchUnreadNotificationsCount();
    notificationPollingInterval = setInterval(() => {
        fetchUnreadNotificationsCount();
    }, 20000);
}

function stopNotificationPolling() {
    if (notificationPollingInterval) {
        clearInterval(notificationPollingInterval);
        notificationPollingInterval = null;
    }
}

// Click outside listener for notifications
document.addEventListener('click', function(e) {
    const notifContainer = document.getElementById('notificationsDropdownContainer');
    const notifDropdown = document.getElementById('notificationsDropdown');
    if (notifContainer && notifDropdown && !notifContainer.contains(e.target)) {
        notifDropdown.classList.add('hidden');
    }
});

// ESC key listener to close notification modal if open
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        const modal = document.getElementById('notificationSettingsModal');
        if (modal && !modal.classList.contains('hidden')) {
            closeNotificationSettingsModal();
        }
    }
});

function toggleUserMenu() {
    const notifDropdown = document.getElementById('notificationsDropdown');
    if (notifDropdown && !notifDropdown.classList.contains('hidden')) {
        notifDropdown.classList.add('hidden');
    }
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
    startNotificationPolling();
    if (!history.state) {
        history.replaceState({ view: 'moduleSelector', params: {} }, '', '#/moduleSelector');
    }
    showModuleSelectorView(true);
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
        const username = document.getElementById('loginUsername').value.trim();
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
                let errorMsg = 'اسم المستخدم أو كلمة المرور غير صحيحة';
                try {
                    const errData = await response.json();
                    if (errData && errData.detail) {
                        errorMsg = errData.detail;
                    }
                } catch (e) {}
                throw new Error(errorMsg);
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
    stopNotificationPolling();
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

// ----------------- VIEW ROUTING & HISTORY MANAGEMENT -----------------

let isNavigatingHistory = false;

function pushNavigationState(viewName, params = {}, replace = false) {
    if (isNavigatingHistory) return;
    const stateObj = { view: viewName, params: params };
    const hash = '#/' + viewName + (params.id ? `/${params.id}` : (params.dept ? `/${encodeURIComponent(params.dept)}` : ''));
    if (replace) {
        history.replaceState(stateObj, '', hash);
    } else {
        // Only push if state differs from current state
        const curState = history.state;
        if (!curState || curState.view !== viewName || JSON.stringify(curState.params || {}) !== JSON.stringify(params)) {
            history.pushState(stateObj, '', hash);
        }
    }
}

async function handlePopState(event) {
    // 1. If any modal is open, close it and do not change views
    if (closeAnyOpenModal()) {
        // Re-push current state so back button consumed for modal closure
        return;
    }

    const state = event.state;
    isNavigatingHistory = true;
    try {
        if (!state || !state.view || state.view === 'moduleSelector') {
            showModuleSelectorView(true);
        } else if (state.view === 'projects') {
            showProjectsView(true);
        } else if (state.view === 'projectDetail') {
            await viewProjectDetails(state.params.id, true);
        } else if (state.view === 'projectWizard') {
            openProjectWizard(true);
        } else if (state.view === 'projectEdit') {
            await editProject(state.params.id, true);
        } else if (state.view === 'services') {
            showServicesView(true);
        } else if (state.view === 'serviceJobDetail') {
            await viewServiceJobDetails(state.params.id, true);
        } else if (state.view === 'serviceWizard') {
            openServiceWizard(true);
        } else if (state.view === 'departments') {
            await showDepartmentsView(true);
        } else if (state.view === 'subDeptView') {
            await enterSubDeptView(state.params.dept, true);
        } else if (state.view === 'subDeptDetail') {
            currentDepartment = state.params.dept;
            await enterSubDepartment(state.params.subDept, true);
        } else if (state.view === 'deptDetail') {
            await enterDepartment(state.params.dept, true);
        } else if (state.view === 'purchasing') {
            showPurchasingView(true);
        } else if (state.view === 'purchaseRequestDetail') {
            await openPurchaseRequestDetails(state.params.id, true);
        } else if (state.view === 'hr') {
            await showHRView(true);
            if (state.params && state.params.section) {
                enterHrSubSection(state.params.section, true);
            }
        } else if (state.view === 'admin') {
            await showAdminView(true);
            if (state.params && state.params.section) {
                enterAdminSubSection(state.params.section, true);
            } else {
                showAdminHub(true);
            }
        } else {
            showModuleSelectorView(true);
        }
    } catch (err) {
        console.error('Error handling popstate navigation:', err);
    } finally {
        isNavigatingHistory = false;
    }
}


async function showDepartmentsView(fromHistory = false) {
    const username = localStorage.getItem('username');
    if (username !== 'admin' && !userPermissionsList.some(p => p.department_name === 'system_inventory' && (p.can_edit == 1 || p.can_edit === true))) {
        showToast('غير مصرح لك بالوصول لنظام إدارة المخازن', 'bg-rose-500', '✗');
        return;
    }

    if (!fromHistory) {
        pushNavigationState('departments');
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
    const sView = document.getElementById('servicesView');
    if(sView) sView.classList.add('hidden');
    const swView = document.getElementById('serviceWizardView');
    if(swView) swView.classList.add('hidden');
    const sjdView = document.getElementById('serviceJobDetailView');
    if(sjdView) sjdView.classList.add('hidden');

    departmentsView.classList.remove('hidden');
    accessoriesSubDeptView.classList.add('hidden');
    departmentDetailView.classList.add('hidden');
    adminView.classList.add('hidden');
    
    await fetchDepartmentCounts();
}

async function enterSubDeptView(deptName, fromHistory = false) {
    if (!fromHistory) {
        pushNavigationState('subDeptView', { dept: deptName });
    }

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

async function enterSubDepartment(subDept, fromHistory = false) {
    if (!fromHistory) {
        pushNavigationState('subDeptDetail', { dept: currentDepartment, subDept: subDept });
    }

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

async function enterDepartment(deptName, fromHistory = false) {
    if (!fromHistory) {
        pushNavigationState('deptDetail', { dept: deptName });
    }

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
let holidaysChartInstance = null;

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

let adminCurrentSection = 'hub';

window.enterAdminSubSection = function(section, fromHistory = false) {
    if (!fromHistory) {
        pushNavigationState('admin', { section: section });
    }
    adminCurrentSection = section;

    const hub = document.getElementById('adminHub');
    if (hub) hub.classList.add('hidden');

    const sections = ['users', 'accessories', 'projects', 'inventory'];
    sections.forEach(s => {
        const el = document.getElementById('adminSection' + s.charAt(0).toUpperCase() + s.slice(1));
        if (el) {
            if (s === section) {
                el.classList.remove('hidden');
            } else {
                el.classList.add('hidden');
            }
        }
    });

    if (section === 'users') {
        loadUsers();
    } else if (section === 'accessories') {
        renderProjectOptionsAdmin();
    } else if (section === 'projects') {
        renderProjectOptionsAdmin();
        loadFireDoorRules().then(() => renderFireDoorRulesAdmin());
    } else if (section === 'inventory') {
        renderSheetSizesAdmin();
    }
};

window.showAdminHub = function(fromHistory = false) {
    if (!fromHistory) {
        pushNavigationState('admin');
    }
    adminCurrentSection = 'hub';

    const hub = document.getElementById('adminHub');
    if (hub) hub.classList.remove('hidden');

    const sections = ['users', 'accessories', 'projects', 'inventory'];
    sections.forEach(s => {
        const el = document.getElementById('adminSection' + s.charAt(0).toUpperCase() + s.slice(1));
        if (el) el.classList.add('hidden');
    });
};

async function showAdminView(fromHistory = false) {
    if (!fromHistory) {
        pushNavigationState('admin');
    }

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
    
    // Always start at Admin Hub unless navigated with history
    showAdminHub(true);

    await loadUsers();
    await loadProjectOptions();
    renderProjectOptionsAdmin();
    await loadFireDoorRules();
    renderFireDoorRulesAdmin();
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
                    <div class="flex justify-center gap-2 flex-wrap">
                        <button onclick="openEditUserModal(${user.id}, '${user.username}')" class="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl transition text-xs font-bold border border-indigo-200" title="تغيير كلمة المرور">
                            ⚙️ الحساب
                        </button>
                        ${user.username !== 'admin' ? `
                        <button onclick="openPermissionsModal(${user.id}, '${user.username}')" class="px-3 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-xl transition text-xs font-bold border border-amber-200">
                            🛡️ الصلاحيات
                        </button>
                        <button onclick="toggleUserApproval(${user.id})" class="px-3 py-1.5 ${isApproved ? 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200'} rounded-xl transition text-xs font-bold border">
                            ${isApproved ? '🚫 تعطيل' : '✓ تفعيل'}
                        </button>
                        <button onclick="confirmDeleteUser(${user.id}, '${user.username}')" class="px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-xl transition text-xs font-bold border border-rose-200" title="حذف الحساب">
                            🗑️ حذف الحساب
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

        // Section 4: HR System (نظام شؤون الموظفين)
        let hrHtml = `
            <div class="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                <h4 class="font-bold text-sm text-indigo-700 border-b pb-2 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5 5 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                    نظام شؤون الموظفين
                </h4>
                <div class="space-y-3">
                    <div class="flex items-center justify-between p-2.5 border border-slate-100 rounded-xl bg-white">
                        <div>
                            <p class="font-bold text-slate-800 text-sm">إدارة واعتماد طلبات الموظفين</p>
                            <p class="text-xs text-slate-500">منح صلاحية إدارة وإقرار والتحكم بطلبات وإجازات الموظفين</p>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" ${hrMgmtCanEdit ? 'checked' : ''} onchange="togglePermission(${userId}, 'hr_management', this.checked)" class="sr-only peer">
                            <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                    </div>
                </div>
            </div>
        `;
        
        permissionsList.innerHTML = systemsHtml + inventoryHtml + projectHtml + purchasingHtml + hrHtml;
        
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

function showModuleSelectorView(fromHistory = false) {
    if (!fromHistory) {
        pushNavigationState('moduleSelector');
    }

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
    const sView = document.getElementById('servicesView');
    if(sView) sView.classList.add('hidden');
    const swView = document.getElementById('serviceWizardView');
    if(swView) swView.classList.add('hidden');
    const sjdView = document.getElementById('serviceJobDetailView');
    if(sjdView) sjdView.classList.add('hidden');
}

function showProjectsView(fromHistory = false) {
    const username = localStorage.getItem('username');
    if (username !== 'admin' && !userPermissionsList.some(p => p.department_name === 'system_projects' && (p.can_edit == 1 || p.can_edit === true))) {
        showToast('غير مصرح لك بالوصول لنظام إدارة المشاريع', 'bg-rose-500', '✗');
        return;
    }

    if (!fromHistory) {
        pushNavigationState('projects');
    }

    const hrView = document.getElementById('hrView');
    if(hrView) hrView.classList.add('hidden');

    const _pView = document.getElementById('purchasingView');
    if(_pView) _pView.classList.add('hidden');
    const _prdView = document.getElementById('purchaseRequestDetailView');
    if(_prdView) _prdView.classList.add('hidden');

    const sView = document.getElementById('servicesView');
    if(sView) sView.classList.add('hidden');
    const swView = document.getElementById('serviceWizardView');
    if(swView) swView.classList.add('hidden');
    const sjdView = document.getElementById('serviceJobDetailView');
    if(sjdView) sjdView.classList.add('hidden');

    document.getElementById('moduleSelectorView').classList.add('hidden');
    document.getElementById('projectsView').classList.remove('hidden');
    document.getElementById('projectWizardView').classList.add('hidden');
    departmentsView.classList.add('hidden');
    accessoriesSubDeptView.classList.add('hidden');
    departmentDetailView.classList.add('hidden');
    adminView.classList.add('hidden');
    const pdView = document.getElementById('projectDetailView');
    if (pdView) pdView.classList.add('hidden');
    applyPermissionsToUI();
    switchProjectsTab(currentProjectsTab || 'projects');
    loadProjects();
}

let currentProjectsTab = 'projects';

window.handleProjectsMainAction = function() {
    if (currentProjectsTab === 'contractors') {
        openContractorModal();
    } else {
        openProjectWizard();
    }
};

window.switchProjectsTab = function(tabName) {
    currentProjectsTab = tabName;
    
    const projectsTableContainer = document.getElementById('projectsTableContainer');
    const projectContractorsTableContainer = document.getElementById('projectContractorsTableContainer');
    const projectsGanttContainer = document.getElementById('projectsGanttContainer');
    const projectActionButtons = document.getElementById('projectActionButtons');
    const lblProjectsMainAction = document.getElementById('lblProjectsMainAction');
    const tabProjectsTable = document.getElementById('tabProjectsTable');
    const tabContractorsList = document.getElementById('tabContractorsList');
    const tabProjectsGantt = document.getElementById('tabProjectsGantt');
    const subTitleEl = document.getElementById('projectsViewSubTitle');

    const activeTabClass = 'px-4 py-2 rounded-lg font-bold text-xs transition-all bg-white text-slate-800 shadow';
    const inactiveTabClass = 'px-4 py-2 rounded-lg font-bold text-xs transition-all text-slate-600 hover:text-slate-900';
    
    if (tabProjectsTable) tabProjectsTable.className = inactiveTabClass;
    if (tabContractorsList) tabContractorsList.className = inactiveTabClass;
    if (tabProjectsGantt) tabProjectsGantt.className = inactiveTabClass;
    
    if (tabName === 'contractors') {
        if (projectsTableContainer) projectsTableContainer.classList.add('hidden');
        if (projectContractorsTableContainer) projectContractorsTableContainer.classList.remove('hidden');
        if (projectsGanttContainer) projectsGanttContainer.classList.add('hidden');
        if (projectActionButtons) projectActionButtons.classList.add('hidden');
        if (lblProjectsMainAction) lblProjectsMainAction.textContent = 'إضافة مقاول جديد';
        if (subTitleEl) subTitleEl.textContent = 'قائمة بجميع المقاولين المسجلين في النظام.';
        if (tabContractorsList) tabContractorsList.className = activeTabClass;
        
        loadContractors();
    } else if (tabName === 'gantt') {
        if (projectsTableContainer) projectsTableContainer.classList.add('hidden');
        if (projectContractorsTableContainer) projectContractorsTableContainer.classList.add('hidden');
        if (projectsGanttContainer) projectsGanttContainer.classList.remove('hidden');
        if (projectActionButtons) projectActionButtons.classList.remove('hidden');
        if (lblProjectsMainAction) lblProjectsMainAction.textContent = 'إضافة مشروع جديد';
        if (subTitleEl) subTitleEl.textContent = 'مخطط زمني تفاعلي لتتبع مراحل تصنيع الأبواب ومواعيد التسليم.';
        if (tabProjectsGantt) tabProjectsGantt.className = activeTabClass;
        
        renderProjectsGantt();
    } else {
        if (projectsTableContainer) projectsTableContainer.classList.remove('hidden');
        if (projectContractorsTableContainer) projectContractorsTableContainer.classList.add('hidden');
        if (projectsGanttContainer) projectsGanttContainer.classList.add('hidden');
        if (projectActionButtons) projectActionButtons.classList.remove('hidden');
        if (lblProjectsMainAction) lblProjectsMainAction.textContent = 'إضافة مشروع جديد';
        if (subTitleEl) subTitleEl.textContent = 'قائمة بجميع المشاريع المسجلة في النظام.';
        if (tabProjectsTable) tabProjectsTable.className = activeTabClass;
        
        loadProjects();
    }
};

let allContractors = [];

window.addContractorContactRow = function(name = '', phone = '') {
    const container = document.getElementById('contractorContactsContainer');
    if (!container) return;

    const rowIdx = container.children.length + 1;
    const div = document.createElement('div');
    div.className = 'flex items-center gap-2 contractor-contact-row bg-slate-50 p-2 rounded-xl border border-slate-200';
    div.innerHTML = `
        <div class="flex-1">
            <input type="text" placeholder="اسم المسؤول ${rowIdx}" value="${escapeHtml(name)}" class="contractor-contact-name w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-emerald-500">
        </div>
        <div class="flex-1">
            <input type="text" placeholder="رقم هاتف المسؤول ${rowIdx}" value="${escapeHtml(phone)}" class="contractor-contact-phone w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-emerald-500" dir="ltr">
        </div>
        ${rowIdx > 1 ? `
            <button type="button" onclick="this.closest('.contractor-contact-row').remove(); reindexContractorContactRows();" class="p-1.5 text-rose-500 hover:text-rose-700 transition" title="إزالة المسؤول">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
        ` : `<div class="w-7"></div>`}
    `;
    container.appendChild(div);
};

window.reindexContractorContactRows = function() {
    const container = document.getElementById('contractorContactsContainer');
    if (!container) return;
    const rows = container.querySelectorAll('.contractor-contact-row');
    rows.forEach((r, idx) => {
        const nameInput = r.querySelector('.contractor-contact-name');
        const phoneInput = r.querySelector('.contractor-contact-phone');
        if (nameInput) nameInput.placeholder = `اسم المسؤول ${idx + 1}`;
        if (phoneInput) phoneInput.placeholder = `رقم هاتف المسؤول ${idx + 1}`;
    });
};

window.openContractorModal = function(contractorId = null) {
    const form = document.getElementById('contractorForm');
    if (form) form.reset();
    document.getElementById('contractorId').value = '';
    const titleEl = document.getElementById('contractorModalTitle');
    const container = document.getElementById('contractorContactsContainer');
    if (container) container.innerHTML = '';
    
    if (contractorId) {
        if (titleEl) titleEl.textContent = 'تعديل بيانات المقاول';
        const contractor = allContractors.find(c => c.id === contractorId);
        if (contractor) {
            document.getElementById('contractorId').value = contractor.id;
            document.getElementById('contractorName').value = contractor.name || '';
            document.getElementById('contractorFinanceDept').value = contractor.finance_dept || '';
            document.getElementById('contractorFinancialPhone').value = contractor.financial_phone || '';
            document.getElementById('contractorNotes').value = contractor.notes || '';

            // Parse contacts if available
            let list = [];
            if (contractor.contacts) {
                try {
                    list = typeof contractor.contacts === 'string' ? JSON.parse(contractor.contacts) : contractor.contacts;
                } catch (e) {
                    list = [];
                }
            }
            if (Array.isArray(list) && list.length > 0) {
                list.forEach(c => addContractorContactRow(c.name || '', c.phone || ''));
            } else if (contractor.contact_person || contractor.phone) {
                // Backward compatibility: load single contact person/phone
                addContractorContactRow(contractor.contact_person || '', contractor.phone || '');
            } else {
                addContractorContactRow('', '');
            }
        }
    } else {
        if (titleEl) titleEl.textContent = 'إضافة مقاول جديد';
        addContractorContactRow('', '');
    }
    
    const modal = document.getElementById('contractorModal');
    if (modal) modal.classList.remove('hidden');
};

window.closeContractorModal = function() {
    const modal = document.getElementById('contractorModal');
    if (modal) modal.classList.add('hidden');
};

window.saveContractorForm = async function(event) {
    event.preventDefault();
    const id = document.getElementById('contractorId').value;
    
    // Collect Contacts
    const contacts = [];
    const contactRows = document.querySelectorAll('#contractorContactsContainer .contractor-contact-row');
    contactRows.forEach(row => {
        const cName = (row.querySelector('.contractor-contact-name')?.value || '').trim();
        const cPhone = (row.querySelector('.contractor-contact-phone')?.value || '').trim();
        if (cName || cPhone) {
            contacts.push({ name: cName, phone: cPhone });
        }
    });

    const contactsJson = contacts.length > 0 ? JSON.stringify(contacts) : null;
    const primaryContact = contacts.length > 0 ? contacts[0] : null;

    const payload = {
        name: document.getElementById('contractorName').value.trim(),
        contact_person: primaryContact ? primaryContact.name : null,
        phone: primaryContact ? primaryContact.phone : null,
        contacts: contactsJson,
        finance_dept: document.getElementById('contractorFinanceDept').value.trim() || null,
        financial_phone: document.getElementById('contractorFinancialPhone').value.trim() || null,
        notes: document.getElementById('contractorNotes').value.trim() || null
    };
    
    try {
        let response;
        if (id) {
            response = await authFetch(`${CONTRACTORS_URL}/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } else {
            response = await authFetch(`${CONTRACTORS_URL}/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        }
        
        if (!response.ok) throw new Error('فشل حفظ بيانات المقاول');
        
        showToast(id ? 'تم تعديل بيانات المقاول بنجاح' : 'تم إضافة المقاول بنجاح', 'bg-emerald-500', '✓');
        closeContractorModal();
        await loadContractors();
    } catch (e) {
        showToast(e.message, 'bg-rose-500', '✗');
    }
};

window.loadContractors = async function() {
    const tbody = document.getElementById('projectContractorsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-slate-500">جاري تحميل قائمة المقاولين...</td></tr>';
    
    try {
        const response = await authFetch(`${CONTRACTORS_URL}/`);
        if (!response.ok) throw new Error('فشل جلب المقاولين');
        const contractors = await response.json();
        allContractors = contractors;
        
        tbody.innerHTML = '';
        if (contractors.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-slate-500">لا يوجد مقاولين مضافين بعد.</td></tr>';
            return;
        }
        
        contractors.forEach(c => {
            // Parse contacts if available
            let contactsList = [];
            if (c.contacts) {
                try {
                    contactsList = typeof c.contacts === 'string' ? JSON.parse(c.contacts) : c.contacts;
                } catch (e) {
                    contactsList = [];
                }
            } else if (c.contact_person || c.phone) {
                contactsList = [{ name: c.contact_person || '', phone: c.phone || '' }];
            }

            let contactsHtml = '';
            if (Array.isArray(contactsList) && contactsList.length > 0) {
                contactsHtml = `
                    <div class="space-y-1">
                        ${contactsList.map(cnt => `
                            <div class="text-xs flex items-center gap-1.5 bg-slate-50 border border-slate-200/60 px-2 py-0.5 rounded-md">
                                <span class="font-bold text-slate-800">${escapeHtml(cnt.name || '')}</span>
                                ${cnt.phone ? `<span class="text-slate-500 font-mono" dir="ltr">(${escapeHtml(cnt.phone)})</span>` : ''}
                            </div>
                        `).join('')}
                    </div>
                `;
            } else {
                contactsHtml = '<span class="text-slate-400 text-xs">-</span>';
            }

            const tr = document.createElement('tr');
            tr.className = 'border-b hover:bg-slate-50 transition text-sm';
            tr.innerHTML = `
                <td class="p-4 font-bold text-slate-800">${escapeHtml(c.name)}</td>
                <td class="p-4">${contactsHtml}</td>
                <td class="p-4 text-slate-700">${escapeHtml(c.finance_dept || '-')}</td>
                <td class="p-4 text-slate-700" dir="ltr">${escapeHtml(c.financial_phone || '-')}</td>
                <td class="p-4 text-slate-600 text-xs">${escapeHtml(c.notes || '-')}</td>
                <td class="p-4 text-center">
                    <button onclick="openContractorModal(${c.id})" class="text-indigo-600 hover:text-indigo-800 p-1" title="تعديل">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button onclick="deleteContractorItem(${c.id})" class="text-rose-600 hover:text-rose-800 p-1" title="حذف">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-rose-500">${e.message}</td></tr>`;
    }
};

window.deleteContractorItem = async function(contractorId) {
    if (!confirm('هل أنت متأكد من حذف هذا المقاول؟')) return;
    try {
        const response = await authFetch(`${CONTRACTORS_URL}/${contractorId}`, {
            method: 'DELETE'
        });
        if (!response.ok) throw new Error('فشل حذف المقاول');
        showToast('تم حذف المقاول بنجاح', 'bg-emerald-500', '✓');
        await loadContractors();
    } catch (e) {
        showToast(e.message, 'bg-rose-500', '✗');
    }
};

async function loadContractorOptions(selectedName = '') {
    const selectEl = document.getElementById('pwContractor');
    if (!selectEl) return;
    
    selectEl.innerHTML = '<option value="">بدون</option>';
    
    try {
        const response = await authFetch(`${CONTRACTORS_URL}/`);
        if (!response.ok) return;
        const contractors = await response.json();
        allContractors = contractors;
        
        contractors.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.name;
            opt.textContent = c.name;
            if (selectedName && selectedName === c.name) {
                opt.selected = true;
            }
            selectEl.appendChild(opt);
        });
        
        if (selectedName && !contractors.some(c => c.name === selectedName)) {
            const opt = document.createElement('option');
            opt.value = selectedName;
            opt.textContent = selectedName;
            opt.selected = true;
            selectEl.appendChild(opt);
        }
    } catch (e) {
        console.error("Failed loading contractor options:", e);
    }
}

window.handleContractorSelectChange = function(selectElem) {
    const selectedName = selectElem ? selectElem.value : '';
    updateEngineerFieldState(selectedName);
};

window.updateEngineerFieldState = function(contractorName, selectedEngName = '', selectedEngPhone = '') {
    const engNameInput = document.getElementById('pwEngineerName');
    const engSelect = document.getElementById('pwEngineerSelect');
    const engPhoneInput = document.getElementById('pwEngineerPhone');
    
    if (!engNameInput || !engSelect || !engPhoneInput) return;

    if (!contractorName) {
        // No contractor selected: revert to free text input
        engSelect.classList.add('hidden');
        engSelect.innerHTML = '<option value="">-- اختر مسؤول الموقع --</option>';
        engNameInput.classList.remove('hidden');
        engNameInput.readOnly = false;
        if (!selectedEngName) engNameInput.value = '';
        engPhoneInput.readOnly = false;
        engPhoneInput.classList.remove('bg-slate-100', 'cursor-not-allowed');
        if (!selectedEngPhone) engPhoneInput.value = '';
        return;
    }

    const contractor = (allContractors || []).find(c => c.name === contractorName);
    let contactsList = [];
    if (contractor) {
        if (contractor.contacts) {
            try {
                contactsList = typeof contractor.contacts === 'string' ? JSON.parse(contractor.contacts) : contractor.contacts;
            } catch (e) {
                contactsList = [];
            }
        }
        if ((!contactsList || contactsList.length === 0) && (contractor.contact_person || contractor.phone)) {
            contactsList = [{ name: contractor.contact_person || '', phone: contractor.phone || '' }];
        }
    }

    // Switch to select dropdown
    engNameInput.classList.add('hidden');
    engSelect.classList.remove('hidden');
    engSelect.innerHTML = '';

    if (contactsList.length === 0) {
        engSelect.innerHTML = '<option value="">(لا يوجد مسؤولو تواصل مسجلون لدى المقاول)</option>';
        engNameInput.value = '';
        engPhoneInput.value = '';
        engPhoneInput.readOnly = true;
        engPhoneInput.classList.add('bg-slate-100', 'cursor-not-allowed');
        return;
    }

    engSelect.innerHTML = '<option value="">-- اختر مسؤول الموقع --</option>';
    let matchedOption = null;

    contactsList.forEach((cnt, idx) => {
        const opt = document.createElement('option');
        opt.value = cnt.name || '';
        opt.dataset.phone = cnt.phone || '';
        opt.textContent = cnt.phone ? `${cnt.name} (${cnt.phone})` : cnt.name;
        if (selectedEngName && cnt.name === selectedEngName) {
            opt.selected = true;
            matchedOption = opt;
        }
        engSelect.appendChild(opt);
    });

    // Auto-select if there is only 1 contact or if matched
    if (!matchedOption && contactsList.length === 1) {
        engSelect.selectedIndex = 1;
        matchedOption = engSelect.options[1];
    }

    if (matchedOption) {
        engNameInput.value = matchedOption.value;
        engPhoneInput.value = matchedOption.dataset.phone || selectedEngPhone || '';
    } else {
        engNameInput.value = '';
        engPhoneInput.value = '';
    }

    // Phone is read-only and bound to the contractor's contact
    engPhoneInput.readOnly = true;
    engPhoneInput.classList.add('bg-slate-100', 'cursor-not-allowed');
};

window.handleEngineerSelectChange = function(selectElem) {
    const engNameInput = document.getElementById('pwEngineerName');
    const engPhoneInput = document.getElementById('pwEngineerPhone');
    const selectedOption = selectElem.options[selectElem.selectedIndex];

    if (!selectedOption || !selectedOption.value) {
        if (engNameInput) engNameInput.value = '';
        if (engPhoneInput) engPhoneInput.value = '';
        return;
    }

    if (engNameInput) engNameInput.value = selectedOption.value;
    if (engPhoneInput) engPhoneInput.value = selectedOption.dataset.phone || '';
};

function openProjectWizard(fromHistory = false) {
    if (!fromHistory) {
        pushNavigationState('projectWizard');
    }

    const _pView = document.getElementById('purchasingView');
    if(_pView) _pView.classList.add('hidden');
    const _prdView = document.getElementById('purchaseRequestDetailView');
    if(_prdView) _prdView.classList.add('hidden');

    currentEditingProjectId = null;
    currentEditingProjectStatus = "pending";
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
    updateEngineerFieldState('');
    loadContractorOptions();
    loadFireDoorRules();
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
    const progressMap = { 1: '0%', 2: '50%', 3: '100%' };
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

function toggleWindowInputs(element) {
    const tr = element.closest('tr');
    if (!tr) return;
    const specSelect = tr.querySelector('.pd-spec-select');
    const widthInput = tr.querySelector('.pd-window-width');
    const heightInput = tr.querySelector('.pd-window-height');
    const posSelect = tr.querySelector('.pd-window-position');
    if (!specSelect || !widthInput || !heightInput || !posSelect) return;
    
    const val = (specSelect.value || '').trim().toUpperCase();
    const isWindowActive = (val === 'VP' || val === 'GMP' || val === 'GMB');
    
    if (isWindowActive) {
        widthInput.disabled = false;
        heightInput.disabled = false;
        posSelect.disabled = false;
        widthInput.classList.remove('bg-slate-100', 'cursor-not-allowed');
        heightInput.classList.remove('bg-slate-100', 'cursor-not-allowed');
        posSelect.classList.remove('bg-slate-100', 'cursor-not-allowed');
    } else {
        widthInput.value = '';
        heightInput.value = '';
        posSelect.value = '';
        widthInput.disabled = true;
        heightInput.disabled = true;
        posSelect.disabled = true;
        widthInput.classList.add('bg-slate-100', 'cursor-not-allowed');
        heightInput.classList.add('bg-slate-100', 'cursor-not-allowed');
        posSelect.classList.add('bg-slate-100', 'cursor-not-allowed');
    }
}
window.toggleWindowInputs = toggleWindowInputs;

// Standard Profile Types and Options Builder
window.buildProfileSelectOptions = function(selectedVal) {
    const std = [
        { id: "single rabbit with rubber", label: "single rabbit with rubber" },
        { id: "single rabbit without rubber", label: "single rabbit without rubber" },
        { id: "double rabbit with rubber", label: "double rabbit with rubber" },
        { id: "double rabbit without rubber", label: "double rabbit without rubber" }
    ];
    let opts = `<option value="" disabled ${!selectedVal ? 'selected' : ''}>المقطع</option>`;
    const added = new Set();
    const norm = (selectedVal || '').trim().toLowerCase();

    std.forEach(p => {
        added.add(p.id.toLowerCase());
        let isSel = norm === p.id.toLowerCase();
        if (!isSel && norm === 'single rabbit' && p.id === 'single rabbit without rubber') isSel = true;
        if (!isSel && norm === 'double rabbit' && p.id === 'double rabbit without rubber') isSel = true;
        opts += `<option value="${p.id}" ${isSel ? 'selected' : ''}>${p.id}</option>`;
    });

    if (Array.isArray(dbProfileOptions)) {
        dbProfileOptions.forEach(opt => {
            const optLower = (opt.name || '').trim().toLowerCase();
            if (!added.has(optLower) && optLower !== 'single rabbit' && optLower !== 'double rabbit') {
                added.add(optLower);
                const isSel = norm === optLower;
                opts += `<option value="${opt.name}" ${isSel ? 'selected' : ''}>${opt.name}</option>`;
            }
        });
    }
    return opts;
};

// Automatic Dimension Defaults when Profile Type is changed in Door Row
window.onDoorRowProfileChange = function(selectEl) {
    if (!selectEl) return;
    const tr = selectEl.closest('tr');
    if (!tr) return;
    const pType = (selectEl.value || '').toLowerCase();
    const arch1Input = tr.querySelector('.pd-architrave-input') || tr.querySelector('input[placeholder="الكشفة"]');
    const arch2Input = tr.querySelector('.pd-architrave-2-input') || tr.querySelector('input[placeholder="الكشفة 2"]');
    const depthInput = tr.querySelector('input[placeholder="عمق"]') || tr.querySelectorAll('input')[4];

    if (pType.includes('without') || pType.includes('بدون')) {
        if (pType.includes('double') || pType.includes('مزدوج')) {
            // Double rabbit without rubber
            if (arch1Input) arch1Input.value = "4.0";
            if (arch2Input) arch2Input.value = "4.0";
            if (depthInput && (!depthInput.value || parseFloat(depthInput.value) <= 0)) depthInput.value = "15.0";
        } else {
            // Single rabbit without rubber
            if (arch1Input) arch1Input.value = "5.5";
            if (arch2Input) arch2Input.value = "4.0";
            if (depthInput && (!depthInput.value || parseFloat(depthInput.value) <= 0)) depthInput.value = "15.0";
        }
    } else if (pType.includes('double') || pType.includes('مزدوج')) {
        // Double rabbit with rubber
        if (arch1Input) arch1Input.value = "5.0";
        if (arch2Input) arch2Input.value = "5.0";
        if (depthInput && (!depthInput.value || parseFloat(depthInput.value) <= 0)) depthInput.value = "16.0";
    } else {
        // Single rabbit with rubber
        if (arch1Input) arch1Input.value = "4.0";
        if (arch2Input) arch2Input.value = "6.2";
        if (depthInput && (!depthInput.value || parseFloat(depthInput.value) <= 0)) depthInput.value = "15.0";
    }

    if (typeof autoCalculateLeafSizes === 'function') {
        const widthInput = tr.querySelector('.pd-width-input');
        if (widthInput) autoCalculateLeafSizes(widthInput);
    }
};

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

    let profileSelectOpts = window.buildProfileSelectOptions(currentDefaultProfile);

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
            <option value="GMP" ${currentDefaultSpec === 'GMP' || currentDefaultSpec === 'GMB' ? 'selected' : ''}>GMP</option>
        `;
    }

    tr.innerHTML = `
        <td class="p-2"><input type="text" class="w-16 px-2 py-1 border rounded text-center font-bold" placeholder="رقم" value="${nextDoorNumber}"></td>
        <td class="p-2"><input type="number" class="w-16 px-2 py-1 border rounded text-center" placeholder="العدد" value="1" min="1"></td>
        <td class="p-2"><input type="number" step="0.01" class="pd-width-input w-16 px-2 py-1 border rounded text-center" placeholder="عرض" oninput="autoCalculateLeafSizes(this)"></td>
        <td class="p-2"><input type="number" step="0.01" class="w-16 px-2 py-1 border rounded text-center" placeholder="طول"></td>
        <td class="p-2"><input type="number" step="0.01" class="w-16 px-2 py-1 border rounded text-center" placeholder="عمق"></td>
        <td class="p-2">
            <select class="w-full px-2 py-1 border rounded bg-white text-sm">
                <option value="" disabled selected>الاتجاه</option>
                <option value="RH">RH</option>
                <option value="LH">LH</option>
                <option value="RA">RA</option>
                <option value="LA">LA</option>
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
            <select class="pd-profile-type w-full px-2 py-1 border rounded bg-white text-sm" onchange="onDoorRowProfileChange(this)">
                ${profileSelectOpts}
            </select>
        </td>
        <td class="p-2">
            <select class="pd-doortype-select w-full px-2 py-1 border rounded bg-white text-sm" onchange="autoCalculateLeafSizes(this)">
                ${doorTypeSelectOpts}
            </select>
        </td>
        <td class="p-2"><input type="number" step="0.01" class="pd-leaf1-input w-20 px-2 py-1 border rounded text-center bg-slate-100" placeholder="قياس الدرفة" readonly oninput="onLeafSize1Input(this)"></td>
        <td class="p-2"><input type="number" step="0.01" class="pd-leaf2-input w-20 px-2 py-1 border rounded text-center bg-slate-100" placeholder="قياس الدرفة 2" readonly></td>
        <td class="p-2">
            <select class="pd-spec-select w-full px-2 py-1 border rounded bg-white text-sm" onchange="toggleWindowInputs(this)">
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
        <td class="p-2"><input type="text" class="pd-architrave-input w-full px-2 py-1 border rounded" placeholder="الكشفة" oninput="autoCalculateArchitrave2(this); autoCalculateLeafSizes(this);" value="${currentDefaultArchitrave || ''}"></td>
        <td class="p-2"><input type="text" class="pd-architrave-2-input w-full px-2 py-1 border rounded" placeholder="الكشفة 2" value="${currentDefaultArchitrave ? (parseFloat(currentDefaultArchitrave) + 2.2).toFixed(1) : ''}"></td>
        <td class="p-2"><input type="text" class="w-full px-2 py-1 border rounded" placeholder="تحت البلاط" value="${currentDefaultUnderTile || ''}"></td>
        <td class="p-2"><input type="number" step="0.1" class="pd-window-width w-20 px-2 py-1 border rounded text-center bg-slate-100 cursor-not-allowed" placeholder="العرض" disabled></td>
        <td class="p-2"><input type="number" step="0.1" class="pd-window-height w-20 px-2 py-1 border rounded text-center bg-slate-100 cursor-not-allowed" placeholder="الارتفاع" disabled></td>
        <td class="p-2">
            <select class="pd-window-position w-24 px-2 py-1 border rounded bg-slate-100 text-sm cursor-not-allowed" disabled>
                <option value="">--</option>
                <option value="Center">Center</option>
                <option value="Side">Side</option>
            </select>
        </td>
        <td class="p-2 text-center"><input type="checkbox" class="w-4 h-4"></td>
        <td class="p-2"><input type="text" class="pd-notes-input w-full px-2 py-1 border rounded" placeholder="ملاحظات"></td>
        <td class="p-2 text-center">
            <div class="flex items-center justify-center gap-1">
                <button type="button" onclick="openDoorElevationFromWizardRow(this)" class="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer border border-indigo-200 shadow-xs" title="معاينة وتعديل شكل الباب">
                    <span>🚪</span>
                    <span>الباب</span>
                </button>
                <button type="button" onclick="openDoorProfileFromWizardRow(this)" class="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer border border-slate-200 shadow-xs" title="معاينة وتعديل مقطع الحلق">
                    <span>📐</span>
                    <span>المقطع</span>
                </button>
            </div>
        </td>
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

    // Profile select
    const profSel = tr.querySelector('.pd-profile-type') || selects[4];
    if (profSel) {
        profSel.addEventListener('change', function() {
            const isFirstRow = (tr.previousElementSibling === null);
            if (isFirstRow) {
                firstRowProfileChangeCount++;
                if (firstRowProfileChangeCount === 1) {
                    currentDefaultProfile = this.value;
                    const rows = tbody.querySelectorAll('tr');
                    rows.forEach((row, idx) => {
                        if (idx > 0) {
                            const targetSel = row.querySelector('.pd-profile-type') || row.querySelectorAll('select')[4];
                            if (targetSel) {
                                targetSel.value = currentDefaultProfile;
                                window.onDoorRowProfileChange(targetSel);
                            }
                        }
                    });
                }
            }
        });
    }

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
                            autoCalculateLeafSizes(rowSelects[5]);
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
                            toggleWindowInputs(rowSelects[6]);
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
            window.allProjectsData = projects;
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

                const risk = calculateProjectDelayRisk(p);
                let riskBadgeClass = 'bg-slate-50 text-slate-600 border-slate-200';
                if (risk.level === 'danger') riskBadgeClass = 'bg-rose-50 text-rose-700 border-rose-200';
                else if (risk.level === 'warning') riskBadgeClass = 'bg-amber-50 text-amber-700 border-amber-200';
                else if (risk.level === 'completed') riskBadgeClass = 'bg-blue-50 text-blue-700 border-blue-200';
                else if (risk.level === 'safe') riskBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                const riskBadge = `<span class="px-2.5 py-1 rounded-lg font-bold text-xs border ${riskBadgeClass}">${risk.label}</span>`;
                
                tr.innerHTML = `
                    <td class="p-4 font-bold text-slate-800">${p.project_number || '-'}</td>
                    <td class="p-4 font-semibold text-slate-700 hover:text-indigo-600 transition">${p.name || '-'}</td>
                    <td class="p-4 text-slate-500">${p.contractor_name || '-'}</td>
                    <td class="p-4 text-slate-500" dir="ltr">${p.delivery_date ? new Date(p.delivery_date).toLocaleDateString() : '-'}</td>
                    <td class="p-4">${statusBadge}</td>
                    <td class="p-4">${riskBadge}</td>
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

async function viewProjectDetails(id, fromHistory = false) {
    if (!fromHistory) {
        pushNavigationState('projectDetail', { id: id });
    }

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
        
        function renderStaticBadge(status) {
            if (status === 'active') return '<span class="px-4 py-2 bg-emerald-100 text-emerald-800 rounded-xl font-bold border border-emerald-200">مشروع فعال</span>';
            if (status === 'completed') return '<span class="px-4 py-2 bg-blue-100 text-blue-800 rounded-xl font-bold border border-blue-200">مشروع منتهي</span>';
            return '<span class="px-4 py-2 bg-amber-100 text-amber-800 rounded-xl font-bold border border-amber-200">قيد الانتظار</span>';
        }
        
        const statusBadgeHtml = renderStaticBadge(p.status);
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
        badge.innerHTML = `<div class="flex items-center">` + statusBadgeHtml + trackHtml + editHtml + deleteHtml + `</div>`;
        
        const tbody = document.getElementById('pdEngineeringTableBody');
        tbody.innerHTML = '';
        if (p.details && p.details.length > 0) {
            p.details.forEach((d, dIdx) => {
                const tr = document.createElement('tr');
                tr.className = 'border-b hover:bg-indigo-50/50 transition text-sm cursor-pointer group';
                tr.title = 'انقر على الباب لمعاينة رسمة وواجهة الباب التفاعلية';
                tr.onclick = (e) => {
                    if (e && e.target && e.target.closest('input, select, textarea, button')) return;
                    window.openDoorElevationFromProject(dIdx, d);
                };
                tr.innerHTML = `
                    <td class="p-3 font-bold text-indigo-600 group-hover:text-indigo-900 flex items-center justify-between gap-2 font-mono">
                        <div class="flex items-center gap-1.5">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-indigo-400 group-hover:text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            <span>${d.door_number || '-'}</span>
                        </div>
                        <div class="flex items-center gap-1">
                            <button type="button" onclick="event.stopPropagation(); window.openDoorElevationFromProject(${dIdx});" class="text-[11px] font-sans px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-md border border-indigo-200 transition font-bold cursor-pointer flex items-center gap-1 shadow-xs" title="معاينة شكل الباب التفاعلي">🚪 الباب</button>
                            <button type="button" onclick="event.stopPropagation(); window.openDoorProfileFromProject(${dIdx});" class="text-[11px] font-sans px-2 py-0.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-md border border-slate-200 transition font-bold cursor-pointer flex items-center gap-1 shadow-xs" title="معاينة مقطع الحلق">📐 المقطع</button>
                        </div>
                    </td>
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
                    <td class="p-3 font-semibold text-indigo-700">${d.leaf_size || '-'}</td>
                    <td class="p-3 font-semibold text-indigo-700">${d.leaf_size_2 || '-'}</td>
                    <td class="p-3">${d.specifications || '-'}</td>
                    <td class="p-3 font-semibold text-slate-700">${d.leaf_thickness || '4.5'}</td>
                    <td class="p-3 text-center">${d.qashatah === 'YES' ? 'نعم' : 'لا'}</td>
                    <td class="p-3 text-center">${d.fire_resistance || '-'}</td>
                    <td class="p-3">${d.architrave || '-'}</td>
                    <td class="p-3">${d.architrave_2 || '-'}</td>
                    <td class="p-3">${d.under_tile || '-'}</td>
                    <td class="p-3 font-semibold text-slate-700">${d.window_width || '-'}</td>
                    <td class="p-3 font-semibold text-slate-700">${d.window_height || '-'}</td>
                    <td class="p-3 font-semibold text-slate-700">${d.window_position || '-'}</td>
                    <td class="p-3 text-center">${d.raddad === 'YES' ? 'نعم' : 'لا'}</td>
                    <td class="p-3">${(d.notes || '').replace(/\[PROFILE:.*?\]/g, '').trim() || '-'}</td>
                `;
                tbody.appendChild(tr);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="25" class="p-4 text-center text-slate-500">لا يوجد تفاصيل هندسية مسجلة</td></tr>';
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
        const btnPreview = document.getElementById('btnOpenSheetPreview');
        if (btnPreview) btnPreview.classList.add('hidden');
        window.currentSheetNestingData = null;
        const resActions = document.getElementById('projectReservationActions');
        if (resActions) resActions.classList.add('hidden');

        // New Project Enhancements: Delay Alert, Handover, Change Orders, Punch List
        checkAndDisplayDelayAlert(p);
        renderSignedHandoverCard(p);
        loadProjectChangeOrders(p.id, p);
        loadProjectPunchList(p.id, p);
        
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
                status: (currentEditingProjectId && currentEditingProjectStatus) ? currentEditingProjectStatus : "pending"
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
                const arch1El = tr.querySelector('.pd-architrave-input') || tr.querySelector('input[placeholder="الكشفة"]');
                const arch2El = tr.querySelector('.pd-architrave-2-input') || tr.querySelector('input[placeholder="الكشفة 2"]');
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
                    leaf_size: inputs[11].value || null,
                    leaf_size_2: inputs[12].value || null,
                    specifications: inputs[13].value || null,
                    leaf_thickness: inputs[14].value || "4.5",
                    qashatah: inputs[15].checked ? 'YES' : 'NO',
                    fire_resistance: inputs[16].checked ? 'Yes' : 'No',
                    architrave: arch1El ? (arch1El.value || null) : (inputs[17] ? inputs[17].value : null),
                    architrave_2: arch2El ? (arch2El.value || null) : (inputs[18] ? inputs[18].value : null),
                    under_tile: inputs[19].value || null,
                    window_width: inputs[20].value || null,
                    window_height: inputs[21].value || null,
                    window_position: inputs[22].value || null,
                    window_details: (inputs[20].value && inputs[21].value) ? `${inputs[20].value}x${inputs[21].value}${inputs[22].value ? ' (' + inputs[22].value + ')' : ''}` : null,
                    raddad: inputs[23].checked ? 'YES' : 'NO',
                    notes: (tr.querySelector('.pd-notes-input') ? tr.querySelector('.pd-notes-input').value : (inputs[24] ? inputs[24].value : null)) || null
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


window.updateProjectStatus = async function(projectId, newStatus) {
    try {
        const response = await authFetch(`${PROJECTS_URL}/${projectId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        if (!response.ok) throw new Error('فشل تحديث حالة المشروع');
        showToast('تم تحديث حالة المشروع بنجاح', 'bg-emerald-500', '✓');
        // Refresh details view if open
        const pdView = document.getElementById('projectDetailView');
        if (pdView && !pdView.classList.contains('hidden') && window.currentProjectData && window.currentProjectData.id === projectId) {
            viewProjectDetails(projectId);
        }
        // Refresh main table if open
        loadProjects();
    } catch (e) {
        showToast(e.message, 'bg-rose-500', '✗');
    }
};

window.openProjectActivationModal = async function() {
    const modal = document.getElementById('projectActivationModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    await renderProjectActivationList();
};

window.closeProjectActivationModal = function() {
    const modal = document.getElementById('projectActivationModal');
    if (modal) modal.classList.add('hidden');
};

function getStatusSelectColorClass(status) {
    if (status === 'active' || status === 'فعال') return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    if (status === 'completed' || status === 'مكتمل') return 'bg-blue-100 text-blue-800 border-blue-300';
    return 'bg-amber-100 text-amber-800 border-amber-300';
}

function getDeliverySelectColorClass(delivery) {
    if (delivery === 'approved' || delivery === 'موافق') return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    return 'bg-rose-100 text-rose-800 border-rose-300';
}

async function renderProjectActivationList() {
    const tbody = document.getElementById('projectActivationTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-slate-500">جاري جلب المشاريع...</td></tr>';
    
    try {
        const response = await authFetch(PROJECTS_URL + '/');
        if (!response.ok) throw new Error('فشل جلب المشاريع');
        const projects = await response.json();
        
        if (projects.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-slate-500">لا توجد مشاريع مسجلة.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        projects.forEach(p => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-slate-50 transition border-b border-slate-100';
            
            const currentStatus = p.status ? p.status.toLowerCase() : 'pending';
            const currentDelivery = p.delivery_approval ? p.delivery_approval.toLowerCase() : 'stopped';
            
            tr.innerHTML = `
                <td class="p-3 font-bold text-slate-800">${p.project_number || p.id}</td>
                <td class="p-3 font-bold text-slate-900">${p.name}</td>
                <td class="p-3 text-center">
                    <select onchange="changeProjectStatusFromModal(${p.id}, this)" class="px-3 py-1.5 rounded-xl font-bold border text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer ${getStatusSelectColorClass(currentStatus)}">
                        <option value="pending" ${currentStatus === 'pending' ? 'selected' : ''}>قيد الانتظار (Pending)</option>
                        <option value="active" ${currentStatus === 'active' ? 'selected' : ''}>فعال (Active)</option>
                        <option value="completed" ${currentStatus === 'completed' ? 'selected' : ''}>مكتمل (Completed)</option>
                    </select>
                </td>
                <td class="p-3 text-center">
                    <select onchange="changeDeliveryApprovalFromModal(${p.id}, this)" class="px-3 py-1.5 rounded-xl font-bold border text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer ${getDeliverySelectColorClass(currentDelivery)}">
                        <option value="stopped" ${currentDelivery === 'stopped' ? 'selected' : ''}>موقوف</option>
                        <option value="approved" ${currentDelivery === 'approved' ? 'selected' : ''}>موافق</option>
                    </select>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-rose-500">${e.message}</td></tr>`;
    }
}

window.changeProjectStatusFromModal = async function(projectId, selectElem) {
    const newStatus = selectElem.value;
    try {
        await updateProjectStatus(projectId, newStatus);
        selectElem.className = `px-3 py-1.5 rounded-xl font-bold border text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer ${getStatusSelectColorClass(newStatus)}`;
    } catch (e) {
        console.error("Failed to change status from modal:", e);
    }
};

window.changeDeliveryApprovalFromModal = async function(projectId, selectElem) {
    const newApproval = selectElem.value;
    try {
        const response = await authFetch(`${PROJECTS_URL}/${projectId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ delivery_approval: newApproval })
        });
        if (!response.ok) throw new Error('فشل تحديث حالة موافقة التسليم');
        showToast('تم تحديث حالة التسليم بنجاح', 'bg-emerald-500', '✓');
        selectElem.className = `px-3 py-1.5 rounded-xl font-bold border text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer ${getDeliverySelectColorClass(newApproval)}`;
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

window.downloadProjectDXF = async function() {
    if (!window.currentProjectData || !window.currentProjectData.details || window.currentProjectData.details.length === 0) {
        showToast('لا توجد تفاصيل هندسية لتصديرها كملف DXF', 'bg-rose-500', '✗');
        return;
    }

    const projectId = window.currentProjectData.id;
    const projectNumber = window.currentProjectData.project_number || projectId;

    showToast('جاري توليد ملف DXF ومخططات القطع...', 'bg-blue-600', '⏳');

    try {
        const response = await authFetch(`/api/projects/${projectId}/dxf`, {
            method: 'GET'
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.detail || 'فشل توليد وتصدير ملف الـ DXF');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `Project_${projectNumber}_CAD.dxf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        showToast('تم تصدير ملف الـ DXF بنجاح', 'bg-emerald-600', '✓');
    } catch (err) {
        console.error('DXF export error:', err);
        showToast(err.message || 'حدث خطأ أثناء تصدير ملف DXF', 'bg-rose-500', '✗');
    }
};

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

window.editProject = async function(projectId, fromHistory = false) {
    if (!fromHistory) {
        pushNavigationState('projectEdit', { id: projectId });
    }
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
        await loadContractorOptions(p.contractor_name || '');
        
        // Fill basic info
        document.getElementById('pwName').value = p.name || '';
        document.getElementById('pwProjectNumber').value = p.project_number || '';
        if (document.getElementById('pwContractor')) document.getElementById('pwContractor').value = p.contractor_name || '';
        if (p.delivery_date) {
            document.getElementById('pwDeliveryDate').value = p.delivery_date.split('T')[0];
        }
        updateEngineerFieldState(p.contractor_name || '', p.engineer_name || '', p.engineer_phone || '');
        document.getElementById('pwLocation').value = p.location || '';
        document.getElementById('pwMapUrl').value = p.map_url || '';
        document.getElementById('pwAssignee').value = p.executive_manager_id || '';
        document.getElementById('pwPaintColor').value = p.paint_color || '';
        if(document.getElementById('pwManufacturingType')) document.getElementById('pwManufacturingType').value = p.manufacturing_type || '';
        if(document.getElementById('pwInstallationType')) document.getElementById('pwInstallationType').value = p.installation_type || '';
        if(document.getElementById('pwNotes')) document.getElementById('pwNotes').value = p.notes || '';
        
        currentEditingProjectStatus = p.status || "pending";
        const statusRadios = document.querySelectorAll('input[name="pwStatus"]');
        if (statusRadios && statusRadios.length > 0) {
            statusRadios.forEach(r => {
                if (r.value === p.status) r.checked = true;
            });
        }
        
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

                let profileSelectOpts = window.buildProfileSelectOptions(d.profile_type || currentDefaultProfile);

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
                    <td class="p-2"><input type="number" step="0.1" class="pd-width-input w-16 px-1 py-2 border border-slate-300 rounded-lg text-sm text-center" placeholder="عرض" value="${d.width || ''}" oninput="autoCalculateLeafSizes(this)"></td>
                    <td class="p-2"><input type="number" step="0.1" class="w-16 px-1 py-2 border border-slate-300 rounded-lg text-sm text-center" value="${d.height || ''}"></td>
                    <td class="p-2"><input type="number" step="0.1" class="w-16 px-1 py-2 border border-slate-300 rounded-lg text-sm text-center" value="${d.depth || ''}"></td>
                    <td class="p-2">
                        <select class="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white">
                            <option value="" disabled ${!d.direction ? 'selected' : ''}>الاتجاه</option>
                            <option value="RH" ${d.direction === 'RH' ? 'selected' : ''}>RH</option>
                            <option value="LH" ${d.direction === 'LH' ? 'selected' : ''}>LH</option>
                            <option value="RA" ${(d.direction === 'RA' || d.direction === 'Double' || d.direction === 'D/RA') ? 'selected' : ''}>RA</option>
                            <option value="LA" ${(d.direction === 'LA' || d.direction === 'D/LA') ? 'selected' : ''}>LA</option>
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
                        <select class="pd-profile-type w-full p-2 border border-slate-300 rounded-lg text-sm bg-white" onchange="onDoorRowProfileChange(this)">
                            ${profileSelectOpts}
                        </select>
                    </td>
                    <td class="p-2">
                        <select class="pd-doortype-select w-full p-2 border border-slate-300 rounded-lg text-sm bg-white" onchange="autoCalculateLeafSizes(this)">
                            ${doorTypeSelectOpts}
                        </select>
                    </td>
                    <td class="p-2"><input type="number" step="0.01" class="pd-leaf1-input w-20 px-2 py-1 border rounded text-center bg-slate-100" placeholder="قياس الدرفة" value="${d.leaf_size || ''}" readonly oninput="onLeafSize1Input(this)"></td>
                    <td class="p-2"><input type="number" step="0.01" class="pd-leaf2-input w-20 px-2 py-1 border rounded text-center bg-slate-100" placeholder="قياس الدرفة 2" value="${d.leaf_size_2 || ''}" readonly></td>
                    <td class="p-2">
                        <select class="pd-spec-select w-full p-2 border border-slate-300 rounded-lg text-sm bg-white" onchange="toggleWindowInputs(this)">
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
                    <td class="p-2"><input type="text" class="pd-architrave-input w-full p-2 border border-slate-300 rounded-lg text-sm" placeholder="الكشفة" value="${d.architrave || ''}" oninput="autoCalculateArchitrave2(this); autoCalculateLeafSizes(this);"></td>
                    <td class="p-2"><input type="text" class="pd-architrave-2-input w-full p-2 border border-slate-300 rounded-lg text-sm" placeholder="الكشفة 2" value="${d.architrave_2 || ''}"></td>
                    <td class="p-2"><input type="text" class="w-full p-2 border border-slate-300 rounded-lg text-sm" value="${d.under_tile || ''}"></td>
                    <td class="p-2"><input type="number" step="0.1" class="pd-window-width w-20 px-2 py-2 border border-slate-300 rounded-lg text-sm text-center" placeholder="العرض" value="${d.window_width || ''}"></td>
                    <td class="p-2"><input type="number" step="0.1" class="pd-window-height w-20 px-2 py-2 border border-slate-300 rounded-lg text-sm text-center" placeholder="الارتفاع" value="${d.window_height || ''}"></td>
                    <td class="p-2">
                        <select class="pd-window-position w-24 p-2 border border-slate-300 rounded-lg text-sm bg-white">
                            <option value="" ${!d.window_position ? 'selected' : ''}>--</option>
                            <option value="Center" ${d.window_position === 'Center' ? 'selected' : ''}>Center</option>
                            <option value="Side" ${d.window_position === 'Side' ? 'selected' : ''}>Side</option>
                        </select>
                    </td>
                    <td class="p-2 text-center"><input type="checkbox" class="w-5 h-5 text-indigo-600 rounded" ${d.raddad === 'YES' ? 'checked' : ''}></td>
                    <td class="p-2"><input type="text" class="pd-notes-input w-full p-2 border border-slate-300 rounded-lg text-sm" value="${d.notes || ''}"></td>
                    <td class="p-2 text-center">
                        <div class="flex items-center justify-center gap-1">
                            <button type="button" onclick="openDoorElevationFromWizardRow(this)" class="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer border border-indigo-200 shadow-xs" title="معاينة وتعديل شكل الباب">
                                <span>🚪</span>
                                <span>الباب</span>
                            </button>
                            <button type="button" onclick="openDoorProfileFromWizardRow(this)" class="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer border border-slate-200 shadow-xs" title="معاينة وتعديل مقطع الحلق">
                                <span>📐</span>
                                <span>المقطع</span>
                            </button>
                        </div>
                    </td>
                    <td class="p-2 text-center">
                        <button type="button" onclick="this.closest('tr').remove()" class="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition" title="حذف السطر">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
                // Toggle window inputs enabled/disabled based on spec
                toggleWindowInputs(tr.querySelector('.pd-spec-select') || tr);
                // If leaf sizes not yet filled or if double leaf, calculate/update
                if (!d.leaf_size && !d.leaf_size_2) {
                    autoCalculateLeafSizes(tr.querySelector('.pd-width-input') || tr);
                } else {
                    // Update readonly/editability state
                    const dt = (d.door_type || '').toLowerCase();
                    if (dt.includes('double') || dt.includes('دبل')) {
                        const l1 = tr.querySelector('.pd-leaf1-input');
                        if (l1) {
                            l1.removeAttribute('readonly');
                            l1.classList.remove('bg-slate-100');
                        }
                    }
                }
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
            
            let isDisabled = false;
            let extraTitle = '';
            let statusSubText = '';
            if (step.key === 'step_installation') {
                const isApproved = (currentTrackingProjectData.delivery_approval || 'stopped').toLowerCase() === 'approved';
                if (!isApproved) {
                    isDisabled = true;
                    extraTitle = 'title="التسليم موقوف من قبل الإدارة، لا يمكن تعديل هذه الخطوة"';
                    statusSubText = '<span class="text-xs text-rose-500 font-bold block mt-1">⚠️ التسليم موقوف</span>';
                } else {
                    statusSubText = '<span class="text-xs text-emerald-600 font-bold block mt-1">✓ تمت الموافقة على التسليم</span>';
                }
            }
            
            tr.innerHTML = `
                <td class="p-4 font-bold text-slate-800 text-base border-l border-slate-100">${step.label}</td>
                <td class="p-4">
                    <select ${isDisabled ? 'disabled' : ''} ${extraTitle} onchange="updateTrackingStep('${step.key}', this)" class="w-full max-w-[200px] border rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 transition-colors ${isDisabled ? 'bg-slate-200 text-slate-400 border-slate-300 cursor-not-allowed opacity-75' : getStepColorClasses(currentValue)}">
                        <option value="لم يتم البدء" ${currentValue === 'لم يتم البدء' ? 'selected' : ''}>لم يتم البدء</option>
                        <option value="جاري العمل" ${currentValue === 'جاري العمل' ? 'selected' : ''}>جاري العمل</option>
                        <option value="تم الانتهاء" ${currentValue === 'تم الانتهاء' ? 'selected' : ''}>تم الانتهاء</option>
                    </select>
                    ${statusSubText}
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

const WORKFLOW_STEPS_CONFIG = [
    { key: 'step_design', label: 'التصميم' },
    { key: 'step_cutting', label: 'القص' },
    { key: 'step_forming', label: 'التشكيل' },
    { key: 'step_assembly', label: 'التجميع' },
    { key: 'step_painting', label: 'الدهان' },
    { key: 'step_accessories', label: 'الإكسسوارات' },
    { key: 'step_installation', label: 'التركيب / التسليم' }
];

function validateWorkflowStepTransition(projectData, field, newVal) {
    const idx = WORKFLOW_STEPS_CONFIG.findIndex(s => s.key === field);
    if (idx === -1) return { valid: true };

    const currentStep = WORKFLOW_STEPS_CONFIG[idx];
    const prevStep = idx > 0 ? WORKFLOW_STEPS_CONFIG[idx - 1] : null;
    const nextStep = idx < WORKFLOW_STEPS_CONFIG.length - 1 ? WORKFLOW_STEPS_CONFIG[idx + 1] : null;

    const prevVal = prevStep ? (projectData[prevStep.key] || 'لم يتم البدء') : null;
    const nextVal = nextStep ? (projectData[nextStep.key] || 'لم يتم البدء') : null;

    if (newVal === 'جاري العمل') {
        if (prevVal && prevVal !== 'جاري العمل' && prevVal !== 'تم الانتهاء') {
            return {
                valid: false,
                error: `لا يمكن تحويل خطوة (${currentStep.label}) إلى "جاري العمل" قبل أن تكون خطوة (${prevStep.label}) جاري العمل أو تم الانتهاء.`
            };
        }
        if (nextVal && nextVal === 'تم الانتهاء') {
            return {
                valid: false,
                error: `لا يمكن تحويل خطوة (${currentStep.label}) إلى "جاري العمل" لأن خطوة (${nextStep.label}) تم الانتهاء منها بالفعل.`
            };
        }
    } else if (newVal === 'تم الانتهاء') {
        if (prevVal && prevVal !== 'تم الانتهاء') {
            return {
                valid: false,
                error: `لا يمكن إنهاء خطوة (${currentStep.label}) قبل إنهاء خطوة (${prevStep.label}).`
            };
        }
    } else if (newVal === 'لم يتم البدء') {
        if (nextVal && (nextVal === 'جاري العمل' || nextVal === 'تم الانتهاء')) {
            return {
                valid: false,
                error: `لا يمكن تحويل خطوة (${currentStep.label}) إلى "لم يتم البدء" لأن خطوة (${nextStep.label}) قيد التنفيذ أو تم الانتهاء منها.`
            };
        }
    }

    return { valid: true };
}

async function updateTrackingStep(field, selectEl, explicitProjectId = null) {
    const newVal = selectEl.value;
    const targetProjectId = explicitProjectId || currentTrackingProjectId;
    if (!targetProjectId) return;

    // Determine target project object
    let targetProject = null;
    if (explicitProjectId && window.allActiveTrackingProjects) {
        targetProject = window.allActiveTrackingProjects.find(p => p.id === explicitProjectId);
    } else if (currentTrackingProjectData && currentTrackingProjectData.id === targetProjectId) {
        targetProject = currentTrackingProjectData;
    }

    const previousVal = (targetProject && targetProject[field]) || 'لم يتم البدء';

    if (targetProject) {
        const validation = validateWorkflowStepTransition(targetProject, field, newVal);
        if (!validation.valid) {
            showToast(validation.error, 'bg-rose-500', '⚠️');
            selectEl.value = previousVal;
            selectEl.className = `w-full ${selectEl.classList.contains('max-w-[200px]') ? 'max-w-[200px]' : ''} border rounded-lg px-2 py-1.5 text-xs font-bold focus:outline-none focus:ring-2 transition-colors ${getStepColorClasses(previousVal)}`;
            return;
        }
    }

    selectEl.className = `w-full ${selectEl.classList.contains('max-w-[200px]') ? 'max-w-[200px]' : ''} border rounded-lg px-2 py-1.5 text-xs font-bold focus:outline-none focus:ring-2 transition-colors ${getStepColorClasses(newVal)}`;

    try {
        const payload = {};
        payload[field] = newVal;

        const response = await authFetch(`${PROJECTS_URL}/${targetProjectId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.detail || 'فشل الحفظ التلقائي');
        }

        // Update local object state
        if (targetProject) {
            targetProject[field] = newVal;
        }
        if (currentTrackingProjectData && currentTrackingProjectData.id === targetProjectId) {
            currentTrackingProjectData[field] = newVal;
        }

        showToast('تم الحفظ بنجاح', 'bg-emerald-500', '✓');
    } catch (e) {
        // Revert select on error
        if (targetProject) {
            selectEl.value = previousVal;
            selectEl.className = `w-full ${selectEl.classList.contains('max-w-[200px]') ? 'max-w-[200px]' : ''} border rounded-lg px-2 py-1.5 text-xs font-bold focus:outline-none focus:ring-2 transition-colors ${getStepColorClasses(previousVal)}`;
        }
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
//   PROJECT ENHANCEMENTS: DELAY RISK, GANTT,
//   CHANGE ORDERS, PUNCH LIST, HANDOVER & PRINT
// ==========================================

function calculateProjectDelayRisk(p) {
    if (!p) return { level: 'safe', label: '-', color: 'slate', percent: 0, text: '' };
    if (p.status === 'completed') {
        return { level: 'completed', label: 'مكتمل ✓', color: 'blue', percent: 100, daysLeft: 0, text: 'تم إنجاز وتسليم المشروع بالكامل.' };
    }

    const steps = ['step_design', 'step_cutting', 'step_forming', 'step_assembly', 'step_painting', 'step_accessories', 'step_installation'];
    let stepScore = 0;
    steps.forEach(k => {
        const val = p[k] || '';
        if (val === 'مكتمل') stepScore += 100;
        else if (val === 'قيد التنفيذ') stepScore += 50;
    });
    const percent = Math.round(stepScore / steps.length);

    if (!p.delivery_date) {
        return { level: 'normal', label: `${percent}% منجز`, color: 'slate', percent, daysLeft: null, text: `نسبة الإنجاز الحالية ${percent}% (لم يحدد موعد تسليم نهائي)` };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(p.delivery_date);
    targetDate.setHours(0, 0, 0, 0);
    const diffTime = targetDate - today;
    const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (daysLeft < 0) {
        return {
            level: 'danger',
            label: `متأخر ${Math.abs(daysLeft)} يوم`,
            color: 'rose',
            percent,
            daysLeft,
            text: `المشروع متأخر عن موعد التسليم بـ ${Math.abs(daysLeft)} يوم! نسبة الإنجاز الحالية: ${percent}% فقط.`
        };
    } else if (daysLeft <= 3 && percent < 90) {
        return {
            level: 'danger',
            label: `حرج (متبقي ${daysLeft} يوم)`,
            color: 'rose',
            percent,
            daysLeft,
            text: `تنبيه حرج: متبقي ${daysLeft} أيام فقط على موعد التسليم ونسبة الإنجاز ${percent}%. يتطلب تدخلاً فورياً لتفادي التأخير.`
        };
    } else if (daysLeft <= 7 && percent < 70) {
        return {
            level: 'warning',
            label: `تحذير (متبقي ${daysLeft} يوم)`,
            color: 'amber',
            percent,
            daysLeft,
            text: `اقتراب موعد التسليم (متبقي ${daysLeft} أيام) مع تبقي مراحل رئيسية غير مكتملة (إنجاز ${percent}%).`
        };
    } else if (daysLeft <= 14 && percent < 40) {
        return {
            level: 'warning',
            label: `تنبيه (متبقي ${daysLeft} يوم)`,
            color: 'amber',
            percent,
            daysLeft,
            text: `متبقي أسبوعين على موعد التسليم ومعدل التقدم الحالي ${percent}%. يرجى تسريع وتيرة الإنتاج.`
        };
    } else {
        return {
            level: 'safe',
            label: `متبقي ${daysLeft} يوم (${percent}%)`,
            color: 'emerald',
            percent,
            daysLeft,
            text: `الجدول الزمني يسير بصورة طبيعية. متبقي ${daysLeft} يوم ومعدل الإنجاز ${percent}%.`
        };
    }
}

function checkAndDisplayDelayAlert(p) {
    const banner = document.getElementById('pdEarlyWarningBanner');
    if (!banner) return;

    const risk = calculateProjectDelayRisk(p);
    const iconEl = document.getElementById('pdDelayAlertIcon');
    const titleEl = document.getElementById('pdDelayAlertTitle');
    const msgEl = document.getElementById('pdDelayAlertMsg');
    const actionEl = document.getElementById('pdDelayAlertAction');

    if (risk.level === 'danger') {
        banner.className = 'rounded-2xl p-4 border flex items-center justify-between gap-4 animate-fade-in bg-rose-50 border-rose-200 text-rose-900';
        if (iconEl) {
            iconEl.className = 'w-10 h-10 rounded-xl bg-rose-200 text-rose-700 flex items-center justify-center shrink-0';
            iconEl.innerHTML = `<svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>`;
        }
        if (titleEl) titleEl.textContent = 'تنبيه مبكر: خطر تأخير موعد التسليم!';
        if (msgEl) msgEl.textContent = risk.text;
        if (actionEl) actionEl.innerHTML = `<button onclick="openProjectTracking(${p.id})" class="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow transition cursor-pointer">متابعة مراحل الإنتاج</button>`;
        banner.classList.remove('hidden');
    } else if (risk.level === 'warning') {
        banner.className = 'rounded-2xl p-4 border flex items-center justify-between gap-4 animate-fade-in bg-amber-50 border-amber-200 text-amber-900';
        if (iconEl) {
            iconEl.className = 'w-10 h-10 rounded-xl bg-amber-200 text-amber-800 flex items-center justify-center shrink-0';
            iconEl.innerHTML = `<svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`;
        }
        if (titleEl) titleEl.textContent = 'ملاحظة: اقتراب موعد التسليم مع وجود مراحل غير منتهية';
        if (msgEl) msgEl.textContent = risk.text;
        if (actionEl) actionEl.innerHTML = `<button onclick="openProjectTracking(${p.id})" class="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow transition cursor-pointer">تسريع الإنجاز</button>`;
        banner.classList.remove('hidden');
    } else {
        banner.classList.add('hidden');
    }
}

function renderSignedHandoverCard(p) {
    const badge = document.getElementById('pdHandoverStatusBadge');
    const content = document.getElementById('pdHandoverContent');
    if (!badge || !content) return;

    if (p.signed_handover_url) {
        badge.className = 'text-xs px-2.5 py-1 rounded-full font-bold bg-emerald-100 text-emerald-800 border border-emerald-200';
        badge.textContent = 'تم رفع المحضر الموقع ✓';
        content.innerHTML = `
            <div class="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between gap-3">
                <div class="flex items-center gap-3">
                    <div class="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <div>
                        <div class="text-xs font-bold text-slate-800">نسخة محضر الاستلام الموقع محفوظة</div>
                        <div class="text-[10px] text-slate-500">تم اعتماده وتوثيقه ضمن مستندات المشروع</div>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <a href="${API_HOST}${p.signed_handover_url}" target="_blank" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow transition flex items-center gap-1">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        <span>معاينة الملف</span>
                    </a>
                    <button onclick="openUploadHandoverModal()" class="px-2.5 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-bold transition" title="رفع ملف بديل">تحديث</button>
                </div>
            </div>
        `;
    } else {
        badge.className = 'text-xs px-2.5 py-1 rounded-full font-bold bg-slate-100 text-slate-600 border border-slate-200';
        badge.textContent = 'بانتظار الرفع';
        content.innerHTML = `
            <div class="p-3.5 bg-slate-50 border border-dashed border-slate-200 rounded-xl space-y-2.5">
                <p class="text-xs text-slate-600 leading-relaxed">لم يتم رفع نسخة محضر الاستلام الموقعة من مهندس الموقع حتى الآن.</p>
                <div class="flex items-center gap-2 pt-1">
                    <button onclick="openUploadHandoverModal()" class="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow transition flex items-center justify-center gap-1.5 cursor-pointer">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                        <span>رفع المحضر الموقع الآن</span>
                    </button>
                    <button onclick="generateProjectHandoverPdf(window.currentProjectData ? window.currentProjectData.id : null)" class="py-2 px-3 border border-slate-200 hover:bg-white text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer">
                        <svg class="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                        <span>طباعة النموذج</span>
                    </button>
                </div>
            </div>
        `;
    }
}

// Handover Modal Handlers
window.openUploadHandoverModal = function() {
    const modal = document.getElementById('uploadHandoverModal');
    if (modal) {
        document.getElementById('handoverFileInput').value = '';
        document.getElementById('handoverFileName').textContent = 'اضغط لاختيار ملف المحضر (PDF أو صورة)';
        modal.classList.remove('hidden');
    }
};

window.closeUploadHandoverModal = function() {
    const modal = document.getElementById('uploadHandoverModal');
    if (modal) modal.classList.add('hidden');
};

window.previewHandoverFileName = function(input) {
    const nameEl = document.getElementById('handoverFileName');
    if (input.files && input.files[0]) {
        nameEl.textContent = input.files[0].name;
    } else {
        nameEl.textContent = 'اضغط لاختيار ملف المحضر (PDF أو صورة)';
    }
};

window.submitSignedHandover = async function(e) {
    e.preventDefault();
    if (!window.currentProjectData || !window.currentProjectData.id) {
        showToast('لم يتم تحديد المشروع', 'bg-rose-500', '✗');
        return;
    }
    const fileInput = document.getElementById('handoverFileInput');
    if (!fileInput.files || !fileInput.files[0]) {
        showToast('يرجى اختيار ملف المحضر أولاً', 'bg-rose-500', '⚠️');
        return;
    }

    const btn = document.getElementById('btnSubmitHandover');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<div class="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> جاري الرفع...';
    btn.disabled = true;

    try {
        const formData = new FormData();
        formData.append('file', fileInput.files[0]);

        const response = await authFetch(`${PROJECTS_URL}/${window.currentProjectData.id}/upload-handover`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.detail || 'فشل رفع محضر الاستلام');
        }

        const updatedProject = await response.json();
        window.currentProjectData.signed_handover_url = updatedProject.signed_handover_url;
        renderSignedHandoverCard(window.currentProjectData);
        closeUploadHandoverModal();
        showToast('تم رفع واعتماد محضر الاستلام بنجاح', 'bg-emerald-500', '✓');
    } catch (err) {
        showToast(err.message, 'bg-rose-500', '✗');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
};

// Change Orders Handlers
window.loadProjectChangeOrders = async function(projectId, cachedProject = null) {
    const tbody = document.getElementById('pdChangeOrdersBody');
    const countBadge = document.getElementById('pdChangeOrdersCount');
    if (!tbody) return;

    try {
        let orders = null;
        if (cachedProject && cachedProject.change_orders) {
            orders = cachedProject.change_orders;
        } else {
            const res = await authFetch(`${PROJECTS_URL}/${projectId}/change-orders`);
            if (res.ok) orders = await res.json();
        }

        if (!orders || orders.length === 0) {
            if (countBadge) countBadge.textContent = '0';
            tbody.innerHTML = '<tr><td colspan="8" class="p-6 text-center text-slate-400">لا توجد أوامر تعديل مسجلة لهذا المشروع.</td></tr>';
            return;
        }

        if (countBadge) countBadge.textContent = orders.length;
        tbody.innerHTML = '';
        orders.forEach(o => {
            const tr = document.createElement('tr');
            tr.className = 'border-b hover:bg-slate-50 transition text-xs';
            let statusBadge = '<span class="px-2 py-0.5 rounded-full font-bold bg-amber-50 text-amber-700 border border-amber-200">قيد المراجعة</span>';
            if (o.status === 'معتمد') {
                statusBadge = '<span class="px-2 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">معتمد ✓</span>';
            } else if (o.status === 'مرفوض') {
                statusBadge = '<span class="px-2 py-0.5 rounded-full font-bold bg-rose-50 text-rose-700 border border-rose-200">مرفوض ✗</span>';
            }

            tr.innerHTML = `
                <td class="p-3 font-bold font-mono text-indigo-700">${o.order_number || '-'}</td>
                <td class="p-3 font-semibold text-slate-800">${o.title || '-'}</td>
                <td class="p-3 text-slate-600 max-w-xs truncate" title="${o.description || ''}">${o.description || '-'}</td>
                <td class="p-3 text-slate-600">${o.requested_by || '-'}</td>
                <td class="p-3 font-mono font-bold text-slate-700">${o.cost_impact || 'بدون تكلفة'}</td>
                <td class="p-3 font-mono text-slate-700">${o.time_impact || 'بدون تأخير'}</td>
                <td class="p-3">${statusBadge}</td>
                <td class="p-3 text-slate-400" dir="ltr">${o.created_at ? new Date(o.created_at).toLocaleDateString() : '-'}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error('Failed to load change orders', e);
    }
};

window.openNewChangeOrderModal = function() {
    const modal = document.getElementById('newChangeOrderModal');
    if (modal) {
        const count = document.getElementById('pdChangeOrdersCount') ? parseInt(document.getElementById('pdChangeOrdersCount').textContent || '0') : 0;
        document.getElementById('coOrderNumber').value = `CO-${String(count + 1).padStart(2, '0')}`;
        document.getElementById('coTitle').value = '';
        document.getElementById('coDescription').value = '';
        document.getElementById('coRequestedBy').value = '';
        document.getElementById('coCostImpact').value = 'بدون تكلفة إضافية';
        document.getElementById('coTimeImpact').value = 'بدون تأخير';
        document.getElementById('coStatus').value = 'معتمد';
        modal.classList.remove('hidden');
    }
};

window.closeNewChangeOrderModal = function() {
    const modal = document.getElementById('newChangeOrderModal');
    if (modal) modal.classList.add('hidden');
};

window.submitNewChangeOrder = async function(e) {
    e.preventDefault();
    if (!window.currentProjectData || !window.currentProjectData.id) {
        showToast('لم يتم تحديد المشروع', 'bg-rose-500', '✗');
        return;
    }

    const btn = document.getElementById('btnSubmitChangeOrder');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<div class="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> جاري الحفظ...';
    btn.disabled = true;

    try {
        const payload = {
            order_number: document.getElementById('coOrderNumber').value.trim(),
            title: document.getElementById('coTitle').value.trim(),
            description: document.getElementById('coDescription').value.trim(),
            requested_by: document.getElementById('coRequestedBy').value.trim() || null,
            cost_impact: document.getElementById('coCostImpact').value.trim() || null,
            time_impact: document.getElementById('coTimeImpact').value.trim() || null,
            status: document.getElementById('coStatus').value
        };

        const res = await authFetch(`${PROJECTS_URL}/${window.currentProjectData.id}/change-orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || 'فشل حفظ أمر التعديل');
        }

        closeNewChangeOrderModal();
        showToast('تم تسجيل أمر التعديل بنجاح', 'bg-emerald-500', '✓');
        loadProjectChangeOrders(window.currentProjectData.id);
    } catch (err) {
        showToast(err.message, 'bg-rose-500', '✗');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
};

// Punch List Handlers
window.loadProjectPunchList = async function(projectId, cachedProject = null) {
    const tbody = document.getElementById('pdPunchListBody');
    const countBadge = document.getElementById('pdPunchCount');
    if (!tbody) return;

    try {
        let items = null;
        if (cachedProject && cachedProject.punch_list) {
            items = cachedProject.punch_list;
        } else {
            const res = await authFetch(`${PROJECTS_URL}/${projectId}/punch-list`);
            if (res.ok) items = await res.json();
        }

        if (!items || items.length === 0) {
            if (countBadge) countBadge.textContent = '0';
            tbody.innerHTML = '<tr><td colspan="7" class="p-6 text-center text-slate-400">لا توجد ملاحظات مسجلة على التسليم.</td></tr>';
            return;
        }

        if (countBadge) countBadge.textContent = items.length;
        tbody.innerHTML = '';
        items.forEach(item => {
            const tr = document.createElement('tr');
            tr.className = 'border-b hover:bg-slate-50 transition text-xs';

            const priorityBadge = item.priority === 'عاجل'
                ? '<span class="px-2 py-0.5 rounded-full font-bold bg-rose-50 text-rose-700 border border-rose-200">عاجل ⚠️</span>'
                : '<span class="px-2 py-0.5 rounded-full font-bold bg-slate-100 text-slate-600 border border-slate-200">عادي</span>';

            let statusBadge = '<span class="px-2 py-0.5 rounded-full font-bold bg-amber-50 text-amber-700 border border-amber-200">معلق</span>';
            if (item.status === 'جاري الإصلاح') {
                statusBadge = '<span class="px-2 py-0.5 rounded-full font-bold bg-blue-50 text-blue-700 border border-blue-200">جاري الإصلاح 🛠️</span>';
            } else if (item.status === 'تم الإصلاح') {
                statusBadge = '<span class="px-2 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">تم الإصلاح ✓</span>';
            }

            tr.innerHTML = `
                <td class="p-3 font-bold font-mono text-indigo-700">${item.door_number || '-'}</td>
                <td class="p-3 font-medium text-slate-800">${item.description || '-'}</td>
                <td class="p-3">${priorityBadge}</td>
                <td class="p-3">${statusBadge}</td>
                <td class="p-3 text-slate-400" dir="ltr">${item.created_at ? new Date(item.created_at).toLocaleDateString() : '-'}</td>
                <td class="p-3 text-slate-400" dir="ltr">${item.resolved_at ? new Date(item.resolved_at).toLocaleDateString() : '-'}</td>
                <td class="p-3 text-center">
                    <button onclick="togglePunchItemStatus(${item.id}, '${item.status}')" class="px-2.5 py-1 rounded-lg text-xs font-bold border transition ${
                        item.status === 'تم الإصلاح'
                            ? 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                    }">
                        ${item.status === 'تم الإصلاح' ? 'إعادة فتح' : 'اعتماد الإصلاح ✓'}
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error('Failed to load punch list', e);
    }
};

window.openNewPunchItemModal = function() {
    const modal = document.getElementById('newPunchItemModal');
    if (modal) {
        document.getElementById('plDoorNumber').value = '';
        document.getElementById('plDescription').value = '';
        document.getElementById('plPriority').value = 'عادي';
        document.getElementById('plAssignedTo').value = '';
        modal.classList.remove('hidden');
    }
};

window.closeNewPunchItemModal = function() {
    const modal = document.getElementById('newPunchItemModal');
    if (modal) modal.classList.add('hidden');
};

window.submitNewPunchItem = async function(e) {
    e.preventDefault();
    if (!window.currentProjectData || !window.currentProjectData.id) {
        showToast('لم يتم تحديد المشروع', 'bg-rose-500', '✗');
        return;
    }

    const btn = document.getElementById('btnSubmitPunchItem');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<div class="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> جاري الحفظ...';
    btn.disabled = true;

    try {
        const payload = {
            door_number: document.getElementById('plDoorNumber').value.trim() || null,
            description: document.getElementById('plDescription').value.trim(),
            priority: document.getElementById('plPriority').value,
            assigned_to: document.getElementById('plAssignedTo').value.trim() || null,
            status: 'معلق'
        };

        const res = await authFetch(`${PROJECTS_URL}/${window.currentProjectData.id}/punch-list`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || 'فشل تسجيل الملاحظة');
        }

        closeNewPunchItemModal();
        showToast('تم تسجيل ملاحظة التسليم بنجاح', 'bg-emerald-500', '✓');
        loadProjectPunchList(window.currentProjectData.id);
    } catch (err) {
        showToast(err.message, 'bg-rose-500', '✗');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
};

window.togglePunchItemStatus = async function(itemId, currentStatus) {
    const newStatus = currentStatus === 'تم الإصلاح' ? 'معلق' : 'تم الإصلاح';
    try {
        const res = await authFetch(`${PROJECTS_URL}/punch-list/${itemId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        if (!res.ok) throw new Error('فشل تحديث حالة الملاحظة');
        showToast(newStatus === 'تم الإصلاح' ? 'تم اعتماد إغلاق الملاحظة بنجاح' : 'تمت إعادة فتح الملاحظة', 'bg-emerald-500', '✓');
        if (window.currentProjectData) {
            loadProjectPunchList(window.currentProjectData.id);
        }
    } catch (e) {
        showToast(e.message, 'bg-rose-500', '✗');
    }
};

// ==========================================
//  INTERACTIVE GANTT CHART & TIMELINE ENGINE
// ==========================================

window.ganttState = {
    viewMode: 'month', // 'week', 'month', 'quarter'
    offsetDays: -7,
    filter: 'all',
    searchQuery: '',
    expandedProjects: new Set()
};

window.setGanttViewMode = function(mode) {
    window.ganttState.viewMode = mode;
    const btnWeek = document.getElementById('btnGanttModeWeek');
    const btnMonth = document.getElementById('btnGanttModeMonth');
    const btnQuarter = document.getElementById('btnGanttModeQuarter');
    
    const activeCls = 'px-2.5 py-1 text-xs font-bold rounded-lg bg-white text-indigo-700 shadow-xs cursor-pointer';
    const inactiveCls = 'px-2.5 py-1 text-xs font-bold rounded-lg text-slate-600 hover:text-slate-900 cursor-pointer';
    
    if (btnWeek) btnWeek.className = mode === 'week' ? activeCls : inactiveCls;
    if (btnMonth) btnMonth.className = mode === 'month' ? activeCls : inactiveCls;
    if (btnQuarter) btnQuarter.className = mode === 'quarter' ? activeCls : inactiveCls;

    renderProjectsGantt();
};

window.navigateGanttTime = function(delta) {
    if (delta === 'today') {
        window.ganttState.offsetDays = window.ganttState.viewMode === 'week' ? -3 : window.ganttState.viewMode === 'month' ? -7 : -15;
    } else {
        window.ganttState.offsetDays += delta;
    }
    renderProjectsGantt();
};

window.onGanttSearchInput = function(val) {
    window.ganttState.searchQuery = (val || '').trim().toLowerCase();
    renderProjectsGantt();
};

window.filterGanttProjects = function(filterType) {
    window.ganttState.filter = filterType;
    document.querySelectorAll('.gantt-filter-btn').forEach(btn => {
        if (btn.getAttribute('data-filter') === filterType) {
            btn.className = 'gantt-filter-btn px-3 py-1 text-xs font-bold rounded-lg bg-white text-indigo-700 shadow-xs cursor-pointer';
        } else {
            btn.className = 'gantt-filter-btn px-3 py-1 text-xs font-bold rounded-lg text-slate-600 hover:text-slate-900 cursor-pointer';
        }
    });
    renderProjectsGantt();
};

window.toggleGanttProjectExpand = function(projectId, event) {
    if (event) event.stopPropagation();
    const pid = Number(projectId);
    if (window.ganttState.expandedProjects.has(pid)) {
        window.ganttState.expandedProjects.delete(pid);
    } else {
        window.ganttState.expandedProjects.add(pid);
    }
    renderProjectsGantt();
};

window.toggleAllGanttStages = function() {
    const projects = window.allProjectsData || [];
    const allExpanded = projects.length > 0 && projects.every(p => window.ganttState.expandedProjects.has(p.id));
    const lbl = document.getElementById('lblToggleAllStages');
    
    if (allExpanded) {
        window.ganttState.expandedProjects.clear();
        if (lbl) lbl.textContent = 'توسيع المراحل';
    } else {
        projects.forEach(p => window.ganttState.expandedProjects.add(p.id));
        if (lbl) lbl.textContent = 'طي المراحل';
    }
    renderProjectsGantt();
};

window.openGanttSetDeliveryModal = function(projectId, projectName, currentVal) {
    const modal = document.getElementById('ganttSetDeliveryModal');
    const inputId = document.getElementById('ganttModalProjectId');
    const inputDate = document.getElementById('ganttModalDeliveryDate');
    const titleEl = document.getElementById('ganttModalProjectTitle');
    
    if (inputId) inputId.value = projectId;
    if (titleEl) titleEl.textContent = projectName ? `مشروع: ${projectName}` : 'تحديد موعد التسليم';
    
    if (inputDate) {
        if (currentVal && currentVal !== 'null' && currentVal !== 'undefined') {
            try {
                inputDate.value = new Date(currentVal).toISOString().split('T')[0];
            } catch(e) {
                inputDate.value = '';
            }
        } else {
            const defDate = new Date();
            defDate.setDate(defDate.getDate() + 21);
            inputDate.value = defDate.toISOString().split('T')[0];
        }
    }
    
    if (modal) modal.classList.remove('hidden');
};

window.closeGanttSetDeliveryModal = function() {
    const modal = document.getElementById('ganttSetDeliveryModal');
    if (modal) modal.classList.add('hidden');
};

window.submitGanttSetDeliveryDate = async function(event) {
    if (event) event.preventDefault();
    const projectId = document.getElementById('ganttModalProjectId')?.value;
    const dateVal = document.getElementById('ganttModalDeliveryDate')?.value;
    if (!projectId || !dateVal) return;
    
    const btn = document.getElementById('btnSubmitGanttDelivery');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="animate-spin inline-block mr-1">⌛</span> جاري الحفظ...';
    }
    
    try {
        const payload = { delivery_date: new Date(dateVal).toISOString() };
        const res = await authFetch(`${PROJECTS_URL}/${projectId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('فشل تحديث موعد التسليم');
        showToast('تم تحديث موعد التسليم بنجاح', 'bg-emerald-500', '✓');
        closeGanttSetDeliveryModal();
        
        const pRes = await authFetch(PROJECTS_URL + '/');
        if (pRes.ok) {
            window.allProjectsData = await pRes.json();
        }
        renderProjectsGantt();
    } catch (e) {
        showToast(e.message || 'حدث خطأ أثناء حفظ موعد التسليم', 'bg-rose-500', '✗');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<span>حفظ الموعد</span>';
        }
    }
};

window.renderProjectsGantt = async function() {
    const container = document.getElementById('ganttChartBody');
    if (!container) return;

    let projects = window.allProjectsData;
    if (!projects || projects.length === 0) {
        container.innerHTML = '<div class="text-center py-16 text-slate-400 text-xs flex flex-col items-center justify-center gap-2"><span class="text-2xl animate-spin">⏳</span><span>جاري تحميل بيانات المشاريع والمخطط الزمني...</span></div>';
        try {
            const res = await authFetch(PROJECTS_URL + '/');
            if (res.ok) {
                projects = await res.json();
                window.allProjectsData = projects;
            }
        } catch (e) {
            container.innerHTML = '<div class="text-center py-16 text-rose-500 text-xs">فشل تحميل بيانات المشاريع. يرجى إعادة المحاولة.</div>';
            return;
        }
    }

    if (!projects || projects.length === 0) {
        container.innerHTML = '<div class="text-center py-16 text-slate-400 text-xs">لا يوجد مشاريع مسجلة حالياً لعرضها في المخطط الزمني.</div>';
        return;
    }

    // 1. Calculate KPI Metrics
    let countTotal = projects.length;
    let countOnTrack = 0;
    let countDelayed = 0;
    let countPending = 0;
    let countCompleted = 0;

    projects.forEach(p => {
        const risk = calculateProjectDelayRisk(p);
        const st = (p.status || '').toLowerCase();
        if (st === 'completed') {
            countCompleted++;
        } else if (st === 'pending') {
            countPending++;
        } else {
            if (risk.level === 'danger' || risk.level === 'warning') {
                countDelayed++;
            } else {
                countOnTrack++;
            }
        }
    });

    const elTotal = document.getElementById('ganttStatTotal');
    const elOnTrack = document.getElementById('ganttStatOnTrack');
    const elDelayed = document.getElementById('ganttStatDelayed');
    const elPending = document.getElementById('ganttStatPending');
    const elCompleted = document.getElementById('ganttStatCompleted');

    if (elTotal) elTotal.textContent = countTotal;
    if (elOnTrack) elOnTrack.textContent = countOnTrack;
    if (elDelayed) elDelayed.textContent = countDelayed;
    if (elPending) elPending.textContent = countPending;
    if (elCompleted) elCompleted.textContent = countCompleted;

    // 2. Filter & Search
    const currentFilter = window.ganttState.filter || 'all';
    const query = window.ganttState.searchQuery || '';

    const filtered = projects.filter(p => {
        const risk = calculateProjectDelayRisk(p);
        const st = (p.status || '').toLowerCase();
        
        if (currentFilter === 'active' && st !== 'active') return false;
        if (currentFilter === 'completed' && st !== 'completed') return false;
        if (currentFilter === 'delayed' && risk.level !== 'danger' && risk.level !== 'warning') return false;
        
        if (query) {
            const num = (p.project_number || '').toLowerCase();
            const name = (p.name || '').toLowerCase();
            const contractor = (p.contractor_name || '').toLowerCase();
            const loc = (p.location || '').toLowerCase();
            if (!num.includes(query) && !name.includes(query) && !contractor.includes(query) && !loc.includes(query)) {
                return false;
            }
        }
        return true;
    });

    if (filtered.length === 0) {
        container.innerHTML = '<div class="text-center py-16 text-slate-400 text-xs">لا توجد مشاريع مطابقة لمعايير البحث والتصفية المحددة.</div>';
        return;
    }

    // 3. Manufacturing Stages Definition
    const MANUFACTURING_STAGES = [
        { key: 'step_design', label: 'التصميم والتفصيل', short: 'تصميم' },
        { key: 'step_cutting', label: 'قص الصاج والحديد', short: 'قص' },
        { key: 'step_forming', label: 'التشكيل والدرفلة', short: 'تشكيل' },
        { key: 'step_assembly', label: 'التجميع واللحام', short: 'تجميع' },
        { key: 'step_painting', label: 'المعالجة والدهان', short: 'دهان' },
        { key: 'step_accessories', label: 'الإكسسوارات والزجاج', short: 'إكسسوار' },
        { key: 'step_installation', label: 'التسليم والتركيب', short: 'تسليم' }
    ];

    // 4. View Mode & Grid Scale Configuration
    const mode = window.ganttState.viewMode || 'month';
    let totalDays = 42;
    let dayWidth = 36;
    if (mode === 'week') {
        totalDays = 21;
        dayWidth = 54;
    } else if (mode === 'quarter') {
        totalDays = 90;
        dayWidth = 22;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() + (window.ganttState.offsetDays || -7));
    startDate.setHours(0, 0, 0, 0);

    const arabicMonths = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    const arabicDaysShort = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

    // Generate Month groups & Day columns
    const daysData = [];
    const monthGroups = [];
    let currentMonthGroup = null;

    for (let i = 0; i < totalDays; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        const mKey = `${d.getFullYear()}-${d.getMonth()}`;
        const isToday = d.getTime() === today.getTime();
        const dayOfWeek = d.getDay();
        const isWeekend = dayOfWeek === 5 || dayOfWeek === 6; // Friday, Saturday

        daysData.push({
            date: d,
            isToday,
            isWeekend,
            dayNum: d.getDate(),
            dayLabel: arabicDaysShort[dayOfWeek]
        });

        if (!currentMonthGroup || currentMonthGroup.key !== mKey) {
            currentMonthGroup = {
                key: mKey,
                label: `${arabicMonths[d.getMonth()]} ${d.getFullYear()}`,
                daysCount: 1
            };
            monthGroups.push(currentMonthGroup);
        } else {
            currentMonthGroup.daysCount++;
        }
    }

    // Calculate Today vertical line X coordinate
    const todayDiffDays = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
    const showTodayLine = todayDiffDays >= 0 && todayDiffDays < totalDays;
    const todayLineX = showTodayLine ? (todayDiffDays * dayWidth) + Math.round(dayWidth / 2) : -999;

    const timelineTotalWidth = totalDays * dayWidth;

    // Build Month Header HTML
    const monthHeaderHtml = monthGroups.map(mg => `
        <div class="h-6 flex items-center justify-center font-bold text-[11px] text-slate-700 border-r border-slate-200 bg-slate-100/90 truncate px-2" style="width: ${mg.daysCount * dayWidth}px">
            ${mg.label}
        </div>
    `).join('');

    // Build Days Header HTML
    const daysHeaderHtml = daysData.map(d => {
        let bg = 'bg-white';
        let txt = 'text-slate-600';
        if (d.isToday) {
            bg = 'bg-indigo-100/80';
            txt = 'text-indigo-800 font-black';
        } else if (d.isWeekend) {
            bg = 'bg-slate-100/60';
            txt = 'text-slate-400';
        }
        return `
            <div class="h-7 flex flex-col items-center justify-center text-[10px] border-r border-slate-200 ${bg} ${txt}" style="width: ${dayWidth}px; flex-shrink: 0;" title="${d.date.toLocaleDateString('ar-EG')}">
                <span class="font-bold leading-none">${d.dayNum}</span>
                <span class="text-[8px] leading-tight opacity-75">${d.dayLabel}</span>
            </div>
        `;
    }).join('');

    // Build Rows for both panels
    let leftPanelRowsHtml = '';
    let rightPanelRowsHtml = '';

    filtered.forEach(p => {
        const isExpanded = window.ganttState.expandedProjects.has(p.id);
        const risk = calculateProjectDelayRisk(p);
        const st = (p.status || '').toLowerCase();

        // Project dates calculation
        let pStart = p.activated_at ? new Date(p.activated_at) : null;
        if (!pStart && p.created_at) {
            try { pStart = new Date(p.created_at); } catch(e) {}
        }
        if (!pStart) {
            pStart = new Date(today);
            pStart.setDate(pStart.getDate() - 7);
        }
        pStart.setHours(0, 0, 0, 0);

        let isEstimatedDelivery = false;
        let pEnd = p.delivery_date ? new Date(p.delivery_date) : null;
        if (!pEnd) {
            isEstimatedDelivery = true;
            pEnd = new Date(pStart);
            pEnd.setDate(pEnd.getDate() + 21); // Default estimate: 3 weeks
        }
        pEnd.setHours(0, 0, 0, 0);

        if (pEnd.getTime() <= pStart.getTime()) {
            pEnd = new Date(pStart);
            pEnd.setDate(pEnd.getDate() + 7);
        }

        // Timeline Bar coordinate calculations
        const pStartOffsetDays = (pStart - startDate) / (1000 * 60 * 60 * 24);
        const pDurationDays = Math.max(1, (pEnd - pStart) / (1000 * 60 * 60 * 24));
        const barLeft = Math.round(pStartOffsetDays * dayWidth);
        const barWidth = Math.max(24, Math.round(pDurationDays * dayWidth));

        // Styling based on risk & status
        let barBg = 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white';
        let badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
        let statusDot = 'bg-emerald-500';

        if (st === 'completed') {
            barBg = 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white';
            badgeColor = 'bg-blue-50 text-blue-700 border-blue-200';
            statusDot = 'bg-blue-500';
        } else if (risk.level === 'danger') {
            barBg = 'bg-gradient-to-r from-rose-500 to-rose-600 text-white';
            badgeColor = 'bg-rose-50 text-rose-700 border-rose-200';
            statusDot = 'bg-rose-500 animate-ping';
        } else if (risk.level === 'warning') {
            barBg = 'bg-gradient-to-r from-amber-500 to-amber-600 text-white';
            badgeColor = 'bg-amber-50 text-amber-700 border-amber-200';
            statusDot = 'bg-amber-500';
        } else if (st === 'pending') {
            barBg = 'bg-gradient-to-r from-slate-400 to-slate-500 text-white';
            badgeColor = 'bg-slate-100 text-slate-700 border-slate-200';
            statusDot = 'bg-slate-400';
        }

        const estimatedBadge = isEstimatedDelivery ? `
            <button type="button" onclick="openGanttSetDeliveryModal(${p.id}, '${escapeHtml(p.name)}', null)" class="mr-1 px-1.5 py-0.5 rounded text-[9px] bg-amber-100 text-amber-900 border border-amber-300 font-bold hover:bg-amber-200 transition cursor-pointer" title="تاريخ مقدر - اضغط لتحديد موعد التسليم">
                ⚠️ مقدّر
            </button>
        ` : '';

        // Left Panel Project Row (h-[62px])
        leftPanelRowsHtml += `
            <div class="h-[62px] px-3 border-b border-slate-200 bg-white hover:bg-slate-50/80 transition flex items-center justify-between gap-2 text-xs">
                <div class="flex items-center gap-2 min-w-0 flex-1">
                    <button type="button" onclick="toggleGanttProjectExpand(${p.id}, event)" class="w-6 h-6 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 flex items-center justify-center text-[10px] text-slate-500 transition cursor-pointer flex-shrink-0" title="${isExpanded ? 'طي المراحل' : 'عرض المراحل السبع'}">
                        <span>${isExpanded ? '▼' : '◀'}</span>
                    </button>
                    <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-1.5">
                            <span class="font-bold text-slate-800 hover:text-indigo-600 cursor-pointer truncate max-w-[150px]" onclick="viewProjectDetails(${p.id})" title="${p.name}">
                                ${p.name}
                            </span>
                            <span class="text-[10px] font-mono text-indigo-600 bg-indigo-50 px-1 py-0.2 rounded border border-indigo-100 flex-shrink-0">#${p.project_number || p.id}</span>
                            ${estimatedBadge}
                        </div>
                        <div class="flex items-center gap-2 text-[10px] text-slate-400 truncate mt-0.5">
                            <span class="truncate">${p.contractor_name || 'بدون مقاول'}</span>
                            <span>•</span>
                            <span class="font-bold ${risk.level === 'danger' ? 'text-rose-600' : 'text-slate-600'}">${risk.label}</span>
                        </div>
                    </div>
                </div>

                <div class="flex items-center gap-1 flex-shrink-0">
                    <div class="w-12 text-left" dir="ltr">
                        <div class="text-[10px] font-black text-slate-700">${risk.percent}%</div>
                        <div class="w-full bg-slate-100 rounded-full h-1 overflow-hidden mt-0.5">
                            <div class="bg-indigo-600 h-1 rounded-full" style="width: ${risk.percent}%"></div>
                        </div>
                    </div>
                    <button type="button" onclick="openGanttSetDeliveryModal(${p.id}, '${escapeHtml(p.name)}', '${p.delivery_date || ''}')" class="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition cursor-pointer" title="تعديل موعد التسليم">
                        📅
                    </button>
                    <button type="button" onclick="openProjectTracking(${p.id})" class="p-1 rounded-lg hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition cursor-pointer" title="لوحة المتابعة">
                        📊
                    </button>
                </div>
            </div>
        `;

        // Right Panel Project Row (h-[62px])
        rightPanelRowsHtml += `
            <div class="h-[62px] border-b border-slate-200 relative bg-white hover:bg-slate-50/50 transition" style="width: ${timelineTotalWidth}px;">
                <!-- Vertical grid weekend backgrounds -->
                <div class="absolute inset-0 flex pointer-events-none">
                    ${daysData.map(d => `<div style="width: ${dayWidth}px; flex-shrink: 0;" class="h-full border-r border-slate-100 ${d.isWeekend ? 'bg-slate-50/60' : ''}"></div>`).join('')}
                </div>

                <!-- Main Project Gantt Bar -->
                <div class="absolute top-[13px] h-[36px] rounded-xl shadow-xs cursor-pointer group flex items-center px-3 z-10 transition-all hover:shadow-md hover:scale-[1.01] ${barBg} ${isEstimatedDelivery ? 'border-2 border-dashed border-amber-300' : ''}" 
                     style="left: ${barLeft}px; width: ${barWidth}px;" 
                     onclick="openProjectTracking(${p.id})"
                     title="${p.name} - الإنجاز: ${risk.percent}% | البدء: ${pStart.toLocaleDateString()} | التسليم: ${pEnd.toLocaleDateString()} ${isEstimatedDelivery ? '(تقديري)' : ''}">
                    
                    <div class="flex items-center justify-between w-full overflow-hidden text-xs gap-2 select-none">
                        <span class="font-bold truncate text-[11px] drop-shadow-xs">${p.name}</span>
                        <span class="text-[10px] font-mono bg-black/20 px-1.5 py-0.5 rounded font-black flex-shrink-0">${risk.percent}%</span>
                    </div>

                    <!-- Tooltip on hover -->
                    <div class="opacity-0 group-hover:opacity-100 pointer-events-none absolute bottom-full mb-2 right-1/2 translate-x-1/2 z-30 transition bg-slate-900 text-white rounded-xl py-1.5 px-3 text-[10px] shadow-xl whitespace-nowrap">
                        <div class="font-bold">${p.name} (${risk.percent}%)</div>
                        <div class="text-slate-300 font-mono text-[9px] mt-0.5">البدء: ${pStart.toLocaleDateString()} ➔ التسليم: ${pEnd.toLocaleDateString()} ${isEstimatedDelivery ? '⚠️ (تاريخ مقدر)' : ''}</div>
                    </div>
                </div>
            </div>
        `;

        // Sub-rows for 7 Manufacturing Stages when expanded
        if (isExpanded) {
            MANUFACTURING_STAGES.forEach((stage, sIdx) => {
                const stepVal = p[stage.key] || 'لم يتم البدء';
                let stepStatusClass = 'bg-slate-100 text-slate-500 border-slate-200';
                let stepBarClass = 'bg-slate-200 text-slate-600 border border-slate-300';
                let stepIcon = '○';

                if (stepVal === 'مكتمل') {
                    stepStatusClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                    stepBarClass = 'bg-emerald-500 text-white shadow-xs';
                    stepIcon = '✓';
                } else if (stepVal === 'قيد التنفيذ') {
                    stepStatusClass = 'bg-amber-50 text-amber-700 border-amber-200';
                    stepBarClass = 'bg-amber-400 text-amber-950 font-bold animate-pulse shadow-xs';
                    stepIcon = '⏳';
                }

                // Stage timeline slice calculation (distributed evenly along the project timeline)
                const stageDurationDays = pDurationDays / 7;
                const stageStartOffsetDays = pStartOffsetDays + (sIdx * stageDurationDays);
                const stageBarLeft = Math.round(stageStartOffsetDays * dayWidth);
                const stageBarWidth = Math.max(16, Math.round(stageDurationDays * dayWidth));

                // Left Panel Sub-row (h-[34px])
                leftPanelRowsHtml += `
                    <div class="h-[34px] px-3 pl-4 border-b border-slate-100 bg-slate-50/70 hover:bg-slate-100/60 transition flex items-center justify-between text-[11px]">
                        <div class="flex items-center gap-2 pr-5">
                            <span class="text-slate-300 text-[10px]">└─</span>
                            <span class="text-slate-700 font-medium">${stage.label}</span>
                        </div>
                        <span class="px-2 py-0.5 rounded-md text-[9px] font-bold border ${stepStatusClass} flex items-center gap-1">
                            <span>${stepIcon}</span>
                            <span>${stepVal}</span>
                        </span>
                    </div>
                `;

                // Right Panel Sub-row (h-[34px])
                rightPanelRowsHtml += `
                    <div class="h-[34px] border-b border-slate-100 relative bg-slate-50/30" style="width: ${timelineTotalWidth}px;">
                        <!-- Vertical grid weekend backgrounds -->
                        <div class="absolute inset-0 flex pointer-events-none">
                            ${daysData.map(d => `<div style="width: ${dayWidth}px; flex-shrink: 0;" class="h-full border-r border-slate-100 ${d.isWeekend ? 'bg-slate-100/40' : ''}"></div>`).join('')}
                        </div>

                        <!-- Stage Sub-bar -->
                        <div class="absolute top-[7px] h-[20px] rounded-lg shadow-2xs flex items-center justify-center text-[9px] font-bold z-10 ${stepBarClass} cursor-pointer hover:opacity-90 transition"
                             style="left: ${stageBarLeft}px; width: ${stageBarWidth}px;"
                             onclick="openProjectTracking(${p.id})"
                             title="${stage.label}: ${stepVal}">
                            <span class="truncate px-1">${stage.short}: ${stepIcon}</span>
                        </div>
                    </div>
                `;
            });
        }
    });

    // Render Combined Split View
    container.innerHTML = `
        <div class="flex flex-col md:flex-row w-full border border-slate-200 rounded-2xl bg-white shadow-xs overflow-hidden">
            <!-- Left Fixed Table Panel -->
            <div class="w-full md:w-[360px] lg:w-[400px] flex-shrink-0 border-b md:border-b-0 md:border-l border-slate-200 bg-white z-20 shadow-xs">
                <!-- Header -->
                <div class="h-[53px] px-4 border-b border-slate-200 bg-slate-100/80 flex items-center justify-between text-xs font-bold text-slate-700">
                    <span class="flex items-center gap-1.5">
                        <span>📋</span>
                        <span>المشروع / المقاول / الحالة</span>
                    </span>
                    <span class="text-[10px] text-slate-400 font-semibold">(${filtered.length} مشروع)</span>
                </div>
                <!-- Rows Container -->
                <div class="overflow-y-hidden">
                    ${leftPanelRowsHtml}
                </div>
            </div>

            <!-- Right Scrollable Timeline Grid -->
            <div class="flex-1 overflow-x-auto relative bg-white" id="ganttTimelineScrollArea" dir="ltr">
                <div style="width: ${timelineTotalWidth}px; min-width: 100%; position: relative;">
                    <!-- Today Vertical Marker Line -->
                    ${showTodayLine ? `
                        <div class="absolute top-0 bottom-0 z-30 pointer-events-none" style="left: ${todayLineX}px; width: 2px;">
                            <div class="w-[2px] h-full bg-rose-500 shadow-sm relative">
                                <span class="absolute top-1 -left-4 px-1.5 py-0.5 rounded-full bg-rose-600 text-white text-[8px] font-black shadow-md tracking-wider">اليوم</span>
                            </div>
                        </div>
                    ` : ''}

                    <!-- Month Header Row -->
                    <div class="flex border-b border-slate-200 sticky top-0 z-20">
                        ${monthHeaderHtml}
                    </div>

                    <!-- Days Header Row -->
                    <div class="flex border-b border-slate-200 sticky top-6 z-20 shadow-2xs">
                        ${daysHeaderHtml}
                    </div>

                    <!-- Timeline Rows Body -->
                    <div class="relative">
                        ${rightPanelRowsHtml}
                    </div>
                </div>
            </div>
        </div>
    `;

    // Automatically scroll timeline area so "Today" is in view
    setTimeout(() => {
        const scrollArea = document.getElementById('ganttTimelineScrollArea');
        if (scrollArea && showTodayLine) {
            const targetScroll = Math.max(0, todayLineX - 160);
            scrollArea.scrollLeft = targetScroll;
        }
    }, 50);
};

// ==========================================
//  PRINTING FUNCTIONS (Work Order, Cards, Handover)
// ==========================================

async function getProjectForPrint(projectId) {
    if (window.currentProjectData && window.currentProjectData.id === projectId) {
        return window.currentProjectData;
    }
    try {
        const res = await authFetch(`${PROJECTS_URL}/${projectId}`);
        if (res.ok) return await res.json();
    } catch (e) {
        console.error('Failed to fetch project for print', e);
    }
    return window.currentProjectData || null;
}

window.printProjectWorkOrder = async function(projectId) {
    const p = await getProjectForPrint(projectId);
    if (!p) {
        showToast('تعذر جلب بيانات المشروع للطباعة', 'bg-rose-500', '✗');
        return;
    }

    const printWin = window.open('', '_blank');
    if (!printWin) {
        showToast('يرجى السماح بالنوافذ المنبثقة للطباعة', 'bg-amber-500', '⚠️');
        return;
    }

    let rowsHtml = '';
    if (p.details && p.details.length > 0) {
        p.details.forEach((d, idx) => {
            rowsHtml += `
                <tr>
                    <td style="font-weight:bold; font-family:monospace; background:#f8fafc;">${d.door_number || ('D-' + (idx+1))}</td>
                    <td style="font-weight:bold; text-align:center;">${d.quantity || 1}</td>
                    <td style="text-align:center;">${d.width || '-'}</td>
                    <td style="text-align:center;">${d.height || '-'}</td>
                    <td style="text-align:center;">${d.depth || '-'}</td>
                    <td style="text-align:center;">${d.direction || '-'}</td>
                    <td>${d.door_type || '-'}</td>
                    <td style="text-align:center;">${d.leaf_size || '-'}</td>
                    <td style="text-align:center;">${d.leaf_size_2 || '-'}</td>
                    <td style="text-align:center;">${d.leaf_thickness || '4.5'}</td>
                    <td>${d.lock_type || '-'}</td>
                    <td style="text-align:center;">${d.hinges || '-'} (${d.hinges_count || '4'})</td>
                    <td style="text-align:center;">${d.fire_resistance || '-'}</td>
                    <td>${d.architrave || '-'}</td>
                    <td style="text-align:center;">${d.under_tile || '-'}</td>
                    <td>${d.window_width ? `${d.window_width}×${d.window_height} (${d.window_position || ''})` : 'بدون'}</td>
                    <td style="font-size:10px;">${d.notes || '-'}</td>
                </tr>
            `;
        });
    } else {
        rowsHtml = `<tr><td colspan="17" style="text-align:center; padding:20px; color:#94a3b8;">لا توجد تفاصيل هندسية مسجلة</td></tr>`;
    }

    const htmlContent = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
        <meta charset="UTF-8">
        <title>أمر تشغيل وتصنيع - ${p.project_number || ''} ${p.name || ''}</title>
        <style>
            @page { size: A4 landscape; margin: 8mm; }
            * { box-sizing: border-box; font-family: 'Segoe UI', Tahoma, Arial, sans-serif; }
            body { margin: 0; padding: 10px; color: #1e293b; background: #fff; font-size: 11px; }
            .header-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
            .header-table td { padding: 4px; vertical-align: middle; }
            .factory-title { font-size: 18px; font-weight: bold; color: #0f172a; margin: 0; }
            .sub-title { font-size: 13px; color: #4338ca; font-weight: bold; margin-top: 2px; }
            .doc-box { border: 2px solid #4338ca; border-radius: 8px; padding: 6px 12px; text-align: center; background: #eef2ff; }
            .meta-grid { width: 100%; border-collapse: collapse; margin-bottom: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; }
            .meta-grid td { padding: 6px 10px; border-bottom: 1px solid #e2e8f0; font-size: 11px; }
            .meta-label { color: #64748b; font-weight: bold; width: 13%; }
            .meta-val { color: #0f172a; font-weight: bold; width: 20%; }
            .data-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 10px; }
            .data-table th, .data-table td { border: 1px solid #cbd5e1; padding: 4px 5px; }
            .data-table th { background: #1e293b; color: #fff; font-weight: bold; text-align: center; }
            .data-table tr:nth-child(even) { background: #f8fafc; }
            .stages-box { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
            .stages-box th, .stages-box td { border: 1px dashed #94a3b8; padding: 6px; text-align: center; font-size: 10px; }
            .stages-box th { background: #f1f5f9; font-weight: bold; color: #334155; }
            .sign-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            .sign-table td { width: 33.33%; text-align: center; padding: 10px; font-weight: bold; }
            .sign-line { border-bottom: 1px dashed #64748b; margin: 25px auto 5px auto; width: 60%; }
            @media print {
                button { display: none; }
                body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
        </style>
    </head>
    <body>
        <table class="header-table">
            <tr>
                <td style="width: 50%;">
                    <h1 class="factory-title">مصنع أبواب الطوارئ والحديد المتخصص</h1>
                    <div class="sub-title">إدارة العمليات والإنتاج - أمر تشغيل ورشة (Factory Work Order)</div>
                </td>
                <td style="width: 50%; text-align: left;">
                    <div class="doc-box" style="display:inline-block;">
                        <div style="font-size: 14px; font-weight: bold;">أمر تشغيل رقم: WO-${p.project_number || p.id}</div>
                        <div style="font-size: 10px; color: #475569;">تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')}</div>
                    </div>
                </td>
            </tr>
        </table>

        <table class="meta-grid">
            <tr>
                <td class="meta-label">رقم المشروع:</td>
                <td class="meta-val">${p.project_number || '-'}</td>
                <td class="meta-label">اسم المشروع:</td>
                <td class="meta-val">${p.name || '-'}</td>
                <td class="meta-label">المقاول:</td>
                <td class="meta-val">${p.contractor_name || '-'}</td>
            </tr>
            <tr>
                <td class="meta-label">مسؤول الموقع:</td>
                <td class="meta-val">${p.engineer_name || '-'} (${p.engineer_phone || '-'})</td>
                <td class="meta-label">تاريخ التسليم:</td>
                <td class="meta-val" style="color: #b91c1c;">${p.delivery_date ? new Date(p.delivery_date).toLocaleDateString('ar-EG') : '-'}</td>
                <td class="meta-label">لون الدهان:</td>
                <td class="meta-val">${p.paint_color || '-'}</td>
            </tr>
            <tr>
                <td class="meta-label">نوع التصنيع:</td>
                <td class="meta-val">${p.manufacturing_type || '-'}</td>
                <td class="meta-label">طبيعة التركيب:</td>
                <td class="meta-val">${p.installation_type || '-'}</td>
                <td class="meta-label">ملاحظات عامة:</td>
                <td class="meta-val" style="font-size: 10px;">${p.notes || '-'}</td>
            </tr>
        </table>

        <table class="data-table">
            <thead>
                <tr>
                    <th>رقم الباب</th>
                    <th>العدد</th>
                    <th>العرض</th>
                    <th>الارتفاع</th>
                    <th>العمق</th>
                    <th>الاتجاه</th>
                    <th>نوع الباب</th>
                    <th>درفة 1</th>
                    <th>درفة 2</th>
                    <th>السماكة</th>
                    <th>الزرفيل</th>
                    <th>الفصالات</th>
                    <th>حريق</th>
                    <th>الكشفة</th>
                    <th>تحت البلاط</th>
                    <th>الشباك</th>
                    <th>ملاحظات</th>
                </tr>
            </thead>
            <tbody>
                ${rowsHtml}
            </tbody>
        </table>

        <div style="font-weight: bold; font-size: 11px; margin-bottom: 4px; color: #1e293b;">متابعة اعتماد مراحل التصنيع (Production Quality Sign-off):</div>
        <table class="stages-box">
            <thead>
                <tr>
                    <th>1. البرمجة والقص</th>
                    <th>2. الثني والتشكيل</th>
                    <th>3. التجميع واللحام</th>
                    <th>4. فرن الدهان</th>
                    <th>5. الإكسسوارات</th>
                    <th>6. مراقبة الجودة (QC)</th>
                    <th>7. التغليف والتحميل</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>[  ] مكتمل<div style="font-size:9px; color:#64748b; margin-top:10px;">التوقيع: .........</div></td>
                    <td>[  ] مكتمل<div style="font-size:9px; color:#64748b; margin-top:10px;">التوقيع: .........</div></td>
                    <td>[  ] مكتمل<div style="font-size:9px; color:#64748b; margin-top:10px;">التوقيع: .........</div></td>
                    <td>[  ] مكتمل<div style="font-size:9px; color:#64748b; margin-top:10px;">التوقيع: .........</div></td>
                    <td>[  ] مكتمل<div style="font-size:9px; color:#64748b; margin-top:10px;">التوقيع: .........</div></td>
                    <td>[  ] معتمد<div style="font-size:9px; color:#64748b; margin-top:10px;">التوقيع: .........</div></td>
                    <td>[  ] تم التوريد<div style="font-size:9px; color:#64748b; margin-top:10px;">التوقيع: .........</div></td>
                </tr>
            </tbody>
        </table>

        <table class="sign-table">
            <tr>
                <td>
                    مهندس الإنتاج والورشة
                    <div class="sign-line"></div>
                </td>
                <td>
                    مسؤول مراقبة الجودة
                    <div class="sign-line"></div>
                </td>
                <td>
                    اعتماد مدير المصنع
                    <div class="sign-line"></div>
                </td>
            </tr>
        </table>

        <script>
            window.onload = function() {
                setTimeout(function() { window.print(); }, 500);
            };
        </script>
    </body>
    </html>
    `;

    printWin.document.open();
    printWin.document.write(htmlContent);
    printWin.document.close();
};

window.printProjectCuttingCards = async function(projectId) {
    const p = await getProjectForPrint(projectId);
    if (!p) {
        showToast('تعذر جلب بيانات المشروع للطباعة', 'bg-rose-500', '✗');
        return;
    }

    if (!p.details || p.details.length === 0) {
        showToast('لا توجد تفاصيل أبواب مسجلة لطباعة بطاقات القص', 'bg-amber-500', '⚠️');
        return;
    }

    const printWin = window.open('', '_blank');
    if (!printWin) {
        showToast('يرجى السماح بالنوافذ المنبثقة للطباعة', 'bg-amber-500', '⚠️');
        return;
    }

    let cardsHtml = '';
    p.details.forEach((d, idx) => {
        const qty = d.quantity || 1;
        cardsHtml += `
            <div class="card">
                <div class="card-header">
                    <div class="card-pname">${p.name} <span class="p-num">(${p.project_number || '-'})</span></div>
                    <div class="door-num">${d.door_number || ('D-' + (idx+1))}</div>
                </div>
                <div class="card-body">
                    <div class="field-row">
                        <span class="f-lbl">الكمية:</span> <span class="f-val highlight">${qty}</span> | 
                        <span class="f-lbl">المقاس:</span> <span class="f-val highlight" dir="ltr">${d.width || '-'} × ${d.height || '-'} × ${d.depth || '-'}</span>
                    </div>
                    <div class="field-row">
                        <span class="f-lbl">الاتجاه:</span> <span class="f-val">${d.direction || '-'}</span> | 
                        <span class="f-lbl">نوع الباب:</span> <span class="f-val">${d.door_type || '-'}</span>
                    </div>
                    <div class="field-row">
                        <span class="f-lbl">قياس الدرفة 1:</span> <span class="f-val bold">${d.leaf_size || '-'}</span> | 
                        <span class="f-lbl">درفة 2:</span> <span class="f-val bold">${d.leaf_size_2 || '-'}</span>
                    </div>
                    <div class="field-row">
                        <span class="f-lbl">سماكة الدرفة:</span> <span class="f-val">${d.leaf_thickness || '4.5'}</span> | 
                        <span class="f-lbl">المقطع:</span> <span class="f-val">${d.profile_type || '-'}</span>
                    </div>
                    <div class="field-row">
                        <span class="f-lbl">الزرفيل:</span> <span class="f-val">${d.lock_type || '-'}</span> | 
                        <span class="f-lbl">الفصالات:</span> <span class="f-val">${d.hinges || '-'} (${d.hinges_count || '4'})</span>
                    </div>
                    <div class="field-row">
                        <span class="f-lbl">الكشفة:</span> <span class="f-val">${d.architrave || '-'}</span> | 
                        <span class="f-lbl">تحت البلاط:</span> <span class="f-val">${d.under_tile || '-'}</span>
                    </div>
                    <div class="field-row">
                        <span class="f-lbl">الشباك:</span> <span class="f-val">${d.window_width ? `${d.window_width}×${d.window_height} (${d.window_position || ''})` : 'بدون'}</span> | 
                        <span class="f-lbl">حريق:</span> <span class="f-val">${d.fire_resistance || '-'}</span>
                    </div>
                    ${d.notes ? `<div class="field-row notes"><span class="f-lbl">ملاحظات:</span> ${d.notes}</div>` : ''}
                </div>
                <div class="card-footer">
                    <div class="check-box">[ ] قص صاج</div>
                    <div class="check-box">[ ] ثني وتشكيل</div>
                    <div class="check-box">[ ] لحام وتجميع</div>
                    <div class="check-box">[ ] دهان</div>
                </div>
            </div>
        `;
    });

    const htmlContent = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
        <meta charset="UTF-8">
        <title>بطاقات القص وستيكرات الأبواب - ${p.project_number || ''}</title>
        <style>
            @page { size: A4 portrait; margin: 8mm; }
            * { box-sizing: border-box; font-family: 'Segoe UI', Tahoma, Arial, sans-serif; }
            body { margin: 0; padding: 5px; color: #1e293b; background: #fff; font-size: 11px; }
            .page-title { text-align: center; font-size: 14px; font-weight: bold; margin-bottom: 10px; color: #4338ca; border-bottom: 2px solid #e0e7ff; padding-bottom: 5px; }
            .grid-container { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
            .card {
                border: 2px dashed #64748b;
                border-radius: 8px;
                padding: 8px;
                background: #fff;
                break-inside: avoid;
                page-break-inside: avoid;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                position: relative;
            }
            .card-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 1.5px solid #0f172a;
                padding-bottom: 4px;
                margin-bottom: 6px;
            }
            .card-pname { font-size: 10px; font-weight: bold; color: #475569; max-width: 65%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .p-num { color: #4338ca; font-family: monospace; }
            .door-num { font-size: 18px; font-weight: 900; color: #0f172a; font-family: monospace; }
            .card-body { font-size: 10px; line-height: 1.45; }
            .field-row { margin-bottom: 2px; }
            .f-lbl { color: #64748b; font-weight: bold; }
            .f-val { color: #0f172a; }
            .highlight { font-weight: bold; color: #1e1b4b; background: #f1f5f9; padding: 1px 4px; border-radius: 4px; }
            .bold { font-weight: bold; color: #4338ca; }
            .notes { color: #b91c1c; font-size: 9px; font-weight: bold; }
            .card-footer {
                margin-top: 6px;
                padding-top: 4px;
                border-top: 1px solid #e2e8f0;
                display: flex;
                justify-content: space-between;
                font-size: 9px;
                font-weight: bold;
                color: #475569;
            }
            .check-box { white-space: nowrap; }
            @media print {
                body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
        </style>
    </head>
    <body>
        <div class="page-title">بطاقات القص والتشغيل لأبواب مشروع: ${p.name} (${p.project_number || '-'})</div>
        <div class="grid-container">
            ${cardsHtml}
        </div>
        <script>
            window.onload = function() {
                setTimeout(function() { window.print(); }, 500);
            };
        </script>
    </body>
    </html>
    `;

    printWin.document.open();
    printWin.document.write(htmlContent);
    printWin.document.close();
};

window.generateProjectHandoverPdf = async function(projectId) {
    const p = await getProjectForPrint(projectId);
    if (!p) {
        showToast('تعذر جلب بيانات المشروع لتوليد محضر الاستلام', 'bg-rose-500', '✗');
        return;
    }

    const printWin = window.open('', '_blank');
    if (!printWin) {
        showToast('يرجى السماح بالنوافذ المنبثقة لطباعة محضر الاستلام', 'bg-amber-500', '⚠️');
        return;
    }

    let doorsSummaryHtml = '';
    let totalDoorsCount = 0;
    if (p.details && p.details.length > 0) {
        p.details.forEach((d, idx) => {
            const qty = d.quantity || 1;
            totalDoorsCount += qty;
            doorsSummaryHtml += `
                <tr>
                    <td style="text-align:center; font-weight:bold; font-family:monospace;">${d.door_number || ('D-' + (idx+1))}</td>
                    <td style="text-align:center; font-weight:bold;">${qty}</td>
                    <td style="text-align:center;" dir="ltr">${d.width || '-'} × ${d.height || '-'} × ${d.depth || '-'}</td>
                    <td style="text-align:center;">${d.direction || '-'}</td>
                    <td style="text-align:center;">${d.fire_resistance || 'عادي'}</td>
                    <td>${d.lock_type || '-'} / ${d.hinges || '-'}</td>
                    <td style="text-align:center; color:#15803d; font-weight:bold;">تم التوريد والمطابقة ✓</td>
                </tr>
            `;
        });
    }

    // Punch list items to be noted on handover if any
    let punchItemsHtml = '';
    if (p.punch_list && p.punch_list.length > 0) {
        punchItemsHtml += `<div style="font-weight:bold; margin-top:10px; margin-bottom:4px; color:#b91c1c;">ملاحظات ونواقص تم رصدها بالموقع للمتابعة والإصلاح:</div>`;
        punchItemsHtml += `<ul style="margin:0; padding-right:20px; font-size:11px; color:#334155;">`;
        p.punch_list.forEach(item => {
            punchItemsHtml += `<li><strong>[${item.door_number || 'عام'}]:</strong> ${item.description} (الحالة: ${item.status})</li>`;
        });
        punchItemsHtml += `</ul>`;
    } else {
        punchItemsHtml = `
            <div style="border: 1px dashed #cbd5e1; border-radius:6px; padding:8px 12px; margin-top:8px; font-size:11px; color:#475569;">
                <strong>ملاحظات مهندس الموقع / الملاحظات الفنية:</strong>
                <div style="height:35px; border-bottom:1px dotted #cbd5e1;"></div>
            </div>
        `;
    }

    const htmlContent = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
        <meta charset="UTF-8">
        <title>محضر استلام وتسليم أعمال - ${p.name || ''}</title>
        <style>
            @page { size: A4 portrait; margin: 15mm; }
            * { box-sizing: border-box; font-family: 'Segoe UI', Tahoma, Arial, sans-serif; }
            body { margin: 0; padding: 10px; color: #1e293b; background: #fff; font-size: 12px; line-height: 1.6; }
            .doc-border { border: 2px solid #0f172a; padding: 20px; border-radius: 12px; }
            .header-box { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 15px; }
            .header-title { font-size: 20px; font-weight: 900; color: #0f172a; margin: 0; }
            .header-sub { font-size: 14px; font-weight: bold; color: #047857; margin-top: 4px; }
            .doc-meta { display: flex; justify-content: space-between; font-size: 11px; margin-top: 10px; color: #475569; }
            .section-p { margin-bottom: 12px; text-align: justify; }
            .parties-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; }
            .parties-table td { padding: 8px 12px; border: 1px solid #e2e8f0; vertical-align: top; }
            .doors-table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 15px; font-size: 11px; }
            .doors-table th, .doors-table td { border: 1px solid #cbd5e1; padding: 6px 8px; }
            .doors-table th { background: #1e293b; color: #fff; text-align: center; }
            .terms-list { padding-right: 20px; margin: 10px 0; font-size: 11px; color: #334155; }
            .terms-list li { margin-bottom: 4px; }
            .sign-table { width: 100%; border-collapse: collapse; margin-top: 30px; }
            .sign-table td { width: 33.33%; text-align: center; vertical-align: top; padding: 10px; }
            .sign-title { font-weight: bold; color: #0f172a; margin-bottom: 5px; }
            .sign-space { border-bottom: 1px dashed #64748b; height: 50px; width: 80%; margin: 10px auto; }
            @media print {
                body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
        </style>
    </head>
    <body>
        <div class="doc-border">
            <div class="header-box">
                <h1 class="header-title">شركة فراس وطارق الجدع وشريكهم</h1>
                <div style="font-size: 13px; font-weight: bold; color: #475569; margin-top: 3px;">للأبواب المعدنية والأبواب المقاومة للحريق</div>
                <div class="header-sub" style="margin-top: 6px;">محضر فحص واستلام أعمال وتوريد أبواب الموقع</div>
                <div class="doc-meta">
                    <div><strong>رقم المشروع:</strong> ${p.project_number || '-'}</div>
                    <div><strong>رقم المحضر:</strong> REC-${p.project_number || p.id}</div>
                    <div><strong>تاريخ التحرير:</strong> ${new Date().toLocaleDateString('ar-EG')} م</div>
                </div>
            </div>

            <div class="section-p">
                إنه في يوم ......................... الموافق &nbsp;&nbsp;&nbsp;&nbsp; / &nbsp;&nbsp;&nbsp;&nbsp; / 202... م، بموقع مشروع <strong>(${p.name})</strong> الكائن في <strong>(${p.location || 'الموقع المعتمد'})</strong>، تم بحضور كل من:
            </div>

            <table class="parties-table">
                <tr>
                    <td style="width: 50%;">
                        <strong style="color:#0f172a;">الطرف الأول (المصنع المورد والمنفذ):</strong><br>
                        شركة فراس وطارق الجدع وشريكهم<br>
                        <span style="font-size: 10px; color: #64748b;">للأبواب المعدنية والأبواب المقاومة للحريق</span><br>
                        يمثله المشرف: ............................................
                    </td>
                    <td style="width: 50%;">
                        <strong style="color:#0f172a;">الطرف الثاني (المقاول / الجهة المستلمة):</strong><br>
                        السادة / ${p.contractor_name || 'المقاول المعتمد'}<br>
                        يمثله المهندس المشرف: ${p.engineer_name || '............................................'} (هاتف: ${p.engineer_phone || '-'})
                    </td>
                </tr>
            </table>

            <div class="section-p">
                تمت معاينة وفحص واستلام الأبواب المعدنية الموردة والمنفذة طبقاً للمواصفات الفنية المعتمدة وأوامر التشغيل وبيانها كالتالي:
            </div>

            <table class="doors-table">
                <thead>
                    <tr>
                        <th>رقم الباب</th>
                        <th>العدد</th>
                        <th>المقاس (عرض × ارتفاع × عمق)</th>
                        <th>الاتجاه</th>
                        <th>مقاومة الحريق</th>
                        <th>الزرفيل والإكسسوار</th>
                        <th>حالة الاستلام</th>
                    </tr>
                </thead>
                <tbody>
                    ${doorsSummaryHtml}
                </tbody>
                <tfoot>
                    <tr style="background:#f8fafc; font-weight:bold;">
                        <td style="text-align:center;">الإجمالي</td>
                        <td style="text-align:center;">${totalDoorsCount} باب</td>
                        <td colspan="5" style="text-align:left; padding-left:10px; color:#475569;">لون الدهان المعتمد: ${p.paint_color || '-'}</td>
                    </tr>
                </tfoot>
            </table>

            <div style="font-weight:bold; color:#0f172a; margin-top:8px;">إقرار وشروط الاستلام:</div>
            <ol class="terms-list">
                <li>يقر الطرف الثاني بأنه قد قام بفحص ومعاينة الأعمال والأبواب المذكورة أعلاه فحصاً نافياً للجهالة وتأكد من سلامتها ومطابقتها للمقاسات والمواصفات وألوان الدهان المعتمدة.</li>
                <li>تخضع جميع الأبواب الموردة لضمان المصنع المعتمد ضد عيوب الصناعة وفقاً للعقد المبرم بين الطرفين.</li>
                <li>يعد توقيع هذا المحضر إبراءً لذمة الطرف الأول بخصوص التوريد وسلامة الأبواب المذكورة واستحقاق الدفعة المالية المترتبة على التسليم.</li>
            </ol>

            ${punchItemsHtml}

            <table class="sign-table">
                <tr>
                    <td>
                        <div class="sign-title">مندوب الطرف الأول (الشركة)</div>
                        <div style="font-size:10px; color:#64748b;">شركة فراس وطارق الجدع وشريكهم</div>
                        <div class="sign-space"></div>
                        <div>الاسم والتوقيع: ...........................</div>
                    </td>
                    <td>
                        <div class="sign-title">مندوب الطرف الثاني (المقاول)</div>
                        <div style="font-size:10px; color:#64748b;">مهندس الموقع المستلم</div>
                        <div class="sign-space"></div>
                        <div>الاسم والتوقيع: ...........................</div>
                    </td>
                    <td>
                        <div class="sign-title">اعتماد الإدارة الهندسية والمشاريع</div>
                        <div style="font-size:10px; color:#64748b;">الختم والاعتماد الرسمي</div>
                        <div class="sign-space"></div>
                        <div>التاريخ: ..... / ..... / 202... م</div>
                    </td>
                </tr>
            </table>
        </div>

        <script>
            window.onload = function() {
                setTimeout(function() { window.print(); }, 500);
            };
        </script>
    </body>
    </html>
    `;

    printWin.document.open();
    printWin.document.write(htmlContent);
    printWin.document.close();
};

// ==========================================
//           PURCHASING MODULE
// ==========================================

const SUPPLIERS_URL = `${API_HOST}/api/suppliers`;
const PURCHASE_REQUESTS_URL = `${API_HOST}/api/purchase-requests`;

function showPurchasingView(fromHistory = false) {
    const username = localStorage.getItem('username');
    if (username !== 'admin' && !userPermissionsList.some(p => p.department_name === 'system_purchasing' && (p.can_edit == 1 || p.can_edit === true))) {
        showToast('غير مصرح لك بالوصول لنظام إدارة المشتريات', 'bg-rose-500', '✗');
        return;
    }

    if (!fromHistory) {
        pushNavigationState('purchasing');
    }

    const hrView = document.getElementById('hrView');
    if(hrView) hrView.classList.add('hidden');

    const _prdView = document.getElementById('purchaseRequestDetailView');
    if(_prdView) _prdView.classList.add('hidden');

    document.getElementById('moduleSelectorView').classList.add('hidden');
    document.getElementById('projectsView').classList.add('hidden');
    document.getElementById('projectWizardView').classList.add('hidden');
    document.getElementById('projectDetailView').classList.add('hidden');
    const sView = document.getElementById('servicesView');
    if(sView) sView.classList.add('hidden');
    const swView = document.getElementById('serviceWizardView');
    if(swView) swView.classList.add('hidden');
    const sjdView = document.getElementById('serviceJobDetailView');
    if(sjdView) sjdView.classList.add('hidden');

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
        if (!response.ok) return;
        const suppliers = await response.json();
        allSuppliers = suppliers;
        
        renderSuppliersToBody(suppliers, 'suppliersTableBody');
        renderSuppliersToBody(suppliers, 'projectContractorsTableBody');
    } catch (err) {
        console.error("Failed loading suppliers:", err);
    }
}

function renderSuppliersToBody(suppliers, tbodyId) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!suppliers || suppliers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-slate-500">لا يوجد مقاولين/موردين مضافين بعد</td></tr>`;
        return;
    }
    
    const isSupplierEditAuthorized = localStorage.getItem('username') === 'admin' || userPermissionsList.some(p => (p.department_name === 'purchasing_suppliers' || p.department_name === 'system_projects') && (p.can_edit == 1 || p.can_edit === true));

    suppliers.forEach(s => {
        const mapsLink = s.maps_url ? `<a href="${s.maps_url}" target="_blank" class="text-blue-500 hover:underline">عرض الخريطة</a>` : '-';
        
        let actionsHtml = '';
        if (isSupplierEditAuthorized) {
            actionsHtml = `
                <button onclick="editSupplier(${s.id})" class="text-indigo-600 hover:text-indigo-800 p-1" title="تعديل"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>
                <button onclick="deleteSupplier(${s.id})" class="text-rose-600 hover:text-rose-800 p-1" title="حذف"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
            `;
        } else {
            actionsHtml = '-';
        }

        tbody.innerHTML += `
            <tr class="border-b hover:bg-slate-50 transition">
                <td class="p-4 font-bold text-slate-800">${s.name}</td>
                <td class="p-4" dir="ltr">${s.phone || '-'}</td>
                <td class="p-4 text-slate-600">${s.supply_type || '-'}</td>
                <td class="p-4">${s.location || '-'} ${s.maps_url ? '<br>' + mapsLink : ''}</td>
                <td class="p-4 text-center">
                    ${actionsHtml}
                </td>
            </tr>
        `;
    });
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
async function openPurchaseRequestDetails(id, fromHistory = false) {
    if (!fromHistory) {
        pushNavigationState('purchaseRequestDetail', { id: id });
    }

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
            
            // Store nesting layout data and show preview button
            window.currentSheetNestingData = data;
            const btnPreview = document.getElementById('btnOpenSheetPreview');
            const hasSheets = (data.sheets_1_5 && data.sheets_1_5.length > 0) || (data.sheets_1_2 && data.sheets_1_2.length > 0);
            if (btnPreview) {
                if (hasSheets) {
                    btnPreview.classList.remove('hidden');
                } else {
                    btnPreview.classList.add('hidden');
                }
            }

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
        const btnPreview = document.getElementById('btnOpenSheetPreview');
        if (btnPreview) btnPreview.classList.add('hidden');
    } finally {
        document.getElementById('sheetLoading').classList.add('hidden');
    }
}

// ------------- SHEET NESTING PREVIEW MODAL -------------
let currentActiveSheetTab = '1_5';

window.openSheetNestingPreview = function() {
    if (!window.currentSheetNestingData) {
        showToast('يرجى حساب كميات الصاج أولاً', 'bg-amber-500', '!');
        return;
    }

    const data = window.currentSheetNestingData;
    const count1_5 = (data.sheets_1_5 || []).length;
    const count1_2 = (data.sheets_1_2 || []).length;

    const b1_5 = document.getElementById('badgeSheetCount1_5');
    const b1_2 = document.getElementById('badgeSheetCount1_2');
    if (b1_5) b1_5.textContent = `${count1_5} لوح`;
    if (b1_2) b1_2.textContent = `${count1_2} لوح`;

    // Default to the tab that has sheets
    if (count1_5 > 0) {
        switchSheetNestingTab('1_5');
    } else if (count1_2 > 0) {
        switchSheetNestingTab('1_2');
    } else {
        switchSheetNestingTab('1_5');
    }

    document.getElementById('sheetNestingModal').classList.remove('hidden');
};

window.closeSheetNestingPreview = function() {
    const modal = document.getElementById('sheetNestingModal');
    if (modal) modal.classList.add('hidden');
};

window.switchSheetNestingTab = function(tab) {
    currentActiveSheetTab = tab;
    const tab1_5 = document.getElementById('tabSheetNesting1_5');
    const tab1_2 = document.getElementById('tabSheetNesting1_2');

    if (tab === '1_5') {
        tab1_5.className = 'pb-3 px-4 font-bold text-sm border-b-2 border-emerald-600 text-emerald-700 flex items-center gap-2 transition';
        tab1_2.className = 'pb-3 px-4 font-bold text-sm border-b-2 border-transparent text-slate-500 hover:text-slate-800 flex items-center gap-2 transition';
    } else {
        tab1_2.className = 'pb-3 px-4 font-bold text-sm border-b-2 border-emerald-600 text-emerald-700 flex items-center gap-2 transition';
        tab1_5.className = 'pb-3 px-4 font-bold text-sm border-b-2 border-transparent text-slate-500 hover:text-slate-800 flex items-center gap-2 transition';
    }

    renderSheetNestingContent(tab);
};

window.renderSheetNestingContent = function(tab) {
    const container = document.getElementById('sheetNestingContainer');
    if (!container) return;
    container.innerHTML = '';

    const data = window.currentSheetNestingData;
    if (!data) return;

    const sheets = tab === '1_5' ? (data.sheets_1_5 || []) : (data.sheets_1_2 || []);

    if (sheets.length === 0) {
        container.innerHTML = `
            <div class="py-16 text-center text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto mb-2 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p class="font-bold">لا توجد ألواح مطلوبة لهذه السماكة</p>
            </div>
        `;
        return;
    }

    // Colors palette for pieces
    const colors = [
        { bg: '#ecfdf5', border: '#10b981', text: '#065f46' }, // emerald
        { bg: '#eff6ff', border: '#3b82f6', text: '#1e40af' }, // blue
        { bg: '#eef2ff', border: '#6366f1', text: '#3730a3' }, // indigo
        { bg: '#fdf4ff', border: '#d946ef', text: '#86198f' }, // fuchsia
        { bg: '#fffbeb', border: '#f59e0b', text: '#92400e' }, // amber
        { bg: '#f0fdf4', border: '#22c55e', text: '#166534' }, // green
        { bg: '#f8fafc', border: '#64748b', text: '#1e293b' }, // slate
        { bg: '#fff1f2', border: '#f43f5e', text: '#9f1239' }  // rose
    ];

    sheets.forEach((sheet, sheetIdx) => {
        const sheetCard = document.createElement('div');
        sheetCard.className = 'bg-white p-5 rounded-2xl border border-slate-200 shadow-sm';

        // Calculate sheet statistics
        const sheetArea = sheet.width * sheet.height;
        const usedArea = (sheet.pieces || []).reduce((acc, p) => acc + (p.width * p.height), 0);
        const utilization = sheetArea > 0 ? Math.round((usedArea / sheetArea) * 100) : 0;

        let piecesSvg = '';
        (sheet.pieces || []).forEach((piece, pIdx) => {
            const color = colors[pIdx % colors.length];
            const fontSize = Math.max(3, Math.min(piece.width / 5, piece.height / 5, 8));
            const subFontSize = Math.max(2.2, fontSize * 0.7);

            // Realistic contour rendering based on accurate CAD manufacturing geometry
            let realisticPath = '';
            const pw = piece.width;
            const ph = piece.height;
            const pName = piece.part_name || '';

            if (pName.includes('قائم') && ph > pw) {
                const notchD = Math.min(pw * 0.16, ph * 0.08, 6.0);
                const isLockPost = pName.includes('قفل') || (!pName.includes('فصالات') && (pIdx % 2 === 1));

                // Bend lines along post length
                const bendX1 = (pw * 0.28).toFixed(2);
                const bendX2 = (pw * 0.72).toFixed(2);
                const bendLines = `
                    <line x1="${bendX1}" y1="${notchD}" x2="${bendX1}" y2="${ph}" stroke="${color.border}" stroke-width="0.4" stroke-dasharray="2,2" opacity="0.45" />
                    <line x1="${bendX2}" y1="${notchD}" x2="${bendX2}" y2="${ph}" stroke="${color.border}" stroke-width="0.4" stroke-dasharray="2,2" opacity="0.45" />
                `;

                if (isLockPost) {
                    // --- قائم القفل (Lock Post) ---
                    const lockTopContour = [
                        [0.0, 0.0], [0.0299, 0.0], [0.0377, 0.0248], [0.1774, 0.9504],
                        [0.1852, 1.0], [0.2152, 1.0], [0.2152, 0.8512], [0.2226, 0.8017],
                        [0.2326, 0.8017], [0.2401, 0.8512], [0.2401, 1.0], [0.5840, 1.0],
                        [0.5840, 0.8512], [0.5915, 0.8017], [0.6014, 0.8017], [0.6089, 0.8512],
                        [0.6089, 1.0], [0.6388, 1.0], [0.6467, 0.9504], [0.6579, 0.876],
                        [0.6657, 0.8512], [0.6844, 0.8512], [0.6922, 0.8017], [0.7134, 0.6612],
                        [0.7212, 0.6364], [0.7512, 0.6364], [0.7512, 0.4876], [0.7586, 0.438],
                        [0.7686, 0.438], [0.7761, 0.4876], [0.7761, 0.6364], [0.8148, 0.6364],
                        [0.8148, 0.4876], [0.8222, 0.438], [0.8322, 0.438], [0.8397, 0.4876],
                        [0.8397, 0.6364], [0.8696, 0.6364], [0.8775, 0.5868], [0.9623, 0.0248],
                        [0.9701, 0.0], [1.0, 0.0]
                    ];

                    let d = `M 0,${ph} `;
                    lockTopContour.forEach(pt => {
                        d += `L ${(pt[0] * pw).toFixed(2)},${(pt[1] * notchD).toFixed(2)} `;
                    });
                    d += `L ${pw},${ph} Z`;

                    // Single prominent lock strike plate cutout (تفريغ فتحة لسان القفل / الكيلون) near center/latch height
                    const lockX = Math.max(1, pw * 0.76);
                    const lockW = Math.min(pw * 0.12, 4.2);
                    const lockH = Math.min(ph * 0.09, 16.0);
                    const lockY = (ph * 0.48).toFixed(2);
                    const lockCutout = `
                        <rect x="${lockX.toFixed(2)}" y="${lockY}" width="${lockW.toFixed(2)}" height="${lockH.toFixed(2)}" fill="${color.border}" opacity="0.6" rx="0.5" />
                        <rect x="${(lockX + lockW * 0.2).toFixed(2)}" y="${(parseFloat(lockY) + lockH * 0.25).toFixed(2)}" width="${(lockW * 0.6).toFixed(2)}" height="${(lockH * 0.5).toFixed(2)}" fill="${color.text}" opacity="0.8" rx="0.3" />
                    `;

                    realisticPath = `
                        <path d="${d}" fill="${color.bg}" stroke="${color.border}" stroke-width="0.7" />
                        ${bendLines}
                        ${lockCutout}
                    `;
                } else {
                    // --- قائم الفصالات (Hinge Post) ---
                    const hingeTopContour = [
                        [0.0, 0.0], [0.0299, 0.0], [0.0377, 0.0248], [0.1225, 0.5868],
                        [0.1304, 0.6364], [0.1603, 0.6364], [0.1603, 0.4876], [0.1678, 0.438],
                        [0.1778, 0.438], [0.1852, 0.4876], [0.1852, 0.6364], [0.2239, 0.6364],
                        [0.2239, 0.4876], [0.2314, 0.438], [0.2414, 0.438], [0.2488, 0.4876],
                        [0.2488, 0.6364], [0.2788, 0.6364], [0.2866, 0.6612], [0.3078, 0.8017],
                        [0.3156, 0.8512], [0.3343, 0.8512], [0.3421, 0.876], [0.3533, 0.9504],
                        [0.3612, 1.0], [0.3911, 1.0], [0.3911, 0.8512], [0.3986, 0.8017],
                        [0.4085, 0.8017], [0.416, 0.8512], [0.416, 1.0], [0.7599, 1.0],
                        [0.7599, 0.8512], [0.7674, 0.8017], [0.7774, 0.8017], [0.7848, 0.8512],
                        [0.7848, 1.0], [0.8148, 1.0], [0.8226, 0.9504], [0.9623, 0.0248],
                        [0.9701, 0.0], [1.0, 0.0]
                    ];

                    let d = `M 0,${ph} `;
                    hingeTopContour.forEach(pt => {
                        d += `L ${(pt[0] * pw).toFixed(2)},${(pt[1] * notchD).toFixed(2)} `;
                    });
                    d += `L ${pw},${ph} Z`;

                    // 4 hinge cutouts along hinge rabbet (X ~ 12% - 20% of pw)
                    const hx = Math.max(1, pw * 0.12);
                    const hw = Math.min(pw * 0.08, 3.2);
                    const hh = Math.min(ph * 0.05, 10.2);
                    const hPositions = [ph * 0.08, ph * 0.18, ph * 0.53, ph * 0.88];
                    let hingesSvg = '';
                    hPositions.forEach(hy => {
                        hingesSvg += `<rect x="${hx.toFixed(2)}" y="${hy.toFixed(2)}" width="${hw.toFixed(2)}" height="${hh.toFixed(2)}" fill="${color.border}" opacity="0.5" rx="0.4" />`;
                    });

                    realisticPath = `
                        <path d="${d}" fill="${color.bg}" stroke="${color.border}" stroke-width="0.7" />
                        ${bendLines}
                        ${hingesSvg}
                    `;
                }
            } else if (pName.includes('رأس') && ph > pw) {
                // Header (رأس) with accurate CAD end cutouts on BOTH ends (top & bottom)
                const notchD = Math.min(pw * 0.16, ph * 0.08, 6.0);
                const headCadTop = [
                    [1.0, 0.0], [0.9701, 0.0], [0.9623, 0.0248], [0.8775, 0.5868],
                    [0.8696, 0.6364], [0.8447, 0.4711], [0.7462, 0.4711], [0.7212, 0.6364],
                    [0.7134, 0.6612], [0.6922, 0.8017], [0.6844, 0.8512], [0.6657, 0.8512],
                    [0.6579, 0.876], [0.6467, 0.9504], [0.6388, 1.0], [0.6091, 0.8347],
                    [0.2102, 0.8347], [0.1852, 1.0], [0.1774, 0.9504], [0.0377, 0.0248],
                    [0.0299, 0.0], [0.0, 0.0]
                ];
                const headCadBottom = [
                    [0.0, 0.0], [0.0299, 0.0], [0.0377, 0.0248], [0.1774, 0.9504],
                    [0.1852, 1.0], [0.2102, 0.8347], [0.6091, 0.8347], [0.6388, 1.0],
                    [0.6467, 0.9504], [0.6579, 0.876], [0.6657, 0.8512], [0.6844, 0.8512],
                    [0.6922, 0.8017], [0.7134, 0.6612], [0.7212, 0.6364], [0.7462, 0.4711],
                    [0.8447, 0.4711], [0.8696, 0.6364], [0.8775, 0.5868], [0.9623, 0.0248],
                    [0.9701, 0.0], [1.0, 0.0]
                ];

                let d = `M ${(headCadTop[0][0] * pw).toFixed(2)},${(headCadTop[0][1] * notchD).toFixed(2)} `;
                // Top miter cutouts
                headCadTop.forEach(pt => {
                    d += `L ${(pt[0] * pw).toFixed(2)},${(pt[1] * notchD).toFixed(2)} `;
                });
                // Left straight edge down to bottom cutout
                d += `L 0,${(ph - notchD).toFixed(2)} `;
                // Bottom miter cutouts
                headCadBottom.forEach(pt => {
                    d += `L ${(pt[0] * pw).toFixed(2)},${(ph - pt[1] * notchD).toFixed(2)} `;
                });
                // Right straight edge back up to top
                d += `L ${pw},${notchD.toFixed(2)} Z`;

                // Subtle bend lines
                const bendX1 = (pw * 0.28).toFixed(2);
                const bendX2 = (pw * 0.72).toFixed(2);
                const bendLines = `
                    <line x1="${bendX1}" y1="${notchD}" x2="${bendX1}" y2="${ph - notchD}" stroke="${color.border}" stroke-width="0.4" stroke-dasharray="2,2" opacity="0.45" />
                    <line x1="${bendX2}" y1="${notchD}" x2="${bendX2}" y2="${ph - notchD}" stroke="${color.border}" stroke-width="0.4" stroke-dasharray="2,2" opacity="0.45" />
                `;

                realisticPath = `
                    <path d="${d}" fill="${color.bg}" stroke="${color.border}" stroke-width="0.7" />
                    ${bendLines}
                `;
            } else if (pName.includes('درفة') || pName.includes('درفه')) {
                // Door Leaf (الدرفة)
                // Leaf 1 has hinges on the hinge edge, while both have lock/handle holes on the opposite edge
                const hasHinges = pName.includes('1') || !pName.includes('2');
                
                // Bend / formation lines near left and right edges (e.g., 2% - 4% from edges)
                const leafBendLeft = Math.min(pw * 0.05, 4.0).toFixed(2);
                const leafBendRight = (pw - Math.min(pw * 0.05, 4.0)).toFixed(2);
                const leafBends = `
                    <line x1="${leafBendLeft}" y1="0" x2="${leafBendLeft}" y2="${ph}" stroke="${color.border}" stroke-width="0.35" stroke-dasharray="2,2" opacity="0.35" />
                    <line x1="${leafBendRight}" y1="0" x2="${leafBendRight}" y2="${ph}" stroke="${color.border}" stroke-width="0.35" stroke-dasharray="2,2" opacity="0.35" />
                `;

                // Handle and lock hardware on lock edge (right side) at 104.3 cm (1043 mm) from bottom of leaf
                const handleX = pw - Math.min(pw * 0.10, 8.0);
                const handleY = (ph > 110) ? (ph - 104.3) : (ph * 0.50);
                const lockEdgeCutout = `
                    <circle cx="${handleX.toFixed(2)}" cy="${handleY.toFixed(2)}" r="${Math.min(pw * 0.025, 2.5).toFixed(2)}" fill="${color.border}" opacity="0.55" />
                    <rect x="${(pw - Math.min(pw * 0.035, 3.0)).toFixed(2)}" y="${(handleY - Math.min(ph * 0.06, 12)).toFixed(2)}" width="${Math.min(pw * 0.035, 3.0).toFixed(2)}" height="${(Math.min(ph * 0.06, 12) * 2).toFixed(2)}" fill="${color.border}" opacity="0.5" rx="0.4" />
                `;

                // Hinges on the hinge edge (left side) if leaf 1 (which contains hinges)
                let leafHingesSvg = '';
                if (hasHinges) {
                    const lHingesY = [ph * 0.10, ph * 0.22, ph * 0.54, ph * 0.88];
                    const lhw = Math.min(pw * 0.035, 3.2);
                    const lhh = Math.min(ph * 0.05, 10.2);
                    lHingesY.forEach(hy => {
                        leafHingesSvg += `<rect x="0.5" y="${hy.toFixed(2)}" width="${lhw.toFixed(2)}" height="${lhh.toFixed(2)}" fill="${color.border}" opacity="0.55" rx="0.4" />`;
                    });
                }

                realisticPath = `
                    <rect width="${pw}" height="${ph}" fill="${color.bg}" stroke="${color.border}" stroke-width="0.7" rx="0.5" />
                    ${leafBends}
                    ${lockEdgeCutout}
                    ${leafHingesSvg}
                `;
            } else {
                realisticPath = `<rect width="${pw}" height="${ph}" fill="${color.bg}" stroke="${color.border}" stroke-width="0.7" rx="0.5" />`;
            }

            piecesSvg += `
                <g class="piece-group" transform="translate(${piece.x}, ${piece.y})">
                    ${realisticPath}
                    <!-- Label: Door Number -->
                    <text x="${piece.width / 2}" y="${piece.height / 2 - fontSize * 0.5}" font-size="${fontSize}" font-weight="bold" fill="${color.text}" text-anchor="middle" dominant-baseline="central">
                        ${piece.door_number || 'باب'}
                    </text>
                    <!-- Label: Dimensions (Width×Height) -->
                    <text x="${piece.width / 2}" y="${piece.height / 2 + fontSize * 0.7}" font-size="${subFontSize}" fill="${color.text}" opacity="0.9" text-anchor="middle" dominant-baseline="central">
                        (${piece.width}×${piece.height})
                    </text>
                </g>
            `;
        });

        sheetCard.innerHTML = `
            <div class="flex justify-between items-center mb-3 pb-2 border-b border-slate-100 flex-wrap gap-2">
                <div class="flex items-center gap-3">
                    <span class="w-8 h-8 rounded-lg bg-emerald-600 text-white font-black flex items-center justify-center text-sm shadow-sm">${sheet.sheet_index}</span>
                    <div>
                        <h4 class="font-bold text-slate-800 text-base">لوح صاج قياس ${sheet.size} سم</h4>
                        <p class="text-xs text-slate-500">سماكة ${tab === '1_5' ? '1.5 ملم' : '1.2 ملم'} • عدد القطع: ${(sheet.pieces || []).length}</p>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <span class="text-xs px-3 py-1 bg-slate-100 text-slate-700 rounded-lg font-semibold border border-slate-200">
                        نسبة استغلال اللوح: <strong class="text-emerald-600 font-bold">${utilization}%</strong>
                    </span>
                </div>
            </div>

            <!-- SVG Layout View -->
            <div class="bg-slate-100/70 p-4 rounded-xl border border-slate-200 overflow-x-auto flex justify-center items-center">
                <svg viewBox="0 0 ${sheet.width} ${sheet.height}" class="max-w-full max-h-[420px] w-auto h-auto shadow-sm rounded border-2 border-slate-400 bg-white" style="display: block;">
                    <!-- Sheet border grid / pattern background -->
                    <rect x="0" y="0" width="${sheet.width}" height="${sheet.height}" fill="#fcfdfe" stroke="#94a3b8" stroke-width="1" />
                    <!-- Pieces -->
                    ${piecesSvg}
                </svg>
            </div>

            <!-- Pieces List -->
            <div class="mt-3 pt-2 flex flex-wrap gap-2 text-xs">
                ${(sheet.pieces || []).map((p, idx) => {
                    const c = colors[idx % colors.length];
                    return `
                        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border font-medium" style="background-color: ${c.bg}; border-color: ${c.border}; color: ${c.text}">
                            <strong>${p.door_number || 'باب'}</strong>
                            <span>(${p.width}×${p.height} سم)</span>
                        </span>
                    `;
                }).join('')}
            </div>
        `;

        container.appendChild(sheetCard);
    });
};

// =========================================================================
// CLEAN INTERACTIVE PROFILE VIEWER & DIMENSION EDITOR (Single Rabbit with Rubber)
// Faithful to: Single rabbit with ruber frame.dxf
// =========================================================================

window.profileEditorState = {
    D: 150.0,       // Overall frame depth (top)
    A_L: 40.0,      // Left architrave (upper height)
    S: 22.0,        // Rabbet step height (lower left)
    A_R: 62.0,      // Right architrave (total height = A_L + S = 62)
    W_rab: 52.0,    // Rabbet width (bottom left)
    W_step: 12.0,   // Step width before rubber (middle bottom)
    W_web: 98.0,    // Web width (D - W_rab = 150 - 52 = 98)
    H_step: 10.5,   // Step height
    S_in: 14.5,     // Inner step height
    R_L: 15.0,      // Left top return flange
    R_R: 15.0,      // Right top return flange
    T: 1.5,         // Sheet thickness
    isReadOnly: false, // Read-only mode flag (true in project view, false in wizard)
    // Source context
    sourceType: null, // 'project' or 'wizard'
    sourceDoorIdx: null,
    sourceRowEl: null
};

// Check if profile type is supported (Always allow viewing)
window.isProfileSupported = function(profileType) {
    return true;
};

// Unsupported profile modal
window.showUnsupportedProfileModal = function(profileName) {
    const modal = document.getElementById('unsupportedProfileModal');
    const msg = document.getElementById('unsupportedProfileMsg');
    if (msg) {
        msg.innerHTML = `المقطع المختار: <strong class="text-amber-700">${profileName || 'غير محدد'}</strong><br>المعاينة التفاعلية والتعديل المباشر متاحان حالياً لمقطع <strong class="text-slate-900">Single rabbit with rubber</strong> فقط.`;
    }
    if (modal) modal.classList.remove('hidden');
};

window.closeUnsupportedProfileModal = function() {
    const modal = document.getElementById('unsupportedProfileModal');
    if (modal) modal.classList.add('hidden');
};

// Calculate exact unfolded flat width (Sheet Metal Flat Pattern Width)
window.calculateProfileUnfoldedWidth = function(s) {
    const pType = (s.profileType || s.profile_type || '').toLowerCase();
    const isDrnr = (pType.includes('double') || pType.includes('مزدوج')) && (pType.includes('without') || pType.includes('بدون'));
    const isDouble = (pType.includes('double') || pType.includes('مزدوج')) && !isDrnr;
    const isWithoutRubber = (pType.includes('without') || pType.includes('بدون') || pType === 'single rabbit') && !isDrnr;

    const D = parseFloat(s.D) || (isDouble ? 160.0 : 150.0);
    const A_L = parseFloat(s.A_L) || (isDrnr ? 40.0 : (isDouble ? 50.0 : (isWithoutRubber ? 55.0 : 40.0)));
    const A_R = parseFloat(s.A_R) !== undefined ? parseFloat(s.A_R) : (isDrnr ? 40.0 : (isDouble ? 50.0 : (isWithoutRubber ? 40.0 : 62.0)));
    const R_L = parseFloat(s.R_L) || 15.0;
    const R_R = parseFloat(s.R_R) || 15.0;

    if (isDrnr) {
        // Double Rabbit Without Rubber Benchmark: D=150, A_L=40, A_R=40, R_L=15, R_R=15 => Unfolded Flat = 272.94 mm
        const delta = (D - 150.0)
                    + (A_L - 40.0)
                    + (A_R - 40.0)
                    + (R_L - 15.0)
                    + (R_R - 15.0);
        return Math.max(50.0, Math.round((272.94 + delta) * 10) / 10);
    }

    if (isDouble) {
        // Double Rabbit with Rubber Benchmark: D=160, A_L=50, A_R=50, R_L=15, R_R=15 => Unfolded Flat = 338.34 mm
        const delta = (D - 160.0)
                    + (A_L - 50.0)
                    + (A_R - 50.0)
                    + (R_L - 15.0)
                    + (R_R - 15.0);
        return Math.max(50.0, Math.round((338.34 + delta) * 10) / 10);
    }

    if (isWithoutRubber) {
        // Single Rabbit Without Rubber Benchmark: D=150, A_L=55, A_R=40, R_L=15, R_R=15 => Unfolded Flat = 275.80 mm
        const delta = (D - 150.0)
                    + (A_L - 55.0)
                    + (A_R - 40.0)
                    + (R_L - 15.0)
                    + (R_R - 15.0);
        return Math.max(50.0, Math.round((275.80 + delta) * 10) / 10);
    }

    // Single Rabbit With Rubber Benchmark: D=150, A_L=40, A_R=62, R_L=15, R_R=15 => Unfolded Flat = 315.9 mm
    const delta = (D - 150.0)
                + (A_L - 40.0)
                + (A_R - 62.0)
                + (R_L - 15.0)
                + (R_R - 15.0);

    const totalMm = Math.max(50.0, Math.round((315.9 + delta) * 10) / 10);
    return totalMm;
};

// Update Unfolded Width Corner Badge
function updateProfileUnfoldedBadge() {
    const totalMm = window.calculateProfileUnfoldedWidth(window.profileEditorState);
    const totalCm = (totalMm / 10.0).toFixed(1);

    const lblMm = document.getElementById('lblTotalUnfoldedWidth');
    const lblCm = document.getElementById('lblTotalUnfoldedCm');

    if (lblMm) lblMm.textContent = totalMm.toFixed(1);
    if (lblCm) lblCm.textContent = `(${totalCm} سم)`;
}

// Update Modal UI between Editable (Wizard) and Read-Only (Project View)
window.updateProfileModalUI = function() {
    const s = window.profileEditorState;
    const subtitle = document.getElementById('lblProfileSubtitle');
    const btnReset = document.getElementById('btnProfileReset');
    const btnApply = document.getElementById('btnProfileApply');
    const btnCancel = document.getElementById('btnProfileCancel');
    const footerNote = document.getElementById('lblProfileFooterNote');

    if (s.isReadOnly) {
        if (subtitle) subtitle.textContent = 'معاينة مقطع الحلق وحساب الإفراد (للتعديل يرجى استخدام زر تعديل المشروع)';
        if (btnReset) btnReset.classList.add('hidden');
        if (btnApply) btnApply.classList.add('hidden');
        if (btnCancel) btnCancel.textContent = 'إغلاق';
        if (footerNote) footerNote.textContent = '• نمط العرض فقط: المقاسات معتمدة ومسجلة في المشروع';
    } else {
        if (subtitle) subtitle.textContent = 'انقر مباشرة على أي رقم أو خط بعد في الرسم لتعديل قياسه أو اختر مقطعاً آخر';
        if (btnReset) btnReset.classList.remove('hidden');
        if (btnApply) btnApply.classList.remove('hidden');
        if (btnCancel) btnCancel.textContent = 'إلغاء';
        if (footerNote) footerNote.textContent = '• المقاسات المعروضة بالملم وسماكة الصاج الافتراضية 1.5 ملم';
    }

    // Sync Profile Select in Studio Modal
    const sel = document.getElementById('studioProfileSelect');
    if (sel) {
        const curP = (s.profileType || 'single rabbit with rubber').toLowerCase();
        for (let i = 0; i < sel.options.length; i++) {
            const optVal = sel.options[i].value.toLowerCase();
            if (optVal === curP ||
                (curP === 'single rabbit' && optVal.includes('single rabbit without rubber')) ||
                (curP === 'double rabbit' && optVal.includes('double rabbit without rubber'))) {
                sel.selectedIndex = i;
                break;
            }
        }
        sel.disabled = !!s.isReadOnly;
    }

    // Sync labels in controls bar and bottom bar
    const lblD = document.getElementById('lblStudioProfileD');
    const lblA1 = document.getElementById('lblStudioProfileA1');
    const lblA2 = document.getElementById('lblStudioProfileA2');
    const lblName = document.getElementById('lblCurrentProfileName');
    const lblThick = document.getElementById('lblCurrentProfileThickness');
    const lblUnfolded = document.getElementById('lblCurrentProfileUnfolded');

    if (lblD) lblD.textContent = ((s.D || 150) / 10).toFixed(1);
    if (lblA1) lblA1.textContent = ((s.A_L || 40) / 10).toFixed(1);
    if (lblA2) lblA2.textContent = ((s.A_R || 62) / 10).toFixed(1);
    if (lblName) lblName.textContent = s.profileType || 'single rabbit with rubber';
    if (lblThick) lblThick.textContent = (s.T || 1.5) + ' مم';
    if (lblUnfolded) lblUnfolded.textContent = window.calculateProfileUnfoldedWidth(s) + ' مم';
};

// Studio Modal: Switch Profile Type
window.onStudioProfileTypeChange = function(newProfile) {
    const p = window.profileEditorState;
    const s = window.doorElevationState;
    p.profileType = newProfile;
    s.profileType = newProfile;
    const pType = (newProfile || '').toLowerCase();

    const isDrnr = (pType.includes('double') || pType.includes('مزدوج')) && (pType.includes('without') || pType.includes('بدون'));
    const isDouble = (pType.includes('double') || pType.includes('مزدوج')) && !isDrnr;
    const isWithoutRubber = (pType.includes('without') || pType.includes('بدون') || pType === 'single rabbit') && !isDrnr;

    if (isDrnr) {
        // Double rabbit without rubber benchmark: D=150, A_L=40, A_R=40
        p.D = 150.0;
        p.A_L = 40.0;
        p.A_R = 40.0;
        p.R_L = 15.0;
        p.R_R = 15.0;
        p.W_rab1 = 47.0;
        p.W_rab2 = 47.0;
        p.S1 = 15.0;
        p.S2 = 15.0;
        p.W_web = 56.0;
    } else if (isDouble) {
        // Double rabbit with rubber benchmark: D=160, A_L=50, A_R=50
        p.D = 160.0;
        p.A_L = 50.0;
        p.A_R = 50.0;
        p.R_L = 15.0;
        p.R_R = 15.0;
        p.W_rab1 = 52.0;
        p.W_step = 12.0;
        p.H_step = 10.5;
        p.S_in = 11.5;
        p.W_rab2 = 47.0;
        p.W_web = 61.0;
    } else if (isWithoutRubber) {
        // Single rabbit without rubber benchmark: D=150, A_L=55, A_R=40
        p.D = 150.0;
        p.A_L = 55.0;
        p.A_R = 40.0;
        p.R_L = 15.0;
        p.R_R = 15.0;
    } else {
        // Single rabbit with rubber benchmark: D=150, A_L=40, A_R=62
        p.D = 150.0;
        p.A_L = 40.0;
        p.A_R = 62.0;
        p.W_rab = 52.0;
        p.W_step = 12.0;
        p.W_web = 98.0;
        p.H_step = 10.5;
        p.S_in = 14.5;
        p.R_L = 15.0;
        p.R_R = 15.0;
    }

    s.depth = p.D / 10.0;
    s.architrave = p.A_L / 10.0;
    s.architrave2 = p.A_R / 10.0;

    window.updateProfileModalUI();
    window.renderCleanProfileSvg();
    if (typeof updateProfileUnfoldedBadge === 'function') updateProfileUnfoldedBadge();
    if (typeof updateDoorElevationUI === 'function') updateDoorElevationUI();
};

// Reset to Default Factory Profile
window.resetProfileToDefault = function() {
    if (window.profileEditorState.isReadOnly) return;
    const curP = window.profileEditorState.profileType || 'single rabbit with rubber';
    window.onStudioProfileTypeChange(curP);
    showToast('تمت إعادة ضبط المقطع إلى مقاسات الـ DXF القياسية', 'bg-slate-700', '↺');
};

// Close modal
window.closeInteractiveProfileEditor = function() {
    const modal = document.getElementById('profileEditorModal');
    if (modal) modal.classList.add('hidden');
};

// =========================================================================
// INTERACTIVE DOOR ELEVATION & PROFILE CAD STUDIO
// =========================================================================

window.doorElevationState = {
    width: 100.0,          // Total Width in cm
    height: 220.0,         // Total Height in cm
    depth: 15.0,           // Depth in cm
    architrave: 4.0,       // Architrave 1 in cm
    architrave2: 6.2,      // Architrave 2 in cm
    direction: 'RH',       // 'RH', 'LH', 'Double'
    doorType: 'Single leaf metal',
    lockType: 'Mortise',   // 'Mortise', 'Panic Bar', etc.
    hinges: 'Standard Stainless Steel',
    hingesCount: 4,
    hasWindow: false,
    windowWidth: 20,
    windowHeight: 60,
    windowPosition: 'Center',
    raddad: false,
    doorNumber: 'باب',
    isReadOnly: false,
    sourceType: null,      // 'project' or 'wizard'
    sourceDoorIdx: null,
    sourceRowEl: null,
    activeTab: 'elevation' // 'elevation' or 'profile'
};

// Studio Tab Switcher
window.switchStudioTab = function(tabName) {
    window.doorElevationState.activeTab = tabName;
    const btnElev = document.getElementById('btnStudioTabElevation');
    const btnProf = document.getElementById('btnStudioTabProfile');
    const cElev = document.getElementById('doorElevationContainer');
    const cProf = document.getElementById('doorProfileContainer');
    const badgeElev = document.getElementById('badgeDoorElevationStats');
    const badgeProf = document.getElementById('badgeProfileUnfolded');
    const title = document.getElementById('lblStudioTitle');

    if (tabName === 'profile') {
        if (cElev) cElev.classList.add('hidden');
        if (cProf) cProf.classList.remove('hidden');
        if (badgeElev) badgeElev.classList.add('hidden');
        if (badgeProf) badgeProf.classList.remove('hidden');

        if (btnProf) {
            btnProf.className = 'px-4 py-1.5 rounded-xl text-xs font-bold transition-all bg-white text-emerald-700 shadow-sm flex items-center gap-1.5 cursor-pointer';
        }
        if (btnElev) {
            btnElev.className = 'px-4 py-1.5 rounded-xl text-xs font-bold transition-all text-slate-600 hover:text-slate-900 flex items-center gap-1.5 cursor-pointer';
        }
        if (title) title.textContent = 'معاينة وتعديل مقطع الحلق (Profile CAD)';
        window.updateProfileModalUI();
        window.renderCleanProfileSvg();
        if (typeof updateProfileUnfoldedBadge === 'function') updateProfileUnfoldedBadge();
    } else {
        if (cProf) cProf.classList.add('hidden');
        if (cElev) cElev.classList.remove('hidden');
        if (badgeProf) badgeProf.classList.add('hidden');
        if (badgeElev) badgeElev.classList.remove('hidden');

        if (btnElev) {
            btnElev.className = 'px-4 py-1.5 rounded-xl text-xs font-bold transition-all bg-white text-indigo-700 shadow-sm flex items-center gap-1.5 cursor-pointer';
        }
        if (btnProf) {
            btnProf.className = 'px-4 py-1.5 rounded-xl text-xs font-bold transition-all text-slate-600 hover:text-slate-900 flex items-center gap-1.5 cursor-pointer';
        }
        if (title) title.textContent = 'معاينة وتعديل شكل الباب';
        window.renderDoorElevationSvg();
    }
};

// Calculate Leaf Sizes
window.calculateDoorElevationLeafSizes = function() {
    const s = window.doorElevationState;
    let w = parseFloat(s.width) || 100.0;
    let h = parseFloat(s.height) || 220.0;
    let arch = parseFloat(s.architrave) || 4.0;
    if (w > 350) w /= 10.0;
    if (h > 450) h /= 10.0;
    if (arch > 20) arch /= 10.0;

    const rawDir = (s.direction || '').toUpperCase();
    const dt = (s.doorType || '').toLowerCase();
    const isDouble = rawDir === 'RA' || rawDir === 'LA' || rawDir === 'DOUBLE' || rawDir.includes('D/') || rawDir.includes('دبل') || dt.includes('double') || dt.includes('دبل');

    // Leaf height: Door height - Architrave (A1) - 3mm (frame gap) - 7mm (floor clearance) = H - A1 - 1.0 cm
    const leafHeight = Math.max(10, Math.round((h - arch - 1.0) * 100) / 100);

    if (isDouble) {
        // Double door: clearances = 3.5mm (left) + 3.5mm (right) + 8.0mm (middle) = 15.0mm (1.5 cm)
        const leafW = Math.max(10, Math.round(((w - (2 * arch) - 1.5) / 2) * 100) / 100);
        // User requested reversing direction for RA and LA:
        // For RA: Active leaf is on the left (isRightActive = false)
        // For LA: Active leaf is on the right (isRightActive = true)
        const isRightActive = (rawDir === 'LA' || rawDir.includes('LA') || rawDir.includes('D/LA'));
        return {
            isDouble: true,
            leaf1: leafW,
            leaf2: leafW,
            leafHeight: leafHeight,
            a1_unfolded_mm: Math.round((leafW_mm + 105.30) * 10) / 10,
            a2_unfolded_mm: Math.round((leafW_mm + 79.65) * 10) / 10,
            a4_unfolded_mm: Math.round((leafW_mm + 134.34) * 10) / 10,
            a3_unfolded_mm: Math.round((leafW_mm + 51.86) * 10) / 10,
            isRightActive: isRightActive
        };
    } else {
        // Single door: clearance = 7.0mm (0.7 cm) total
        const leaf1 = Math.max(10, Math.round((w - (2 * arch) - 0.7) * 100) / 100);
        const leaf1_mm = leaf1 * 10;
        const leaf1Unfolded_mm = Math.round((leaf1_mm + 140.12) * 10) / 10;
        return {
            isDouble: false,
            leaf1: leaf1,
            leaf2: null,
            leafHeight: leafHeight,
            leaf1Unfolded_mm: leaf1Unfolded_mm
        };
    }
};

// Update Door Elevation UI & Inputs
window.updateDoorElevationUI = function() {
    const s = window.doorElevationState;
    const inpW = document.getElementById('doorCtrlWidth');
    const inpH = document.getElementById('doorCtrlHeight');
    const lblStatW = document.getElementById('lblDoorStatsWidth');
    const lblStatH = document.getElementById('lblDoorStatsHeight');

    if (inpW && document.activeElement !== inpW) inpW.value = s.width;
    if (inpH && document.activeElement !== inpH) inpH.value = s.height;
    if (lblStatW) lblStatW.textContent = s.width;
    if (lblStatH) lblStatH.textContent = s.height;

    // Direction dropdown select (LH, RH, RA, LA)
    const dirSel = document.getElementById('doorElevationDirectionSelect');
    if (dirSel) {
        let curDir = (s.direction || 'RH').toUpperCase();
        if (curDir === 'DOUBLE' || curDir === 'D/RA' || curDir === 'D/RH') curDir = 'RA';
        if (curDir === 'D/LA' || curDir === 'D/LH') curDir = 'LA';
        if (!['LH', 'RH', 'RA', 'LA'].includes(curDir)) {
            curDir = (s.doorType || '').toLowerCase().includes('double') ? 'RA' : 'RH';
        }
        dirSel.value = curDir;
    }

    // Stats bar
    const leafInfo = window.calculateDoorElevationLeafSizes();
    const lblLeaf1 = document.getElementById('lblStatsLeaf1');
    const lblLeaf2 = document.getElementById('lblStatsLeaf2');
    const boxLeaf2 = document.getElementById('boxStatsLeaf2');
    const lblDoorType = document.getElementById('lblStatsDoorType');
    const lblArch = document.getElementById('lblStatsArchitrave');
    const lblLock = document.getElementById('lblStatsLock');
    const lblHinges = document.getElementById('lblStatsHinges');
    const lblHandleHole = document.getElementById('lblStatsHandleHole');

    if (leafInfo.isDouble) {
        if (leafInfo.isRightActive) {
            if (lblLeaf1) lblLeaf1.textContent = `درفة رئيسية (يمين): ${leafInfo.leaf1} × ${leafInfo.leafHeight} سم (إفراد A1: ${leafInfo.a1_unfolded_mm} مم | A2: ${leafInfo.a2_unfolded_mm} مم)`;
            if (boxLeaf2 && lblLeaf2) {
                boxLeaf2.classList.remove('hidden');
                lblLeaf2.textContent = `درفة ثانوية (يسار): ${leafInfo.leaf2} × ${leafInfo.leafHeight} سم (إفراد A4: ${leafInfo.a4_unfolded_mm} مم | A3: ${leafInfo.a3_unfolded_mm} مم)`;
            }
        } else {
            if (lblLeaf1) lblLeaf1.textContent = `درفة رئيسية (يسار): ${leafInfo.leaf1} × ${leafInfo.leafHeight} سم (إفراد A1: ${leafInfo.a1_unfolded_mm} مم | A2: ${leafInfo.a2_unfolded_mm} مم)`;
            if (boxLeaf2 && lblLeaf2) {
                boxLeaf2.classList.remove('hidden');
                lblLeaf2.textContent = `درفة ثانوية (يمين): ${leafInfo.leaf2} × ${leafInfo.leafHeight} سم (إفراد A4: ${leafInfo.a4_unfolded_mm} مم | A3: ${leafInfo.a3_unfolded_mm} مم)`;
            }
        }
    } else {
        if (lblLeaf1) lblLeaf1.textContent = `${leafInfo.leaf1} × ${leafInfo.leafHeight} سم (إفراد: ${leafInfo.leaf1Unfolded_mm} مم)`;
        if (boxLeaf2) boxLeaf2.classList.add('hidden');
    }

    if (lblDoorType) lblDoorType.textContent = s.doorType || (leafInfo.isDouble ? 'Double leaf metal' : 'Single leaf metal');
    if (lblArch) lblArch.textContent = `${s.architrave} سم`;
    if (lblLock) lblLock.textContent = s.lockType || 'Mortise';
    if (lblHinges) lblHinges.textContent = `${s.hingesCount || 4} فصالات (${s.hinges || 'ستانلس'})`;
    if (lblHandleHole) lblHandleHole.textContent = '1050 ملم (1043 ملم عن قاع الدرفة)';

    // Mode handling (Read-only vs Editable)
    const subtitle = document.getElementById('lblProfileSubtitle');
    const btnReset = document.getElementById('btnProfileReset');
    const btnApply = document.getElementById('btnProfileApply');
    const btnCancel = document.getElementById('btnProfileCancel');
    const footerNote = document.getElementById('lblProfileFooterNote');
    const controlsBar = document.getElementById('doorElevationControls');

    if (s.isReadOnly) {
        if (subtitle) subtitle.textContent = 'معاينة تفاعلية لشكل الباب وأبعاده (للتعديل يرجى استخدام زر تعديل المشروع)';
        if (btnReset) btnReset.classList.add('hidden');
        if (btnApply) btnApply.classList.add('hidden');
        if (btnCancel) btnCancel.textContent = 'إغلاق';
        if (footerNote) footerNote.textContent = '• نمط العرض فقط: المقاسات معتمدة ومسجلة في المشروع';
        if (controlsBar) controlsBar.classList.add('pointer-events-none', 'opacity-60');
    } else {
        if (subtitle) subtitle.textContent = 'انقر مباشرة على أبعاد العرض أو الارتفاع في الرسم لتعديل القياس فوراً';
        if (btnReset) btnReset.classList.remove('hidden');
        if (btnApply) btnApply.classList.remove('hidden');
        if (btnCancel) btnCancel.textContent = 'إلغاء';
        if (footerNote) footerNote.textContent = '• انقر على رقم العرض أو الارتفاع في الرسم للتعديل المباشر • يتم تحديث قياس الدرف والمقطع تلقائياً';
        if (controlsBar) controlsBar.classList.remove('pointer-events-none', 'opacity-60');
    }
};

// Steppers
window.adjustDoorDimension = function(dim, delta) {
    if (window.doorElevationState.isReadOnly) return;
    const s = window.doorElevationState;
    if (dim === 'width') {
        s.width = Math.max(50, Math.min(350, Math.round((parseFloat(s.width) + delta) * 10) / 10));
    } else if (dim === 'height') {
        s.height = Math.max(120, Math.min(350, Math.round((parseFloat(s.height) + delta) * 10) / 10));
    }
    window.updateDoorElevationUI();
    window.renderDoorElevationSvg();
};

window.onDoorDimensionInput = function(dim, val) {
    if (window.doorElevationState.isReadOnly) return;
    const num = parseFloat(val);
    if (isNaN(num) || num <= 0) return;
    const s = window.doorElevationState;
    if (dim === 'width') {
        s.width = Math.max(40, Math.min(400, Math.round(num * 10) / 10));
    } else if (dim === 'height') {
        s.height = Math.max(100, Math.min(400, Math.round(num * 10) / 10));
    }
    window.updateDoorElevationUI();
    window.renderDoorElevationSvg();
};

window.setDoorElevationDirection = function(dir) {
    if (window.doorElevationState.isReadOnly) return;
    const s = window.doorElevationState;
    s.direction = dir;
    if (dir === 'RA' || dir === 'LA' || dir === 'Double') {
        s.doorType = 'Double leaf metal';
    } else {
        s.doorType = 'Single leaf metal';
    }
    // If opened from a wizard row, update the row directly as well
    if (s.sourceType === 'wizard' && s.sourceRowEl) {
        const selects = Array.from(s.sourceRowEl.querySelectorAll('select'));
        const dirSelect = selects.find(sel => {
            const opts = Array.from(sel.options).map(o => o.value);
            return opts.includes('RH') || opts.includes('LH') || opts.includes('RA') || opts.includes('LA');
        });
        if (dirSelect) {
            dirSelect.value = dir;
        }
        const dtSelect = s.sourceRowEl.querySelector('.pd-doortype-select') || selects.find(sel => {
            const html = (sel.innerHTML || '').toLowerCase();
            return html.includes('single leaf') || html.includes('double leaf');
        });
        if (dtSelect) {
            const isDbl = (dir === 'RA' || dir === 'LA');
            const opts = Array.from(dtSelect.options);
            const m = opts.find(o => isDbl ? o.value.toLowerCase().includes('double') : o.value.toLowerCase().includes('single'));
            if (m) dtSelect.value = m.value;
        }
        const wInput = s.sourceRowEl.querySelector('.pd-width-input') || s.sourceRowEl.querySelector('input[placeholder="عرض"]') || s.sourceRowEl.querySelectorAll('input')[2];
        if (wInput && typeof autoCalculateLeafSizes === 'function') {
            autoCalculateLeafSizes(wInput);
        }
    }
    window.updateDoorElevationUI();
    window.renderDoorElevationSvg();
};

window.applyDoorPreset = function(w, h, dir) {
    if (window.doorElevationState.isReadOnly) return;
    const s = window.doorElevationState;
    s.width = w;
    s.height = h;
    if (dir) {
        s.direction = dir;
        if (dir === 'Double') s.doorType = 'Double leaf metal';
    }
    window.updateDoorElevationUI();
    window.renderDoorElevationSvg();
};

// In-place click on SVG dimension badge (Direct CAD-style inline editing)
window.editDoorDimensionInPlace = function(dim, event) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    if (window.doorElevationState.isReadOnly) {
        if (typeof showToast === 'function') {
            showToast('نمط العرض فقط: للتعديل افتح نافذة تعديل المشروع', 'bg-slate-700', 'ℹ');
        }
        return;
    }

    const s = window.doorElevationState;
    const currentVal = dim === 'width' ? s.width : s.height;
    const targetId = dim === 'width' ? 'badgeDimWidth' : 'badgeDimHeight';
    const targetEl = document.getElementById(targetId);
    if (!targetEl) return;

    if (targetEl.querySelector('foreignObject')) return;

    const originalContent = targetEl.innerHTML;
    const bx = parseFloat(targetEl.dataset.x) || 0;
    const by = parseFloat(targetEl.dataset.y) || 0;

    const inputW = 340;
    const inputH = 84;

    targetEl.innerHTML = `
        <foreignObject x="${bx - inputW / 2}" y="${by - inputH / 2}" width="${inputW}" height="${inputH}" class="overflow-visible">
            <div xmlns="http://www.w3.org/1999/xhtml" style="display:flex; justify-content:center; align-items:center; width:100%; height:100%; direction:rtl;">
                <div style="display:flex; align-items:center; justify-content:center; background:#ffffff; border:3.5px solid #4f46e5; border-radius:20px; box-shadow:0 8px 24px rgba(79, 70, 229, 0.35); padding:4px 10px; width:100%; height:100%; box-sizing:border-box;">
                    <span style="font-size:26px; font-weight:900; color:#4338ca; margin-left:6px; font-family:system-ui, sans-serif; white-space:nowrap;">
                        ${dim === 'width' ? 'العرض:' : 'الارتفاع:'}
                    </span>
                    <input type="number" step="0.5" id="dim-door-inline-${dim}" value="${currentVal}"
                        style="width:120px; height:54px; text-align:center; font-size:32px; font-weight:900; font-family:system-ui, sans-serif;
                               background:#f8fafc; color:#1e1b4b; border:2px solid #cbd5e1; border-radius:10px; outline:none; padding:0 4px;" />
                    <span style="font-size:22px; font-weight:700; color:#64748b; margin-right:6px; font-family:system-ui, sans-serif;">سم</span>
                </div>
            </div>
        </foreignObject>
    `;

    const inputEl = document.getElementById(`dim-door-inline-${dim}`);
    if (!inputEl) return;

    let isHandled = false;
    const commitVal = () => {
        if (isHandled) return;
        isHandled = true;
        const newVal = parseFloat(inputEl.value);
        if (!isNaN(newVal) && newVal > 0) {
            if (dim === 'width') {
                s.width = Math.max(30, Math.min(500, Math.round(newVal * 10) / 10));
                if (s.sourceType === 'wizard' && s.sourceRowEl) {
                    const wInput = s.sourceRowEl.querySelector('input[placeholder="عرض"]') || s.sourceRowEl.querySelectorAll('input')[2];
                    if (wInput) {
                        wInput.value = s.width;
                        if (typeof autoCalculateLeafSizes === 'function') autoCalculateLeafSizes(wInput);
                    }
                }
            } else {
                s.height = Math.max(50, Math.min(500, Math.round(newVal * 10) / 10));
                if (s.sourceType === 'wizard' && s.sourceRowEl) {
                    const hInput = s.sourceRowEl.querySelector('input[placeholder="طول"]') || s.sourceRowEl.querySelector('input[placeholder="الارتفاع"]') || s.sourceRowEl.querySelectorAll('input')[3];
                    if (hInput) {
                        hInput.value = s.height;
                    }
                }
            }

            if (typeof window.calculateSheetRequirements === 'function') {
                try { window.calculateSheetRequirements(); } catch(e) {}
            }

            window.updateDoorElevationUI();
            window.renderDoorElevationSvg();

            if (typeof showToast === 'function') {
                showToast(`تم تعديل ${dim === 'width' ? 'العرض' : 'الارتفاع'} إلى ${s[dim]} سم`, 'bg-indigo-600', '✓');
            }
        } else {
            targetEl.innerHTML = originalContent;
        }
    };

    const cancelEdit = () => {
        if (isHandled) return;
        isHandled = true;
        targetEl.innerHTML = originalContent;
    };

    inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            commitVal();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelEdit();
        }
    });

    inputEl.addEventListener('blur', () => {
        commitVal();
    });

    setTimeout(() => {
        inputEl.focus();
        inputEl.select();
    }, 20);
};

// Render Door Elevation SVG (Architectural Elevation CAD View)
window.renderDoorElevationSvg = function() {
    const viewport = document.getElementById('doorElevationSvgViewport');
    if (!viewport) return;

    const s = window.doorElevationState;
    const W = (parseFloat(s.width) || 100.0) * 10;   // Convert cm to mm
    const H = (parseFloat(s.height) || 220.0) * 10;  // Convert cm to mm
    const arch = (parseFloat(s.architrave) || 4.0) * 10; // Architrave width in mm
    const isDouble = s.direction === 'Double' || (s.doorType || '').toLowerCase().includes('double') || (s.doorType || '').includes('دبل');
    const dir = s.direction || 'RH';

    // ViewBox Margins (Ensuring door, floor, dimensions and badges are never clipped)
    const marginL = 190;
    const marginR = 60;
    const marginT = 160;
    const marginB = 140;
    const vbX = -marginL;
    const vbY = -marginT;
    const vbW = W + marginL + marginR;
    const vbH = H + marginT + marginB;

    // Leaf and Opening Geometry
    const openingW = Math.max(100, W - 2 * arch);
    const openingH = Math.max(200, H - arch);
    const leafGapTop = 3;       // فراغ بين الباب والحلق من الأعلى = 3 ملم
    const clearanceBottom = 7;  // فراغ بين الدرفة والأرض من الأسفل = 7 ملم
    const leafGapSides = 3.5;   // خلوص جانبي = 3.5 ملم (إجمالي الخلوص الجانبي = 7 ملم)

    // Leaf size calculations
    const leafCalc = window.calculateDoorElevationLeafSizes();
    const leaf1W = isDouble ? (leafCalc.leaf1 * 10) : (openingW - 7);
    const leaf2W = isDouble ? (leafCalc.leaf2 * 10) : 0;
    // طول الدرفة = طول الباب - كشفة A1 - 3 ملم (فراغ أعلى) - 7 ملم (فراغ أسفل)
    const leafH = H - arch - leafGapTop - clearanceBottom;

    // مكان ثقب اليد ثابت على ارتفاع 1050 ملم من الأرض التشطيبية إلى منتصف الدائرة (1043 ملم عن قاع الدرفة)
    const handleHoleY = H - 1050;
    const isPanic = (s.lockType || '').toLowerCase().includes('panic') || (s.lockType || '').includes('طوارئ');

    // Hinges parameters
    const hingeW = 18;
    const hingeH = 95;
    const hingeYPositions = [
        arch + 160,
        arch + 420,
        Math.round((arch + 420 + H - 240) / 2),
        H - 240
    ];

    let leavesSvg = '';
    let hingesSvg = '';
    let swingTrianglesSvg = '';
    let hardwareSvg = '';
    let windowSvg = '';
    let closerSvg = '';

    if (!isDouble) {
        // SINGLE LEAF
        const leafX = arch + leafGapSides;
        const leafY = arch + leafGapTop;
        const leafW = leaf1W;

        leavesSvg = `
            <!-- Single Leaf Body -->
            <rect x="${leafX}" y="${leafY}" width="${leafW}" height="${leafH}" rx="3" fill="url(#doorLeafGrad)" stroke="#64748b" stroke-width="2" filter="url(#leafShadow)"/>
            <!-- Inner leaf bevel line -->
            <rect x="${leafX + 8}" y="${leafY + 8}" width="${leafW - 16}" height="${leafH - 16}" rx="2" fill="none" stroke="#cbd5e1" stroke-width="1.5" stroke-opacity="0.8"/>
            <!-- Leaf size watermark -->
            <g transform="translate(${leafX + leafW/2}, ${H - 160})">
                <text x="0" y="0" text-anchor="middle" font-family="system-ui, sans-serif" font-size="32" font-weight="bold" fill="#475569" opacity="0.9">درفة: ${leafCalc.leaf1} × ${(leafH / 10).toFixed(1)} سم (إفراد: ${leafCalc.leaf1Unfolded_mm} مم)</text>
                <text x="0" y="32" text-anchor="middle" font-family="system-ui, sans-serif" font-size="20" font-weight="semibold" fill="#64748b" opacity="0.8">طول الدرفة = ${s.height} - ${s.architrave} - 0.3 - 0.7 = ${(leafH / 10).toFixed(1)} سم</text>
            </g>
        `;

        // Swing Triangle
        if (dir === 'RH') {
            // Hinges on Right jamb, Handle on Left
            const apexX = leafX + 55;
            swingTrianglesSvg = `
                <polygon points="${leafX + leafW},${leafY} ${apexX},${handleHoleY} ${leafX + leafW},${leafY + leafH}" fill="rgba(79, 70, 229, 0.04)" stroke="#4f46e5" stroke-width="2.5" stroke-dasharray="14,10"/>
                <circle cx="${apexX}" cy="${handleHoleY}" r="4" fill="#4f46e5"/>
            `;
            // Hinges on Right
            hingeYPositions.forEach(hy => {
                hingesSvg += `
                    <g transform="translate(${W - arch - hingeW + 2}, ${hy})">
                        <rect x="0" y="0" width="${hingeW}" height="${hingeH}" rx="4" fill="url(#doorHingeGrad)" stroke="#334155" stroke-width="1.5"/>
                        <line x1="${hingeW/2}" y1="2" x2="${hingeW/2}" y2="${hingeH - 2}" stroke="#475569" stroke-width="1.5"/>
                        <line x1="2" y1="${hingeH/3}" x2="${hingeW - 2}" y2="${hingeH/3}" stroke="#64748b" stroke-width="1"/>
                        <line x1="2" y1="${(hingeH/3)*2}" x2="${hingeW - 2}" y2="${(hingeH/3)*2}" stroke="#64748b" stroke-width="1"/>
                    </g>
                `;
            });
            // Hardware on Left
            if (isPanic) {
                const bX = leafX + 35;
                const bW = leafW - 70;
                hardwareSvg = `
                    <g id="panicBarHardware">
                        <rect x="${bX}" y="${handleHoleY - 24}" width="${bW}" height="48" rx="8" fill="#1e293b" stroke="#0f172a" stroke-width="2"/>
                        <rect x="${bX + 25}" y="${handleHoleY - 16}" width="${bW - 50}" height="32" rx="6" fill="#ef4444" stroke="#b91c1c" stroke-width="1.5"/>
                        <text x="${bX + bW/2}" y="${handleHoleY + 6}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="18" font-weight="900" fill="#ffffff" letter-spacing="1">PUSH • بار طوارئ</text>
                    </g>
                `;
            } else {
                const hx = leafX + 55;
                hardwareSvg = `
                    <g id="mortiseLockHardware">
                        <!-- Escutcheon Plate -->
                        <rect x="${hx - 14}" y="${handleHoleY - 50}" width="28" height="155" rx="7" fill="#475569" stroke="#1e293b" stroke-width="2"/>
                        <!-- Lever handle pointing inward (right) -->
                        <rect x="${hx}" y="${handleHoleY - 7.5}" width="65" height="15" rx="7" fill="#e2e8f0" stroke="#1e293b" stroke-width="2"/>
                        <!-- Handle Spindle Hole / Center Circle (1050mm from floor, 1043mm from leaf bottom) -->
                        <circle cx="${hx}" cy="${handleHoleY}" r="11" fill="#334155" stroke="#1e293b" stroke-width="2"/>
                        <circle cx="${hx}" cy="${handleHoleY}" r="4" fill="#0f172a"/>
                        <!-- Keyhole / Euro Cylinder (72mm below spindle) -->
                        <circle cx="${hx}" cy="${handleHoleY + 72}" r="5" fill="#0f172a"/>
                        <path d="M ${hx - 3} ${handleHoleY + 74} L ${hx + 3} ${handleHoleY + 74} L ${hx + 2} ${handleHoleY + 88} L ${hx - 2} ${handleHoleY + 88} Z" fill="#0f172a"/>
                    </g>
                `;
            }
        } else {
            // LH: Hinges on Left jamb, Handle on Right
            const apexX = leafX + leafW - 55;
            swingTrianglesSvg = `
                <polygon points="${leafX},${leafY} ${apexX},${handleHoleY} ${leafX},${leafY + leafH}" fill="rgba(79, 70, 229, 0.04)" stroke="#4f46e5" stroke-width="2.5" stroke-dasharray="14,10"/>
                <circle cx="${apexX}" cy="${handleHoleY}" r="4" fill="#4f46e5"/>
            `;
            // Hinges on Left
            hingeYPositions.forEach(hy => {
                hingesSvg += `
                    <g transform="translate(${arch - 2}, ${hy})">
                        <rect x="0" y="0" width="${hingeW}" height="${hingeH}" rx="4" fill="url(#doorHingeGrad)" stroke="#334155" stroke-width="1.5"/>
                        <line x1="${hingeW/2}" y1="2" x2="${hingeW/2}" y2="${hingeH - 2}" stroke="#475569" stroke-width="1.5"/>
                        <line x1="2" y1="${hingeH/3}" x2="${hingeW - 2}" y2="${hingeH/3}" stroke="#64748b" stroke-width="1"/>
                        <line x1="2" y1="${(hingeH/3)*2}" x2="${hingeW - 2}" y2="${(hingeH/3)*2}" stroke="#64748b" stroke-width="1"/>
                    </g>
                `;
            });
            // Hardware on Right
            if (isPanic) {
                const bX = leafX + 35;
                const bW = leafW - 70;
                hardwareSvg = `
                    <g id="panicBarHardware">
                        <rect x="${bX}" y="${handleHoleY - 24}" width="${bW}" height="48" rx="8" fill="#1e293b" stroke="#0f172a" stroke-width="2"/>
                        <rect x="${bX + 25}" y="${handleHoleY - 16}" width="${bW - 50}" height="32" rx="6" fill="#ef4444" stroke="#b91c1c" stroke-width="1.5"/>
                        <text x="${bX + bW/2}" y="${handleHoleY + 6}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="18" font-weight="900" fill="#ffffff" letter-spacing="1">PUSH • بار طوارئ</text>
                    </g>
                `;
            } else {
                const hx = leafX + leafW - 55;
                hardwareSvg = `
                    <g id="mortiseLockHardware">
                        <!-- Escutcheon Plate -->
                        <rect x="${hx - 14}" y="${handleHoleY - 50}" width="28" height="155" rx="7" fill="#475569" stroke="#1e293b" stroke-width="2"/>
                        <!-- Lever handle pointing inward (left) -->
                        <rect x="${hx - 65}" y="${handleHoleY - 7.5}" width="65" height="15" rx="7" fill="#e2e8f0" stroke="#1e293b" stroke-width="2"/>
                        <!-- Handle Spindle Hole / Center Circle (1050mm from floor, 1043mm from leaf bottom) -->
                        <circle cx="${hx}" cy="${handleHoleY}" r="11" fill="#334155" stroke="#1e293b" stroke-width="2"/>
                        <circle cx="${hx}" cy="${handleHoleY}" r="4" fill="#0f172a"/>
                        <!-- Keyhole -->
                        <circle cx="${hx}" cy="${handleHoleY + 72}" r="5" fill="#0f172a"/>
                        <path d="M ${hx - 3} ${handleHoleY + 74} L ${hx + 3} ${handleHoleY + 74} L ${hx + 2} ${handleHoleY + 88} L ${hx - 2} ${handleHoleY + 88} Z" fill="#0f172a"/>
                    </g>
                `;
            }
        }

        // Window (Vision Panel)
        if (s.hasWindow) {
            const wW = (parseFloat(s.windowWidth) || 20) * 10;
            const wH = (parseFloat(s.windowHeight) || 60) * 10;
            const wX = (s.windowPosition === 'Side') ? (dir === 'RH' ? leafX + 80 : leafX + leafW - wW - 80) : (leafX + (leafW - wW)/2);
            const wY = arch + 340;
            windowSvg = `
                <g id="visionPanel">
                    <rect x="${wX}" y="${wY}" width="${wW}" height="${wH}" rx="6" fill="#1e293b" stroke="#0f172a" stroke-width="2"/>
                    <rect x="${wX + 12}" y="${wY + 12}" width="${wW - 24}" height="${wH - 24}" rx="4" fill="url(#doorGlassGrad)" stroke="#38bdf8" stroke-width="1.5"/>
                    <line x1="${wX + 22}" y1="${wY + wH - 22}" x2="${wX + wW - 22}" y2="${wY + 22}" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity="0.65"/>
                    <text x="${wX + wW/2}" y="${wY + wH + 28}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="17" font-weight="bold" fill="#0284c7">زجاج: ${s.windowWidth}×${s.windowHeight} سم</text>
                </g>
            `;
        }

        // Door Closer (رداد)
        if (s.raddad) {
            const clW = 190;
            const clH = 46;
            const clX = (dir === 'RH') ? (W - arch - clW - 20) : (arch + 20);
            const clY = arch + 14;
            closerSvg = `
                <g id="doorCloser">
                    <rect x="${clX}" y="${clY}" width="${clW}" height="${clH}" rx="6" fill="#334155" stroke="#1e293b" stroke-width="2"/>
                    <line x1="${clX + clW/2}" y1="${clY + clH/2}" x2="${clX + clW/2 + (dir === 'RH' ? -60 : 60)}" y2="${arch - 12}" stroke="#475569" stroke-width="4.5" stroke-linecap="round"/>
                    <circle cx="${clX + clW/2 + (dir === 'RH' ? -60 : 60)}" cy="${arch - 12}" r="5" fill="#1e293b"/>
                    <text x="${clX + clW/2}" y="${clY + 29}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="14" font-weight="bold" fill="#ffffff">رداد هيدروليكي</text>
                </g>
            `;
        }
    } else {
        // DOUBLE LEAF (دبل)
        const gapBetween = 8;
        const l1W = leafCalc.leaf1 * 10;
        const l2W = leafCalc.leaf2 * 10;

        const leaf1X = arch + leafGapSides;
        const leaf1Y = arch + leafGapTop;
        const leaf2X = leaf1X + l1W + gapBetween;
        const leaf2Y = leaf1Y;
        const isRightActive = leafCalc.isRightActive;

        const leftTitle = isRightActive ? 'درفة ثانوية (خاملة)' : 'درفة رئيسية (نشطة)';
        const rightTitle = isRightActive ? 'درفة رئيسية (نشطة)' : 'درفة ثانوية (خاملة)';
        const leftUnfold = isRightActive ? `إفراد A4: ${leafCalc.a4_unfolded_mm} مم | A3: ${leafCalc.a3_unfolded_mm} مم` : `إفراد A1: ${leafCalc.a1_unfolded_mm} مم | A2: ${leafCalc.a2_unfolded_mm} مم`;
        const rightUnfold = isRightActive ? `إفراد A1: ${leafCalc.a1_unfolded_mm} مم | A2: ${leafCalc.a2_unfolded_mm} مم` : `إفراد A4: ${leafCalc.a4_unfolded_mm} مم | A3: ${leafCalc.a3_unfolded_mm} مم`;

        leavesSvg = `
            <!-- Left Leaf -->
            <rect x="${leaf1X}" y="${leaf1Y}" width="${l1W}" height="${leafH}" rx="3" fill="url(#doorLeafGrad)" stroke="#64748b" stroke-width="2" filter="url(#leafShadow)"/>
            <rect x="${leaf1X + 8}" y="${leaf1Y + 8}" width="${l1W - 16}" height="${leafH - 16}" rx="2" fill="none" stroke="#cbd5e1" stroke-width="1.5" stroke-opacity="0.8"/>
            <g transform="translate(${leaf1X + l1W/2}, ${H - 160})">
                <text x="0" y="0" text-anchor="middle" font-family="system-ui, sans-serif" font-size="28" font-weight="bold" fill="#475569" opacity="0.9">${leftTitle}: ${leafCalc.leaf1} × ${(leafH / 10).toFixed(1)} سم</text>
                <text x="0" y="28" text-anchor="middle" font-family="system-ui, sans-serif" font-size="18" font-weight="semibold" fill="#64748b" opacity="0.85">${leftUnfold}</text>
            </g>

            <!-- Right Leaf -->
            <rect x="${leaf2X}" y="${leaf2Y}" width="${l2W}" height="${leafH}" rx="3" fill="url(#doorLeafGrad)" stroke="#64748b" stroke-width="2" filter="url(#leafShadow)"/>
            <rect x="${leaf2X + 8}" y="${leaf2Y + 8}" width="${l2W - 16}" height="${leafH - 16}" rx="2" fill="none" stroke="#cbd5e1" stroke-width="1.5" stroke-opacity="0.8"/>
            <g transform="translate(${leaf2X + l2W/2}, ${H - 160})">
                <text x="0" y="0" text-anchor="middle" font-family="system-ui, sans-serif" font-size="28" font-weight="bold" fill="#475569" opacity="0.9">${rightTitle}: ${leafCalc.leaf2} × ${(leafH / 10).toFixed(1)} سم</text>
                <text x="0" y="28" text-anchor="middle" font-family="system-ui, sans-serif" font-size="18" font-weight="semibold" fill="#64748b" opacity="0.85">${rightUnfold}</text>
            </g>

            <!-- Central Astragal (شفة الركوب 36.5 ملم) -->
            <rect x="${isRightActive ? (leaf1X + l1W - 5) : (leaf2X - 31.5)}" y="${leaf1Y}" width="36.5" height="${leafH}" fill="#475569" stroke="#334155" stroke-width="1"/>
            
            <!-- Inactive Leaf Flush Bolts (ترابيس للأعلى والأسفل) -->
            <rect x="${isRightActive ? (leaf1X + l1W - 25) : (leaf2X + 5)}" y="${leaf1Y + 30}" width="18" height="65" rx="3" fill="#cbd5e1" stroke="#475569" stroke-width="1.5"/>
            <rect x="${isRightActive ? (leaf1X + l1W - 25) : (leaf2X + 5)}" y="${leaf1Y + leafH - 95}" width="18" height="65" rx="3" fill="#cbd5e1" stroke="#475569" stroke-width="1.5"/>
        `;

        // Double Triangles meeting at center
        const apexX = leaf1X + l1W + (gapBetween / 2);
        swingTrianglesSvg = `
            <!-- Left leaf swing -->
            <polygon points="${leaf1X},${leaf1Y} ${apexX - 15},${handleHoleY} ${leaf1X},${leaf1Y + leafH}" fill="rgba(79, 70, 229, 0.03)" stroke="#4f46e5" stroke-width="2.5" stroke-dasharray="14,10"/>
            <!-- Right leaf swing -->
            <polygon points="${leaf2X + l2W},${leaf2Y} ${apexX + 15},${handleHoleY} ${leaf2X + l2W},${leaf2Y + leafH}" fill="rgba(79, 70, 229, 0.03)" stroke="#4f46e5" stroke-width="2.5" stroke-dasharray="14,10"/>
            <circle cx="${apexX}" cy="${handleHoleY}" r="5" fill="#4f46e5"/>
        `;

        // Hinges on BOTH left and right outer jambs
        hingeYPositions.forEach(hy => {
            // Left jamb hinges
            hingesSvg += `
                <g transform="translate(${arch - 2}, ${hy})">
                    <rect x="0" y="0" width="${hingeW}" height="${hingeH}" rx="4" fill="url(#doorHingeGrad)" stroke="#334155" stroke-width="1.5"/>
                    <line x1="${hingeW/2}" y1="2" x2="${hingeW/2}" y2="${hingeH - 2}" stroke="#475569" stroke-width="1.5"/>
                </g>
            `;
            // Right jamb hinges
            hingesSvg += `
                <g transform="translate(${W - arch - hingeW + 2}, ${hy})">
                    <rect x="0" y="0" width="${hingeW}" height="${hingeH}" rx="4" fill="url(#doorHingeGrad)" stroke="#334155" stroke-width="1.5"/>
                    <line x1="${hingeW/2}" y1="2" x2="${hingeW/2}" y2="${hingeH - 2}" stroke="#475569" stroke-width="1.5"/>
                </g>
            `;
        });

        // Hardware on Active leaf (and passive leaf if panic)
        if (isPanic) {
            const b1W = l1W - 60;
            const b2W = l2W - 60;
            hardwareSvg = `
                <g id="doublePanicBars">
                    <rect x="${leaf1X + 30}" y="${handleHoleY - 24}" width="${b1W}" height="48" rx="8" fill="#1e293b" stroke="#0f172a" stroke-width="2"/>
                    <rect x="${leaf1X + 50}" y="${handleHoleY - 16}" width="${b1W - 40}" height="32" rx="6" fill="#ef4444" stroke="#b91c1c" stroke-width="1.5"/>

                    <rect x="${leaf2X + 30}" y="${handleHoleY - 24}" width="${b2W}" height="48" rx="8" fill="#1e293b" stroke="#0f172a" stroke-width="2"/>
                    <rect x="${leaf2X + 50}" y="${handleHoleY - 16}" width="${b2W - 40}" height="32" rx="6" fill="#ef4444" stroke="#b91c1c" stroke-width="1.5"/>
                    <text x="${W/2}" y="${handleHoleY + 6}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="17" font-weight="900" fill="#ffffff">PUSH • ذراعا طوارئ مزدوجان</text>
                </g>
            `;
        } else {
            const hx = isRightActive ? (leaf2X + 45) : (leaf1X + l1W - 45);
            const leverX = isRightActive ? hx : (hx - 65);
            hardwareSvg = `
                <g id="doubleMortiseLock">
                    <rect x="${hx - 14}" y="${handleHoleY - 50}" width="28" height="155" rx="7" fill="#475569" stroke="#1e293b" stroke-width="2"/>
                    <rect x="${leverX}" y="${handleHoleY - 7.5}" width="65" height="15" rx="7" fill="#e2e8f0" stroke="#1e293b" stroke-width="2"/>
                    <circle cx="${hx}" cy="${handleHoleY}" r="11" fill="#334155" stroke="#1e293b" stroke-width="2"/>
                    <circle cx="${hx}" cy="${handleHoleY}" r="4" fill="#0f172a"/>
                    <circle cx="${hx}" cy="${handleHoleY + 72}" r="5" fill="#0f172a"/>
                    <path d="M ${hx - 3} ${handleHoleY + 74} L ${hx + 3} ${handleHoleY + 74} L ${hx + 2} ${handleHoleY + 88} L ${hx - 2} ${handleHoleY + 88} Z" fill="#0f172a"/>
                </g>
            `;
        }

        // Vision panels on both leaves if present
        if (s.hasWindow) {
            const wW = Math.min(l1W - 60, (parseFloat(s.windowWidth) || 20) * 10);
            const wH = (parseFloat(s.windowHeight) || 60) * 10;
            const w1X = leaf1X + (l1W - wW)/2;
            const w2X = leaf2X + (l2W - wW)/2;
            const wY = arch + 340;
            windowSvg = `
                <g id="doubleVisionPanels">
                    <!-- Left window -->
                    <rect x="${w1X}" y="${wY}" width="${wW}" height="${wH}" rx="6" fill="#1e293b" stroke="#0f172a" stroke-width="2"/>
                    <rect x="${w1X + 10}" y="${wY + 10}" width="${wW - 20}" height="${wH - 20}" rx="4" fill="url(#doorGlassGrad)" stroke="#38bdf8" stroke-width="1.5"/>
                    <!-- Right window -->
                    <rect x="${w2X}" y="${wY}" width="${wW}" height="${wH}" rx="6" fill="#1e293b" stroke="#0f172a" stroke-width="2"/>
                    <rect x="${w2X + 10}" y="${wY + 10}" width="${wW - 20}" height="${wH - 20}" rx="4" fill="url(#doorGlassGrad)" stroke="#38bdf8" stroke-width="1.5"/>
                </g>
            `;
        }
    }

    // Outer Frame SVG (Mitered 45° corners)
    const frameSvg = `
        <g id="steelOuterFrame">
            <!-- Left Jamb -->
            <rect x="0" y="0" width="${arch}" height="${H}" fill="url(#doorFrameGrad)" stroke="#1e293b" stroke-width="2"/>
            <!-- Right Jamb -->
            <rect x="${W - arch}" y="0" width="${arch}" height="${H}" fill="url(#doorFrameGrad)" stroke="#1e293b" stroke-width="2"/>
            <!-- Top Header -->
            <rect x="${arch}" y="0" width="${W - 2*arch}" height="${arch}" fill="url(#doorFrameGrad)" stroke="#1e293b" stroke-width="2"/>
            <!-- 45 Degree Corner Miters -->
            <line x1="0" y1="0" x2="${arch}" y2="${arch}" stroke="#0f172a" stroke-width="2.5"/>
            <line x1="${W}" y1="0" x2="${W - arch}" y2="${arch}" stroke="#0f172a" stroke-width="2.5"/>
        </g>
    `;

    // Floor Line (F.F.L) with architectural ground hatching
    const floorX1 = -marginL + 30;
    const floorX2 = W + marginR - 20;
    let floorHatchLines = '';
    for (let fx = floorX1; fx <= floorX2; fx += 28) {
        floorHatchLines += `<line x1="${fx}" y1="${H}" x2="${fx - 18}" y2="${H + 24}" stroke="#94a3b8" stroke-width="2"/>`;
    }
    const floorSvg = `
        <g id="floorLevelGroup">
            <!-- Solid floor level line -->
            <line x1="${floorX1}" y1="${H}" x2="${floorX2}" y2="${H}" stroke="#334155" stroke-width="4"/>
            <!-- Architectural floor hatch lines -->
            ${floorHatchLines}
            <!-- F.F.L text label -->
            <text x="${floorX1 + 10}" y="${H + 46}" font-family="system-ui, sans-serif" font-size="26" font-weight="900" fill="#64748b">F.F.L ±0.00 (منسوب التشطيب)</text>
        </g>
    `;

    // Dimension Lines (Width & Height with interactive clickable badges)
    const dimWidthY = -85;
    const dimHeightX = -110;

    const dimensionsSvg = `
        <g id="architecturalDimensions">
            <!-- Top Width Dimension Lines -->
            <line x1="0" y1="-8" x2="0" y2="${dimWidthY - 25}" stroke="#94a3b8" stroke-dasharray="8,8" stroke-width="2.5"/>
            <line x1="${W}" y1="-8" x2="${W}" y2="${dimWidthY - 25}" stroke="#94a3b8" stroke-dasharray="8,8" stroke-width="2.5"/>
            <line x1="0" y1="${dimWidthY}" x2="${W}" y2="${dimWidthY}" stroke="#4f46e5" stroke-width="4" marker-start="url(#arrowStart)" marker-end="url(#arrowEnd)"/>

            <!-- Top Width Interactive Badge -->
            <g id="badgeDimWidth" class="cursor-pointer group" onclick="editDoorDimensionInPlace('width', event)" data-x="${W/2}" data-y="${dimWidthY}">
                <rect x="${W/2 - 170}" y="${dimWidthY - 42}" width="340" height="84" rx="20" fill="#ffffff" stroke="#4f46e5" stroke-width="3.5" filter="url(#badgeShadow)"/>
                <text x="${W/2}" y="${dimWidthY + 16}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="46" font-weight="900" fill="#312e81">العرض: ${s.width} سم ✎</text>
            </g>

            <!-- Left Height Dimension Lines -->
            <line x1="-8" y1="0" x2="${dimHeightX - 25}" y2="0" stroke="#94a3b8" stroke-dasharray="8,8" stroke-width="2.5"/>
            <line x1="-8" y1="${H}" x2="${dimHeightX - 25}" y2="${H}" stroke="#94a3b8" stroke-dasharray="8,8" stroke-width="2.5"/>
            <line x1="${dimHeightX}" y1="0" x2="${dimHeightX}" y2="${H}" stroke="#4f46e5" stroke-width="4" marker-start="url(#arrowStart)" marker-end="url(#arrowEnd)"/>

            <!-- Left Height Interactive Badge -->
            <g id="badgeDimHeight" class="cursor-pointer group" onclick="editDoorDimensionInPlace('height', event)" data-x="${dimHeightX}" data-y="${H/2}">
                <g id="badgeDimHeightInner" transform="rotate(-90, ${dimHeightX}, ${H/2})">
                    <rect x="${dimHeightX - 170}" y="${H/2 - 42}" width="340" height="84" rx="20" fill="#ffffff" stroke="#4f46e5" stroke-width="3.5" filter="url(#badgeShadow)"/>
                    <text x="${dimHeightX}" y="${H/2 + 16}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="46" font-weight="900" fill="#312e81">الارتفاع: ${s.height} سم ✎</text>
                </g>
            </g>
        </g>
    `;

    viewport.innerHTML = `
        <svg viewBox="${vbX} ${vbY} ${vbW} ${vbH}" class="w-full h-full max-h-[85vh] drop-shadow-md select-none transition-all duration-200" style="display:block; margin:auto;" preserveAspectRatio="xMidYMid meet">
            <defs>
                <!-- Frame Steel Gradient -->
                <linearGradient id="doorFrameGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stop-color="#334155" />
                    <stop offset="50%" stop-color="#475569" />
                    <stop offset="100%" stop-color="#334155" />
                </linearGradient>

                <!-- Leaf Powder-Coated Metal Gradient -->
                <linearGradient id="doorLeafGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#f8fafc" />
                    <stop offset="50%" stop-color="#f1f5f9" />
                    <stop offset="100%" stop-color="#e2e8f0" />
                </linearGradient>

                <!-- Stainless Steel Hinges Gradient -->
                <linearGradient id="doorHingeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stop-color="#94a3b8" />
                    <stop offset="35%" stop-color="#ffffff" />
                    <stop offset="65%" stop-color="#cbd5e1" />
                    <stop offset="100%" stop-color="#64748b" />
                </linearGradient>

                <!-- Glass Gradient -->
                <linearGradient id="doorGlassGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#e0f2fe" stop-opacity="0.85" />
                    <stop offset="50%" stop-color="#7dd3fc" stop-opacity="0.9" />
                    <stop offset="100%" stop-color="#38bdf8" stop-opacity="0.85" />
                </linearGradient>

                <!-- Dimension Arrows (Blue) -->
                <marker id="arrowStart" viewBox="0 0 10 10" refX="2" refY="5" markerWidth="9" markerHeight="9" orient="auto">
                    <path d="M 10 1 L 1 5 L 10 9 z" fill="#4f46e5" />
                </marker>
                <marker id="arrowEnd" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="9" markerHeight="9" orient="auto">
                    <path d="M 0 1 L 9 5 L 0 9 z" fill="#4f46e5" />
                </marker>

                <!-- Dimension Arrows (Green for Handle) -->
                <marker id="arrowStartGreen" viewBox="0 0 10 10" refX="2" refY="5" markerWidth="9" markerHeight="9" orient="auto">
                    <path d="M 10 1 L 1 5 L 10 9 z" fill="#059669" />
                </marker>
                <marker id="arrowEndGreen" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="9" markerHeight="9" orient="auto">
                    <path d="M 0 1 L 9 5 L 0 9 z" fill="#059669" />
                </marker>

                <!-- Floor Hatch Pattern -->
                <pattern id="floorHatchPattern" width="16" height="16" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                    <line x1="0" y1="0" x2="0" y2="16" stroke="#94a3b8" stroke-width="2"/>
                </pattern>

                <!-- Shadows -->
                <filter id="badgeShadow" x="-15%" y="-20%" width="130%" height="150%">
                    <feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#312e81" flood-opacity="0.18"/>
                </filter>
                <filter id="leafShadow" x="-5%" y="-2%" width="110%" height="106%">
                    <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#0f172a" flood-opacity="0.12"/>
                </filter>
            </defs>

            <!-- CAD Background Grid -->
            <rect x="${vbX}" y="${vbY}" width="${vbW}" height="${vbH}" fill="#f8fafc" />

            <!-- Floor Line & Hatch -->
            ${floorSvg}

            <!-- Steel Outer Frame -->
            ${frameSvg}

            <!-- Leaves (Single / Double) -->
            ${leavesSvg}

            <!-- Swing Direction Triangles -->
            ${swingTrianglesSvg}

            <!-- Hinges -->
            ${hingesSvg}

            <!-- Vision Panel / Window -->
            ${windowSvg}

            <!-- Locks / Handles / Panic Bar -->
            ${hardwareSvg}

            <!-- Door Closer -->
            ${closerSvg}

            <!-- Dimension Lines & Interactive Badges -->
            ${dimensionsSvg}
        </svg>
    `;
};

// Reset Studio Tab
window.resetStudioCurrentTab = function() {
    const s = window.doorElevationState;
    if (s.isReadOnly) return;
    if (s.activeTab === 'elevation') {
        s.width = 100.0;
        s.height = 220.0;
        window.updateDoorElevationUI();
        window.renderDoorElevationSvg();
        if (typeof showToast === 'function') {
            showToast('تمت إعادة ضبط أبعاد الباب إلى 100 × 220 سم', 'bg-slate-700', '↺');
        }
    } else {
        window.resetProfileToDefault();
    }
};

// Apply Studio Changes to Source (Wizard or Edit Table Row)
window.applyStudioChangesToSource = function() {
    const s = window.doorElevationState;
    const p = window.profileEditorState;

    if (s.isReadOnly) {
        window.closeInteractiveProfileEditor();
        return;
    }

    if (s.sourceType === 'wizard' && s.sourceRowEl) {
        const tr = s.sourceRowEl;

        // 1. Width
        const widthInput = tr.querySelector('.pd-width-input') || tr.querySelector('input[placeholder="عرض"]') || tr.querySelectorAll('input')[2];
        if (widthInput) widthInput.value = s.width;

        // 2. Height
        const heightInput = tr.querySelector('input[placeholder="طول"]') || tr.querySelector('input[placeholder="الارتفاع"]') || tr.querySelectorAll('input')[3];
        if (heightInput) heightInput.value = s.height;

        // 3. Depth (from profile editor state)
        const depthCm = Math.round((p.D / 10.0) * 10) / 10;
        const depthInput = tr.querySelector('input[placeholder="عمق"]') || tr.querySelectorAll('input')[4];
        if (depthInput) depthInput.value = depthCm;

        // 4. Architrave 1
        const arch1Cm = Math.round((p.A_L / 10.0) * 10) / 10;
        const arch1Input = tr.querySelector('.pd-architrave-input') || tr.querySelector('input[placeholder="الكشفة"]');
        if (arch1Input) arch1Input.value = arch1Cm;

        // 5. Architrave 2
        const arch2Cm = Math.round((p.A_R / 10.0) * 10) / 10;
        const arch2Input = tr.querySelector('.pd-architrave-2-input') || tr.querySelector('input[placeholder="الكشفة 2"]');
        if (arch2Input) arch2Input.value = arch2Cm;

        // 5b. Profile select
        const profSel = tr.querySelector('.pd-profile-type') || Array.from(tr.querySelectorAll('select')).find(sel => {
            const opts = Array.from(sel.options).map(o => o.value);
            return opts.includes('single rabbit with rubber') || opts.includes('single rabbit without rubber') || opts.includes('double rabbit with rubber') || opts.includes('double rabbit without rubber');
        });
        if (profSel && p.profileType) {
            profSel.value = p.profileType;
        }

        // 6. Direction select
        const selects = Array.from(tr.querySelectorAll('select'));
        const dirSelect = selects.find(sel => {
            const opts = Array.from(sel.options).map(o => o.value);
            return opts.includes('RH') || opts.includes('LH') || opts.includes('RA') || opts.includes('LA');
        }) || selects[0];
        if (dirSelect) {
            dirSelect.value = s.direction;
        }

        // 7. Door Type select
        const doorTypeSelect = tr.querySelector('.pd-doortype-select') || selects.find(sel => {
            const html = (sel.innerHTML || '').toLowerCase();
            return html.includes('single leaf') || html.includes('double leaf');
        });
        if (doorTypeSelect) {
            const opts = Array.from(doorTypeSelect.options);
            const matchingOpt = opts.find(o => o.value.toLowerCase().includes(s.doorType.toLowerCase()) || (s.doorType.toLowerCase().includes('double') && o.value.toLowerCase().includes('double')));
            if (matchingOpt) doorTypeSelect.value = matchingOpt.value;
        }

        // 8. Auto calculate leaf sizes
        if (typeof autoCalculateLeafSizes === 'function' && widthInput) {
            autoCalculateLeafSizes(widthInput);
        }

        // 8b. Persist custom profile parameters (s1, s2, r2) to row notes & dataset
        const customObj = {
            s1: parseFloat(p.R_L || p.S1 || 15.0),
            s2: parseFloat(p.R_R || p.S2 || 15.0),
            r2: parseFloat(p.H_step || 10.5)
        };
        tr.dataset.customProfile = JSON.stringify(customObj);

        const notesInput = tr.querySelector('.pd-notes-input') || tr.querySelectorAll('input')[24];
        if (notesInput) {
            let currentNotes = (notesInput.value || '').replace(/\s*\[PROFILE:.*?\]/g, '').trim();
            const tag = `[PROFILE:${JSON.stringify(customObj)}]`;
            notesInput.value = currentNotes ? `${currentNotes} ${tag}` : tag;
        }

        // 9. Recalculate sheet requirements if available
        if (typeof window.calculateSheetRequirements === 'function') {
            try { window.calculateSheetRequirements(); } catch (e) {}
        }

        if (typeof showToast === 'function') {
            showToast('تم اعتماد قياسات الباب والمقطع بنجاح في جدول الأبواب!', 'bg-emerald-600', '✓');
        }
    }

    window.closeInteractiveProfileEditor();
};
window.applyProfileChangesToSource = window.applyStudioChangesToSource;

// Trigger 1A: Open Door Elevation from Project View (READ-ONLY)
window.openDoorElevationFromProject = function(doorIdx, directDoor) {
    try {
        let d = null;
        if (directDoor && typeof directDoor === 'object') {
            d = directDoor;
        } else if (doorIdx && typeof doorIdx === 'object') {
            d = doorIdx;
        } else {
            const doors = (window.currentProjectData && Array.isArray(window.currentProjectData.details))
                ? window.currentProjectData.details
                : ((window.currentProjectData && Array.isArray(window.currentProjectData.doors)) ? window.currentProjectData.doors : []);
            if (doorIdx !== undefined && doorIdx !== null && doors[doorIdx]) {
                d = doors[doorIdx];
            } else if (doorIdx !== undefined && doorIdx !== null) {
                d = doors.find(x => x.id == doorIdx || x.door_number == doorIdx);
            }
            if (!d && doors.length > 0) {
                d = doors[0];
            }
        }
        if (!d) {
            console.warn('Door data not found for preview:', doorIdx, window.currentProjectData);
            if (typeof showToast === 'function') {
                showToast('تعذر تحميل بيانات الباب المحدد', 'bg-rose-600', '⚠️');
            }
            return;
        }

        const s = window.doorElevationState;
        s.isReadOnly = true;
        s.sourceType = 'project';
        s.sourceDoorIdx = doorIdx;
        s.sourceRowEl = null;

        s.width = parseFloat(d.width) || 100.0;
        s.height = parseFloat(d.height) || 220.0;
        s.depth = parseFloat(d.depth) || 15.0;
        s.architrave = parseFloat(d.architrave) || 4.0;
        s.architrave2 = parseFloat(d.architrave_2) || 6.2;
        let dirVal = (d.direction || 'RH').toUpperCase();
        if (dirVal === 'DOUBLE' || dirVal === 'D/RA' || dirVal === 'D/RH') dirVal = 'RA';
        if (dirVal === 'D/LA' || dirVal === 'D/LH') dirVal = 'LA';
        s.direction = dirVal;
        s.doorType = d.door_type || ((dirVal === 'RA' || dirVal === 'LA') ? 'Double leaf metal' : 'Single leaf metal');
        s.lockType = d.lock_type || 'Mortise';
        s.hinges = d.hinges || 'Standard Stainless Steel';
        s.hingesCount = parseInt(d.hinges_count) || 4;
        s.hasWindow = !!(parseFloat(d.window_width) > 0 && parseFloat(d.window_height) > 0);
        s.windowWidth = parseFloat(d.window_width) || 20;
        s.windowHeight = parseFloat(d.window_height) || 60;
        s.windowPosition = d.window_position || 'Center';
        s.raddad = (d.raddad === 'YES' || d.raddad === true);
        s.doorNumber = d.door_number || ('#' + ((doorIdx !== undefined && doorIdx !== null) ? (doorIdx + 1) : 1));

        // Sync profile state
        const p = window.profileEditorState;
        p.isReadOnly = true;
        p.sourceType = 'project';
        p.sourceDoorIdx = doorIdx;
        p.sourceRowEl = null;
        p.profileType = d.profile_type || 'single rabbit with rubber';
        p.D = s.depth < 40 ? s.depth * 10 : s.depth;
        p.A_L = s.architrave < 15 ? s.architrave * 10 : s.architrave;
        p.A_R = s.architrave2 < 15 ? s.architrave2 * 10 : s.architrave2;

        // Parse custom profile if stored in notes
        let customProf = null;
        if (d.notes) {
            const m = d.notes.match(/\[PROFILE:(.*?)\]/);
            if (m) {
                try { customProf = JSON.parse(m[1]); } catch(e) {}
            }
        }
        if (customProf) {
            if (customProf.s1) { p.R_L = customProf.s1; p.S1 = customProf.s1; }
            if (customProf.s2) { p.R_R = customProf.s2; p.S2 = customProf.s2; }
            if (customProf.r2) { p.H_step = customProf.r2; }
        }

        const tag = document.getElementById('lblProfileDoorTag');
        if (tag) tag.textContent = `باب: ${s.doorNumber}`;

        window.updateDoorElevationUI();
        window.switchStudioTab('elevation');

        const modal = document.getElementById('profileEditorModal');
        if (modal) modal.classList.remove('hidden');
    } catch (err) {
        console.error('Error in openDoorElevationFromProject:', err);
    }
};

// Trigger 1B: Open Door Profile from Project View (READ-ONLY)
window.openDoorProfileFromProject = function(doorIdx, directDoor) {
    try {
        window.openDoorElevationFromProject(doorIdx, directDoor);
        window.switchStudioTab('profile');
    } catch (err) {
        console.error('Error in openDoorProfileFromProject:', err);
    }
};

// Trigger 2A: Open Door Elevation from Wizard / Edit Row (EDITABLE)
window.openDoorElevationFromWizardRow = function(btn) {
    try {
        const tr = btn ? btn.closest('tr') : null;
        if (!tr) return;

        const s = window.doorElevationState;
        s.isReadOnly = false;
        s.sourceType = 'wizard';
        s.sourceDoorIdx = null;
        s.sourceRowEl = tr;

        const doorNumInput = tr.querySelector('input[placeholder="رقم"]') || tr.querySelector('input[placeholder="رقم الباب"]') || tr.querySelectorAll('input')[0];
        s.doorNumber = doorNumInput ? (doorNumInput.value || 'باب') : 'باب';

        const widthInput = tr.querySelector('.pd-width-input') || tr.querySelector('input[placeholder="عرض"]') || tr.querySelectorAll('input')[2];
        const heightInput = tr.querySelector('input[placeholder="طول"]') || tr.querySelector('input[placeholder="الارتفاع"]') || tr.querySelectorAll('input')[3];
        const depthInput = tr.querySelector('input[placeholder="عمق"]') || tr.querySelectorAll('input')[4];
        const arch1Input = tr.querySelector('.pd-architrave-input') || tr.querySelector('input[placeholder="الكشفة"]');
        const arch2Input = tr.querySelector('.pd-architrave-2-input') || tr.querySelector('input[placeholder="الكشفة 2"]');

        s.width = widthInput && parseFloat(widthInput.value) > 0 ? parseFloat(widthInput.value) : 100.0;
        s.height = heightInput && parseFloat(heightInput.value) > 0 ? parseFloat(heightInput.value) : 220.0;
        s.depth = depthInput && parseFloat(depthInput.value) > 0 ? parseFloat(depthInput.value) : 15.0;
        s.architrave = arch1Input && parseFloat(arch1Input.value) > 0 ? parseFloat(arch1Input.value) : 4.0;
        s.architrave2 = arch2Input && parseFloat(arch2Input.value) > 0 ? parseFloat(arch2Input.value) : (s.architrave + 2.2);

        // Selects
        const selects = Array.from(tr.querySelectorAll('select'));
        const dirSelect = selects.find(sel => {
            const opts = Array.from(sel.options).map(o => o.value);
            return opts.includes('RH') || opts.includes('LH') || opts.includes('RA') || opts.includes('LA');
        }) || selects[0];
        s.direction = dirSelect && dirSelect.value ? dirSelect.value : 'RH';
        if (s.direction === 'Double' || s.direction === 'D/RA') s.direction = 'RA';
        if (s.direction === 'D/LA') s.direction = 'LA';

        const lockSelect = selects[1];
        s.lockType = lockSelect && lockSelect.value ? lockSelect.value : 'Mortise';

        const hingeSelect = selects[2];
        s.hinges = hingeSelect && hingeSelect.value ? hingeSelect.value : 'Standard Stainless Steel';

        const hingeCountSelect = selects[3];
        s.hingesCount = hingeCountSelect && parseInt(hingeCountSelect.value) ? parseInt(hingeCountSelect.value) : 4;

        const doorTypeSelect = tr.querySelector('.pd-doortype-select') || selects[5];
        s.doorType = doorTypeSelect && doorTypeSelect.value ? doorTypeSelect.value : 'Single leaf metal';

        // Window & Raddad
        const winWInput = tr.querySelector('.pd-window-width');
        const winHInput = tr.querySelector('.pd-window-height');
        const winPosSelect = tr.querySelector('.pd-window-position');
        s.windowWidth = winWInput && parseFloat(winWInput.value) > 0 ? parseFloat(winWInput.value) : 20;
        s.windowHeight = winHInput && parseFloat(winHInput.value) > 0 ? parseFloat(winHInput.value) : 60;
        s.windowPosition = winPosSelect && winPosSelect.value ? winPosSelect.value : 'Center';
        s.hasWindow = (winWInput && !winWInput.disabled && parseFloat(winWInput.value) > 0);

        // Checkbox for raddad
        const checkboxes = Array.from(tr.querySelectorAll('input[type="checkbox"]'));
        const raddadCb = checkboxes[checkboxes.length - 1];
        s.raddad = raddadCb ? raddadCb.checked : false;

        // Profile Type
        const profileSelect = tr.querySelector('.pd-profile-type') || selects.find(sel => {
            const opts = Array.from(sel.options).map(o => o.value);
            return opts.includes('single rabbit with rubber') || opts.includes('double rabbit with rubber') || opts.includes('single rabbit without rubber') || opts.includes('double rabbit without rubber') || opts.includes('single rabbit');
        });
        s.profileType = profileSelect && profileSelect.value ? profileSelect.value : 'single rabbit with rubber';

        // Sync profile state
        const p = window.profileEditorState;
        p.isReadOnly = false;
        p.sourceType = 'wizard';
        p.sourceDoorIdx = null;
        p.sourceRowEl = tr;
        p.profileType = s.profileType;
        p.D = s.depth < 40 ? s.depth * 10 : s.depth;
        p.A_L = s.architrave < 15 ? s.architrave * 10 : s.architrave;
        p.A_R = s.architrave2 < 15 ? s.architrave2 * 10 : s.architrave2;

        // Restore custom profile from row dataset or notes input
        let customProf = null;
        if (tr.dataset.customProfile) {
            try { customProf = JSON.parse(tr.dataset.customProfile); } catch(e) {}
        }
        if (!customProf) {
            const notesInput = tr.querySelector('.pd-notes-input') || tr.querySelectorAll('input')[24];
            if (notesInput && notesInput.value) {
                const m = notesInput.value.match(/\[PROFILE:(.*?)\]/);
                if (m) {
                    try { customProf = JSON.parse(m[1]); } catch(e) {}
                }
            }
        }
        if (customProf) {
            if (customProf.s1) { p.R_L = customProf.s1; p.S1 = customProf.s1; }
            if (customProf.s2) { p.R_R = customProf.s2; p.S2 = customProf.s2; }
            if (customProf.r2) { p.H_step = customProf.r2; }
        }

        const tag = document.getElementById('lblProfileDoorTag');
        if (tag) tag.textContent = `باب: ${s.doorNumber}`;

        window.updateDoorElevationUI();
        window.switchStudioTab('elevation');

        const modal = document.getElementById('profileEditorModal');
        if (modal) modal.classList.remove('hidden');
    } catch (err) {
        console.error('Error in openDoorElevationFromWizardRow:', err);
    }
};

// Trigger 2B: Open Door Profile from Wizard / Edit Row (EDITABLE)
window.openDoorProfileFromWizardRow = function(btn) {
    try {
        window.openDoorElevationFromWizardRow(btn);
        window.switchStudioTab('profile');
    } catch (err) {
        console.error('Error in openDoorProfileFromWizardRow:', err);
    }
};

// Interactive In-Place Inline Dimension Editing (No prompt popups)
window.editProfileDimension = function(param, event) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }

    // STRICT CHECK: If read-only mode, do not allow editing
    if (window.profileEditorState.isReadOnly) return;

    const s = window.profileEditorState;
    const currentVal = s[param] !== undefined ? s[param] : 0;

    // Look for target group
    const targetEl = document.getElementById(`dim-group-${param}`);
    if (!targetEl) return;

    // Check if input already open
    if (targetEl.querySelector('foreignObject')) return;

    const originalContent = targetEl.innerHTML;

    // Get bbox or position attributes from dataset
    const bx = parseFloat(targetEl.dataset.x) || 0;
    const by = parseFloat(targetEl.dataset.y) || 0;

    const inputW = 44;
    const inputH = 22;

    targetEl.innerHTML = `
        <foreignObject x="${bx - inputW / 2}" y="${by - inputH / 2}" width="${inputW}" height="${inputH}" class="overflow-visible">
            <div xmlns="http://www.w3.org/1999/xhtml" style="display:flex; justify-content:center; align-items:center; width:100%; height:100%;">
                <input type="number" step="0.5" id="dim-inline-input-${param}" value="${currentVal}"
                    style="width: 100%; height: 100%; text-align: center; font-size: 10px; font-weight: 700; font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                           background: #ffffff; color: #1e293b; border: 1.5px solid #2563eb; border-radius: 5px; outline: none;
                           box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); padding: 0 1px;" />
            </div>
        </foreignObject>
    `;

    const inputEl = document.getElementById(`dim-inline-input-${param}`);
    if (!inputEl) return;

    let isHandled = false;
    const commitVal = () => {
        if (isHandled) return;
        isHandled = true;
        const newVal = parseFloat(inputEl.value);
        if (!isNaN(newVal) && newVal > 0) {
            if (param === 'T' && newVal > 2.0) {
                if (typeof showToast === 'function') {
                    showToast('لا يمكن أن تتجاوز سماكة الصاج 2 ملم', 'bg-rose-600', '⚠️');
                } else {
                    alert('لا يمكن أن تتجاوز سماكة الصاج 2 ملم');
                }
                targetEl.innerHTML = originalContent;
                return;
            }
            applyNewDimensionParam(param, newVal);
        } else {
            targetEl.innerHTML = originalContent;
        }
    };

    const cancelEdit = () => {
        if (isHandled) return;
        isHandled = true;
        targetEl.innerHTML = originalContent;
    };

    inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            commitVal();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelEdit();
        }
    });

    inputEl.addEventListener('blur', () => {
        commitVal();
    });

    setTimeout(() => {
        inputEl.focus();
        inputEl.select();
    }, 20);
};

// Apply new dimension parameter logic with automatic dependencies
function applyNewDimensionParam(param, val) {
    const s = window.profileEditorState;
    if (s.isReadOnly) return;

    const pType = (s.profileType || s.profile_type || '').toLowerCase();
    const isDrnr = (pType.includes('double') || pType.includes('مزدوج')) && (pType.includes('without') || pType.includes('بدون'));
    const isDouble = (pType.includes('double') || pType.includes('مزدوج')) && !isDrnr;
    const isDoubleAny = isDrnr || isDouble;

    if (param === 'D') {
        s.D = val;
        if (isDoubleAny) {
            const w1 = s.W_rab1 || (isDouble ? 52.0 : 47.0);
            const w2 = s.W_rab2 || 47.0;
            s.W_web = Math.max(10.0, s.D - w1 - w2);
        } else {
            s.W_web = Math.max(10.0, s.D - (s.W_rab || 52.0));
        }
    } else if (param === 'A_L') {
        s.A_L = val;
        if (isDoubleAny) {
            // For double rabbet, architraves are equal by default
            s.A_R = val;
        } else {
            s.A_R = s.A_L + 22.0;
        }
    } else if (param === 'A_R') {
        s.A_R = val;
    } else if (param === 'W_rab' || param === 'W_rab1') {
        s.W_rab = val;
        s.W_rab1 = val;
        if (isDoubleAny) {
            const w2 = s.W_rab2 || 47.0;
            s.W_web = Math.max(10.0, s.D - val - w2);
        } else {
            s.W_web = Math.max(10.0, s.D - s.W_rab);
        }
    } else if (param === 'W_rab2') {
        s.W_rab2 = val;
        const w1 = s.W_rab1 || (isDouble ? 52.0 : 47.0);
        s.W_web = Math.max(10.0, s.D - w1 - val);
    } else if (param === 'W_web') {
        s.W_web = val;
        if (isDoubleAny) {
            const w1 = s.W_rab1 || (isDouble ? 52.0 : 47.0);
            const w2 = s.W_rab2 || 47.0;
            s.D = w1 + w2 + s.W_web;
        } else {
            s.D = (s.W_rab || 52.0) + s.W_web;
        }
    } else if (param === 'W_step') {
        s.W_step = val;
    } else if (param === 'H_step' || param === 'S1' || param === 'S_1') {
        s.H_step = val;
        s.S1 = val;
    } else if (param === 'S_in') {
        s.S_in = val;
    } else if (param === 'R_L') {
        s.R_L = val;
    } else if (param === 'R_R') {
        s.R_R = val;
    } else if (param === 'T') {
        if (val > 2.0) {
            if (typeof showToast === 'function') {
                showToast('لا يمكن أن تتجاوز سماكة الصاج 2 ملم', 'bg-rose-600', '⚠️');
            } else {
                alert('لا يمكن أن تتجاوز سماكة الصاج 2 ملم');
            }
            return;
        }
        s.T = val;
    }

    window.renderCleanProfileSvg();
    updateProfileUnfoldedBadge();
}

// Render Clean Profile SVG (Charcoal gray lines, accurate dimension locations matching Image)
window.renderCleanProfileSvg = function() {
    const viewport = document.getElementById('profileSvgViewport');
    if (!viewport) return;

    const s = window.profileEditorState;
    const D = parseFloat(s.D) || 150.0;
    const A_L = parseFloat(s.A_L) || 40.0;
    const H_step = parseFloat(s.H_step) || 10.5;   // 10.5 mm vertical step for rubber groove
    const S_in = parseFloat(s.S_in) || 14.5;       // 14.5 mm inner vertical step
    const A_R = parseFloat(s.A_R) !== undefined ? parseFloat(s.A_R) : 62.0; // Architrave 2
    const W_rab = parseFloat(s.W_rab) || 52.0;    // left rabbet horizontal
    const W_step = parseFloat(s.W_step) || 12.0;   // rubber groove width
    const W_web = parseFloat(s.W_web) || Math.max(10.0, D - W_rab); // bottom web width
    const R_L = parseFloat(s.R_L) || 15.0;         // left return flange
    const R_R = parseFloat(s.R_R) || 15.0;         // right return flange
    const T = Math.min(2.0, parseFloat(s.T) || 1.5); // Sheet thickness <= 2.0 mm

    // Colors: Architectural Soft-blue background, Charcoal Gray lines, Hatch
    const colBg = "#f0f4f9";
    const colProfile = "#334155";    // charcoal / slate-700
    const colDimLine = "#64748b";    // slate-500
    const colDimText = "#0f172a";    // slate-900

    // Vertical geometry mapping:
    // Left side starts with top return flange at y = 0
    // Rabbet horizontal is at y = A_L
    // The bottom of the web sits at y = A_L + S_in + H_step
    // Right architrave height is A_R.
    // If A_R is decoupled from A_L, the right return flange sits at y_R_top = (A_L + S_in + H_step) - A_R
    const y_bot = A_L + S_in + H_step;
    const y_R_top = y_bot - A_R;

    const pts = {
        p0:  { x: D - R_R, y: y_R_top },
        p1:  { x: D - 3,   y: y_R_top },
        p2:  { x: D,       y: y_R_top + 3 },
        p3:  { x: D,       y: y_bot - 3 },
        p4:  { x: D - 3,   y: y_bot },
        p5:  { x: W_rab + 3, y: y_bot },
        p6:  { x: W_rab,     y: y_bot - 3 },
        p7:  { x: W_rab,     y: y_bot - H_step + 3 },
        p8:  { x: W_rab + 3, y: y_bot - H_step },
        p9:  { x: W_rab + W_step - 1.5, y: y_bot - H_step },
        p10: { x: W_rab + W_step,       y: y_bot - H_step - 1.5 },
        p11: { x: W_rab + W_step,       y: A_L + 1.5 },
        p12: { x: W_rab + W_step - 1.5, y: A_L },
        p13: { x: 3,                    y: A_L },
        p14: { x: 0,                    y: A_L - 3 },
        p15: { x: 0,                    y: 3 },
        p16: { x: 3,                    y: 0 },
        p17: { x: R_L,                  y: 0 }
    };

    const inPts = {
        p0:  { x: D - R_R, y: y_R_top + T },
        p1:  { x: D - 3,   y: y_R_top + T },
        p2:  { x: D - T,   y: y_R_top + 3 },
        p3:  { x: D - T,   y: y_bot - 3 },
        p4:  { x: D - 3,   y: y_bot - T },
        p5:  { x: W_rab + 3, y: y_bot - T },
        p6:  { x: W_rab + T, y: y_bot - 3 },
        p7:  { x: W_rab + T, y: y_bot - H_step + 3 },
        p8:  { x: W_rab + 3, y: y_bot - H_step + T },
        p9:  { x: W_rab + W_step - 1.5, y: y_bot - H_step + T },
        p10: { x: W_rab + W_step + T,   y: y_bot - H_step - 1.5 },
        p11: { x: W_rab + W_step + T,   y: A_L + 1.5 },
        p12: { x: W_rab + W_step - 1.5, y: A_L - T },
        p13: { x: 3,                    y: A_L - T },
        p14: { x: T,                    y: A_L - 3 },
        p15: { x: T,                    y: 3 },
        p16: { x: 3,                    y: T },
        p17: { x: R_L,                  y: T }
    };

    const outerPath = `
        M ${pts.p0.x} ${pts.p0.y}
        L ${pts.p1.x} ${pts.p1.y}
        A 3 3 0 0 1 ${pts.p2.x} ${pts.p2.y}
        L ${pts.p3.x} ${pts.p3.y}
        A 3 3 0 0 1 ${pts.p4.x} ${pts.p4.y}
        L ${pts.p5.x} ${pts.p5.y}
        A 3 3 0 0 1 ${pts.p6.x} ${pts.p6.y}
        L ${pts.p7.x} ${pts.p7.y}
        A 3 3 0 0 1 ${pts.p8.x} ${pts.p8.y}
        L ${pts.p9.x} ${pts.p9.y}
        A 1.5 1.5 0 0 0 ${pts.p10.x} ${pts.p10.y}
        L ${pts.p11.x} ${pts.p11.y}
        A 1.5 1.5 0 0 0 ${pts.p12.x} ${pts.p12.y}
        L ${pts.p13.x} ${pts.p13.y}
        A 3 3 0 0 1 ${pts.p14.x} ${pts.p14.y}
        L ${pts.p15.x} ${pts.p15.y}
        A 3 3 0 0 1 ${pts.p16.x} ${pts.p16.y}
        L ${pts.p17.x} ${pts.p17.y}
    `;

    const r_outer = Math.max(0.5, 3 - T);
    const r_inner = 1.5 + T;

    // Inner path backwards from p17 to p0 to make a closed polygon for hatching
    const reverseInnerPath = `
        L ${inPts.p17.x} ${inPts.p17.y}
        L ${inPts.p16.x} ${inPts.p16.y}
        A ${r_outer} ${r_outer} 0 0 0 ${inPts.p15.x} ${inPts.p15.y}
        L ${inPts.p14.x} ${inPts.p14.y}
        A ${r_outer} ${r_outer} 0 0 0 ${inPts.p13.x} ${inPts.p13.y}
        L ${inPts.p12.x} ${inPts.p12.y}
        A ${r_inner} ${r_inner} 0 0 1 ${inPts.p11.x} ${inPts.p11.y}
        L ${inPts.p10.x} ${inPts.p10.y}
        A ${r_inner} ${r_inner} 0 0 1 ${inPts.p9.x} ${inPts.p9.y}
        L ${inPts.p8.x} ${inPts.p8.y}
        A ${r_outer} ${r_outer} 0 0 0 ${inPts.p7.x} ${inPts.p7.y}
        L ${inPts.p6.x} ${inPts.p6.y}
        A ${r_outer} ${r_outer} 0 0 0 ${inPts.p5.x} ${inPts.p5.y}
        L ${inPts.p4.x} ${inPts.p4.y}
        A ${r_outer} ${r_outer} 0 0 0 ${inPts.p3.x} ${inPts.p3.y}
        L ${inPts.p2.x} ${inPts.p2.y}
        A ${r_outer} ${r_outer} 0 0 0 ${inPts.p1.x} ${inPts.p1.y}
        L ${inPts.p0.x} ${inPts.p0.y}
        Z
    `;

    const closedHatchPath = outerPath + reverseInnerPath;

    // Sized viewBox to make the drawing comfortably proportioned
    const topLimit = Math.min(0, y_R_top);
    const minX = -45;
    const maxX = D + 45;
    const minY = topLimit - 40;
    const maxY = y_bot + 45;
    const vbW = maxX - minX;
    const vbH = maxY - minY;

    // Helper for interactive dimension element (Clean, Modern, NO bounding box)
    const formatDimVal = (v) => {
        const num = Math.round(parseFloat(v) * 10) / 10;
        return String(num).replace('.', ',');
    };

    const isReadOnly = !!s.isReadOnly;
    const cursorClass = isReadOnly ? 'cursor-default' : 'cursor-pointer group';
    const hoverClass = isReadOnly ? '' : 'group-hover:fill-blue-600 transition-colors';

    const makeDimH = (x1, x2, y, val, param, offsetTextY = -3.8, arrowsInside = true) => {
        const midX = (x1 + x2) / 2;
        const strVal = formatDimVal(val);
        const markerStart = arrowsInside ? 'url(#cad-arr-start)' : 'url(#cad-arr-end)';
        const markerEnd = arrowsInside ? 'url(#cad-arr-end)' : 'url(#cad-arr-start)';
        const titleText = isReadOnly ? `القياس: ${strVal} مم` : `انقر لتعديل القياس: ${strVal} مم`;
        const clickAttr = isReadOnly ? '' : `onclick="editProfileDimension('${param}', event)"`;
        return `
            <g id="dim-group-${param}" data-x="${midX}" data-y="${y + offsetTextY}" class="${cursorClass}" ${clickAttr}>
                <line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${colDimLine}" stroke-width="0.4" marker-start="${markerStart}" marker-end="${markerEnd}" />
                <text x="${midX}" y="${y + offsetTextY}" fill="${colDimText}" font-size="4.6" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="700" text-anchor="middle" dominant-baseline="central" class="${hoverClass}">
                    ${strVal}
                </text>
                <title>${titleText}</title>
            </g>
        `;
    };

    const makeDimV = (y1, y2, x, val, param, offsetTextX = -3.6, rotateText = true) => {
        const midY = (y1 + y2) / 2;
        const strVal = formatDimVal(val);
        const titleText = isReadOnly ? `القياس: ${strVal} مم` : `انقر لتعديل القياس: ${strVal} مم`;
        const clickAttr = isReadOnly ? '' : `onclick="editProfileDimension('${param}', event)"`;
        return `
            <g id="dim-group-${param}" data-x="${x + offsetTextX}" data-y="${midY}" class="${cursorClass}" ${clickAttr}>
                <line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="${colDimLine}" stroke-width="0.4" marker-start="url(#cad-arr-start)" marker-end="url(#cad-arr-end)" />
                <g transform="${rotateText ? `rotate(-90 ${x + offsetTextX} ${midY})` : ''}">
                    <text x="${x + offsetTextX}" y="${midY}" fill="${colDimText}" font-size="4.6" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="700" text-anchor="middle" dominant-baseline="central" class="${hoverClass}">
                        ${strVal}
                    </text>
                </g>
                <title>${titleText}</title>
            </g>
        `;
    };

    const pType = (s.profileType || s.profile_type || '').toLowerCase();
    const isDrnr = (pType.includes('double') || pType.includes('مزدوج')) && (pType.includes('without') || pType.includes('بدون'));
    const isDouble = (pType.includes('double') || pType.includes('مزدوج')) && !isDrnr;

    if (isDrnr) {
        const D = parseFloat(s.D) || 150.0;
        const A_L = parseFloat(s.A_L) || 40.0;
        const A_R = parseFloat(s.A_R) !== undefined ? parseFloat(s.A_R) : 40.0;
        const R_L = parseFloat(s.R_L) || 15.0;
        const R_R = parseFloat(s.R_R) || 15.0;
        const T = Math.min(2.0, parseFloat(s.T) || 1.5);
        const W_rab1 = parseFloat(s.W_rab1) || 47.0;
        const W_rab2 = parseFloat(s.W_rab2) || 47.0;
        const S1 = parseFloat(s.S1) || 15.0;
        const S2 = parseFloat(s.S2) || 15.0;
        const W_web = Math.max(15.0, D - W_rab1 - W_rab2);
        const y_bot = A_L + S1;
        const y_rab2 = y_bot - S2;
        const y_R_top = y_rab2 - A_R;

        const r = 3.0;
        const r_outer = Math.max(0.5, 3 - T);
        const r_inner = 3 + T;

        const pts = {
            p0:  { x: D - R_R,            y: y_R_top },
            p1:  { x: D - r,              y: y_R_top },
            p2:  { x: D,                  y: y_R_top + r },
            p3:  { x: D,                  y: y_rab2 - r },
            p4:  { x: D - r,              y: y_rab2 },
            p5:  { x: D - W_rab2 + r,     y: y_rab2 },
            p6:  { x: D - W_rab2,         y: y_rab2 + r },
            p7:  { x: D - W_rab2,         y: y_bot - r },
            p8:  { x: D - W_rab2 - r,     y: y_bot },
            p9:  { x: W_rab1 + r,         y: y_bot },
            p10: { x: W_rab1,             y: y_bot - r },
            p11: { x: W_rab1,             y: A_L + r },
            p12: { x: W_rab1 - r,         y: A_L },
            p13: { x: r,                  y: A_L },
            p14: { x: 0,                  y: A_L - r },
            p15: { x: 0,                  y: r },
            p16: { x: r,                  y: 0 },
            p17: { x: R_L,                y: 0 }
        };

        const outerPath = `
            M ${pts.p0.x} ${pts.p0.y}
            L ${pts.p1.x} ${pts.p1.y}
            A 3 3 0 0 1 ${pts.p2.x} ${pts.p2.y}
            L ${pts.p3.x} ${pts.p3.y}
            A 3 3 0 0 1 ${pts.p4.x} ${pts.p4.y}
            L ${pts.p5.x} ${pts.p5.y}
            A 3 3 0 0 0 ${pts.p6.x} ${pts.p6.y}
            L ${pts.p7.x} ${pts.p7.y}
            A 3 3 0 0 1 ${pts.p8.x} ${pts.p8.y}
            L ${pts.p9.x} ${pts.p9.y}
            A 3 3 0 0 1 ${pts.p10.x} ${pts.p10.y}
            L ${pts.p11.x} ${pts.p11.y}
            A 3 3 0 0 0 ${pts.p12.x} ${pts.p12.y}
            L ${pts.p13.x} ${pts.p13.y}
            A 3 3 0 0 1 ${pts.p14.x} ${pts.p14.y}
            L ${pts.p15.x} ${pts.p15.y}
            A 3 3 0 0 1 ${pts.p16.x} ${pts.p16.y}
            L ${pts.p17.x} ${pts.p17.y}
        `;

        const inPts = {
            p0:  { x: D - R_R,            y: y_R_top + T },
            p1:  { x: D - r,              y: y_R_top + T },
            p2:  { x: D - T,              y: y_R_top + r },
            p3:  { x: D - T,              y: y_rab2 - r },
            p4:  { x: D - r,              y: y_rab2 - T },
            p5:  { x: D - W_rab2 + r,     y: y_rab2 - T },
            p6:  { x: D - W_rab2 - T,     y: y_rab2 + r },
            p7:  { x: D - W_rab2 - T,     y: y_bot - r },
            p8:  { x: D - W_rab2 - r,     y: y_bot - T },
            p9:  { x: W_rab1 + r,         y: y_bot - T },
            p10: { x: W_rab1 + T,         y: y_bot - r },
            p11: { x: W_rab1 + T,         y: A_L + r },
            p12: { x: W_rab1 - r,         y: A_L - T },
            p13: { x: r,                  y: A_L - T },
            p14: { x: T,                  y: A_L - r },
            p15: { x: T,                  y: r },
            p16: { x: r,                  y: T },
            p17: { x: R_L,                y: T }
        };

        const reverseInnerPath = `
            L ${inPts.p17.x} ${inPts.p17.y}
            L ${inPts.p16.x} ${inPts.p16.y}
            A ${r_outer} ${r_outer} 0 0 0 ${inPts.p15.x} ${inPts.p15.y}
            L ${inPts.p14.x} ${inPts.p14.y}
            A ${r_outer} ${r_outer} 0 0 0 ${inPts.p13.x} ${inPts.p13.y}
            L ${inPts.p12.x} ${inPts.p12.y}
            A ${r_inner} ${r_inner} 0 0 1 ${inPts.p11.x} ${inPts.p11.y}
            L ${inPts.p10.x} ${inPts.p10.y}
            A ${r_outer} ${r_outer} 0 0 0 ${inPts.p9.x} ${inPts.p9.y}
            L ${inPts.p8.x} ${inPts.p8.y}
            A ${r_outer} ${r_outer} 0 0 0 ${inPts.p7.x} ${inPts.p7.y}
            L ${inPts.p6.x} ${inPts.p6.y}
            A ${r_inner} ${r_inner} 0 0 1 ${inPts.p5.x} ${inPts.p5.y}
            L ${inPts.p4.x} ${inPts.p4.y}
            A ${r_outer} ${r_outer} 0 0 0 ${inPts.p3.x} ${inPts.p3.y}
            L ${inPts.p2.x} ${inPts.p2.y}
            A ${r_outer} ${r_outer} 0 0 0 ${inPts.p1.x} ${inPts.p1.y}
            L ${inPts.p0.x} ${inPts.p0.y}
            Z
        `;
        const closedHatchPath = outerPath + reverseInnerPath;

        const topLimit = Math.min(0, y_R_top);
        const minX = -45;
        const maxX = D + 45;
        const minY = topLimit - 40;
        const maxY = y_bot + 45;
        const vbW = maxX - minX;
        const vbH = maxY - minY;

        // Dimensions:
        const dimD_Y = topLimit - 20;
        const dimD = `
            <line x1="0" y1="0" x2="0" y2="${dimD_Y - 3}" stroke="${colDimLine}" stroke-width="0.5" stroke-dasharray="1.5,1.5" />
            <line x1="${D}" y1="${y_R_top}" x2="${D}" y2="${dimD_Y - 3}" stroke="${colDimLine}" stroke-width="0.5" stroke-dasharray="1.5,1.5" />
            ${makeDimH(0, D, dimD_Y, D, 'D', -3.8)}
        `;

        const dimR_L_Y = -8;
        const dimR_L = `
            <line x1="0" y1="0" x2="0" y2="${dimR_L_Y - 3}" stroke="${colDimLine}" stroke-width="0.5" stroke-dasharray="1.5,1.5" />
            <line x1="${R_L}" y1="0" x2="${R_L}" y2="${dimR_L_Y - 3}" stroke="${colDimLine}" stroke-width="0.5" stroke-dasharray="1.5,1.5" />
            ${makeDimH(0, R_L, dimR_L_Y, R_L, 'R_L', -3.8, false)}
        `;

        const dimR_R_Y = y_R_top - 8;
        const dimR_R = `
            <line x1="${D - R_R}" y1="${y_R_top}" x2="${D - R_R}" y2="${dimR_R_Y - 3}" stroke="${colDimLine}" stroke-width="0.5" stroke-dasharray="1.5,1.5" />
            <line x1="${D}" y1="${y_R_top}" x2="${D}" y2="${dimR_R_Y - 3}" stroke="${colDimLine}" stroke-width="0.5" stroke-dasharray="1.5,1.5" />
            ${makeDimH(D - R_R, D, dimR_R_Y, R_R, 'R_R', -3.8, false)}
        `;

        const dimA_L_X = -16;
        const dimA_L = `
            <line x1="0" y1="0" x2="${dimA_L_X - 3}" y2="0" stroke="${colDimLine}" stroke-width="0.5" stroke-dasharray="1.5,1.5" />
            <line x1="0" y1="${A_L}" x2="${dimA_L_X - 3}" y2="${A_L}" stroke="${colDimLine}" stroke-width="0.5" stroke-dasharray="1.5,1.5" />
            ${makeDimV(0, A_L, dimA_L_X, A_L, 'A_L', -4.0, true)}
        `;

        const dimA_R_X = D + 18;
        const dimA_R = `
            <line x1="${D}" y1="${y_R_top}" x2="${dimA_R_X + 3}" y2="${y_R_top}" stroke="${colDimLine}" stroke-width="0.5" stroke-dasharray="1.5,1.5" />
            <line x1="${D}" y1="${y_rab2}" x2="${dimA_R_X + 3}" y2="${y_rab2}" stroke="${colDimLine}" stroke-width="0.5" stroke-dasharray="1.5,1.5" />
            ${makeDimV(y_R_top, y_rab2, dimA_R_X, A_R, 'A_R', 4.0, true)}
        `;

        const dimBot_Y = y_bot + 24;
        const dimBottom = `
            <line x1="0" y1="${A_L}" x2="0" y2="${dimBot_Y + 3}" stroke="${colDimLine}" stroke-width="0.5" stroke-dasharray="1.5,1.5" />
            <line x1="${W_rab1}" y1="${A_L}" x2="${W_rab1}" y2="${dimBot_Y + 3}" stroke="${colDimLine}" stroke-width="0.5" stroke-dasharray="1.5,1.5" />
            <line x1="${D - W_rab2}" y1="${y_rab2}" x2="${D - W_rab2}" y2="${dimBot_Y + 3}" stroke="${colDimLine}" stroke-width="0.5" stroke-dasharray="1.5,1.5" />
            <line x1="${D}" y1="${y_rab2}" x2="${D}" y2="${dimBot_Y + 3}" stroke="${colDimLine}" stroke-width="0.5" stroke-dasharray="1.5,1.5" />
            
            ${makeDimH(0, W_rab1, dimBot_Y, W_rab1, 'W_rab1', 4.0)}
            ${makeDimH(W_rab1, D - W_rab2, dimBot_Y, Math.round(W_web), 'W_web', 4.0)}
            ${makeDimH(D - W_rab2, D, dimBot_Y, W_rab2, 'W_rab2', 4.0)}
        `;

        const dimStep_X = W_rab1 + 14;
        const dimStep = `
            <line x1="${W_rab1}" y1="${A_L}" x2="${dimStep_X + 3}" y2="${A_L}" stroke="${colDimLine}" stroke-width="0.5" stroke-dasharray="1.5,1.5" />
            <line x1="${W_rab1}" y1="${y_bot}" x2="${dimStep_X + 3}" y2="${y_bot}" stroke="${colDimLine}" stroke-width="0.5" stroke-dasharray="1.5,1.5" />
            ${makeDimV(A_L, y_bot, dimStep_X, S1, 'H_step', 3.8, true)}
        `;

        viewport.innerHTML = `
            <svg viewBox="${minX} ${minY} ${vbW} ${vbH}" class="w-full h-full max-h-[440px] select-none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <marker id="cad-arr-end" markerWidth="5" markerHeight="5" refX="4.5" refY="2.5" orient="auto">
                        <path d="M 0,0.8 L 4.5,2.5 L 0,4.2 Z" fill="${colDimLine}" />
                    </marker>
                    <marker id="cad-arr-start" markerWidth="5" markerHeight="5" refX="0.5" refY="2.5" orient="auto">
                        <path d="M 4.5,0.8 L 0,2.5 L 4.5,4.2 Z" fill="${colDimLine}" />
                    </marker>
                    <pattern id="profile-cad-hatch" width="2.2" height="2.2" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                        <line x1="0" y1="0" x2="0" y2="2.2" stroke="#94a3b8" stroke-width="0.2" />
                    </pattern>
                </defs>
                <rect x="${minX}" y="${minY}" width="${vbW}" height="${vbH}" fill="${colBg}" />
                <path d="${closedHatchPath}" fill="#ffffff" stroke="none" />
                <path d="${closedHatchPath}" fill="url(#profile-cad-hatch)" stroke="${colProfile}" stroke-width="0.25" stroke-linecap="round" stroke-linejoin="round" />
                ${dimD}
                ${dimR_L}
                ${dimR_R}
                ${dimA_L}
                ${dimA_R}
                ${dimBottom}
                ${dimStep}
            </svg>
        `;
        return;
    }

    if (isDouble) {
        const D = parseFloat(s.D) || 160.0;
        const A_L = parseFloat(s.A_L) || 50.0;
        const A_R = parseFloat(s.A_R) !== undefined ? parseFloat(s.A_R) : 50.0;
        const R_L = parseFloat(s.R_L) || 15.0;
        const R_R = parseFloat(s.R_R) || 15.0;
        const T = Math.min(2.0, parseFloat(s.T) || 1.5);
        const W_rab1 = parseFloat(s.W_rab1) || 52.0;
        const W_step = parseFloat(s.W_step) || 12.0;
        const H_step = parseFloat(s.H_step) || 10.5;
        const S_in = parseFloat(s.S_in) || 11.5;
        const S_total = S_in + H_step; // 22.0 mm
        const W_rab2 = parseFloat(s.W_rab2) || 47.0;
        const x_stop = W_rab1 + W_step; // 64.0 mm
        const x_web_end = D - W_rab2;   // 113.0 mm when D=160
        const W_web = Math.max(15.0, x_web_end - W_rab1); // 61.0 mm when D=160
        const y_bot = A_L + S_total;    // 72.0 mm
        const y_rab2 = y_bot - S_total; // 50.0 mm
        const y_R_top = y_rab2 - A_R;   // 0.0 mm

        const r = 3.0;
        const r_sm = 1.5;
        const r_outer = Math.max(0.5, 3 - T);
        const r_inner = 1.5 + T;
        const r_inner3 = 3 + T;

        // Outer contour of Double Rabbet With Rubber (Exact CAD architecture matching DXF)
        const pts = {
            p0:  { x: D - R_R,           y: y_R_top },
            p1:  { x: D - r,             y: y_R_top },
            p2:  { x: D,                 y: y_R_top + r },
            p3:  { x: D,                 y: y_rab2 - r },
            p4:  { x: D - r,             y: y_rab2 },
            p5:  { x: x_web_end + r,     y: y_rab2 },
            p6:  { x: x_web_end,         y: y_rab2 + r },
            p7:  { x: x_web_end,         y: y_bot - r },
            p8:  { x: x_web_end - r,     y: y_bot },
            p9:  { x: W_rab1 + r,        y: y_bot },
            p10: { x: W_rab1,            y: y_bot - r },
            p11: { x: W_rab1,            y: y_bot - H_step + r },
            p12: { x: W_rab1 + r,        y: y_bot - H_step },
            p13: { x: x_stop - r_sm,     y: y_bot - H_step },
            p14: { x: x_stop,            y: y_bot - H_step - r_sm },
            p15: { x: x_stop,            y: A_L + r_sm },
            p16: { x: x_stop - r_sm,     y: A_L },
            p17: { x: r,                 y: A_L },
            p18: { x: 0,                 y: A_L - r },
            p19: { x: 0,                 y: r },
            p20: { x: r,                 y: 0 },
            p21: { x: R_L,               y: 0 }
        };

        const outerPath = `
            M ${pts.p0.x} ${pts.p0.y}
            L ${pts.p1.x} ${pts.p1.y}
            A 3 3 0 0 1 ${pts.p2.x} ${pts.p2.y}
            L ${pts.p3.x} ${pts.p3.y}
            A 3 3 0 0 1 ${pts.p4.x} ${pts.p4.y}
            L ${pts.p5.x} ${pts.p5.y}
            A 3 3 0 0 0 ${pts.p6.x} ${pts.p6.y}
            L ${pts.p7.x} ${pts.p7.y}
            A 3 3 0 0 1 ${pts.p8.x} ${pts.p8.y}
            L ${pts.p9.x} ${pts.p9.y}
            A 3 3 0 0 1 ${pts.p10.x} ${pts.p10.y}
            L ${pts.p11.x} ${pts.p11.y}
            A 3 3 0 0 1 ${pts.p12.x} ${pts.p12.y}
            L ${pts.p13.x} ${pts.p13.y}
            A 1.5 1.5 0 0 0 ${pts.p14.x} ${pts.p14.y}
            L ${pts.p15.x} ${pts.p15.y}
            A 1.5 1.5 0 0 0 ${pts.p16.x} ${pts.p16.y}
            L ${pts.p17.x} ${pts.p17.y}
            A 3 3 0 0 1 ${pts.p18.x} ${pts.p18.y}
            L ${pts.p19.x} ${pts.p19.y}
            A 3 3 0 0 1 ${pts.p20.x} ${pts.p20.y}
            L ${pts.p21.x} ${pts.p21.y}
        `;

        const inPts = {
            p0:  { x: D - R_R,           y: y_R_top + T },
            p1:  { x: D - r,             y: y_R_top + T },
            p2:  { x: D - T,             y: y_R_top + r },
            p3:  { x: D - T,             y: y_rab2 - r },
            p4:  { x: D - r,             y: y_rab2 - T },
            p5:  { x: x_web_end + r,     y: y_rab2 - T },
            p6:  { x: x_web_end - T,     y: y_rab2 + r },
            p7:  { x: x_web_end - T,     y: y_bot - r },
            p8:  { x: x_web_end - r,     y: y_bot - T },
            p9:  { x: W_rab1 + r,        y: y_bot - T },
            p10: { x: W_rab1 + T,        y: y_bot - r },
            p11: { x: W_rab1 + T,        y: y_bot - H_step + r },
            p12: { x: W_rab1 + r,        y: y_bot - H_step + T },
            p13: { x: x_stop - r_sm,     y: y_bot - H_step + T },
            p14: { x: x_stop + T,        y: y_bot - H_step - r_sm },
            p15: { x: x_stop + T,        y: A_L + r_sm },
            p16: { x: x_stop - r_sm,     y: A_L - T },
            p17: { x: r,                 y: A_L - T },
            p18: { x: T,                 y: A_L - r },
            p19: { x: T,                 y: r },
            p20: { x: r,                 y: T },
            p21: { x: R_L,               y: T }
        };

        const reverseInnerPath = `
            L ${inPts.p21.x} ${inPts.p21.y}
            L ${inPts.p20.x} ${inPts.p20.y}
            A ${r_outer} ${r_outer} 0 0 0 ${inPts.p19.x} ${inPts.p19.y}
            L ${inPts.p18.x} ${inPts.p18.y}
            A ${r_outer} ${r_outer} 0 0 0 ${inPts.p17.x} ${inPts.p17.y}
            L ${inPts.p16.x} ${inPts.p16.y}
            A ${r_inner} ${r_inner} 0 0 1 ${inPts.p15.x} ${inPts.p15.y}
            L ${inPts.p14.x} ${inPts.p14.y}
            A ${r_inner} ${r_inner} 0 0 1 ${inPts.p13.x} ${inPts.p13.y}
            L ${inPts.p12.x} ${inPts.p12.y}
            A ${r_outer} ${r_outer} 0 0 0 ${inPts.p11.x} ${inPts.p11.y}
            L ${inPts.p10.x} ${inPts.p10.y}
            A ${r_outer} ${r_outer} 0 0 0 ${inPts.p9.x} ${inPts.p9.y}
            L ${inPts.p8.x} ${inPts.p8.y}
            A ${r_outer} ${r_outer} 0 0 0 ${inPts.p7.x} ${inPts.p7.y}
            L ${inPts.p6.x} ${inPts.p6.y}
            A ${r_inner3} ${r_inner3} 0 0 1 ${inPts.p5.x} ${inPts.p5.y}
            L ${inPts.p4.x} ${inPts.p4.y}
            A ${r_outer} ${r_outer} 0 0 0 ${inPts.p3.x} ${inPts.p3.y}
            L ${inPts.p2.x} ${inPts.p2.y}
            A ${r_outer} ${r_outer} 0 0 0 ${inPts.p1.x} ${inPts.p1.y}
            L ${inPts.p0.x} ${inPts.p0.y}
            Z
        `;
        const closedHatchPath = outerPath + reverseInnerPath;

        const topLimit = Math.min(0, y_R_top);
        const minX = -45;
        const maxX = D + 45;
        const minY = topLimit - 40;
        const maxY = y_bot + 45;
        const vbW = maxX - minX;
        const vbH = maxY - minY;

        // Dimensions:
        const dimD_Y = topLimit - 20;
        const dimD = `
            <line x1="0" y1="0" x2="0" y2="${dimD_Y - 3}" stroke="${colDimLine}" stroke-width="0.5" stroke-dasharray="1.5,1.5" />
            <line x1="${D}" y1="${y_R_top}" x2="${D}" y2="${dimD_Y - 3}" stroke="${colDimLine}" stroke-width="0.5" stroke-dasharray="1.5,1.5" />
            ${makeDimH(0, D, dimD_Y, D, 'D', -3.8)}
        `;

        const dimR_L_Y = -8;
        const dimR_L = `
            <line x1="0" y1="0" x2="0" y2="${dimR_L_Y - 3}" stroke="${colDimLine}" stroke-width="0.5" stroke-dasharray="1.5,1.5" />
            <line x1="${R_L}" y1="0" x2="${R_L}" y2="${dimR_L_Y - 3}" stroke="${colDimLine}" stroke-width="0.5" stroke-dasharray="1.5,1.5" />
            ${makeDimH(0, R_L, dimR_L_Y, R_L, 'R_L', -3.8, false)}
        `;

        const dimR_R_Y = y_R_top - 8;
        const dimR_R = `
            <line x1="${D - R_R}" y1="${y_R_top}" x2="${D - R_R}" y2="${dimR_R_Y - 3}" stroke="${colDimLine}" stroke-width="0.5" stroke-dasharray="1.5,1.5" />
            <line x1="${D}" y1="${y_R_top}" x2="${D}" y2="${dimR_R_Y - 3}" stroke="${colDimLine}" stroke-width="0.5" stroke-dasharray="1.5,1.5" />
            ${makeDimH(D - R_R, D, dimR_R_Y, R_R, 'R_R', -3.8, false)}
        `;

        const dimA_L_X = -16;
        const dimA_L = `
            <line x1="0" y1="0" x2="${dimA_L_X - 3}" y2="0" stroke="${colDimLine}" stroke-width="0.5" stroke-dasharray="1.5,1.5" />
            <line x1="0" y1="${A_L}" x2="${dimA_L_X - 3}" y2="${A_L}" stroke="${colDimLine}" stroke-width="0.5" stroke-dasharray="1.5,1.5" />
            ${makeDimV(0, A_L, dimA_L_X, A_L, 'A_L', -4.0, true)}
        `;

        const dimA_R_X = D + 18;
        const dimA_R = `
            <line x1="${D}" y1="${y_R_top}" x2="${dimA_R_X + 3}" y2="${y_R_top}" stroke="${colDimLine}" stroke-width="0.5" stroke-dasharray="1.5,1.5" />
            <line x1="${D}" y1="${y_rab2}" x2="${dimA_R_X + 3}" y2="${y_rab2}" stroke="${colDimLine}" stroke-width="0.5" stroke-dasharray="1.5,1.5" />
            ${makeDimV(y_R_top, y_rab2, dimA_R_X, A_R, 'A_R', 4.0, true)}
        `;

        const dimBot_Y = y_bot + 24;
        const dimBottom = `
            <line x1="0" y1="${A_L}" x2="0" y2="${dimBot_Y + 3}" stroke="${colDimLine}" stroke-width="0.5" stroke-dasharray="1.5,1.5" />
            <line x1="${W_rab1}" y1="${A_L}" x2="${W_rab1}" y2="${dimBot_Y + 3}" stroke="${colDimLine}" stroke-width="0.5" stroke-dasharray="1.5,1.5" />
            <line x1="${x_web_end}" y1="${y_rab2}" x2="${x_web_end}" y2="${dimBot_Y + 3}" stroke="${colDimLine}" stroke-width="0.5" stroke-dasharray="1.5,1.5" />
            <line x1="${D}" y1="${y_rab2}" x2="${D}" y2="${dimBot_Y + 3}" stroke="${colDimLine}" stroke-width="0.5" stroke-dasharray="1.5,1.5" />
            
            ${makeDimH(0, W_rab1, dimBot_Y, W_rab1, 'W_rab1', 4.0)}
            ${makeDimH(W_rab1, x_web_end, dimBot_Y, Math.round(W_web), 'W_web', 4.0)}
            ${makeDimH(x_web_end, D, dimBot_Y, W_rab2, 'W_rab2', 4.0)}
        `;

        const dimStep_X = D + 30;
        const dimStep = `
            <line x1="${x_web_end}" y1="${y_rab2}" x2="${dimStep_X + 3}" y2="${y_rab2}" stroke="${colDimLine}" stroke-width="0.5" stroke-dasharray="1.5,1.5" />
            <line x1="${x_web_end}" y1="${y_bot}" x2="${dimStep_X + 3}" y2="${y_bot}" stroke="${colDimLine}" stroke-width="0.5" stroke-dasharray="1.5,1.5" />
            ${makeDimV(y_rab2, y_bot, dimStep_X, S_total, 'H_step', 4.0, true)}
        `;

        const dimGroove_Y = y_bot - H_step - 5;
        const dimGroove = `
            <line x1="${W_rab1}" y1="${y_bot - H_step}" x2="${W_rab1}" y2="${dimGroove_Y - 3}" stroke="${colDimLine}" stroke-width="0.5" stroke-dasharray="1.5,1.5" />
            <line x1="${x_stop}" y1="${y_bot - H_step}" x2="${x_stop}" y2="${dimGroove_Y - 3}" stroke="${colDimLine}" stroke-width="0.5" stroke-dasharray="1.5,1.5" />
            ${makeDimH(W_rab1, x_stop, dimGroove_Y, W_step, 'W_step', -3.2, false)}
        `;

        viewport.innerHTML = `
            <svg viewBox="${minX} ${minY} ${vbW} ${vbH}" class="w-full h-full max-h-[440px] select-none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <marker id="cad-arr-end" markerWidth="5" markerHeight="5" refX="4.5" refY="2.5" orient="auto">
                        <path d="M 0,0.8 L 4.5,2.5 L 0,4.2 Z" fill="${colDimLine}" />
                    </marker>
                    <marker id="cad-arr-start" markerWidth="5" markerHeight="5" refX="0.5" refY="2.5" orient="auto">
                        <path d="M 4.5,0.8 L 0,2.5 L 4.5,4.2 Z" fill="${colDimLine}" />
                    </marker>
                    <pattern id="profile-cad-hatch" width="2.2" height="2.2" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                        <line x1="0" y1="0" x2="0" y2="2.2" stroke="#94a3b8" stroke-width="0.2" />
                    </pattern>
                </defs>
                <rect x="${minX}" y="${minY}" width="${vbW}" height="${vbH}" fill="${colBg}" />
                <path d="${closedHatchPath}" fill="#ffffff" stroke="none" />
                <path d="${closedHatchPath}" fill="url(#profile-cad-hatch)" stroke="${colProfile}" stroke-width="0.25" stroke-linecap="round" stroke-linejoin="round" />
                ${dimD}
                ${dimR_L}
                ${dimR_R}
                ${dimA_L}
                ${dimA_R}
                ${dimBottom}
                ${dimStep}
                ${dimGroove}
            </svg>
        `;
        return;
    }

    const isWithoutRubber = pType.includes('without') || pType.includes('بدون') || pType === 'single rabbit';
    if (isWithoutRubber) {
        const D = parseFloat(s.D) || 150.0;
        const A_L = parseFloat(s.A_L) || 55.0;
        const A_R = parseFloat(s.A_R) !== undefined ? parseFloat(s.A_R) : 40.0;
        const R_L = parseFloat(s.R_L) || 15.0;
        const R_R = parseFloat(s.R_R) || 15.0;
        const T = Math.min(2.0, parseFloat(s.T) || 1.5);
        const W_rab = 47.0;
        const S = 15.0;
        const W_web = Math.max(20.0, D - W_rab);
        const y_bot = A_L + S;
        const y_R_top = y_bot - A_R;

        // Outer contour of Single Rabbet Without Rubber
        const outerD = `
            M ${D - R_R} ${y_R_top}
            L ${D} ${y_R_top}
            L ${D} ${y_bot}
            L ${W_rab} ${y_bot}
            L ${W_rab} ${A_L}
            L 0 ${A_L}
            L 0 0
            L ${R_L} 0
        `;

        // Inner contour (thickness T)
        const innerD = `
            L ${R_L} ${T}
            L ${T} ${T}
            L ${T} ${A_L - T}
            L ${W_rab - T} ${A_L - T}
            L ${W_rab - T} ${y_bot - T}
            L ${D - T} ${y_bot - T}
            L ${D - T} ${y_R_top + T}
            L ${D - R_R} ${y_R_top + T}
            Z
        `;
        const closedHatchPath = outerD + innerD;

        const topLimit = Math.min(0, y_R_top);
        const minX = -45;
        const maxX = D + 45;
        const minY = topLimit - 40;
        const maxY = y_bot + 45;
        const vbW = maxX - minX;
        const vbH = maxY - minY;

        // Dimensions:
        const dimD_Y = topLimit - 20;
        const dimD = `
            <line x1="0" y1="0" x2="0" y2="${dimD_Y - 3}" stroke="${colDimLine}" stroke-width="0.5" stroke-dasharray="1.5,1.5" />
            <line x1="${D}" y1="${y_R_top}" x2="${D}" y2="${dimD_Y - 3}" stroke="${colDimLine}" stroke-width="0.5" stroke-dasharray="1.5,1.5" />
            ${makeDimH(0, D, dimD_Y, D, 'D', -3.8)}
        `;

        const dimR_L_Y = -8;
        const dimR_L = `
            <line x1="0" y1="0" x2="0" y2="${dimR_L_Y - 3}" stroke="${colDimLine}" stroke-width="0.5" stroke-dasharray="1.5,1.5" />
            <line x1="${R_L}" y1="0" x2="${R_L}" y2="${dimR_L_Y - 3}" stroke="${colDimLine}" stroke-width="0.5" stroke-dasharray="1.5,1.5" />
            ${makeDimH(0, R_L, dimR_L_Y, R_L, 'R_L', -3.8, false)}
        `;

        const dimR_R_Y = y_R_top - 8;
        const dimR_R = `
            <line x1="${D - R_R}" y1="${y_R_top}" x2="${D - R_R}" y2="${dimR_R_Y - 3}" stroke="${colDimLine}" stroke-width="0.5" stroke-dasharray="1.5,1.5" />
            <line x1="${D}" y1="${y_R_top}" x2="${D}" y2="${dimR_R_Y - 3}" stroke="${colDimLine}" stroke-width="0.5" stroke-dasharray="1.5,1.5" />
            ${makeDimH(D - R_R, D, dimR_R_Y, R_R, 'R_R', -3.8, false)}
        `;

        const dimA_L_X = -16;
        const dimA_L = `
            <line x1="0" y1="0" x2="${dimA_L_X - 3}" y2="0" stroke="${colDimLine}" stroke-width="0.5" stroke-dasharray="1.5,1.5" />
            <line x1="0" y1="${A_L}" x2="${dimA_L_X - 3}" y2="${A_L}" stroke="${colDimLine}" stroke-width="0.5" stroke-dasharray="1.5,1.5" />
            ${makeDimV(0, A_L, dimA_L_X, A_L, 'A_L', -4.0, true)}
        `;

        const dimA_R_X = D + 18;
        const dimA_R = `
            <line x1="${D}" y1="${y_R_top}" x2="${dimA_R_X + 3}" y2="${y_R_top}" stroke="${colDimLine}" stroke-width="0.5" stroke-dasharray="1.5,1.5" />
            <line x1="${D}" y1="${y_bot}" x2="${dimA_R_X + 3}" y2="${y_bot}" stroke="${colDimLine}" stroke-width="0.5" stroke-dasharray="1.5,1.5" />
            ${makeDimV(y_R_top, y_bot, dimA_R_X, A_R, 'A_R', 4.0, true)}
        `;

        const dimBot_Y = y_bot + 24;
        const dimBottom = `
            <line x1="0" y1="${A_L}" x2="0" y2="${dimBot_Y + 3}" stroke="${colDimLine}" stroke-width="0.5" stroke-dasharray="1.5,1.5" />
            <line x1="${W_rab}" y1="${y_bot}" x2="${W_rab}" y2="${dimBot_Y + 3}" stroke="${colDimLine}" stroke-width="0.5" stroke-dasharray="1.5,1.5" />
            <line x1="${D}" y1="${y_bot}" x2="${D}" y2="${dimBot_Y + 3}" stroke="${colDimLine}" stroke-width="0.5" stroke-dasharray="1.5,1.5" />
            
            ${makeDimH(0, W_rab, dimBot_Y, W_rab, 'W_rab', 4.0)}
            ${makeDimH(W_rab, D, dimBot_Y, Math.round(W_web), 'W_web', 4.0)}
        `;

        const dimStep_X = W_rab + 14;
        const dimStep = `
            <line x1="${W_rab}" y1="${A_L}" x2="${dimStep_X + 3}" y2="${A_L}" stroke="${colDimLine}" stroke-width="0.5" stroke-dasharray="1.5,1.5" />
            <line x1="${W_rab}" y1="${y_bot}" x2="${dimStep_X + 3}" y2="${y_bot}" stroke="${colDimLine}" stroke-width="0.5" stroke-dasharray="1.5,1.5" />
            ${makeDimV(A_L, y_bot, dimStep_X, S, 'H_step', 3.8, true)}
        `;

        viewport.innerHTML = `
            <svg viewBox="${minX} ${minY} ${vbW} ${vbH}" class="w-full h-full max-h-[440px] select-none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <marker id="cad-arr-end" markerWidth="5" markerHeight="5" refX="4.5" refY="2.5" orient="auto">
                        <path d="M 0,0.8 L 4.5,2.5 L 0,4.2 Z" fill="${colDimLine}" />
                    </marker>
                    <marker id="cad-arr-start" markerWidth="5" markerHeight="5" refX="0.5" refY="2.5" orient="auto">
                        <path d="M 4.5,0.8 L 0,2.5 L 4.5,4.2 Z" fill="${colDimLine}" />
                    </marker>
                    <pattern id="profile-cad-hatch" width="2.2" height="2.2" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                        <line x1="0" y1="0" x2="0" y2="2.2" stroke="#94a3b8" stroke-width="0.2" />
                    </pattern>
                </defs>
                <rect x="${minX}" y="${minY}" width="${vbW}" height="${vbH}" fill="${colBg}" />
                <path d="${closedHatchPath}" fill="#ffffff" stroke="none" />
                <path d="${closedHatchPath}" fill="url(#profile-cad-hatch)" stroke="${colProfile}" stroke-width="0.25" stroke-linecap="round" stroke-linejoin="round" />
                ${dimD}
                ${dimR_L}
                ${dimR_R}
                ${dimA_L}
                ${dimA_R}
                ${dimBottom}
                ${dimStep}
            </svg>
        `;
        return;
    }

    // 1. Top Depth: D (Topmost horizontal dimension)
    const dimD_Y = topLimit - 20;
    const dimD = `
        <line x1="0" y1="0" x2="0" y2="${dimD_Y - 3}" stroke="${colDimLine}" stroke-width="0.5" stroke-dasharray="1.5,1.5" />
        <line x1="${D}" y1="${y_R_top}" x2="${D}" y2="${dimD_Y - 3}" stroke="${colDimLine}" stroke-width="0.5" stroke-dasharray="1.5,1.5" />
        ${makeDimH(0, D, dimD_Y, D, 'D', -3.8)}
    `;

    // 2. Left Flange Return: R_L (Top left)
    const dimR_L_Y = -8;
    const dimR_L = `
        <line x1="0" y1="0" x2="0" y2="${dimR_L_Y - 3}" stroke="${colDimLine}" stroke-width="0.5" stroke-dasharray="1.5,1.5" />
        <line x1="${R_L}" y1="0" x2="${R_L}" y2="${dimR_L_Y - 3}" stroke="${colDimLine}" stroke-width="0.5" stroke-dasharray="1.5,1.5" />
        ${makeDimH(0, R_L, dimR_L_Y, R_L, 'R_L', -3.8, false)}
    `;

    // 3. Right Flange Return: R_R (Top right)
    const dimR_R_Y = y_R_top - 8;
    const dimR_R = `
        <line x1="${D - R_R}" y1="${y_R_top}" x2="${D - R_R}" y2="${dimR_R_Y - 3}" stroke="${colDimLine}" stroke-width="0.5" stroke-dasharray="1.5,1.5" />
        <line x1="${D}" y1="${y_R_top}" x2="${D}" y2="${dimR_R_Y - 3}" stroke="${colDimLine}" stroke-width="0.5" stroke-dasharray="1.5,1.5" />
        ${makeDimH(D - R_R, D, dimR_R_Y, R_R, 'R_R', -3.8, false)}
    `;

    // 4. Left Height: A_L (Left vertical)
    const dimA_L_X = -16;
    const dimA_L = `
        <line x1="0" y1="0" x2="${dimA_L_X - 3}" y2="0" stroke="${colDimLine}" stroke-width="0.5" stroke-dasharray="1.5,1.5" />
        <line x1="0" y1="${A_L}" x2="${dimA_L_X - 3}" y2="${A_L}" stroke="${colDimLine}" stroke-width="0.5" stroke-dasharray="1.5,1.5" />
        ${makeDimV(0, A_L, dimA_L_X, A_L, 'A_L', -4.0, true)}
    `;

    // 5. Right Height: A_R (Right vertical)
    const dimA_R_X = D + 18;
    const dimA_R = `
        <line x1="${D}" y1="${y_R_top}" x2="${dimA_R_X + 3}" y2="${y_R_top}" stroke="${colDimLine}" stroke-width="0.5" stroke-dasharray="1.5,1.5" />
        <line x1="${D}" y1="${y_bot}" x2="${dimA_R_X + 3}" y2="${y_bot}" stroke="${colDimLine}" stroke-width="0.5" stroke-dasharray="1.5,1.5" />
        ${makeDimV(y_R_top, y_bot, dimA_R_X, A_R, 'A_R', 4.0, true)}
    `;

    // 6. Vertical Step H_step (Adjacent to groove)
    const dimStep_X = W_rab - 12;
    const dimStep = `
        <line x1="${W_rab}" y1="${y_bot - H_step}" x2="${dimStep_X - 2.5}" y2="${y_bot - H_step}" stroke="${colDimLine}" stroke-width="0.5" stroke-dasharray="1.5,1.5" />
        <line x1="${W_rab}" y1="${y_bot}" x2="${dimStep_X - 2.5}" y2="${y_bot}" stroke="${colDimLine}" stroke-width="0.5" stroke-dasharray="1.5,1.5" />
        ${makeDimV(y_bot - H_step, y_bot, dimStep_X, H_step, 'H_step', -3.8, true)}
    `;

    // 7. Inner Vertical Step S_in (Inside rabbet to right of groove)
    const dimSin_X = W_rab + W_step + 14;
    const dimSin = `
        <line x1="${W_rab + W_step}" y1="${A_L}" x2="${dimSin_X + 2.5}" y2="${A_L}" stroke="${colDimLine}" stroke-width="0.5" stroke-dasharray="1.5,1.5" />
        <line x1="${W_rab + W_step}" y1="${y_bot - H_step}" x2="${dimSin_X + 2.5}" y2="${y_bot - H_step}" stroke="${colDimLine}" stroke-width="0.5" stroke-dasharray="1.5,1.5" />
        ${makeDimV(A_L, y_bot - H_step, dimSin_X, S_in, 'S_in', 3.8, true)}
    `;

    // 8. Groove Width W_step (Under rubber groove)
    const dimGroove_Y = y_bot + 10;
    const dimGroove = `
        <line x1="${W_rab}" y1="${y_bot}" x2="${W_rab}" y2="${dimGroove_Y + 2.5}" stroke="${colDimLine}" stroke-width="0.5" stroke-dasharray="1.5,1.5" />
        <line x1="${W_rab + W_step}" y1="${y_bot - H_step}" x2="${W_rab + W_step}" y2="${dimGroove_Y + 2.5}" stroke="${colDimLine}" stroke-width="0.5" stroke-dasharray="1.5,1.5" />
        ${makeDimH(W_rab, W_rab + W_step, dimGroove_Y, W_step, 'W_step', 4.0, false)}
    `;

    // 9. Bottom Dimensions: W_rab (left rabbet) and W_web (right web)
    const dimBot_Y = y_bot + 24;
    const dimBottom = `
        <line x1="0" y1="${A_L}" x2="0" y2="${dimBot_Y + 3}" stroke="${colDimLine}" stroke-width="0.5" stroke-dasharray="1.5,1.5" />
        <line x1="${W_rab}" y1="${y_bot}" x2="${W_rab}" y2="${dimBot_Y + 3}" stroke="${colDimLine}" stroke-width="0.5" stroke-dasharray="1.5,1.5" />
        <line x1="${D}" y1="${y_bot}" x2="${D}" y2="${dimBot_Y + 3}" stroke="${colDimLine}" stroke-width="0.5" stroke-dasharray="1.5,1.5" />
        
        <!-- left rabbet width -->
        ${makeDimH(0, W_rab, dimBot_Y, W_rab, 'W_rab', 4.0)}

        <!-- right web width -->
        ${makeDimH(W_rab, D, dimBot_Y, W_web, 'W_web', 4.0)}
    `;

    // 10. Thickness T inside right architrave with architectural ticks
    const dimThick_X = D - 14;
    const dimThick_Y_mid = (y_R_top + 18);
    const dimThick = `
        <line x1="${D - T}" y1="${dimThick_Y_mid}" x2="${dimThick_X}" y2="${dimThick_Y_mid}" stroke="${colDimLine}" stroke-width="0.5" stroke-dasharray="1.5,1.5" />
        ${makeDimV(dimThick_Y_mid - 6, dimThick_Y_mid + 6, dimThick_X, T, 'T', -3.8, true)}
    `;

    // Render pure refined drawing with AutoCAD crosshatch and soft blue background
    viewport.innerHTML = `
        <svg viewBox="${minX} ${minY} ${vbW} ${vbH}" class="w-full h-full max-h-[440px] select-none" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <!-- AutoCAD architectural tick / arrow markers -->
                <marker id="cad-arr-end" markerWidth="5" markerHeight="5" refX="4.5" refY="2.5" orient="auto">
                    <path d="M 0,0.8 L 4.5,2.5 L 0,4.2 Z" fill="${colDimLine}" />
                </marker>
                <marker id="cad-arr-start" markerWidth="5" markerHeight="5" refX="0.5" refY="2.5" orient="auto">
                    <path d="M 4.5,0.8 L 0,2.5 L 4.5,4.2 Z" fill="${colDimLine}" />
                </marker>

                <!-- Architectural 45-degree engineering crosshatch pattern -->
                <pattern id="profile-cad-hatch" width="2.2" height="2.2" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                    <line x1="0" y1="0" x2="0" y2="2.2" stroke="#94a3b8" stroke-width="0.2" />
                </pattern>
            </defs>

            <!-- Architectural Canvas Background -->
            <rect x="${minX}" y="${minY}" width="${vbW}" height="${vbH}" fill="${colBg}" />

            <!-- Profile Solid Fill Underneath -->
            <path d="${closedHatchPath}" fill="#ffffff" stroke="none" />

            <!-- Profile Metal Hatch Interior & Thin Architectural Charcoal Outline -->
            <path d="${closedHatchPath}" fill="url(#profile-cad-hatch)" stroke="${colProfile}" stroke-width="0.25" stroke-linecap="round" stroke-linejoin="round" />

            <!-- Dimensions (Faithful to Architectural Blueprint) -->
            ${dimD}
            ${dimR_L}
            ${dimR_R}
            ${dimA_L}
            ${dimA_R}
            ${dimStep}
            ${dimSin}
            ${dimGroove}
            ${dimBottom}
            ${dimThick}
        </svg>
    `;
};



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

// ------------- PROJECT OPTIONS MANAGEMENT -------------

async function loadStoreItemsForOptions(type, selectedName = null) {
    const itemSelect = document.getElementById('optFormItemSelect');
    if (!itemSelect) return;
    itemSelect.innerHTML = '<option value="">جاري تحميل أصناف المخزن...</option>';

    try {
        let items = [];
        const response = await authFetch(`${API_URL}/`);
        if (response.ok) {
            const allItems = await response.json();
            // Filter by category "إكسسوارات" / "قسم الاكسسوارات" or any accessory item
            items = allItems.filter(it => {
                const cat = normalizeArabic(it.category || '');
                return cat.includes('كسسوار') || cat.includes('accessories');
            });
            if (items.length === 0) items = allItems;
        } else {
            throw new Error('فشل الاستجابة');
        }

        const filtered = items.filter(it => {
            const sub = normalizeArabic(it.subcategory || '');
            const name = normalizeArabic(it.name || '');
            if (type === 'lock') return sub.includes('زرفيل') || sub.includes('قفل') || sub.includes('lock') || name.includes('زرفيل') || name.includes('قفل') || name.includes('lock');
            if (type === 'hinge') return sub.includes('فصال') || sub.includes('hinge') || name.includes('فصال') || name.includes('hinge');
            return true;
        });

        const displayItems = filtered.length > 0 ? filtered : items;

        if (displayItems.length > 0) {
            itemSelect.innerHTML = '<option value="">-- اختر الصنف من المخزن --</option>';
            displayItems.forEach(item => {
                const optEl = document.createElement('option');
                optEl.value = item.name;
                optEl.dataset.sku = item.sku || '';
                if (selectedName && (item.name === selectedName || (item.name && selectedName && item.name.trim().toLowerCase() === selectedName.trim().toLowerCase()))) {
                    optEl.selected = true;
                }
                optEl.textContent = `${item.name} ${item.sku ? '(' + item.sku + ')' : '(بدون رمز SKU)'}`;
                itemSelect.appendChild(optEl);
            });
            // If selectedName wasn't in displayItems, append it
            if (selectedName && !Array.from(itemSelect.options).some(o => o.value === selectedName)) {
                const optEl = document.createElement('option');
                optEl.value = selectedName;
                optEl.selected = true;
                optEl.textContent = selectedName;
                itemSelect.appendChild(optEl);
            }
        } else {
            itemSelect.innerHTML = '<option value="">-- لا توجد أصناف في المستودع --</option>';
        }
    } catch (err) {
        console.error('Error fetching accessories items:', err);
        itemSelect.innerHTML = '<option value="">-- خطأ أثناء جلب الأصناف --</option>';
    }
}

window.openAddOptionModal = async function(type) {
    let title = 'إضافة خيار جديد';
    if (type === 'lock') title = 'إضافة خيار زرفيل جديد';
    else if (type === 'hinge') title = 'إضافة خيار فصالة جديد';
    else if (type === 'profile') title = 'إضافة خيار مقطع جديد';
    else if (type === 'door_type') title = 'إضافة خيار نوع درفة جديد';
    else if (type === 'specification') title = 'إضافة خيار مواصفات جديد';

    document.getElementById('optionModalTitle').textContent = title;
    const subTitleEl = document.getElementById('optionModalSubtitle');
    if (subTitleEl) {
        subTitleEl.textContent = (type === 'lock' || type === 'hinge')
            ? 'اختر الصنف من قسم إكسسوارات المخزن وتحديد مقاومة الحريق.'
            : 'أدخل اسم الخيار المعتمد لمشاريع الأبواب.';
    }

    document.getElementById('optFormId').value = '';
    document.getElementById('optFormType').value = type;
    document.getElementById('optFormName').value = '';
    document.getElementById('optFormSku').value = '';
    document.getElementById('optFormFireRated').checked = false;

    const storeContainer = document.getElementById('optStoreItemContainer');
    const customContainer = document.getElementById('optCustomNameContainer');
    const fireContainer = document.getElementById('optFireRatedContainer');
    const skuContainer = document.getElementById('optSkuContainer');

    // Custom name container is always visible so user can customize the display name
    if (customContainer) customContainer.classList.remove('hidden');

    if (type === 'lock' || type === 'hinge') {
        if (storeContainer) storeContainer.classList.remove('hidden');
        if (fireContainer) fireContainer.classList.remove('hidden');
        if (skuContainer) skuContainer.classList.remove('hidden');
        await loadStoreItemsForOptions(type);
    } else {
        if (storeContainer) storeContainer.classList.add('hidden');
        if (fireContainer) fireContainer.classList.add('hidden');
        if (skuContainer) skuContainer.classList.add('hidden');
    }

    document.getElementById('projectOptionModal').classList.remove('hidden');
};

window.handleOptionItemSelect = function(selectEl) {
    const selectedOpt = selectEl.options[selectEl.selectedIndex];
    if (selectedOpt && selectedOpt.value) {
        document.getElementById('optFormName').value = selectedOpt.value;
        document.getElementById('optFormSku').value = selectedOpt.dataset.sku || '';
    } else {
        document.getElementById('optFormSku').value = '';
    }
};

window.openEditOptionModal = async function(id, type) {
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
    const subTitleEl = document.getElementById('optionModalSubtitle');
    if (subTitleEl) {
        subTitleEl.textContent = (type === 'lock' || type === 'hinge')
            ? 'تعديل خيار الإكسسوار وربطه بالمستودع ومقاومة الحريق.'
            : 'تعديل اسم الخيار المعتمد للمشاريع.';
    }

    document.getElementById('optFormId').value = id;
    document.getElementById('optFormType').value = type;
    document.getElementById('optFormName').value = opt.name;
    document.getElementById('optFormSku').value = opt.sku || '';
    document.getElementById('optFormFireRated').checked = opt.is_fire_rated === true || opt.is_fire_rated == 1;

    const storeContainer = document.getElementById('optStoreItemContainer');
    const customContainer = document.getElementById('optCustomNameContainer');
    const fireContainer = document.getElementById('optFireRatedContainer');
    const skuContainer = document.getElementById('optSkuContainer');

    // Always keep custom name container visible for editing the name
    if (customContainer) customContainer.classList.remove('hidden');

    if (type === 'lock' || type === 'hinge') {
        if (storeContainer) storeContainer.classList.remove('hidden');
        if (fireContainer) fireContainer.classList.remove('hidden');
        if (skuContainer) skuContainer.classList.remove('hidden');
        await loadStoreItemsForOptions(type, opt.name);
    } else {
        if (storeContainer) storeContainer.classList.add('hidden');
        if (fireContainer) fireContainer.classList.add('hidden');
        if (skuContainer) skuContainer.classList.add('hidden');
    }

    document.getElementById('projectOptionModal').classList.remove('hidden');
};

window.closeProjectOptionModal = function() {
    document.getElementById('projectOptionModal').classList.add('hidden');
};

window.handleOptionFormSubmit = async function(e) {
    e.preventDefault();
    const id = document.getElementById('optFormId').value;
    const type = document.getElementById('optFormType').value;
    let name = document.getElementById('optFormName').value.trim();
    const sku = document.getElementById('optFormSku').value.trim();
    const isFireRated = document.getElementById('optFormFireRated').checked;

    if (!name) {
        showToast('الرجاء إدخال أو اختيار اسم الخيار', 'bg-rose-500', '✗');
        return;
    }

    const isAccessory = (type === 'lock' || type === 'hinge');
    const payload = {
        option_type: type,
        name: name,
        sku: isAccessory ? (sku || null) : null,
        is_fire_rated: isAccessory ? isFireRated : false
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
            const isFire = opt.is_fire_rated === true || opt.is_fire_rated == 1;
            const fireBadge = isFire 
                ? '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">🔥 مقاوم للحريق</span>' 
                : '<span class="text-slate-400 text-xs">عادي</span>';
            const tr = document.createElement('tr');
            tr.className = 'border-b hover:bg-slate-50 transition';
            tr.innerHTML = `
                <td class="p-4 font-semibold text-slate-800">${opt.name}</td>
                <td class="p-4 text-slate-500 font-mono">${opt.sku || '---'}</td>
                <td class="p-4 text-center">${fireBadge}</td>
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
            const isFire = opt.is_fire_rated === true || opt.is_fire_rated == 1;
            const fireBadge = isFire 
                ? '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">🔥 مقاوم للحريق</span>' 
                : '<span class="text-slate-400 text-xs">عادي</span>';
            const tr = document.createElement('tr');
            tr.className = 'border-b hover:bg-slate-50 transition';
            tr.innerHTML = `
                <td class="p-4 font-semibold text-slate-800">${opt.name}</td>
                <td class="p-4 text-slate-500 font-mono">${opt.sku || '---'}</td>
                <td class="p-4 text-center">${fireBadge}</td>
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

// ================= FIRE-RATED DOOR RULES LOGIC =================
let dbFireDoorRules = [];

window.loadFireDoorRules = async function() {
    try {
        const response = await authFetch(`${API_HOST}/api/fire-door-rules/`);
        if (response.ok) {
            dbFireDoorRules = await response.json();
        }
    } catch (err) {
        console.error('Error fetching fire door rules:', err);
    }
};

window.renderFireDoorRulesAdmin = function() {
    const tbody = document.getElementById('fireDoorRulesTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!dbFireDoorRules || dbFireDoorRules.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="16" class="p-8 text-center text-slate-400 font-semibold bg-slate-50/50">
                    لا توجد مواصفات محددة لأبواب الحريق حالياً. اضغط على "إضافة صف مواصفة جديدة" لإنشاء مواصفة.
                </td>
            </tr>
        `;
        return;
    }

    dbFireDoorRules.forEach((rule, idx) => {
        const tr = document.createElement('tr');
        tr.className = 'border-b hover:bg-slate-50 transition text-slate-800 text-xs';

        const fmtVal = (val) => (val !== null && val !== undefined && val !== '') ? `<span class="font-bold font-mono text-slate-900">${val}</span>` : '<span class="text-slate-300 font-mono">-</span>';
        const profileBadge = (!rule.profile_type || rule.profile_type === 'الجميع') 
            ? '<span class="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md font-bold text-[11px]">الجميع</span>' 
            : `<span class="font-semibold text-slate-800">${rule.profile_type}</span>`;
        const doorTypeBadge = (!rule.door_type || rule.door_type === 'الجميع') 
            ? '<span class="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md font-bold text-[11px]">الجميع</span>' 
            : `<span class="font-semibold text-slate-800">${rule.door_type}</span>`;

        tr.innerHTML = `
            <td class="p-3 font-mono font-bold text-slate-400 border-l border-slate-100">${idx + 1}</td>
            <td class="p-2 border-l border-slate-100 bg-amber-50/20">${fmtVal(rule.min_height)}</td>
            <td class="p-2 border-l border-slate-100 bg-amber-50/20">${fmtVal(rule.max_height)}</td>
            <td class="p-2 border-l border-slate-100 bg-blue-50/20">${fmtVal(rule.min_width)}</td>
            <td class="p-2 border-l border-slate-100 bg-blue-50/20">${fmtVal(rule.max_width)}</td>
            <td class="p-2 border-l border-slate-100 bg-indigo-50/20">${fmtVal(rule.min_depth)}</td>
            <td class="p-2 border-l border-slate-100 bg-indigo-50/20">${fmtVal(rule.max_depth)}</td>
            <td class="p-2 border-l border-slate-100">${profileBadge}</td>
            <td class="p-2 border-l border-slate-100">${doorTypeBadge}</td>
            <td class="p-2 border-l border-slate-100 bg-emerald-50/20">${fmtVal(rule.min_leaf_thickness)}</td>
            <td class="p-2 border-l border-slate-100 bg-emerald-50/20">${fmtVal(rule.max_leaf_thickness)}</td>
            <td class="p-2 border-l border-slate-100 bg-purple-50/20">${fmtVal(rule.min_architrave)}</td>
            <td class="p-2 border-l border-slate-100 bg-purple-50/20">${fmtVal(rule.max_architrave)}</td>
            <td class="p-2 border-l border-slate-100 bg-rose-50/20">${fmtVal(rule.min_architrave_2)}</td>
            <td class="p-2 border-l border-slate-100 bg-rose-50/20">${fmtVal(rule.max_architrave_2)}</td>
            <td class="p-2">
                <div class="flex items-center justify-center gap-1.5">
                    <button onclick="openEditFireRuleModal(${rule.id})" class="px-2.5 py-1 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg transition text-xs font-bold border border-amber-200">تعديل</button>
                    <button onclick="deleteFireRule(${rule.id})" class="px-2.5 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg transition text-xs font-bold border border-rose-200">حذف</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
};

window.openAddFireRuleModal = function() {
    document.getElementById('fireRuleModalTitle').innerHTML = '<span>🔥 إضافة مواصفة باب مقاوم للحريق</span>';
    document.getElementById('fireRuleId').value = '';
    document.getElementById('fireRuleName').value = '';
    
    // Populate profile select
    const profileSelect = document.getElementById('fireRuleProfile');
    profileSelect.innerHTML = '<option value="الجميع">الجميع (ينطبق على كافة المقاطع)</option>';
    if (typeof dbProfileOptions !== 'undefined') {
        dbProfileOptions.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.name;
            opt.textContent = p.name;
            profileSelect.appendChild(opt);
        });
    }

    // Populate door type select
    const doorTypeSelect = document.getElementById('fireRuleDoorType');
    doorTypeSelect.innerHTML = '<option value="الجميع">الجميع (ينطبق على كافة أنواع الدرفات)</option>';
    if (typeof dbDoorTypeOptions !== 'undefined') {
        dbDoorTypeOptions.forEach(dt => {
            const opt = document.createElement('option');
            opt.value = dt.name;
            opt.textContent = dt.name;
            doorTypeSelect.appendChild(opt);
        });
    }

    // Clear numeric fields
    document.getElementById('fireRuleMinHeight').value = '';
    document.getElementById('fireRuleMaxHeight').value = '';
    document.getElementById('fireRuleMinWidth').value = '';
    document.getElementById('fireRuleMaxWidth').value = '';
    document.getElementById('fireRuleMinDepth').value = '';
    document.getElementById('fireRuleMaxDepth').value = '';
    document.getElementById('fireRuleMinLeafThickness').value = '';
    document.getElementById('fireRuleMaxLeafThickness').value = '';
    document.getElementById('fireRuleMinArchitrave').value = '';
    document.getElementById('fireRuleMaxArchitrave').value = '';
    document.getElementById('fireRuleMinArchitrave2').value = '';
    document.getElementById('fireRuleMaxArchitrave2').value = '';

    document.getElementById('fireDoorRuleModal').classList.remove('hidden');
};

window.openEditFireRuleModal = function(id) {
    const rule = dbFireDoorRules.find(r => r.id === id);
    if (!rule) return;

    document.getElementById('fireRuleModalTitle').innerHTML = '<span>🔥 تعديل مواصفة باب مقاوم للحريق</span>';
    document.getElementById('fireRuleId').value = rule.id;
    document.getElementById('fireRuleName').value = rule.name || '';

    // Populate profile select
    const profileSelect = document.getElementById('fireRuleProfile');
    profileSelect.innerHTML = '<option value="الجميع">الجميع (ينطبق على كافة المقاطع)</option>';
    if (typeof dbProfileOptions !== 'undefined') {
        dbProfileOptions.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.name;
            opt.textContent = p.name;
            if (p.name === rule.profile_type) opt.selected = true;
            profileSelect.appendChild(opt);
        });
    }
    if (!rule.profile_type || rule.profile_type === 'الجميع') {
        profileSelect.value = 'الجميع';
    }

    // Populate door type select
    const doorTypeSelect = document.getElementById('fireRuleDoorType');
    doorTypeSelect.innerHTML = '<option value="الجميع">الجميع (ينطبق على كافة أنواع الدرفات)</option>';
    if (typeof dbDoorTypeOptions !== 'undefined') {
        dbDoorTypeOptions.forEach(dt => {
            const opt = document.createElement('option');
            opt.value = dt.name;
            opt.textContent = dt.name;
            if (dt.name === rule.door_type) opt.selected = true;
            doorTypeSelect.appendChild(opt);
        });
    }
    if (!rule.door_type || rule.door_type === 'الجميع') {
        doorTypeSelect.value = 'الجميع';
    }

    // Fill numeric fields
    document.getElementById('fireRuleMinHeight').value = rule.min_height !== null && rule.min_height !== undefined ? rule.min_height : '';
    document.getElementById('fireRuleMaxHeight').value = rule.max_height !== null && rule.max_height !== undefined ? rule.max_height : '';
    document.getElementById('fireRuleMinWidth').value = rule.min_width !== null && rule.min_width !== undefined ? rule.min_width : '';
    document.getElementById('fireRuleMaxWidth').value = rule.max_width !== null && rule.max_width !== undefined ? rule.max_width : '';
    document.getElementById('fireRuleMinDepth').value = rule.min_depth !== null && rule.min_depth !== undefined ? rule.min_depth : '';
    document.getElementById('fireRuleMaxDepth').value = rule.max_depth !== null && rule.max_depth !== undefined ? rule.max_depth : '';
    document.getElementById('fireRuleMinLeafThickness').value = rule.min_leaf_thickness !== null && rule.min_leaf_thickness !== undefined ? rule.min_leaf_thickness : '';
    document.getElementById('fireRuleMaxLeafThickness').value = rule.max_leaf_thickness !== null && rule.max_leaf_thickness !== undefined ? rule.max_leaf_thickness : '';
    document.getElementById('fireRuleMinArchitrave').value = rule.min_architrave !== null && rule.min_architrave !== undefined ? rule.min_architrave : '';
    document.getElementById('fireRuleMaxArchitrave').value = rule.max_architrave !== null && rule.max_architrave !== undefined ? rule.max_architrave : '';
    document.getElementById('fireRuleMinArchitrave2').value = rule.min_architrave_2 !== null && rule.min_architrave_2 !== undefined ? rule.min_architrave_2 : '';
    document.getElementById('fireRuleMaxArchitrave2').value = rule.max_architrave_2 !== null && rule.max_architrave_2 !== undefined ? rule.max_architrave_2 : '';

    document.getElementById('fireDoorRuleModal').classList.remove('hidden');
};

window.closeFireRuleModal = function() {
    document.getElementById('fireDoorRuleModal').classList.add('hidden');
};

window.handleFireRuleFormSubmit = async function(e) {
    e.preventDefault();
    const id = document.getElementById('fireRuleId').value;
    const parseOrNull = (val) => {
        const f = parseFloat(val);
        return isNaN(f) ? null : f;
    };

    const payload = {
        name: document.getElementById('fireRuleName').value.trim() || null,
        profile_type: document.getElementById('fireRuleProfile').value,
        door_type: document.getElementById('fireRuleDoorType').value,
        min_height: parseOrNull(document.getElementById('fireRuleMinHeight').value),
        max_height: parseOrNull(document.getElementById('fireRuleMaxHeight').value),
        min_width: parseOrNull(document.getElementById('fireRuleMinWidth').value),
        max_width: parseOrNull(document.getElementById('fireRuleMaxWidth').value),
        min_depth: parseOrNull(document.getElementById('fireRuleMinDepth').value),
        max_depth: parseOrNull(document.getElementById('fireRuleMaxDepth').value),
        min_leaf_thickness: parseOrNull(document.getElementById('fireRuleMinLeafThickness').value),
        max_leaf_thickness: parseOrNull(document.getElementById('fireRuleMaxLeafThickness').value),
        min_architrave: parseOrNull(document.getElementById('fireRuleMinArchitrave').value),
        max_architrave: parseOrNull(document.getElementById('fireRuleMaxArchitrave').value),
        min_architrave_2: parseOrNull(document.getElementById('fireRuleMinArchitrave2').value),
        max_architrave_2: parseOrNull(document.getElementById('fireRuleMaxArchitrave2').value)
    };

    let url = `${API_HOST}/api/fire-door-rules/`;
    let method = 'POST';
    if (id) {
        url = `${API_HOST}/api/fire-door-rules/${id}`;
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
            showToast('تم حفظ المواصفة بنجاح', 'bg-emerald-500', '✓');
            closeFireRuleModal();
            await loadFireDoorRules();
            renderFireDoorRulesAdmin();
        } else {
            const data = await response.json();
            showToast(data.detail || 'حدث خطأ أثناء الحفظ', 'bg-rose-500', '✗');
        }
    } catch (err) {
        console.error(err);
        showToast('حدث خطأ أثناء حفظ المواصفة', 'bg-rose-500', '✗');
    }
};

window.deleteFireRule = async function(id) {
    if (!confirm('هل أنت متأكد من رغبتك في حذف هذا الصف من مواصفات أبواب الحريق؟')) return;

    try {
        showToast('جار الحذف...', 'bg-blue-500', 'ℹ');
        const response = await authFetch(`${API_HOST}/api/fire-door-rules/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showToast('تم حذف المواصفة بنجاح', 'bg-emerald-500', '✓');
            await loadFireDoorRules();
            renderFireDoorRulesAdmin();
        } else {
            const data = await response.json();
            showToast(data.detail || 'حدث خطأ أثناء الحذف', 'bg-rose-500', '✗');
        }
    } catch (err) {
        console.error(err);
        showToast('حدث خطأ أثناء الحذف', 'bg-rose-500', '✗');
    }
};

// ------------- AUTOMATIC ARCHITRAVE 2 CALCULATION -------------

window.autoCalculateArchitrave2 = function(input) {
    const tr = input.closest('tr');
    if (!tr) return;
    const architrave2Input = tr.querySelector('input[placeholder="الكشفة 2"]') || tr.querySelector('.pd-architrave-2-input') || tr.querySelectorAll('input')[7];
    if (!architrave2Input) return;
    const val = parseFloat(input.value);
    if (!isNaN(val)) {
        architrave2Input.value = (val + 2.2).toFixed(1);
    } else {
        architrave2Input.value = '';
    }
};

window.autoCalculateLeafSizes = function(element) {
    const tr = element.closest('tr');
    if (!tr) return;

    // Robust input discovery
    const widthInput = tr.querySelector('input[placeholder="عرض"]') || tr.querySelector('.pd-width-input') || tr.querySelectorAll('input')[2];
    const architraveInput = tr.querySelector('input[placeholder="الكشفة"]') || tr.querySelector('.pd-architrave-input') || Array.from(tr.querySelectorAll('input')).find(i => (i.placeholder || '').includes('الكشفة') && !(i.placeholder || '').includes('2'));
    
    const selects = Array.from(tr.querySelectorAll('select'));
    const doorTypeSelect = tr.querySelector('.pd-doortype-select') || selects.find(s => {
        const val = (s.value || '').toLowerCase();
        const html = (s.innerHTML || '').toLowerCase();
        return val.includes('leaf') || html.includes('single leaf') || html.includes('double leaf');
    }) || selects[5];

    const leafSize1Input = tr.querySelector('input[placeholder="قياس الدرفة"]') || tr.querySelector('.pd-leaf1-input');
    const leafSize2Input = tr.querySelector('input[placeholder="قياس الدرفة 2"]') || tr.querySelector('.pd-leaf2-input');

    if (!leafSize1Input || !leafSize2Input) return;

    const width = parseFloat(widthInput ? widthInput.value : '');
    const architrave = parseFloat(architraveInput ? architraveInput.value : '0') || 0;
    const doorType = (doorTypeSelect ? (doorTypeSelect.value || '') : '').toLowerCase();

    // Check if double leaf (supports "double", "double leaf metal", "double leaf wood", "دبل")
    const isDouble = doorType.includes('double') || doorType.includes('دبل');

    if (isDouble) {
        leafSize1Input.removeAttribute('readonly');
        leafSize1Input.classList.remove('bg-slate-100');

        if (!isNaN(width) && width > 0) {
            const leaf1Val = (width - (2 * architrave) - 1.5) / 2;
            leafSize1Input.value = leaf1Val.toFixed(2);
            
            const leaf2Val = (width - (2 * architrave) - 1.5) - leaf1Val;
            leafSize2Input.value = leaf2Val.toFixed(2);
        } else {
            leafSize1Input.value = '';
            leafSize2Input.value = '';
        }
    } else {
        leafSize1Input.setAttribute('readonly', 'readonly');
        leafSize1Input.classList.add('bg-slate-100');
        leafSize2Input.value = '';

        if (!isNaN(width) && width > 0) {
            const leaf1Val = width - (2 * architrave) - 0.7;
            leafSize1Input.value = leaf1Val.toFixed(2);
        } else {
            leafSize1Input.value = '';
        }
    }
};

window.onLeafSize1Input = function(leaf1Input) {
    const tr = leaf1Input.closest('tr');
    if (!tr) return;

    const widthInput = tr.querySelector('input[placeholder="عرض"]') || tr.querySelector('.pd-width-input') || tr.querySelectorAll('input')[2];
    const architraveInput = tr.querySelector('input[placeholder="الكشفة"]') || tr.querySelector('.pd-architrave-input') || Array.from(tr.querySelectorAll('input')).find(i => (i.placeholder || '').includes('الكشفة') && !(i.placeholder || '').includes('2'));
    
    const selects = Array.from(tr.querySelectorAll('select'));
    const doorTypeSelect = tr.querySelector('.pd-doortype-select') || selects.find(s => {
        const val = (s.value || '').toLowerCase();
        const html = (s.innerHTML || '').toLowerCase();
        return val.includes('leaf') || html.includes('single leaf') || html.includes('double leaf');
    }) || selects[5];

    const leafSize2Input = tr.querySelector('input[placeholder="قياس الدرفة 2"]') || tr.querySelector('.pd-leaf2-input');

    if (!leafSize2Input) return;

    const doorType = (doorTypeSelect ? (doorTypeSelect.value || '') : '').toLowerCase();
    const isDouble = doorType.includes('double') || doorType.includes('دبل');

    if (!isDouble) return;

    const width = parseFloat(widthInput ? widthInput.value : '');
    const architrave = parseFloat(architraveInput ? architraveInput.value : '0') || 0;
    const leaf1Val = parseFloat(leaf1Input.value);

    if (!isNaN(width) && !isNaN(leaf1Val)) {
        const leaf2Val = (width - (2 * architrave) - 1.5) - leaf1Val;
        leafSize2Input.value = leaf2Val.toFixed(2);
    } else {
        leafSize2Input.value = '';
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
        window.allActiveTrackingProjects = activeProjects;
        
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
                let isDisabled = false;
                let extraTitle = '';
                let statusSubText = '';
                if (stepKey === 'step_installation') {
                    const isApproved = (p.delivery_approval || 'stopped').toLowerCase() === 'approved';
                    if (!isApproved) {
                        isDisabled = true;
                        extraTitle = 'title="التسليم موقوف من قبل الإدارة، لا يمكن تعديل هذه الخطوة"';
                        statusSubText = '<span class="text-[10px] text-rose-500 font-bold block mt-0.5">⚠️ التسليم موقوف</span>';
                    } else {
                        statusSubText = '<span class="text-[10px] text-emerald-600 font-bold block mt-0.5">✓ تمت الموافقة</span>';
                    }
                }
                stepsCells += `
                    <td class="p-3 text-center min-w-[140px]">
                        <select ${isDisabled ? 'disabled' : ''} ${extraTitle} onchange="updateTrackingStep('${stepKey}', this, ${p.id})" class="w-full border rounded-lg px-2 py-1.5 text-xs font-bold focus:outline-none focus:ring-2 transition-colors ${isDisabled ? 'bg-slate-200 text-slate-400 border-slate-300 cursor-not-allowed opacity-75' : getStepColorClasses(currentValue)}">
                            <option value="لم يتم البدء" ${currentValue === 'لم يتم البدء' ? 'selected' : ''}>لم يتم البدء</option>
                            <option value="جاري العمل" ${currentValue === 'جاري العمل' ? 'selected' : ''}>جاري العمل</option>
                            <option value="تم الانتهاء" ${currentValue === 'تم الانتهاء' ? 'selected' : ''}>تم الانتهاء</option>
                        </select>
                        ${statusSubText}
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
let fireDoorsEditMode = false;
let fireDoorsLockMode = false;
let fireDoorsShowSpecs = false;

window.openFireDoorsModal = async function() {
    const modal = document.getElementById('fireDoorsModal');
    const tbody = document.getElementById('fireDoorsTableBody');
    const emptyEl = document.getElementById('fireDoorsEmpty');
    const loadingEl = document.getElementById('fireDoorsLoading');
    
    // Reset states
    fireDoorsEditMode = false;
    fireDoorsLockMode = false;
    updateFireDoorsEditToolbarState();
    updateFireDoorsLockToolbarState();
    
    const specsChk = document.getElementById('chkFireDoorSpecs');
    if (specsChk) fireDoorsShowSpecs = specsChk.checked;
    
    tbody.innerHTML = '';
    emptyEl.classList.add('hidden');
    loadingEl.classList.remove('hidden');
    
    modal.classList.remove('hidden');
    void modal.offsetWidth;
    modal.classList.remove('opacity-0');
    modal.querySelector('.transform').classList.remove('scale-95');
    
    await loadFireDoorsData();
};

window.loadFireDoorsData = async function() {
    const tbody = document.getElementById('fireDoorsTableBody');
    const emptyEl = document.getElementById('fireDoorsEmpty');
    const loadingEl = document.getElementById('fireDoorsLoading');
    const countBadge = document.getElementById('fireDoorsCountBadge');

    try {
        const response = await authFetch(`${API_HOST}/api/fire-doors/`);
        if (!response.ok) throw new Error('فشل تحميل أبواب الحريق');
        
        globalFireDoors = await response.json();
        loadingEl.classList.add('hidden');
        
        if (countBadge) countBadge.textContent = `${globalFireDoors.length} باب`;
        
        if (globalFireDoors.length === 0) {
            emptyEl.classList.remove('hidden');
            tbody.innerHTML = '';
            return;
        }
        emptyEl.classList.add('hidden');
        renderFireDoorsTable();
        
    } catch (e) {
        showToast(e.message, 'bg-rose-500', '✗');
        loadingEl.classList.add('hidden');
        tbody.innerHTML = `<tr><td colspan="16" class="p-8 text-center text-rose-500 font-bold">${e.message}</td></tr>`;
    }
};

window.renderFireDoorsTable = function() {
    const tbody = document.getElementById('fireDoorsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const isAdmin = window.currentUser && window.currentUser.username === 'admin';

    // Apply column visibilities to headers
    toggleFireDoorSpecsColumns(fireDoorsShowSpecs, false);

    globalFireDoors.forEach((d, globalIdx) => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50 transition border-b border-slate-100 text-xs sm:text-sm';
        tr.dataset.id = d.id;
        tr.dataset.index = d.index;
        tr.dataset.globalIdx = globalIdx;

        // Is this door locked? If locked and not admin, sticker is read-only
        const isLocked = d.is_locked;
        const canEditSticker = fireDoorsEditMode && (isAdmin || !isLocked);
        const canEditFinalDelivery = fireDoorsEditMode;

        // Sticker cell
        let stickerHtml = '';
        if (fireDoorsEditMode) {
            if (canEditSticker) {
                stickerHtml = `
                    <div class="space-y-0.5 inline-block w-full max-w-[120px]">
                        <input type="text" 
                               value="${escapeHtml(d.sticker_number || '')}" 
                               oninput="handleStickerInput(this, ${globalIdx})" 
                               class="fd-sticker-input w-full px-2 py-1 text-center border border-slate-300 rounded-lg text-xs font-mono font-bold focus:ring-2 focus:ring-rose-500 outline-none transition" 
                               placeholder="الملصق" />
                        <div class="fd-sticker-error text-[10px] text-rose-600 font-bold hidden flex items-center justify-center gap-1">
                            <span>⚠️</span> <span>الرقم مستخدم</span>
                        </div>
                    </div>
                `;
            } else {
                stickerHtml = `
                    <div class="flex items-center justify-center gap-1 whitespace-nowrap">
                        <span class="font-mono font-bold text-slate-700">${escapeHtml(d.sticker_number || '-')}</span>
                        <span class="text-[10px] bg-slate-100 text-slate-500 px-1 py-0.5 rounded border border-slate-200" title="مقفل نهائياً">🔒</span>
                    </div>
                `;
            }
        } else {
            stickerHtml = `
                <div class="flex items-center justify-center gap-1.5 whitespace-nowrap">
                    <span class="font-mono font-bold text-slate-800">${escapeHtml(d.sticker_number || '-')}</span>
                    ${d.is_locked ? '<span class="text-xs text-indigo-600" title="حفظ نهائي (مقفل)">🔒</span>' : ''}
                </div>
            `;
        }

        // Final delivery cell (automatically set upon final lock, read-only)
        const finalDeliveryHtml = d.final_delivery_date ? 
            `<span class="font-medium text-slate-700 whitespace-nowrap">${escapeHtml(d.final_delivery_date)}</span>` : 
            '<span class="text-slate-400 text-xs">-</span>';

        // Installation date cell
        const installationHtml = d.installation_date ? 
            `<span class="px-2 py-0.5 rounded-md font-semibold text-center whitespace-nowrap inline-block ${d.installation_date === 'منتهي' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-700'}">${escapeHtml(d.installation_date)}</span>` : 
            '<span class="text-slate-400 text-xs">-</span>';

        // Checkbox cell
        let checkboxCellHtml = '';
        const isProjectCompleted = d.project_status && d.project_status.toLowerCase() === 'completed';
        if (fireDoorsLockMode) {
            if (isLocked) {
                checkboxCellHtml = `
                    <td class="p-2.5 text-center fd-col-checkbox">
                        <span class="text-xs text-indigo-500 font-bold" title="مقفل بالفعل">🔒</span>
                    </td>
                `;
            } else if (!isProjectCompleted) {
                checkboxCellHtml = `
                    <td class="p-2.5 text-center fd-col-checkbox">
                        <span class="text-[10px] bg-amber-50 text-amber-600 px-1 py-0.5 rounded border border-amber-200 cursor-not-allowed" title="لا يمكن الحفظ النهائي إلا بعد أن يصبح المشروع منتهياً">المشروع غير منتهي</span>
                    </td>
                `;
            } else {
                checkboxCellHtml = `
                    <td class="p-2.5 text-center fd-col-checkbox">
                        <input type="checkbox" class="fd-row-checkbox rounded text-indigo-600 focus:ring-0 cursor-pointer" onclick="handleFireDoorCheckboxClick(event, this)" data-id="${d.id}" data-index="${d.index}" />
                    </td>
                `;
            }
        } else {
            if (isLocked && !isAdmin) {
                checkboxCellHtml = `
                    <td class="p-2.5 text-center fd-col-checkbox ${fireDoorsEditMode ? '' : 'hidden'}">
                        <span class="text-xs text-slate-400" title="مقفل نهائياً - لا يمكن حذفه أو تعديله">🔒</span>
                    </td>
                `;
            } else {
                checkboxCellHtml = `
                    <td class="p-2.5 text-center fd-col-checkbox ${fireDoorsEditMode ? '' : 'hidden'}">
                        <input type="checkbox" class="fd-row-checkbox rounded text-rose-600 focus:ring-0 cursor-pointer" onclick="handleFireDoorCheckboxClick(event, this)" data-id="${d.id}" data-index="${d.index}" />
                    </td>
                `;
            }
        }

        // Row actions (delete button in edit mode)
        let actionsHtml = '';
        if (isLocked && !isAdmin) {
            actionsHtml = `
                <td class="p-2.5 text-center fd-col-actions ${fireDoorsEditMode ? '' : 'hidden'}">
                    <span class="text-slate-400 text-xs" title="مقفل نهائياً">🔒</span>
                </td>
            `;
        } else {
            actionsHtml = `
                <td class="p-2.5 text-center fd-col-actions ${fireDoorsEditMode ? '' : 'hidden'}">
                    <button type="button" onclick="deleteSingleFireDoor(${d.id}, ${d.index})" class="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1.5 rounded-lg transition" title="حذف هذا الباب">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </td>
            `;
        }

        tr.innerHTML = `
            ${checkboxCellHtml}
            <td class="p-2.5 font-bold text-slate-800 whitespace-nowrap">${escapeHtml(d.project_name)}</td>
            <td class="p-2.5 font-bold text-slate-500 whitespace-nowrap">${escapeHtml(d.project_number)}</td>
            <td class="p-2.5 text-slate-700 font-medium whitespace-nowrap">${escapeHtml(d.door_number)}</td>
            <td class="p-2.5 text-center">${stickerHtml}</td>
            <td class="p-2.5 text-center">${installationHtml}</td>
            <td class="p-2.5 text-center">${finalDeliveryHtml}</td>
            
            <!-- Optional Specs Columns -->
            <td class="p-2.5 text-slate-600 fd-col-spec whitespace-nowrap ${fireDoorsShowSpecs ? '' : 'hidden'}">${escapeHtml(d.height)}</td>
            <td class="p-2.5 text-slate-600 fd-col-spec whitespace-nowrap ${fireDoorsShowSpecs ? '' : 'hidden'}">${escapeHtml(d.width)}</td>
            <td class="p-2.5 text-slate-600 fd-col-spec whitespace-nowrap ${fireDoorsShowSpecs ? '' : 'hidden'}">${escapeHtml(d.depth)}</td>
            <td class="p-2.5 text-slate-600 fd-col-spec whitespace-nowrap ${fireDoorsShowSpecs ? '' : 'hidden'}">${escapeHtml(d.door_type)}</td>
            <td class="p-2.5 text-slate-600 fd-col-spec whitespace-nowrap ${fireDoorsShowSpecs ? '' : 'hidden'}">${escapeHtml(d.profile_type)}</td>
            <td class="p-2.5 text-slate-600 fd-col-spec whitespace-nowrap ${fireDoorsShowSpecs ? '' : 'hidden'}">${escapeHtml(d.lock_type)}</td>
            <td class="p-2.5 text-slate-600 fd-col-spec whitespace-nowrap ${fireDoorsShowSpecs ? '' : 'hidden'}">${escapeHtml(d.hinges)}</td>
            <td class="p-2.5 text-slate-600 fd-col-spec whitespace-nowrap ${fireDoorsShowSpecs ? '' : 'hidden'}">${escapeHtml(d.window)}</td>
            
            ${actionsHtml}
        `;
        tbody.appendChild(tr);
    });

    if (fireDoorsEditMode) {
        validateAllStickers();
    }
    updateSelectedCount();
};

window.toggleFireDoorEditMode = function() {
    if (fireDoorsLockMode) {
        fireDoorsLockMode = false;
        updateFireDoorsLockToolbarState();
    }
    fireDoorsEditMode = !fireDoorsEditMode;
    updateFireDoorsEditToolbarState();
    renderFireDoorsTable();
};

window.toggleFireDoorsLockMode = function() {
    if (fireDoorsEditMode) {
        fireDoorsEditMode = false;
        updateFireDoorsEditToolbarState();
    }
    fireDoorsLockMode = !fireDoorsLockMode;
    updateFireDoorsLockToolbarState();
    renderFireDoorsTable();
};

function updateFireDoorsLockToolbarState() {
    const toolbar = document.getElementById('fireDoorsLockToolbar');
    const btnText = document.getElementById('btnFinalLockFireDoorsText');
    const btn = document.getElementById('btnFinalLockFireDoors');
    const chkSelectAll = document.getElementById('chkSelectAllFireDoors');

    if (chkSelectAll) chkSelectAll.checked = false;

    if (fireDoorsLockMode) {
        if (toolbar) toolbar.classList.remove('hidden');
        if (btnText) btnText.textContent = 'إلغاء التحديد';
        if (btn) btn.className = 'bg-slate-600 hover:bg-slate-700 text-white font-bold py-1.5 px-3.5 rounded-xl transition text-xs shadow flex items-center gap-1';
    } else {
        if (toolbar) toolbar.classList.add('hidden');
        if (btnText) btnText.textContent = 'حفظ نهائي';
        if (btn) btn.className = 'bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1.5 px-3.5 rounded-xl transition text-xs shadow flex items-center gap-1';
    }

    // Toggle column headers
    document.querySelectorAll('.fd-col-checkbox').forEach(el => {
        if (fireDoorsLockMode || fireDoorsEditMode) el.classList.remove('hidden');
        else el.classList.add('hidden');
    });

    updateSelectedCount();
}

function updateFireDoorsEditToolbarState() {
    const toolbar = document.getElementById('fireDoorsEditToolbar');
    const btnText = document.getElementById('btnToggleFireDoorEditText');
    const btn = document.getElementById('btnToggleFireDoorEdit');
    const chkSelectAll = document.getElementById('chkSelectAllFireDoors');

    if (chkSelectAll) chkSelectAll.checked = false;

    if (fireDoorsEditMode) {
        if (toolbar) toolbar.classList.remove('hidden');
        if (btnText) btnText.textContent = 'إلغاء التعديل';
        if (btn) btn.className = 'bg-slate-600 hover:bg-slate-700 text-white font-bold py-1.5 px-3.5 rounded-xl transition text-xs shadow flex items-center gap-1';
    } else {
        if (toolbar) toolbar.classList.add('hidden');
        if (btnText) btnText.textContent = 'تعديل';
        if (btn) btn.className = 'bg-amber-500 hover:bg-amber-600 text-white font-bold py-1.5 px-3.5 rounded-xl transition text-xs shadow flex items-center gap-1';
    }

    // Toggle column headers
    document.querySelectorAll('.fd-col-checkbox').forEach(el => {
        if (fireDoorsLockMode || fireDoorsEditMode) el.classList.remove('hidden');
        else el.classList.add('hidden');
    });
    document.querySelectorAll('.fd-col-actions').forEach(el => {
        if (fireDoorsEditMode) el.classList.remove('hidden');
        else el.classList.add('hidden');
    });

    updateSelectedCount();
}

window.toggleFireDoorSpecsColumns = function(show, reRender = true) {
    fireDoorsShowSpecs = show;
    document.querySelectorAll('.fd-col-spec').forEach(el => {
        if (show) el.classList.remove('hidden');
        else el.classList.add('hidden');
    });
};

// --- Duplicate Sticker Checking ---
window.handleStickerInput = function(inputEl, globalIdx) {
    validateAllStickers();
};

function validateAllStickers() {
    const rows = document.querySelectorAll('#fireDoorsTableBody tr');
    const values = [];

    // Collect values from all active inputs
    rows.forEach(r => {
        const input = r.querySelector('.fd-sticker-input');
        const val = input ? input.value.trim() : '';
        values.push({
            row: r,
            input: input,
            val: val,
            errorEl: r.querySelector('.fd-sticker-error')
        });
    });

    // Count occurrences of non-empty values
    const counts = {};
    values.forEach(v => {
        if (v.val) {
            counts[v.val] = (counts[v.val] || 0) + 1;
        }
    });

    // Highlight duplicates
    let hasDuplicates = false;
    values.forEach(v => {
        if (v.input && v.val && counts[v.val] > 1) {
            hasDuplicates = true;
            v.input.classList.add('border-rose-500', 'bg-rose-50', 'text-rose-900');
            v.input.classList.remove('border-slate-300');
            if (v.errorEl) v.errorEl.classList.remove('hidden');
        } else if (v.input) {
            v.input.classList.remove('border-rose-500', 'bg-rose-50', 'text-rose-900');
            v.input.classList.add('border-slate-300');
            if (v.errorEl) v.errorEl.classList.add('hidden');
        }
    });

    return hasDuplicates;
}

// --- Batch Selection & Deletion with Shift-Click Support ---
let lastFireDoorCheckedCheckbox = null;

window.handleFireDoorCheckboxClick = function(event, currentCheckbox) {
    const checkboxes = Array.from(document.querySelectorAll('#fireDoorsTableBody .fd-row-checkbox'));
    
    if (event && event.shiftKey && lastFireDoorCheckedCheckbox && lastFireDoorCheckedCheckbox !== currentCheckbox) {
        const start = checkboxes.indexOf(lastFireDoorCheckedCheckbox);
        const end = checkboxes.indexOf(currentCheckbox);
        
        if (start !== -1 && end !== -1) {
            const [lower, upper] = start < end ? [start, end] : [end, start];
            const targetState = currentCheckbox.checked;
            for (let i = lower; i <= upper; i++) {
                checkboxes[i].checked = targetState;
            }
        }
    }
    
    lastFireDoorCheckedCheckbox = currentCheckbox;
    updateSelectedCount();
};

window.toggleSelectAllFireDoors = function(checked) {
    const checkboxes = document.querySelectorAll('#fireDoorsTableBody .fd-row-checkbox');
    checkboxes.forEach(cb => cb.checked = checked);
    lastFireDoorCheckedCheckbox = null;
    updateSelectedCount();
};

window.updateSelectedCount = function() {
    const checked = document.querySelectorAll('#fireDoorsTableBody .fd-row-checkbox:checked');
    const countEl = document.getElementById('fireDoorsSelectedCount');
    const deleteBtn = document.getElementById('btnDeleteSelectedFireDoors');
    
    if (countEl) countEl.textContent = `(تم تحديد ${checked.length})`;
    if (deleteBtn) {
        deleteBtn.disabled = checked.length === 0;
    }

    const lockCountEl = document.getElementById('fireDoorsLockSelectedCount');
    const confirmLockBtn = document.getElementById('btnConfirmLockSelection');
    if (lockCountEl) lockCountEl.textContent = `(تم تحديد ${checked.length})`;
    if (confirmLockBtn) {
        confirmLockBtn.disabled = checked.length === 0;
    }
};

window.deleteSelectedFireDoors = async function() {
    const checked = document.querySelectorAll('#fireDoorsTableBody .fd-row-checkbox:checked');
    if (checked.length === 0) return;

    if (!confirm(`هل أنت متأكد من حذف ${checked.length} باب من جدول أبواب الحريق؟`)) {
        return;
    }

    const items = [];
    checked.forEach(cb => {
        items.push({
            id: parseInt(cb.dataset.id),
            index: parseInt(cb.dataset.index)
        });
    });

    try {
        const response = await authFetch(`${API_HOST}/api/fire-doors/batch-delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: items })
        });
        if (!response.ok) throw new Error('فشل حذف الأبواب المحددة');
        
        showToast('تم حذف الأبواب بنجاح', 'bg-emerald-500', '✓');
        await loadFireDoorsData();
    } catch (e) {
        showToast(e.message, 'bg-rose-500', '✗');
    }
};

window.deleteSingleFireDoor = async function(id, index) {
    if (!confirm('هل أنت متأكد من حذف هذا الباب من جدول أبواب الحريق؟')) {
        return;
    }
    try {
        const response = await authFetch(`${API_HOST}/api/fire-doors/batch-delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: [{ id: id, index: index }] })
        });
        if (!response.ok) throw new Error('فشل حذف الباب');
        
        showToast('تم حذف الباب بنجاح', 'bg-emerald-500', '✓');
        await loadFireDoorsData();
    } catch (e) {
        showToast(e.message, 'bg-rose-500', '✗');
    }
};

// --- Save Bulk Edits ---
window.saveFireDoorsBulkEdits = async function() {
    // Check duplicates first
    const hasDuplicates = validateAllStickers();
    if (hasDuplicates) {
        showToast('يوجد أرقام ملصقات مكررة في الجدول! يرجى تعديلها قبل الحفظ.', 'bg-rose-500', '⚠️');
        return;
    }

    const rows = document.querySelectorAll('#fireDoorsTableBody tr');
    const updates = [];

    rows.forEach(r => {
        const id = parseInt(r.dataset.id);
        const index = parseInt(r.dataset.index);
        const stickerInput = r.querySelector('.fd-sticker-input');

        const stickerVal = stickerInput ? stickerInput.value.trim() : null;

        if (id && !isNaN(index)) {
            updates.push({
                id: id,
                index: index,
                sticker_number: stickerVal !== null ? stickerVal : ''
            });
        }
    });

    try {
        const response = await authFetch(`${API_HOST}/api/fire-doors/bulk-save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ updates: updates })
        });
        if (!response.ok) throw new Error('فشل حفظ التعديلات');

        showToast('تم حفظ التعديلات بنجاح', 'bg-emerald-500', '✓');
        fireDoorsEditMode = false;
        updateFireDoorsEditToolbarState();
        await loadFireDoorsData();
    } catch (e) {
        showToast(e.message, 'bg-rose-500', '✗');
    }
};

// --- Final Lock Modal Logic ---
window.openFinalLockModal = function() {
    const checked = document.querySelectorAll('#fireDoorsTableBody .fd-row-checkbox:checked');
    if (checked.length === 0) {
        showToast('يرجى تحديد باب واحد على الأقل للحفظ النهائي', 'bg-amber-500', '⚠️');
        return;
    }

    const modal = document.getElementById('fireDoorsFinalLockModal');
    const countText = document.getElementById('finalLockDoorsCountText');
    if (countText) countText.textContent = `${checked.length} باب`;

    if (!modal) return;
    modal.classList.remove('hidden');
    void modal.offsetWidth;
    modal.classList.remove('opacity-0');
    modal.querySelector('.transform').classList.remove('scale-95');
};

window.closeFinalLockModal = function() {
    const modal = document.getElementById('fireDoorsFinalLockModal');
    if (!modal) return;
    modal.classList.add('opacity-0');
    modal.querySelector('.transform').classList.add('scale-95');
    setTimeout(() => { modal.classList.add('hidden'); }, 250);
};

window.confirmFinalLockFireDoors = async function() {
    const checked = document.querySelectorAll('#fireDoorsTableBody .fd-row-checkbox:checked');
    const ids = Array.from(new Set(Array.from(checked).map(cb => parseInt(cb.dataset.id)).filter(id => !isNaN(id))));

    if (ids.length === 0) {
        showToast('لم يتم تحديد أي أبواب للحفظ النهائي', 'bg-amber-500', '⚠️');
        return;
    }

    try {
        const response = await authFetch(`${API_HOST}/api/fire-doors/final-lock`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: ids })
        });
        if (!response.ok) throw new Error('فشل الحفظ النهائي للأبواب المحددة');

        closeFinalLockModal();
        showToast('تم الحفظ النهائي للأبواب المحددة بنجاح. أرقام الملصقات مقفلة الآن.', 'bg-indigo-600', '🔒');
        fireDoorsLockMode = false;
        updateFireDoorsLockToolbarState();
        await loadFireDoorsData();
    } catch (e) {
        showToast(e.message, 'bg-rose-500', '✗');
    }
};

// --- Add Fire Door Modal Logic ---
window.openAddFireDoorModal = async function() {
    const modal = document.getElementById('fireDoorAddModal');
    const select = document.getElementById('addFdProjectId');
    if (!modal) return;

    // Load active projects for selection
    if (select) {
        select.innerHTML = '<option value="">جاري تحميل المشاريع...</option>';
        try {
            const res = await authFetch(`${PROJECTS_URL}/`);
            if (res.ok) {
                const projects = await res.json();
                const activeProjects = projects.filter(p => p.status && p.status.toLowerCase() === 'active');
                if (activeProjects.length === 0) {
                    select.innerHTML = '<option value="">لا توجد مشاريع فعالة متاحة</option>';
                } else {
                    select.innerHTML = activeProjects.map(p => 
                        `<option value="${p.id}">${escapeHtml(p.name)} (${escapeHtml(p.project_number)})</option>`
                    ).join('');
                }
            }
        } catch (e) {
            select.innerHTML = '<option value="">تعذر جلب المشاريع</option>';
        }
    }

    modal.classList.remove('hidden');
    void modal.offsetWidth;
    modal.classList.remove('opacity-0');
    modal.querySelector('.transform').classList.remove('scale-95');
};

window.closeAddFireDoorModal = function() {
    const modal = document.getElementById('fireDoorAddModal');
    if (!modal) return;
    modal.classList.add('opacity-0');
    modal.querySelector('.transform').classList.add('scale-95');
    setTimeout(() => { modal.classList.add('hidden'); }, 250);
};

window.submitAddFireDoor = async function(event) {
    event.preventDefault();
    const projectId = parseInt(document.getElementById('addFdProjectId').value);
    const doorNumber = document.getElementById('addFdDoorNumber').value.trim();
    const stickerNumber = document.getElementById('addFdStickerNumber').value.trim() || null;
    const height = document.getElementById('addFdHeight').value.trim() || null;
    const width = document.getElementById('addFdWidth').value.trim() || null;
    const depth = document.getElementById('addFdDepth').value.trim() || null;
    const doorType = document.getElementById('addFdDoorType').value.trim() || null;
    const profileType = document.getElementById('addFdProfileType').value.trim() || null;
    const lockType = document.getElementById('addFdLockType').value.trim() || null;
    const hinges = document.getElementById('addFdHinges').value.trim() || null;
    const windowDetails = document.getElementById('addFdWindow').value.trim() || null;
    const finalDeliveryDate = document.getElementById('addFdFinalDeliveryDate').value.trim() || null;

    if (!projectId || !doorNumber) {
        showToast('يرجى اختيار المشروع وإدخال رقم الباب', 'bg-amber-500', '⚠️');
        return;
    }

    try {
        const response = await authFetch(`${API_HOST}/api/fire-doors/add-door`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                project_id: projectId,
                door_number: doorNumber,
                sticker_number: stickerNumber,
                height: height,
                width: width,
                depth: depth,
                door_type: doorType,
                profile_type: profileType,
                lock_type: lockType,
                hinges: hinges,
                window_details: windowDetails,
                final_delivery_date: finalDeliveryDate
            })
        });

        if (!response.ok) throw new Error('فشل إضافة باب الحريق');

        showToast('تمت إضافة باب الحريق بنجاح', 'bg-emerald-500', '✓');
        closeAddFireDoorModal();
        await loadFireDoorsData();
    } catch (e) {
        showToast(e.message, 'bg-rose-500', '✗');
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

// --- Export to Excel (All Columns Always) ---
window.exportFireDoorsToExcel = function() {
    if (globalFireDoors.length === 0) {
        showToast('لا يوجد بيانات لتصديرها', 'bg-amber-500', '⚠');
        return;
    }
    
    // Create CSV content representing Excel sheet with UTF-8 BOM
    let csvContent = "\ufeff";
    const headers = [
        "اسم المشروع",
        "رقم المشروع",
        "رقم الباب",
        "رقم الملصق",
        "تاريخ التركيب",
        "تاريخ الاستلام النهائي",
        "طول الباب",
        "عرض الباب",
        "عمق الباب",
        "نوع الدرفة",
        "نوع المقطع",
        "الزرفيل",
        "الفصالة",
        "الشباك"
    ];
    csvContent += headers.join(",") + "\n";
    
    globalFireDoors.forEach(d => {
        const row = [
            `"${(d.project_name || '').replace(/"/g, '""')}"`,
            `"${String(d.project_number || '').replace(/"/g, '""')}"`,
            `"${(d.door_number || '').replace(/"/g, '""')}"`,
            `"${(d.sticker_number || '').replace(/"/g, '""')}"`,
            `"${(d.installation_date || '').replace(/"/g, '""')}"`,
            `"${(d.final_delivery_date || '').replace(/"/g, '""')}"`,
            `"${(d.height || '').replace(/"/g, '""')}"`,
            `"${(d.width || '').replace(/"/g, '""')}"`,
            `"${(d.depth || '').replace(/"/g, '""')}"`,
            `"${(d.door_type || '').replace(/"/g, '""')}"`,
            `"${(d.profile_type || '').replace(/"/g, '""')}"`,
            `"${(d.lock_type || '').replace(/"/g, '""')}"`,
            `"${(d.hinges || '').replace(/"/g, '""')}"`,
            `"${(d.window || '').replace(/"/g, '""')}"`
        ];
        csvContent += row.join(",") + "\n";
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `أبواب_الحريق_${new Date().toLocaleDateString('ar-SA').replace(/\//g, '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('تم تصدير ملف أبواب الحريق بنجاح (شامل كافة المواصفات)', 'bg-emerald-500', '✓');
};

// --- Print Fire Doors Table ---
window.printFireDoorsTable = function() {
    if (globalFireDoors.length === 0) {
        showToast('لا يوجد بيانات لطباعتها', 'bg-amber-500', '⚠');
        return;
    }

    const printUser = (window.currentUser && window.currentUser.username) || localStorage.getItem('username') || 'المستخدم';
    const printDate = new Date().toLocaleString('ar-SA', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        hour12: true 
    });

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        showToast('يرجى السماح بالنوافذ المنبثقة للطباعة', 'bg-amber-500', '⚠️');
        return;
    }

    let rowsHtml = '';
    globalFireDoors.forEach((d, idx) => {
        rowsHtml += `
            <tr>
                <td style="text-align: center;">${idx + 1}</td>
                <td><strong>${escapeHtml(d.project_name)}</strong></td>
                <td style="text-align: center;">${escapeHtml(d.project_number)}</td>
                <td style="text-align: center;">${escapeHtml(d.door_number)}</td>
                <td style="text-align: center; font-weight: bold; font-family: monospace;">${escapeHtml(d.sticker_number || '-')}</td>
                <td style="text-align: center;">${escapeHtml(d.installation_date || '-')}</td>
                <td style="text-align: center;">${escapeHtml(d.final_delivery_date || '-')}</td>
                <td style="text-align: center;">${escapeHtml(d.height)}</td>
                <td style="text-align: center;">${escapeHtml(d.width)}</td>
                <td style="text-align: center;">${escapeHtml(d.depth)}</td>
                <td style="text-align: center;">${escapeHtml(d.door_type)}</td>
                <td style="text-align: center;">${escapeHtml(d.profile_type)}</td>
                <td style="text-align: center;">${escapeHtml(d.lock_type)}</td>
                <td style="text-align: center;">${escapeHtml(d.hinges)}</td>
                <td style="text-align: center;">${escapeHtml(d.window)}</td>
            </tr>
        `;
    });

    printWindow.document.write(`
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
            <meta charset="UTF-8">
            <title>جدول أبواب الحريق والمطابقة</title>
            <style>
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    direction: rtl;
                    margin: 20px;
                    color: #1e293b;
                }
                .header {
                    border-bottom: 2px solid #e2e8f0;
                    padding-bottom: 12px;
                    margin-bottom: 16px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .title {
                    font-size: 20px;
                    font-weight: bold;
                    color: #b91c1c;
                }
                .meta {
                    font-size: 11px;
                    color: #64748b;
                    line-height: 1.6;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 10px;
                }
                th, td {
                    border: 1px solid #cbd5e1;
                    padding: 5px 6px;
                }
                th {
                    background-color: #f1f5f9;
                    font-weight: bold;
                    color: #334155;
                }
                tr:nth-child(even) {
                    background-color: #f8fafc;
                }
                @media print {
                    @page {
                        size: landscape;
                        margin: 10mm;
                    }
                    body {
                        margin: 0;
                    }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <div>
                    <div class="title">تقرير أبواب الحريق ومتابعة الملصقات</div>
                    <div style="font-size: 12px; color: #475569; margin-top: 3px;">مصنع الأبواب المعدنية المقاومة للحريق</div>
                </div>
                <div class="meta" style="text-align: left;">
                    <div><strong>تاريخ ووقت الطباعة:</strong> ${printDate}</div>
                    <div><strong>طبع بواسطة:</strong> ${escapeHtml(printUser)}</div>
                    <div><strong>إجمالي الأبواب:</strong> ${globalFireDoors.length} باب</div>
                </div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th style="width: 30px;">#</th>
                        <th>المشروع</th>
                        <th>رقم المشروع</th>
                        <th>رقم الباب</th>
                        <th>رقم الملصق</th>
                        <th>تاريخ التركيب</th>
                        <th>الاستلام النهائي</th>
                        <th>الارتفاع</th>
                        <th>العرض</th>
                        <th>العمق</th>
                        <th>الدرفة</th>
                        <th>المقطع</th>
                        <th>الزرفيل</th>
                        <th>الفصالة</th>
                        <th>الشباك</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>
        </body>
        </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
        printWindow.print();
    }, 500);
};

window.proceedFromStep2 = async function() {
    if (ignoreFireDoorValidation) {
        goToWizardStep(3);
        return;
    }

    // Ensure fire door rules are loaded
    if (!dbFireDoorRules || dbFireDoorRules.length === 0) {
        await loadFireDoorRules();
    }

    const rows = document.querySelectorAll('#projectDetailsTableBody tr');
    let errors = [];

    rows.forEach(tr => {
        const inputs = tr.querySelectorAll('input, select');
        if (inputs.length < 17) return; // safety check

        const doorNum = inputs[0].value || 'بدون رقم';
        // Check fire_resistance checkbox: inputs[16] is fire_resistance, with defensive fallback to inputs[14]
        let isFireResistant = false;
        if (inputs[16] && inputs[16].type === 'checkbox') {
            isFireResistant = inputs[16].checked;
        } else if (inputs[14] && inputs[14].type === 'checkbox') {
            isFireResistant = inputs[14].checked;
        }

        if (isFireResistant) {
            const width = parseFloat(inputs[2].value);
            const height = parseFloat(inputs[3].value);
            const depth = parseFloat(inputs[4].value);
            const profile = inputs[9] ? inputs[9].value.trim() : '';
            const doorType = inputs[10] ? inputs[10].value.trim() : '';
            const leafThickness = inputs[14] ? parseFloat(inputs[14].value) : NaN;
            const architrave = inputs[17] ? parseFloat(inputs[17].value) : NaN;
            const architrave2 = inputs[18] ? parseFloat(inputs[18].value) : NaN;

            if (dbFireDoorRules && dbFireDoorRules.length > 0) {
                let matchesAny = false;
                for (let r of dbFireDoorRules) {
                    let match = true;

                    // 1. Height check
                    if (r.min_height !== null && r.min_height !== undefined && !isNaN(r.min_height)) {
                        if (isNaN(height) || height < r.min_height) match = false;
                    }
                    if (r.max_height !== null && r.max_height !== undefined && !isNaN(r.max_height)) {
                        if (isNaN(height) || height > r.max_height) match = false;
                    }

                    // 2. Width check
                    if (r.min_width !== null && r.min_width !== undefined && !isNaN(r.min_width)) {
                        if (isNaN(width) || width < r.min_width) match = false;
                    }
                    if (r.max_width !== null && r.max_width !== undefined && !isNaN(r.max_width)) {
                        if (isNaN(width) || width > r.max_width) match = false;
                    }

                    // 3. Depth check
                    if (r.min_depth !== null && r.min_depth !== undefined && !isNaN(r.min_depth)) {
                        if (isNaN(depth) || depth < r.min_depth) match = false;
                    }
                    if (r.max_depth !== null && r.max_depth !== undefined && !isNaN(r.max_depth)) {
                        if (isNaN(depth) || depth > r.max_depth) match = false;
                    }

                    // 4. Profile check
                    if (r.profile_type && r.profile_type !== 'الجميع') {
                        if (!profile || profile !== r.profile_type) match = false;
                    }

                    // 5. Door Type check
                    if (r.door_type && r.door_type !== 'الجميع') {
                        if (!doorType || doorType !== r.door_type) match = false;
                    }

                    // 6. Leaf Thickness check
                    if (r.min_leaf_thickness !== null && r.min_leaf_thickness !== undefined && !isNaN(r.min_leaf_thickness)) {
                        if (isNaN(leafThickness) || leafThickness < r.min_leaf_thickness) match = false;
                    }
                    if (r.max_leaf_thickness !== null && r.max_leaf_thickness !== undefined && !isNaN(r.max_leaf_thickness)) {
                        if (isNaN(leafThickness) || leafThickness > r.max_leaf_thickness) match = false;
                    }

                    // 7. Architrave (الكشفة) check
                    if (r.min_architrave !== null && r.min_architrave !== undefined && !isNaN(r.min_architrave)) {
                        if (isNaN(architrave) || architrave < r.min_architrave) match = false;
                    }
                    if (r.max_architrave !== null && r.max_architrave !== undefined && !isNaN(r.max_architrave)) {
                        if (isNaN(architrave) || architrave > r.max_architrave) match = false;
                    }

                    // 8. Architrave 2 (الكشفة 2) check
                    if (r.min_architrave_2 !== null && r.min_architrave_2 !== undefined && !isNaN(r.min_architrave_2)) {
                        if (isNaN(architrave2) || architrave2 < r.min_architrave_2) match = false;
                    }
                    if (r.max_architrave_2 !== null && r.max_architrave_2 !== undefined && !isNaN(r.max_architrave_2)) {
                        if (isNaN(architrave2) || architrave2 > r.max_architrave_2) match = false;
                    }

                    if (match) {
                        matchesAny = true;
                        break;
                    }
                }

                if (!matchesAny) {
                    errors.push(`الباب رقم (${doorNum}): القياسات أو المواصفات المختارة لا تطابق أي من مواصفات أبواب الحريق المعتمدة في النظام.`);
                }
            } else {
                // Fallback default rules if none configured
                let doorErrors = [];
                if (isNaN(width) || width > 140) doorErrors.push("العرض يجب ألا يزيد عن 140 سم");
                if (isNaN(height) || height > 280) doorErrors.push("الطول يجب ألا يزيد عن 280 سم");
                if (profile === "single rabbit with rubber") {
                    if (isNaN(depth) || depth !== 15) doorErrors.push("العمق يجب أن يكون 15 سم");
                } else if (profile === "double rabbit with rubber") {
                    if (isNaN(depth) || depth < 15 || depth > 33) doorErrors.push("العمق يجب ألا يقل عن 15 سم وألا يزيد عن 33 سم");
                } else if (profile === "single rabbit without rubber" || profile === "double rabbit without rubber" || profile === "single rabbit") {
                    if (isNaN(depth) || depth < 10 || depth > 35) doorErrors.push("العمق يجب ألا يقل عن 10 سم وألا يزيد عن 35 سم");
                }
                if (doorErrors.length > 0) {
                    errors.push(`الباب رقم (${doorNum}): ${doorErrors.join('، ')}`);
                }
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
            
            const arch = parseFloat(d.architrave) || 4.0;
            let leafWidth = "";
            if (frameWidth > 0) {
                leafWidth = isDouble ? (((frameWidth - (2 * arch) - 1.5) / 2)).toFixed(1) : (frameWidth - (2 * arch) - 0.7).toFixed(1);
            }
            let leafHeight = frameHeight > 0 ? (frameHeight - arch - 1.0).toFixed(1) : "";
            
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

async function showHRView(fromHistory = false) {
    const currentUsername = localStorage.getItem('username');
    const hasHrAccess = currentUsername === 'admin' || userPermissionsList.some(p => p.department_name === 'system_hr' && (p.can_edit == 1 || p.can_edit === true));
    if (!hasHrAccess) {
        showToast('غير مصرح لك بالوصول لنظام إدارة شؤون الموظفين', 'bg-rose-500', '✗');
        return;
    }

    if (!fromHistory) {
        pushNavigationState('hr');
    }

    const views = [
        'moduleSelectorView', 'departmentsView', 'accessoriesSubDeptView', 
        'departmentDetailView', 'adminView', 'purchasingView', 
        'purchaseRequestDetailView', 'projectsView', 'projectWizardView', 
        'projectDetailView', 'servicesView', 'serviceWizardView', 'serviceJobDetailView'
    ];
    views.forEach(v => {
        const el = document.getElementById(v);
        if (el) el.classList.add('hidden');
    });

    const hrView = document.getElementById('hrView');
    if (hrView) hrView.classList.remove('hidden');

    // Check permissions
    const hasHrMgmt = currentUsername === 'admin' || userPermissionsList.some(p => p.department_name === 'hr_management' && (p.can_edit == 1 || p.can_edit === true));
    
    // Load users to check if manager
    let isManager = false;
    try {
        const usersRes = await authFetch('/api/users/basic');
        if (usersRes.ok) {
            const allUsers = await usersRes.json();
            const me = allUsers.find(u => u.username === currentUsername);
            const myId = me ? me.id : null;
            if (myId) {
                isManager = allUsers.some(u => u.manager_id === myId);
                // Cache user object globally
                window.currentUserObject = me;
            }
        }
    } catch(e) {
        console.error('[DEBUG] Failed checking manager status', e);
    }
    
    const adminBtn = document.getElementById('hrAdminRequestsBtn');
    if (adminBtn) {
        if (hasHrMgmt || isManager) {
            adminBtn.classList.remove('hidden');
        } else {
            adminBtn.classList.add('hidden');
        }
    }

    const adminEmpBtn = document.getElementById('hrAdminEmployeesBtn');
    if (adminEmpBtn) {
        if (hasHrMgmt) {
            adminEmpBtn.classList.remove('hidden');
        } else {
            adminEmpBtn.classList.add('hidden');
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
    document.getElementById('hrSalarySection').classList.add('hidden');
    document.getElementById('hrSalarySection').classList.remove('block');

    // Load Data
    await loadHrProfile();
    await loadHrRequests();
    await loadHrAttendance();
}

function enterHrSubSection(section, fromHistory = false) {
    if (!fromHistory) {
        pushNavigationState('hr', { section: section });
    }
    hrCurrentSection = section;
    
    // Hide main menu
    document.getElementById('hrMainMenuSection').classList.add('hidden');
    document.getElementById('hrMainMenuSection').classList.remove('grid');

    // Show selected section
    const sections = ['profile', 'forms', 'attendance', 'salary'];
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
    } else if (section === 'salary') {
        loadHrSalary();
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
        document.getElementById('hrSalarySection').classList.add('hidden');
        document.getElementById('hrSalarySection').classList.remove('block');
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

        // Personal profile is always read-only. Editing is done via Employee Files.
        const nameInput = document.getElementById('hrProfileName');
        const jobTitleInput = document.getElementById('hrProfileJobTitle');
        const empIdInput = document.getElementById('hrProfileEmpId');
        const deptInput = document.getElementById('hrProfileDepartment');
        const avatarInput = document.getElementById('hrProfileAvatarInput');
        const avatarLabel = document.getElementById('hrProfileAvatarLabel');
        const saveBtn = document.getElementById('hrProfileSaveBtn');

        nameInput.disabled = true;
        jobTitleInput.disabled = true;
        empIdInput.disabled = true;
        deptInput.disabled = true;
        avatarInput.disabled = true;
        if (avatarLabel) avatarLabel.classList.add('hidden');
        if (saveBtn) saveBtn.classList.add('hidden');
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
        
        // Exclude loan requests ('سلفة') from Forms & Requests section
        const formsList = list.filter(req => req.request_type !== 'سلفة');

        if (formsList.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-slate-400">لا يوجد طلبات سابقة بعد</td></tr>`;
            return;
        }

        formsList.forEach(req => {
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

            let actionCell = '-';
            if (req.status !== 'موافق' && req.status !== 'مرفوض') {
                actionCell = `<button onclick="deleteHrRequest(${req.id})" class="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold transition">🗑 حذف</button>`;
            }

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
                <td class="p-4 text-center">${actionCell}</td>
            `;
            tbody.appendChild(row);
        });

        // Load vacations and draw chart
        try {
            const userRes = await authFetch('/api/users/me');
            if (userRes.ok) {
                const user = await userRes.json();
                const vacRes = await authFetch(`/api/users/${user.id}/vacations`);
                if (vacRes.ok) {
                    const vacations = await vacRes.json();
                    renderUserHolidaysChart(user.allowed_holidays || 21, vacations);
                }
            }
        } catch (e) {
            console.error('[DEBUG] Failed to load vacations for chart inside loadHrRequests', e);
        }
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

        const currentUsername = localStorage.getItem('username');
        const hasHrMgmt = currentUsername === 'admin' || userPermissionsList.some(p => p.department_name === 'hr_management' && (p.can_edit == 1 || p.can_edit === true));

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
            if (req.status === 'موافق') {
                statusClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
            } else if (req.status === 'مرفوض') {
                statusClass = 'bg-rose-50 text-rose-700 border-rose-200';
            } else if (req.status.includes('تمت الموافقة من قبل المدير المباشر')) {
                statusClass = 'bg-amber-50 text-amber-700 border-amber-200';
            } else if (req.status.includes('بانتظار موافقة المدير المباشر') || req.status === 'قيد الانتظار') {
                statusClass = 'bg-indigo-50 text-indigo-700 border-indigo-200';
            }

            // Determine if viewer is direct manager
            const requester = req.user;
            const requesterManagerId = requester ? requester.manager_id : null;
            const isDirectManager = requesterManagerId && window.currentUserObject && (window.currentUserObject.id === requesterManagerId);

            let actionsHtml = '-';
            
            const isHierarchical = req.request_type === 'مغادرة' || req.request_type === 'اجازة';

            if (req.status === 'قيد الانتظار' || req.status.includes('بانتظار موافقة')) {
                if (isHierarchical && requesterManagerId) {
                    if (isDirectManager) {
                        actionsHtml = `
                            <div class="flex justify-center gap-1.5">
                                <button onclick="changeRequestStatus(${req.id}, 'موافق')" class="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-[10px] font-bold border border-emerald-200 transition">
                                    ✓ موافقة المدير
                                </button>
                                <button onclick="changeRequestStatus(${req.id}, 'مرفوض')" class="px-2.5 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg text-[10px] font-bold border border-rose-200 transition">
                                    ✗ رفض
                                </button>
                            </div>
                        `;
                    } else if (hasHrMgmt) {
                        actionsHtml = `
                            <div class="flex justify-center gap-1.5 flex-col items-center">
                                <span class="text-slate-400 text-[10px] font-bold mb-1">بانتظار المدير المباشر</span>
                                <button onclick="changeRequestStatus(${req.id}, 'مرفوض')" class="px-2.5 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg text-[10px] font-bold border border-rose-200 transition w-full">
                                    ✗ رفض مبكر
                                </button>
                            </div>
                        `;
                    }
                } else {
                    // No manager, or not hierarchical request
                    if (hasHrMgmt) {
                        actionsHtml = `
                            <div class="flex justify-center gap-1.5">
                                <button onclick="changeRequestStatus(${req.id}, 'موافق')" class="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-[10px] font-bold border border-emerald-200 transition">
                                    ✓ موافقة شؤون الموظفين
                                </button>
                                <button onclick="changeRequestStatus(${req.id}, 'مرفوض')" class="px-2.5 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg text-[10px] font-bold border border-rose-200 transition">
                                    ✗ رفض
                                </button>
                            </div>
                        `;
                    } else if (isDirectManager) {
                        // Let manager approve/forward if they want, or show simple actions
                        actionsHtml = `
                            <div class="flex justify-center gap-1.5">
                                <button onclick="changeRequestStatus(${req.id}, 'موافق')" class="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-[10px] font-bold border border-emerald-200 transition">
                                    ✓ موافقة المدير
                                </button>
                                <button onclick="changeRequestStatus(${req.id}, 'مرفوض')" class="px-2.5 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg text-[10px] font-bold border border-rose-200 transition">
                                    ✗ رفض
                                </button>
                            </div>
                        `;
                    }
                }
            } else if (req.status === 'تمت الموافقة من قبل المدير المباشر وبانتظار الموافقة من شؤون الموظفين') {
                if (hasHrMgmt) {
                    actionsHtml = `
                        <div class="flex justify-center gap-1.5">
                            <button onclick="changeRequestStatus(${req.id}, 'موافق')" class="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-[10px] font-bold border border-emerald-200 transition">
                                ✓ موافقة نهائية
                            </button>
                            <button onclick="changeRequestStatus(${req.id}, 'مرفوض')" class="px-2.5 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg text-[10px] font-bold border border-rose-200 transition">
                                ✗ رفض
                            </button>
                        </div>
                    `;
                }
            }

            if (hasHrMgmt) {
                const deleteBtn = `<button onclick="deleteHrRequest(${req.id})" class="px-2.5 py-1 bg-slate-100 text-rose-700 hover:bg-rose-100 rounded-lg text-[10px] font-bold border border-rose-200 transition" title="حذف الطلب نهائياً">🗑 حذف</button>`;
                if (actionsHtml.includes('</div>')) {
                    actionsHtml = actionsHtml.replace('</div>', `${deleteBtn}</div>`);
                } else {
                    actionsHtml = `<div class="flex justify-center gap-1.5">${deleteBtn}</div>`;
                }
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
        if (!res.ok) {
            let detail = 'فشل في تحديث حالة الطلب';
            try {
                const errData = await res.json();
                if (errData && errData.detail) detail = errData.detail;
            } catch (e) {
                // Ignore JSON parse error if response is HTML/plain text
            }
            throw new Error(detail);
        }
        showToast('تم تحديث حالة الطلب بنجاح', 'bg-emerald-500', '✓');
        await loadHrAdminRequests();
        await loadHrRequests();
        await loadHrSalary();
    } catch (err) {
        console.error(err);
        showToast('خطأ في تحديث حالة الطلب: ' + err.message, 'bg-rose-500', '✗');
    }
}

let pendingDeleteReqId = null;

function deleteHrRequest(reqId) {
    pendingDeleteReqId = reqId;
    const modal = document.getElementById('hrConfirmDeleteModal');
    if (modal) modal.classList.remove('hidden');
}

function closeHrConfirmDeleteModal() {
    pendingDeleteReqId = null;
    const modal = document.getElementById('hrConfirmDeleteModal');
    if (modal) modal.classList.add('hidden');
}

async function executeHrRequestDeletion() {
    if (!pendingDeleteReqId) return;
    const reqId = pendingDeleteReqId;
    closeHrConfirmDeleteModal();

    try {
        const res = await authFetch(`/api/hr/requests/${reqId}`, {
            method: 'DELETE'
        });
        if (!res.ok) {
            let detail = 'فشل في حذف الطلب';
            try {
                const errData = await res.json();
                if (errData && errData.detail) detail = errData.detail;
            } catch (e) {}
            throw new Error(detail);
        }
        showToast('تم حذف الطلب بنجاح', 'bg-emerald-500', '✓');
        
        if (typeof loadHrRequests === 'function') await loadHrRequests();
        if (typeof loadHrSalary === 'function') await loadHrSalary();
        if (typeof loadHrAdminRequests === 'function') await loadHrAdminRequests();
    } catch (err) {
        console.error(err);
        showToast('خطأ أثناء حذف الطلب: ' + err.message, 'bg-rose-500', '✗');
    }
}

// --- EMPLOYEE FILES MANAGEMENT DIALOG ---
let cachedEmployeesList = [];

async function openHrAdminEmployeesModal() {
    document.getElementById('hrAdminEmployeesModal').classList.remove('hidden');
    showEmployeesList();
    await loadHrAdminEmployees();
}

function closeHrAdminEmployeesModal() {
    document.getElementById('hrAdminEmployeesModal').classList.add('hidden');
}

function showEmployeesList() {
    document.getElementById('hrEmployeesListView').classList.remove('hidden');
    document.getElementById('hrEmployeeEditView').classList.add('hidden');
    document.getElementById('hrAdminEmployeesTitle').innerText = 'ملفات الموظفين';
}

async function loadHrAdminEmployees() {
    try {
        const res = await authFetch('/api/users/basic');
        if (!res.ok) throw new Error('Failed to load employees list');
        cachedEmployeesList = await res.json();

        const tbody = document.getElementById('hrAdminEmployeesTableBody');
        tbody.innerHTML = '';

        if (cachedEmployeesList.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="p-6 text-center text-slate-400">لا يوجد موظفون بعد</td></tr>`;
            return;
        }

        cachedEmployeesList.forEach(emp => {
            let avatarCell = `<div class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs">👤</div>`;
            if (emp.avatar_url) {
                avatarCell = `<img src="${emp.avatar_url}" class="w-8 h-8 rounded-full object-cover" />`;
            }

            // Find manager name
            let managerName = 'بدون';
            if (emp.manager_id) {
                const mgr = cachedEmployeesList.find(u => u.id === emp.manager_id);
                if (mgr) {
                    managerName = mgr.full_name || mgr.username;
                }
            }

            const row = document.createElement('tr');
            row.className = 'border-b hover:bg-slate-50 transition text-right';
            row.innerHTML = `
                <td class="p-3">${avatarCell}</td>
                <td class="p-3 font-bold text-slate-800">${emp.full_name || '-'}</td>
                <td class="p-3 text-slate-500 font-semibold">${emp.username}</td>
                <td class="p-3 text-slate-700">${emp.job_title || '-'}</td>
                <td class="p-3 text-slate-700">${emp.department || '-'}</td>
                <td class="p-3 text-center text-emerald-700 font-bold">${emp.salary || '-'}</td>
                <td class="p-3 text-center font-semibold text-indigo-600">${managerName}</td>
                <td class="p-3 text-center">
                    <button onclick="showEmployeeEditForm(${emp.id})" class="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg font-bold border border-indigo-200 transition text-[10px]">
                        ⚙ تعديل الملف
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });

    } catch (err) {
        console.error(err);
        showToast('خطأ أثناء تحميل ملفات الموظفين: ' + err.message, 'bg-rose-500', '✗');
    }
}

function showEmployeeEditForm(userId) {
    const emp = cachedEmployeesList.find(u => u.id === userId);
    if (!emp) return;

    document.getElementById('hrEmployeesListView').classList.add('hidden');
    document.getElementById('hrEmployeeEditView').classList.remove('hidden');
    document.getElementById('hrAdminEmployeesTitle').innerText = `تعديل ملف الموظف: ${emp.full_name || emp.username}`;

    // Populate Fields
    document.getElementById('editEmpUserId').value = emp.id;
    document.getElementById('editEmpFullName').value = emp.full_name || '';
    document.getElementById('editEmpJobTitle').value = emp.job_title || '';
    document.getElementById('editEmpEmploymentId').value = emp.employment_id || '';
    document.getElementById('editEmpDepartment').value = emp.department || '';
    document.getElementById('editEmpSalary').value = emp.salary || '';
    document.getElementById('editEmpAllowedHolidays').value = emp.allowed_holidays !== undefined && emp.allowed_holidays !== null ? emp.allowed_holidays : 21;

    // Reset vacation inputs
    document.getElementById('addEmpVacationDate').value = '';
    document.getElementById('addEmpVacationNotes').value = '';

    // Handle avatar preview
    const previewImg = document.getElementById('editEmpAvatarPreview');
    const placeholder = document.getElementById('editEmpAvatarPlaceholder');
    if (emp.avatar_url) {
        previewImg.src = emp.avatar_url;
        previewImg.classList.remove('hidden');
        placeholder.classList.add('hidden');
    } else {
        previewImg.src = '';
        previewImg.classList.add('hidden');
        placeholder.classList.remove('hidden');
    }

    // Populate direct manager dropdown
    const select = document.getElementById('editEmpManagerSelect');
    select.innerHTML = '<option value="0">بدون</option>';

    cachedEmployeesList.forEach(u => {
        // Exclude the user being edited from the manager selection list
        if (u.id !== userId) {
            const opt = document.createElement('option');
            opt.value = u.id;
            opt.innerText = u.full_name ? `${u.full_name} (${u.username})` : u.username;
            if (u.id === emp.manager_id) {
                opt.selected = true;
            }
            select.appendChild(opt);
        }
    });

    // Load vacation days list for admin view
    loadEmpVacationsForAdmin(emp.id);

    // Reset and load salaries
    document.getElementById('addEmpSalaryMonth').value = '';
    document.getElementById('addEmpSalaryBasic').value = '';
    document.getElementById('addEmpSalarySocial').value = '';
    document.getElementById('addEmpSalaryOther').value = '';
    document.getElementById('addEmpSalaryLoans').value = '';
    document.getElementById('addEmpSalaryOvertime').value = '';
    loadEmpSalariesForAdmin(emp.id);
}

function previewEditEmpAvatar(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const previewImg = document.getElementById('editEmpAvatarPreview');
            const placeholder = document.getElementById('editEmpAvatarPlaceholder');
            previewImg.src = e.target.result;
            previewImg.classList.remove('hidden');
            placeholder.classList.add('hidden');
        }
        reader.readAsDataURL(input.files[0]);
    }
}

async function saveHrEmployeeByAdmin(event) {
    event.preventDefault();
    const userId = document.getElementById('editEmpUserId').value;
    const formData = new FormData();
    formData.append('full_name', document.getElementById('editEmpFullName').value);
    formData.append('job_title', document.getElementById('editEmpJobTitle').value);
    formData.append('employment_id', document.getElementById('editEmpEmploymentId').value);
    formData.append('department', document.getElementById('editEmpDepartment').value);
    formData.append('salary', document.getElementById('editEmpSalary').value);
    formData.append('allowed_holidays', document.getElementById('editEmpAllowedHolidays').value);
    
    const mgrVal = document.getElementById('editEmpManagerSelect').value;
    formData.append('manager_id', mgrVal);

    const avatarInput = document.getElementById('editEmpAvatarInput');
    if (avatarInput.files && avatarInput.files[0]) {
        formData.append('avatar', avatarInput.files[0]);
    }

    try {
        const res = await authFetch(`/api/users/${userId}/profile-admin`, {
            method: 'PUT',
            body: formData
        });
        if (!res.ok) throw new Error('Failed to save employee profile changes');
        showToast('تم حفظ تعديلات الموظف بنجاح', 'bg-emerald-500', '✓');
        showEmployeesList();
        await loadHrAdminEmployees();
    } catch (err) {
        console.error(err);
        showToast('خطأ في حفظ التغييرات: ' + err.message, 'bg-rose-500', '✗');
    }
}

// --- USER HOLIDAYS CHART & DETAILS ---
function renderUserHolidaysChart(allowedHolidays, takenVacations) {
    const total = parseInt(allowedHolidays) || 21;
    const taken = takenVacations.length;
    let remaining = total - taken;
    if (remaining < 0) remaining = 0;

    // Update Text Stats
    document.getElementById('userHolidaysTotal').innerText = total;
    document.getElementById('userHolidaysRemaining').innerText = remaining;
    document.getElementById('userHolidaysTaken').innerText = taken;

    // Update Detailed list (hidden by default)
    document.getElementById('userVacationsListSection').classList.add('hidden');
    const tbody = document.getElementById('userVacationsTableBody');
    tbody.innerHTML = '';
    
    if (takenVacations.length === 0) {
        tbody.innerHTML = `<tr><td colspan="2" class="p-4 text-center text-slate-400 font-bold">لا يوجد أيام عطل مسجلة بعد</td></tr>`;
    } else {
        takenVacations.forEach(vac => {
            const row = document.createElement('tr');
            row.className = 'border-b hover:bg-slate-50 transition';
            row.innerHTML = `
                <td class="p-3 font-semibold text-slate-800">${vac.vacation_date}</td>
                <td class="p-3 text-slate-600">${vac.notes || '-'}</td>
            `;
            tbody.appendChild(row);
        });
    }

    // Skip drawing the chart if the section is hidden (Chart.js cannot size properly)
    const formsSection = document.getElementById('hrFormsSection');
    if (formsSection && formsSection.classList.contains('hidden')) {
        console.log('[DEBUG] Skipping Chart.js render because hrFormsSection is hidden');
        return;
    }

    // Render Pie Chart with a slight delay to allow layout to calculate dimensions
    setTimeout(() => {
        const canvas = document.getElementById('userHolidaysChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        
        if (holidaysChartInstance) {
            holidaysChartInstance.destroy();
        }

        holidaysChartInstance = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['عطل متبقية', 'عطل تم أخذها'],
                datasets: [{
                    data: [remaining, taken],
                    backgroundColor: ['#10b981', '#f43f5e'],
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false // We use our custom legend in HTML
                    },
                    tooltip: {
                        rtl: true,
                        titleFont: { family: 'Outfit, Cairo, sans-serif', size: 12 },
                        bodyFont: { family: 'Outfit, Cairo, sans-serif', size: 12 },
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.raw || 0;
                                return `${label}: ${value} يوم`;
                            }
                        }
                    }
                }
            }
        });
    }, 50);
}

function toggleVacationDetailsTable() {
    const el = document.getElementById('userVacationsListSection');
    if (el.classList.contains('hidden')) {
        el.classList.remove('hidden');
    } else {
        el.classList.add('hidden');
    }
}

// --- ADMIN VACATIONS MANAGEMENT LIST ---
async function loadEmpVacationsForAdmin(userId) {
    try {
        const res = await authFetch(`/api/users/${userId}/vacations`);
        if (!res.ok) throw new Error('Failed to load vacations list');
        const vacations = await res.ok ? await res.json() : [];

        const tbody = document.getElementById('editEmpVacationsTableBody');
        tbody.innerHTML = '';

        if (vacations.length === 0) {
            tbody.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-slate-400">لا توجد عطل مسجلة للموظف بعد</td></tr>`;
            return;
        }

        vacations.forEach(vac => {
            const row = document.createElement('tr');
            row.className = 'border-b hover:bg-slate-50 transition';
            row.innerHTML = `
                <td class="p-2 font-semibold text-slate-800">${vac.vacation_date}</td>
                <td class="p-2 text-slate-600">${vac.notes || '-'}</td>
                <td class="p-2 text-center">
                    <button type="button" onclick="deleteVacationDayByAdmin(${vac.id}, ${userId})" class="px-2 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded border border-rose-200 transition text-[9px] font-bold">
                        حذف
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (err) {
        console.error(err);
        showToast('خطأ أثناء تحميل عطل الموظف: ' + err.message, 'bg-rose-500', '✗');
    }
}

async function addVacationDayByAdmin() {
    const userId = document.getElementById('editEmpUserId').value;
    const dateInput = document.getElementById('addEmpVacationDate');
    const notesInput = document.getElementById('addEmpVacationNotes');

    const vacationDate = dateInput.value;
    const notes = notesInput.value;

    if (!vacationDate) {
        showToast('يرجى تحديد تاريخ يوم العطلة أولاً', 'bg-amber-500', '⚠️');
        return;
    }

    try {
        const res = await authFetch(`/api/users/${userId}/vacations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ vacation_date: vacationDate, notes: notes })
        });
        if (!res.ok) throw new Error('Failed to add vacation day');
        
        showToast('تمت إضافة يوم العطلة بنجاح', 'bg-emerald-500', '✓');
        dateInput.value = '';
        notesInput.value = '';
        await loadEmpVacationsForAdmin(userId);
    } catch (err) {
        console.error(err);
        showToast('خطأ في إضافة يوم العطلة: ' + err.message, 'bg-rose-500', '✗');
    }
}

async function deleteVacationDayByAdmin(vacationId, userId) {
    if (!confirm('هل أنت متأكد من رغبتك في حذف يوم العطلة هذا للموظف؟')) return;

    try {
        const res = await authFetch(`/api/users/vacations/${vacationId}`, {
            method: 'DELETE'
        });
        if (!res.ok) throw new Error('Failed to delete vacation day');

        showToast('تم حذف يوم العطلة بنجاح', 'bg-emerald-500', '✓');
        await loadEmpVacationsForAdmin(userId);
    } catch (err) {
        console.error(err);
        showToast('خطأ في حذف يوم العطلة: ' + err.message, 'bg-rose-500', '✗');
    }
}

// --- USER SALARIES LOGIC (FRONTEND) ---
let cachedUserSalariesList = [];

async function loadHrSalary() {
    try {
        const userRes = await authFetch('/api/users/me');
        if (!userRes.ok) throw new Error('Failed to load current user');
        const user = await userRes.json();

        const res = await authFetch(`/api/users/${user.id}/salaries`);
        if (!res.ok) throw new Error('Failed to load salaries list');
        const salaries = await res.json();
        cachedUserSalariesList = salaries;

        // Fetch user's loan requests
        let loanRequests = [];
        try {
            const reqRes = await authFetch('/api/hr/requests/me');
            if (reqRes.ok) {
                const allReqs = await reqRes.json();
                loanRequests = allReqs.filter(r => r.request_type === 'سلفة');
            }
        } catch (e) {
            console.error('Failed to load loan requests', e);
        }

        // Render Loan Requests Table inside Salary Section
        const loansTbody = document.getElementById('userLoansTableBody');
        if (loansTbody) {
            loansTbody.innerHTML = '';
            if (loanRequests.length === 0) {
                loansTbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-400 font-bold">لا يوجد طلبات سلف مسجلة</td></tr>`;
            } else {
                loanRequests.forEach(l => {
                    let statusClass = 'bg-slate-50 text-slate-700 border-slate-200';
                    if (l.status === 'موافق') statusClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                    if (l.status === 'مرفوض') statusClass = 'bg-rose-50 text-rose-700 border-rose-200';

                    let actionCell = '-';
                    if (l.status !== 'موافق' && l.status !== 'مرفوض') {
                        actionCell = `<button onclick="deleteHrRequest(${l.id})" class="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold transition">🗑 حذف</button>`;
                    }

                    const row = document.createElement('tr');
                    row.className = 'border-b hover:bg-slate-50 transition';
                    row.innerHTML = `
                        <td class="p-4 text-slate-500 font-semibold">${new Date(l.request_date).toLocaleDateString()}</td>
                        <td class="p-4 font-bold text-slate-800">${l.reason}</td>
                        <td class="p-4 text-center">
                            <span class="inline-block px-2.5 py-1 ${statusClass} rounded-full text-xs font-bold border">${l.status}</span>
                        </td>
                        <td class="p-4 text-center">${actionCell}</td>
                    `;
                    loansTbody.appendChild(row);
                });
            }
        }

        // Current Date / Month calculation
        const now = new Date();
        const curYear = now.getFullYear();
        const curMonth = String(now.getMonth() + 1).padStart(2, '0');
        const curMonthStr = `${curYear}-${curMonth}`;

        // Calculate sum of approved loans for current month
        let approvedLoansThisMonth = 0;
        loanRequests.forEach(l => {
            if (l.status === 'موافق') {
                const reqDate = new Date(l.request_date);
                const reqMonthStr = `${reqDate.getFullYear()}-${String(reqDate.getMonth() + 1).padStart(2, '0')}`;
                if (reqMonthStr === curMonthStr) {
                    const match = (l.reason || '').match(/(\d+(?:\.\d+)?)/);
                    if (match) {
                        approvedLoansThisMonth += parseFloat(match[1]);
                    }
                }
            }
        });

        // Find current month salary record in DB if any
        const curSal = salaries.find(s => s.month === curMonthStr);

        document.getElementById('salaryCurrentMonthName').innerText = `شهر: ${curMonthStr}`;

        const basic = curSal ? curSal.basic_salary : (user.salary ? parseFloat(user.salary.replace(/[^0-9.]/g, '')) || 0 : 0);
        const socialSecurity = curSal ? curSal.social_security_deduction : Math.round(basic * 0.075 * 100) / 100;
        const loansVal = curSal ? Math.max(curSal.loans, approvedLoansThisMonth) : approvedLoansThisMonth;
        const overtime = curSal ? curSal.overtime : 0;
        const otherDeductions = curSal ? curSal.other_deductions : 0;

        const totalNet = basic + overtime - socialSecurity - loansVal - otherDeductions;

        document.getElementById('salaryBasicVal').innerText = `${basic.toFixed(2)} دينار`;
        document.getElementById('salaryOvertimeVal').innerText = `${overtime.toFixed(2)} دينار`;
        document.getElementById('salarySocialSecurityVal').innerText = `${socialSecurity.toFixed(2)} دينار`;
        document.getElementById('salaryLoansVal').innerText = `${loansVal.toFixed(2)} دينار`;
        document.getElementById('salaryOtherDeductionsVal').innerText = `${otherDeductions.toFixed(2)} دينار`;
        document.getElementById('salaryTotalVal').innerText = `${totalNet.toFixed(2)} دينار`;

        // Render previous month salary records table
        const tbody = document.getElementById('userSalariesTableBody');
        tbody.innerHTML = '';

        if (salaries.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-400 font-bold">لا يوجد سجل رواتب سابق بعد</td></tr>`;
        } else {
            salaries.forEach(sal => {
                const totalDeductions = sal.social_security_deduction + sal.other_deductions + sal.loans;
                const row = document.createElement('tr');
                row.className = 'border-b hover:bg-slate-50 transition cursor-pointer';
                row.onclick = () => showSalaryDetails(sal.month);
                row.innerHTML = `
                    <td class="p-4 font-semibold text-slate-800">${sal.month}</td>
                    <td class="p-4 text-slate-650 text-slate-600">${sal.basic_salary.toFixed(2)} دينار</td>
                    <td class="p-4 text-rose-650 text-rose-600">-${totalDeductions.toFixed(2)} دينار</td>
                    <td class="p-4 text-emerald-650 text-emerald-600">+${sal.overtime.toFixed(2)} دينار</td>
                    <td class="p-4 font-bold text-emerald-750 text-emerald-700">${sal.total.toFixed(2)} دينار</td>
                    <td class="p-4 text-center">
                        <button class="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg font-bold transition text-[10px]">
                            👁 عرض التفاصيل
                        </button>
                    </td>
                `;
                tbody.appendChild(row);
            });
        }
    } catch (err) {
        console.error(err);
        showToast('خطأ أثناء تحميل الرواتب: ' + err.message, 'bg-rose-500', '✗');
    }
}

// --- SALARY DETAILS MODAL ---
function showSalaryDetails(month) {
    const sal = cachedUserSalariesList.find(s => s.month === month);
    if (!sal) return;

    document.getElementById('salaryDetailsMonthName').innerText = sal.month;
    document.getElementById('detailSalaryBasic').innerText = `${sal.basic_salary.toFixed(2)} دينار`;
    document.getElementById('detailSalaryOvertime').innerText = `+${sal.overtime.toFixed(2)} دينار`;
    document.getElementById('detailSalarySocial').innerText = `-${sal.social_security_deduction.toFixed(2)} دينار`;
    document.getElementById('detailSalaryLoans').innerText = `-${sal.loans.toFixed(2)} دينار`;
    document.getElementById('detailSalaryOther').innerText = `-${sal.other_deductions.toFixed(2)} دينار`;
    document.getElementById('detailSalaryTotal').innerText = `${sal.total.toFixed(2)} دينار`;

    document.getElementById('hrSalaryDetailsModal').classList.remove('hidden');
}

function closeSalaryDetailsModal() {
    document.getElementById('hrSalaryDetailsModal').classList.add('hidden');
}

// --- LOAN REQUESTS (FRONTEND) ---
function openLoanRequestModal() {
    document.getElementById('loanAmountInput').value = '';
    document.getElementById('loanNotesInput').value = '';
    document.getElementById('hrLoanRequestModal').classList.remove('hidden');
}

function closeLoanRequestModal() {
    document.getElementById('hrLoanRequestModal').classList.add('hidden');
}

async function submitLoanRequest(event) {
    event.preventDefault();
    const amountVal = document.getElementById('loanAmountInput').value;
    const notesVal = document.getElementById('loanNotesInput').value;

    const amount = parseFloat(amountVal);
    if (isNaN(amount) || amount <= 0) {
        showToast('يرجى إدخال مبلغ صحيح', 'bg-rose-500', '✗');
        return;
    }

    if (amount > 100) {
        showToast('الحد الأقصى للسلفة هو 100 دينار فقط', 'bg-rose-500', '✗');
        return;
    }

    const formData = new FormData();
    formData.append('request_type', 'سلفة');
    formData.append('reason', `طلب سلفة بقيمة ${amount} دينار - ملاحظات: ${notesVal}`);

    try {
        const res = await authFetch('/api/hr/requests/', {
            method: 'POST',
            body: formData
        });

        if (!res.ok) throw new Error('Failed to submit loan request');
        showToast('تم تقديم طلب السلفة بنجاح وهو بانتظار موافقة شؤون الموظفين', 'bg-emerald-500', '✓');
        closeLoanRequestModal();
        
        if (typeof loadHrRequests === 'function') {
            loadHrRequests();
        }
    } catch (err) {
        console.error(err);
        showToast('خطأ أثناء تقديم طلب السلفة: ' + err.message, 'bg-rose-500', '✗');
    }
}

// --- ADMIN SALARY MANAGEMENT ---
async function loadEmpSalariesForAdmin(userId) {
    try {
        const res = await authFetch(`/api/users/${userId}/salaries`);
        if (!res.ok) throw new Error('Failed to load employee salaries list');
        const salaries = await res.json();

        const tbody = document.getElementById('editEmpSalariesTableBody');
        tbody.innerHTML = '';

        if (salaries.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="p-4 text-center text-slate-400">لا توجد سجلات رواتب مسجلة لهذا الموظف بعد</td></tr>`;
            return;
        }

        salaries.forEach(sal => {
            const row = document.createElement('tr');
            row.className = 'border-b hover:bg-slate-50 transition text-right';
            row.innerHTML = `
                <td class="p-2 font-semibold text-slate-800">${sal.month}</td>
                <td class="p-2">${sal.basic_salary.toFixed(2)} دينار</td>
                <td class="p-2 text-rose-600">-${sal.social_security_deduction.toFixed(2)}</td>
                <td class="p-2 text-rose-600">-${sal.other_deductions.toFixed(2)}</td>
                <td class="p-2 text-rose-600">-${sal.loans.toFixed(2)}</td>
                <td class="p-2 text-emerald-600">+${sal.overtime.toFixed(2)}</td>
                <td class="p-2 font-bold text-emerald-700">${sal.total.toFixed(2)}</td>
                <td class="p-2 text-center">
                    <button type="button" onclick="deleteEmployeeSalaryByAdmin(${sal.id}, ${userId})" class="px-2 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded border border-rose-200 transition text-[9px] font-bold">
                        حذف
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (err) {
        console.error(err);
        showToast('خطأ أثناء تحميل رواتب الموظف: ' + err.message, 'bg-rose-500', '✗');
    }
}

async function saveEmployeeSalaryByAdmin() {
    const userId = document.getElementById('editEmpUserId').value;
    const month = document.getElementById('addEmpSalaryMonth').value;
    const basic = parseFloat(document.getElementById('addEmpSalaryBasic').value) || 0;
    let social = parseFloat(document.getElementById('addEmpSalarySocial').value) || 0;
    if (!social && basic > 0) {
        social = Math.round(basic * 0.075 * 100) / 100;
    }
    const other = parseFloat(document.getElementById('addEmpSalaryOther').value) || 0;
    const loans = parseFloat(document.getElementById('addEmpSalaryLoans').value) || 0;
    const overtime = parseFloat(document.getElementById('addEmpSalaryOvertime').value) || 0;

    if (!month) {
        showToast('يرجى تحديد الشهر أولاً', 'bg-amber-500', '⚠️');
        return;
    }

    try {
        const res = await authFetch(`/api/users/${userId}/salaries`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                month: month,
                basic_salary: basic,
                social_security_deduction: social,
                other_deductions: other,
                loans: loans,
                overtime: overtime
            })
        });

        if (!res.ok) throw new Error('Failed to save salary record');
        showToast('تم حفظ سجل الراتب بنجاح', 'bg-emerald-500', '✓');
        
        document.getElementById('addEmpSalaryBasic').value = '';
        document.getElementById('addEmpSalarySocial').value = '';
        document.getElementById('addEmpSalaryOther').value = '';
        document.getElementById('addEmpSalaryLoans').value = '';
        document.getElementById('addEmpSalaryOvertime').value = '';

        await loadEmpSalariesForAdmin(userId);
    } catch (err) {
        console.error(err);
        showToast('خطأ أثناء حفظ الراتب: ' + err.message, 'bg-rose-500', '✗');
    }
}

async function deleteEmployeeSalaryByAdmin(salaryId, userId) {
    if (!confirm('هل أنت متأكد من رغبتك في حذف سجل الراتب لهذا الشهر؟')) return;

    try {
        const res = await authFetch(`/api/users/salaries/${salaryId}`, {
            method: 'DELETE'
        });

        if (!res.ok) throw new Error('Failed to delete salary record');
        showToast('تم حذف سجل الراتب بنجاح', 'bg-emerald-500', '✓');
        await loadEmpSalariesForAdmin(userId);
    } catch (err) {
        console.error(err);
        showToast('خطأ أثناء حذف الراتب: ' + err.message, 'bg-rose-500', '✗');
    }
}


// =========================================================================
// ========================= SERVICES MANAGEMENT SYSTEM =====================
// =========================================================================

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

const SERVICES_URL = `${API_HOST}/api/service-jobs`;
const SERVICE_CLIENTS_URL = `${API_HOST}/api/service-clients`;

let allServicesJobs = [];
let allServicesClients = [];
let currentServicesTab = 'jobs';
let currentServicesFilter = '';
let currentServiceJobData = null;
let serviceWizardSelectedFiles = [];

// Navigation to Services View
function showServicesView(fromHistory = false) {
    const username = localStorage.getItem('username');
    if (!username) {
        showAuthView();
        return;
    }

    if (!fromHistory) {
        pushNavigationState('services');
    }

    // Hide all other views
    const viewsToHide = [
        'moduleSelectorView', 'projectsView', 'projectWizardView', 'projectDetailView',
        'departmentsView', 'subDeptView', 'departmentDetailView', 'adminView',
        'purchasingView', 'purchaseRequestDetailView', 'hrView',
        'serviceWizardView', 'serviceJobDetailView'
    ];
    viewsToHide.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });

    const sView = document.getElementById('servicesView');
    if (sView) sView.classList.remove('hidden');

    switchServicesTab(currentServicesTab || 'jobs');
    loadServicesJobs();
    loadServicesClients();
}

// Switch between Jobs Table and Clients Table
window.switchServicesTab = function(tabName) {
    currentServicesTab = tabName;
    const jobsContainer = document.getElementById('servicesJobsTableContainer');
    const clientsContainer = document.getElementById('servicesClientsTableContainer');
    const tabJobs = document.getElementById('tabServicesJobs');
    const tabClients = document.getElementById('tabServicesClients');
    const btnActionLabel = document.getElementById('lblServicesMainAction');
    const subTitle = document.getElementById('servicesViewSubTitle');

    if (tabName === 'clients') {
        if (jobsContainer) jobsContainer.classList.add('hidden');
        if (clientsContainer) clientsContainer.classList.remove('hidden');
        if (tabClients) tabClients.className = 'px-4 py-2 rounded-lg font-bold text-xs transition-all bg-white text-slate-800 shadow';
        if (tabJobs) tabJobs.className = 'px-4 py-2 rounded-lg font-bold text-xs transition-all text-slate-600 hover:text-slate-900';
        if (btnActionLabel) btnActionLabel.textContent = 'إضافة عميل جديد';
        if (subTitle) subTitle.textContent = 'قائمة بجميع عملاء الخدمات والأعمال الخارجية المسجلين.';
        loadServicesClients();
    } else {
        if (jobsContainer) jobsContainer.classList.remove('hidden');
        if (clientsContainer) clientsContainer.classList.add('hidden');
        if (tabJobs) tabJobs.className = 'px-4 py-2 rounded-lg font-bold text-xs transition-all bg-white text-slate-800 shadow';
        if (tabClients) tabClients.className = 'px-4 py-2 rounded-lg font-bold text-xs transition-all text-slate-600 hover:text-slate-900';
        if (btnActionLabel) btnActionLabel.textContent = 'إضافة عمل جديد';
        if (subTitle) subTitle.textContent = 'إدارة ومتابعة الأعمال والخدمات الخارجية وقائمة العملاء.';
    }
};

window.handleServicesMainAction = function() {
    if (currentServicesTab === 'clients') {
        openServiceClientModal();
    } else {
        openServiceWizard();
    }
};

// Load Jobs
async function loadServicesJobs() {
    const loading = document.getElementById('servicesJobsLoading');
    const empty = document.getElementById('servicesJobsEmpty');
    const tbody = document.getElementById('servicesJobsTableBody');
    if (!tbody) return;

    if (loading) loading.classList.remove('hidden');
    if (empty) empty.classList.add('hidden');
    tbody.innerHTML = '';

    try {
        const response = await authFetch(SERVICES_URL + '/');
        if (!response.ok) throw new Error('فشل جلب قائمة الأعمال');
        allServicesJobs = await response.json();

        updateServicesStats();
        filterServicesJobsTable();
    } catch (e) {
        console.error(e);
        showToast(e.message || 'خطأ أثناء تحميل الأعمال', 'bg-rose-500', '✗');
    } finally {
        if (loading) loading.classList.add('hidden');
    }
}

function updateServicesStats() {
    const totalEl = document.getElementById('statServicesTotal');
    const inProgEl = document.getElementById('statServicesInProgress');
    const compEl = document.getElementById('statServicesCompleted');
    const clientsEl = document.getElementById('statServicesClients');

    if (totalEl) totalEl.textContent = allServicesJobs.length;
    if (inProgEl) inProgEl.textContent = allServicesJobs.filter(j => j.status === 'قيد التنفيذ').length;
    if (compEl) compEl.textContent = allServicesJobs.filter(j => j.status === 'مكتمل' || j.status === 'تم التسليم').length;
    if (clientsEl) clientsEl.textContent = allServicesClients.length;
}

window.setServicesJobFilter = function(filterStatus) {
    currentServicesFilter = filterStatus;
    document.querySelectorAll('.filter-service-btn').forEach(btn => {
        if (btn.getAttribute('data-filter') === filterStatus) {
            btn.className = 'filter-service-btn px-3 py-1.5 rounded-lg text-xs font-bold border transition bg-teal-600 text-white border-teal-600';
        } else {
            btn.className = 'filter-service-btn px-3 py-1.5 rounded-lg text-xs font-bold border transition bg-white text-slate-600 border-slate-200 hover:bg-slate-50';
        }
    });
    filterServicesJobsTable();
};

window.filterServicesJobsTable = function() {
    const query = (document.getElementById('searchServicesJobsInput')?.value || '').trim().toLowerCase();
    const tbody = document.getElementById('servicesJobsTableBody');
    const empty = document.getElementById('servicesJobsEmpty');
    if (!tbody) return;

    let filtered = allServicesJobs;

    if (currentServicesFilter) {
        filtered = filtered.filter(j => j.status === currentServicesFilter);
    }

    if (query) {
        filtered = filtered.filter(j => 
            (j.job_number && j.job_number.toLowerCase().includes(query)) ||
            (j.name && j.name.toLowerCase().includes(query)) ||
            (j.client_name && j.client_name.toLowerCase().includes(query)) ||
            (j.client_phone && j.client_phone.includes(query))
        );
    }

    if (filtered.length === 0) {
        tbody.innerHTML = '';
        if (empty) empty.classList.remove('hidden');
        return;
    }

    if (empty) empty.classList.add('hidden');

    tbody.innerHTML = filtered.map(job => {
        // Build operations badges
        const ops = [];
        if (job.op_design) ops.push('<span class="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded text-[11px] font-bold">تصميم</span>');
        if (job.op_laser_cutting) ops.push('<span class="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded text-[11px] font-bold">قص ليزر</span>');
        if (job.op_bending) ops.push('<span class="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-[11px] font-bold">تطعيج</span>');
        if (job.op_punching) ops.push('<span class="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded text-[11px] font-bold">بنش</span>');
        if (job.op_welding) ops.push('<span class="bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded text-[11px] font-bold">لحام</span>');
        if (job.op_painting) ops.push('<span class="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded text-[11px] font-bold">دهان</span>');
        const opsHtml = ops.length > 0 ? ops.join(' ') : '<span class="text-slate-400 text-xs">-</span>';

        // Delivery date
        let deliveryStr = '-';
        if (job.expected_delivery_date) {
            deliveryStr = job.expected_delivery_date.split('T')[0];
        }

        // Status badge
        let statusBadge = '';
        if (job.status === 'قيد الانتظار') {
            statusBadge = '<span class="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-bold">قيد الانتظار</span>';
        } else if (job.status === 'قيد التنفيذ') {
            statusBadge = '<span class="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-bold">قيد التنفيذ</span>';
        } else if (job.status === 'مكتمل') {
            statusBadge = '<span class="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold">مكتمل</span>';
        } else if (job.status === 'تم التسليم') {
            statusBadge = '<span class="px-2.5 py-1 bg-teal-50 text-teal-700 border border-teal-200 rounded-full text-xs font-bold">تم التسليم</span>';
        } else {
            statusBadge = `<span class="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-bold">${job.status || 'نشط'}</span>`;
        }

        const priceStr = job.final_price !== null && job.final_price !== undefined ? 
            `${parseFloat(job.final_price).toFixed(2)} د.أ` : '0.00 د.أ';

        return `
            <tr class="hover:bg-slate-50 transition border-b border-slate-100 cursor-pointer" onclick="viewServiceJobDetails(${job.id})">
                <td class="p-4 font-bold text-teal-700" dir="ltr">${escapeHtml(job.job_number || '')}</td>
                <td class="p-4 font-extrabold text-slate-900">${escapeHtml(job.name || '')}</td>
                <td class="p-4 font-semibold text-slate-800">${escapeHtml(job.client_name || '')}</td>
                <td class="p-4 text-slate-600" dir="ltr">${escapeHtml(job.client_phone || '-')}</td>
                <td class="p-4 text-slate-600 font-medium" dir="ltr">${deliveryStr}</td>
                <td class="p-4">${opsHtml}</td>
                <td class="p-4 font-extrabold text-slate-900">${priceStr}</td>
                <td class="p-4">${statusBadge}</td>
                <td class="p-4 text-center" onclick="event.stopPropagation()">
                    <div class="flex items-center justify-center gap-1.5">
                        <button onclick="viewServiceJobDetails(${job.id})" class="p-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 transition" title="عرض التفاصيل">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        </button>
                        <button onclick="openEditServiceJobModal(${job.id})" class="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition" title="تعديل العمل">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button onclick="deleteServiceJobById(${job.id})" class="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition" title="حذف العمل">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
};

// --- SERVICE WIZARD LOGIC ---

let currentServiceWizardStep = 1;

window.openServiceWizard = async function(fromHistory = false) {
    if (!fromHistory) {
        pushNavigationState('serviceWizard');
    }

    const viewsToHide = [
        'moduleSelectorView', 'projectsView', 'projectWizardView', 'projectDetailView',
        'departmentsView', 'subDeptView', 'departmentDetailView', 'adminView',
        'purchasingView', 'purchaseRequestDetailView', 'hrView',
        'servicesView', 'serviceJobDetailView'
    ];
    viewsToHide.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });

    const wView = document.getElementById('serviceWizardView');
    if (wView) wView.classList.remove('hidden');

    // Reset Form and Titles
    const form = document.getElementById('serviceWizardForm');
    if (form) form.reset();
    const jobIdInput = document.getElementById('swJobId');
    if (jobIdInput) jobIdInput.value = '';

    const title = document.getElementById('serviceWizardTitle');
    const subTitle = document.getElementById('serviceWizardSubTitle');
    const btnSubmit = document.getElementById('btnSubmitServiceJob');
    if (title) title.textContent = 'إضافة عمل جديد';
    if (subTitle) subTitle.textContent = 'اتبع الخطوات لإدخال كافة تفاصيل ومواصفات العمل.';
    if (btnSubmit) btnSubmit.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
        <span>اعتماد وحفظ العمل</span>
    `;

    serviceWizardSelectedFiles = [];
    renderServiceWizardSelectedFiles();

    // Default dates
    const today = new Date().toISOString().split('T')[0];
    const recDate = document.getElementById('swReceivedDate');
    if (recDate) recDate.value = today;

    // Fetch and populate next job number automatically
    const jobNumInput = document.getElementById('swJobNumber');
    if (jobNumInput) {
        jobNumInput.value = '';
        try {
            const res = await authFetch(`${SERVICES_URL}/next-number`);
            if (res.ok) {
                const data = await res.json();
                if (data.next_job_number && !jobNumInput.value) {
                    jobNumInput.value = data.next_job_number;
                }
            }
        } catch (e) {
            console.error('Failed to get next job number', e);
        }
    }

    // Populate Users
    loadUsersIntoSelect('swAssignedTo');

    // Ensure clients are loaded, then populate client dropdown
    if (!allServicesClients || allServicesClients.length === 0) {
        await loadServicesClients();
    } else {
        populateServiceClientsSelect();
    }

    goToServiceWizardStep(1);
};

window.openEditServiceJobModal = async function(jobId) {
    if (!jobId) return;

    let job = currentServiceJobData;
    if (!job || job.id !== jobId) {
        try {
            const res = await authFetch(`${SERVICES_URL}/${jobId}`);
            if (!res.ok) throw new Error('فشل جلب تفاصيل العمل للتعديل');
            job = await res.json();
            currentServiceJobData = job;
        } catch (e) {
            showToast(e.message, 'bg-rose-500', '✗');
            return;
        }
    }

    pushNavigationState('serviceWizard', { editJobId: jobId });

    const viewsToHide = [
        'moduleSelectorView', 'projectsView', 'projectWizardView', 'projectDetailView',
        'departmentsView', 'subDeptView', 'departmentDetailView', 'adminView',
        'purchasingView', 'purchaseRequestDetailView', 'hrView',
        'servicesView', 'serviceJobDetailView'
    ];
    viewsToHide.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });

    const wView = document.getElementById('serviceWizardView');
    if (wView) wView.classList.remove('hidden');

    const form = document.getElementById('serviceWizardForm');
    if (form) form.reset();

    // Set Edit Mode Identifiers
    const jobIdInput = document.getElementById('swJobId');
    if (jobIdInput) jobIdInput.value = job.id;

    const title = document.getElementById('serviceWizardTitle');
    const subTitle = document.getElementById('serviceWizardSubTitle');
    const btnSubmit = document.getElementById('btnSubmitServiceJob');
    if (title) title.textContent = 'تعديل بيانات العمل';
    if (subTitle) subTitle.textContent = `تعديل تفاصيل العمل رقم ${job.job_number || ''}`;
    if (btnSubmit) btnSubmit.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
        <span>حفظ التعديلات</span>
    `;

    // Step 1: Basic info
    document.getElementById('swName').value = job.name || '';
    document.getElementById('swJobNumber').value = job.job_number || '';
    document.getElementById('swClientName').value = job.client_name || '';
    document.getElementById('swContactPerson').value = job.contact_person || '';
    document.getElementById('swClientPhone').value = job.client_phone || '';
    document.getElementById('swReceivedDate').value = job.received_date ? job.received_date.split('T')[0] : '';
    document.getElementById('swDeliveryDate').value = job.expected_delivery_date ? job.expected_delivery_date.split('T')[0] : '';

    // Step 2: Operations & Sheet
    document.getElementById('swOpDesign').checked = !!job.op_design;
    document.getElementById('swOpLaser').checked = !!job.op_laser_cutting;
    document.getElementById('swOpBending').checked = !!job.op_bending;
    document.getElementById('swOpPunching').checked = !!job.op_punching;
    document.getElementById('swOpWelding').checked = !!job.op_welding;
    document.getElementById('swOpPainting').checked = !!job.op_painting;

    document.getElementById('swSheetThickness').value = job.sheet_thickness !== null && job.sheet_thickness !== undefined ? job.sheet_thickness : '';
    if (job.sheet_ownership) document.getElementById('swSheetOwnership').value = job.sheet_ownership;
    if (job.sheet_type) document.getElementById('swSheetType').value = job.sheet_type;
    document.getElementById('swNotes').value = job.notes || '';

    // Step 3: Pricing & Specs
    document.getElementById('swFinalPrice').value = job.final_price !== null && job.final_price !== undefined ? job.final_price : '';
    document.getElementById('swTaxInclusive').checked = job.tax_inclusive !== false;
    document.getElementById('swCuttingLength').value = job.cutting_length !== null && job.cutting_length !== undefined ? job.cutting_length : '';
    document.getElementById('swBendsCount').value = job.bends_count !== null && job.bends_count !== undefined ? job.bends_count : '';
    document.getElementById('swPunchStrokesCount').value = job.punch_strokes_count !== null && job.punch_strokes_count !== undefined ? job.punch_strokes_count : '';
    document.getElementById('swExpectedDuration').value = job.expected_duration || '';

    // Users and Client Select
    await loadUsersIntoSelect('swAssignedTo');
    if (job.assigned_to) {
        document.getElementById('swAssignedTo').value = job.assigned_to;
    }
    
    if (!allServicesClients || allServicesClients.length === 0) {
        await loadServicesClients();
    }
    populateServiceClientsSelect(job.client_name, job.contact_person);
    if (job.client_phone) {
        document.getElementById('swClientPhone').value = job.client_phone;
    }

    serviceWizardSelectedFiles = [];
    renderServiceWizardSelectedFiles();

    goToServiceWizardStep(1);
};

window.goToServiceWizardStep = function(stepNum) {
    // Validate when going forward
    if (stepNum > currentServiceWizardStep) {
        if (currentServiceWizardStep === 1) {
            const name = document.getElementById('swName')?.value.trim();
            const jobNum = document.getElementById('swJobNumber')?.value.trim();
            const clientName = document.getElementById('swClientName')?.value.trim();
            const contactPerson = document.getElementById('swContactPerson')?.value.trim();
            if (!name || !jobNum || !clientName) {
                showToast('يرجى ملء الحقول الإلزامية في الخطوة الأولى (اسم العمل، رقم الإنتاج، واختيار العميل)', 'bg-amber-500', '⚠️');
                return;
            }
            if (!contactPerson) {
                showToast('يرجى اختيار مسؤول التواصل للعميل المحدد', 'bg-amber-500', '⚠️');
                return;
            }
        } else if (currentServiceWizardStep === 2) {
            // Check operations
            const hasAnyOp = document.getElementById('swOpDesign')?.checked ||
                             document.getElementById('swOpLaser')?.checked ||
                             document.getElementById('swOpBending')?.checked ||
                             document.getElementById('swOpPunching')?.checked ||
                             document.getElementById('swOpWelding')?.checked ||
                             document.getElementById('swOpPainting')?.checked;
            const thickness = document.getElementById('swSheetThickness')?.value;
            if (!hasAnyOp && !thickness) {
                showToast('يرجى تحديد عملية تصنيع واحدة على الأقل أو إدخال مواصفات الصاج', 'bg-amber-500', '⚠️');
                return;
            }
        } else if (currentServiceWizardStep === 3) {
            const price = document.getElementById('swFinalPrice')?.value;
            if (price === '' || price === null) {
                showToast('يرجى إدخال السعر النهائي', 'bg-amber-500', '⚠️');
                return;
            }
        }
    }

    currentServiceWizardStep = stepNum;

    // Show/hide step contents
    for (let i = 1; i <= 4; i++) {
        const stepEl = document.getElementById(`serviceWizardStep${i}`);
        if (stepEl) {
            if (i === stepNum) stepEl.classList.remove('hidden');
            else stepEl.classList.add('hidden');
        }
    }

    // Update Progress Line & Badges
    const progressLine = document.getElementById('serviceWizardProgressLine');
    if (progressLine) {
        const percentages = { 1: '0%', 2: '33%', 3: '66%', 4: '100%' };
        progressLine.style.width = percentages[stepNum] || '0%';
    }

    document.querySelectorAll('.service-wizard-step-indicator').forEach(ind => {
        const step = parseInt(ind.getAttribute('data-step') || '1');
        if (step <= stepNum) {
            ind.className = 'w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm bg-teal-600 text-white shadow-md service-wizard-step-indicator transition-colors';
        } else {
            ind.className = 'w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm bg-slate-200 text-slate-500 service-wizard-step-indicator transition-colors';
        }
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.handleServiceClientSelect = function(clientName, selectedContact = null) {
    const nameInput = document.getElementById('swClientName');
    const contactSelect = document.getElementById('swContactPersonSelect');
    const contactInput = document.getElementById('swContactPerson');
    const phoneInput = document.getElementById('swClientPhone');

    if (nameInput) nameInput.value = clientName || '';
    if (contactInput) contactInput.value = '';
    if (contactSelect) {
        contactSelect.innerHTML = '<option value="">-- اختر مسؤول التواصل --</option>';
        contactSelect.disabled = true;
    }
    if (phoneInput) phoneInput.value = '';

    if (!clientName) return;

    const client = allServicesClients.find(c => c.name.trim().toLowerCase() === clientName.trim().toLowerCase());
    if (!client) return;

    let contactsList = [];
    if (client.contacts) {
        try {
            contactsList = typeof client.contacts === 'string' ? JSON.parse(client.contacts) : client.contacts;
        } catch (e) {
            contactsList = [];
        }
    }

    if (!Array.isArray(contactsList)) contactsList = [];

    // If client has contacts defined
    if (contactsList.length > 0) {
        contactSelect.disabled = false;
        contactsList.forEach(cnt => {
            const opt = document.createElement('option');
            opt.value = cnt.name;
            opt.textContent = `${cnt.name}${cnt.phone ? ` (${cnt.phone})` : ''}`;
            opt.dataset.phone = cnt.phone || '';
            contactSelect.appendChild(opt);
        });

        // Also add client's main phone/name as an option if not in contacts
        if (client.phone && !contactsList.some(cnt => cnt.name === client.name)) {
            const mainOpt = document.createElement('option');
            mainOpt.value = client.name;
            mainOpt.textContent = `${client.name} - الإدارة/الرقم الأساسي (${client.phone})`;
            mainOpt.dataset.phone = client.phone;
            contactSelect.appendChild(mainOpt);
        }

        if (selectedContact) {
            contactSelect.value = selectedContact;
            if (contactInput) contactInput.value = selectedContact;
            const chosen = contactSelect.options[contactSelect.selectedIndex];
            if (chosen && chosen.dataset.phone && phoneInput) {
                phoneInput.value = chosen.dataset.phone;
            } else if (client.phone && phoneInput) {
                phoneInput.value = client.phone;
            }
        } else {
            // Auto select the first contact person by default
            contactSelect.selectedIndex = 1;
            const chosen = contactSelect.options[1];
            if (chosen) {
                if (contactInput) contactInput.value = chosen.value;
                if (chosen.dataset.phone && phoneInput) {
                    phoneInput.value = chosen.dataset.phone;
                } else if (client.phone && phoneInput) {
                    phoneInput.value = client.phone;
                }
            }
        }
    } else {
        // Fallback: client has no extra contacts, create a default option with client's name & phone
        contactSelect.disabled = false;
        const opt = document.createElement('option');
        opt.value = client.name;
        opt.textContent = `${client.name}${client.phone ? ` (${client.phone})` : ''}`;
        opt.dataset.phone = client.phone || '';
        contactSelect.appendChild(opt);
        contactSelect.value = client.name;
        if (contactInput) contactInput.value = client.name;
        if (phoneInput && client.phone) phoneInput.value = client.phone;
    }
};

window.handleServiceContactPersonSelect = function(val) {
    const contactInput = document.getElementById('swContactPerson');
    const contactSelect = document.getElementById('swContactPersonSelect');
    const phoneInput = document.getElementById('swClientPhone');

    if (contactInput) contactInput.value = val || '';

    if (contactSelect && phoneInput) {
        const chosen = contactSelect.options[contactSelect.selectedIndex];
        if (chosen && chosen.dataset.phone) {
            phoneInput.value = chosen.dataset.phone;
        }
    }
};

function populateServiceClientsSelect(selectedClientName = null, selectedContact = null) {
    const sel = document.getElementById('swClientSelect');
    if (!sel) return;
    sel.innerHTML = '<option value="">-- اختر العميل --</option>';
    allServicesClients.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.name;
        opt.textContent = c.company ? `${c.name} (${c.company})` : c.name;
        sel.appendChild(opt);
    });

    if (selectedClientName) {
        sel.value = selectedClientName;
        handleServiceClientSelect(selectedClientName, selectedContact);
    } else {
        sel.value = '';
        handleServiceClientSelect('');
    }
}

async function loadUsersIntoSelect(selectId) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    sel.innerHTML = '<option value="">-- اختر مسؤول التنفيذ --</option>';
    try {
        const res = await authFetch(USERS_BASIC_URL);
        if (res.ok) {
            const users = await res.json();
            users.forEach(u => {
                const opt = document.createElement('option');
                opt.value = u.full_name || u.username;
                opt.textContent = `${u.full_name || u.username}${u.job_title ? ` - ${u.job_title}` : ''}`;
                sel.appendChild(opt);
            });
        }
    } catch (e) {
        console.error('Failed to load users for select', e);
    }
}

window.updateServiceAttachmentsList = function(input) {
    if (input.files && input.files.length > 0) {
        for (let i = 0; i < input.files.length; i++) {
            serviceWizardSelectedFiles.push(input.files[i]);
        }
    }
    renderServiceWizardSelectedFiles();
    input.value = '';
};

function renderServiceWizardSelectedFiles() {
    const container = document.getElementById('swAttachmentsList');
    if (!container) return;
    if (serviceWizardSelectedFiles.length === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = serviceWizardSelectedFiles.map((file, idx) => `
        <div class="flex justify-between items-center bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs">
            <div class="flex items-center gap-2 overflow-hidden">
                <span class="text-teal-600">📎</span>
                <span class="font-bold text-slate-800 truncate">${escapeHtml(file.name)}</span>
                <span class="text-slate-400 text-[11px]">(${(file.size / 1024).toFixed(1)} KB)</span>
            </div>
            <button type="button" onclick="removeServiceWizardFile(${idx})" class="text-rose-500 hover:text-rose-700 font-bold px-2 py-1">
                ✕
            </button>
        </div>
    `).join('');
}

window.removeServiceWizardFile = function(idx) {
    serviceWizardSelectedFiles.splice(idx, 1);
    renderServiceWizardSelectedFiles();
};

// Wizard Submission (Create or Edit)
window.handleServiceWizardSubmit = async function(e) {
    if (e && e.preventDefault) e.preventDefault();

    const editJobId = document.getElementById('swJobId')?.value;
    const name = (document.getElementById('swName')?.value || '').trim();
    const job_number = (document.getElementById('swJobNumber')?.value || '').trim();
    const client_name = (document.getElementById('swClientName')?.value || '').trim();
    const contact_person = (document.getElementById('swContactPerson')?.value || '').trim();

    if (!name || !client_name) {
        showToast('يرجى ملء الحقول الإلزامية: اسم العمل واختيار العميل', 'bg-amber-500', '⚠️');
        goToServiceWizardStep(1);
        return;
    }
    if (!contact_person) {
        showToast('يرجى اختيار مسؤول التواصل للعميل المحدد', 'bg-amber-500', '⚠️');
        goToServiceWizardStep(1);
        return;
    }

    const btn = document.getElementById('btnSubmitServiceJob');
    const originalText = btn ? btn.innerHTML : '';
    if (btn) {
        btn.innerHTML = `
            <div class="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            <span>جاري الحفظ...</span>
        `;
        btn.disabled = true;
    }

    try {
        const payload = {
            name: name,
            job_number: job_number || null,
            client_name: client_name,
            client_phone: (document.getElementById('swClientPhone')?.value || '').trim() || null,
            contact_person: contact_person || null,
            received_date: document.getElementById('swReceivedDate')?.value ? new Date(document.getElementById('swReceivedDate').value).toISOString() : null,
            expected_delivery_date: document.getElementById('swDeliveryDate')?.value ? new Date(document.getElementById('swDeliveryDate').value).toISOString() : null,
            assigned_to: document.getElementById('swAssignedTo')?.value || null,

            op_design: !!document.getElementById('swOpDesign')?.checked,
            op_laser_cutting: !!document.getElementById('swOpLaser')?.checked,
            op_bending: !!document.getElementById('swOpBending')?.checked,
            op_punching: !!document.getElementById('swOpPunching')?.checked,
            op_welding: !!document.getElementById('swOpWelding')?.checked,
            op_painting: !!document.getElementById('swOpPainting')?.checked,

            sheet_thickness: document.getElementById('swSheetThickness')?.value ? parseFloat(document.getElementById('swSheetThickness').value) : null,
            sheet_ownership: document.getElementById('swSheetOwnership')?.value || null,
            sheet_type: document.getElementById('swSheetType')?.value || null,
            notes: (document.getElementById('swNotes')?.value || '').trim() || null,

            final_price: document.getElementById('swFinalPrice')?.value ? parseFloat(document.getElementById('swFinalPrice').value) : 0.0,
            tax_inclusive: !!document.getElementById('swTaxInclusive')?.checked,
            cutting_length: document.getElementById('swCuttingLength')?.value ? parseFloat(document.getElementById('swCuttingLength').value) : null,
            bends_count: document.getElementById('swBendsCount')?.value ? parseInt(document.getElementById('swBendsCount').value) : null,
            punch_strokes_count: document.getElementById('swPunchStrokesCount')?.value ? parseInt(document.getElementById('swPunchStrokesCount').value) : null,
            expected_duration: (document.getElementById('swExpectedDuration')?.value || '').trim() || null
        };

        let res;
        if (editJobId) {
            res = await authFetch(`${SERVICES_URL}/${editJobId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } else {
            payload.status = "قيد التنفيذ";
            res = await authFetch(SERVICES_URL + '/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        }

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || 'فشل حفظ بيانات العمل');
        }

        const savedJob = await res.json();

        // Upload selected attachments if any
        if (serviceWizardSelectedFiles.length > 0) {
            for (const file of serviceWizardSelectedFiles) {
                const fd = new FormData();
                fd.append('file', file);
                await authFetch(`${SERVICES_URL}/${savedJob.id}/attachments/`, {
                    method: 'POST',
                    body: fd
                });
            }
        }

        showToast(editJobId ? 'تم تحديث بيانات العمل بنجاح!' : 'تمت إضافة العمل بنجاح!', 'bg-emerald-500', '✓');
        viewServiceJobDetails(savedJob.id);
    } catch (err) {
        console.error(err);
        showToast(err.message || 'حدث خطأ أثناء حفظ العمل', 'bg-rose-500', '✗');
    } finally {
        if (btn) {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }
};

// --- SERVICE JOB DETAILS VIEW ---

window.viewServiceJobDetails = async function(jobId, fromHistory = false) {
    if (!fromHistory) {
        pushNavigationState('serviceJobDetail', { id: jobId });
    }

    const viewsToHide = [
        'moduleSelectorView', 'projectsView', 'projectWizardView', 'projectDetailView',
        'departmentsView', 'subDeptView', 'departmentDetailView', 'adminView',
        'purchasingView', 'purchaseRequestDetailView', 'hrView',
        'servicesView', 'serviceWizardView'
    ];
    viewsToHide.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });

    const jdView = document.getElementById('serviceJobDetailView');
    if (jdView) jdView.classList.remove('hidden');

    try {
        const res = await authFetch(`${SERVICES_URL}/${jobId}`);
        if (!res.ok) throw new Error('فشل جلب تفاصيل العمل');
        const job = await res.json();
        currentServiceJobData = job;
        renderServiceJobDetails(job);
    } catch (e) {
        console.error(e);
        showToast(e.message || 'خطأ أثناء تحميل تفاصيل العمل', 'bg-rose-500', '✗');
        showServicesView();
    }
};

function renderServiceJobDetails(job) {
    document.getElementById('sjdName').textContent = job.name || 'بدون اسم';
    document.getElementById('sjdSubtitle').textContent = `رقم الإنتاج: ${job.job_number || '-'} | العميل: ${job.client_name || '-'}`;
    
    // Status Badge & Selector
    const badge = document.getElementById('sjdStatusBadge');
    const select = document.getElementById('sjdStatusSelect');
    if (select) select.value = job.status || 'قيد التنفيذ';

    if (badge) {
        if (job.status === 'قيد الانتظار') {
            badge.className = 'px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-bold';
        } else if (job.status === 'قيد التنفيذ') {
            badge.className = 'px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-bold';
        } else if (job.status === 'مكتمل') {
            badge.className = 'px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold';
        } else if (job.status === 'تم التسليم') {
            badge.className = 'px-3 py-1 bg-teal-50 text-teal-700 border border-teal-200 rounded-full text-xs font-bold';
        } else {
            badge.className = 'px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-bold';
        }
        badge.textContent = job.status || 'قيد التنفيذ';
    }

    // Card 1: Basic Info
    document.getElementById('sjdJobNumber').textContent = job.job_number || '-';
    document.getElementById('sjdJobNameVal').textContent = job.name || '-';
    document.getElementById('sjdAssignedTo').textContent = job.assigned_to || 'غير محدد';
    document.getElementById('sjdReceivedDate').textContent = job.received_date ? job.received_date.split('T')[0] : '-';
    document.getElementById('sjdDeliveryDate').textContent = job.expected_delivery_date ? job.expected_delivery_date.split('T')[0] : '-';
    document.getElementById('sjdCreatedAt').textContent = job.created_at ? job.created_at.split('T')[0] : '-';

    // Card 2: Client Info
    document.getElementById('sjdClientName').textContent = job.client_name || '-';
    const contactPersonEl = document.getElementById('sjdContactPerson');
    if (contactPersonEl) contactPersonEl.textContent = job.contact_person || '-';
    document.getElementById('sjdClientPhone').textContent = job.client_phone || '-';
    const phoneBtn = document.getElementById('sjdPhoneCallBtn');
    if (phoneBtn) {
        if (job.client_phone) {
            phoneBtn.href = `tel:${job.client_phone}`;
            phoneBtn.classList.remove('pointer-events-none', 'opacity-50');
        } else {
            phoneBtn.href = '#';
            phoneBtn.classList.add('pointer-events-none', 'opacity-50');
        }
    }

    // Card 3: Operations Badges
    const opContainer = document.getElementById('sjdOperationsList');
    if (opContainer) {
        const ops = [];
        if (job.op_design) ops.push('<span class="bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5"><span>🎨</span> تصميم</span>');
        if (job.op_laser_cutting) ops.push('<span class="bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5"><span>⚡</span> قص ليزر</span>');
        if (job.op_bending) ops.push('<span class="bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5"><span>📐</span> تطعيج</span>');
        if (job.op_punching) ops.push('<span class="bg-purple-50 text-purple-700 border border-purple-200 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5"><span>🔘</span> بنش</span>');
        if (job.op_welding) ops.push('<span class="bg-orange-50 text-orange-700 border border-orange-200 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5"><span>🔥</span> لحام</span>');
        if (job.op_painting) ops.push('<span class="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5"><span>🖌️</span> دهان</span>');

        opContainer.innerHTML = ops.length > 0 ? ops.join('') : '<p class="text-xs text-slate-400">لم يتم تحديد عمليات تصنيع</p>';
    }

    // Card 4: Sheet Specs
    document.getElementById('sjdSheetThickness').textContent = job.sheet_thickness ? `${job.sheet_thickness} ملم` : 'غير محدد';
    document.getElementById('sjdSheetOwnership').textContent = job.sheet_ownership || 'غير محدد';
    document.getElementById('sjdSheetType').textContent = job.sheet_type || 'غير محدد';
    document.getElementById('sjdNotes').textContent = job.notes || 'لا توجد ملاحظات إضافية.';

    // Card 5: Pricing & Specs
    const priceVal = job.final_price !== null && job.final_price !== undefined ? parseFloat(job.final_price).toFixed(2) : '0.00';
    document.getElementById('sjdFinalPrice').textContent = `${priceVal} د.أ`;
    document.getElementById('sjdTaxStatus').textContent = job.tax_inclusive ? 'شامل ضريبة المبيعات' : 'غير شامل الضريبة';
    document.getElementById('sjdCuttingLength').textContent = job.cutting_length ? `${job.cutting_length} متر` : '-';
    document.getElementById('sjdBendsCount').textContent = job.bends_count !== null && job.bends_count !== undefined ? `${job.bends_count}` : '-';
    document.getElementById('sjdPunchStrokesCount').textContent = job.punch_strokes_count !== null && job.punch_strokes_count !== undefined ? `${job.punch_strokes_count}` : '-';
    document.getElementById('sjdExpectedDuration').textContent = job.expected_duration || '-';

    // Card 6: Attachments
    renderServiceJobAttachments(job.attachments || []);
}

function renderServiceJobAttachments(attachments) {
    const list = document.getElementById('sjdAttachmentsList');
    if (!list) return;
    if (!attachments || attachments.length === 0) {
        list.innerHTML = '<p class="text-xs text-slate-400 py-3 text-center">لا توجد ملفات مرفقة لهذا العمل.</p>';
        return;
    }

    list.innerHTML = attachments.map(att => `
        <div class="flex justify-between items-center bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs">
            <a href="${att.file_url}" target="_blank" class="flex items-center gap-2 text-slate-700 hover:text-teal-600 font-bold overflow-hidden truncate">
                <span class="text-teal-600">📄</span>
                <span class="truncate">${escapeHtml(att.file_name)}</span>
            </a>
            <div class="flex items-center gap-1">
                <a href="${att.file_url}" download class="p-1 text-slate-400 hover:text-slate-600" title="تحميل">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                </a>
                <button onclick="deleteServiceAttachmentById(${att.id})" class="p-1 text-rose-400 hover:text-rose-600" title="حذف">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
            </div>
        </div>
    `).join('');
}

window.handleServiceJobStatusChange = async function(newStatus) {
    if (!currentServiceJobData) return;
    try {
        const res = await authFetch(`${SERVICES_URL}/${currentServiceJobData.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        if (!res.ok) throw new Error('فشل تحديث حالة العمل');
        currentServiceJobData.status = newStatus;
        renderServiceJobDetails(currentServiceJobData);
        showToast('تم تحديث حالة العمل بنجاح', 'bg-emerald-500', '✓');
    } catch (e) {
        showToast(e.message, 'bg-rose-500', '✗');
    }
};

window.uploadAdditionalServiceAttachment = async function(input) {
    if (!currentServiceJobData || !input.files || input.files.length === 0) return;
    const file = input.files[0];
    const fd = new FormData();
    fd.append('file', file);

    try {
        const res = await authFetch(`${SERVICES_URL}/${currentServiceJobData.id}/attachments/`, {
            method: 'POST',
            body: fd
        });
        if (!res.ok) throw new Error('فشل رفع الملف');
        const newAtt = await res.json();
        currentServiceJobData.attachments = currentServiceJobData.attachments || [];
        currentServiceJobData.attachments.push(newAtt);
        renderServiceJobAttachments(currentServiceJobData.attachments);
        showToast('تم رفع الملف بنجاح', 'bg-emerald-500', '✓');
    } catch (e) {
        showToast(e.message, 'bg-rose-500', '✗');
    } finally {
        input.value = '';
    }
};

window.deleteServiceAttachmentById = async function(attId) {
    if (!confirm('هل أنت متأكد من حذف هذا المرفق؟')) return;
    try {
        const res = await authFetch(`${SERVICES_URL}/attachments/${attId}`, {
            method: 'DELETE'
        });
        if (!res.ok) throw new Error('فشل حذف المرفق');
        if (currentServiceJobData) {
            currentServiceJobData.attachments = (currentServiceJobData.attachments || []).filter(a => a.id !== attId);
            renderServiceJobAttachments(currentServiceJobData.attachments);
        }
        showToast('تم حذف المرفق بنجاح', 'bg-emerald-500', '✓');
    } catch (e) {
        showToast(e.message, 'bg-rose-500', '✗');
    }
};

window.deleteCurrentServiceJob = async function() {
    if (!currentServiceJobData) return;
    deleteServiceJobById(currentServiceJobData.id, true);
};

window.deleteServiceJobById = async function(jobId, fromDetails = false) {
    if (!confirm('هل أنت متأكد من حذف هذا العمل نهائياً؟')) return;
    try {
        const res = await authFetch(`${SERVICES_URL}/${jobId}`, {
            method: 'DELETE'
        });
        if (!res.ok) throw new Error('فشل حذف العمل');
        showToast('تم حذف العمل بنجاح', 'bg-emerald-500', '✓');
        if (fromDetails) {
            showServicesView();
        } else {
            loadServicesJobs();
        }
    } catch (e) {
        showToast(e.message, 'bg-rose-500', '✗');
    }
};

// --- SERVICE REPORT & RECEIPT MODAL (PDF / PRINT) ---

window.openServiceReportModal = function() {
    const job = currentServiceJobData;
    if (!job) return;

    // Operations list string
    const ops = [];
    if (job.op_design) ops.push('تصميم');
    if (job.op_laser_cutting) ops.push('قص ليزر');
    if (job.op_bending) ops.push('تطعيج');
    if (job.op_punching) ops.push('بنش');
    if (job.op_welending) ops.push('لحام');
    if (job.op_welding) ops.push('لحام');
    if (job.op_painting) ops.push('دهان');
    // Deduplicate
    const uniqueOps = [...new Set(ops)];
    const opsText = uniqueOps.length > 0 ? uniqueOps.join(' + ') : 'غير محدد';

    const priceText = job.final_price !== null && job.final_price !== undefined ? 
        `${parseFloat(job.final_price).toFixed(2)} د.أ (${job.tax_inclusive ? 'شامل الضريبة' : 'غير شامل الضريبة'})` : '-';

    // Populate Page 1 (Work Details Report Table)
    document.getElementById('repJobNumber').textContent = job.job_number || '-';
    document.getElementById('repCreatedAt').textContent = job.created_at ? job.created_at.split('T')[0] : '-';
    document.getElementById('repDeliveryDate').textContent = job.expected_delivery_date ? job.expected_delivery_date.split('T')[0] : '-';
    
    document.getElementById('repJobName').textContent = job.name || '-';
    document.getElementById('repClientName').textContent = job.client_name || '-';
    const repContactEl = document.getElementById('repContactPerson');
    if (repContactEl) repContactEl.textContent = job.contact_person || '-';
    document.getElementById('repClientPhone').textContent = job.client_phone || '-';
    document.getElementById('repAssignedTo').textContent = job.assigned_to || 'غير محدد';
    document.getElementById('repReceivedDate').textContent = job.received_date ? job.received_date.split('T')[0] : '-';
    document.getElementById('repStatus').textContent = job.status || '-';

    document.getElementById('repOperations').textContent = opsText;
    document.getElementById('repSheetThickness').textContent = job.sheet_thickness ? `${job.sheet_thickness} ملم` : '-';
    document.getElementById('repSheetType').textContent = job.sheet_type || '-';
    document.getElementById('repSheetOwnership').textContent = job.sheet_ownership || '-';

    document.getElementById('repCuttingLength').textContent = job.cutting_length ? `${job.cutting_length} متر` : '-';
    document.getElementById('repBendsCount').textContent = job.bends_count !== null && job.bends_count !== undefined ? `${job.bends_count}` : '-';
    document.getElementById('repPunchStrokes').textContent = job.punch_strokes_count !== null && job.punch_strokes_count !== undefined ? `${job.punch_strokes_count}` : '-';
    document.getElementById('repExpectedDuration').textContent = job.expected_duration || '-';
    document.getElementById('repFinalPrice').textContent = priceText;
    document.getElementById('repNotes').textContent = job.notes || 'لا توجد ملاحظات.';

    // Populate Page 2 (Delivery / Receipt Voucher)
    document.getElementById('recJobNumber').textContent = `رقم الإنتاج: ${job.job_number || '-'}`;
    document.getElementById('recJobName').textContent = job.name || '-';
    document.getElementById('recProdNumber').textContent = job.job_number || '-';
    document.getElementById('recClientName').textContent = job.client_name || '-';
    const recContactEl = document.getElementById('recContactPerson');
    if (recContactEl) recContactEl.textContent = job.contact_person || '-';
    document.getElementById('recClientPhone').textContent = job.client_phone || '-';
    document.getElementById('recOperations').textContent = opsText;
    document.getElementById('recSheetInfo').textContent = `سماكة ${job.sheet_thickness || '-'} ملم - صاج ${job.sheet_type || '-'} (${job.sheet_ownership || '-'})`;
    document.getElementById('recFinalPrice').textContent = priceText;

    const modal = document.getElementById('serviceReportModal');
    if (modal) modal.classList.remove('hidden');
};

window.closeServiceReportModal = function() {
    const modal = document.getElementById('serviceReportModal');
    if (modal) modal.classList.add('hidden');
};

window.printServiceReport = function() {
    window.print();
};

// --- SERVICE CLIENTS LOGIC ---

async function loadServicesClients() {
    const loading = document.getElementById('servicesClientsLoading');
    const tbody = document.getElementById('servicesClientsTableBody');
    if (!tbody) return;

    if (loading) loading.classList.remove('hidden');
    tbody.innerHTML = '';

    try {
        const res = await authFetch(SERVICE_CLIENTS_URL + '/');
        if (!res.ok) throw new Error('فشل تحميل قائمة العملاء');
        allServicesClients = await res.json();
        populateServiceClientsSelect();
        renderServicesClientsTable(allServicesClients);
        updateServicesStats();
    } catch (e) {
        console.error(e);
    } finally {
        if (loading) loading.classList.add('hidden');
    }
}

function renderServicesClientsTable(clients) {
    const tbody = document.getElementById('servicesClientsTableBody');
    if (!tbody) return;

    if (clients.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-slate-400">لا يوجد عملاء مسجلين حالياً.</td></tr>';
        return;
    }

    tbody.innerHTML = clients.map(c => {
        // Parse contacts if available
        let contactsList = [];
        if (c.contacts) {
            try {
                contactsList = typeof c.contacts === 'string' ? JSON.parse(c.contacts) : c.contacts;
            } catch (e) {
                contactsList = [];
            }
        }

        let contactsHtml = '';
        if (Array.isArray(contactsList) && contactsList.length > 0) {
            contactsHtml = `
                <div class="space-y-1">
                    ${contactsList.map(cnt => `
                        <div class="text-xs flex items-center gap-1.5 bg-slate-50 border border-slate-200/60 px-2 py-0.5 rounded-md">
                            <span class="font-bold text-slate-800">${escapeHtml(cnt.name || '')}</span>
                            ${cnt.phone ? `<span class="text-slate-500 font-mono" dir="ltr">(${escapeHtml(cnt.phone)})</span>` : ''}
                        </div>
                    `).join('')}
                </div>
            `;
        } else {
            contactsHtml = '<span class="text-slate-400 text-xs">-</span>';
        }

        return `
            <tr class="hover:bg-slate-50 transition border-b border-slate-100">
                <td class="p-4 font-bold text-slate-900">${escapeHtml(c.name)}</td>
                <td class="p-4 text-slate-600 font-semibold" dir="ltr">${escapeHtml(c.phone || '-')}</td>
                <td class="p-4 text-slate-600">${escapeHtml(c.company || '-')}</td>
                <td class="p-4">${contactsHtml}</td>
                <td class="p-4 text-center">
                    <span class="px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 font-bold text-xs">
                        ${c.jobs_count || 0} عمل
                    </span>
                </td>
                <td class="p-4 text-slate-500 text-xs">${escapeHtml(c.notes || '-')}</td>
                <td class="p-4 text-center">
                    <div class="flex items-center justify-center gap-1.5">
                        <button onclick="openServiceClientModal(${c.id})" class="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition" title="تعديل">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button onclick="deleteServiceClient(${c.id})" class="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition" title="حذف">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

window.filterServicesClientsTable = function() {
    const q = (document.getElementById('searchServicesClientsInput')?.value || '').trim().toLowerCase();
    if (!q) {
        renderServicesClientsTable(allServicesClients);
        return;
    }
    const filtered = allServicesClients.filter(c => 
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.phone && c.phone.includes(q)) ||
        (c.company && c.company.toLowerCase().includes(q)) ||
        (c.contacts && c.contacts.toLowerCase().includes(q))
    );
    renderServicesClientsTable(filtered);
};

window.addServiceClientContactRow = function(name = '', phone = '') {
    const container = document.getElementById('scmContactsContainer');
    if (!container) return;

    const rowIdx = container.children.length + 1;
    const div = document.createElement('div');
    div.className = 'flex items-center gap-2 scm-contact-row bg-slate-50 p-2 rounded-xl border border-slate-200';
    div.innerHTML = `
        <div class="flex-1">
            <input type="text" placeholder="اسم المسؤول ${rowIdx}" value="${escapeHtml(name)}" class="scm-contact-name w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-teal-500">
        </div>
        <div class="flex-1">
            <input type="text" placeholder="رقم هاتف المسؤول ${rowIdx}" value="${escapeHtml(phone)}" class="scm-contact-phone w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-teal-500" dir="ltr">
        </div>
        ${rowIdx > 1 ? `
            <button type="button" onclick="this.closest('.scm-contact-row').remove(); reindexServiceClientContactRows();" class="p-1.5 text-rose-500 hover:text-rose-700 transition" title="إزالة المسؤول">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
        ` : `<div class="w-7"></div>`}
    `;
    container.appendChild(div);
};

window.reindexServiceClientContactRows = function() {
    const container = document.getElementById('scmContactsContainer');
    if (!container) return;
    const rows = container.querySelectorAll('.scm-contact-row');
    rows.forEach((r, idx) => {
        const nameInput = r.querySelector('.scm-contact-name');
        const phoneInput = r.querySelector('.scm-contact-phone');
        if (nameInput) nameInput.placeholder = `اسم المسؤول ${idx + 1}`;
        if (phoneInput) phoneInput.placeholder = `رقم هاتف المسؤول ${idx + 1}`;
    });
};

window.openServiceClientModal = function(clientId = null) {
    const title = document.getElementById('serviceClientModalTitle');
    const idInput = document.getElementById('scmClientId');
    const nameInput = document.getElementById('scmName');
    const phoneInput = document.getElementById('scmPhone');
    const companyInput = document.getElementById('scmCompany');
    const notesInput = document.getElementById('scmNotes');
    const contactsContainer = document.getElementById('scmContactsContainer');

    if (contactsContainer) contactsContainer.innerHTML = '';

    if (clientId) {
        const client = allServicesClients.find(c => c.id === clientId);
        if (!client) return;
        if (title) title.textContent = 'تعديل بيانات العميل';
        if (idInput) idInput.value = client.id;
        if (nameInput) nameInput.value = client.name || '';
        if (phoneInput) phoneInput.value = client.phone || '';
        if (companyInput) companyInput.value = client.company || '';
        if (notesInput) notesInput.value = client.notes || '';

        // Contacts
        let list = [];
        if (client.contacts) {
            try {
                list = typeof client.contacts === 'string' ? JSON.parse(client.contacts) : client.contacts;
            } catch (e) {
                list = [];
            }
        }
        if (Array.isArray(list) && list.length > 0) {
            list.forEach(c => addServiceClientContactRow(c.name || '', c.phone || ''));
        } else {
            addServiceClientContactRow('', '');
        }
    } else {
        if (title) title.textContent = 'إضافة عميل جديد';
        if (idInput) idInput.value = '';
        if (nameInput) nameInput.value = '';
        if (phoneInput) phoneInput.value = '';
        if (companyInput) companyInput.value = '';
        if (notesInput) notesInput.value = '';
        addServiceClientContactRow('', '');
    }

    const modal = document.getElementById('serviceClientModal');
    if (modal) modal.classList.remove('hidden');
};

window.closeServiceClientModal = function() {
    const modal = document.getElementById('serviceClientModal');
    if (modal) modal.classList.add('hidden');
};

window.handleServiceClientSubmit = async function(e) {
    e.preventDefault();
    const id = document.getElementById('scmClientId')?.value;
    const name = document.getElementById('scmName')?.value.trim();
    const phone = document.getElementById('scmPhone')?.value.trim() || null;
    const company = document.getElementById('scmCompany')?.value.trim() || null;
    const notes = document.getElementById('scmNotes')?.value.trim() || null;

    if (!name) {
        showToast('اسم العميل مطلوب', 'bg-amber-500', '⚠️');
        return;
    }

    // Collect Contacts
    const contacts = [];
    const contactRows = document.querySelectorAll('#scmContactsContainer .scm-contact-row');
    contactRows.forEach(row => {
        const cName = (row.querySelector('.scm-contact-name')?.value || '').trim();
        const cPhone = (row.querySelector('.scm-contact-phone')?.value || '').trim();
        if (cName || cPhone) {
            contacts.push({ name: cName, phone: cPhone });
        }
    });

    const contactsJson = contacts.length > 0 ? JSON.stringify(contacts) : null;

    const payload = {
        name,
        phone,
        company,
        contacts: contactsJson,
        notes
    };

    try {
        let res;
        if (id) {
            res = await authFetch(`${SERVICE_CLIENTS_URL}/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } else {
            res = await authFetch(SERVICE_CLIENTS_URL + '/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        }

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || 'فشل حفظ بيانات العميل');
        }

        showToast('تم حفظ بيانات العميل بنجاح', 'bg-emerald-500', '✓');
        closeServiceClientModal();
        loadServicesClients();
    } catch (err) {
        showToast(err.message, 'bg-rose-500', '✗');
    }
};

window.deleteServiceClient = async function(clientId) {
    if (!confirm('هل أنت متأكد من رغبتك في حذف هذا العميل؟')) return;
    try {
        const res = await authFetch(`${SERVICE_CLIENTS_URL}/${clientId}`, {
            method: 'DELETE'
        });
        if (!res.ok) throw new Error('فشل حذف العميل');
        showToast('تم حذف العميل بنجاح', 'bg-emerald-500', '✓');
        loadServicesClients();
    } catch (e) {
        showToast(e.message, 'bg-rose-500', '✗');
    }
};

