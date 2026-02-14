/**
 * Plateful - Food Redistribution Platform
 * Main Application JavaScript
 */

// ============ Configuration ============
const API = '/api';

// ============ State Management ============
let currentPage = 'dashboard';
let foodItems = [];
let filteredItems = [];
let currentFilter = 'all';
let currentUser = null; // null = guest

// ============ DOM Elements ============
const elements = {
  // Navigation
  navLinks: document.querySelectorAll('.nav-link'),
  navToggle: document.getElementById('nav-toggle'),
  mobileNav: document.getElementById('mobile-nav'),

  // Auth nav elements
  navUserInfo: document.getElementById('nav-user-info'),
  navLoginBtn: document.getElementById('nav-login-btn'),
  navLogoutBtn: document.getElementById('nav-logout-btn'),
  mobileLoginBtn: document.getElementById('mobile-login-btn'),
  mobileLogoutBtn: document.getElementById('mobile-logout-btn'),

  // Pages
  pages: document.querySelectorAll('.page'),

  // Dashboard
  statTotalItems: document.getElementById('stat-total-items'),
  statExpiring: document.getElementById('stat-expiring'),
  statQuantity: document.getElementById('stat-quantity'),
  recentDonations: document.getElementById('recent-donations'),

  // Donations
  donationsGrid: document.getElementById('donations-grid'),
  searchDonations: document.getElementById('search-donations'),
  filterButtons: document.querySelectorAll('.filter-btn'),

  // Alerts
  urgentAlerts: document.getElementById('urgent-alerts'),
  warningAlerts: document.getElementById('warning-alerts'),
  infoAlerts: document.getElementById('info-alerts'),

  // Donation Modal
  modal: document.getElementById('add-donation-modal'),
  form: document.getElementById('add-form'),
  nameInput: document.getElementById('name'),
  qtyInput: document.getElementById('qty'),
  expInput: document.getElementById('exp'),
  categoryInput: document.getElementById('category'),
  notesInput: document.getElementById('notes'),

  // Auth elements
  loginForm: document.getElementById('login-form'),
  registerForm: document.getElementById('register-form'),
  loginToggle: document.getElementById('login-toggle'),
  registerToggle: document.getElementById('register-toggle'),
  registerRole: document.getElementById('register-role'),
  orgNameGroup: document.getElementById('org-name-group'),
  orgNameLabel: document.getElementById('org-name-label'),
  guestBtn: document.getElementById('guest-btn'),

  // Toast
  toastContainer: document.getElementById('toast-container')
};

// ============ Initialization ============
document.addEventListener('DOMContentLoaded', async () => {
  initNavigation();
  initModal();
  initFilterButtons();
  initForm();
  initQuickActions();
  initAuth();
  setMinDate();

  // Check session on load
  await checkSession();
});

// ============ Auth System ============
function initAuth() {
  // Login/Register toggle
  elements.loginToggle.addEventListener('click', () => {
    elements.loginToggle.classList.add('active');
    elements.registerToggle.classList.remove('active');
    elements.loginForm.style.display = '';
    elements.registerForm.style.display = 'none';
  });

  elements.registerToggle.addEventListener('click', () => {
    elements.registerToggle.classList.add('active');
    elements.loginToggle.classList.remove('active');
    elements.registerForm.style.display = '';
    elements.loginForm.style.display = 'none';
  });

  // Role selector — show/hide org name field
  elements.registerRole.addEventListener('change', () => {
    const role = elements.registerRole.value;
    if (role === 'company' || role === 'charity') {
      elements.orgNameGroup.style.display = '';
      elements.orgNameLabel.textContent = role === 'company' ? 'Company Name' : 'Charity Name';
      document.getElementById('register-org-name').placeholder = role === 'company' ? 'Enter company name' : 'Enter charity name';
      document.getElementById('register-org-name').required = true;
    } else {
      elements.orgNameGroup.style.display = 'none';
      document.getElementById('register-org-name').required = false;
    }
  });

  // Login form submit
  elements.loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;

    if (!username || !password) {
      showToast('Please fill in all fields', 'error');
      return;
    }

    try {
      const res = await fetch(`${API}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (res.ok) {
        currentUser = data;
        showToast(`Welcome back, ${data.username}!`, 'success');
        updateUIForRole();
        navigateTo('dashboard');
        loadData();
      } else {
        showToast(data.error || 'Login failed', 'error');
      }
    } catch (e) {
      console.error('Login error:', e);
      showToast('Login failed. Please try again.', 'error');
    }
  });

  // Register form submit
  elements.registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('register-username').value.trim();
    const password = document.getElementById('register-password').value;
    const role = elements.registerRole.value;
    const organizationName = document.getElementById('register-org-name').value.trim();

    if (!username || !password) {
      showToast('Please fill in all fields', 'error');
      return;
    }

    if ((role === 'company' || role === 'charity') && !organizationName) {
      showToast(`Please enter your ${role} name`, 'error');
      return;
    }

    try {
      const res = await fetch(`${API}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, role, organizationName: organizationName || null })
      });
      const data = await res.json();
      if (res.ok) {
        currentUser = data;
        showToast(`Account created! Welcome, ${data.username}!`, 'success');
        updateUIForRole();
        navigateTo('dashboard');
        loadData();
      } else {
        showToast(data.error || 'Registration failed', 'error');
      }
    } catch (e) {
      console.error('Register error:', e);
      showToast('Registration failed. Please try again.', 'error');
    }
  });

  // Guest button
  elements.guestBtn.addEventListener('click', () => {
    currentUser = null;
    updateUIForRole();
    navigateTo('dashboard');
    loadData();
  });

  // Logout handler (added to data-action system)
}

