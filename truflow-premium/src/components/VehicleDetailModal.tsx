import React, { useState, useRef } from "react";
import { Vehicle } from "../types";
import { openTruLens } from "../lib/productConfig";
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
  Search,
  Loader2,
  MessageCircle,
  Linkedin,
  Instagram
} from "lucide-react";
import { authFetch } from "../lib/session";

interface SocialAccount {
  accountId: string;
  dealershipId: string;
  platform: string;
  username?: string;
  connectedAt: string;
}

interface VehicleDetailModalProps {
  /** Documents filed against this vehicle, rendered as its own tab. */
  documentsPanel?: React.ReactNode;
  vehicle: Vehicle;
  isOpen: boolean;
  onClose: () => void;
  onUpdateVehicle: (id: string, updates: Partial<Vehicle>) => Promise<void>;
  /** Remove the unit from stock. The owning screen does the checks and the
   *  confirming — this just asks for it. Optional, so the modal still renders
   *  for anywhere that shouldn't offer deletion. */
  onDeleteVehicle?: (id: string) => Promise<void>;
  /** Cancellation flow: put a sold unit back in stock (which re-lists it on the
   *  website) and reopen the deal that closed on it. Optional. */
  onReturnToStock?: (vehicle: Vehicle) => void | Promise<void>;
  settings?: any;
  dealershipId?: string;
}

