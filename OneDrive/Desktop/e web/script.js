(() => {
  const menuButton = document.querySelector('.menu-toggle');
  const navigation = document.querySelector('#primary-navigation');

  if (menuButton && navigation) {
    const setMenuOpen = (isOpen) => {
      menuButton.setAttribute('aria-expanded', String(isOpen));
      menuButton.setAttribute('aria-label', isOpen ? 'Close navigation menu' : 'Open navigation menu');
      navigation.classList.toggle('is-open', isOpen);
    };
    menuButton.addEventListener('click', () => setMenuOpen(menuButton.getAttribute('aria-expanded') !== 'true'));
    navigation.addEventListener('click', (event) => {
      if (event.target.closest('a')) setMenuOpen(false);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') {
        setMenuOpen(false);
        menuButton.focus();
      }
    });
  }

  const year = document.querySelector('#current-year');
  if (year) year.textContent = String(new Date().getFullYear());

  /*
   * ÉLORA store configuration (single source of truth):
   * - Update each product's imagePath only after the real local photo is added.
   * - Set priceInr only when that product's INR price is confirmed.
   * - Add the actual WhatsApp business number as digits with country code.
   * No secrets belong in this public frontend configuration.
   */
  const STORE_CONFIG = {
    currency: 'INR',
    whatsappNumber: ''
  };
  const PRODUCT_DATA = [
    { id: 'black-bead-set', name: 'Black-bead bracelet & earring set', category: 'jewelry', imagePath: null, imageAlt: 'Black-bead bracelet and matching earrings', priceInr: null, placeholderClass: 'product-placeholder--black' },
    { id: 'pastel-floral-set', name: 'Pastel floral jewelry set', category: 'jewelry', imagePath: null, imageAlt: 'Pastel floral jewelry set', priceInr: null, placeholderClass: 'product-placeholder--floral' },
    { id: 'pink-heart-set', name: 'Heart-shaped pastel bead jewelry set', category: 'jewelry', imagePath: null, imageAlt: 'Pink heart-bead bracelet and matching earrings', priceInr: null, placeholderClass: 'product-placeholder--heart' },
    { id: 'multicolor-bead-set', name: 'Multicolor bead jewelry set', category: 'jewelry', imagePath: null, imageAlt: 'Multicolor bead bracelet and matching earrings', priceInr: null, placeholderClass: 'product-placeholder--multi' },
    { id: 'ivory-satin-bows', name: 'Ivory satin hair bows', category: 'hair-bows', imagePath: null, imageAlt: 'Ivory satin hair bows', priceInr: null, placeholderClass: 'product-placeholder--satin' },
    { id: 'pink-pearl-bows', name: 'Pink pearl-decorated hair bows', category: 'hair-bows', imagePath: null, imageAlt: 'Pink hair bows decorated with pearls', priceInr: null, placeholderClass: 'product-placeholder--pearl' },
    { id: 'pink-mesh-bows', name: 'Pink mesh ribbon hair bows', category: 'hair-bows', imagePath: null, imageAlt: 'Pink mesh ribbon hair bows with decorative beads', priceInr: null, placeholderClass: 'product-placeholder--mesh' }
  ];
  const products = new Map(PRODUCT_DATA.map((product) => [product.id, product]));

  const makeElement = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };

  const createProductCard = (product) => {
    const card = makeElement('article', 'product-card');
    card.dataset.productId = product.id;

    const visual = makeElement('div', `product-placeholder ${product.placeholderClass}`);
    visual.setAttribute('role', 'img');
    visual.setAttribute('aria-label', `Product photo placeholder: ${product.name}`);
    visual.append(
      makeElement('span', '', 'PRODUCT IMAGE'),
      makeElement('small', '', product.name)
    );
    visual.querySelectorAll('span, small').forEach((label) => label.dataset.placeholderLabel = '');

    if (product.imagePath) {
      const image = makeElement('img', 'product-image');
      image.alt = product.imageAlt;
      image.loading = 'lazy';
      image.decoding = 'async';
      image.hidden = true;
      image.addEventListener('load', () => {
        image.hidden = false;
        visual.removeAttribute('role');
        visual.removeAttribute('aria-label');
        visual.classList.add('has-image');
      }, { once: true });
      image.addEventListener('error', () => image.remove(), { once: true });
      image.src = product.imagePath;
      visual.append(image);
    }

    const info = makeElement('div', 'product-info');
    const name = makeElement('h4', '', product.name);
    const price = makeElement('p', '', product.priceInr === null ? 'Price to be announced' : formatInr(product.priceInr));
    const addButton = makeElement('button', 'add-to-bag', 'Add to bag');
    addButton.type = 'button';
    addButton.dataset.addToBag = '';
    addButton.dataset.productId = product.id;
    addButton.setAttribute('aria-label', `Add ${product.name} to bag`);
    info.append(name, price, addButton);
    card.append(visual, info);
    return card;
  };

  const grids = new Map([
    ['jewelry', document.querySelector('[data-product-grid="jewelry"]')],
    ['hair-bows', document.querySelector('[data-product-grid="hair-bows"]')]
  ]);
  PRODUCT_DATA.forEach((product) => {
    const grid = grids.get(product.category);
    if (grid) grid.append(createProductCard(product));
  });

  const bagTrigger = document.querySelector('.bag-trigger');
  const drawer = document.querySelector('#bag-drawer');
  const backdrop = document.querySelector('.bag-backdrop');
  const itemsHost = document.querySelector('[data-bag-items]');
  const countLabel = document.querySelector('[data-bag-count]');
  const subtotalLabel = document.querySelector('[data-bag-subtotal]');
  const pricingNote = document.querySelector('[data-pricing-note]');
  const orderButton = document.querySelector('[data-whatsapp-order]');
  const orderNote = document.querySelector('[data-order-note]');
  const statusLabel = document.querySelector('[data-bag-status]');
  if (!bagTrigger || !drawer || !backdrop || !itemsHost || !countLabel || !subtotalLabel || !orderButton) return;

  const storageKey = 'elora-shopping-bag-v1';
  const readBag = () => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(storageKey) || '{}');
      if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return {};
      return Object.fromEntries(Object.entries(saved).filter(([id, quantity]) =>
        products.has(id) && Number.isInteger(quantity) && quantity >= 1 && quantity <= 99
      ));
    } catch {
      return {};
    }
  };
  let bag = readBag();
  let returnFocusTo = null;

  const saveBag = () => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(bag));
    } catch {
      if (statusLabel) statusLabel.textContent = 'This browser could not save your bag for later.';
    }
  };
  function formatInr(amount) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency', currency: STORE_CONFIG.currency, maximumFractionDigits: 2
    }).format(amount);
  }
  const getUnitPrice = (id) => {
    const price = products.get(id)?.priceInr;
    return Number.isFinite(price) && price > 0 ? price : null;
  };
  const isValidWhatsAppNumber = /^\d{10,15}$/.test(STORE_CONFIG.whatsappNumber);
  const allPricesConfirmed = () => Object.keys(bag).length > 0 && Object.keys(bag).every((id) => getUnitPrice(id) !== null);

  const createButton = (label, action, id, className, disabled = false) => {
    const button = makeElement('button', className, label);
    button.type = 'button';
    button.dataset.action = action;
    button.dataset.productId = id;
    button.disabled = disabled;
    if (action === 'increase' || action === 'decrease') {
      const product = products.get(id);
      button.setAttribute('aria-label', `${action === 'increase' ? 'Increase' : 'Decrease'} quantity of ${product.name}`);
    }
    return button;
  };

  const renderBag = () => {
    const entries = Object.entries(bag);
    const totalItems = entries.reduce((sum, [, quantity]) => sum + quantity, 0);
    countLabel.textContent = String(totalItems);
    bagTrigger.setAttribute('aria-label', `Open shopping bag, ${totalItems} ${totalItems === 1 ? 'item' : 'items'}`);
    itemsHost.replaceChildren();

    if (entries.length === 0) {
      const empty = makeElement('div', 'bag-empty');
      empty.append(
        makeElement('p', 'bag-empty__title', 'Your bag is waiting.'),
        makeElement('p', '', 'Add a piece from the collection to begin.')
      );
      itemsHost.append(empty);
    } else {
      entries.forEach(([id, quantity]) => {
        const product = products.get(id);
        const line = makeElement('article', 'bag-item');
        const mark = makeElement('span', 'bag-item__mark', 'É');
        mark.setAttribute('aria-hidden', 'true');
        const details = makeElement('div');
        const name = makeElement('h3', 'bag-item__name', product.name);
        const unitPrice = getUnitPrice(id);
        const price = makeElement('p', 'bag-item__price', unitPrice === null ? 'Price to be announced' : formatInr(unitPrice));
        const controls = makeElement('div', 'bag-item__controls');
        const quantityLabel = makeElement('span', 'bag-quantity', String(quantity));
        quantityLabel.setAttribute('aria-label', `Quantity ${quantity}`);
        controls.append(
          createButton('−', 'decrease', id, 'bag-quantity-button', quantity <= 1),
          quantityLabel,
          createButton('+', 'increase', id, 'bag-quantity-button')
        );
        const remove = createButton('Remove', 'remove', id, 'bag-remove');
        remove.setAttribute('aria-label', `Remove ${product.name} from bag`);
        details.append(name, price, controls);
        line.append(mark, details, remove);
        itemsHost.append(line);
      });
    }

    if (allPricesConfirmed()) {
      const subtotal = entries.reduce((sum, [id, quantity]) => sum + getUnitPrice(id) * quantity, 0);
      subtotalLabel.textContent = formatInr(subtotal);
      if (pricingNote) pricingNote.textContent = 'Subtotal for confirmed item prices.';
    } else {
      subtotalLabel.textContent = 'Pricing pending';
      if (pricingNote) pricingNote.textContent = 'Prices have not been confirmed. No total is shown.';
    }
    const canOrder = entries.length > 0 && allPricesConfirmed() && isValidWhatsAppNumber;
    orderButton.disabled = !canOrder;
    orderButton.textContent = canOrder ? 'Continue on WhatsApp' : 'WhatsApp ordering unavailable';
    if (orderNote) orderNote.textContent = canOrder
      ? 'Your order request will open in WhatsApp for you to review and send.'
      : 'Ordering will be available after a business WhatsApp number and confirmed prices are configured.';
  };

  const openBag = (trigger) => {
    returnFocusTo = trigger || bagTrigger;
    drawer.hidden = false;
    backdrop.hidden = false;
    document.body.classList.add('bag-open');
    drawer.querySelector('.bag-close')?.focus();
  };
  const closeBag = () => {
    drawer.hidden = true;
    backdrop.hidden = true;
    document.body.classList.remove('bag-open');
    returnFocusTo?.focus();
    returnFocusTo = null;
  };

  document.querySelectorAll('[data-add-to-bag]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.dataset.productId;
      if (!products.has(id)) return;
      bag[id] = Math.min(99, (bag[id] || 0) + 1);
      saveBag();
      renderBag();
      if (statusLabel) statusLabel.textContent = `${products.get(id).name} added to your bag.`;
      openBag(button);
    });
  });
  bagTrigger.addEventListener('click', () => openBag(bagTrigger));
  backdrop.addEventListener('click', closeBag);
  drawer.querySelectorAll('[data-close-bag]').forEach((button) => button.addEventListener('click', closeBag));
  itemsHost.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const { action, productId } = button.dataset;
    if (!products.has(productId) || !bag[productId]) return;
    if (action === 'increase') bag[productId] = Math.min(99, bag[productId] + 1);
    if (action === 'decrease' && bag[productId] > 1) bag[productId] -= 1;
    if (action === 'remove') delete bag[productId];
    saveBag();
    renderBag();

    if (action === 'remove') {
      drawer.querySelector('.bag-close')?.focus();
      return;
    }
    const controls = Array.from(itemsHost.querySelectorAll('[data-action]'));
    const next = controls.find((control) => control.dataset.productId === productId && control.dataset.action === action && !control.disabled)
      || controls.find((control) => control.dataset.productId === productId && control.dataset.action === 'increase')
      || drawer.querySelector('.bag-close');
    next?.focus();
  });
  drawer.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeBag();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(drawer.querySelectorAll('button:not(:disabled), [href], [tabindex]:not([tabindex="-1"])'));
    if (focusable.length === 0) {
      event.preventDefault();
      drawer.focus();
    } else if (event.shiftKey && document.activeElement === focusable[0]) {
      event.preventDefault();
      focusable[focusable.length - 1].focus();
    } else if (!event.shiftKey && document.activeElement === focusable[focusable.length - 1]) {
      event.preventDefault();
      focusable[0].focus();
    }
  });
  orderButton.addEventListener('click', () => {
    if (orderButton.disabled || !allPricesConfirmed() || !isValidWhatsAppNumber) return;
    const orderLines = Object.entries(bag).map(([id, quantity]) =>
      `${products.get(id).name} × ${quantity} — ${formatInr(getUnitPrice(id) * quantity)}`
    );
    const subtotal = Object.entries(bag).reduce((sum, [id, quantity]) => sum + getUnitPrice(id) * quantity, 0);
    const message = `Hello ÉLORA, I would like to enquire about:\n${orderLines.join('\n')}\nSubtotal: ${formatInr(subtotal)}\nPlease confirm availability and next steps.`;
    window.open(`https://wa.me/${STORE_CONFIG.whatsappNumber}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  });

  renderBag();
})();
