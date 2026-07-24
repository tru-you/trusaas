import React from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import { X, ScanLine, Loader2, AlertCircle, Zap, ZapOff, Camera } from 'lucide-react';
import { parseSaDisc, type DiscScan } from '../lib/saDisc';

/**
 * Scan a South African vehicle licence disc and hand back its fields.
 *
 * The disc carries a PDF417 barcode with make, model, colour, VIN and expiry in
 * plaintext. Live-video decoding proved unreliable — up close the camera can't
 * focus and motion blurs the fine bars — so the primary path is a MANUAL,
 * one-tap capture: the dealer lines the barcode up in the box and taps, we grab
 * a crisp full-resolution still, and decode THAT with whichever engine works:
 *
 *  - Native BarcodeDetector (pdf417) when present — best on Android Chrome.
 *  - zxing-js on the still image as a fallback (e.g. iOS Safari).
 *
 * A live loop also runs opportunistically, so a clean, steady frame can lock on
 * without a tap. Either way a miss just closes and the dealer types as before.
 */
export default function DiscScanner({
  onResult,
  onClose,
}: {
  onResult: (scan: DiscScan) => void;
  onClose: () => void;
}) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const detectorRef = React.useRef<any>(null);      // native BarcodeDetector, if usable
  const zxingRef = React.useRef<BrowserMultiFormatReader | null>(null);
  const rafRef = React.useRef<number | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const doneRef = React.useRef(false);
  const [status, setStatus] = React.useState<'starting' | 'scanning' | 'error'>('starting');
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [torchOn, setTorchOn] = React.useState(false);
  const [torchSupported, setTorchSupported] = React.useState(false);
  const [reading, setReading] = React.useState(false);
  const [hint, setHint] = React.useState<string | null>(null);
  const [diag, setDiag] = React.useState<string>('');

  // Latest onResult without making it an effect dependency.
  const onResultRef = React.useRef(onResult);
  onResultRef.current = onResult;

  const stopEverything = React.useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const finish = React.useCallback((payload: string) => {
    if (doneRef.current) return;
    doneRef.current = true;
    stopEverything();
    onResultRef.current(parseSaDisc(payload));
  }, [stopEverything]);

  // Decode a single still frame with whatever engine is available. Returns the
  // payload string, or null if nothing decoded.
  const decodeStill = React.useCallback(async (): Promise<string | null> => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) return null;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Native detector first — reads pdf417 straight off the canvas.
    if (detectorRef.current) {
      try {
        const codes = await detectorRef.current.detect(canvas);
        if (codes && codes.length && codes[0].rawValue) return codes[0].rawValue as string;
      } catch { /* fall through to zxing */ }
    }
    // zxing on the still image.
    try {
      if (!zxingRef.current) {
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.PDF_417]);
        hints.set(DecodeHintType.TRY_HARDER, true);
        zxingRef.current = new BrowserMultiFormatReader(hints);
      }
      const dataUrl = canvas.toDataURL('image/png');
      const res = await zxingRef.current.decodeFromImageUrl(dataUrl);
      if (res) return res.getText();
    } catch { /* no code in this frame */ }
    return null;
  }, []);

  const captureAndRead = React.useCallback(async () => {
    if (doneRef.current || reading) return;
    setReading(true);
    setHint(null);
    // Try the current frame plus a couple of quick retries — helps if the first
    // grab caught a mid-focus frame.
    let payload: string | null = null;
    for (let i = 0; i < 3 && !payload; i++) {
      payload = await decodeStill();
      if (!payload) await new Promise((r) => setTimeout(r, 250));
    }
    setReading(false);
    if (payload) finish(payload);
    else setHint('No barcode read — fill the box with just the barcode, hold steady, torch on if shiny.');
  }, [decodeStill, finish, reading]);

  // Lazily build a native pdf417 detector (may not exist / may not support it).
  const ensureDetector = React.useCallback(async () => {
    if (detectorRef.current) return detectorRef.current;
    const BD: any = (window as any).BarcodeDetector;
    if (!BD) return null;
    try {
      const formats: string[] = await BD.getSupportedFormats();
      if (formats.includes('pdf417')) detectorRef.current = new BD({ formats: ['pdf417'] });
    } catch { detectorRef.current = null; }
    return detectorRef.current;
  }, []);

  // Decode a still PHOTO taken with the phone's real camera (full resolution,
  // properly focused) — far more likely to read than a live video frame.
  const decodeImageFile = React.useCallback(async (file: File) => {
    if (doneRef.current) return;
    setReading(true);
    setHint(null);
    const url = URL.createObjectURL(file);
    let payload: string | null = null;
    try {
      const detector = await ensureDetector();
      if (detector) {
        try {
          const bmp = await createImageBitmap(file);
          const codes = await detector.detect(bmp);
          (bmp as any).close?.();
          if (codes && codes.length && codes[0].rawValue) payload = codes[0].rawValue as string;
        } catch { /* fall through */ }
      }
      if (!payload) {
        if (!zxingRef.current) {
          const hints = new Map();
          hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.PDF_417]);
          hints.set(DecodeHintType.TRY_HARDER, true);
          zxingRef.current = new BrowserMultiFormatReader(hints);
        }
        try {
          const res = await zxingRef.current.decodeFromImageUrl(url);
          if (res) payload = res.getText();
        } catch { /* no code in this photo */ }
      }
    } finally {
      URL.revokeObjectURL(url);
    }
    setReading(false);
    if (payload) finish(payload);
    else setHint('No barcode in that photo — get closer so the barcode fills the frame, then retake.');
  }, [ensureDetector, finish]);

  React.useEffect(() => {
    doneRef.current = false;
    let cancelled = false;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 3840 },
            height: { ideal: 2160 },
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current!;
        video.srcObject = stream;
        try { await video.play(); } catch { /* autoplay policy */ }
        setStatus('scanning');

        const track = stream.getVideoTracks()[0];
        const caps: any = track?.getCapabilities?.() || {};
        if (caps.torch) setTorchSupported(true);

        // Set up native BarcodeDetector if it can do pdf417, and record what
        // this device actually supports so a failed read is diagnosable.
        const BD: any = (window as any).BarcodeDetector;
        if (!BD) {
          setDiag('no native scanner (zxing)');
        } else {
          try {
            const formats: string[] = await BD.getSupportedFormats();
            if (formats.includes('pdf417')) {
              detectorRef.current = new BD({ formats: ['pdf417'] });
              setDiag('native pdf417 ✓');
            } else {
              setDiag('native, no pdf417 (zxing)');
            }
          } catch { detectorRef.current = null; setDiag('native error (zxing)'); }
        }

        // Opportunistic live loop — a clean steady frame can lock without a tap.
        const tick = async () => {
          if (cancelled || doneRef.current) return;
          const payload = await decodeStill();
          if (payload) { finish(payload); return; }
          rafRef.current = requestAnimationFrame(() =>
            setTimeout(() => { rafRef.current = requestAnimationFrame(tick); }, 350) as unknown as number,
          );
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch (e: any) {
        if (cancelled) return;
        setStatus('error');
        setErrorMsg(
          /permission|denied|notallowed/i.test(String(e?.name || e))
            ? 'Camera blocked. Allow camera access, or type the details in.'
            : 'Could not start the camera. Type the details in instead.',
        );
      }
    })();

    return () => {
      cancelled = true;
      stopEverything();
    };
    // Mount once — camera lifecycle must not restart on parent re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn } as any] });
      setTorchOn((v) => !v);
    } catch { /* torch unavailable */ }
  };

  return (
    <div className="fixed inset-0 z-[400] bg-[#06080D] flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <span className="text-[13px] font-semibold text-[#E8EAE6] flex items-center gap-2">
          <ScanLine size={16} className="text-[#4FE3DC]" /> Scan licence disc
        </span>
        <div className="flex items-center gap-1">
          {torchSupported && status === 'scanning' && (
            <button
              onClick={toggleTorch}
              aria-label="Toggle torch"
              className="text-[rgba(232,234,230,0.72)] hover:text-[#E8EAE6] p-1"
            >
              {torchOn ? <Zap size={18} className="text-[#4FE3DC]" /> : <ZapOff size={18} />}
            </button>
          )}
          <button onClick={onClose} aria-label="Close" className="text-[rgba(232,234,230,0.72)] hover:text-[#E8EAE6] p-1">
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden bg-black">
        <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
        <canvas ref={canvasRef} className="hidden" />

        {status === 'scanning' && (
          <>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-[86%] aspect-[3/2] rounded-xl border-2 border-[#4FE3DC]/70 shadow-[0_0_0_100vmax_rgba(6,8,13,0.55)]" />
            </div>
            <p className="absolute top-4 left-0 right-0 text-center text-[13px] text-[#E8EAE6] px-6">
              {hint || 'Tap “Take a photo” and fill the frame with just the barcode.'}
            </p>
            {diag && (
              <span className="absolute top-1 left-1/2 -translate-x-1/2 text-[10px] font-mono text-[rgba(232,234,230,0.4)]">
                {diag}
              </span>
            )}
          </>
        )}

        {status === 'starting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[rgba(232,234,230,0.72)]">
            <Loader2 size={22} className="animate-spin text-[#4FE3DC]" />
            <span className="text-[13px]">Starting camera…</span>
          </div>
        )}

        {status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
            <AlertCircle size={24} className="text-[#C07676]" />
            <p className="text-[13px] text-[rgba(232,234,230,0.72)]">{errorMsg}</p>
            <button onClick={onClose} className="mt-1 px-4 py-2 rounded-full bg-[#4FE3DC] text-[#06080D] text-[13px] font-semibold flex items-center gap-2">
              <Camera size={15} /> Type it in
            </button>
          </div>
        )}
      </div>

      {/* Photo capture works even if the live camera failed to start. */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) decodeImageFile(f);
        }}
      />

      {status !== 'starting' && (
        <div className="p-4 border-t border-white/10 space-y-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={reading}
            className="w-full py-3.5 rounded-2xl flex items-center justify-center gap-2.5 font-semibold text-sm bg-[#4FE3DC] text-[#06080D] active:scale-[0.98] transition-all disabled:opacity-60"
          >
            {reading ? <><Loader2 size={18} className="animate-spin" /> Reading…</> : <><Camera size={18} strokeWidth={2.5} /> Take a photo of the barcode</>}
          </button>
          {status === 'scanning' && (
            <button
              type="button"
              onClick={captureAndRead}
              disabled={reading}
              className="w-full py-2.5 rounded-2xl flex items-center justify-center gap-2 font-semibold text-[13px] bg-white/5 border border-white/15 text-[#E8EAE6] active:scale-[0.98] transition-all disabled:opacity-60"
            >
              <ScanLine size={16} /> Or read from live view
            </button>
          )}
        </div>
      )}
    </div>
  );
}
