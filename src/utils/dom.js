/**
 * Create an HTML element with attributes and children.
 * @param {string} tag
 * @param {Object} [attrs]
 * @param  {...(HTMLElement|string)} children
 * @returns {HTMLElement}
 */
export function el(tag, attrs = {}, ...children) {
  const element = document.createElement(tag);

  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'className') {
      element.className = value;
    } else if (key === 'innerHTML') {
      element.innerHTML = value;
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(element.style, value);
    } else if (key.startsWith('on') && typeof value === 'function') {
      const event = key.slice(2).toLowerCase();
      element.addEventListener(event, value);
    } else if (key === 'dataset') {
      for (const [dk, dv] of Object.entries(value)) {
        element.dataset[dk] = dv;
      }
    } else if (key === 'htmlFor') {
      element.setAttribute('for', value);
    } else {
      element.setAttribute(key, value);
    }
  }

  for (const child of children) {
    if (child == null || child === false) continue;
    if (typeof child === 'string' || typeof child === 'number') {
      element.appendChild(document.createTextNode(String(child)));
    } else if (child instanceof Node) {
      element.appendChild(child);
    }
  }

  return element;
}

/** Clear all children of an element */
export function clearElement(element) {
  element.innerHTML = '';
}

/** Replace content of a container with new content */
export function replaceContent(container, ...newChildren) {
  clearElement(container);
  for (const child of newChildren) {
    if (child instanceof Node) {
      container.appendChild(child);
    }
  }
}

// ─── Custom Dialog System ─────────────────────────────────────────
// Replaces native prompt(), confirm(), alert() with styled modals.

/**
 * Show a custom alert dialog.
 * @param {string} message
 * @returns {Promise<void>}
 */
export function showAlert(message) {
  return new Promise((resolve) => {
    const overlay = _createDialogOverlay();
    const dialog = el('div', { className: 'dialog' });

    dialog.appendChild(el('div', { className: 'dialog__body' }, message));

    const footer = el('div', { className: 'dialog__footer' });
    const okBtn = el('button', {
      className: 'btn-primary',
      onClick: () => { overlay.remove(); resolve(); },
    }, 'OK');
    footer.appendChild(okBtn);
    dialog.appendChild(footer);

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    okBtn.focus();
  });
}

/**
 * Show a custom confirm dialog.
 * @param {string} message
 * @returns {Promise<boolean>}
 */
export function showConfirm(message) {
  return new Promise((resolve) => {
    const overlay = _createDialogOverlay();
    const dialog = el('div', { className: 'dialog' });

    dialog.appendChild(el('div', { className: 'dialog__body' }, message));

    const footer = el('div', { className: 'dialog__footer' });

    const cancelBtn = el('button', {
      className: 'btn-secondary',
      onClick: () => { overlay.remove(); resolve(false); },
    }, 'Anuluj');
    footer.appendChild(cancelBtn);

    const okBtn = el('button', {
      className: 'btn-primary',
      onClick: () => { overlay.remove(); resolve(true); },
    }, 'Potwierdź');
    footer.appendChild(okBtn);

    dialog.appendChild(footer);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    okBtn.focus();
  });
}

/**
 * Show a custom prompt dialog (single input).
 * @param {string} message - Label text
 * @param {string} [defaultValue=''] - Pre-filled value
 * @returns {Promise<string|null>} - User input or null if cancelled
 */
export function showPrompt(message, defaultValue = '') {
  return new Promise((resolve) => {
    const overlay = _createDialogOverlay();
    const dialog = el('div', { className: 'dialog' });

    dialog.appendChild(el('div', { className: 'dialog__body' }, message));

    const input = el('input', {
      type: 'text',
      className: 'dialog__input',
      value: defaultValue,
    });
    // Handle Enter key
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { overlay.remove(); resolve(input.value); }
      if (e.key === 'Escape') { overlay.remove(); resolve(null); }
    });
    dialog.appendChild(input);

    const footer = el('div', { className: 'dialog__footer' });

    const cancelBtn = el('button', {
      className: 'btn-secondary',
      onClick: () => { overlay.remove(); resolve(null); },
    }, 'Anuluj');
    footer.appendChild(cancelBtn);

    const okBtn = el('button', {
      className: 'btn-primary',
      onClick: () => { overlay.remove(); resolve(input.value); },
    }, 'OK');
    footer.appendChild(okBtn);

    dialog.appendChild(footer);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    input.focus();
    input.select();
  });
}

/**
 * Show a multi-field prompt dialog.
 * @param {string} title - Dialog title
 * @param {Array<{label: string, key: string, defaultValue?: string, placeholder?: string, required?: boolean}>} fields
 * @returns {Promise<Object|null>} - Object with field values keyed by `key`, or null if cancelled
 */
export function showMultiPrompt(title, fields) {
  return new Promise((resolve) => {
    const overlay = _createDialogOverlay();
    const dialog = el('div', { className: 'dialog dialog--wide' });

    dialog.appendChild(el('div', { className: 'dialog__header' }, title));

    const body = el('div', { className: 'dialog__fields' });
    const inputs = {};

    for (const field of fields) {
      const row = el('div', { className: 'dialog__field' });
      row.appendChild(el('label', { className: 'dialog__label' }, field.label));
      const input = el('input', {
        type: 'text',
        className: 'dialog__input',
        value: field.defaultValue || '',
        placeholder: field.placeholder || '',
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { overlay.remove(); resolve(null); }
      });
      row.appendChild(input);
      body.appendChild(row);
      inputs[field.key] = input;
    }

    dialog.appendChild(body);

    const footer = el('div', { className: 'dialog__footer' });

    const cancelBtn = el('button', {
      className: 'btn-secondary',
      onClick: () => { overlay.remove(); resolve(null); },
    }, 'Anuluj');
    footer.appendChild(cancelBtn);

    const okBtn = el('button', {
      className: 'btn-primary',
      onClick: () => {
        // Validate required fields
        for (const field of fields) {
          if (field.required && !inputs[field.key].value.trim()) {
            inputs[field.key].focus();
            inputs[field.key].style.borderColor = 'var(--color-danger)';
            return;
          }
        }
        const result = {};
        for (const field of fields) {
          result[field.key] = inputs[field.key].value;
        }
        overlay.remove();
        resolve(result);
      },
    }, 'Zapisz');
    footer.appendChild(okBtn);

    dialog.appendChild(footer);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // Focus first input
    const firstInput = Object.values(inputs)[0];
    if (firstInput) firstInput.focus();
  });
}

/** @private Create a dialog overlay element */
function _createDialogOverlay() {
  const overlay = el('div', { className: 'dialog-overlay' });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      // Don't auto-close — user must use buttons
    }
  });
  return overlay;
}
