import React, { useState, useEffect } from "react";
import {
  Sparkles,
  ShoppingBag,
  Facebook,
  Instagram,
  MessageCircle,
  Linkedin,
  Globe,
  CheckCircle2,
  ShieldCheck,
  Share2,
  Save,
  Loader2,
} from "lucide-react";
import { authFetch } from "../lib/session";

interface TruSocialSettingsProps {
  dealershipId: string;
  dealerName?: string;
  truSocialEnabled?: boolean;
  onNotify: (title: string, message: string, type?: "info" | "warning" | "error") => void;
}

interface ChannelItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  color: string;
  badge: string;
  desc: string;
  detail: string;
}

const CHANNELS: ChannelItem[] = [
  {
    id: "marketplace",
    label: "Facebook Marketplace",
    icon: ShoppingBag,
    color: "#0084FF",
    badge: "80%+ of Leads",
    desc: "1-Click Title, Compliant Specs & 8-Photo Drag-and-Drop Pack",
    detail: "Meta prohibits 3rd-party automated API posting to Marketplace. TruSocial solves this with algorithm-compliant specs and a 1-click photo pack ready to drop into Marketplace.",
  },
  {
    id: "fb_page",
    label: "Facebook Business Page",
    icon: Facebook,
    color: "#1877F2",
    badge: "Brand Building",
    desc: "Rich post copy with verified pricing, specs, and clean link unfurling",
    detail: "Generates tailored copy with your dealership contact details and clean canonical vehicle URLs that unfurl high-res photo cards.",
  },
  {
    id: "instagram",
    label: "Instagram Feed & Stories",
    icon: Instagram,
    color: "#E4405F",
    badge: "Engagement",
    desc: "Aesthetic spacing, smart hashtags, specs, and story link stickers",
    detail: "Formatted for visual engagement with relevant automotive hashtags (#SouthAfricaCars, #AutoTraderSA) and story sticker links.",
  },
  {
    id: "whatsapp",
    label: "WhatsApp Status & Broadcast",
    icon: MessageCircle,
    color: "#25D366",
    badge: "Direct 1-on-1",
    desc: "High-contrast markdown formatting with instant buyer inquiry link",
    detail: "Bolded key figures (*Price*, *Mileage*, *Year*) designed for dealer broadcasts, status updates, and 1-tap buyer inquiry.",
  },
  {
    id: "linkedin",
    label: "LinkedIn Corporate",
    icon: Linkedin,
    color: "#0A66C2",
    badge: "B2B & Fleet",
    desc: "Executive tone highlighting VAT invoice eligibility and commercial fleet use",
    detail: "Perfect for premium bakkies, luxury SUVs, and commercial vehicles targeting business owners and fleet managers.",
  },
  {
    id: "google_business",
    label: "Google Business Profile",
    icon: Globe,
    color: "#4285F4",
    badge: "Local SEO",
    desc: "Local Search & Google Maps 'What's New / Product' announcement",
    detail: "Boosts local search presence and Google Maps discovery when potential buyers search for cars in your area.",
  },
];

