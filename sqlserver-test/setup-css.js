const fs = require('fs');
const path = 'public/styles.css';
const css = `
/* ----- New Feature Styles ----- */
.donation-img-cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform var(--transition-base);
}

.donation-card:hover .donation-img-cover {
  transform: scale(1.05);
}

.status-badge {
  padding: 2px 8px;
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.status-pending {
  background: var(--accent-yellow-light);
  color: #92400e;
}

.status-claimed {
  background: var(--accent-purple-light);
  color: var(--accent-purple);
}

.card-claimed {
  opacity: 0.7;
  border: 1px solid var(--gray-200);
}

.card-claimed .donation-image {
  filter: grayscale(100%);
}

.donation-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--spacing-xs);
}

.donor-name {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: var(--font-size-xs);
  color: var(--gray-500);
  margin-top: 4px;
}
`;

try {
    const content = fs.readFileSync(path, 'utf8');
    if (!content.includes('.donation-img-cover')) {
        fs.appendFileSync(path, css);
        console.log('CSS appended successfully.');
    } else {
        console.log('CSS already present.');
    }
} catch (e) {
    console.error('Error updating CSS:', e);
}
