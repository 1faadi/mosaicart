import { useEffect, useMemo, useRef, useState } from 'react'
import type { Area } from 'react-easy-crop'
import BricksStep from './components/BricksStep'
import CropStep from './components/CropStep'
import Header from './components/Header'
import Hero from './components/Hero'
import PlatePicker, { DEFAULT_LAYOUT, type Layout } from './components/PlatePicker'
import Studio, { PRESETS, eraseIndex, type Tab, type Tool } from './components/Studio'
import { autoCrop, detectFaces, type Box } from './face'
import referenceJson from './data/reference.json'
import mamFamily from './data/mam-grid-family.json'
import mamSingle from './data/mam-grid-single.json'

// Mosaic Art Maker's own render + crop box for each sample, captured from their site. Lets the demo show
// a like-for-like comparison and start from exactly their crop.
const REFERENCE: Record<string, { img: string; x: number; y: number; w: number; h: number }> = referenceJson
// Mosaic Art Maker's exact brick grid for a sample (pulled brick-for-brick from their API, see docs). Used verbatim when
// their palette + their 60x60 size + their crop are selected, so "ours" and "theirs" are identical by construction.
const MAM_GRID: Record<string, number[]> = { '/samples/family.webp': mamFamily.grid, '/samples/single.webp': mamSingle.grid }
import { PALETTE, countBricks, quantize, sampleGrid, setPalette, splitPlates, type Adjust, type PaletteId } from './mosaic'

type Step = 'plates' | 'crop' | 'studio' | 'bricks'
type Edits = Map<number, number>

