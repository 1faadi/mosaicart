import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision'

export type Box = { x: number; y: number; width: number; height: number }

let detector: Promise<FaceDetector> | null = null

// BlazeFace short-range (MediaPipe), runs in-browser. Returns face boxes in image pixels.
export async function detectFaces(img: HTMLImageElement): Promise<Box[]> {
  detector ??= FilesetResolver.forVisionTasks('/wasm').then((wasm) =>
    FaceDetector.createFromOptions(wasm, {
      baseOptions: { modelAssetPath: '/models/blaze_face_short_range.tflite' },
      runningMode: 'IMAGE',
      minDetectionConfidence: 0.5,
    }),
  )
  try {
    const d = await detector
    return d.detect(img).detections.map((det) => {
      const b = det.boundingBox!
      return { x: b.originX, y: b.originY, width: b.width, height: b.height }
    })
  } catch (e) {
    console.warn('face detection unavailable', e)
    return []
  }
}

// Square-ish crop that frames all faces with headroom, like the reference's suggested crops.
export function autoCrop(faces: Box[], imgW: number, imgH: number, aspect: number): Box {
  if (!faces.length) {
    const w = Math.min(imgW, imgH * aspect)
    return { x: (imgW - w) / 2, y: (imgH - w / aspect) / 2, width: w, height: w / aspect }
  }
  const x0 = Math.min(...faces.map((f) => f.x)), y0 = Math.min(...faces.map((f) => f.y))
  const x1 = Math.max(...faces.map((f) => f.x + f.width)), y1 = Math.max(...faces.map((f) => f.y + f.height))
  const fw = x1 - x0, fh = y1 - y0
  // tight framing like the reference's suggested crop: ~15% sideways, ~25% above/below
  let w = fw * 1.3, h = fh * 1.55
  if (w / h > aspect) h = w / aspect; else w = h * aspect
  w = Math.min(w, imgW); h = Math.min(h, imgH)
  if (w / h > aspect) w = h * aspect; else h = w / aspect
  const cx = (x0 + x1) / 2, cy = y0 + fh * 0.5
  const x = Math.max(0, Math.min(imgW - w, cx - w / 2))
  const y = Math.max(0, Math.min(imgH - h, cy - h / 2))
  return { x, y, width: w, height: h }
}
