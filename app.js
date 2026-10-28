(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const products = window.PRODUCTS;
  const maxPrice = window.STORE.maxPrice;
  const money = value => new Intl.NumberFormat('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 }).format(value);
  const hasPrice = product => typeof product.price === 'number' && Number.isFinite(product.price);
  const textOn = color => { const value = color.replace('#', ''); const rgb = [0, 2, 4].map(offset => parseInt(value.slice(offset, offset + 2), 16)); return (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000 > 145 ? '#20251b' : '#ffffff'; };
  const priceText = product => hasPrice(product) ? money(product.price) : 'Pris kommer';
  const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const save = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
  const defaults = () => ({ condition: 'all', category: 'all', sizes: [], colors: [], minPrice: 0, maxPrice, sort: 'featured' });
  let state = defaults();
  let bag = read('yong.bag', []);
  if (!Array.isArray(bag)) bag = [];
  bag = [...new Set(bag)].filter(id => products.some(product => product.id === id && hasPrice(product)));
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
      $('#newsletter-form').reset();
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

  // Responsive derivatives keep the original pixels, colors and photo orientation.
  // The full-size viewer always opens the untouched source photo.
  function img(product, index = 0, extra = '', context = 'small', priority = false) {
    const file = product.photos[index];
    const asset = window.PHOTO_ASSETS?.[file];
    const rotation = product.rotations?.[index] || 0;
    const sizes = { grid: '(max-width:700px) 46vw, (max-width:1000px) 44vw, 30vw', detail: '(max-width:700px) 94vw, 49vw', thumb: '100px', small: '130px' }[context] || '100vw';
    const sources = asset?.sources || [];
    const fallback = context === 'original' ? file : sources[0]?.src || file;
    const rawSizes = Math.abs(rotation) % 180 === 90 ? { grid: '(max-width:700px) 62vw, (max-width:1000px) 59vw, 40vw', detail: '(max-width:700px) 125vw, 66vw', thumb: '134px', small: '174px' }[context] || sizes : sizes;
    const responsive = context !== 'original' && sources.length ? `srcset="${sources.map(source => `${escape(source.src)} ${source.width}w`).join(', ')}" sizes="${rawSizes}"` : '';
    const dimensions = asset ? `width="${asset.width}" height="${asset.height}"` : '';
    return `<img src="${escape(fallback)}" ${responsive} ${dimensions} alt="${escape(product.name)} – ${escape(product.photoLabels[index])}" loading="${priority || context === 'detail' || context === 'original' ? 'eager' : 'lazy'}" decoding="async" fetchpriority="${priority ? 'high' : 'auto'}" ${rotation ? `data-rotate="${rotation}"` : ''} ${extra}>`;
  }
  function fitRotatedFrame(frame) {
    const image = frame.querySelector('img[data-rotate]');
    if (!image) return;
    const { width, height } = frame.getBoundingClientRect();
    const quarterTurn = Math.abs(Number(image.dataset.rotate)) % 180 === 90;
    image.style.width = `${quarterTurn ? height : width}px`;
    image.style.height = `${quarterTurn ? width : height}px`;
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
      (state.category === 'all' || product.category === state.category) &&
      (!state.sizes.length || state.sizes.includes(product.size)) &&
      (!state.colors.length || state.colors.includes(product.color)) && (hasPrice(product) ? product.price >= state.minPrice && product.price <= state.maxPrice : state.minPrice === 0 && state.maxPrice === maxPrice));
    if (state.sort === 'price-low') result.sort((a, b) => !hasPrice(a) ? (hasPrice(b) ? 1 : 0) : !hasPrice(b) ? -1 : a.price - b.price);
    if (state.sort === 'price-high') result.sort((a, b) => !hasPrice(a) ? (hasPrice(b) ? 1 : 0) : !hasPrice(b) ? -1 : b.price - a.price);
    if (state.sort === 'newest') result.sort((a, b) => b.date.localeCompare(a.date));
    return result;
  }
  function card(product, order) {
    return `<article class="product-card"><button class="product-image" data-product="${product.id}" aria-label="Se ${escape(product.name)}, ${priceText(product)}">
      <span class="sample-badge real-condition">${product.conditionType === 'new' ? 'Helt ny' : 'Secondhand'}</span><span class="product-media photo-frame" style="--front-scale:${product.cardScale || 1}">${img(product, 0, 'class="primary"', 'grid', order < 1)}${img(product, 1, 'class="alternate"', 'grid')}</span><span class="product-size">Str. ${product.size}</span></button>
      ${hasPrice(product) ? `<button class="quick-add" data-add="${product.id}" aria-label="Læg ${escape(product.name)} i kurven">+</button>` : ''}
      <div class="product-meta"><div class="product-topline"><button class="product-name" data-product="${product.id}">${escape(product.name)}</button><span class="product-price">${priceText(product)}</span></div>
      <p class="product-description">${product.color} / Str. ${product.size}</p><div class="product-bottom"><span class="swatch" style="--swatch:${product.hex}" role="img" aria-label="Farve: ${product.color}"></span><span class="condition">${escape(product.condition)}</span></div></div></article>`;
  }
  function render() {
    const list = filtered();
    $('#product-grid').innerHTML = list.map(card).join('');
    $('[data-condition=all] span').textContent = String(products.length).padStart(2, '0');
    $('#result-count').textContent = `${list.length} ${list.length === 1 ? 'vare' : 'varer'}`;
    $('#empty-state').hidden = list.length > 0;
    $$('[data-condition]').forEach(button => { const selected = button.dataset.condition === state.condition; button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', String(selected)); });
    $$('[data-nav]').forEach(button => button.classList.toggle('active', button.dataset.nav === state.condition));
    $$('[data-type]').forEach(button => { const selected = button.dataset.type === state.category; button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', String(selected)); });
    $('#sort').value = state.sort;
    const tags = [];
    if (state.category !== 'all') tags.push({ type: 'category', value: state.category, label: state.category });
    if (state.condition !== 'all') tags.push({ type: 'condition', value: state.condition, label: conditionLabel(state.condition) });
    state.sizes.forEach(value => tags.push({ type: 'sizes', value, label: `Str. ${value}` }));
    state.colors.forEach(value => tags.push({ type: 'colors', value, label: value }));
    if (state.minPrice > 0 || state.maxPrice < maxPrice) tags.push({ type: 'maxPrice', value: '', label: `${money(state.minPrice)} – ${money(state.maxPrice)}` });
    $('#active-filters').innerHTML = tags.map(tag => `<button class="filter-tag" data-remove-filter="${tag.type}" data-value="${escape(tag.value)}">${escape(tag.label)} <span aria-hidden="true">×</span><span class="sr-only">Fjern filter</span></button>`).join('');
    $('#filter-count').textContent = tags.length || '';
    $('#show-results').textContent = `Vis ${list.length} ${list.length === 1 ? 'vare' : 'varer'}`;
    if (!list.length) {
      $('#empty-state h3').textContent = state.condition === 'preowned' ? 'Ingen secondhand varer lige nu.' : 'Ingen varer i dette udvalg.';
      if (state.category === 'Sko' || state.category === 'Accessories') $('#empty-state h3').textContent = `Ingen ${state.category.toLowerCase()} lige nu.`;
      $('#empty-state p').textContent = state.condition === 'preowned' ? 'Prøv andre filtre, eller se hele udvalget.' : 'Prøv en anden stand, farve eller størrelse.';
    }
    syncFilters(); revealCards(); fitPhotos();
  }
  const categories = ['T-shirts', 'Hoodies', 'Overshirts', 'Longsleeves', 'Sko', 'Accessories'];
  $('#type-options').innerHTML = ['all', ...categories].map(value => `<label class="option-label"><input type="radio" name="category" value="${value}">${value === 'all' ? 'Alle kategorier' : value}</label>`).join('');
  $('#category-options').innerHTML = ['all', 'new', 'preowned'].map(value => `<label class="option-label"><input type="radio" name="condition" value="${value}">${conditionLabel(value)}</label>`).join('');
  $('#size-options').innerHTML = [...new Set(products.map(product => product.size))].map(value => `<label class="size-choice"><input type="checkbox" name="size" value="${value}"><span>${value}</span></label>`).join('');
  $('#color-options').innerHTML = products.map(product => `<label class="option-label"><input type="checkbox" name="color" value="${product.color}"><span class="swatch" style="--swatch:${product.hex}"></span>${product.color}</label>`).join('');
  function syncFilters() {
    $$('input[name=category]').forEach(input => input.checked = input.value === state.category);
    $$('input[name=condition]').forEach(input => input.checked = input.value === state.condition);
    $$('input[name=size]').forEach(input => input.checked = state.sizes.includes(input.value));
    $$('input[name=color]').forEach(input => input.checked = state.colors.includes(input.value));
    $('#min-price-input').value = state.minPrice; $('#max-price-input').value = state.maxPrice;
    $('#max-price').value = state.maxPrice; $('#range-value').textContent = money(state.maxPrice);
  }
  function reset() { state = defaults(); render(); }
  $('#filters-dialog').addEventListener('change', event => {
    if (event.target.name === 'category') state.category = event.target.value;
    if (event.target.name === 'condition') state.condition = event.target.value;
    if (event.target.name === 'size') state.sizes = $$('input[name=size]:checked').map(input => input.value);
    if (event.target.name === 'color') state.colors = $$('input[name=color]:checked').map(input => input.value);
    render();
  });
  function setPriceRange(minimum, maximum) {
    state.minPrice = Math.max(0, Math.min(maxPrice, minimum));
    state.maxPrice = Math.max(state.minPrice, Math.min(maxPrice, maximum));
    render();
  }
  $('#min-price-input').oninput = event => { if (event.target.value !== '') setPriceRange(Number(event.target.value), state.maxPrice); };
  $('#max-price-input').oninput = event => { if (event.target.value !== '') setPriceRange(Math.min(state.minPrice, Number(event.target.value)), Number(event.target.value)); };
  $('#max-price').oninput = event => setPriceRange(Math.min(state.minPrice, Number(event.target.value)), Number(event.target.value));
  $('#reset-filters').onclick = reset; $('#reset-empty').onclick = reset;
  $('#show-results').onclick = () => closeDialog($('#filters-dialog'));
  $('#filter-open').onclick = () => openDialog('#filters-dialog');
  $('#sort').onchange = event => { state.sort = event.target.value; render(); };

  function showProduct(id) {
    const product = products.find(product => product.id === id);
    if (!product) return;
    currentProduct = product; currentPhoto = 0;
    const variants = product.group ? products.filter(other => other.group === product.group) : [product];
    $('#product-content').innerHTML = `<div class="product-layout"><div class="product-gallery">
      <button class="main-product-image photo-frame" id="gallery-expand" aria-label="Se stort billede af ${escape(product.name)}">${img(product, 0, '', 'detail')}<span class="expand-label">Se stort ↗</span></button>
      <div class="gallery-thumbs">${product.photos.map((photo, index) => `<button class="gallery-thumb photo-frame ${index === 0 ? 'selected' : ''}" data-gallery="${index}" aria-label="${product.photoLabels[index]}" aria-pressed="${index === 0}">${img(product, index, '', 'thumb')}</button>`).join('')}</div>
      <p class="gallery-caption">Egne billeder af den konkrete vare. Tryk på billedet for at se detaljerne.</p></div>
      <div class="product-details"><p class="eyebrow">${escape(product.brand.toUpperCase())} / ${escape(product.category.toUpperCase())}</p><h2>${escape(product.name)}</h2><p class="detail-price">${priceText(product)}</p>
      <div class="detail-badges"><span>${product.conditionType === 'new' ? 'Helt ny' : 'Secondhand · ' + escape(product.condition)}</span></div>
      <div class="detail-color"><span>Farve: <strong>${product.color}</strong></span><div class="variant-options">${variants.map(other => `<button class="variant-swatch ${other.id === product.id ? 'selected' : ''}" style="--swatch:${other.hex}" data-variant="${other.id}" aria-label="Vælg ${other.color.toLowerCase()}" aria-pressed="${other.id === product.id}"></button>`).join('')}</div></div>
      <div class="detail-label"><span>Størrelse</span><button class="size-guide" id="size-guide">Størrelse & pasform</button></div><span class="available-size">${product.size}<span>✓</span></span>
      
      <details class="product-accordion" open><summary>Om varen</summary><p>${escape(product.description)}</p></details>
      <details class="product-accordion" id="fit-details"><summary>Størrelse & pasform</summary><p>Størrelse ${product.size}. Præcise mål er endnu ikke oplyst. Se egne billeder af mærker og detaljer i galleriet.</p></details>
      <details class="product-accordion"><summary>Fragt & retur</summary><p>Fragtpris, leveringstid og returvilkår bliver oplyst inden køb.</p></details>
      <div class="purchase-area"><button class="add-product" id="detail-add" ${hasPrice(product) ? '' : 'disabled'} style="--button-color:${product.hex};--button-text:${textOn(product.hex)}"><span>${!hasPrice(product) ? 'Pris kommer' : bag.includes(product.id) ? 'Se varen i kurven' : 'Læg i kurv'}</span><span>↗</span></button><p class="demo-caption">Checkout er en demo · betaling er ikke tilsluttet endnu.</p></div></div></div>`;
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
    frame.innerHTML = `${img(currentProduct, index, '', 'detail')}<span class="expand-label">Se stort ↗</span>`;
    $$('[data-gallery]').forEach(button => { const selected = Number(button.dataset.gallery) === index; button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', String(selected)); });
    fitPhotos();
    animateElement(frame.querySelector('img'), [{ opacity: .25, transform: 'scale(.98)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 400 });
  }
  function renderLargePhoto() {
    $('#large-photo').innerHTML = img(currentProduct, currentPhoto, '', 'original');
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
    if (!products.some(product => product.id === id && hasPrice(product))) return;
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
      return `<div class="bag-item"><span class="bag-photo photo-frame">${img(product)}</span><div class="bag-item-details"><div class="bag-item-top"><span>${escape(product.name)}</span><span>${priceText(product)}</span></div><p>${product.color} · Str. ${product.size} · ${product.condition}</p><div class="bag-item-actions"><div class="quantity"><button data-remove="${id}" aria-label="Fjern ${escape(product.name)}">−</button><span>1</span><button disabled aria-label="Der er én af denne vare">+</button></div><button class="remove" data-remove="${id}">Fjern</button></div></div></div>`;
    }).join('');
    const related = products.find(product => hasPrice(product) && !bag.includes(product.id));
    if (related) $('#bag-items').innerHTML += `<h3 class="related-title">Også i udvalget</h3><div class="related-card"><span class="related-photo photo-frame">${img(related)}</span><p>${escape(related.name)}<span>${priceText(related)} · Str. ${related.size}</span></p><button data-add="${related.id}" aria-label="Tilføj ${escape(related.name)}">+</button></div>`;
    $('#bag-summary').innerHTML = `<div class="subtotal"><span>Subtotal</span><span>${money(subtotal())}</span></div><p class="shipping-note">Fragtpris oplyses inden køb.<br>Checkout er en demo · ingen betaling.</p><button class="pill dark wide" id="checkout-open">Se checkout-demo <span>↗</span></button>`;
    $('#checkout-open').onclick = showCheckout; fitPhotos();
  }
  $('#bag-open').onclick = () => { renderBag(); openDialog('#bag-dialog'); };
  function showCheckout() {
    $('#checkout-items').innerHTML = bag.map(id => { const product = products.find(product => product.id === id); return `<div class="checkout-line"><span>${escape(product.name)}<small>${product.color} / Str. ${product.size} · ${product.condition} · 1 stk.</small></span><span>${priceText(product)}</span></div>`; }).join('');
    $('#checkout-total').innerHTML = `<div class="checkout-line"><span>Varer</span><span>${money(subtotal())}</span></div><div class="checkout-line"><span>Fragt</span><span>Oplyses før køb</span></div><div class="subtotal" style="margin-top:18px"><span>I alt ekskl. fragt</span><span>${money(subtotal())}</span></div>`;
    $('#demo-finish').disabled = false; $('#demo-finish').innerHTML = 'Prøv checkout-demoen <span>↗</span>'; openDialog('#checkout-dialog');
  }
  $('#demo-finish').onclick = () => { $('#demo-finish').textContent = 'Demo gennemført ✓'; $('#demo-finish').disabled = true; toast('Demo gennemført. Ingen ordre eller betaling er oprettet.'); };
  function renderSearch() {
    const query = $('#search-input').value.toLowerCase().trim();
    const matches = products.filter(product => `${product.name} ${product.brand} ${product.color} ${product.category} ${product.size} ${product.condition}`.toLowerCase().includes(query));
    $('#search-results').innerHTML = matches.length ? matches.map(product => `<button class="search-result" data-product="${product.id}"><span class="search-photo photo-frame">${img(product)}</span><div><strong>${escape(product.name)}</strong><span>${product.color} / Str. ${product.size} · ${priceText(product)} · ${product.condition}</span></div></button>`).join('') : '<p class="muted">Ingen varer fundet. Prøv en anden søgning.</p>';
    fitPhotos();
  }
  $('#search-open').onclick = () => { renderSearch(); openDialog('#search-dialog'); $('#search-input').focus(); };
  $('#search-input').oninput = renderSearch;
  $('#notify-open').onclick = () => openDialog('#newsletter-dialog');
  $('#newsletter-form').onsubmit = event => {
    event.preventDefault(); newsletterDismissed = true; save('yong.newsletter.dismissed', true);
    $('#newsletter-form').reset();
    openWheel();
  };
  const wheelSegments = window.STORE.wheel;
  const wheelColors = ['#b5cc95', '#d6d8d0', '#6b8b4e', '#dfbd6b'];
  let wheelResult = read('rascal.wheel.result', null), wheelSpinning = false;
  const point = angle => ({ x: 180 + 170 * Math.cos((angle - 90) * Math.PI / 180), y: 180 + 170 * Math.sin((angle - 90) * Math.PI / 180) });
  let angleStart = 0;
  $('#wheel-disc').innerHTML = wheelSegments.map((segment, index) => {
    const angleEnd = angleStart + segment.weight * 3.6;
    const from = point(angleStart), to = point(angleEnd), middle = (angleStart + angleEnd) / 2;
    const labelPoint = { x: 180 + 105 * Math.cos((middle - 90) * Math.PI / 180), y: 180 + 105 * Math.sin((middle - 90) * Math.PI / 180) };
    const label = segment.discount ? `${segment.discount} %` : 'Ingen rabat';
    const path = `<path d="M180 180 L${from.x} ${from.y} A170 170 0 ${segment.weight > 50 ? 1 : 0} 1 ${to.x} ${to.y} Z" fill="${wheelColors[index]}" stroke="#faf9f6" stroke-width="1.5"/>`;
    const text = segment.weight >= 20 ? `<text x="${labelPoint.x}" y="${labelPoint.y}" text-anchor="middle" dominant-baseline="middle" font-size="${segment.discount ? 28 : 12}" font-weight="550" fill="#25311c">${label}</text>` : '';
    angleStart = angleEnd;
    return path + text;
  }).join('');
  function randomUnit() { const value = new Uint32Array(1); crypto.getRandomValues(value); return value[0] / 4294967296; }
  function displayWheelResult() {
    if (!wheelResult) return;
    const discount = wheelResult.discount;
    $('#spin-wheel').disabled = true;
    $('#spin-wheel').textContent = 'Dit spin er brugt';
    $('#wheel-disc').style.transition = 'none';
    $('#wheel-disc').style.transform = `rotate(${wheelResult.rotation}deg)`;
    $('#wheel-result').innerHTML = discount
      ? `<strong>${discount} % rabat i demoen</strong><p>Dit resultat er gemt i denne browser.</p><span class="wheel-code">DEMO${discount}</span><small>Demokode · kan ikke bruges til køb endnu.</small>`
      : '<strong>Ingen rabat denne gang.</strong><p>Du kan stadig holde øje med de næste fund.</p><small>Dette var et demo-spin.</small>';
  }
  function openWheel() {
    openDialog('#wheel-dialog');
    if (wheelResult) displayWheelResult();
  }
  $('#spin-wheel').onclick = () => {
    if (wheelSpinning || wheelResult) return;
    wheelSpinning = true;
    const draw = randomUnit() * 100;
    let cumulative = 0, selectedIndex = 0;
    for (let index = 0; index < wheelSegments.length; index++) {
      cumulative += wheelSegments[index].weight;
      if (draw < cumulative) { selectedIndex = index; break; }
    }
    const selected = wheelSegments[selectedIndex];
    const before = wheelSegments.slice(0, selectedIndex).reduce((sum, segment) => sum + segment.weight, 0);
    const targetAngle = (before + selected.weight * (.15 + randomUnit() * .7)) * 3.6;
    wheelResult = { discount: selected.discount, rotation: 7 * 360 + 360 - targetAngle };
    save('rascal.wheel.result', wheelResult);
    $('#spin-wheel').disabled = true;
    $('#spin-wheel').textContent = 'Hjulet drejer…';
    $('#wheel-result').textContent = '';
    const disc = $('#wheel-disc');
    disc.style.transition = reducedMotion.matches ? 'none' : 'transform 5.8s cubic-bezier(.12,.72,.11,1)';
    disc.style.transform = `rotate(${wheelResult.rotation}deg)`;
    setTimeout(() => { wheelSpinning = false; displayWheelResult(); }, reducedMotion.matches ? 0 : 5850);
  };
  function schedulePopup() {
    if (popupScheduled || newsletterDismissed) return;
    popupScheduled = true;
    setTimeout(() => { if (!newsletterDismissed && !document.hidden && !$('dialog[open]')) openDialog('#newsletter-dialog'); }, window.STORE.popupDelay);
  }
  document.addEventListener('pointerdown', schedulePopup, { once: true }); document.addEventListener('scroll', schedulePopup, { once: true, passive: true });
  function showInfo(kind) {
    if (kind === 'withdrawal') { openDialog('#withdrawal-dialog'); return; }
    if (kind === 'privacy' || kind === 'competition') { showLegal(kind); return; }
    if (kind === 'returns') { openDialog('#policy-dialog'); $('#policy-dialog').scrollTop = 0; return; }
    const content = {
      about: ['Nye og secondhand fund.', 'RASCAL ARCHIVE er et udvalg af både helt nye og brugte varer. Standen fremgår altid af den enkelte vare.', 'Her handler det om personlig stil og gode fund. Egne billeder og tydelige oplysninger om størrelse, farve og stand gør det nemt at se, hvad du vælger.'],
      shipping: ['Fragt & retur.', 'Fragtpris og leveringstid bliver oplyst inden køb.', 'Fragtpris, returvilkår og øvrige handelsbetingelser bliver oplyst inden åbning. Checkout er en demo, og der tages ikke imod betaling endnu.'],
      contact: ['Kontakt & sælger.', 'Rascal Archive er butikkens navn. Den juridiske sælgers navn, fysiske adresse, kontaktmail, telefon og eventuelt CVR-nummer er endnu ikke oplyst.', 'Oplysningerne bliver tilføjet før åbning. Der kan ikke gennemføres rigtige køb eller nyhedsbrevstilmeldinger i denne forhåndsvisning.']
    }[kind];
    $('#info-content').innerHTML = `<p class="eyebrow">RASCAL ARCHIVE</p><h2>${content[0]}</h2><p>${content[1]}</p><p>${content[2]}</p>`; openDialog('#info-dialog');
  }
  function showLegal(kind) {
    const privacy = `<p class="eyebrow">RASCAL ARCHIVE / PRIVATLIV</p><h2>Privatliv & lokale valg.</h2><div class="policy-draft">Oplysninger om den juridiske sælger, kontaktmail og endelige hosting- og mailleverandører mangler før åbning.</div><section><h3>Formularer i denne demo</h3><p>Der oprettes ingen ordre eller nyhedsbrevstilmelding. Mailfeltet bliver tømt efter testen; appen gemmer eller sender ikke adressen. Brug gerne en fiktiv adresse. Fortrydelsesformularen er endnu ikke aktiv.</p></section><section><h3>Det gemmes i browseren</h3><p>Appen husker din kurv, dit aktivt valgte lyse/mørke tema, om du har lukket tilmeldingen, og demoresultatet fra lykkehjulet. Valgene gemmes lokalt, indtil de ryddes i browseren. Filtre beholdes kun, mens siden er åben. Appen indeholder ingen analyse- eller annonceværktøjer.</p><button class="pill dark" id="clear-local-data">Ryd appens lokale valg</button></section><section><h3>Adgang til forhåndsvisningen</h3><p>Den hostede forhåndsvisning kan kræve ChatGPT-login. Udbyderen behandler adgangsoplysninger efter sine egne vilkår. Den endelige privatlivstekst skal også beskrive den valgte hostings tekniske logning og eventuelle databehandlere.</p></section><section><h3>Før rigtige tilmeldinger</h3><p>Navn og kontakt på den dataansvarlige, behandlingsgrundlag, opbevaringstid, modtagere og relevante overførsler bliver oplyst inden indsamling. Der skal også være nem adgang til at afmelde og gøre rettigheder gældende. Du kan læse om databeskyttelse og klageadgang hos <a href="https://www.datatilsynet.dk/" target="_blank" rel="noopener noreferrer">Datatilsynet</a>.</p></section>`;
    const competition = `<p class="eyebrow">RASCAL ARCHIVE / LYKKEHJUL</p><h2>Vilkår for demoen.</h2><div class="policy-draft">Dette er en gratis demonstration. Der uddeles ingen reel præmie, og koderne kan ikke indløses. En aktiv kampagnes periode, ansvarlige virksomhed og fulde indløsningsvilkår skal oplyses før åbning.</div><section><h3>Deltagelse</h3><p>Du prøver nyhedsbrevets tilmeldingsflow før hjulet. Der oprettes intet reelt samtykke eller abonnement. Du kan bruge en fiktiv mailadresse. Ingen køb eller betaling kræves. Ét demoresultat gemmes lokalt pr. browser.</p></section><section><h3>Udfald og chancer</h3><p>5 %: 65 % chance. Ingen rabat: 25 %. 10 %: 8 %. 15 %: 2 %. Resultatet vælges tilfældigt ved tryk på drejeknappen og vises straks efter animationen. Der vælges ikke efterfølgende en anden vinder. SVG-hjulets felter følger de samme proportioner.</p></section><section><h3>Demoresultatet</h3><p>Resultatet vises kun i din browser. Ingen deltagerliste eller vindernavne offentliggøres. Der er ingen aktiv rabatkode, kontantpræmie eller udløbsfrist på en indløselig gevinst i denne demo. Før en reel kampagne åbner, skal gyldighed, omfattede varer, begrænsninger og levering af rabatten fremgå tydeligt.</p></section><section><h3>Nyhedsbrev ved åbning</h3><p>En rigtig tilmelding kræver et særskilt, aktivt og dokumenterbart ja til e-mailmarkedsføring fra den oplyste sælger. Samtykke skal kunne trækkes tilbage gratis og nemt. Afmelding må ikke fjerne en allerede opnået præmie eller rabat.</p></section>`;
    $('#legal-content').innerHTML = kind === 'privacy' ? privacy : competition;
    openDialog('#legal-dialog'); $('#legal-dialog').scrollTop = 0;
    const clear = $('#clear-local-data');
    if (clear) clear.onclick = () => {
      try { ['yong.bag','yong.filters.v2','yong.newsletter.dismissed','rascal.theme','rascal.wheel.result'].forEach(key => localStorage.removeItem(key)); } catch {}
      bag = []; state = defaults(); wheelResult = null; wheelSpinning = false; newsletterDismissed = false;
      $('#spin-wheel').disabled = false; $('#spin-wheel').innerHTML = 'Drej hjulet <span>↻</span>';
      $('#wheel-result').textContent = ''; $('#wheel-disc').style.transition = 'none'; $('#wheel-disc').style.transform = 'rotate(0deg)';
      render(); persistBag();
      clear.textContent = 'Lokale valg er ryddet ✓'; clear.disabled = true;
      toast('Appens lokale valg er ryddet. Tema nulstilles ved næste besøg.');
    };
  }
  document.addEventListener('click', event => {
    const condition = event.target.closest('[data-condition],[data-nav]');
    const type = event.target.closest('[data-type]');
    if (type) { state.category = type.dataset.type; render(); }
    if (condition) { state.condition = condition.dataset.condition || condition.dataset.nav; if (condition.dataset.nav === 'all') state.category = 'all'; render(); if (condition.dataset.nav) $('#collection').scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth' }); }
    const product = event.target.closest('[data-product]'); if (product) showProduct(product.dataset.product);
    const add = event.target.closest('[data-add]'); if (add) addToBag(add.dataset.add);
    const remove = event.target.closest('[data-remove]'); if (remove) removeFromBag(remove.dataset.remove);
    const tag = event.target.closest('[data-remove-filter]');
    if (tag) { const key = tag.dataset.removeFilter; if (key === 'condition' || key === 'category') state[key] = 'all'; else if (key === 'maxPrice') { state.minPrice = 0; state.maxPrice = maxPrice; } else state[key] = state[key].filter(value => value !== tag.dataset.value); render(); }
    const info = event.target.closest('[data-info]'); if (info) showInfo(info.dataset.info);
  });
  if (!reducedMotion.matches) {
    document.documentElement.classList.add('motion-ready');
    $$('.next-edit,.values>div,.faq-section').forEach(section => { section.classList.add('reveal-section'); if (revealObserver) revealObserver.observe(section); else section.classList.add('is-revealed'); });
  }
  let scrollFrame = false;
  function updateScroll() { const max = document.documentElement.scrollHeight - innerHeight; document.documentElement.style.setProperty('--scroll-progress', max > 0 ? `${Math.min(100, scrollY / max * 100)}%` : '0%'); $('.header').classList.toggle('is-scrolled', scrollY > 30); scrollFrame = false; }
  document.addEventListener('scroll', () => { if (!scrollFrame) { scrollFrame = true; requestAnimationFrame(updateScroll); } }, { passive: true });
  function syncTheme() {
    const dark = document.documentElement.dataset.theme === 'dark';
    $('#theme-toggle').setAttribute('aria-label', dark ? 'Skift til lys visning' : 'Skift til mørk visning');
    $('#theme-toggle').setAttribute('aria-pressed', String(dark));
    document.querySelector('meta[name="theme-color"]').content = dark ? '#111310' : '#faf9f6';
  }
  $('#theme-toggle').onclick = () => {
    document.documentElement.dataset.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('rascal.theme', document.documentElement.dataset.theme); } catch {}
    syncTheme();
  };
  syncTheme();
  $('#year').textContent = new Date().getFullYear(); render(); persistBag(); updateScroll();
})();
