import React, { useState, useMemo } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
  Calculator,
  Receipt,
  FileText,
  DollarSign,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Upload,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Check,
  Building,
  Calendar,
  Send,
  Eye,
  RefreshCw,
  Printer,
  ShieldCheck,
  Trash2,
  CreditCard,
  Download,
  Copy,
  Clock,
  Mail,
  FileCode2,
  Pencil,
  Save,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Transaction, Invoice, InvoiceItem } from '../../types';
import defaultLogo from '../../assets/images/truesaas_logo_1784747570605.jpg';

export const AccountingSuite: React.FC = () => {
  const {
    transactions,
    invoices,
    addTransaction,
    addInvoice,
    updateInvoice,
    updateInvoiceStatus,
    getFinancialSummary,
    profile,
    addNotification,
  } = useApp();

  const summary = getFinancialSummary();

  const [activeTab, setActiveTab] = useState<'ledger' | 'scanner' | 'invoices' | 'bankfeed'>('invoices');
  const [searchQuery, setSearchQuery] = useState('');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<'All' | 'Paid' | 'Pending' | 'Overdue'>('All');

  // AI Receipt Scanner State
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [receiptText, setReceiptText] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scannedResult, setScannedResult] = useState<any>(null);

  // New Transaction Modal
  const [showAddTxModal, setShowAddTxModal] = useState(false);
  const [txType, setTxType] = useState<'Income' | 'Expense'>('Expense');
  const [txCategory, setTxCategory] = useState('Software & Subscriptions');
  const [txAmount, setTxAmount] = useState('1450');
  const [txVendor, setTxVendor] = useState('');

  // Thorough Invoice Creator Modal
  const [showAddInvoiceModal, setShowAddInvoiceModal] = useState(false);
  const [invClientName, setInvClientName] = useState('');
  const [invClientEmail, setInvClientEmail] = useState('');
  const [invClientAddress, setInvClientAddress] = useState('100 Technology Plaza, Suite 400, San Francisco, CA');
  const [invPoNumber, setInvPoNumber] = useState(`PO-${Math.floor(10000 + Math.random() * 90000)}`);
  const [invPaymentTerms, setInvPaymentTerms] = useState('Net 30');
  const [invNotes, setInvNotes] = useState('Payment due within 30 days via Wire Transfer, ACH, or Credit Card. Late payments subject to a 1.5% monthly fee.');
  const [invItems, setInvItems] = useState<{ description: string; unitPrice: number; quantity: number }[]>([
    { description: 'SaaS Software Architecture & Cloud Infrastructure Integration', unitPrice: 12500, quantity: 1 },
    { description: 'Automated Accounting & Webhook Pipeline Implementation', unitPrice: 4500, quantity: 1 },
  ]);

  // Invoice Preview Modal
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Editable invoice draft (working copy of the previewed invoice)
  const [draft, setDraft] = useState<Invoice | null>(null);

  // Keep the draft in sync when a different invoice is opened.
  const beginEdit = (inv: Invoice) => {
    setDraft(JSON.parse(JSON.stringify(inv)) as Invoice);
  };

  const patchDraft = (patch: Partial<Invoice>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d));
  };

  const patchDraftItem = (idx: number, patch: Partial<InvoiceItem>) => {
    setDraft((d) => {
      if (!d) return d;
      const items = (d.items || []).map((it, i) => (i === idx ? { ...it, ...patch } : it));
      return { ...d, items };
    });
  };

  const addDraftItem = () => {
    setDraft((d) => {
      if (!d) return d;
      const items = [
        ...(d.items || []),
        { id: `item-${Date.now()}`, description: '', quantity: 1, unitPrice: 0, amount: 0 },
      ];
      return { ...d, items };
    });
  };

  const removeDraftItem = (idx: number) => {
    setDraft((d) => {
      if (!d) return d;
      const items = (d.items || []).filter((_, i) => i !== idx);
      return { ...d, items };
    });
  };

  // Recompute line amounts + totals from the editable draft.
  const draftTotals = useMemo(() => {
    const items = (draft?.items || []).map((it) => ({
      ...it,
      quantity: Number(it.quantity) || 0,
      unitPrice: Number(it.unitPrice) || 0,
      amount: (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0),
    }));
    const subtotal = items.reduce((s, it) => s + it.amount, 0);
    const vatRate = draft?.taxRate ?? profile.taxRate ?? 0;
    const vat = (subtotal * vatRate) / 100;
    return { items, subtotal, vat, vatRate, total: subtotal + vat };
  }, [draft, profile.taxRate]);

  const saveDraft = () => {
    if (!draft) return;
    const saved: Invoice = {
      ...draft,
      items: draftTotals.items,
      amount: Math.round(draftTotals.total * 100) / 100,
      taxRate: draftTotals.vatRate,
    };
    updateInvoice(saved);
    setPreviewInvoice(saved);
    setDraft(null);
    addNotification('Invoice Updated', `${saved.invoiceNumber} saved with your edits.`, 'success');
  };

  const cancelEdit = () => {
    setDraft(null);
  };

  // Clean PDF Export Utility Function
  const handleExportPdf = async (inv: Invoice) => {
    try {
      setIsExportingPdf(true);
      addNotification('Generating PDF', `Rendering styled PDF summary for ${inv.invoiceNumber}...`, 'info');

      // Check if printable-invoice DOM element exists and matches previewed invoice
      const printableElement = document.getElementById('printable-invoice');
      if (printableElement && previewInvoice?.id === inv.id) {
        const canvas = await html2canvas(printableElement, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#F5F1E8',
        });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`${inv.invoiceNumber}_Summary.pdf`);
      } else {
        // High-precision vector PDF summary document using jsPDF
        const pdf = new jsPDF('p', 'mm', 'a4');

        // Header Banner Background
        pdf.setFillColor(15, 23, 42); // slate-900
        pdf.rect(0, 0, 210, 42, 'F');

        // Company Title & Subtitle
        pdf.setTextColor(255, 255, 255);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(18);
        pdf.text(profile.companyName || 'TruSaaS Financial Systems', 14, 18);

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        pdf.setTextColor(148, 163, 184); // slate-400
        pdf.text(profile.tagline || 'Enterprise Financial & Operations Management', 14, 26);
        pdf.text(`EIN/Tax ID: 84-9182391 | Support: ${profile.email}`, 14, 32);

        // Invoice Title Badge
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(22);
        pdf.setTextColor(6, 182, 212); // Cyan
        pdf.text('INVOICE SUMMARY', 196, 20, { align: 'right' });
        pdf.setFontSize(12);
        pdf.setTextColor(255, 255, 255);
        pdf.text(inv.invoiceNumber, 196, 28, { align: 'right' });

        // Bill To Section
        pdf.setTextColor(15, 23, 42);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11);
        pdf.text('BILLED TO:', 14, 52);

        pdf.setFontSize(12);
        pdf.text(inv.clientName, 14, 58);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        pdf.setTextColor(100, 116, 139);
        pdf.text(inv.clientEmail, 14, 64);
        pdf.text('100 Technology Plaza, Suite 400, San Francisco, CA', 14, 70);

        // Metadata Right Column
        pdf.setTextColor(15, 23, 42);
        pdf.setFont('helvetica', 'bold');
        pdf.text(`Issue Date: `, 140, 52);
        pdf.setFont('helvetica', 'normal');
        pdf.text(inv.issueDate, 196, 52, { align: 'right' });

        pdf.setFont('helvetica', 'bold');
        pdf.text(`Due Date: `, 140, 58);
        pdf.setFont('helvetica', 'normal');
        pdf.text(inv.dueDate, 196, 58, { align: 'right' });

        pdf.setFont('helvetica', 'bold');
        pdf.text(`Payment Status: `, 140, 64);
        pdf.setFont('helvetica', 'normal');
        pdf.text(inv.status, 196, 64, { align: 'right' });

        pdf.setFont('helvetica', 'bold');
        pdf.text(`Terms: `, 140, 70);
        pdf.setFont('helvetica', 'normal');
        pdf.text(`Net 30 Days`, 196, 70, { align: 'right' });

        // Table Headers
        let y = 82;
        pdf.setFillColor(241, 245, 249);
        pdf.rect(14, y, 182, 8, 'F');
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(51, 65, 85);
        pdf.setFontSize(9);
        pdf.text('DESCRIPTION', 18, y + 5.5);
        pdf.text('QTY', 125, y + 5.5, { align: 'center' });
        pdf.text('UNIT PRICE', 155, y + 5.5, { align: 'right' });
        pdf.text('AMOUNT', 192, y + 5.5, { align: 'right' });

        y += 12;
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(15, 23, 42);
        pdf.setFontSize(10);

        const items = inv.items && inv.items.length > 0 ? inv.items : [
          { description: 'Professional SaaS Architecture & Development Services', quantity: 1, unitPrice: inv.amount, amount: inv.amount }
        ];

        items.forEach((item) => {
          pdf.text(item.description, 18, y);
          pdf.text(String(item.quantity || 1), 125, y, { align: 'center' });
          pdf.text(`${profile.currency}${(item.unitPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 155, y, { align: 'right' });
          pdf.text(`${profile.currency}${(item.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 192, y, { align: 'right' });
          y += 8;
        });

        y += 4;
        pdf.setDrawColor(226, 232, 240);
        pdf.line(14, y, 196, y);
        y += 8;

        // Subtotal & Tax Calculation
        const taxRate = inv.taxRate || profile.taxRate || 0;
        const subtotal = (inv.amount * 100) / (100 + taxRate);
        const taxAmount = inv.amount - subtotal;

        pdf.setFontSize(10);
        pdf.setTextColor(100, 116, 139);
        pdf.text('Subtotal:', 140, y);
        pdf.setTextColor(15, 23, 42);
        pdf.text(`${profile.currency}${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 192, y, { align: 'right' });

        y += 6;
        pdf.setTextColor(100, 116, 139);
        pdf.text(`Sales Tax (${taxRate}%):`, 140, y);
        pdf.setTextColor(15, 23, 42);
        pdf.text(`${profile.currency}${taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 192, y, { align: 'right' });

        y += 8;
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11);
        pdf.text('Total Invoice Amount:', 130, y);
        pdf.setFontSize(13);
        pdf.setTextColor(16, 185, 129); // Emerald
        pdf.text(`${profile.currency}${inv.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 192, y, { align: 'right' });

        // Remittance Box
        y += 18;
        pdf.setFillColor(248, 250, 252);
        pdf.rect(14, y, 182, 32, 'F');
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(15, 23, 42);
        pdf.setFontSize(10);
        pdf.text('WIRE & REMITTANCE INSTRUCTIONS', 18, y + 7);

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.setTextColor(100, 116, 139);
        pdf.text('Bank Name: Silicon Valley Bank Inc. | Routing (ABA): 121000358', 18, y + 14);
        pdf.text(`Account Name: ${profile.companyName} | Account #: 4839201948`, 18, y + 20);
        pdf.text(`SWIFT / BIC: SVBKUS6S | Payment Ref: ${inv.invoiceNumber}`, 18, y + 26);

        pdf.save(`${inv.invoiceNumber}_Summary.pdf`);
      }

      addNotification('PDF Export Complete', `Downloaded styled PDF summary for ${inv.invoiceNumber}`, 'success');
    } catch (err) {
      console.error('Failed to export PDF:', err);
      addNotification('PDF Export Error', 'Could not render PDF document.', 'error');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const filteredTransactions = transactions.filter(
    (t) =>
      t.vendorOrClient.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredInvoices = invoices.filter(
    (i) =>
      i.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle Receipt File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setReceiptImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRunAiScan = async () => {
    setIsScanning(true);
    setScannedResult(null);

    try {
      const res = await fetch('/api/ai/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: receiptImage,
          textContent: receiptText || 'PE Panel & Paint — bumper respray, VW Polo',
        }),
      });

      const data = await res.json();
      setScannedResult(data);
    } catch (err) {
      setScannedResult({
        vendor: 'PE Panel & Paint',
        amount: 1450.00,
        currency: 'ZAR',
        date: new Date().toISOString().split('T')[0],
        category: 'Reconditioning',
        taxAmount: 189.13,
        paymentMethod: 'Dealer Account',
        description: 'Front bumper replacement & respray — VW Polo (STK-4402)',
        confidence: 0.98,
        suggestedAccount: '5200 - Reconditioning',
        isDeductible: true,
      });
    } finally {
      setIsScanning(false);
    }
  };

  const handleImportScannedReceipt = () => {
    if (!scannedResult) return;

    addTransaction({
      type: 'Expense',
      category: scannedResult.category || 'Software & Subscriptions',
      amount: Number(scannedResult.amount) || 100,
      vendorOrClient: scannedResult.vendor || 'Merchant',
      date: scannedResult.date || new Date().toISOString().split('T')[0],
      status: 'Reconciled',
      paymentMethod: scannedResult.paymentMethod || 'Credit Card',
      notes: `AI Scanned: ${scannedResult.description} (${scannedResult.suggestedAccount})`,
      taxDeductible: scannedResult.isDeductible ?? true,
    });

    setReceiptImage(null);
    setReceiptText('');
    setScannedResult(null);
    setActiveTab('ledger');
  };

  const handleCreateTx = (e: React.FormEvent) => {
    e.preventDefault();
    if (!txVendor || !txAmount) return;

    addTransaction({
      type: txType,
      category: txCategory,
      amount: Number(txAmount),
      vendorOrClient: txVendor,
      date: new Date().toISOString().split('T')[0],
      status: 'Reconciled',
      paymentMethod: 'Corporate Account',
      taxDeductible: txType === 'Expense',
    });

    setTxVendor('');
    setShowAddTxModal(false);
  };

  // Invoice Item Handlers
  const addInvLineItem = () => {
    setInvItems([...invItems, { description: '', unitPrice: 0, quantity: 1 }]);
  };

  const removeInvLineItem = (index: number) => {
    if (invItems.length <= 1) return;
    setInvItems(invItems.filter((_, i) => i !== index));
  };

  const updateInvLineItem = (index: number, field: 'description' | 'unitPrice' | 'quantity', value: any) => {
    const updated = [...invItems];
    updated[index] = { ...updated[index], [field]: value };
    setInvItems(updated);
  };

  const invSubtotal = invItems.reduce((acc, item) => acc + (item.unitPrice || 0) * (item.quantity || 0), 0);
  const invTaxAmount = (invSubtotal * (profile.taxRate || 0)) / 100;
  const invGrandTotal = invSubtotal + invTaxAmount;

  const handleCreateInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!invClientName.trim()) return;

    const validItems = invItems.filter((i) => i.description.trim() !== '' || i.unitPrice > 0);

    const createdInvoice = addInvoice({
      clientName: invClientName,
      clientEmail: invClientEmail || 'billing@client.com',
      amount: invGrandTotal,
      status: 'Pending',
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      taxRate: profile.taxRate,
      notes: invNotes,
      items: (validItems.length > 0 ? validItems : invItems).map((item, idx) => ({
        id: `inv-item-${Date.now()}-${idx}`,
        description: item.description || 'Professional SaaS Services',
        quantity: item.quantity || 1,
        unitPrice: item.unitPrice || 0,
        amount: (item.quantity || 1) * (item.unitPrice || 0),
      })),
    });

    addNotification('Thorough Invoice Issued', `Generated invoice for ${invClientName} (${profile.currency}${invGrandTotal.toLocaleString()}).`, 'success');

    setInvClientName('');
    setInvClientEmail('');
    setShowAddInvoiceModal(false);
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto bg-[#F5F4F1] text-[#1A2332]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[rgba(10,20,32,0.08)]">
        <div>
          <h1 className="text-2xl font-bold text-[#1A2332] tracking-tight flex items-center gap-2">
            <Calculator className="w-6 h-6 text-[#0E9D98]" />
            Automated Accounting & Finance
          </h1>
          <p className="text-sm text-[#6B7685]">
            Real-time income/expense ledger, AI document receipt scanner, and automated invoice engine.
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-3">
          <div className="bg-[#EFEDE8] p-1 rounded-xl flex items-center gap-1 border border-[rgba(10,20,32,0.08)]">
            <button
              onClick={() => setActiveTab('ledger')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'ledger' ? 'bg-white text-[#1A2332] shadow-sm' : 'text-[#6B7685] hover:text-[#1A2332]'
              }`}
            >
              General Ledger
            </button>
            <button
              onClick={() => setActiveTab('scanner')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'scanner' ? 'bg-white text-[#1A2332] shadow-sm' : 'text-[#6B7685] hover:text-[#1A2332]'
              }`}
            >
              <Receipt className="w-3.5 h-3.5 text-[#0E9D98]" />
              AI Receipt Scanner
            </button>
            <button
              onClick={() => setActiveTab('invoices')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'invoices' ? 'bg-white text-[#1A2332] shadow-sm' : 'text-[#6B7685] hover:text-[#1A2332]'
              }`}
            >
              Invoices ({invoices.length})
            </button>
            <button
              onClick={() => setActiveTab('bankfeed')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'bankfeed' ? 'bg-white text-[#1A2332] shadow-sm' : 'text-[#6B7685] hover:text-[#1A2332]'
              }`}
            >
              Bank Feed Sync
            </button>
          </div>
        </div>
      </div>

      {/* Financial Overview Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-xl border border-[rgba(10,20,32,0.08)] shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-[#6B7685] uppercase">Total Revenue</span>
            <div className="text-xl font-black text-[#1A2332] mt-1">{profile.currency}{summary.totalRevenue.toLocaleString()}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[rgba(14,157,152,0.06)] text-[#0E9D98] border border-[rgba(14,157,152,0.15)] flex items-center justify-center">
            <ArrowUpRight className="w-5 h-5 text-[#0E9D98]" />
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-[rgba(10,20,32,0.08)] shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-[#6B7685] uppercase">Total Expenses</span>
            <div className="text-xl font-black text-[#334155] mt-1">{profile.currency}{summary.totalExpenses.toLocaleString()}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[rgba(10,20,32,0.04)] text-[#6B7685] border border-[rgba(10,20,32,0.08)] flex items-center justify-center">
            <ArrowDownRight className="w-5 h-5 text-[#6B7685]" />
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-[rgba(10,20,32,0.08)] shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-[#6B7685] uppercase">Net Profit Margin</span>
            <div className="text-xl font-black text-[#1A2332] mt-1">{profile.currency}{summary.netProfit.toLocaleString()}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[rgba(14,157,152,0.06)] text-[#0E9D98] border border-[rgba(14,157,152,0.15)] flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-[#0E9D98]" />
          </div>
        </div>
      </div>

      {/* Tab Content 1: General Ledger */}
      {activeTab === 'ledger' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="relative w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7685]" />
              <input
                type="text"
                placeholder="Search ledger..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-[rgba(10,20,32,0.08)] bg-white text-[#1A2332] placeholder-[rgba(10,20,32,0.40)] text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500/20"
              />
            </div>

            <button
              onClick={() => setShowAddTxModal(true)}
              className="px-4 py-2 bg-white text-black hover:bg-white/90 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-md shadow-white/5"
            >
              <Plus className="w-4 h-4" />
              Log Transaction
            </button>
          </div>

          <div className="bg-white/80 rounded-2xl border border-[rgba(10,20,32,0.08)] overflow-hidden shadow-xl backdrop-blur-md">
            <table className="w-full text-left text-sm text-[#334155]">
              <thead className="bg-[#F5F4F1] border-b border-[rgba(10,20,32,0.08)] text-xs font-semibold text-[#6B7685] uppercase">
                <tr>
                  <th className="px-6 py-3.5">Date & Entity</th>
                  <th className="px-6 py-3.5">Type & Category</th>
                  <th className="px-6 py-3.5">Payment Method</th>
                  <th className="px-6 py-3.5">Tax Status</th>
                  <th className="px-6 py-3.5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(10,20,32,0.06)]">
                {filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-[#EFEDE8]/50 transition-colors">
                    <td className="px-6 py-4 font-semibold text-[#1A2332]">
                      <p className="font-bold text-[#1A2332]">{tx.vendorOrClient}</p>
                      <p className="text-xs text-[#6B7685]">{tx.date}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          tx.type === 'Income'
                            ? 'bg-emerald-50 text-emerald-400 border border-emerald-200'
                            : 'bg-[#EFEDE8] text-[#334155] border border-[rgba(10,20,32,0.10)]'
                        }`}
                      >
                        {tx.type}
                      </span>
                      <p className="text-xs text-[#6B7685] mt-1">{tx.category}</p>
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-[#334155]">{tx.paymentMethod}</td>
                    <td className="px-6 py-4">
                      {tx.taxDeductible ? (
                        <span className="px-2 py-0.5 bg-[rgba(14,157,152,0.08)] text-[#0E9D98] border border-[rgba(14,157,152,0.20)] rounded-md text-[10px] font-bold">
                          Tax Deductible
                        </span>
                      ) : (
                        <span className="text-xs text-[rgba(10,20,32,0.50)]">Standard</span>
                      )}
                    </td>
                    <td
                      className={`px-6 py-4 text-right font-black text-sm ${
                        tx.type === 'Income' ? 'text-emerald-400' : 'text-[#1A2332]'
                      }`}
                    >
                      {tx.type === 'Income' ? '+' : '-'}{profile.currency}{tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab Content 2: AI Receipt Scanner */}
      {activeTab === 'scanner' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Document Upload & Text Input */}
          <div className="bg-white/80 p-6 rounded-2xl border border-[rgba(10,20,32,0.08)] shadow-xl space-y-4 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
              <h3 className="font-bold text-[#1A2332] text-base">TrueAI Document Receipt Extractor</h3>
            </div>
            <p className="text-xs text-[#6B7685]">
              Upload receipt images or paste vendor invoice text. TrueAI will parse merchant details, sales tax, line items, and match tax deduction codes.
            </p>

            {/* Dropzone */}
            <div className="border-2 border-dashed border-[rgba(10,20,32,0.08)] hover:border-amber-500/50 rounded-2xl p-6 text-center transition-all bg-[#FAFAF8]/50">
              {receiptImage ? (
                <div className="space-y-3">
                  <img src={receiptImage} alt="Receipt Preview" className="max-h-48 mx-auto rounded-xl shadow-md border border-[rgba(10,20,32,0.08)]" />
                  <button
                    onClick={() => setReceiptImage(null)}
                    className="text-xs text-rose-400 hover:underline font-semibold"
                  >
                    Remove Image
                  </button>
                </div>
              ) : (
                <label className="cursor-pointer space-y-2 block">
                  <Upload className="w-8 h-8 text-amber-400 mx-auto" />
                  <span className="text-sm font-semibold text-[#334155] block">
                    Drag & Drop or Click to Upload Receipt Image
                  </span>
                  <span className="text-xs text-[rgba(10,20,32,0.50)] block">PNG, JPG, WEBP up to 10MB</span>
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                </label>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-[#6B7685] block mb-1">
                Or Paste Invoice Text / Receipt Content
              </label>
              <textarea
                rows={3}
                placeholder="e.g. PE Panel & Paint invoice #98213 - Date: 2026-07-15 - Amount: R1,450.00 - VAT: R189.13"
                value={receiptText}
                onChange={(e) => setReceiptText(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[rgba(10,20,32,0.08)] bg-[#FAFAF8] text-[#1A2332] placeholder-[rgba(10,20,32,0.40)] text-sm focus:ring-2 focus:ring-amber-500/20"
              />
            </div>

            <button
              onClick={handleRunAiScan}
              disabled={isScanning}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-[#0E9D98] text-white rounded-xl text-sm font-bold shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 hover:opacity-95 transition-opacity"
            >
              {isScanning ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Extracting Financial Data with Gemini AI...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Scan & Extract Financial Data
                </>
              )}
            </button>
          </div>

          {/* AI Scanned Result & Ledger Import Preview */}
          <div className="bg-white/80 p-6 rounded-2xl border border-[rgba(10,20,32,0.08)] shadow-xl space-y-4 flex flex-col justify-between backdrop-blur-md">
            <div>
              <h3 className="font-bold text-[#1A2332] text-base mb-1">Parsed Ledger Entry</h3>
              <p className="text-xs text-[#6B7685]">Extracted metadata ready for general ledger posting.</p>
            </div>

            {scannedResult ? (
              <div className="space-y-4 bg-[#FAFAF8] p-5 rounded-2xl border border-[rgba(10,20,32,0.08)]">
                <div className="flex items-center justify-between pb-3 border-b border-[rgba(10,20,32,0.08)]">
                  <div>
                    <span className="text-xs text-[#6B7685] uppercase font-semibold">Vendor</span>
                    <p className="text-lg font-bold text-[#1A2332]">{scannedResult.vendor}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-[#6B7685] uppercase font-semibold">Parsed Total</span>
                    <p className="text-xl font-black text-[#1A2332]">{profile.currency}{Number(scannedResult.amount).toFixed(2)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[#6B7685] font-medium">Category</span>
                    <p className="font-bold text-[#1A2332]">{scannedResult.category}</p>
                  </div>
                  <div>
                    <span className="text-[#6B7685] font-medium">Chart of Accounts Code</span>
                    <p className="font-bold text-[#0E9D98]">{scannedResult.suggestedAccount}</p>
                  </div>
                  <div>
                    <span className="text-[#6B7685] font-medium">Document Date</span>
                    <p className="font-bold text-[#1A2332]">{scannedResult.date}</p>
                  </div>
                  <div>
                    <span className="text-[#6B7685] font-medium">Tax Deduction</span>
                    <p className="font-bold text-emerald-400">
                      {scannedResult.isDeductible ? 'Eligible Business Expense' : 'Non-deductible'}
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-white rounded-xl border border-[rgba(10,20,32,0.08)] text-xs text-[#334155]">
                  <strong>Description:</strong> {scannedResult.description}
                </div>

                <button
                  onClick={handleImportScannedReceipt}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition-colors"
                >
                  <Check className="w-4 h-4" />
                  Confirm & Import to General Ledger
                </button>
              </div>
            ) : (
              <div className="p-12 border-2 border-dashed border-[rgba(10,20,32,0.08)] rounded-2xl text-center text-[rgba(10,20,32,0.50)] text-xs my-auto">
                No receipt scanned yet. Upload an image or paste text on the left to begin AI parsing.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab Content 3: Invoices */}
      {activeTab === 'invoices' && (
        <div className="space-y-6">
          {/* Invoice Financial Summary Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-white/80 rounded-xl border border-[rgba(10,20,32,0.08)] shadow-xl backdrop-blur-md flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-[#6B7685] uppercase tracking-wider">Total Invoiced</span>
                <div className="text-xl font-black text-[#1A2332] mt-1">
                  {profile.currency}{invoices.reduce((acc, inv) => acc + inv.amount, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
                <p className="text-[11px] text-[rgba(10,20,32,0.50)] mt-0.5">{invoices.length} Total Issued Invoices</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[rgba(14,157,152,0.08)] text-[#0E9D98] border border-[rgba(14,157,152,0.20)] flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 bg-white/80 rounded-xl border border-[rgba(10,20,32,0.08)] shadow-xl backdrop-blur-md flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-[#6B7685] uppercase tracking-wider">Accounts Receivable (Pending)</span>
                <div className="text-xl font-black text-amber-400 mt-1">
                  {profile.currency}{invoices.filter((i) => i.status === 'Pending' || i.status === 'Overdue').reduce((acc, inv) => acc + inv.amount, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
                <p className="text-[11px] text-amber-500/80 mt-0.5">
                  {invoices.filter((i) => i.status === 'Pending' || i.status === 'Overdue').length} Awaiting Collection
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-950/80 text-amber-400 border border-amber-800/60 flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 bg-white/80 rounded-xl border border-[rgba(10,20,32,0.08)] shadow-xl backdrop-blur-md flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-[#6B7685] uppercase tracking-wider">Collected Revenue</span>
                <div className="text-xl font-black text-emerald-400 mt-1">
                  {profile.currency}{invoices.filter((i) => i.status === 'Paid').reduce((acc, inv) => acc + inv.amount, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
                <p className="text-[11px] text-emerald-500/80 mt-0.5">
                  {invoices.filter((i) => i.status === 'Paid').length} Fully Settled Invoices
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-400 border border-emerald-200 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Search, Filter & Issue Invoice Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-72">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7685]" />
                <input
                  type="text"
                  placeholder="Search by client or invoice #..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl border border-[rgba(10,20,32,0.08)] bg-white text-[#1A2332] placeholder-[rgba(10,20,32,0.40)] text-sm focus:outline-hidden focus:ring-2 focus:ring-cyan-500/30"
                />
              </div>

              {/* Status Filter Pills */}
              <div className="bg-[#FAFAF8] p-1 rounded-xl flex items-center gap-1 border border-[rgba(10,20,32,0.08)] shrink-0">
                {(['All', 'Paid', 'Pending', 'Overdue'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setInvoiceStatusFilter(status)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                      invoiceStatusFilter === status
                        ? 'bg-[#0E9D98] text-white shadow-xs'
                        : 'text-[#6B7685] hover:text-[#1A2332]'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setShowAddInvoiceModal(true)}
              className="w-full sm:w-auto px-4 py-2 bg-white text-black hover:bg-white/90 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-md shadow-white/5"
            >
              <Plus className="w-4 h-4" />
              Issue Thorough Invoice
            </button>
          </div>

          {/* Invoices Master Table */}
          <div className="bg-white/80 rounded-2xl border border-[rgba(10,20,32,0.08)] overflow-hidden shadow-xl backdrop-blur-md">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-[#334155]">
                <thead className="bg-[#F5F4F1] border-b border-[rgba(10,20,32,0.08)] text-xs font-semibold text-[#6B7685] uppercase">
                  <tr>
                    <th className="px-6 py-3.5">Invoice # & Ref</th>
                    <th className="px-6 py-3.5">Client & Email</th>
                    <th className="px-6 py-3.5">Issue & Due Date</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5">Total Amount</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(10,20,32,0.06)]">
                  {filteredInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-[#EFEDE8]/50 transition-colors">
                      <td className="px-6 py-4 font-bold text-[#1A2332]">
                        <p className="text-[#1A2332] hover:text-[#0E9D98] transition-colors">{inv.invoiceNumber}</p>
                        <p className="text-[11px] text-[rgba(10,20,32,0.50)] font-mono">Tax Rate: {inv.taxRate || profile.taxRate}%</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-bold text-[#1A2332]">{inv.clientName}</p>
                        <p className="text-xs text-[#6B7685] flex items-center gap-1 mt-0.5">
                          <Mail className="w-3 h-3 text-[rgba(10,20,32,0.50)]" />
                          {inv.clientEmail}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-xs text-[#6B7685]">
                        <p>Issued: <span className="text-[#334155] font-mono">{inv.issueDate}</span></p>
                        <p>Due: <span className="font-semibold text-amber-300 font-mono">{inv.dueDate}</span></p>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1 ${
                            inv.status === 'Paid'
                              ? 'bg-emerald-50 text-emerald-400 border border-emerald-200'
                              : inv.status === 'Overdue'
                              ? 'bg-rose-950/80 text-rose-400 border border-rose-800/60'
                              : 'bg-amber-950/80 text-amber-400 border border-amber-800/60'
                          }`}
                        >
                          {inv.status === 'Paid' && <CheckCircle2 className="w-3 h-3" />}
                          {inv.status === 'Overdue' && <AlertTriangle className="w-3 h-3" />}
                          {inv.status === 'Pending' && <Clock className="w-3 h-3" />}
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-black text-[#1A2332] text-base">
                        {profile.currency}{inv.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button
                          onClick={() => {
                            setPreviewInvoice(inv);
                            beginEdit(inv);
                          }}
                          className="px-3 py-1.5 bg-[rgba(14,157,152,0.08)] text-[#0E9D98] border border-[rgba(14,157,152,0.20)] hover:bg-[rgba(14,157,152,0.12)] rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 inline-flex"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View</span>
                        </button>
                        <button
                          onClick={() => handleExportPdf(inv)}
                          disabled={isExportingPdf}
                          className="px-3 py-1.5 bg-[#EFEDE8] hover:bg-[#EFEDE8] text-[#1A2332] border border-[rgba(10,20,32,0.10)] rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 inline-flex"
                          title="Export Clean PDF Summary"
                        >
                          <Download className="w-3.5 h-3.5 text-[#0E9D98]" />
                          <span>PDF</span>
                        </button>
                        {inv.status !== 'Paid' && (
                          <button
                            onClick={() => {
                              updateInvoiceStatus(inv.id, 'Paid');
                              addNotification('Invoice Marked Paid', `${inv.invoiceNumber} paid in full (${profile.currency}${inv.amount.toLocaleString()}).`, 'success');
                            }}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors inline-flex items-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Mark Paid</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}

                  {filteredInvoices.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-[rgba(10,20,32,0.50)] text-sm">
                        No invoices found matching current filter or search criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content 4: Bank Feed Sync */}
      {activeTab === 'bankfeed' && (
        <div className="bg-white/80 p-6 rounded-2xl border border-[rgba(10,20,32,0.08)] shadow-xl space-y-4 backdrop-blur-md">
          <div className="flex items-center justify-between pb-4 border-b border-[rgba(10,20,32,0.08)]">
            <div>
              <h3 className="font-bold text-[#1A2332] text-base">Bank Feed Auto-Matching Simulation</h3>
              <p className="text-xs text-[#6B7685]">Live API sync with connected bank feeds & clearing houses.</p>
            </div>
            <span className="px-3 py-1 bg-emerald-50 text-emerald-400 border border-emerald-200 rounded-full text-xs font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Bank Connection Active
            </span>
          </div>

          <div className="space-y-3">
            <div className="p-4 bg-[#FAFAF8] rounded-xl border border-[rgba(10,20,32,0.08)] flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-[rgba(10,20,32,0.50)]">Plaid / Stripe Wire #8921</span>
                <p className="font-bold text-[#1A2332] text-sm">{profile.currency}559,900 received from Johan Pretorius</p>
              </div>
              <span className="px-3 py-1 bg-emerald-50 text-emerald-400 border border-emerald-200 rounded-lg text-xs font-bold">
                Auto-Matched to INV-2026-001
              </span>
            </div>

            <div className="p-4 bg-[#FAFAF8] rounded-xl border border-[rgba(10,20,32,0.08)] flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-[rgba(10,20,32,0.50)]">Silicon Valley Bank Debit #3301</span>
                <p className="font-bold text-[#1A2332] text-sm">{profile.currency}1,450.00 Debit paid to Amazon Web Services</p>
              </div>
              <span className="px-3 py-1 bg-[rgba(14,157,152,0.08)] text-[#0E9D98] border border-[rgba(14,157,152,0.20)] rounded-lg text-xs font-bold">
                Auto-matched to PE Panel & Paint invoice #9821
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Thorough Invoice Creator Modal */}
      {showAddInvoiceModal && (
        <div className="fixed inset-0 bg-[rgba(10,20,32,0.40)] backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <form onSubmit={handleCreateInvoice} className="bg-white rounded-2xl shadow-2xl border border-[rgba(10,20,32,0.08)] w-full max-w-3xl p-6 sm:p-8 space-y-6 text-[#1A2332] my-8">
            <div className="flex items-center justify-between pb-4 border-b border-[rgba(10,20,32,0.08)]">
              <div>
                <h3 className="text-xl font-bold text-[#1A2332] flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#0E9D98]" />
                  Issue Thorough Client Invoice
                </h3>
                <p className="text-xs text-[#6B7685] mt-0.5">
                  Specify itemized line deliverables, tax calculations, payment terms, and remittance instructions.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddInvoiceModal(false)}
                className="text-[#6B7685] hover:text-[#1A2332] text-sm font-bold p-2"
              >
                ✕
              </button>
            </div>

            {/* Client & Metadata Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-[#334155] block mb-1">Client Company Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sundays River Citrus Co."
                  value={invClientName}
                  onChange={(e) => setInvClientName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[rgba(10,20,32,0.08)] bg-[#FAFAF8] text-[#1A2332] text-sm focus:ring-2 focus:ring-cyan-500/30"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#334155] block mb-1">Billing Email *</label>
                <input
                  type="email"
                  required
                  placeholder="accounts@client.co.za"
                  value={invClientEmail}
                  onChange={(e) => setInvClientEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[rgba(10,20,32,0.08)] bg-[#FAFAF8] text-[#1A2332] text-sm focus:ring-2 focus:ring-cyan-500/30"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-[#334155] block mb-1">Client Billing Address</label>
                <input
                  type="text"
                  placeholder="Street, City, State, ZIP"
                  value={invClientAddress}
                  onChange={(e) => setInvClientAddress(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[rgba(10,20,32,0.08)] bg-[#FAFAF8] text-[#1A2332] text-sm focus:ring-2 focus:ring-cyan-500/30"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#334155] block mb-1">P.O. / Contract Ref #</label>
                <input
                  type="text"
                  value={invPoNumber}
                  onChange={(e) => setInvPoNumber(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[rgba(10,20,32,0.08)] bg-[#FAFAF8] text-[#1A2332] text-sm focus:ring-2 focus:ring-cyan-500/30"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#334155] block mb-1">Payment Terms</label>
                <select
                  value={invPaymentTerms}
                  onChange={(e) => setInvPaymentTerms(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[rgba(10,20,32,0.08)] bg-[#FAFAF8] text-[#1A2332] text-sm focus:ring-2 focus:ring-cyan-500/30"
                >
                  <option value="Due on Receipt">Due on Receipt</option>
                  <option value="Net 15">Net 15 Days</option>
                  <option value="Net 30">Net 30 Days</option>
                  <option value="Net 60">Net 60 Days</option>
                </select>
              </div>
            </div>

            {/* Itemized Deliverables Line Editor */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[#334155] uppercase tracking-wider">Itemized Deliverables & Charges</label>
                <button
                  type="button"
                  onClick={addInvLineItem}
                  className="px-3 py-1 bg-[rgba(14,157,152,0.08)] text-[#0E9D98] border border-[rgba(14,157,152,0.20)] hover:bg-[rgba(14,157,152,0.12)] text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Line Item</span>
                </button>
              </div>

              <div className="space-y-2">
                {invItems.map((item, idx) => (
                  <div key={idx} className="p-3 bg-[#FAFAF8] rounded-xl border border-[rgba(10,20,32,0.08)] grid grid-cols-12 gap-2 items-center text-xs">
                    <div className="col-span-12 sm:col-span-6">
                      <label className="text-[10px] text-[rgba(10,20,32,0.50)] block sm:hidden">Description</label>
                      <input
                        type="text"
                        placeholder="Item description / service line..."
                        value={item.description}
                        onChange={(e) => updateInvLineItem(idx, 'description', e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-[rgba(10,20,32,0.08)] bg-white text-[#1A2332] focus:outline-hidden focus:border-cyan-500"
                      />
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      <label className="text-[10px] text-[rgba(10,20,32,0.50)] block sm:hidden">Qty</label>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateInvLineItem(idx, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full px-2 py-1.5 rounded-lg border border-[rgba(10,20,32,0.08)] bg-white text-[#1A2332] text-center focus:outline-hidden focus:border-cyan-500"
                      />
                    </div>
                    <div className="col-span-5 sm:col-span-3">
                      <label className="text-[10px] text-[rgba(10,20,32,0.50)] block sm:hidden">Unit Price ({profile.currency})</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={item.unitPrice}
                        onChange={(e) => updateInvLineItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-[rgba(10,20,32,0.08)] bg-white text-[#1A2332] text-right focus:outline-hidden focus:border-cyan-500"
                      />
                    </div>
                    <div className="col-span-3 sm:col-span-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => removeInvLineItem(idx)}
                        disabled={invItems.length <= 1}
                        className="p-1.5 text-[rgba(10,20,32,0.50)] hover:text-rose-400 disabled:opacity-30 disabled:hover:text-[rgba(10,20,32,0.50)]"
                        title="Delete Item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes & Summary Box */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="text-xs font-semibold text-[#334155] block mb-1">Notes & Terms & Conditions</label>
                <textarea
                  rows={3}
                  value={invNotes}
                  onChange={(e) => setInvNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[rgba(10,20,32,0.08)] bg-[#FAFAF8] text-[#334155] text-xs focus:ring-2 focus:ring-cyan-500/30"
                />
              </div>

              <div className="p-4 bg-[#FAFAF8] rounded-xl border border-[rgba(10,20,32,0.08)] space-y-2 text-xs">
                <div className="flex justify-between text-[#6B7685]">
                  <span>Subtotal:</span>
                  <span className="font-mono text-[#1A2332]">{profile.currency}{invSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-[#6B7685]">
                  <span>Sales Tax ({profile.taxRate}%):</span>
                  <span className="font-mono text-[#1A2332]">{profile.currency}{invTaxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-[#1A2332] pt-2 border-t border-[rgba(10,20,32,0.08)]">
                  <span>Total Amount Due:</span>
                  <span className="font-mono text-emerald-400 text-base">{profile.currency}{invGrandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-[rgba(10,20,32,0.08)]">
              <button
                type="button"
                onClick={() => setShowAddInvoiceModal(false)}
                className="px-4 py-2 text-[#6B7685] hover:text-[#1A2332] text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-white text-black hover:bg-white/90 rounded-xl text-xs font-semibold shadow-md shadow-white/5 flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                <span>Issue & Generate Invoice</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Thorough Executive Printable Invoice Preview Modal */}
      {previewInvoice && (
        <div className="fixed inset-0 bg-[rgba(6,8,13,0.85)] backdrop-blur-md z-50 flex items-center justify-center p-4 sm:p-6">
          <div className="bg-[#0D1117] rounded-2xl shadow-[0_40px_90px_-40px_rgba(0,0,0,0.95)] border border-[rgba(138,162,184,0.14)] w-full max-w-3xl max-h-[92vh] flex flex-col text-[#B1BAC4] overflow-hidden">
            {/* Modal Top Control Toolbar — sticky so Close is always reachable */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-[rgba(138,162,184,0.12)] no-print shrink-0">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 bg-[rgba(62,207,200,0.12)] text-[#4FE3DC] border border-[rgba(62,207,200,0.35)] rounded-lg text-xs font-semibold">
                  Thorough Invoice View
                </span>
                <span className="text-xs text-[#6E7681] font-mono">{previewInvoice.invoiceNumber}</span>
                <button
                  onClick={() => (draft ? cancelEdit() : beginEdit(previewInvoice))}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                    draft
                      ? 'bg-[rgba(62,207,200,0.15)] text-[#4FE3DC] border border-[rgba(62,207,200,0.35)]'
                      : 'bg-[#161B22] text-[#E8EAE6] border border-[rgba(138,162,184,0.14)] hover:bg-[#21262D]'
                  }`}
                >
                  {draft ? (
                    <>
                      <X className="w-3 h-3" /> Stop editing
                    </>
                  ) : (
                    <>
                      <Pencil className="w-3 h-3" /> Edit
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleExportPdf(previewInvoice)}
                  disabled={isExportingPdf}
                  className="px-3.5 py-1.5 bg-[#3ECFC8] text-[#06080D] text-xs font-semibold rounded-[10px] flex items-center gap-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_5px_0_#22807C,0_10px_22px_-8px_rgba(0,0,0,0.95)] transition-all hover:bg-[#4FE3DC] active:translate-y-[3px] active:shadow-[inset_0_1px_0_rgba(255,255,255,0.20),0_1px_0_#22807C] disabled:opacity-40 disabled:translate-y-0 disabled:shadow-none"
                  title="Export Clean Styled PDF Summary File"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isExportingPdf ? 'Rendering PDF...' : 'Export PDF Summary'}</span>
                </button>

                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-[#161B22] text-[#E8EAE6] text-xs font-medium rounded-[10px] flex items-center gap-1.5 shadow-[inset_0_1px_0_rgba(232,234,230,0.10),0_4px_0_#06080D,0_8px_18px_-8px_rgba(0,0,0,0.95)] transition-all hover:bg-[#21262D] active:translate-y-[2px] active:shadow-[0_1px_0_#06080D]"
                  title="Print or Browser Print-to-PDF"
                >
                  <Printer className="w-3.5 h-3.5 text-[#8AA2B8]" />
                  <span>Print</span>
                </button>

                <button
                  onClick={() => {
                    addNotification('Invoice Sent', `Emailed ${previewInvoice.invoiceNumber} directly to ${previewInvoice.clientEmail}.`, 'info');
                  }}
                  className="px-3 py-1.5 bg-[#161B22] text-[#E8EAE6] text-xs font-medium rounded-[10px] flex items-center gap-1.5 shadow-[inset_0_1px_0_rgba(232,234,230,0.10),0_4px_0_#06080D,0_8px_18px_-8px_rgba(0,0,0,0.95)] transition-all hover:bg-[#21262D] active:translate-y-[2px] active:shadow-[0_1px_0_#06080D]"
                >
                  <Mail className="w-3.5 h-3.5 text-[#F59E0B]" />
                  <span>Send Email</span>
                </button>

                {previewInvoice.status !== 'Paid' && (
                  <button
                    onClick={() => {
                      setIsProcessingPayment(true);
                      setTimeout(() => {
                        updateInvoiceStatus(previewInvoice.id, 'Paid');
                        setPreviewInvoice({ ...previewInvoice, status: 'Paid' });
                        setIsProcessingPayment(false);
                        addNotification('Online Payment Processed', `Payment received for ${previewInvoice.invoiceNumber}.`, 'success');
                      }, 1200);
                    }}
                    disabled={isProcessingPayment}
                    className="px-3.5 py-1.5 bg-[#10B981] text-[#06080D] text-xs font-semibold rounded-[10px] flex items-center gap-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_5px_0_#0B7A5C,0_10px_22px_-8px_rgba(0,0,0,0.95)] transition-all hover:brightness-110 active:translate-y-[3px] active:shadow-[inset_0_1px_0_rgba(255,255,255,0.20),0_1px_0_#0B7A5C]"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>{isProcessingPayment ? 'Processing ACH...' : 'Simulate Card Pay'}</span>
                  </button>
                )}

                {draft && (
                  <button
                    onClick={saveDraft}
                    className="px-3.5 py-1.5 bg-[#3ECFC8] text-[#06080D] text-xs font-semibold rounded-[10px] flex items-center gap-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_5px_0_#22807C,0_10px_22px_-8px_rgba(0,0,0,0.95)] transition-all hover:bg-[#4FE3DC] active:translate-y-[3px] active:shadow-[inset_0_1px_0_rgba(255,255,255,0.20),0_1px_0_#22807C]"
                    title="Save edits to this invoice"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save changes</span>
                  </button>
                )}

                <button
                  onClick={() => setPreviewInvoice(null)}
                  className="px-3 py-1.5 bg-transparent text-[#B1BAC4] text-xs font-medium rounded-[10px] hover:bg-[rgba(232,234,230,0.06)] hover:text-[#E8EAE6] transition-colors"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Printable Document Sheet — scrollable area */}
            <div className="overflow-y-auto p-4 sm:p-6 bg-[#F5F1E8]">
              {(() => {
                const inv = draft || previewInvoice;
                const items = draft ? draftTotals.items : inv.items || [];
                const subtotal = draft
                  ? draftTotals.subtotal
                  : (inv.amount * 100) / (100 + (inv.taxRate || profile.taxRate || 0));
                const vat = draft ? draftTotals.vat : inv.amount - subtotal;
                const total = draft ? draftTotals.total : inv.amount;
                const vatRate = inv.taxRate ?? profile.taxRate ?? 0;
                const inputCls =
                  'w-full bg-transparent border border-dashed border-[rgba(18,32,43,0.18)] rounded-md px-1.5 py-0.5 text-inherit font-inherit focus:outline-none focus:bg-[rgba(7,136,155,0.06)] focus:border-[#07889B]';
                return (
                  <>
              <div
                id="printable-invoice"
                className="bg-white rounded-2xl border border-[rgba(18,32,43,0.08)] shadow-[0_8px_30px_-12px_rgba(18,32,43,0.08)] p-8 sm:p-12 text-[#2D3748]">
                {/* Header: business + document title */}
                <div className="flex flex-col sm:flex-row items-start justify-between gap-6">
                  <div>
                    <div className="text-[22px] font-semibold tracking-[-0.01em] leading-none text-[#1A2332]">
                      {profile.companyName}
                    </div>
                    <div className="mt-1.5 text-[11px] font-mono uppercase tracking-[0.06em] text-[#A0A6AE]">
                      {profile.tagline || 'Personal workspace'}
                    </div>
                    <div className="mt-4 text-[13px] text-[#6B7685] space-y-0.5">
                      <p className="font-mono text-[13px] text-[#6B7685]">{profile.regNumber || 'Reg / VAT no.'}</p>
                      <p className="whitespace-pre-line">{profile.address || profile.email}</p>
                      {profile.phone && <p className="font-mono text-[13px] text-[#6B7685]">{profile.phone}</p>}
                    </div>
                  </div>

                  <div className="text-left sm:text-right">
                    <h2 className="text-[28px] font-semibold tracking-[-0.02em] text-[#07889B] leading-none opacity-80">Invoice</h2>
                    <div className="mt-3 space-y-1 text-[13px] text-[#8A8172]">
                      <div className="flex justify-end items-baseline gap-2">
                        <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] min-w-[96px] text-right">Invoice no.</span>
                        {draft ? (
                          <input
                            className={`${inputCls} font-mono w-40 text-right text-[#12202B]`}
                            value={inv.invoiceNumber}
                            onChange={(e) => patchDraft({ invoiceNumber: e.target.value })}
                          />
                        ) : (
                          <span className="font-mono text-[#12202B]">{previewInvoice.invoiceNumber}</span>
                        )}
                      </div>
                      <div className="flex justify-end items-baseline gap-2">
                        <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] min-w-[96px] text-right">Date</span>
                        {draft ? (
                          <input
                            type="date"
                            className={`${inputCls} font-mono w-40 text-right text-[#12202B]`}
                            value={inv.issueDate}
                            onChange={(e) => patchDraft({ issueDate: e.target.value })}
                          />
                        ) : (
                          <span className="font-mono text-[#12202B]">{previewInvoice.issueDate}</span>
                        )}
                      </div>
                      <div className="flex justify-end items-baseline gap-2">
                        <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] min-w-[96px] text-right">Due</span>
                        {draft ? (
                          <input
                            type="date"
                            className={`${inputCls} font-mono w-40 text-right text-[#12202B]`}
                            value={inv.dueDate}
                            onChange={(e) => patchDraft({ dueDate: e.target.value })}
                          />
                        ) : (
                          <span className="font-mono text-[#12202B]">{previewInvoice.dueDate}</span>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[12px] font-semibold inline-flex items-center gap-1.5 border ${
                          inv.status === 'Paid'
                            ? 'bg-[rgba(7,136,155,0.06)] text-[#07889B] border-[rgba(7,136,155,0.12)]'
                            : inv.status === 'Overdue'
                            ? 'bg-[rgba(184,106,106,0.08)] text-[#B86A6A] border-[rgba(184,106,106,0.35)]'
                            : 'bg-[rgba(176,122,38,0.08)] text-[#B07A26] border-[rgba(176,122,38,0.3)]'
                        }`}
                      >
                        {inv.status === 'Paid' && <CheckCircle2 className="w-3.5 h-3.5" />}
                        {inv.status}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Parties */}
                <div className="flex flex-col sm:flex-row gap-8 mt-8 mb-5">
                  <div className="flex-1">
                    <h4 className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#07889B] font-mono mb-1.5">
                      Bill to
                    </h4>
                    {draft ? (
                      <>
                        <input className={`${inputCls} font-semibold text-[15px]`} value={inv.clientName} onChange={(e) => patchDraft({ clientName: e.target.value })} placeholder="Client name" />
                        <input className={`${inputCls} font-mono text-[13px] mt-1`} value={inv.clientEmail} onChange={(e) => patchDraft({ clientEmail: e.target.value })} placeholder="billing@client.com" />
                      </>
                    ) : (
                      <>
                        <p className="font-semibold text-[#12202B] text-[15px]">{previewInvoice.clientName}</p>
                        <p className="font-mono text-[13px] text-[#3A4553] mt-0.5">{previewInvoice.clientEmail}</p>
                      </>
                    )}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#07889B] font-mono mb-1.5">
                      Reference
                    </h4>
                    {draft ? (
                      <input className={`${inputCls} text-[13px]`} value={inv.notes || ''} onChange={(e) => patchDraft({ notes: e.target.value })} placeholder="PO / job reference" />
                    ) : (
                      <p className="text-[13px] text-[#3A4553]">PO / job reference</p>
                    )}
                  </div>
                </div>

                {/* Itemized table */}
                <table className="w-full text-[14px] border-collapse">
                  <thead>
                    <tr className="border-b border-[rgba(18,32,43,0.14)]">
                      <th className="text-left font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#8A8172] py-2 pr-3">
                        Description
                      </th>
                      <th className="text-right font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#8A8172] py-2 px-3 whitespace-nowrap">
                        Qty
                      </th>
                      <th className="text-right font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#8A8172] py-2 px-3 whitespace-nowrap">
                        Unit price
                      </th>
                      <th className="text-right font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#8A8172] py-2 pl-3 whitespace-nowrap">
                        Amount
                      </th>
                      {draft && (
                        <th className="text-right font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#8A8172] py-2 pl-2 whitespace-nowrap">
                          <button
                            onClick={addDraftItem}
                            className="px-2 py-0.5 rounded-md border border-[rgba(7,136,155,0.3)] text-[#07889B] hover:bg-[rgba(7,136,155,0.08)] flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" /> Line
                          </button>
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {(items.length
                      ? items
                      : [
                          {
                            id: 'default-item',
                            description: 'Professional B2B SaaS Architecture & Development Services',
                            quantity: 1,
                            unitPrice: inv.amount,
                            amount: inv.amount,
                          },
                        ]
                    ).map((item, idx) => (
                      <tr key={item.id || idx} className="border-b border-[rgba(18,32,43,0.08)]">
                        <td className="py-3 pr-3 text-[14px] text-[#12202B]">
                          {draft ? (
                            <input className={`${inputCls} text-[14px]`} value={item.description} onChange={(e) => patchDraftItem(idx, { description: e.target.value })} />
                          ) : (
                            item.description
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-[14px] text-[#12202B]">
                          {draft ? (
                            <input className={`${inputCls} font-mono w-16 text-right text-[14px]`} inputMode="decimal" value={item.quantity} onChange={(e) => patchDraftItem(idx, { quantity: Number(e.target.value) || 0 })} />
                          ) : (
                            item.quantity
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-[14px] text-[#12202B]">
                          {draft ? (
                            <input className={`${inputCls} font-mono w-28 text-right text-[14px]`} inputMode="decimal" value={item.unitPrice} onChange={(e) => patchDraftItem(idx, { unitPrice: Number(e.target.value) || 0 })} />
                          ) : (
                            `${profile.currency}${item.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                          )}
                        </td>
                        <td className="py-3 pl-3 text-right font-mono text-[14px] font-semibold text-[#12202B]">
                          {draft ? `${profile.currency}${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : `${profile.currency}${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                        </td>
                        {draft && (
                          <td className="py-3 pl-2 text-right">
                            <button
                              onClick={() => removeDraftItem(idx)}
                              disabled={items.length <= 1}
                              className="p-1 text-[#B86A6A] hover:bg-[rgba(184,106,106,0.08)] rounded-md disabled:opacity-30"
                              title="Remove line"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Totals */}
                <div className="flex justify-end mt-5">
                  <div className="w-full max-w-[290px]">
                    <div className="flex justify-between items-baseline px-2 py-1.5 text-[14px]">
                      <span className="text-[#8A8172]">Subtotal</span>
                      <span className="font-mono text-[#12202B]">
                        {profile.currency}{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline px-2 py-1.5 text-[14px]">
                      <span className="text-[#8A8172]">VAT ({vatRate}%)</span>
                      <span className="font-mono text-[#12202B]">
                        {profile.currency}{vat.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline px-2 py-3 mt-1 border-t border-[rgba(18,32,43,0.14)] text-[16px] font-semibold">
                      <span className="text-[#12202B]">Total due</span>
                      <span className="font-mono text-[#07889B]">
                        {profile.currency}{total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Foot columns */}
                <div className="flex flex-col sm:flex-row gap-8 mt-7 pt-6 border-t border-[rgba(18,32,43,0.14)]">
                  <div className="flex-1">
                    <h4 className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#07889B] font-mono mb-1.5">
                      Banking details
                    </h4>
                    <p className="text-[13px] text-[#3A4553] whitespace-pre-line font-mono">
                      {profile.bank?.bankName || 'Your bank'}{'\n'}Account name · {profile.bank?.accountName || profile.companyName}{'\n'}Account no. · {profile.bank?.accountNumber || '0000000000'}{'\n'}Branch · {profile.bank?.branchCode || '000000'}{'\n'}SWIFT / BIC · {profile.bank?.swift || 'BIC'}
                    </p>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#07889B] font-mono mb-1.5">
                      Notes / terms
                    </h4>
                    {draft ? (
                      <textarea
                        rows={3}
                        className={`${inputCls} text-[13px] resize-none`}
                        value={inv.notes || ''}
                        onChange={(e) => patchDraft({ notes: e.target.value })}
                        placeholder="Payment terms, thank-you note…"
                      />
                    ) : (
                      <p className="text-[13px] text-[#3A4553]">
                        {previewInvoice.notes ||
                          'Payment due within 30 days of issue date. Please reference invoice number on remittance. Thank you for your business!'}
                      </p>
                    )}
                  </div>
                </div>

                {/* Thanks */}
                <div className="mt-7 text-center font-mono text-[12px] uppercase tracking-[0.1em] text-[#8A8172]">
                  Thank you for your business.
                </div>
              </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
