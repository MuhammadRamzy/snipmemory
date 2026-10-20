// Client-side image processing: downscale + JPEG encode before upload (keeps R2
// storage and mobile data small) and optional face anonymisation on the front view.

const MAX_EDGE = 1440;
const QUALITY = 0.82;

type Source = HTMLVideoElement | HTMLImageElement | ImageBitmap;

function dimensions(source: Source) {
  if (source instanceof HTMLVideoElement) return { w: source.videoWidth, h: source.videoHeight };
  if (source instanceof HTMLImageElement) return { w: source.naturalWidth, h: source.naturalHeight };
  return { w: source.width, h: source.height };
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Uses the Shape Detection API where available (Chrome/Android), otherwise null. */
async function detectFaces(canvas: HTMLCanvasElement): Promise<Box[] | null> {
  const Detector = (window as unknown as { FaceDetector?: new (o: object) => { detect(c: HTMLCanvasElement): Promise<{ boundingBox: DOMRectReadOnly }[]> } }).FaceDetector;
  if (!Detector) return null;
  try {
    const faces = await new Detector({ fastMode: true, maxDetectedFaces: 3 }).detect(canvas);
    return faces.map((f) => f.boundingBox);
  } catch {
    return null;
  }
}

/** Pixelates the inside of an ellipse — irreversible, unlike a light blur. */
function pixelateEllipse(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number) {
  const { canvas } = ctx;
  const block = Math.max(8, Math.round(canvas.width / 40));
  const small = document.createElement('canvas');
  small.width = Math.ceil(canvas.width / block);
  small.height = Math.ceil(canvas.height / block);
  const sctx = small.getContext('2d')!;
  sctx.drawImage(canvas, 0, 0, small.width, small.height);
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(small, 0, 0, canvas.width, canvas.height);
  ctx.restore();
}

export async function processPhoto(source: Source, opts: { blurFace?: boolean } = {}): Promise<{ blob: Blob; blurred: boolean }> {
  const { w, h } = dimensions(source);
  const scale = Math.min(1, MAX_EDGE / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);

  let blurred = false;
  if (opts.blurFace) {
    const faces = await detectFaces(canvas);
    if (faces && faces.length) {
      // Cover eyes → mouth but stop short of the hairline so the cut stays visible.
      for (const f of faces) pixelateEllipse(ctx, f.x + f.width / 2, f.y + f.height * 0.58, f.width * 0.55, f.height * 0.5);
    } else {
      // Fall back to the face zone of the on-screen guide.
      pixelateEllipse(ctx, canvas.width * 0.5, canvas.height * 0.56, canvas.width * 0.16, canvas.height * 0.15);
    }
    blurred = true;
  }

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode image'))), 'image/jpeg', QUALITY),
  );
  return { blob, blurred };
}

export async function fileToImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
