import { useMemo, useState } from 'react'
import type { Box } from '../face'
import { PALETTE, PALETTES, quantize, sampleGrid, type Adjust, type Metric, type PaletteId } from '../mosaic'
import MosaicCanvas from './MosaicCanvas'
import { TitleBar } from './StepBar'

export type Tab = 'style' | 'tune' | 'edit'
export type Tool = 'paint' | 'erase' | 'pick'

export const PRESETS: Record<string, Adjust> = {
  Portrait: { brightness: 1.05, contrast: 1.4, saturation: 1.0, gamma: 1.0, sharpen: 1.0, faceLift: 1.0, dither: 0, metric: 'rgb' },
  Natural: { brightness: 1.0, contrast: 1.0, saturation: 1, gamma: 1, sharpen: 1.0, faceLift: 1, dither: 0, metric: 'rgb' },
  Soft: { brightness: 1.05, contrast: 1.2, saturation: 0.9, gamma: 1.0, sharpen: 0.6, faceLift: 1.0, dither: 0.5, metric: 'lab' },
  Punchy: { brightness: 1.05, contrast: 1.8, saturation: 1.15, gamma: 1.0, sharpen: 1.3, faceLift: 1.0, dither: 0, metric: 'rgb' },
  Mono: { brightness: 1.05, contrast: 1.6, saturation: 0, gamma: 1.0, sharpen: 1.0, faceLift: 1.0, dither: 0, metric: 'rgb' },
}
// erase = lightest brick of the active palette (White / Cream)
export const eraseIndex = () => PALETTE.reduce((b, p, i) => (p.lab[0] > PALETTE[b].lab[0] ? i : b), 0)

type Props = {
  img: HTMLImageElement | null; area: Box | null; faces: Box[]; W: number; H: number; plate: number; referenceImg?: string
  grid: number[]; edits: Map<number, number>; counts: Map<number, number>
  adj: Adjust; onAdj: (a: Adjust) => void; maxColors: number; onMaxColors: (n: number) => void
  paletteId: PaletteId; onPalette: (p: PaletteId) => void; locked: boolean
  tab: Tab; onTab: (t: Tab) => void
  tool: Tool; onTool: (t: Tool) => void; brush: number; onBrush: (i: number) => void
  onPaint: (i: number) => void; onUndo: () => void; onRedo: () => void; onReset: () => void; canUndo: boolean; canRedo: boolean
  painting: boolean; onPainting: (b: boolean) => void
  onPrev: () => void; onNext: () => void
}

type NumKey = Exclude<keyof Adjust, 'metric'>
const SLIDERS: [NumKey, string, number, number, number][] = [
  ['faceLift', 'AI face lift', 1, 1.8, 0.05], ['brightness', 'Brightness', 0.6, 1.6, 0.02], ['contrast', 'Contrast', 0.6, 2.4, 0.05],
  ['saturation', 'Saturation', 0, 2, 0.05], ['gamma', 'Gamma', 0.6, 1.8, 0.05], ['sharpen', 'Sharpen', 0, 1.5, 0.05], ['dither', 'Dither', 0, 1, 0.05],
]