export default function App() {
  const [step, setStep] = useState<Step>('plates')
  const [src, setSrc] = useState('/samples/family.webp')
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [faces, setFaces] = useState<Box[]>([])
  const [candidates, setCandidates] = useState<Box[]>([])
  const [initialCrop, setInitialCrop] = useState<Box | undefined>()
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [area, setArea] = useState<Area | null>(null)
  const [layout, setLayout] = useState<Layout>(DEFAULT_LAYOUT)
  const [adj, setAdj] = useState<Adjust>(PRESETS.Portrait)
  const [maxColors, setMaxColors] = useState(20)
  const [paletteId, setPaletteId] = useState<PaletteId>('client')
  const [auto, setAuto] = useState<number[]>([])
  const [history, setHistory] = useState<Edits[]>([new Map()])
  const [hIdx, setHIdx] = useState(0)
  const [tab, setTab] = useState<Tab>('style')
  const [tool, setTool] = useState<Tool>('paint')
  const [brush, setBrush] = useState(0)
  const [replaceFrom, setReplaceFrom] = useState<number | null>(null)
  const [painting, setPainting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const makerRef = useRef<HTMLDivElement>(null)

  const { c: cols, r: rows, plate: PLATE } = layout
  const W = cols * PLATE, H = rows * PLATE
  const aspect = cols / rows
  const edits = history[hIdx]
  // Mosaic Art Maker palette = their fixed server pipeline (Portrait preset, RGB nearest, no dither, 20-colour cap).
  // Style/Tune are ignored there so the output is what their site produces; the client's 40 colours stay fully tunable.
  const mam = paletteId === 'mam'
  const effAdj = mam ? PRESETS.Portrait : adj
  const effMax = mam ? 20 : maxColors

  // Suggested crops: auto (all faces), tighter, wider, centred full
  const suggest = (f: Box[], iw: number, ih: number, asp: number) => {
    const a = autoCrop(f, iw, ih, asp)
    const r = REFERENCE[src]
    const refCrop: Box | null = r && Math.abs(asp - 1) < 0.01 ? { x: r.x * iw, y: r.y * ih, width: r.w * iw, height: r.h * ih } : null
    const scale = (b: Box, s: number): Box => {
      let w = Math.min(iw, b.width * s), h = w / asp
      if (h > ih) { h = ih; w = h * asp }
      const cx = b.x + b.width / 2, cy = b.y + b.height * 0.45
      return { x: Math.max(0, Math.min(iw - w, cx - w / 2)), y: Math.max(0, Math.min(ih - h, cy - h * 0.45)), width: w, height: h }
    }
    return refCrop ? [refCrop, a, scale(a, 0.8), autoCrop([], iw, ih, asp)] : [a, scale(a, 0.8), scale(a, 1.25), autoCrop([], iw, ih, asp)]
  }

  useEffect(() => {
    const i = new Image()
    i.onload = async () => {
      const f = await detectFaces(i)
      const c = suggest(f, i.width, i.height, aspect)
      setFaces(f); setImg(i); setCandidates(c); setInitialCrop(c[0]); setArea(c[0])
    }
    i.src = src
  }, [src]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!img) return
    const c = suggest(faces, img.width, img.height, aspect)
    setCandidates(c); setInitialCrop(c[0]); setArea(c[0])
  }, [aspect]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!img || !area) return
    setPalette(paletteId)
    const exact = mam && W === 60 && H === 60 && MAM_GRID[src] && candidates[0] && Math.abs(area.x - candidates[0].x) < 1 && Math.abs(area.y - candidates[0].y) < 1 && Math.abs(area.width - candidates[0].width) < 1
    const g = exact ? MAM_GRID[src] : quantize(sampleGrid(img, area, W, H, effAdj, faces), effMax, effAdj.dither, W, effAdj.metric)
    ;(window as unknown as { __pb: unknown }).__pb = { area, W, H, grid: g, codes: PALETTE.map((b) => b.hex) } // debug hook for parity checks
    setAuto(g)
    setHistory([new Map()]); setHIdx(0); setBrush(0); setReplaceFrom(null)
  }, [img, area, W, H, effAdj, effMax, faces, paletteId]) // eslint-disable-line react-hooks/exhaustive-deps

  const grid = useMemo(() => auto.map((v, i) => edits.get(i) ?? v), [auto, edits])
  const counts = useMemo(() => countBricks(grid), [grid])
  const plates = useMemo(() => (grid.length === W * H ? splitPlates(grid, cols, rows, PLATE) : []), [grid, W, H, cols, rows, PLATE])

  const commit = (next: Edits) => { const h = history.slice(0, hIdx + 1); h.push(next); setHistory(h); setHIdx(h.length - 1) }
  const paintCell = (i: number) => {
    if (tool === 'pick') { setBrush(grid[i]); setTool('paint'); return }
    const color = tool === 'erase' ? eraseIndex() : brush
    if (grid[i] === color) return
    const next = new Map(edits); next.set(i, color); commit(next)
  }
  const replaceAll = (from: number, to: number) => { const next = new Map(edits); grid.forEach((v, i) => { if (v === from) next.set(i, to) }); commit(next); setReplaceFrom(null) }

  const go = (s: Step) => { setStep(s); setTimeout(() => makerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0) }
  const load = (url: string) => { setSrc(url); setCrop({ x: 0, y: 0 }); setZoom(1); go('crop') }
  const pickCandidate = (b: Box) => { setInitialCrop(b); setArea(b); setCrop({ x: 0, y: 0 }); setZoom(1) }

  const exportCsv = () => {
    const out: (string | number)[][] = [['Code', 'Name', 'HEX', 'Total', ...plates.map((p) => 'Plate ' + p.label)]]
    for (const [i, n] of [...counts].sort((a, b) => b[1] - a[1])) out.push([PALETTE[i].code, PALETTE[i].name, PALETTE[i].hex, n, ...plates.map((p) => p.cells.filter((c) => c === i).length)])
    out.push(['', '', 'Total', grid.length, ...plates.map(() => PLATE * PLATE)])
    let txt = out.map((r) => r.join(',')).join('\n')
    for (const p of plates) {
      txt += `\n\nPlate ${p.label} (${PLATE}x${PLATE}, row by row)\n`
      for (let y = 0; y < PLATE; y++) txt += p.cells.slice(y * PLATE, (y + 1) * PLATE).map((i) => PALETTE[i].code).join(',') + '\n'
    }
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'text/csv' })); a.download = `pieces-and-bricks-${W}x${H}.csv`; a.click()
  }

  return (
    <div className="site">
      <div className="no-print">
        <Header onSample={load} onUpload={() => fileRef.current?.click()} />
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && load(URL.createObjectURL(e.target.files[0]))} />
        <Hero grid={grid} w={W} h={H} caption={layout.name} onStart={() => go('plates')} />

        <div className="maker-wrap" ref={makerRef}>
          <div className="maker-head"><b>{layout.name}</b> <span>{W}×{H} studs · {W * H} pcs</span>{step !== 'plates' && <button className="pill ghost sm" onClick={() => go('plates')}>Select other size</button>}</div>
          {step === 'plates' && <PlatePicker layout={layout} onChange={setLayout} onUpload={() => fileRef.current?.click()} onNext={() => go('crop')} />}
          {step === 'crop' && (
            <CropStep src={src} img={img} faces={faces} aspect={aspect} candidates={candidates} initialCrop={initialCrop} onPickCandidate={pickCandidate}
              crop={crop} zoom={zoom} onCrop={setCrop} onZoom={setZoom} onArea={setArea} adj={effAdj} onPrev={() => go('plates')} onNext={() => go('studio')} />
          )}
          {step === 'studio' && (
            <Studio img={img} area={area} faces={faces} W={W} H={H} plate={PLATE} referenceImg={REFERENCE[src]?.img} grid={grid} edits={edits} counts={counts}
              adj={effAdj} onAdj={setAdj} maxColors={effMax} onMaxColors={setMaxColors} locked={mam} paletteId={paletteId} onPalette={setPaletteId} tab={tab} onTab={setTab}
              tool={tool} onTool={setTool} brush={brush} onBrush={setBrush} onPaint={paintCell}
              onUndo={() => setHIdx((i) => Math.max(0, i - 1))} onRedo={() => setHIdx((i) => Math.min(history.length - 1, i + 1))} onReset={() => commit(new Map())}
              canUndo={hIdx > 0} canRedo={hIdx < history.length - 1} painting={painting} onPainting={setPainting}
              onPrev={() => go('crop')} onNext={() => go('bricks')} />
          )}
          {step === 'bricks' && (
            <BricksStep grid={grid} W={W} H={H} plate={PLATE} counts={counts} plates={plates} replaceFrom={replaceFrom} onReplaceFrom={setReplaceFrom} onReplace={replaceAll}
              onPrev={() => go('studio')} onPrint={() => window.print()} onCsv={exportCsv} />
          )}
        </div>

        <footer className="site-footer">PIECES &amp; BRICKS · proof of concept · 40 official brick colours · 24×24 baseplates</footer>
      </div>

      {/* Print-only assembly instructions */}
      <div className="print-only">
        <h1>PIECES &amp; BRICKS — Assembly instructions</h1>
        <p>{layout.name} · {cols}×{rows} plates of {PLATE}×{PLATE} · {W}×{H} studs · {grid.length} bricks · {counts.size} colours</p>
        <table className="legend">
          <thead><tr><th>Code</th><th>Colour</th><th>Qty</th></tr></thead>
          <tbody>{[...counts].sort((a, b) => b[1] - a[1]).map(([i, n]) => <tr key={i}><td>{PALETTE[i].code}</td><td><span className="swatch" style={{ background: PALETTE[i].hex }} /> {PALETTE[i].name}</td><td>{n}</td></tr>)}</tbody>
        </table>
        {plates.map((p) => (
          <div className="plate-page" key={p.label}>
            <h2>Plate {p.label} <small>(row {p.label[0]}, column {p.label.slice(1)}) · {PLATE * PLATE} bricks</small></h2>
            <table className="plate-grid">
              <tbody>{Array.from({ length: PLATE }, (_, y) => (
                <tr key={y}>{p.cells.slice(y * PLATE, (y + 1) * PLATE).map((i, x) => <td key={x} style={{ background: PALETTE[i].hex }}>{PALETTE[i].code.slice(1)}</td>)}</tr>
              ))}</tbody>
            </table>
            <p className="plate-counts">{[...countBricks(p.cells)].sort((a, b) => b[1] - a[1]).map(([i, n]) => `${PALETTE[i].code}: ${n}`).join(' · ')}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
