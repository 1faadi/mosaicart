import { useEffect, useRef } from 'react'
import { PALETTE } from '../mosaic'
import stud from '../data/mam-stud.json'

// Mosaic Art Maker's stud look, measured from their render: pixel = a * brickHex + b per tile pixel (10x10 per brick).
const S = stud.size, SA = stud.a, SB = stud.b

// Draw a brick grid into a canvas (new one when none given). Stud look: Mosaic Art Maker's measured tile for their
// palette, a simple ring highlight for ours.
export function renderMosaic(grid: number[], w: number, h: number, px: number, frame = false, c = document.createElement('canvas')): HTMLCanvasElement {
    const pad = frame ? Math.round(px * 1.5) : 0
    c.width = w * px + pad * 2; c.height = h * px + pad * 2
    const ctx = c.getContext('2d')!
    if (frame) { ctx.fillStyle = '#1b1b1b'; ctx.fillRect(0, 0, c.width, c.height) }
    if (PALETTE[0].display && px >= 4) {
      // their exact stud tile: render at S px per brick, then scale to px
      const off = new OffscreenCanvas(w * S, h * S)
      const id = new ImageData(w * S, h * S)
      const d = id.data
      for (let i = 0; i < grid.length; i++) {
        const [r, g, b] = PALETTE[grid[i]].rgb
        const x0 = (i % w) * S, y0 = ((i / w) | 0) * S
        for (let v = 0; v < S; v++) for (let u = 0; u < S; u++) {
          const t = (v * S + u) * 3, o = ((y0 + v) * w * S + x0 + u) * 4
          d[o] = SA[t] * r + SB[t]; d[o + 1] = SA[t + 1] * g + SB[t + 1]; d[o + 2] = SA[t + 2] * b + SB[t + 2]; d[o + 3] = 255
        }
      }
      off.getContext('2d')!.putImageData(id, 0, 0)
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(off, pad, pad, w * px, h * px)
      return c
    }
    for (let i = 0; i < grid.length; i++) {
      const x = pad + (i % w) * px, y = pad + ((i / w) | 0) * px
      ctx.fillStyle = PALETTE[grid[i]].hex
      ctx.fillRect(x, y, px, px)
      if (px >= 5) {
        ctx.beginPath(); ctx.arc(x + px / 2, y + px / 2, px * 0.3, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 1; ctx.stroke()
        ctx.beginPath(); ctx.arc(x + px / 2, y + px / 2 - px * 0.08, px * 0.3, Math.PI * 1.1, Math.PI * 1.9)
        ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.stroke()
      }
    }
    return c
}

// Canvas render of a brick grid with stud look. Used for previews/thumbnails (fast, non-interactive).
export default function MosaicCanvas({ grid, w, h, px = 8, frame = false, className = '' }: { grid: number[]; w: number; h: number; px?: number; frame?: boolean; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (ref.current && grid.length === w * h) renderMosaic(grid, w, h, px, frame, ref.current)
  }, [grid, w, h, px, frame])
  return <canvas ref={ref} className={className} />
}
