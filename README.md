# Protocol Compiler — Corpus Search

A license-aware, self-contained search UI over ~124,000 harvested laboratory-science
records across four libraries — **protocols**, **Q&A**, **computational analyses**,
and **literature** — from ~22 open sources.

**Live:** https://xavierbower.github.io/protocol-compiler-search/

## How it handles licensing

Every record is tiered by the license of its source content:

- **open** — full snippet shown (CC-BY / CC-BY-SA / CC0 / permissive OSS)
- **unknown** — short snippet + a link to the original (license unconfirmed)
- **restricted** — title + link only, no snippet (all-rights-reserved)

A provenance link is attribution, not a redistribution grant, so full text is
rendered only for openly-licensed records. All indexed content is untrusted
third-party text; use the source links for anything authoritative.

Static site — `index.html` + `app.js` + `style.css` + a prebuilt `data/catalog.json`.
No backend, no tracking.
