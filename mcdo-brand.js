/* Coachella — official McDonald's arches replacement, layout-safe edition.
   Keep the original SVG and its CSS sizing; replace ONLY the drawn path
   with the supplied official logo embedded as an SVG <image>.
   Decorative background arches are intentionally not modified. */
(() => {
  'use strict';
  const LOGO_URL = new URL('mcdo-golden-arches.png', document.currentScript?.src || location.href).href;
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const known = [
    /M12\s+74V38C12\s+-4\s+56\s+-4\s+60\s+38/i,
    /M14\s+82V45C14\s+-3\s+55\s+-3\s+60\s+45/i
  ];

  function update(root) {
    const nodes = [];
    if (root.nodeType === 1 && root.matches?.('svg')) nodes.push(root);
    if (root.querySelectorAll) nodes.push(...root.querySelectorAll('svg'));
    for (const svg of nodes) {
      if (svg.dataset.mcdoReplaced === '1') continue;
      const paths = [...svg.querySelectorAll('path')];
      if (paths.length !== 1 || !known.some(rx => rx.test(paths[0].getAttribute('d') || ''))) continue;
      const vb = svg.viewBox.baseVal;
      const x = vb?.width ? vb.x : 0;
      const y = vb?.height ? vb.y : 0;
      const width = vb?.width || 120;
      const height = vb?.height || 80;
      const logo = document.createElementNS(SVG_NS, 'image');
      logo.setAttribute('href', LOGO_URL);
      logo.setAttribute('x', String(x));
      logo.setAttribute('y', String(y));
      logo.setAttribute('width', String(width));
      logo.setAttribute('height', String(height));
      logo.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      logo.setAttribute('aria-label', "McDonald's Golden Arches");
      paths[0].replaceWith(logo);
      svg.dataset.mcdoReplaced = '1';
      // The original SVG is left intact, so CSS classes, width/height,
      // viewBox, and all responsive sizing remain exactly as before.
    }
  }

  function init() {
    update(document);
    const observer = new MutationObserver(records => {
      for (const record of records) for (const node of record.addedNodes) update(node);
    });
    observer.observe(document.documentElement, {childList: true, subtree: true});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once: true});
  else init();
})();