async function checkSession() {
  try {
    const res = await fetch(`${API}/session`);
    const data = await res.json();
    if (data) {
      currentUser = data;
    } else {
      currentUser = null;
    }
  } catch (e) {
    currentUser = null;
  }
  updateUIForRole();
  loadData();
}

async function logout() {
  try {
    await fetch(`${API}/logout`, { method: 'POST' });
  } catch (e) {
    console.error('Logout error:', e);
  }
  currentUser = null;
  updateUIForRole();
  showToast('You have been logged out', 'info');
  navigateTo('login');
}

function updateUIForRole() {
  const role = currentUser ? currentUser.role : 'guest';
  const isLoggedIn = currentUser !== null;

  // Update nav auth buttons
  if (isLoggedIn) {
    elements.navLoginBtn.style.display = 'none';
    elements.navLogoutBtn.style.display = '';
    elements.navUserInfo.style.display = '';
    elements.navUserInfo.textContent = getRoleDisplay(currentUser);
    if (elements.mobileLoginBtn) elements.mobileLoginBtn.style.display = 'none';
    if (elements.mobileLogoutBtn) elements.mobileLogoutBtn.style.display = '';
  } else {
    elements.navLoginBtn.style.display = '';
    elements.navLogoutBtn.style.display = 'none';
    elements.navUserInfo.style.display = 'none';
    if (elements.mobileLoginBtn) elements.mobileLoginBtn.style.display = '';
    if (elements.mobileLogoutBtn) elements.mobileLogoutBtn.style.display = 'none';
  }

  // Show/hide auth-required elements based on role
  document.querySelectorAll('.auth-required').forEach(el => {
    const allowedRoles = (el.dataset.authRole || '').split(',');
    if (allowedRoles.includes(role)) {
      el.style.display = '';
    } else {
      el.style.display = 'none';
    }
  });
}

function getRoleDisplay(user) {
  if (!user) return 'Guest';
  const roleName = user.role.charAt(0).toUpperCase() + user.role.slice(1);
  if (user.organizationName) {
    return `${user.organizationName} (${roleName})`;
  }
  return `${user.username} (${roleName})`;
}

// ============ Navigation ============
function initNavigation() {
  // Desktop & Mobile nav links
  document.querySelectorAll('[data-page]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const page = e.currentTarget.dataset.page;
      navigateTo(page);
    });
  });

  // Mobile nav toggle
  if (elements.navToggle) {
    elements.navToggle.addEventListener('click', () => {
      elements.mobileNav.classList.toggle('active');
    });
  }
}

function navigateTo(page) {
  // Update URL hash
  window.location.hash = page;

  // Update nav links
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
    if (link.dataset.page === page) {
      link.classList.add('active');
    }
  });

  // Show page
  elements.pages.forEach(p => {
    p.classList.remove('active');
    if (p.id === `${page}-page`) {
      p.classList.add('active');
    }
  });

  // Close mobile nav
  elements.mobileNav?.classList.remove('active');

  currentPage = page;

  // Refresh data for specific pages
  if (page === 'donations') {
    renderDonationsGrid();
  } else if (page === 'alerts') {
    renderAlerts();
  }
}

// Handle browser back/forward
window.addEventListener('hashchange', () => {
  const hash = window.location.hash.slice(1) || 'dashboard';
  navigateTo(hash);
});

// Initialize from URL hash
if (window.location.hash) {
  navigateTo(window.location.hash.slice(1));
}

