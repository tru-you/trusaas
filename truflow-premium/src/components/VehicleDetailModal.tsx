import React, { useState, useRef, useCallback, useEffect } from "react";
import { Vehicle, Dealership } from "../types";
import { openTruLens } from "../lib/productConfig";
import { openStockWhatsApp } from "../lib/salesShare";
import { useMoney, useMarket } from "../contexts/MarketContext";
import { formatMoney, formatMoneyFromData, formatDistance } from "./market";
import VehiclePicker, { VehiclePickerValue } from "./VehiclePicker";
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
  Instagram,
  Printer,
  History,
  TrendingUp,
  Radio,
  ShoppingBag,
  Copy,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { authFetch } from "../lib/session";
import { VEHICLE_EXTRAS } from "../lib/vehicleExtras";
import { Imagin8GatedButton, Imagin8Bundles, ZERO_BUNDLES } from "./imagin8-gating";
import { SocialShareModal } from "./SocialShareModal";
import {
  buildFacebookPagePost,
  buildFacebookMarketplacePack,
  buildInstagramPost,
  buildWhatsAppStatusPost,
  buildLinkedInPost,
  buildGoogleBusinessPost,
  buildVehicleShareUrl,
} from "../lib/socialGenerators";

function numberToWords(n: number): string {
  if (n === 0) return "Zero";
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const scales = ["", "Thousand", "Million", "Billion"];
  const chunk = (x: number): string => {
    let s = "";
    if (x >= 100) { s += ones[Math.floor(x / 100)] + " Hundred"; x %= 100; if (x) s += " and "; }
    if (x >= 20) { s += tens[Math.floor(x / 10)]; x %= 10; if (x) s += "-" + ones[x]; }
    else if (x > 0) s += ones[x];
    return s;
  };
  const parts: string[] = [];
  let i = 0;
  let num = Math.floor(Math.abs(n));
  while (num > 0) {
    const c = num % 1000;
    if (c) parts.unshift(chunk(c) + (scales[i] ? " " + scales[i] : ""));
    num = Math.floor(num / 1000);
    i++;
  }
  return parts.join(", ");
}

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
  dealership?: Dealership;
  onNotify?: (title: string, message: string, type?: "info" | "warning" | "error") => void;
}

