import { PALETTE } from '../mosaic'

export default function Header({ onSample, onUpload }: { onSample: (url: string) => void; onUpload: () => void }) {
  return (
    <>
      <div className="colorbar" aria-hidden>{PALETTE.map((p) => <span key={p.code} style={{ background: p.hex }} />)}</div>
      <header className="site-header">
        <a className="wordmark" href="#top"><span className="mark" />PIECES <em>&amp;</em> BRICKS</a>
        <nav>
          <button className="pill ghost" onClick={() => onSample('/samples/single.webp')}>Sample · Portrait</button>
          <button className="pill ghost" onClick={() => onSample('/samples/family.webp')}>Sample · Family</button>
          <button className="pill primary" onClick={onUpload}>Upload photo</button>
        </nav>
      </header>
    </>
  )
}