// ============ Quick Actions ============
function initQuickActions() {
  document.querySelectorAll('[data-action]').forEach(el => {
    el.addEventListener('click', (e) => {
      const action = e.currentTarget.dataset.action;
      handleAction(action);
    });
  });
}

function handleAction(action) {
  switch (action) {
    case 'add-donation':
      if (!currentUser) {
        showToast('Please log in to donate items', 'info');
        navigateTo('login');
        return;
      }
      openModal();
      break;
    case 'close-modal':
      closeModal();
      break;
    case 'add-recipient':
      if (!currentUser) {
        showToast('Please log in first', 'info');
        navigateTo('login');
        return;
      }
      showToast('Organization registration coming soon!', 'info');
      break;
    case 'logout':
      logout();
      break;
    default:
      console.log('Unknown action:', action);
  }
}

// ============ Modal ============
function initModal() {
  // Close on overlay click
  elements.modal.querySelector('.modal-overlay').addEventListener('click', closeModal);

  // Close button
  elements.modal.querySelector('.modal-close').addEventListener('click', closeModal);

  // Close on escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && elements.modal.classList.contains('active')) {
      closeModal();
    }
  });
}

function openModal() {
  elements.modal.classList.add('active');
  elements.nameInput.focus();
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  elements.modal.classList.remove('active');
  elements.form.reset();
  elements.qtyInput.value = '1';
  document.body.style.overflow = '';
}

// ============ Form Handling ============
function initForm() {
  elements.form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const payload = {
      name: elements.nameInput.value.trim(),
      quantity: Number(elements.qtyInput.value),
      expirationDate: elements.expInput.value || null
    };

    if (!payload.name) {
      showToast('Please enter an item name', 'error');
      return;
    }

    try {
      const res = await fetch(`${API}/food`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        closeModal();
        showToast(`${payload.name} added to inventory!`, 'success');
        await loadData();
      } else {
        showToast('Failed to add item. Please try again.', 'error');
      }
    } catch (e) {
      console.error('Insert failed:', e);
      showToast('Failed to add item. Please check your connection.', 'error');
    }
  });
}

function setMinDate() {
  const today = new Date().toISOString().split('T')[0];
  elements.expInput.setAttribute('min', today);
}

// ============ Filter Buttons ============
function initFilterButtons() {
  elements.filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      elements.filterButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      filterDonations();
    });
  });

  // Search input
  if (elements.searchDonations) {
    elements.searchDonations.addEventListener('input', filterDonations);
  }
}

function filterDonations() {
  const searchTerm = elements.searchDonations?.value.toLowerCase() || '';

  filteredItems = foodItems.filter(item => {
    // Search filter
    if (searchTerm && !item.Name.toLowerCase().includes(searchTerm)) {
      return false;
    }

    // Status filter
    const daysUntil = getDaysUntilExpiration(item.ExpirationDate);
    switch (currentFilter) {
      case 'fresh':
        return daysUntil === null || daysUntil > 7;
      case 'expiring':
        return daysUntil !== null && daysUntil <= 7 && daysUntil > 3;
      case 'urgent':
        return daysUntil !== null && daysUntil <= 3;
      default:
        return true;
    }
  });

  renderDonationsGrid();
}

// ============ Data Loading ============
async function loadData() {
  try {
    const res = await fetch(`${API}/food`);
    foodItems = await res.json();
    filteredItems = [...foodItems];

    updateDashboard();
    renderRecentDonations();
    if (currentPage === 'donations') {
      renderDonationsGrid();
    }
    if (currentPage === 'alerts') {
      renderAlerts();
    }
  } catch (e) {
    console.error('Failed to load items:', e);
    showToast('Failed to load data. Please refresh the page.', 'error');
  }
}

// ============ Dashboard ============
function updateDashboard() {
  let expiringSoon = 0;
  let totalQty = 0;

  foodItems.forEach(item => {
    const daysUntil = getDaysUntilExpiration(item.ExpirationDate);
    if (daysUntil !== null && daysUntil <= 7 && daysUntil >= 0) {
      expiringSoon++;
    }
    totalQty += item.Quantity || 0;
  });

  // Animate numbers
  animateValue(elements.statTotalItems, foodItems.length);
  animateValue(elements.statExpiring, expiringSoon);
  animateValue(elements.statQuantity, totalQty);
}

function animateValue(element, target) {
  if (!element) return;

  const start = parseInt(element.textContent) || 0;
  const duration = 500;
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easeProgress = 1 - Math.pow(1 - progress, 3); // Ease out cubic
    const current = Math.round(start + (target - start) * easeProgress);
    element.textContent = current;

    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }

  requestAnimationFrame(update);
}

