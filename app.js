/* ==========================================================================
   Carpintería y Diseño Interior's | app.js
   Estructura:
     1. Utilidades y detección
     2. Preloader (progreso real + puertas que se abren)
     3. Scroll suave (Lenis)
     4. Navegación y menú móvil
     5. Revelado de textos y bloques
     6. Hero: partículas y paralaje
     7. Efectos de scroll (GSAP + ScrollTrigger)
     8. Microinteracciones (magnético, botones, spotlight)
     9. Visor de imágenes
    10. Formulario que envía a WhatsApp
    11. Arranque
   Si GSAP o Lenis no cargan, la página sigue siendo completa y usable.
   ========================================================================== */
(() => {
  'use strict';

  // Avisa al seguro del <head> que el script sí corrió
  window.__cdReady = true;

  /* ───────── 1. Utilidades y detección ───────── */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const root = document.documentElement;
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FINE_POINTER = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const HAS_GSAP = !!(window.gsap && window.ScrollTrigger);
  const HAS_LENIS = !!window.Lenis;
  // Debe coincidir con el media query del CSS (galería fijada y tarjetas apiladas)
  const DESKTOP_MOTION = '(min-width: 1000px) and (prefers-reduced-motion: no-preference)';

  // La clase has-gsap activa los layouts que dependen de GSAP. En movimiento reducido no se activa.
  const MOTION_ON = HAS_GSAP && !REDUCED;
  if (MOTION_ON) {
    gsap.registerPlugin(ScrollTrigger);
    root.classList.add('has-gsap');
  }

  let lenis = null;
  const lockScroll = (lock) => {
    if (lenis) { lock ? lenis.stop() : lenis.start(); }
    else { document.body.style.overflow = lock ? 'hidden' : ''; }
  };

  /* ───────── 2. Preloader ───────── */
  // El porcentaje mezcla un avance mínimo "simulado" con hitos reales (fuentes, imagen del hero, window.load).
  function runLoader() {
    return new Promise((resolve) => {
      const loader = $('#loader');
      if (!loader) { root.classList.add('is-ready'); root.classList.remove('is-loading'); return resolve(); }

      const ring = $('.ring-prog', loader);
      const pctEl = $('[data-loader-pct]', loader);
      const CIRC = 339.3;
      const MIN_MS = REDUCED ? 600 : 2700;
      const t0 = performance.now();
      let target = 0;
      let allDone = false;
      let shown = 0;

      const bump = (v) => { target = Math.max(target, v); };

      const fontsReady = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
      const heroImg = $('.hero__img');
      const heroReady = (heroImg && !heroImg.complete)
        ? new Promise((r) => { heroImg.addEventListener('load', r, { once: true }); heroImg.addEventListener('error', r, { once: true }); })
        : Promise.resolve();
      const pageLoaded = document.readyState === 'complete'
        ? Promise.resolve()
        : new Promise((r) => window.addEventListener('load', r, { once: true }));

      fontsReady.then(() => bump(40));
      heroReady.then(() => bump(78));
      pageLoaded.then(() => bump(100));
      Promise.all([fontsReady, heroReady, pageLoaded]).then(() => { allDone = true; });
      setTimeout(() => { allDone = true; bump(100); }, 7000); // seguro: nunca atorar al usuario

      const render = () => {
        const v = Math.min(100, Math.round(shown));
        if (pctEl) pctEl.textContent = v;
        if (ring) ring.style.strokeDashoffset = (CIRC * (1 - shown / 100)).toFixed(1);
      };

      const finish = () => {
        shown = 100; render();
        loader.classList.add('is-done');               // las puertas se abren
        setTimeout(() => root.classList.add('is-ready'), 650); // arranca la entrada del hero
        setTimeout(() => {
          loader.remove();
          root.classList.remove('is-loading');
          resolve();
        }, 1700);
      };

      const tick = (now) => {
        const elapsed = now - t0;
        const simulated = Math.min(elapsed / MIN_MS, 1) * 100;
        const cap = allDone ? 100 : Math.min(target, 96);
        const goal = Math.min(simulated, cap);
        shown += (goal - shown) * 0.09;
        render();
        if (allDone && elapsed >= MIN_MS && shown > 99.3) finish();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  /* ───────── 3. Scroll suave ───────── */
  function initSmoothScroll() {
    if (!HAS_LENIS || REDUCED) return;
    lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.95, smoothWheel: true });
    if (HAS_GSAP) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((t) => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
    lenis.stop(); // detenido hasta que termine el preloader
  }

  /* ───────── 4. Navegación y menú móvil ───────── */
  function initNav() {
    const nav = $('#nav');
    const burger = $('#burger');
    const menu = $('#menu');
    if (!nav) return;

    // El tema de la barra (oscuro/claro) sigue a la sección que está bajo ella
    const themed = $$('[data-theme]').filter((el) => el !== nav);
    const themeIO = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) nav.dataset.theme = e.target.dataset.theme; });
    }, { rootMargin: '0px 0px -94% 0px' });
    themed.forEach((s) => themeIO.observe(s));

    // Enlace activo según la sección visible
    const links = $$('.nav__link');
    const linkIO = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        links.forEach((a) => a.classList.toggle('is-current', a.getAttribute('href') === '#' + e.target.id));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    ['servicios', 'proyectos', 'proceso', 'nosotros', 'faq'].forEach((id) => { const s = document.getElementById(id); if (s) linkIO.observe(s); });

    // Menú móvil
    $$('.menu__link').forEach((a, i) => a.style.setProperty('--k', i));
    const setMenu = (open) => {
      if (!menu || !burger) return;
      menu.classList.toggle('is-open', open);
      menu.setAttribute('aria-hidden', String(!open));
      menu.inert = !open;
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
      lockScroll(open);
    };
    if (burger) burger.addEventListener('click', () => setMenu(!menu.classList.contains('is-open')));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu && menu.classList.contains('is-open')) setMenu(false); });
    window.addEventListener('resize', () => { if (window.innerWidth >= 1100 && menu && menu.classList.contains('is-open')) setMenu(false); });

    // Anclas con scroll suave (también cierra el menú)
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const id = a.getAttribute('href');
      if (id.length < 2) return;
      const target = document.getElementById(id.slice(1));
      if (!target) return;
      e.preventDefault();
      const wasOpen = menu && menu.classList.contains('is-open');
      if (wasOpen) setMenu(false);
      const go = () => {
        if (lenis) lenis.scrollTo(target, { duration: 1.7, easing: (t) => 1 - Math.pow(1 - t, 4) });
        else target.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' });
        history.replaceState(null, '', id);
      };
      wasOpen ? setTimeout(go, 350) : go();
    });
  }

  /* ───────── 5. Revelado de textos y bloques ───────── */
  // Divide el texto en palabras (respeta elementos hijos como <em>) para animarlas con máscara
  function splitWords(el) {
    let index = 0;
    const walk = (node) => {
      Array.from(node.childNodes).forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span');
            w.className = 'w';
            const wi = document.createElement('span');
            wi.className = 'wi';
            wi.style.setProperty('--wi', index++);
            wi.textContent = part;
            w.appendChild(wi);
            frag.appendChild(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) {
          walk(n);
        }
      });
    };
    walk(el);
  }

  function initReveals() {
    $$('[data-split], [data-fill]').forEach(splitWords);
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
    $$('[data-reveal], [data-split]').forEach((el) => io.observe(el));
  }

  /* ───────── 6. Hero: partículas y paralaje ───────── */
  // Motas de polvo de taller que suben lento; reaccionan al cursor. Se pausan fuera de pantalla.
  function particleField(canvas, opts = {}) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const cfg = Object.assign({ count: 70, rise: 0.22, size: 2.1, limeBias: 0.45 }, opts);
    const WHITE = 'rgba(255,255,255,';
    const LIME = 'rgba(162,218,47,';
    let w = 0, h = 0, parts = [], raf = 0, mx = -999, my = -999;

    const rand = (a, b) => a + Math.random() * (b - a);
    const make = (initial) => ({
      x: rand(0, w), y: initial ? rand(0, h) : h + 10, r: rand(0.5, cfg.size),
      vx: rand(-0.05, 0.05), vy: -rand(0.06, cfg.rise), ph: rand(0, 6.28), tw: rand(0.6, 1.8),
      a: rand(0.25, 0.85), lime: Math.random() < cfg.limeBias,
    });

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = r.width; h = r.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(Math.min(cfg.count * 1.2, Math.max(22, cfg.count * (w * h) / (1440 * 900))));
      parts = Array.from({ length: n }, () => make(true));
    };

    const draw = (t, animate) => {
      ctx.clearRect(0, 0, w, h);
      for (const p of parts) {
        if (animate) {
          p.x += p.vx + Math.sin(t / 2200 + p.ph) * 0.14;
          p.y += p.vy;
          const dx = p.x - mx, dy = p.y - my, d2 = dx * dx + dy * dy;
          if (d2 < 14400) { const d = Math.sqrt(d2) || 1, f = ((120 - d) / 120) * 1.6; p.x += (dx / d) * f; p.y += (dy / d) * f; }
          if (p.y < -10) Object.assign(p, make(false));
          if (p.x < -10) p.x = w + 10;
          if (p.x > w + 10) p.x = -10;
        }
        const alpha = p.a * (0.55 + 0.45 * Math.sin((t / 650) * p.tw + p.ph));
        ctx.fillStyle = (p.lime ? LIME : WHITE) + alpha.toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, 6.283);
        ctx.fill();
      }
    };

    const loop = (t) => { draw(t, true); raf = requestAnimationFrame(loop); };
    const start = () => { if (!raf && !REDUCED) raf = requestAnimationFrame(loop); };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };

    resize();
    draw(0, false); // cuadro estático (también para movimiento reducido)
    new ResizeObserver(() => { resize(); draw(0, false); }).observe(canvas);
    new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop())).observe(canvas);

    const host = canvas.parentElement;
    host.addEventListener('pointermove', (e) => {
      const r = canvas.getBoundingClientRect();
      mx = e.clientX - r.left; my = e.clientY - r.top;
    }, { passive: true });
    host.addEventListener('pointerleave', () => { mx = my = -999; });
  }

  function initHero() {
    const hero = $('#inicio');
    if (!hero) return;
    particleField($('#hero-canvas'), { count: 70 });
    particleField($('#cta-canvas'), { count: 46, rise: 0.3, limeBias: 0.7 });

    // Paralaje con el cursor (solo punteros finos). Actualiza variables CSS dentro de rAF.
    if (FINE_POINTER && !REDUCED) {
      let raf = 0, nx = 0, ny = 0;
      hero.addEventListener('pointermove', (e) => {
        const r = hero.getBoundingClientRect();
        nx = ((e.clientX - r.left) / r.width - 0.5) * 2;
        ny = ((e.clientY - r.top) / r.height - 0.5) * 2;
        if (!raf) raf = requestAnimationFrame(() => {
          hero.style.setProperty('--px', nx.toFixed(3));
          hero.style.setProperty('--py', ny.toFixed(3));
          raf = 0;
        });
      }, { passive: true });
    }
  }

  /* ───────── 7. Efectos de scroll (GSAP + ScrollTrigger) ───────── */
  function initScrollFX() {
    if (!MOTION_ON) {
      // Sin GSAP o con movimiento reducido: la línea de tiempo se muestra completa
      $$('.tl__step').forEach((s) => s.classList.add('is-active'));
      return;
    }
    const mm = gsap.matchMedia();

    // Barra de progreso de lectura
    gsap.to('.progress span', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.2 } });

    // Hero: al bajar, la foto se desplaza más lento y el texto se aleja
    gsap.to('.hero__scroll', { yPercent: 14, ease: 'none', scrollTrigger: { trigger: '#inicio', start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to('.hero__inner', { yPercent: -8, opacity: 0.1, ease: 'none', scrollTrigger: { trigger: '#inicio', start: '35% top', end: 'bottom top', scrub: true } });

    // Manifiesto: las palabras se iluminan conforme avanzas
    const words = $$('.statement__text .wi');
    if (words.length) {
      gsap.fromTo(words, { opacity: 0.14 }, {
        opacity: 1, ease: 'none', stagger: 0.1,
        scrollTrigger: { trigger: '.statement__text', start: 'top 82%', end: 'bottom 50%', scrub: true },
      });
    }

    // Paralaje de las fotos del manifiesto (se mueve la imagen dentro de su marco)
    $$('[data-parallax]').forEach((fig) => {
      const amp = (parseFloat(fig.dataset.parallax) || 0.1) * 40;
      const img = $('img', fig);
      if (!img) return;
      gsap.fromTo(img, { yPercent: -amp, scale: 1.2 }, {
        yPercent: amp, scale: 1.2, ease: 'none',
        scrollTrigger: { trigger: fig, start: 'top bottom', end: 'bottom top', scrub: true },
      });
    });

    // Imagen que se abre a pantalla completa mientras la sección queda fija
    // El recorte se anima con un objeto numérico propio: interpolar el string de clip-path falla
    // porque el navegador lo normaliza (inset(21% 30% round 22px)) y GSAP empareja mal los valores.
    const setupExpand = (insetY, insetX) => {
      const exp = $('.expand');
      if (!exp) return;
      const frame = $('.expand__frame', exp);
      const img = $('img', frame);
      const clip = { y: insetY, x: insetX, r: 22 };
      const renderClip = () => { frame.style.clipPath = 'inset(' + clip.y + '% ' + clip.x + '% ' + clip.y + '% ' + clip.x + '% round ' + clip.r + 'px)'; };
      renderClip();
      gsap.set(img, { scale: 1.3 });
      gsap.set($('.expand__caption', exp), { opacity: 0, y: 40 });
      gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { trigger: exp, start: 'top top', end: '+=160%', pin: true, scrub: 0.8, anticipatePin: 1 },
      })
        .to($('.expand__title', exp), { opacity: 0, yPercent: -40, duration: 0.3 }, 0)
        .to(clip, { y: 0, x: 0, r: 0, duration: 1, onUpdate: renderClip }, 0)
        .to(img, { scale: 1, duration: 1 }, 0)
        .to($('.expand__shade', exp), { opacity: 1, duration: 0.4 }, 0.6)
        .to($('.expand__caption', exp), { opacity: 1, y: 0, duration: 0.35 }, 0.65);
    };
    mm.add('(max-width: 699px)', () => setupExpand(27, 9));
    mm.add('(min-width: 700px)', () => setupExpand(21, 30));

    // Servicios: cada tarjeta se hunde y se oscurece cuando la siguiente la cubre
    mm.add(DESKTOP_MOTION, () => {
      const cards = $$('.svc');
      cards.forEach((card, i) => {
        const next = cards[i + 1];
        if (!next) return;
        gsap.to($('.svc__inner', card), {
          scale: 0.93, '--dim': 0.55, ease: 'none',
          scrollTrigger: {
            trigger: next, start: 'top 88%',
            end: () => 'top ' + parseFloat(getComputedStyle(next).top),
            scrub: true,
          },
        });
      });
    });

    // Galería: el scroll vertical se convierte en recorrido horizontal
    mm.add(DESKTOP_MOTION, () => {
      const sec = $('.hgal');
      const rail = $('.hgal__rail');
      const bar = $('.hgal__bar span');
      if (!sec || !rail) return;
      const distance = () => Math.max(0, rail.scrollWidth - window.innerWidth);
      const pan = gsap.to(rail, {
        x: () => -distance(), ease: 'none',
        scrollTrigger: {
          trigger: sec, start: 'top top', end: () => '+=' + distance(), pin: true, scrub: 1, anticipatePin: 1, invalidateOnRefresh: true,
          onUpdate: (self) => { if (bar) bar.style.transform = 'scaleX(' + self.progress.toFixed(4) + ')'; },
        },
      });
      // Cada foto se desliza un poco dentro de su marco (profundidad)
      $$('.pcard__img img', sec).forEach((img) => {
        if (img.classList.contains('pcard__img--wide')) return;
        gsap.fromTo(img, { xPercent: -6 }, {
          xPercent: 6, ease: 'none',
          scrollTrigger: { trigger: img.closest('.pcard'), containerAnimation: pan, start: 'left right', end: 'right left', scrub: true },
        });
      });
    });

    // Proceso: la línea se dibuja y cada paso se enciende al llegar
    gsap.to('.tl__fill', { scaleY: 1, ease: 'none', scrollTrigger: { trigger: '.tl', start: 'top 62%', end: 'bottom 62%', scrub: true } });
    $$('.tl__step').forEach((step) => {
      ScrollTrigger.create({
        trigger: step, start: 'top 66%',
        onEnter: () => step.classList.add('is-active'),
        onLeaveBack: () => step.classList.remove('is-active'),
      });
    });

    // CTA final: el texto fantasma se desplaza lateralmente con el scroll
    gsap.fromTo('.cta__ghost', { xPercent: 0 }, {
      xPercent: -38, ease: 'none',
      scrollTrigger: { trigger: '.cta', start: 'top bottom', end: 'bottom top', scrub: true },
    });
  }

  /* ───────── 8. Microinteracciones ───────── */
  function initMicro() {
    // Relleno de botones desde el punto exacto de entrada y salida del cursor
    if (FINE_POINTER) {
      const setPoint = (el, e) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--x', (e.clientX - r.left) + 'px');
        el.style.setProperty('--y', (e.clientY - r.top) + 'px');
      };
      $$('.btn').forEach((b) => {
        b.addEventListener('pointerenter', (e) => setPoint(b, e));
        b.addEventListener('pointerleave', (e) => setPoint(b, e));
      });
    }

    // Elementos magnéticos
    if (FINE_POINTER && !REDUCED) {
      $$('[data-magnetic]').forEach((el) => {
        const strength = el.classList.contains('orb') ? 0.22 : 0.18;
        el.addEventListener('pointermove', (e) => {
          const r = el.getBoundingClientRect();
          el.style.setProperty('--mx', ((e.clientX - (r.left + r.width / 2)) * strength).toFixed(1) + 'px');
          el.style.setProperty('--my', ((e.clientY - (r.top + r.height / 2)) * strength).toFixed(1) + 'px');
        });
        el.addEventListener('pointerleave', () => {
          el.style.setProperty('--mx', '0px');
          el.style.setProperty('--my', '0px');
        });
      });
    }

    // Luz que sigue al cursor sobre las celdas del bento
    if (FINE_POINTER) {
      $$('[data-spot]').forEach((cell) => {
        cell.addEventListener('pointermove', (e) => {
          const r = cell.getBoundingClientRect();
          cell.style.setProperty('--sx', (e.clientX - r.left) + 'px');
          cell.style.setProperty('--sy', (e.clientY - r.top) + 'px');
        });
      });
    }
  }

  /* ───────── 9. Visor de imágenes ───────── */
  function initLightbox() {
    const dlg = $('#lightbox');
    if (!dlg || typeof dlg.showModal !== 'function') return;
    const items = $$('[data-lightbox]');
    const img = $('.lb__img', dlg);
    const cap = $('.lb__cap', dlg);
    let idx = 0;
    let opener = null;

    const show = (i) => {
      idx = (i + items.length) % items.length;
      const btn = items[idx];
      const thumb = $('img', btn);
      img.src = btn.dataset.src;
      img.alt = thumb ? thumb.alt : '';
      cap.textContent = btn.dataset.caption || '';
    };

    items.forEach((btn, i) => btn.addEventListener('click', () => {
      opener = btn;
      show(i);
      dlg.showModal();
      lockScroll(true);
    }));
    dlg.addEventListener('close', () => { lockScroll(false); if (opener) opener.focus({ preventScroll: true }); });
    $('[data-lb-close]', dlg).addEventListener('click', () => dlg.close());
    $('[data-lb-prev]', dlg).addEventListener('click', () => show(idx - 1));
    $('[data-lb-next]', dlg).addEventListener('click', () => show(idx + 1));
    dlg.addEventListener('click', (e) => { if (e.target === dlg || e.target.classList.contains('lb__inner')) dlg.close(); });
    dlg.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') show(idx - 1);
      if (e.key === 'ArrowRight') show(idx + 1);
    });
  }

  /* ───────── 10. Formulario → WhatsApp ───────── */
  function initForm() {
    const form = $('#quote-form');
    if (!form) return;
    const WA_NUMBER = '522221722337'; // WhatsApp principal (lada país + 10 dígitos)
    const status = $('#form-status');
    const btn = $('#form-submit');
    const label = $('.btn__label', btn);
    const defaultLabel = label.textContent;
    const f = { name: $('#f-name'), phone: $('#f-phone'), service: $('#f-service'), msg: $('#f-msg') };

    const setError = (input, message) => {
      const field = input.closest('.field');
      const err = $('.field__error', field);
      field.classList.toggle('has-error', Boolean(message));
      input.setAttribute('aria-invalid', message ? 'true' : 'false');
      if (err) err.textContent = message || '';
    };

    const validate = () => {
      let first = null;
      const fail = (input, message) => { setError(input, message); if (!first) first = input; };

      if (f.name.value.trim().length < 2) fail(f.name, 'Escribe tu nombre para saber cómo dirigirnos a ti.');
      else setError(f.name, '');

      const digits = f.phone.value.replace(/\D/g, '');
      if (f.phone.value.trim() && digits.length < 10) fail(f.phone, 'Revisa tu número: debe tener 10 dígitos.');
      else setError(f.phone, '');

      if (!f.service.value) fail(f.service, 'Elige el tipo de proyecto que te interesa.');
      else setError(f.service, '');

      return first;
    };

    // Al corregir un campo con error, se revalida en vivo
    Object.values(f).forEach((input) => input.addEventListener('input', () => {
      if (input.closest('.field').classList.contains('has-error')) validate();
    }));
    f.service.addEventListener('change', () => { if (f.service.closest('.field').classList.contains('has-error')) validate(); });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      status.classList.remove('is-visible');
      const firstInvalid = validate();
      if (firstInvalid) { firstInvalid.focus(); return; }

      const lines = [
        'Hola, soy ' + f.name.value.trim() + '.',
        'Quiero cotizar: ' + f.service.value + '.',
      ];
      if (f.msg.value.trim()) lines.push('Detalles: ' + f.msg.value.trim());
      if (f.phone.value.trim()) lines.push('Mi teléfono: ' + f.phone.value.trim());
      lines.push('(Enviado desde el sitio web)');
      const url = 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(lines.join('\n'));

      btn.classList.add('is-loading');
      label.textContent = 'Abriendo WhatsApp...';
      window.open(url, '_blank', 'noopener'); // dentro del gesto del usuario para evitar bloqueos

      status.innerHTML = '<i class="ph-fill ph-check-circle" aria-hidden="true"></i><span>Listo. Si WhatsApp no se abrió, <a href="' + url + '" target="_blank" rel="noopener">haz clic aquí</a>.</span>';
      status.classList.add('is-visible');
      setTimeout(() => { btn.classList.remove('is-loading'); label.textContent = defaultLabel; }, 3500);
    });
  }

  /* ───────── 11. Arranque ───────── */
  function initWhatsAppTip() {
    const wa = $('#wa-float');
    if (!wa) return;
    setTimeout(() => wa.classList.add('show-tip'), 4200);
    setTimeout(() => wa.classList.remove('show-tip'), 11000);
  }

  initSmoothScroll();
  initReveals();
  initNav();
  initHero();
  initMicro();
  initLightbox();
  initForm();
  initScrollFX();

  runLoader().then(() => {
    if (lenis) lenis.start();
    if (HAS_GSAP) ScrollTrigger.refresh();
    initWhatsAppTip();
  });

  // Recalcular posiciones cuando las fuentes o la página terminen de cargar
  if (HAS_GSAP) {
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
    window.addEventListener('load', () => ScrollTrigger.refresh());
  }
})();
