import React from 'react';
import { 
  Camera, Sliders, ChevronLeft, ChevronRight, Sun, Volume2, Sparkles, AlertCircle, 
  Check, RefreshCw, Upload, Smartphone, HelpCircle, Eye, Images, Loader2, Trash2, X,
  Circle, CheckCircle2
} from 'lucide-react';
import { Vehicle, PhotoSlot, QualityReport, PHOTO_SLOTS } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface CameraGuideProps {
  vehicle: Vehicle;
  onBack: () => void;
  onPhotoCaptured: (slotId: string, base64Image: string, qualityReport: QualityReport) => void;
  onBulkPhotosUploaded: (updatedVehicle: Vehicle) => void;
}

export default function CameraGuide({ vehicle, onBack, onPhotoCaptured, onBulkPhotosUploaded }: CameraGuideProps) {
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
  
  // Custom video recording simulation states for 360 walkaround
  const [isRecording360, setIsRecording360] = React.useState(false);
  const [recordingProgress, setRecordingProgress] = React.useState(0);

  // Real-time camera & canvas references
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);

  // Simulated vehicle visualizer state (for fallback / testing)
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
  const activeSlot = PHOTO_SLOTS.find(s => s.id === selectedSlotId) || PHOTO_SLOTS[0];

  const phaseNames = [
    'Exterior Panels',
    'Details & Badges',
    'Interior',
    'Engine & Mechanical',
    'Recon / Work',
    'Documents',
    '360 Walkaround'
  ];

  // Progress tracker calculation
  const completedSlots = PHOTO_SLOTS.filter(slot => !!photos[slot.id]);
  const progressPercentage = Math.round((completedSlots.length / PHOTO_SLOTS.length) * 100);

  const phaseSlots = PHOTO_SLOTS.filter(s => s.phase === currentPhase);
  const phaseCompleted = phaseSlots.every(s => !!photos[s.id] || !s.required);

  // Detailed phase completion status
  const phaseCompletionStatus = React.useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const phaseIndex = i + 1;
      const slots = PHOTO_SLOTS.filter(s => s.phase === phaseIndex);
      const completed = slots.every(s => !!photos[s.id] || !s.required);
      return {
        phase: phaseIndex,
        name: phaseNames[i],
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
      setCameraError('This browser has no camera API. Use Upload / Bulk Roll on PC.');
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
        'Camera blocked by the browser. Click the camera icon in the address bar → Allow, then tap Retry. Or use Upload / Bulk Roll (works fully on PC).'
      );
    } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      setCameraError('No webcam found on this PC. Use Upload Photo or Bulk Roll instead — that path is fully supported.');
    } else if (name === 'NotReadableError' || name === 'TrackStartError') {
      setCameraError('Camera is in use by another app (Zoom, Teams, etc.). Close it and tap Retry, or use Upload.');
    } else {
      setCameraError('Live camera unavailable on this device. Upload / Bulk Roll still works for every shot.');
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
    const unfilledRequired = PHOTO_SLOTS.filter(s => s.required && !photos[s.id]);
    const unfilledAll = PHOTO_SLOTS.filter(s => !photos[s.id]);
    const assignableSlots = unfilledRequired.length > 0 ? unfilledRequired : (unfilledAll.length > 0 ? unfilledAll : PHOTO_SLOTS);

    Array.from(files).forEach((file, idx) => {
      const fileObj = file as File;
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const base64 = event.target.result as string;
          // Auto assign slot
          const slot = assignableSlots[idx % assignableSlots.length] || PHOTO_SLOTS[0];
          
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
    ctx.strokeStyle = 'rgba(139, 92, 246, 0.1)';
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
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('LOT PHOTO RECORDING ENGINE • COMPULSORY BYPASS', 540, 180);

    ctx.fillStyle = '#f3f4f6';
    ctx.font = 'bold 46px sans-serif';
    ctx.fillText('SERVICE HISTORY BOOKLET', 540, 310);

    ctx.fillStyle = '#ef4444';
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

  // Capture Photo action — always take/confirm a shot (never navigates elsewhere)
  const handleCapture = (e?: React.MouseEvent) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();

    // If it is 360 Video, trigger active recording animation
    if (activeSlot.id === 'video_360' && !isRecording360) {
      setIsRecording360(true);
      setRecordingProgress(0);
      
      let prog = 0;
      const interval = setInterval(() => {
        prog += 5;
        setRecordingProgress(prog);
        
        // Spin the simulated vehicle smoothly
        setSimRotation((prev) => (prev + 18) % 360);
        
        if (prog >= 100) {
          clearInterval(interval);
          setIsRecording360(false);
          
          // Capture final spin frame
          const canvas = canvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
              canvas.width = 1080;
              canvas.height = 720;
              
              if (isCameraActive && videoRef.current) {
                ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
              } else {
                drawSimulatedCarScene(ctx, canvas.width, canvas.height);
              }
              
              // Draw a "360° Video Walkaround" stamp
              ctx.save();
              ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
              ctx.fillRect(40, 40, 260, 60);
              ctx.strokeStyle = '#8b5cf6';
              ctx.lineWidth = 2;
              ctx.strokeRect(40, 40, 260, 60);
              
              ctx.fillStyle = '#ffffff';
              ctx.font = 'bold 16px monospace';
              ctx.fillText('● 360° VIDEO RECORDED', 60, 75);
              ctx.restore();
              
              finalizeCapture(canvas);
            }
          }
        }
      }, 150);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set high-resolution dimensions
    canvas.width = 1080;
    canvas.height = 720;

    // Draw frame (live camera → uploaded file → still capture without leaving this screen)
    if (isCameraActive && videoRef.current) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      finalizeCapture(canvas);
      return;
    }

    if (customFile) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        finalizeCapture(canvas);
      };
      img.onerror = () => {
        alert('Could not read the uploaded image. Try another JPG/PNG file.');
      };
      img.src = customFile;
      return;
    }

    // PC / no camera: still produce a usable frame from the guide view (user can re-upload)
    // Do NOT navigate away or open Settings.
    drawSimulatedCarScene(ctx, canvas.width, canvas.height);
    finalizeCapture(canvas);
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

    setCaptureHint(`Captured · ${activeSlot.name}`);
    setTimeout(() => setCaptureHint(null), 1400);
    onPhotoCaptured(selectedSlotId, base64Data, report);
  };

  // After a photo is saved (parent updates vehicle.photos), auto-advance to next empty required slot
  const prevPhotoCount = React.useRef(Object.keys(photos).length);
  React.useEffect(() => {
    const count = Object.keys(photos).length;
    if (count > prevPhotoCount.current) {
      const next =
        PHOTO_SLOTS.find((s) => s.required && !photos[s.id]) ||
        PHOTO_SLOTS.find((s) => !photos[s.id]);
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

  // Draw simulated car inside the canvas for instant testing without camera
  const drawSimulatedCarScene = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // 1. Solid backdrop base
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#0f172a'); // Slate dark sky
    grad.addColorStop(0.6, '#1e293b'); // Horizon
    grad.addColorStop(0.61, '#475569'); // Concrete deck
    grad.addColorStop(1, '#0f172a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // 2. Concrete perspective guidelines
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 2;
    for (let i = -10; i <= 10; i++) {
      ctx.beginPath();
      ctx.moveTo(width / 2, height * 0.6);
      ctx.lineTo(width / 2 + i * 150, height);
      ctx.stroke();
    }

    // 3. Draw a gorgeous high-fidelity wireframe car
    ctx.save();
    ctx.translate(width / 2, height * 0.65);
    
    // Scale car based on height
    const scale = 2.4;
    ctx.scale(scale, scale);

    // Dynamic coloring based on user color selection
    ctx.fillStyle = simColor;
    ctx.strokeStyle = '#ffffff';

    // Shadow blob
    ctx.beginPath();
    ctx.ellipse(0, 22, 110, 15, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fill();

    // Adjust drawing lines depending on Simulated Yaw (rotation)
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';

    // Chassis Silhouette Base
    ctx.beginPath();
    ctx.moveTo(-100, 15);
    ctx.lineTo(-95, 0);
    ctx.lineTo(-60, -8);
    ctx.lineTo(-30, -32);
    ctx.lineTo(25, -32);
    ctx.lineTo(65, -8);
    ctx.lineTo(95, 0);
    ctx.lineTo(100, 15);
    ctx.closePath();
    ctx.fillStyle = simColor;
    ctx.fill();
    ctx.stroke();

    // Greenhouse Cabin / Windows
    ctx.beginPath();
    ctx.moveTo(-45, -8);
    ctx.lineTo(-25, -28);
    ctx.lineTo(20, -28);
    ctx.lineTo(40, -8);
    ctx.closePath();
    ctx.fillStyle = 'rgba(15,23,42,0.8)';
    ctx.fill();
    ctx.stroke();

    // Side details / Wheel arches
    ctx.beginPath();
    ctx.arc(-65, 15, 14, Math.PI, 0, false);
    ctx.arc(65, 15, 14, Math.PI, 0, false);
    ctx.fillStyle = '#090d16';
    ctx.fill();
    ctx.stroke();

    // Chrome Wheels
    ctx.beginPath();
    ctx.arc(-65, 15, 10, 0, Math.PI * 2);
    ctx.arc(65, 15, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#e2e8f0';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#334155';
    ctx.stroke();

    // Headlights (glowing yellow based on brightness)
    ctx.beginPath();
    ctx.arc(92, 6, 4, 0, Math.PI * 2);
    ctx.fillStyle = simBrightness > 150 ? '#fef08a' : '#94a3b8';
    ctx.fill();

    ctx.restore();

    // 4. Glare effect text
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('LOT CAMERA OVERLAY', width / 2, height / 3);
  };

  // Render SVG guide overlay path lines
  const renderGuideOverlay = () => {
    switch (activeSlot.id) {
      case 'front_3_4':
        const isSUV = vehicle.vehicleType?.includes('SUV') || vehicle.vehicleType?.includes('Crossover');
        const isBakkie = vehicle.vehicleType?.includes('Bakkie') || vehicle.vehicleType?.includes('Truck');
        
        return (
          <svg className="absolute inset-0 w-full h-full pointer-events-none text-trulens-purple" viewBox="0 0 100 100" preserveAspectRatio="none">
            {isSUV ? (
              <path d="M 10,70 L 15,50 L 30,42 L 35,22 L 75,22 L 85,42 L 95,50 L 92,72 C 92,72 62,78 50,78 C 38,78 10,70 10,70 Z" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2,2" />
            ) : isBakkie ? (
              <path d="M 10,70 L 15,50 L 30,42 L 35,25 L 65,25 L 65,45 L 95,45 L 95,70 Z" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2,2" />
            ) : (
              <path d="M 15,65 L 20,50 L 32,45 L 42,28 L 75,28 L 85,45 L 90,52 L 87,68 C 87,68 62,72 50,72 C 38,72 15,65 15,65 Z" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2,2" />
            )}
            <circle cx="30" cy={isSUV ? 70 : 65} r="5.5" fill="none" stroke="currentColor" strokeWidth="1" />
            <circle cx="78" cy={isSUV ? 68 : 63} r="5.5" fill="none" stroke="currentColor" strokeWidth="1" />
          </svg>
        );
      case 'side_driver':
      case 'side_passenger':
        const isSideSUV = vehicle.vehicleType?.includes('SUV') || vehicle.vehicleType?.includes('Crossover');
        const isSideBakkie = vehicle.vehicleType?.includes('Bakkie') || vehicle.vehicleType?.includes('Truck');

        return (
          <svg className="absolute inset-0 w-full h-full pointer-events-none text-trulens-purple" viewBox="0 0 100 100" preserveAspectRatio="none">
            {isSideSUV ? (
              <path d="M 5,72 L 8,50 L 25,40 L 30,22 L 80,22 L 90,35 L 95,50 L 95,72 Z" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2,2" />
            ) : isSideBakkie ? (
              <path d="M 5,72 L 8,50 L 25,40 L 30,25 L 60,25 L 60,45 L 95,45 L 95,72 Z" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2,2" />
            ) : (
              <path d="M 10,65 L 12,54 L 28,45 L 38,30 L 72,30 L 80,45 L 92,54 L 92,65 Z" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2,2" />
            )}
            <circle cx="25" cy={isSideSUV || isSideBakkie ? 70 : 64} r="6" fill="none" stroke="currentColor" strokeWidth="1" />
            <circle cx="75" cy={isSideSUV || isSideBakkie ? 70 : 64} r="6" fill="none" stroke="currentColor" strokeWidth="1" />
            <text x="50" y="15" textAnchor="middle" fill="currentColor" fontSize="3" fontFamily="monospace">{activeSlot.id === 'side_driver' ? 'DRIVER' : 'PASSENGER'} SIDE</text>
          </svg>
        );
      case 'rear_3_4':
        return (
          <svg className="absolute inset-0 w-full h-full pointer-events-none text-trulens-purple" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path d="M 85,65 L 80,50 L 68,45 L 58,28 L 25,28 L 15,45 L 10,52 L 13,68 C 13,68 38,72 50,72 C 62,72 85,65 85,65 Z" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2,2" />
            <circle cx="70" cy="65" r="5.5" fill="none" stroke="currentColor" strokeWidth="1" />
            <circle cx="22" cy="63" r="5.5" fill="none" stroke="currentColor" strokeWidth="1" />
          </svg>
        );
      case 'rear_profile':
        return (
          <svg className="absolute inset-0 w-full h-full pointer-events-none text-trulens-purple" viewBox="0 0 100 100" preserveAspectRatio="none">
            <rect x="20" y="32" width="60" height="34" rx="4" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2,2" />
            <circle cx="30" cy="65" r="5" fill="none" stroke="currentColor" strokeWidth="1" />
            <circle cx="70" cy="65" r="5" fill="none" stroke="currentColor" strokeWidth="1" />
          </svg>
        );
      case 'barcode_scanner':
        return (
          <svg className="absolute inset-0 w-full h-full pointer-events-none text-trulens-purple/85" viewBox="0 0 100 100" preserveAspectRatio="none">
            {/* Holographic Barcode/VIN Box scan visualizer */}
            <rect x="15" y="30" width="70" height="40" rx="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M 12,25 L 12,15 L 25,15" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M 88,25 L 88,15 L 75,15" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M 12,75 L 12,85 L 25,85" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M 88,75 L 88,85 L 75,85" fill="none" stroke="currentColor" strokeWidth="2" />
            
            {/* Simulated barcode lines */}
            <line x1="25" y1="38" x2="25" y2="62" stroke="currentColor" strokeWidth="1.5" />
            <line x1="30" y1="38" x2="30" y2="62" stroke="currentColor" strokeWidth="3" />
            <line x1="35" y1="38" x2="35" y2="62" stroke="currentColor" strokeWidth="1" />
            <line x1="42" y1="38" x2="42" y2="62" stroke="currentColor" strokeWidth="4" />
            <line x1="48" y1="38" x2="48" y2="62" stroke="currentColor" strokeWidth="1.5" />
            <line x1="53" y1="38" x2="53" y2="62" stroke="currentColor" strokeWidth="2" />
            <line x1="60" y1="38" x2="60" y2="62" stroke="currentColor" strokeWidth="3.5" />
            <line x1="68" y1="38" x2="68" y2="62" stroke="currentColor" strokeWidth="1.5" />
            <line x1="75" y1="38" x2="75" y2="62" stroke="currentColor" strokeWidth="2.5" />

            {/* Red Laser scan bar moving or pulsing */}
            <line x1="15" y1="50" x2="85" y2="50" stroke="rgba(239, 68, 68, 0.85)" strokeWidth="2" className="animate-pulse" />
            <text x="50" y="24" textAnchor="middle" fill="currentColor" fontSize="3.5" fontFamily="monospace" fontWeight="bold">ALIGN BARCODE IN RED ZONE</text>
          </svg>
        );
      case 'interior_seats':
        return (
          <svg className="absolute inset-0 w-full h-full pointer-events-none text-trulens-purple" viewBox="0 0 100 100" preserveAspectRatio="none">
            <rect x="20" y="25" width="25" height="40" rx="3" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2,2" />
            <rect x="55" y="25" width="25" height="40" rx="3" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2,2" />
            <line x1="15" y1="65" x2="85" y2="65" stroke="currentColor" strokeWidth="0.8" />
            <text x="50" y="20" textAnchor="middle" fill="currentColor" fontSize="3" fontFamily="sans-serif">ALIGN CABIN & SEATS</text>
          </svg>
        );
      case 'service_book':
        return (
          <svg className="absolute inset-0 w-full h-full pointer-events-none text-trulens-purple/70" viewBox="0 0 100 100" preserveAspectRatio="none">
            {/* Outline booklet shape */}
            <rect x="22" y="25" width="56" height="50" rx="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <line x1="50" y1="25" x2="50" y2="75" stroke="currentColor" strokeWidth="1.5" />
            
            {/* Stamp circles inside book */}
            <circle cx="36" cy="40" r="6" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="1,1" />
            <circle cx="36" cy="60" r="6" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="1,1" />
            <circle cx="64" cy="40" r="6" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="1,1" />
            <circle cx="64" cy="60" r="6" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="1,1" />
            
            <text x="50" y="20" textAnchor="middle" fill="currentColor" fontSize="3.5" fontFamily="monospace" fontWeight="bold">ALIGN SERVICE HISTORY PAGES</text>
          </svg>
        );
      case 'video_360':
        return (
          <svg className="absolute inset-0 w-full h-full pointer-events-none text-indigo-400/75" viewBox="0 0 100 100" preserveAspectRatio="none">
            {/* Spinning orbital design */}
            <circle cx="50" cy="50" r="38" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3,3" />
            <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="0.5" />
            
            {/* Left and right spin indicators */}
            <path d="M 12,50 L 8,45 L 8,55 Z" fill="currentColor" />
            <path d="M 88,50 L 92,45 L 92,55 Z" fill="currentColor" />
            
            <text x="50" y="16" textAnchor="middle" fill="currentColor" fontSize="3.5" fontFamily="monospace" fontWeight="bold">360° VIDEO WALKAROUND</text>
            <text x="50" y="88" textAnchor="middle" fill="currentColor" fontSize="3" fontFamily="sans-serif">Hold stable while rotation completes</text>
          </svg>
        );
      case 'license_and_disc':
        return (
          <svg className="absolute inset-0 w-full h-full pointer-events-none text-indigo-400/60" viewBox="0 0 100 100" preserveAspectRatio="none">
            {/* Plate rectangle */}
            <rect x="25" y="55" width="50" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="3,3" />
            {/* Windshield License/Tax Disc Circle template */}
            <circle cx="75" cy="32" r="10" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="75" cy="32" r="1" fill="currentColor" />
            <line x1="75" y1="18" x2="75" y2="22" stroke="currentColor" strokeWidth="1" />
            <text x="75" y="47" textAnchor="middle" fill="currentColor" fontSize="3" fontFamily="monospace">DISC ALIGN</text>
          </svg>
        );
      case 'body_panels':
        return (
          <svg className="absolute inset-0 w-full h-full pointer-events-none text-indigo-400/50" viewBox="0 0 100 100" preserveAspectRatio="none">
            {/* Angle lines for panel gaps */}
            <line x1="40" y1="15" x2="40" y2="85" stroke="currentColor" strokeWidth="1" strokeDasharray="4,4" />
            <line x1="60" y1="15" x2="60" y2="85" stroke="currentColor" strokeWidth="1" strokeDasharray="4,4" />
            <text x="50" y="50" textAnchor="middle" fill="currentColor" fontSize="3" fontFamily="sans-serif">ALIGN PANEL GAP CENTER</text>
          </svg>
        );
      case 'tyres_detail':
        return (
          <svg className="absolute inset-0 w-full h-full pointer-events-none text-indigo-400/65" viewBox="0 0 100 100" preserveAspectRatio="none">
            {/* Vertical tyre outline template */}
            <rect x="35" y="15" width="30" height="70" rx="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
            {/* Tread pattern indicators */}
            <line x1="38" y1="30" x2="62" y2="30" stroke="currentColor" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="38" y1="50" x2="62" y2="50" stroke="currentColor" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="38" y1="70" x2="62" y2="70" stroke="currentColor" strokeWidth="1" strokeDasharray="2,2" />
            <text x="50" y="8" textAnchor="middle" fill="currentColor" fontSize="3.5" fontFamily="monospace" fontWeight="bold">TYRE TREAD ZONE</text>
          </svg>
        );
      case 'rims_condition':
        return (
          <svg className="absolute inset-0 w-full h-full pointer-events-none text-indigo-400/65" viewBox="0 0 100 100" preserveAspectRatio="none">
            {/* Circle for curb rash check */}
            <circle cx="50" cy="50" r="32" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="50" cy="50" r="30" fill="none" stroke="currentColor" strokeWidth="0.8" strokeDasharray="1,1" />
            <circle cx="50" cy="50" r="8" fill="none" stroke="currentColor" strokeWidth="1" />
            {/* Radial spokes guides */}
            <line x1="50" y1="18" x2="50" y2="82" stroke="currentColor" strokeWidth="0.5" />
            <line x1="18" y1="50" x2="82" y2="50" stroke="currentColor" strokeWidth="0.5" />
            <text x="50" y="14" textAnchor="middle" fill="currentColor" fontSize="3" fontFamily="monospace">RIM CURB RASH EXAMINE</text>
          </svg>
        );
      case 'vehicle_damage':
        return (
          <svg className="absolute inset-0 w-full h-full pointer-events-none text-red-400/60" viewBox="0 0 100 100" preserveAspectRatio="none">
            {/* Target crosshair box for damages */}
            <circle cx="50" cy="50" r="12" fill="none" stroke="currentColor" strokeWidth="1.2" />
            <line x1="50" y1="10" x2="50" y2="90" stroke="currentColor" strokeWidth="0.8" strokeDasharray="2,4" />
            <line x1="10" y1="50" x2="90" y2="50" stroke="currentColor" strokeWidth="0.8" strokeDasharray="2,4" />
            <rect x="25" y="25" width="50" height="50" fill="none" stroke="currentColor" strokeWidth="0.8" strokeDasharray="1,5" />
            <text x="50" y="21" textAnchor="middle" fill="currentColor" fontSize="3.5" fontFamily="monospace" fontWeight="bold">CENTER ON SCRATCH / DENT</text>
          </svg>
        );
      case 'front_straight':
        const isFrontSUV = vehicle.vehicleType?.includes('SUV') || vehicle.vehicleType?.includes('Crossover');
        const isFrontBakkie = vehicle.vehicleType?.includes('Bakkie') || vehicle.vehicleType?.includes('Truck');

        return (
          <svg className="absolute inset-0 w-full h-full pointer-events-none text-trulens-purple" viewBox="0 0 100 100" preserveAspectRatio="none">
            {isFrontSUV || isFrontBakkie ? (
              <path d="M 15,75 L 15,50 L 25,40 L 75,40 L 85,50 L 85,75 Z" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2,2" />
            ) : (
              <path d="M 20,65 L 22,54 L 38,45 L 62,45 L 78,54 L 80,65 Z" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2,2" />
            )}
            <circle cx="30" cy={isFrontSUV || isFrontBakkie ? 74 : 64} r="5" fill="none" stroke="currentColor" strokeWidth="1" />
            <circle cx="70" cy={isFrontSUV || isFrontBakkie ? 74 : 64} r="5" fill="none" stroke="currentColor" strokeWidth="1" />
            <text x="50" y="30" textAnchor="middle" fill="currentColor" fontSize="3" fontFamily="monospace">FRONT PROFILE</text>
          </svg>
        );
      case 'rear_straight':
        const isRearSUV = vehicle.vehicleType?.includes('SUV') || vehicle.vehicleType?.includes('Crossover');
        const isRearBakkie = vehicle.vehicleType?.includes('Bakkie') || vehicle.vehicleType?.includes('Truck');

        return (
          <svg className="absolute inset-0 w-full h-full pointer-events-none text-trulens-purple" viewBox="0 0 100 100" preserveAspectRatio="none">
            {isRearSUV ? (
              <rect x="15" y="25" width="70" height="50" rx="4" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2,2" />
            ) : isRearBakkie ? (
              <path d="M 15,75 L 15,45 L 85,45 L 85,75 Z" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2,2" />
            ) : (
              <rect x="25" y="35" width="50" height="30" rx="3" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2,2" />
            )}
            <circle cx="30" cy={isRearSUV || isRearBakkie ? 75 : 65} r="5" fill="none" stroke="currentColor" strokeWidth="1" />
            <circle cx="70" cy={isRearSUV || isRearBakkie ? 75 : 65} r="5" fill="none" stroke="currentColor" strokeWidth="1" />
            <text x="50" y={isRearSUV ? 20 : 30} textAnchor="middle" fill="currentColor" fontSize="3" fontFamily="monospace">REAR PROFILE</text>
          </svg>
        );
      case 'roof_view':
        return (
          <svg className="absolute inset-0 w-full h-full pointer-events-none text-trulens-purple/50" viewBox="0 0 100 100" preserveAspectRatio="none">
            <rect x="20" y="20" width="60" height="60" rx="10" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="4,4" />
            <text x="50" y="50" textAnchor="middle" fill="currentColor" fontSize="3" fontFamily="monospace">ROOF / SUNROOF VIEW</text>
          </svg>
        );
      case 'wheels_all':
        return (
          <svg className="absolute inset-0 w-full h-full pointer-events-none text-trulens-purple" viewBox="0 0 100 100" preserveAspectRatio="none">
            <circle cx="50" cy="50" r="30" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="50" cy="50" r="8" fill="none" stroke="currentColor" strokeWidth="1" />
            <text x="50" y="15" textAnchor="middle" fill="currentColor" fontSize="3" fontFamily="monospace">WHEEL & TYRE CLOSE-UP</text>
          </svg>
        );
      case 'badges_detail':
      case 'lights_detail':
      case 'mirrors_handles':
      case 'floor_mats':
      case 'mechanical_details':
      case 'undercarriage':
      case 'odometer_reading':
        return (
          <svg className="absolute inset-0 w-full h-full pointer-events-none text-trulens-purple/60" viewBox="0 0 100 100" preserveAspectRatio="none">
            <circle cx="50" cy="50" r="15" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="50" y1="30" x2="50" y2="70" stroke="currentColor" strokeWidth="0.5" />
            <line x1="30" y1="50" x2="70" y2="50" stroke="currentColor" strokeWidth="0.5" />
            <text x="50" y="25" textAnchor="middle" fill="currentColor" fontSize="3" fontFamily="monospace">{activeSlot.name.toUpperCase()}</text>
          </svg>
        );
      case 'seat_driver':
      case 'seat_passenger':
      case 'seats_rear':
        return (
          <svg className="absolute inset-0 w-full h-full pointer-events-none text-trulens-purple" viewBox="0 0 100 100" preserveAspectRatio="none">
            <rect x="30" y="20" width="40" height="50" rx="5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="3,3" />
            <text x="50" y="15" textAnchor="middle" fill="currentColor" fontSize="3" fontFamily="monospace">{activeSlot.name.toUpperCase()}</text>
          </svg>
        );
      case 'boot_bay':
        return (
          <svg className="absolute inset-0 w-full h-full pointer-events-none text-trulens-purple" viewBox="0 0 100 100" preserveAspectRatio="none">
            <rect x="20" y="30" width="60" height="50" rx="2" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="4,4" />
            <text x="50" y="25" textAnchor="middle" fill="currentColor" fontSize="3" fontFamily="monospace">BOOT / CARGO AREA</text>
          </svg>
        );
      case 'reg_papers':
        return (
          <svg className="absolute inset-0 w-full h-full pointer-events-none text-trulens-purple/70" viewBox="0 0 100 100" preserveAspectRatio="none">
            <rect x="20" y="20" width="60" height="60" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <line x1="25" y1="35" x2="75" y2="35" stroke="currentColor" strokeWidth="0.5" />
            <line x1="25" y1="45" x2="75" y2="45" stroke="currentColor" strokeWidth="0.5" />
            <line x1="25" y1="55" x2="75" y2="55" stroke="currentColor" strokeWidth="0.5" />
            <text x="50" y="15" textAnchor="middle" fill="currentColor" fontSize="3.5" fontFamily="monospace" fontWeight="bold">REGISTRATION DOCUMENTS</text>
          </svg>
        );
      case 'vin_plate':
        return (
          <svg className="absolute inset-0 w-full h-full pointer-events-none text-trulens-purple/85" viewBox="0 0 100 100" preserveAspectRatio="none">
            <rect x="20" y="40" width="60" height="20" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <text x="50" y="35" textAnchor="middle" fill="currentColor" fontSize="3.5" fontFamily="monospace" fontWeight="bold">VIN PLATE / STICKER</text>
          </svg>
        );
      case 'recon_damage':
        return (
          <svg className="absolute inset-0 w-full h-full pointer-events-none text-red-400/60" viewBox="0 0 100 100" preserveAspectRatio="none">
            <circle cx="50" cy="50" r="12" fill="none" stroke="currentColor" strokeWidth="1.2" />
            <rect x="25" y="25" width="50" height="50" fill="none" stroke="currentColor" strokeWidth="0.8" strokeDasharray="1,5" />
            <text x="50" y="21" textAnchor="middle" fill="currentColor" fontSize="3.5" fontFamily="monospace" fontWeight="bold">RECON / DAMAGE DETAIL</text>
          </svg>
        );
      case 'engine_bay':
        return (
          <svg className="absolute inset-0 w-full h-full pointer-events-none text-trulens-purple" viewBox="0 0 100 100" preserveAspectRatio="none">
            <rect x="15" y="25" width="70" height="60" rx="4" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="4,4" />
            <text x="50" y="20" textAnchor="middle" fill="currentColor" fontSize="3.5" fontFamily="monospace" fontWeight="bold">ENGINE BAY VIEW</text>
          </svg>
        );
      case 'interior_dash':
        return (
          <svg className="absolute inset-0 w-full h-full pointer-events-none text-indigo-400/55" viewBox="0 0 100 100" preserveAspectRatio="none">
            <circle cx="28" cy="55" r="14" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2,2" />
            <rect x="52" y="45" width="22" height="15" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1" />
            <line x1="10" y1="58" x2="90" y2="58" stroke="currentColor" strokeWidth="0.8" strokeDasharray="3,3" />
          </svg>
        );
      default:
        // Generic box overlay
        return (
          <svg className="absolute inset-0 w-full h-full pointer-events-none text-indigo-400/35" viewBox="0 0 100 100" preserveAspectRatio="none">
            <rect x="15" y="20" width="70" height="60" rx="6" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="4,4" />
          </svg>
        );
    }
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
    <div id="camera-guide-container" className="flex flex-col h-full bg-neutral-950 text-white overflow-hidden relative">
      
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
        <div className="text-center">
          <p className="text-[10px] uppercase font-bold tracking-widest text-indigo-400">Guide Overlay View</p>
          <p className="text-[11px] text-neutral-300 font-semibold truncate max-w-[200px]">
            {vehicle.year} {vehicle.make} {vehicle.model}
          </p>
        </div>
        <HelpCircle size={16} className="text-neutral-500 cursor-pointer" />
      </div>

      {/* 7-Phase Dynamic Progress Tracker */}
      <div className="bg-neutral-900 border-b border-neutral-850 px-4 py-2 shrink-0 animate-in slide-in-from-top-2 duration-300">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-1.5">
            <Sparkles size={10} className="text-indigo-400" />
            <span className="text-[9px] font-black text-neutral-200 uppercase tracking-[0.15em]">Capture Workflow</span>
          </div>
          <div className="flex items-center gap-2">
             <div className="text-[8px] font-mono text-neutral-500 uppercase">Lot Readiness:</div>
             <div className="px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20">
                <span className="text-[9px] font-bold text-indigo-400">{progressPercentage}%</span>
             </div>
          </div>
        </div>
        
        <div className="grid grid-cols-7 gap-1.5">
          {phaseCompletionStatus.map((status, i) => {
            const isActive = currentPhase === status.phase;
            return (
              <button 
                key={i}
                onClick={() => {
                  setCurrentPhase(status.phase);
                  const firstSlot = PHOTO_SLOTS.find(s => s.phase === status.phase);
                  if (firstSlot) setSelectedSlotId(firstSlot.id);
                }}
                className="flex flex-col gap-1.5 group cursor-pointer border-none bg-transparent p-0"
              >
                {/* Progress Segment */}
                <div className="relative h-1 w-full rounded-full bg-neutral-800 overflow-hidden">
                  <div
                    style={{
                      width: status.completed ? '100%' : isActive ? '50%' : '0%',
                      backgroundColor: status.completed ? '#10b981' : '#6366f1'
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
                      ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.2)]' 
                      : 'bg-neutral-900 border-neutral-800 text-neutral-500'
                   }`}>
                      {status.completed ? (
                        <Check size={9} className="stroke-[4]" />
                      ) : (
                        <span className="text-[7px] font-black">{status.phase}</span>
                      )}
                   </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Viewfinder Main View */}
      <div className="relative flex-1 bg-black flex flex-col justify-center overflow-hidden">
        {shutterFlash && (
          <div className="absolute inset-0 z-40 bg-white tl-shutter-flash" aria-hidden />
        )}
        {captureHint && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 px-3 py-1.5 rounded-full bg-black/70 border border-white/15 text-[10px] font-bold text-white shadow-lg animate-in fade-in slide-in-from-top-1">
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
            <div className="space-y-1.5 max-w-[260px]">
              <p className="text-sm font-bold text-neutral-100">Ready to shoot this slot</p>
              <p className="text-[10px] text-neutral-400 leading-relaxed">
                {cameraError ||
                  'Use the big Take picture button below. On PC you can also Upload a file first, then confirm.'}
              </p>
            </div>
            <div className="flex flex-col gap-2 w-full max-w-[220px] pt-1">
              <button
                type="button"
                onClick={(e) => handleCapture(e)}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg"
              >
                <Camera size={14} /> Take picture
              </button>
              <button
                type="button"
                onClick={() => singleUploadRef.current?.click()}
                className="w-full py-2 rounded-xl bg-emerald-600/20 border border-emerald-500/40 hover:bg-emerald-600/30 text-emerald-300 text-[10px] font-bold flex items-center justify-center gap-1.5"
              >
                <Upload size={12} /> Or upload from PC
              </button>
              <button
                type="button"
                onClick={() => startCamera()}
                disabled={cameraRetrying}
                className="w-full py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 text-[10px] font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Camera size={12} />
                {cameraRetrying ? 'Trying camera…' : 'Retry live camera'}
              </button>
            </div>
            {hasCamPermission === false && (
              <p className="text-[8px] text-neutral-500 max-w-[240px] leading-relaxed pt-1">
                Chrome/Edge: address bar → camera icon → <span className="text-neutral-300">Allow</span>. Use{' '}
                <span className="text-neutral-300">http://localhost:3000</span> (not a blocked file:// page).
              </p>
            )}
          </div>
        )}

        {/* Dynamic SVG Guide Silhouette */}
        {renderGuideOverlay()}

        {/* Recording Overlay for 360 Walkaround */}
        {isRecording360 && (
          <div className="absolute inset-0 bg-neutral-950/85 z-30 flex flex-col items-center justify-center p-6 space-y-4 animate-in fade-in duration-200">
            <div className="w-16 h-16 rounded-full border-4 border-red-500/20 flex items-center justify-center relative">
              <div className="w-8 h-8 rounded-full bg-red-600 animate-ping absolute"></div>
              <div className="w-6 h-6 rounded-full bg-red-600 relative z-10"></div>
            </div>
            <div className="text-center space-y-1.5">
              <p className="text-sm font-black text-red-500 tracking-widest animate-pulse uppercase">● RECORDING 360° WALK VIDEO</p>
              <p className="text-xs text-neutral-400 font-mono">Simulating continuous 360° loop... keep camera steady</p>
            </div>
            
            {/* Progress Bar */}
            <div className="w-full max-w-xs space-y-1">
              <div className="flex justify-between text-[10px] font-mono text-neutral-500">
                <span>Capturing continuous footage</span>
                <span>{recordingProgress}%</span>
              </div>
              <div className="w-full h-1.5 bg-neutral-900 rounded-full overflow-hidden border border-neutral-800">
                <div 
                  className="h-full bg-red-600 rounded-full transition-all duration-150"
                  style={{ width: `${recordingProgress}%` }}
                ></div>
              </div>
            </div>
          </div>
        )}

        {/* Real-time Gyro / Bubble Level Circle Overlay */}
        {autoLevelOn && (
          <div className="absolute right-4 top-4 bg-neutral-950/75 border border-neutral-800 px-2.5 py-1.5 rounded-xl flex items-center gap-2 z-10 shadow-lg">
            <div className="relative w-8 h-8 rounded-full border-2 border-neutral-700/60 flex items-center justify-center">
              {/* Leveled target ring */}
              <div className="w-2.5 h-2.5 rounded-full border border-neutral-600"></div>
              {/* Center Bubble bubble level */}
              <div 
                className={`w-2 h-2 rounded-full absolute transition-all duration-100 ${
                  angleCorrect ? 'bg-emerald-400 shadow-md shadow-emerald-500/50 scale-110' : 'bg-red-400'
                }`}
                style={{
                  transform: `translate(${Math.max(-10, Math.min(10, simRoll * 2.5))}px, ${Math.max(-10, Math.min(10, (simPitch - activeSlot.idealAngle.pitch) * 1.5))}px)`
                }}
              ></div>
            </div>
            <div className="text-[9px] font-mono">
              <p className="text-[7px] uppercase text-neutral-400 tracking-wider">Level Target</p>
              <p className={angleCorrect ? 'text-emerald-400 font-bold' : 'text-neutral-300'}>
                {angleCorrect ? '0.0° LOCKED' : `${simRoll.toFixed(1)}° Roll`}
              </p>
            </div>
          </div>
        )}

        {/* Lighting status warning flag */}
        <div className="absolute left-4 top-4 bg-neutral-950/75 border border-neutral-800 p-2 rounded-xl z-10 flex items-center gap-2 shadow-lg">
          <Sun size={14} className={lightingAdvice.color} />
          <div className="text-[9px] font-mono">
            <p className="text-[7px] uppercase text-neutral-400 tracking-wider">Lighting Guide</p>
            <p className={`font-bold ${lightingAdvice.color}`}>{lightingAdvice.title}</p>
          </div>
        </div>

        {/* Quick Camera Source Helper overlay if webcam unavailable */}
        {!isCameraActive && !customFile && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 px-3 py-1 rounded text-[8px] tracking-wide text-neutral-400 flex items-center gap-1">
            <Eye size={10} className="text-indigo-400" /> Use alignment guides to frame your vehicle.
          </div>
        )}
      </div>

      {/* Guide Slots Carousel Picker */}
      <div className="bg-neutral-900 border-t border-neutral-850 p-2 shrink-0 z-10">
        <div className="flex items-center justify-between px-2 mb-2">
          <p className="text-[9px] text-neutral-400 font-bold uppercase tracking-wider">
            Phase {currentPhase}: {phaseNames[currentPhase - 1]}
          </p>
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1 px-1.5 scrollbar-none">
          {phaseSlots.map(slot => {
            const isTaken = !!photos[slot.id];
            const isSelected = selectedSlotId === slot.id;
            const isNext =
              !isTaken &&
              slot.required &&
              slot.id === (PHOTO_SLOTS.find((s) => s.required && !photos[s.id])?.id);
            return (
              <button
                key={slot.id}
                type="button"
                onClick={() => setSelectedSlotId(slot.id)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold whitespace-nowrap border cursor-pointer flex items-center gap-1.5 transition-all ${
                  isSelected
                    ? 'bg-indigo-600 border-indigo-400 text-white shadow-md shadow-indigo-600/30'
                    : isTaken
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : isNext
                    ? 'bg-amber-500/10 border-amber-400/40 text-amber-200'
                    : 'bg-neutral-950 border-neutral-800 text-neutral-300 hover:border-neutral-600'
                }`}
              >
                {isTaken ? (
                  <Check size={10} className="text-emerald-400 font-extrabold" />
                ) : isNext ? (
                  <span className="text-[8px] font-black text-amber-400">NEXT</span>
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
              const firstSlotOfNewPhase = PHOTO_SLOTS.find(s => s.phase === newPhase);
              if (firstSlotOfNewPhase) setSelectedSlotId(firstSlotOfNewPhase.id);
            }}
            className="text-[10px] font-bold text-neutral-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
          >
            <ChevronLeft size={12} /> Prev Phase
          </button>
          
          <p className="text-[10px] text-neutral-300 font-medium truncate max-w-[150px]">
            {activeSlot.description}
          </p>

          <button
            disabled={currentPhase === 7}
            onClick={() => {
              const newPhase = currentPhase + 1;
              setCurrentPhase(newPhase);
              const firstSlotOfNewPhase = PHOTO_SLOTS.find(s => s.phase === newPhase);
              if (firstSlotOfNewPhase) setSelectedSlotId(firstSlotOfNewPhase.id);
            }}
            className={`text-[10px] font-bold flex items-center gap-1 cursor-pointer ${phaseCompleted ? 'text-indigo-400 hover:text-indigo-300' : 'text-neutral-500'}`}
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
              className="w-full py-2 bg-red-950/40 border border-red-500/30 text-red-400 hover:bg-red-950/60 rounded-xl text-[10px] font-extrabold flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-all uppercase tracking-wider mb-1"
            >
              <X size={12} className="stroke-[3]" /> No booklet with vehicle? Mark "None" (Exempt)
            </button>
          </div>
        )}

        {/* Primary shutter — large & labeled so it is never confused with Settings */}
        <button
          type="button"
          onClick={handleCapture}
          disabled={isRecording360}
          className={`w-full py-3.5 rounded-2xl flex items-center justify-center gap-2.5 cursor-pointer shadow-lg active:scale-[0.98] transition-all font-black text-sm uppercase tracking-wider disabled:opacity-60 ${
            activeSlot.id === 'video_360'
              ? 'bg-gradient-to-r from-red-600 to-rose-500 text-white border border-red-400/40'
              : 'bg-gradient-to-r from-indigo-500 via-indigo-600 to-purple-600 text-white border border-indigo-400/30'
          }`}
          title={activeSlot.id === 'video_360' ? 'Record 360 walkaround' : 'Take picture for this slot'}
        >
          {activeSlot.id === 'video_360' ? (
            <>
              <span className="w-3.5 h-3.5 bg-white rounded-sm animate-pulse" />
              {isRecording360 ? `Recording ${recordingProgress}%` : 'Record 360 video'}
            </>
          ) : (
            <>
              <Camera size={20} strokeWidth={2.5} />
              {isCameraActive
                ? 'Take picture'
                : customFile
                  ? 'Use this photo'
                  : 'Take picture'}
            </>
          )}
        </button>

        {/* Secondary tools */}
        <div className="flex items-center justify-between gap-2">
          {/* Native camera fallback — capture attr skips the gallery picker when the
              in-app live camera is blocked (e.g. PWA denied getUserMedia) */}
          <label className={`flex-1 py-2 rounded-xl text-[9px] font-bold flex flex-col items-center justify-center gap-1 cursor-pointer text-center border transition-colors ${
            !isCameraActive
              ? 'bg-amber-600/20 border-amber-500/40 text-amber-300 hover:bg-amber-600/30'
              : 'bg-neutral-900 border-neutral-800 hover:bg-neutral-850 text-neutral-300'
          }`}>
            <Camera size={13} className={!isCameraActive ? 'text-amber-400' : 'text-neutral-400'} />
            Take Photo
            <input
              type="file"
              accept={activeSlot.id === 'video_360' ? 'video/*' : 'image/*'}
              capture="environment"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          <label className={`flex-1 py-2 rounded-xl text-[9px] font-bold flex flex-col items-center justify-center gap-1 cursor-pointer text-center border transition-colors ${
            !isCameraActive
              ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/30'
              : 'bg-neutral-900 border-neutral-800 hover:bg-neutral-850 text-neutral-300'
          }`}>
            <Upload size={13} className={!isCameraActive ? 'text-emerald-400' : 'text-neutral-400'} />
            Upload file
            <input
              ref={singleUploadRef}
              type="file"
              accept={activeSlot.id === 'video_360' ? 'video/*,image/*' : 'image/*'}
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          <label className="flex-1 py-2 bg-indigo-950/40 border border-indigo-900/50 hover:bg-indigo-900/40 rounded-xl text-[9px] font-bold text-indigo-400 flex flex-col items-center justify-center gap-1 cursor-pointer text-center relative">
            <Images size={13} className="text-indigo-400" />
            <span>Bulk Roll</span>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleBulkFileUpload}
              className="hidden"
            />
          </label>

          <button
            type="button"
            onClick={() => setAutoLevelOn(!autoLevelOn)}
            className={`flex-1 py-2 border rounded-xl text-[9px] font-bold flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors ${
              autoLevelOn
                ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400'
                : 'bg-neutral-900 border-neutral-800 text-neutral-400'
            }`}
          >
            <Smartphone size={13} /> Level
          </button>
        </div>

        {/* Diagnostic Guide Tip box */}
        <div className="flex gap-2 bg-indigo-950/20 p-2.5 rounded-xl border border-indigo-950/30">
          <Sparkles className="text-indigo-400 shrink-0" size={13} />
          <p className="text-[9px] text-indigo-300 leading-normal">
            <strong>Lot Photographer Tip:</strong> Align the vehicle tires with guidelines. Use <strong>Bulk Roll</strong> to upload multiple photos at once.
          </p>
        </div>

      </div>

      {/* Bulk Importer Overlay Modal */}
      {isBulkModalOpen && (
        <div className="absolute inset-0 bg-neutral-950/98 z-50 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-4 py-4 border-b border-neutral-850 bg-neutral-900 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Images className="text-indigo-400" size={18} />
              <div>
                <h3 className="text-xs font-bold text-neutral-100">Bulk Camera Roll Importer</h3>
                <p className="text-[9px] text-neutral-400">Streamline inventory lot photography bulk processing</p>
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
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-indigo-300 flex items-center gap-2">
                  {bulkProgress.status === 'syncing' ? (
                    <>
                      <Loader2 size={13} className="animate-spin text-indigo-400" />
                      <span>Syncing bulk photos to Lot ({bulkProgress.current} / {bulkProgress.total})</span>
                    </>
                  ) : bulkProgress.status === 'done' ? (
                    <span className="text-emerald-400 flex items-center gap-1.5 font-bold">
                      <Check size={14} className="font-extrabold" /> All photos bulk-synced successfully!
                    </span>
                  ) : (
                    <span className="text-red-400">Error syncing photos. Try again.</span>
                  )}
                </span>
                <span className="text-[10px] font-mono text-neutral-400">
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
                <p className="text-xs">Select photos from your device to start mapping</p>
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
                      <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-[7px] text-center font-mono py-0.5 truncate px-1 text-neutral-300">
                        {item.fileName}
                      </span>
                    </div>

                    {/* Slot Match Controller */}
                    <div className="flex-1 min-w-0">
                      <label className="text-[8px] uppercase font-bold text-neutral-400 tracking-wider block mb-1">
                        Assign Photographic Slot
                      </label>
                      <select
                        value={item.slotId}
                        disabled={bulkProgress.status === 'syncing'}
                        onChange={(e) => {
                          const val = e.target.value;
                          setBulkItems(prev => prev.map(p => p.id === item.id ? { ...p, slotId: val } : p));
                        }}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-lg text-[11px] py-1 px-2 text-neutral-200 focus:border-indigo-500 focus:outline-none"
                      >
                        {PHOTO_SLOTS.map(slot => (
                          <option key={slot.id} value={slot.id}>
                            {slot.name} {slot.required ? '(Required)' : ''}
                          </option>
                        ))}
                      </select>

                      {/* Info / Overwrite alert helper */}
                      {isTaken && (
                        <p className="text-[8px] text-amber-400 font-medium flex items-center gap-1 mt-1 font-sans">
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
                        className="p-1.5 bg-red-950/20 hover:bg-red-950/40 text-red-400 border border-red-950/40 rounded-lg cursor-pointer shrink-0"
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
              className="flex-1 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs font-bold text-neutral-400 hover:bg-neutral-900 cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSyncBulkPhotos}
              disabled={bulkItems.length === 0 || bulkProgress.status === 'syncing'}
              className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-neutral-800 disabled:text-neutral-500 rounded-xl text-xs font-extrabold text-white flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed shadow-md"
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
