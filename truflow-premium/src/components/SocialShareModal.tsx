import React, { useState } from "react";
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
  Sparkles,
  Layers,
  Send,
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
  estimateMonthlyPayment,
} from "../lib/socialGenerators";
import { formatMoney } from "./market";

interface SocialShareModalProps {
  vehicle: Vehicle;
  dealership?: Dealership | null;
  onClose: () => void;
}

type SocialChannel = "marketplace" | "fb_page" | "instagram" | "linkedin" | "google_business" | "whatsapp";

export const SocialShareModal: React.FC<SocialShareModalProps> = ({
  vehicle,
  dealership,
  onClose,
}) => {
  const { market } = useMarket();
  const [activeChannel, setActiveChannel] = useState<SocialChannel>("marketplace");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [downloadingPhotos, setDownloadingPhotos] = useState(false);

  const dealerInput = {
    name: dealership?.name || "Our Dealership",
    tradingAs: dealership?.tradingAs,
    location: dealership?.location,
    address: dealership?.address,
    phone: dealership?.bankingDetails?.accountNumber ? "" : "",
    whatsapp: "",
    websiteUrl: dealership?.websiteUrl,
    slug: dealership?.slug,
  };

  const shareUrl = buildVehicleShareUrl(vehicle, dealerInput);

  // Content generators
  const fbPageText = buildFacebookPagePost(vehicle, dealerInput, market);
  const marketplacePack = buildFacebookMarketplacePack(vehicle, dealerInput, market);
  const instagramData = buildInstagramPost(vehicle, dealerInput, market);
  const linkedInText = buildLinkedInPost(vehicle, dealerInput, market);
  const gbpData = buildGoogleBusinessPost(vehicle, dealerInput, market);
  const whatsAppText = buildWhatsAppStatusPost(vehicle, dealerInput, market);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleDownloadPhotos = async () => {
    if (!vehicle.images || vehicle.images.length === 0) {
      alert("No photos uploaded for this vehicle yet. Shoot photos in TruLens first!");
      return;
    }
    setDownloadingPhotos(true);
    try {
      const topPhotos = vehicle.images.slice(0, 8);
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
    { id: "marketplace", label: "FB Marketplace", icon: <ShoppingBag size={15} />, color: "#0084FF", badge: "High Leads" },
    { id: "fb_page", label: "Facebook Page", icon: <Facebook size={15} />, color: "#1877F2", badge: "Brand" },
    { id: "instagram", label: "Instagram", icon: <Instagram size={15} />, color: "#E4405F" },
    { id: "whatsapp", label: "WhatsApp Status", icon: <MessageCircle size={15} />, color: "#25D366", badge: "Instant" },
    { id: "linkedin", label: "LinkedIn", icon: <Linkedin size={15} />, color: "#0A66C2", badge: "B2B" },
    { id: "google_business", label: "Google Business", icon: <Globe size={15} />, color: "#4285F4", badge: "Local SEO" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[color:var(--ink-2,#0F1923)] border border-white/10 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-[color:var(--white,#fff)]">
        
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
                  1-Click Ready
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

        {/* Channel Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* 1. FACEBOOK MARKETPLACE */}
          {activeChannel === "marketplace" && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-start gap-3">
                <ShoppingBag className="text-blue-400 shrink-0 mt-0.5" size={18} />
                <div className="text-[12.5px] text-blue-200 leading-relaxed">
                  <strong>Meta Marketplace Rules:</strong> Algorithms penalize keyword-stuffed titles and banned finance phrasing. This pack is generated with clean vehicle identifiers and a structured specification list to maximize reach.
                </div>
              </div>

              {/* Title & Price Preview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2 bg-black/30 border border-white/10 rounded-xl p-3.5">
                  <span className="text-[10.5px] font-mono uppercase text-[color:var(--cyan)] block mb-1">Marketplace Title</span>
                  <div className="text-[14px] font-semibold text-white flex items-center justify-between">
                    <span>{marketplacePack.suggestedTitle}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(marketplacePack.suggestedTitle, "mp-title")}
                      className="text-xs px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-[rgba(232,234,230,0.8)] cursor-pointer flex items-center gap-1"
                    >
                      {copiedKey === "mp-title" ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      {copiedKey === "mp-title" ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>

                <div className="bg-black/30 border border-white/10 rounded-xl p-3.5">
                  <span className="text-[10.5px] font-mono uppercase text-[color:var(--cyan)] block mb-1">Listing Price</span>
                  <div className="text-[16px] font-bold text-white flex items-center justify-between">
                    <span>{formatMoney(marketplacePack.price, { currency: market.currency, locale: market.locale })}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(String(marketplacePack.price), "mp-price")}
                      className="text-xs px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-[rgba(232,234,230,0.8)] cursor-pointer flex items-center gap-1"
                    >
                      {copiedKey === "mp-price" ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      {copiedKey === "mp-price" ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Description Body */}
              <div className="bg-black/30 border border-white/10 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase text-[rgba(232,234,230,0.6)]">Listing Description</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(marketplacePack.bodyDescription, "mp-desc")}
                    className="text-xs px-3 py-1.5 bg-[color:var(--cyan)] hover:bg-opacity-90 text-white rounded-lg cursor-pointer flex items-center gap-1.5 font-medium transition-all"
                  >
                    {copiedKey === "mp-desc" ? <Check size={13} className="text-white" /> : <Copy size={13} />}
                    {copiedKey === "mp-desc" ? "Description Copied!" : "Copy Full Description"}
                  </button>
                </div>
                <textarea
                  readOnly
                  rows={8}
                  value={marketplacePack.bodyDescription}
                  className="w-full bg-black/40 border border-white/5 rounded-lg p-3 text-[12.5px] text-[rgba(232,234,230,0.85)] font-mono leading-relaxed outline-none resize-none"
                />
              </div>

              {/* Bottom Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleDownloadPhotos}
                  disabled={downloadingPhotos}
                  className="px-4 py-2.5 bg-white/10 hover:bg-white/15 border border-white/15 rounded-xl text-[13px] font-medium cursor-pointer flex items-center gap-2 transition-all disabled:opacity-50"
                >
                  {downloadingPhotos ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  <span>{downloadingPhotos ? "Downloading Photos..." : "Download 8-Photo Pack"}</span>
                </button>

                <a
                  href="https://www.facebook.com/marketplace/create/vehicle"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-2.5 bg-[#0084FF] hover:bg-[#0073e6] text-white font-semibold text-[13px] rounded-xl flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
                >
                  <span>Open Facebook Marketplace</span>
                  <ExternalLink size={14} />
                </a>
              </div>
            </div>
          )}

          {/* 2. FACEBOOK BUSINESS PAGE */}
          {activeChannel === "fb_page" && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="bg-black/30 border border-white/10 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Facebook size={16} className="text-blue-400" />
                    <span className="text-[13px] font-semibold text-white">Dealership Page Post</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(fbPageText, "fb-page")}
                    className="text-xs px-3 py-1.5 bg-[color:var(--cyan)] hover:bg-opacity-90 text-white rounded-lg cursor-pointer flex items-center gap-1.5 font-medium transition-all"
                  >
                    {copiedKey === "fb-page" ? <Check size={13} /> : <Copy size={13} />}
                    {copiedKey === "fb-page" ? "Post Copied!" : "Copy Page Post"}
                  </button>
                </div>
                <textarea
                  readOnly
                  rows={10}
                  value={fbPageText}
                  className="w-full bg-black/40 border border-white/5 rounded-lg p-3 text-[13px] text-[rgba(232,234,230,0.9)] leading-relaxed outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <a
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-2.5 bg-[#1877F2] hover:bg-blue-600 text-white font-semibold text-[13px] rounded-xl flex items-center gap-2 shadow-lg shadow-blue-600/20 transition-all cursor-pointer"
                >
                  <Facebook size={15} />
                  <span>Share to Facebook Page</span>
                  <ExternalLink size={14} />
                </a>
              </div>
            </div>
          )}

          {/* 3. INSTAGRAM */}
          {activeChannel === "instagram" && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="bg-black/30 border border-white/10 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Instagram size={16} className="text-pink-400" />
                    <span className="text-[13px] font-semibold text-white">Feed / Reels Caption</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(instagramData.caption, "ig-caption")}
                    className="text-xs px-3 py-1.5 bg-[color:var(--cyan)] hover:bg-opacity-90 text-white rounded-lg cursor-pointer flex items-center gap-1.5 font-medium transition-all"
                  >
                    {copiedKey === "ig-caption" ? <Check size={13} /> : <Copy size={13} />}
                    {copiedKey === "ig-caption" ? "Caption Copied!" : "Copy Instagram Caption"}
                  </button>
                </div>
                <textarea
                  readOnly
                  rows={9}
                  value={instagramData.caption}
                  className="w-full bg-black/40 border border-white/5 rounded-lg p-3 text-[13px] text-[rgba(232,234,230,0.9)] leading-relaxed outline-none resize-none"
                />
              </div>

              {/* Story Sticker Link */}
              <div className="bg-black/30 border border-white/10 rounded-xl p-4 flex items-center justify-between gap-4">
                <div>
                  <span className="text-[11px] font-mono uppercase text-pink-400 block mb-0.5">Instagram Story Link Sticker</span>
                  <span className="text-[12.5px] text-[rgba(232,234,230,0.7)] truncate block max-w-md">{instagramData.storyStickerUrl}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(instagramData.storyStickerUrl, "ig-sticker")}
                  className="text-xs px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white cursor-pointer flex items-center gap-1.5 shrink-0"
                >
                  {copiedKey === "ig-sticker" ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  {copiedKey === "ig-sticker" ? "Link Copied" : "Copy Story Link"}
                </button>
              </div>

              <div className="flex justify-end pt-2">
                <a
                  href="https://www.instagram.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-2.5 bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 hover:opacity-90 text-white font-semibold text-[13px] rounded-xl flex items-center gap-2 shadow-lg transition-all cursor-pointer"
                >
                  <Instagram size={15} />
                  <span>Open Instagram Web</span>
                  <ExternalLink size={14} />
                </a>
              </div>
            </div>
          )}

          {/* 4. WHATSAPP STATUS & BROADCAST */}
          {activeChannel === "whatsapp" && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageCircle size={16} className="text-emerald-400" />
                    <span className="text-[13px] font-semibold text-white">WhatsApp Status &amp; Broadcast Text</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(whatsAppText, "wa-text")}
                    className="text-xs px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg cursor-pointer flex items-center gap-1.5 font-medium transition-all"
                  >
                    {copiedKey === "wa-text" ? <Check size={13} /> : <Copy size={13} />}
                    {copiedKey === "wa-text" ? "Status Copied!" : "Copy WhatsApp Text"}
                  </button>
                </div>
                <textarea
                  readOnly
                  rows={9}
                  value={whatsAppText}
                  className="w-full bg-black/40 border border-emerald-500/20 rounded-lg p-3 text-[13px] text-emerald-100 font-mono leading-relaxed outline-none resize-none"
                />
              </div>

              <div className="flex justify-end pt-2">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(whatsAppText)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-2.5 bg-[#25D366] hover:bg-[#20bd5a] text-black font-semibold text-[13px] rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
                >
                  <MessageCircle size={16} />
                  <span>Send via WhatsApp</span>
                  <ExternalLink size={14} />
                </a>
              </div>
            </div>
          )}

          {/* 5. LINKEDIN */}
          {activeChannel === "linkedin" && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="bg-black/30 border border-white/10 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Linkedin size={16} className="text-blue-400" />
                    <span className="text-[13px] font-semibold text-white">LinkedIn B2B / Executive Post</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(linkedInText, "li-text")}
                    className="text-xs px-3 py-1.5 bg-[color:var(--cyan)] hover:bg-opacity-90 text-white rounded-lg cursor-pointer flex items-center gap-1.5 font-medium transition-all"
                  >
                    {copiedKey === "li-text" ? <Check size={13} /> : <Copy size={13} />}
                    {copiedKey === "li-text" ? "Post Copied!" : "Copy LinkedIn Post"}
                  </button>
                </div>
                <textarea
                  readOnly
                  rows={9}
                  value={linkedInText}
                  className="w-full bg-black/40 border border-white/5 rounded-lg p-3 text-[13px] text-[rgba(232,234,230,0.9)] leading-relaxed outline-none resize-none"
                />
              </div>

              <div className="flex justify-end pt-2">
                <a
                  href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-2.5 bg-[#0A66C2] hover:bg-blue-700 text-white font-semibold text-[13px] rounded-xl flex items-center gap-2 shadow-lg shadow-blue-700/20 transition-all cursor-pointer"
                >
                  <Linkedin size={15} />
                  <span>Share on LinkedIn</span>
                  <ExternalLink size={14} />
                </a>
              </div>
            </div>
          )}

          {/* 6. GOOGLE BUSINESS PROFILE */}
          {activeChannel === "google_business" && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="bg-black/30 border border-white/10 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe size={16} className="text-blue-400" />
                    <span className="text-[13px] font-semibold text-white">Google Maps / What's New Update</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(gbpData.summary, "gbp-text")}
                    className="text-xs px-3 py-1.5 bg-[color:var(--cyan)] hover:bg-opacity-90 text-white rounded-lg cursor-pointer flex items-center gap-1.5 font-medium transition-all"
                  >
                    {copiedKey === "gbp-text" ? <Check size={13} /> : <Copy size={13} />}
                    {copiedKey === "gbp-text" ? "Update Copied!" : "Copy Google Update"}
                  </button>
                </div>
                <textarea
                  readOnly
                  rows={6}
                  value={gbpData.summary}
                  className="w-full bg-black/40 border border-white/5 rounded-lg p-3 text-[13px] text-[rgba(232,234,230,0.9)] leading-relaxed outline-none resize-none"
                />
                <div className="flex items-center gap-2 text-[12px] text-[rgba(232,234,230,0.6)]">
                  <span>Action Button Setting:</span>
                  <strong className="text-white bg-white/10 px-2 py-0.5 rounded">{gbpData.ctaText}</strong>
                  <span>with URL:</span>
                  <span className="text-blue-400 underline truncate max-w-xs">{gbpData.targetUrl}</span>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <a
                  href="https://business.google.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-2.5 bg-[#4285F4] hover:bg-blue-600 text-white font-semibold text-[13px] rounded-xl flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
                >
                  <Globe size={15} />
                  <span>Open Google Business Profile</span>
                  <ExternalLink size={14} />
                </a>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
