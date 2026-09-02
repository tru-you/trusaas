import React from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import { X, ScanLine, Loader2, AlertCircle, Zap, ZapOff, Camera, Pencil } from 'lucide-react';
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
  onResult: (scan: DiscScan, photo?: string) => void;
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

  const grabFrame = React.useCallback((): string | undefined => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return undefined;
    const c = canvasRef.current || document.createElement('canvas');
    c.width = video.videoWidth;
    c.height = video.videoHeight;
    c.getContext('2d')?.drawImage(video, 0, 0);
    return c.toDataURL('image/jpeg', 0.85);
  }, []);

  const finish = React.useCallback((payload: string, photo?: string) => {
    if (doneRef.current) return;
    doneRef.current = true;
    const frame = photo || grabFrame();
    stopEverything();
    onResultRef.current(parseSaDisc(payload), frame);
  }, [stopEverything, grabFrame]);

  const getZxing = React.useCallback(() => {
    if (!zxingRef.current) {
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.PDF_417]);
      hints.set(DecodeHintType.TRY_HARDER, true);
      zxingRef.current = new BrowserMultiFormatReader(hints);
    }
    return zxingRef.current;
  }, []);

  /**
   * Paint the current frame — optionally just the guide box — and try to read it.
   *
   * `heavy` decides whether zxing is allowed to run. The live loop passes false:
   * it used to encode the whole frame to a PNG data URL and hand that to zxing
   * every 350ms, which on a 4K stream is tens of megabytes of base64 per second.
   * The phone spent its budget on that instead of on autofocus, so the picture
   * never settled and the barcode never resolved — the scanner was starving the
   * thing it needed. The loop now uses only the native detector, which reads the
   * canvas directly, and zxing runs when the dealer actually taps.
   *
   * The crop matters as much: PDF417 is found far more reliably when the code
   * fills the image, and the guide box on screen is already telling the dealer
   * to frame it that way.
   */
  const decodeStill = React.useCallback(async (opts?: { heavy?: boolean; crop?: boolean }): Promise<string | null> => {
    const { heavy = true, crop = true } = opts || {};
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) return null;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    // Matches the on-screen guide: 86% of the width at 3:2.
    const cw = crop ? Math.round(vw * 0.86) : vw;
    const ch = crop ? Math.min(vh, Math.round(cw / 1.5)) : vh;
    const sx = Math.round((vw - cw) / 2);
    const sy = Math.round((vh - ch) / 2);

    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(video, sx, sy, cw, ch, 0, 0, cw, ch);

    // Native detector first — reads pdf417 straight off the canvas, no copy.
    if (detectorRef.current) {
      try {
        const codes = await detectorRef.current.detect(canvas);
        if (codes && codes.length && codes[0].rawValue) return codes[0].rawValue as string;
      } catch { /* fall through */ }
    }

    if (!heavy) return null;

    // decodeFromCanvas reads the pixels directly. The old path went through
    // canvas.toDataURL('image/png') and decodeFromImageUrl, i.e. encode a PNG,
    // base64 it, hand it back to the browser to decode again — three expensive
    // conversions to look at pixels that were already in memory.
    try {
      const res = getZxing().decodeFromCanvas(canvas);
      if (res) return res.getText();
    } catch { /* no code in this frame */ }
    return null;
  }, [getZxing]);

  const captureAndRead = React.useCallback(async () => {
    if (doneRef.current || reading) return;
    setReading(true);
    setHint(null);
    // Cropped to the guide box first, since that is what the dealer was told to
    // fill; then the whole frame, in case they framed it wide. A couple of
    // retries because the first grab often lands mid-focus.
    let payload: string | null = null;
    for (let i = 0; i < 3 && !payload; i++) {
      payload = await decodeStill({ crop: true });
      if (!payload) payload = await decodeStill({ crop: false });
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
        try {
          const res = await getZxing().decodeFromImageUrl(url);
          if (res) payload = res.getText();
        } catch { /* no code in the full photo */ }
      }
      // A phone photo of a windscreen is mostly windscreen. If the whole frame
      // did not read, try the middle of it, where the disc almost always is —
      // the same reason the live path crops to the guide box.
      if (!payload) {
        try {
          const img = new Image();
          img.src = url;
          await img.decode();
          const c = document.createElement('canvas');
          const cw = Math.round(img.naturalWidth * 0.7);
          const ch = Math.round(img.naturalHeight * 0.7);
          c.width = cw; c.height = ch;
          c.getContext('2d')?.drawImage(
            img,
            Math.round((img.naturalWidth - cw) / 2),
            Math.round((img.naturalHeight - ch) / 2),
            cw, ch, 0, 0, cw, ch,
          );
          const res = getZxing().decodeFromCanvas(c);
          if (res) payload = res.getText();
        } catch { /* no code in the centre either */ }
      }
    } finally {
      URL.revokeObjectURL(url);
    }
    setReading(false);
    if (payload) {
      const reader = new FileReader();
      reader.onload = () => finish(payload!, reader.result as string);
      reader.onerror = () => finish(payload!);
      reader.readAsDataURL(file);
    } else {
      setHint('No barcode in that photo — get closer so the barcode fills the frame, then retake.');
    }
  }, [ensureDetector, finish, getZxing]);

  React.useEffect(() => {
    doneRef.current = false;
    let cancelled = false;

    (async () => {
      try {
        // Was 3840x2160. A 4K stream is not more readable here — PDF417 needs
        // focus and contrast, not pixels — and it costs the phone the headroom
        // it needs to autofocus, which is the thing that actually decides
        // whether the code resolves. 1080p is well past what the bars need.
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            // Discs are read at arm's length through glass; ask the camera to
            // keep hunting focus rather than locking on the first frame.
            advanced: [{ focusMode: 'continuous' }] as any,
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
        // heavy:false keeps zxing out of the loop; see decodeStill.
        const tick = async () => {
          if (cancelled || doneRef.current) return;
          const payload = await decodeStill({ heavy: false, crop: true });
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
              <span className="absolute top-1 left-1/2 -translate-x-1/2 text-[12px] font-mono text-[rgba(232,234,230,0.4)]">
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
            className="w-full py-4 rounded-2xl flex items-center justify-center gap-3 font-semibold text-[16px] bg-[#4FE3DC] text-[#06080D] active:scale-[0.98] transition-all disabled:opacity-60"
          >
            {reading ? <><Loader2 size={18} className="animate-spin" /> Reading…</> : <><Camera size={18} strokeWidth={2.5} /> Take a photo of the barcode</>}
          </button>
          {status === 'scanning' && (
            <button
              type="button"
              onClick={captureAndRead}
              disabled={reading}
              className="w-full py-3 rounded-2xl flex items-center justify-center gap-2 font-semibold text-[13px] bg-white/5 border border-white/15 text-[#E8EAE6] active:scale-[0.98] transition-all disabled:opacity-60"
            >
              <ScanLine size={16} /> Or read from live view
            </button>
          )}
          {/* Fail-safe: never trap the dealer in the scanner — always a one-tap
              way out to type the details. Emphasised once a read has failed. */}
          <button
            type="button"
            onClick={onClose}
            className={`w-full py-3 rounded-2xl flex items-center justify-center gap-2 font-semibold text-[13px] active:scale-[0.98] transition-all ${
              hint
                ? 'bg-[#4FE3DC] text-[#06080D]'
                : 'text-[rgba(232,234,230,0.72)] hover:text-[#E8EAE6]'
            }`}
          >
            <Pencil size={15} /> {hint ? 'Couldn’t read it — enter manually' : 'Enter manually instead'}
          </button>
        </div>
      )}
    </div>
  );
}
