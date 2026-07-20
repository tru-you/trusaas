import { Invoice, Lead, Vehicle } from "../types";
import { Printer } from "lucide-react";

interface InvoicePreviewProps {
  invoice: Invoice;
  lead?: Lead;
  vehicle?: Vehicle;
}

export default function InvoicePreview({ invoice, lead, vehicle }: InvoicePreviewProps) {
  const exVat = invoice.amount / 1.15;
  const vat = invoice.amount - exVat;

  const formatZAR = (num: number) => {
    return "R " + Math.round(num).toLocaleString("en-ZA");
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
            body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; color: #1a1a2e; background: #fff; }
            .doc-header { display: flex; justify-content: space-between; margin-bottom: 30px; border-bottom: 2px solid #1a1a2e; padding-bottom: 16px; }
            .doc-meta { font-size: 12px; color: #555; line-height: 1.7; }
            table { width: 100%; border-collapse: collapse; margin: 24px 0; }
            th { text-align: left; padding: 10px; background: #f8f8fa; font-size: 11px; border-bottom: 2px solid #1a1a2e; text-transform: uppercase; letter-spacing: 0.5px; }
            td { padding: 10px; border-bottom: 1px solid #eee; font-size: 12px; }
            .totals { margin-left: auto; width: 280px; text-align: right; font-size: 13px; line-height: 2; margin-top: 20px; }
            .totals .grand { font-size: 18px; font-weight: 800; border-top: 2px solid #1a1a2e; padding-top: 8px; margin-top: 8px; color: #1a1a2e; }
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
      <div className="card-header flex justify-between items-center px-4 py-3 border-b border-[rgba(126,164,214,0.1)]">
        <h3 className="font-semibold text-sm">Interactive Live Document Preview</h3>
        <button
          onClick={handlePrint}
          className="btn btn-secondary btn-sm flex items-center gap-1.5"
        >
          <Printer size={13} /> Print / Save PDF
        </button>
      </div>
      <div className="card-body p-6" id="printableInvoiceFrame">
        <div className="bg-[#0f1826] text-[#1a1a2e] rounded-xl p-8 max-w-[800px] mx-auto shadow-xl font-sans">
          {/* Header */}
          <div className="flex justify-between border-b-2 border-white/10 pb-5 mb-6">
            <div>
              <div className="text-xl font-black tracking-tight text-[#122a48]">TrueCar DMS</div>
              <div className="text-[10px] text-gray-400 font-medium">Automotive Retail Operations South Africa</div>
            </div>
            <div className="text-right">
              <div className="text-lg font-black tracking-tight text-gray-900">TAX INVOICE</div>
              <div className="text-xs font-mono font-bold text-gray-600">{invoice.invoiceNumber}</div>
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-3 gap-6 mb-8 text-xs text-gray-700">
            <div>
              <div className="font-bold text-gray-900 mb-1">Merchant Provider:</div>
              <div>Johannesburg Auto (Pty) Ltd</div>
              <div>Sandton Towers, Sandhurst</div>
              <div>Johannesburg, 2196</div>
              <div>VAT Ref: 4920194857</div>
            </div>
            <div>
              <div className="font-bold text-gray-900 mb-1">Bill To:</div>
              {lead ? (
                <>
                  <div className="font-semibold">{lead.firstName} {lead.lastName}</div>
                  <div>{lead.phone}</div>
                  <div>{lead.email}</div>
                </>
              ) : (
                <div className="italic text-gray-400">Anonymous Walk-In Account</div>
              )}
            </div>
            <div>
              <div className="font-bold text-gray-900 mb-1">Invoice Info:</div>
              <div>Issued: {new Date().toISOString().slice(0, 10)}</div>
              <div>Due Limit: <span className="font-bold">{invoice.dueDate}</span></div>
              <div>Payment Mode: <span className="font-bold">{invoice.paymentMethod}</span></div>
            </div>
          </div>

          {/* Table */}
          <table className="w-full border-collapse mb-6 text-xs text-gray-800">
            <thead>
              <tr className="border-b-2 border-white/10 bg-gray-50">
                <th className="text-left py-2 px-3 font-bold text-gray-700 text-[10px]">Asset Specifications Summary</th>
                <th className="text-center py-2 px-3 font-bold text-gray-700 text-[10px] w-12">Qty</th>
                <th className="text-right py-2 px-3 font-bold text-gray-700 text-[10px] w-36">Unit Price Ex VAT</th>
                <th className="text-right py-2 px-3 font-bold text-gray-700 text-[10px] w-36">Total ZAR</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="py-3 px-3">
                  {vehicle ? (
                    <>
                      <div className="font-bold text-gray-900">{vehicle.year} {vehicle.make} {vehicle.model}</div>
                      <div className="text-[10px] text-gray-400">Stock Ref: {vehicle.stockNumber} / Trim: {vehicle.trim}</div>
                    </>
                  ) : (
                    <div className="font-bold">Standard Vehicle Asset Purchase</div>
                  )}
                </td>
                <td className="text-center py-3 px-3">1</td>
                <td className="text-right py-3 px-3 font-mono">{formatZAR(exVat)}</td>
                <td className="text-right py-3 px-3 font-mono font-semibold">{formatZAR(exVat)}</td>
              </tr>
            </tbody>
          </table>

          {/* Totals */}
          <div className="ml-auto w-64 text-right text-xs text-gray-700 flex flex-col gap-1.5 border-t border-gray-100 pt-4">
            <div className="flex justify-between">
              <span>Subtotal (Ex VAT):</span>
              <span className="font-mono">{formatZAR(exVat)}</span>
            </div>
            <div className="flex justify-between">
              <span>VAT @ 15%:</span>
              <span className="font-mono">{formatZAR(vat)}</span>
            </div>
            <div className="flex justify-between text-base font-black text-gray-900 border-t-2 border-white/10 pt-2 mt-2">
              <span>TOTAL DUE:</span>
              <span className="font-mono">{formatZAR(invoice.amount)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
