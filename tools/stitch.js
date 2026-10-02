// Node equivalent of stitch.py (python3 unavailable in this environment).
// Run from the site root: node tools/stitch.js
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const compDir = path.join(root, 'components');

const comps = {};
for (const f of fs.readdirSync(compDir)) {
  if (!f.endsWith('.html')) continue;
  const name = f.replace(/\.html$/, '');
  const raw = fs.readFileSync(path.join(compDir, f), 'utf8');
  comps[name] = raw.replace(/<!--[\s\S]*?-->/g, '').trim();
}

function expand(html) {
  return html.replace(/<div data-include="\/components\/([\w-]+)\.html"><\/div>/g, (m, name) => expand(comps[name]));
}

const resolved = {};
for (const k in comps) resolved[k] = expand(comps[k]);

function walk(dir, files) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'components') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (entry.name.endsWith('.html')) files.push(full);
  }
}

const files = [];
walk(root, files);

let n = 0;
for (const page of files) {
  let s = fs.readFileSync(page, 'utf8');
  const o = s;
  for (const name in resolved) {
    const body = resolved[name];
    const markerRe = new RegExp(`<!-- component:${name} -->[\\s\\S]*?<!-- /component:${name} -->`, 'g');
    s = s.replace(markerRe, `<!-- component:${name} -->\n${body}\n<!-- /component:${name} -->`);
    s = s.split(`<div data-include="/components/${name}.html"></div>`).join(`<!-- component:${name} -->\n${body}\n<!-- /component:${name} -->`);
  }
  if (s !== o) {
    fs.writeFileSync(page, s);
    n++;
  }
}
console.log(`stitched ${n} page(s)`);
