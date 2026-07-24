import React from 'react';
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import { X, ScanLine, Loader2, AlertCircle } from 'lucide-react';
import { parseSaDisc, type DiscScan } from '../lib/saDisc';

/**
 * Scan a South African vehicle licence disc and hand back its fields.
 *
 * The disc carries a PDF417 barcode with make, model, colour, VIN and expiry
 * in plaintext, so this fills the Add Vehicle form without typing — the thing
 * every dealer asked for first. Reads continuously from the live camera; the
 * moment a disc decodes, it parses and returns. A failed or absent scan simply
 * closes and the dealer types as before, so it can never block adding a car.
 */
export default function DiscScanner({
  onResult,
  onClose,
}: {
  onResult: (scan: DiscScan) => void;
  onClose: () => void;
}) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const readerRef = React.useRef<BrowserMultiFormatReader | null>(null);
  const [status, setStatus] = React.useState<'starting' | 'scanning' | 'error'>('starting');
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Keep the latest onResult without making it an effect dependency — otherwise
  // every parent re-render (the sync poll fires every few seconds) would change
  // the callback identity, tear the camera down and restart it, which looks like
  // the scanner flashing and dropping straight back to the form.
  const onResultRef = React.useRef(onResult);
  onResultRef.current = onResult;

  React.useEffect(() => {
    // Only look for PDF417 — the disc format — so it locks on fast and doesn't
    // trip over other barcodes in frame.
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.PDF_417]);
    hints.set(DecodeHintType.TRY_HARDER, true);
    const reader = new BrowserMultiFormatReader(hints);
    readerRef.current = reader;
    let done = false;
    let controls: IScannerControls | null = null;

    (async () => {
      try {
        setStatus('scanning');
        controls = await reader.decodeFromConstraints(
          { video: { facingMode: 'environment' } },
          videoRef.current!,
          (res) => {
            if (res && !done) {
              done = true;
              const scan = parseSaDisc(res.getText());
              stop();
              onResultRef.current(scan);
            }
          },
        );
        // On some mobile browsers the stream attaches but the element never
        // starts painting (black frame) unless play() is nudged explicitly.
        try { await videoRef.current?.play(); } catch { /* autoplay policies */ }
      } catch (e: any) {
        if (done) return;
        setStatus('error');
        setErrorMsg(
          /permission|denied|notallowed/i.test(String(e?.name || e))
            ? 'Camera blocked. Allow camera access, or type the details in.'
            : 'Could not start the camera. Type the details in instead.',
        );
      }
    })();

    function stop() {
      try { controls?.stop(); } catch { /* ignore */ }
    }
    return stop;
    // Mount once — camera lifecycle must not restart on parent re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[400] bg-[#06080D] flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <span className="text-[13px] font-semibold text-[#E8EAE6] flex items-center gap-2">
          <ScanLine size={16} className="text-[#4FE3DC]" /> Scan licence disc
        </span>
        <button onClick={onClose} aria-label="Close" className="text-[rgba(232,234,230,0.72)] hover:text-[#E8EAE6] p-1">
          <X size={18} />
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden bg-black">
        <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />

        {/* Aiming frame */}
        {status === 'scanning' && (
          <>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-[78%] aspect-[3/2] rounded-xl border-2 border-[#4FE3DC]/70 shadow-[0_0_0_100vmax_rgba(6,8,13,0.55)]" />
            </div>
            <p className="absolute bottom-6 left-0 right-0 text-center text-[13px] text-[#E8EAE6] px-6">
              Hold the disc inside the frame — the barcode fills the box.
            </p>
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
            <button onClick={onClose} className="mt-1 px-4 py-2 rounded-full bg-[#4FE3DC] text-[#06080D] text-[13px] font-semibold">
              Type it in
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
