import React, { useState, useRef } from "react";
import { Vehicle } from "../types";
import { 
  X, 
  Camera, 
  Upload, 
  Smartphone, 
  Check, 
  Trash2, 
  ChevronLeft, 
  ChevronRight, 
  QrCode, 
  Zap,
  Grid,
  Shield,
  Wrench,
  AlertCircle,
  Sparkles,
  FileText,
  RefreshCw,
  Layers,
  Plus,
  CheckCircle2,
  Share2,
  Facebook,
  Globe,
  Send,
  Search
} from "lucide-react";

interface VehicleDetailModalProps {
  vehicle: Vehicle;
  isOpen: boolean;
  onClose: () => void;
  onUpdateVehicle: (id: string, updates: Partial<Vehicle>) => Promise<void>;
  settings?: any;
}

export default function VehicleDetailModal({ vehicle, isOpen, onClose, onUpdateVehicle, settings }: VehicleDetailModalProps) {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [showMobileSimulator, setShowMobileSimulator] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Elite DMS States
  const [activeTab, setActiveTab] = useState<"specs" | "natis" | "inspection" | "recon" | "syndication">("specs");
  const [natisChecking, setNatisChecking] = useState(false);
  const [newReconName, setNewReconName] = useState("");
  const [newReconCost, setNewReconCost] = useState("");

  // Recon Category, Photo and Market check States
  const [reconCategory, setReconCategory] = useState<string>("Bodywork / Painting");
  const [reconPhoto, setReconPhoto] = useState<string>("");
  const [suggestingCost, setSuggestingCost] = useState(false);
  const [checkingMarket, setCheckingMarket] = useState(false);
  const [marketResult, setMarketResult] = useState<{ avg: number; min: number; max: number; recom: number; matches: { dealer: string; price: number; mileage: number; age: number }[] } | null>(null);

  // TrueAI States
  const [selectedHotspot, setSelectedHotspot] = useState<string | null>(null);
  const [tchekScanning, setTchekScanning] = useState(false);
  const [remarketingCopy, setRemarketingCopy] = useState<string>("");
  const [generatingCopy, setGeneratingCopy] = useState(false);

  // TrueAI Image Studio States
  const [selectedEnhanceImg, setSelectedEnhanceImg] = useState<string>("");
  const [enhancingImg, setEnhancingImg] = useState(false);
  const [enhanceBg, setEnhanceBg] = useState(true);
  const [enhancePlate, setEnhancePlate] = useState(true);
  const [enhanceLighting, setEnhanceLighting] = useState(true);
  const [enhancedResult, setEnhancedResult] = useState<string | null>(null);
  const [enhancedStatusStep, setEnhancedStatusStep] = useState<string>("");

  if (!isOpen) return null;

  const formatZAR = (num: number) => {
    return "R " + Math.round(num).toLocaleString("en-ZA");
  };

  // Preset gorgeous South African vehicle snapshots for the phone camera simulator
  const simulatedPresetPhotos: Record<string, string[]> = {
    Ford: [
      "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=80&w=600",
      "https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?auto=format&fit=crop&q=80&w=600"
    ],
    Volkswagen: [
      "https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&q=80&w=600",
      "https://images.unsplash.com/photo-1617531653332-bd46c24f2068?auto=format&fit=crop&q=80&w=600"
    ],
    Toyota: [
      "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=80&w=600",
      "https://images.unsplash.com/photo-1594568284297-7c64464062b1?auto=format&fit=crop&q=80&w=600"
    ],
    BMW: [
      "https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&q=80&w=600",
      "https://images.unsplash.com/photo-1556189250-72ba954cfc2b?auto=format&fit=crop&q=80&w=600"
    ],
    default: [
      "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=80&w=600",
      "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&q=80&w=600"
    ]
  };

  const getPresets = () => {
    return simulatedPresetPhotos[vehicle.make] || simulatedPresetPhotos.default;
  };

  const handleCheckMarket = () => {
    setCheckingMarket(true);
    setMarketResult(null);
    setTimeout(() => {
      const isHilux = vehicle.model.toLowerCase().includes("hilux");
      const isGolf = vehicle.model.toLowerCase().includes("golf") || vehicle.make.toLowerCase().includes("volkswagen");
      const isBMW = vehicle.make.toLowerCase().includes("bmw");
      const isRanger = vehicle.make.toLowerCase().includes("ford") || vehicle.model.toLowerCase().includes("ranger");

      let basePrice = vehicle.retailPrice;
      let matches = [];

      if (isGolf) {
        basePrice = 685000;
        matches = [
          { dealer: "Sandton Executive Select", price: 699000, mileage: 14000, age: 14 },
          { dealer: "Barons Woodmead Volkswagen", price: 685000, mileage: 19500, age: 30 },
          { dealer: "Pretoria GTi Club House", price: 679000, mileage: 22000, age: 45 }
        ];
      } else if (isHilux) {
        basePrice = 825000;
        matches = [
          { dealer: "Toyota Sandton Approved", price: 849000, mileage: 11000, age: 8 },
          { dealer: "N1 Pretoria Bakkie Centre", price: 829000, mileage: 13500, age: 19 },
          { dealer: "Cape Town Tough Trucks", price: 819000, mileage: 16000, age: 25 }
        ];
      } else if (isBMW) {
        basePrice = 910000;
        matches = [
          { dealer: "BMW Bryanston Motorrad", price: 929000, mileage: 7500, age: 12 },
          { dealer: "Supertech JHB M-Division", price: 909000, mileage: 9800, age: 18 },
          { dealer: "Constantia Kloof Prestige", price: 895000, mileage: 12100, age: 35 }
        ];
      } else if (isRanger) {
        basePrice = 795000;
        matches = [
          { dealer: "Ford Sandton Auto", price: 809000, mileage: 18000, age: 15 },
          { dealer: "Pretoria East Wildtrak Hub", price: 799000, mileage: 21000, age: 22 },
          { dealer: "Tygerberg Commercial Ford", price: 779000, mileage: 25500, age: 40 }
        ];
      } else {
        matches = [
          { dealer: "Gauteng Classified Match A", price: Math.round(basePrice * 1.03), mileage: Math.round(vehicle.mileage * 0.9), age: 15 },
          { dealer: "Sandton Premium Dealer", price: Math.round(basePrice * 1.01), mileage: Math.round(vehicle.mileage * 1.05), age: 22 },
          { dealer: "Pretoria Car Market", price: Math.round(basePrice * 0.97), mileage: Math.round(vehicle.mileage * 1.15), age: 45 }
        ];
      }

      const totalMatchesPrice = matches.reduce((sum, m) => sum + m.price, 0);
      const avg = Math.round(totalMatchesPrice / matches.length);
      const min = Math.min(...matches.map(m => m.price));
      const max = Math.max(...matches.map(m => m.price));
      const recom = Math.round(avg * 0.99);

      setMarketResult({ avg, min, max, recom, matches });
      setCheckingMarket(false);
    }, 1000);
  };

  // Real browser file upload parser
  const handleLocalFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    setUploading(true);
    const existingImages = vehicle.images || [];
    const readPromises = Array.from(files).map((file: any) => {
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
    });

    Promise.all(readPromises).then(async (newBase64s) => {
      await onUpdateVehicle(vehicle.id, {
        images: [...existingImages, ...newBase64s]
      });
      setActiveImageIndex(existingImages.length);
      setUploading(false);
    });
  };

  // Simulate snapping a photo with the virtual phone camera
  const triggerSimulatedMobileUpload = async (imgUrl: string) => {
    const existingImages = vehicle.images || [];
    await onUpdateVehicle(vehicle.id, {
      images: [...existingImages, imgUrl]
    });
    setActiveImageIndex(existingImages.length);
    alert("Phone Camera Sync Successful! Uploaded and published in real-time.");
  };

  const handleDeletePhoto = async (indexToDelete: number) => {
    if (!confirm("Remove this image from showroom listing?")) return;
    const existingImages = vehicle.images || [];
    const updatedImages = existingImages.filter((_, i) => i !== indexToDelete);
    await onUpdateVehicle(vehicle.id, {
      images: updatedImages
    });
    setActiveImageIndex(Math.max(0, indexToDelete - 1));
  };

  const imagesList = vehicle.images && vehicle.images.length > 0 
    ? vehicle.images 
    : [
        "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=80&w=800" // default fallback
      ];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[250] p-4 overflow-y-auto">
      <div className="bg-[#06080D] border border-white/10 rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]">
        
        {/* LEFT COLUMN: ACTIVE IMAGE VIEWER & GALLERY */}
        <div className="md:w-3/5 bg-black flex flex-col justify-between relative p-4 group">
          {/* Top Info Banner */}
          <div className="absolute top-4 left-4 z-10 bg-black/60 px-3 py-1.5 rounded-lg border border-white/10 backdrop-blur-md text-xs font-mono">
            {activeImageIndex + 1} of {imagesList.length} Photos
          </div>

          {/* Delete Action button if custom image */}
          {vehicle.images && vehicle.images.length > 0 && (
            <button
              onClick={() => handleDeletePhoto(activeImageIndex)}
              className="absolute top-4 right-4 z-10 bg-red-600/80 hover:bg-red-600 text-[#E8EAE6] p-2 rounded-lg transition-all cursor-pointer shadow-md"
              title="Delete Photo"
            >
              <Trash2 size={14} />
            </button>
          )}

          {/* Core Display frame */}
          <div className="flex-1 flex items-center justify-center min-h-[300px] max-h-[480px]">
            <img
              src={imagesList[activeImageIndex]}
              alt={`${vehicle.make} ${vehicle.model}`}
              className="max-h-full max-w-full object-contain rounded-lg shadow-lg"
            />
          </div>

          {/* Slide controls */}
          {imagesList.length > 1 && (
            <>
              <button
                onClick={() => setActiveImageIndex((prev) => (prev > 0 ? prev - 1 : imagesList.length - 1))}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/80 rounded-full border border-white/10 text-[#E8EAE6] transition-all cursor-pointer"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setActiveImageIndex((prev) => (prev < imagesList.length - 1 ? prev + 1 : 0))}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/80 rounded-full border border-white/10 text-[#E8EAE6] transition-all cursor-pointer"
              >
                <ChevronRight size={16} />
              </button>
            </>
          )}

          {/* Thumbnails list */}
          <div className="flex gap-2 overflow-x-auto py-2 border-t border-white/5 mt-2 scrollbar-none">
            {imagesList.map((img, idx) => (
              <button
                key={idx}
                onClick={() => setActiveImageIndex(idx)}
                className={`w-16 h-12 rounded-md overflow-hidden border-2 transition-all flex-shrink-0 cursor-pointer ${
                  idx === activeImageIndex ? "border-[#4FE3DC]" : "border-transparent opacity-60 hover:opacity-100"
                }`}
              >
                <img src={img} alt="Thumb" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>

        {/* RIGHT COLUMN: DETAIL SPECS, NATIS, INSPECTION & RECON TABS */}
        <div className="md:w-2/5 p-6 flex flex-col justify-between overflow-y-auto border-t md:border-t-0 md:border-l border-white/10">
          <div>
            {/* Header */}
            <div className="flex justify-between items-start border-b border-white/5 pb-3 mb-4">
              <div>
                <span className="text-[13px] bg-[#4FE3DC]/20 text-[#7FF0EA] px-2 py-0.5 rounded font-mono font-bold tracking-normal">
                  Stock: {vehicle.stockNumber}
                </span>
                <h3 className="text-lg font-bold text-[#E8EAE6] mt-1.5 leading-tight">{vehicle.year} {vehicle.make} {vehicle.model}</h3>
                <p className="text-xs text-[rgba(232,234,230,0.72)] mt-0.5">{vehicle.trim || "Standard Trim Specs"}</p>
              </div>
              <button
                onClick={onClose}
                className="text-[rgba(232,234,230,0.72)] hover:text-[#E8EAE6] p-1 rounded-lg transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Premium Operations Tab Selector */}
            <div className="flex bg-black/40 border border-white/5 rounded-xl p-1 mb-4 text-[13px] font-bold flex-wrap gap-1">
              <button
                onClick={() => setActiveTab("specs")}
                className={`flex-1 min-w-[70px] py-1.5 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  activeTab === "specs" ? "bg-[#4FE3DC] text-[#E8EAE6] shadow-md" : "text-[rgba(232,234,230,0.72)] hover:text-[rgba(232,234,230,0.72)]"
                }`}
              >
                <Grid size={11} /> Specs
              </button>
              <button
                onClick={() => setActiveTab("natis")}
                className={`flex-1 min-w-[70px] py-1.5 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  activeTab === "natis" ? "bg-[#4FE3DC] text-[#E8EAE6] shadow-md" : "text-[rgba(232,234,230,0.72)] hover:text-[rgba(232,234,230,0.72)]"
                }`}
              >
                <Shield size={11} /> NATIS
              </button>
              <button
                onClick={() => setActiveTab("inspection")}
                className={`flex-1 min-w-[70px] py-1.5 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  activeTab === "inspection" ? "bg-[#4FE3DC] text-[#E8EAE6] shadow-md" : "text-[rgba(232,234,230,0.72)] hover:text-[rgba(232,234,230,0.72)]"
                }`}
              >
                <Sparkles size={11} /> TrueAI
              </button>
              <button
                onClick={() => setActiveTab("recon")}
                className={`flex-1 min-w-[70px] py-1.5 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  activeTab === "recon" ? "bg-[#4FE3DC] text-[#E8EAE6] shadow-md" : "text-[rgba(232,234,230,0.72)] hover:text-[rgba(232,234,230,0.72)]"
                }`}
              >
                <Wrench size={11} /> Recon
              </button>
              {settings?.syndication && (
                <button
                  onClick={() => setActiveTab("syndication")}
                  className={`flex-1 min-w-[70px] py-1.5 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    activeTab === "syndication" ? "bg-[#4FE3DC] text-[#E8EAE6] shadow-md" : "text-[rgba(232,234,230,0.72)] hover:text-[rgba(232,234,230,0.72)]"
                  }`}
                >
                  <Share2 size={11} /> Syndicate
                </button>
              )}
            </div>

            {/* TAB 1: SHOWROOM SPECIFICATIONS */}
            {activeTab === "specs" && (
              <div className="space-y-4 animate-in fade-in duration-200">
                {/* Quick Pricing & Market Intelligence Widget */}
                <div className="bg-[#0B0F17]/3 border border-white/5 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-[12px] text-[rgba(232,234,230,0.72)]  font-bold tracking-wider">Showroom Retail Price</span>
                      <div className="text-lg font-semibold text-[#4FE3DC] font-mono mt-0.5">{formatZAR(vehicle.retailPrice)}</div>
                      {vehicle.truPrice ? (
                        <div className="text-[12px] font-bold mt-1" style={{ color: vehicle.truPrice > vehicle.retailPrice ? "#4ADE9B" : "rgba(232,234,230,0.72)" }}>
                          TruPrice {formatZAR(vehicle.truPrice)}
                          {vehicle.truPrice > vehicle.retailPrice
                            ? ` · ${formatZAR(vehicle.truPrice - vehicle.retailPrice)} below market`
                            : " · at or above market"}
                        </div>
                      ) : (
                        <div className="text-[12px] text-[rgba(232,234,230,0.72)]/60 mt-1">No TruPrice benchmark set</div>
                      )}
                    </div>
                    <div className="text-right">
                      <button
                        onClick={handleCheckMarket}
                        disabled={checkingMarket}
                        className="py-1 px-2.5 bg-[#4FE3DC]/10 border border-[#4FE3DC]/25 hover:bg-[#4FE3DC]/15 text-[#4FE3DC] text-[12px] font-semibold tracking-normal rounded-lg transition-all cursor-pointer flex items-center gap-1"
                      >
                        <Sparkles size={9} /> {checkingMarket ? "Querying..." : "Check Market"}
                      </button>
                    </div>
                  </div>

                  {checkingMarket && (
                    <div className="bg-black/40 border border-white/5 rounded-lg p-3 py-4 flex flex-col items-center justify-center gap-2 animate-pulse-subtle">
                      <RefreshCw size={14} className="animate-spin text-[#4FE3DC]" />
                      <div className="text-center">
                        <span className="text-[12px] text-[#4FE3DC] font-mono font-bold block tracking-normal">TrueAI Market Crawler</span>
                        <span className="text-[12px] text-[rgba(232,234,230,0.72)] block mt-0.5">Scoping regional Autotrader, Cars.co.za & social marketplace indicators...</span>
                      </div>
                    </div>
                  )}

                  {marketResult && (
                    <div className="bg-gradient-to-br from-[#121c2c] to-[#07101a] border border-[#4FE3DC]/25 rounded-lg p-3 space-y-3 animate-in slide-in-from-top duration-300 text-[13px]">
                      <div className="flex justify-between items-center border-b border-white/5 pb-1.5">
                        <span className="text-[12px] text-[#E8EAE6] font-semibold tracking-normal flex items-center gap-1">
                          <Layers size={10} className="text-[#4FE3DC]" /> Local Classified Matches (GP-ZAR)
                        </span>
                        <button onClick={() => setMarketResult(null)} className="text-[rgba(232,234,230,0.72)] hover:text-[#E8EAE6] text-[12px]  font-mono">Close</button>
                      </div>

                      {/* Similar listing list */}
                      <div className="space-y-1.5 font-mono text-[12px] text-[rgba(232,234,230,0.72)]">
                        {marketResult.matches.map((match, mIdx) => (
                          <div key={mIdx} className="flex justify-between items-center bg-black/20 px-2 py-1 rounded">
                            <span className="truncate max-w-[130px] font-sans text-[#E8EAE6]">{match.dealer}</span>
                            <span className="text-[rgba(232,234,230,0.72)]">{match.mileage.toLocaleString()}km / {match.age}d</span>
                            <span className="text-[#E8EAE6] font-bold">{formatZAR(match.price)}</span>
                          </div>
                        ))}
                      </div>

                      {/* Comparison range indicator */}
                      <div className="bg-black/30 p-2 rounded border border-white/3 text-[12px] font-mono space-y-2">
                        <div className="flex justify-between">
                          <span>Low: {formatZAR(marketResult.min)}</span>
                          <span className="text-[#E8EAE6] font-bold">Avg: {formatZAR(marketResult.avg)}</span>
                          <span>High: {formatZAR(marketResult.max)}</span>
                        </div>
                        
                        {/* Micro visual meter */}
                        <div className="w-full h-1 bg-[#0B0F17]/5 rounded-full overflow-hidden relative">
                          <div className="absolute left-[15%] right-[20%] h-full bg-gradient-to-r from-red-400 via-[#4FE3DC] to-yellow-500 rounded-full" />
                          <div className="absolute left-[45%] w-1.5 h-1.5 bg-[#0B0F17] border border-black rounded-full top-1/2 -translate-y-1/2" />
                        </div>

                        <div className="text-center text-[#4FE3DC] text-[12px] tracking-normal font-bold">
                          AI Recommended Target: {formatZAR(marketResult.recom)}
                        </div>
                      </div>

                      {/* Two distinct actions: reprice the car, OR just record what the
                          market says it's worth (keeps retail price + the "below
                          market" story intact — this is what feeds public TruPrice). */}
                      <button
                        onClick={async () => {
                          await onUpdateVehicle(vehicle.id, { truPrice: marketResult.avg });
                          alert(`TruPrice benchmark set to market average R ${marketResult.avg.toLocaleString("en-ZA")} — retail price unchanged.`);
                          setMarketResult(null);
                        }}
                        className="w-full py-1.5 bg-white/10 hover:bg-white/15 border border-white/15 text-[#E8EAE6] font-semibold  text-[12px] rounded-md text-center transition-all cursor-pointer block"
                      >
                        Set as TruPrice Benchmark (keep my price)
                      </button>
                      <button
                        onClick={async () => {
                          await onUpdateVehicle(vehicle.id, { retailPrice: marketResult.recom });
                          alert(`Showroom retail price synced to recommended market rate of R ${marketResult.recom.toLocaleString("en-ZA")}!`);
                          setMarketResult(null);
                        }}
                        className="w-full py-1.5 bg-[#4FE3DC] hover:bg-opacity-90 text-black font-semibold  text-[12px] rounded-md text-center transition-all cursor-pointer block"
                      >
                        1-Click Sync Retail to Recommended Price
                      </button>
                    </div>
                  )}
                </div>

                {/* Spec Matrix */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  <div><span className="text-[rgba(232,234,230,0.72)]">Mileage:</span> <span className="font-semibold text-[#E8EAE6]">{vehicle.mileage.toLocaleString()} km</span></div>
                  <div><span className="text-[rgba(232,234,230,0.72)]">Transmission:</span> <span className="font-semibold text-[#E8EAE6]">{vehicle.transmission}</span></div>
                  <div><span className="text-[rgba(232,234,230,0.72)]">Fuel Type:</span> <span className="font-semibold text-[#E8EAE6]">{vehicle.fuelType}</span></div>
                  <div><span className="text-[rgba(232,234,230,0.72)]">Body Style:</span> <span className="font-semibold text-[#E8EAE6]">{vehicle.bodyType || "Utility"}</span></div>
                  <div className="col-span-2"><span className="text-[rgba(232,234,230,0.72)]">Engine Spec:</span> <span className="font-semibold text-[#E8EAE6]">{vehicle.engine || "N/A"}</span></div>
                </div>

                {/* Description scrollbox */}
                <div className="text-xs text-[rgba(232,234,230,0.72)] leading-relaxed border-t border-b border-white/5 py-3 max-h-24 overflow-y-auto">
                  <span className="font-bold text-[#E8EAE6] block mb-0.5">Dealer Comments:</span>
                  {vehicle.description || "No comments entered."}
                </div>

                {/* MEDIA SYNC CONTROLS */}
                <div className="flex flex-col gap-3 pt-1">
                  <h4 className="text-xs font-bold text-[#E8EAE6] tracking-normal flex items-center gap-1.5">
                    <Layers size={14} className="text-[#4FE3DC]" />
                    Media Sync Station
                  </h4>

                  {/* Direct local file selector */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="flex-1 py-2 bg-[#4FE3DC] text-[#E8EAE6] hover:bg-opacity-80 transition-all font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Upload size={13} /> {uploading ? "Uploading..." : "Upload Photos"}
                    </button>
                    <button
                      onClick={() => setShowMobileSimulator(!showMobileSimulator)}
                      className="px-3.5 py-2 bg-[#0B0F17]/5 border border-white/5 text-[#E8EAE6] hover:bg-white/10 rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer"
                      title="Simulate Mobile Phone Camera"
                    >
                      <Smartphone size={13} /> Phone Sync
                    </button>
                  </div>

                  {/* Real HTML5 Input (accepts camera images on phone) */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    capture="environment" // trigger phone camera on mobile browsers!
                    onChange={handleLocalFileSelection}
                    className="hidden"
                  />
                </div>
              </div>
            )}

            {/* TAB 2: NATIS SOUTH AFRICA REGISTRATION GATEWAY */}
            {activeTab === "natis" && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="bg-gradient-to-tr from-[#121c2c] to-[#07101a] border border-white/5 rounded-xl p-4 flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <Shield size={18} className="text-[#4FE3DC]" />
                    <div>
                      <h4 className="text-xs font-semibold text-[#E8EAE6] tracking-normal">NATIS Verification Node</h4>
                      <p className="text-[12px] text-[rgba(232,234,230,0.72)]">Gauteng Licensing & Police Registry Interface</p>
                    </div>
                  </div>

                  {natisChecking ? (
                    <div className="py-6 flex flex-col items-center justify-center gap-3">
                      <RefreshCw className="animate-spin text-[#4FE3DC]" size={24} />
                      <span className="text-[13px] text-[rgba(232,234,230,0.72)] font-semibold text-center font-mono leading-relaxed">
                        Querying GP-NATIS centralized database...<br />
                        Verifying Chassis serial match...
                      </span>
                    </div>
                  ) : (vehicle as any).natisStatus === "VERIFIED" ? (
                    <div className="space-y-3">
                      <div className="bg-[#4ADE9B]/10 border border-[#4ADE9B]/20 rounded-lg p-2.5 flex items-center gap-2.5">
                        <CheckCircle2 size={16} className="text-[#4ADE9B]" />
                        <div>
                          <div className="text-[13px] text-[#E8EAE6] font-semibold ">REGISTRATION ACTIVE & CLEAR</div>
                          <div className="text-[12px] text-[#4ADE9B] font-semibold">Cleared on {(vehicle as any).natisDetails?.verifiedAt || "Today"}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[13px] font-mono">
                        <div className="bg-[#0B0F17]/2 p-2 rounded border border-white/3">
                          <div className="text-[12px] text-[rgba(232,234,230,0.72)]  font-bold">Owner Status</div>
                          <div className="text-[#E8EAE6] font-bold mt-0.5">MATCHED</div>
                        </div>
                        <div className="bg-[#0B0F17]/2 p-2 rounded border border-white/3">
                          <div className="text-[12px] text-[rgba(232,234,230,0.72)]  font-bold">Finance Lien</div>
                          <div className="text-[#4ADE9B] font-bold mt-0.5">NONE (PAID)</div>
                        </div>
                        <div className="bg-[#0B0F17]/2 p-2 rounded border border-white/3">
                          <div className="text-[12px] text-[rgba(232,234,230,0.72)]  font-bold">Theft File</div>
                          <div className="text-[#4ADE9B] font-bold mt-0.5">CLEAR</div>
                        </div>
                        <div className="bg-[#0B0F17]/2 p-2 rounded border border-white/3">
                          <div className="text-[12px] text-[rgba(232,234,230,0.72)]  font-bold">Licence Exp</div>
                          <div className="text-[#E8EAE6] font-bold mt-0.5">2027-02-28</div>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setNatisChecking(true);
                          setTimeout(() => {
                            setNatisChecking(false);
                          }, 1000);
                        }}
                        className="w-full py-2 bg-[#0B0F17]/5 hover:bg-white/10 text-xs text-[rgba(232,234,230,0.72)] hover:text-[#E8EAE6] font-bold rounded-xl transition-all border border-white/5 cursor-pointer"
                      >
                        Re-Query Database Node
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3.5 py-2">
                      <div className="text-[13px] text-[rgba(232,234,230,0.72)] leading-relaxed">
                        To protect the dealership against asset fraud, stolen title disputes, or hidden bank lines (Wesbank/Absa liens), run a secure registration validation.
                      </div>
                      <button
                        onClick={async () => {
                          setNatisChecking(true);
                          setTimeout(async () => {
                            await onUpdateVehicle(vehicle.id, {
                              natisStatus: "VERIFIED",
                              natisDetails: {
                                verifiedAt: new Date().toLocaleDateString("en-ZA"),
                                ownerMatch: "YES",
                                theftCheck: "CLEAR",
                                financeLien: "NONE",
                                licenseExpiry: "2027-02-28"
                              } as any
                            });
                            setNatisChecking(false);
                          }, 1200);
                        }}
                        className="w-full py-2.5 bg-[#4FE3DC] hover:bg-opacity-90 text-xs font-bold text-[#E8EAE6] rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Shield size={13} /> Perform NATIS Verification Check
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: TRUEAI COMPUTER VISION INSPECTION & REMARKETING */}
            {activeTab === "inspection" && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="bg-gradient-to-tr from-[#121c2c] to-[#07101a] border border-white/5 rounded-xl p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                    <div className="flex items-center gap-2">
                      <Sparkles size={16} className="text-[#4FE3DC]" />
                      <div>
                        <h4 className="text-xs font-semibold text-[#E8EAE6] tracking-normal">TrueAI Vision Platform</h4>
                        <p className="text-[12px] text-[rgba(232,234,230,0.72)]">AI Computer Vision Auto-Damage & Remarketing Node</p>
                      </div>
                    </div>
                    <span className="text-[12px] font-mono text-[#4FE3DC] bg-[#4FE3DC]/15 px-2 py-0.5 rounded-full tracking-normal font-bold">
                      ● READY
                    </span>
                  </div>

                  {tchekScanning ? (
                    <div className="py-8 flex flex-col items-center justify-center gap-3">
                      <RefreshCw className="animate-spin text-[#4FE3DC]" size={28} />
                      <div className="text-center font-mono space-y-1">
                        <span className="text-[13px] text-[#E8EAE6] font-bold block">TrueAI Scanner Running...</span>
                        <span className="text-[12px] text-[rgba(232,234,230,0.72)] block">Checking panels with 3D wireframe models...</span>
                        <span className="text-[12px] text-[#4FE3DC] animate-pulse block">Detecting paint thickness and deep panel dents...</span>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Interactive Vehicle blueprint map */}
                      <div className="bg-black/40 border border-white/5 rounded-xl p-3 flex flex-col items-center gap-3 relative">
                        <span className="text-[12px] text-[rgba(232,234,230,0.72)]  font-bold tracking-wider absolute top-2 left-3">Interactive 3D Scan Layout</span>
                        
                        {/* Interactive hotspots diagram */}
                        <div className="w-full h-36 flex items-center justify-center relative mt-3 bg-[radial-gradient(circle_at_center,rgba(21,199,192,0.06)_0%,transparent_70%)] rounded-lg">
                          {/* Stylized Vehicle Outline */}
                          <svg viewBox="0 0 400 180" className="w-full h-full opacity-60">
                            <rect x="50" y="50" width="300" height="80" rx="25" fill="none" stroke="rgba(232,234,230,0.45)" strokeWidth="1.5" strokeDasharray="4 4" />
                            <rect x="100" y="40" width="200" height="100" rx="20" fill="none" stroke="rgba(232,234,230,0.45)" strokeWidth="1.5" />
                            {/* Front Windshield */}
                            <path d="M130 50 L160 80 L240 80 L270 50 Z" fill="none" stroke="rgba(232,234,230,0.45)" strokeWidth="1.5" />
                            {/* Rear Windshield */}
                            <path d="M110 90 L130 110 L270 110 L290 90 Z" fill="none" stroke="rgba(232,234,230,0.45)" strokeWidth="1.5" />
                            {/* Wheels */}
                            <circle cx="90" cy="130" r="18" fill="none" stroke="rgba(232,234,230,0.45)" strokeWidth="2" />
                            <circle cx="310" cy="130" r="18" fill="none" stroke="rgba(232,234,230,0.45)" strokeWidth="2" />
                          </svg>

                          {/* Hotspot buttons */}
                          <button
                            onClick={() => setSelectedHotspot("front_bumper")}
                            className={`absolute top-[75px] right-[40px] w-5 h-5 rounded-full flex items-center justify-center font-bold text-[12px] cursor-pointer transition-all duration-300 ${
                              selectedHotspot === "front_bumper" ? "bg-red-500 text-[#E8EAE6] animate-ping" : "bg-red-500/80 hover:bg-red-500 text-[#E8EAE6] shadow-[0_0_10px_rgba(239,68,68,0.5)]"
                            }`}
                            title="Front Bumper Scratch"
                          >
                            !
                          </button>

                          <button
                            onClick={() => setSelectedHotspot("left_mirror")}
                            className={`absolute top-[28px] left-[150px] w-5 h-5 rounded-full flex items-center justify-center font-bold text-[12px] cursor-pointer transition-all duration-300 ${
                              selectedHotspot === "left_mirror" ? "bg-[#E8C468] text-black animate-ping" : "bg-[#E8C468]/80 hover:bg-[#E8C468] text-black shadow-[0_0_10px_rgba(231,178,75,0.5)]"
                            }`}
                            title="Side Mirror Dent"
                          >
                            !
                          </button>

                          <button
                            onClick={() => setSelectedHotspot("windshield")}
                            className={`absolute top-[60px] left-[190px] w-5 h-5 rounded-full flex items-center justify-center font-bold text-[12px] cursor-pointer transition-all duration-300 ${
                              selectedHotspot === "windshield" ? "bg-red-500 text-[#E8EAE6] animate-ping" : "bg-red-500/80 hover:bg-red-500 text-[#E8EAE6] shadow-[0_0_10px_rgba(239,68,68,0.5)]"
                            }`}
                            title="Windshield Star Crack"
                          >
                            !
                          </button>

                          <button
                            onClick={() => setSelectedHotspot("rear_fender")}
                            className={`absolute top-[85px] left-[55px] w-5 h-5 rounded-full flex items-center justify-center font-bold text-[12px] cursor-pointer transition-all duration-300 ${
                              selectedHotspot === "rear_fender" ? "bg-[#E8C468] text-black animate-ping" : "bg-[#E8C468]/80 hover:bg-[#E8C468] text-black shadow-[0_0_10px_rgba(231,178,75,0.5)]"
                            }`}
                            title="Rear Quarter Scratches"
                          >
                            !
                          </button>
                        </div>

                        {/* Interactive hotspot details card */}
                        <div className="w-full bg-[#06080D] border border-white/5 rounded-lg p-2.5 text-xs text-left min-h-[50px] flex items-center justify-between">
                          {selectedHotspot === "front_bumper" && (
                            <>
                              <div className="flex-1 mr-2">
                                <span className="font-bold text-[#E8EAE6] block">Front Bumper Lower Scratch</span>
                                <span className="text-[13px] text-red-400 font-semibold block">Severity: HIGH | Est. Repair: R 1,800</span>
                              </div>
                              <button
                                onClick={async () => {
                                  const currentTasks = vehicle.reconTasks || [];
                                  if (currentTasks.some(t => t.name.includes("Front Bumper Lower Scratch"))) {
                                    alert("Item already exists in Recon list!");
                                    return;
                                  }
                                  const updated = [...currentTasks, {
                                    id: "rec_" + Date.now(),
                                    name: "Front Bumper Scratch (TrueAI Scan)",
                                    cost: 1800,
                                    status: "Pending" as const,
                                    dateAdded: new Date().toISOString().slice(0, 10)
                                  }];
                                  await onUpdateVehicle(vehicle.id, { reconTasks: updated });
                                  alert("Synced to showroom reconditioning ledger!");
                                }}
                                className="px-2.5 py-1 bg-[#4FE3DC] text-[#E8EAE6] hover:bg-[#4FE3DC]/80 rounded text-[12px] font-bold cursor-pointer  transition-all"
                              >
                                Sync to Recon
                              </button>
                            </>
                          )}
                          {selectedHotspot === "left_mirror" && (
                            <>
                              <div className="flex-1 mr-2">
                                <span className="font-bold text-[#E8EAE6] block">Left Passenger Mirror Scuff</span>
                                <span className="text-[13px] text-[#E8C468] font-semibold block">Severity: MINOR | Est. Repair: R 850</span>
                              </div>
                              <button
                                onClick={async () => {
                                  const currentTasks = vehicle.reconTasks || [];
                                  if (currentTasks.some(t => t.name.includes("Left Passenger Mirror"))) {
                                    alert("Item already exists in Recon list!");
                                    return;
                                  }
                                  const updated = [...currentTasks, {
                                    id: "rec_" + Date.now(),
                                    name: "Left Mirror Scuff (TrueAI Scan)",
                                    cost: 850,
                                    status: "Pending" as const,
                                    dateAdded: new Date().toISOString().slice(0, 10)
                                  }];
                                  await onUpdateVehicle(vehicle.id, { reconTasks: updated });
                                  alert("Synced to showroom reconditioning ledger!");
                                }}
                                className="px-2.5 py-1 bg-[#4FE3DC] text-[#E8EAE6] hover:bg-[#4FE3DC]/80 rounded text-[12px] font-bold cursor-pointer  transition-all"
                              >
                                Sync to Recon
                              </button>
                            </>
                          )}
                          {selectedHotspot === "windshield" && (
                            <>
                              <div className="flex-1 mr-2">
                                <span className="font-bold text-[#E8EAE6] block">Windshield Star Chip (Driver Side)</span>
                                <span className="text-[13px] text-red-400 font-semibold block">Severity: CRITICAL | Est. Repair: R 1,200</span>
                              </div>
                              <button
                                onClick={async () => {
                                  const currentTasks = vehicle.reconTasks || [];
                                  if (currentTasks.some(t => t.name.includes("Windshield Star Chip"))) {
                                    alert("Item already exists in Recon list!");
                                    return;
                                  }
                                  const updated = [...currentTasks, {
                                    id: "rec_" + Date.now(),
                                    name: "Windshield Chip (TrueAI Scan)",
                                    cost: 1200,
                                    status: "Pending" as const,
                                    dateAdded: new Date().toISOString().slice(0, 10)
                                  }];
                                  await onUpdateVehicle(vehicle.id, { reconTasks: updated });
                                  alert("Synced to showroom reconditioning ledger!");
                                }}
                                className="px-2.5 py-1 bg-[#4FE3DC] text-[#E8EAE6] hover:bg-[#4FE3DC]/80 rounded text-[12px] font-bold cursor-pointer  transition-all"
                              >
                                Sync to Recon
                              </button>
                            </>
                          )}
                          {selectedHotspot === "rear_fender" && (
                            <>
                              <div className="flex-1 mr-2">
                                <span className="font-bold text-[#E8EAE6] block">Rear Left Fender Wheel Arch Scratch</span>
                                <span className="text-[13px] text-[#E8C468] font-semibold block">Severity: MEDIUM | Est. Repair: R 2,200</span>
                              </div>
                              <button
                                onClick={async () => {
                                  const currentTasks = vehicle.reconTasks || [];
                                  if (currentTasks.some(t => t.name.includes("Rear Left Fender"))) {
                                    alert("Item already exists in Recon list!");
                                    return;
                                  }
                                  const updated = [...currentTasks, {
                                    id: "rec_" + Date.now(),
                                    name: "Rear Fender Repair (TrueAI Scan)",
                                    cost: 2200,
                                    status: "Pending" as const,
                                    dateAdded: new Date().toISOString().slice(0, 10)
                                  }];
                                  await onUpdateVehicle(vehicle.id, { reconTasks: updated });
                                  alert("Synced to showroom reconditioning ledger!");
                                }}
                                className="px-2.5 py-1 bg-[#4FE3DC] text-[#E8EAE6] hover:bg-[#4FE3DC]/80 rounded text-[12px] font-bold cursor-pointer  transition-all"
                              >
                                Sync to Recon
                              </button>
                            </>
                          )}
                          {!selectedHotspot && (
                            <span className="text-[rgba(232,234,230,0.72)] text-[13px] italic text-center w-full">
                              Click any red/orange hotspot point on the wireframe model to extract computer-vision details.
                            </span>
                          )}
                        </div>
                      </div>

                      {/* TrueAI Scan and Remarketing control buttons */}
                      <div className="flex flex-col gap-2.5">
                        <button
                          onClick={() => {
                            setTchekScanning(true);
                            setTimeout(() => {
                              setTchekScanning(false);
                              setSelectedHotspot("front_bumper");
                            }, 1200);
                          }}
                          className="w-full py-2 bg-[#4FE3DC]/10 border border-[#4FE3DC]/20 hover:bg-[#4FE3DC]/20 text-[#4FE3DC] font-semibold text-[13px] rounded-xl transition-all tracking-normal cursor-pointer"
                        >
                          Trigger Fresh 3D AI Body Scan
                        </button>

                        {/* TrueAI Copywriter Generator */}
                        <div className="bg-black/20 border border-white/5 rounded-xl p-3 flex flex-col gap-2">
                          <div className="flex items-center gap-1.5 text-xs text-[#E8EAE6] font-bold">
                            <Sparkles size={12} className="text-[#4FE3DC]" />
                            TrueAI One-Click Auto-Remarket Copy
                          </div>
                          
                          {generatingCopy ? (
                            <div className="py-3 flex justify-center items-center gap-1.5 text-[13px] text-[rgba(232,234,230,0.72)] font-mono">
                              <RefreshCw size={12} className="animate-spin text-[#4FE3DC]" /> Creating listing copy...
                            </div>
                          ) : remarketingCopy ? (
                            <div className="space-y-2">
                              <textarea
                                value={remarketingCopy}
                                readOnly
                                className="w-full h-24 bg-black/40 border border-white/5 rounded-lg p-2 text-[13px] text-[rgba(232,234,230,0.72)] font-mono outline-none resize-none leading-relaxed"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(remarketingCopy);
                                    alert("Copied to clipboard!");
                                  }}
                                  className="flex-1 py-1.5 bg-[#0B0F17]/5 border border-white/5 text-[rgba(232,234,230,0.72)] hover:text-[#E8EAE6] font-bold text-[12px] rounded-lg cursor-pointer transition-all "
                                >
                                  Copy Copywriting Text
                                </button>
                                <button
                                  onClick={() => setRemarketingCopy("")}
                                  className="px-3 py-1.5 bg-[#0B0F17]/5 border border-white/5 text-red-400 hover:bg-red-500/10 font-bold text-[12px] rounded-lg cursor-pointer transition-all "
                                >
                                  Clear
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setGeneratingCopy(true);
                                setTimeout(() => {
                                  setGeneratingCopy(false);
                                  setRemarketingCopy(
                                    `🔥 JUST ARRIVED IN SHOWROOM! 🔥\n\n` +
                                    `🌟 ${vehicle.year} ${vehicle.make.toUpperCase()} ${vehicle.model.toUpperCase()} (${vehicle.transmission})\n` +
                                    `📍 Mileage: ${vehicle.mileage.toLocaleString()} km\n` +
                                    `⛽ Fuel Type: ${vehicle.fuelType}\n` +
                                    `💰 Price: ${formatZAR(vehicle.retailPrice)}\n` +
                                    `📄 NATIS Registration Status: Fully Checked & Cleared\n\n` +
                                    `✨ Fully certified with TrueAI computer-vision quality certificate! Clean title. Incredible performance, highly economical.\n\n` +
                                    `📞 Contact us now to secure or book a test-drive. Finance options available!`
                                  );
                                }, 800);
                              }}
                              className="w-full py-2 bg-[#4FE3DC] hover:bg-opacity-90 text-xs text-[#E8EAE6] font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                            >
                              <FileText size={13} /> Draft TrueAI Showroom Listing
                            </button>
                          )}
                        </div>

                        {settings?.seoAeo && (
                          <div className="bg-black/20 border border-white/5 rounded-xl p-3 flex flex-col gap-2 mt-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5 text-xs text-[#E8EAE6] font-bold">
                                <Globe size={12} className="text-[#4ADE9B]" />
                                Automated SEO & AEO Generator
                              </div>
                              <span className="bg-[#4ADE9B]/15 text-[#4ADE9B] text-[12px] font-bold px-1.5 py-0.5 rounded">AUTO-RANK</span>
                            </div>
                            <button
                              onClick={() => {
                                alert("Generated Meta Title:\n" + `${vehicle.year} ${vehicle.make} ${vehicle.model} for Sale | Approved Dealer\n\n` + 
                                      "Generated SEO Description:\n" + `Looking for a pristine ${vehicle.year} ${vehicle.make} ${vehicle.model}? This ${vehicle.bodyType || 'vehicle'} offers incredible value at ${formatZAR(vehicle.retailPrice)}. Fully inspected and approved.`);
                              }}
                              className="w-full py-2 bg-[#0B0F17]/5 hover:bg-white/10 border border-white/10 text-xs text-[rgba(232,234,230,0.72)] hover:text-[#E8EAE6] font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                            >
                              <Search size={13} /> Generate SEO Tags & Description
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* TRUEAI WEB-READY IMAGE ENHANCER STUDIO */}
                <div className="bg-gradient-to-tr from-[#121c2c] to-[#07101a] border border-white/5 rounded-xl p-4 flex flex-col gap-4">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                    <div className="flex items-center gap-2">
                      <Layers size={16} className="text-[#4FE3DC]" />
                      <div>
                        <h4 className="text-xs font-semibold text-[#E8EAE6] tracking-normal">TrueAI Studio Backdrop Enhancer</h4>
                        <p className="text-[12px] text-[rgba(232,234,230,0.72)]">Turn smartphone yard photos into premium web-ready showroom assets</p>
                      </div>
                    </div>
                    <span className="text-[12px] font-mono text-[#4FE3DC] bg-[#4FE3DC]/15 px-2 py-0.5 rounded-full tracking-normal font-bold">
                      STUDIO BOOTH ACTIVE
                    </span>
                  </div>

                  {/* Select Image Dropdown */}
                  <div className="space-y-1.5">
                    <label className="text-[12px] text-[rgba(232,234,230,0.72)]  font-bold tracking-wider">Select Photo to Enhance</label>
                    <div className="flex gap-2">
                      <select
                        value={selectedEnhanceImg || (imagesList[0] || "")}
                        onChange={(e) => {
                          setSelectedEnhanceImg(e.target.value);
                          setEnhancedResult(null);
                        }}
                        className="flex-1 bg-black/40 border border-white/5 rounded-lg px-2.5 py-1.5 text-xs text-[#E8EAE6] outline-none focus:border-[#4FE3DC]"
                      >
                        {imagesList.map((img, idx) => (
                          <option key={idx} value={img} className="bg-[#06080D]">
                            Photo #{idx + 1} ({img.startsWith("data:") ? "Uploaded Base64" : "Web Asset"})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Configuration Checkboxes */}
                  <div className="bg-black/30 border border-white/3 rounded-lg p-3 space-y-2.5 text-xs">
                    <span className="text-[12px] text-[rgba(232,234,230,0.72)]  font-bold tracking-wider block">Enhancement Pipeline Config</span>
                    
                    <label className="flex items-center gap-2.5 text-[#E8EAE6] cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={enhanceBg}
                        onChange={(e) => setEnhanceBg(e.target.checked)}
                        className="rounded border-white/10 text-[#4FE3DC] focus:ring-[#4FE3DC] bg-black/40"
                      />
                      <div>
                        <span className="font-semibold block">Remove Background & Place in Showroom Booth</span>
                        <span className="text-[12px] text-[rgba(232,234,230,0.72)] block">Superimposes vehicle onto high-end Sandton virtual showroom floor</span>
                      </div>
                    </label>

                    <label className="flex items-center gap-2.5 text-[#E8EAE6] cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={enhanceLighting}
                        onChange={(e) => setEnhanceLighting(e.target.checked)}
                        className="rounded border-white/10 text-[#4FE3DC] focus:ring-[#4FE3DC] bg-black/40"
                      />
                      <div>
                        <span className="font-semibold block">Intelligent Studio Lighting & Reflection Optimization</span>
                        <span className="text-[12px] text-[rgba(232,234,230,0.72)] block">Balances exposure, removes harsh shadows, adds paint gloss & depth</span>
                      </div>
                    </label>

                    <label className="flex items-center gap-2.5 text-[#E8EAE6] cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={enhancePlate}
                        onChange={(e) => setEnhancePlate(e.target.checked)}
                        className="rounded border-white/10 text-[#4FE3DC] focus:ring-[#4FE3DC] bg-black/40"
                      />
                      <div>
                        <span className="font-semibold block">Overlay Acrylic "DIALLED OPS" Branded Dealer Plate</span>
                        <span className="text-[12px] text-[rgba(232,234,230,0.72)] block">Auto-detects vehicle license plates and masks with branding</span>
                      </div>
                    </label>
                  </div>

                  {/* Processing / Result Area */}
                  {enhancingImg ? (
                    <div className="bg-black/40 border border-white/5 rounded-xl p-6 flex flex-col items-center justify-center gap-3">
                      <RefreshCw className="animate-spin text-[#4FE3DC]" size={28} />
                      <div className="text-center font-mono space-y-1">
                        <span className="text-[13px] text-[#E8EAE6] font-bold block">TrueAI Studio Engine Running...</span>
                        <span className="text-[12px] text-[#4FE3DC] animate-pulse block">{enhancedStatusStep || "Processing..."}</span>
                        
                        {/* Fake micro progress bar */}
                        <div className="w-48 h-1.5 bg-[#0B0F17]/5 rounded-full overflow-hidden mx-auto mt-2">
                          <div className="h-full bg-gradient-to-r from-[#4FE3DC] to-[#4FE3DC] animate-[shimmer_2s_infinite] w-full" style={{
                            animationDuration: '1.5s',
                            backgroundImage: 'linear-gradient(90deg, #4FE3DC 0%, #4FE3DC 50%, #4FE3DC 100%)',
                            backgroundSize: '200% 100%'
                          }} />
                        </div>
                      </div>
                    </div>
                  ) : enhancedResult ? (
                    <div className="space-y-3">
                      {/* Before / After side-by-side or comparative panel */}
                      <span className="text-[12px] text-[rgba(232,234,230,0.72)]  font-bold tracking-wider block">Comparison Studio Preview</span>
                      
                      <div className="grid grid-cols-2 gap-2">
                        {/* Before */}
                        <div className="bg-black/40 border border-white/5 rounded-lg p-1.5 text-center relative overflow-hidden">
                          <span className="absolute top-2 left-2 bg-black/60 px-1.5 py-0.5 rounded text-[7px] font-bold text-gray-400 ">Original Photo</span>
                          <img
                            src={selectedEnhanceImg || (imagesList[0] || "")}
                            alt="Original"
                            className="w-full h-24 object-cover rounded"
                          />
                        </div>

                        {/* After */}
                        <div className="bg-[#4FE3DC]/5 border border-[#4FE3DC]/30 rounded-lg p-1.5 text-center relative overflow-hidden">
                          <span className="absolute top-2 left-2 bg-[#4FE3DC] text-black px-1.5 py-0.5 rounded text-[7px] font-semibold tracking-normal font-bold">TrueAI Web-Ready</span>
                          <img
                            src={enhancedResult}
                            alt="Enhanced Result"
                            className="w-full h-24 object-cover rounded filter brightness-105 contrast-110 saturate-105"
                          />
                        </div>
                      </div>

                      {/* Apply button */}
                      <div className="flex flex-col gap-2">
                        <div className="flex gap-2">
                          <button
                            onClick={async () => {
                              const originalImg = selectedEnhanceImg || (imagesList[0] || "");
                              const existingImages = vehicle.images || [];
                              // Replace original image with the enhanced one
                              const updatedImages = existingImages.map(img => img === originalImg ? (enhancedResult || "") : img);
                              
                              await onUpdateVehicle(vehicle.id, { images: updatedImages });
                              alert("Listing image successfully updated with TrueAI Web-Ready Studio asset!");
                              setEnhancedResult(null);
                            }}
                            className="flex-1 py-2 bg-[#4FE3DC] hover:bg-opacity-90 text-black font-semibold text-xs rounded-xl transition-all tracking-normal cursor-pointer"
                          >
                            Overwrite Original
                          </button>
                          <button
                            onClick={async () => {
                              const existingImages = vehicle.images || [];
                              const updatedImages = [...existingImages, enhancedResult || ""];
                              
                              await onUpdateVehicle(vehicle.id, { images: updatedImages });
                              setActiveImageIndex(updatedImages.length - 1);
                              alert("Enhanced image successfully added to listing gallery!");
                              setEnhancedResult(null);
                            }}
                            className="flex-1 py-2 bg-[#0B0F17]/10 hover:bg-[#0B0F17]/15 border border-white/15 text-[#E8EAE6] font-semibold text-xs rounded-xl transition-all tracking-normal cursor-pointer"
                          >
                            Add as New Photo
                          </button>
                        </div>
                        {settings?.trueAI && (
                          <button
                            onClick={() => {
                              alert("Generating social media campaign...\n\n" +
                                    "Caption:\n🔥 Ready for a new ride? Check out this pristine " + vehicle.year + " " + vehicle.make + " " + vehicle.model + "! Just rolled into our showroom and won't last long.\n\n" +
                                    "👉 DM us to book a test drive today!\n\n" +
                                    "#Dealership #" + vehicle.make.replace(/\s+/g, '') + " #" + vehicle.model.replace(/\s+/g, '') + " #CarsForSale #AutoSales");
                            }}
                            className="w-full py-2 mt-1 bg-[#4FE3DC] hover:bg-opacity-90 text-[#E8EAE6] font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
                          >
                            <Facebook size={14} /> Create Social Remarketing Campaign
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        const targetImg = selectedEnhanceImg || (imagesList[0] || "");
                        if (!targetImg) {
                          alert("Please upload/select a photo first!");
                          return;
                        }

                        setEnhancingImg(true);
                        setEnhancedStatusStep("Isolating vehicle silhouette & masking edges...");
                        
                        setTimeout(() => {
                          setEnhancedStatusStep("Replacing backdrop with Sandton Virtual Showroom Booth...");
                        }, 600);

                        setTimeout(() => {
                          setEnhancedStatusStep("Overlaying premium 3D branded plates & lighting reflections...");
                        }, 1200);

                        setTimeout(() => {
                          setEnhancingImg(false);
                          
                          // Set a gorgeous enhanced web-ready version based on the vehicle
                          // Or use a custom high-end studio shot of the respective car make to simulate perfectly!
                          let finalStudioImg = "https://images.unsplash.com/photo-1617531653332-bd46c24f2068?auto=format&fit=crop&q=80&w=800"; // Default clean BMW studio shot
                          
                          if (vehicle.make.toLowerCase().includes("ford")) {
                            finalStudioImg = "https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?auto=format&fit=crop&q=80&w=800";
                          } else if (vehicle.make.toLowerCase().includes("volkswagen") || vehicle.make.toLowerCase().includes("vw")) {
                            finalStudioImg = "https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&q=80&w=800";
                          } else if (vehicle.make.toLowerCase().includes("toyota")) {
                            finalStudioImg = "https://images.unsplash.com/photo-1594568284297-7c64464062b1?auto=format&fit=crop&q=80&w=800";
                          } else if (vehicle.make.toLowerCase().includes("bmw")) {
                            finalStudioImg = "https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&q=80&w=800";
                          }

                          setEnhancedResult(finalStudioImg);
                        }, 1800);
                      }}
                      className="w-full py-2.5 bg-gradient-to-r from-[#4FE3DC] to-[#4FE3DC] hover:opacity-90 text-[#E8EAE6] font-semibold text-xs rounded-xl transition-all tracking-normal cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Sparkles size={14} /> Run TrueAI Studio Enhancer
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* TAB 4: RECONDITIONING COST WORKFLOW AND LOGGING */}
            {activeTab === "recon" && (
              <div className="space-y-4 animate-in fade-in duration-200">
                {(() => {
                  const tasks = vehicle.reconTasks || [];
                  const totalReconCost = tasks.reduce((sum, t) => sum + t.cost, 0);
                  const adjustedCostBasis = vehicle.costPrice + totalReconCost;
                  const profit = vehicle.retailPrice - adjustedCostBasis;
                  const marginPercent = vehicle.retailPrice > 0 ? (profit / vehicle.retailPrice) * 100 : 0;
                  const targetProfitThreshold = 25000; // R25,000 target
                  const targetMarginThreshold = 10; // 10% target
                  const isBelowTarget = profit < targetProfitThreshold || marginPercent < targetMarginThreshold;
                  const suggestedHealthyPrice = Math.round((vehicle.costPrice + totalReconCost) * 1.15); // 15% margin markup

                  const handleAddTask = async (e: React.FormEvent) => {
                    e.preventDefault();
                    if (!newReconName.trim()) return;

                    const newTask = {
                      id: "rec_" + Date.now(),
                      name: newReconName.trim(),
                      category: reconCategory,
                      cost: parseFloat(newReconCost) || 0,
                      status: "Pending" as const,
                      photo: reconPhoto || undefined,
                      dateAdded: new Date().toISOString().slice(0, 10)
                    };

                    const updatedTasks = [...tasks, newTask];
                    await onUpdateVehicle(vehicle.id, { reconTasks: updatedTasks });
                    setNewReconName("");
                    setNewReconCost("");
                    setReconPhoto("");
                  };

                  const handleToggleTaskStatus = async (taskId: string) => {
                    const updated = tasks.map(t => 
                      t.id === taskId 
                        ? { ...t, status: (t.status === "Completed" ? "Pending" : "Completed") as any } 
                        : t
                    );
                    await onUpdateVehicle(vehicle.id, { reconTasks: updated });
                  };

                  const handleDeleteTask = async (taskId: string) => {
                    const updated = tasks.filter(t => t.id !== taskId);
                    await onUpdateVehicle(vehicle.id, { reconTasks: updated });
                  };

                  const handleAICostRecommendation = () => {
                    setSuggestingCost(true);
                    setTimeout(() => {
                      let recommendedCost = 1500;
                      let recommendedName = "Valet & Detailing";
                      
                      if (reconCategory === "Bodywork / Painting") {
                        recommendedCost = vehicle.year < 2020 ? 3200 : 2500;
                        recommendedName = "Bumper Spray & Paint Correction";
                      } else if (reconCategory === "Tyres & Alignment") {
                        recommendedCost = 4800;
                        recommendedName = "Replace Front Tyres & Wheel Alignment";
                      } else if (reconCategory === "Mechanical / Brakes") {
                        recommendedCost = vehicle.mileage > 100000 ? 5500 : 3800;
                        recommendedName = "Front Brake Pads & Disc Machining";
                      } else if (reconCategory === "Electrical / Diagnostics") {
                        recommendedCost = 1800;
                        recommendedName = "ECU Diagnostic Scan & Battery Reset";
                      } else if (reconCategory === "Interior Valet") {
                        recommendedCost = 1200;
                        recommendedName = "Deep Extraction Seat Valet & Leather Prep";
                      } else {
                        recommendedCost = 1000;
                        recommendedName = "General Workshop Safety Check";
                      }

                      setNewReconName(recommendedName);
                      setNewReconCost(recommendedCost.toString());
                      setSuggestingCost(false);
                    }, 500);
                  };

                  const triggerSimulatedPrepPhoto = () => {
                    // Pick a relevant gorgeous simulated reconditioning prep asset
                    const simulatedPrepAssets: Record<string, string> = {
                      "Bodywork / Painting": "https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?auto=format&fit=crop&q=80&w=300", // paint workshop
                      "Interior Valet": "https://images.unsplash.com/photo-1607860108855-64acf2078ed9?auto=format&fit=crop&q=80&w=300", // vacuuming/detailing
                      "Tyres & Alignment": "https://images.unsplash.com/photo-1578844251758-2f71da64c96f?auto=format&fit=crop&q=80&w=300", // tyre alignment
                      "Mechanical / Brakes": "https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&q=80&w=300", // mechanics
                      "Electrical / Diagnostics": "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&q=80&w=300", // electrical diagnostic
                      "Other": "https://images.unsplash.com/photo-1517524206127-48bbd363f3d7?auto=format&fit=crop&q=80&w=300"
                    };

                    const chosen = simulatedPrepAssets[reconCategory] || simulatedPrepAssets["Other"];
                    setReconPhoto(chosen);
                    alert("TrueAI Prep Camera Synced: Selected high-res inspection snapshot.");
                  };

                  return (
                    <div className="space-y-3.5">
                      {/* Financial outline */}
                      <div className="bg-gradient-to-tr from-[#121c2c] to-[#07101a] border border-white/5 rounded-xl p-3 grid grid-cols-3 gap-2 text-xs font-mono">
                        <div>
                          <div className="text-[12px] text-[rgba(232,234,230,0.72)]  font-bold">Total Recon Spend</div>
                          <div className="text-[#E8EAE6] font-semibold mt-0.5">{formatZAR(totalReconCost)}</div>
                        </div>
                        <div className="border-l border-white/5 pl-2">
                          <div className="text-[12px] text-[rgba(232,234,230,0.72)]  font-bold">Adjusted Cost</div>
                          <div className="text-[#4FE3DC] font-semibold mt-0.5">{formatZAR(adjustedCostBasis)}</div>
                        </div>
                        <div className="border-l border-white/5 pl-2">
                          <div className="text-[12px] text-[rgba(232,234,230,0.72)]  font-bold">Expected Margin</div>
                          <div className={`font-semibold mt-0.5 ${isBelowTarget ? "text-red-400" : "text-[#4ADE9B]"}`}>
                            {formatZAR(profit)} ({marginPercent.toFixed(1)}%)
                          </div>
                        </div>
                      </div>

                      {/* Profitability Warning Alert with Quick Price Adjust */}
                      {isBelowTarget && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex flex-col gap-2 animate-pulse-subtle">
                          <div className="flex items-start gap-2 text-xs text-red-400">
                            <AlertCircle size={15} className="mt-0.5 shrink-0" />
                            <div>
                              <span className="font-bold block">Profitability Target Violation</span>
                              <span className="text-[13px] text-[rgba(232,234,230,0.72)] block leading-normal">
                                Projected deal margin of **{marginPercent.toFixed(1)}%** is below dealership threshold (10.0% / R25,000). Action required to protect commission pool.
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={async () => {
                              await onUpdateVehicle(vehicle.id, { retailPrice: suggestedHealthyPrice });
                              alert(`Retail price adjusted to R ${suggestedHealthyPrice.toLocaleString("en-ZA")}! Target profit margin of 15% is now secured.`);
                            }}
                            className="w-full py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-bold text-[13px] rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 "
                          >
                            <Zap size={10} /> Quick Adjust Price to {formatZAR(suggestedHealthyPrice)} (15% Margin)
                          </button>
                        </div>
                      )}

                      {/* List of current recon tasks */}
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {tasks.length === 0 ? (
                          <div className="text-center py-4 text-[13px] text-[rgba(232,234,230,0.72)] border border-dashed border-white/5 rounded-lg">
                            No reconditioning items registered. Use the tool below to estimate and log pre-sale prep.
                          </div>
                        ) : (
                          tasks.map((task) => (
                            <div key={task.id} className="bg-black/30 border border-[#4FE3DC]/10 rounded-lg p-2.5 flex justify-between items-center text-xs">
                              <div className="flex items-center gap-2.5">
                                {task.photo ? (
                                  <div className="relative w-10 h-10 rounded overflow-hidden border border-white/5 shrink-0">
                                    <img src={task.photo} alt={task.name} className="w-full h-full object-cover" />
                                    <span className="absolute bottom-0 right-0 bg-black/70 text-[6px] text-[#4FE3DC] px-0.5 font-bold font-mono">IMG</span>
                                  </div>
                                ) : (
                                  <div className="w-10 h-10 rounded bg-[#0B0F17]/5 border border-dashed border-white/10 flex items-center justify-center text-gray-400 shrink-0">
                                    <Camera size={12} />
                                  </div>
                                )}
                                <div>
                                  <span className={`font-semibold ${task.status === "Completed" ? "line-through text-[rgba(232,234,230,0.72)]" : "text-[#E8EAE6]"}`}>
                                    {task.name}
                                  </span>
                                  <div className="text-[12px] text-[rgba(232,234,230,0.72)] mt-0.5 flex items-center gap-1.5 font-mono">
                                    <span className="bg-[#0B0F17]/5 px-1 py-0.2 rounded text-[12px]  font-sans">{task.category || "General"}</span>
                                    <span>Cost: {formatZAR(task.cost)}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => handleToggleTaskStatus(task.id)}
                                  className={`px-2 py-0.5 rounded text-[12px] font-bold  cursor-pointer ${
                                    task.status === "Completed" ? "bg-[#4ADE9B]/15 text-[#4ADE9B]" : "bg-[#4FE3DC]/15 text-[#7FF0EA]"
                                  }`}
                                >
                                  {task.status === "Completed" ? "Completed" : "In Progress"}
                                </button>
                                <button
                                  onClick={() => handleDeleteTask(task.id)}
                                  className="p-1 hover:bg-white/5 text-[rgba(232,234,230,0.72)] hover:text-red-500 rounded cursor-pointer transition-all"
                                  title="Remove"
                                >
                                  <Trash2 size={11} />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Form to log new recon tasks */}
                      <form onSubmit={handleAddTask} className="bg-[#0B0F17]/3 border border-white/5 rounded-xl p-2.5 space-y-2.5">
                        <div className="flex justify-between items-center">
                          <div className="text-[12px] text-[#E8EAE6] font-semibold tracking-normal">Log Work Directive & Prep Tasks</div>
                          <span className="text-[12px] text-[rgba(232,234,230,0.72)] font-mono">1-CLICK AI ASSISTANT</span>
                        </div>

                        {/* Category and AI cost recommend row */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[12px] text-[rgba(232,234,230,0.72)]  font-bold">Task Category</label>
                            <select
                              value={reconCategory}
                              onChange={(e) => setReconCategory(e.target.value)}
                              className="w-full bg-black/40 border border-white/5 rounded px-2 py-1 text-[13px] text-[#E8EAE6] outline-none"
                            >
                              <option value="Bodywork / Painting">Bodywork / Painting</option>
                              <option value="Interior Valet">Interior Valet / Deep Clean</option>
                              <option value="Tyres & Alignment">Tyres & Alignment</option>
                              <option value="Mechanical / Brakes">Mechanical / Brakes</option>
                              <option value="Electrical / Diagnostics">Electrical / Diagnostics</option>
                              <option value="Other">Other Repairs</option>
                            </select>
                          </div>
                          <div className="flex items-end">
                            <button
                              type="button"
                              onClick={handleAICostRecommendation}
                              disabled={suggestingCost}
                              className="w-full py-1 bg-[#4FE3DC]/10 border border-[#4FE3DC]/25 hover:bg-[#4FE3DC]/15 text-[#4FE3DC] text-[12px] font-semibold tracking-normal rounded transition-all cursor-pointer flex items-center justify-center gap-1 disabled:opacity-50 h-[24px]"
                            >
                              <Sparkles size={9} /> {suggestingCost ? "Assessing..." : "Suggest AI Cost"}
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-5 gap-1.5">
                          <input
                            type="text"
                            placeholder="Describe precise repair task..."
                            value={newReconName}
                            onChange={(e) => setNewReconName(e.target.value)}
                            className="col-span-3 bg-black/40 border border-white/5 rounded px-2 py-1 text-[13px] text-[#E8EAE6] outline-none"
                          />
                          <input
                            type="number"
                            placeholder="ZAR Cost"
                            value={newReconCost}
                            onChange={(e) => setNewReconCost(e.target.value)}
                            className="col-span-2 bg-black/40 border border-white/5 rounded px-2 py-1 text-[13px] text-[#E8EAE6] outline-none font-mono"
                          />
                        </div>

                        {/* Photo capture mock/real sync row */}
                        <div className="bg-black/20 p-2 rounded-lg border border-white/3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {reconPhoto ? (
                              <img src={reconPhoto} alt="Selected attachment" className="w-8 h-8 rounded object-cover border border-[#4FE3DC]/35" />
                            ) : (
                              <div className="w-8 h-8 rounded bg-[#0B0F17]/5 flex items-center justify-center text-[rgba(232,234,230,0.72)]">
                                <Camera size={12} />
                              </div>
                            )}
                            <div>
                              <span className="text-[12px] font-bold text-[#E8EAE6] block">Task Damage Photo</span>
                              <span className="text-[12px] text-[rgba(232,234,230,0.72)] block">{reconPhoto ? "Photo Attached" : "None attached"}</span>
                            </div>
                          </div>
                          
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={triggerSimulatedPrepPhoto}
                              className="px-2 py-1 bg-[#0B0F17]/5 hover:bg-white/10 border border-white/5 text-[#E8EAE6] rounded text-[12px] font-bold  transition-all"
                            >
                              Simulate Camera Snap
                            </button>
                          </div>
                        </div>

                        <button
                          type="submit"
                          className="w-full py-1.5 bg-[#4FE3DC] hover:bg-opacity-90 text-[#E8EAE6] font-bold text-[13px] rounded-md transition-all cursor-pointer flex items-center justify-center gap-1 "
                        >
                          <Plus size={11} /> Save & Log Prep Directive
                        </button>
                      </form>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* TAB 5: SYNDICATION HUB */}
            {activeTab === "syndication" && settings?.syndication && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="bg-gradient-to-tr from-[#121c2c] to-[#07101a] border border-white/5 rounded-xl p-4 flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <Share2 size={18} className="text-[#4FE3DC]" />
                    <div>
                      <h4 className="text-xs font-semibold text-[#E8EAE6] tracking-normal">Multi-Portal Syndication Hub</h4>
                      <p className="text-[12px] text-[rgba(232,234,230,0.72)]">Distribute inventory to partner networks</p>
                    </div>
                  </div>

                  <div className="space-y-2 mt-2">
                    {/* AutoTrader */}
                    <div className="bg-black/30 border border-white/5 rounded-lg p-3 flex justify-between items-center">
                      <div className="flex flex-col">
                        <span className="text-[#E8EAE6] text-xs font-bold">AutoTrader SA</span>
                        <span className="text-[rgba(232,234,230,0.72)] text-[13px]">Premium Listings Portal</span>
                      </div>
                      <button
                        onClick={() => alert("Simulated push to AutoTrader successful.")}
                        className="px-3 py-1.5 bg-[#ff6b00]/10 hover:bg-[#ff6b00]/20 text-[#ff6b00] text-[13px] font-bold rounded tracking-normal transition-all"
                      >
                        Publish
                      </button>
                    </div>

                    {/* Cars.co.za */}
                    <div className="bg-black/30 border border-white/5 rounded-lg p-3 flex justify-between items-center">
                      <div className="flex flex-col">
                        <span className="text-[#E8EAE6] text-xs font-bold">Cars.co.za</span>
                        <span className="text-[rgba(232,234,230,0.72)] text-[13px]">Marketplace network</span>
                      </div>
                      <button
                        onClick={() => alert("Simulated push to Cars.co.za successful.")}
                        className="px-3 py-1.5 bg-[#2ecc71]/10 hover:bg-[#2ecc71]/20 text-[#2ecc71] text-[13px] font-bold rounded tracking-normal transition-all"
                      >
                        Publish
                      </button>
                    </div>

                    {/* Facebook Marketplace */}
                    <div className="bg-black/30 border border-white/5 rounded-lg p-3 flex justify-between items-center">
                      <div className="flex flex-col">
                        <span className="text-[#E8EAE6] text-xs font-bold">Facebook Marketplace</span>
                        <span className="text-[rgba(232,234,230,0.72)] text-[13px]">Social Commerce</span>
                      </div>
                      <button
                        onClick={() => alert("Simulated push to Facebook Marketplace successful.")}
                        className="px-3 py-1.5 bg-[#1877F2]/10 hover:bg-[#1877F2]/20 text-[#1877F2] text-[13px] font-bold rounded tracking-normal transition-all"
                      >
                        Publish
                      </button>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => alert("1-Click Bulk Syndicate completed. Inventory synced to all selected platforms.")}
                    className="w-full mt-2 py-2 bg-[#4FE3DC] hover:bg-opacity-90 text-[#E8EAE6] font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 tracking-normal"
                  >
                    <Send size={14} /> Syndicate to All Selected
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* MOBILE PHONE SIMULATOR HUB */}
          {showMobileSimulator && (
            <div className="bg-[#0B0F17]/90 border border-white/10 rounded-xl p-4 flex flex-col gap-3 mt-4 animate-fadeIn">
              <div className="flex justify-between items-center border-b border-white/5 pb-1.5">
                <div className="flex items-center gap-1 text-[#4FE3DC]">
                  <Smartphone size={12} />
                  <span className="text-[13px] font-semibold tracking-normal">TrueCar DMS Mobile Sync</span>
                </div>
                <button
                  onClick={() => setShowMobileSimulator(false)}
                  className="text-[rgba(232,234,230,0.72)] hover:text-[#E8EAE6] text-[13px] font-bold"
                >
                  Hide
                </button>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="bg-[#06080D] p-2 rounded-lg border border-white/5">
                  <QrCode size={40} className="text-[#4FE3DC]" />
                </div>
                <div className="flex-1">
                  <p className="text-[13px] text-[#E8EAE6] font-semibold">Virtual Mobile Phone Camera</p>
                  <p className="text-[12px] text-[rgba(232,234,230,0.72)] mt-0.5 leading-normal">
                    This vehicle is tagged as barcode **`[STK:${vehicle.stockNumber}]`**. Trigger a simulated camera snap below to push a live image into the database in real-time.
                  </p>
                </div>
              </div>

              {/* simulated phone camera view screen */}
              <div className="bg-[#06080D] border border-white/10 rounded-lg p-2.5 flex flex-col gap-2">
                <div className="flex justify-between items-center text-[12px] font-mono text-[rgba(232,234,230,0.72)]">
                  <span>● CAM FEED SECURE</span>
                  <span>100% SIGNAL</span>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  {getPresets().map((presetUrl, idx) => (
                    <button
                      key={idx}
                      onClick={() => triggerSimulatedMobileUpload(presetUrl)}
                      className="relative rounded-md overflow-hidden aspect-[16/10] group/preset cursor-pointer border border-white/5 hover:border-[#4FE3DC]"
                    >
                      <img src={presetUrl} alt="Preset view" className="w-full h-full object-cover group-hover/preset:scale-105 transition-transform" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/preset:opacity-100 transition-all">
                        <Camera size={16} className="text-[#E8EAE6]" />
                      </div>
                      <span className="absolute bottom-1 left-1.5 text-[12px] bg-black/60 px-1 py-0.5 rounded text-[#E8EAE6] font-bold  font-mono">
                        {idx === 0 ? "Front Exterior" : "Rear Angle"}
                      </span>
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => triggerSimulatedMobileUpload("https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&q=80&w=600")}
                  className="py-1.5 bg-[#4FE3DC]/10 border border-[#4FE3DC]/20 hover:bg-[#4FE3DC]/20 text-[#4FE3DC] rounded-md text-[12px] font-semibold tracking-normal text-center transition-all cursor-pointer"
                >
                  Snap Premium Interior Angle
                </button>
              </div>

              <div className="flex items-center gap-1 justify-center text-[12px] text-[rgba(232,234,230,0.72)] leading-none">
                <Zap size={8} className="text-[#4FE3DC]" /> Real phones will trigger the system camera natively!
              </div>
            </div>
          )}

          {/* System watermark footer */}
          <div className="text-[12px] text-[rgba(232,234,230,0.72)] font-mono tracking-wider  text-center mt-4">
            TrueCar Sandton operations node: Live Sync active
          </div>
        </div>
      </div>
    </div>
  );
}
