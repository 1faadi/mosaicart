import clientJson from './data/palette.json'
import mamJson from './data/palette-mam.json'
import type { Box } from './face'
import { cropRgb, imageToRgb, resizeLanczos, type Rgb } from './resample'

// `display` = how the brick looks in Mosaic Art Maker's stud render (measured, ~hex x1.10 lighting gain); preview only, hex stays the true brick colour
export type Brick = { code: string; name: string; hex: string; display?: string; rgb: [number, number, number]; lab: [number, number, number] }
export type PaletteId = 'client' | 'mam'

const build = (list: { code: string; name: string; hex: string; display?: string }[]): Brick[] => list.map((p) => {
  const rgb = hexToRgb(p.hex)
  return { ...p, rgb, lab: rgbToLab(rgb) }
})
export const PALETTES: Record<PaletteId, { label: string; bricks: Brick[] }> = {
  client: { label: 'PIECES & BRICKS · 40 colours', bricks: build(clientJson) },
  mam: { label: 'Mosaic Art Maker · 44 colours', bricks: build(mamJson) },
}
// Active palette. Same array identity everywhere; setPalette swaps contents in place.
export const PALETTE: Brick[] = [...PALETTES.client.bricks]
export function setPalette(id: PaletteId) { PALETTE.splice(0, PALETTE.length, ...PALETTES[id].bricks) }

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

// sRGB -> CIELAB (D65). Perceptual distance in Lab beats RGB for skin tones.
export function rgbToLab([r, g, b]: [number, number, number]): [number, number, number] {
  const lin = (c: number) => {
    c /= 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  const R = lin(r), G = lin(g), B = lin(b)
  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047
  const y = R * 0.2126 + G * 0.7152 + B * 0.0722
  const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  const fx = f(x), fy = f(y), fz = f(z)
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

// CIELAB distance with chroma weighted 0.8 and a penalty for picking a brick more saturated than the
// source pixel. Plain Euclidean Lab happily drops yellow/purple bricks into near-grey hair and
// shadows; the reference site's output has none of that (docs/compare_fix.png).
const CHROMA_W = 1.0, SAT_PEN = 0.3
export type Metric = 'lab' | 'rgb'
export function nearestBrick(rgb: [number, number, number], allowed: Brick[] = PALETTE, metric: Metric = 'lab'): number {
  let best = 0, bestD = Infinity
  if (metric === 'rgb') {
    // plain RGB Euclidean: what PIL's palette quantize does; matches the reference site brick-for-brick
    for (let i = 0; i < allowed.length; i++) {
      const [r, g, b] = allowed[i].rgb
      const d = (rgb[0] - r) ** 2 + (rgb[1] - g) ** 2 + (rgb[2] - b) ** 2
      if (d < bestD) { bestD = d; best = i }
    }
    return PALETTE.indexOf(allowed[best])
  }
  const lab = rgbToLab(rgb)
  const sc = Math.hypot(lab[1], lab[2])
  for (let i = 0; i < allowed.length; i++) {
    const l = allowed[i].lab
    const pc = Math.hypot(l[1], l[2])
    const over = Math.max(0, pc - sc)
    const d = (lab[0] - l[0]) ** 2 + CHROMA_W * ((lab[1] - l[1]) ** 2 + (lab[2] - l[2]) ** 2) + SAT_PEN * over * over
    if (d < bestD) { bestD = d; best = i }
  }
  return PALETTE.indexOf(allowed[best])
}

// Reverse-engineered from mosaicartmaker.com and verified brick-for-brick against their output on the two
// client samples (75% identical bricks, rest are adjacent tones): their backend is PIL.
//   resize upload to 600px on the shorter side -> crop -> resize to grid (Lanczos) -> ImageEnhance.Sharpness(2.0)
//   -> Brightness(1.05) -> Contrast(1.4, pivot = image mean grey) -> nearest brick in RGB, no dither.
// `sharpen` here = PIL factor - 1 (so 1.0 == Sharpness(2.0)). `contrast` pivots on the mean like PIL.
export type Adjust = { brightness: number; contrast: number; saturation: number; gamma: number; sharpen: number; faceLift: number; dither: number; metric: Metric }

const PRE = 600 // reference client resizes the SHORTER side of every upload to 600px (expo-image-manipulator) before cropping

// cache of the 600px-wide pre-resized source per image element
const preCache = new WeakMap<HTMLImageElement, Rgb>()
function pre600(img: HTMLImageElement): Rgb {
  let p = preCache.get(img)
  if (!p) {
    const full = imageToRgb(img)
    p = full.w > full.h ? resizeLanczos(full, Math.round(full.w * PRE / full.h), PRE) : resizeLanczos(full, PRE, Math.round(full.h * PRE / full.w))
    preCache.set(img, p)
  }
  return p
}
const L = (c: number[]) => (c[0] * 299 + c[1] * 587 + c[2] * 114) / 1000 // PIL "L" luma

export function sampleGrid(
  img: HTMLImageElement,
  crop: Box,
  w: number,
  h: number,
  adj: Adjust,
  faces: Box[] = [],
): [number, number, number][] {
  // 1. 600-wide source (PIL Lanczos), integer crop in that space, PIL Lanczos down to the grid
  const pre = pre600(img)
  const s = pre.w / img.naturalWidth
  const cx = Math.round(crop.x * s), cy = Math.round(crop.y * s)
  const cw = Math.max(1, Math.round(crop.width * s)), ch = Math.max(1, Math.round(crop.height * s))
  const small = resizeLanczos(cropRgb(pre, cx, cy, cw, ch), w, h)
  const px = (x: number, y: number, k: number) => small.data[(Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))) * 3 + k]
  // 2. PIL ImageEnhance.Sharpness(1 + sharpen): blend with SMOOTH-filtered image, rounded to 8-bit
  const cells: number[][] = []
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    cells.push([0, 1, 2].map((k) => {
      const v = px(x, y, k)
      if (!adj.sharpen) return v
      let sm = 5 * v
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) sm += px(x + dx, y + dy, k)
      sm = Math.round(sm / 13)
      return Math.max(0, Math.min(255, Math.round(sm + (1 + adj.sharpen) * (v - sm))))
    }))
  }
  // 3. saturation (PIL Color), brightness (PIL Brightness), each rounded
  for (const c of cells) {
    if (adj.saturation !== 1) { const l = Math.round(L(c)); for (let i = 0; i < 3; i++) c[i] = Math.max(0, Math.min(255, Math.round(l + (c[i] - l) * adj.saturation))) }
    if (adj.brightness !== 1) for (let i = 0; i < 3; i++) c[i] = Math.max(0, Math.min(255, Math.round(c[i] * adj.brightness)))
  }
  // 4. PIL Contrast: pivot on the (integer) mean grey of the whole image
  let mean = 0
  for (const c of cells) mean += L(c)
  mean = Math.round(mean / cells.length)
  // face region = one box around all faces, padded 25%
  const cellW = crop.width / w, cellH = crop.height / h
  let fb: { x0: number; x1: number; y0: number; y1: number } | null = null
  if (faces.length && adj.faceLift !== 1) {
    const x0 = Math.min(...faces.map((f) => f.x)), y0 = Math.min(...faces.map((f) => f.y))
    const x1 = Math.max(...faces.map((f) => f.x + f.width)), y1 = Math.max(...faces.map((f) => f.y + f.height))
    const pw = (x1 - x0) * 0.25, ph = (y1 - y0) * 0.25
    fb = { x0: (x0 - pw - crop.x) / cellW, x1: (x1 + pw - crop.x) / cellW, y0: (y0 - ph - crop.y) / cellH, y1: (y1 + ph - crop.y) / cellH }
  }
  const out: [number, number, number][] = []
  for (let i = 0; i < cells.length; i++) {
    const x = i % w, y = (i / w) | 0
    const lift = fb && x >= fb.x0 && x <= fb.x1 && y >= fb.y0 && y <= fb.y1 ? adj.faceLift : 1
    const c = cells[i]
    out.push([0, 1, 2].map((k) => {
      let v = adj.contrast === 1 ? c[k] : Math.round(mean + (c[k] - mean) * adj.contrast)
      if (adj.gamma !== 1) v = 255 * (Math.max(0, Math.min(255, v)) / 255) ** adj.gamma
      return Math.max(0, Math.min(255, v * lift))
    }) as [number, number, number])
  }
  return out
}

