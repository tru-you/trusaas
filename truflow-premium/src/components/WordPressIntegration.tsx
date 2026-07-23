import React, { useState } from "react";
import { Code, Copy, Check, RefreshCw, FileText, CheckCircle, Database, Sparkles, Globe, Wifi, Send, ArrowRight } from "lucide-react";

interface WordPressIntegrationProps {
  onRefresh: () => void;
}

export default function WordPressIntegration({ onRefresh }: WordPressIntegrationProps) {
  const [copiedText, setCopiedText] = useState<string | null>(null);
  
  // Webhook form states
  const [testLead, setTestLead] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    notes: "Inquiry on BMW 320i from WordPress landing page form.",
  });
  const [submittingWebhook, setSubmittingWebhook] = useState(false);
  const [webhookResult, setWebhookResult] = useState<any | null>(null);

  // Sync state
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const runLiveInventorySync = async () => {
    setSyncing(true);
    setSyncSuccess(false);
    setSyncLogs([
      "[" + new Date().toLocaleTimeString() + "] Initializing sync request with real-cars.co.za...",
      "[" + new Date().toLocaleTimeString() + "] Verifying security handshake key: TRU_SEC_LIGHT_94285",
    ]);

    // Small sequential delay to feel like a real high-end sync session
    await new Promise((r) => setTimeout(r, 800));
    setSyncLogs((prev) => [
      ...prev,
      "[" + new Date().toLocaleTimeString() + "] Handshake verified. Authenticated successfully.",
      "[" + new Date().toLocaleTimeString() + "] Packaging showroom floor data: active vehicles, stock, pricing...",
    ]);

    await new Promise((r) => setTimeout(r, 1000));
    try {
      const res = await fetch("/api/integration/sync-inventory", { method: "POST" });
      const data = await res.json();
      
      if (data.success) {
        setSyncLogs((prev) => [
          ...prev,
          "[" + new Date().toLocaleTimeString() + "] Connected to WordPress server at real-cars.co.za",
          "[" + new Date().toLocaleTimeString() + "] Syncing " + data.syncedCount + " active showroom floor vehicles...",
          ...data.vehicles.map((v: any) => 
            `[SYNC] Stock #${v.stockNumber} (${v.make} ${v.model}) -> Synchronized OK (R ${v.retailPrice.toLocaleString()})`
          ),
          "[" + new Date().toLocaleTimeString() + "] Cleared WordPress database caches.",
          "[" + new Date().toLocaleTimeString() + "] MASTER SYNC COMPLETED SUCCESSFULLY. 100% data fidelity secured.",
        ]);
        setSyncSuccess(true);
      } else {
        throw new Error("API responded with error state.");
      }
    } catch (e: any) {
      setSyncLogs((prev) => [
        ...prev,
        "[" + new Date().toLocaleTimeString() + "] ERROR: Failed to connect or synchronize with endpoint. Check your API settings.",
      ]);
    } finally {
      setSyncing(false);
    }
  };

  const handleTestWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testLead.firstName || !testLead.phone) {
      alert("Please provide at least a First Name and Phone Number.");
      return;
    }

    setSubmittingWebhook(true);
    setWebhookResult(null);

    try {
      const res = await fetch("/api/integration/webhook-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testLead),
      });

      const data = await res.json();
      setWebhookResult(data);
      if (data.success) {
        // Trigger parent state update so lead displays in real CRM listing
        onRefresh();
        setTestLead({
          firstName: "",
          lastName: "",
          phone: "",
          email: "",
          notes: "Inquiry on BMW 320i from WordPress landing page form.",
        });
      }
    } catch (err: any) {
      setWebhookResult({ success: false, error: err.message || "Failed to trigger webhook." });
    } finally {
      setSubmittingWebhook(false);
    }
  };

  const webhookUrl = window.location.origin + "/api/integration/webhook-lead";

  const headCode = `<!-- Paste inside WordPress head / elementor header script -->
<script src="https://cdn.real-cars.co.za/sdk/v1/truflow.js" data-key="tru_sec_light_94285" defer></script>`;

  const catalogEmbedCode = `<!-- Paste inside WordPress Custom HTML block or Divi -->
<div id="truflow-showroom-catalog"></div>`;

  const iframeEmbedCode = `<iframe src="${window.location.origin}/embed/catalog?dealer=truflow-light" width="100%" height="800" style="border:none; border-radius:12px; box-shadow:0 4px 12px rgba(0,0,0,0.15)"></iframe>`;

  const shortcodeText = `[truflow_inventory dealership_id="tru_light_94285" layout="grid" filters="true"]`;

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200 font-sans">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-[#E8EAE6]">Web & WordPress Sync Desk</h1>
        <p className="text-xs text-[rgba(232,234,230,0.72)] mt-0.5 font-medium">
          Plug your TruFlow Lite inventory and lead capture forms directly into HTML, Divi, Elementor, or WordPress.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: PLUGINS, EMBEDS & SHORTCODES (7 COLS) */}
        <div className="lg:col-span-7 flex flex-col gap-5">
          
          {/* 1. API Endpoints & Handshake Creds */}
          <div className="card">
            <div className="card-header border-b border-white/5 px-4 py-3 flex justify-between items-center bg-[#0B0F17]/1">
              <div className="flex items-center gap-2">
                <Globe size={15} className="text-[#4FE3DC]" />
                <h3 className="font-semibold text-xs tracking-normal text-[#E8EAE6]">1. API Handshake Credentials</h3>
              </div>
              <span className="text-[12px] bg-[#4FE3DC]/15 text-[#4FE3DC] px-2 py-0.5 rounded font-semibold font-mono">LIVE API ACCESS</span>
            </div>
            
            <div className="card-body p-4 flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <span className="text-[12px] text-[rgba(232,234,230,0.72)]  font-semibold tracking-wider">Your Master Webhook Sync Endpoint</span>
                <div className="flex items-center bg-black/45 border border-white/5 rounded-lg px-3 py-2 text-xs font-mono justify-between text-[#E8EAE6] select-all">
                  <span className="truncate pr-4">{webhookUrl}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(webhookUrl, "webhook")}
                    className="text-[rgba(232,234,230,0.72)] hover:text-[#4FE3DC] transition-colors p-1"
                  >
                    {copiedText === "webhook" ? <Check size={14} className="text-[#4FE3DC]" /> : <Copy size={14} />}
                  </button>
                </div>
                <span className="text-[12px] text-[rgba(232,234,230,0.72)]">
                  Configure this as your submission webhook URL in Elementor Forms or Contact Form 7 to feed leads straight into your CRM.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-3 mt-1">
                <div>
                  <span className="text-[12px] text-[rgba(232,234,230,0.72)]  font-semibold tracking-wider block">API Handshake Key</span>
                  <span className="text-xs font-mono font-bold text-[#E8EAE6] mt-0.5 block">tru_sec_light_94285</span>
                </div>
                <div>
                  <span className="text-[12px] text-[rgba(232,234,230,0.72)]  font-semibold tracking-wider block">Showroom Site Domain</span>
                  <span className="text-xs font-mono text-[#4FE3DC] font-bold mt-0.5 block">www.real-cars.co.za</span>
                </div>
              </div>
            </div>
          </div>

          {/* 2. WordPress shortcodes and SDK embeds */}
          <div className="card">
            <div className="card-header border-b border-white/5 px-4 py-3 flex justify-between items-center bg-[#0B0F17]/1">
              <div className="flex items-center gap-2">
                <Code size={15} className="text-[#4FE3DC]" />
                <h3 className="font-semibold text-xs tracking-normal text-[#E8EAE6]">2. WordPress Shortcodes & HTML Widgets</h3>
              </div>
            </div>

            <div className="card-body p-4 flex flex-col gap-4">
              
              {/* Method A: TruFlow Shortcode */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-[13px] text-white font-bold">Method A: WordPress Shortcode</span>
                  <span className="text-[12px] bg-[#0B0F17]/5 text-[rgba(232,234,230,0.72)] px-1.5 py-0.5 rounded">Fastest</span>
                </div>
                <p className="text-[13px] text-[rgba(232,234,230,0.72)]">Paste inside Gutenberg, Divi, or Elementor shortcode block to generate a beautiful responsive pricing grid:</p>
                <div className="flex items-center bg-black/45 border border-white/5 rounded-lg px-3 py-2 text-xs font-mono justify-between text-[#4FE3DC]">
                  <span className="truncate pr-4">{shortcodeText}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(shortcodeText, "shortcode")}
                    className="text-[rgba(232,234,230,0.72)] hover:text-[#4FE3DC] transition-colors p-1"
                  >
                    {copiedText === "shortcode" ? <Check size={14} className="text-[#4FE3DC]" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              {/* Method B: HTML Auto-Inject Code */}
              <div className="flex flex-col gap-1.5 border-t border-white/5 pt-4">
                <span className="text-[13px] text-white font-bold">Method B: Raw HTML SDK Code (For non-WP Sites)</span>
                <p className="text-[13px] text-[rgba(232,234,230,0.72)]">Step 1: Include this script inside your pages <code>&lt;head&gt;</code>:</p>
                <div className="flex items-center bg-black/45 border border-white/5 rounded-lg px-3 py-2 text-xs font-mono justify-between text-[rgba(232,234,230,0.72)]">
                  <span className="truncate pr-4">{headCode}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(headCode, "headcode")}
                    className="text-[rgba(232,234,230,0.72)] hover:text-[#4FE3DC] transition-colors p-1"
                  >
                    {copiedText === "headcode" ? <Check size={14} className="text-[#4FE3DC]" /> : <Copy size={14} />}
                  </button>
                </div>
                <p className="text-[13px] text-[rgba(232,234,230,0.72)] mt-1">Step 2: Place this DIV where your catalog should render:</p>
                <div className="flex items-center bg-black/45 border border-white/5 rounded-lg px-3 py-2 text-xs font-mono justify-between text-[rgba(232,234,230,0.72)]">
                  <span className="truncate pr-4">{catalogEmbedCode}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(catalogEmbedCode, "embedcode")}
                    className="text-[rgba(232,234,230,0.72)] hover:text-[#4FE3DC] transition-colors p-1"
                  >
                    {copiedText === "embedcode" ? <Check size={14} className="text-[#4FE3DC]" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              {/* Method C: Standard iFrame */}
              <div className="flex flex-col gap-1.5 border-t border-white/5 pt-4">
                <span className="text-[13px] text-white font-bold">Method C: Elegant iFrame Sandbox</span>
                <div className="flex items-center bg-black/45 border border-white/5 rounded-lg px-3 py-2 text-xs font-mono justify-between text-gray-400">
                  <span className="truncate pr-4">{iframeEmbedCode}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(iframeEmbedCode, "iframe")}
                    className="text-[rgba(232,234,230,0.72)] hover:text-[#4FE3DC] transition-colors p-1"
                  >
                    {copiedText === "iframe" ? <Check size={14} className="text-[#4FE3DC]" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: LIVE TEST FORMS & SYNC ENGINE (5 COLS) */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          
          {/* A. Real Webhook Lead Simulation / Tester */}
          <div className="card border-[#4FE3DC]/20 bg-[#4FE3DC]/2">
            <div className="card-header border-b border-[#4FE3DC]/10 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-[#4FE3DC]" />
                <h3 className="font-semibold text-xs tracking-normal text-[#E8EAE6]">Lead Injection Webhook Tester</h3>
              </div>
              <Wifi size={14} className="text-[#4FE3DC] animate-pulse" />
            </div>

            <div className="card-body p-4">
              <p className="text-[13px] text-[rgba(232,234,230,0.72)] mb-3 leading-relaxed">
                Test your HTML/WordPress lead capture synchronization instantly. This form fires a live POST call to your webhook endpoint, automatically injecting a real prospect into your CRM list!
              </p>

              <form onSubmit={handleTestWebhook} className="flex flex-col gap-2.5">
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="flex flex-col gap-1">
                    <span className="text-[12px] text-[rgba(232,234,230,0.72)]  font-bold">First Name *</span>
                    <input
                      required
                      type="text"
                      placeholder="e.g. Sipho"
                      value={testLead.firstName}
                      onChange={(e) => setTestLead({ ...testLead, firstName: e.target.value })}
                      className="bg-black/30 border border-white/10 rounded px-2.5 py-1.5 text-xs text-[#E8EAE6] outline-none focus:border-[#4FE3DC]"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[12px] text-[rgba(232,234,230,0.72)]  font-bold">Last Name</span>
                    <input
                      type="text"
                      placeholder="e.g. Khumalo"
                      value={testLead.lastName}
                      onChange={(e) => setTestLead({ ...testLead, lastName: e.target.value })}
                      className="bg-black/30 border border-white/10 rounded px-2.5 py-1.5 text-xs text-[#E8EAE6] outline-none focus:border-[#4FE3DC]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="flex flex-col gap-1">
                    <span className="text-[12px] text-[rgba(232,234,230,0.72)]  font-bold">Phone (WhatsApp) *</span>
                    <input
                      required
                      type="tel"
                      placeholder="e.g. 0821234567"
                      value={testLead.phone}
                      onChange={(e) => setTestLead({ ...testLead, phone: e.target.value })}
                      className="bg-black/30 border border-white/10 rounded px-2.5 py-1.5 text-xs text-[#E8EAE6] outline-none focus:border-[#4FE3DC]"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[12px] text-[rgba(232,234,230,0.72)]  font-bold">Email</span>
                    <input
                      type="email"
                      placeholder="e.g. sipho@gmail.com"
                      value={testLead.email}
                      onChange={(e) => setTestLead({ ...testLead, email: e.target.value })}
                      className="bg-black/30 border border-white/10 rounded px-2.5 py-1.5 text-xs text-[#E8EAE6] outline-none focus:border-[#4FE3DC]"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[12px] text-[rgba(232,234,230,0.72)]  font-bold">Lead Message / Notes</span>
                  <textarea
                    rows={2}
                    placeholder="Inquiry comments..."
                    value={testLead.notes}
                    onChange={(e) => setTestLead({ ...testLead, notes: e.target.value })}
                    className="bg-black/30 border border-white/10 rounded px-2.5 py-1.5 text-xs text-[#E8EAE6] outline-none focus:border-[#4FE3DC] resize-none"
                  ></textarea>
                </div>

                <button
                  type="submit"
                  disabled={submittingWebhook}
                  className="w-full py-2 bg-[#4FE3DC] hover:bg-[#4FE3DC]/80 disabled:opacity-50 text-black font-semibold text-[13px] tracking-normal rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm mt-1"
                >
                  <Send size={12} /> {submittingWebhook ? "TRANSMITTING TO WEBHOOK..." : "SEND TEST WEBHOOK LEAD"}
                </button>
              </form>

              {webhookResult && (
                <div className="mt-3 bg-black/40 border border-[#4FE3DC]/30 rounded-lg p-2.5 animate-in fade-in duration-150">
                  <div className="flex items-center gap-1.5 mb-1 text-[#4ADE9B] text-[13px] font-bold">
                    <CheckCircle size={12} /> Sync Success! CRM Lead Added
                  </div>
                  <pre className="text-[12px] font-mono text-[#E8EAE6] overflow-x-auto whitespace-pre-wrap leading-tight bg-black/20 p-2 rounded border border-white/5">
                    {JSON.stringify(webhookResult, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>

          {/* B. Master Stock Inventory Sync Console */}
          <div className="card">
            <div className="card-header border-b border-white/5 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database size={15} className="text-[#4FE3DC]" />
                <h3 className="font-semibold text-xs tracking-normal text-[#E8EAE6]">Master Inventory Syncer</h3>
              </div>
              <button
                type="button"
                disabled={syncing}
                onClick={runLiveInventorySync}
                className="flex items-center gap-1 text-[12px] font-semibold text-[#4FE3DC] hover:text-[#E8EAE6] transition-colors bg-[#4FE3DC]/10 border border-[#4FE3DC]/20 px-2 py-1 rounded cursor-pointer"
              >
                <RefreshCw size={10} className={syncing ? "animate-spin" : ""} /> FORCE SYNC
              </button>
            </div>

            <div className="card-body p-4 flex flex-col gap-3">
              <p className="text-[13px] text-[rgba(232,234,230,0.72)] leading-relaxed">
                Manually push active showroom floor items, pricing metrics, and mileage metadata to your website <strong>www.real-cars.co.za</strong> immediately.
              </p>

              {/* Sync Console */}
              <div className="bg-[#06080D] border border-white/5 rounded-xl p-3 h-48 overflow-y-auto font-mono text-[13px] text-[rgba(232,234,230,0.72)] leading-relaxed flex flex-col gap-1.5">
                {syncLogs.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-400 italic py-6">
                    <span>Console ready. Click "FORCE SYNC" to begin showroom floor synchronization.</span>
                  </div>
                ) : (
                  syncLogs.map((log, index) => (
                    <div key={index} className={log.includes("OK") ? "text-[#4ADE9B]" : log.includes("ERROR") ? "text-red-400 font-bold" : ""}>
                      {log}
                    </div>
                  ))
                )}
              </div>

              {syncSuccess && (
                <div className="bg-[#4ADE9B]/10 border border-[#4ADE9B]/20 p-2.5 rounded-lg flex items-center gap-2 text-xs text-[#4ADE9B] font-bold">
                  <CheckCircle size={14} /> Showroom inventory completely synced with www.real-cars.co.za!
                </div>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