function renderRecentDonations() {
  const container = elements.recentDonations;
  if (!container) return;

  if (foodItems.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📭</div>
        <p>No donations yet. Be the first to contribute!</p>
      </div>
    `;
    return;
  }

  // Show last 5 items
  const recent = foodItems.slice(0, 5);

  container.innerHTML = recent.map(item => {
    const daysUntil = getDaysUntilExpiration(item.ExpirationDate);
    const badgeClass = getBadgeClass(daysUntil);
    const badgeText = getBadgeText(daysUntil);
    const iconClass = getCategoryIcon(item.Name);

    return `
      <div class="activity-item">
        <div class="activity-icon ${iconClass}">${getCategoryEmoji(item.Name)}</div>
        <div class="activity-content">
          <div class="activity-title">${escapeHtml(item.Name)}</div>
          <div class="activity-meta">Qty: ${item.Quantity} ${item.ExpirationDate ? '• Exp: ' + formatDate(item.ExpirationDate) : ''}</div>
        </div>
        <span class="activity-badge ${badgeClass}">${badgeText}</span>
      </div>
    `;
  }).join('');
}

// ============ Donations Grid ============
function renderDonationsGrid() {
  const container = elements.donationsGrid;
  if (!container) return;

  const role = currentUser ? currentUser.role : 'guest';
  const canClaim = ['charity', 'admin'].includes(role);
  const canRemove = ['user', 'company', 'charity', 'admin'].includes(role);

  if (filteredItems.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-state-icon">📭</div>
        <p>${currentFilter === 'all' ? 'No donations available.' : 'No items match your filter.'}</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filteredItems.map(item => {
    const daysUntil = getDaysUntilExpiration(item.ExpirationDate);
    const badgeClass = getBadgeClass(daysUntil);
    const badgeText = getBadgeText(daysUntil);
    const emoji = getCategoryEmoji(item.Name);

    let actionsHtml = '';
    if (canClaim) {
      actionsHtml += `<button class="btn btn-outline btn-sm" onclick="claimDonation(${item.Id})">Claim</button>`;
    }
    if (canRemove) {
      actionsHtml += `<button class="btn btn-primary btn-sm" onclick="deleteDonation(${item.Id}, '${escapeHtml(item.Name)}')">Remove</button>`;
    }

    return `
      <div class="donation-card">
        <div class="donation-image">
          ${emoji}
          <span class="donation-badge ${badgeClass}">${badgeText}</span>
        </div>
        <div class="donation-content">
          <h3 class="donation-title">${escapeHtml(item.Name)}</h3>
          <div class="donation-meta">
            <span>📦 Qty: ${item.Quantity}</span>
            <span>📅 ${item.ExpirationDate ? formatDate(item.ExpirationDate) : 'No expiration'}</span>
          </div>
          ${actionsHtml ? `<div class="donation-actions">${actionsHtml}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// ============ Alerts ============
function renderAlerts() {
  const urgent = [];
  const warning = [];
  const info = [];

  foodItems.forEach(item => {
    const daysUntil = getDaysUntilExpiration(item.ExpirationDate);
    if (daysUntil === null) return;

    if (daysUntil < 0) {
      urgent.push({ ...item, daysUntil, status: 'Expired' });
    } else if (daysUntil <= 3) {
      urgent.push({ ...item, daysUntil, status: `${daysUntil} day${daysUntil !== 1 ? 's' : ''} left` });
    } else if (daysUntil <= 7) {
      warning.push({ ...item, daysUntil, status: `${daysUntil} days left` });
    } else if (daysUntil <= 14) {
      info.push({ ...item, daysUntil, status: `${daysUntil} days left` });
    }
  });

  renderAlertList(elements.urgentAlerts, urgent);
  renderAlertList(elements.warningAlerts, warning);
  renderAlertList(elements.infoAlerts, info);
}

function renderAlertList(container, items) {
  if (!container) return;

  const role = currentUser ? currentUser.role : 'guest';
  const canAct = ['user', 'company', 'charity', 'admin'].includes(role);

  if (items.length === 0) {
    container.innerHTML = '<div class="empty-state-sm">No items in this category</div>';
    return;
  }

  container.innerHTML = items.map(item => `
    <div class="alert-item">
      <div class="alert-item-icon">${getCategoryEmoji(item.Name)}</div>
      <div class="alert-item-content">
        <div class="alert-item-title">${escapeHtml(item.Name)} (${item.Quantity})</div>
        <div class="alert-item-meta">${item.status}</div>
      </div>
      ${canAct ? `
      <div class="alert-item-actions">
        <button class="btn btn-outline btn-sm" onclick="donateToDonation(${item.Id})">Donate</button>
        <button class="btn btn-primary btn-sm" onclick="deleteDonation(${item.Id}, '${escapeHtml(item.Name)}')">Remove</button>
      </div>
      ` : ''}
    </div>
  `).join('');
}

// ============ Actions ============
async function deleteDonation(id, name) {
  if (!currentUser) {
    showToast('Please log in to perform this action', 'info');
    navigateTo('login');
    return;
  }
  if (!confirm(`Delete "${name}"? This action cannot be undone.`)) return;

  try {
    const res = await fetch(`${API}/food/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast(`${name} removed from inventory`, 'success');
      await loadData();
    } else {
      showToast('Failed to remove item', 'error');
    }
  } catch (e) {
    console.error('Delete failed:', e);
    showToast('Failed to remove item', 'error');
  }
}

