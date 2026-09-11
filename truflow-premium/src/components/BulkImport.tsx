import React, { useState, useRef, useCallback } from "react";
import { Vehicle } from "../types";
import { Upload, FileSpreadsheet, Check, AlertCircle, X, Download, ChevronDown } from "lucide-react";
import { useMoney } from "../contexts/MarketContext";

interface Props {
  onImportVehicles: (vehicles: Partial<Vehicle>[]) => Promise<void>;
  existingStockNumbers: string[];
}

interface ParsedRow {
  raw: Record<string, string>;
  mapped: Partial<Vehicle>;
  errors: string[];
  duplicate: boolean;
}

const COLUMN_MAP: Record<string, keyof Vehicle> = {
  "stock number": "stockNumber",
  "stock no": "stockNumber",
  "stock #": "stockNumber",
  "stock": "stockNumber",
  "stocknumber": "stockNumber",
  "make": "make",
  "manufacturer": "make",
  "brand": "make",
  "model": "model",
  "year": "year",
  "model year": "year",
  "variant": "trim",
  "trim": "trim",
  "series": "trim",
  "description": "trim",
  "vin": "vin",
  "vin number": "vin",
  "chassis": "vin",
  "chassis number": "vin",
  "engine number": "engineNumber",
  "engine no": "engineNumber",
  "engine": "engine",
  "engine spec": "engine",
  "registration": "registrationNumber",
  "reg number": "registrationNumber",
  "reg no": "registrationNumber",
  "registration number": "registrationNumber",
  "colour": "color",
  "color": "color",
  "body type": "bodyType",
  "body": "bodyType",
  "transmission": "transmission",
  "trans": "transmission",
  "fuel": "fuelType",
  "fuel type": "fuelType",
  "mileage": "mileage",
  "km": "mileage",
  "odometer": "mileage",
  "kilometers": "mileage",
  "retail price": "retailPrice",
  "retail": "retailPrice",
  "selling price": "retailPrice",
  "price": "retailPrice",
  "asking price": "retailPrice",
  "cost price": "costPrice",
  "cost": "costPrice",
  "purchase price": "costPrice",
  "trade price": "costPrice",
  "minimum price": "minimumPrice",
  "min price": "minimumPrice",
  "condition": "condition",
  "new or used": "newOrUsed",
  "new/used": "newOrUsed",
  "type": "newOrUsed",
  "location": "location",
  "branch": "location",
  "supplier": "supplier",
  "supplier invoice": "supplierInvNumber",
  "mm code": "mmCode",
  "m&m code": "mmCode",
  "mmcode": "mmCode",
  "service history": "serviceHistory",
  "extras": "optionalExtras" as any,
  "optional extras": "optionalExtras" as any,
  "date acquired": "dateAcquired",
  "purchase date": "dateAcquired",
  "province": "province",
  "license number": "licenseNumber",
  "licence number": "licenseNumber",
  "license expiry": "licenseExpiry",
  "licence expiry": "licenseExpiry",
  "previous owners": "previousOwners",
  "key number": "keyNumber",
};

const NUM_FIELDS = new Set(["year", "mileage", "retailPrice", "costPrice", "minimumPrice", "previousOwners"]);

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if ((ch === ',' || ch === ';' || ch === '\t') && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(line => {
    const vals = parseLine(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = vals[i] || ""; });
    return obj;
  }).filter(r => Object.values(r).some(v => v.trim()));

  return { headers, rows };
}

