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

// ============ DOM Elements ============
const elements = {
  // Navigation
  navLinks: document.querySelectorAll('.nav-link'),
  navToggle: document.getElementById('nav-toggle'),
  mobileNav: document.getElementById('mobile-nav'),
  
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
  
  // Modal
  modal: document.getElementById('add-donation-modal'),
  form: document.getElementById('add-form'),
  nameInput: document.getElementById('name'),
  qtyInput: document.getElementById('qty'),
  expInput: document.getElementById('exp'),
  categoryInput: document.getElementById('category'),
  notesInput: document.getElementById('notes'),
  
  // Toast
  toastContainer: document.getElementById('toast-container')
};

// ============ Initialization ============
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initModal();
  initFilterButtons();
  initForm();
  initQuickActions();
  setMinDate();
  loadData();
});

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
      openModal();
      break;
    case 'close-modal':
      closeModal();
      break;
    case 'add-recipient':
      showToast('Organization registration coming soon!', 'info');
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
          <div class="donation-actions">
            <button class="btn btn-outline btn-sm" onclick="claimDonation(${item.Id})">Claim</button>
            <button class="btn btn-primary btn-sm" onclick="deleteDonation(${item.Id}, '${escapeHtml(item.Name)}')">Remove</button>
          </div>
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
      <div class="alert-item-actions">
        <button class="btn btn-outline btn-sm" onclick="donateToDonation(${item.Id})">Donate</button>
        <button class="btn btn-primary btn-sm" onclick="deleteDonation(${item.Id}, '${escapeHtml(item.Name)}')">Remove</button>
      </div>
    </div>
  `).join('');
}

// ============ Actions ============
async function deleteDonation(id, name) {
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
  const item = foodItems.find(i => i.Id === id);
  if (item) {
    showToast(`🎉 Claimed "${item.Name}"! Coordinate pickup with the donor.`, 'success');
  }
}

function donateToDonation(id) {
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