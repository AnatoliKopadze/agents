// Render one image file to PNG at 2x and report layout problems.
// Usage: node source/design/render.cjs <input.html> <output.png>
// Prints JSON: { file, cssSize, pngSize, issues: [...] }. Fix every issue before you call an image done.
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const [, , input, output] = process.argv;
  if (!input || !output) { console.error('usage: render.cjs in.html out.png'); process.exit(2); }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', e => errors.push('page error: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto('file://' + path.resolve(input));
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 8000 })
    .catch(() => errors.push('window.__ready never set: call draw(fn) or done() at the end of the file'));
  await page.waitForTimeout(150);
  const report = await page.evaluate(() => {
    const issues = [];
    const frame = document.querySelector('.frame');
    if (!frame) return { issues: ['no .frame element'], w: 0, h: 0 };
    const f = frame.getBoundingClientRect();
    const cs = getComputedStyle(frame);
    const padL = parseFloat(cs.paddingLeft), padR = parseFloat(cs.paddingRight);
    const label = el => (el.id ? '#' + el.id : el.className ? '.' + String(el.className).split(' ').join('.') : el.tagName) + ' "' + (el.textContent || '').trim().slice(0, 40) + '"';
    // 1. text clipped inside boxes
    document.querySelectorAll('.node, .pill, .tag, .code, .panel, .bar').forEach(el => {
      if (el.scrollWidth > el.clientWidth + 2) issues.push('text overflows its box: ' + label(el));
    });
    // 2. things outside the frame or inside the side padding
    document.querySelectorAll('.node, .pill, .code, .panel, .title, .sub, .caption, .kicker, .tag').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width === 0) return;
      if (r.left < f.left + padL - 24 || r.right > f.right - padR + 24) issues.push('too close to / outside the frame edge: ' + label(el));
      if (r.top < f.top + 8 || r.bottom > f.bottom - 8) issues.push('outside the frame vertically: ' + label(el));
    });
    // 3. overlapping boxes and labels
    const boxes = [...document.querySelectorAll('.node, .pill.wire-label, .cut')].map(el => [el, el.getBoundingClientRect()]);
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const [ea, a] = boxes[i], [eb, b] = boxes[j];
      if (ea.contains(eb) || eb.contains(ea)) continue;
      const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (ox > 4 && oy > 4) issues.push('overlap: ' + label(ea) + ' with ' + label(eb));
    }
    // 4. forbidden characters and small text
    const txt = frame.innerText;
    if (/[—–]/.test(txt)) issues.push('em/en dash found in image text: use a period, comma, colon or arrow');
    const walker = document.createTreeWalker(frame, NodeFilter.SHOW_TEXT);
    const small = new Set();
    while (walker.nextNode()) {
      const n = walker.currentNode;
      if (!n.textContent.trim()) continue;
      const fs = parseFloat(getComputedStyle(n.parentElement).fontSize);
      if (fs < 16) small.add(n.textContent.trim().slice(0, 30) + ' (' + fs + 'px)');
    }
    if (small.size) issues.push('text smaller than 16px (unreadable on phones): ' + [...small].join(' | '));
    issues.push(...(window.__wireErrors || []));
    return { issues, w: Math.round(f.width), h: Math.round(f.height) };
  });
  const frame = await page.$('.frame');
  await frame.screenshot({ path: output });
  await browser.close();
  console.log(JSON.stringify({ file: output, cssSize: [report.w, report.h], pngSize: [report.w * 2, report.h * 2], issues: [...errors, ...report.issues] }, null, 1));
})();
