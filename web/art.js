// art.js — original inline-SVG art for "Study Abroad: Maple Corner Market".
// All layers share viewBox 0 0 1600 900 with `xMidYMid slice` so they stay aligned.

export const EMOTIONS = ['neutral', 'happy', 'thinking', 'sorry', 'confused', 'surprised'];

const VB = 'viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"';

// ---------- helpers ----------
function rngFrom(seed) {
  // mulberry32
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const f = (n) => Math.round(n * 10) / 10;
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const between = (rng, a, b) => a + (b - a) * rng();

const LEAF = [
  [0, -1], [0.12, -0.62], [0.35, -0.72], [0.28, -0.3], [0.62, -0.42], [0.55, -0.25], [0.9, -0.22],
  [0.72, 0], [0.8, 0.12], [0.42, 0.22], [0.48, 0.4], [0.06, 0.3], [0.06, 0.72], [-0.06, 0.72],
  [-0.06, 0.3], [-0.48, 0.4], [-0.42, 0.22], [-0.8, 0.12], [-0.72, 0], [-0.9, -0.22], [-0.55, -0.25],
  [-0.62, -0.42], [-0.28, -0.3], [-0.35, -0.72], [-0.12, -0.62],
];
export function mapleLeaf(cx, cy, s, fill, extra = '') {
  const pts = LEAF.map(([x, y]) => `${f(cx + x * s)},${f(cy + y * s)}`).join(' ');
  return `<polygon points="${pts}" fill="${fill}" stroke-linejoin="round" ${extra}/>`;
}

/** Stand-alone maple leaf icon (for the title / UI). */
export function leafIcon(size = 48, fill = '#d4553a') {
  return `<svg width="${size}" height="${size}" viewBox="-1 -1.05 2 2" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${mapleLeaf(0, 0, 0.95, fill)}</svg>`;
}

const PRODUCT_COLORS = ['#e4572e', '#f3a712', '#29335c', '#669bbc', '#a8c686', '#db5461', '#f6ae2d',
  '#86bbd8', '#9e6240', '#2f9c95', '#e07a5f', '#81b29a', '#f2cc8f', '#6d597a', '#ee964b', '#3d5a80'];

function product(type, px, by, pw, ph, color) {
  const top = by - ph;
  switch (type) {
    case 'bottle': {
      const bh = ph * 0.68;
      return `<g>
        <rect x="${f(px + pw * 0.3)}" y="${f(top + 4)}" width="${f(pw * 0.4)}" height="${f(ph * 0.36)}" rx="2" fill="${color}"/>
        <rect x="${f(px + pw * 0.26)}" y="${f(top)}" width="${f(pw * 0.48)}" height="7" rx="2" fill="#3b2a20" opacity=".8"/>
        <rect x="${f(px)}" y="${f(by - bh)}" width="${f(pw)}" height="${f(bh)}" rx="${f(pw * 0.3)}" fill="${color}"/>
        <rect x="${f(px)}" y="${f(by - bh * 0.7)}" width="${f(pw)}" height="${f(bh * 0.32)}" fill="#fffaf0" opacity=".75"/>
        <rect x="${f(px + pw * 0.16)}" y="${f(by - bh * 0.95)}" width="${f(pw * 0.13)}" height="${f(bh * 0.8)}" rx="2" fill="#fff" opacity=".35"/>
      </g>`;
    }
    case 'can':
      return `<g>
        <rect x="${f(px)}" y="${f(top)}" width="${f(pw)}" height="${f(ph)}" rx="3" fill="${color}"/>
        <rect x="${f(px)}" y="${f(top + ph * 0.3)}" width="${f(pw)}" height="${f(ph * 0.38)}" fill="#fffaf0" opacity=".7"/>
        <ellipse cx="${f(px + pw / 2)}" cy="${f(top + 2)}" rx="${f(pw / 2)}" ry="3" fill="#d9d2c8"/>
        <rect x="${f(px + pw * 0.72)}" y="${f(top)}" width="${f(pw * 0.28)}" height="${f(ph)}" rx="2" fill="#000" opacity=".12"/>
      </g>`;
    case 'jar':
      return `<g>
        <rect x="${f(px)}" y="${f(top + 7)}" width="${f(pw)}" height="${f(ph - 7)}" rx="6" fill="${color}"/>
        <rect x="${f(px + 2)}" y="${f(top)}" width="${f(pw - 4)}" height="9" rx="2" fill="#c9973f"/>
        <circle cx="${f(px + pw / 2)}" cy="${f(by - ph * 0.42)}" r="${f(Math.min(pw, ph) * 0.24)}" fill="#fffaf0" opacity=".8"/>
        <rect x="${f(px + pw * 0.14)}" y="${f(top + 12)}" width="${f(pw * 0.12)}" height="${f(ph * 0.6)}" rx="2" fill="#fff" opacity=".3"/>
      </g>`;
    default: // box
      return `<g>
        <rect x="${f(px)}" y="${f(top)}" width="${f(pw)}" height="${f(ph)}" rx="2" fill="${color}"/>
        <rect x="${f(px)}" y="${f(top)}" width="${f(pw)}" height="4" fill="#fff" opacity=".28"/>
        <rect x="${f(px + 3)}" y="${f(top + ph * 0.28)}" width="${f(pw - 6)}" height="${f(ph * 0.3)}" rx="2" fill="#fffaf0" opacity=".78"/>
        <circle cx="${f(px + pw / 2)}" cy="${f(top + ph * 0.43)}" r="${f(Math.min(pw, ph) * 0.1)}" fill="${color}"/>
        <rect x="${f(px + pw * 0.74)}" y="${f(top)}" width="${f(pw * 0.26)}" height="${f(ph)}" fill="#000" opacity=".13"/>
      </g>`;
  }
}

function shelfFrame(x, y, w, h, rows) {
  const rowH = (h - 20) / rows;
  let s = `<rect x="${x + 8}" y="${y + 10}" width="${w}" height="${h}" rx="8" fill="#5b3a26" opacity=".18" filter="url(#soft)"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="url(#woodDark)"/>
    <rect x="${x + 10}" y="${y + 10}" width="${w - 20}" height="${h - 20}" rx="3" fill="url(#shelfBack)"/>`;
  const boards = [];
  for (let r = 0; r < rows; r++) {
    const by = y + 10 + (r + 1) * rowH - 8;
    boards.push(by);
  }
  return { s, boards, rowH };
}

function boardsSvg(x, w, boards, rng) {
  let s = '';
  for (const by of boards) {
    s += `<rect x="${x + 6}" y="${f(by)}" width="${w - 12}" height="12" rx="2" fill="url(#woodLight)"/>
      <rect x="${x + 6}" y="${f(by)}" width="${w - 12}" height="2" fill="#f3cfa4" opacity=".8"/>
      <rect x="${x + 6}" y="${f(by + 12)}" width="${w - 12}" height="5" fill="#3b2a20" opacity=".18"/>`;
    // price tags
    for (let tx = x + 22; tx < x + w - 40; tx += between(rng, 55, 95)) {
      s += `<rect x="${f(tx)}" y="${f(by + 2)}" width="20" height="9" rx="1.5" fill="#fffdf6"/>
        <rect x="${f(tx + 3)}" y="${f(by + 5)}" width="12" height="2.5" fill="#d4553a"/>`;
    }
  }
  return s;
}

function stockedShelf(x, y, w, h, rows, seed, types) {
  const rng = rngFrom(seed);
  const { s, boards, rowH } = shelfFrame(x, y, w, h, rows);
  let out = s;
  for (const by of boards) {
    let cx = x + 16;
    // each row has a "brand" rhythm: runs of same product
    while (cx < x + w - 30) {
      const type = pick(rng, types);
      const color = pick(rng, PRODUCT_COLORS);
      const pw = type === 'can' ? between(rng, 20, 26) : type === 'bottle' ? between(rng, 18, 26) : between(rng, 26, 44);
      const ph = Math.min(rowH - 20, (type === 'bottle' ? between(rng, 0.7, 0.9) : between(rng, 0.5, 0.8)) * (rowH - 14));
      const run = 1 + Math.floor(rng() * 3);
      for (let k = 0; k < run && cx + pw < x + w - 14; k++) {
        out += product(type, cx, by, pw, ph, color);
        cx += pw + 2;
      }
      cx += between(rng, 3, 9);
    }
  }
  return out + boardsSvg(x, w, boards, rng);
}

function fruitPile(x0, by, width, r, color, hi, rng, leaf) {
  let s = '';
  const n = Math.max(1, Math.floor(width / (r * 2)));
  for (let row = 0; row < 3; row++) {
    const count = n - row;
    if (count <= 0) break;
    const offset = x0 + r + row * r + (width - n * 2 * r) / 2;
    for (let i = 0; i < count; i++) {
      const cx = offset + i * 2 * r + between(rng, -1.5, 1.5);
      const cy = by - r - row * r * 1.55;
      s += `<circle cx="${f(cx)}" cy="${f(cy)}" r="${r}" fill="${color}"/>
        <circle cx="${f(cx - r * 0.35)}" cy="${f(cy - r * 0.38)}" r="${f(r * 0.28)}" fill="${hi}" opacity=".55"/>`;
      if (leaf) s += `<path d="M${f(cx)} ${f(cy - r)} q4 -7 9 -5" stroke="#4f7d32" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
    }
  }
  return s;
}

function scallions(x0, by, width, rng) {
  let s = '';
  for (let x = x0 + 6; x < x0 + width - 6; x += 9) {
    const h = between(rng, 48, 66);
    const lean = between(rng, -6, 6);
    s += `<path d="M${f(x)} ${by - 2} q${f(lean / 2)} ${-h * 0.5} ${f(lean)} ${f(-h)}" stroke="#5ea33b" stroke-width="5" fill="none" stroke-linecap="round"/>
      <path d="M${f(x)} ${by - 2} l0 -12" stroke="#f4f1e6" stroke-width="5.5" stroke-linecap="round"/>`;
  }
  s += `<rect x="${f(x0 + width / 2 - 16)}" y="${by - 20}" width="32" height="7" rx="3" fill="#d4553a"/>`;
  return s;
}

function lettuce(x0, by, width, rng) {
  let s = '';
  for (let x = x0 + 22; x < x0 + width - 16; x += 40) {
    s += `<circle cx="${f(x)}" cy="${by - 22}" r="21" fill="#7cb342"/>
      <circle cx="${f(x - 9)}" cy="${by - 28}" r="13" fill="#9ccc65"/>
      <circle cx="${f(x + 8)}" cy="${by - 18}" r="11" fill="#8bc34a"/>
      <path d="M${f(x - 12)} ${by - 22} q12 -10 24 0" stroke="#c5e1a5" stroke-width="2" fill="none"/>`;
  }
  return s;
}

function carrots(x0, by, width, rng) {
  let s = '';
  for (let x = x0 + 8; x < x0 + width - 12; x += 13) {
    const h = between(rng, 40, 52);
    s += `<path d="M${f(x)} ${by - 4} l6 ${-h} l6 ${h} z" fill="#f08a24" transform="rotate(${f(between(rng, -6, 6))} ${f(x + 6)} ${by})"/>
      <path d="M${f(x + 6)} ${f(by - h - 4)} l-5 -10 M${f(x + 6)} ${f(by - h - 4)} l5 -11" stroke="#5ea33b" stroke-width="3" stroke-linecap="round"/>`;
  }
  return s;
}

function crate(x, by, w, label) {
  return `<rect x="${x}" y="${by - 26}" width="${w}" height="26" rx="2" fill="#c48a55"/>
    <rect x="${x}" y="${by - 26}" width="${w}" height="4" fill="#e0ad79"/>
    <rect x="${x}" y="${by - 14}" width="${w}" height="3" fill="#9b6a3f"/>
    <rect x="${x + w / 2 - 22}" y="${by - 23}" width="44" height="16" rx="2" fill="#fffdf6"/>
    <text x="${x + w / 2}" y="${by - 11.5}" font-family="Nunito, sans-serif" font-size="11" font-weight="800" fill="#d4553a" text-anchor="middle">${label}</text>`;
}

function produceUnit(x, y, w, h) {
  const rng = rngFrom(11);
  const rows = 4;
  const { s, boards } = shelfFrame(x, y, w, h, rows);
  let out = s;
  const third = (w - 40) / 3;
  const rowsContent = [
    [['apple'], ['orange'], ['lemon']],
    [['scallion'], ['lettuce'], ['tomato']],
    [['carrot'], ['onion'], ['lime']],
    [['potato'], ['apple'], ['orange']],
  ];
  const prices = ['$0.99', '$1.29', '$2.49', '$1.79', '$0.89', '$3.19'];
  boards.forEach((by, ri) => {
    rowsContent[ri].forEach(([kind], ci) => {
      const x0 = x + 14 + ci * (third + 6);
      const top = by - 26;
      let inner = '';
      if (kind === 'apple') inner = fruitPile(x0, top, third, 11, '#d64545', '#ffb3a7', rng, true);
      else if (kind === 'orange') inner = fruitPile(x0, top, third, 11, '#f39c34', '#ffd59a', rng);
      else if (kind === 'lemon') inner = fruitPile(x0, top, third, 10, '#f4d35e', '#fff3b0', rng);
      else if (kind === 'lime') inner = fruitPile(x0, top, third, 9, '#7cb342', '#d4f0a0', rng);
      else if (kind === 'tomato') inner = fruitPile(x0, top, third, 11, '#e8483b', '#ffb3a7', rng, true);
      else if (kind === 'onion') inner = fruitPile(x0, top, third, 11, '#c9955c', '#f0d2aa', rng);
      else if (kind === 'potato') inner = fruitPile(x0, top, third, 12, '#b98b5e', '#e3c39d', rng);
      else if (kind === 'scallion') inner = scallions(x0, top, third, rng);
      else if (kind === 'lettuce') inner = lettuce(x0, top, third, rng);
      else if (kind === 'carrot') inner = carrots(x0, top, third, rng);
      out += inner + crate(x0, by, third, pick(rng, prices));
    });
  });
  return out + boardsSvg(x, w, boards, rng);
}

function carton(x, by, w, h, band) {
  return `<g>
    <path d="M${x} ${by} v${-h} l${w / 2} ${-w * 0.35} l${w / 2} ${w * 0.35} v${h} z" fill="#fbfbf7"/>
    <path d="M${x + w / 2} ${f(by - h - w * 0.35)} v${-5}" stroke="#e6e6de" stroke-width="4"/>
    <rect x="${x}" y="${f(by - h * 0.62)}" width="${w}" height="${f(h * 0.3)}" fill="${band}"/>
    <rect x="${x + w * 0.7}" y="${f(by - h)}" width="${f(w * 0.3)}" height="${h}" fill="#000" opacity=".08"/>
  </g>`;
}

function coolerUnit(x, y, w, h) {
  const rng = rngFrom(77);
  const rows = 4;
  const ix = x + 16, iy = y + 26, iw = w - 32, ih = h - 60;
  const rowH = ih / rows;
  let s = `<rect x="${x + 8}" y="${y + 12}" width="${w}" height="${h}" rx="12" fill="#1b2630" opacity=".22" filter="url(#soft)"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="#3c4a57"/>
    <rect x="${x}" y="${y}" width="${w}" height="20" rx="10" fill="#4e5f6e"/>
    <rect x="${ix}" y="${iy}" width="${iw}" height="${ih}" rx="4" fill="url(#coolerIn)"/>
    <rect x="${ix}" y="${iy}" width="${iw}" height="14" fill="#ffffff" opacity=".7"/>`;
  for (let r = 0; r < rows; r++) {
    const by = iy + (r + 1) * rowH - 6;
    let cx = ix + 8;
    while (cx < ix + iw - 30) {
      const choice = rng();
      if (choice < 0.5) {
        const cw = between(rng, 24, 30);
        const band = pick(rng, ['#3d7cc9', '#d64545', '#4caf50', '#f3a712', '#7e57c2']);
        const n = 1 + Math.floor(rng() * 3);
        for (let k = 0; k < n && cx + cw < ix + iw - 6; k++) { s += carton(f(cx), f(by), f(cw), f(rowH * 0.52), band); cx += cw + 3; }
      } else if (choice < 0.8) {
        const col = pick(rng, ['#f8bbd0', '#fff59d', '#b3e5fc', '#c8e6c9']);
        for (let k = 0; k < 3 && cx + 18 < ix + iw - 6; k++) {
          s += `<path d="M${f(cx)} ${f(by - 26)} h18 l-3 26 h-12 z" fill="#fffdf8"/><rect x="${f(cx - 1)}" y="${f(by - 29)}" width="20" height="5" rx="2" fill="${col}"/>`;
          cx += 21;
        }
      } else {
        s += `<path d="M${f(cx)} ${f(by)} l44 0 l0 -20 z" fill="#f6c945"/><circle cx="${f(cx + 32)}" cy="${f(by - 6)}" r="3" fill="#e0a92a"/>`;
        cx += 48;
      }
      cx += between(rng, 2, 8);
    }
    s += `<rect x="${ix}" y="${f(by)}" width="${iw}" height="6" fill="#9fb3c2"/><rect x="${ix}" y="${f(by)}" width="${iw}" height="1.5" fill="#fff" opacity=".8"/>`;
  }
  // glass doors
  const doors = 3, dw = iw / doors;
  for (let d = 0; d < doors; d++) {
    const dx = ix + d * dw;
    s += `<rect x="${f(dx)}" y="${iy}" width="${f(dw)}" height="${ih}" fill="#dff3ff" opacity=".1"/>
      <polygon points="${f(dx + dw * 0.15)},${iy} ${f(dx + dw * 0.42)},${iy} ${f(dx + dw * 0.05)},${iy + ih} ${f(dx - dw * 0.0)},${iy + ih * 0.8}" fill="#fff" opacity=".16"/>
      <polygon points="${f(dx + dw * 0.55)},${iy} ${f(dx + dw * 0.63)},${iy} ${f(dx + dw * 0.3)},${iy + ih} ${f(dx + dw * 0.22)},${iy + ih}" fill="#fff" opacity=".1"/>
      <rect x="${f(dx + dw - 14)}" y="${iy + ih * 0.35}" width="6" height="${f(ih * 0.3)}" rx="3" fill="#c9d4dd"/>`;
    if (d > 0) s += `<rect x="${f(dx - 3)}" y="${iy}" width="6" height="${ih}" fill="#5c6b78"/>`;
  }
  s += `<rect x="${ix}" y="${iy}" width="${iw}" height="${ih}" rx="4" fill="none" stroke="#5c6b78" stroke-width="5"/>
    <rect x="${x + 10}" y="${y + h - 28}" width="${w - 20}" height="20" rx="3" fill="#2c3741"/>`;
  for (let gx = x + 20; gx < x + w - 20; gx += 10) s += `<rect x="${gx}" y="${y + h - 24}" width="4" height="12" rx="2" fill="#46545f"/>`;
  return s;
}

function aisleSign(cx, y, num, name) {
  const w = 200, h = 46;
  return `<g>
    <line x1="${cx - 70}" y1="0" x2="${cx - 70}" y2="${y}" stroke="#6b5444" stroke-width="2.5"/>
    <line x1="${cx + 70}" y1="0" x2="${cx + 70}" y2="${y}" stroke="#6b5444" stroke-width="2.5"/>
    <rect x="${cx - w / 2 + 3}" y="${y + 5}" width="${w}" height="${h}" rx="12" fill="#2c3a2c" opacity=".25"/>
    <rect x="${cx - w / 2}" y="${y}" width="${w}" height="${h}" rx="12" fill="url(#signGreen)" stroke="#2c5c39" stroke-width="3"/>
    <rect x="${cx - w / 2 + 6}" y="${y + 4}" width="${w - 12}" height="6" rx="3" fill="#fff" opacity=".18"/>
    <circle cx="${cx - w / 2 + 26}" cy="${y + h / 2}" r="16" fill="#fffaf0"/>
    <text x="${cx - w / 2 + 26}" y="${y + h / 2 + 7}" font-family="Nunito, sans-serif" font-size="21" font-weight="900" fill="#2c5c39" text-anchor="middle">${num}</text>
    <text x="${cx + 16}" y="${y + h / 2 + 8}" font-family="Nunito, sans-serif" font-size="22" font-weight="800" fill="#fffaf0" text-anchor="middle" letter-spacing="1">${name}</text>
  </g>`;
}

function pendantLamp(cx) {
  return `<g>
    <ellipse cx="${cx}" cy="150" rx="210" ry="130" fill="url(#lampGlow)"/>
    <line x1="${cx}" y1="0" x2="${cx}" y2="44" stroke="#4a3a30" stroke-width="3"/>
    <path d="M${cx - 34} 78 L${cx - 16} 44 L${cx + 16} 44 L${cx + 34} 78 Z" fill="#2f6b43"/>
    <path d="M${cx - 16} 44 L${cx + 16} 44 L${cx + 20} 52 L${cx - 20} 52 Z" fill="#245534"/>
    <ellipse cx="${cx}" cy="80" rx="18" ry="8" fill="#fff6d6"/>
    <ellipse cx="${cx}" cy="80" rx="36" ry="5" fill="#ffe7a8" opacity=".6"/>
  </g>`;
}

// ---------- background ----------
export function renderBackground() {
  const rng = rngFrom(5);
  let bokeh = '';
  for (let i = 0; i < 18; i++) {
    bokeh += `<circle cx="${f(between(rng, 0, 1600))}" cy="${f(between(rng, 90, 520))}" r="${f(between(rng, 6, 22))}" fill="#fff6dc" opacity="${f(between(rng, 0.05, 0.16) * 100) / 100}"/>`;
  }
  // floor tiles in perspective
  let tiles = '';
  for (let i = -10; i <= 26; i++) {
    const xb = i * 100;
    tiles += `<line x1="${f(800 + (xb - 800) * 0.35)}" y1="640" x2="${xb}" y2="900" stroke="#a87e58" stroke-width="1.5" opacity=".35"/>`;
  }
  [668, 704, 752, 816].forEach((y) => { tiles += `<line x1="0" y1="${y}" x2="1600" y2="${y}" stroke="#a87e58" stroke-width="1.5" opacity=".35"/>`; });

  return `<svg ${VB} class="scene-svg" aria-hidden="true">
  <defs>
    <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbe8cf"/><stop offset="1" stop-color="#f0cfa9"/></linearGradient>
    <linearGradient id="ceil" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9b48e"/><stop offset="1" stop-color="#ecd0ae"/></linearGradient>
    <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d8b48a"/><stop offset="1" stop-color="#b48760"/></linearGradient>
    <linearGradient id="woodDark" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7a4e32"/><stop offset=".5" stop-color="#8f5f3e"/><stop offset="1" stop-color="#6e452c"/></linearGradient>
    <linearGradient id="woodLight" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c58b5c"/><stop offset="1" stop-color="#9b6640"/></linearGradient>
    <linearGradient id="shelfBack" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e2c8a6"/><stop offset="1" stop-color="#f3e2c9"/></linearGradient>
    <linearGradient id="coolerIn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f1faff"/><stop offset="1" stop-color="#c4def0"/></linearGradient>
    <linearGradient id="signGreen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4f9161"/><stop offset="1" stop-color="#376b45"/></linearGradient>
    <linearGradient id="banner" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9a6543"/><stop offset="1" stop-color="#744629"/></linearGradient>
    <radialGradient id="lampGlow"><stop offset="0" stop-color="#fff3c8" stop-opacity=".85"/><stop offset=".5" stop-color="#ffe7b0" stop-opacity=".25"/><stop offset="1" stop-color="#ffe7b0" stop-opacity="0"/></radialGradient>
    <radialGradient id="warmLight" cx=".45" cy=".25" r=".8"><stop offset="0" stop-color="#fff4d8" stop-opacity=".55"/><stop offset=".6" stop-color="#ffd9a0" stop-opacity=".08"/><stop offset="1" stop-color="#6b3b1f" stop-opacity=".22"/></radialGradient>
    <linearGradient id="beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff8e0" stop-opacity=".35"/><stop offset="1" stop-color="#fff8e0" stop-opacity="0"/></linearGradient>
    <filter id="soft" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="6"/></filter>
  </defs>
  <rect width="1600" height="900" fill="url(#wall)"/>
  <rect y="600" width="1600" height="40" fill="#e5c29b"/>
  <rect y="640" width="1600" height="260" fill="url(#floor)"/>
  ${tiles}
  <rect y="636" width="1600" height="8" fill="#8f5f3e"/>
  <rect width="1600" height="84" fill="url(#ceil)"/>
  <rect y="84" width="1600" height="6" fill="#c79f78"/>
  ${[800, 1240, 1480].map((x) => `<rect x="${x - 40}" y="22" width="80" height="12" rx="6" fill="#fffbe8" opacity=".9"/><rect x="${x - 60}" y="34" width="120" height="30" fill="url(#beam)"/>`).join('')}

  ${produceUnit(28, 214, 384, 420)}
  ${stockedShelf(430, 214, 384, 420, 4, 23, ['box', 'box', 'jar', 'bottle'])}
  ${stockedShelf(832, 214, 384, 420, 4, 42, ['box', 'bottle', 'bottle', 'can'])}
  ${coolerUnit(1236, 200, 340, 440)}

  ${pendantLamp(640)}${pendantLamp(1030)}${pendantLamp(1400)}

  ${aisleSign(220, 150, 1, 'Produce')}
  ${aisleSign(622, 150, 2, 'Pantry')}
  ${aisleSign(1024, 150, 4, 'Household')}
  ${aisleSign(1406, 140, 5, 'Dairy')}

  <g transform="translate(34 8) scale(.9)">${bannerInner()}</g>
  ${bokeh}
  <rect width="1600" height="900" fill="url(#warmLight)"/>
</svg>`;
}

// ---------- counter / foreground ----------
export function renderCounter() {
  let seams = '';
  for (let x = 450; x < 1260; x += 110) seams += `<rect x="${x}" y="640" width="3" height="260" fill="#244c30" opacity=".5"/>`;
  return `<svg ${VB} class="scene-svg" aria-hidden="true">
  <defs>
    <linearGradient id="ctrTop" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e2b07e"/><stop offset="1" stop-color="#b9824f"/></linearGradient>
    <linearGradient id="ctrFront" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a8a5a"/><stop offset="1" stop-color="#2c5c39"/></linearGradient>
    <linearGradient id="screenG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7ee0cf"/><stop offset="1" stop-color="#2fa597"/></linearGradient>
    <linearGradient id="basket" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e2574a"/><stop offset="1" stop-color="#b63a30"/></linearGradient>
    <filter id="ctrShadow" x="-10%" y="-30%" width="120%" height="160%"><feDropShadow dx="0" dy="-6" stdDeviation="10" flood-color="#3b2214" flood-opacity=".35"/></filter>
  </defs>
  <g filter="url(#ctrShadow)">
    <polygon points="380,604 1270,604 1306,640 344,640" fill="url(#ctrTop)"/>
    <rect x="344" y="640" width="962" height="260" fill="url(#ctrFront)"/>
  </g>
  <rect x="380" y="604" width="890" height="4" fill="#f4cfa0"/>
  <rect x="344" y="640" width="962" height="10" fill="#244c30" opacity=".6"/>
  ${seams}
  <circle cx="825" cy="770" r="56" fill="#fffaf0" opacity=".92"/>
  ${mapleLeaf(825, 768, 40, '#d4553a')}
  <!-- conveyor -->
  <polygon points="600,608 900,608 910,622 590,622" fill="#2f2a28"/>
  <!-- basket -->
  <g>
    <rect x="452" y="520" width="16" height="70" rx="6" fill="#e0b98a" transform="rotate(-18 460 560)"/>
    <ellipse cx="505" cy="548" rx="16" ry="15" fill="#d64545"/><circle cx="499" cy="542" r="4.5" fill="#ffb3a7" opacity=".7"/>
    <path d="M505 534 q4 -8 10 -6" stroke="#4f7d32" stroke-width="3" fill="none"/>
    <path d="M430 556 h140 l-12 52 h-116 z" fill="url(#basket)"/>
    <path d="M440 568 h120 M444 582 h112 M448 596 h104" stroke="#8f2a22" stroke-width="2.5" opacity=".55"/>
    <path d="M455 556 q45 -50 90 0" stroke="#8f2a22" stroke-width="6" fill="none" stroke-linecap="round"/>
  </g>
  <!-- card reader -->
  <g>
    <rect x="955" y="566" width="40" height="40" rx="6" fill="#3a3a3f"/>
    <rect x="961" y="572" width="28" height="12" rx="2" fill="url(#screenG)"/>
    <circle cx="968" cy="592" r="2.5" fill="#888"/><circle cx="975" cy="592" r="2.5" fill="#888"/><circle cx="982" cy="592" r="2.5" fill="#888"/>
  </g>
  <!-- register -->
  <g>
    <rect x="1040" y="560" width="170" height="46" rx="8" fill="#5a5f66"/>
    <rect x="1040" y="560" width="170" height="8" rx="4" fill="#767c84"/>
    <rect x="1118" y="510" width="12" height="52" fill="#4a4f56"/>
    <rect x="1062" y="452" width="124" height="66" rx="8" fill="#3a3e44"/>
    <rect x="1070" y="460" width="108" height="50" rx="4" fill="url(#screenG)"/>
    <text x="1124" y="484" font-family="Nunito, sans-serif" font-size="13" font-weight="900" fill="#0f3d38" text-anchor="middle">MAPLE</text>
    <text x="1124" y="502" font-family="Nunito, sans-serif" font-size="11" font-weight="800" fill="#0f3d38" text-anchor="middle">Thank you!</text>
    <rect x="1072" y="462" width="104" height="10" rx="3" fill="#fff" opacity=".18"/>
  </g>
</svg>`;
}

/** Store name banner hanging from the ceiling (part of background layer, separate for reuse). */
export function renderBanner() {
  return `<svg viewBox="0 0 520 90" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${bannerInner()}</svg>`;
}
function bannerInner() {
  return `<defs><linearGradient id="bnr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9a6543"/><stop offset="1" stop-color="#6f4327"/></linearGradient></defs>
    <rect x="6" y="10" width="508" height="74" rx="14" fill="#3b2214" opacity=".25"/>
    <rect x="0" y="4" width="508" height="74" rx="14" fill="url(#bnr)" stroke="#5a3520" stroke-width="3"/>
    <rect x="10" y="12" width="488" height="58" rx="9" fill="none" stroke="#e8b04b" stroke-width="2" stroke-dasharray="2 6" stroke-linecap="round"/>
    ${mapleLeaf(52, 42, 24, '#e8553a')}
    <text x="276" y="53" font-family="Nunito, sans-serif" font-size="34" font-weight="900" fill="#fff3dc" text-anchor="middle" letter-spacing="1">Maple Corner Market</text>`;
}

// ---------- Maya ----------
const SKIN = '#fde2cc', SKIN_SH = '#f2c4a6', HAIR = '#a8482a', HAIR_D = '#6e2c18', LINE = '#3a1d10';

function eyeOpen(cx, cy, opt = {}) {
  const { dx = 0, dy = 0, ry = 20, irisR = 1, lid = 0, id } = opt;
  const irx = 12 * irisR, iry = 16 * irisR;
  return `<g>
    <clipPath id="${id}"><ellipse cx="${cx}" cy="${cy}" rx="17" ry="${ry}"/></clipPath>
    <ellipse cx="${cx}" cy="${cy}" rx="17" ry="${ry}" fill="#fffdfb"/>
    <g clip-path="url(#${id})">
      <ellipse cx="${cx + dx}" cy="${cy + 3 + dy}" rx="${irx}" ry="${iry}" fill="url(#iris)"/>
      <ellipse cx="${cx + dx}" cy="${cy + 4 + dy}" rx="${f(5 * irisR)}" ry="${f(7 * irisR)}" fill="#2b1608"/>
      <circle cx="${cx + dx - 4}" cy="${cy - 5 + dy}" r="4.2" fill="#fff"/>
      <circle cx="${cx + dx + 5}" cy="${cy + 9 + dy}" r="2" fill="#fff" opacity=".9"/>
      <rect x="${cx - 18}" y="${cy - ry - 2}" width="36" height="${8 + lid}" fill="${SKIN}"/>
      <ellipse cx="${cx}" cy="${cy - ry + 2}" rx="17" ry="5" fill="#000" opacity=".08"/>
    </g>
    <path d="M${cx - 20} ${cy - ry + 9 + lid} Q${cx} ${cy - ry - 6 + lid} ${cx + 20} ${cy - ry + 8 + lid}" stroke="${LINE}" stroke-width="4.5" fill="none" stroke-linecap="round"/>
    <path d="M${cx + (cx < 0 ? -19 : 19)} ${cy - ry + 9 + lid} l${cx < 0 ? -6 : 6} -4" stroke="${LINE}" stroke-width="3" stroke-linecap="round"/>
    <path d="M${cx - 10} ${cy + ry - 1} Q${cx} ${cy + ry + 2} ${cx + 10} ${cy + ry - 1}" stroke="${LINE}" stroke-width="1.6" fill="none" opacity=".5"/>
  </g>`;
}

function eyeClosedHappy(cx, cy) {
  return `<path d="M${cx - 17} ${cy + 5} Q${cx} ${cy - 14} ${cx + 17} ${cy + 5}" stroke="${LINE}" stroke-width="4.8" fill="none" stroke-linecap="round"/>
    <path d="M${cx + (cx < 0 ? -16 : 16)} ${cy + 4} l${cx < 0 ? -5 : 5} -2" stroke="${LINE}" stroke-width="3" stroke-linecap="round"/>`;
}

function brow(d) { return `<path d="${d}" stroke="${HAIR_D}" stroke-width="4.5" fill="none" stroke-linecap="round"/>`; }

const MOUTH_FILL = '#a8413e';
const TONGUE = '#f08a8a';

function face(emotion) {
  const L = -34, R = 34, EY = 268;
  let eyes = '', brows = '', mClosed = '', mOpen = '', blush = 0.35, fx = '', blink = true;

  switch (emotion) {
    case 'happy':
      eyes = eyeClosedHappy(L, EY) + eyeClosedHappy(R, EY);
      blink = false;
      brows = brow(`M${L - 16} ${EY - 36} Q${L} ${EY - 44} ${L + 15} ${EY - 37}`) + brow(`M${R - 15} ${EY - 37} Q${R} ${EY - 44} ${R + 16} ${EY - 36}`);
      mClosed = `<path d="M-17 311 Q0 329 17 311" stroke="${MOUTH_FILL}" stroke-width="3.2" fill="none" stroke-linecap="round"/>`;
      mOpen = `<path d="M-17 310 Q0 338 17 310 Z" fill="${MOUTH_FILL}"/><ellipse cx="0" cy="326" rx="8" ry="4" fill="${TONGUE}"/><path d="M-14 311 h28" stroke="#fff" stroke-width="2.5" opacity=".9"/>`;
      blush = 0.6;
      fx = sparkle(-118, 175, 12) + sparkle(122, 205, 9) + sparkle(105, 150, 6);
      break;
    case 'thinking':
      eyes = eyeOpen(L, EY, { dx: 4, dy: -7, lid: 3, id: 'eyeL' }) + eyeOpen(R, EY, { dx: 4, dy: -7, lid: 3, id: 'eyeR' });
      brows = brow(`M${L - 16} ${EY - 33} Q${L} ${EY - 38} ${L + 15} ${EY - 33}`) + brow(`M${R - 15} ${EY - 40} Q${R} ${EY - 46} ${R + 16} ${EY - 40}`);
      mClosed = `<path d="M-8 321 Q2 317 11 320" stroke="${MOUTH_FILL}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
      mOpen = `<ellipse cx="2" cy="320" rx="6" ry="5" fill="${MOUTH_FILL}"/>`;
      fx = `<g class="fx-dots"><circle cx="102" cy="196" r="6" fill="#fffaf0" stroke="#c9a37c" stroke-width="2"/><circle cx="122" cy="172" r="9" fill="#fffaf0" stroke="#c9a37c" stroke-width="2"/><circle cx="148" cy="142" r="13" fill="#fffaf0" stroke="#c9a37c" stroke-width="2"/></g>`;
      break;
    case 'sorry':
      eyes = eyeOpen(L, EY, { dy: 3, lid: 5, ry: 18, id: 'eyeL' }) + eyeOpen(R, EY, { dy: 3, lid: 5, ry: 18, id: 'eyeR' });
      brows = brow(`M${L - 16} ${EY - 28} Q${L} ${EY - 33} ${L + 15} ${EY - 42}`) + brow(`M${R - 15} ${EY - 42} Q${R} ${EY - 33} ${R + 16} ${EY - 28}`);
      mClosed = `<path d="M-12 321 Q-6 316 0 320 Q6 324 12 318" stroke="${MOUTH_FILL}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
      mOpen = `<path d="M-11 317 Q0 313 11 317 Q8 329 0 329 Q-8 329 -11 317 Z" fill="${MOUTH_FILL}"/>`;
      blush = 0.3;
      fx = `<g class="fx-drip"><path d="M96 200 q-12 20 0 26 q12 -6 0 -26 z" fill="#9fd4f5" stroke="#5aa6d6" stroke-width="2"/><circle cx="93" cy="217" r="2.5" fill="#fff"/></g>`;
      break;
    case 'confused':
      eyes = eyeOpen(L, EY, { dx: -3, id: 'eyeL' }) + eyeOpen(R, EY, { dx: -3, ry: 18, lid: 3, id: 'eyeR' });
      brows = brow(`M${L - 16} ${EY - 42} Q${L} ${EY - 50} ${L + 15} ${EY - 42}`) + brow(`M${R - 15} ${EY - 31} Q${R} ${EY - 34} ${R + 16} ${EY - 36}`);
      mClosed = `<path d="M-10 322 Q0 315 10 321" stroke="${MOUTH_FILL}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
      mOpen = `<ellipse cx="0" cy="321" rx="6" ry="6" fill="${MOUTH_FILL}"/>`;
      fx = `<g class="fx-float"><text x="112" y="176" font-family="Nunito, sans-serif" font-size="60" font-weight="900" fill="#e07a3c" stroke="#fffaf0" stroke-width="5" paint-order="stroke" transform="rotate(12 125 160)">?</text></g>`;
      break;
    case 'surprised':
      eyes = eyeOpen(L, EY, { ry: 22, irisR: 0.72, id: 'eyeL' }) + eyeOpen(R, EY, { ry: 22, irisR: 0.72, id: 'eyeR' });
      brows = brow(`M${L - 16} ${EY - 44} Q${L} ${EY - 54} ${L + 15} ${EY - 45}`) + brow(`M${R - 15} ${EY - 45} Q${R} ${EY - 54} ${R + 16} ${EY - 44}`);
      mClosed = `<ellipse cx="0" cy="322" rx="6" ry="7" fill="${MOUTH_FILL}"/>`;
      mOpen = `<ellipse cx="0" cy="323" rx="9" ry="12" fill="${MOUTH_FILL}"/><ellipse cx="0" cy="330" rx="5" ry="3" fill="${TONGUE}"/>`;
      fx = `<g class="fx-pop" stroke="#e07a3c" stroke-width="5" stroke-linecap="round"><path d="M100 170 l18 -16"/><path d="M112 196 l24 -4"/><path d="M90 150 l6 -22"/><path d="M-100 170 l-18 -16"/><path d="M-90 150 l-6 -22"/></g>`;
      break;
    default: // neutral
      eyes = eyeOpen(L, EY, { id: 'eyeL' }) + eyeOpen(R, EY, { id: 'eyeR' });
      brows = brow(`M${L - 16} ${EY - 34} Q${L} ${EY - 41} ${L + 15} ${EY - 35}`) + brow(`M${R - 15} ${EY - 35} Q${R} ${EY - 41} ${R + 16} ${EY - 34}`);
      mClosed = `<path d="M-10 316 Q0 323 10 316" stroke="${MOUTH_FILL}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
      mOpen = `<path d="M-11 314 Q0 332 11 314 Q0 318 -11 314 Z" fill="${MOUTH_FILL}"/><ellipse cx="0" cy="324" rx="5" ry="2.5" fill="${TONGUE}"/>`;
  }

  const cheeks = `<ellipse cx="-52" cy="301" rx="14" ry="6.5" fill="#ff8a8a" opacity="${blush}"/>
    <ellipse cx="52" cy="301" rx="14" ry="6.5" fill="#ff8a8a" opacity="${blush}"/>
    ${emotion === 'happy' ? '<path d="M-60 300 l4 -5 M-52 301 l4 -5 M-44 302 l4 -5 M44 302 l4 -5 M52 301 l4 -5 M60 300 l4 -5" stroke="#e86a6a" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>' : ''}`;

  const nose = `<path d="M2 296 q3 3 -1 5" stroke="${SKIN_SH}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;

  return {
    eyes: `<g class="maya-eyes${blink ? ' blink' : ''}">${eyes}</g>`,
    brows, cheeks, nose, fx,
    mouth: `<g class="m-closed">${mClosed}</g><g class="m-open">${mOpen}</g>`,
  };
}

function sparkle(x, y, s) {
  return `<path class="fx-twinkle" d="M${x} ${y - s} Q${x + s * 0.18} ${y - s * 0.18} ${x + s} ${y} Q${x + s * 0.18} ${y + s * 0.18} ${x} ${y + s} Q${x - s * 0.18} ${y + s * 0.18} ${x - s} ${y} Q${x - s * 0.18} ${y - s * 0.18} ${x} ${y - s} Z" fill="#ffd36b"/>`;
}

function thinkingArm() {
  // forearm rising in front of torso to the chin (viewer's left)
  return `<g class="arm-think">
    <path d="M-168 640 C-150 560 -110 470 -62 372 L-28 388 C-70 470 -100 560 -112 640 Z" fill="#fbf4ea" stroke="#d9cbb8" stroke-width="2"/>
    <path d="M-150 600 C-130 530 -100 470 -70 410" stroke="#e5d8c6" stroke-width="3" fill="none"/>
    <path d="M-64 360 C-70 340 -54 330 -36 336 C-20 340 -14 352 -18 366 C-22 380 -40 388 -54 384 C-64 380 -66 370 -64 360 Z" fill="${SKIN}" stroke="${SKIN_SH}" stroke-width="2"/>
    <path d="M-40 340 q10 -2 16 6 M-44 352 q12 -2 20 6" stroke="${SKIN_SH}" stroke-width="2" fill="none" stroke-linecap="round"/>
  </g>`;
}

/**
 * Render Maya's SVG for the given emotion. If `target` (or #maya) exists, it is updated in place.
 * Returns the SVG markup.
 */
export function renderMaya(emotion = 'neutral', target) {
  if (!EMOTIONS.includes(emotion)) emotion = 'neutral';
  const fc = face(emotion);
  const svg = `<svg ${VB} class="scene-svg maya-svg" data-emotion="${emotion}" aria-label="Maya (${emotion})" role="img">
  <defs>
    <linearGradient id="hairG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c25a34"/><stop offset=".6" stop-color="${HAIR}"/><stop offset="1" stop-color="#7d321c"/></linearGradient>
    <linearGradient id="apronG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#53966a"/><stop offset="1" stop-color="#346644"/></linearGradient>
    <linearGradient id="shirtG" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#efe5d6"/><stop offset=".3" stop-color="#fdf8f0"/><stop offset=".75" stop-color="#fbf4ea"/><stop offset="1" stop-color="#e8dccb"/></linearGradient>
    <linearGradient id="iris" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a2a14"/><stop offset=".55" stop-color="#8a5228"/><stop offset="1" stop-color="#c98a46"/></linearGradient>
    <radialGradient id="faceG" cx=".5" cy=".42" r=".65"><stop offset="0" stop-color="#fff0e3"/><stop offset=".8" stop-color="${SKIN}"/><stop offset="1" stop-color="#f7cfb3"/></radialGradient>
    <filter id="mayaShadow" x="-20%" y="-10%" width="140%" height="130%"><feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#4a2a14" flood-opacity=".28"/></filter>
  </defs>
  <g transform="translate(770 0)">
   <g class="maya-breathe" filter="url(#mayaShadow)">
    <!-- back hair -->
    <path d="M-106 250 C-118 150 -60 112 0 112 C60 112 118 150 106 250 L112 350 C92 366 62 358 50 344 L-50 344 C-62 358 -92 366 -112 350 Z" fill="url(#hairG)"/>
    <!-- body -->
    <path d="M-24 318 L-24 388 Q0 400 24 388 L24 318 Z" fill="${SKIN_SH}"/>
    <path d="M-42 376 Q-112 384 -152 418 Q-178 444 -184 520 L-196 900 L196 900 L184 520 Q178 444 152 418 Q112 384 42 376 Q0 398 -42 376 Z" fill="url(#shirtG)" stroke="#d9cbb8" stroke-width="2"/>
    <path d="M-150 440 Q-176 540 -164 660 M150 440 Q176 540 164 660" stroke="#e0d2bf" stroke-width="3" fill="none"/>
    <!-- waist tie -->
    <rect x="-180" y="590" width="360" height="16" rx="4" fill="#2c5c39"/>
    <!-- apron straps -->
    <path d="M-72 442 L-38 384 L-24 389 L-58 446 Z M72 442 L38 384 L24 389 L58 446 Z" fill="#2f6340"/>
    <!-- collar -->
    <path d="M-42 376 L-6 420 L-30 434 L-58 388 Z M42 376 L6 420 L30 434 L58 388 Z" fill="#fffdf8" stroke="#d9cbb8" stroke-width="2" stroke-linejoin="round"/>
    <!-- apron bib -->
    <path d="M-72 440 L72 440 L82 520 Q96 560 124 600 L130 900 L-130 900 L-124 600 Q-96 560 -82 520 Z" fill="url(#apronG)"/>
    <path d="M-66 448 L66 448" stroke="#7fbf92" stroke-width="2" stroke-dasharray="5 5" opacity=".8"/>
    <rect x="-56" y="618" width="112" height="56" rx="8" fill="#2f6340" opacity=".55"/>
    <rect x="-52" y="622" width="104" height="48" rx="6" fill="none" stroke="#7fbf92" stroke-width="1.6" stroke-dasharray="4 4"/>
    <!-- name tag -->
    <g>
      <rect x="12" y="462" width="66" height="30" rx="6" fill="#fffaf0" stroke="#c9a66b" stroke-width="2"/>
      ${mapleLeaf(27, 477, 9, '#d4553a')}
      <text x="56" y="482" font-family="Nunito, sans-serif" font-size="13" font-weight="900" fill="#3b2a20" text-anchor="middle" letter-spacing=".5">MAYA</text>
    </g>
    <!-- head -->
    <g class="maya-head">
      <ellipse cx="-78" cy="268" rx="11" ry="17" fill="${SKIN_SH}"/>
      <ellipse cx="78" cy="268" rx="11" ry="17" fill="${SKIN_SH}"/>
      <path d="M-78 230 C-80 300 -40 346 0 352 C40 346 80 300 78 230 C78 172 40 150 0 150 C-40 150 -78 172 -78 230 Z" fill="url(#faceG)"/>
      <path d="M-70 232 C-40 238 40 238 70 232 L70 222 L-70 222 Z" fill="${SKIN_SH}" opacity=".35"/>
      ${fc.cheeks}
      ${fc.eyes}
      ${fc.brows}
      ${fc.nose}
      <g class="maya-mouth">${fc.mouth}</g>
      <!-- bangs -->
      <path d="M-90 252 C-98 160 -42 116 4 118 C62 118 100 160 92 258 C82 228 72 208 56 196 C52 216 42 224 28 228 C31 212 26 198 18 188 C4 210 -16 222 -42 230 C-32 216 -30 204 -32 194 C-52 210 -72 228 -90 252 Z" fill="url(#hairG)"/>
      <path d="M-90 240 C-98 292 -90 332 -70 356 C-80 322 -78 286 -72 252 Z M90 240 C98 292 90 332 70 356 C80 322 78 286 72 252 Z" fill="url(#hairG)"/>
      <path d="M-56 160 Q0 134 56 160" stroke="#e98a5c" stroke-width="7" fill="none" stroke-linecap="round" opacity=".55"/>
      <path d="M-40 150 Q-30 143 -18 140" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" opacity=".35"/>
      <!-- hair clip -->
      ${mapleLeaf(66, 188, 13, '#f2b33d', 'stroke="#c9862a" stroke-width="1.5"')}
    </g>
    ${emotion === 'thinking' ? thinkingArm() : ''}
   </g>
   <g class="maya-fx">${fc.fx}</g>
  </g>
</svg>`;
  const el = target || (typeof document !== 'undefined' ? document.getElementById('maya') : null);
  if (el) el.innerHTML = svg;
  return svg;
}
