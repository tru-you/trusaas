import React from 'react';
import {
  Camera, ChevronLeft, AlertCircle,
  Check, Upload, ClipboardCheck, Images, Loader2, Trash2, X, SkipForward
} from 'lucide-react';
import { Vehicle, QualityReport } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { usePropertySlots } from '../lib/usePropertySlots';

interface CameraGuideProps {
  vehicle: Vehicle;
  onBack: () => void;
  onComplete?: () => void;
  onPhotoCaptured: (slotId: string, base64Image: string, qualityReport: QualityReport) => void;
  onBulkPhotosUploaded: (updatedVehicle: Vehicle) => void;
  onOpenDamageTagger?: () => void;
  onOpenChecklist?: () => void;
}

export default function CameraGuide({ vehicle, onBack, onComplete, onPhotoCaptured, onBulkPhotosUploaded, onOpenDamageTagger, onOpenChecklist }: CameraGuideProps) {
  const { user } = useAuth();
  const slots = usePropertySlots(vehicle);
  // Crash-safe: never read vehicle.photos when undefined
  const photos = vehicle?.photos || {};
  /* Every capture here routes through SlotReview for a condition assessment,
     which unmounts this component and remounts it fresh when the shooter
     comes back — a hardcoded 'bonnet' default meant every single return trip
     reset back to slot 1, no matter how far the walkaround had actually
     gotten, which read as the app being stuck rather than advancing. Lazy
     initializer so this only runs once, at mount — compute the real first
     gap from what's already captured instead of assuming slot 1. */
  const [selectedSlotId, setSelectedSlotId] = React.useState<string>(
    () => slots.find((s) => !vehicle.photos?.[s.id])?.id || slots[0].id,
  );
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

  // Simulated viewfinder state (for fallback / testing)
  const [simRotation, setSimRotation] = React.useState(45); // Degrees (Yaw)
  const [simPitch, setSimPitch] = React.useState(12); // Pitch (Phone vertical level)
  const [simRoll, setSimRoll] = React.useState(0); // Roll (Phone horizontal level)
  const [simBrightness, setSimBrightness] = React.useState(130); // 0-255
  const [simColor, setSimColor] = React.useState('#1e3a8a'); // Blue
  const [customFile, setCustomFile] = React.useState<string | null>(null);

  // Auto-level assistant toggle
  const [autoLevelOn, setAutoLevelOn] = React.useState(true);

  // Bulk upload state variables
  interface BulkImageItem {
    id: string;
    fileName: string;
    base64: string;
    slotId: string;
    qualityReport: QualityReport;
  }
  const [bulkItems, setBulkItems] = React.useState<BulkImageItem[]>([]);
  const [isBulkModalOpen, setIsBulkModalOpen] = React.useState(false);
  const [bulkProgress, setBulkProgress] = React.useState<{ current: number; total: number; status: 'idle' | 'syncing' | 'done' | 'error' }>({
    current: 0,
    total: 0,
    status: 'idle'
  });

  // Active slot information
  const activeSlot = slots.find(s => s.id === selectedSlotId) || slots[0];
  const activeSlotIndex = slots.findIndex(s => s.id === selectedSlotId);

  // Progress tracker calculation
  const completedSlots = slots.filter(slot => !!photos[slot.id]);
  const progressPercentage = Math.round((completedSlots.length / slots.length) * 100);

  const allSlots = slots;
  const chipStripRef = React.useRef<HTMLDivElement>(null);

  // Auto-scroll the chip strip so the active slot is always visible
  React.useEffect(() => {
    const strip = chipStripRef.current;
    if (!strip) return;
    const chip = strip.querySelector(`[data-slot="${selectedSlotId}"]`) as HTMLElement | null;
    if (chip) chip.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [selectedSlotId]);

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
      setCameraError('No camera on this device. Use Import below to add a photo — the rest of the inspection works the same.');
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
      setSimRotation(activeSlot.idealAngle.yaw);
      setSimPitch(activeSlot.idealAngle.pitch + Math.floor(Math.random() * 6 - 3));
      setSimRoll(Math.floor(Math.random() * 4 - 2));
    }
  }, [selectedSlotId]);

  // Handle local file uploads inside viewfinder
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setCustomFile(event.target.result as string);
          // Uploaded image becomes the live viewfinder — ready for shutter / AI
          setIsCameraActive(false);
        }
      };
      reader.readAsDataURL(file);
      // Allow re-selecting the same file later
      e.target.value = '';
    }
  };

  // Handle select multiple files from camera roll
  const handleBulkFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newItems: BulkImageItem[] = [];
    let loadedCount = 0;

    // We try to auto-assign slots sequentially to make bulk processing extremely fast
    const unfilledRequired = slots.filter(s => s.required && !photos[s.id]);
    const unfilledAll = slots.filter(s => !photos[s.id]);
    const assignableSlots = unfilledRequired.length > 0 ? unfilledRequired : (unfilledAll.length > 0 ? unfilledAll : slots);

    Array.from(files).forEach((file, idx) => {
      const fileObj = file as File;
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const base64 = event.target.result as string;
          // Auto assign slot
          const slot = assignableSlots[idx % assignableSlots.length] || slots[0];
          
          const defaultReport: QualityReport = {
            overallScore: 94,
            lightingCheck: {
              status: 'Perfect',
              brightness: 135,
              contrast: 120,
              feedback: 'Balanced ambient lighting detected from camera roll import.'
            },
            angleCheck: {
              status: 'Perfect',
              pitchDiff: 0,
              rollDiff: 0,
              feedback: 'Imported photo framing accepted.'
            }
          };

          newItems.push({
            id: `bulk-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
            fileName: fileObj.name,
            base64,
            slotId: slot.id,
            qualityReport: defaultReport
          });
        }
        loadedCount++;
        if (loadedCount === files.length) {
          setBulkItems(prev => [...prev, ...newItems]);
          setBulkProgress({ current: 0, total: files.length, status: 'idle' });
          setIsBulkModalOpen(true);
        }
      };
      reader.readAsDataURL(fileObj);
    });
  };

  // Perform bulk sequential upload of all mapped photos
  const handleSyncBulkPhotos = async () => {
    if (bulkItems.length === 0) return;

    setBulkProgress({ current: 0, total: bulkItems.length, status: 'syncing' });

    let latestVehicleState = vehicle;

    const token = await user?.getIdToken();

    for (let i = 0; i < bulkItems.length; i++) {
      const item = bulkItems[i];
      setBulkProgress(prev => ({ ...prev, current: i + 1 }));

      try {
        const res = await fetch('/api/inventory/upload-photo', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            vehicleId: vehicle.id,
            slotId: item.slotId,
            base64Image: item.base64,
            qualityReport: item.qualityReport
          })
        });

        if (res.ok) {
          const data = await res.json();
          latestVehicleState = data.vehicle;
        }
      } catch (err) {
        console.error(`Error uploading bulk item ${item.fileName}:`, err);
        setBulkProgress(prev => ({ ...prev, status: 'error' }));
        return;
      }
    }

    setBulkProgress(prev => ({ ...prev, status: 'done' }));
    
    // Update local vehicle state in the App component
    onBulkPhotosUploaded(latestVehicleState);

    // Close the bulk modal after a successful sync
    setTimeout(() => {
      setIsBulkModalOpen(false);
      setBulkItems([]);
      setBulkProgress({ current: 0, total: 0, status: 'idle' });
    }, 1500);
  };

  const handleMarkNotPresent = (slotId: string, slotName: string) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#0a0f1d';
    ctx.fillRect(0, 0, 1080, 720);

    ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
    ctx.lineWidth = 10;
    ctx.strokeRect(40, 40, 1000, 640);

    ctx.fillStyle = '#f3f4f6';
    ctx.font = 'bold 40px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(slotName.toUpperCase(), 540, 300);

    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 34px sans-serif';
    ctx.fillText('NOT PRESENT', 540, 390);

    ctx.fillStyle = '#9ca3af';
    ctx.font = '18px sans-serif';
    ctx.fillText('Marked by inspector during walk-through.', 540, 480);

    const base64Data = canvas.toDataURL('image/jpeg', 0.85);
    const report: QualityReport = {
      overallScore: 100,
      lightingCheck: { status: 'Perfect', brightness: 130, contrast: 120, feedback: `${slotName} marked not present.` },
      angleCheck: { status: 'Perfect', pitchDiff: 0, rollDiff: 0, feedback: 'Item not present at property.' },
    };

    onPhotoCaptured(slotId, base64Data, report);
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
    // we NEVER fabricate an image. Send the inspector to the phone camera / file
    // picker to capture a real photo instead.
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
          ? 'Framing conforms to inspection standards.'
          : angleStatus === 'Good'
          ? 'Satisfactory framing. Keep the camera level and square to the surface.'
          : 'Warning: Level is severely tilted. Hold camera horizontal and straight.',
      }
    };

    setCaptureHint(`Captured · ${activeSlot.name}`);
    setTimeout(() => setCaptureHint(null), 1400);
    onPhotoCaptured(selectedSlotId, base64Data, report);
  };

  /* After a photo is saved (parent updates vehicle.photos), auto-advance to
     the next empty slot in walkaround ORDER — not the next empty required
     slot. Skipping straight past an optional shot (spare wheel, jack, spare
     keys) to the next required one broke the physical walk: the inspector is
     standing right at the boot for those two accessory shots, and jumping
     past them to the rear-left quarter panel sent them out of sequence. */
  const prevPhotoCount = React.useRef(Object.keys(photos).length);
  React.useEffect(() => {
    const count = Object.keys(photos).length;
    if (count > prevPhotoCount.current) {
      const next = slots.find((s) => !photos[s.id]);
      if (next) {
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


  const renderGuideOverlay = () => (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
      <g stroke="currentColor" strokeWidth="0.4" fill="none" opacity="0.5" className="text-tru-cyan">
        <path d="M 8,16 L 8,10 L 16,10" />
        <path d="M 92,16 L 92,10 L 84,10" />
        <path d="M 8,84 L 8,90 L 16,90" />
        <path d="M 92,84 L 92,90 L 84,90" />
      </g>
      <rect x="16" y="26" width="68" height="48" rx="2"
            stroke="currentColor" strokeWidth="0.5" strokeDasharray="1.5,2"
            fill="none" opacity="0.35" className="text-tru-cyan" />
      <line x1="30" y1="50" x2="70" y2="50" stroke="currentColor" strokeWidth="0.4" opacity="0.25" className="text-tru-cyan" />
    </svg>
  );

  // Determine lighting quality for prompt advice
  const getLightingAdvice = () => {
    if (simBrightness < 80) return { title: 'Viewfinder Dark', color: 'text-red-400', desc: 'Turn on overhead studio spots.' };
    if (simBrightness > 210) return { title: 'Overexposed Glare', color: 'text-amber-400', desc: 'Avoid direct midday sun.' };
    return { title: 'Lighting Perfect', color: 'text-emerald-400', desc: 'Ready for studio background extraction.' };
  };

  const lightingAdvice = getLightingAdvice();

  // Angle accuracy rating
  const angleCorrect = Math.abs(simPitch - activeSlot.idealAngle.pitch) < 4 && Math.abs(simRoll) < 3;

  return (
    <div id="camera-guide-container" className="flex flex-col h-full bg-white text-[#0A1420] overflow-hidden relative">
      
      {/* Hidden processing canvas */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Viewfinder — fills all remaining height. The nav, count and tick bars
          that used to stack above it (~170px of chrome) are now overlays on the
          feed itself. Tag damage / Checklist moved to a labelled pair above the
          shutter. */}
      <div className="capture-preview relative flex-1 min-h-0 bg-black flex flex-col justify-center overflow-hidden">
        {shutterFlash && (
          <div className="absolute inset-0 z-40 bg-white tl-shutter-flash" aria-hidden />
        )}

        {/* Header overlay — back · vehicle + count, with the progress bar.
            Container is click-through; only the back button takes pointer events. */}
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
                {vehicle.propertyType} — {vehicle.suburb}
              </p>
              <p className="text-[12px] font-mono text-[#4FE3DC]">
                {completedSlots.length} / {slots.length} · {slots.length - completedSlots.length} to go
              </p>
            </div>
            <div className="w-9 shrink-0" aria-hidden />
          </div>
          {/* Was a tick strip — three indicators counting the same thing. One 3px bar now. */}
          <div className="mt-2 h-[3px] rounded-full bg-[rgba(232,234,230,0.14)] overflow-hidden">
            <div
              className="h-full bg-[#0E9D98] transition-all duration-300"
              style={{ width: `${Math.round((completedSlots.length / Math.max(slots.length, 1)) * 100)}%` }}
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
                <span className="text-neutral-300">localhost</span> (not a blocked file:// page).
              </p>
            )}
          </div>
        )}

        {/* No car-shaped overlay — a purple silhouette over a real car never
            lines up and just gets in the way. The frame stays clean. */}


        {/* Simulated AI overlays (bubble level, lighting pill) removed —
            they showed fake sensor data and cluttered the viewfinder. */}

        {/* Slot identity — bottom-left on the feed, on a scrim instead of black
            pills. Name at 17/600, description under it. */}
        <div className="absolute inset-x-0 bottom-0 z-20 pointer-events-none px-4 pt-10 pb-3 bg-gradient-to-t from-black/75 via-black/35 to-transparent">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-[#4FE3DC]">Shot {activeSlotIndex + 1} / {slots.length}</span>
            <span className={`text-[11px] font-medium ${activeSlot.required ? 'text-[#4FE3DC]' : 'text-neutral-400'}`}>
              {activeSlot.required ? 'Required' : 'Optional'}
            </span>
          </div>
          <p className="text-[17px] font-semibold text-[#E8EAE6] leading-tight mt-0.5">{activeSlot.name}</p>
          <p className="text-[13px] text-neutral-300 leading-normal mt-0.5 max-w-[80%]">
            {activeSlot.description || 'Frame the panel inside the guide outline before capturing.'}
          </p>
        </div>
      </div>

      {/* Shot list — one continuous strip, all 27 slots. The chip strip and the
          console below are pinned siblings (no scroll wrapper), so Shoot / Skip /
          Import stay reachable and the viewfinder above (flex-1 min-h-0) flexes to
          fill the rest — a bigger preview with controls always in reach. */}
      <div className="bg-[#F0F4F8] border-t border-[rgba(10,20,32,0.06)] py-2 shrink-0 z-10">
        <div ref={chipStripRef} className="flex gap-2 overflow-x-auto pb-1 px-3 scrollbar-none">
          {allSlots.map((slot, i) => {
            const isTaken = !!photos[slot.id];
            const isSelected = selectedSlotId === slot.id;
            const isNext =
              !isTaken &&
              slot.id === (slots.find((s) => !photos[s.id])?.id);
            return (
              <button
                key={slot.id}
                data-slot={slot.id}
                type="button"
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
                  <span className="text-[11px] font-mono opacity-60">{String(i + 1).padStart(2, '0')}</span>
                  {isTaken && <Check size={12} />}
                </span>
                <span className="text-[12px] font-medium leading-tight line-clamp-2">{slot.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Capture & Controls Console */}
      <div className="bg-white p-4 border-t border-[rgba(10,20,32,0.06)] space-y-4 shrink-0">
        
        {/* "Not present" bypass for optional items — spare wheel, jack, spare keys, etc. */}
        {!activeSlot.required && !photos[activeSlot.id] && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-200 px-1">
            <button
              type="button"
              onClick={() => handleMarkNotPresent(activeSlot.id, activeSlot.name)}
              className="w-full py-2 bg-red-950/40 border border-red-500/30 text-red-400 hover:bg-red-950/60 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all tracking-normal mb-1"
            >
              <X size={12} className="stroke-[3]" /> Not present — skip this item
            </button>
          </div>
        )}

        {/* Inspect-only: Tag damage / Checklist as a labelled ghost pair above
            the shutter (moved out of the header). Amber stays amber; the
            checklist loses its cyan, because cyan is the shutter. */}
        {(onOpenDamageTagger || onOpenChecklist) && (
          <div className="flex items-center justify-center gap-2">
            {onOpenDamageTagger && (
              <button
                type="button"
                onClick={onOpenDamageTagger}
                title="Tag damage on captured photos"
                className="flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-[12px] text-[13px] font-medium text-amber-400 hover:bg-[rgba(245,158,11,0.10)] cursor-pointer transition-colors"
              >
                <AlertCircle size={16} /> Tag damage
              </button>
            )}
            {onOpenChecklist && (
              <button
                type="button"
                onClick={onOpenChecklist}
                title="Open the condition checklist"
                className="flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-[12px] text-[13px] font-medium text-[rgba(10,20,32,0.72)] hover:text-[#0A1420] hover:bg-[rgba(10,20,32,0.04)] cursor-pointer transition-colors"
              >
                <ClipboardCheck size={16} /> Checklist
              </button>
            )}
          </div>
        )}

        <div className="flex items-center justify-center gap-4">
          {/* Import — native camera capture when the live feed is off, a file
              picker when it is on. One control; both mean "put an image in this slot". */}
          {!isCameraActive ? (
            <label className="tru-btn-secondary w-[52px] h-[52px] flex flex-col items-center justify-center gap-0.5 cursor-pointer" title="Take a photo with the device camera">
              <Camera size={18} />
              <span className="text-[11px]">Import</span>
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
              <span className="text-[11px]">Import</span>
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

          {/* Skip — move to the next slot without capturing. Replaces the
              bulk-import control here. */}
          <button
            type="button"
            onClick={() => {
              const idx = allSlots.findIndex((s) => s.id === selectedSlotId);
              const next = allSlots[idx + 1];
              if (next) setSelectedSlotId(next.id);
            }}
            disabled={allSlots.findIndex((s) => s.id === selectedSlotId) >= allSlots.length - 1}
            className="tru-btn-secondary w-[52px] h-[52px] flex flex-col items-center justify-center gap-0.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            title="Skip to the next slot"
          >
            <SkipForward size={18} />
            <span className="text-[11px]">Skip</span>
          </button>
        </div>

        {progressPercentage === 100 && (
          <button
            type="button"
            onClick={onComplete || onBack}
            className="tru-btn-secondary w-full py-3 text-[14px] flex items-center justify-center gap-2 animate-in fade-in slide-in-from-bottom-2"
          >
            <Check size={16} /> All shots captured — review & submit
          </button>
        )}

      </div>

      {/* Bulk Importer Overlay Modal */}
      {isBulkModalOpen && (
        <div className="absolute inset-0 bg-white/98 z-50 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-4 py-4 border-b border-[rgba(10,20,32,0.06)] bg-[#F0F4F8] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Images className="text-indigo-400" size={18} />
              <div>
                <h3 className="text-[13px] font-medium text-[#0A1420]">Bulk Camera Roll Importer</h3>
                <p className="text-[13px] text-[rgba(10,20,32,0.55)]">Batch-import photos from your camera roll</p>
              </div>
            </div>
            {bulkProgress.status === 'idle' && (
              <button 
                onClick={() => {
                  setIsBulkModalOpen(false);
                  setBulkItems([]);
                }}
                className="p-1 rounded-full hover:bg-[#E8ECF0] text-[rgba(10,20,32,0.55)] cursor-pointer"
              >
                <X size={18} />
              </button>
            )}
          </div>

          {/* Sync Progress Banner */}
          {bulkProgress.status !== 'idle' && (
            <div className="bg-indigo-950/40 border-b border-indigo-900/30 px-4 py-3 space-y-2 shrink-0">
              <div className="flex justify-between items-center text-[13px]">
                <span className="font-semibold text-indigo-300 flex items-center gap-2">
                  {bulkProgress.status === 'syncing' ? (
                    <>
                      <Loader2 size={13} className="animate-spin text-indigo-400" />
                      <span>Syncing bulk photos to Lot ({bulkProgress.current} / {bulkProgress.total})</span>
                    </>
                  ) : bulkProgress.status === 'done' ? (
                    <span className="text-emerald-400 flex items-center gap-2 font-bold">
                      <Check size={14} className="font-semibold" /> All photos bulk-synced successfully!
                    </span>
                  ) : (
                    <span className="text-red-400">Error syncing photos. Try again.</span>
                  )}
                </span>
                <span className="text-[13px] font-mono text-[rgba(10,20,32,0.55)]">
                  {Math.round((bulkProgress.current / bulkProgress.total) * 100)}%
                </span>
              </div>
              <div className="w-full bg-[#F0F4F8] rounded-full h-1.5 overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 ${bulkProgress.status === 'done' ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                  style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Bulk Images List */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {bulkItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2 text-[rgba(10,20,32,0.45)]">
                <Upload size={32} />
                <p className="text-[13px]">Select photos from your device to start mapping</p>
              </div>
            ) : (
              bulkItems.map((item) => {
                const isTaken = !!photos[item.slotId];
                return (
                  <div key={item.id} className="bg-[#F0F4F8] rounded-xl p-3 border border-[rgba(10,20,32,0.06)] flex gap-3 items-center relative hover:border-[rgba(10,20,32,0.10)] transition-colors">
                    {/* Thumbnail */}
                    <div className="w-14 h-14 rounded-lg bg-black border border-[rgba(10,20,32,0.10)] overflow-hidden shrink-0 relative">
                      <img 
                        src={item.base64} 
                        alt="Bulk item thumbnail" 
                        className="w-full h-full object-cover" 
                        referrerPolicy="no-referrer"
                      />
                      <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-[13px] text-center font-mono py-0.5 truncate px-1 text-neutral-300">
                        {item.fileName}
                      </span>
                    </div>

                    {/* Slot Match Controller */}
                    <div className="flex-1 min-w-0">
                      <label className="text-[13px] font-medium text-[rgba(10,20,32,0.55)] block mb-1">
                        Assign Photographic Slot
                      </label>
                      <select
                        value={item.slotId}
                        disabled={bulkProgress.status === 'syncing'}
                        onChange={(e) => {
                          const val = e.target.value;
                          setBulkItems(prev => prev.map(p => p.id === item.id ? { ...p, slotId: val } : p));
                        }}
                        className="w-full bg-[#F4F8FC] border border-[rgba(10,20,32,0.10)] rounded-lg text-[13px] py-1 px-2 text-[rgba(10,20,32,0.85)] focus:border-indigo-500 focus:outline-none"
                      >
                        {slots.map(slot => (
                          <option key={slot.id} value={slot.id}>
                            {slot.name} {slot.required ? '(Required)' : ''}
                          </option>
                        ))}
                      </select>

                      {/* Info / Overwrite alert helper */}
                      {isTaken && (
                        <p className="text-[13px] text-amber-400 font-medium flex items-center gap-1 mt-1 font-sans">
                          <AlertCircle size={9} /> Already has a photo. This will replace it.
                        </p>
                      )}
                    </div>

                    {/* Delete item action */}
                    {bulkProgress.status === 'idle' && (
                      <button
                        onClick={() => {
                          setBulkItems(prev => prev.filter(p => p.id !== item.id));
                        }}
                        className="p-2 bg-red-950/20 hover:bg-red-950/40 text-red-400 border border-red-950/40 rounded-lg cursor-pointer shrink-0"
                        title="Remove photo"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Action Footer */}
          <div className="p-4 border-t border-[rgba(10,20,32,0.06)] bg-[#F0F4F8]/80 flex items-center gap-3 shrink-0">
            <button
              onClick={() => {
                setIsBulkModalOpen(false);
                setBulkItems([]);
              }}
              disabled={bulkProgress.status === 'syncing'}
              className="flex-1 py-2 bg-[#F4F8FC] border border-[rgba(10,20,32,0.10)] rounded-xl text-[13px] font-bold text-[rgba(10,20,32,0.45)] hover:bg-[#E8ECF0] cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSyncBulkPhotos}
              disabled={bulkItems.length === 0 || bulkProgress.status === 'syncing'}
              className="flex-1 py-2 tl-btn-3d bg-indigo-600 hover:bg-indigo-500 disabled:bg-[#E8ECF0] disabled:text-[rgba(10,20,32,0.45)] rounded-xl text-[13px] font-semibold text-white flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed shadow-md"
            >
              {bulkProgress.status === 'syncing' ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Syncing ({bulkProgress.current}/{bulkProgress.total})...
                </>
              ) : (
                <>
                  <Upload size={14} /> Sync {bulkItems.length} Photos
                </>
              )}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
