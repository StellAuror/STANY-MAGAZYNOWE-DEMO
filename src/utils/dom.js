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