export function quantize(cells: [number, number, number][], maxColors = PALETTE.length, strength = 0.75, w = 0, metric: Metric = 'lab'): number[] {
  const n = cells.length
  const width = w || Math.round(Math.sqrt(n))
  const height = Math.ceil(n / width)
  const pass = (allowed: Brick[]) => {
    const a = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) { a[i * 3] = cells[i][0]; a[i * 3 + 1] = cells[i][1]; a[i * 3 + 2] = cells[i][2] }
    const out = new Array<number>(n)
    const add = (x: number, y: number, er: number, eg: number, eb: number, k: number) => {
      if (x < 0 || x >= width || y >= height) return
      const o = (y * width + x) * 3
      a[o] += er * k; a[o + 1] += eg * k; a[o + 2] += eb * k
    }
    for (let y = 0; y < height; y++) {
      const ltr = y % 2 === 0
      for (let xi = 0; xi < width; xi++) {
        const x = ltr ? xi : width - 1 - xi
        const i = y * width + x
        if (i >= n) continue
        const o = i * 3
        const r = Math.max(0, Math.min(255, a[o])), g = Math.max(0, Math.min(255, a[o + 1])), b = Math.max(0, Math.min(255, a[o + 2]))
        const pi = nearestBrick([r, g, b], allowed, metric)
        out[i] = pi
        if (!strength) continue
        const [pr, pg, pb] = PALETTE[pi].rgb
        const er = (r - pr) * strength, eg = (g - pg) * strength, eb = (b - pb) * strength
        const dx = ltr ? 1 : -1
        add(x + dx, y, er, eg, eb, 7 / 16)
        add(x - dx, y + 1, er, eg, eb, 3 / 16)
        add(x, y + 1, er, eg, eb, 5 / 16)
        add(x + dx, y + 1, er, eg, eb, 1 / 16)
      }
    }
    return out
  }
  let grid = pass(PALETTE)
  if (maxColors < PALETTE.length) {
    const top = [...countBricks(grid)].sort((a, b) => b[1] - a[1]).slice(0, maxColors).map(([i]) => PALETTE[i])
    grid = pass(top)
  }
  return grid
}

export function countBricks(grid: number[]): Map<number, number> {
  const m = new Map<number, number>()
  for (const i of grid) m.set(i, (m.get(i) ?? 0) + 1)
  return m
}

export const PLATE = 24

// Split a (cols*24) x (rows*24) grid into per-baseplate grids, row-major, labelled A1, A2, B1...
export function splitPlates(grid: number[], cols: number, rows: number, plate = PLATE): { label: string; cells: number[] }[] {
  const w = cols * plate
  const plates: { label: string; cells: number[] }[] = []
  for (let pr = 0; pr < rows; pr++) for (let pc = 0; pc < cols; pc++) {
    const cells: number[] = []
    for (let y = 0; y < plate; y++) for (let x = 0; x < plate; x++) cells.push(grid[(pr * plate + y) * w + pc * plate + x])
    plates.push({ label: String.fromCharCode(65 + pr) + (pc + 1), cells })
  }
  return plates
}
