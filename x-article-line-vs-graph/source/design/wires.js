/* Arrow helper. Usage inside an image file:
 *   <script src="../design/wires.js"></script>
 *   <script>
 *     draw(() => {
 *       wire('a', 'b');                                   // auto sides, accent color
 *       wire('a', 'c', { color: 'green', label: 'findings[]' });
 *       wire('x', 'y', { color: 'muted', dashed: true, cut: true });
 *       wire('p', 'q', { from: 'bottom', to: 'top', curve: 0.3 });
 *     });
 *   </script>
 * Options: color: accent | green | muted | ink (default accent)
 *          from/to: right | left | top | bottom (default: picked from positions)
 *          curve: 0..1 bend strength (default .5; 0 = nearly straight)
 *          dashed, head (default true), width (default 3), gap (px from box, default 6)
 *          label: text pill at the middle, labelClass: extra class for the pill (e.g. 'accent')
 *          cut: true draws a round X on the middle (an arrow that should not exist)
 *          t: 0..1 where the label/cut sits along the curve (default .5)
 */
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const COLORS = { accent: '#C8552B', green: '#4D6B37', muted: '#B4ACA0', ink: '#1D1B18' };
  let svg, frame;
  window.__wireErrors = [];

  function setup() {
    frame = document.querySelector('.frame');
    svg = frame.querySelector('svg.wires');
    if (!svg) {
      svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('class', 'wires');
      frame.appendChild(svg);
    }
    svg.setAttribute('width', frame.offsetWidth);
    svg.setAttribute('height', frame.offsetHeight);
    const defs = document.createElementNS(NS, 'defs');
    for (const [k, c] of Object.entries(COLORS)) {
      const m = document.createElementNS(NS, 'marker');
      m.setAttribute('id', 'h-' + k);
      m.setAttribute('viewBox', '0 0 10 10');
      m.setAttribute('refX', '8');
      m.setAttribute('refY', '5');
      m.setAttribute('markerWidth', '4.2');
      m.setAttribute('markerHeight', '4.2');
      m.setAttribute('orient', 'auto-start-reverse');
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', 'M0,0 L10,5 L0,10 z');
      p.setAttribute('fill', c);
      m.appendChild(p);
      defs.appendChild(m);
    }
    svg.appendChild(defs);
  }
  function rel(el) {
    const r = el.getBoundingClientRect(), f = frame.getBoundingClientRect();
    return { x: r.left - f.left, y: r.top - f.top, w: r.width, h: r.height };
  }
  function anchor(b, side) {
    switch (side) {
      case 'right': return [b.x + b.w, b.y + b.h / 2, 1, 0];
      case 'left': return [b.x, b.y + b.h / 2, -1, 0];
      case 'top': return [b.x + b.w / 2, b.y, 0, -1];
      default: return [b.x + b.w / 2, b.y + b.h, 0, 1];
    }
  }
  function autoSides(a, b) {
    const dx = (b.x + b.w / 2) - (a.x + a.w / 2), dy = (b.y + b.h / 2) - (a.y + a.h / 2);
    if (Math.abs(dx) >= Math.abs(dy) * 0.6) return dx > 0 ? ['right', 'left'] : ['left', 'right'];
    return dy > 0 ? ['bottom', 'top'] : ['top', 'bottom'];
  }
  function bez(p0, p1, p2, p3, t) { const u = 1 - t; return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3; }

  window.wire = function (fromId, toId, o = {}) {
    if (!svg) setup();
    const A = document.getElementById(fromId), B = document.getElementById(toId);
    if (!A || !B) { window.__wireErrors.push('missing id: ' + (!A ? fromId : toId)); return; }
    const a = rel(A), b = rel(B);
    let [sf, st] = autoSides(a, b);
    if (o.from) sf = o.from;
    if (o.to) st = o.to;
    const [x1, y1, dx1, dy1] = anchor(a, sf);
    const [x2, y2, dx2, dy2] = anchor(b, st);
    const gap = o.gap ?? 6;
    const head = o.head !== false;
    const sx = x1 + dx1 * gap, sy = y1 + dy1 * gap;
    const ex = x2 + dx2 * (gap + (head ? 4 : 0)), ey = y2 + dy2 * (gap + (head ? 4 : 0));
    // bend strength follows the distance along each anchor's own axis, so arrows never loop back
    const cv = o.curve ?? 0.5;
    const k1 = Math.max(12, cv * (dx1 ? Math.abs(ex - sx) : Math.abs(ey - sy)));
    const k2 = Math.max(12, cv * (dx2 ? Math.abs(ex - sx) : Math.abs(ey - sy)));
    const c1x = sx + dx1 * k1, c1y = sy + dy1 * k1, c2x = ex + dx2 * k2, c2y = ey + dy2 * k2;
    const color = COLORS[o.color] ? o.color : 'accent';
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', `M${sx},${sy} C${c1x},${c1y} ${c2x},${c2y} ${ex},${ey}`);
    p.setAttribute('fill', 'none');
    p.setAttribute('stroke', COLORS[color]);
    p.setAttribute('stroke-width', o.width || 3);
    p.setAttribute('stroke-linecap', 'round');
    if (o.dashed) p.setAttribute('stroke-dasharray', '9 9');
    if (head) p.setAttribute('marker-end', `url(#h-${color})`);
    svg.appendChild(p);
    const t = o.t ?? 0.5;
    const mx = bez(sx, c1x, c2x, ex, t), my = bez(sy, c1y, c2y, ey, t);
    if (o.label) {
      const d = document.createElement('div');
      d.className = 'pill wire-label ' + (o.labelClass || '');
      d.textContent = o.label;
      d.style.position = 'absolute';
      d.style.left = mx + 'px';
      d.style.top = my + 'px';
      d.style.transform = 'translate(-50%, -50%)';
      frame.appendChild(d);
    }
    if (o.cut) {
      const d = document.createElement('div');
      d.className = 'cut';
      d.textContent = '✕';
      d.style.left = mx + 'px';
      d.style.top = my + 'px';
      frame.appendChild(d);
    }
  };

  /* Wait for fonts and layout, run the drawing function, then signal the renderer. */
  window.draw = function (fn) {
    document.fonts.ready.then(() => {
      requestAnimationFrame(() => {
        try { fn(); } catch (e) { window.__wireErrors.push(String(e)); }
        window.__ready = true;
      });
    });
  };
  /* For images without arrows. */
  window.done = function () { document.fonts.ready.then(() => { window.__ready = true; }); };
})();
