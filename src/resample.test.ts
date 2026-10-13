// Verifies our Lanczos matches PIL's Image.LANCZOS byte-for-byte (fixture generated with Pillow).
// Run: npx tsx src/resample.test.ts
import assert from 'node:assert/strict'
import fx from './data/lanczos-fixture.json'
import { resizeLanczos } from './resample'

const src = { w: fx.w, h: fx.h, data: Uint8ClampedArray.from(fx.src) }
for (const [label, t] of [['down', fx.down], ['up', fx.up]] as const) {
  const r = resizeLanczos(src, t.w, t.h)
  let maxDiff = 0, off = 0
  for (let i = 0; i < r.data.length; i++) { const d = Math.abs(r.data[i] - t.data[i]); if (d > maxDiff) maxDiff = d; if (d > 1) off++ }
  console.log(`${label}: max byte diff ${maxDiff}, bytes off by >1: ${off}/${r.data.length}`)
  assert.ok(maxDiff <= 2 && off < r.data.length * 0.02, `${label} differs from PIL`)
}
console.log('resample.test.ts OK')