export default function TruSocialSettings({
  dealershipId,
  dealerName,
  onNotify,
}: TruSocialSettingsProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [facebookPage, setFacebookPage] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [googleBusinessUrl, setGoogleBusinessUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");

  useEffect(() => {
    let mounted = true;
    async function loadDealerDetails() {
      if (!dealershipId) return;
      setLoading(true);
      try {
        const res = await authFetch(`/api/dealerships/${encodeURIComponent(dealershipId)}`);
        if (res.ok && mounted) {
          const d = await res.json();
          setFacebookPage(d.facebookPage || "");
          setInstagramHandle(d.instagramHandle || "");
          setWhatsappNumber(d.whatsappNumber || d.whatsapp || "");
          setGoogleBusinessUrl(d.googleBusinessUrl || "");
          setWebsiteUrl(d.websiteUrl || "");
        }
      } catch {
        /* best-effort fallback */
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadDealerDetails();
    return () => {
      mounted = false;
    };
  }, [dealershipId]);

  const saveChannels = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dealershipId) return;
    setSaving(true);
    try {
      const res = await authFetch(`/api/dealerships/${encodeURIComponent(dealershipId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facebookPage: facebookPage.trim(),
          instagramHandle: instagramHandle.trim().replace(/^@/, ""),
          whatsappNumber: whatsappNumber.trim(),
          googleBusinessUrl: googleBusinessUrl.trim(),
          websiteUrl: websiteUrl.trim(),
          truSocialEnabled: true,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Save failed");
      }
      onNotify("TruSocial", "Social profiles updated successfully.");
    } catch (err: any) {
      onNotify("TruSocial", err?.message || "Failed to save settings", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Overview Banner */}
      <div className="card border-[color:var(--glass-line)] bg-gradient-to-br from-[color:var(--ink-2)] to-black/40 p-5 rounded-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-[color:var(--cyan)]" />
              <h3 className="font-bold text-[15.5px] text-[color:var(--white)]">
                TruSocial 1-Click Command Hub
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-mono tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase font-semibold">
                Active on all stock
              </span>
            </div>
            <p className="text-[13px] text-[rgba(232,234,230,0.72)] leading-relaxed max-w-2xl">
              {dealerName ? <strong>{dealerName}</strong> : "Your dealership"} is equipped with native multi-channel marketing packs.
              Every vehicle in your inventory generates tailored, algorithm-compliant copy and photo packs for all major platforms.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="px-3.5 py-2 rounded-xl bg-black/40 border border-white/10 text-center">
              <div className="text-[16px] font-bold text-[color:var(--cyan)]">6</div>
              <div className="text-[10px] uppercase font-mono tracking-wider text-[rgba(232,234,230,0.55)]">Channels</div>
            </div>
            <div className="px-3.5 py-2 rounded-xl bg-black/40 border border-white/10 text-center">
              <div className="text-[16px] font-bold text-emerald-400">1-Click</div>
              <div className="text-[10px] uppercase font-mono tracking-wider text-[rgba(232,234,230,0.55)]">Packs</div>
            </div>
          </div>
        </div>

        {/* Facebook Marketplace Compliance Guarantee */}
        <div className="mt-4 p-3.5 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-start gap-3 text-[12.5px] text-blue-200">
          <ShieldCheck size={18} className="text-blue-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong className="text-white">Facebook Marketplace Compliance:</strong> Meta actively restricts and bans accounts using third-party automated posting bots.
            TruSocial protects your account with verified, human-assisted 1-Click Packs: pre-formatted compliant titles, clean vehicle specifications, and an 8-photo bundle ready to drag-and-drop into Marketplace in seconds.
          </div>
        </div>
      </div>

      {/* 6 Supported Channels Grid */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-mono uppercase tracking-wider text-[color:var(--cyan)] font-semibold">
            Supported Marketing Channels
          </span>
          <span className="text-[11px] text-[rgba(232,234,230,0.5)]">
            Open any vehicle &gt; tap &ldquo;Social &amp; Share&rdquo;
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {CHANNELS.map((ch) => {
            const IconComp = ch.icon;
            return (
              <div
                key={ch.id}
                className="bg-black/30 border border-white/5 hover:border-white/15 rounded-xl p-4 flex flex-col justify-between gap-3 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span style={{ color: ch.color }}>
                        <IconComp size={16} />
                      </span>
                      <span className="text-[13px] font-bold text-white">{ch.label}</span>
                    </div>
                    <span
                      className="text-[9.5px] font-mono px-2 py-0.5 rounded uppercase font-semibold"
                      style={{ background: `${ch.color}15`, color: ch.color }}
                    >
                      {ch.badge}
                    </span>
                  </div>
                  <p className="text-[12px] font-medium text-[rgba(232,234,230,0.85)] mb-1">
                    {ch.desc}
                  </p>
                  <p className="text-[11px] text-[rgba(232,234,230,0.55)] leading-relaxed">
                    {ch.detail}
                  </p>
                </div>

                <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-[rgba(232,234,230,0.4)]">
                  <span className="flex items-center gap-1 text-emerald-400 font-mono">
                    <CheckCircle2 size={11} /> Ready
                  </span>
                  <span>Native Generator</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dealership Social Channel Handles */}
      <div className="card border-[color:var(--glass-line)] p-5 rounded-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-semibold text-[14.5px] text-white flex items-center gap-2">
              <Share2 size={15} className="text-[color:var(--cyan)]" />
              Dealership Channel Profiles &amp; Target Links
            </h4>
            <p className="text-[12px] text-[rgba(232,234,230,0.55)] mt-0.5">
              These channels and handles are automatically embedded into your vehicle marketing copy and share links.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="py-8 flex items-center justify-center gap-2 text-[13px] text-[rgba(232,234,230,0.5)]">
            <Loader2 size={15} className="animate-spin text-[color:var(--cyan)]" />
            Loading profiles…
          </div>
        ) : (
          <form onSubmit={saveChannels} className="space-y-3.5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[11.5px] font-mono text-[rgba(232,234,230,0.7)] uppercase tracking-wider mb-1">
                  Facebook Page URL or Handle
                </label>
                <input
                  type="text"
                  value={facebookPage}
                  onChange={(e) => setFacebookPage(e.target.value)}
                  placeholder="e.g. facebook.com/carsoncaledon"
                  className="tru-input w-full text-[13px]"
                />
              </div>

              <div>
                <label className="block text-[11.5px] font-mono text-[rgba(232,234,230,0.7)] uppercase tracking-wider mb-1">
                  Instagram Handle
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-white/40">@</span>
                  <input
                    type="text"
                    value={instagramHandle}
                    onChange={(e) => setInstagramHandle(e.target.value)}
                    placeholder="e.g. carsoncaledon"
                    className="tru-input w-full text-[13px] pl-7"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11.5px] font-mono text-[rgba(232,234,230,0.7)] uppercase tracking-wider mb-1">
                  WhatsApp Business Number
                </label>
                <input
                  type="text"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  placeholder="e.g. 27618759389 (international format without +)"
                  className="tru-input w-full text-[13px]"
                />
              </div>

              <div>
                <label className="block text-[11.5px] font-mono text-[rgba(232,234,230,0.7)] uppercase tracking-wider mb-1">
                  Google Business Profile URL
                </label>
                <input
                  type="text"
                  value={googleBusinessUrl}
                  onChange={(e) => setGoogleBusinessUrl(e.target.value)}
                  placeholder="e.g. https://g.page/r/..."
                  className="tru-input w-full text-[13px]"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="btn btn-primary px-5 py-2 text-[12.5px] font-semibold flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                Save Channel Profiles
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

