import React, { useEffect, useState } from "react";
import { X, Printer, Loader2, CheckCircle2 } from "lucide-react";
import { authFetch } from "../lib/session";

interface InspectionReportProps {
  propertyId: string;
  onClose: () => void;
}

type InspectionRating = "ok" | "note" | "damage";

interface InspectionPayload {
  property?: {
    id: string;
    address?: string;
    suburb?: string;
    propertyType?: string;
    bedrooms?: number;
    bathrooms?: number;
    garages?: number;
    erfSize?: string;
    floorSize?: string;
    listingRef?: string;
    askingPrice?: number;
    images?: string[];
  };
  inspectionResults?: Record<string, "Pass" | "Attention">;
  damage?: { section?: string; type: string; severity: number; note: string }[];
  slotAssessment?: Record<
    string,
    { rating?: InspectionRating; works?: "yes" | "no" | "na"; comment?: string }
  >;
  inspectionReport?: { section: string; rating: InspectionRating; note?: string }[];
  conditionDeclaration?: { noVisibleDamage?: boolean; declaredAt?: string };
}

const RATING_META: Record<InspectionRating, { label: string; color: string; bg: string }> = {
  ok: { label: "OK", color: "var(--success)", bg: "rgba(11, 124, 114, 0.10)" },
  note: { label: "Note", color: "var(--amber)", bg: "rgba(212, 148, 42, 0.16)" },
  damage: { label: "Damage", color: "var(--danger)", bg: "rgba(184, 106, 106, 0.12)" },
};

const SEVERITY_COLORS = ["#0B7C72", "#0B7C72", "#D4942A", "#B86A6A", "#B86A6A"];

function formatZAR(num: number): string {
  return "R " + Math.round(num || 0).toLocaleString("en-ZA");
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      style={{
        background: "var(--ink)",
        border: "1px solid var(--glass-line)",
        borderRadius: 14,
        padding: "14px 16px",
      }}
    >
      <h4
        style={{
          margin: "0 0 10px",
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--muted)",
          fontFamily: "var(--mono)",
        }}
      >
        {title}
      </h4>
      {children}
    </section>
  );
}

function Chip({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        color,
        background: bg,
        border: "1px solid " + color,
        whiteSpace: "nowrap",
        fontFamily: "var(--mono)",
      }}
    >
      {label}
    </span>
  );
}