export default function Studio(p: Props) {
  const { W, H, plate: PLATE } = p
  const [compare, setCompare] = useState(false)
  // preset thumbnails: small renders of the current crop under each preset
  const presetThumbs = useMemo(() => {
    if (!p.img || !p.area) return {}
    const tw = 36, th = Math.round(36 * H / W)
    return Object.fromEntries(Object.entries(PRESETS).map(([k, a]) => [k, quantize(sampleGrid(p.img!, p.area!, tw, th, a, p.faces), p.maxColors, a.dither, tw, a.metric)]))
  }, [p.img, p.area, p.faces, W, H, p.maxColors, p.paletteId])
  const used = [...p.counts.keys()].sort((a, b) => a - b)
  const setA = (k: NumKey, v: number) => p.onAdj({ ...p.adj, [k]: v })

  return (
    <div className="maker studio">
      {p.tab !== 'edit' && (
        <div className={'preview-wrap' + (compare && p.referenceImg ? ' compare' : '')}>
          <div className="frame">{p.grid.length ? <MosaicCanvas grid={p.grid} w={W} h={H} px={Math.max(4, Math.floor((compare ? 600 : 440) / Math.max(W, H)))} /> : null}</div>
          {compare && p.referenceImg && <div className="frame"><img src={p.referenceImg} alt="Mosaic Art Maker result" /></div>}
          {p.referenceImg && (
            <div className="compare-bar">
              {compare && <><span>Ours · {W}×{H}</span><span>Mosaic Art Maker · 60×60</span></>}
              <label className="inline"><input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} /> Compare with Mosaic Art Maker's result</label>
            </div>
          )}
        </div>
      )}

      {p.tab === 'style' && (
        <>
          <TitleBar>Select the style</TitleBar>
          {p.locked && <p className="hint center">Mosaic Art Maker palette: style, tune and colour cap are fixed to their pipeline so the result matches their site.</p>}
          <fieldset className="lock" disabled={p.locked}>
          <div className="presets">
            {Object.entries(PRESETS).map(([k, a]) => (
              <button key={k} className={'preset' + (p.adj === a ? ' selected' : '')} onClick={() => p.onAdj(a)}>
                {presetThumbs[k] && <MosaicCanvas grid={presetThumbs[k]} w={36} h={Math.round(36 * H / W)} px={3} />}
                <span>{k}</span>
              </button>
            ))}
          </div>
          <label className="switch-row">AI face colour correction
            <input type="checkbox" checked={p.adj.faceLift > 1} onChange={(e) => setA('faceLift', e.target.checked ? 1.15 : 1)} /><i />
          </label>
          <label className="slider-row"><span>Max colours : {p.maxColors}</span>
            <input type="range" min={6} max={40} step={1} value={p.maxColors} onChange={(e) => p.onMaxColors(+e.target.value)} />
          </label>
          </fieldset>
          <div className="palette-switch">
            <span>Colour matching</span>
            {(['rgb', 'lab'] as Metric[]).map((mt) => (
              <button key={mt} disabled={p.locked} className={'pill ghost sm' + (p.adj.metric === mt ? ' active' : '')} onClick={() => p.onAdj({ ...p.adj, metric: mt })}>{mt === 'rgb' ? 'RGB (reference-exact)' : 'Lab (perceptual)'}</button>
            ))}
          </div>
          <div className="palette-switch">
            <span>Brick palette</span>
            {(Object.keys(PALETTES) as PaletteId[]).map((id) => (
              <button key={id} className={'pill ghost sm' + (p.paletteId === id ? ' active' : '')} onClick={() => p.onPalette(id)}>{PALETTES[id].label}</button>
            ))}
          </div>
        </>
      )}

      {p.tab === 'tune' && (
        <>
          <TitleBar>Adjust image effects</TitleBar>
          {p.locked && <p className="hint center">Fixed for the Mosaic Art Maker palette. Switch to the 40-colour palette in Style to tune.</p>}
          <fieldset className="lock sliders" disabled={p.locked}>
            {SLIDERS.map(([k, label, lo, hi, step]) => (
              <div className="slider" key={k}>
                <div className="slider-label">{label} : {p.adj[k].toFixed(2)}</div>
                <div className="zoomrow">
                  <button className="round" onClick={() => setA(k, Math.max(lo, +(p.adj[k] - step).toFixed(2)))}>−</button>
                  <input type="range" min={lo} max={hi} step={step} value={p.adj[k]} onChange={(e) => setA(k, +e.target.value)} />
                  <button className="round" onClick={() => setA(k, Math.min(hi, +(p.adj[k] + step).toFixed(2)))}>+</button>
                </div>
              </div>
            ))}
          </fieldset>
          <p className="hint center">💡 Click − + to fine-tune</p>
        </>
      )}

      {p.tab === 'edit' && (
        <>
          <div className="editgrid-wrap" onMouseDown={() => p.onPainting(true)} onMouseUp={() => p.onPainting(false)} onMouseLeave={() => p.onPainting(false)}>
            <div className={'editgrid' + (p.tool === 'pick' ? ' picking' : '') + (W > 72 ? ' fine' : '')} style={{ gridTemplateColumns: `repeat(${W}, 1fr)`, aspectRatio: W / H }}>
              {p.grid.map((pi, i) => {
                const x = i % W, y = (i / W) | 0
                const edge = (x % PLATE === PLATE - 1 && x < W - 1 ? ' pr' : '') + (y % PLATE === PLATE - 1 && y < H - 1 ? ' pb' : '')
                return <div key={i} className={'cell' + (p.edits.has(i) ? ' edited' : '') + edge} style={{ background: PALETTE[pi].hex }}
                  onMouseDown={() => p.onPaint(i)} onMouseEnter={() => p.painting && p.tool !== 'pick' && p.onPaint(i)} title={`${PALETTE[pi].code} ${PALETTE[pi].name}`} />
              })}
            </div>
          </div>
          <TitleBar>Edit brick colour</TitleBar>
          <div className="edit-tools">
            <div className="brush-big" style={{ background: PALETTE[p.tool === 'erase' ? eraseIndex() : p.brush].hex }} title={PALETTE[p.brush].name} />
            <div className="tool-btns">
              <button className={'pill ghost sm' + (p.tool === 'paint' ? ' active' : '')} onClick={() => p.onTool('paint')}>✎ Paint</button>
              <button className={'pill ghost sm' + (p.tool === 'erase' ? ' active' : '')} onClick={() => p.onTool('erase')}>⌫ Erase</button>
              <button className={'pill ghost sm' + (p.tool === 'pick' ? ' active' : '')} onClick={() => p.onTool('pick')}>⌖ Pick</button>
            </div>
            <div className="tool-btns">
              <button className="round" onClick={p.onUndo} disabled={!p.canUndo} title="Undo">↶</button>
              <button className="round" onClick={p.onRedo} disabled={!p.canRedo} title="Redo">↷</button>
              <button className="pill ghost sm" onClick={p.onReset} disabled={!p.edits.size}>Reset ({p.edits.size})</button>
            </div>
          </div>
          <div className="swatches">
            {used.map((i) => (
              <button key={i} className={'sw' + (p.brush === i && p.tool !== 'erase' ? ' selected' : '')} style={{ background: PALETTE[i].hex }} title={`${PALETTE[i].code} ${PALETTE[i].name} (${p.counts.get(i)})`}
                onClick={() => { p.onBrush(i); if (p.tool === 'erase') p.onTool('paint') }} />
            ))}
            <span className="sw-sep" />
            {PALETTE.filter((_, i) => !p.counts.has(i)).map((b) => {
              const i = PALETTE.indexOf(b)
              return <button key={i} className={'sw dim' + (p.brush === i ? ' selected' : '')} style={{ background: b.hex }} title={`${b.code} ${b.name} (unused)`} onClick={() => { p.onBrush(i); p.onTool('paint') }} />
            })}
          </div>
          <p className="hint center">💡 Pick a colour, then click or drag on bricks. Counts update on the next step.</p>
        </>
      )}

      <div className="tabbar">
        <button className="pill ghost" onClick={p.onPrev}>Previous</button>
        <div className="tabs">
          {(['style', 'tune', 'edit'] as Tab[]).map((t) => (
            <button key={t} className={'tab' + (p.tab === t ? ' active' : '')} onClick={() => p.onTab(t)}>
              <i>{t === 'style' ? '◐' : t === 'tune' ? '≡' : '✎'}</i>{t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <button className="pill primary" onClick={p.onNext}>Next</button>
      </div>
    </div>
  )
}
