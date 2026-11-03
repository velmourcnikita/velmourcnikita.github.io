'use strict';
(() => {
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const layer = document.createElement('div');
  layer.className = 'cursor-layer'; layer.setAttribute('aria-hidden', 'true');
  const dot = document.createElement('span'); dot.className = 'cursor-dot';
  const ring = document.createElement('span'); ring.className = 'cursor-ring';
  const trail = Array.from({ length: 5 }, (_, i) => {
    const element = document.createElement('span'); element.className = 'cursor-trail';
    element.style.opacity = String(.22 - i * .035);
    layer.append(element); return { element, x: 0, y: 0 };
  });
  layer.append(ring, dot); document.body.append(layer);
  let enabled = false, visible = false, frame = 0, lastTime = 0;
  let x = 0, y = 0, ringX = 0, ringY = 0, card = null, dirtyCard = false;
  function stop() {
    cancelAnimationFrame(frame); frame = 0; lastTime = 0; visible = false;
    layer.classList.remove('is-visible', 'is-down', 'is-interactive');
    document.body.classList.remove('custom-cursor');
    if (card) card.classList.remove('is-pointed');
    card = null;
  }
  function sync() {
    enabled = finePointer.matches && !reducedMotion.matches && !document.body.classList.contains('effects-off');
    stop();
  }
  function place(element, px, py) { element.style.transform = 'translate3d(' + px + 'px,' + py + 'px,0)'; }
  function draw(now) {
    frame = 0;
    if (!enabled || !visible || document.hidden) return;
    const step = lastTime ? Math.min((now - lastTime) / 16.67, 3) : 1;
    lastTime = now;
    const ease = 1 - Math.pow(.78, step);
    ringX += (x - ringX) * ease; ringY += (y - ringY) * ease;
    place(dot, x, y); place(ring, ringX, ringY);
    let previousX = ringX, previousY = ringY, remaining = Math.abs(x - ringX) + Math.abs(y - ringY);
    for (const point of trail) {
      point.x += (previousX - point.x) * ease; point.y += (previousY - point.y) * ease;
      remaining += Math.abs(previousX - point.x) + Math.abs(previousY - point.y);
      place(point.element, point.x, point.y);
      previousX = point.x; previousY = point.y;
    }
    if (dirtyCard && card) {
      const box = card.getBoundingClientRect();
      card.style.setProperty('--mouse-x', (x - box.left) + 'px');
      card.style.setProperty('--mouse-y', (y - box.top) + 'px');
      dirtyCard = false;
    }
    if (remaining > .2) frame = requestAnimationFrame(draw);
    else lastTime = 0;
  }
  document.addEventListener('pointermove', event => {
    if (!enabled || event.pointerType !== 'mouse') return;
    x = event.clientX; y = event.clientY;
    if (!visible) {
      visible = true; ringX = x; ringY = y;
      for (const point of trail) { point.x = x; point.y = y; }
      layer.classList.add('is-visible'); document.body.classList.add('custom-cursor');
    }
    const nextCard = event.target instanceof Element ? event.target.closest('.card') : null;
    if (nextCard !== card) {
      if (card) card.classList.remove('is-pointed');
      card = nextCard; if (card) card.classList.add('is-pointed');
    }
    dirtyCard = true;
    layer.classList.toggle('is-interactive', event.target instanceof Element && !!event.target.closest('a, button, summary, input'));
    if (!frame) frame = requestAnimationFrame(draw);
  }, { passive: true });
  document.addEventListener('pointerdown', () => { if (visible) layer.classList.add('is-down'); }, { passive: true });
  document.addEventListener('pointerup', () => layer.classList.remove('is-down'), { passive: true });
  document.documentElement.addEventListener('pointerleave', stop);
  for (const iframe of document.querySelectorAll('iframe')) iframe.addEventListener('pointerenter', stop);
  addEventListener('blur', stop);
  addEventListener('scroll', stop, { passive: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  document.addEventListener('effectschange', sync);
  finePointer.addEventListener('change', sync); reducedMotion.addEventListener('change', sync);
  sync();
})();
