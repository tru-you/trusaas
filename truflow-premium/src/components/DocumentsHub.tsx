import React, { useRef, useState } from "react";
import { DealerDocument } from "../types";
import {
  Upload, FileText, FileImage, File as FileIcon, Trash2, Check,
  RotateCcw, Printer, Download, X, PenLine,
} from "lucide-react";

interface DocumentsHubProps {
  documents: DealerDocument[];
  getLeadLabel?: (id: string) => string;
  getVehicleLabel?: (id: string) => string;
  onUpload: (file: {
    fileName: string;
    mimeType: string;
    fileData: string;
    leadId?: string;
    vehicleId?: string;
  }) => Promise<void>;
  onSign: (id: string, signature: string, signedBy: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  /** Attach anything uploaded here to this vehicle and/or lead. Set when the
   *  hub is embedded in a record, so a signed OTP files itself against the car
   *  and the buyer instead of landing in an undifferentiated pile. */
  vehicleId?: string;
  leadId?: string;
  /** Embedded in a record rather than shown as its own screen: drops the page
   *  heading and tightens the spacing. */
  embedded?: boolean;
}

const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15MB — data URLs bloat data.json fast

function docIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return FileImage;
  if (mimeType === "application/pdf") return FileText;
  return FileIcon;
}

function formatDate(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-ZA", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

export default function DocumentsHub({ documents, getLeadLabel, getVehicleLabel, onUpload, onSign, onDelete, vehicleId, leadId, embedded }: DocumentsHubProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signMode, setSignMode] = useState<"draw" | "type">("draw");
  const [typedName, setTypedName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);

  const activeDoc = documents.find((d) => d.id === activeDocId) || null;

  const handleFilePicked = async (file: File) => {
    if (file.size > MAX_FILE_BYTES) {
      alert(`"${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)}MB — please upload files under 15MB.`);
      return;
    }
    setUploading(true);
    try {
      const fileData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      await onUpload({ fileName: file.name, mimeType: file.type || "application/octet-stream", fileData, vehicleId, leadId });
    } catch (err) {
      console.error(err);
      alert("Could not upload that file. Please try again.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Signature pad logic (draw)
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
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
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
    if ("touches" in e) e.preventDefault();
  };

  const stopDrawing = () => setIsDrawing(false);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleSignSubmit = async () => {
    if (!activeDoc) return;
    setSubmitting(true);
    try {
      let signatureData = "";
      let signerName = typedName.trim();
      if (signMode === "draw") {
        signatureData = canvasRef.current?.toDataURL() || "";
      } else {
        if (!signerName) {
          alert("Please type the signee's name.");
          setSubmitting(false);
          return;
        }
        signatureData = `TYPED:${signerName}`;
      }
      if (!signatureData) {
        alert("Please draw a signature before submitting.");
        setSubmitting(false);
        return;
      }
      await onSign(activeDoc.id, signatureData, signerName || "Signee");
    } catch (err) {
      console.error(err);
      alert("Failed to save signature.");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrint = (doc: DealerDocument) => {
    const win = window.open("", "_blank");
    if (!win) return;
    const previewHtml = doc.mimeType.startsWith("image/")
      ? `<img src="${doc.fileData}" style="max-width:100%;display:block;margin:0 auto 24px" />`
      : doc.mimeType === "application/pdf"
      ? `<iframe src="${doc.fileData}" style="width:100%;height:70vh;border:1px solid #ddd;margin-bottom:24px"></iframe>`
      : `<p style="color:#666">${doc.fileName} (preview not available for this file type)</p>`;
    const sigHtml = doc.signature
      ? doc.signature.startsWith("TYPED:")
        ? `<div style="font-family:cursive;font-size:22px;border-bottom:1px solid #333;display:inline-block;padding:6px 20px 4px">${doc.signature.replace("TYPED:", "")}</div>`
        : `<img src="${doc.signature}" style="max-height:60px" />`
      : `<span style="color:#c00">Unsigned</span>`;
    win.document.write(`
      <html>
        <head><title>${doc.fileName}</title></head>
        <body style="font-family:system-ui,-apple-system,sans-serif;padding:40px;color:#1a1a2e;background:#fff">
          <h2 style="margin:0 0 4px">${doc.fileName}</h2>
          <p style="color:#666;font-size:12px;margin:0 0 24px">Uploaded ${formatDate(doc.uploadedAt)}</p>
          ${previewHtml}
          <div style="margin-top:24px;border-top:1px solid #ddd;padding-top:16px">
            <div style="font-size:11px;color:#666;letter-spacing:.05em;margin-bottom:6px">Signature</div>
            ${sigHtml}
            ${doc.signedBy ? `<div style="font-size:12px;color:#333;margin-top:8px">Signed by ${doc.signedBy} on ${formatDate(doc.signedAt)}</div>` : ""}
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `);
    win.document.close();
  };

  return (
    <div className={`flex flex-col ${embedded ? "gap-3" : "gap-6"} animate-in fade-in duration-200`}>
      <div className="flex justify-between items-center gap-4 flex-wrap">
        {embedded ? (
          <p className="text-[13px] text-[rgba(232,234,230,0.72)] max-w-[300px] leading-relaxed">
            Anything uploaded here files itself against this record — offers, disclosures,
            signed agreements — and can be signed in place.
          </p>
        ) : (
          <div>
            <h1 className="font-sans text-2xl font-semibold tracking-tight text-[color:var(--white)]">Documents</h1>
            <p className="text-[13px] text-[rgba(232,234,230,0.72)] mt-0.5 font-medium">
              Upload any document your dealership needs — agreements, disclosures, RICA forms, your own templates —
              then capture a signature on it.
            </p>
          </div>
        )}
        <label className={`btn btn-primary flex items-center gap-2 cursor-pointer ${uploading ? "opacity-60 pointer-events-none" : ""}`}>
          <Upload size={14} />
          {uploading ? "Uploading…" : "Upload document"}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFilePicked(file);
            }}
          />
        </label>
      </div>

      <div className="card">
        {!embedded && (
          <div className="card-header border-b border-white/5 px-4 py-3">
            <h3 className="font-semibold text-[16px]">Uploaded Documents</h3>
          </div>
        )}
        <div className="card-body p-0 overflow-x-auto">
          {documents.length === 0 ? (
            <div className="py-10 px-4 text-center text-[13px] text-[rgba(232,234,230,0.72)]">
              No documents uploaded yet. Tap <b>Upload document</b> to add the first one.
            </div>
          ) : (
            <table className="w-full text-[13px] text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-white/5 text-[rgba(232,234,230,0.72)] tracking-normal text-[13px] bg-[color:var(--glass)]">
                  <th className="py-3 px-4 font-bold">File</th>
                  <th className="py-3 px-4 font-bold">Linked to</th>
                  <th className="py-3 px-4 font-bold">Uploaded</th>
                  <th className="py-3 px-4 font-bold">Status</th>
                  <th className="py-3 px-4 font-bold text-right">Operation</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => {
                  const Icon = docIcon(doc.mimeType);
                  const linked = [
                    doc.leadId && getLeadLabel ? getLeadLabel(doc.leadId) : null,
                    doc.vehicleId && getVehicleLabel ? getVehicleLabel(doc.vehicleId) : null,
                  ].filter(Boolean).join(" · ") || "—";
                  return (
                    <tr key={doc.id} className="border-b border-white/3 hover:bg-[color:var(--glass)]">
                      <td className="py-3 px-4 font-semibold text-[color:var(--white)] flex items-center gap-2">
                        <Icon size={14} className="text-[rgba(232,234,230,0.72)] shrink-0" /> {doc.fileName}
                      </td>
                      <td className="py-3 px-4">{linked}</td>
                      <td className="py-3 px-4 font-mono text-[13px]">{formatDate(doc.uploadedAt)}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[13px] font-bold tracking-normal ${
                          doc.status === "Signed" ? "bg-[color:var(--cyan-faint)] text-[color:var(--cyan)]" : "bg-[color:var(--glass)] text-[color:var(--warning)]"
                        }`}>
                          {doc.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right flex justify-end gap-2">
                        <button
                          onClick={() => { setActiveDocId(doc.id); setTypedName(""); }}
                          className="px-4 py-2 bg-[color:var(--cyan)] hover:bg-[color:var(--cyan-soft)] text-[color:var(--white)] rounded-lg text-[13px] font-bold cursor-pointer shadow-md active:scale-95 transition-all"
                        >
                          {doc.status === "Signed" ? "View" : "View & Sign"}
                        </button>
                        <button
                          onClick={async () => {
                            if (confirm(`Delete "${doc.fileName}"? This cannot be undone.`)) {
                              await onDelete(doc.id);
                              if (activeDocId === doc.id) setActiveDocId(null);
                            }
                          }}
                          className="p-2 text-[rgba(232,234,230,0.72)] hover:text-red-400 rounded hover:bg-white/5 cursor-pointer"
                          title="Delete document"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {activeDoc && (
        <div className="card">
          <div className="card-header border-b border-white/5 px-4 py-3 flex justify-between items-center">
            <h3 className="font-semibold text-[16px] flex items-center gap-2">
              <FileText size={14} className="text-[rgba(232,234,230,0.72)]" /> {activeDoc.fileName}
            </h3>
            <div className="flex items-center gap-2">
              <button onClick={() => handlePrint(activeDoc)} className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-[13px] font-bold text-[color:var(--white)] cursor-pointer">
                <Printer size={12} /> Print
              </button>
              <a
                href={activeDoc.fileData}
                download={activeDoc.fileName}
                className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-[13px] font-bold text-[color:var(--white)] cursor-pointer"
              >
                <Download size={12} /> Download
              </a>
              <button onClick={() => setActiveDocId(null)} className="p-2 text-[rgba(232,234,230,0.72)] hover:text-[color:var(--white)] rounded hover:bg-white/5 cursor-pointer">
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="card-body p-4 grid md:grid-cols-2 gap-4">
            {/* Preview */}
            <div className="bg-white rounded-lg overflow-hidden border border-white/10 flex items-center justify-center min-h-[260px]">
              {activeDoc.mimeType.startsWith("image/") ? (
                <img src={activeDoc.fileData} alt={activeDoc.fileName} className="max-w-full max-h-[420px] object-contain" />
              ) : activeDoc.mimeType === "application/pdf" ? (
                <iframe src={activeDoc.fileData} title={activeDoc.fileName} className="w-full h-[420px]" />
              ) : (
                <div className="text-center text-slate-500 text-[13px] p-6">
                  <FileIcon size={28} className="mx-auto mb-2 opacity-50" />
                  No in-browser preview for this file type.<br />Use Download to open it.
                </div>
              )}
            </div>

            {/* Sign / Signed */}
            <div className="flex flex-col gap-3">
              {activeDoc.status === "Signed" ? (
                <div className="rounded-lg border border-[color:var(--cyan-soft)] bg-[color:var(--cyan-faint)] p-4 flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-[color:var(--cyan)] font-bold text-[13px] tracking-normal">
                    <Check size={14} /> Signed
                  </div>
                  <div className="bg-white rounded-lg p-3 flex items-center justify-center min-h-[80px]">
                    {activeDoc.signature?.startsWith("TYPED:") ? (
                      <span className="text-2xl italic text-slate-800" style={{ fontFamily: "cursive" }}>
                        {activeDoc.signature.replace("TYPED:", "")}
                      </span>
                    ) : (
                      <img src={activeDoc.signature} alt="Signature" className="max-h-16 object-contain" />
                    )}
                  </div>
                  <p className="text-[13px] text-[rgba(232,234,230,0.72)]">
                    Signed by <b className="text-[color:var(--white)]">{activeDoc.signedBy}</b> on {formatDate(activeDoc.signedAt)}
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border border-white/10 bg-[color:var(--glass-line)] p-4 flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-[color:var(--warning)] font-bold text-[13px] tracking-normal">
                    <PenLine size={14} /> Capture signature
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setSignMode("draw")}
                      className={`flex-1 py-2 rounded-lg text-[13px] font-bold cursor-pointer ${signMode === "draw" ? "bg-[color:var(--cyan)] on-fill" : "bg-white/5 text-[rgba(232,234,230,0.72)]"}`}
                    >
                      Draw
                    </button>
                    <button
                      onClick={() => setSignMode("type")}
                      className={`flex-1 py-2 rounded-lg text-[13px] font-bold cursor-pointer ${signMode === "type" ? "bg-[color:var(--cyan)] on-fill" : "bg-white/5 text-[rgba(232,234,230,0.72)]"}`}
                    >
                      Type name
                    </button>
                  </div>

                  {signMode === "draw" ? (
                    <>
                      <div className="bg-white rounded-lg overflow-hidden border border-white/10">
                        <canvas
                          ref={canvasRef}
                          width={400}
                          height={140}
                          className="w-full touch-none cursor-crosshair"
                          onMouseDown={startDrawing}
                          onMouseMove={draw}
                          onMouseUp={stopDrawing}
                          onMouseLeave={stopDrawing}
                          onTouchStart={startDrawing}
                          onTouchMove={draw}
                          onTouchEnd={stopDrawing}
                        />
                      </div>
                      <button onClick={clearCanvas} className="flex items-center gap-2 self-start px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-[13px] font-bold text-[rgba(232,234,230,0.72)] cursor-pointer">
                        <RotateCcw size={12} /> Clear
                      </button>
                      <input
                        type="text"
                        value={typedName}
                        onChange={(e) => setTypedName(e.target.value)}
                        placeholder="Signee's full name (for the record)"
                        className="bg-[color:var(--ink-2)] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-[color:var(--white)] placeholder-[color:var(--faint)] focus:outline-none focus:border-[color:var(--cyan)]"
                      />
                    </>
                  ) : (
                    <input
                      type="text"
                      value={typedName}
                      onChange={(e) => setTypedName(e.target.value)}
                      placeholder="Type full name to sign"
                      className="bg-[color:var(--ink-2)] border border-white/10 rounded-lg px-3 py-3 text-[16px] text-[color:var(--white)] placeholder-[color:var(--faint)] focus:outline-none focus:border-[color:var(--cyan)]"
                      style={{ fontFamily: "cursive" }}
                    />
                  )}

                  <button
                    onClick={handleSignSubmit}
                    disabled={submitting}
                    className="mt-1 py-3 bg-[color:var(--cyan)] hover:bg-[color:var(--cyan-soft)] text-[color:var(--white)] rounded-lg text-[13px] font-bold tracking-normal cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? "Saving…" : "Save Signature"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
