const fs = require('fs');
const path = 'public/styles.css';
const css = `
/* ----- Chat Drawer ----- */
.chat-drawer {
  position: fixed;
  bottom: 0;
  right: 20px;
  width: 350px;
  height: 500px;
  background: white;
  box-shadow: var(--shadow-2xl);
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  transform: translateY(100%);
  transition: transform var(--transition-spring);
  z-index: 2000;
  display: flex;
  flex-direction: column;
}

.chat-drawer.active {
  transform: translateY(0);
}

.chat-header {
  padding: var(--spacing-md);
  background: var(--gradient-primary);
  color: white;
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chat-close {
  background: none;
  border: none;
  color: white;
  font-size: 1.5rem;
  cursor: pointer;
}

.chat-messages {
  flex: 1;
  padding: var(--spacing-md);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  background: var(--gray-50);
}

.message {
  max-width: 80%;
  display: flex;
  flex-direction: column;
}

.message-in {
  align-self: flex-start;
}

.message-out {
  align-self: flex-end;
  align-items: flex-end;
}

.message-bubble {
  padding: 8px 12px;
  border-radius: 12px;
  font-size: 0.9rem;
  line-height: 1.4;
}

.message-in .message-bubble {
  background: white;
  border: 1px solid var(--gray-200);
  border-bottom-left-radius: 2px;
}

.message-out .message-bubble {
  background: var(--primary-600);
  color: white;
  border-bottom-right-radius: 2px;
}

.message-time {
  font-size: 0.7rem;
  color: var(--gray-400);
  margin-top: 2px;
}

.chat-form {
  padding: var(--spacing-sm);
  border-top: 1px solid var(--gray-200);
  display: flex;
  gap: var(--spacing-sm);
  background: white;
}

.chat-form input {
  flex: 1;
  padding: 8px;
  border: 1px solid var(--gray-300);
  border-radius: var(--radius-md);
  outline: none;
}

.chat-form input:focus {
  border-color: var(--primary-500);
}

/* History Page adjustments */
#history-grid {
  margin-top: var(--spacing-lg);
}
`;

try {
    const content = fs.readFileSync(path, 'utf8');
    if (!content.includes('.chat-drawer')) {
        fs.appendFileSync(path, css);
        console.log('Chat CSS appended successfully.');
    } else {
        console.log('Chat styles already present.');
    }
} catch (e) {
    console.error('Error updating CSS:', e);
}
