import { useMemo } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import type { Box } from '../face'
import { quantize, sampleGrid, type Adjust } from '../mosaic'
import MosaicCanvas from './MosaicCanvas'
import { StepFooter, TitleBar } from './StepBar'

type Props = {
  src: string; img: HTMLImageElement | null; faces: Box[]; aspect: number
  candidates: Box[]; initialCrop: Box | undefined; onPickCandidate: (b: Box) => void
  crop: { x: number; y: number }; zoom: number; onCrop: (c: { x: number; y: number }) => void; onZoom: (z: number) => void
  onArea: (a: Area) => void; adj: Adjust; onPrev: () => void; onNext: () => void
}

export default function CropStep(p: Props) {
  // 4 suggested crops rendered as small mosaics, like the reference's thumbnail strip
  const thumbs = useMemo(() => {
    if (!p.img) return []
    const tw = 30, th = Math.round(30 / p.aspect)
    return p.candidates.map((c) => quantize(sampleGrid(p.img!, c, tw, th, p.adj, p.faces), 20, p.adj.dither, tw, p.adj.metric))
  }, [p.img, p.candidates, p.aspect, p.adj, p.faces])
  const tw = 30, th = Math.round(30 / p.aspect)

  return (
    <div className="maker">
      <TitleBar>Crop photo <small>{p.faces.length} face{p.faces.length === 1 ? '' : 's'} detected</small></TitleBar>
      <div className="thumbs">
        {thumbs.map((g, i) => (
          <button key={i} className={'thumb' + (p.initialCrop === p.candidates[i] ? ' selected' : '')} onClick={() => p.onPickCandidate(p.candidates[i])}>
            <MosaicCanvas grid={g} w={tw} h={th} px={3} />
          </button>
        ))}
      </div>
      <div className="cropper" style={{ aspectRatio: p.aspect }}>
        {p.initialCrop && (
          <Cropper key={p.src + p.aspect + p.initialCrop.x + p.initialCrop.width} image={p.src} crop={p.crop} zoom={p.zoom} aspect={p.aspect} maxZoom={6}
            initialCroppedAreaPixels={p.initialCrop} showGrid
            onCropChange={p.onCrop} onZoomChange={p.onZoom}
            onCropComplete={(_, px) => { if (px.width > 0 && px.height > 0) p.onArea(px) }} />
        )}
      </div>
      <div className="zoomrow">
        <button className="round" onClick={() => p.onZoom(Math.max(1, p.zoom - 0.2))}>−</button>
        <input type="range" min={1} max={6} step={0.01} value={p.zoom} onChange={(e) => p.onZoom(+e.target.value)} />
        <button className="round" onClick={() => p.onZoom(Math.min(6, p.zoom + 0.2))}>+</button>
      </div>
      <StepFooter onPrev={p.onPrev} onNext={p.onNext} />
    </div>
  )
}
