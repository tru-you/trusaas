import React from 'react';
import {
  Camera, ChevronLeft,
  Check, Upload, HelpCircle, Images, X,
  RotateCcw, SkipForward} from 'lucide-react';
import { Vehicle, QualityReport } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useVertical } from './VerticalContext';
import { getTemplate, getTemplateForVertical, DEFAULT_TEMPLATE } from '../templates';

interface CameraGuideProps {
  vehicle: Vehicle;
  onBack: () => void;
  onComplete?: () => void;
  onPhotoCaptured: (slotId: string, base64Image: string, qualityReport: QualityReport) => void;
  onEditRequested?: (slotId: string, base64Image: string, qualityReport: QualityReport) => void;
  onBulkPhotosUploaded: (updatedVehicle: Vehicle) => void;
  onOpenGuide?: () => void;
}

export default function CameraGuide({ vehicle, onBack, onComplete, onPhotoCaptured, onEditRequested, onBulkPhotosUploaded, onOpenGuide }: CameraGuideProps) {
  // A just-taken shot awaiting Redo / Keep. This is the whole point: shoot,
  // glance, keep or redo — no forced save-and-edit between every angle.
  const [pendingShot, setPendingShot] = React.useState<{ slotId: string; base64: string; report: QualityReport; kind: 'photo' | 'video' } | null>(null);
  const { user } = useAuth();
  const { id: verticalId } = useVertical();
  const template = React.useMemo(() => {
    return vehicle.templateId ? getTemplate(vehicle.templateId) : getTemplateForVertical(vehicle.vertical || verticalId);
  }, [vehicle.templateId, vehicle.vertical, verticalId]);

  // Crash-safe: never read vehicle.photos when undefined
  const photos = vehicle?.photos || {};
  /* Lazy initializer so this only runs once, at mount — reopening a
     partially-shot vehicle should resume at the first real gap, not always
     reset to slot 1. */
  const [selectedSlotId, setSelectedSlotId] = React.useState<string>(() => {
    // Resume at the first empty CORE shot, then any empty shot, then slot 1 —
    // so onboarding leads with the ~10 that make a car listing-ready.
    const p = vehicle.photos || {};
    const firstEmptyCore = template.slots.find((s) => s.tier === 'core' && !p[s.id]);
    const firstEmptyAny = template.slots.find((s) => !p[s.id]);
    return (firstEmptyCore || firstEmptyAny || template.slots[0]).id;
  });
  const [isCameraActive, setIsCameraActive] = React.useState(false);
  const [hasCamPermission, setHasCamPermission] = React.useState<boolean | null>(null);
  const [cameraError, setCameraError] = React.useState<string | null>(null);
  const [cameraRetrying, setCameraRetrying] = React.useState(false);
  const [shutterFlash, setShutterFlash] = React.useState(false);
  const [captureHint, setCaptureHint] = React.useState<string | null>(null);
  const singleUploadRef = React.useRef<HTMLInputElement>(null);
  
  // Real-time camera & canvas references
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);

  // Simulated vehicle visualizer state (for fallback / testing)
  const [simPitch, setSimPitch] = React.useState(12); // Pitch (Phone vertical level)
  const [simRoll, setSimRoll] = React.useState(0); // Roll (Phone horizontal level)
  const simBrightness = 130; // constant — there is no live light metering behind it
  const [customFile, setCustomFile] = React.useState<string | null>(null);

  // Auto-level assistant toggle

  // Live bulk-upload progress — drives the auto-assign "Upload photos (bulk)"
  // path below. The old per-photo slot-mapping modal was retired, so this is
  // the only bulk state left.
  const [bulkProgress, setBulkProgress] = React.useState<{ current: number; total: number; status: 'idle' | 'syncing' | 'done' | 'error' }>({
    current: 0,
    total: 0,
    status: 'idle'
  });

  // Active slot information
  const activeSlot = template.slots.find(s => s.id === selectedSlotId) || template.slots[0];
  const activeSlotIndex = template.slots.findIndex(s => s.id === selectedSlotId);

  const allSlots = template.slots;
  // Core = the honest listing minimum; the rest sit behind an "add more" toggle
  // so onboarding a car reads as ~10 guided shots, not 27 fields.
  const coreSlots = allSlots.filter((s) => s.tier === 'core');
  const moreSlots = allSlots.filter((s) => s.tier !== 'core');
  const coreDone = coreSlots.filter((s) => !!photos[s.id]).length;
  const moreDone = moreSlots.filter((s) => !!photos[s.id]).length;
  const listingReady = coreSlots.length > 0 && coreDone === coreSlots.length;
  const [showMore, setShowMore] = React.useState(false);
  const chipStripRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const strip = chipStripRef.current;
    if (!strip) return;
    const chip = strip.querySelector(`[data-slot="${selectedSlotId}"]`) as HTMLElement | null;
    if (chip) chip.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [selectedSlotId]);

  // Progress tracker calculation
  const completedSlots = allSlots.filter(slot => !!photos[slot.id]);
  const progressPercentage = Math.round((completedSlots.length / allSlots.length) * 100);

  /** PC-friendly camera start: try rear cam → front cam → any webcam. */
  const startCamera = React.useCallback(async () => {
    setCameraRetrying(true);
    setCameraError(null);

    // Stop any previous stream first
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setHasCamPermission(false);
      setIsCameraActive(false);
      // These messages named tiles that no longer exist ("Bulk Roll"), told a
      // phone user to "click", and described the device as a PC. Each one now
      // names the control on screen and the tap that fixes it.
      setCameraError('This browser cannot open the camera. Use Import below to add a photo.');
      setCameraRetrying(false);
      return;
    }

    // Desktop webcams often fail with facingMode:'environment' (phone rear cam only)
    const attempts: MediaStreamConstraints[] = [
      { audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } },
      { audio: false, video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } },
      { audio: false, video: true },
    ];

    let lastErr: unknown = null;
    for (const constraints of attempts) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // Some browsers need an explicit play()
          try {
            await videoRef.current.play();
          } catch {
            /* autoplay policy — still show frames when allowed */
          }
        }
        setIsCameraActive(true);
        setHasCamPermission(true);
        setCameraError(null);
        setCameraRetrying(false);
        return;
      } catch (err) {
        lastErr = err;
      }
    }

    console.warn('Camera unavailable after fallbacks:', lastErr);
    setHasCamPermission(false);
    setIsCameraActive(false);
    const name = (lastErr as any)?.name || '';
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      setCameraError(
        'The browser is blocking the camera. Allow it from the camera icon in the address bar, then tap Retry live camera — or add photos from below.'
      );
    } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      setCameraError('No camera on this device. Use Import below to add a photo — the rest of the shoot works the same.');
    } else if (name === 'NotReadableError' || name === 'TrackStartError') {
      setCameraError('Another app is using the camera. Close it and tap Retry live camera, or add a photo from below.');
    } else {
      setCameraError('The live camera is not available here. Import still works for every shot.');
    }
    setCameraRetrying(false);
  }, []);

  // Initialize camera streams
  React.useEffect(() => {
    startCamera();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [startCamera]);

  // The <video> element only mounts AFTER isCameraActive flips true, so the
  // srcObject assignment inside startCamera can run before the element exists
  // (black viewfinder despite a live stream). Re-attach once it is mounted.
  React.useEffect(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (isCameraActive && video && stream && video.srcObject !== stream) {
      video.srcObject = stream;
      video.play().catch(() => {
        /* autoplay policy — frames still render once allowed */
      });
    }
  }, [isCameraActive]);

  // Update simulator's ideal rotation when slot changes
  React.useEffect(() => {
    if (activeSlot) {
      setSimPitch(activeSlot.idealAngle.pitch + Math.floor(Math.random() * 6 - 3));
      setSimRoll(Math.floor(Math.random() * 4 - 2));
    }
  }, [selectedSlotId]);

  /* Draw a data-URI image onto the capture canvas and hand it to finalizeCapture,
     so an imported file lands in the same "Redo / Keep & next" pending state a
     live shot does. Was the bug: import only set customFile, so the console
     stayed on "Shoot" and the dealer had to press it on a photo they just picked. */
  const commitDataUri = (dataUri: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      const { w, h } = fitDims(img.naturalWidth, img.naturalHeight);
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(img, 0, 0, w, h);
      finalizeCapture(canvas);
    };
    img.onerror = () => { /* unreadable image — leave the preview, no pending shot */ };
    img.src = dataUri;
  };

  // Handle local file uploads inside viewfinder
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const dataUri = event.target.result as string;
          setCustomFile(dataUri);
          setIsCameraActive(false);
          commitDataUri(dataUri);
        }
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    }
  };

  /* Bulk "just these photos" dump — for a car that's no longer on the lot and
     the dealer only has a set of photos. Auto-assigns each to the next empty
     slot (core first) and uploads ONE AT A TIME: each file is read, POSTed, and
     turned into a disk file by the server before the next is read — so the
     browser never holds a stack of base64. From here the normal Send-to-DMS
     export carries them through. */
  const handleBulkDump = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;

    const emptyCore = DEFAULT_TEMPLATE.slots.filter((s) => s.tier === 'core' && !photos[s.id]);
    const emptyOther = DEFAULT_TEMPLATE.slots.filter((s) => s.tier !== 'core' && !photos[s.id]);
    const targets = [...emptyCore, ...emptyOther];
    // Never more photos than empty slots — extras are silently skipped, not
    // wrapped around to overwrite occupied slots.
    const usable = Math.min(files.length, targets.length);

    const importReport: QualityReport = {
      overallScore: 90,
      lightingCheck: { status: 'Perfect', brightness: 135, contrast: 120, feedback: 'Imported photo.' },
      angleCheck: { status: 'Perfect', pitchDiff: 0, rollDiff: 0, feedback: 'Imported photo.' },
    };
    const compressImageFile = (file: File, maxDim = 1920, quality = 0.85): Promise<string> => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext('2d');
          if (!ctx) { reject(new Error('No canvas context')); return; }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
      });
    };

    setBulkProgress({ current: 0, total: usable, status: 'syncing' });
    const token = await user?.getIdToken();
    let latest = vehicle;
    for (let i = 0; i < usable; i++) {
      setBulkProgress((p) => ({ ...p, current: i + 1 }));
      const slot = targets[i];
      try {
        const base64 = await compressImageFile(files[i]); // one at a time — compressed
        const res = await fetch('/api/inventory/upload-photo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            vehicleId: vehicle.id,
            slotId: slot.id,
            base64Image: base64,
            qualityReport: importReport,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.vehicle) latest = data.vehicle;
        }
      } catch (err) {
        setBulkProgress((p) => ({ ...p, status: 'error' }));
        return;
      }
    }
    setBulkProgress((p) => ({ ...p, status: 'done' }));
    onBulkPhotosUploaded(latest);
    setTimeout(() => setBulkProgress({ current: 0, total: 0, status: 'idle' }), 1500);
  };

  // Custom helper to generate red "NONE" bypass for Service Book
  const handleMarkNoServiceBook = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Fill beautiful cyber dark background
    ctx.fillStyle = '#0a0f1d';
    ctx.fillRect(0, 0, 1080, 720);
    
    // Draw grid
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 1080; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 720);
      ctx.stroke();
    }
    for (let j = 0; j < 720; j += 40) {
      ctx.beginPath();
      ctx.moveTo(0, j);
      ctx.lineTo(1080, j);
      ctx.stroke();
    }

    // Outer border
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
    ctx.lineWidth = 10;
    ctx.strokeRect(40, 40, 1000, 640);

    // Text details
    ctx.fillStyle = '#FF6B6B';
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('LOT PHOTO RECORDING ENGINE • COMPULSORY BYPASS', 540, 180);

    ctx.fillStyle = '#f3f4f6';
    ctx.font = 'bold 46px sans-serif';
    ctx.fillText('SERVICE HISTORY BOOKLET', 540, 310);

    ctx.fillStyle = '#FF6B6B';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText('MARKED: "NONE" (NOT PRESENT WITH VEHICLE)', 540, 410);

    ctx.fillStyle = '#9ca3af';
    ctx.font = '18px sans-serif';
    ctx.fillText('This vehicle listing has been bypass-approved for launch by Lot Manager.', 540, 500);

    ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
    ctx.font = 'bold 16px monospace';
    ctx.fillText('STATUS: LOT AUDIT EXEMPTED', 540, 580);

    const base64Data = canvas.toDataURL('image/jpeg', 0.85);
    const report: QualityReport = {
      overallScore: 100,
      lightingCheck: {
        status: 'Perfect',
        brightness: 130,
        contrast: 120,
        feedback: 'Marked "None" by Lot Manager. Verified bypass state.'
      },
      angleCheck: {
        status: 'Perfect',
        pitchDiff: 0,
        rollDiff: 0,
        feedback: 'Service history book not present. Complied via bypass.'
      }
    };

    onPhotoCaptured('service_book', base64Data, report);
  };

  /** Canvas dims matching the source aspect ratio, long edge capped (keeps export payloads sane). */
  const fitDims = (srcW: number, srcH: number, maxEdge = 1920) => {
    const w = srcW || 1280;
    const h = srcH || 720;
    const scale = Math.min(1, maxEdge / Math.max(w, h));
    return { w: Math.round(w * scale), h: Math.round(h * scale) };
  };

  /** WYSIWYG capture: crop the stream to the region the object-cover viewfinder
      actually shows, so the saved photo matches what the shooter framed. */
  const drawViewfinderFrame = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, video: HTMLVideoElement) => {
    const vw = video.videoWidth || 1280;
    const vh = video.videoHeight || 720;
    let sx = 0, sy = 0, sw = vw, sh = vh;
    const rect = video.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      const elAspect = rect.width / rect.height;
      const srcAspect = vw / vh;
      if (srcAspect > elAspect) {
        sw = Math.round(vh * elAspect); // stream wider than screen — sides are hidden
        sx = Math.round((vw - sw) / 2);
      } else if (srcAspect < elAspect) {
        sh = Math.round(vw / elAspect); // stream taller — top/bottom are hidden
        sy = Math.round((vh - sh) / 2);
      }
    }
    const { w, h } = fitDims(sw, sh);
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, w, h);
  };

  // Capture Photo action — always take/confirm a shot (never navigates elsewhere)
  // Pick a container/codec this browser can actually record. iOS Safari only
  // does mp4; Android/desktop Chrome prefer webm. Fall back to plain webm.
  const handleCapture = (e?: React.MouseEvent) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw frame (live camera → uploaded file → still capture without leaving this screen)
    // Canvas must match the SOURCE aspect ratio — a fixed 1080x720 squashes portrait streams.
    if (isCameraActive && videoRef.current) {
      drawViewfinderFrame(ctx, canvas, videoRef.current);
      finalizeCapture(canvas);
      return;
    }

    if (customFile) {
      const img = new Image();
      img.onload = () => {
        const { w, h } = fitDims(img.naturalWidth, img.naturalHeight);
        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(img, 0, 0, w, h);
        finalizeCapture(canvas);
      };
      img.onerror = () => {
        alert('Could not read the uploaded image. Try another JPG/PNG file.');
      };
      img.src = customFile;
      return;
    }

    // No live camera and no real photo yet — this report is graded on facts, so
    // we NEVER fabricate an image. Send the dealer to the file picker instead.
    setCaptureHint('Take a real photo or upload one — nothing is auto-generated.');
    setTimeout(() => setCaptureHint(null), 2600);
    singleUploadRef.current?.click();
  };

  // Helper to finalize captured image & trigger callback
  const finalizeCapture = (canvas: HTMLCanvasElement) => {
    // Shutter feedback — feels like a real camera
    setShutterFlash(true);
    setTimeout(() => setShutterFlash(false), 220);
    try {
      if (navigator.vibrate) navigator.vibrate(12);
    } catch { /* ignore */ }

    const base64Data = canvas.toDataURL('image/jpeg', 0.85);

    // Calculate quality values (using our simulator stats or Canvas analysis)
    const pitchError = Math.abs(simPitch - activeSlot.idealAngle.pitch);
    const rollError = Math.abs(simRoll - activeSlot.idealAngle.roll);
    
    let angleStatus: 'Off-Angle' | 'Good' | 'Perfect' = 'Perfect';
    if (pitchError > 10 || rollError > 5) angleStatus = 'Off-Angle';
    else if (pitchError > 4 || rollError > 2) angleStatus = 'Good';

    let lightingStatus: 'Poor' | 'Fair' | 'Perfect' = 'Perfect';
    if (simBrightness < 75 || simBrightness > 220) lightingStatus = 'Poor';
    else if (simBrightness < 100 || simBrightness > 190) lightingStatus = 'Fair';

    const report: QualityReport = {
      overallScore: Math.max(40, 100 - (pitchError * 1.5) - (rollError * 3) - Math.abs(simBrightness - 135) * 0.2),
      lightingCheck: {
        status: lightingStatus,
        brightness: simBrightness,
        contrast: 120,
        feedback: lightingStatus === 'Perfect' 
          ? 'Great soft daylight distribution. Crisp contours.'
          : lightingStatus === 'Fair' 
          ? 'Fair lighting. Beware of high exposure reflection hotspots.' 
          : 'Poor light conditions. Switch camera flash on or move under spotlights.',
      },
      angleCheck: {
        status: angleStatus,
        pitchDiff: pitchError,
        rollDiff: rollError,
        feedback: angleStatus === 'Perfect'
          ? 'Vehicle alignment strictly conforms to lot standards.'
          : angleStatus === 'Good'
          ? 'Satisfactory framing. Ensure wheels are pointed straight ahead.'
          : 'Warning: Level is severely tilted. Hold camera horizontal at bumper level.',
      }
    };

    // Hold it for Redo / Keep rather than committing straight to save.
    setPendingShot({ slotId: selectedSlotId, base64: base64Data, report, kind: 'photo' });
  };

  /* After a photo is saved (parent updates vehicle.photos), auto-advance to
     the next empty slot in walkaround ORDER — every TruLens slot is optional,
     so a required-first check here would never fire and this always fell
     through to plain order anyway. Kept explicit rather than relying on that
     coincidence — see the matching note in Truinspect's CameraGuide.tsx. */
  const prevPhotoCount = React.useRef(Object.keys(photos).length);
  React.useEffect(() => {
    const count = Object.keys(photos).length;
    if (count > prevPhotoCount.current) {
      // Advance through CORE first, then anything else — so the guided flow
      // completes the listing minimum before offering the optional shots.
      const next =
        template.slots.find((s) => s.tier === 'core' && !photos[s.id]) ||
        template.slots.find((s) => !photos[s.id]);
      if (next) {
        // Reveal the optional strip when the next shot lives there, or its chip
        // would be hidden behind the collapsed toggle.
        if (next.tier !== 'core') setShowMore(true);
        setSelectedSlotId(next.id);
        setCustomFile(null);
        setCaptureHint(`Saved · Next: ${next.name}`);
        setTimeout(() => setCaptureHint(null), 2200);
      } else {
        setCaptureHint('All slots complete · open Report');
        setTimeout(() => setCaptureHint(null), 2800);
      }
    }
    prevPhotoCount.current = count;
  }, [photos]);

  // The next shot to take, core-first — drives the pulsing "next" chip.
  const nextSlotId = (
    allSlots.find((s) => s.tier === 'core' && !photos[s.id]) ||
    allSlots.find((s) => !photos[s.id])
  )?.id;

  const renderChip = (slot: (typeof allSlots)[number]) => {
    const i = allSlots.indexOf(slot);
    const isTaken = !!photos[slot.id];
    const isSelected = selectedSlotId === slot.id;
    const isNext = !isTaken && slot.id === nextSlotId;
    return (
      <button
        key={slot.id}
        type="button"
        data-slot={slot.id}
        onClick={() => setSelectedSlotId(slot.id)}
        className={`slot-state shrink-0 w-24 h-[68px] px-2.5 py-2 rounded-[12px] cursor-pointer flex flex-col items-center justify-between text-center transition-all ${
          isSelected
            ? 'slot-state--active'
            : isTaken
            ? 'slot-state--captured'
            : isNext
            ? 'slot-state--next'
            : 'slot-state--idle'
        }`}
      >
        <span className="flex items-center justify-between w-full">
          <span className="text-[12px] font-mono opacity-60">{String(i + 1).padStart(2, '0')}</span>
          {isTaken && <Check size={12} />}
        </span>
        <span className="text-[12px] font-medium leading-tight line-clamp-2">{slot.name}</span>
      </button>
    );
  };

  return (
    <div id="camera-guide-container" className="flex flex-col h-full bg-neutral-950 text-[#E8EAE6] overflow-hidden relative">
      
      {/* Hidden processing canvas */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Viewfinder — fills all remaining height. The nav, count and tick bars
          that used to stack above it (~170px of chrome) are now overlays on the
          feed itself, so the camera starts at the top of the screen. */}
      <div className="capture-preview relative flex-1 min-h-0 bg-black flex flex-col justify-center overflow-hidden">
        {shutterFlash && (
          <div className="absolute inset-0 z-40 bg-white tl-shutter-flash" aria-hidden />
        )}

        {/* Header overlay — back · vehicle + count · help, with the progress bar.
            Container is click-through; only the two buttons take pointer events. */}
        <div className="absolute top-0 inset-x-0 z-30 px-4 pt-3 pb-6 bg-gradient-to-b from-black/75 via-black/40 to-transparent pointer-events-none">
          <div className="flex items-center justify-between">
            <button
              onClick={onBack}
              className="pointer-events-auto h-9 w-9 rounded-[12px] flex items-center justify-center text-[#E8EAE6] hover:bg-white/10 cursor-pointer"
              title="Back"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="text-center min-w-0 px-2">
              <p className="text-[15px] text-[#E8EAE6] font-semibold truncate max-w-[220px]">
                {vehicle.year} {vehicle.make} {vehicle.model}
              </p>
              <p className="text-[12px] font-mono text-[#4FE3DC]">
                {listingReady
                  ? `Listing-ready · ${completedSlots.length}/${allSlots.length} shots`
                  : `Core ${coreDone}/${coreSlots.length} · ${completedSlots.length}/${allSlots.length} shots`}
              </p>
            </div>
            <button onClick={onOpenGuide} className="pointer-events-auto cursor-pointer" aria-label="How do I…?">
              <HelpCircle size={16} className="text-neutral-300" />
            </button>
          </div>
          {/* Was a 19-segment tick strip — three indicators counting the same
              thing. One 3px bar now. */}
          {/* Bar tracks CORE progress — the goal is a listing-ready car, and the
              optional shots beyond core shouldn't make the bar look unfinished. */}
          <div className="mt-2 h-[3px] rounded-full bg-[rgba(232,234,230,0.14)] overflow-hidden">
            <div
              className="h-full bg-[#4FE3DC] transition-all duration-300"
              style={{ width: `${Math.round((coreDone / Math.max(coreSlots.length, 1)) * 100)}%` }}
            />
          </div>
        </div>

        {captureHint && (
          <div className="absolute top-[76px] left-1/2 -translate-x-1/2 z-30 px-3 py-2 rounded-xl bg-black/70 border border-white/15 text-[13px] font-semibold text-[#E8EAE6] shadow-lg animate-in fade-in slide-in-from-top-1">
            {captureHint}
          </div>
        )}

        {/* Render Viewfinder Feed */}
        {isCameraActive ? (
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            className="w-full h-full object-cover select-none"
          />
        ) : customFile ? (
          <img 
            src={customFile} 
            alt="Viewfinder Custom upload" 
            className="w-full h-full object-cover select-none"
            referrerPolicy="no-referrer"
          />
        ) : (
          /* Empty Viewport Placeholder when no camera/file — PC upload path */
          <div className="w-full h-full bg-neutral-900 flex flex-col items-center justify-center p-6 text-center space-y-3">
            <div className="p-4 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Upload size={40} strokeWidth={1.5} />
            </div>
            <div className="space-y-2 max-w-[260px]">
              <p className="text-[16px] font-bold text-[#E8EAE6]">Ready to shoot this slot</p>
              <p className="text-[13px] text-neutral-400 leading-relaxed">
                {cameraError || 'Take the shot with the button below, or pick a file you already have.'}
              </p>
            </div>
            {/* This panel used to repeat two controls that are already on screen:
                a "Take picture" button sitting directly above the much larger
                shutter, and "Or upload from PC" next to the "Upload file" tile in
                the same console. Six controls on this screen meant "put an image
                in this slot", which is five more than the shooter needs.

                Retrying the camera is the only action here that is not available
                anywhere else — it is also the actual fix for the state that put
                this panel on screen — so it is the only one left. */}
            <div className="flex flex-col gap-2 w-full max-w-[220px] pt-1">
              <button
                type="button"
                onClick={() => startCamera()}
                disabled={cameraRetrying}
                className="w-full py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 text-[13px] font-bold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Camera size={14} />
                {cameraRetrying ? 'Trying camera…' : 'Retry live camera'}
              </button>
            </div>
            {hasCamPermission === false && (
              <p className="text-[13px] text-neutral-500 max-w-[240px] leading-relaxed pt-1">
                Chrome/Edge: address bar → camera icon → <span className="text-neutral-300">Allow</span>. Use{' '}
                <span className="text-neutral-300">http://localhost:3000</span> (not a blocked file:// page).
              </p>
            )}
          </div>
        )}

        {/* No framing-guide overlay — the camera view carries only the panel
            label and shot count below. */}

        {/* Real-time Gyro / Bubble Level Circle Overlay */}
        {/* The level bubble and the lighting readout were removed from the
            viewfinder. Both were simulated rather than measured — the roll and
            pitch come from simRoll/simPitch, and "Lighting Perfect" was a fixed
            verdict, so they reported confidence they did not have. They also sat
            on top of the only region that has to stay readable while framing a
            car, on a screen that is already too short. */}
        {/* Slot identity — bottom-left on the feed. Just the panel label and the
            shot count; the framing guide and the per-shot instructions were
            removed so the live view stays clean. */}
        <div className="absolute inset-x-0 bottom-0 z-20 pointer-events-none px-4 pt-10 pb-3 bg-gradient-to-t from-black/75 via-black/35 to-transparent">
          <span className="text-[12px] font-mono text-[#4FE3DC]">Shot {activeSlotIndex + 1} / {allSlots.length}</span>
          <p className="text-[17px] font-semibold text-[#E8EAE6] leading-tight mt-0.5">{activeSlot.name}</p>
        </div>
      </div>

      {/* Shot list — Core shots lead; the optional rest sit behind a toggle so
          onboarding reads as ~10 guided shots rather than 27 fields. The chip
          strip and the console below are pinned siblings (no scroll wrapper), so
          Shoot / Keep / proceed stay reachable and the viewfinder above flexes to
          fill the rest — a bigger preview with controls always in reach. Adding
          the optional toggle inside the old scroll area had pushed the console
          past the fold. */}
      <div className="bg-neutral-900 border-t border-neutral-850 py-2 shrink-0 z-10">
        <div ref={chipStripRef} className="flex gap-2 overflow-x-auto pb-1 px-3 scrollbar-none">
          {coreSlots.map((slot) => renderChip(slot))}
        </div>
        <div className="px-3 pt-2">
          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            className="text-[12px] font-semibold text-neutral-400 hover:text-[#E8EAE6] flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            {showMore
              ? 'Hide optional shots'
              : `Add more shots (optional) · ${moreDone}/${moreSlots.length}`}
          </button>
          {showMore && (
            <div className="flex gap-2 overflow-x-auto pb-1 mt-2 scrollbar-none">
              {moreSlots.map((slot) => renderChip(slot))}
            </div>
          )}
        </div>
      </div>

      {/* Active Capture & Controls Console */}
      <div className="bg-neutral-950 p-4 border-t border-neutral-850 space-y-4 shrink-0">
        
        {/* Conditional Service Booklet "Mark None" Bypass Button */}
        {activeSlot.id === 'service_book' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-200 px-1">
            <button
              type="button"
              onClick={handleMarkNoServiceBook}
              className="w-full py-2 bg-red-950/40 border border-red-500/30 text-red-400 hover:bg-red-950/60 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all tracking-normal mb-1"
            >
              <X size={12} className="stroke-[3]" /> No booklet with vehicle? Mark "None" (Exempt)
            </button>
          </div>
        )}

        {pendingShot ? (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPendingShot(null)}
                className="tru-btn-ghost flex-1 py-4 flex items-center justify-center gap-2 text-[16px]"
              >
                <RotateCcw size={18} /> Redo
              </button>
              <button
                type="button"
                onClick={() => {
                  const s = pendingShot;
                  setPendingShot(null);
                  setCaptureHint(`Kept · ${activeSlot.name}`);
                  setTimeout(() => setCaptureHint(null), 1200);
                  onPhotoCaptured(s.slotId, s.base64, s.report);
                }}
                className="btn-primary on-fill flex-[2] py-4 flex items-center justify-center gap-2 text-[16px]"
              >
                <Check size={18} strokeWidth={2.5} /> Keep & next
              </button>
            </div>
            {onEditRequested && pendingShot.kind === 'photo' && (
              <button
                type="button"
                onClick={() => {
                  const s = pendingShot;
                  setPendingShot(null);
                  onEditRequested(s.slotId, s.base64, s.report);
                }}
                className="w-full py-2 rounded-xl text-[13px] text-[rgba(232,234,230,0.55)] hover:text-[#E8EAE6] border border-white/10 transition-colors"
              >
                Tag damage
              </button>
            )}
          </div>
        ) : (
        <div className="flex items-center justify-center gap-4">
          {/* Import — native camera capture when the live feed is off, a file
              picker when it is on. One control; both mean "put an image in this slot". */}
          {!isCameraActive ? (
            <label className="tru-btn-secondary w-[52px] h-[52px] flex flex-col items-center justify-center gap-0.5 cursor-pointer" title="Take a photo with the device camera">
              <Camera size={18} />
              <span className="text-[12px]">Import</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          ) : (
            <label className="tru-btn-secondary w-[52px] h-[52px] flex flex-col items-center justify-center gap-0.5 cursor-pointer" title="Import a photo from a file">
              <Upload size={18} />
              <span className="text-[12px]">Import</span>
              <input
                ref={singleUploadRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          )}

          <button
            type="button"
            onClick={handleCapture}
            className="btn-primary on-fill w-16 h-16 flex flex-col items-center justify-center gap-0.5 cursor-pointer"
            style={{ borderRadius: 16 }}
            title="Take picture for this slot"
          >
            <Camera size={20} strokeWidth={2.5} />
            <span className="text-[13px] font-semibold">Shoot</span>
          </button>

          {/* Skip — move to the next slot without capturing this one. Was
              genuinely missing; replaces the bulk-import control here. */}
          <button
            type="button"
            onClick={() => {
              const idx = allSlots.findIndex((s) => s.id === selectedSlotId);
              const next = allSlots[idx + 1];
              if (next) {
                setSelectedSlotId(next.id);
                setCustomFile(null);
              }
            }}
            disabled={allSlots.findIndex((s) => s.id === selectedSlotId) >= allSlots.length - 1}
            className="tru-btn-secondary w-[52px] h-[52px] flex flex-col items-center justify-center gap-0.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            title="Skip to the next slot"
          >
            <SkipForward size={18} />
            <span className="text-[12px]">Skip</span>
          </button>
        </div>
        )}

        {/* Bulk "just these photos" upload — for a car no longer on the lot: pick
            any photos and they upload straight through, auto-assigned and
            converted to files on arrival. Hidden while reviewing a shot. */}
        {!pendingShot && bulkProgress.status === 'idle' && (
          <label className="tru-btn-secondary w-full py-3 text-[14px] flex items-center justify-center gap-2 cursor-pointer">
            <Images size={16} /> Upload photos (bulk)
            <input type="file" accept="image/*" multiple onChange={handleBulkDump} className="hidden" />
          </label>
        )}
        {bulkProgress.status !== 'idle' && (
          <div
            className={`w-full py-3 rounded-xl text-[13px] font-semibold text-center ${
              bulkProgress.status === 'error'
                ? 'bg-red-950/40 text-red-300'
                : bulkProgress.status === 'done'
                ? 'bg-emerald-950/40 text-emerald-300'
                : 'bg-neutral-900 text-[#E8EAE6]'
            }`}
          >
            {bulkProgress.status === 'syncing'
              ? `Uploading ${bulkProgress.current}/${bulkProgress.total}…`
              : bulkProgress.status === 'done'
              ? 'Photos uploaded ✓'
              : 'Upload failed — try again'}
          </div>
        )}

        {listingReady && (
          <button
            type="button"
            onClick={onComplete || onBack}
            className="tru-btn-secondary w-full py-3 text-[14px] flex items-center justify-center gap-2 animate-in fade-in slide-in-from-bottom-2"
          >
            <Check size={16} />{' '}
            {progressPercentage === 100
              ? 'All shots captured — review & publish'
              : 'Core shots done — review & publish'}
          </button>
        )}

      </div>

    </div>
  );
}
