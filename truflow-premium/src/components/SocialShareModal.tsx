import React, { useState, useMemo } from "react";
import {
  X,
  Share2,
  Copy,
  Check,
  ExternalLink,
  Download,
  Facebook,
  Instagram,
  Linkedin,
  Globe,
  MessageCircle,
  ShoppingBag,
  RotateCcw,
  Image as ImageIcon,
  Loader2,
} from "lucide-react";
import { Vehicle, Dealership } from "../types";
import { useMarket } from "../contexts/MarketContext";
import {
  buildFacebookPagePost,
  buildFacebookMarketplacePack,
  buildInstagramPost,
  buildLinkedInPost,
  buildGoogleBusinessPost,
  buildWhatsAppStatusPost,
  buildVehicleShareUrl,
} from "../lib/socialGenerators";
import { formatMoney } from "./market";

interface SocialShareModalProps {
  vehicle: Vehicle;
  dealership?: Dealership | null;
  onClose: () => void;
}

type SocialChannel = "marketplace" | "fb_page" | "instagram" | "whatsapp" | "linkedin" | "google_business";

export const SocialShareModal: React.FC<SocialShareModalProps> = ({
  vehicle,
  dealership,
  onClose,
}) => {
  const { market } = useMarket();
  const [activeChannel, setActiveChannel] = useState<SocialChannel>("marketplace");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [downloadingPhotos, setDownloadingPhotos] = useState(false);
  const [downloadingSingle, setDownloadingSingle] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number>(0);

  const imagesList = useMemo(() => {
    const list: string[] = [];
    if (Array.isArray(vehicle.images)) {
      vehicle.images.forEach((img) => {
        if (img && typeof img === "string" && !list.includes(img)) list.push(img);
      });
    }
    if (vehicle.heroImage && !list.includes(vehicle.heroImage)) {
      list.unshift(vehicle.heroImage);
    }
    return list;
  }, [vehicle.images, vehicle.heroImage]);

  const dealerInput = useMemo(() => ({
    name: dealership?.name || "Our Dealership",
    tradingAs: dealership?.tradingAs,
    location: dealership?.location,
    address: dealership?.address,
    phone: "",
    whatsapp: "",
    websiteUrl: dealership?.websiteUrl,
    slug: dealership?.slug,
  }), [dealership]);

  const shareUrl = useMemo(() => buildVehicleShareUrl(vehicle, dealerInput), [vehicle, dealerInput]);

  // Default templates from generator
  const defaultTemplates = useMemo(() => {
    const mpPack = buildFacebookMarketplacePack(vehicle, dealerInput, market);
    const igPost = buildInstagramPost(vehicle, dealerInput, market);
    const gbpPost = buildGoogleBusinessPost(vehicle, dealerInput, market);

    return {
      marketplace: mpPack.bodyDescription,
      mpTitle: mpPack.suggestedTitle,
      fb_page: buildFacebookPagePost(vehicle, dealerInput, market),
      instagram: igPost.caption,
      igStoryLink: igPost.storyStickerUrl,
      whatsapp: buildWhatsAppStatusPost(vehicle, dealerInput, market),
      linkedin: buildLinkedInPost(vehicle, dealerInput, market),
      google_business: gbpPost.summary,
      gbpCtaText: gbpPost.ctaText,
      gbpTargetUrl: gbpPost.targetUrl,
    };
  }, [vehicle, dealerInput, market]);

  // Editable blurbs state per channel
  const [editedBlurbs, setEditedBlurbs] = useState<{ [key in SocialChannel]: string }>({
    marketplace: defaultTemplates.marketplace,
    fb_page: defaultTemplates.fb_page,
    instagram: defaultTemplates.instagram,
    whatsapp: defaultTemplates.whatsapp,
    linkedin: defaultTemplates.linkedin,
    google_business: defaultTemplates.google_business,
  });

  const [marketplaceTitle, setMarketplaceTitle] = useState(defaultTemplates.mpTitle);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleResetActiveChannel = () => {
    if (activeChannel === "marketplace") {
      setMarketplaceTitle(defaultTemplates.mpTitle);
    }
    setEditedBlurbs((prev) => ({
      ...prev,
      [activeChannel]: defaultTemplates[activeChannel],
    }));
  };

  const handleDownloadSinglePhoto = async () => {
    if (imagesList.length === 0) {
      alert("No photos available for this vehicle.");
      return;
    }
    setDownloadingSingle(true);
    try {
      const url = imagesList[selectedPhotoIndex] || imagesList[0];
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `${vehicle.year}-${vehicle.make}-${vehicle.model}-selected.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Photo download error:", err);
      alert("Could not download photo automatically.");
    } finally {
      setDownloadingSingle(false);
    }
  };

  const handleDownloadPhotosPack = async () => {
    if (imagesList.length === 0) {
      alert("No photos uploaded for this vehicle yet. Shoot photos in TruLens first!");
      return;
    }
    setDownloadingPhotos(true);
    try {
      const topPhotos = imagesList.slice(0, 8);
      for (let i = 0; i < topPhotos.length; i++) {
        const url = topPhotos[i];
        const res = await fetch(url);
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = `${vehicle.year}-${vehicle.make}-${vehicle.model}-photo-${i + 1}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
        await new Promise((r) => setTimeout(r, 200));
      }
    } catch (err) {
      console.error("Photo download error:", err);
      alert("Could not download photos automatically. Please save them from the gallery.");
    } finally {
      setDownloadingPhotos(false);
    }
  };

  const channels: { id: SocialChannel; label: string; icon: React.ReactNode; color: string; badge?: string }[] = [
    { id: "marketplace", label: "FB Marketplace", icon: <ShoppingBag size={15} />, color: "#0084FF", badge: "High Volume" },
    { id: "fb_page", label: "Facebook Page", icon: <Facebook size={15} />, color: "#1877F2", badge: "Brand" },
    { id: "instagram", label: "Instagram", icon: <Instagram size={15} />, color: "#E4405F", badge: "Feed & Story" },
    { id: "whatsapp", label: "WhatsApp Status", icon: <MessageCircle size={15} />, color: "#25D366", badge: "Direct" },
    { id: "linkedin", label: "LinkedIn", icon: <Linkedin size={15} />, color: "#0A66C2", badge: "B2B Fleet" },
    { id: "google_business", label: "Google Business", icon: <Globe size={15} />, color: "#4285F4", badge: "Local Maps" },
  ];

  const currentBlurb = editedBlurbs[activeChannel];
  const charCount = currentBlurb.length;
  const wordCount = currentBlurb.trim() ? currentBlurb.trim().split(/\s+/).length : 0;
  const isModified = currentBlurb !== defaultTemplates[activeChannel] || (activeChannel === "marketplace" && marketplaceTitle !== defaultTemplates.mpTitle);

  const selectedImage = imagesList[selectedPhotoIndex] || imagesList[0] || "";
  const domainDisplay = dealership?.websiteUrl
    ? dealership.websiteUrl.replace(/^https?:\/\//, "").replace(/\/.*$/, "")
    : "trudealer.tru-saas.com";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[color:var(--ink-2,#0F1923)] border border-white/10 rounded-2xl w-full max-w-5xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden text-[color:var(--white,#fff)]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-black/30">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[color:var(--cyan-soft,rgba(11,124,114,0.2))] text-[color:var(--cyan,#0B7C72)] flex items-center justify-center">
              <Share2 size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[16px] font-bold tracking-tight">TruSocial Command Hub</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                  1-Click Distribution
                </span>
              </div>
              <p className="text-[12px] text-[rgba(232,234,230,0.6)]">
                {vehicle.year} {vehicle.make} {vehicle.model} {vehicle.trim || ""} · Stock #{vehicle.stockNumber}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[rgba(232,234,230,0.6)] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Channel Selection Tabs */}
        <div className="flex items-center gap-1.5 px-6 pt-3 pb-1 border-b border-white/5 bg-black/20 overflow-x-auto no-scrollbar">
          {channels.map((c) => {
            const isActive = activeChannel === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveChannel(c.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-[12.5px] font-medium transition-all whitespace-nowrap cursor-pointer border ${
                  isActive
                    ? "bg-white/10 border-white/20 text-white shadow-sm"
                    : "border-transparent text-[rgba(232,234,230,0.65)] hover:text-white hover:bg-white/5"
                }`}
              >
                <span style={{ color: c.color }}>{c.icon}</span>
                <span>{c.label}</span>
                {c.badge && (
                  <span className="text-[9px] px-1.5 py-0.2 rounded font-mono uppercase bg-black/40 text-[rgba(232,234,230,0.5)]">
                    {c.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Modal Main Body (2 Columns on Large Screens) */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left / Primary Column: Channel Copy & Editor */}
          <div className="lg:col-span-7 space-y-5">
            
            {/* Channel Info Banner */}
            {activeChannel === "marketplace" && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3.5 flex items-start gap-3">
                <ShoppingBag className="text-blue-400 shrink-0 mt-0.5" size={17} />
                <div className="text-[12px] text-blue-200 leading-relaxed">
                  <strong>Meta Marketplace Rules:</strong> Algorithms penalize keyword-stuffed titles and financing claims. This pack is generated with clean vehicle identifiers and structured specs for maximum buyer reach.
                </div>
              </div>
            )}

            {/* Marketplace Title & Price Customization */}
            {activeChannel === "marketplace" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2 bg-black/30 border border-white/10 rounded-xl p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10.5px] font-mono uppercase text-[color:var(--cyan)]">Marketplace Title</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(marketplaceTitle, "mp-title")}
                      className="text-xs px-2 py-0.5 bg-white/10 hover:bg-white/20 rounded text-[rgba(232,234,230,0.8)] cursor-pointer flex items-center gap-1"
                    >
                      {copiedKey === "mp-title" ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                      {copiedKey === "mp-title" ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <input
                    type="text"
                    value={marketplaceTitle}
                    onChange={(e) => setMarketplaceTitle(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-[13.5px] font-semibold text-white outline-none focus:border-[color:var(--cyan)] transition-colors"
                  />
                </div>

                <div className="bg-black/30 border border-white/10 rounded-xl p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10.5px] font-mono uppercase text-[color:var(--cyan)]">Listing Price</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(String(vehicle.retailPrice), "mp-price")}
                      className="text-xs px-2 py-0.5 bg-white/10 hover:bg-white/20 rounded text-[rgba(232,234,230,0.8)] cursor-pointer flex items-center gap-1"
                    >
                      {copiedKey === "mp-price" ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                      {copiedKey === "mp-price" ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <div className="text-[15px] font-bold text-white py-1">
                    {formatMoney(vehicle.retailPrice, { currency: market.currency, locale: market.locale })}
                  </div>
                </div>
              </div>
            )}

            {/* Editable Blurb Textarea */}
            <div className="bg-black/30 border border-white/10 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[11.5px] font-mono uppercase text-[rgba(232,234,230,0.7)]">
                    Listing Blurb &amp; Copy (Editable)
                  </span>
                  {isModified && (
                    <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300">
                      Edited
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isModified && (
                    <button
                      type="button"
                      onClick={handleResetActiveChannel}
                      className="text-xs px-2 py-1 bg-white/5 hover:bg-white/10 rounded text-[rgba(232,234,230,0.7)] hover:text-white cursor-pointer flex items-center gap-1 transition-colors"
                      title="Reset to generated template"
                    >
                      <RotateCcw size={11} />
                      <span>Reset</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleCopy(currentBlurb, `copy-${activeChannel}`)}
                    className="text-xs px-3 py-1.5 bg-[color:var(--cyan)] hover:bg-opacity-90 text-white rounded-lg cursor-pointer flex items-center gap-1.5 font-medium transition-all shadow-sm"
                  >
                    {copiedKey === `copy-${activeChannel}` ? <Check size={13} className="text-white" /> : <Copy size={13} />}
                    {copiedKey === `copy-${activeChannel}` ? "Copied to Clipboard!" : "Copy Blurb"}
                  </button>
                </div>
              </div>

              <textarea
                rows={11}
                value={currentBlurb}
                onChange={(e) => {
                  const val = e.target.value;
                  setEditedBlurbs((prev) => ({ ...prev, [activeChannel]: val }));
                }}
                placeholder="Write or customize your vehicle marketing blurb here..."
                className="w-full bg-black/40 border border-white/10 focus:border-[color:var(--cyan)] rounded-xl p-3.5 text-[13px] text-[rgba(232,234,230,0.9)] leading-relaxed outline-none resize-y transition-colors font-sans"
              />

              <div className="flex items-center justify-between text-[11px] font-mono text-[rgba(232,234,230,0.5)] pt-0.5">
                <span>{wordCount} words · {charCount} characters</span>
                <span>Direct edits are preserved when switching channels</span>
              </div>
            </div>

            {/* Platform Direct Share Action */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="text-[12px] text-[rgba(232,234,230,0.6)]">
                {activeChannel === "marketplace" && "Copy title & description above, then paste directly into Marketplace."}
                {activeChannel === "fb_page" && "Share public showroom link to Facebook timeline."}
                {activeChannel === "instagram" && "Copy caption & story link sticker, then post via Instagram."}
                {activeChannel === "whatsapp" && "Opens WhatsApp with your edited blurb pre-filled."}
                {activeChannel === "linkedin" && "Opens LinkedIn with your canonical link ready to post."}
                {activeChannel === "google_business" && "Post updates directly to your Google Business profile."}
              </div>

              {activeChannel === "marketplace" && (
                <a
                  href="https://www.facebook.com/marketplace/create/vehicle"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 bg-[#0084FF] hover:bg-[#0073e6] text-white font-semibold text-[12.5px] rounded-xl flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
                >
                  <span>Open Facebook Marketplace</span>
                  <ExternalLink size={13} />
                </a>
              )}

              {activeChannel === "fb_page" && (
                <a
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 bg-[#1877F2] hover:bg-blue-600 text-white font-semibold text-[12.5px] rounded-xl flex items-center gap-2 shadow-lg shadow-blue-600/20 transition-all cursor-pointer"
                >
                  <Facebook size={14} />
                  <span>Share to Facebook</span>
                  <ExternalLink size={13} />
                </a>
              )}

              {activeChannel === "instagram" && (
                <a
                  href="https://www.instagram.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 hover:opacity-90 text-white font-semibold text-[12.5px] rounded-xl flex items-center gap-2 shadow-lg transition-all cursor-pointer"
                >
                  <Instagram size={14} />
                  <span>Open Instagram Web</span>
                  <ExternalLink size={13} />
                </a>
              )}

              {activeChannel === "whatsapp" && (
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(currentBlurb)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 bg-[#25D366] hover:bg-[#20bd5a] text-black font-semibold text-[12.5px] rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
                >
                  <MessageCircle size={15} />
                  <span>Send via WhatsApp</span>
                  <ExternalLink size={13} />
                </a>
              )}

              {activeChannel === "linkedin" && (
                <a
                  href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 bg-[#0A66C2] hover:bg-blue-700 text-white font-semibold text-[12.5px] rounded-xl flex items-center gap-2 shadow-lg shadow-blue-700/20 transition-all cursor-pointer"
                >
                  <Linkedin size={14} />
                  <span>Share on LinkedIn</span>
                  <ExternalLink size={13} />
                </a>
              )}

              {activeChannel === "google_business" && (
                <a
                  href="https://business.google.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 bg-[#4285F4] hover:bg-blue-600 text-white font-semibold text-[12.5px] rounded-xl flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
                >
                  <Globe size={14} />
                  <span>Open Google Business Profile</span>
                  <ExternalLink size={13} />
                </a>
              )}
            </div>

          </div>

          {/* Right / Secondary Column: Photo Selector & Live Open Graph (OG) Preview */}
          <div className="lg:col-span-5 space-y-4">
            
            {/* Photo Selection Header */}
            <div className="bg-black/30 border border-white/10 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11.5px] font-mono uppercase text-[color:var(--cyan)]">
                  Select Photo ({imagesList.length} Available)
                </span>
                <span className="text-[11px] text-[rgba(232,234,230,0.5)] font-mono">
                  {imagesList.length ? selectedPhotoIndex + 1 : 0} of {imagesList.length}
                </span>
              </div>

              {/* Thumbnail selector */}
              {imagesList.length > 0 ? (
                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                  {imagesList.map((img, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedPhotoIndex(idx)}
                      className={`relative w-16 h-12 rounded-lg overflow-hidden shrink-0 border-2 transition-all cursor-pointer ${
                        idx === selectedPhotoIndex
                          ? "border-[color:var(--cyan)] ring-2 ring-[color:var(--cyan)]/30 scale-105"
                          : "border-white/10 opacity-60 hover:opacity-100"
                      }`}
                    >
                      <img src={img} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                      {idx === selectedPhotoIndex && (
                        <div className="absolute inset-0 bg-[color:var(--cyan)]/20 flex items-center justify-center">
                          <Check size={12} className="text-white drop-shadow" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-[12px] text-[rgba(232,234,230,0.5)] border border-dashed border-white/10 rounded-lg">
                  No vehicle photos uploaded yet. Shoot in TruLens.
                </div>
              )}

              {/* Photo Actions */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleDownloadSinglePhoto}
                  disabled={downloadingSingle || imagesList.length === 0}
                  className="px-2.5 py-1.5 bg-white/10 hover:bg-white/15 rounded-lg text-[11.5px] font-medium text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40"
                >
                  {downloadingSingle ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                  <span>Download Photo</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadPhotosPack}
                  disabled={downloadingPhotos || imagesList.length === 0}
                  className="px-2.5 py-1.5 bg-white/10 hover:bg-white/15 rounded-lg text-[11.5px] font-medium text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40"
                >
                  {downloadingPhotos ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                  <span>8-Photo Pack</span>
                </button>
              </div>
            </div>

            {/* Live Open Graph (OG) Social Card Preview */}
            <div className="bg-black/30 border border-white/10 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11.5px] font-mono uppercase text-[rgba(232,234,230,0.7)]">
                  Live Open Graph (OG) Preview
                </span>
                <span className="text-[9.5px] font-mono uppercase px-1.5 py-0.2 rounded bg-white/10 text-[rgba(232,234,230,0.7)]">
                  Social Card
                </span>
              </div>

              {/* The Unfurl Social Card */}
              <div className="border border-white/15 rounded-xl overflow-hidden bg-[color:var(--ink-3,#16212D)] shadow-xl transition-all">
                {/* Social Image Frame */}
                <div className="relative aspect-[16/9] w-full bg-black/60 flex items-center justify-center overflow-hidden">
                  {selectedImage ? (
                    <img
                      src={selectedImage}
                      alt="Social Preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-1.5 text-[rgba(232,234,230,0.4)]">
                      <ImageIcon size={28} />
                      <span className="text-[11px] font-mono">No Image Selected</span>
                    </div>
                  )}
                  <div className="absolute top-2.5 left-2.5 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-mono text-white/90 border border-white/10">
                    {domainDisplay}
                  </div>
                </div>

                {/* Card Text Footer */}
                <div className="p-3.5 space-y-1">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-[color:var(--cyan)]">
                    {dealership?.tradingAs || dealership?.name || "TruDealer Showroom"}
                  </div>
                  <h4 className="text-[14px] font-bold text-white line-clamp-1">
                    {vehicle.year} {vehicle.make} {vehicle.model} {vehicle.trim || ""}
                  </h4>
                  <p className="text-[11.5px] text-[rgba(232,234,230,0.75)] line-clamp-2 leading-snug font-sans">
                    {currentBlurb.replace(/\n+/g, " ").slice(0, 160)}...
                  </p>
                </div>
              </div>

              {/* Story Sticker / Short Link Info */}
              <div className="flex items-center justify-between text-[11.5px] bg-black/40 border border-white/5 rounded-lg p-2.5 text-[rgba(232,234,230,0.7)]">
                <span className="truncate mr-2 font-mono text-[11px]">{shareUrl}</span>
                <button
                  type="button"
                  onClick={() => handleCopy(shareUrl, "og-link")}
                  className="text-xs px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-white cursor-pointer shrink-0 flex items-center gap-1"
                >
                  {copiedKey === "og-link" ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                  <span>{copiedKey === "og-link" ? "Copied" : "Copy Link"}</span>
                </button>
              </div>

            </div>

          </div>

        </div>

      </div>
    </div>
  );
};

