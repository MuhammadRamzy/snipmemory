import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { fileToImage, processPhoto } from '../lib/image';
import type { Angle } from '../lib/types';
import { Icons } from './icons';
import { Button, Toggle } from './ui';
import { ANGLES } from './VisitCard';

export interface CapturedPhoto {
  angle: Angle;
  blob: Blob;
  url: string;
  blurred: boolean;
}

/** Head outlines that help every stylist frame the same shot each time. */
function Guide({ angle }: { angle: Angle }) {
  const stroke = 'rgba(255,255,255,0.85)';
  const common = { fill: 'none', stroke, strokeWidth: 0.6, strokeDasharray: '2 1.5' };
  return (
    <svg viewBox="0 0 60 80" className="pointer-events-none absolute inset-0 size-full" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      {angle === 'front' && (
        <>
          <ellipse cx="30" cy="36" rx="12" ry="15.5" {...common} />
          <path d="M14 78c1-11 7-16 16-16s15 5 16 16" {...common} />
          <path d="M18 30c2-9 7-13 12-13s10 4 12 13" {...common} strokeDasharray="0" strokeOpacity="0.5" />
        </>
      )}
      {(angle === 'left' || angle === 'right') && (
        <g transform={angle === 'right' ? 'translate(60 0) scale(-1 1)' : undefined}>
          <path d="M22 22c3-6 11-8 17-5 6 3 8 10 7 17-1 6-4 9-4 13v5h-6v4H25l-3-5c-3-1-5-3-5-6l2-4-2-3 3-3c0-5 0-9 2-13z" {...common} />
          <circle cx="36" cy="38" r="2.5" {...common} />
          <path d="M16 78c1-10 7-15 16-15s14 5 15 15" {...common} />
        </g>
      )}
      {angle === 'back' && (
        <>
          <ellipse cx="30" cy="35" rx="13" ry="16" {...common} />
          <path d="M22 50h16" {...common} strokeDasharray="0" />
          <path d="M14 78c1-11 7-16 16-16s15 5 16 16" {...common} />
        </>
      )}
      <line x1="30" y1="2" x2="30" y2="78" stroke={stroke} strokeOpacity="0.15" strokeWidth="0.3" />
    </svg>
  );
}

const HINTS: Record<Angle, string> = {
  front: 'Face the client. Line the eyes up with the guide.',
  left: 'Client’s left side. Ear in the circle.',
  right: 'Client’s right side. Ear in the circle.',
  back: 'Behind the client. Show the neckline.',
  detail: 'Close-up of any detail.',
};

export function Camera({
  startAngle,
  sequence,
  reference,
  onCapture,
  onClose,
}: {
  startAngle: Angle;
  /** When true, advances front → left → right → back automatically. */
  sequence: boolean;
  /** Last time's photos, shown as a small reference while shooting. */
  reference?: Partial<Record<Angle, string>>;
  onCapture: (photo: CapturedPhoto) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [angle, setAngle] = useState<Angle>(startAngle);
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [error, setError] = useState<string | null>(null);
  const [blur, setBlur] = useState(false);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false });
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        setError(null);
      } catch {
        setError('Camera unavailable. Allow camera access, or upload a photo instead.');
      }
    })();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [facing]);

  const finish = (photo: CapturedPhoto) => {
    onCapture(photo);
    const index = ANGLES.findIndex((a) => a.id === photo.angle);
    if (sequence && index >= 0 && index < ANGLES.length - 1) setAngle(ANGLES[index + 1].id);
    else onClose();
  };

  const shoot = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    setBusy(true);
    setFlash(true);
    setTimeout(() => setFlash(false), 120);
    try {
      const { blob, blurred } = await processPhoto(video, { blurFace: blur && angle === 'front' });
      finish({ angle, blob, blurred, url: URL.createObjectURL(blob) });
    } finally {
      setBusy(false);
    }
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const img = await fileToImage(file);
      const { blob, blurred } = await processPhoto(img, { blurFace: blur && angle === 'front' });
      finish({ angle, blob, blurred, url: URL.createObjectURL(blob) });
    } catch {
      setError('Could not read that image.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  // Portal to <body>: animated ancestors would otherwise trap this fixed overlay.
  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white" role="dialog" aria-modal="true" aria-label="Camera">
      <div className="flex items-center justify-between gap-3 p-3">
        <button onClick={onClose} className="rounded-full bg-white/10 p-2" aria-label="Close camera">
          <Icons.x />
        </button>
        <div className="flex gap-1 rounded-full bg-white/10 p-1 text-sm">
          {ANGLES.map((a) => (
            <button key={a.id} onClick={() => setAngle(a.id)} className={`rounded-full px-3 py-1 font-medium ${angle === a.id ? 'bg-white text-black' : 'text-white/80'}`}>
              {a.label}
            </button>
          ))}
        </div>
        <button onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))} className="rounded-full bg-white/10 p-2" aria-label="Switch camera">
          <Icons.repeat />
        </button>
      </div>

      <div className="relative mx-auto aspect-[3/4] w-full max-w-md flex-1 overflow-hidden sm:rounded-2xl" style={{ maxHeight: 'calc(100dvh - 190px)' }}>
        {!error ? (
          <video ref={videoRef} playsInline muted className={`size-full object-cover ${facing === 'user' ? '-scale-x-100' : ''}`} />
        ) : (
          <div className="grid size-full place-items-center p-8 text-center text-sm text-white/80">{error}</div>
        )}
        <Guide angle={angle} />
        {flash && <div className="absolute inset-0 bg-white/70" />}
        {reference?.[angle] && (
          <div className="absolute right-2 top-2 w-20 overflow-hidden rounded-lg border-2 border-white/70 shadow-lg">
            <img src={reference[angle]} alt="Last time" className="aspect-[3/4] w-full object-cover" />
            <p className="bg-black/70 py-0.5 text-center text-[10px] font-semibold">Last time</p>
          </div>
        )}
        <p className="absolute inset-x-0 bottom-3 mx-auto w-fit rounded-full bg-black/60 px-3 py-1 text-center text-xs">{HINTS[angle]}</p>
      </div>

      <div className="safe-bottom flex items-center justify-between gap-4 px-6 pt-4">
        <div className="w-24">
          {angle === 'front' && (
            <div className="[&_*]:text-white">
              <Toggle checked={blur} onChange={setBlur} label="Hide face" />
            </div>
          )}
        </div>
        <button
          onClick={shoot}
          disabled={busy || Boolean(error)}
          className="grid size-18 place-items-center rounded-full border-4 border-white transition active:scale-95 disabled:opacity-40"
          aria-label="Take photo"
        >
          <span className="size-14 rounded-full bg-white" />
        </button>
        <div className="flex w-24 justify-end">
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
          <Button variant="ghost" size="sm" className="text-white hover:bg-white/10" onClick={() => fileRef.current?.click()}>
            <Icons.upload size={16} /> Upload
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
