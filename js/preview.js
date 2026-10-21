/* Yahara static preview — reveals, announcement rotator, header, drawers, carousels, mock cart. Demo only: nothing is submitted anywhere. */
(() => {
  const d = document, root = d.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ICON = { pause: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6v12M15 6v12"/></svg>', play: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5l11 7-11 7z"/></svg>' };
  const $ = (s, c = d) => c.querySelector(s), $$ = (s, c = d) => [...c.querySelectorAll(s)];

  /* Scroll reveals (§6.5-A): rootMargin 0 0 -80px 0, wait for img.decode(), run once */
  const reveal = el => {
    const imgs = $$('img', el);
    Promise.all(imgs.map(i => (i.decode ? i.decode().catch(() => {}) : Promise.resolve()))).then(() => {
      el.style.setProperty('--d', (el.dataset.delay || 0) + 'ms');
      requestAnimationFrame(() => el.classList.add('is-in'));
    });
  };
  const motionEls = $$('[data-motion]');
  if (reduce || !('IntersectionObserver' in window)) motionEls.forEach(e => e.classList.add('is-in'));
  else {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { io.unobserve(e.target); reveal(e.target); } }), { rootMargin: '0px 0px -80px 0px' });
    motionEls.forEach(e => io.observe(e));
  }
  // Grid stagger: index × 50ms, cap 300ms
  $$('[data-stagger]').forEach(g => $$(':scope > *', g).forEach((c, i) => { const m = c.matches('[data-motion]') ? c : $('[data-motion]', c); if (m && !m.dataset.delay) m.dataset.delay = Math.min(i * 50, 300); }));

  /* Stat count-up (optional, §7.3) — final text already in HTML */
  if (!reduce && 'IntersectionObserver' in window) {
    const so = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return; so.unobserve(e.target);
      const el = e.target, target = +el.dataset.count, t0 = performance.now(), dur = 1200;
      const ease = t => 1 - Math.pow(1 - t, 3);
      const step = now => { const p = Math.min((now - t0) / dur, 1); el.textContent = Math.round(target * ease(p)); if (p < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    }), { rootMargin: '0px 0px -80px 0px' });
    $$('[data-count]').forEach(e => so.observe(e));
  }

  /* Announcement rotator (§6.5-D): 8s autoplay, loop, arrows, pause button, pause on hover/focus/hidden */
  $$('.announcement').forEach(bar => {
    const slides = $$('.announcement__slide', bar); if (slides.length < 2) return;
    let i = 0, timer = null, userPaused = false, hover = false;
    const pauseBtn = $('[data-ann-pause]', bar), live = $('.announcement__track', bar);
    const show = n => { slides[i].classList.remove('is-active'); slides[i].setAttribute('aria-hidden', 'true'); i = (n + slides.length) % slides.length; slides[i].classList.add('is-active'); slides[i].removeAttribute('aria-hidden'); };
    const stop = () => { clearInterval(timer); timer = null; };
    const play = () => { stop(); if (!userPaused && !hover && !d.hidden && !reduce) timer = setInterval(() => show(i + 1), 8000); };
    $('[data-ann-prev]', bar).addEventListener('click', () => { show(i - 1); play(); });
    $('[data-ann-next]', bar).addEventListener('click', () => { show(i + 1); play(); });
    pauseBtn.addEventListener('click', () => { userPaused = !userPaused; pauseBtn.setAttribute('aria-pressed', userPaused); pauseBtn.setAttribute('aria-label', userPaused ? 'Play announcements' : 'Pause announcements'); pauseBtn.innerHTML = userPaused ? ICON.play : ICON.pause; play(); });
    live.addEventListener('mouseenter', () => { hover = true; stop(); }); live.addEventListener('mouseleave', () => { hover = false; play(); });
    live.addEventListener('focusin', () => { hover = true; stop(); }); live.addEventListener('focusout', () => { hover = false; play(); });
    d.addEventListener('visibilitychange', play);
    if (reduce) { userPaused = true; pauseBtn.innerHTML = ICON.play; pauseBtn.setAttribute('aria-pressed', 'true'); }
    play();
  });

  /* Sticky header: hide on scroll down, show on scroll up (§7.2) */
  const header = $('.site-header');
  if (header) {
    let last = scrollY;
    addEventListener('scroll', () => {
      const y = scrollY; header.classList.toggle('is-scrolled', y > 10);
      if (y > 300 && y > last + 4 && !$('.nav__item.is-open')) header.classList.add('is-hidden');
      else if (y < last - 4 || y < 300) header.classList.remove('is-hidden');
      last = y;
    }, { passive: true });
  }

  /* Dropdowns: click + hover (fine pointer), Esc closes, arrow keys move */
  const closeAll = except => $$('.nav__item.is-open').forEach(n => { if (n !== except) { n.classList.remove('is-open'); $('button', n).setAttribute('aria-expanded', 'false'); } });
  $$('.nav__item[data-dropdown]').forEach(item => {
    const btn = $('button', item);
    const set = open => { closeAll(item); item.classList.toggle('is-open', open); btn.setAttribute('aria-expanded', open); };
    btn.addEventListener('click', () => set(!item.classList.contains('is-open')));
    if (matchMedia('(hover:hover) and (pointer:fine)').matches) { item.addEventListener('mouseenter', () => set(true)); item.addEventListener('mouseleave', () => set(false)); }
    item.addEventListener('keydown', e => {
      const links = $$('.dropdown a', item), idx = links.indexOf(d.activeElement);
      if (e.key === 'Escape') { set(false); btn.focus(); }
      if (e.key === 'ArrowDown') { e.preventDefault(); set(true); (links[idx + 1] || links[0]).focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); (links[idx - 1] || links[links.length - 1]).focus(); }
    });
  });
  d.addEventListener('click', e => { if (!e.target.closest('.nav__item')) closeAll(); });

  /* Drawers with focus trap + Esc + return focus (§10) */
  const overlay = $('.overlay'); let openDrawer = null, opener = null;
  const focusables = el => $$('a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])', el).filter(x => x.offsetParent !== null);
  const open = (id, from) => { const dr = d.getElementById(id); if (!dr) return; openDrawer = dr; opener = from || d.activeElement; dr.classList.add('is-open'); dr.setAttribute('aria-hidden', 'false'); overlay.classList.add('is-open'); d.body.style.overflow = 'hidden'; setTimeout(() => (focusables(dr)[0] || dr).focus(), 60); };
  const close = () => { if (!openDrawer) return; openDrawer.classList.remove('is-open'); openDrawer.setAttribute('aria-hidden', 'true'); overlay.classList.remove('is-open'); d.body.style.overflow = ''; openDrawer = null; opener && opener.focus && opener.focus(); };
  $$('[data-open]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); open(b.dataset.open, b); }));
  $$('[data-close]').forEach(b => b.addEventListener('click', close));
  overlay && overlay.addEventListener('click', close);
  d.addEventListener('keydown', e => {
    if (!openDrawer) return;
    if (e.key === 'Escape') close();
    if (e.key === 'Tab') { const f = focusables(openDrawer); if (!f.length) return; const a = f[0], z = f[f.length - 1]; if (e.shiftKey && d.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && d.activeElement === z) { e.preventDefault(); a.focus(); } }
  });

  /* Mock cart (§16.5) */
  const KEY = 'yahara-preview-cart', FREE = 85;
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
  const save = c => { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch {} };
  const money = n => '$' + n.toFixed(2);
  const render = () => {
    const cart = load(), list = $('#cart-lines'), count = cart.reduce((a, l) => a + l.qty, 0), sub = cart.reduce((a, l) => a + l.qty * l.price, 0);
    $$('.cart-count').forEach(c => { c.textContent = count; c.hidden = !count; });
    if (!list) return;
    list.innerHTML = cart.length ? cart.map((l, i) => `<div class="cart-line"><img src="${l.img}" alt="" width="72" height="72"><div><p class="cart-line__title">${l.title}</p><p class="cart-line__meta">${l.plan ? l.plan + ' · ' : ''}Qty ${l.qty} · <button type="button" data-remove="${i}">Remove</button></p></div><span class="cart-line__price">${money(l.qty * l.price)}</span></div>`).join('') : '<p class="cart-empty">Your cart is empty.</p>';
    $('#cart-subtotal').textContent = money(sub);
    const left = Math.max(FREE - sub, 0);
    $('#ship-msg').textContent = left ? `You're ${money(left)} away from free shipping.` : 'Your order ships free.';
    $('.ship-bar__fill').style.width = Math.min(sub / FREE * 100, 100) + '%';
    $$('[data-remove]', list).forEach(b => b.addEventListener('click', () => { const c = load(); c.splice(+b.dataset.remove, 1); save(c); render(); }));
  };
  const add = (b, qty = 1) => {
    const c = load(), key = b.dataset.title + (b.dataset.plan || '') + (b.dataset.variant || '');
    const f = c.find(l => l.key === key);
    if (f) f.qty += qty; else c.push({ key, title: b.dataset.title + (b.dataset.variant ? ' – ' + b.dataset.variant : ''), price: +b.dataset.price, img: b.dataset.img, plan: b.dataset.plan || '', qty });
    save(c); render(); open('cart-drawer', b);
  };
  d.addEventListener('click', e => {
    const b = e.target.closest('[data-add]'); if (!b) return; e.preventDefault();
    if (b.dataset.add === 'options') { location.href = b.dataset.href || 'product.html'; return; }
    let qty = 1; const q = b.closest('form') && $('.qty input', b.closest('form')); if (q) qty = Math.max(1, parseInt(q.value, 10) || 1);
    const form = b.closest('form'); if (form && form.dataset.variantForm !== undefined) { const v = $$('input[type=radio]:checked', form).filter(r => r.name.startsWith('opt')).map(r => r.value).join(' / '); b.dataset.variant = v; }
    add(b, qty);
  });
  $$('[data-checkout]').forEach(b => b.addEventListener('click', () => { const s = $('#checkout-note'); s.textContent = 'Demo only – checkout is disabled in this preview.'; }));
  render();

  /* Carousels: progress bar bound to scroll; arrows move one card (§6.5-G) */
  $$('.carousel').forEach(c => {
    const t = $('.carousel__track', c), bar = $('.carousel__bar', c), prev = $('[data-prev]', c), next = $('[data-next]', c), status = $('.carousel__status', c);
    const upd = () => { const max = t.scrollWidth - t.clientWidth, vis = t.clientWidth / t.scrollWidth; bar.style.width = (vis * 100) + '%'; bar.style.transform = `translateX(${max > 0 ? (t.scrollLeft / max) * ((1 / vis) - 1) * 100 : 0}%)`; if (prev) prev.disabled = t.scrollLeft < 4; if (next) next.disabled = t.scrollLeft > max - 4; if (status) { const w = t.firstElementChild.getBoundingClientRect().width; status.textContent = `Showing item ${Math.round(t.scrollLeft / w) + 1} of ${t.children.length}`; } };
    const by = dir => { const w = t.firstElementChild.getBoundingClientRect().width + parseFloat(getComputedStyle(t).columnGap || 12); t.scrollBy({ left: dir * w, behavior: reduce ? 'auto' : 'smooth' }); };
    prev && prev.addEventListener('click', () => by(-1)); next && next.addEventListener('click', () => by(1));
    t.addEventListener('scroll', upd, { passive: true }); addEventListener('resize', upd); upd();
  });

  /* Forms: newsletter + contact show a fake success state; nothing is sent */
  $$('form[data-demo-form]').forEach(f => f.addEventListener('submit', e => { e.preventDefault(); const s = $('[role=status]', f.parentElement) || $('[role=status]', f); if (s) s.textContent = f.dataset.demoForm; f.reset(); }));
  $$('form[data-noop]').forEach(f => f.addEventListener('submit', e => e.preventDefault()));

  /* Tabs (§9.7): ARIA tablist with arrow keys */
  $$('[role=tablist]').forEach(list => {
    const tabs = $$('[role=tab]', list);
    const sel = t => { tabs.forEach(x => { const on = x === t; x.setAttribute('aria-selected', on); x.tabIndex = on ? 0 : -1; d.getElementById(x.getAttribute('aria-controls')).hidden = !on; }); };
    tabs.forEach((t, i) => { t.addEventListener('click', () => sel(t)); t.addEventListener('keydown', e => { let n = null; if (e.key === 'ArrowRight') n = tabs[(i + 1) % tabs.length]; if (e.key === 'ArrowLeft') n = tabs[(i - 1 + tabs.length) % tabs.length]; if (e.key === 'Home') n = tabs[0]; if (e.key === 'End') n = tabs[tabs.length - 1]; if (n) { e.preventDefault(); sel(n); n.focus(); } }); });
  });

  /* Café hours table: highlight today in America/Chicago */
  const today = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'America/Chicago' }).format(new Date());
  $$('[data-day]').forEach(r => r.classList.toggle('is-today', r.dataset.day === today));

  /* Product gallery + qty + sticky ATC */
  $$('.gallery').forEach(g => { const main = $('.gallery__main img', g); $$('.gallery__thumbs button', g).forEach(b => b.addEventListener('click', () => { main.src = b.dataset.src; main.srcset = b.dataset.srcset || ''; main.alt = b.dataset.alt; $$('.gallery__thumbs button', g).forEach(x => x.setAttribute('aria-current', x === b)); })); });
  $$('.qty').forEach(q => { const i = $('input', q); $('[data-dec]', q).addEventListener('click', () => i.value = Math.max(1, (+i.value || 1) - 1)); $('[data-inc]', q).addEventListener('click', () => i.value = (+i.value || 1) + 1); });
  const atc = $('.sticky-atc'), buy = $('#main-buy');
  if (atc && buy && 'IntersectionObserver' in window) new IntersectionObserver(([e]) => atc.classList.toggle('is-visible', !e.isIntersecting && e.boundingClientRect.top < 0)).observe(buy);

  /* Collection grid/list toggle */
  $$('[data-view]').forEach(b => b.addEventListener('click', () => { $('.grid-products').classList.toggle('is-list', b.dataset.view === 'list'); $$('[data-view]').forEach(x => x.setAttribute('aria-pressed', x === b)); }));

  /* Click-to-load map (§9.8) */
  $$('[data-map]').forEach(b => b.addEventListener('click', () => { const box = b.closest('.map-box'); box.innerHTML = `<iframe title="Map: 261 W Main Street, Stoughton, WI 53589" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://maps.google.com/maps?q=${encodeURIComponent('261 W Main Street, Stoughton, WI 53589')}&output=embed"></iframe>`; }));

  /* Global "pause animations" toggle (§10) + review-note toggle */
  const MK = 'yahara-preview-motion-paused', NK = 'yahara-preview-hide-notes';
  const setMotion = p => { d.body.classList.toggle('motion-paused', p); $$('[data-motion-toggle]').forEach(b => { b.setAttribute('aria-pressed', p); b.textContent = p ? 'Play animations' : 'Pause animations'; }); $$('video[data-autoplay]').forEach(v => p ? v.pause() : v.play().catch(() => {})); };
  const setNotes = h => { d.body.classList.toggle('hide-notes', h); $$('[data-notes-toggle]').forEach(b => { b.setAttribute('aria-pressed', h); b.textContent = h ? 'Show review notes' : 'Hide review notes'; }); };
  $$('[data-motion-toggle]').forEach(b => b.addEventListener('click', () => { const p = !d.body.classList.contains('motion-paused'); localStorage.setItem(MK, p ? '1' : ''); setMotion(p); }));
  $$('[data-notes-toggle]').forEach(b => b.addEventListener('click', () => { const h = !d.body.classList.contains('hide-notes'); localStorage.setItem(NK, h ? '1' : ''); setNotes(h); }));
  setMotion(!!localStorage.getItem(MK) || reduce); setNotes(!!localStorage.getItem(NK) || new URLSearchParams(location.search).has('clean'));
  $$('[data-placeholder]').forEach(p => console.warn('[PLACEHOLDER]', p.textContent.trim()));

})();
