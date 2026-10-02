/* carebravo.com — main.js
   Trimmed from caryfy.ai's main.js: keeps the component loader, current-nav
   marking, mobile menu and the hero/page-head nav colour switch. Drops the
   i18n init and investor-form/hero-sound wiring caryfy.ai's main.js has —
   CareBravo is single-language and these two pages carry no matching form.
   Components are fetched over HTTP, so preview with a local server
   (e.g. `npx serve .`), not file://. */
(function () {
  // ---- Analytics: Microsoft Clarity + GA4, initialised here and nowhere else ----
  // Every page loads this file, so tracking lives in one place. The guard keeps it to one
  // init per page even if this script were ever included twice. Not part of header/footer.
  var CLARITY_ID = 'w9dlt1yome';
  var GA4_ID = 'G-QGE5NWE2V0';

  function initAnalytics() {
    if (window.__cbAnalyticsInit) return;
    window.__cbAnalyticsInit = true;

    if (!document.querySelector('script[src*="clarity.ms/tag/"]')) {
      (function (c, l, a, r, i, t, y) {
        c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
        t = l.createElement(r); t.async = 1; t.src = 'https://www.clarity.ms/tag/' + i;
        y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
      })(window, document, 'clarity', 'script', CLARITY_ID);
    }

    if (!document.querySelector('script[src*="googletagmanager.com/gtag/js"]')) {
      var gaScript = document.createElement('script');
      gaScript.async = true;
      gaScript.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA4_ID;
      document.head.appendChild(gaScript);
    }
    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', GA4_ID);
  }
  initAnalytics();

  // Bare-bones header used ONLY if /components/header.html can't be fetched at all
  // (blocked request, offline, flaky mobile network). Keeps the nav on-screen and
  // usable — no wordmark/announcement styling — instead of the page having no header.
  var HEADER_FALLBACK = '<nav class="nav scrolled" id="nav" aria-label="Primary"><div class="wrap nav-in">' +
    '<a class="wordmark" href="/" aria-label="CareBravo home">CareBravo<span>®</span></a>' +
    '<div class="links" id="links"><a href="/how-it-works">How it works</a><a href="/agents">Cary® and the nine agents</a>' +
    '<a href="/medicaid">Medicaid</a><a href="/pricing">Pricing</a></div>' +
    '<div class="nav-right"><a class="pill cta" href="/calculate">See What\'s Draining Your Agency →</a>' +
    '<button class="menu-btn" type="button" aria-controls="links" aria-expanded="false" aria-label="Menu"><span></span><span></span></button></div>' +
    '</div></nav>';

  async function fetchInclude(url, attempt) {
    // force-cache can pin a bad/opaque response on flaky mobile connections;
    // retry once, bypassing the cache, before giving up.
    const res = await fetch(url, { cache: attempt === 0 ? 'force-cache' : 'no-store' });
    if (!res.ok) throw new Error(res.status + ' ' + url);
    return res.text();
  }

  async function loadIncludes(root) {
    const slots = [...root.querySelectorAll('[data-include]')];
    if (!slots.length) return;
    await Promise.all(slots.map(async slot => {
      const url = slot.getAttribute('data-include');
      let html;
      try {
        html = await fetchInclude(url, 0);
      } catch (e) {
        try {
          html = await fetchInclude(url, 1); // one retry, no-store
        } catch (e2) {
          console.error('Component failed to load:', url, e2);
          if (url.indexOf('header.html') !== -1) {
            html = HEADER_FALLBACK; // guarantee the nav renders even with no network access to the include
          } else {
            slot.classList.add('include-failed'); // e.g. footer — leave slot in place, nothing to fall back to
            return;
          }
        }
      }
      const tpl = document.createElement('template');
      tpl.innerHTML = html.trim();
      await loadIncludes(tpl.content);           // nested includes (footer → knowledge graph)
      slot.replaceWith(tpl.content);
    }));
  }

  function normalise(path) {
    path = path.replace(/\/index(\.html)?$/, '/').replace(/\.html$/, '').replace(/\/+$/, '');
    return path === '' ? '/' : path;
  }

  function markCurrent() {
    const here = normalise(location.pathname);
    document.querySelectorAll('#links a').forEach(a => {
      const there = normalise(new URL(a.getAttribute('href'), location.origin).pathname);
      if (there === here) a.setAttribute('aria-current', 'page');
    });
  }

  function mobileMenu() {
    const nav = document.getElementById('nav');
    const btn = nav && nav.querySelector('.menu-btn');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    nav.querySelectorAll('#links a').forEach(a => a.addEventListener('click', () => {
      nav.classList.remove('open'); btn.setAttribute('aria-expanded', 'false');
    }));
  }

  // function navColour() {
  //   const nav = document.getElementById('nav');
  //   const head = document.querySelector('.hero, .page-head');
  //   if (!nav) return;
  //   if (!head) { nav.classList.remove('on-dusk'); nav.classList.add('scrolled'); return; } // pages without a hero (404) read on paper
  //   if (!('IntersectionObserver' in window)) return;
  //   const io = new IntersectionObserver(([e]) => {
  //     const on = e.isIntersecting && e.intersectionRatio > 0.08;
  //     nav.classList.toggle('on-dusk', on);
  //     nav.classList.toggle('scrolled', !on);
  //   }, { threshold: [0, 0.08, 0.2] });
  //   io.observe(head);
  // }

  function navColour() {
  const nav = document.getElementById('nav');
  if (!nav) return;

  function update() {
    const scrolled = window.scrollY > 0;

    nav.classList.toggle('scrolled', scrolled);
    nav.classList.toggle('on-dusk', !scrolled);
  }

  update();
  window.addEventListener('scroll', update, { passive: true });
}

  async function boot() {
    await loadIncludes(document);
    markCurrent();
    mobileMenu();
    navColour();
    document.documentElement.classList.add('ready');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
