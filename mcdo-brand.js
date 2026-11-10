/* Coachella official McDonald's arches asset replacement.
   Only replaces known hand-drawn McDonald's M icon paths, not decorative backgrounds. */
(() => {
  'use strict';
  const LOGO = 'mcdo-golden-arches.png';
  const known = [
    /M12\s+74V38C12\s+-4\s+56\s+-4\s+60\s+38/i,
    /M14\s+82V45C14\s+-3\s+55\s+-3\s+60\s+45/i
  ];
  function update(root) {
    const nodes = [];
    if (root.nodeType === 1 && root.matches?.('svg')) nodes.push(root);
    if (root.querySelectorAll) nodes.push(...root.querySelectorAll('svg'));
    for (const svg of nodes) {
      if (svg.dataset.mcdoReplaced) continue;
      const paths = [...svg.querySelectorAll('path')];
      if (paths.length !== 1 || !known.some(rx => rx.test(paths[0].getAttribute('d') || ''))) continue;
      const img = document.createElement('img');
      img.src = LOGO;
      img.alt = 'McDonald’s Golden Arches';
      img.className = (svg.getAttribute('class') || '') + ' mcdo-official-logo';
      if (svg.id) img.id = svg.id;
      const css = svg.getAttribute('style');
      if (css) img.setAttribute('style', css);
      const w = svg.getAttribute('width'), h = svg.getAttribute('height');
      if (w) img.setAttribute('width', w);
      if (h) img.setAttribute('height', h);
      // Preserve layout while fitting the complete official mark.
      img.style.objectFit = 'contain';
      if (!w && !h && !svg.classList.contains('arch-logo')) {
        img.style.width = '100%';
        img.style.height = '100%';
      }
      svg.dataset.mcdoReplaced = '1';
      svg.replaceWith(img);
    }
  }
  function init() {
    update(document);
    const observer = new MutationObserver(records => {
      for (const record of records) for (const node of record.addedNodes) update(node);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