export default function InspectionReport({ propertyId, onClose }: InspectionReportProps) {
  const [data, setData] = useState<InspectionPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch("/api/inspection/" + encodeURIComponent(propertyId));
        if (!res.ok) throw new Error("Could not load the inspection report.");
        const payload = (await res.json()) as InspectionPayload;
        if (!cancelled) setData(payload);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || "Could not load the inspection report.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [propertyId]);

  const p = data?.property;
  const inspectionResults = data?.inspectionResults || {};
  const damage = data?.damage || [];
  const slotAssessment = data?.slotAssessment || {};
  const condition = data?.conditionDeclaration || {};

  const ratingChip = (rating?: InspectionRating) => {
    if (!rating || !RATING_META[rating]) return null;
    return <Chip label={RATING_META[rating].label} color={RATING_META[rating].color} bg={RATING_META[rating].bg} />;
  };

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .inspection-print, .inspection-print * { visibility: visible; }
          .inspection-print {
            position: absolute !important;
            inset: 0 !important;
            max-height: none !important;
            overflow: visible !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }
          .inspection-print * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .inspection-no-print { display: none !important; }
        }
      `}</style>
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 400,
          background: "rgba(20, 20, 31, 0.45)",
          backdropFilter: "blur(6px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
          overflowY: "auto",
        }}
      >
        <div
          className="inspection-print"
          style={{
            width: "100%",
            maxWidth: 720,
            maxHeight: "90vh",
            overflowY: "auto",
            background: "var(--ink-2)",
            border: "1px solid var(--glass-line)",
            borderRadius: 16,
            boxShadow: "var(--shadow-modal)",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 12,
              padding: "18px 20px 14px",
              borderBottom: "1px solid var(--glass-line)",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--white)" }}>
                  {p?.address || "Property"}
                </h3>
                {p?.suburb && <span style={{ fontSize: 13, color: "var(--white-dim)" }}>{p.suburb}</span>}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 8 }}>
                {p?.propertyType && (
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--cyan)",
                      background: "var(--cyan-faint)",
                      border: "1px solid rgba(13, 148, 136, 0.25)",
                      padding: "2px 10px",
                      borderRadius: 999,
                    }}
                  >
                    {p.propertyType}
                  </span>
                )}
                {p?.listingRef && (
                  <span style={{ fontSize: 12, fontFamily: "var(--mono)", color: "var(--muted)" }}>{p.listingRef}</span>
                )}
                {typeof p?.askingPrice === "number" && (
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--white)" }}>{formatZAR(p.askingPrice)}</span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close inspection report"
              className="inspection-no-print"
              style={{
                background: "transparent",
                border: "none",
                color: "var(--white-dim)",
                cursor: "pointer",
                padding: 6,
                borderRadius: 8,
                flexShrink: 0,
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: "16px 20px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
            {loading && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "32px 0", fontSize: 13, color: "var(--muted)" }}>
                <Loader2 size={16} className="animate-spin" /> Loading inspection report…
              </div>
            )}

            {error && (
              <div
                style={{
                  padding: "10px 12px",
                  fontSize: 13,
                  color: "var(--danger)",
                  background: "rgba(184, 106, 106, 0.10)",
                  border: "1px solid rgba(184, 106, 106, 0.30)",
                  borderRadius: 10,
                }}
              >
                {error}
              </div>
            )}

            {!loading && !error && (
              <>
                {/* Inspection summary */}
                <SectionCard title="Inspection summary">
                  {Object.keys(inspectionResults).length === 0 ? (
                    <div style={{ fontSize: 13, color: "var(--muted)" }}>No inspection data captured yet.</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {Object.entries(inspectionResults).map(([slot, result]) => (
                        <div
                          key={slot}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 10,
                            padding: "8px 12px",
                            background: "var(--ink)",
                            border: "1px solid var(--glass-line)",
                            borderRadius: 10,
                          }}
                        >
                          <span style={{ fontSize: 13, color: "var(--white)" }}>{slot}</span>
                          <Chip
                            label={result}
                            color={result === "Pass" ? "var(--success)" : "var(--amber)"}
                            bg={result === "Pass" ? "rgba(11, 124, 114, 0.10)" : "rgba(212, 148, 42, 0.16)"}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>

                {/* Findings */}
                <SectionCard title="Findings">
                  {damage.length === 0 ? (
                    <div style={{ fontSize: 13, color: "var(--muted)" }}>No damage findings.</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {damage.map((d, i) => (
                        <div
                          key={i}
                          style={{
                            padding: "10px 12px",
                            background: "var(--ink)",
                            border: "1px solid var(--glass-line)",
                            borderRadius: 10,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--white)" }}>{d.type || "Finding"}</span>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }} title={"Severity " + d.severity + " / 5"}>
                              {[1, 2, 3, 4, 5].map((n) => (
                                <span
                                  key={n}
                                  style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: "50%",
                                    background: n <= (d.severity || 0) ? SEVERITY_COLORS[n - 1] : "rgba(84, 98, 120, 0.25)",
                                  }}
                                />
                              ))}
                            </span>
                          </div>
                          {d.note && (
                            <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 4, lineHeight: 1.5 }}>{d.note}</div>
                          )}
                          {d.section && (
                            <div style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--white-dim)", marginTop: 4 }}>
                              Panel: {d.section}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>

                {/* Slot assessment */}
                <SectionCard title="Slot assessment">
                  {Object.keys(slotAssessment).length === 0 ? (
                    <div style={{ fontSize: 13, color: "var(--muted)" }}>No slot assessments recorded.</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {Object.entries(slotAssessment).map(([slot, s]) => (
                        <div
                          key={slot}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 10,
                            flexWrap: "wrap",
                            padding: "8px 12px",
                            background: "var(--ink)",
                            border: "1px solid var(--glass-line)",
                            borderRadius: 10,
                          }}
                        >
                          <span style={{ fontSize: 13, color: "var(--white)" }}>{slot}</span>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            {ratingChip(s?.rating)}
                            {s?.works && s.works !== "na" && (
                              <Chip
                                label={s.works === "yes" ? "Works" : "Not working"}
                                color={s.works === "yes" ? "var(--success)" : "var(--danger)"}
                                bg={s.works === "yes" ? "rgba(11, 124, 114, 0.10)" : "rgba(184, 106, 106, 0.12)"}
                              />
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>

                {/* Condition declaration */}
                <SectionCard title="Condition declaration">
                  {condition.noVisibleDamage === true ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--success)", flexWrap: "wrap" }}>
                      <CheckCircle2 size={15} style={{ flexShrink: 0 }} />
                      <span style={{ fontWeight: 600 }}>No visible damage declared</span>
                      {condition.declaredAt && (
                        <span style={{ color: "var(--muted)" }}>
                          · {new Date(condition.declaredAt).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div style={{ fontSize: 13, color: "var(--muted)" }}>No condition declaration.</div>
                  )}
                </SectionCard>
              </>
            )}
          </div>

          {/* Footer */}
          <div
            className="inspection-no-print"
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
              padding: "14px 20px",
              borderTop: "1px solid var(--glass-line)",
              background: "rgba(251, 249, 243, 0.6)",
            }}
          >
            <button
              onClick={onClose}
              style={{
                padding: "8px 14px",
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 10,
                background: "#FFFFFF",
                color: "var(--white)",
                border: "1px solid var(--glass-line)",
                cursor: "pointer",
              }}
            >
              Close
            </button>
            <button
              onClick={() => window.print()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 14px",
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 10,
                background: "linear-gradient(180deg, #0D9488 0%, #0B7C72 100%)",
                color: "var(--text-on-accent)",
                border: "none",
                cursor: "pointer",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.30)",
              }}
            >
              <Printer size={14} /> Print / Save PDF
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
