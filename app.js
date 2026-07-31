'use strict';

// ── theme ──
const root = document.documentElement;
const saved = localStorage.getItem('pc-theme');
if (saved) root.setAttribute('data-theme', saved);
document.getElementById('theme').addEventListener('click', () => {
  const dark = getComputedStyle(document.body).backgroundColor === 'rgb(14, 17, 19)';
  const next = dark ? 'light' : 'dark';
  root.setAttribute('data-theme', next);
  localStorage.setItem('pc-theme', next);
});

const TIER = {
  open: 'Open — full content servable',
  unknown: 'Unknown license — snippet + link only',
  restricted: 'Restricted — link to source only',
};
const PAGE = 60;

let DATA = [];
let HAY = [];
let META = null;
let loaded = false;
const state = { q: '', library: new Set(), tier: new Set(), source: new Set(), shown: PAGE };

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function load() {
  try {
    const [cat, meta] = await Promise.all([
      fetch('data/catalog.json').then((r) => r.json()),
      fetch('data/catalog-meta.json').then((r) => r.json()).catch(() => null),
    ]);
    DATA = cat;
    META = meta;
    HAY = DATA.map((d) => (d.t + ' ' + (d.g || []).join(' ') + ' ' + (d.sn || '') + ' ' + d.s).toLowerCase());
    loaded = true;
    buildFacets();
    $('foot').innerHTML =
      `<b>${DATA.length.toLocaleString()}</b> records across protocols · Q&amp;A · analyses` +
      (meta ? ` · built ${new Date(meta.generatedAt).toISOString().slice(0, 10)}` : '') +
      '. Full content is rendered only for openly-licensed records; others link to source. All content is untrusted third-party text.';
    render();
  } catch (e) {
    $('stat').textContent = 'Failed to load catalog. Run `npm run catalog`, then serve site/.';
  }
}

function counts(key) {
  const m = new Map();
  for (const d of DATA) m.set(d[key], (m.get(d[key]) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function facetRow(group, value, label, count) {
  const el = document.createElement('div');
  el.className = 'facet';
  el.tabIndex = 0;
  el.innerHTML = `<span>${esc(label)}</span><span class="cnt">${count.toLocaleString()}</span>`;
  const toggle = () => {
    const set = state[group];
    set.has(value) ? set.delete(value) : set.add(value);
    el.classList.toggle('on');
    state.shown = PAGE;
    render();
  };
  el.addEventListener('click', toggle);
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle();
    }
  });
  return el;
}

function buildFacets() {
  for (const [v, c] of counts('l')) $('f-library').appendChild(facetRow('library', v, v, c));
  const tc = Object.fromEntries(counts('tier'));
  for (const t of ['open', 'unknown', 'restricted']) if (tc[t]) $('f-tier').appendChild(facetRow('tier', t, t, tc[t]));
  for (const [v, c] of counts('s')) $('f-source').appendChild(facetRow('source', v, v, c));
}

function matches(i, toks) {
  const d = DATA[i];
  if (state.library.size && !state.library.has(d.l)) return false;
  if (state.tier.size && !state.tier.has(d.tier)) return false;
  if (state.source.size && !state.source.has(d.s)) return false;
  const h = HAY[i];
  for (const t of toks) if (h.indexOf(t) === -1) return false;
  return true;
}

function score(i, toks) {
  const d = DATA[i];
  const ti = d.t.toLowerCase();
  let s = 0;
  for (const t of toks) {
    if (ti.indexOf(t) !== -1) s += 10;
    if ((d.g || []).some((g) => g.toLowerCase().indexOf(t) !== -1)) s += 4;
  }
  return s + Math.min(d.w || 0, 800) / 800;
}

function searchHits() {
  const toks = state.q.toLowerCase().split(/\s+/).filter(Boolean);
  const hits = [];
  for (let i = 0; i < DATA.length; i++) if (matches(i, toks)) hits.push(i);
  if (toks.length) hits.sort((a, b) => score(b, toks) - score(a, toks));
  return hits;
}

function meter(hits) {
  const c = { open: 0, unknown: 0, restricted: 0 };
  for (const i of hits) c[DATA[i].tier]++;
  const tot = hits.length || 1;
  $('meter').innerHTML = ['open', 'unknown', 'restricted']
    .map((t) => `<i class="${t}" style="width:${(100 * c[t]) / tot}%" title="${t}: ${c[t]}"></i>`)
    .join('');
}

function card(d) {
  const link = d.u ? `<a class="src-link" href="${esc(d.u)}" target="_blank" rel="noopener noreferrer nofollow">view source ↗</a>` : '';
  const title = d.u
    ? `<a href="${esc(d.u)}" target="_blank" rel="noopener noreferrer nofollow">${esc(d.t)}</a>`
    : esc(d.t);
  const tags = (d.g || []).slice(0, 6).map((g) => `<span class="tag">${esc(g)}</span>`).join('');
  let body;
  if (d.tier === 'restricted') body = `<div class="locknote">🔒 ${esc(d.lic)} — content not shown; view at source.</div>`;
  else if (d.sn) body = `<div class="snippet">${esc(d.sn)}${d.sn.length >= 240 ? '…' : ''}</div>`;
  else body = '';
  return `<article class="card"><div class="row1"><span class="badge lib">${esc(d.l)}</span><span class="badge src">${esc(d.s)}</span><span class="badge ${d.tier}" title="${esc(TIER[d.tier])}">${esc(d.lic)}</span>${link}</div><h2>${title}</h2>${body}<div class="tags">${tags}</div></article>`;
}

function render() {
  const box = $('results');
  if (!loaded) {
    $('stat').textContent = 'indexing the corpus — one moment…';
    box.innerHTML = '<div class="empty">Loading ~124k records… first load is a few seconds.</div>';
    return;
  }
  const hits = searchHits();
  meter(hits);
  const active = state.library.size + state.tier.size + state.source.size;
  $('stat').textContent =
    `${hits.length.toLocaleString()} result${hits.length === 1 ? '' : 's'}` +
    (state.q ? ` · “${state.q}”` : '') +
    (active ? ` · ${active} filter${active === 1 ? '' : 's'}` : '');
  if (!hits.length) {
    box.innerHTML = '<div class="empty">No matches. Try fewer words or clear filters.</div>';
    return;
  }
  const slice = hits.slice(0, state.shown);
  box.innerHTML = slice.map((i) => card(DATA[i])).join('');
  if (hits.length > state.shown) {
    const more = document.createElement('div');
    more.className = 'more';
    more.textContent = `Showing ${state.shown.toLocaleString()} of ${hits.length.toLocaleString()} — scroll for more`;
    box.appendChild(more);
  }
}

let t;
$('q').addEventListener('input', (e) => {
  clearTimeout(t);
  t = setTimeout(() => {
    state.q = e.target.value.trim();
    state.shown = PAGE;
    render();
  }, 120);
});

window.addEventListener('scroll', () => {
  if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 400 && state.shown < DATA.length) {
    state.shown += PAGE;
    render();
  }
});

render(); // show the loading state immediately
load();
