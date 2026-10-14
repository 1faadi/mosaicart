import { useMemo, useState } from 'react'
import { autoCrop, type Box } from '../face'
import { PALETTE, quantize, sampleGrid, type Adjust } from '../mosaic'
import MosaicCanvas from './MosaicCanvas'
import { StepFooter, TitleBar } from './StepBar'

export type Layout = { c: number; r: number; plate: number; name: string; note: string }

// Client spec: 8 mm bricks, 24x24-stud baseplates = 19.2 x 19.2 cm, 576 bricks each; bigger art = more baseplates.
// Reference (mosaicartmaker.com): 60x60-stud panels of 4 mm bricks, kept only for the side-by-side comparison.
export const BRICK_MM = 8
const cm = (studs: number) => (studs * BRICK_MM / 10).toFixed(1).replace(/\.0$/, '')
const pb = (c: number, r: number): Layout => ({ c, r, plate: 24, name: `${c * 24}×${r * 24} studs`, note: `${c}×${r} baseplate${c * r > 1 ? 's' : ''} · ${cm(c * 24)}×${cm(r * 24)} cm` })
export const FAMILIES: { title: string; items: Layout[] }[] = [
  { title: 'PIECES & BRICKS · 8 mm bricks', items: [pb(1, 1), pb(2, 1), pb(2, 2), pb(3, 2), pb(3, 3), pb(4, 4)] },
  { title: 'Reference only · Mosaic Art Maker 4 mm', items: [
    { c: 1, r: 1, plate: 60, name: '26×26 cm', note: '60×60 studs' },
    { c: 2, r: 1, plate: 60, name: '50×26 cm', note: '120×60 studs' },
    { c: 1, r: 2, plate: 60, name: '26×50 cm', note: '60×120 studs' },
    { c: 2, r: 2, plate: 60, name: '50×50 cm', note: '120×120 studs' },
    { c: 3, r: 2, plate: 60, name: '74×50 cm', note: '180×120 studs' },
    { c: 2, r: 3, plate: 60, name: '50×74 cm', note: '120×180 studs' },
  ] },
]
export const DEFAULT_LAYOUT = FAMILIES[0].items[2]

type Props = { layout: Layout; onChange: (l: Layout) => void; onUpload: () => void; onNext: () => void; img: HTMLImageElement | null; faces: Box[]; adj: Adjust }

export default function PlatePicker({ layout, onChange, onUpload, onNext, img, faces, adj }: Props) {
  const [fam, setFam] = useState(FAMILIES.findIndex((f) => f.items.includes(layout)))
  const f = FAMILIES[fam]
  // Same photo at every size: auto-crop on the faces for that aspect, then the real engine on the 40 colours.
  // This is the "test the same photograph at different sizes" view; pick the smallest size whose face still reads.
  const previews = useMemo(() => {
    if (!img || fam !== 0) return {} as Record<string, number[]>
    return Object.fromEntries(f.items.map((l) => {
      const W = l.c * l.plate, H = l.r * l.plate
      const crop = autoCrop(faces, img.width, img.height, W / H)
      return [l.name, quantize(sampleGrid(img, crop, W, H, adj, faces), PALETTE.length, adj.dither, W, adj.metric)]
    }))
  }, [img, faces, adj, fam]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="maker">
      <TitleBar>Select the art size</TitleBar>
      <div className="family-tabs">
        {FAMILIES.map((x, i) => (
          <button key={x.title} className={'family-tab' + (i === fam ? ' active' : '')} onClick={() => { setFam(i); onChange(FAMILIES[i].items[i === 0 ? 3 : 0]) }}>
            {x.title}<small>{x.items[0].plate}×{x.items[0].plate} {x.items[0].plate === 24 ? 'baseplates · 19.2 cm' : 'panels · 26 cm'}</small>
          </button>
        ))}
      </div>
      {[f].map((f) => (
        <div key={f.title}>
          <div className="tiles">
            {f.items.map((l) => {
              const sel = l === layout
              const px = l.plate === 24 ? Math.floor(120 / Math.max(l.c, l.r)) - 2 : 26
              const g = previews[l.name]
              const W = l.c * l.plate, H = l.r * l.plate
              return (
                <button key={l.name} className={'tile' + (sel ? ' selected' : '')} onClick={() => onChange(l)}>
                  <div className="tile-art" style={{ height: 120 }}>
                    {g ? <MosaicCanvas grid={g} w={W} h={H} px={Math.max(1, Math.floor(116 / Math.max(W, H)))} className="tile-mosaic" /> : (
                      <div className="plates" style={{ gridTemplateColumns: `repeat(${l.c}, ${px}px)` }}>
                        {Array.from({ length: l.c * l.r }, (_, i) => <span key={i} style={{ width: px, height: px }} />)}
                      </div>
                    )}
                  </div>
                  <div className="tile-label"><b>{l.name}</b><span>{l.note} · {(l.c * l.r * l.plate * l.plate).toLocaleString()} pcs</span></div>
                </button>
              )
            })}
          </div>
        </div>
      ))}
      <p className="hint center">{f.items[0].plate === 24
        ? (img ? 'Live preview of your photo at each size, auto-cropped on the faces. 24×24 = one baseplate, 576 bricks, 19.2 cm.' : '8 mm bricks · 24×24 baseplate = 576 bricks = 19.2×19.2 cm. Load a photo to preview it at every size.')
        : 'Not our product: 60×60 panels of 4 mm bricks (26 cm), kept only to compare with the reference shop.'}</p>
      <StepFooter onNext={onNext} nextLabel="Next">
        <button className="pill ghost" onClick={onUpload}>Upload Photo</button>
      </StepFooter>
    </div>
  )
}
