# carebravo.com — v3 package, complete site (17 September 2026)

Built on Abhay's carebravo-v2 reference: same tokens, stylesheet, components and JS. Every page is complete,
self-contained and already stitched (header + footer inlined). Deploy the folder as-is to Netlify.

## What is in this drop — all four waves, 25 pages
| URL | File | Wave |
|---|---|---|
| / | index.html | A |
| /pricing | pricing/index.html | A |
| /agents | agents/index.html | A |
| /how-it-works | how-it-works/index.html | A |
| /medicaid · /georgia · /results | medicaid/, georgia/, results/ | B |
| /outcomes hub + nine Outcome pages (scheduling-payroll, compliance, billing, communication, documentation, marketing, hiring, retention, training) | outcomes/, outcomes/<slug>/ | C |
| /caredrain · /tangleware · /screen-tax · /autonomous-caring · /parallel-promise · /about · /editorial-policy | one folder each | D |
| 404 | 404.html | — |

Not in the package: /calculate — apply the copy deck (15 Sep) to the existing Calculator; the sitemap carries a comment for it.

## Structure
```
carebravo/
├── components/   header.html · footer.html · knowledge-graph.html  (SOURCE — edit here, then run tools/stitch.py)
├── css/          tokens.css (shared with caryfy.ai; Section 2 = CareBravo warm temperature) · style.css
├── js/main.js    nav marking, mobile menu, hero nav colour switch (include loader now a no-op — nothing to fetch)
├── images/       empty; every slot already points at /images/<name>.jpg — see IMAGE-SHOT-LIST.md
├── og/           empty; every page already points at /og/<page>.jpg
├── tools/stitch.py
├── <page>/index.html …
├── 404.html · _redirects · netlify.toml · robots.txt · sitemap.xml · llms.txt · site.webmanifest
└── IMAGE-SHOT-LIST.md
```

## Three things that changed from the reference
1. **Warm temperature** (15 Sep ruling): `tokens.css` Section 2 overrides paper, ink and rules. Keep it last in the file.
2. **Header and footer are inlined**, not fetched. Answer-engine crawlers do not run JavaScript and the footer graph
   is the only path into the lexicon pages. Pages carry `<!-- component:header -->…<!-- /component:header -->`
   markers; after editing anything in `components/`, run `python3 tools/stitch.py` from the site root and every page updates.
3. **Every URL is `<path>/index.html`.** No root-level .html, no pretty-URL redirect rules. `_redirects` only carries
   the /start retirement and the legacy .html addresses.

## Images
Every `.hero`, `.page-head` and `.media` slot already contains `<img src="/images/…" onerror="this.remove()">`.
Until the file exists the gradient frame and `.shot` caption show; the moment it exists the image shows and the
caption hides. No HTML changes when images land. Generate from `IMAGE-SHOT-LIST.md` (69 files: 45 stills, 24 OG cards).

## Pre-launch checklist (gates unchanged)
- [ ] Jumana: Heart Test on Wave A (home, pricing, agents, how-it-works) — publish gate
- [ ] Andrea: fee-credit remedy language (row 81-a) — no fee-credit claim is on any page; gate is on the guarantee panel wording
- [ ] Counsel: footer entity attribution — footer is ownerless as ruled 15 Sep; leave as is until told otherwise
- [ ] Favicon set: favicon.ico, favicon.svg, apple-touch-icon.png, android-chrome-192/512 (paths are already in every head and in site.webmanifest)
- [ ] Images generated and dropped in /images and /og per the shot list; no gradient frame visible at launch
- [ ] /results chart: AR-aging curve as inline SVG, dated, n stated — replaces the `.media.chart` placeholder
- [ ] Anuj: append the legacy /showcase and old Outcome URL 301s to `_redirects` from the 30 Aug manifest; confirm /agents URL
- [ ] Verify in the Network tab that Geist and Instrument Serif load from Google Fonts on every page
- [ ] sameAs: add LinkedIn, Georgia DCH listing, Google Business Profile to the #product node once real — never placeholders
