// XBAR reusable top banner injector
(function(){
  function basePath() {
    try {
      const p = window.location.pathname;
      const idx = p.indexOf('/apps/');
      if (idx !== -1) return p.slice(0, idx) + '/'; // root before '/apps/'
      // fallback for non-app pages at root
      const lastSlash = p.lastIndexOf('/');
      return p.slice(0, lastSlash + 1);
    } catch { return '/'; }
  }
  function mountBanner() {
    let mount = document.getElementById('xbar-banner');
    if (!mount) {
      mount = document.createElement('div');
      mount.id = 'xbar-banner';
      document.body.insertBefore(mount, document.body.firstChild);
    }
    const base = basePath();
    const homeHref = base;
    const appletsHref = base + '#applets';
    const blogsHref = base + '#blogs';
    const githubHref = 'https://github.com/Songyosr/xbar';
    mount.innerHTML = [
      '<header class="xbar-banner">',
      '  <div class="container-1140">',
      `    <a href="${homeHref}" class="brand-xbar" aria-label="home">`,
      '      <span class="br-l">[</span>x̄<span class="br-r">]</span>',
      '    </a>',
      '    <nav class="xbar-nav" aria-label="Primary">',
      `      <a href="${appletsHref}">Applets</a>`,
      `      <a href="${blogsHref}">Blogs</a>`,
      `      <a href="${githubHref}" rel="noopener">GitHub</a>`,
      '    </nav>',
      '  </div>',
      '</header>'
    ].join('');
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountBanner);
  } else {
    mountBanner();
  }
})();
