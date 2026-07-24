import React from 'react';
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import { X, ScanLine, Loader2, AlertCircle, Zap, ZapOff, Camera } from 'lucide-react';
import { parseSaDisc, type DiscScan } from '../lib/saDisc';

/**
 * Scan a South African vehicle licence disc and hand back its fields.
 *
 * The disc carries a PDF417 barcode with make, model, colour, VIN and expiry
 * in plaintext, so this fills the Add Vehicle form without typing.
 *
 * Decoding path:
 *  1. The browser's native BarcodeDetector when it supports pdf417 (Android
 *     Chrome). It's dramatically more reliable on the dense SA disc barcode
 *     than the JS decoder — this is what makes scanning actually work.
 *  2. zxing-js as a fallback where BarcodeDetector is missing (e.g. iOS Safari).
 *
 * A failed or absent scan just closes and the dealer types as before, so it can
 * never block adding a car.
 */
export default function DiscScanner({
  onResult,
  onClose,
}: {
  onResult: (scan: DiscScan) => void;
  onClose: () => void;
}) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const zxingControlsRef = React.useRef<IScannerControls | null>(null);
  const rafRef = React.useRef<number | null>(null);
  const doneRef = React.useRef(false);
  const [status, setStatus] = React.useState<'starting' | 'scanning' | 'error'>('starting');
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [torchOn, setTorchOn] = React.useState(false);
  const [torchSupported, setTorchSupported] = React.useState(false);
  const [engine, setEngine] = React.useState<'native' | 'zxing'>('native');

  // Latest onResult without making it an effect dependency — otherwise a parent
  // re-render would tear the camera down and restart it.
  const onResultRef = React.useRef(onResult);
  onResultRef.current = onResult;

  const finish = React.useCallback((payload: string) => {
    if (doneRef.current) return;
    doneRef.current = true;
    const scan = parseSaDisc(payload);
    onResultRef.current(scan);
  }, []);

  React.useEffect(() => {
    doneRef.current = false;
    let cancelled = false;

    const startNative = async (detector: any, video: HTMLVideoElement) => {
      const tick = async () => {
        if (cancelled || doneRef.current) return;
        try {
          const codes = await detector.detect(video);
          if (codes && codes.length && codes[0].rawValue) {
            stop();
            finish(codes[0].rawValue);
            return;
          }
        } catch {
          /* transient decode error — keep trying */
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    };

    const startZxing = async (video: HTMLVideoElement) => {
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.PDF_417]);
      hints.set(DecodeHintType.TRY_HARDER, true);
      const reader = new BrowserMultiFormatReader(hints);
      zxingControlsRef.current = await reader.decodeFromVideoElement(video, (res) => {
        if (res && !doneRef.current) {
          stop();
          finish(res.getText());
        }
      });
    };

    (async () => {
      try {
        // One high-res rear-camera stream, shared by whichever engine runs.
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

        // Torch support (rear camera, Android). Feature-detected off the track.
        const track = stream.getVideoTracks()[0];
        const caps: any = track?.getCapabilities?.() || {};
        if (caps.torch) setTorchSupported(true);

        // Prefer native BarcodeDetector when it can do pdf417.
        const BD: any = (window as any).BarcodeDetector;
        let nativeOk = false;
        if (BD) {
          try {
            const formats: string[] = await BD.getSupportedFormats();
            if (formats.includes('pdf417')) {
              setEngine('native');
              await startNative(new BD({ formats: ['pdf417'] }), video);
              nativeOk = true;
            }
          } catch {
            nativeOk = false;
          }
        }
        if (!nativeOk) {
          setEngine('zxing');
          await startZxing(video);
        }
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

    function stop() {
      cancelled = true;
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      try { zxingControlsRef.current?.stop(); } catch { /* ignore */ }
      zxingControlsRef.current = null;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    }
    return stop;
    // Mount once — camera lifecycle must not restart on parent re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finish]);

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn } as any] });
      setTorchOn((v) => !v);
    } catch {
      /* torch unavailable */
    }
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

        {/* Aiming frame */}
        {status === 'scanning' && (
          <>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-[82%] aspect-[3/2] rounded-xl border-2 border-[#4FE3DC]/70 shadow-[0_0_0_100vmax_rgba(6,8,13,0.55)]" />
            </div>
            <p className="absolute bottom-6 left-0 right-0 text-center text-[13px] text-[#E8EAE6] px-6">
              Fill the box with the barcode — hold steady and let it focus.
            </p>
            <span className="absolute top-3 left-1/2 -translate-x-1/2 text-[10px] font-mono text-[rgba(232,234,230,0.4)]">
              {engine === 'native' ? 'reader: native' : 'reader: fallback'}
            </span>
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
    </div>
  );
}