export default function VehicleDetailModal({ vehicle, isOpen, onClose, onUpdateVehicle, onDeleteVehicle, onReturnToStock, settings, documentsPanel, dealershipId}: VehicleDetailModalProps) {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Social publish states
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([]);
  const [socialLoading, setSocialLoading] = useState(false);
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
  const [socialCaption, setSocialCaption] = useState("");
  const [socialPublishing, setSocialPublishing] = useState(false);
  const [socialResult, setSocialResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Elite DMS States
  const [activeTab, setActiveTab] = useState<"specs" | "inspection" | "recon" | "syndication" | "docs">("specs");
  const [newReconName, setNewReconName] = useState("");
  const [newReconCost, setNewReconCost] = useState("");

  // Recon Category, Photo and Market check States
  const [reconCategory, setReconCategory] = useState<string>("Bodywork / Painting");
  const [reconPhoto, setReconPhoto] = useState<string>("");
  const [suggestingCost, setSuggestingCost] = useState(false);
  const [editingTruPrice, setEditingTruPrice] = useState(false);
  const [truPriceInput, setTruPriceInput] = useState("");
  const [savingTruPrice, setSavingTruPrice] = useState(false);

  // TrueAI States
  const [tchekScanning, setTchekScanning] = useState(false);
  const [remarketingCopy, setRemarketingCopy] = useState<string>("");
  const [generatingCopy, setGeneratingCopy] = useState(false);

  // TrueAI Image Studio States
  const [selectedEnhanceImg, setSelectedEnhanceImg] = useState<string>("");

  if (!isOpen) return null;

  const formatZAR = (num: number) => {
    return "R " + Math.round(num).toLocaleString("en-ZA");
  };

  /* Every array a TruLens capture fills, not just `images`.
     mapAutoLensPhotos files the eight exterior slots into `images` and sorts
     everything else — interior, engine, detail and document shots — into
     extrasPhotos/damagePhotos/vinPhotos/serviceBookPhotos. This modal only
     ever read `images`, so a 22-photo capture rendered exactly 8 photos and a
     re-export that added interior shots looked like it had silently failed to
     sync. Each entry remembers which array it came from, so deleting one still
     targets the right index in the right field. */
  const GALLERY_FIELDS = [
    "images",
    "extrasPhotos",
    "damagePhotos",
    "vinPhotos",
    "serviceBookPhotos",
  ] as const;

  const galleryPhotos = GALLERY_FIELDS.flatMap((field) =>
    (((vehicle as any)[field] as string[] | undefined) ?? [])
      // Mapped before filtering so `index` stays the position in the source
      // array — that is what a delete has to write back against.
      .map((src, index) => ({ src, field, index }))
      // A walkaround is a data:video/… URI and cannot render in an <img>.
      .filter((p) => typeof p.src === "string" && p.src && !/^data:video\//i.test(p.src))
  );

  const photoCount = galleryPhotos.length;
  /* Mirrors what readState does on the server: a row that predates the flag is
     backfilled to true, so "not explicitly false" is genuinely published. The
     public feed itself tests === true. */
  const isPublished = vehicle.showOnWebsite !== false;
  const webReadyHint =
    photoCount >= 6
      ? { label: "Gallery ready for web", color: "var(--cyan)" }
      : { label: "Shoot in TruLens before publishing", color: "var(--warning)" };

  // Preset gorgeous South African vehicle snapshots for the phone camera simulator
  /** Save a TruPrice benchmark the dealer has worked out themselves.
   *  This replaced a "market crawler" that invented comparable listings and
   *  attributed them to real, named dealerships, then offered to reprice the
   *  car from those invented numbers. */
  const handleSaveTruPrice = async () => {
    const value = Number(truPriceInput.replace(/[^0-9]/g, ""));
    if (!value) return;
    setSavingTruPrice(true);
    await onUpdateVehicle(vehicle.id, { truPrice: value });
    setSavingTruPrice(false);
    setEditingTruPrice(false);
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

  const handleDeletePhoto = async (indexToDelete: number) => {
    // The gallery is a flattened view over several arrays, so a position in it
    // says nothing about where the photo actually lives. Resolve it first.
    const target = galleryPhotos[indexToDelete];
    if (!target) return;
    if (!confirm("Remove this image from showroom listing?")) return;
    const source = ((vehicle as any)[target.field] as string[] | undefined) || [];
    await onUpdateVehicle(vehicle.id, {
      [target.field]: source.filter((_, i) => i !== target.index),
    } as any);
    setActiveImageIndex(Math.max(0, indexToDelete - 1));
  };

  // Load connected social accounts when syndication tab opens
  const loadSocialAccounts = async () => {
    if (!dealershipId) return;
    setSocialLoading(true);
    try {
      const res = await authFetch(`/api/social/accounts?dealershipId=${encodeURIComponent(dealershipId)}`);
      if (res.ok) {
        const data = await res.json();
        setSocialAccounts(data.accounts || []);
      }
    } catch { /* best-effort */ }
    setSocialLoading(false);
  };

  const buildDefaultCaption = () =>
    `${vehicle.year} ${vehicle.make} ${vehicle.model} (${vehicle.transmission})\n` +
    `${vehicle.mileage.toLocaleString()} km · ${vehicle.fuelType}\n` +
    `R ${Math.round(vehicle.retailPrice).toLocaleString("en-ZA")}\n\n` +
    (vehicle.description ? vehicle.description + "\n\n" : "") +
    `Contact us to book a test-drive or secure this vehicle!`;

  const handleSocialPublish = async () => {
    if (!dealershipId || !selectedAccounts.size) return;
    setSocialPublishing(true);
    setSocialResult(null);
    try {
      const res = await authFetch("/api/social/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dealershipId,
          vehicleId: vehicle.id,
          caption: socialCaption,
          accountIds: Array.from(selectedAccounts),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Publish failed");
      setSocialResult({ ok: true, message: `Published to ${data.platforms?.join(", ") || "selected channels"}` });
      setSelectedAccounts(new Set());
    } catch (err: any) {
      setSocialResult({ ok: false, message: err?.message || "Publish failed" });
    }
    setSocialPublishing(false);
  };

  const handleWhatsAppShare = () => {
    const text = socialCaption || buildDefaultCaption();
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  // No stand-in photo. This fell back to a stock image of an unrelated car,
  // which the public feed then served as the vehicle's hero shot.
  const imagesList = galleryPhotos.map((p) => p.src);
  // Deleting the last photo, or a shorter capture replacing a longer one,
  // leaves the index past the end — which rendered an empty frame.
  const safeIndex = Math.min(activeImageIndex, Math.max(0, imagesList.length - 1));

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[250] p-4 overflow-y-auto">
      <div className="bg-[color:var(--ink)] border border-white/10 rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Product cut: capture lives in TruLens — Premium is gallery + publish */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-white/10 bg-[color:var(--ink)] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span
              className="text-[13px] font-semibold px-2 py-1 rounded border"
              style={{ color: webReadyHint.color, borderColor: webReadyHint.color + "55", background: webReadyHint.color + "18" }}
            >
              {webReadyHint.label}
            </span>
            <span className="text-[13px] text-[rgba(232,234,230,0.72)] truncate">
              {photoCount} gallery photo{photoCount === 1 ? "" : "s"} · stock media only (no in-DMS camera)
            </span>
          </div>
          {/* Publish / open-in-TruLens / remove regrouped into the footer at the
              bottom of the detail panel — the top bar is now just status. */}
        </div>

        <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden">
        {/* LEFT COLUMN: ACTIVE IMAGE VIEWER & GALLERY */}
        <div className="md:w-3/5 bg-black flex flex-col justify-between relative p-4 group">
          {/* Top Info Banner */}
          <div className="absolute top-4 left-4 z-10 bg-black/60 px-3 py-2 rounded-lg border border-white/10 backdrop-blur-md text-[13px] font-mono">
            {imagesList.length ? safeIndex + 1 : 0} of {imagesList.length} Photos
          </div>

          {/* Delete Action button if custom image */}
          {imagesList.length > 0 && (
            <button
              onClick={() => handleDeletePhoto(safeIndex)}
              className="absolute top-4 right-4 z-10 bg-[color:var(--glass)] hover:bg-[color:var(--ink-2)] text-[color:var(--white)] p-2 rounded-lg transition-all cursor-pointer shadow-md"
              title="Delete Photo"
            >
              <Trash2 size={14} />
            </button>
          )}

          {/* Core Display frame. On mobile the modal stacks (gallery over info),
              so cap the image to ~a third of the viewport and keep it contained —
              full-bleed is a desktop treatment. The info panel below then gets
              real room. */}
          <div className="flex items-center justify-center min-h-[120px] max-h-[24svh] md:flex-1 md:min-h-[300px] md:max-h-[480px]">
            <img
              src={imagesList[safeIndex]}
              alt={`${vehicle.make} ${vehicle.model}`}
              className="max-h-full max-w-full object-contain rounded-lg md:rounded-none"
            />
          </div>

          {/* Slide controls */}
          {imagesList.length > 1 && (
            <>
              <button
                onClick={() => setActiveImageIndex(safeIndex > 0 ? safeIndex - 1 : imagesList.length - 1)}
                className="tru-btn-secondary absolute left-4 top-1/2 -translate-y-1/2 h-11 w-11 flex items-center justify-center cursor-pointer"
                title="Previous photo"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setActiveImageIndex(safeIndex < imagesList.length - 1 ? safeIndex + 1 : 0)}
                className="tru-btn-secondary absolute right-4 top-1/2 -translate-y-1/2 h-11 w-11 flex items-center justify-center cursor-pointer"
                title="Next photo"
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
                className={`w-16 h-12 rounded-[10px] overflow-hidden transition-all flex-shrink-0 cursor-pointer ${
                  idx === safeIndex ? "ring-2 ring-[color:var(--cyan)]" : "opacity-60 hover:opacity-100"
                }`}
              >
                <img src={img} alt="Thumb" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>

        {/* RIGHT COLUMN: DETAIL SPECS, INSPECTION & RECON TABS */}
        <div className="md:w-2/5 max-md:flex-1 max-md:min-h-0 p-4 md:p-6 flex flex-col justify-between overflow-y-auto border-t md:border-t-0 md:border-l border-white/10">
          <div>
            {/* Header */}
            <div className="flex justify-between items-start border-b border-white/5 pb-3 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-[color:var(--white)] leading-tight">{vehicle.year} {vehicle.make} {vehicle.model}</h3>
                <p className="text-[13px] text-[rgba(232,234,230,0.72)] mt-0.5">
                  {vehicle.trim || "Standard Trim Specs"} · <span className="font-mono text-[rgba(232,234,230,0.55)]">{vehicle.stockNumber}</span>
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {onReturnToStock && vehicle.status === "SOLD" && (
                  <button
                    onClick={() => onReturnToStock(vehicle)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[color:var(--glass-line)] bg-[color:var(--glass)] text-[color:var(--cyan)] hover:text-[color:var(--white)] text-[13px] font-semibold transition-colors cursor-pointer"
                    title="Cancellation — put this car back in stock and reopen the deal"
                  >
                    <RefreshCw size={14} />
                    Return to stock
                  </button>
                )}
                {/* Remove moved to the footer — it no longer sits next to the
                    close X in near-identical styling. */}
                <button aria-label="Close"
                  onClick={onClose}
                  className="text-[rgba(232,234,230,0.72)] hover:text-[color:var(--white)] p-1 rounded-lg transition-all cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Underlined tab row. A segmented control whose active segment is a
                filled cyan key makes the loudest object in the panel a label for
                where you already are; underlining it frees the cyan for Publish. */}
            <div className="flex gap-2 border-b border-white/10 mb-3 text-[13px] font-semibold overflow-x-auto scrollbar-thin">
              <button
                onClick={() => setActiveTab("specs")}
                className={`px-3 py-2 flex items-center justify-center gap-1 border-b-2 -mb-px whitespace-nowrap transition-colors cursor-pointer ${
                  activeTab === "specs" ? "text-[color:var(--white)] border-[color:var(--cyan)]" : "text-[rgba(232,234,230,0.72)] border-transparent hover:text-[color:var(--white)]"
                }`}
              >
                <Grid size={11} /> Specs
              </button>
              <button
                onClick={() => setActiveTab("docs")}
                className={`px-3 py-2 flex items-center justify-center gap-1 border-b-2 -mb-px whitespace-nowrap transition-colors cursor-pointer ${
                  activeTab === "docs" ? "text-[color:var(--white)] border-[color:var(--cyan)]" : "text-[rgba(232,234,230,0.72)] border-transparent hover:text-[color:var(--white)]"
                }`}
              >
                <FileText size={11} /> Docs
              </button>
              <button
                onClick={() => setActiveTab("inspection")}
                className={`px-3 py-2 flex items-center justify-center gap-1 border-b-2 -mb-px whitespace-nowrap transition-colors cursor-pointer ${
                  activeTab === "inspection" ? "text-[color:var(--white)] border-[color:var(--cyan)]" : "text-[rgba(232,234,230,0.72)] border-transparent hover:text-[color:var(--white)]"
                }`}
              >
                <Sparkles size={11} /> Assist
              </button>
              <button
                onClick={() => setActiveTab("recon")}
                className={`px-3 py-2 flex items-center justify-center gap-1 border-b-2 -mb-px whitespace-nowrap transition-colors cursor-pointer ${
                  activeTab === "recon" ? "text-[color:var(--white)] border-[color:var(--cyan)]" : "text-[rgba(232,234,230,0.72)] border-transparent hover:text-[color:var(--white)]"
                }`}
              >
                <Wrench size={11} /> Recon
              </button>
              {settings?.syndication && (
                <button
                  onClick={() => setActiveTab("syndication")}
                  className={`px-3 py-2 flex items-center justify-center gap-1 border-b-2 -mb-px whitespace-nowrap transition-colors cursor-pointer ${
                    activeTab === "syndication" ? "text-[color:var(--white)] border-[color:var(--cyan)]" : "text-[rgba(232,234,230,0.72)] border-transparent hover:text-[color:var(--white)]"
                  }`}
                >
                  <Share2 size={11} /> Feed
                </button>
              )}
            </div>

            {/* TAB 1: SHOWROOM SPECIFICATIONS */}
            {activeTab === "specs" && (
              <div className="space-y-4 animate-in fade-in duration-200">
                {/* Quick Pricing & Market Intelligence Widget */}
                <div className="bg-[color:var(--glass)] border border-white/5 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[length:var(--t-micro)] font-mono text-[color:var(--muted)] tracking-wider">Retail</span>
                      <div className="text-[32px] leading-none font-semibold text-[color:var(--white)] font-mono mt-1">{formatZAR(vehicle.retailPrice)}</div>
                      {vehicle.truPrice ? (
                        <div className="text-[13px] font-semibold mt-2" style={{ color: vehicle.truPrice > vehicle.retailPrice ? "var(--cyan)" : "rgba(232,234,230,0.72)" }}>
                          TruPrice {formatZAR(vehicle.truPrice)}
                          {vehicle.truPrice > vehicle.retailPrice
                            ? ` · ${formatZAR(vehicle.truPrice - vehicle.retailPrice)} below market`
                            : " · at or above market"}
                        </div>
                      ) : (
                        <div className="text-[13px] text-[rgba(232,234,230,0.72)]/60 mt-1">No TruPrice benchmark set</div>
                      )}
                    </div>
                    <button
                      onClick={() => { setTruPriceInput(String(vehicle.truPrice || vehicle.retailPrice || "")); setEditingTruPrice(true); }}
                      className="tru-btn-ghost px-3 min-h-[36px] text-[13px] cursor-pointer shrink-0"
                    >
                      {vehicle.truPrice ? "Edit TruPrice" : "Set TruPrice"}
                    </button>
                  </div>

                  {editingTruPrice && (
                    <div className="bg-black/30 border border-white/10 rounded-lg p-3 space-y-2">
                      <label className="text-[13px] text-[rgba(232,234,230,0.72)]  font-semibold tracking-wider block">
                        TruPrice benchmark
                      </label>
                      <p className="text-[13px] text-[rgba(232,234,230,0.72)] leading-relaxed">
                        What this vehicle is genuinely worth on the open market, from your own
                        trade experience or book value. Shown on the website as the price
                        customers are compared against — so it only carries weight if it is real.
                      </p>
                      <input
                        type="text"
                        inputMode="numeric"
                        autoFocus
                        value={truPriceInput}
                        onChange={(e) => setTruPriceInput(e.target.value)}
                        placeholder="e.g. 389000"
                        className="w-full bg-[color:var(--ink)] border border-white/15 rounded-lg px-3 py-2 text-[16px] text-[color:var(--white)] font-mono outline-none focus:border-[color:var(--cyan)]"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveTruPrice}
                          disabled={savingTruPrice}
                          className="tru-btn-secondary flex-1 py-2 text-[13px] cursor-pointer disabled:opacity-60"
                        >
                          {savingTruPrice ? "Saving…" : "Save benchmark"}
                        </button>
                        <button
                          onClick={() => setEditingTruPrice(false)}
                          className="tru-btn-ghost px-3 py-2 text-[13px] cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Showroom Category */}
                <div className="bg-[color:var(--glass)] border border-white/5 rounded-xl p-4 space-y-2">
                  <span className="text-[13px] text-[rgba(232,234,230,0.72)] font-semibold tracking-wider">Showroom Category</span>
                  <select
                    value={vehicle.category || ""}
                    onChange={(e) => {
                      const val = e.target.value as Vehicle["category"] | "";
                      onUpdateVehicle(vehicle.id, { category: val || undefined } as Partial<Vehicle>);
                    }}
                    className="w-full bg-[color:var(--ink)] border border-white/15 rounded-lg px-3 py-2 text-[13px] text-[color:var(--white)] outline-none focus:border-[color:var(--cyan)]"
                  >
                    <option value="">Used (default)</option>
                    <option value="used">Premium Used</option>
                    <option value="select">Premium Select</option>
                    <option value="performance">Premium Performance</option>
                  </select>
                  <p className="text-[length:var(--t-micro)] text-[rgba(232,234,230,0.45)]">Controls which category page this vehicle appears on the website.</p>
                </div>

                {/* Spec matrix — 12px mono label over a 15px value, so label and
                    value no longer read at equal weight. */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <div className="flex flex-col">
                    <span className="text-[length:var(--t-micro)] font-mono text-[color:var(--muted)]">Mileage</span>
                    <span className="text-[15px] font-medium text-[color:var(--white)] mt-0.5">{vehicle.mileage.toLocaleString()} km</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[length:var(--t-micro)] font-mono text-[color:var(--muted)]">Transmission</span>
                    <span className="text-[15px] font-medium text-[color:var(--white)] mt-0.5">{vehicle.transmission}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[length:var(--t-micro)] font-mono text-[color:var(--muted)]">Fuel</span>
                    <span className="text-[15px] font-medium text-[color:var(--white)] mt-0.5">{vehicle.fuelType}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[length:var(--t-micro)] font-mono text-[color:var(--muted)]">Body style</span>
                    <span className="text-[15px] font-medium text-[color:var(--white)] mt-0.5">{vehicle.bodyType || "Utility"}</span>
                  </div>
                  <div className="flex flex-col col-span-2">
                    <span className="text-[length:var(--t-micro)] font-mono text-[color:var(--muted)]">Engine</span>
                    <span className="text-[15px] font-medium text-[color:var(--white)] mt-0.5">{vehicle.engine || "N/A"}</span>
                  </div>
                </div>

                {/* Description scrollbox */}
                <div className="text-[13px] text-[rgba(232,234,230,0.72)] leading-relaxed border-t border-b border-white/5 py-3 max-h-24 overflow-y-auto">
                  <span className="font-semibold text-[color:var(--white)] block mb-0.5">Dealer Comments:</span>
                  {vehicle.description || "No comments entered."}
                </div>

                {/* MEDIA SYNC CONTROLS */}
                <div className="flex flex-col gap-3 pt-1">
                  <h4 className="text-[13px] font-semibold text-[color:var(--white)] tracking-normal flex items-center gap-2">
                    <Layers size={14} className="text-[color:var(--cyan)]" />
                    Media Sync Station
                  </h4>

                  {/* Direct local file selector */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="tru-btn-secondary flex-1 py-2 text-[13px] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <Upload size={13} /> {uploading ? "Uploading…" : "Add photos"}
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

            {activeTab === "docs" && (
              <div className="space-y-4 animate-in fade-in duration-200">
                {documentsPanel}
              </div>
            )}

            {/* TAB 3: TRUEAI COMPUTER VISION INSPECTION & REMARKETING */}
            {activeTab === "inspection" && (
              <div className="space-y-4 animate-in fade-in duration-200">
                {/* Removed from here: a "TrueAI Vision Platform" that reported the
                    same invented damage on every vehicle ("Rear Left Fender Wheel
                    Arch Scratch, Severity MEDIUM, Est. Repair R 2,200") and could
                    push it into the recon ledger as a real cost; and a "Studio
                    Backdrop Enhancer" that narrated silhouette masking and then
                    swapped in a stock photo of a different car of the same make.
                    Damage assessment belongs to TruLens/TruInspect, working on
                    real photos. What is left is text generation — which is all
                    this ever genuinely did. */}
                <div className="bg-[color:var(--glass)] border border-white/5 rounded-xl p-4 flex flex-col gap-3">
                  <div className="border-b border-white/5 pb-2">
                    <h4 className="text-[13px] font-semibold text-[color:var(--white)] tracking-normal">Listing text</h4>
                    <p className="text-[13px] text-[rgba(232,234,230,0.72)] mt-0.5">
                      Starting points for adverts and page copy — read them over before publishing.
                    </p>
                  </div>
                        {/* TrueAI Copywriter Generator */}
                        <div className="bg-black/20 border border-white/5 rounded-xl p-3 flex flex-col gap-2">
                          <div className="flex items-center gap-2 text-[13px] text-[color:var(--white)] font-semibold">
                            <Sparkles size={12} className="text-[color:var(--cyan)]" />
                            Advert copy
                          </div>
                          
                          {generatingCopy ? (
                            <div className="py-3 flex justify-center items-center gap-2 text-[13px] text-[rgba(232,234,230,0.72)] font-mono">
                              <RefreshCw size={12} className="animate-spin text-[color:var(--cyan)]" /> Creating listing copy...
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
                                  className="flex-1 py-2 bg-[color:var(--glass)] border border-white/5 text-[rgba(232,234,230,0.72)] hover:text-[color:var(--white)] font-semibold text-[13px] rounded-lg cursor-pointer transition-all "
                                >
                                  Copy Copywriting Text
                                </button>
                                <button
                                  onClick={() => setRemarketingCopy("")}
                                  className="px-3 py-2 bg-[color:var(--glass)] border border-white/5 text-[color:var(--muted)] hover:bg-[color:var(--glass)] font-semibold text-[13px] rounded-lg cursor-pointer transition-all "
                                >
                                  Clear
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                // Built from the vehicle record, instantly. The
                                // spinner here only ever simulated thinking.
                                setRemarketingCopy(
                                    `🔥 JUST ARRIVED IN SHOWROOM! 🔥\n\n` +
                                    `🌟 ${vehicle.year} ${vehicle.make.toUpperCase()} ${vehicle.model.toUpperCase()} (${vehicle.transmission})\n` +
                                    `📍 Mileage: ${vehicle.mileage.toLocaleString()} km\n` +
                                    `⛽ Fuel Type: ${vehicle.fuelType}\n` +
                                    `💰 Price: ${formatZAR(vehicle.retailPrice)}\n\n` +
                                    // Claims the dealer can stand behind. This previously asserted
                                    // "NATIS Fully Checked & Cleared" and a "TrueAI quality
                                    // certificate" in copy meant for public adverts — neither had
                                    // happened, and the dealer would have been the one publishing it.
                                    `✨ Well looked after and ready to drive away.\n\n` +
                                    `📞 Contact us now to secure or book a test-drive. Finance options available!`
                                );
                              }}
                              className="w-full py-2 bg-[color:var(--cyan)] hover:bg-opacity-90 text-[13px] on-fill font-semibold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
                            >
                              <FileText size={13} /> Build advert text
                            </button>
                          )}
                        </div>

                        {settings?.seoAeo && (
                          <div className="bg-black/20 border border-white/5 rounded-xl p-3 flex flex-col gap-2 mt-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-[13px] text-[color:var(--white)] font-semibold">
                                <Globe size={12} className="text-[color:var(--cyan)]" />
                                Page title & description
                              </div>
                              <span className="bg-[color:var(--cyan-faint)] text-[color:var(--cyan)] text-[13px] font-semibold px-2 py-0.5 rounded">AUTO-RANK</span>
                            </div>
                            <button
                              onClick={() => {
                                alert("Generated Meta Title:\n" + `${vehicle.year} ${vehicle.make} ${vehicle.model} for Sale | Approved Dealer\n\n` + 
                                      "Generated SEO Description:\n" + `Looking for a pristine ${vehicle.year} ${vehicle.make} ${vehicle.model}? This ${vehicle.bodyType || 'vehicle'} offers incredible value at ${formatZAR(vehicle.retailPrice)}. Fully inspected and approved.`);
                              }}
                              className="w-full py-2 bg-[color:var(--glass)] hover:bg-white/10 border border-white/10 text-[13px] text-[rgba(232,234,230,0.72)] hover:text-[color:var(--white)] font-semibold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
                            >
                              <Search size={13} /> Generate SEO Tags & Description
                            </button>
                          </div>
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

                  /** Typical recon costs by category — a table, not a model.
                   *  It was fronted by an "Assessing..." spinner and called an
                   *  AI recommendation. The numbers are the useful part. */
                  const handleAICostRecommendation = () => {
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
                  };

                  /** Attach a real photo of the work. This used to pick a stock
                   *  workshop image by category and report "TrueAI Prep Camera
                   *  Synced" — filing a photograph of someone else's garage as
                   *  evidence of work done on this car. */
                  const attachReconPhoto = (file?: File) => {
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => setReconPhoto(reader.result as string);
                    reader.readAsDataURL(file);
                  };

                  return (
                    <div className="space-y-4">
                      {/* Financial outline */}
                      <div className="bg-[color:var(--ink-2)] border border-white/5 rounded-xl p-3 grid grid-cols-3 gap-2 text-[13px] font-mono">
                        <div>
                          <div className="text-[13px] text-[rgba(232,234,230,0.72)]  font-semibold">Total Recon Spend</div>
                          <div className="text-[color:var(--white)] font-semibold mt-0.5">{formatZAR(totalReconCost)}</div>
                        </div>
                        <div className="border-l border-white/5 pl-2">
                          <div className="text-[13px] text-[rgba(232,234,230,0.72)]  font-semibold">Adjusted Cost</div>
                          <div className="text-[color:var(--cyan)] font-semibold mt-0.5">{formatZAR(adjustedCostBasis)}</div>
                        </div>
                        <div className="border-l border-white/5 pl-2">
                          <div className="text-[13px] text-[rgba(232,234,230,0.72)]  font-semibold">Expected Margin</div>
                          <div className={`font-semibold mt-0.5 ${isBelowTarget ? "text-[color:var(--muted)]" : "text-[color:var(--cyan)]"}`}>
                            {formatZAR(profit)} ({marginPercent.toFixed(1)}%)
                          </div>
                        </div>
                      </div>

                      {/* Profitability Warning Alert with Quick Price Adjust */}
                      {isBelowTarget && (
                        <div className="bg-[color:var(--glass)] border border-[color:var(--glass-line)] rounded-xl p-3 flex flex-col gap-2 animate-pulse-subtle">
                          <div className="flex items-start gap-2 text-[13px] text-[color:var(--muted)]">
                            <AlertCircle size={15} className="mt-0.5 shrink-0" />
                            <div>
                              <span className="font-semibold block">Profitability Target Violation</span>
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
                            className="w-full py-2 bg-[color:var(--glass)] hover:bg-[color:var(--glass)] text-[color:var(--muted)] font-semibold text-[13px] rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 "
                          >
                            <Zap size={10} /> Quick Adjust Price to {formatZAR(suggestedHealthyPrice)} (15% Margin)
                          </button>
                        </div>
                      )}

                      {/* List of current recon tasks */}
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {tasks.length === 0 ? (
                          <div className="text-center py-4 text-[13px] text-[rgba(232,234,230,0.72)] border border-dashed border-white/5 rounded-lg">
                            No reconditioning items registered. Use the tool below to estimate and log pre-sale prep.
                          </div>
                        ) : (
                          tasks.map((task) => (
                            <div key={task.id} className="bg-black/30 border border-[color:var(--cyan-faint)] rounded-lg p-3 flex justify-between items-center text-[13px]">
                              <div className="flex items-center gap-3">
                                {task.photo ? (
                                  <div className="relative w-10 h-10 rounded overflow-hidden border border-white/5 shrink-0">
                                    <img src={task.photo} alt={task.name} className="w-full h-full object-cover" />
                                    <span className="absolute bottom-0 right-0 bg-black/70 text-[length:var(--t-micro)] text-[color:var(--cyan)] px-0.5 font-semibold font-mono">IMG</span>
                                  </div>
                                ) : (
                                  <div className="w-10 h-10 rounded bg-[color:var(--glass)] border border-dashed border-white/10 flex items-center justify-center text-gray-400 shrink-0">
                                    <Camera size={12} />
                                  </div>
                                )}
                                <div>
                                  <span className={`font-semibold ${task.status === "Completed" ? "line-through text-[rgba(232,234,230,0.72)]" : "text-[color:var(--white)]"}`}>
                                    {task.name}
                                  </span>
                                  <div className="text-[13px] text-[rgba(232,234,230,0.72)] mt-0.5 flex items-center gap-2 font-mono">
                                    <span className="bg-[color:var(--glass)] px-1 py-0.2 rounded text-[13px]  font-sans">{task.category || "General"}</span>
                                    <span>Cost: {formatZAR(task.cost)}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleToggleTaskStatus(task.id)}
                                  className={`px-2 py-0.5 rounded text-[13px] font-semibold  cursor-pointer ${
                                    task.status === "Completed" ? "bg-[color:var(--cyan-faint)] text-[color:var(--cyan)]" : "bg-[color:var(--cyan-faint)] text-[color:var(--cyan-bright)]"
                                  }`}
                                >
                                  {task.status === "Completed" ? "Completed" : "In Progress"}
                                </button>
                                <button
                                  onClick={() => handleDeleteTask(task.id)}
                                  className="p-1 hover:bg-white/5 text-[rgba(232,234,230,0.72)] hover:text-[color:var(--muted)] rounded cursor-pointer transition-all"
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
                      <form onSubmit={handleAddTask} className="bg-[color:var(--glass)] border border-white/5 rounded-xl p-3 space-y-3">
                        <div className="flex justify-between items-center">
                          <div className="text-[13px] text-[color:var(--white)] font-semibold tracking-normal">Log Work Directive & Prep Tasks</div>
                          <span className="text-[13px] text-[rgba(232,234,230,0.72)] font-mono">1-CLICK AI ASSISTANT</span>
                        </div>

                        {/* Category and AI cost recommend row */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[13px] text-[rgba(232,234,230,0.72)]  font-semibold">Task Category</label>
                            <select
                              value={reconCategory}
                              onChange={(e) => setReconCategory(e.target.value)}
                              className="w-full bg-black/40 border border-white/5 rounded px-2 py-1 text-[13px] text-[color:var(--white)] outline-none"
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
                              className="w-full py-1 bg-[color:var(--cyan-faint)] border border-[color:var(--cyan-soft)] hover:bg-[color:var(--cyan-faint)] text-[color:var(--cyan)] text-[13px] font-semibold tracking-normal rounded transition-all cursor-pointer flex items-center justify-center gap-1 disabled:opacity-50 h-[24px]"
                            >
                              <Sparkles size={9} /> Typical cost
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-5 gap-2">
                          <input
                            type="text"
                            placeholder="Describe precise repair task..."
                            value={newReconName}
                            onChange={(e) => setNewReconName(e.target.value)}
                            className="col-span-3 bg-black/40 border border-white/5 rounded px-2 py-1 text-[13px] text-[color:var(--white)] outline-none"
                          />
                          <input
                            type="number"
                            placeholder="ZAR Cost"
                            value={newReconCost}
                            onChange={(e) => setNewReconCost(e.target.value)}
                            className="col-span-2 bg-black/40 border border-white/5 rounded px-2 py-1 text-[13px] text-[color:var(--white)] outline-none font-mono"
                          />
                        </div>

                        {/* Photo capture mock/real sync row */}
                        <div className="bg-black/20 p-2 rounded-lg border border-white/3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {reconPhoto ? (
                              <img src={reconPhoto} alt="Selected attachment" className="w-8 h-8 rounded object-cover border border-[color:var(--cyan-soft)]" />
                            ) : (
                              <div className="w-8 h-8 rounded bg-[color:var(--glass)] flex items-center justify-center text-[rgba(232,234,230,0.72)]">
                                <Camera size={12} />
                              </div>
                            )}
                            <div>
                              <span className="text-[13px] font-semibold text-[color:var(--white)] block">Task Damage Photo</span>
                              <span className="text-[13px] text-[rgba(232,234,230,0.72)] block">{reconPhoto ? "Photo Attached" : "None attached"}</span>
                            </div>
                          </div>
                          
                          <div className="flex gap-2">
                            <label className="px-2 py-1 bg-[color:var(--glass)] hover:bg-white/10 border border-white/5 text-[color:var(--white)] rounded text-[13px] font-semibold  transition-all cursor-pointer">
                              Attach photo
                              <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                className="hidden"
                                onChange={(e) => attachReconPhoto(e.target.files?.[0])}
                              />
                            </label>
                          </div>
                        </div>

                        <button
                          type="submit"
                          className="w-full py-2 bg-[color:var(--cyan)] hover:bg-opacity-90 on-fill font-semibold text-[13px] rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 "
                        >
                          <Plus size={11} /> Save & Log Prep Directive
                        </button>
                      </form>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* TAB 5: SOCIAL PUBLISH */}
            {activeTab === "syndication" && settings?.syndication && (() => {
              const PLATFORM_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
                facebook:          { label: "Facebook",         icon: <Facebook size={14} />,       color: "#1877F2" },
                instagram:         { label: "Instagram",        icon: <Instagram size={14} />,      color: "#E4405F" },
                "google-business": { label: "Google Business",  icon: <Globe size={14} />,          color: "#4285F4" },
                linkedin:          { label: "LinkedIn",         icon: <Linkedin size={14} />,       color: "#0A66C2" },
              };

              // Load accounts on first render of this tab
              if (!socialLoading && socialAccounts.length === 0 && dealershipId && settings?.truSocial) {
                loadSocialAccounts();
                if (!socialCaption) setSocialCaption(buildDefaultCaption());
              }

              const toggleAccount = (id: string) => {
                setSelectedAccounts((prev) => {
                  const next = new Set(prev);
                  next.has(id) ? next.delete(id) : next.add(id);
                  return next;
                });
              };

              return (
              <div className="space-y-4 animate-in fade-in duration-200">
                {/* Caption */}
                <div className="bg-[color:var(--ink-2)] border border-white/5 rounded-xl p-4 flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <Share2 size={14} className="text-[color:var(--cyan)]" />
                    <h4 className="text-[13px] font-semibold text-[color:var(--white)] tracking-normal">Social post</h4>
                  </div>
                  <textarea
                    value={socialCaption}
                    onChange={(e) => setSocialCaption(e.target.value)}
                    placeholder="Write your social caption..."
                    rows={5}
                    className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-[13px] text-[rgba(232,234,230,0.85)] placeholder:text-[rgba(232,234,230,0.35)] outline-none resize-none leading-relaxed focus:border-[color:var(--cyan-soft)] transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setSocialCaption(buildDefaultCaption())}
                    className="self-start px-3 py-1.5 text-[13px] text-[color:var(--muted)] hover:text-[color:var(--white)] bg-[color:var(--glass)] border border-[color:var(--glass-line)] rounded-lg transition-colors cursor-pointer"
                  >
                    <RefreshCw size={11} className="inline mr-1.5 -mt-px" />
                    Reset to default
                  </button>
                </div>

                {/* Connected channels via Zernio */}
                {settings?.truSocial && dealershipId && (
                  <div className="bg-[color:var(--ink-2)] border border-white/5 rounded-xl p-4 flex flex-col gap-3">
                    <h4 className="text-[13px] font-semibold text-[color:var(--white)] tracking-normal">Publish to connected channels</h4>

                    {socialLoading ? (
                      <div className="flex items-center gap-2 py-3 text-[13px] text-[rgba(232,234,230,0.55)]">
                        <Loader2 size={13} className="animate-spin" /> Loading accounts...
                      </div>
                    ) : socialAccounts.length === 0 ? (
                      <p className="text-[13px] text-[rgba(232,234,230,0.55)] py-2">
                        No social accounts connected. Go to Settings &rarr; TruSocial to connect.
                      </p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {socialAccounts.map((acc) => {
                          const meta = PLATFORM_META[acc.platform] || { label: acc.platform, icon: <Globe size={14} />, color: "var(--cyan)" };
                          const selected = selectedAccounts.has(acc.accountId);
                          return (
                            <button
                              key={acc.accountId}
                              type="button"
                              onClick={() => toggleAccount(acc.accountId)}
                              className={
                                "flex items-center gap-3 rounded-lg border p-3 transition-all cursor-pointer text-left " +
                                (selected
                                  ? "border-[color:var(--cyan-soft)] bg-[color:var(--cyan-faint)]"
                                  : "border-white/5 bg-black/20 hover:border-white/15")
                              }
                            >
                              <div
                                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                style={{ background: meta.color + "20", color: meta.color }}
                              >
                                {meta.icon}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-[13px] font-semibold text-[color:var(--white)]">{meta.label}</div>
                                {acc.username && (
                                  <div className="text-[13px] text-[rgba(232,234,230,0.55)] truncate">@{acc.username}</div>
                                )}
                              </div>
                              <div className={
                                "w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors " +
                                (selected
                                  ? "border-[color:var(--cyan)] bg-[color:var(--cyan)]"
                                  : "border-white/20")
                              }>
                                {selected && <Check size={12} className="text-[color:var(--ink)]" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Publish button */}
                    {socialAccounts.length > 0 && (
                      <button
                        type="button"
                        disabled={socialPublishing || !selectedAccounts.size || !socialCaption.trim()}
                        onClick={handleSocialPublish}
                        className="w-full py-2.5 bg-[color:var(--cyan)] hover:bg-opacity-90 on-fill font-semibold text-[13px] rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {socialPublishing ? (
                          <><Loader2 size={13} className="animate-spin" /> Publishing...</>
                        ) : (
                          <><Send size={13} /> Publish to {selectedAccounts.size || ""} selected</>
                        )}
                      </button>
                    )}

                    {socialResult && (
                      <div className={
                        "text-[13px] px-3 py-2 rounded-lg border " +
                        (socialResult.ok
                          ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                          : "text-red-400 bg-red-500/10 border-red-500/20")
                      }>
                        {socialResult.message}
                      </div>
                    )}
                  </div>
                )}

                {/* Quick share — always available, no Zernio needed */}
                <div className="bg-[color:var(--ink-2)] border border-white/5 rounded-xl p-4 flex flex-col gap-3">
                  <h4 className="text-[13px] font-semibold text-[color:var(--white)] tracking-normal">Quick share</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleWhatsAppShare}
                      className="flex items-center justify-center gap-2 py-2.5 rounded-lg border border-white/5 bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 text-[13px] font-semibold transition-colors cursor-pointer"
                    >
                      <MessageCircle size={14} /> WhatsApp
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(socialCaption || buildDefaultCaption());
                        setSocialResult({ ok: true, message: "Caption copied to clipboard" });
                      }}
                      className="flex items-center justify-center gap-2 py-2.5 rounded-lg border border-white/5 bg-[color:var(--glass)] text-[color:var(--muted)] hover:text-[color:var(--white)] text-[13px] font-semibold transition-colors cursor-pointer"
                    >
                      <FileText size={14} /> Copy caption
                    </button>
                  </div>
                </div>

                {/* Marketplace (coming soon) */}
                <div className="bg-[color:var(--ink-2)] border border-white/5 rounded-xl p-4 flex flex-col gap-3 opacity-50">
                  <h4 className="text-[13px] font-semibold text-[color:var(--white)] tracking-normal">Marketplace syndication</h4>
                  <p className="text-[13px] text-[rgba(232,234,230,0.55)]">AutoTrader SA, Cars.co.za — coming soon</p>
                </div>
              </div>
              );
            })()}
          </div>

          {/* Footer — the one action that leaves the modal (Publish) over the two
              exits. Remove is a destructive ghost here, no longer beside the X. */}
          <div className="shrink-0 pt-3 mt-3 border-t border-white/10 flex flex-col gap-2">
            <button
              type="button"
              disabled={publishing}
              onClick={async () => {
                setPublishing(true);
                try {
                  await onUpdateVehicle(vehicle.id, { showOnWebsite: !isPublished } as Partial<Vehicle>);
                } finally {
                  setPublishing(false);
                }
              }}
              title={isPublished ? "Remove this vehicle from the dealer website feed" : "Show this vehicle on the dealer website"}
              className={
                "w-full min-h-[44px] inline-flex items-center justify-center gap-2 text-[14px] cursor-pointer disabled:opacity-50 " +
                (isPublished ? "tru-btn-secondary" : "btn-primary on-fill")
              }
            >
              <Globe size={14} />
              {publishing ? "Saving…" : isPublished ? "On website — tap to unpublish" : "Publish to website"}
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => openTruLens(vehicle.stockNumber)}
                className="tru-btn-ghost min-h-[44px] inline-flex items-center justify-center gap-2 text-[13px] cursor-pointer"
              >
                <Camera size={14} /> Open in TruLens
              </button>
              {onDeleteVehicle && (
                <button
                  type="button"
                  onClick={() => onDeleteVehicle(vehicle.id)}
                  title="Remove this unit from stock"
                  className="min-h-[44px] inline-flex items-center justify-center gap-2 text-[13px] rounded-[10px] text-[rgba(184,106,106,0.85)] hover:text-[#C07676] hover:bg-[rgba(184,106,106,0.14)] cursor-pointer transition-colors"
                >
                  <Trash2 size={14} /> Remove from stock
                </button>
              )}
            </div>
          </div>
        </div>
        </div>{/* end md:flex row */}
      </div>
    </div>
  );
}
