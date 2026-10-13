// PIL-compatible Lanczos resampling (Image.LANCZOS / ANTIALIAS): support 3, separable passes,
// scale-aware kernel when downscaling, 8-bit rounding after each pass. Replicating PIL exactly is what
// makes our bricks line up with the reference site's output; canvas drawImage() does not.
export type Rgb = { w: number; h: number; data: Uint8ClampedArray } // RGB, 3 bytes per pixel

const SUPPORT = 3
const sinc = (x: number) => (x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x))
const lanczos = (x: number) => (Math.abs(x) < SUPPORT ? sinc(x) * sinc(x / SUPPORT) : 0)

function coeffs(inSize: number, outSize: number): { xmin: Int32Array; len: Int32Array; k: Float64Array; kmax: number } {
  const scale = inSize / outSize
  const filterScale = Math.max(1, scale)
  const support = SUPPORT * filterScale
  const kmax = Math.ceil(support) * 2 + 1
  const xmin = new Int32Array(outSize), len = new Int32Array(outSize), k = new Float64Array(outSize * kmax)
  for (let i = 0; i < outSize; i++) {
    const center = (i + 0.5) * scale
    let x0 = Math.floor(center - support); if (x0 < 0) x0 = 0
    let x1 = Math.ceil(center + support); if (x1 > inSize) x1 = inSize
    let sum = 0
    for (let x = x0; x < x1; x++) { const w = lanczos((x - center + 0.5) / filterScale); k[i * kmax + (x - x0)] = w; sum += w }
    if (sum) for (let x = 0; x < x1 - x0; x++) k[i * kmax + x] /= sum
    xmin[i] = x0; len[i] = x1 - x0
  }
  return { xmin, len, k, kmax }
}

function pass(src: Rgb, outW: number, outH: number, horizontal: boolean): Rgb {
  const { xmin, len, k, kmax } = horizontal ? coeffs(src.w, outW) : coeffs(src.h, outH)
  const out = new Uint8ClampedArray(outW * outH * 3)
  for (let y = 0; y < outH; y++) for (let x = 0; x < outW; x++) {
    const i = horizontal ? x : y, x0 = xmin[i], n = len[i]
    let r = 0, g = 0, b = 0
    for (let j = 0; j < n; j++) {
      const w = k[i * kmax + j]
      const o = horizontal ? (y * src.w + x0 + j) * 3 : ((x0 + j) * src.w + x) * 3
      r += src.data[o] * w; g += src.data[o + 1] * w; b += src.data[o + 2] * w
    }
    const p = (y * outW + x) * 3
    out[p] = Math.round(r); out[p + 1] = Math.round(g); out[p + 2] = Math.round(b)
  }
  return { w: outW, h: outH, data: out }
}

export function resizeLanczos(src: Rgb, outW: number, outH: number): Rgb {
  // PIL does the horizontal pass first (on the rows that will be needed), then vertical
  const mid = src.w === outW ? src : pass(src, outW, src.h, true)
  return mid.h === outH ? mid : pass(mid, outW, outH, false)
}

export function cropRgb(src: Rgb, x: number, y: number, w: number, h: number): Rgb {
  const out = new Uint8ClampedArray(w * h * 3)
  for (let yy = 0; yy < h; yy++) {
    const sy = Math.min(src.h - 1, Math.max(0, y + yy))
    for (let xx = 0; xx < w; xx++) {
      const sx = Math.min(src.w - 1, Math.max(0, x + xx))
      const s = (sy * src.w + sx) * 3, d = (yy * w + xx) * 3
      out[d] = src.data[s]; out[d + 1] = src.data[s + 1]; out[d + 2] = src.data[s + 2]
    }
  }
  return { w, h, data: out }
}

export function imageToRgb(img: HTMLImageElement): Rgb {
  const c = document.createElement('canvas')
  c.width = img.naturalWidth; c.height = img.naturalHeight
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0)
  const d = ctx.getImageData(0, 0, c.width, c.height).data
  const out = new Uint8ClampedArray(c.width * c.height * 3)
  for (let i = 0, j = 0; i < d.length; i += 4, j += 3) { out[j] = d[i]; out[j + 1] = d[i + 1]; out[j + 2] = d[i + 2] }
  return { w: c.width, h: c.height, data: out }
}