function mapRow(raw: Record<string, string>, existingStocks: Set<string>): ParsedRow {
  const mapped: Partial<Vehicle> = { status: "INVENTORY" as const };
  const errors: string[] = [];

  for (const [csvCol, csvVal] of Object.entries(raw)) {
    if (!csvVal.trim()) continue;
    const key = csvCol.toLowerCase().trim();
    const vehicleField = COLUMN_MAP[key];
    if (!vehicleField) continue;

    if (vehicleField === "optionalExtras" as any) {
      (mapped as any).optionalExtras = csvVal.split(/[,;]/).map(s => s.trim()).filter(Boolean);
    } else if (NUM_FIELDS.has(vehicleField)) {
      const num = Number(csvVal.replace(/[^\d.-]/g, ""));
      if (!isNaN(num)) (mapped as any)[vehicleField] = num;
    } else if (vehicleField === "transmission") {
      const v = csvVal.toLowerCase();
      (mapped as any).transmission = v.includes("auto") ? "Automatic" : v.includes("manual") ? "Manual" : csvVal;
    } else if (vehicleField === "fuelType") {
      const v = csvVal.toLowerCase();
      if (v.includes("petrol") || v.includes("gas")) (mapped as any).fuelType = "Petrol";
      else if (v.includes("diesel")) (mapped as any).fuelType = "Diesel";
      else if (v.includes("hybrid")) (mapped as any).fuelType = "Hybrid";
      else if (v.includes("electric")) (mapped as any).fuelType = "Electric";
      else (mapped as any).fuelType = csvVal;
    } else {
      (mapped as any)[vehicleField] = csvVal.trim();
    }
  }

  if (!mapped.make) errors.push("Missing make");
  if (!mapped.model) errors.push("Missing model");
  if (!mapped.year) errors.push("Missing year");

  const duplicate = !!(mapped.stockNumber && existingStocks.has(mapped.stockNumber));

  return { raw, mapped, errors, duplicate };
}

function generateTemplate(): string {
  return "Stock Number,Make,Model,Year,Variant,VIN,Engine Number,Registration,Colour,Body Type,Transmission,Fuel Type,Mileage,Retail Price,Cost Price,Condition,Location,MM Code,Extras\n" +
    'STK001,Toyota,Hilux,2021,2.8 GD-6 4x4,AHTFZ29G4X0123456,1GD-1234567,CA 123-456,White,Double Cab,Automatic,Diesel,45000,549900,420000,Excellent,Main Branch,93601780,"ABS Brakes,Air Conditioning,Cruise Control"';
}

