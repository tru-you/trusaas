import { Invoice, Lead, Vehicle, Dealership } from "../types";
import { Printer } from "lucide-react";
import { useMoney } from "../contexts/MarketContext";

interface InvoicePreviewProps {
  invoice: Invoice;
  lead?: Lead;
  vehicle?: Vehicle;
  dealership?: Dealership;
}

export default function InvoicePreview({ invoice, lead, vehicle, dealership }: InvoicePreviewProps) {
  const money = useMoney();
  const exVat = invoice.amount / 1.15;
  const vat = invoice.amount - exVat;

  const dealerName = dealership?.name || "Your Dealership";
  const dealerAddress = dealership?.address || dealership?.location || "";
  const dealerVat = dealership?.vatNumber || "";

  const formatZAR = (num: number) => {
    return money(num);
  };

  const handlePrint = () => {
    const content = document.getElementById("printableInvoiceFrame")?.innerHTML || "";
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html>
        <head>
          <title>Tax Invoice - ${invoice.invoiceNumber}</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; color: #06080D; background: #fff; }
            .doc-header { display: flex; justify-content: space-between; margin-bottom: 30px; border-bottom: 2px solid #06080D; padding-bottom: 16px; }
            .doc-meta { font-size: 12px; color: #6E7681; line-height: 1.7; }
            table { width: 100%; border-collapse: collapse; margin: 24px 0; }
            th { text-align: left; padding: 10px; background: #E8EAE6; font-size: 11px; border-bottom: 2px solid #06080D; letter-spacing: 0.5px; }
            td { padding: 10px; border-bottom: 1px solid rgba(6,8,13,0.08); font-size: 12px; }
            .totals { margin-left: auto; width: 280px; text-align: right; font-size: 13px; line-height: 2; margin-top: 20px; }
            .totals .grand { font-size: 18px; font-weight: 600; border-top: 2px solid #06080D; padding-top: 8px; margin-top: 8px; color: #06080D; }
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

  return (
    <div className="card mt-6">
      <div className="card-header flex justify-between items-center px-4 py-3 border-b border-[rgba(138,162,184,0.1)]">
        <h3 className="font-semibold text-[16px]">Interactive Live Document Preview</h3>
        <button
          onClick={handlePrint}
          className="btn btn-secondary btn-sm flex items-center gap-2"
        >
          <Printer size={13} /> Print / Save PDF
        </button>
      </div>
      <div className="card-body p-6" id="printableInvoiceFrame">
        <div className="bg-white text-[color:var(--tru-ink-900)] rounded-xl p-8 max-w-[800px] mx-auto shadow-xl font-sans">
          {/* Header */}
          <div className="flex justify-between border-b-2 border-[color:var(--tru-ink-900)]/12 pb-5 mb-6">
            <div>
              <div className="text-xl font-semibold tracking-tight">{dealerName}</div>
              {dealerAddress && (
                <div className="text-[13px] text-[color:var(--tru-ink-300)] font-medium">{dealerAddress}</div>
              )}
            </div>
            <div className="text-right">
              <div className="text-lg font-semibold tracking-tight">TAX INVOICE</div>
              <div className="text-[13px] font-mono font-semibold text-[color:var(--tru-ink-600)]">{invoice.invoiceNumber}</div>
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-3 gap-6 mb-8 text-[13px] text-[color:var(--tru-ink-700)]">
            <div>
              <div className="font-semibold text-[color:var(--tru-ink-900)] mb-1">Merchant Provider:</div>
              <div>{dealerName}</div>
              {dealerAddress && dealerAddress.split("\n").map((line, i) => (
                <div key={i}>{line}</div>
              ))}
              {dealerVat && <div>VAT Ref: {dealerVat}</div>}
            </div>
            <div>
              <div className="font-semibold text-[color:var(--tru-ink-900)] mb-1">Bill To:</div>
              {lead ? (
                <>
                  <div className="font-semibold">{lead.firstName} {lead.lastName}</div>
                  <div>{lead.phone}</div>
                  <div>{lead.email}</div>
                </>
              ) : (
                <div className="italic text-[color:var(--tru-ink-300)]">Walk-in</div>
              )}
            </div>
            <div>
              <div className="font-semibold text-[color:var(--tru-ink-900)] mb-1">Invoice Info:</div>
              <div>Issued: {new Date().toISOString().slice(0, 10)}</div>
              <div>Due Limit: <span className="font-semibold">{invoice.dueDate}</span></div>
              <div>Payment Mode: <span className="font-semibold">{invoice.paymentMethod}</span></div>
            </div>
          </div>

          {/* Table */}
          <table className="w-full border-collapse mb-6 text-[13px] text-[color:var(--tru-ink-700)]">
            <thead>
              <tr className="border-b-2 border-[color:var(--tru-ink-900)]/12 bg-[color:var(--tru-paper)]">
                <th className="text-left py-2 px-3 font-semibold text-[color:var(--tru-ink-700)] text-[13px]">Vehicle</th>
                <th className="text-center py-2 px-3 font-semibold text-[color:var(--tru-ink-700)] text-[13px] w-12">Qty</th>
                <th className="text-right py-2 px-3 font-semibold text-[color:var(--tru-ink-700)] text-[13px] w-36">Unit price ex VAT</th>
                <th className="text-right py-2 px-3 font-semibold text-[color:var(--tru-ink-700)] text-[13px] w-36">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-[color:var(--tru-ink-900)]/8">
                <td className="py-3 px-3">
                  {vehicle ? (
                    <>
                      <div className="font-semibold text-[color:var(--tru-ink-900)]">{vehicle.year} {vehicle.make} {vehicle.model}</div>
                      <div className="text-[13px] text-[color:var(--tru-ink-300)]">Stock Ref: {vehicle.stockNumber} / Trim: {vehicle.trim}</div>
                    </>
                  ) : (
                    <div className="font-semibold">Standard Vehicle Asset Purchase</div>
                  )}
                </td>
                <td className="text-center py-3 px-3">1</td>
                <td className="text-right py-3 px-3 font-mono">{formatZAR(exVat)}</td>
                <td className="text-right py-3 px-3 font-mono font-semibold">{formatZAR(exVat)}</td>
              </tr>
            </tbody>
          </table>

          {/* Totals */}
          <div className="ml-auto w-64 text-right text-[13px] text-[color:var(--tru-ink-700)] flex flex-col gap-2 border-t border-[color:var(--tru-ink-900)]/8 pt-4">
            <div className="flex justify-between">
              <span>Subtotal (Ex VAT):</span>
              <span className="font-mono">{formatZAR(exVat)}</span>
            </div>
            <div className="flex justify-between">
              <span>VAT @ 15%:</span>
              <span className="font-mono">{formatZAR(vat)}</span>
            </div>
            <div className="flex justify-between text-base font-semibold text-[color:var(--tru-ink-900)] border-t-2 border-[color:var(--tru-ink-900)]/12 pt-2 mt-2">
              <span>TOTAL DUE:</span>
              <span className="font-mono">{formatZAR(invoice.amount)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
