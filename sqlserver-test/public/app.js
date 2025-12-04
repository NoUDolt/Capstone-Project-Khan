const API = '/api';
const tbody = document.querySelector('#items tbody');
const form = document.getElementById('add-form');
const nameEl = document.getElementById('name');
const qtyEl = document.getElementById('qty');
const expEl = document.getElementById('exp');
const addBtn = document.getElementById('add-btn');
const backBtn = document.getElementById('back-btn');
const inventoryPage = document.getElementById('inventory-page');
const addPage = document.getElementById('add-page');

// Page navigation
addBtn.addEventListener('click', () => {
  inventoryPage.classList.remove('active');
  addPage.classList.add('active');
});

backBtn.addEventListener('click', () => {
  addPage.classList.remove('active');
  inventoryPage.classList.add('active');
});

function getDaysUntilExpiration(expirationDate) {
  if (!expirationDate) return null;
  const today = new Date();
  const expDate = new Date(expirationDate);
  const diffTime = expDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

function getStatusBadge(daysUntil) {
  if (daysUntil === null) return '<span class="badge badge-success">No Expiration</span>';
  if (daysUntil < 0) return '<span class="badge" style="background:#fee;color:#991b1b">Expired</span>';
  if (daysUntil <= 3) return '<span class="badge badge-warning">⚠️ Urgent</span>';
  if (daysUntil <= 7) return '<span class="badge badge-warning">Expires Soon</span>';
  return '<span class="badge badge-success">Fresh</span>';
}

async function loadItems() {
  try {
    const res = await fetch(`${API}/food`);
    const data = await res.json();
    
    tbody.innerHTML = '';
    
    if (data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><div class="empty-state-icon">📭</div><p>No items in inventory. Add your first item!</p></td></tr>';
      updateStats(0, 0, 0);
      return;
    }

    let expiringSoon = 0;
    let totalQty = 0;

    data.forEach(row => {
      const daysUntil = getDaysUntilExpiration(row.ExpirationDate);
      if (daysUntil !== null && daysUntil <= 7 && daysUntil >= 0) expiringSoon++;
      totalQty += row.Quantity || 0;

      const tr = document.createElement('tr');
      if (daysUntil !== null && daysUntil <= 3 && daysUntil >= 0) {
        tr.classList.add('expiring-soon');
      }
      
      tr.innerHTML = `
        <td><strong>#${row.Id}</strong></td>
        <td>${row.Name}</td>
        <td>${row.Quantity}</td>
        <td>${row.ExpirationDate ? new Date(row.ExpirationDate).toLocaleDateString() : 'N/A'}</td>
        <td>${getStatusBadge(daysUntil)}</td>
        <td><button data-id="${row.Id}" class="del btn-delete">Delete</button></td>
      `;
      tbody.appendChild(tr);
    });

    updateStats(data.length, expiringSoon, totalQty);
  } catch (e) {
    console.error('Failed to load items:', e);
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#dc2626;padding:32px">Failed to load inventory. Please try again.</td></tr>';
  }
}

function updateStats(total, expiring, quantity) {
  document.getElementById('total-items').textContent = total;
  document.getElementById('expiring-soon').textContent = expiring;
  document.getElementById('total-quantity').textContent = quantity;
}

tbody.addEventListener('click', async e => {
  const btn = e.target.closest('button.del');
  if (!btn) return;
  const id = btn.dataset.id;
  if (!confirm(`Delete item #${id}? This action cannot be undone.`)) return;
  
  try {
    const res = await fetch(`${API}/food/${id}`, { method: 'DELETE' });
    if (res.ok) loadItems();
    else alert('Failed to delete item');
  } catch (e) {
    console.error('Delete failed:', e);
    alert('Failed to delete item');
  }
});

form.addEventListener('submit', async e => {
  e.preventDefault();
  const payload = {
    name: nameEl.value.trim(),
    quantity: Number(qtyEl.value),
    expirationDate: expEl.value || null
  };
  
  if (!payload.name) {
    alert('Please enter an item name');
    return;
  }

  try {
    const res = await fetch(`${API}/food`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (res.ok) {
      form.reset();
      qtyEl.value = '1';
      loadItems();
      // Navigate back to inventory
      addPage.classList.remove('active');
      inventoryPage.classList.add('active');
    } else {
      alert('Failed to add item');
    }
  } catch (e) {
    console.error('Insert failed:', e);
    alert('Failed to add item');
  }
});

// Set minimum date to today
const today = new Date().toISOString().split('T')[0];
expEl.setAttribute('min', today);

loadItems();