function claimDonation(id) {
  if (!currentUser) {
    showToast('Please log in to claim items', 'info');
    navigateTo('login');
    return;
  }
  const item = foodItems.find(i => i.Id === id);
  if (item) {
    showToast(`🎉 Claimed "${item.Name}"! Coordinate pickup with the donor.`, 'success');
  }
}

function donateToDonation(id) {
  if (!currentUser) {
    showToast('Please log in to donate items', 'info');
    navigateTo('login');
    return;
  }
  const item = foodItems.find(i => i.Id === id);
  if (item) {
    showToast(`📍 Donation for "${item.Name}" listed! Recipients will be notified.`, 'success');
  }
}

// Make functions available globally
window.deleteDonation = deleteDonation;
window.claimDonation = claimDonation;
window.donateToDonation = donateToDonation;

// ============ Toast Notifications ============
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';

  toast.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <span class="toast-message">${message}</span>
  `;

  elements.toastContainer.appendChild(toast);

  // Auto remove after 4 seconds
  setTimeout(() => {
    toast.style.animation = 'toastSlide 0.3s ease reverse';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ============ Utility Functions ============
function getDaysUntilExpiration(expirationDate) {
  if (!expirationDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expDate = new Date(expirationDate);
  const diffTime = expDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getBadgeClass(daysUntil) {
  if (daysUntil === null) return 'badge-fresh';
  if (daysUntil < 0) return 'badge-urgent';
  if (daysUntil <= 3) return 'badge-urgent';
  if (daysUntil <= 7) return 'badge-expiring';
  return 'badge-fresh';
}

function getBadgeText(daysUntil) {
  if (daysUntil === null) return 'Fresh';
  if (daysUntil < 0) return 'Expired';
  if (daysUntil <= 3) return 'Urgent';
  if (daysUntil <= 7) return 'Expiring Soon';
  return 'Fresh';
}

function getCategoryEmoji(name) {
  const lower = name.toLowerCase();
  if (lower.includes('bread') || lower.includes('bakery') || lower.includes('pastry') || lower.includes('cake')) return '🍞';
  if (lower.includes('vegetable') || lower.includes('salad') || lower.includes('produce') || lower.includes('lettuce')) return '🥬';
  if (lower.includes('fruit') || lower.includes('apple') || lower.includes('banana') || lower.includes('orange')) return '🍎';
  if (lower.includes('meat') || lower.includes('chicken') || lower.includes('beef') || lower.includes('pork')) return '🥩';
  if (lower.includes('fish') || lower.includes('seafood') || lower.includes('salmon')) return '🐟';
  if (lower.includes('milk') || lower.includes('dairy') || lower.includes('cheese') || lower.includes('yogurt')) return '🧀';
  if (lower.includes('egg')) return '🥚';
  if (lower.includes('rice') || lower.includes('grain') || lower.includes('pasta')) return '🍚';
  if (lower.includes('soup') || lower.includes('stew')) return '🥣';
  if (lower.includes('pizza')) return '🍕';
  if (lower.includes('sandwich') || lower.includes('burger')) return '🥪';
  if (lower.includes('can') || lower.includes('canned')) return '🥫';
  if (lower.includes('drink') || lower.includes('juice') || lower.includes('beverage')) return '🧃';
  return '🍽️';
}

function getCategoryIcon(name) {
  const lower = name.toLowerCase();
  if (lower.includes('bread') || lower.includes('bakery')) return 'bakery';
  if (lower.includes('vegetable') || lower.includes('fruit') || lower.includes('produce')) return 'produce';
  if (lower.includes('milk') || lower.includes('dairy') || lower.includes('cheese')) return 'dairy';
  if (lower.includes('meat') || lower.includes('chicken') || lower.includes('beef')) return 'meat';
  if (lower.includes('can')) return 'canned';
  return 'produce';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}