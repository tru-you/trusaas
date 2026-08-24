import React from 'react';
import { Pen, X } from 'lucide-react';

export interface SignaturePadProps {
  /** Current signature data URL, or null when empty. */
  value?: string | null;
  /** Fires when drawing ends (mouse up / touch end) with the new data URL,
   *  and when cleared with null. */
  onChange?: (dataUrl: string | null) => void;
  /** Heading text above the canvas. Default "Digital signature". */
  label?: string;
  /** Canvas height in px. Default 120. */
  height?: number;
  /** Optional wrapper class. */
  className?: string;
  /** When true, the pad cannot be edited (value is still rendered). */
  disabled?: boolean;
}

/** A drawn-signature capture pad, lifted out of TradeInSummary so the VIR and
 *  the TruLens shoot report can carry the same control. Mirrors the trade-in
 *  UX: white pad, dark ink, "Clear" to start over. Data URL is the contract —
 *  it travels with the vehicle and renders straight into the printed report. */
export const SignaturePad: React.FC<SignaturePadProps> = ({
  value,
  onChange,
  label = 'Digital signature',
  height = 120,
  className = '',
  disabled = false,
}) => {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = React.useState(false);
  const [hasStrokes, setHasStrokes] = React.useState(false);

  // Paint the existing value on mount / when value changes externally, so a
  // reloaded vehicle shows the signature the inspector already drew.
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (value) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setHasStrokes(true);
      };
      img.src = value;
    } else {
      setHasStrokes(false);
    }
  }, [value]);

  const position = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      const t = e.touches[0] || e.changedTouches[0];
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const beginStroke = (e: React.TouchEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const p = position(e);
    ctx.strokeStyle = '#0B0F17';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    setIsDrawing(true);
  };

  const moveStroke = (e: React.TouchEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || disabled) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const p = position(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    setHasStrokes(true);
  };

  const endStroke = (e?: React.TouchEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e?.preventDefault?.();
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (!canvas || !onChange) return;
    // Only emit a change if there's actual ink on the canvas — don't fire
    // "empty" signatures on every click that never moved.
    if (hasStrokes) onChange(canvas.toDataURL('image/png'));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasStrokes(false);
    onChange?.(null);
  };

  return (
    <div className={`rounded-xl border border-neutral-800 bg-neutral-900/70 p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[13px] font-medium text-cyan-400 flex items-center gap-2">
          <Pen size={14} /> {label}
        </h3>
        {hasStrokes && !disabled && (
          <button
            type="button"
            onClick={clear}
            className="text-[12px] text-neutral-500 hover:text-rose-400 flex items-center gap-1 cursor-pointer"
          >
            <X size={12} /> Clear
          </button>
        )}
      </div>
      <canvas
        ref={canvasRef}
        width={640}
        height={height * 2}
        style={{ height }}
        className={`w-full bg-white rounded-lg border border-neutral-300 ${disabled ? '' : 'touch-none cursor-crosshair'}`}
        onMouseDown={beginStroke}
        onMouseMove={moveStroke}
        onMouseUp={endStroke}
        onMouseLeave={endStroke}
        onTouchStart={beginStroke}
        onTouchMove={moveStroke}
        onTouchEnd={endStroke}
      />
      <p className="text-[11px] text-neutral-500 mt-2 leading-snug">
        Draw your signature in the box above. It will be printed on the report.
      </p>
    </div>
  );
};
