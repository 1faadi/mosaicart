import MosaicCanvas from './MosaicCanvas'

export default function Hero({ grid, w, h, caption, onStart }: { grid: number[]; w: number; h: number; caption: string; onStart: () => void }) {
  return (
    <section className="hero" id="top">
      <div className="hero-art">
        <div className="frame">{grid.length ? <MosaicCanvas grid={grid} w={w} h={h} px={Math.max(4, Math.floor(420 / w))} /> : <div className="frame-empty" />}</div>
        <div className="hero-caption">{caption} · {w}×{h} studs · {(w * h).toLocaleString()} bricks</div>
      </div>
      <div className="hero-copy">
        <h1>Turn Your Photos into<br />Brick Mosaic Art</h1>
        <ul className="bullets">
          <li><b>Perfect for Portraits</b><span>Face-aware cropping and skin-tone colour correction</span></li>
          <li><b>40 Official Brick Colours</b><span>Every brick matched to a real colour we stock</span></li>
          <li><b>Exact Brick Counts</b><span>24×24 baseplates · 576 bricks each · edit and watch counts update</span></li>
        </ul>
        <button className="pill primary lg" onClick={onStart}>Upload &amp; Preview Now</button>
        <p className="fine">Free instant preview · 100% in your browser · nothing uploaded</p>
      </div>
    </section>
  )
}
