import { PALETTE, countBricks } from '../mosaic'
import MosaicCanvas from './MosaicCanvas'
import { StepFooter, TitleBar } from './StepBar'

type Plate = { label: string; cells: number[] }
type Props = {
  grid: number[]; W: number; H: number; plate: number; counts: Map<number, number>; plates: Plate[]
  replaceFrom: number | null; onReplaceFrom: (i: number | null) => void; onReplace: (from: number, to: number) => void
  onPrev: () => void; onPrint: () => void; onCsv: () => void
}

export default function BricksStep(p: Props) {
  const total = p.grid.length
  const sorted = [...p.counts].sort((a, b) => b[1] - a[1])
  return (
    <div className="maker bricks">
      <div className="bricks-top">
        <div className="frame sm">{p.grid.length ? <MosaicCanvas grid={p.grid} w={p.W} h={p.H} px={Math.max(3, Math.floor(300 / Math.max(p.W, p.H)))} /> : null}</div>
        <div className="bricks-summary">
          <h2>Your brick art</h2>
          <div className="stats">
            <div><b>{p.plates.length}</b><span>baseplate{p.plates.length > 1 ? 's' : ''}</span></div>
            <div><b>{total}</b><span>bricks</span></div>
            <div><b>{p.counts.size}</b><span>colours</span></div>
          </div>
          <div className="row">
            <button className="pill primary" onClick={p.onPrint}>Print assembly instructions</button>
            <button className="pill ghost" onClick={p.onCsv}>Download CSV</button>
          </div>
          <p className="fine">Editor, counts, per-plate list, CSV and the printed guide all come from the same brick matrix.</p>
        </div>
      </div>

      <TitleBar>Bricks required <small>{p.counts.size} colours · {total} pcs</small></TitleBar>
      {p.replaceFrom !== null && (
        <p className="replace-banner">Replace all <b>{PALETTE[p.replaceFrom].code} {PALETTE[p.replaceFrom].name}</b> ({p.counts.get(p.replaceFrom)} pcs) with… click a row. <button className="pill ghost sm" onClick={() => p.onReplaceFrom(null)}>cancel</button></p>
      )}
      <table className="bom">
        <thead><tr><th>#</th><th></th><th>Code</th><th>Colour</th><th className="num">Qty</th>{p.plates.length > 1 && p.plates.map((pl) => <th key={pl.label} className="num">{pl.label}</th>)}<th /></tr></thead>
        <tbody>
          {sorted.map(([i, n], k) => (
            <tr key={i} className={p.replaceFrom !== null ? 'target' : ''} onClick={() => p.replaceFrom !== null && p.replaceFrom !== i && p.onReplace(p.replaceFrom, i)}>
              <td className="num muted">{k + 1}</td>
              <td><span className="swatch" style={{ background: PALETTE[i].hex }} /></td>
              <td><b>{PALETTE[i].code}</b></td><td>{PALETTE[i].name}</td>
              <td className="num"><b>{n}</b></td>
              {p.plates.length > 1 && p.plates.map((pl) => <td key={pl.label} className="num muted">{countBricks(pl.cells).get(i) || ''}</td>)}
              <td>{p.replaceFrom === null && <button className="round sm" title="Replace this colour everywhere" onClick={(e) => { e.stopPropagation(); p.onReplaceFrom(i) }}>⇄</button>}</td>
            </tr>
          ))}
        </tbody>
        <tfoot><tr><td colSpan={4}>Total</td><td className="num">{total}</td>{p.plates.length > 1 && p.plates.map((pl) => <td key={pl.label} className="num">{p.plate * p.plate}</td>)}<td /></tr></tfoot>
      </table>
      <StepFooter onPrev={p.onPrev} prevLabel="Back to editor" />
    </div>
  )
}
