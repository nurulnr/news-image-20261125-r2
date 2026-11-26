// news-image-20261125 round 2 — "The World in One Day", Wednesday 25 November 2026.
// A newspaper front page drawn from scratch in code: 52 date-checked stories
// (1 lead + 20 grid + 10-item UTC timeline + 21 briefs) plus a markets strip.
// Node 22, standard library only, no network at runtime. The program draws the
// image pixel by pixel into a buffer, encodes it as a PNG, and writes it to
// /output/entry.png (or $MAKEFUN_OUTPUT_DIR). Fully deterministic: same bytes
// on every run.
//
// Run it:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

// ---------------------------------------------------------------------------
// 5x7 bitmap font, drawn from a hand-made table (uppercase + digits + marks).
// Each glyph is 7 rows of 5 bits, '1' = ink. Lowercase input is uppercased.
// ---------------------------------------------------------------------------
const GLYPHS: Record<string, string[]> = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '10101', '01010'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00110', '01000', '10000', '11111'],
  '3': ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  ',': ['00000', '00000', '00000', '00000', '01100', '00100', '01000'],
  ':': ['00000', '01100', '01100', '00000', '01100', '01100', '00000'],
  ';': ['00000', '01100', '01100', '00000', '01100', '00100', '01000'],
  '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
  '?': ['01110', '10001', '00001', '00110', '00100', '00000', '00100'],
  "'": ['00100', '00100', '01000', '00000', '00000', '00000', '00000'],
  '"': ['01010', '01010', '01010', '00000', '00000', '00000', '00000'],
  '-': ['00000', '00000', '00000', '01110', '00000', '00000', '00000'],
  '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
  '%': ['11001', '11010', '00010', '00100', '01000', '01011', '10011'],
  '(': ['00010', '00100', '01000', '01000', '01000', '00100', '00010'],
  ')': ['01000', '00100', '00010', '00010', '00010', '00100', '01000'],
  '&': ['01100', '10010', '10100', '01000', '10101', '10010', '01101'],
  '+': ['00000', '00100', '00100', '01110', '00100', '00100', '00000'],
  '=': ['00000', '00000', '01110', '00000', '01110', '00000', '00000'],
  '*': ['00000', '00100', '10101', '01110', '10101', '00100', '00000'],
  '>': ['10000', '01000', '00100', '00010', '00100', '01000', '10000'],
  _: ['00000', '00000', '00000', '00000', '00000', '00000', '11111'],
};

const CHAR_W = 5;
const CHAR_H = 7;

// ---------------------------------------------------------------------------
// CRC-32 (IEEE) for PNG chunks.
// ---------------------------------------------------------------------------
const CRC_TABLE: number[] = (() => {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table.push(c >>> 0);
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(w: number, h: number, rgb: Buffer): Buffer {
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 3)] = 0; // filter: none
    rgb.copy(raw, y * (1 + w * 3) + 1, y * w * 3, (y + 1) * w * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// A tiny RGB canvas: pixel buffer plus rects, circles, lines and bitmap text.
// ---------------------------------------------------------------------------
type RGB = [number, number, number];

class Canvas {
  readonly w: number;
  readonly h: number;
  private buf: Buffer;

  constructor(w: number, h: number, bg: RGB) {
    this.w = w;
    this.h = h;
    this.buf = Buffer.alloc(w * h * 3);
    this.fillRect(0, 0, w, h, bg);
  }

  set(x: number, y: number, c: RGB): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 3;
    this.buf[i] = c[0];
    this.buf[i + 1] = c[1];
    this.buf[i + 2] = c[2];
  }

  fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
    for (let j = y; j < y + h; j++) {
      for (let i = x; i < x + w; i++) this.set(i, j, c);
    }
  }

  frame(x: number, y: number, w: number, h: number, c: RGB, t = 1): void {
    this.fillRect(x, y, w, t, c);
    this.fillRect(x, y + h - t, w, t, c);
    this.fillRect(x, y, t, h, c);
    this.fillRect(x + w - t, y, t, h, c);
  }

  line(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    let x = x0;
    let y = y0;
    for (;;) {
      this.set(x, y, c);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x += sx; }
      if (e2 <= dx) { err += dx; y += sy; }
    }
  }

  disc(cx: number, cy: number, r: number, c: RGB): void {
    for (let y = -r; y <= r; y++) {
      const span = Math.floor(Math.sqrt(r * r - y * y));
      for (let x = -span; x <= span; x++) this.set(cx + x, cy + y, c);
    }
  }

  ring(cx: number, cy: number, r: number, c: RGB, t = 2): void {
    for (let a = 0; a < 360; a++) {
      const rad = (a * Math.PI) / 180;
      for (let k = 0; k < t; k++) {
        this.set(Math.round(cx + (r - k) * Math.cos(rad)), Math.round(cy + (r - k) * Math.sin(rad)), c);
      }
    }
  }

  textWidth(s: string, scale: number): number {
    return s.length * (CHAR_W + 1) * scale - scale;
  }

  text(s: string, x: number, y: number, scale: number, c: RGB): void {
    const up = s.toUpperCase();
    for (let ci = 0; ci < up.length; ci++) {
      const g = GLYPHS[up[ci]] ?? GLYPHS[' '];
      const ox = x + ci * (CHAR_W + 1) * scale;
      for (let r = 0; r < CHAR_H; r++) {
        for (let col = 0; col < CHAR_W; col++) {
          if (g[r][col] === '1') {
            this.fillRect(ox + col * scale, y + r * scale, scale, scale, c);
          }
        }
      }
    }
  }

  // Greedy word wrap for one paragraph; returns the lines.
  wrap(s: string, scale: number, maxW: number): string[] {
    const words = s.split(' ');
    const lines: string[] = [];
    let cur = '';
    for (const w of words) {
      const next = cur ? cur + ' ' + w : w;
      if (this.textWidth(next, scale) <= maxW || !cur) cur = next;
      else { lines.push(cur); cur = w; }
    }
    if (cur) lines.push(cur);
    return lines;
  }

  toPng(): Buffer {
    return encodePng(this.w, this.h, this.buf);
  }
}

