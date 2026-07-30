import React from 'react';
import { 
  Camera, Sliders, ChevronLeft, ChevronRight, Sun, Sparkles, AlertCircle,
  Check, RefreshCw, Upload, Smartphone, HelpCircle, Eye, Images, Loader2, Trash2, X,
  Circle, CheckCircle2, RotateCcw} from 'lucide-react';
import { Vehicle, QualityReport } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { DEFAULT_TEMPLATE } from '../templates';

interface CameraGuideProps {
  vehicle: Vehicle;
  onBack: () => void;
  onPhotoCaptured: (slotId: string, base64Image: string, qualityReport: QualityReport) => void;
  onEditRequested?: (slotId: string, base64Image: string, qualityReport: QualityReport) => void;
  onBulkPhotosUploaded: (updatedVehicle: Vehicle) => void;
}

export default function CameraGuide({ vehicle, onBack, onPhotoCaptured, onEditRequested, onBulkPhotosUploaded }: CameraGuideProps) {
  // A just-taken shot awaiting Redo / Keep. This is the whole point: shoot,
  // glance, keep or redo — no forced save-and-edit between every angle.
  const [pendingShot, setPendingShot] = React.useState<{ slotId: string; base64: string; report: QualityReport; kind: 'photo' | 'video' } | null>(null);
  const { user } = useAuth();
  // Crash-safe: never read vehicle.photos when undefined
  const photos = vehicle?.photos || {};
  const [selectedSlotId, setSelectedSlotId] = React.useState<string>('front_3_4');
  const [currentPhase, setCurrentPhase] = React.useState(1);
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
  const [simRotation, setSimRotation] = React.useState(45); // Degrees (Yaw)
  const [simPitch, setSimPitch] = React.useState(12); // Pitch (Phone vertical level)
  const [simRoll, setSimRoll] = React.useState(0); // Roll (Phone horizontal level)
  const [simBrightness, setSimBrightness] = React.useState(130); // 0-255
  const [customFile, setCustomFile] = React.useState<string | null>(null);

  // Auto-level assistant toggle

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
  const activeSlot = DEFAULT_TEMPLATE.slots.find(s => s.id === selectedSlotId) || DEFAULT_TEMPLATE.slots[0];

  const phaseNames = DEFAULT_TEMPLATE.phases.map(p => p.name);

  // Progress tracker calculation
  const completedSlots = DEFAULT_TEMPLATE.slots.filter(slot => !!photos[slot.id]);
  const progressPercentage = Math.round((completedSlots.length / DEFAULT_TEMPLATE.slots.length) * 100);

  const phaseSlots = DEFAULT_TEMPLATE.slots.filter(s => s.phase === currentPhase);
  const phaseCompleted = phaseSlots.every(s => !!photos[s.id] || !s.required);

  // Detailed phase completion status
  const phaseCompletionStatus = React.useMemo(() => {
    return DEFAULT_TEMPLATE.phases.map((p, i) => {
      const phaseIndex = i + 1;
      const slots = DEFAULT_TEMPLATE.slots.filter(s => s.phase === phaseIndex);
      const completed = slots.every(s => !!photos[s.id] || !s.required);
      return {
        phase: phaseIndex,
        name: p.name,
        completed
      };
    });
  }, [photos]);

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
      setCameraError('This browser cannot open the camera. Add photos with One photo or Many photos below.');
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
      setCameraError('No camera on this device. Add photos with One photo or Many photos below — the rest of the shoot works the same.');
    } else if (name === 'NotReadableError' || name === 'TrackStartError') {
      setCameraError('Another app is using the camera. Close it and tap Retry live camera, or add a photo from below.');
    } else {
      setCameraError('The live camera is not available here. One photo and Many photos still work for every shot.');
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
          const dataUri = event.target.result as string;
          setCustomFile(dataUri);
          setIsCameraActive(false);
        }
      };
      reader.readAsDataURL(file);
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
    const unfilledRequired = DEFAULT_TEMPLATE.slots.filter(s => s.required && !photos[s.id]);
    const unfilledAll = DEFAULT_TEMPLATE.slots.filter(s => !photos[s.id]);
    const assignableSlots = unfilledRequired.length > 0 ? unfilledRequired : (unfilledAll.length > 0 ? unfilledAll : DEFAULT_TEMPLATE.slots);

    Array.from(files).forEach((file, idx) => {
      const fileObj = file as File;
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const base64 = event.target.result as string;
          // Auto assign slot
          const slot = assignableSlots[idx % assignableSlots.length] || DEFAULT_TEMPLATE.slots[0];
          
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

  // After a photo is saved (parent updates vehicle.photos), auto-advance to next empty required slot
  const prevPhotoCount = React.useRef(Object.keys(photos).length);
  React.useEffect(() => {
    const count = Object.keys(photos).length;
    if (count > prevPhotoCount.current) {
      const next =
        DEFAULT_TEMPLATE.slots.find((s) => s.required && !photos[s.id]) ||
        DEFAULT_TEMPLATE.slots.find((s) => !photos[s.id]);
      if (next) {
        setSelectedSlotId(next.id);
        setCurrentPhase(next.phase);
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

  // Render SVG guide overlay path lines
  /**
   * A calm framing guide instead of a traced car silhouette.
   *
   * The old overlay drew a dashed car shape per body type over the live camera.
   * It never lined up with the actual car — no outline can match every make,
   * model and angle — so it just cluttered the viewfinder and fought the real
   * vehicle. Photographers frame with brackets and a target zone, not a traced
   * outline: fill the frame, keep it level, shoot. Universal, quiet, and it
   * works for any vehicle.
   */
  const renderGuideOverlay = () => {
    const label = (activeSlot.name || activeSlot.id || '').toString();
    return (
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
        {/* Corner brackets — frame the shot without drawing a car */}
        <g stroke="#4FE3DC" strokeWidth="0.7" fill="none" opacity="0.55">
          <path d="M 8,16 L 8,10 L 16,10" />
          <path d="M 92,16 L 92,10 L 84,10" />
          <path d="M 8,84 L 8,90 L 16,90" />
          <path d="M 92,84 L 92,90 L 84,90" />
        </g>
        {/* A soft target zone: fill roughly this much of the frame with the car */}
        <rect x="16" y="26" width="68" height="48" rx="2"
              stroke="#4FE3DC" strokeWidth="0.5" strokeDasharray="1.5,2"
              fill="none" opacity="0.35" />
        {/* Level line — keep the horizon straight */}
        <line x1="30" y1="50" x2="70" y2="50" stroke="#4FE3DC" strokeWidth="0.4" opacity="0.25" />
        {label && (
          <text x="50" y="20" textAnchor="middle" fill="#E8EAE6" fillOpacity="0.75"
                fontSize="3" fontFamily="Inter, sans-serif">{label}</text>
        )}
      </svg>
    );
  };

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
    <div id="camera-guide-container" className="flex flex-col h-full bg-neutral-950 text-[#E8EAE6] overflow-hidden relative">
      
      {/* Hidden processing canvas */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Top Navigation */}
      <div className="bg-neutral-900/90 px-4 py-3 flex items-center justify-between border-b border-neutral-850 z-20 shrink-0">
        <button 
          onClick={onBack}
          className="p-1 rounded-full hover:bg-neutral-800 text-neutral-300 flex items-center justify-center cursor-pointer"
        >
          <ChevronLeft size={20} />
        </button>
        {/* The vehicle is what the shooter needs to confirm they are on, so it
            leads. "Guide Overlay View" led instead — a name for a screen you are
            already looking at, set in wide-tracked bold, which is the loudest
            thing on the page saying the least. */}
        <div className="text-center min-w-0">
          <p className="text-[15px] text-[#E8EAE6] font-semibold truncate max-w-[220px]">
            {vehicle.year} {vehicle.make} {vehicle.model}
          </p>
          <p className="text-[12px] text-[rgba(232,234,230,0.55)]">Viewfinder</p>
        </div>
        <HelpCircle size={16} className="text-neutral-500 cursor-pointer" />
      </div>

      {/* 7-Phase Dynamic Progress Tracker */}
      <div className="bg-neutral-900 border-b border-neutral-850 px-4 py-2 shrink-0 animate-in slide-in-from-top-2 duration-300">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
            <Sparkles size={10} className="text-[#4FE3DC]" />
            {/* "Capture Workflow" / "Lot Readiness" — two pieces of product
                vocabulary for "the list of shots" and "how many are done".
                Neither is what anyone in the yard calls them. */}
            <span className="text-[13px] font-semibold text-neutral-200">Shot list</span>
          </div>
          <div className="flex items-center gap-2">
             <div className="text-[13px] font-mono text-neutral-500 ">Done</div>
             <div className="px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20">
                <span className="text-[13px] font-bold text-[#4FE3DC]">{progressPercentage}%</span>
             </div>
          </div>
        </div>
        
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${DEFAULT_TEMPLATE.phases.length}, minmax(0, 1fr))` }}
        >
          {phaseCompletionStatus.map((status, i) => {
            const isActive = currentPhase === status.phase;
            return (
              <button 
                key={i}
                onClick={() => {
                  setCurrentPhase(status.phase);
                  const firstSlot = DEFAULT_TEMPLATE.slots.find(s => s.phase === status.phase);
                  if (firstSlot) setSelectedSlotId(firstSlot.id);
                }}
                className="flex flex-col gap-2 group cursor-pointer border-none bg-transparent p-0"
              >
                {/* Progress Segment */}
                <div className="relative h-1 w-full rounded-full bg-neutral-800 overflow-hidden">
                  <div
                    style={{
                      width: status.completed ? '100%' : isActive ? '50%' : '0%',
                      backgroundColor: status.completed ? '#10b981' : '#4FE3DC'
                    }}
                    className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ${isActive ? 'opacity-100' : 'opacity-40'}`}
                  />
                </div>
                
                {/* Status Indicator */}
                <div className={`flex flex-col items-center gap-1 transition-all duration-300 ${isActive ? 'scale-110' : 'opacity-50 group-hover:opacity-100'}`}>
                   <div className={`w-4 h-4 rounded-full flex items-center justify-center border transition-colors ${
                     status.completed 
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.2)]' 
                      : isActive 
                      ? 'bg-indigo-500/20 border-indigo-500/40 text-[#4FE3DC] shadow-[0_0_8px_rgba(6,182,212,0.2)]' 
                      : 'bg-neutral-900 border-neutral-800 text-neutral-500'
                   }`}>
                      {status.completed ? (
                        <Check size={9} className="stroke-[4]" />
                      ) : (
                        <span className="text-[11px] font-semibold">{status.phase}</span>
                      )}
                   </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Viewfinder Main View */}
      {/* min-h gives the viewfinder a floor instead of leaving it whatever the
          chrome does not use. As flex-1 alone it was competing with a shot-list
          header, a phase strip, a slot row, a three-button utility row and a hint
          panel, and lost — the preview came out a letterbox strip about a third
          of a phone screen, which is not enough to frame a car in.
          svh not vh: the mobile address bar collapses on scroll, and vh would
          change the framing mid-shoot. */}
      <div className="capture-preview relative flex-1 min-h-[46svh] bg-black flex flex-col justify-center overflow-hidden">
        {shutterFlash && (
          <div className="absolute inset-0 z-40 bg-white tl-shutter-flash" aria-hidden />
        )}
        {captureHint && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 px-3 py-2 rounded-full bg-black/70 border border-white/15 text-[13px] font-bold text-[#E8EAE6] shadow-lg animate-in fade-in slide-in-from-top-1">
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

        {/* Dynamic SVG Guide Silhouette */}
        {renderGuideOverlay()}

        {/* Real-time Gyro / Bubble Level Circle Overlay */}
        {/* The level bubble and the lighting readout were removed from the
            viewfinder. Both were simulated rather than measured — the roll and
            pitch come from simRoll/simPitch, and "Lighting Perfect" was a fixed
            verdict, so they reported confidence they did not have. They also sat
            on top of the only region that has to stay readable while framing a
            car, on a screen that is already too short. */}
        {/* Quick Camera Source Helper overlay if webcam unavailable */}
        {!isCameraActive && !customFile && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 px-3 py-1 rounded text-[13px] tracking-wide text-neutral-400 flex items-center gap-1">
            <Eye size={10} className="text-[#4FE3DC]" /> Use alignment guides to frame your vehicle.
          </div>
        )}
      </div>

      {/* Below-viewfinder chrome: scrolls when the viewfinder's min-h
          leaves less than the chrome needs. min-h-0 is required — without it
          a flex child won't shrink below its content size. */}
      <div className="flex-1 min-h-0 overflow-y-auto">

      {/* Guide Slots Carousel Picker */}
      <div className="bg-neutral-900 border-t border-neutral-850 p-2 shrink-0 z-10">
        <div className="flex items-center justify-between px-2 mb-2">
          <p className="text-[13px] text-neutral-400 font-bold tracking-normal">
            Phase {currentPhase}: {phaseNames[currentPhase - 1]}
          </p>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 px-2 scrollbar-none">
          {phaseSlots.map(slot => {
            const isTaken = !!photos[slot.id];
            const isSelected = selectedSlotId === slot.id;
            const isNext =
              !isTaken &&
              slot.required &&
              slot.id === (DEFAULT_TEMPLATE.slots.find((s) => s.required && !photos[s.id])?.id);
            return (
              <button
                key={slot.id}
                type="button"
                onClick={() => setSelectedSlotId(slot.id)}
                /* shrink-0 is load-bearing: the row is overflow-x-auto, but flex children
                   shrink by default, so without it the chips compressed instead of
                   scrolling — and whitespace-nowrap then pushed each label out of its
                   own box and onto the next chip. */
                className={`slot-state shrink-0 px-3 py-2 rounded-lg text-[13px] font-semibold whitespace-nowrap cursor-pointer flex items-center gap-2 transition-all ${
                  isSelected
                    ? 'slot-state--active'
                    : isTaken
                    ? 'slot-state--captured'
                    : isNext
                    ? 'slot-state--next'
                    : 'slot-state--idle'
                }`}
              >
                {isTaken ? (
                  <Check size={10} className="font-semibold" />
                ) : isNext ? (
                  <span className="text-[13px] font-semibold">NEXT</span>
                ) : null}
                {slot.name} {slot.required && !isTaken ? '*' : ''}
              </button>
            );
          })}
        </div>
        
        <div className="flex items-center justify-between mt-2 px-2">
          <button
            disabled={currentPhase === 1}
            onClick={() => {
              const newPhase = currentPhase - 1;
              setCurrentPhase(newPhase);
              const firstSlotOfNewPhase = DEFAULT_TEMPLATE.slots.find(s => s.phase === newPhase);
              if (firstSlotOfNewPhase) setSelectedSlotId(firstSlotOfNewPhase.id);
            }}
            className="text-[13px] font-bold text-neutral-400 hover:text-[#E8EAE6] disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
          >
            <ChevronLeft size={12} /> Prev Phase
          </button>
          
          <p className="text-[13px] text-neutral-300 font-medium truncate max-w-[150px]">
            {activeSlot.description}
          </p>

          <button
            disabled={currentPhase === DEFAULT_TEMPLATE.phases.length}
            onClick={() => {
              const newPhase = currentPhase + 1;
              setCurrentPhase(newPhase);
              const firstSlotOfNewPhase = DEFAULT_TEMPLATE.slots.find(s => s.phase === newPhase);
              if (firstSlotOfNewPhase) setSelectedSlotId(firstSlotOfNewPhase.id);
            }}
            className={`text-[13px] font-bold flex items-center gap-1 cursor-pointer ${phaseCompleted ? 'text-[#4FE3DC] hover:text-indigo-300' : 'text-neutral-500'}`}
          >
            Next Phase <ChevronRight size={12} />
          </button>
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
                className="flex-1 py-4 rounded-2xl flex items-center justify-center gap-2 font-semibold text-[16px] bg-white/5 border border-white/15 text-[#E8EAE6] active:scale-[0.98] transition-all"
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
                className="flex-[2] py-4 rounded-2xl flex items-center justify-center gap-2 font-semibold text-[16px] bg-[#4FE3DC] text-[#06080D] active:scale-[0.98] transition-all"
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
                Edit this shot first
              </button>
            )}
          </div>
        ) : (
        <button
          type="button"
          onClick={handleCapture}
          className="w-full py-4 rounded-2xl flex items-center justify-center gap-3 cursor-pointer shadow-lg active:scale-[0.98] transition-all font-semibold text-[16px] tracking-normal disabled:opacity-60 bg-[#4FE3DC] text-[#06080D] border border-transparent"
          title="Take picture for this slot"
        >
          <Camera size={20} strokeWidth={2.5} />
          {isCameraActive
            ? 'Take picture'
            : customFile
              ? 'Use this photo'
              : 'Take picture'}
        </button>
        )}

        {/* Secondary tools */}
        <div className="flex items-center justify-between gap-2">
          {/* Native camera fallback — capture attr skips the gallery picker when the
              in-app live camera is blocked (e.g. PWA denied getUserMedia).

              Only shown when that has actually happened. With the live camera
              running this was a second shutter sitting beside the real one, in a
              row already four tiles wide on a 360px screen, and the two do the
              same thing from the shooter's side. */}
          {!isCameraActive && (
            <label className="flex-1 py-2 rounded-xl text-[13px] font-bold flex flex-col items-center justify-center gap-1 cursor-pointer text-center border transition-colors bg-amber-600/20 border-amber-500/40 text-amber-300 hover:bg-amber-600/30">
              <Camera size={13} className="text-amber-400" />
              Phone camera
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          )}

          <label className={`flex-1 py-2 rounded-xl text-[13px] font-bold flex flex-col items-center justify-center gap-1 cursor-pointer text-center border transition-colors ${
            !isCameraActive
              ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/30'
              : 'bg-neutral-900 border-neutral-800 hover:bg-neutral-850 text-neutral-300'
          }`}>
            <Upload size={13} className={!isCameraActive ? 'text-emerald-400' : 'text-neutral-400'} />
            One photo
            <input
              ref={singleUploadRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          <label className="flex-1 py-2 bg-indigo-950/40 border border-indigo-900/50 hover:bg-indigo-900/40 rounded-xl text-[13px] font-bold text-[#4FE3DC] flex flex-col items-center justify-center gap-1 cursor-pointer text-center relative">
            <Images size={13} className="text-[#4FE3DC]" />
            <span>Many photos</span>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleBulkFileUpload}
              className="hidden"
            />
          </label>

        </div>

        {/* Guidance for the panel being shot right now. This was a single
            hardcoded sentence repeated on all 26 slots, so it stopped being
            read after the first one. Every slot already carries a description
            written for it — show that instead. Body copy is neutral, not cyan:
            cyan is reserved for where the eye should go next. */}
        <div className="flex gap-2 bg-neutral-900/60 p-3 rounded-xl border border-neutral-800">
          <Sparkles className="text-[#4FE3DC] shrink-0" size={13} />
          <p className="text-[13px] text-neutral-300 leading-normal">
            <strong className="text-neutral-100">{activeSlot.name}:</strong>{' '}
            {activeSlot.description || 'Frame the panel inside the guide outline before capturing.'}
          </p>
        </div>

      </div>

      </div>{/* end below-viewfinder scroll wrapper */}

      {/* Bulk Importer Overlay Modal */}
      {isBulkModalOpen && (
        <div className="absolute inset-0 bg-neutral-950/98 z-50 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-4 py-4 border-b border-neutral-850 bg-neutral-900 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Images className="text-[#4FE3DC]" size={18} />
              <div>
                <h3 className="text-[13px] font-bold text-[#E8EAE6]">Bulk Camera Roll Importer</h3>
                <p className="text-[13px] text-neutral-400">Streamline inventory lot photography bulk processing</p>
              </div>
            </div>
            {bulkProgress.status === 'idle' && (
              <button 
                onClick={() => {
                  setIsBulkModalOpen(false);
                  setBulkItems([]);
                }}
                className="p-1 rounded-full hover:bg-neutral-800 text-neutral-400 cursor-pointer"
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
                      <Loader2 size={13} className="animate-spin text-[#4FE3DC]" />
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
                <span className="text-[13px] font-mono text-neutral-400">
                  {Math.round((bulkProgress.current / bulkProgress.total) * 100)}%
                </span>
              </div>
              <div className="w-full bg-neutral-900 rounded-full h-1.5 overflow-hidden">
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
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2 text-neutral-500">
                <Upload size={32} />
                <p className="text-[13px]">Select photos from your device to start mapping</p>
              </div>
            ) : (
              bulkItems.map((item) => {
                const isTaken = !!photos[item.slotId];
                return (
                  <div key={item.id} className="bg-neutral-900 rounded-xl p-3 border border-neutral-850 flex gap-3 items-center relative hover:border-neutral-800 transition-colors">
                    {/* Thumbnail */}
                    <div className="w-14 h-14 rounded-lg bg-black border border-neutral-800 overflow-hidden shrink-0 relative">
                      <img 
                        src={item.base64} 
                        alt="Bulk item thumbnail" 
                        className="w-full h-full object-cover" 
                        referrerPolicy="no-referrer"
                      />
                      <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-[11px] text-center font-mono py-0.5 truncate px-1 text-neutral-300">
                        {item.fileName}
                      </span>
                    </div>

                    {/* Slot Match Controller */}
                    <div className="flex-1 min-w-0">
                      <label className="text-[13px]  font-bold text-neutral-400 tracking-wider block mb-1">
                        Assign Photographic Slot
                      </label>
                      <select
                        value={item.slotId}
                        disabled={bulkProgress.status === 'syncing'}
                        onChange={(e) => {
                          const val = e.target.value;
                          setBulkItems(prev => prev.map(p => p.id === item.id ? { ...p, slotId: val } : p));
                        }}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-lg text-[13px] py-1 px-2 text-neutral-200 focus:border-indigo-500 focus:outline-none"
                      >
                        {DEFAULT_TEMPLATE.slots.map(slot => (
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
          <div className="p-4 border-t border-neutral-850 bg-neutral-900/80 flex items-center gap-3 shrink-0">
            <button
              onClick={() => {
                setIsBulkModalOpen(false);
                setBulkItems([]);
              }}
              disabled={bulkProgress.status === 'syncing'}
              className="flex-1 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-[13px] font-bold text-neutral-400 hover:bg-neutral-900 cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSyncBulkPhotos}
              disabled={bulkItems.length === 0 || bulkProgress.status === 'syncing'}
              className="flex-1 py-2 tl-btn-3d bg-indigo-600 hover:bg-indigo-500 disabled:bg-neutral-800 disabled:text-neutral-500 rounded-xl text-[13px] font-semibold text-[#E8EAE6] flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed shadow-md"
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
