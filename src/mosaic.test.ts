// Minimal self-check, no framework. Run: npx tsx src/mosaic.test.ts
import assert from 'node:assert/strict'
import { PALETTE, PALETTES, countBricks, hexToRgb, nearestBrick, quantize, rgbToLab, setPalette, splitPlates } from './mosaic'

assert.equal(PALETTE.length, 40, 'palette must have 40 bricks')
assert.equal(new Set(PALETTE.map((p) => p.code)).size, 40, 'codes unique')

// every palette colour maps to itself
for (const [i, b] of PALETTE.entries()) assert.equal(nearestBrick(b.rgb), i, `${b.code} self-match`)

// skin tone lands in beige family, not grey
const skin = nearestBrick(hexToRgb('#E8B898'))
assert.ok(['C03', 'C04', 'C05'].includes(PALETTE[skin].code), `skin -> ${PALETTE[skin].code}`)

// pure white / black
assert.equal(PALETTE[nearestBrick([255, 255, 255])].code, 'C02')
assert.equal(PALETTE[nearestBrick([0, 0, 0])].code, 'C01')

// lab sanity: white L≈100, black L≈0
assert.ok(Math.abs(rgbToLab([255, 255, 255])[0] - 100) < 0.1)
assert.ok(rgbToLab([0, 0, 0])[0] < 0.1)

// counts sum to grid size
const grid = Array.from({ length: 576 }, (_, i) => i % 7)
const total = [...countBricks(grid).values()].reduce((a, b) => a + b, 0)
assert.equal(total, 576)

// colour cap: 40 random cells -> at most 5 distinct bricks, still 40 cells
const rnd: [number, number, number][] = Array.from({ length: 40 }, (_, i) => [(i * 37) % 256, (i * 91) % 256, (i * 53) % 256])
const capped = quantize(rnd, 5, 0.75, 8)
assert.equal(capped.length, 40)
assert.ok(new Set(capped).size <= 5, 'cap respected')

// plates: 48x24 grid (2x1) splits into A1 (left) and A2 (right), each 576, no cell lost
const big = Array.from({ length: 48 * 24 }, (_, i) => (i % 48 < 24 ? 1 : 2))
const plates = splitPlates(big, 2, 1)
assert.deepEqual(plates.map((p) => p.label), ['A1', 'A2'])
assert.ok(plates[0].cells.every((c) => c === 1) && plates[0].cells.length === 576)
assert.ok(plates[1].cells.every((c) => c === 2) && plates[1].cells.length === 576)

// dither: flat mid-grey field of 16x16 -> dithered mix of >=2 greys, 256 cells; strength 0 -> single brick
const flat: [number, number, number][] = Array.from({ length: 256 }, () => [140, 140, 140])
assert.equal(new Set(quantize(flat, 40, 0, 16)).size, 1, 'no dither = one brick')
assert.ok(new Set(quantize(flat, 40, 0.75, 16)).size >= 2, 'dither mixes bricks')
assert.equal(quantize(flat, 40, 0.75, 16).length, 256)

// palette switch swaps in place
setPalette('mam'); assert.equal(PALETTE.length, 44); assert.equal(PALETTE[nearestBrick([255, 255, 255])].name, 'Cream')
setPalette('client'); assert.equal(PALETTE.length, 40); assert.equal(PALETTE[nearestBrick([255, 255, 255])].name, 'White')
assert.equal(PALETTES.mam.bricks.length, 44)

// rgb metric: pure red -> Red brick (C15) by RGB distance
assert.equal(PALETTE[nearestBrick([205, 41, 40], PALETTE, 'rgb')].code, 'C15')

console.log('mosaic.test.ts OK')