// ---------------------------------------------------------------------------
// Palette: newsprint on cream paper.
// ---------------------------------------------------------------------------
const PAPER: RGB = [246, 241, 227];
const INK: RGB = [26, 26, 26];
const NAVY: RGB = [16, 36, 62];
const NAVY2: RGB = [28, 58, 92];
const RED: RGB = [178, 34, 30];
const GOLD: RGB = [212, 175, 55];
const GREY: RGB = [96, 96, 90];
const CARD: RGB = [255, 255, 255];
const LINE: RGB = [200, 192, 172];
const TEAL: RGB = [14, 110, 110];
const PURPLE: RGB = [96, 54, 140];
const ORANGE: RGB = [196, 94, 10];
const GREEN: RGB = [34, 110, 54];
const BLUE: RGB = [32, 84, 160];

const W = 1024;
const H = 1024;

// ---------------------------------------------------------------------------
// The day's news — every item happened, or was first reported, on
// Wednesday 25 November 2026 (checked against Reuters, AP, BBC, Ofgem,
// USTR, BEA, CMSA and the wire services that day).
// ---------------------------------------------------------------------------
const LEAD_HEAD = ['US PROPOSES TARIFFS', 'ON 14 ECONOMIES'];
const LEAD_SUB =
  'China faces 20% — up to 40% if talks fail. EU, Japan and Korea 15%, Vietnam 35% without a deal. USTR acts after an 8-month probe; hearings 25 Jan.';

