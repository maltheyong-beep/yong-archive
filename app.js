(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const products = window.PRODUCTS;
  const maxPrice = window.STORE.maxPrice;
  const money = value => new Intl.NumberFormat('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 }).format(value);
  const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const save = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
  const defaults = () => ({ condition: 'all', sizes: [], colors: [], maxPrice, sort: 'featured' });
  let state = { ...defaults(), ...read('yong.filters.v2', {}) };
  let bag = read('yong.bag', []);
  if (!Array.isArray(bag)) bag = [];
  bag = [...new Set(bag)].filter(id => products.some(product => product.id === id));
  let currentProduct = null, currentPhoto = 0, toastTimer, popupScheduled = false;
  let newsletterDismissed = !!read('yong.newsletter.dismissed', false);
  let previousBagCount = bag.length;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const conditionLabel = value => ({ all: 'Alle varer', new: 'Helt nyt', preowned: 'Secondhand' }[value]);

  function animateElement(element, keyframes, options = {}) {
    if (reducedMotion.matches || !element?.animate) return null;
    return element.animate(keyframes, { duration: 420, easing: 'cubic-bezier(.22,1,.36,1)', ...options });
  }
  function toast(message) {
    $('#toast').textContent = message;
    $('#toast').classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 3000);
  }
  function closeDialog(dialog, immediate = false) {
    if (!dialog.open) return;
    if (dialog.id === 'newsletter-dialog') {
      newsletterDismissed = true;
      save('yong.newsletter.dismissed', true);
    }
    if (immediate || reducedMotion.matches) {
      dialog.getAnimations().forEach(animation => animation.cancel());
      delete dialog.dataset.closing;
      dialog.close();
      return;
    }
    if (dialog.dataset.closing) return;
    dialog.dataset.closing = 'true';
    const drawer = dialog.classList.contains('drawer');
    const animation = animateElement(dialog, drawer
      ? [{ transform: 'translateX(0)', opacity: 1 }, { transform: 'translateX(40px)', opacity: 0 }]
      : [{ transform: 'translateY(0) scale(1)', opacity: 1 }, { transform: 'translateY(12px) scale(.98)', opacity: 0 }],
      { duration: 180, easing: 'ease-in' });
    const finish = () => { delete dialog.dataset.closing; if (dialog.open) dialog.close(); };
    if (animation) animation.finished.then(finish).catch(() => {}); else finish();
  }
  function openDialog(selector) {
    const dialog = $(selector);
    if (dialog.open) return;
    $$('dialog[open]').forEach(other => closeDialog(other, true));
    dialog.showModal();
    const drawer = dialog.classList.contains('drawer');
    animateElement(dialog, drawer
      ? [{ transform: 'translateX(100%)', opacity: .6 }, { transform: 'translateX(0)', opacity: 1 }]
      : [{ transform: 'translateY(22px) scale(.975)', opacity: 0 }, { transform: 'translateY(0) scale(1)', opacity: 1 }],
      { duration: drawer ? 480 : 380 });
    fitPhotos();
  }
  $$('dialog').forEach(dialog => {
    dialog.querySelectorAll('.close').forEach(button => button.addEventListener('click', () => closeDialog(dialog)));
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDialog(dialog);
    });
    dialog.addEventListener('cancel', event => { event.preventDefault(); closeDialog(dialog); });
  });

  // Preserve the original photos. Rotation happens only in the page layout.
  function img(product, index = 0, extra = '') {
    const rotation = product.rotations?.[index] || 0;
    return `<img src="${escape(product.photos[index])}" alt="${escape(product.name)} – ${escape(product.photoLabels[index])}" loading="lazy" ${rotation ? `data-rotate="${rotation}"` : ''} ${extra}>`;
  }
  function fitRotatedFrame(frame) {
    const image = frame.querySelector('img[data-rotate]');
    if (!image) return;
    const { width, height } = frame.getBoundingClientRect();
    image.style.width = `${height}px`;
    image.style.height = `${width}px`;
    image.style.left = '50%'; image.style.top = '50%';
    image.style.translate = '-50% -50%'; image.style.rotate = `${image.dataset.rotate}deg`;
  }
  const photoObserver = 'ResizeObserver' in window ? new ResizeObserver(entries => entries.forEach(entry => fitRotatedFrame(entry.target))) : null;
  function fitPhotos() {
    photoObserver?.disconnect();
    $$('.photo-frame').forEach(frame => {
      if (!frame.querySelector('img[data-rotate]')) return;
      fitRotatedFrame(frame);
      photoObserver?.observe(frame);
    });
  }
  window.addEventListener('resize', fitPhotos, { passive: true });

  const revealObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('is-revealed'); revealObserver.unobserve(entry.target); } });
  }, { threshold: .08 }) : null;
  function revealCards() {
    $$('.product-card').forEach((card, index) => {
      if (reducedMotion.matches) return;
      card.classList.add('reveal-card'); card.style.setProperty('--stagger', `${(index % 4) * 65}ms`);
      if (revealObserver) revealObserver.observe(card); else card.classList.add('is-revealed');
    });
  }
  function filtered() {
    const result = products.filter(product =>
      (state.condition === 'all' || product.conditionType === state.condition) &&
      (!state.sizes.length || state.sizes.includes(product.size)) &&
      (!state.colors.length || state.colors.includes(product.color)) && product.price <= state.maxPrice);
    if (state.sort === 'price-low') result.sort((a, b) => a.price - b.price);
    if (state.sort === 'price-high') result.sort((a, b) => b.price - a.price);
    if (state.sort === 'newest') result.sort((a, b) => b.date.localeCompare(a.date));
    return result;
  }
  function card(product) {
    return `<article class="product-card"><button class="product-image" data-product="${product.id}" aria-label="Se ${escape(product.name)}, ${money(product.price)}">
      <span class="sample-badge real-condition">${escape(product.condition)}</span><span class="product-media photo-frame">${img(product, 0, 'class="primary"')}${img(product, 1, 'class="alternate"')}</span><span class="product-size">Str. ${product.size}</span></button>
      <button class="quick-add" data-add="${product.id}" aria-label="Læg ${escape(product.name)} i kurven">+</button>
      <div class="product-meta"><div class="product-topline"><button class="product-name" data-product="${product.id}">${escape(product.name)}</button><span class="product-price">${money(product.price)}</span></div>
      <p class="product-description">${product.color} / Str. ${product.size} / ${product.condition}</p><div class="product-bottom"><span class="swatch" style="--swatch:${product.hex}" role="img" aria-label="Farve: ${product.color}"></span><span class="condition">Kvittering medfølger</span></div></div></article>`;
  }
  function render() {
    const list = filtered();
    $('#product-grid').innerHTML = list.map(card).join('');
    $('#result-count').textContent = `${list.length} ${list.length === 1 ? 'vare' : 'varer'}`;
    $('#empty-state').hidden = list.length > 0;
    $$('[data-condition]').forEach(button => { const selected = button.dataset.condition === state.condition; button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', String(selected)); });
    $$('[data-nav]').forEach(button => button.classList.toggle('active', button.dataset.nav === state.condition));
    $('#sort').value = state.sort;
    const tags = [];
    if (state.condition !== 'all') tags.push({ type: 'condition', value: state.condition, label: conditionLabel(state.condition) });
    state.sizes.forEach(value => tags.push({ type: 'sizes', value, label: `Str. ${value}` }));
    state.colors.forEach(value => tags.push({ type: 'colors', value, label: value }));
    if (state.maxPrice < maxPrice) tags.push({ type: 'maxPrice', value: '', label: `Op til ${money(state.maxPrice)}` });
    $('#active-filters').innerHTML = tags.map(tag => `<button class="filter-tag" data-remove-filter="${tag.type}" data-value="${escape(tag.value)}">${escape(tag.label)} <span aria-hidden="true">×</span><span class="sr-only">Fjern filter</span></button>`).join('');
    $('#filter-count').textContent = tags.length || '';
    $('#show-results').textContent = `Vis ${list.length} ${list.length === 1 ? 'vare' : 'varer'}`;
    if (!list.length) {
      $('#empty-state h3').textContent = state.condition === 'preowned' ? 'Ingen secondhand varer lige nu.' : 'Ingen varer i dette udvalg.';
      $('#empty-state p').textContent = state.condition === 'preowned' ? 'De to Supreme-hoodies er helt nye. Se hele udvalget herunder.' : 'Prøv en anden stand, farve eller størrelse.';
    }
    save('yong.filters.v2', state); syncFilters(); revealCards(); fitPhotos();
  }
  $('#category-options').innerHTML = ['all', 'new', 'preowned'].map(value => `<label class="option-label"><input type="radio" name="condition" value="${value}">${conditionLabel(value)}</label>`).join('');
  $('#size-options').innerHTML = [...new Set(products.map(product => product.size))].map(value => `<label class="size-choice"><input type="checkbox" name="size" value="${value}"><span>${value}</span></label>`).join('');
  $('#color-options').innerHTML = products.map(product => `<label class="option-label"><input type="checkbox" name="color" value="${product.color}"><span class="swatch" style="--swatch:${product.hex}"></span>${product.color}</label>`).join('');
  function syncFilters() {
    $$('input[name=condition]').forEach(input => input.checked = input.value === state.condition);
    $$('input[name=size]').forEach(input => input.checked = state.sizes.includes(input.value));
    $$('input[name=color]').forEach(input => input.checked = state.colors.includes(input.value));
    $('#max-price').value = state.maxPrice; $('#range-value').textContent = money(state.maxPrice);
  }
  function reset() { state = defaults(); render(); }
  $('#filters-dialog').addEventListener('change', event => {
    if (event.target.name === 'condition') state.condition = event.target.value;
    if (event.target.name === 'size') state.sizes = $$('input[name=size]:checked').map(input => input.value);
    if (event.target.name === 'color') state.colors = $$('input[name=color]:checked').map(input => input.value);
    render();
  });
  $('#max-price').oninput = event => { state.maxPrice = Number(event.target.value); render(); };
  $('#reset-filters').onclick = reset; $('#reset-empty').onclick = reset;
  $('#show-results').onclick = () => closeDialog($('#filters-dialog'));
  $('#filter-open').onclick = () => openDialog('#filters-dialog');
  $('#sort').onchange = event => { state.sort = event.target.value; render(); };

  function showProduct(id) {
    const product = products.find(product => product.id === id);
    if (!product) return;
    currentProduct = product; currentPhoto = 0;
    const variants = products.filter(other => other.group === product.group);
    $('#product-content').innerHTML = `<div class="product-layout"><div class="product-gallery">
      <button class="main-product-image photo-frame" id="gallery-expand" aria-label="Se stort billede af ${escape(product.name)}">${img(product)}<span class="expand-label">Se stort ↗</span></button>
      <div class="gallery-thumbs">${product.photos.map((photo, index) => `<button class="gallery-thumb photo-frame ${index === 0 ? 'selected' : ''}" data-gallery="${index}" aria-label="${product.photoLabels[index]}" aria-pressed="${index === 0}">${img(product, index)}</button>`).join('')}</div>
      <p class="gallery-caption">Egne billeder af den konkrete vare. Tryk på billedet for at se detaljerne.</p></div>
      <div class="product-details"><p class="eyebrow">SUPREME / FW25 · BOX LOGO</p><h2>${escape(product.name)}</h2><p class="detail-price">${money(product.price)}</p>
      <div class="detail-badges"><span>${product.condition}</span><span>✓ Kvittering medfølger</span></div>
      <div class="detail-color"><span>Farve: <strong>${product.color}</strong></span><div class="variant-options">${variants.map(other => `<button class="variant-swatch ${other.id === product.id ? 'selected' : ''}" style="--swatch:${other.hex}" data-variant="${other.id}" aria-label="Vælg ${other.color.toLowerCase()}" aria-pressed="${other.id === product.id}"></button>`).join('')}</div></div>
      <div class="detail-label"><span>Størrelse</span><button class="size-guide" id="size-guide">Størrelse & pasform</button></div><span class="available-size">${product.size}<span>✓</span></span>
      <p class="detail-note">${product.offers ? 'Bud er velkomne.' : ''}</p><p class="dispatch-note"><span aria-hidden="true">↗</span> ${product.dispatch}</p>
      <details class="product-accordion" open><summary>Om varen</summary><p>${escape(product.description)}</p></details>
      <details class="product-accordion" id="fit-details"><summary>Størrelse & pasform</summary><p>Størrelse ${product.size}. Præcise mål er endnu ikke oplyst. Se egne billeder af mærker og detaljer i galleriet.</p></details>
      <details class="product-accordion"><summary>Fragt & retur</summary><p>Varen afsendes inden for 24 timer. Det er afsendelsestiden; leveringstiden afhænger af fragtfirmaet. Fragtpris og returvilkår bliver oplyst inden køb.</p></details>
      <div class="purchase-area"><button class="add-product" id="detail-add" style="--button-color:${product.hex};--button-text:${product.color === 'Sort' ? '#fff' : '#252722'}"><span>${bag.includes(product.id) ? 'Se varen i kurven' : 'Læg i kurv'}</span><span>↗</span></button><p class="demo-caption">Checkout er en demo · betaling er ikke tilsluttet endnu.</p></div></div></div>`;
    $$('[data-gallery]').forEach(button => button.onclick = () => setGallery(Number(button.dataset.gallery)));
    $$('[data-variant]').forEach(button => button.onclick = () => { if (button.dataset.variant !== currentProduct.id) showProduct(button.dataset.variant); });
    $('#size-guide').onclick = () => { $('#fit-details').open = true; $('#fit-details').scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'nearest' }); };
    $('#detail-add').onclick = () => addToBag(product.id);
    $('#gallery-expand').onclick = openLargePhoto;
    openDialog('#product-dialog'); $('#product-dialog').scrollTop = 0; fitPhotos();
  }
  function setGallery(index) {
    currentPhoto = index;
    const frame = $('#gallery-expand');
    frame.innerHTML = `${img(currentProduct, index)}<span class="expand-label">Se stort ↗</span>`;
    $$('[data-gallery]').forEach(button => { const selected = Number(button.dataset.gallery) === index; button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', String(selected)); });
    fitPhotos();
    animateElement(frame.querySelector('img'), [{ opacity: .25, transform: 'scale(.98)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 400 });
  }
  function renderLargePhoto() {
    $('#large-photo').innerHTML = img(currentProduct, currentPhoto);
    $('#photo-counter').textContent = `${currentPhoto + 1} / ${currentProduct.photos.length} · ${currentProduct.photoLabels[currentPhoto]}`;
    fitPhotos();
  }
  function openLargePhoto() {
    $('#photo-dialog').showModal(); renderLargePhoto();
    animateElement($('#photo-dialog'), [{ opacity: 0 }, { opacity: 1 }], { duration: 250 });
  }
  function stepPhoto(direction) { setGallery((currentPhoto + direction + currentProduct.photos.length) % currentProduct.photos.length); renderLargePhoto(); }
  $('#photo-prev').onclick = () => stepPhoto(-1); $('#photo-next').onclick = () => stepPhoto(1);
  $('#photo-dialog').addEventListener('keydown', event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); stepPhoto(event.key === 'ArrowLeft' ? -1 : 1); } });

  function subtotal() { return bag.reduce((total, id) => total + products.find(product => product.id === id).price, 0); }
  function persistBag() {
    if (previousBagCount !== bag.length) { animateElement($('#bag-count'), [{ transform: 'scale(1)' }, { transform: 'scale(1.55)', background: '#c3d1b4', offset: .45 }, { transform: 'scale(1)' }], { duration: 520 }); previousBagCount = bag.length; }
    save('yong.bag', bag); $('#bag-count').textContent = bag.length;
    $('#bag-open').setAttribute('aria-label', `Åbn kurven, ${bag.length} varer`); renderBag();
  }
  function addToBag(id) {
    if (bag.includes(id)) { openDialog('#bag-dialog'); toast('Varen ligger allerede i din kurv.'); return; }
    if (!products.some(product => product.id === id)) return;
    bag.push(id); persistBag(); openDialog('#bag-dialog');
  }
  function removeFromBag(id) { bag = bag.filter(item => item !== id); persistBag(); toast('Varen er fjernet fra kurven.'); }
  function renderBag() {
    $('#drawer-count').textContent = `(${bag.length})`;
    if (!bag.length) {
      $('#bag-items').innerHTML = '<div class="bag-empty"><h3>Plads til dit næste fund.</h3><p>Din kurv er tom.<br>Find din næste favorit i udvalget.</p><button class="pill dark" id="continue-shopping">Se udvalget ↗</button></div>';
      $('#bag-summary').hidden = true; $('#continue-shopping').onclick = () => closeDialog($('#bag-dialog')); return;
    }
    $('#bag-summary').hidden = false;
    $('#bag-items').innerHTML = bag.map(id => {
      const product = products.find(product => product.id === id);
      return `<div class="bag-item"><span class="bag-photo photo-frame">${img(product)}</span><div class="bag-item-details"><div class="bag-item-top"><span>${escape(product.name)}</span><span>${money(product.price)}</span></div><p>${product.color} · Str. ${product.size} · ${product.condition}</p><div class="bag-item-actions"><div class="quantity"><button data-remove="${id}" aria-label="Fjern ${escape(product.name)}">−</button><span>1</span><button disabled aria-label="Der er én af denne vare">+</button></div><button class="remove" data-remove="${id}">Fjern</button></div></div></div>`;
    }).join('');
    const related = products.find(product => !bag.includes(product.id));
    if (related) $('#bag-items').innerHTML += `<h3 class="related-title">Også i udvalget</h3><div class="related-card"><span class="related-photo photo-frame">${img(related)}</span><p>${escape(related.name)}<span>${money(related.price)} · Str. ${related.size}</span></p><button data-add="${related.id}" aria-label="Tilføj ${escape(related.name)}">+</button></div>`;
    $('#bag-summary').innerHTML = `<div class="subtotal"><span>Subtotal</span><span>${money(subtotal())}</span></div><p class="shipping-note">Fragtpris oplyses inden køb.<br>Checkout er en demo · ingen betaling.</p><button class="pill dark wide" id="checkout-open">Se checkout-demo <span>↗</span></button>`;
    $('#checkout-open').onclick = showCheckout; fitPhotos();
  }
  $('#bag-open').onclick = () => { renderBag(); openDialog('#bag-dialog'); };
  function showCheckout() {
    $('#checkout-items').innerHTML = bag.map(id => { const product = products.find(product => product.id === id); return `<div class="checkout-line"><span>${escape(product.name)}<small>${product.color} / Str. ${product.size} · ${product.condition} · 1 stk.</small></span><span>${money(product.price)}</span></div>`; }).join('');
    $('#checkout-total').innerHTML = `<div class="checkout-line"><span>Varer</span><span>${money(subtotal())}</span></div><div class="checkout-line"><span>Fragt</span><span>Oplyses før køb</span></div><div class="subtotal" style="margin-top:18px"><span>I alt ekskl. fragt</span><span>${money(subtotal())}</span></div>`;
    $('#demo-finish').disabled = false; $('#demo-finish').innerHTML = 'Prøv checkout-demoen <span>↗</span>'; openDialog('#checkout-dialog');
  }
  $('#demo-finish').onclick = () => { $('#demo-finish').textContent = 'Demo gennemført ✓'; $('#demo-finish').disabled = true; toast('Demo gennemført. Ingen ordre eller betaling er oprettet.'); };
  function renderSearch() {
    const query = $('#search-input').value.toLowerCase().trim();
    const matches = products.filter(product => `${product.name} ${product.brand} ${product.color} ${product.category} ${product.size} ${product.condition}`.toLowerCase().includes(query));
    $('#search-results').innerHTML = matches.length ? matches.map(product => `<button class="search-result" data-product="${product.id}"><span class="search-photo photo-frame">${img(product)}</span><div><strong>${escape(product.name)}</strong><span>${product.color} / Str. ${product.size} · ${money(product.price)} · ${product.condition}</span></div></button>`).join('') : '<p class="muted">Ingen varer fundet. Prøv en anden søgning.</p>';
    fitPhotos();
  }
  $('#search-open').onclick = () => { renderSearch(); openDialog('#search-dialog'); $('#search-input').focus(); };
  $('#search-input').oninput = renderSearch;
  $('#notify-open').onclick = () => openDialog('#newsletter-dialog');
  $('#newsletter-form').onsubmit = event => { event.preventDefault(); newsletterDismissed = true; save('yong.newsletter.dismissed', true); $('#newsletter-message').textContent = 'Tak, fordi du prøvede tilmeldingen. Din mail er ikke gemt eller sendt. Funktionen bliver tilsluttet inden åbning.'; $('#newsletter-form').reset(); toast('Demo gennemført. Din mail er ikke sendt.'); };
  function schedulePopup() {
    if (popupScheduled || newsletterDismissed) return;
    popupScheduled = true;
    setTimeout(() => { if (!newsletterDismissed && !document.hidden && !$('dialog[open]')) openDialog('#newsletter-dialog'); }, window.STORE.popupDelay);
  }
  document.addEventListener('pointerdown', schedulePopup, { once: true }); document.addEventListener('scroll', schedulePopup, { once: true, passive: true });
  function showInfo(kind) {
    const content = {
      about: ['Nye og secondhand fund.', 'YONG ARCHIVE er et udvalg af både helt nye og brugte varer. Standen fremgår altid af den enkelte vare.', 'De to Supreme Box Logo hoodies fra FW25 er helt nye, i størrelse M og med kvittering. Billederne viser de konkrete varer.'],
      shipping: ['Fragt & retur.', 'De to Supreme-hoodies afsendes inden for 24 timer. Leveringstiden afhænger af fragtfirmaet.', 'Fragtpris, returvilkår og øvrige handelsbetingelser bliver oplyst inden åbning. Checkout er en demo, og der tages ikke imod betaling endnu.'],
      contact: ['Kontakt & bud.', 'Bud på varerne er velkomne. Kontaktoplysninger bliver tilføjet inden åbning.', 'Checkout og tilmelding er endnu kun demoer.']
    }[kind];
    $('#info-content').innerHTML = `<p class="eyebrow">YONG ARCHIVE</p><h2>${content[0]}</h2><p>${content[1]}</p><p>${content[2]}</p>`; openDialog('#info-dialog');
  }
  document.addEventListener('click', event => {
    const condition = event.target.closest('[data-condition],[data-nav]');
    if (condition) { state.condition = condition.dataset.condition || condition.dataset.nav; render(); if (condition.dataset.nav) $('#collection').scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth' }); }
    const product = event.target.closest('[data-product]'); if (product) showProduct(product.dataset.product);
    const add = event.target.closest('[data-add]'); if (add) addToBag(add.dataset.add);
    const remove = event.target.closest('[data-remove]'); if (remove) removeFromBag(remove.dataset.remove);
    const tag = event.target.closest('[data-remove-filter]');
    if (tag) { const key = tag.dataset.removeFilter; if (key === 'condition') state.condition = 'all'; else if (key === 'maxPrice') state.maxPrice = maxPrice; else state[key] = state[key].filter(value => value !== tag.dataset.value); render(); }
    const info = event.target.closest('[data-info]'); if (info) showInfo(info.dataset.info);
  });
  if (!reducedMotion.matches) {
    document.documentElement.classList.add('motion-ready');
    $$('.next-edit,.values>div').forEach(section => { section.classList.add('reveal-section'); if (revealObserver) revealObserver.observe(section); else section.classList.add('is-revealed'); });
  }
  let scrollFrame = false;
  function updateScroll() { const max = document.documentElement.scrollHeight - innerHeight; document.documentElement.style.setProperty('--scroll-progress', max > 0 ? `${Math.min(100, scrollY / max * 100)}%` : '0%'); $('.header').classList.toggle('is-scrolled', scrollY > 30); scrollFrame = false; }
  document.addEventListener('scroll', () => { if (!scrollFrame) { scrollFrame = true; requestAnimationFrame(updateScroll); } }, { passive: true });
  $('#year').textContent = new Date().getFullYear(); render(); persistBag(); updateScroll();
})();
