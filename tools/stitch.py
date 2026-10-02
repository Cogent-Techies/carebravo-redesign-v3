#!/usr/bin/env python3
"""stitch.py — inline components into every page so the shipped HTML carries the header and footer.
No client-side fetch: answer-engine crawlers do not run JavaScript, and the footer graph is the only inbound
path to the lexicon pages.

Pages carry marker pairs:   <!-- component:header --> ... <!-- /component:header -->
Run from the site root after editing anything in components/:   python3 tools/stitch.py
Every page is rewritten with the current component content between its markers. Idempotent."""
import re, pathlib
root = pathlib.Path(__file__).resolve().parents[1]
# the provenance comment at the top of each component mentions its own include tag; strip comments before expanding
comps = {p.stem: re.sub(r'<!--.*?-->', '', p.read_text(encoding='utf-8'), flags=re.S).strip() for p in (root/'components').glob('*.html')}
def expand(html):
    return re.sub(r'<div data-include="/components/([\w-]+)\.html"></div>', lambda m: expand(comps[m.group(1)]), html)
resolved = {k: expand(v) for k, v in comps.items()}
n = 0
for page in root.rglob('*.html'):
    if 'components' in page.parts: continue
    s = page.read_text(encoding='utf-8'); o = s
    for name, body in resolved.items():
        s = re.sub(rf'<!-- component:{name} -->.*?<!-- /component:{name} -->',
                   lambda m: f'<!-- component:{name} -->\n{body}\n<!-- /component:{name} -->', s, flags=re.S)
        s = s.replace(f'<div data-include="/components/{name}.html"></div>',
                      f'<!-- component:{name} -->\n{body}\n<!-- /component:{name} -->')
    if s != o: page.write_text(s, encoding='utf-8'); n += 1
print(f'stitched {n} page(s)')
