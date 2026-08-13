import React, { useState, useRef } from "react";
import { Vehicle } from "../types";
import { openTruLens } from "../lib/productConfig";
import { openStockWhatsApp } from "../lib/salesShare";
import {
  X,
  Camera,
  Upload,
  Smartphone,
  Check,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  QrCode,
  Zap,
  Grid,
  Shield,
  Wrench,
  AlertCircle,
  FileText,
  RefreshCw,
  Layers,
  Plus,
  CheckCircle2,
  Share2,
  Facebook,
  Globe,
  Send,
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
  /** True only when this dealership has the `social` product AND TruSocial is
   *  switched on. Gates the Publish tab: publishing goes to OAuth-connected
   *  accounts, so offering it to a dealer with no connections would only ever
   *  fail — the tab is omitted entirely instead. */
  truSocialEnabled?: boolean;
  hasLens?: boolean;
}

export default function VehicleDetailModal({ vehicle, isOpen, onClose, onUpdateVehicle, onDeleteVehicle, onReturnToStock, settings, documentsPanel, dealershipId, truSocialEnabled, hasLens = true}: VehicleDetailModalProps) {
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
  const [activeTab, setActiveTab] = useState<"specs" | "recon" | "publish" | "docs">("specs");
  const [newReconName, setNewReconName] = useState("");
  const [newReconCost, setNewReconCost] = useState("");

  // Recon Category and Market check States
  const [reconCategory, setReconCategory] = useState<string>("Bodywork / Painting");
  const [editingTruPrice, setEditingTruPrice] = useState(false);
  const [truPriceInput, setTruPriceInput] = useState("");
  const [savingTruPrice, setSavingTruPrice] = useState(false);

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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[250] p-0 md:p-4 overflow-y-auto">
      {/* Full-bleed on mobile (edge-to-edge, full height) so the sheet uses the
          whole screen instead of a narrow card inside a scrim; a framed card
          from md up. */}
      <div className="bg-[color:var(--ink)] border-0 md:border border-white/10 rounded-none md:rounded-2xl w-full max-w-none md:max-w-5xl shadow-2xl overflow-hidden flex flex-col h-[100dvh] md:h-auto max-h-[100dvh] md:max-h-[90vh]">
        {/* Title bar — desktop only. On mobile the name/back/pill/counter are
            overlaid on the photo header below (hidden md:flex). */}
        <div className="hidden md:flex items-center justify-between gap-3 px-5 py-3.5 border-b border-white/10 bg-[color:var(--ink)] shrink-0">
          <div className="flex items-baseline gap-2 min-w-0">
            <h3 className="text-[18px] font-semibold text-[color:var(--white)] leading-tight truncate">
              {vehicle.year} {vehicle.make} {vehicle.model}
            </h3>
            <span className="text-[13px] text-[color:var(--white-dim)] truncate">{vehicle.trim || "Standard"}</span>
            <span className="text-[13px] font-mono text-[color:var(--muted)] shrink-0">{vehicle.stockNumber}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className="text-[12px] font-semibold px-2.5 py-1 rounded-full border whitespace-nowrap"
              style={{ color: webReadyHint.color, borderColor: webReadyHint.color + "55", background: webReadyHint.color + "09" }}
            >
              {webReadyHint.label} · {photoCount} photo{photoCount === 1 ? "" : "s"}
            </span>
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
            <button aria-label="Close"
              onClick={onClose}
              className="text-[rgba(232,234,230,0.72)] hover:text-[color:var(--white)] p-1 rounded-lg transition-all cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden">
        {/* LEFT COLUMN: ACTIVE IMAGE VIEWER & GALLERY */}
        <div className="md:w-3/5 bg-black flex flex-col justify-between relative p-0 md:p-4 group">
          {/* Mobile photo header — the image fills a 230px band and the chrome
              (back, pill+counter, title) is overlaid on a gradient. Desktop
              keeps the contained viewer below. */}
          <div className="md:hidden absolute inset-x-0 top-0 h-[230px] z-10 pointer-events-none"
               style={{ background: "linear-gradient(180deg, rgba(6,8,13,0.55) 0%, transparent 35%, rgba(6,8,13,0.85) 100%)" }} />
          <button
            onClick={onClose}
            aria-label="Back"
            className="md:hidden absolute top-3 left-3 z-20 h-9 w-9 grid place-items-center rounded-full text-[color:var(--white)] cursor-pointer"
            style={{ background: "rgba(6,8,13,0.6)", border: "1px solid rgba(255,255,255,0.12)" }}
          >
            <ChevronLeft size={18} />
          </button>
          <div className="md:hidden absolute top-3 right-3 z-20 flex items-center gap-2">
            <span
              className="text-[12px] font-semibold px-2.5 py-1 rounded-full border whitespace-nowrap"
              style={{ color: webReadyHint.color, borderColor: webReadyHint.color + "55", background: "rgba(6,8,13,0.6)" }}
            >
              {webReadyHint.label}
            </span>
            {imagesList.length > 0 && (
              <button
                onClick={() => handleDeletePhoto(safeIndex)}
                aria-label="Delete photo"
                className="h-9 w-9 grid place-items-center rounded-full text-[color:var(--white)] cursor-pointer"
                style={{ background: "rgba(6,8,13,0.6)", border: "1px solid rgba(255,255,255,0.12)" }}
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
          <div className="md:hidden absolute left-4 bottom-16 z-20 min-w-0 pr-16">
            <div className="text-[20px] font-semibold tracking-[-0.015em] text-[color:var(--white)] leading-tight truncate">
              {vehicle.year} {vehicle.make} {vehicle.model}
            </div>
            <div className="text-[13px] text-[color:var(--white-dim)] truncate">
              {vehicle.trim || "Standard"} · <span className="font-mono">{vehicle.stockNumber}</span>
            </div>
          </div>
          <div className="md:hidden absolute right-4 bottom-16 z-20">
            <span className="text-[12px] font-mono px-2 py-0.5 rounded-full text-[color:var(--white)]" style={{ background: "rgba(6,8,13,0.6)" }}>
              {imagesList.length ? safeIndex + 1 : 0}/{imagesList.length}
            </span>
          </div>

          {/* Desktop-only "N of M Photos" badge (mobile uses the overlay counter). */}
          <div className="hidden md:block absolute top-4 left-4 z-10 bg-black/60 px-3 py-2 rounded-lg border border-white/10 backdrop-blur-md text-[13px] font-mono">
            {imagesList.length ? safeIndex + 1 : 0} of {imagesList.length} Photos
          </div>

          {/* Desktop delete (mobile delete lives in the overlay above). */}
          {imagesList.length > 0 && (
            <button
              onClick={() => handleDeletePhoto(safeIndex)}
              className="hidden md:block absolute top-4 right-4 z-10 bg-[color:var(--glass)] hover:bg-[color:var(--ink-2)] text-[color:var(--white)] p-2 rounded-lg transition-all cursor-pointer shadow-md"
              title="Delete Photo"
            >
              <Trash2 size={14} />
            </button>
          )}

          {/* Core display frame. Mobile: a 230px cover header. Desktop: a
              contained viewer. */}
          <div className="h-[230px] md:h-auto flex items-center justify-center md:min-h-[300px] md:max-h-[480px] md:flex-1 overflow-hidden">
            <img
              src={imagesList[safeIndex]}
              alt={`${vehicle.make} ${vehicle.model}`}
              className="w-full h-full object-cover md:w-auto md:max-h-full md:max-w-full md:object-contain md:rounded-none"
            />
          </div>

          {/* Slide controls */}
          {imagesList.length > 1 && (
            <>
              <button
                onClick={() => setActiveImageIndex(safeIndex > 0 ? safeIndex - 1 : imagesList.length - 1)}
                className="tru-btn-secondary absolute left-4 top-1/2 -translate-y-1/2 h-11 w-11 hidden md:flex items-center justify-center cursor-pointer"
                title="Previous photo"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setActiveImageIndex(safeIndex < imagesList.length - 1 ? safeIndex + 1 : 0)}
                className="tru-btn-secondary absolute right-4 top-1/2 -translate-y-1/2 h-11 w-11 hidden md:flex items-center justify-center cursor-pointer"
                title="Next photo"
              >
                <ChevronRight size={16} />
              </button>
            </>
          )}

          {/* Thumbnails list. The add-photos control lives here now, as a
              dashed slot next to the photos it changes — it left the specs
              column with the "Media Sync Station" section. */}
          <div className="flex gap-2 overflow-x-auto py-2 border-t border-white/5 mt-2 scrollbar-none">
            {imagesList.map((img, idx) => (
              <div
                key={idx}
                className={`relative w-16 h-12 rounded-[10px] overflow-hidden flex-shrink-0 group/thumb transition-all ${
                  idx === safeIndex ? "ring-2 ring-[color:var(--cyan)]" : "opacity-60 hover:opacity-100"
                }`}
              >
                <button
                  onClick={() => setActiveImageIndex(idx)}
                  className="w-full h-full block cursor-pointer"
                  title={`Photo ${idx + 1}`}
                >
                  <img src={img} alt="Thumb" className="w-full h-full object-cover" />
                </button>
                {/* Per-thumbnail delete — always shown on mobile so it's tappable,
                    fades in on hover on desktop. stopPropagation so it does not
                    also switch to the photo it is removing. */}
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeletePhoto(idx); }}
                  aria-label={`Delete photo ${idx + 1}`}
                  title="Delete this photo"
                  className="absolute top-0.5 right-0.5 h-3.5 w-3.5 md:h-5 md:w-5 grid place-items-center rounded-full bg-black/70 text-white opacity-100 md:opacity-0 md:group-hover/thumb:opacity-100 transition-opacity cursor-pointer"
                >
                  <X size={8} className="md:hidden" />
                  <X size={10} className="hidden md:block" />
                </button>
              </div>
            ))}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              title="Add photos"
              className="w-16 h-12 shrink-0 rounded-[10px] flex flex-col items-center justify-center gap-0.5 text-[color:var(--white-dim)] hover:text-[color:var(--white)] cursor-pointer disabled:opacity-50"
              style={{ border: "1px dashed rgba(232,234,230,0.25)" }}
            >
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              <span className="text-[12px] leading-none">{uploading ? "…" : "Add"}</span>
            </button>
            {/* Hidden picker — accepts the phone camera on mobile browsers. */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              capture="environment"
              onChange={handleLocalFileSelection}
              className="hidden"
            />
          </div>
        </div>

        {/* RIGHT COLUMN: DETAIL SPECS, INSPECTION & RECON TABS */}
        <div className="md:w-2/5 max-md:flex-1 max-md:min-h-0 p-5 md:p-6 flex flex-col justify-between overflow-y-auto border-t md:border-t-0 md:border-l border-white/10">
          <div>
            {/* Header (car name, trim, stock, close, return-to-stock) moved to
                the modal's top title bar so the detail panel opens straight on
                the tab row. */}

            {/* Underlined tab row. A segmented control whose active segment is a
                filled cyan key makes the loudest object in the panel a label for
                where you already are; underlining it frees the cyan for Publish. */}
            <div className="flex gap-2 border-b border-white/10 mb-5 text-[13px] font-semibold overflow-x-auto scrollbar-thin">
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
                onClick={() => setActiveTab("recon")}
                className={`px-3 py-2 flex items-center justify-center gap-1 border-b-2 -mb-px whitespace-nowrap transition-colors cursor-pointer ${
                  activeTab === "recon" ? "text-[color:var(--white)] border-[color:var(--cyan)]" : "text-[rgba(232,234,230,0.72)] border-transparent hover:text-[color:var(--white)]"
                }`}
              >
                <Wrench size={11} /> Recon
              </button>
              {truSocialEnabled && (
                <button
                  onClick={() => setActiveTab("publish")}
                  className={`px-3 py-2 flex items-center justify-center gap-1 border-b-2 -mb-px whitespace-nowrap transition-colors cursor-pointer ${
                    activeTab === "publish" ? "text-[color:var(--white)] border-[color:var(--cyan)]" : "text-[rgba(232,234,230,0.72)] border-transparent hover:text-[color:var(--white)]"
                  }`}
                >
                  <Share2 size={11} /> Publish
                </button>
              )}
            </div>

            {/* TAB 1: SHOWROOM SPECIFICATIONS */}
            {activeTab === "specs" && (
              <div className="space-y-5 animate-in fade-in duration-200">
                {/* Pricing — no card container: retail leads at display size,
                    TruPrice reads as one line, and the editor is a ghost chip. */}
                <div className="space-y-3">
                  <div className="flex justify-between items-start gap-3">
                    <div className="min-w-0">
                      <span className="text-[length:var(--t-micro)] font-mono text-[color:var(--muted)] tracking-wider">Retail</span>
                      <div className="text-[38px] leading-none font-semibold tracking-[-0.022em] text-[color:var(--white)] font-mono mt-1">{formatZAR(vehicle.retailPrice)}</div>
                      {vehicle.truPrice ? (
                        <div className="text-[13px] mt-2 text-[color:var(--white-dim)]">
                          TruPrice <span className="font-semibold text-[color:var(--cyan)]">{formatZAR(vehicle.truPrice)}</span>
                          {vehicle.truPrice > vehicle.retailPrice
                            ? ` · ${formatZAR(vehicle.truPrice - vehicle.retailPrice)} below market`
                            : " · at or above market"}
                        </div>
                      ) : (
                        <div className="text-[13px] text-[color:var(--muted)] mt-1">No TruPrice benchmark set</div>
                      )}
                    </div>
                    <button
                      onClick={() => { setTruPriceInput(String(vehicle.truPrice || vehicle.retailPrice || "")); setEditingTruPrice(true); }}
                      className="px-3 min-h-[32px] text-[13px] font-semibold rounded-[8px] text-[color:var(--white-dim)] hover:text-[color:var(--white)] cursor-pointer shrink-0"
                      style={{ background: "rgba(232,234,230,0.06)" }}
                    >
                      {vehicle.truPrice ? "Edit" : "Set"}
                    </button>
                  </div>

                  {editingTruPrice && (
                    <div className="bg-black/30 border border-white/10 rounded-lg p-3 space-y-2">
                      <label className="text-[13px] text-[rgba(232,234,230,0.72)]  font-semibold tracking-wider block">
                        TruPrice benchmark
                      </label>
                      <p className="text-[12px] text-[color:var(--muted)]">
                        Open-market value, from your own book
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

                {/* Showroom category — a field row between hairlines, not a card. */}
                <div className="flex items-center justify-between gap-3 py-3 border-y border-white/[0.07]">
                  <span className="text-[length:var(--t-micro)] font-mono text-[color:var(--muted)]">Showroom category</span>
                  <select
                    value={vehicle.category || ""}
                    onChange={(e) => {
                      const val = e.target.value as Vehicle["category"] | "";
                      onUpdateVehicle(vehicle.id, { category: val || undefined } as Partial<Vehicle>);
                    }}
                    className="min-w-[180px] bg-[color:var(--ink)] border border-white/15 rounded-lg px-3 py-2 text-[13px] text-[color:var(--white)] outline-none focus:border-[color:var(--cyan)]"
                  >
                    <option value="">Used (default)</option>
                    <option value="used">Premium Used</option>
                    <option value="select">Premium Select</option>
                    <option value="performance">Premium Performance</option>
                  </select>
                </div>

                {/* Vehicle details — collapsed by default so the modal stays
                    scannable. Dealer identity fields are rare-touch (usually
                    only once, to correct a typo the disc scanner missed), so
                    they live one tap deeper. Every input saves on blur; the
                    server stamps a per-field updatedAt and pushes back to
                    TruLens for Lens-sourced vehicles. */}
                <details className="bg-[color:var(--glass)] border border-white/5 rounded-xl">
                  <summary className="cursor-pointer px-4 py-3 text-[13px] font-semibold text-[color:var(--white)] tracking-normal select-none flex items-center gap-2 [&::-webkit-details-marker]:hidden">
                    <ChevronDown size={14} className="text-[color:var(--muted)]" />
                    Make, model, VIN &amp; specs
                  </summary>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-3 px-4 pb-4 pt-1">
                    {[
                      { key: "year",    label: "Year",         type: "number" },
                      { key: "make",    label: "Make",         type: "text"   },
                      { key: "model",   label: "Model",        type: "text"   },
                      { key: "trim",    label: "Trim",         type: "text"   },
                      { key: "vin",               label: "VIN",              type: "text"   },
                      { key: "engineNumber",      label: "Engine no.",       type: "text"   },
                      { key: "registrationNumber", label: "Reg. plate",      type: "text"   },
                      { key: "mmCode",            label: "MM code",         type: "text"   },
                      { key: "color",             label: "Colour",          type: "text"   },
                      { key: "mileage",           label: "Mileage (km)",    type: "number" },
                      { key: "bodyType",          label: "Body style",      type: "text"   },
                      { key: "engine",            label: "Engine",          type: "text"   },
                    ].map((f: any) => (
                      <div key={f.key} className={"flex flex-col" + (f.colSpan === 2 ? " col-span-2" : "")}>
                        <label className="text-[length:var(--t-micro)] font-mono text-[color:var(--muted)]">{f.label}</label>
                        <input
                          type={f.type}
                          defaultValue={(vehicle as any)[f.key] ?? ""}
                          onBlur={(e) => {
                            const raw = e.target.value;
                            const cur = (vehicle as any)[f.key];
                            const next = f.type === "number" ? (raw === "" ? 0 : Number(raw)) : raw;
                            if (next === cur) return;
                            onUpdateVehicle(vehicle.id, { [f.key]: next } as Partial<Vehicle>);
                          }}
                          className="w-full bg-[color:var(--ink)] border border-white/15 rounded-lg px-3 py-2 text-[15px] text-[color:var(--white)] outline-none focus:border-[color:var(--cyan)] mt-0.5"
                        />
                      </div>
                    ))}
                    <div className="flex flex-col">
                      <label className="text-[length:var(--t-micro)] font-mono text-[color:var(--muted)]">Transmission</label>
                      <select
                        defaultValue={vehicle.transmission || "Automatic"}
                        onChange={(e) => onUpdateVehicle(vehicle.id, { transmission: e.target.value } as Partial<Vehicle>)}
                        className="w-full bg-[color:var(--ink)] border border-white/15 rounded-lg px-3 py-2 text-[15px] text-[color:var(--white)] outline-none focus:border-[color:var(--cyan)] mt-0.5"
                      >
                        <option>Automatic</option>
                        <option>Manual</option>
                      </select>
                    </div>
                    <div className="flex flex-col">
                      <label className="text-[length:var(--t-micro)] font-mono text-[color:var(--muted)]">Fuel</label>
                      <select
                        defaultValue={vehicle.fuelType || "Petrol"}
                        onChange={(e) => onUpdateVehicle(vehicle.id, { fuelType: e.target.value } as Partial<Vehicle>)}
                        className="w-full bg-[color:var(--ink)] border border-white/15 rounded-lg px-3 py-2 text-[15px] text-[color:var(--white)] outline-none focus:border-[color:var(--cyan)] mt-0.5"
                      >
                        <option>Petrol</option>
                        <option>Diesel</option>
                        <option>Hybrid</option>
                        <option>Electric</option>
                      </select>
                    </div>
                    <div className="flex flex-col col-span-2">
                      <label className="text-[length:var(--t-micro)] font-mono text-[color:var(--muted)]">Dealer comments</label>
                      <textarea
                        defaultValue={vehicle.description || ""}
                        onBlur={(e) => {
                          if (e.target.value === (vehicle.description || "")) return;
                          onUpdateVehicle(vehicle.id, { description: e.target.value } as Partial<Vehicle>);
                        }}
                        rows={3}
                        className="w-full bg-[color:var(--ink)] border border-white/15 rounded-lg px-3 py-2 text-[13px] text-[color:var(--white)] outline-none focus:border-[color:var(--cyan)] mt-0.5 resize-y"
                      />
                    </div>
                  </div>
                </details>
              </div>
            )}

            {activeTab === "docs" && (
              <div className="space-y-4 animate-in fade-in duration-200">
                {documentsPanel}
              </div>
            )}

            {/* TAB 3: RECONDITIONING COST WORKFLOW AND LOGGING */}
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
                      dateAdded: new Date().toISOString().slice(0, 10)
                    };

                    const updatedTasks = [...tasks, newTask];
                    await onUpdateVehicle(vehicle.id, { reconTasks: updatedTasks });
                    setNewReconName("");
                    setNewReconCost("");
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
                        <div className="text-[13px] text-[color:var(--white)] font-semibold tracking-normal">Log Prep Tasks</div>

                        <div className="space-y-1">
                          <label className="text-[13px] text-[rgba(232,234,230,0.72)] font-semibold">Task Category</label>
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

                        {/* The recon "Attach photo" control was removed.
                            `reconTasks[].photo` is not in VEHICLE_PHOTO_FIELDS,
                            so unlike every other upload in the app it never went
                            through putPhotos — the image stayed as base64 inside
                            the vehicle row, adding roughly 4 MB per photo to the
                            dealer's state file, which is exactly what moving
                            photos into the media store was meant to stop.
                            Damage photos belong in the gallery above (or in
                            TruLens), where they are stored as files. */}

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

            {/* TAB 5: TRUSOCIAL PUBLISH — OAuth-connected channels only. */}
            {activeTab === "publish" && truSocialEnabled && (() => {
              const ALL_PLATFORMS = [
                { id: "facebook",         label: "Facebook",        icon: <Facebook size={14} />,       color: "#1877F2" },
                { id: "instagram",        label: "Instagram",       icon: <Instagram size={14} />,      color: "#E4405F" },
                { id: "google-business",  label: "Google Business", icon: <Globe size={14} />,          color: "#4285F4" },
                { id: "linkedin",         label: "LinkedIn",        icon: <Linkedin size={14} />,       color: "#0A66C2" },
                { id: "whatsapp",         label: "WhatsApp",        icon: <MessageCircle size={14} />,  color: "#25D366" },
              ];

              // Load accounts on first render of this tab
              if (!socialLoading && socialAccounts.length === 0 && dealershipId) {
                loadSocialAccounts();
              }
              if (!socialCaption) setSocialCaption(buildDefaultCaption());

              const connectedMap = new Map(socialAccounts.map((a) => [a.platform, a]));

              const togglePlatform = (platformId: string) => {
                if (platformId === "whatsapp") {
                  // WhatsApp is a toggle for the direct-share selection
                  setSelectedAccounts((prev) => {
                    const next = new Set(prev);
                    next.has("whatsapp") ? next.delete("whatsapp") : next.add("whatsapp");
                    return next;
                  });
                  return;
                }
                const acc = connectedMap.get(platformId);
                if (!acc) return; // not connected — click does nothing
                setSelectedAccounts((prev) => {
                  const next = new Set(prev);
                  next.has(acc.accountId) ? next.delete(acc.accountId) : next.add(acc.accountId);
                  return next;
                });
              };

              const zernioSelected = Array.from(selectedAccounts).filter((id) => id !== "whatsapp");
              const whatsappSelected = selectedAccounts.has("whatsapp");

              const handlePublishAll = async () => {
                setSocialPublishing(true);
                setSocialResult(null);
                const results: string[] = [];

                // Publish to Zernio channels
                if (zernioSelected.length && dealershipId) {
                  try {
                    const res = await authFetch("/api/social/publish", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        dealershipId,
                        vehicleId: vehicle.id,
                        caption: socialCaption,
                        accountIds: zernioSelected,
                      }),
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || "Publish failed");
                    results.push(data.platforms?.join(", ") || "social channels");
                  } catch (err: any) {
                    setSocialResult({ ok: false, message: err?.message || "Publish failed" });
                    setSocialPublishing(false);
                    return;
                  }
                }

                // WhatsApp direct share
                if (whatsappSelected) {
                  handleWhatsAppShare();
                  results.push("WhatsApp");
                }

                if (results.length) {
                  setSocialResult({ ok: true, message: `Published to ${results.join(", ")}` });
                }
                setSelectedAccounts(new Set());
                setSocialPublishing(false);
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
                    rows={4}
                    className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-[13px] text-[rgba(232,234,230,0.85)] placeholder:text-[rgba(232,234,230,0.35)] outline-none resize-none leading-relaxed focus:border-[color:var(--cyan-soft)] transition-colors"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSocialCaption(buildDefaultCaption())}
                      className="px-3 py-1.5 text-[13px] text-[color:var(--muted)] hover:text-[color:var(--white)] bg-[color:var(--glass)] border border-[color:var(--glass-line)] rounded-lg transition-colors cursor-pointer"
                    >
                      <RefreshCw size={11} className="inline mr-1.5 -mt-px" />Reset
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(socialCaption || buildDefaultCaption());
                        setSocialResult({ ok: true, message: "Caption copied" });
                      }}
                      className="px-3 py-1.5 text-[13px] text-[color:var(--muted)] hover:text-[color:var(--white)] bg-[color:var(--glass)] border border-[color:var(--glass-line)] rounded-lg transition-colors cursor-pointer"
                    >
                      <FileText size={11} className="inline mr-1.5 -mt-px" />Copy
                    </button>
                  </div>
                </div>

                {/* All platform channels */}
                <div className="bg-[color:var(--ink-2)] border border-white/5 rounded-xl p-4 flex flex-col gap-3">
                  <h4 className="text-[13px] font-semibold text-[color:var(--white)] tracking-normal">Choose where to post</h4>

                  {socialLoading ? (
                    <div className="flex items-center gap-2 py-3 text-[13px] text-[rgba(232,234,230,0.55)]">
                      <Loader2 size={13} className="animate-spin" /> Loading channels...
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {ALL_PLATFORMS.map((plat) => {
                        const isWhatsApp = plat.id === "whatsapp";
                        const connected = isWhatsApp || connectedMap.has(plat.id);
                        const acc = connectedMap.get(plat.id);
                        const isSelected = isWhatsApp
                          ? selectedAccounts.has("whatsapp")
                          : acc ? selectedAccounts.has(acc.accountId) : false;

                        return (
                          <button
                            key={plat.id}
                            type="button"
                            onClick={() => togglePlatform(plat.id)}
                            disabled={!connected}
                            className={
                              "flex items-center gap-3 rounded-lg border p-3 transition-all text-left " +
                              (isSelected
                                ? "border-[color:var(--cyan-soft)] bg-[color:var(--cyan-faint)] cursor-pointer"
                                : connected
                                  ? "border-white/5 bg-black/20 hover:border-white/15 cursor-pointer"
                                  : "border-white/5 bg-black/10 opacity-50 cursor-default")
                            }
                          >
                            <div
                              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                              style={{ background: plat.color + "20", color: plat.color }}
                            >
                              {plat.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[13px] font-semibold text-[color:var(--white)]">{plat.label}</div>
                              <div className="text-[13px] text-[rgba(232,234,230,0.55)] truncate">
                                {isWhatsApp
                                  ? "Opens WhatsApp with caption"
                                  : connected
                                    ? `@${acc?.username || "connected"}`
                                    : "Contact support to connect"}
                              </div>
                            </div>
                            <div className={
                              "w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors " +
                              (isSelected
                                ? "border-[color:var(--cyan)] bg-[color:var(--cyan)]"
                                : connected
                                  ? "border-white/20"
                                  : "border-white/10")
                            }>
                              {isSelected && <Check size={12} className="text-[color:var(--ink)]" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Publish button */}
                  <button
                    type="button"
                    disabled={socialPublishing || (!zernioSelected.length && !whatsappSelected) || !socialCaption.trim()}
                    onClick={handlePublishAll}
                    className="w-full py-2.5 bg-[color:var(--cyan)] hover:bg-opacity-90 on-fill font-semibold text-[13px] rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed mt-1"
                  >
                    {socialPublishing ? (
                      <><Loader2 size={13} className="animate-spin" /> Publishing...</>
                    ) : (
                      <><Send size={13} /> Publish to {selectedAccounts.size} selected</>
                    )}
                  </button>

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

                {/* Marketplace (coming soon) */}
                <div className="bg-[color:var(--ink-2)] border border-white/5 rounded-xl p-4 flex flex-col gap-3 opacity-50">
                  <h4 className="text-[13px] font-semibold text-[color:var(--white)] tracking-normal">Marketplace syndication</h4>
                  <p className="text-[13px] text-[rgba(232,234,230,0.55)]">AutoTrader SA, Cars.co.za — coming soon</p>
                </div>
              </div>
              );
            })()}
          </div>

          {/* Footer — a clean row: publish toggle on the left (Light-style,
              no big cyan CTA), utility actions on the right. */}
          <div className="shrink-0 pt-3 mt-3 border-t border-white/10 flex flex-col gap-2">
            <label
              className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-[color:var(--glass)] border border-white/5 cursor-pointer select-none"
              title={isPublished ? "On website — tap to unpublish" : "Publish this vehicle to the dealer website"}
            >
              <span className="flex items-center gap-2 text-[13px] text-[color:var(--white)] font-semibold">
                <Globe size={14} className={isPublished ? "text-[color:var(--cyan)]" : "text-[rgba(232,234,230,0.55)]"} />
                {publishing ? "Saving…" : isPublished ? "Live on website" : "Not on website"}
              </span>
              <span
                className={
                  "relative inline-flex h-[22px] w-[40px] items-center rounded-full transition-colors " +
                  (isPublished ? "bg-[color:var(--cyan)]" : "bg-white/15")
                }
              >
                <span
                  className={
                    "inline-block h-[18px] w-[18px] rounded-full bg-white shadow transition-transform " +
                    (isPublished ? "translate-x-[20px]" : "translate-x-[2px]")
                  }
                />
              </span>
              <input
                type="checkbox"
                className="sr-only"
                checked={isPublished}
                disabled={publishing}
                onChange={async () => {
                  setPublishing(true);
                  try {
                    await onUpdateVehicle(vehicle.id, { showOnWebsite: !isPublished } as Partial<Vehicle>);
                  } finally {
                    setPublishing(false);
                  }
                }}
              />
            </label>
            {/* Open in TruLens / Remove — desktop only. On mobile these move to
                the fixed action bar (Shoot) and are otherwise a desk job. */}
            <div className="hidden md:grid grid-cols-2 gap-2">
              {hasLens && (
              <button
                type="button"
                onClick={() => openTruLens(vehicle.stockNumber)}
                className="tru-btn-ghost min-h-[44px] inline-flex items-center justify-center gap-2 text-[13px] cursor-pointer"
              >
                <Camera size={14} /> Open in TruLens
              </button>
              )}
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

        {/* Mobile action bar — pinned to the bottom of the sheet. Shoot in
            TruLens is the primary floor action; WhatsApp is one-to-one to the
            customer in front of you (blurb + images via the Web Share API,
            falling back to wa.me); the sync opens the Publish tab (one-to-many
            to connected channels) and only appears for TruSocial dealers. */}
        <div
          className="md:hidden shrink-0 flex items-center gap-2 px-4 pt-3 border-t border-[color:var(--glass-line)] bg-[rgba(11,15,23,0.95)]"
          style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom,0px))" }}
        >
          {hasLens && (
          <button
            type="button"
            onClick={() => openTruLens(vehicle.stockNumber)}
            className="btn btn-primary flex-1 min-h-[48px] inline-flex items-center justify-center gap-2"
          >
            <Camera size={16} /> Shoot in TruLens
          </button>
          )}
          <button
            type="button"
            onClick={() => { void openStockWhatsApp(vehicle as any); }}
            aria-label="WhatsApp this vehicle to a customer"
            className="h-[56px] w-[56px] shrink-0 grid place-items-center rounded-xl text-[color:var(--white)] bg-[color:var(--glass)] border border-[color:var(--glass-line)] cursor-pointer"
          >
            <MessageCircle size={18} />
          </button>
          {truSocialEnabled && (
            <button
              type="button"
              onClick={() => setActiveTab("publish")}
              aria-label="Publish to connected channels"
              className="h-[56px] w-[56px] shrink-0 grid place-items-center rounded-xl text-[color:var(--white)] bg-[color:var(--glass)] border border-[color:var(--glass-line)] cursor-pointer"
            >
              <Share2 size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