type GridItem = { tag: string; color: RGB; title: string; detail: string };
const GRID: GridItem[] = [
  { tag: 'ENERGY', color: ORANGE, title: 'UK ENERGY CAP UP 26% FROM JAN', detail: 'Typical bill 1,723 to 2,166 pounds' },
  { tag: 'MARKETS', color: RED, title: 'KOSPI CRASHES 6.2%', detail: 'Samsung -9.9%, SK Hynix -11.1%' },
  { tag: 'SPACE', color: PURPLE, title: "PAKISTAN'S FIRST ASTRONAUT", detail: 'First foreign visitor to Tiangong' },
  { tag: 'WAR', color: RED, title: 'UKRAINE HITS 2 ROSNEFT REFINERIES', detail: 'Syzran, Kuibyshev ablaze; 1 killed' },
  { tag: 'WAR', color: RED, title: "RUSSIA'S 112-DRONE NIGHT", detail: '7 killed; Kyiv says 88 drones downed' },
  { tag: 'WAR', color: RED, title: 'TANKERS HIT BY MINES IN HORMUZ', detail: 'Two tankers explode and burn' },
  { tag: 'WAR', color: RED, title: 'HOUTHIS HIT SAUDI REFINERY', detail: 'Ras Tanura hit; blast in Riyadh' },
  { tag: 'WAR', color: RED, title: 'US: LEAVE IRAN NOW', detail: 'Citizens told to quit Iran at once' },
  { tag: 'TECH', color: BLUE, title: 'NVIDIA SLIDES 8.3%', detail: 'Huang rally fades; chips hit low' },
  { tag: 'ECONOMY', color: TEAL, title: 'US INFLATION 3.8%', detail: 'Core 3.3%; Dec Fed hike priced in' },
  { tag: 'ECONOMY', color: TEAL, title: 'US GDP REVISED TO 4.3%', detail: 'Growth beats 3.4% first read' },
  { tag: 'TECH', color: BLUE, title: 'HUAWEI CONVICTED IN US', detail: 'Guilty on 10 of 12 counts in NY' },
  { tag: 'WAR', color: RED, title: 'ISRAEL KILLS HAMAS SECURITY CHIEF', detail: 'Abuelouf, wife, 2 children killed' },
  { tag: 'WAR', color: RED, title: 'SUDAN DRONE STRIKES KILL 19', detail: '19 killed in Damazin, rights group' },
  { tag: 'WAR', color: RED, title: 'LIBYA VOWS REVENGE', detail: '2 Libyan officers killed in port' },
  { tag: 'WAR', color: RED, title: 'UKRAINE LASER DOWNS DRONE', detail: 'Blysk laser downs jet drone' },
  { tag: 'WAR', color: RED, title: 'FIVE RUSSIAN JETS DAMAGED', detail: '3 MiG-31s, 2 Su-34s hit at base' },
  { tag: 'EUROPE', color: GREEN, title: 'EU PARLIAMENT LOOSENS NATURE LAWS', detail: 'MEPs vote 367-268 to review rules' },
  { tag: 'EUROPE', color: GREEN, title: 'MAGYAR MEETS ZELENSKYY', detail: 'Hungary, Ukraine seek reset' },
  { tag: 'EUROPE', color: GREEN, title: 'SPAIN VOTE LOOMS', detail: 'Sanchez warns before Sunday vote' },
];

const TIMELINE: [string, string][] = [
  ['00:18', 'Shenzhou-24 lifts off, Jiuquan'],
  ['02:12', 'Ukraine drones hit 2 refineries'],
  ['03:56', 'Shenzhou-24 docks at Tiangong'],
  ['06:16', 'Huawei verdict reported in NY'],
  ['07:14', 'Ofgem: energy cap up 26%'],
  ['13:30', 'US PCE 3.8%, GDP 4.3% out'],
  ['14:35', 'Shenzhou-24 crew boards Tiangong'],
  ['17:30', 'US proposes tariffs on 14'],
  ['21:00', 'Wall St closes lower; Nasdaq -4%'],
  ['22:52', 'Explosion heard in Riyadh'],
];

const BRIEF: string[] = [
  'TAIWAN: 1 JET, 9 SHIPS',
  'EU: CAGED FARM BAN RULING',
  'PUIGDEMONT RETURNS 12 DEC',
  'SARKOZY TRIAL SET FOR 2027',
  'FRANCE SEIZES 3.3T METH',
  'CZECHS BACK POLAND',
  'MBS TO ATTEND US G20',
  'IRAN: 2 US DRONES DOWNED',
  '55% IN US WANT WAR ENDED',
  'TRUMP: WAR FUNDED TO JAN',
  'ABREGO GARCIA TO SPAIN',
  'N KOREA EXPELS SWISS ENVOY',
  'CALIFORNIA TIDE FLOODS',
  'CAIRO TANKER FIRE KILLS 31',
  'SERBIA SCHOOL SHOOTING',
  'UCL: UTD DRAW, LFC WIN',
  'STEELERS CUT AARON RODGERS',
  'SINNER TO MISS OZ OPEN',
  "MACY'S 100TH PARADE",
  'COP31 ENDS WITH NO DEAL',
  'PAOLO BULGARI DIES AT 89',
];

const MARKETS =
  'KOSPI -6.2%   TAIEX -4.8%   NIKKEI -3%   NASDAQ -4%   S&P 500 -2.7%   NVIDIA -8.3%';
const MARKETS2 =
  'BRENT $91.40   SAMSUNG -9.9%   SK HYNIX -11.1%   SOFTBANK -14.8%   MICRON -11.3%';