export default function VehicleDetailModal({ vehicle, isOpen, onClose, onUpdateVehicle, onDeleteVehicle, onReturnToStock, settings, documentsPanel, dealershipId, truSocialEnabled, hasLens = true, dealership, onNotify }: VehicleDetailModalProps) {
  const money = useMoney();
  const market = useMarket();

  const notify = (title: string, message: string, type: "info" | "warning" | "error" = "info") => {
    if (onNotify) {
      onNotify(title, message, type);
    } else {
      console.warn(`[VehicleDetailModal] ${type.toUpperCase()}: ${title} - ${message}`);
    }
  };
  /* Legal docs keep cents — offers and settlements can't round. */
  const moneyDoc = (n: number) =>
    `${market.currency}${market.currency === "R" ? " " : ""}${(Number(n) || 0).toLocaleString(market.locale, { minimumFractionDigits: 2 })}`;
  const currencyName = market.currency === "£" ? "Pounds" : market.currency === "$" ? "Dollars" : "Rand";
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [showOutrightOtp, setShowOutrightOtp] = useState(false);
  const [showSocialModal, setShowSocialModal] = useState(false);

  // Social publish states
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([]);
  const [socialLoading, setSocialLoading] = useState(false);
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
  const [socialCaption, setSocialCaption] = useState("");
  const [socialPublishing, setSocialPublishing] = useState(false);
  const [socialResult, setSocialResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Elite DMS States
  const [activeTab, setActiveTab] = useState<"specs" | "recon" | "publish" | "docs" | "extras">("specs");
  const [newReconName, setNewReconName] = useState("");
  const [newReconCost, setNewReconCost] = useState("");

  // Recon Category and Market check States
  const [reconCategory, setReconCategory] = useState<string>("Bodywork / Painting");
  const [editingTruPrice, setEditingTruPrice] = useState(false);
  const [truPriceInput, setTruPriceInput] = useState("");
  const [savingTruPrice, setSavingTruPrice] = useState(false);

  // TrueAI Image Studio States
  const [selectedEnhanceImg, setSelectedEnhanceImg] = useState<string>("");

  // Imagin8 / TransUnion
  const [tuValuation, setTuValuation] = useState<any>(null);
  const [tuValLoading, setTuValLoading] = useState(false);
  const [regCheckResult, setRegCheckResult] = useState<any>(null);
  const [regCheckLoading, setRegCheckLoading] = useState(false);

  // Market scraper
  const [marketValuation, setMarketValuation] = useState<any>(null);
  const [marketValLoading, setMarketValLoading] = useState(false);

  // Imagin8 bundle gating
  const [imagin8Bundles, setImagin8Bundles] = useState<Imagin8Bundles>(ZERO_BUNDLES);

  // Fetch bundles on mount
  useEffect(() => {
    authFetch('/api/imagin8/bundles')
      .then(r => r.ok ? r.json() : ZERO_BUNDLES)
      .then(b => setImagin8Bundles(b))
      .catch(() => setImagin8Bundles(ZERO_BUNDLES));
  }, []);

  // Extras tab
  const [extrasCategory, setExtrasCategory] = useState<string>("Basic");

  // Supplementary income
  const [suppType, setSuppType] = useState("Warranty");
  const [suppAmount, setSuppAmount] = useState("");
  const [suppRef, setSuppRef] = useState("");

  const handleTuValuation = useCallback(async () => {
    if (!vehicle.mmCode) { notify("M&M Code Required", "Select make/model/variant first to get an M&M code.", "warning"); return; }
    setTuValLoading(true);
    setTuValuation(null);
    try {
      const res = await authFetch("/api/imagin8/valuation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mmCode: vehicle.mmCode, year: vehicle.year, mileage: vehicle.mileage }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Valuation failed");
      if (data.bundlesRemaining) setImagin8Bundles(data.bundlesRemaining);
      setTuValuation(data);
    } catch (err: any) {
      notify("Valuation Error", err?.message || "Valuation failed", "error");
    } finally {
      setTuValLoading(false);
    }
  }, [vehicle.mmCode, vehicle.year, vehicle.mileage]);

  const handleRegCheck = useCallback(async () => {
    const id = vehicle.vin || (vehicle as any).registrationNumber;
    if (!id) { notify("Input Required", "Enter a VIN or registration number first.", "warning"); return; }
    setRegCheckLoading(true);
    setRegCheckResult(null);
    try {
      const type = vehicle.vin ? "vin" : "reg";
      const res = await authFetch("/api/imagin8/regcheck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: id, type }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reg check failed");
      if (data.bundlesRemaining) setImagin8Bundles(data.bundlesRemaining);
      setRegCheckResult(data);
    } catch (err: any) {
      notify("Reg Check Error", err?.message || "Reg check failed", "error");
    } finally {
      setRegCheckLoading(false);
    }
  }, [vehicle.vin, (vehicle as any).registrationNumber]);

  const [accidentReportLoading, setAccidentReportLoading] = useState(false);
  const [accidentReportResult, setAccidentReportResult] = useState<any>(null);
  const handleAccidentReport = useCallback(async () => {
    const vin = vehicle.vin?.trim();
    if (!vin) { notify("VIN Required", "Enter a VIN number first to run an accident report.", "warning"); return; }
    setAccidentReportLoading(true);
    setAccidentReportResult(null);
    try {
      const qs = new URLSearchParams({ vin }).toString();
      const res = await authFetch(`/api/imagin8/accident-report?${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Accident report failed");
      if (data.bundlesRemaining) setImagin8Bundles(data.bundlesRemaining);
      setAccidentReportResult(data);
    } catch (err: any) {
      notify("Accident Report Error", err?.message || "Accident report failed", "error");
    } finally {
      setAccidentReportLoading(false);
    }
  }, [vehicle.vin]);

  const handleMarketValue = useCallback(async () => {
    if (!vehicle.make || !vehicle.model) { notify("Details Required", "Please fill in Make and Model first.", "warning"); return; }
    setMarketValLoading(true);
    setMarketValuation(null);
    try {
      const res = await authFetch("/api/valuation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ make: vehicle.make, model: vehicle.model, year: vehicle.year, mileage: vehicle.mileage }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Market valuation failed");
      setMarketValuation(data);
    } catch (err: any) {
      notify("Market Valuation Error", err?.message || "Market valuation failed", "error");
    } finally {
      setMarketValLoading(false);
    }
  }, [vehicle.make, vehicle.model, vehicle.year, vehicle.mileage]);

  if (!isOpen) return null;

  const formatZAR = (num: number) => {
    return money(num);
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
    `${formatDistance(Number(vehicle.mileage), market.distanceUnit, market.locale)} · ${vehicle.fuelType}\n` +
    `${money(vehicle.retailPrice)}\n\n` +
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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[250] p-0 md:p-3 overflow-y-auto">
      {/* Full-bleed on mobile (edge-to-edge, full height) so the sheet uses the
          whole screen instead of a narrow card inside a scrim; a framed card
          from md up. */}
      <div className="bg-[color:var(--ink)] border-0 md:border border-white/10 rounded-none md:rounded-2xl w-full max-w-none md:max-w-[1600px] shadow-2xl overflow-hidden flex flex-col h-[100dvh] md:h-auto max-h-[100dvh] md:max-h-[94vh]">
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
        <div className="md:w-1/2 bg-black flex flex-col justify-between relative p-0 md:p-4 group">
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
                className="h-7 w-7 grid place-items-center rounded-full text-white/50 cursor-pointer"
                style={{ background: "rgba(6,8,13,0.45)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <Trash2 size={12} />
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
                  className="absolute -top-0.5 -right-0.5 h-3 w-3 md:h-5 md:w-5 grid place-items-center rounded-full bg-black/60 text-white/60 opacity-0 group-hover/thumb:opacity-100 md:opacity-0 md:group-hover/thumb:opacity-100 transition-opacity cursor-pointer"
                >
                  <X size={6} className="md:hidden" />
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
        <div className="md:w-1/2 max-md:flex-1 max-md:min-h-0 p-5 md:p-6 flex flex-col justify-between overflow-y-auto border-t md:border-t-0 md:border-l border-white/10">
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
              <button
                onClick={() => setActiveTab("extras")}
                className={`px-3 py-2 flex items-center justify-center gap-1 border-b-2 -mb-px whitespace-nowrap transition-colors cursor-pointer ${
                  activeTab === "extras" ? "text-[color:var(--white)] border-[color:var(--cyan)]" : "text-[rgba(232,234,230,0.72)] border-transparent hover:text-[color:var(--white)]"
                }`}
              >
                <Layers size={11} /> Extras
              </button>
              <button
                onClick={() => setActiveTab("publish")}
                className={`px-3 py-2 flex items-center justify-center gap-1 border-b-2 -mb-px whitespace-nowrap transition-colors cursor-pointer ${
                  activeTab === "publish" ? "text-[color:var(--white)] border-[color:var(--cyan)]" : "text-[rgba(232,234,230,0.72)] border-transparent hover:text-[color:var(--white)]"
                }`}
              >
                <Share2 size={11} /> Social &amp; Share
              </button>
            </div>

            {/* TAB 1: FULL VEHICLE OVERVIEW */}
            {activeTab === "specs" && (
              <div className="space-y-5 animate-in fade-in duration-200">

                {/* ── Imagin8 / TransUnion — auto-populate or manual.
                     SA-only stack (SA provider) — hidden on other markets. ── */}
                {market.id === 'za' && (
                <div className="bg-[color:var(--glass)] border border-white/5 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] font-mono text-[color:var(--cyan)] uppercase tracking-wider">Imagin8 · Auto-fill from TransUnion</div>
                    <span className="text-[11px] text-[color:var(--muted)]">or fill manually below</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Imagin8GatedButton
                      feature="valuation"
                      bundles={imagin8Bundles}
                      onClick={handleTuValuation}
                      onUnlock={() => notify("TransUnion Bundle", "TransUnion official valuations are bundle-gated. Contact your TruSaaS account manager to activate live M&M valuations for this dealership.", "info")}
                      className="w-full"
                      icon={tuValLoading ? <Loader2 size={14} className="animate-spin text-cyan-400" /> : <Zap size={14} />}
                    />
                    <Imagin8GatedButton
                      feature="regCheck"
                      bundles={imagin8Bundles}
                      onClick={handleRegCheck}
                      onUnlock={() => notify("TransUnion Bundle", "Registration checks are bundle-gated. Contact your TruSaaS account manager to activate live TransUnion verification for this dealership.", "info")}
                      className="w-full"
                      icon={regCheckLoading ? <Loader2 size={14} className="animate-spin text-cyan-400" /> : <Shield size={14} />}
                    />
                    <Imagin8GatedButton
                      feature="accidentReport"
                      bundles={imagin8Bundles}
                      onClick={handleAccidentReport}
                      onUnlock={() => notify("TransUnion Bundle", "Accident reports are bundle-gated. Contact your TruSaaS account manager to activate live TransUnion claims history for this dealership.", "info")}
                      className="w-full"
                      icon={accidentReportLoading ? <Loader2 size={14} className="animate-spin text-cyan-400" /> : <History size={14} />}
                    />
                    <button
                      type="button"
                      onClick={handleMarketValue}
                      disabled={marketValLoading}
                      className={`market-btn w-full inline-flex items-center justify-center gap-2 min-h-[46px] px-4 py-2.5 text-[#4FE3DC] text-[13px] font-semibold cursor-pointer select-none${marketValLoading ? ' scanning' : ''}`}
                    >
                      {marketValLoading ? <Loader2 size={14} className="animate-spin" /> : <Radio size={14} />}
                      <span className="truncate">{marketValLoading ? 'Scanning market…' : 'Live Market Value'}</span>
                      <span className="mv-badge">LIVE</span>
                    </button>
                  </div>

                  {/* Market Value result */}
                  {marketValuation && (
                    <div className="border border-emerald-500/20 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-400">Market Scraper · AutoTrader &amp; Cars.co.za</div>
                        <div className="text-[11px] text-[color:var(--muted)]">{marketValuation.listingsFound} listings</div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="text-[11px] text-[color:var(--muted)]">Avg Retail</div>
                          <div className="text-[16px] font-semibold text-emerald-400 font-mono">
                            {marketValuation.averageRetailPrice != null ? formatMoneyFromData(marketValuation.averageRetailPrice, marketValuation) : "—"}
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] text-[color:var(--muted)]">Mileage Adjusted</div>
                          <div className="text-[13px] text-[color:var(--white)]">{marketValuation.mileageAdjusted ? `Yes (median ${formatDistance(marketValuation.sampleMedianKm, marketValuation.distanceUnit || market.distanceUnit, market.locale)})` : "No"}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => onUpdateVehicle(vehicle.id, { truPrice: Math.round(marketValuation.averageRetailPrice) })}
                        className="tru-btn-secondary w-full flex items-center justify-center gap-1.5 py-2 text-[13px] font-semibold text-emerald-400 cursor-pointer"
                      >
                        <CheckCircle2 size={14} /> Apply as TruPrice
                      </button>
                    </div>
                  )}

                  {/* TU Valuation result with auto-fill */}
                  {tuValuation && (
                    <div className="border border-[color:var(--cyan)]/20 rounded-lg p-3 space-y-2">
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { label: "Trade", value: tuValuation.tradePrice },
                          { label: "Retail", value: tuValuation.retailPrice },
                          { label: "New", value: tuValuation.newPrice },
                        ].map((v) => (
                          <div key={v.label}>
                            <div className="text-[11px] text-[color:var(--muted)]">{v.label}</div>
                            <div className="text-[16px] font-semibold text-[color:var(--white)] font-mono">
                              {v.value != null ? formatMoney(Math.round(v.value)) : "—"}
                            </div>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={() => {
                          const updates: Partial<Vehicle> = {};
                          if (tuValuation.tradePrice != null) updates.mmTrade = tuValuation.tradePrice;
                          if (tuValuation.retailPrice != null) updates.mmRetail = tuValuation.retailPrice;
                          onUpdateVehicle(vehicle.id, updates);
                        }}
                        className="tru-btn-secondary w-full flex items-center justify-center gap-1.5 py-2 text-[13px] font-semibold text-[color:var(--cyan)] cursor-pointer"
                      >
                        <Zap size={14} /> Apply MM Trade &amp; Retail values
                      </button>
                    </div>
                  )}

                  {/* Reg Check result with auto-fill */}
                  {regCheckResult && (
                    <div className={`border rounded-lg p-3 space-y-2 ${
                      regCheckResult.stolen || regCheckResult.financePending
                        ? "bg-red-500/10 border-red-500/30"
                        : "bg-emerald-500/10 border-emerald-500/20"
                    }`}>
                      <div className={`text-[11px] font-mono uppercase tracking-wider ${
                        regCheckResult.stolen || regCheckResult.financePending ? "text-red-400" : "text-emerald-400"
                      }`}>
                        Background Check
                      </div>
                      {regCheckResult.alerts?.length > 0 ? (
                        <div className="space-y-1">
                          {regCheckResult.alerts.map((a: string, i: number) => (
                            <div key={i} className="flex items-center gap-2 text-red-400 text-[13px] font-semibold">
                              <AlertCircle size={14} /> {a}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-emerald-400 text-[13px] font-semibold">
                          <CheckCircle2 size={14} /> Clear — no stolen flag, no outstanding finance
                        </div>
                      )}
                      <button
                        onClick={() => {
                          const updates: Partial<Vehicle> = {};
                          if (regCheckResult.vin) updates.vin = regCheckResult.vin;
                          if (regCheckResult.engineNumber) updates.engineNumber = regCheckResult.engineNumber;
                          if (regCheckResult.colour) updates.color = regCheckResult.colour;
                          if (regCheckResult.registrationNumber) updates.registrationNumber = regCheckResult.registrationNumber;
                          onUpdateVehicle(vehicle.id, updates);
                        }}
                        className="tru-btn-secondary w-full flex items-center justify-center gap-1.5 py-2 text-[13px] font-semibold text-emerald-400 cursor-pointer"
                      >
                        <Zap size={14} /> Apply VIN, engine, colour &amp; reg to vehicle
                      </button>
                    </div>
                  )}

                  {/* Accident Report result */}
                  {accidentReportResult && (
                    <div className="border border-rose-500/20 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-[11px] font-mono uppercase tracking-wider text-rose-400">TransUnion Accident &amp; Claims History</div>
                        <div className="text-[11px] font-semibold text-rose-300">
                          {accidentReportResult.claims?.length > 0 ? `${accidentReportResult.claims.length} claim(s) found` : "No claims on record"}
                        </div>
                      </div>
                      {accidentReportResult.claims?.length > 0 ? (
                        <div className="space-y-1.5 mt-2">
                          {accidentReportResult.claims.map((claim: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between text-[12px] bg-white/[0.03] px-2.5 py-1.5 rounded">
                              <span className="text-[color:var(--muted)]">{claim.claimDate || claim.date || "Claim"}</span>
                              <span className="text-[color:var(--white)] font-medium">{claim.description || claim.damagedArea || "Damage reported"}</span>
                              <span className="text-rose-400 font-mono font-semibold">{claim.amount ? formatZAR(claim.amount) : "—"}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[12px] text-emerald-400">Clear — no insurance claims or panel damage reported to TransUnion.</p>
                      )}
                    </div>
                  )}
                </div>
                )}

                {/* ── PRICING & PROFIT ── */}
                <div className="bg-[color:var(--glass)] border border-white/5 rounded-xl p-4 space-y-3">
                  <div className="text-[11px] font-mono text-[color:var(--muted)] uppercase tracking-wider">Pricing &amp; Profit</div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key: "retailPrice",   label: "Selling Price",   type: "number" },
                      { key: "costPrice",      label: "Purchase Price",  type: "number" },
                      { key: "minimumPrice",   label: "Minimum Price",   type: "number" },
                      { key: "truPrice",       label: "TruPrice",        type: "number" },
                      { key: "mmTrade",        label: "MM Trade",        type: "number" },
                      { key: "mmRetail",       label: "MM Retail",       type: "number" },
                    ].map((f) => (
                      <div key={f.key} className="flex flex-col">
                        <label className="text-[length:var(--t-micro)] font-mono text-[color:var(--muted)]">{f.label}</label>
                        <input
                          type="number"
                          defaultValue={(vehicle as any)[f.key] ?? ""}
                          onBlur={(e) => {
                            const raw = e.target.value;
                            const cur = (vehicle as any)[f.key];
                            const next = raw === "" ? 0 : Number(raw);
                            if (next === cur) return;
                            onUpdateVehicle(vehicle.id, { [f.key]: next } as Partial<Vehicle>);
                          }}
                          className="w-full bg-[color:var(--ink)] border border-white/15 rounded-lg px-3 py-2 text-[15px] text-[color:var(--white)] font-mono outline-none focus:border-[color:var(--cyan)] mt-0.5"
                        />
                      </div>
                    ))}
                  </div>
                  {/* Live profit calc */}
                  {(() => {
                    const reconTotal = (vehicle.reconTasks || []).reduce((s, t) => s + t.cost, 0);
                    const suppTotal = (vehicle.supplementaryIncome || []).reduce((s, i) => s + i.amount, 0);
                    const totalCost = vehicle.costPrice + reconTotal;
                    const grossProfit = vehicle.retailPrice - totalCost;
                    const fullProfit = grossProfit + suppTotal;
                    const totalRevenue = vehicle.retailPrice + suppTotal;
                    const margin = totalRevenue > 0 ? (fullProfit / totalRevenue) * 100 : 0;
                    return (
                      <div className="grid grid-cols-4 gap-2 pt-2 border-t border-white/5 text-[13px] font-mono">
                        <div>
                          <div className="text-[color:var(--muted)] text-[11px]">Total Cost</div>
                          <div className="text-[color:var(--white)] font-semibold">{formatZAR(totalCost)}</div>
                        </div>
                        <div>
                          <div className="text-[color:var(--muted)] text-[11px]">Gross Profit</div>
                          <div className={`font-semibold ${grossProfit >= 0 ? "text-[color:var(--cyan)]" : "text-red-400"}`}>{formatZAR(grossProfit)}</div>
                        </div>
                        <div>
                          <div className="text-[color:var(--muted)] text-[11px]">Supp. Income</div>
                          <div className="text-emerald-400 font-semibold">{suppTotal > 0 ? formatZAR(suppTotal) : "—"}</div>
                        </div>
                        <div>
                          <div className="text-[color:var(--muted)] text-[11px]">Full Profit</div>
                          <div className={`font-semibold ${fullProfit >= 0 ? "text-[color:var(--cyan)]" : "text-red-400"}`}>
                            {formatZAR(fullProfit)} <span className={`text-[11px] ${margin >= 10 ? "text-[color:var(--cyan)]" : "text-amber-400"}`}>{margin.toFixed(1)}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* ── MAIN DETAILS ── */}
                <div className="bg-[color:var(--glass)] border border-white/5 rounded-xl p-4 space-y-3">
                  <div className="text-[11px] font-mono text-[color:var(--muted)] uppercase tracking-wider">Main Details</div>
                  <VehiclePicker
                    theme="flow"
                    initial={{ make: vehicle.make, model: vehicle.model, year: vehicle.year, variant: vehicle.trim }}
                    onSelect={async (v: VehiclePickerValue) => {
                      onUpdateVehicle(vehicle.id, {
                        make: v.make, model: v.model, year: v.year, trim: v.variant, mmCode: v.mmCode,
                      } as Partial<Vehicle>);
                      // Auto-fill specs from the resolved M&M code (Static Info,
                      // flat subscription). Fuel type is the safe cross-field.
                      if (!v.mmCode) return;
                      try {
                        const res = await authFetch("/api/imagin8/static", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ mmCode: v.mmCode }),
                        });
                        if (!res.ok) return;
                        const s = await res.json();
                        const fuelMap: Record<string, string> = { P: "Petrol", D: "Diesel", H: "Hybrid", E: "Electric" };
                        if (s.fuelType && fuelMap[s.fuelType]) {
                          onUpdateVehicle(vehicle.id, { fuelType: fuelMap[s.fuelType] } as Partial<Vehicle>);
                        }
                      } catch { /* spec auto-fill is best-effort */ }
                    }}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col">
                      <label className="text-[length:var(--t-micro)] font-mono text-[color:var(--muted)]">New / Used</label>
                      <select
                        defaultValue={vehicle.newOrUsed || "Used"}
                        onChange={(e) => onUpdateVehicle(vehicle.id, { newOrUsed: e.target.value as 'New' | 'Used' })}
                        className="w-full bg-[color:var(--ink)] border border-white/15 rounded-lg px-3 py-2 text-[15px] text-[color:var(--white)] outline-none focus:border-[color:var(--cyan)] mt-0.5"
                      >
                        <option>New</option>
                        <option>Used</option>
                      </select>
                    </div>
                    <div className="flex flex-col">
                      <label className="text-[length:var(--t-micro)] font-mono text-[color:var(--muted)]">Body Type</label>
                      <select
                        defaultValue={vehicle.bodyType || ""}
                        onChange={(e) => onUpdateVehicle(vehicle.id, { bodyType: e.target.value } as Partial<Vehicle>)}
                        className="w-full bg-[color:var(--ink)] border border-white/15 rounded-lg px-3 py-2 text-[15px] text-[color:var(--white)] outline-none focus:border-[color:var(--cyan)] mt-0.5"
                      >
                        <option value="">Select...</option>
                        <option>Sedan</option>
                        <option>Hatchback</option>
                        <option>SUV</option>
                        <option>Bakkie (Single Cab)</option>
                        <option>Bakkie (Double Cab)</option>
                        <option>Bakkie (Extended Cab)</option>
                        <option>Coupe</option>
                        <option>Convertible</option>
                        <option>Station Wagon</option>
                        <option>MPV / Minivan</option>
                        <option>Crossover</option>
                        <option>Panel Van</option>
                        <option>Bus / Minibus</option>
                      </select>
                    </div>
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
                    {[
                      { key: "color",     label: "Colour",    type: "text" },
                      { key: "condition", label: "Condition", type: "text" },
                      { key: "location",  label: "Location",  type: "text" },
                      { key: "mileage",   label: "KM In",     type: "number" },
                    ].map((f) => (
                      <div key={f.key} className="flex flex-col">
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
                      <label className="text-[length:var(--t-micro)] font-mono text-[color:var(--muted)]">Showroom Category</label>
                      <select
                        value={vehicle.category || ""}
                        onChange={(e) => {
                          const val = e.target.value as Vehicle["category"] | "";
                          onUpdateVehicle(vehicle.id, { category: val || undefined } as Partial<Vehicle>);
                        }}
                        className="w-full bg-[color:var(--ink)] border border-white/15 rounded-lg px-3 py-2 text-[15px] text-[color:var(--white)] outline-none focus:border-[color:var(--cyan)] mt-0.5"
                      >
                        <option value="">Used (default)</option>
                        <option value="used">Premium Used</option>
                        <option value="select">Premium Select</option>
                        <option value="performance">Premium Performance</option>
                      </select>
                    </div>
                    <div className="flex flex-col">
                      <label className="text-[length:var(--t-micro)] font-mono text-[color:var(--muted)]">Service History</label>
                      <select
                        defaultValue={vehicle.serviceHistory || ""}
                        onChange={(e) => onUpdateVehicle(vehicle.id, { serviceHistory: e.target.value } as Partial<Vehicle>)}
                        className="w-full bg-[color:var(--ink)] border border-white/15 rounded-lg px-3 py-2 text-[15px] text-[color:var(--white)] outline-none focus:border-[color:var(--cyan)] mt-0.5"
                      >
                        <option value="">Select...</option>
                        <option>Full Service History</option>
                        <option>Partial Service History</option>
                        <option>No Service History</option>
                        <option>Service Plan Active</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* ── VEHICLE IDENTITY ── */}
                <div className="bg-[color:var(--glass)] border border-white/5 rounded-xl p-4 space-y-3">
                  <div className="text-[11px] font-mono text-[color:var(--muted)] uppercase tracking-wider">Vehicle Identity</div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key: "stockNumber",        label: "Stock Code",        type: "text" },
                      { key: "vin",                label: "VIN / Chassis",     type: "text" },
                      { key: "engineNumber",       label: "Engine Number",     type: "text" },
                      { key: "registrationNumber", label: "Registration Plate", type: "text" },
                      { key: "mmCode",             label: "M&M Code",         type: "text" },
                      { key: "licenseNumber",      label: "License Number",    type: "text" },
                      { key: "keyNumber",          label: "Key Number",        type: "text" },
                      { key: "engine",             label: "Engine Spec",       type: "text" },
                    ].map((f) => (
                      <div key={f.key} className="flex flex-col">
                        <label className="text-[length:var(--t-micro)] font-mono text-[color:var(--muted)]">{f.label}</label>
                        <input
                          type={f.type}
                          defaultValue={(vehicle as any)[f.key] ?? ""}
                          onBlur={(e) => {
                            const raw = e.target.value;
                            const cur = (vehicle as any)[f.key];
                            if (raw === (cur ?? "").toString()) return;
                            onUpdateVehicle(vehicle.id, { [f.key]: raw } as Partial<Vehicle>);
                          }}
                          className="w-full bg-[color:var(--ink)] border border-white/15 rounded-lg px-3 py-2 text-[15px] text-[color:var(--white)] outline-none focus:border-[color:var(--cyan)] mt-0.5"
                        />
                      </div>
                    ))}
                    {[
                      { key: "firstRegDate",  label: "1st Registration Date" },
                      { key: "licenseExpiry", label: "License Expiry" },
                      { key: "dateAcquired",  label: "Date Acquired" },
                    ].map((f) => (
                      <div key={f.key} className="flex flex-col">
                        <label className="text-[length:var(--t-micro)] font-mono text-[color:var(--muted)]">{f.label}</label>
                        <input
                          type="date"
                          defaultValue={(vehicle as any)[f.key] ?? ""}
                          onBlur={(e) => {
                            const raw = e.target.value;
                            const cur = (vehicle as any)[f.key];
                            if (raw === (cur ?? "")) return;
                            onUpdateVehicle(vehicle.id, { [f.key]: raw } as Partial<Vehicle>);
                          }}
                          className="w-full bg-[color:var(--ink)] border border-white/15 rounded-lg px-3 py-2 text-[15px] text-[color:var(--white)] outline-none focus:border-[color:var(--cyan)] mt-0.5"
                        />
                      </div>
                    ))}
                    <div className="flex flex-col">
                      <label className="text-[length:var(--t-micro)] font-mono text-[color:var(--muted)]">Province</label>
                      <select
                        defaultValue={vehicle.province || ""}
                        onChange={(e) => onUpdateVehicle(vehicle.id, { province: e.target.value } as Partial<Vehicle>)}
                        className="w-full bg-[color:var(--ink)] border border-white/15 rounded-lg px-3 py-2 text-[15px] text-[color:var(--white)] outline-none focus:border-[color:var(--cyan)] mt-0.5"
                      >
                        <option value="">Select...</option>
                        <option>Gauteng</option>
                        <option>Western Cape</option>
                        <option>KwaZulu-Natal</option>
                        <option>Eastern Cape</option>
                        <option>Free State</option>
                        <option>Mpumalanga</option>
                        <option>Limpopo</option>
                        <option>North West</option>
                        <option>Northern Cape</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-3 col-span-2 pt-1">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={vehicle.enatisDocs ?? false}
                          onChange={(e) => onUpdateVehicle(vehicle.id, { enatisDocs: e.target.checked } as Partial<Vehicle>)}
                          className="w-4 h-4 rounded border border-white/20 bg-[color:var(--ink)] accent-[color:var(--cyan)]"
                        />
                        <span className="text-[13px] text-[color:var(--white)]">eNaTIS docs received</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* ── PURCHASE DETAILS ── */}
                <div className="bg-[color:var(--glass)] border border-white/5 rounded-xl p-4 space-y-3">
                  <div className="text-[11px] font-mono text-[color:var(--muted)] uppercase tracking-wider">Purchase Details</div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key: "supplier",          label: "Supplier",           type: "text" },
                      { key: "supplierInvNumber", label: "Supplier Invoice Nr", type: "text" },
                      { key: "paymentType",       label: "Payment Type",        type: "text" },
                      { key: "paymentRef",        label: "Payment Ref",         type: "text" },
                      { key: "purchasedBy",       label: "Purchased By",        type: "text" },
                      { key: "settlementAmount",  label: "Settlement Amt",      type: "number" },
                    ].map((f) => (
                      <div key={f.key} className="flex flex-col">
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
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowOutrightOtp(true)}
                    className="mt-3 tru-btn-secondary inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-[rgb(29,185,84)] cursor-pointer"
                  >
                    <Printer size={14} /> Generate OTP (Outright Purchase)
                  </button>
                </div>

                {/* ── SUPPLEMENTARY INCOME ── */}
                <div className="bg-[color:var(--glass)] border border-white/5 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] font-mono text-[color:var(--muted)] uppercase tracking-wider">Supplementary Income</div>
                    {(vehicle.supplementaryIncome?.length || 0) > 0 && (
                      <span className="text-[13px] font-semibold font-mono text-[color:var(--cyan)]">
                        {formatZAR((vehicle.supplementaryIncome || []).reduce((s, i) => s + i.amount, 0))}
                      </span>
                    )}
                  </div>

                  {/* Existing items */}
                  {(vehicle.supplementaryIncome || []).length > 0 && (
                    <div className="space-y-1.5">
                      {(vehicle.supplementaryIncome || []).map((item) => (
                        <div key={item.id} className="flex items-center justify-between gap-2 bg-black/20 rounded-lg px-3 py-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[12px] px-1.5 py-0.5 rounded bg-[color:var(--cyan-faint)] text-[color:var(--cyan)] font-semibold shrink-0">{item.type}</span>
                            <span className="text-[13px] text-[color:var(--white)] truncate">{item.description || item.type}</span>
                            {item.reference && <span className="text-[11px] text-[color:var(--muted)] font-mono shrink-0">{item.reference}</span>}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[13px] font-semibold font-mono text-[color:var(--white)]">{formatZAR(item.amount)}</span>
                            <button
                              type="button"
                              onClick={() => {
                                const updated = (vehicle.supplementaryIncome || []).filter((i) => i.id !== item.id);
                                onUpdateVehicle(vehicle.id, { supplementaryIncome: updated } as Partial<Vehicle>);
                              }}
                              className="p-1 hover:bg-white/5 text-[rgba(232,234,230,0.45)] hover:text-[color:var(--muted)] rounded cursor-pointer transition-colors"
                            >
                              <X size={11} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add new income item */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const amt = parseFloat(suppAmount);
                      if (!amt) return;
                      const newItem = {
                        id: "supp_" + Date.now(),
                        type: suppType,
                        amount: amt,
                        reference: suppRef || undefined,
                        date: new Date().toISOString().slice(0, 10),
                      };
                      const existing = vehicle.supplementaryIncome || [];
                      onUpdateVehicle(vehicle.id, { supplementaryIncome: [...existing, newItem] } as Partial<Vehicle>);
                      setSuppAmount("");
                      setSuppRef("");
                    }}
                    className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-end"
                  >
                    <div className="flex flex-col">
                      <label className="text-[length:var(--t-micro)] font-mono text-[color:var(--muted)]">Type</label>
                      <select
                        value={suppType}
                        onChange={(e) => setSuppType(e.target.value)}
                        className="w-full bg-[color:var(--ink)] border border-white/15 rounded-lg px-3 py-2 text-[13px] text-[color:var(--white)] outline-none focus:border-[color:var(--cyan)] mt-0.5"
                      >
                        <option>Warranty</option>
                        <option>Service Plan</option>
                        <option>Insurance</option>
                        <option>Dent & Scratch</option>
                        <option>Paint Protection</option>
                        <option>Tyre & Rim</option>
                        <option>Credit Life</option>
                        <option>GAP Cover</option>
                        <option>Tracking Installation</option>
                        <option>Licence & Reg</option>
                        <option>Other</option>
                      </select>
                    </div>
                    <div className="flex flex-col">
                      <label className="text-[length:var(--t-micro)] font-mono text-[color:var(--muted)]">Amount</label>
                      <input
                        type="number"
                        value={suppAmount}
                        onChange={(e) => setSuppAmount(e.target.value)}
                        placeholder="R"
                        className="w-[110px] bg-[color:var(--ink)] border border-white/15 rounded-lg px-3 py-2 text-[13px] text-[color:var(--white)] font-mono outline-none focus:border-[color:var(--cyan)] mt-0.5"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-[length:var(--t-micro)] font-mono text-[color:var(--muted)]">Ref</label>
                      <input
                        type="text"
                        value={suppRef}
                        onChange={(e) => setSuppRef(e.target.value)}
                        placeholder="optional"
                        className="w-[100px] bg-[color:var(--ink)] border border-white/15 rounded-lg px-3 py-2 text-[13px] text-[color:var(--white)] outline-none focus:border-[color:var(--cyan)] mt-0.5"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={!suppAmount}
                      className="tru-btn-secondary flex items-center justify-center gap-2 px-3.5 py-2.5 text-[13px] font-semibold text-[color:var(--cyan)] disabled:opacity-40 cursor-pointer mt-0.5"
                    >
                      <Plus size={14} /> Add
                    </button>
                  </form>
                </div>

                {/* ── DESCRIPTION ── */}
                <div className="bg-[color:var(--glass)] border border-white/5 rounded-xl p-4 space-y-2">
                  <div className="text-[11px] font-mono text-[color:var(--muted)] uppercase tracking-wider">Description &amp; Notes</div>
                  <textarea
                    defaultValue={vehicle.description || ""}
                    onBlur={(e) => {
                      if (e.target.value === (vehicle.description || "")) return;
                      onUpdateVehicle(vehicle.id, { description: e.target.value } as Partial<Vehicle>);
                    }}
                    rows={4}
                    placeholder="Website description, internal notes..."
                    className="w-full bg-[color:var(--ink)] border border-white/15 rounded-lg px-3 py-2 text-[13px] text-[color:var(--white)] outline-none focus:border-[color:var(--cyan)] resize-y"
                  />
                </div>

              </div>
            )}

            {/* TAB: EXTRAS */}
            {activeTab === "extras" && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="bg-[color:var(--glass)] border border-white/5 rounded-xl p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] font-mono uppercase tracking-wider text-[color:var(--cyan)]">Optional Extras</div>
                    <div className="text-[12px] text-[color:var(--muted)]">{(vehicle.optionalExtras || []).length} selected</div>
                  </div>
                  <div className="flex gap-1 border-b border-white/10 pb-2">
                    {Object.keys(VEHICLE_EXTRAS).map(cat => (
                      <button
                        key={cat}
                        onClick={() => setExtrasCategory(cat)}
                        className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition cursor-pointer ${
                          extrasCategory === cat
                            ? "bg-[color:var(--cyan)]/15 text-[color:var(--cyan)]"
                            : "text-[rgba(232,234,230,0.55)] hover:text-[color:var(--white)]"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 max-h-[360px] overflow-y-auto pr-1">
                    {(VEHICLE_EXTRAS[extrasCategory] || []).map(extra => {
                      const checked = (vehicle.optionalExtras || []).includes(extra);
                      return (
                        <label key={extra} className="flex items-center gap-2 py-1 cursor-pointer hover:bg-white/[0.02] rounded px-1 transition">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              const current = vehicle.optionalExtras || [];
                              const updated = checked ? current.filter(e => e !== extra) : [...current, extra];
                              onUpdateVehicle(vehicle.id, { optionalExtras: updated });
                            }}
                            className="accent-[color:var(--cyan)] w-4 h-4 cursor-pointer"
                          />
                          <span className={`text-[13px] ${checked ? "text-[color:var(--white)]" : "text-[rgba(232,234,230,0.55)]"}`}>{extra}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {(vehicle.optionalExtras || []).length > 0 && (
                  <div className="bg-[color:var(--glass)] border border-white/5 rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-mono uppercase tracking-wider text-[color:var(--muted)]">Extras String</div>
                      <button
                        onClick={() => navigator.clipboard.writeText((vehicle.optionalExtras || []).join(", "))}
                        className="text-[11px] text-[color:var(--cyan)] hover:underline cursor-pointer"
                      >
                        Copy
                      </button>
                    </div>
                    <div className="text-[12px] text-[rgba(232,234,230,0.72)] leading-relaxed bg-black/20 rounded-lg p-3 font-mono">
                      {(vehicle.optionalExtras || []).join(", ")}
                    </div>
                  </div>
                )}
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
                  const targetProfitThreshold = { za: 25000, uk: 1200, us: 1500 }[market?.id || 'za'] || 25000; // market-scaled target
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
                                Projected deal margin of **{marginPercent.toFixed(1)}%** is below dealership threshold (10.0% / {money(targetProfitThreshold)}). Action required to protect commission pool.
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={async () => {
                              await onUpdateVehicle(vehicle.id, { retailPrice: suggestedHealthyPrice });
                              notify("Price Adjusted", `Retail price adjusted to ${money(suggestedHealthyPrice)}! Target profit margin of 15% is now secured.`, "info");
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

            {/* TAB 5: TRUSOCIAL COMMAND HUB — Facebook, Marketplace, Instagram, WhatsApp, LinkedIn, GBP */}
            {activeTab === "publish" && (() => {
              const dealerInput = {
                name: dealership?.name || "Our Dealership",
                tradingAs: dealership?.tradingAs,
                location: dealership?.location,
                address: dealership?.address,
                whatsapp: "",
                websiteUrl: dealership?.websiteUrl,
                slug: dealership?.slug,
              };
              const shareUrl = buildVehicleShareUrl(vehicle as any, dealerInput);
              const fbPageText = buildFacebookPagePost(vehicle as any, dealerInput, market);
              const mpPack = buildFacebookMarketplacePack(vehicle as any, dealerInput, market);
              const igData = buildInstagramPost(vehicle as any, dealerInput, market);
              const waText = buildWhatsAppStatusPost(vehicle as any, dealerInput, market);
              const liText = buildLinkedInPost(vehicle as any, dealerInput, market);
              const gbpData = buildGoogleBusinessPost(vehicle as any, dealerInput, market);

              return (
                <div className="space-y-4 animate-in fade-in duration-200">
                  {/* Hero launch card */}
                  <div className="bg-gradient-to-r from-[color:var(--cyan-soft)]/30 via-blue-500/10 to-purple-500/10 border border-[color:var(--cyan-soft)] rounded-xl p-3.5 flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[13px] font-bold text-white">TruSocial Command Hub</span>
                        <span className="text-[9.5px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 uppercase">1-Click Ready</span>
                      </div>
                      <p className="text-[11.5px] text-[rgba(232,234,230,0.7)]">
                        Launch multi-channel distribution across Facebook, Marketplace, Instagram, WhatsApp, LinkedIn &amp; GBP.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowSocialModal(true)}
                      className="px-3 py-1.5 bg-[color:var(--cyan)] hover:bg-opacity-90 text-white font-semibold text-[11.5px] rounded-lg flex items-center gap-1.5 shadow-md cursor-pointer shrink-0 transition-all"
                    >
                      <Sparkles size={13} /> Full Hub
                    </button>
                  </div>

                  {/* 1-Click Channel Cards */}
                  <div className="grid grid-cols-1 gap-2.5">
                    {/* FB Marketplace */}
                    <div className="bg-black/30 border border-white/5 rounded-xl p-3 flex flex-col gap-2 hover:border-blue-500/30 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ShoppingBag size={14} className="text-[#0084FF]" />
                          <span className="text-[12px] font-semibold text-white">FB Marketplace</span>
                        </div>
                        <span className="text-[9.5px] font-mono px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-400">High Volume</span>
                      </div>
                      <p className="text-[11px] text-[rgba(232,234,230,0.6)] line-clamp-1 font-mono">
                        {mpPack.suggestedTitle}
                      </p>
                      <div className="flex items-center gap-2 pt-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(mpPack.bodyDescription);
                            setSocialResult({ ok: true, message: "Marketplace description copied!" });
                          }}
                          className="flex-1 py-1 bg-white/10 hover:bg-white/15 text-[11px] font-medium rounded-lg text-white flex items-center justify-center gap-1 cursor-pointer transition-colors"
                        >
                          <Copy size={11} /> Copy Description
                        </button>
                        <a
                          href="https://www.facebook.com/marketplace/create/vehicle"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-[11px] rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-colors"
                          title="Open Marketplace"
                        >
                          <span>Open</span>
                          <ExternalLink size={11} />
                        </a>
                      </div>
                    </div>

                    {/* WhatsApp Status & Broadcast */}
                    <div className="bg-black/30 border border-white/5 rounded-xl p-3 flex flex-col gap-2 hover:border-emerald-500/30 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <MessageCircle size={14} className="text-[#25D366]" />
                          <span className="text-[12px] font-semibold text-white">WhatsApp Story &amp; Broadcast</span>
                        </div>
                        <span className="text-[9.5px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400">Instant</span>
                      </div>
                      <p className="text-[11px] text-[rgba(232,234,230,0.6)] line-clamp-1">
                        Bold specs, cash price, estimated monthly instalment &amp; 360 link.
                      </p>
                      <div className="flex items-center gap-2 pt-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(waText);
                            setSocialResult({ ok: true, message: "WhatsApp text copied!" });
                          }}
                          className="flex-1 py-1 bg-white/10 hover:bg-white/15 text-[11px] font-medium rounded-lg text-white flex items-center justify-center gap-1 cursor-pointer transition-colors"
                        >
                          <Copy size={11} /> Copy Text
                        </button>
                        <a
                          href={`https://wa.me/?text=${encodeURIComponent(waText)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-[11px] rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-colors"
                          title="Send to WhatsApp"
                        >
                          <span>Send</span>
                          <Send size={11} />
                        </a>
                      </div>
                    </div>

                    {/* Facebook Business Page */}
                    <div className="bg-black/30 border border-white/5 rounded-xl p-3 flex flex-col gap-2 hover:border-blue-600/30 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Facebook size={14} className="text-[#1877F2]" />
                          <span className="text-[12px] font-semibold text-white">Facebook Business Page</span>
                        </div>
                        <span className="text-[9.5px] font-mono px-1.5 py-0.2 rounded bg-blue-600/10 text-blue-400">Brand</span>
                      </div>
                      <p className="text-[11px] text-[rgba(232,234,230,0.6)] line-clamp-1">
                        Dealership arrival announcement with rich OpenGraph preview.
                      </p>
                      <div className="flex items-center gap-2 pt-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(fbPageText);
                            setSocialResult({ ok: true, message: "Facebook post copied!" });
                          }}
                          className="flex-1 py-1 bg-white/10 hover:bg-white/15 text-[11px] font-medium rounded-lg text-white flex items-center justify-center gap-1 cursor-pointer transition-colors"
                        >
                          <Copy size={11} /> Copy Post
                        </button>
                        <a
                          href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-[11px] rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-colors"
                          title="Share to Facebook"
                        >
                          <span>Share</span>
                          <ExternalLink size={11} />
                        </a>
                      </div>
                    </div>

                    {/* Instagram */}
                    <div className="bg-black/30 border border-white/5 rounded-xl p-3 flex flex-col gap-2 hover:border-pink-500/30 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Instagram size={14} className="text-[#E4405F]" />
                          <span className="text-[12px] font-semibold text-white">Instagram Feed &amp; Story</span>
                        </div>
                        <span className="text-[9.5px] font-mono px-1.5 py-0.2 rounded bg-pink-500/10 text-pink-400">Feed/Story</span>
                      </div>
                      <p className="text-[11px] text-[rgba(232,234,230,0.6)] line-clamp-1">
                        Aesthetic bulleted caption, financing breakdown &amp; smart hashtags.
                      </p>
                      <div className="flex items-center gap-2 pt-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(igData.caption);
                            setSocialResult({ ok: true, message: "Instagram caption copied!" });
                          }}
                          className="flex-1 py-1 bg-white/10 hover:bg-white/15 text-[11px] font-medium rounded-lg text-white flex items-center justify-center gap-1 cursor-pointer transition-colors"
                        >
                          <Copy size={11} /> Copy Caption
                        </button>
                        <a
                          href="https://www.instagram.com"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 bg-pink-600/20 hover:bg-pink-600/30 text-pink-400 text-[11px] rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-colors"
                          title="Open Instagram"
                        >
                          <span>Open</span>
                          <ExternalLink size={11} />
                        </a>
                      </div>
                    </div>

                    {/* LinkedIn & Google Business in 2 cols */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(liText);
                          setSocialResult({ ok: true, message: "LinkedIn post copied!" });
                        }}
                        className="py-2 px-2.5 bg-black/30 hover:bg-black/40 border border-white/5 hover:border-blue-700/30 rounded-xl text-left cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-1.5 text-blue-400 text-[11.5px] font-semibold mb-0.5">
                          <Linkedin size={13} /> LinkedIn B2B
                        </div>
                        <span className="text-[10px] text-[rgba(232,234,230,0.5)] block">Click to copy post</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(gbpData.summary);
                          setSocialResult({ ok: true, message: "Google Business update copied!" });
                        }}
                        className="py-2 px-2.5 bg-black/30 hover:bg-black/40 border border-white/5 hover:border-amber-500/30 rounded-xl text-left cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-1.5 text-[#4285F4] text-[11.5px] font-semibold mb-0.5">
                          <Globe size={13} /> Google Business
                        </div>
                        <span className="text-[10px] text-[rgba(232,234,230,0.5)] block">Click to copy update</span>
                      </button>
                    </div>
                  </div>

                  {socialResult && (
                    <div className="text-[12px] px-3 py-1.5 rounded-lg border text-emerald-400 bg-emerald-500/10 border-emerald-500/20 flex items-center gap-1.5 animate-in fade-in">
                      <Check size={13} />
                      <span>{socialResult.message}</span>
                    </div>
                  )}
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
            onClick={() => { void openStockWhatsApp(vehicle as any, undefined, market); }}
            aria-label="WhatsApp this vehicle to a customer"
            className="h-[56px] w-[56px] shrink-0 grid place-items-center rounded-xl text-[color:var(--white)] bg-[color:var(--glass)] border border-[color:var(--glass-line)] cursor-pointer"
          >
            <MessageCircle size={18} />
          </button>
          <button
            type="button"
            onClick={() => setShowSocialModal(true)}
            aria-label="TruSocial 1-Click Pack"
            title="TruSocial 1-Click Pack"
            className="h-[56px] w-[56px] shrink-0 grid place-items-center rounded-xl text-[color:var(--cyan)] hover:text-white bg-[color:var(--glass)] hover:bg-[color:var(--cyan-soft)] border border-[color:var(--glass-line)] cursor-pointer transition-all"
          >
            <Share2 size={18} />
          </button>
        </div>
      </div>

      {/* Outright Purchase OTP Modal */}
      {showOutrightOtp && (() => {
        const ds = dealership?.docSettings;
        const terms = ds?.otpOutrightTerms?.length ? ds.otpOutrightTerms : (ds?.saleTerms?.length ? ds.saleTerms : [
          "This offer is valid for 7 (seven) calendar days from date of issue.",
          "The vehicle is purchased voetstoots (as-is) unless otherwise specified.",
          "Payment will be made by electronic funds transfer within 3 business days of acceptance.",
          "Transfer of ownership is subject to receipt of all required documentation.",
        ]);
        const offerAmount = vehicle.costPrice || vehicle.retailPrice || 0;
        const today = new Date().toLocaleDateString(market.locale, { day: "numeric", month: "long", year: "numeric" });

        return (
          <div className="fixed inset-0 bg-black/70 z-[350] flex items-center justify-center p-6" onClick={() => setShowOutrightOtp(false)}>
            <div className="bg-white rounded-xl w-full max-w-[800px] max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="p-8 text-black" id="otp-outright-print">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    {ds?.logo && <img src={ds.logo} alt="" className="h-12 object-contain mb-2" />}
                    <h2 className="text-xl font-bold">{dealership?.name || "Dealership"}</h2>
                    {dealership?.tradingAs && <p className="text-sm text-gray-500">t/a {dealership.tradingAs}</p>}
                    {dealership?.address && <p className="text-xs text-gray-400 mt-1">{dealership.address}</p>}
                  </div>
                  <div className="text-right">
                    <h3 className="text-lg font-bold text-gray-800">OFFER TO PURCHASE</h3>
                    <p className="text-sm text-gray-500">Outright Vehicle Purchase</p>
                    <p className="text-sm text-gray-400 mt-1">{today}</p>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-4 mb-4">
                  <h4 className="font-semibold text-sm text-gray-700 mb-2">SELLER DETAILS</h4>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
                    <div className="flex gap-2"><span className="text-gray-400 w-24 shrink-0">Name:</span><span className="border-b border-gray-300 flex-1 min-h-[20px]">{(vehicle as any).supplier || ""}</span></div>
                    <div className="flex gap-2"><span className="text-gray-400 w-24 shrink-0">ID / Reg Nr:</span><span className="border-b border-gray-300 flex-1 min-h-[20px]"></span></div>
                    <div className="flex gap-2"><span className="text-gray-400 w-24 shrink-0">Phone:</span><span className="border-b border-gray-300 flex-1 min-h-[20px]"></span></div>
                    <div className="flex gap-2"><span className="text-gray-400 w-24 shrink-0">Address:</span><span className="border-b border-gray-300 flex-1 min-h-[20px]"></span></div>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-4 mb-4">
                  <h4 className="font-semibold text-sm text-gray-700 mb-2">VEHICLE DETAILS</h4>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
                    <div className="flex gap-2"><span className="text-gray-400 w-24 shrink-0">Make:</span><span>{vehicle.make}</span></div>
                    <div className="flex gap-2"><span className="text-gray-400 w-24 shrink-0">Model:</span><span>{vehicle.model}</span></div>
                    <div className="flex gap-2"><span className="text-gray-400 w-24 shrink-0">Year:</span><span>{vehicle.year}</span></div>
                    <div className="flex gap-2"><span className="text-gray-400 w-24 shrink-0">Variant:</span><span>{(vehicle as any).variant || ""}</span></div>
                    <div className="flex gap-2"><span className="text-gray-400 w-24 shrink-0">VIN / Chassis:</span><span>{(vehicle as any).chassisNumber || ""}</span></div>
                    <div className="flex gap-2"><span className="text-gray-400 w-24 shrink-0">Engine Nr:</span><span>{(vehicle as any).engineNumber || ""}</span></div>
                    <div className="flex gap-2"><span className="text-gray-400 w-24 shrink-0">Registration:</span><span>{(vehicle as any).registrationNumber || ""}</span></div>
                    <div className="flex gap-2"><span className="text-gray-400 w-24 shrink-0">Mileage:</span><span>{vehicle.mileage ? formatDistance(Number(vehicle.mileage), market.distanceUnit, market.locale) : "0"}</span></div>
                    <div className="flex gap-2"><span className="text-gray-400 w-24 shrink-0">Colour:</span><span>{(vehicle as any).colour || (vehicle as any).color || ""}</span></div>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-4 mb-4">
                  <h4 className="font-semibold text-sm text-gray-700 mb-2">OFFER</h4>
                  <p className="text-sm">
                    The Buyer hereby offers to purchase the above-described vehicle for the amount of:
                  </p>
                  <p className="text-2xl font-bold mt-2 mb-1">
                    {moneyDoc(offerAmount)}
                  </p>
                  <p className="text-xs text-gray-500">
                    ({numberToWords(offerAmount)} {currencyName})
                  </p>
                  {(vehicle as any).settlementAmount > 0 && (
                    <p className="text-sm text-gray-600 mt-2">
                      Settlement amount of {moneyDoc((vehicle as any).settlementAmount)} to be deducted,
                      net payable to seller: {moneyDoc(offerAmount - (vehicle as any).settlementAmount)}
                    </p>
                  )}
                </div>

                <div className="border-t border-gray-200 pt-4 mb-6">
                  <h4 className="font-semibold text-sm text-gray-700 mb-2">TERMS & CONDITIONS</h4>
                  <ol className="list-decimal list-inside text-sm space-y-1.5 text-gray-600">
                    {terms.map((t, i) => <li key={i}>{t}</li>)}
                  </ol>
                </div>

                <div className="border-t border-gray-200 pt-6 grid grid-cols-2 gap-8">
                  <div>
                    <p className="text-xs text-gray-400 mb-8">BUYER (Dealer)</p>
                    <div className="border-b border-gray-400 mb-1"></div>
                    <p className="text-xs text-gray-500">Signature & Date</p>
                    <p className="text-sm font-medium mt-1">{dealership?.name || ""}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-8">SELLER</p>
                    <div className="border-b border-gray-400 mb-1"></div>
                    <p className="text-xs text-gray-500">Signature & Date</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
                <button
                  type="button"
                  onClick={() => setShowOutrightOtp(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById("otp-outright-print");
                    if (!el) return;
                    const w = window.open("", "_blank");
                    if (!w) return;
                    w.document.write(`<html><head><title>OTP - ${vehicle.year} ${vehicle.make} ${vehicle.model}</title><style>body{font-family:Arial,sans-serif;padding:40px;color:#111}@media print{button{display:none}}</style></head><body>${el.innerHTML}</body></html>`);
                    w.document.close();
                    w.print();
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-green-600 text-white hover:bg-green-700"
                >
                  <Printer size={14} /> Print OTP
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {showSocialModal && (
        <SocialShareModal
          vehicle={vehicle}
          dealership={dealership}
          onClose={() => setShowSocialModal(false)}
        />
      )}
    </div>
  );
}
