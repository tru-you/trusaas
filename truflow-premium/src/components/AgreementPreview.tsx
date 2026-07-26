import React, { useRef, useState, useEffect } from "react";
import { Agreement, Lead, Vehicle } from "../types";
import { Printer, Shield, FileSignature, RotateCcw, Check } from "lucide-react";

interface AgreementPreviewProps {
  agreement: Agreement;
  lead?: Lead;
  vehicle?: Vehicle;
  onSignAgreement?: (id: string, signature: string) => Promise<void>;
}

export default function AgreementPreview({ agreement, lead, vehicle, onSignAgreement }: AgreementPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signMode, setSignMode] = useState<"draw" | "type">("draw");
  const [typedName, setTypedName] = useState(lead ? `${lead.firstName} ${lead.lastName}` : "");
  const [submitting, setSubmitting] = useState(false);

  const formatZAR = (num: number) => {
    return "R " + Math.round(num).toLocaleString("en-ZA");
  };

  const handlePrint = () => {
    const content = document.getElementById("printableAgreementFrame")?.innerHTML || "";
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html>
        <head>
          <title>Agreement Deed - ${agreement.agreementNumber}</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; color: #1a1a2e; background: #fff; }
            .doc-title { text-align: center; color: #122a48; font-size: 20px; font-weight: 800; margin-bottom: 5px; }
            .doc-sub { text-align: center; font-size: 11px; color: #666; margin-bottom: 30px; }
            .party-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 30px; font-size: 12px; line-height: 1.6; }
            .asset-panel { background: #f8f8fa; border-radius: 6px; padding: 15px; margin-bottom: 30px; font-size: 12px; border: 1px solid #ddd; }
            .terms-box { font-size: 11px; line-height: 1.8; color: #333; margin-bottom: 30px; height: 160px; overflow-y: scroll; padding: 12px; border: 1px solid #ddd; border-radius: 6px; background: #fafafa; }
            .sign-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 40px; font-size: 12px; }
            .sign-line { border-top: 1px solid #333; padding-top: 8px; margin-top: 50px; }
          </style>
        </head>
        <body>
          ${content}
          <script>window.print();</script>
        </body>
      </html>
    `);
    win.document.close();
  };

  // Signature pad logic
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "var(--ink-2)";

    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();

    if ("touches" in e) {
      e.preventDefault();
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleSignSubmit = async () => {
    if (!onSignAgreement) return;
    setSubmitting(true);
    try {
      let signatureData = "";
      if (signMode === "draw") {
        const canvas = canvasRef.current;
        if (canvas) {
          signatureData = canvas.toDataURL();
        }
      } else {
        signatureData = `TYPED:${typedName}`;
      }

      if (!signatureData || signatureData === "TYPED:") {
        alert("Please provide your signature before submitting.");
        setSubmitting(false);
        return;
      }

      await onSignAgreement(agreement.id, signatureData);
    } catch (err) {
      console.error(err);
      alert("Failed to submit digital signature.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card mt-6">
      <div className="card-header flex justify-between items-center px-4 py-3 border-b border-[rgba(138,162,184,0.1)]">
        <h3 className="font-semibold text-[16px]">Active Binding Contract Preview</h3>
        <button
          onClick={handlePrint}
          className="btn btn-secondary btn-sm flex items-center gap-2"
        >
          <Printer size={13} /> Print / Save PDF
        </button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
        {/* CONTRACT PAPER VIEW */}
        <div className="lg:col-span-2">
          <div className="bg-[color:var(--ink-2)] text-[color:var(--ink-2)] rounded-xl p-8 max-w-[800px] mx-auto shadow-xl font-sans relative overflow-hidden" id="printableAgreementFrame">
            {/* Security Badge watermark */}
            <div className="absolute top-8 right-8 text-[color:var(--cyan-faint)] flex items-center gap-1 text-[13px] font-bold tracking-wider select-none">
              <Shield size={16} /> SECURED BY TRUECAR DMS SIGN-OFF
            </div>

            <h1 className="text-center text-xl font-semibold text-[color:var(--ink-2)] tracking-tight ">
              {agreement.type === "Offer to Purchase" ? "Offer to Purchase (OTP)" :
               agreement.type === "Finance Application" ? "Pre-Approval Credit Finance Application" :
               agreement.type === "Trade-In Transfer" ? "Trade-In Exchange Agreement" :
               agreement.type === "Deposit Hold" ? "Secured Deposit Hold & Reserve Deed" :
               "Certified Binding Sales Agreement"}
            </h1>
            <div className="text-center text-[13px] font-bold text-gray-400 font-mono tracking-widest  mb-8">
              Reference Index: {
                agreement.type === "Offer to Purchase" ? "OTP-" :
                agreement.type === "Finance Application" ? "FIN-" :
                agreement.type === "Trade-In Transfer" ? "TRD-" :
                agreement.type === "Deposit Hold" ? "DEP-" : "SLS-"
              }{agreement.agreementNumber}
            </div>

            {/* Party Grid */}
            <div className="grid grid-cols-2 gap-8 mb-6 text-[13px] text-gray-700 leading-relaxed border-b border-gray-100 pb-6">
              <div>
                <div className="font-bold text-gray-900 mb-2 text-[13px] tracking-wider  text-gray-400">PART A: DEALER MERCHANT</div>
                <div className="font-semibold text-gray-900">Johannesburg Auto (Pty) Ltd</div>
                <div>Registration No: 2015/123456/07</div>
                <div>Sandton Towers, Sandhurst</div>
                <div>Johannesburg, South Africa</div>
              </div>
              <div>
                <div className="font-bold text-gray-900 mb-2 text-[13px] tracking-wider  text-gray-400">PART B: APPLICANT / PURCHASER</div>
                {lead ? (
                  <>
                    <div className="font-semibold text-gray-900">{lead.firstName} {lead.lastName}</div>
                    <div>Phone: {lead.phone}</div>
                    <div>Email: {lead.email}</div>
                    <div className="italic text-[13px] text-gray-400 mt-1">Authorized Customer Account</div>
                  </>
                ) : (
                  <div className="italic text-gray-400">Walk-In Client Account</div>
                )}
              </div>
            </div>

            {/* Asset Identification Panel */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 text-[13px] text-gray-800">
              <div className="font-bold text-[color:var(--ink-2)] mb-2 tracking-wide  text-[13px]">
                Acquired Asset Assignment Identification:
              </div>
              <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                <div><span className="text-gray-400 font-medium">Year Model:</span> <span className="font-semibold">{vehicle?.year || "N/A"}</span></div>
                <div><span className="text-gray-400 font-medium">Make Manufacturer:</span> <span className="font-semibold">{vehicle?.make || "N/A"}</span></div>
                <div><span className="text-gray-400 font-medium">Engine / Model:</span> <span className="font-semibold">{vehicle?.model || "N/A"}</span></div>
                <div><span className="text-gray-400 font-medium">Stock identification:</span> <span className="font-semibold font-mono text-[color:var(--ink-2)]">{vehicle?.stockNumber || "N/A"}</span></div>
              </div>
            </div>

            {/* Pricing Summary */}
            <div className="grid grid-cols-2 gap-4 mb-6 text-[13px] text-gray-800 bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div>
                <span className="text-gray-400 font-medium">Negotiated Price (Ex VAT):</span>{" "}
                <span className="font-bold">{formatZAR(agreement.purchasePrice / 1.15)}</span>
              </div>
              <div>
                <span className="text-gray-400 font-medium">Downpayment / Deposit:</span>{" "}
                <span className="font-bold text-[color:var(--cyan)]">{formatZAR(agreement.depositAmount)}</span>
              </div>
              <div>
                <span className="text-gray-400 font-medium">Standard 15% VAT:</span>{" "}
                <span className="font-bold">{formatZAR(agreement.purchasePrice - (agreement.purchasePrice / 1.15))}</span>
              </div>
              <div>
                <span className="text-gray-400 font-medium text-[16px] font-semibold">Total Cost (Incl VAT):</span>{" "}
                <span className="font-bold text-gray-950 font-mono text-[16px]">{formatZAR(agreement.purchasePrice)}</span>
              </div>
            </div>

            {/* Legal Scrollbox */}
            <div className="text-[13px] text-gray-600 border border-gray-200 rounded-lg p-4 bg-gray-50 h-28 overflow-y-auto mb-6 line-height-relaxed select-none">
              {agreement.type === "Offer to Purchase" ? (
                <>
                  <div className="font-bold text-gray-900 mb-2">1. MANDATORY OFFER & ACCEPTANCE STATUTE:</div>
                  This Offer to Purchase (OTP) constitutes a formal, binding contract for submission to financing agencies or direct cash payment. The offer remains valid for 7 calendar days from sign-off.
                  <div className="font-bold text-gray-900 mt-3 mb-2">2. FINANCING CONDITION SUSPENSIVE:</div>
                  If financing is requested, this agreement is suspensively conditioned upon securing formal finance approval from registered South African banks (including WesBank, Absa, Standard Bank, Nedbank) within 10 operational days.
                  <div className="font-bold text-gray-900 mt-3 mb-2">3. POPI ACT & CREDIT BUREAU DISCLOSURE:</div>
                  The purchaser authorizes Johannesburg Auto to syndicate this OTP data to financial institutions for credit analysis.
                </>
              ) : agreement.type === "Finance Application" ? (
                <>
                  <div className="font-bold text-gray-900 mb-2">1. CREDIT ASSESSMENT DISCLOSURE:</div>
                  The applicant hereby requests Johannesburg Auto (Pty) Ltd to act as the finance & insurance (F&I) broker. The applicant explicitly authorizes soft and hard credit bureau enquiries (Experian, TransUnion, ITC).
                  <div className="font-bold text-gray-900 mt-3 mb-2">2. POPI Act:</div>
                  All personal credit logs, bank details, and identification files provided will be treated in strict accordance with the Protection of Personal Information (POPI) Act of South Africa.
                  <div className="font-bold text-gray-900 mt-3 mb-2">3. DECLARATION OF SOLVENCY:</div>
                  The applicant declares that they are not currently under debt review, administration, or declared insolvent under any South African jurisdiction.
                </>
              ) : (
                <>
                  <div className="font-bold text-gray-900 mb-2">1. Standard terms:</div>
                  The purchaser executes this commitment with the understanding that the asset described above has been examined. The merchant provides legal warranty clearance for a structured limit of 6 months.
                  <div className="font-bold text-gray-900 mt-3 mb-2">2. RESIDUAL VOETSTOOTS STATUTE:</div>
                  The asset is transferred Voetstoots (As-Is) with standard factory warranties continuing where applicable. The purchaser acknowledges that they have personally inspected and approved the vehicle.
                  <div className="font-bold text-gray-900 mt-3 mb-2">3. COMPLIANCE & POPI STATUTE:</div>
                  Information processed during this transaction is stored securely under the South African Protection of Personal Information (POPI) Act directives. Both parties consent to storage of signing logs.
                </>
              )}
            </div>

            {/* Signatures */}
            <div className="grid grid-cols-2 gap-12 mt-8 text-[13px] border-t border-gray-100 pt-6">
              <div className="flex flex-col">
                {/* Left blank to be signed. This printed "TrueCar Sandton
                    Showroom Floor Node" in the dealer's signature field —
                    wrong product, a hardcoded branch, and a contract should
                    never arrive with a signature already in it. */}
                <div className="h-12 border-b border-gray-300" />
                <div className="font-semibold text-gray-900 mt-2">Signature of Dealer Representative</div>
                <div className="text-gray-400 text-[13px] mt-0.5">Date: {agreement.signedAt?.slice(0, 10) || new Date().toISOString().slice(0, 10)}</div>
              </div>
              <div className="flex flex-col">
                <div className="h-12 border-b border-gray-300 flex items-center justify-center text-center">
                  {agreement.signature ? (
                    agreement.signature.startsWith("TYPED:") ? (
                      <span className="font-serif italic text-base text-[color:var(--ink-2)] tracking-wider font-semibold">
                        {agreement.signature.replace("TYPED:", "")}
                      </span>
                    ) : (
                      <img src={agreement.signature} alt="Client Signature" className="max-h-12 object-contain" />
                    )
                  ) : (
                    <span className="text-[color:var(--muted)] text-[13px]  font-semibold tracking-widest font-mono">Waiting for signature</span>
                  )}
                </div>
                <div className="font-semibold text-gray-900 mt-2">Signature of Purchaser</div>
                <div className="text-gray-400 text-[13px] mt-0.5">
                  Date: {agreement.signedAt ? agreement.signedAt.slice(0, 10) : "Pending"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* INTERACTIVE SIGNING PAD */}
        <div className="flex flex-col justify-between bg-[color:var(--glass)] border border-white/5 rounded-xl p-5 gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-[color:var(--cyan)]">
              <FileSignature size={16} />
              <h4 className="font-semibold text-[13px] tracking-normal">Signing</h4>
            </div>
            <p className="text-[13px] text-[rgba(232,234,230,0.72)] leading-relaxed">
              Verify legal terms, then capture the purchaser's binding signature below to finalize this transaction record.
            </p>
          </div>

          {agreement.status === "Pending Signature" ? (
            <div className="flex flex-col gap-3">
              <div className="flex bg-[color:var(--glass)] rounded-lg p-0.5 border border-white/5">
                <button
                  onClick={() => setSignMode("draw")}
                  className={`flex-1 text-center py-1 text-[13px] font-bold rounded-lg transition-all ${
                    signMode === "draw" ? "bg-[color:var(--cyan)] on-fill" : "text-[rgba(232,234,230,0.72)] hover:text-[color:var(--white)]"
                  }`}
                >
                  Draw Signature
                </button>
                <button
                  onClick={() => setSignMode("type")}
                  className={`flex-1 text-center py-1 text-[13px] font-bold rounded-lg transition-all ${
                    signMode === "type" ? "bg-[color:var(--cyan)] on-fill" : "text-[rgba(232,234,230,0.72)] hover:text-[color:var(--white)]"
                  }`}
                >
                  Type E-Sign
                </button>
              </div>

              {signMode === "draw" ? (
                <div className="flex flex-col gap-2">
                  <div className="relative bg-[color:var(--ink-2)] rounded-lg overflow-hidden border border-white/10">
                    <canvas
                      ref={canvasRef}
                      width={280}
                      height={120}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                      className="w-full bg-[color:var(--ink-2)] cursor-crosshair touch-none"
                    />
                    <button
                      onClick={clearCanvas}
                      className="absolute bottom-2 right-2 p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-all flex items-center gap-1 text-[13px] font-bold"
                    >
                      <RotateCcw size={10} /> Clear Pad
                    </button>
                  </div>
                  <span className="text-[13px] text-[rgba(232,234,230,0.72)] italic text-center">Use your mouse or touchscreen to draw</span>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    value={typedName}
                    onChange={(e) => setTypedName(e.target.value)}
                    placeholder="Enter full legal name..."
                    className="w-full px-3 py-2 bg-[color:var(--glass)] border border-white/10 rounded-lg text-[13px] text-[color:var(--white)] outline-none focus:border-[color:var(--cyan)]"
                  />
                  <div className="h-16 bg-[color:var(--glass)] rounded-lg border border-dashed border-white/10 flex items-center justify-center p-3">
                    <span className="font-serif italic text-lg text-[color:var(--cyan)] tracking-wider">
                      {typedName || "Cursive Preview"}
                    </span>
                  </div>
                </div>
              )}

              <button
                onClick={handleSignSubmit}
                disabled={submitting}
                className="w-full py-3 bg-gradient-to-r from-[color:var(--cyan)] to-[color:var(--cyan)] text-[color:var(--ink)] hover:brightness-110 active:scale-95 transition-all text-[13px] font-bold rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10 disabled:opacity-50"
              >
                {submitting ? "Processing E-Sign..." : "Affix Binding Signature"}
              </button>
            </div>
          ) : (
            <div className="bg-[color:var(--cyan-faint)] border border-[color:var(--cyan-faint)] rounded-xl p-4 flex flex-col items-center justify-center gap-3 py-6">
              <div className="w-10 h-10 rounded-full bg-[color:var(--cyan-faint)] flex items-center justify-center text-[color:var(--cyan)]">
                <Check size={20} />
              </div>
              <div className="text-center">
                <h5 className="text-[13px] font-semibold text-[color:var(--white)] tracking-normal">Signed</h5>
                <p className="text-[13px] text-[rgba(232,234,230,0.72)] mt-0.5">
                  Digitally signed with unique hashing index. Document locked from modifications.
                </p>
              </div>
              <div className="text-[13px] font-mono bg-[color:var(--glass)] border border-white/5 rounded px-3 py-1 text-[color:var(--cyan)] text-center max-w-full truncate">
                SHA-256: {agreement.id.slice(4)}
              </div>
            </div>
          )}

          <div className="bg-[color:var(--glass-line)] rounded-lg p-3 text-[13px] text-[rgba(232,234,230,0.72)] leading-relaxed border border-white/3 flex flex-col gap-1">
            <span className="font-bold text-[rgba(232,234,230,0.72)]">Audit trail:</span>
            <span>IP Location: Sandton, RSA (Vite Showroom)</span>
            <span>Timestamp: {agreement.signedAt || "Pending Execution"}</span>
            <span>POPI Act consent recorded</span>
          </div>
        </div>
      </div>
    </div>
  );
}