// ---------------------------------------------------------------------------
// Layout: masthead, lead + art, markets strip, 20-card grid, UTC timeline,
// 21 briefs, footer. 1 + 20 + 10 + 21 = 52 stories.
// ---------------------------------------------------------------------------
function draw(): Canvas {
  const c = new Canvas(W, H, PAPER);

  // ---- Masthead ------------------------------------------------------------
  c.fillRect(0, 0, W, 86, NAVY);
  c.fillRect(0, 86, W, 4, GOLD);
  c.disc(52, 43, 24, GOLD);
  c.ring(52, 43, 24, PAPER, 2);
  c.line(28, 43, 76, 43, PAPER);
  c.line(52, 19, 52, 67, PAPER);
  c.text('THE WORLD IN ONE DAY', 92, 14, 4, PAPER);
  c.text('WEDNESDAY 25 NOVEMBER 2026  -  52 STORIES, ONE DAY', 92, 52, 2, GOLD);

  // ---- Lead story ----------------------------------------------------------
  c.text('TRADE WAR', 16, 102, 2, RED);
  c.fillRect(16, 122, 120, 3, RED);
  c.text(LEAD_HEAD[0], 16, 132, 4, INK);
  c.text(LEAD_HEAD[1], 16, 166, 4, INK);
  const sub = c.wrap(LEAD_SUB, 2, 620);
  sub.forEach((ln, i) => c.text(ln, 16, 204 + i * 18, 2, GREY));

  // Lead art: a globe with tariff badges.
  const gx = 830;
  const gy = 158;
  c.disc(gx, gy, 52, NAVY2);
  c.ring(gx, gy, 52, NAVY, 3);
  c.line(gx - 52, gy, gx + 52, gy, PAPER);
  c.line(gx, gy - 52, gx, gy + 52, PAPER);
  c.line(gx - 37, gy - 37, gx + 37, gy + 37, PAPER);
  c.line(gx - 37, gy + 37, gx + 37, gy - 37, PAPER);
  c.disc(gx - 66, gy - 32, 24, RED);
  c.text('20%', gx - 66 - 18, gy - 32 - 7, 2, PAPER);
  c.disc(gx + 66, gy - 34, 24, RED);
  c.text('15%', gx + 66 - 18, gy - 34 - 7, 2, PAPER);
  c.disc(gx, gy + 58, 22, RED);
  c.text('35%', gx - 18, gy + 58 - 7, 2, PAPER);
  c.text('CHINA', gx - 66 - 18, gy - 32 + 28, 1, INK);
  c.text('EU', gx + 66 - 6, gy - 34 + 28, 1, INK);
  c.text('VIETNAM', gx - 24, gy + 58 + 26, 1, INK);

  // ---- Markets strip ---------------------------------------------------------
  c.fillRect(0, 258, W, 44, RED);
  c.text(MARKETS, 16, 264, 2, PAPER);
  c.text(MARKETS2, 16, 282, 2, PAPER);

  // ---- Grid: 20 stories ------------------------------------------------------
  c.text('THE DAY IN STORIES', 16, 312, 2, NAVY);
  c.fillRect(16, 332, W - 32, 2, NAVY);
  const colX = [16, 516];
  const cardW = 492;
  GRID.forEach((g, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = colX[col];
    const y = 340 + row * 34;
    c.fillRect(x, y, cardW, 32, CARD);
    c.frame(x, y, cardW, 32, LINE, 1);
    c.fillRect(x, y, 4, 32, g.color);
    const head = `${g.tag}  ${g.title}`;
    c.text(head, x + 10, y + 3, 2, INK);
    // tag word in its colour: redraw the tag over the same spot in colour
    c.fillRect(x + 10, y + 3, c.textWidth(g.tag, 2), 14, CARD);
    c.text(g.tag, x + 10, y + 3, 2, g.color);
    c.text(g.detail, x + 10, y + 18, 2, GREY);
  });

  // ---- Timeline ---------------------------------------------------------------
  const tlY = 688;
  c.text('THE DAY IN ORDER  -  UTC', 16, tlY, 2, NAVY);
  c.fillRect(16, tlY + 20, W - 32, 2, NAVY);
  TIMELINE.forEach(([t, s], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = colX[col];
    const y = tlY + 28 + row * 22;
    c.text(t, x + 2, y + 4, 2, RED);
    c.text(s, x + 66, y + 4, 2, INK);
  });

  // ---- In brief ---------------------------------------------------------------
  const brY = 834;
  c.text('IN BRIEF', 16, brY, 2, NAVY);
  c.fillRect(16, brY + 20, W - 32, 2, NAVY);
  const bCols = [16, 352, 688];
  BRIEF.forEach((b, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = bCols[col];
    const y = brY + 26 + row * 19;
    c.fillRect(x, y + 5, 5, 5, RED);
    c.text(b, x + 12, y + 2, 2, INK);
  });

  // ---- Footer -------------------------------------------------------------------
  c.fillRect(0, 1000, W, 2, NAVY);
  c.text('SOURCES: REUTERS, AP, BBC, OFGEM, USTR, BEA, CMSA - ALL EVENTS 25 NOV 2026', 16, 1006, 2, GREY);

  return c;
}

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'entry.png'), draw().toPng());