export default function BulkImport({ onImportVehicles, existingStockNumbers }: Props) {
  const money = useMoney();
  const [step, setStep] = useState<"upload" | "preview" | "importing" | "done">("upload");
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [importCount, setImportCount] = useState(0);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const existingSet = new Set(existingStockNumbers.map(s => s.toLowerCase()));

  const handleFile = useCallback((file: File) => {
    setError("");
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { headers: h, rows } = parseCSV(text);
      if (rows.length === 0) { setError("No data rows found in file."); return; }

      const mappedHeaders = h.map(hdr => {
        const key = hdr.toLowerCase().trim();
        return COLUMN_MAP[key] || null;
      });
      const unmapped = h.filter((_, i) => !mappedHeaders[i]);

      setHeaders(h);
      const existingLower = new Set(existingStockNumbers.map(s => s.toLowerCase()));
      const results = rows.map(r => mapRow(r, existingLower));
      setParsed(results);
      setFileName(file.name);
      setStep("preview");
    };
    reader.readAsText(file);
  }, [existingStockNumbers]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith(".csv") || file.name.endsWith(".tsv") || file.name.endsWith(".txt"))) {
      handleFile(file);
    } else {
      setError("Please drop a CSV file.");
    }
  }, [handleFile]);

  const handleImport = async () => {
    const toImport = parsed.filter(r => r.errors.length === 0 && !(skipDuplicates && r.duplicate));
    if (toImport.length === 0) return;
    setStep("importing");
    try {
      await onImportVehicles(toImport.map(r => r.mapped));
      setImportCount(toImport.length);
      setStep("done");
    } catch (err: any) {
      setError(err?.message || "Import failed");
      setStep("preview");
    }
  };

  const valid = parsed.filter(r => r.errors.length === 0 && !(skipDuplicates && r.duplicate));
  const withErrors = parsed.filter(r => r.errors.length > 0);
  const duplicates = parsed.filter(r => r.duplicate);

  const downloadTemplate = () => {
    const blob = new Blob([generateTemplate()], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "truflow-stock-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[color:var(--white)]">Bulk Vehicle Import</h2>
          <p className="text-[12px] text-[color:var(--muted)]">Import stock from CSV — switch from VMG, third-party export, or your own spreadsheet</p>
        </div>
        <button
          onClick={downloadTemplate}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-semibold bg-[color:var(--cyan)]/10 text-[color:var(--cyan)] hover:bg-[color:var(--cyan)]/20 transition cursor-pointer"
        >
          <Download size={13} /> Download Template
        </button>
      </div>

      {/* STEP 1: Upload */}
      {step === "upload" && (
        <div
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-white/10 hover:border-[color:var(--cyan)]/30 rounded-xl p-12 flex flex-col items-center gap-4 cursor-pointer transition group"
        >
          <div className="w-16 h-16 rounded-2xl bg-[color:var(--cyan)]/10 flex items-center justify-center group-hover:bg-[color:var(--cyan)]/20 transition">
            <Upload size={28} className="text-[color:var(--cyan)]" />
          </div>
          <div className="text-center">
            <div className="text-[14px] font-semibold text-[color:var(--white)]">Drop CSV file here or click to browse</div>
            <div className="text-[12px] text-[color:var(--muted)] mt-1">Supports CSV, TSV · comma, semicolon, or tab delimited</div>
          </div>
          <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[13px]">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {/* STEP 2: Preview */}
      {step === "preview" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileSpreadsheet size={18} className="text-[color:var(--cyan)]" />
              <div>
                <div className="text-[13px] font-semibold text-[color:var(--white)]">{fileName}</div>
                <div className="text-[11px] text-[color:var(--muted)]">{parsed.length} rows parsed</div>
              </div>
            </div>
            <button onClick={() => { setStep("upload"); setParsed([]); setError(""); }} className="text-[12px] text-[color:var(--muted)] hover:text-[color:var(--white)] cursor-pointer">
              Change file
            </button>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wider text-emerald-400/70">Ready to Import</span>
              <span className="text-xl font-mono font-semibold text-emerald-400">{valid.length}</span>
            </div>
            <div className={`rounded-xl p-3 flex flex-col gap-1 border ${withErrors.length > 0 ? "bg-red-500/10 border-red-500/20" : "bg-[color:var(--glass-line)] border-white/5"}`}>
              <span className="text-[11px] uppercase tracking-wider text-[rgba(232,234,230,0.55)]">With Errors</span>
              <span className={`text-xl font-mono font-semibold ${withErrors.length > 0 ? "text-red-400" : "text-[color:var(--white)]"}`}>{withErrors.length}</span>
            </div>
            <div className={`rounded-xl p-3 flex flex-col gap-1 border ${duplicates.length > 0 ? "bg-amber-500/10 border-amber-500/20" : "bg-[color:var(--glass-line)] border-white/5"}`}>
              <span className="text-[11px] uppercase tracking-wider text-[rgba(232,234,230,0.55)]">Duplicates</span>
              <span className={`text-xl font-mono font-semibold ${duplicates.length > 0 ? "text-amber-400" : "text-[color:var(--white)]"}`}>{duplicates.length}</span>
            </div>
          </div>

          {duplicates.length > 0 && (
            <label className="flex items-center gap-2 text-[13px] text-[color:var(--white)] cursor-pointer">
              <input type="checkbox" checked={skipDuplicates} onChange={e => setSkipDuplicates(e.target.checked)} className="accent-[color:var(--cyan)]" />
              Skip duplicate stock numbers
            </label>
          )}

          <div className="overflow-x-auto rounded-xl border border-white/5 max-h-[400px] overflow-y-auto">
            <table className="w-full text-[12px]">
              <thead className="sticky top-0">
                <tr className="text-left text-[11px] uppercase tracking-wider text-[rgba(232,234,230,0.45)] bg-[rgba(20,20,20,0.95)]">
                  <th className="px-3 py-2 w-8">#</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Stock #</th>
                  <th className="px-3 py-2">Make</th>
                  <th className="px-3 py-2">Model</th>
                  <th className="px-3 py-2">Year</th>
                  <th className="px-3 py-2">Variant</th>
                  <th className="px-3 py-2 text-right">Retail</th>
                  <th className="px-3 py-2 text-right">Cost</th>
                  <th className="px-3 py-2 text-right">KM</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {parsed.map((row, i) => (
                  <tr key={i} className={`${row.errors.length > 0 ? "bg-red-500/5" : row.duplicate ? "bg-amber-500/5" : "hover:bg-[rgba(255,255,255,0.02)]"} transition-colors`}>
                    <td className="px-3 py-2 text-[color:var(--muted)]">{i + 1}</td>
                    <td className="px-3 py-2">
                      {row.errors.length > 0 ? (
                        <span className="inline-flex items-center gap-1 text-red-400 text-[11px]"><AlertCircle size={10} />{row.errors[0]}</span>
                      ) : row.duplicate ? (
                        <span className="inline-flex items-center gap-1 text-amber-400 text-[11px]"><AlertCircle size={10} />Duplicate</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-emerald-400 text-[11px]"><Check size={10} />Ready</span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-[color:var(--white)]">{row.mapped.stockNumber || "—"}</td>
                    <td className="px-3 py-2 text-[color:var(--white)]">{row.mapped.make || "—"}</td>
                    <td className="px-3 py-2 text-[color:var(--white)]">{row.mapped.model || "—"}</td>
                    <td className="px-3 py-2 text-[color:var(--white)]">{row.mapped.year || "—"}</td>
                    <td className="px-3 py-2 text-[rgba(232,234,230,0.55)]">{row.mapped.trim || "—"}</td>
                    <td className="px-3 py-2 text-right font-mono text-[color:var(--white)]">{row.mapped.retailPrice ? money(row.mapped.retailPrice) : "—"}</td>
                    <td className="px-3 py-2 text-right font-mono text-[rgba(232,234,230,0.55)]">{row.mapped.costPrice ? money(row.mapped.costPrice) : "—"}</td>
                    <td className="px-3 py-2 text-right font-mono text-[rgba(232,234,230,0.55)]">{row.mapped.mileage ? row.mapped.mileage.toLocaleString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-[12px] text-[color:var(--muted)]">
              {valid.length} vehicle{valid.length !== 1 ? "s" : ""} will be imported · TruLens photos not affected
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setStep("upload"); setParsed([]); }}
                className="px-4 py-2 rounded-lg text-[13px] font-semibold text-[color:var(--muted)] hover:text-[color:var(--white)] transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={valid.length === 0}
                className="px-6 py-2 rounded-lg text-[13px] font-semibold bg-[color:var(--cyan)] text-black hover:opacity-90 disabled:opacity-40 transition cursor-pointer"
              >
                Import {valid.length} Vehicle{valid.length !== 1 ? "s" : ""}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: Importing */}
      {step === "importing" && (
        <div className="flex flex-col items-center gap-4 py-12">
          <div className="w-12 h-12 rounded-xl bg-[color:var(--cyan)]/10 flex items-center justify-center animate-pulse">
            <Upload size={24} className="text-[color:var(--cyan)]" />
          </div>
          <div className="text-[14px] text-[color:var(--white)]">Importing vehicles...</div>
        </div>
      )}

      {/* STEP 4: Done */}
      {step === "done" && (
        <div className="flex flex-col items-center gap-4 py-12">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 flex items-center justify-center">
            <Check size={32} className="text-emerald-400" />
          </div>
          <div className="text-center">
            <div className="text-[16px] font-semibold text-[color:var(--white)]">{importCount} vehicles imported</div>
            <div className="text-[12px] text-[color:var(--muted)] mt-1">They're on the floor — open TruLens to shoot photos</div>
          </div>
          <button
            onClick={() => { setStep("upload"); setParsed([]); setImportCount(0); }}
            className="px-4 py-2 rounded-lg text-[13px] font-semibold bg-[color:var(--cyan)]/10 text-[color:var(--cyan)] hover:bg-[color:var(--cyan)]/20 transition cursor-pointer mt-2"
          >
            Import More
          </button>
        </div>
      )}

      {/* Column mapping reference */}
      {step === "upload" && (
        <details className="group">
          <summary className="flex items-center gap-2 text-[12px] text-[color:var(--muted)] cursor-pointer hover:text-[color:var(--white)] transition">
            <ChevronDown size={12} className="group-open:rotate-180 transition-transform" />
            Supported column names
          </summary>
          <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1 text-[11px] text-[rgba(232,234,230,0.55)] bg-[color:var(--glass)] rounded-lg p-4 border border-white/5">
            {Object.entries(
              Object.entries(COLUMN_MAP).reduce<Record<string, string[]>>((acc, [csv, field]) => {
                if (!acc[field]) acc[field] = [];
                acc[field].push(csv);
                return acc;
              }, {})
            ).map(([field, aliases]) => (
              <div key={field}>
                <span className="text-[color:var(--cyan)] font-mono">{field}</span>
                <span className="text-[color:var(--muted)]"> ← {aliases.join(", ")}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
