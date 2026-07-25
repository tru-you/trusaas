import React from 'react';
import { 
  Sparkles, Sliders, ChevronLeft, Save, Download, AlertCircle, Check, 
  Trash, Image as ImageIcon, Wand2, Info, ArrowUpRight, Copy, Loader2, Gauge 
} from 'lucide-react';
import { Vehicle, QualityReport, STUDIO_BACKGROUNDS } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface ImageEditorProps {
  vehicle: Vehicle;
  slotId: string;
  imageSrc: string;
  qualityReport: QualityReport;
  onBack: () => void;
  onSave: (processedImage: string, updatedReport: QualityReport) => void;
}

export default function ImageEditor({
  vehicle,
  slotId,
  imageSrc,
  qualityReport,
  onBack,
  onSave
}: ImageEditorProps) {
  const { user } = useAuth();
  // Editing configurations
  const [selectedBgId, setSelectedBgId] = React.useState<string>('none');
  const [brightness, setBrightness] = React.useState<number>(100); // 100%
  const [contrast, setContrast] = React.useState<number>(100);
  const [saturation, setSaturation] = React.useState<number>(100);
  const [exposure, setExposure] = React.useState<number>(0); // offset
  const [maskThreshold, setMaskThreshold] = React.useState<number>(50); // Cutout sensitivity
  const [isMaskActive, setIsMaskActive] = React.useState<boolean>(false);

  // Proofing toggle: cycle black (void) → grey (surround) → white (proof/buyer view)
  const [proofMode, setProofMode] = React.useState<'surround' | 'void' | 'proof'>('surround');
  const proofCycle: Record<string, 'void' | 'surround' | 'proof'> = { surround: 'proof', proof: 'void', void: 'surround' };
  const proofLabel: Record<string, string> = { surround: 'Grey', proof: 'White · buyer view', void: 'Black' };

  // Gemini state
  const [isAnalyzing, setIsAnalyzing] = React.useState<boolean>(false);
  const [aiReport, setAiReport] = React.useState<QualityReport['aiAnalysis'] | null>(null);
  const [fullReport, setFullReport] = React.useState<QualityReport>(qualityReport);
  const [copiedText, setCopiedText] = React.useState<string | null>(null);

  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const imageRef = React.useRef<HTMLImageElement>(null);

  // Auto-fix adjustment logic
  const handleAutoFix = () => {
    // Basic logic to "improve" settings based on the feedback
    // Aim for neutral brightness/contrast if quality is poor
    setBrightness(110); // slightly brighter
    setContrast(110);   // slightly higher contrast
    setSaturation(105); // slightly more vivid
  };

  // Trigger Gemini Analysis on load or manual click
  const handleRunGeminiAudit = async () => {
    if (!user) return;
    setIsAnalyzing(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/gemini/analyze', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          base64Image: imageSrc,
          slotName: slotId,
          vehicleInfo: {
            make: vehicle.make,
            model: vehicle.model,
            year: vehicle.year
          }
        })
      });
      if (res.ok) {
        const data = await res.json();
        setAiReport(data.aiAnalysis);
        
        // Merge report parameters
        const updatedReport: QualityReport = {
          overallScore: data.overallScore || fullReport.overallScore,
          lightingCheck: data.lightingCheck || fullReport.lightingCheck,
          angleCheck: data.angleCheck || fullReport.angleCheck,
          aiAnalysis: data.aiAnalysis
        };
        setFullReport(updatedReport);
      }
    } catch (e) {
      console.error('Failed to query Gemini:', e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Run initial Gemini audit automatically to populate listing descriptive copy
  React.useEffect(() => {
    handleRunGeminiAudit();
  }, [imageSrc]);

  // Handle composite canvas building for backdrop removal simulation
  React.useEffect(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    img.onload = () => {
      drawComposite();
    };

    // Re-draw if sliders, backgrounds or masks toggle
    drawComposite();

    function drawComposite() {
      if (!ctx || !img || !img.complete) return;
      
      canvas.width = img.naturalWidth || 1080;
      canvas.height = img.naturalHeight || 720;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 1. Draw custom studio background if selected
      const currentBg = STUDIO_BACKGROUNDS.find(b => b.id === selectedBgId);
      // 'cutout' leaves the canvas transparent — the car drops onto whatever it
      // is placed over. The two studios are plain neutral seamless fills, which
      // is what real vehicle photography uses.
      if (currentBg && currentBg.id !== 'none' && currentBg.id !== 'cutout') {
        if (currentBg.id === 'studio_light') {
          const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
          grad.addColorStop(0, '#E8EAE6');
          grad.addColorStop(0.75, '#C2C6C0');
          grad.addColorStop(1, '#A6ABA4');
          ctx.fillStyle = grad;
        } else { // studio_dark
          const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
          grad.addColorStop(0, '#1A1D22');
          grad.addColorStop(0.8, '#0B0F17');
          grad.addColorStop(1, '#06080D');
          ctx.fillStyle = grad;
        }
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // A soft contact shadow so the car doesn't float on the seamless
        ctx.beginPath();
        ctx.ellipse(canvas.width / 2, canvas.height * 0.75, canvas.width * 0.38, canvas.height * 0.08, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.fill();
      }

      // 2. Draw vehicle with masking or transparency thresholds (auto background removal simulation)
      ctx.save();

      // Apply adjustment filters directly to canvas context
      const bVal = (brightness / 100).toFixed(2);
      const cVal = (contrast / 100).toFixed(2);
      const sVal = (saturation / 100).toFixed(2);
      ctx.filter = `brightness(${bVal}) contrast(${cVal}) saturate(${sVal})`;

      if (selectedBgId !== 'none' || isMaskActive) {
        // High-fidelity background subtraction masking:
        // Create an ellipse clip path which preserves the central vehicle contour and extracts background
        ctx.beginPath();
        ctx.ellipse(
          canvas.width / 2, 
          canvas.height * 0.52, 
          canvas.width * (0.35 + (maskThreshold / 300)), 
          canvas.height * (0.24 + (maskThreshold / 400)), 
          0, 0, Math.PI * 2
        );
        ctx.clip();
      }

      // Draw main image onto composite
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
  }, [selectedBgId, brightness, contrast, saturation, maskThreshold, isMaskActive, imageSrc]);

  // Export current canvas composite as PNG
  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `${vehicle.make}_${vehicle.model}_${slotId}_studio.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  // Save changes to cloud sync inventory
  const handleSaveChanges = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const processedBase64 = canvas.toDataURL('image/jpeg', 0.85);
    onSave(processedBase64, fullReport);
  };

  const copyToClipboard = (text: string, type: 'title' | 'desc') => {
    navigator.clipboard.writeText(text);
    setCopiedText(type);
    setTimeout(() => setCopiedText(null), 2000);
  };

  return (
    <div id="image-editor-container" className="flex flex-col h-full bg-neutral-900 text-[#E8EAE6] overflow-hidden relative">
      
      {/* Hidden original image element to capture draw triggers */}
      <img 
        ref={imageRef} 
        src={imageSrc} 
        alt="Original base" 
        className="hidden" 
        referrerPolicy="no-referrer"
      />

      {/* Top Header */}
      <div className="bg-neutral-950 px-4 py-3 flex items-center justify-between border-b border-neutral-850 z-20 shrink-0 shadow-md">
        <button 
          onClick={onBack}
          className="p-1 rounded-full hover:bg-neutral-800 text-neutral-300 flex items-center justify-center cursor-pointer"
        >
          <ChevronLeft size={20} />
        </button>
        <div>
          <p className="text-[13px]  font-bold tracking-widest text-indigo-400">Review & enhance</p>
          <p className="text-[13px] text-neutral-300 font-semibold truncate max-w-[200px]">
            Then save to continue shooting
          </p>
        </div>
        
        {/* Save & Sync action */}
        <button
          type="button"
          onClick={handleSaveChanges}
          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-[13px] font-semibold  tracking-wide text-[#E8EAE6] flex items-center gap-1 cursor-pointer transition-colors shadow-md shadow-emerald-600/20"
        >
          <Save size={12} /> Save shot
        </button>
      </div>

      {/* Primary Scrollable Workspace */}
      <div className="flex-1 overflow-y-auto pb-4 space-y-4">
        
        {/* Render Canvas preview viewport — sterile zone, no cyan, no blur */}
        <div
          className="photo-review relative w-full aspect-[4/3] flex items-center justify-center overflow-hidden border-b border-neutral-850 transition-colors duration-200"
          data-proof={proofMode}
        >
          <canvas
            ref={canvasRef}
            className="w-full h-full object-contain max-h-[300px]"
          />

          {/* Proofing toggle — top-right, outside the image frame */}
          <button
            type="button"
            onClick={() => setProofMode(proofCycle[proofMode])}
            title="Cycle proof background: grey → white (buyer view) → black"
            className="absolute top-2 right-2 px-2 py-1 rounded text-[11px] font-mono bg-black/60 border border-white/20 text-white/70 hover:text-white transition-colors"
          >
            ◐ {proofLabel[proofMode]}
          </button>

          <span className="absolute bottom-3 left-3 bg-black/70 px-2 py-1 rounded text-[12px] font-mono tracking-wider text-neutral-400 border border-white/10">
            Preview · {selectedBgId === 'none' ? 'As shot' : selectedBgId === 'cutout' ? 'Cutout' : 'Studio backdrop'}
          </span>
        </div>

        {/* Studio Background Selector Row */}
        <div className="px-4">
          <span className="text-[12px]  font-bold text-neutral-400 tracking-wider flex items-center gap-1.5 mb-2">
            <ImageIcon size={12} className="text-indigo-400" /> Professional Dealer Backdrops
          </span>
          <div className="grid grid-cols-5 gap-1.5">
            {STUDIO_BACKGROUNDS.map(bg => (
              <button
                key={bg.id}
                onClick={() => setSelectedBgId(bg.id)}
                className={`p-1.5 rounded-lg border flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                  selectedBgId === bg.id
                    ? 'border-indigo-500 bg-indigo-550/10 text-indigo-400'
                    : 'border-neutral-800 bg-neutral-950/60 text-neutral-400 hover:border-neutral-700'
                }`}
              >
                {/* Simulated circle graphic */}
                <div 
                  className="w-7 h-7 rounded-full border border-white/10 mb-1 flex items-center justify-center overflow-hidden"
                  style={{ background: bg.gradient || '#3f3f46' }}
                >
                  {bg.id === 'none' && <ImageIcon size={12} className="text-neutral-500" />}
                </div>
                <span className="text-[12px] font-semibold truncate w-full">{bg.name.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Quality Audit Progress Metrics (Gemini / Simulated metrics) */}
        <div className="px-4">
          <div className="bg-neutral-950 rounded-xl border border-neutral-850 p-3.5 space-y-3 shadow-sm">
            <div className="flex justify-between items-center pb-2 border-b border-neutral-900">
              <span className="text-xs font-bold text-neutral-200 flex items-center gap-1.5">
                <Sparkles size={14} className="text-indigo-400" /> AI Automotive Quality Report
              </span>
              <button 
                onClick={handleRunGeminiAudit}
                disabled={isAnalyzing}
                className="text-[12px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 disabled:opacity-50"
              >
                {isAnalyzing ? <Loader2 size={10} className="animate-spin" /> : <Wand2 size={10} />} Re-Audit
              </button>
              {fullReport.overallScore < 95 && (
                <button 
                  onClick={handleAutoFix}
                  className="text-[12px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                >
                  <Sparkles size={10} /> Auto-fix
                </button>
              )}
            </div>

            <div className="flex gap-4 items-center">
              {/* Radial Rating Circle */}
              <div className="relative w-14 h-14 rounded-full border-4 border-neutral-900 flex items-center justify-center shrink-0">
                <span className="text-sm font-semibold text-[#E8EAE6]">
                  {isAnalyzing ? '...' : `${Math.round(fullReport.overallScore)}%`}
                </span>
                <div className="absolute inset-0 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" style={{ animationDuration: isAnalyzing ? '1.5s' : '0s' }}></div>
              </div>

              {/* Quality details summary */}
              <div className="space-y-1 text-[13px] leading-relaxed">
                <p className="text-neutral-300 font-medium">
                  <strong>Lighting Level:</strong> <span className={fullReport.lightingCheck.status === 'Perfect' ? 'text-emerald-400' : 'text-amber-400'}>
                    {fullReport.lightingCheck.status}
                  </span>
                </p>
                <p className="text-neutral-400 font-normal">
                  {fullReport.lightingCheck.feedback}
                </p>
                <p className="text-neutral-300 font-medium mt-1">
                  <strong>Angle Frame:</strong> <span className={fullReport.angleCheck.status === 'Perfect' ? 'text-emerald-400' : 'text-amber-400'}>
                    {fullReport.angleCheck.status}
                  </span>
                </p>
                <p className="text-neutral-400 font-normal">
                  {fullReport.angleCheck.feedback}
                </p>
              </div>
            </div>

            {/* AI Generated Marketplace Title & Description */}
            {aiReport && (
              <div className="pt-2 border-t border-neutral-900 space-y-2.5">
                <div>
                  <span className="text-[12px] font-bold  text-neutral-400 tracking-wider flex items-center justify-between">
                    <span>Generated Listing Title (Gemini)</span>
                    <button 
                      onClick={() => copyToClipboard(aiReport.suggestedTitle || '', 'title')}
                      className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-normal lowercase"
                    >
                      <Copy size={10} /> {copiedText === 'title' ? 'copied!' : 'copy'}
                    </button>
                  </span>
                  <p className="text-xs font-semibold text-[#E8EAE6] mt-0.5">{aiReport.suggestedTitle}</p>
                </div>

                <div>
                  <span className="text-[12px] font-bold  text-neutral-400 tracking-wider flex items-center justify-between">
                    <span>Automated Marketplace Copy (Gemini)</span>
                    <button 
                      onClick={() => copyToClipboard(aiReport.suggestedDescription || '', 'desc')}
                      className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-normal lowercase"
                    >
                      <Copy size={10} /> {copiedText === 'desc' ? 'copied!' : 'copy'}
                    </button>
                  </span>
                  <p className="text-[13px] text-neutral-300 leading-relaxed mt-1 bg-neutral-900 p-2 rounded border border-neutral-850 whitespace-pre-line font-medium">
                    {aiReport.suggestedDescription}
                  </p>
                </div>

                {/* Detected Issues warnings */}
                {(() => {
                  const issues = Array.isArray(aiReport.detectedIssues)
                    ? aiReport.detectedIssues
                    : typeof aiReport.detectedIssues === 'string' && aiReport.detectedIssues
                      ? [aiReport.detectedIssues]
                      : [];
                  if (!issues.length) return null;
                  return (
                  <div className="bg-amber-950/20 border border-amber-900/30 p-2 rounded flex gap-1.5 items-start">
                    <AlertCircle size={12} className="text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-[12px] text-amber-300">
                      <p className="font-bold">Lot Photographer Warning:</p>
                      <ul className="list-disc pl-3.5 space-y-0.5 mt-0.5">
                        {issues.map((issue, idx) => (
                          <li key={idx}>{issue}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>

        {/* Studio Masking and Enhancer Filters Sliders */}
        <div className="px-4">
          <div className="bg-neutral-950 rounded-xl border border-neutral-850 p-3.5 space-y-3.5">
            <span className="text-xs font-bold text-neutral-200 flex items-center justify-between">
              <span className="flex items-center gap-1.5"><Sliders size={14} className="text-indigo-400" /> Composite Studio Adjuster</span>
              
              {/* Toggle manual mask */}
              <button 
                onClick={() => setIsMaskActive(!isMaskActive)}
                className={`px-2 py-0.5 rounded text-[12px] font-bold tracking-wider  border transition-all ${
                  isMaskActive || selectedBgId !== 'none'
                    ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400'
                    : 'bg-neutral-900 border-neutral-850 text-neutral-400'
                }`}
              >
                Manual BG Subtraction {isMaskActive || selectedBgId !== 'none' ? 'On' : 'Off'}
              </button>
            </span>

            {/* Slider Adjustments */}
            <div className="space-y-3">
              {/* Mask Threshold Slider */}
              {(isMaskActive || selectedBgId !== 'none') && (
                <div>
                  <label className="text-[12px] text-neutral-400 flex justify-between font-mono">
                    <span>Auto Background Subtraction Mask Depth</span>
                    <span className="font-bold text-neutral-200">{maskThreshold}%</span>
                  </label>
                  <input 
                    type="range" 
                    min="1" 
                    max="100" 
                    value={maskThreshold}
                    onChange={(e) => setMaskThreshold(Number(e.target.value))}
                    className="w-full accent-indigo-500 h-1 rounded" 
                  />
                </div>
              )}

              {/* Brightness */}
              <div>
                <label className="text-[12px] text-neutral-400 flex justify-between font-mono">
                  <span>Exposure Brightness</span>
                  <span className="font-bold text-neutral-200">{brightness}%</span>
                </label>
                <input 
                  type="range" 
                  min="50" 
                  max="150" 
                  value={brightness}
                  onChange={(e) => setBrightness(Number(e.target.value))}
                  className="w-full accent-indigo-500 h-1 rounded" 
                />
              </div>

              {/* Contrast */}
              <div>
                <label className="text-[12px] text-neutral-400 flex justify-between font-mono">
                  <span>Contrast & Highlights</span>
                  <span className="font-bold text-neutral-200">{contrast}%</span>
                </label>
                <input 
                  type="range" 
                  min="50" 
                  max="150" 
                  value={contrast}
                  onChange={(e) => setContrast(Number(e.target.value))}
                  className="w-full accent-indigo-500 h-1 rounded" 
                />
              </div>

              {/* Saturation */}
              <div>
                <label className="text-[12px] text-neutral-400 flex justify-between font-mono">
                  <span>Color Saturation</span>
                  <span className="font-bold text-neutral-200">{saturation}%</span>
                </label>
                <input 
                  type="range" 
                  min="50" 
                  max="150" 
                  value={saturation}
                  onChange={(e) => setSaturation(Number(e.target.value))}
                  className="w-full accent-indigo-500 h-1 rounded" 
                />
              </div>
            </div>
          </div>
        </div>

        {/* Bottom actions — primary is save & continue shooting */}
        <div className="px-4 space-y-2">
          <button
            type="button"
            onClick={handleSaveChanges}
            className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-2xl text-sm font-semibold tracking-normal text-[#E8EAE6] flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-900/30"
          >
            <Save size={16} /> Save & next shot
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="w-full py-2.5 bg-neutral-950 border border-neutral-800 hover:bg-neutral-900 rounded-xl text-[13px] font-bold text-neutral-300 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Download size={14} className="text-indigo-400" /> Download PNG only
          </button>
        </div>

      </div>

    </div>
  );
}
