import { useState } from 'react'
import { StepFooter, TitleBar } from './StepBar'

export type Layout = { c: number; r: number; plate: number; name: string; note: string }

// Client spec: 24x24-stud baseplates, 576 bricks each. Reference (mosaicartmaker.com): 60x60-stud 4mm-brick products.
export const FAMILIES: { title: string; items: Layout[] }[] = [
  { title: 'PIECES & BRICKS', items: [
    { c: 1, r: 1, plate: 24, name: '1×1 plates', note: '24×24 studs' },
    { c: 2, r: 1, plate: 24, name: '2×1 plates', note: '48×24 studs' },
    { c: 1, r: 2, plate: 24, name: '1×2 plates', note: '24×48 studs' },
    { c: 2, r: 2, plate: 24, name: '2×2 plates', note: '48×48 studs' },
    { c: 3, r: 2, plate: 24, name: '3×2 plates', note: '72×48 studs' },
    { c: 3, r: 3, plate: 24, name: '3×3 plates', note: '72×72 studs' },
  ] },
  { title: 'Mosaic Art Maker sizes', items: [
    { c: 1, r: 1, plate: 60, name: '26×26 cm', note: '60×60 studs' },
    { c: 2, r: 1, plate: 60, name: '50×26 cm', note: '120×60 studs' },
    { c: 1, r: 2, plate: 60, name: '26×50 cm', note: '60×120 studs' },
    { c: 2, r: 2, plate: 60, name: '50×50 cm', note: '120×120 studs' },
    { c: 3, r: 2, plate: 60, name: '74×50 cm', note: '180×120 studs' },
    { c: 2, r: 3, plate: 60, name: '50×74 cm', note: '120×180 studs' },
  ] },
]
export const DEFAULT_LAYOUT = FAMILIES[0].items[3]

export default function PlatePicker({ layout, onChange, onUpload, onNext }: { layout: Layout; onChange: (l: Layout) => void; onUpload: () => void; onNext: () => void }) {
  const [fam, setFam] = useState(FAMILIES.findIndex((f) => f.items.includes(layout)))
  const f = FAMILIES[fam]
  return (
    <div className="maker">
      <TitleBar>Select the art size</TitleBar>
      <div className="family-tabs">
        {FAMILIES.map((x, i) => (
          <button key={x.title} className={'family-tab' + (i === fam ? ' active' : '')} onClick={() => { setFam(i); onChange(FAMILIES[i].items[i === 0 ? 3 : 0]) }}>
            {x.title}<small>{x.items[0].plate}×{x.items[0].plate} {x.items[0].plate === 24 ? 'baseplates' : 'panels'}</small>
          </button>
        ))}
      </div>
      {[f].map((f) => (
        <div key={f.title}>
          <div className="tiles">
            {f.items.map((l) => {
              const sel = l === layout
              const px = l.plate === 24 ? 36 : 26
              return (
                <button key={l.name} className={'tile' + (sel ? ' selected' : '')} onClick={() => onChange(l)}>
                  <div className="tile-art" style={{ height: 120 }}>
                    <div className="plates" style={{ gridTemplateColumns: `repeat(${l.c}, ${px}px)` }}>
                      {Array.from({ length: l.c * l.r }, (_, i) => <span key={i} style={{ width: px, height: px }} />)}
                    </div>
                  </div>
                  <div className="tile-label"><b>{l.name}</b><span>{l.note} · {(l.c * l.r * l.plate * l.plate).toLocaleString()} pcs</span></div>
                </button>
              )
            })}
          </div>
        </div>
      ))}
      <p className="hint center">{f.items[0].plate === 24 ? '24×24 baseplate = 576 bricks. Portraits need 2×2 or larger.' : '60×60 panel = 3,600 bricks, 4mm mini bricks. Same sizes as the reference shop.'}</p>
      <StepFooter onNext={onNext} nextLabel="Next">
        <button className="pill ghost" onClick={onUpload}>Upload Photo</button>
      </StepFooter>
    </div>
  )
}
