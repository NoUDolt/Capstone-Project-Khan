const API = '/api';
const tbody = document.querySelector('#items tbody');
const form = document.getElementById('add-form');
const nameEl = document.getElementById('name');
const qtyEl = document.getElementById('qty');
const expEl = document.getElementById('exp');

async function loadItems() {
  const res = await fetch(`${API}/food`);
  const data = await res.json();
  tbody.innerHTML = '';
  data.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.Id}</td>
      <td>${row.Name}</td>
      <td>${row.Quantity}</td>
      <td>${row.ExpirationDate ? row.ExpirationDate.substring(0,10) : ''}</td>
      <td><button data-id="${row.Id}" class="del">Delete</button></td>`;
    tbody.appendChild(tr);
  });
}

tbody.addEventListener('click', async e => {
  const btn = e.target.closest('button.del');
  if (!btn) return;
  const id = btn.dataset.id;
  if (!confirm(`Delete ${id}?`)) return;
  const res = await fetch(`${API}/food/${id}`, { method: 'DELETE' });
  if (res.ok) loadItems();
});

form.addEventListener('submit', async e => {
  e.preventDefault();
  const payload = {
    name: nameEl.value.trim(),
    quantity: Number(qtyEl.value),
    expirationDate: expEl.value || null
  };
  if (!payload.name) return alert('Name required');
  const res = await fetch(`${API}/food`, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify(payload)
  });
  if (res.ok) { form.reset(); loadItems(); }
  else alert('Insert failed');
});

loadItems();
