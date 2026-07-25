import React, { useState } from "react";
import { DMSState, Vehicle, Expense, Invoice } from "../types";
import { 
  DollarSign, 
  TrendingUp, 
  Wrench, 
  Activity, 
  Plus, 
  Check, 
  AlertCircle, 
  TrendingDown, 
  Sliders, 
  ArrowUpRight, 
  Briefcase, 
  Layers, 
  HelpCircle,
  FileSpreadsheet,
  ChevronRight,
  RefreshCw
} from "lucide-react";

interface AccountingReconProps {
  state: DMSState;
  onUpdateVehicle: (id: string, updates: Partial<Vehicle>) => Promise<void>;
  onAddExpense: (expense: Partial<Expense>) => Promise<void>;
  onReconcileExpense: (id: string, reconciled: boolean) => Promise<void>;
}

export default function AccountingRecon({ state, onUpdateVehicle, onAddExpense, onReconcileExpense }: AccountingReconProps) {
  const [activeTab, setActiveTab] = useState<"pl" | "recon" | "bank">("pl");
  
  // Expenses form state
  const [expenseForm, setExpenseForm] = useState({
    description: "",
    amount: "",
    category: "Operations",
    date: new Date().toISOString().slice(0, 10),
    referenceId: "",
  });

  // Selected vehicle for recon panel
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(
    state.vehicles.length > 0 ? state.vehicles[0].id : ""
  );

  // New recon task form state
  const [reconForm, setReconForm] = useState({
    name: "",
    cost: "",
    status: "Pending" as "Pending" | "In Progress" | "Completed"
  });

  // Bank reconciliation matching selected states
  const [selectedLedgerId, setSelectedLedgerId] = useState<string | null>(null);
  const [selectedBankTxId, setSelectedBankTxId] = useState<string | null>(null);

  // Bank statement uploader states
  const [statementUploading, setStatementUploading] = useState(false);
  const [statementName, setStatementName] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Simulated live bank feed (Sandton Premium Corporate Account)
  const [bankFeed, setBankFeed] = useState([
    { id: "btx-1", date: "2026-07-15", sender: "FNB TRANSFER / THABO NDLOVU", amount: 485000, type: "CREDIT" as const, matched: true, matchedLabel: "INV-2026-0043 Match" },
    { id: "btx-2", date: "2026-07-12", sender: "ESKOM HOLDINGS CO RE-ACC", amount: -8400, type: "DEBIT" as const, matched: false },
    { id: "btx-3", date: "2026-07-08", sender: "SUTHERLAND CAR SPA / PE-1042", amount: -4800, type: "DEBIT" as const, matched: false },
    { id: "btx-4", date: "2026-07-05", sender: "GOOGLE ADS / MON-0129", amount: -12000, type: "DEBIT" as const, matched: true, matchedLabel: "exp-2 Match" },
    { id: "btx-5", date: "2026-07-01", sender: "SANDTON REAL ESTATE TRUST", amount: -45000, type: "DEBIT" as const, matched: true, matchedLabel: "exp-1 Match" },
    { id: "btx-6", date: "2026-07-14", sender: "ABS TRUST / VEHICLE OUTPAY", amount: 945000, type: "CREDIT" as const, matched: false },
  ]);

  // Statement Template Datasets
  const statementTemplates = {
    fnb: [
      { id: "btx-f1", date: "2026-07-15", sender: "FNB TRANSFER / THABO NDLOVU", amount: 485000, type: "CREDIT" as const, matched: false },
      { id: "btx-f2", date: "2026-07-14", sender: "RANDBURG PANELBEATERS / RE-GP774", amount: -18500, type: "DEBIT" as const, matched: false },
      { id: "btx-f3", date: "2026-07-12", sender: "ESKOM HOLDINGS CO RE-ACC", amount: -8400, type: "DEBIT" as const, matched: false },
      { id: "btx-f4", date: "2026-07-08", sender: "SUTHERLAND CAR SPA / PE-1042", amount: -4800, type: "DEBIT" as const, matched: false },
      { id: "btx-f5", date: "2026-07-05", sender: "GOOGLE ADS / MON-0129", amount: -12000, type: "DEBIT" as const, matched: false },
      { id: "btx-f6", date: "2026-07-01", sender: "SANDTON REAL ESTATE TRUST", amount: -45000, type: "DEBIT" as const, matched: false },
      { id: "btx-f7", date: "2026-07-14", sender: "WESBANK SALOR / VEHICLE SETTLE", amount: -245000, type: "DEBIT" as const, matched: false },
    ],
    nedbank: [
      { id: "btx-n1", date: "2026-07-15", sender: "NEDBANK DEPOSIT / CLIENT COETZEE", amount: 320000, type: "CREDIT" as const, matched: false },
      { id: "btx-n2", date: "2026-07-13", sender: "ESKOM GAUTENG SOUTH ACC", amount: -9100, type: "DEBIT" as const, matched: false },
      { id: "btx-n3", date: "2026-07-10", sender: "SASOL GARAGE SANDTON", amount: -1200, type: "DEBIT" as const, matched: false },
      { id: "btx-n4", date: "2026-07-07", sender: "METROPOLITAN LEASE FEE / SANDTON", amount: -12000, type: "DEBIT" as const, matched: false },
      { id: "btx-n5", date: "2026-07-03", sender: "MAINTENANCE PARTS DIRECT", amount: -6500, type: "DEBIT" as const, matched: false },
    ],
    standard: [
      { id: "btx-s1", date: "2026-07-14", sender: "STAN TRFR / LEAD OUTBOUND S.A.", amount: -14000, type: "DEBIT" as const, matched: false },
      { id: "btx-s2", date: "2026-07-12", sender: "DEPOSIT CASH SHOWROOM / NDLOVU", amount: 15000, type: "CREDIT" as const, matched: false },
      { id: "btx-s3", date: "2026-07-09", sender: "SAPS GAUTENG LICENSING GATE", amount: -3200, type: "DEBIT" as const, matched: false },
      { id: "btx-s4", date: "2026-07-06", sender: "SANDTON PRINTING / FLYERS", amount: -2200, type: "DEBIT" as const, matched: false },
    ]
  };

  const handleLoadStatementTemplate = (key: keyof typeof statementTemplates, label: string) => {
    setStatementUploading(true);
    setStatementName(label);
    setTimeout(() => {
      setStatementUploading(false);
      setBankFeed(statementTemplates[key]);
      setSelectedLedgerId(null);
      setSelectedBankTxId(null);
    }, 1000);
  };

  const handleDropStatementFile = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setStatementUploading(true);
      setStatementName(file.name);
      setTimeout(() => {
        setStatementUploading(false);
        // Load random standard set or FNB set
        setBankFeed(statementTemplates.fnb);
        setSelectedLedgerId(null);
        setSelectedBankTxId(null);
      }, 1200);
    }
  };

  const formatZAR = (num: number) => {
    return "R " + Math.round(num).toLocaleString("en-ZA");
  };

  const getVehicleLabel = (id: string) => {
    const v = state.vehicles.find((item) => item.id === id);
    return v ? `${v.year} ${v.make} ${v.model}` : "General Inventory Item";
  };

  // Calculations for Profit & Loss Statement
  const soldVehicles = state.vehicles.filter((v) => v.status === "SOLD");
  const revenueFromSales = state.invoices
    .filter((inv) => inv.status === "Paid")
    .reduce((sum, inv) => sum + inv.amount, 0);

  // Total cost of sales: sum of cost prices of sold units + sum of completed recon tasks on sold units
  const costOfSoldUnits = soldVehicles.reduce((sum, v) => sum + v.costPrice, 0);
  const reconOnSoldUnits = soldVehicles.reduce((sum, v) => {
    const tasks = v.reconTasks || [];
    const completedTasksCost = tasks
      .filter((t) => t.status === "Completed")
      .reduce((s, t) => s + t.cost, 0);
    return sum + completedTasksCost;
  }, 0);

  const totalCostOfSales = costOfSoldUnits + reconOnSoldUnits;
  const grossProfit = revenueFromSales - totalCostOfSales;
  const grossMarginPercentage = revenueFromSales > 0 ? (grossProfit / revenueFromSales) * 100 : 0;

  // Operating Expenses (rent, marketing, utilities, reconditioning on unsold units etc.)
  const totalLedgerExpenses = (state.expenses || []).reduce((sum, e) => sum + e.amount, 0);
  const totalOperatingExpenses = totalLedgerExpenses;

  const netProfit = grossProfit - totalOperatingExpenses;

  // Handles adding general expenses
  const handleAddExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseForm.description || !expenseForm.amount) {
      alert("Please fill in description and amount.");
      return;
    }
    const amt = parseFloat(expenseForm.amount);
    if (isNaN(amt)) {
      alert("Invalid expense amount.");
      return;
    }

    await onAddExpense({
      description: expenseForm.description,
      amount: amt,
      category: expenseForm.category,
      date: expenseForm.date,
      referenceId: expenseForm.referenceId,
      reconciled: false
    });

    setExpenseForm({
      description: "",
      amount: "",
      category: "Operations",
      date: new Date().toISOString().slice(0, 10),
      referenceId: "",
    });
  };

  // Handles adding recon tasks
  const handleAddReconSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reconForm.name || !reconForm.cost) {
      alert("Please provide recon task description and cost.");
      return;
    }
    const costAmt = parseFloat(reconForm.cost);
    if (isNaN(costAmt)) {
      alert("Invalid cost format.");
      return;
    }

    const targetVehicle = state.vehicles.find((v) => v.id === selectedVehicleId);
    if (!targetVehicle) return;

    const currentTasks = targetVehicle.reconTasks || [];
    const newTask = {
      id: "rc_" + Date.now(),
      name: reconForm.name,
      cost: costAmt,
      status: reconForm.status,
      dateAdded: new Date().toISOString().slice(0, 10)
    };

    await onUpdateVehicle(selectedVehicleId, {
      reconTasks: [...currentTasks, newTask]
    });

    setReconForm({
      name: "",
      cost: "",
      status: "Pending"
    });
  };

  // Handles toggling recon task status
  const toggleReconTaskStatus = async (vehicleId: string, taskId: string, newStatus: "Pending" | "In Progress" | "Completed") => {
    const v = state.vehicles.find((item) => item.id === vehicleId);
    if (!v) return;

    const updatedTasks = (v.reconTasks || []).map((t) => {
      if (t.id === taskId) {
        return { ...t, status: newStatus };
      }
      return t;
    });

    await onUpdateVehicle(vehicleId, {
      reconTasks: updatedTasks
    });
  };

  // Handles manual reconciliation matching
  const handleReconcileMatch = async () => {
    if (!selectedLedgerId || !selectedBankTxId) {
      alert("Select one ledger entry and one bank statement transaction to link.");
      return;
    }

    const ledgerExpense = state.expenses?.find((e) => e.id === selectedLedgerId);
    const bankTxIndex = bankFeed.findIndex((tx) => tx.id === selectedBankTxId);

    if (ledgerExpense && bankTxIndex !== -1) {
      const bankTx = bankFeed[bankTxIndex];
      
      // Let's verify amount match (approx match)
      const absLedger = Math.abs(ledgerExpense.amount);
      const absBank = Math.abs(bankTx.amount);
      
      if (Math.abs(absLedger - absBank) > 5) {
        if (!confirm(`Warning: The ledger amount (${formatZAR(absLedger)}) does not match the bank transaction amount (${formatZAR(absBank)}). Reconcile anyway?`)) {
          return;
        }
      }

      await onReconcileExpense(selectedLedgerId, true);
      
      const updatedFeed = [...bankFeed];
      updatedFeed[bankTxIndex] = {
        ...bankTx,
        matched: true,
        matchedLabel: `${ledgerExpense.description.substring(0, 15)} Match`
      };
      setBankFeed(updatedFeed);
      setSelectedLedgerId(null);
      setSelectedBankTxId(null);
      alert("Successfully reconciled! Bank transaction linked to internal ledger record.");
    } else {
      alert("Selected items could not be matched.");
    }
  };

  const selectedVehicle = state.vehicles.find((v) => v.id === selectedVehicleId);
  const reconTasks = selectedVehicle?.reconTasks || [];
  const totalReconSpent = reconTasks.reduce((sum, t) => sum + t.cost, 0);

  return (
    <div className="flex flex-col gap-6" id="accounting_recon_dashboard">
      {/* Top Section Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[color:var(--white)] flex items-center gap-2">
            <FileSpreadsheet className="text-[color:var(--cyan)]" size={20} />
            TrueCar DMS Accounting & Reconditioning Hub
          </h2>
          <p className="text-[13px] text-[rgba(232,234,230,0.72)] mt-1">
            Real-time Profit & Loss Ledger, Expense Audits, Refurbishment Cost Trackers, and Bank Statement Reconciliation.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex bg-[color:var(--ink-2)] border border-white/5 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab("pl")}
            className={`px-4 py-2 text-[13px] font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "pl" ? "bg-gradient-to-r from-[color:var(--cyan)] to-[color:var(--cyan)] text-[color:var(--ink)]" : "text-[rgba(232,234,230,0.72)] hover:text-[color:var(--white)]"
            }`}
          >
            <Activity size={13} />
            Profit & Loss Ledger
          </button>
          <button
            onClick={() => setActiveTab("recon")}
            className={`px-4 py-2 text-[13px] font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "recon" ? "bg-gradient-to-r from-[color:var(--cyan)] to-[color:var(--cyan)] text-[color:var(--ink)]" : "text-[rgba(232,234,230,0.72)] hover:text-[color:var(--white)]"
            }`}
          >
            <Wrench size={13} />
            Reconditioning (Recon)
          </button>
          <button
            onClick={() => setActiveTab("bank")}
            className={`px-4 py-2 text-[13px] font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "bank" ? "bg-gradient-to-r from-[color:var(--cyan)] to-[color:var(--cyan)] text-[color:var(--ink)]" : "text-[rgba(232,234,230,0.72)] hover:text-[color:var(--white)]"
            }`}
          >
            <Sliders size={13} />
            Bank Feed Reconciliation
          </button>
        </div>
      </div>

      {/* 1. PROFIT & LOSS LEDGER TAB */}
      {activeTab === "pl" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
          {/* Executive KPI Grid */}
          <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-[color:var(--glass-line)] border border-white/5 rounded-xl p-4 flex flex-col gap-2">
              <span className="text-[13px] text-[rgba(232,234,230,0.72)]  font-bold tracking-wider">Showroom Sales Revenue</span>
              <span className="text-lg font-mono text-[color:var(--cyan)] font-bold">{formatZAR(revenueFromSales)}</span>
              <span className="text-[13px] text-[rgba(232,234,230,0.72)] flex items-center gap-1"><ArrowUpRight size={10} className="text-[color:var(--cyan)]" /> From paid invoices</span>
            </div>
            
            <div className="bg-[color:var(--glass-line)] border border-white/5 rounded-xl p-4 flex flex-col gap-2">
              <span className="text-[13px] text-[rgba(232,234,230,0.72)]  font-bold tracking-wider">Cost of Sales (COGS)</span>
              <span className="text-lg font-mono text-[color:var(--danger)] font-bold">{formatZAR(totalCostOfSales)}</span>
              <span className="text-[13px] text-[rgba(232,234,230,0.72)]">Units cost + Complete Recon</span>
            </div>

            <div className="bg-[color:var(--glass-line)] border border-white/5 rounded-xl p-4 flex flex-col gap-2">
              <span className="text-[13px] text-[rgba(232,234,230,0.72)]  font-bold tracking-wider">Gross Profit Margin</span>
              <span className="text-lg font-mono text-[color:var(--white)] font-bold">{formatZAR(grossProfit)}</span>
              <span className="text-[13px] text-[color:var(--cyan)] font-semibold">{grossMarginPercentage.toFixed(1)}% Gross Margin</span>
            </div>

            <div className="bg-[color:var(--glass-line)] border border-white/5 rounded-xl p-4 flex flex-col gap-2">
              <span className="text-[13px] text-[rgba(232,234,230,0.72)]  font-bold tracking-wider">Showroom Expenditures</span>
              <span className="text-lg font-mono text-[color:var(--danger)] font-bold">{formatZAR(totalOperatingExpenses)}</span>
              <span className="text-[13px] text-[rgba(232,234,230,0.72)]">Marketing, rent & operations</span>
            </div>

            <div className="bg-gradient-to-br from-[color:var(--cyan-faint)] to-[color:var(--cyan-faint)] border border-[color:var(--cyan-faint)] rounded-xl p-4 flex flex-col gap-2 col-span-2 md:col-span-1">
              <span className="text-[13px] text-[color:var(--cyan)]  font-semibold tracking-wider">Showroom Net Income</span>
              <span className={`text-lg font-mono font-bold ${netProfit >= 0 ? "text-[color:var(--cyan)]" : "text-[color:var(--danger)]"}`}>
                {formatZAR(netProfit)}
              </span>
              <span className="text-[13px] text-[rgba(232,234,230,0.72)]">Bottom-line performance</span>
            </div>
          </div>

          {/* Ledger Expenses List */}
          <div className="lg:col-span-2 card p-5 flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-[16px] text-[color:var(--white)] flex items-center gap-2">
                <Briefcase size={14} className="text-[color:var(--cyan)]" />
                Showroom Expenditure Ledger
              </h3>
              <span className="text-[13px] font-mono bg-[color:var(--glass)] px-3 py-1 rounded-full text-[rgba(232,234,230,0.72)]">
                {state.expenses?.length || 0} Registered Debits
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px] border-collapse">
                <thead>
                  <tr className="border-b border-white/5 text-[rgba(232,234,230,0.72)]">
                    <th className="pb-3 font-bold tracking-normal text-[13px]">Date</th>
                    <th className="pb-3 font-bold tracking-normal text-[13px]">Description</th>
                    <th className="pb-3 font-bold tracking-normal text-[13px]">Category</th>
                    <th className="pb-3 font-bold tracking-normal text-[13px]">Reference</th>
                    <th className="pb-3 font-bold tracking-normal text-[13px] text-right">Amount</th>
                    <th className="pb-3 font-bold tracking-normal text-[13px] text-center">Audit Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {(state.expenses || []).map((e) => (
                    <tr key={e.id} className="hover:bg-[color:var(--glass)] transition-all group">
                      <td className="py-3 font-mono text-[13px] text-[rgba(232,234,230,0.72)]">{e.date}</td>
                      <td className="py-3 text-[color:var(--white)] font-semibold">
                        {e.description}
                      </td>
                      <td className="py-3">
                        <span className="bg-[color:var(--glass)] border border-white/5 text-[13px] text-[rgba(232,234,230,0.72)] px-2 py-0.5 rounded">
                          {e.category}
                        </span>
                      </td>
                      <td className="py-3 font-mono text-[13px] text-[rgba(232,234,230,0.72)]">
                        {e.referenceId ? e.referenceId : "Showroom Direct"}
                      </td>
                      <td className="py-3 text-right font-mono font-bold text-[color:var(--white)] group-hover:text-[color:var(--danger)] transition-all">
                        {formatZAR(e.amount)}
                      </td>
                      <td className="py-3 text-center">
                        {e.reconciled ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[13px] bg-[color:var(--cyan-faint)] text-[color:var(--cyan)] border border-[color:var(--cyan-faint)] font-bold">
                            <Check size={8} /> Reconciled
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[13px] bg-[color:var(--danger)] text-[color:var(--danger)] border border-[color:var(--danger)] font-bold">
                            <AlertCircle size={8} /> Unreconciled
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {(!state.expenses || state.expenses.length === 0) && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-[rgba(232,234,230,0.72)] italic">
                        No custom operating expenses registered. Use the panel on the right to log showroom overheads.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Log Expense Form */}
          <div className="card p-5 flex flex-col gap-4 bg-gradient-to-b from-[color:var(--glass-line)] to-[color:var(--glass-line)]">
            <div>
              <h3 className="font-bold text-[16px] text-[color:var(--white)]">Log Operating Expense</h3>
              <p className="text-[13px] text-[rgba(232,234,230,0.72)] mt-0.5">Register rent, cleaning services, marketing spend, or utility overheads.</p>
            </div>

            <form onSubmit={handleAddExpenseSubmit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[13px] font-bold text-[rgba(232,234,230,0.72)] ">Description / Payee</label>
                <input
                  type="text"
                  placeholder="e.g. Randburg Car Polishers"
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-[color:var(--ink-2)] border border-white/5 rounded-lg text-[13px] text-[color:var(--white)] outline-none focus:border-[color:var(--cyan)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[13px] font-bold text-[rgba(232,234,230,0.72)] ">Amount (ZAR)</label>
                  <input
                    type="number"
                    placeholder="R 4500"
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                    className="w-full px-3 py-2 bg-[color:var(--ink-2)] border border-white/5 rounded-lg text-[13px] text-[color:var(--white)] outline-none focus:border-[color:var(--cyan)] font-mono"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[13px] font-bold text-[rgba(232,234,230,0.72)] ">Category</label>
                  <select
                    value={expenseForm.category}
                    onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                    className="w-full px-3 py-2 bg-[color:var(--ink-2)] border border-white/5 rounded-lg text-[13px] text-[color:var(--white)] outline-none focus:border-[color:var(--cyan)]"
                  >
                    <option value="Rent">Rent / Lease</option>
                    <option value="Marketing">Marketing / Ads</option>
                    <option value="Utilities">Utilities (Eskom/Water)</option>
                    <option value="Operations">Operations</option>
                    <option value="Salaries">Salaries & Commissions</option>
                    <option value="Reconditioning">Refurbishment (Recon)</option>
                    <option value="Others">Others</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[13px] font-bold text-[rgba(232,234,230,0.72)] ">Transaction Date</label>
                  <input
                    type="date"
                    value={expenseForm.date}
                    onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                    className="w-full px-3 py-2 bg-[color:var(--ink-2)] border border-white/5 rounded-lg text-[13px] text-[color:var(--white)] outline-none focus:border-[color:var(--cyan)] font-mono"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[13px] font-bold text-[rgba(232,234,230,0.72)] ">Asset Stock ID (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. PE-1042"
                    value={expenseForm.referenceId}
                    onChange={(e) => setExpenseForm({ ...expenseForm, referenceId: e.target.value })}
                    className="w-full px-3 py-2 bg-[color:var(--ink-2)] border border-white/5 rounded-lg text-[13px] text-[color:var(--white)] outline-none focus:border-[color:var(--cyan)] font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-[color:var(--cyan)] on-fill hover:bg-opacity-80 transition-all font-bold text-[13px] rounded-lg flex items-center justify-center gap-1 cursor-pointer mt-2"
              >
                <Plus size={14} /> Commit Expense Entry
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 2. RECONDITIONING WORKSPACE TAB */}
      {activeTab === "recon" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
          {/* Left Panel: Vehicle List Selector */}
          <div className="card p-5 flex flex-col gap-4">
            <div>
              <h3 className="font-bold text-[16px] text-[color:var(--white)]">Select Refurbishment Target</h3>
              <p className="text-[13px] text-[rgba(232,234,230,0.72)] mt-0.5">Choose a vehicle below to view or manage active reconditioning tasks.</p>
            </div>

            <div className="flex flex-col gap-2 max-h-[450px] overflow-y-auto">
              {state.vehicles.map((v) => {
                const totalRecon = (v.reconTasks || []).reduce((s, t) => s + t.cost, 0);
                const isSelected = v.id === selectedVehicleId;
                const completedTasks = (v.reconTasks || []).filter(t => t.status === 'Completed').length;
                const totalTasksCount = (v.reconTasks || []).length;

                return (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVehicleId(v.id)}
                    className={`p-3 text-left border rounded-xl flex justify-between items-center transition-all cursor-pointer ${
                      isSelected 
                        ? "bg-[color:var(--cyan-faint)] border-[color:var(--cyan-soft)] text-[color:var(--white)]" 
                        : "bg-[color:var(--glass)] border-white/5 text-[rgba(232,234,230,0.72)] hover:bg-[color:var(--glass)]"
                    }`}
                  >
                    <div className="flex flex-col gap-1">
                      <span className="text-[13px] font-semibold truncate">{v.year} {v.make} {v.model}</span>
                      <div className="flex items-center gap-2 text-[13px]">
                        <span className="font-mono text-[rgba(232,234,230,0.72)] ">{v.stockNumber}</span>
                        {totalTasksCount > 0 && (
                          <span className="text-[color:var(--cyan)] font-semibold">
                            {completedTasks}/{totalTasksCount} Complete
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex flex-col gap-0.5">
                      <span className="text-[13px] font-mono font-bold text-[color:var(--white)]">{formatZAR(totalRecon)}</span>
                      <span className="text-[13px] text-[rgba(232,234,230,0.72)]">Recon Overhead</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Middle Panel: Active Recon Checklist */}
          <div className="lg:col-span-2 card p-5 flex flex-col gap-5">
            {selectedVehicle ? (
              <>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 border-b border-white/5 pb-3">
                  <div>
                    <h3 className="font-bold text-[16px] text-[color:var(--white)]">
                      Refurbishment Tasks: {selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model}
                    </h3>
                    <p className="text-[13px] text-[rgba(232,234,230,0.72)] mt-0.5">
                      Stock: <span className="font-mono text-[color:var(--white)]">{selectedVehicle.stockNumber}</span> | Internal Cost: <span className="text-[color:var(--cyan)]">{formatZAR(selectedVehicle.costPrice)}</span>
                    </p>
                  </div>
                  <div className="bg-[color:var(--ink-2)] border border-white/5 rounded-xl px-4 py-2 flex flex-col items-end">
                    <span className="text-[13px] text-[rgba(232,234,230,0.72)]  font-bold tracking-wider">Total Refurbishment Overhead</span>
                    <span className="text-[16px] font-mono font-bold text-[color:var(--cyan)]">{formatZAR(totalReconSpent)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Task List Workspace */}
                  <div className="md:col-span-2 flex flex-col gap-4">
                    <div className="flex justify-between items-center">
                      <h4 className="text-[13px] font-bold tracking-normal text-[rgba(232,234,230,0.72)]">Task Register</h4>
                    </div>

                    <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto">
                      {reconTasks.map((task) => (
                        <div
                          key={task.id}
                          className="bg-[color:var(--glass-line)] border border-white/5 rounded-xl p-4 flex justify-between items-center group hover:border-[color:var(--cyan-faint)] transition-all"
                        >
                          <div className="flex flex-col gap-1">
                            <span className="text-[13px] font-semibold text-[color:var(--white)]">{task.name}</span>
                            <div className="flex items-center gap-2 text-[13px] text-[rgba(232,234,230,0.72)]">
                              <span>Logged: {task.dateAdded}</span>
                              <span>•</span>
                              <span className="font-bold text-[color:var(--white)]">{formatZAR(task.cost)}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {(["Pending", "In Progress", "Completed"] as const).map((st) => (
                              <button
                                key={st}
                                onClick={() => toggleReconTaskStatus(selectedVehicle.id, task.id, st)}
                                className={`px-2 py-1 text-[13px] font-semibold tracking-wider  rounded-md transition-all cursor-pointer ${
                                  task.status === st
                                    ? st === "Completed"
                                      ? "bg-[color:var(--cyan-faint)] text-[color:var(--cyan)] border border-[color:var(--cyan-soft)]"
                                      : st === "In Progress"
                                      ? "bg-[color:var(--cyan-faint)] text-[color:var(--cyan)] border border-[color:var(--cyan-soft)]"
                                      : "bg-[color:var(--danger)] text-[color:var(--danger)] border border-[color:var(--danger)]"
                                    : "bg-[color:var(--glass)] text-[rgba(232,234,230,0.72)] border border-transparent hover:text-[color:var(--white)]"
                                }`}
                              >
                                {st === "In Progress" ? "Active" : st}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}

                      {reconTasks.length === 0 && (
                        <div className="flex flex-col items-center justify-center p-8 text-center text-[rgba(232,234,230,0.72)] bg-[color:var(--glass)] border border-dashed border-white/5 rounded-xl">
                          <Wrench size={24} className="mb-2 text-[rgba(232,234,230,0.72)]" />
                          <p className="text-[13px] italic">No active or historic refurbishment records found for this unit.</p>
                          <p className="text-[13px] mt-0.5">Use the adjacent form to record dings, detailing, safety audits or mechanical maintenance.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Add Recon Task Form */}
                  <div className="bg-[color:var(--glass-line)] border border-white/5 rounded-xl p-4 flex flex-col gap-3">
                    <div>
                      <h4 className="text-[13px] font-bold text-[color:var(--white)] tracking-normal">Log Refurbishment Task</h4>
                      <p className="text-[13px] text-[rgba(232,234,230,0.72)] mt-0.5">Adds to this car's cost.</p>
                    </div>

                    <form onSubmit={handleAddReconSubmit} className="flex flex-col gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[13px] text-[rgba(232,234,230,0.72)] font-bold ">Task Name / Vendor</label>
                        <input
                          type="text"
                          placeholder="e.g. Dent Out Panelbeaters"
                          value={reconForm.name}
                          onChange={(e) => setReconForm({ ...reconForm, name: e.target.value })}
                          className="w-full px-3 py-2 bg-[color:var(--ink-2)] border border-white/5 rounded-lg text-[13px] text-[color:var(--white)] outline-none focus:border-[color:var(--cyan)]"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[13px] text-[rgba(232,234,230,0.72)] font-bold ">Repair Overhead Cost (ZAR)</label>
                        <input
                          type="number"
                          placeholder="R 3500"
                          value={reconForm.cost}
                          onChange={(e) => setReconForm({ ...reconForm, cost: e.target.value })}
                          className="w-full px-3 py-2 bg-[color:var(--ink-2)] border border-white/5 rounded-lg text-[13px] text-[color:var(--white)] outline-none focus:border-[color:var(--cyan)] font-mono"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[13px] text-[rgba(232,234,230,0.72)] font-bold ">Current Workflow Stage</label>
                        <select
                          value={reconForm.status}
                          onChange={(e) => setReconForm({ ...reconForm, status: e.target.value as any })}
                          className="w-full px-3 py-2 bg-[color:var(--ink-2)] border border-white/5 rounded-lg text-[13px] text-[color:var(--white)] outline-none"
                        >
                          <option value="Pending">Pending Audit</option>
                          <option value="In Progress">Active Repair</option>
                          <option value="Completed">Ready & Completed</option>
                        </select>
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2 bg-[color:var(--cyan)] hover:bg-opacity-80 text-[color:var(--ink)] font-semibold text-[13px] rounded-lg flex items-center justify-center gap-1 cursor-pointer mt-1"
                      >
                        <Plus size={12} /> Log Refurbishment
                      </button>
                    </form>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-12 text-center text-[rgba(232,234,230,0.72)]">
                No vehicles available to recondition.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. BANK RECONCILIATION WORKSPACE TAB */}
      {activeTab === "bank" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fadeIn">
          {/* Bank Statement Upload Area */}
          <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
            {/* Drag and Drop Zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDropStatementFile}
              className={`md:col-span-2 border border-dashed rounded-xl p-5 flex flex-col items-center justify-center text-center transition-all relative ${
                dragActive 
                  ? "border-[color:var(--cyan)] bg-[color:var(--cyan-faint)]" 
                  : "border-white/10 hover:border-white/20 bg-black/20"
              }`}
            >
              {statementUploading ? (
                <div className="flex flex-col items-center justify-center gap-2">
                  <RefreshCw className="animate-spin text-[color:var(--cyan)] mb-1" size={24} />
                  <span className="text-[13px] font-bold text-[color:var(--white)] font-mono  tracking-wide">Scanning Statement Document...</span>
                  <span className="text-[13px] font-mono text-[rgba(232,234,230,0.72)]">Parsing rows, mapping credits, filtering debits...</span>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-2">
                  <Sliders className="text-[color:var(--cyan)] mb-1" size={24} />
                  <span className="text-[13px] font-bold text-[color:var(--white)] tracking-normal">
                    {statementName ? `Statement File: "${statementName}"` : "Drag & Drop Bank Statement (PDF, CSV, OFX)"}
                  </span>
                  <p className="text-[13px] text-[rgba(232,234,230,0.72)] leading-normal max-w-md">
                    {statementName 
                      ? "File successfully parsed. Transaction rows are updated in the feed below. Match with showroom ledgers to clear balances."
                      : "We never connect directly to your live bank accounts for maximum security. Simply upload your export file to reconcile instantly."}
                  </p>
                  
                  <div className="flex gap-2 items-center mt-1">
                    <label className="px-3 py-2 bg-[color:var(--cyan)] hover:bg-opacity-80 on-fill font-bold text-[13px] rounded-lg transition-all cursor-pointer ">
                      Select Statement File
                      <input
                        type="file"
                        accept=".csv,.pdf,.ofx,.txt"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            const f = e.target.files[0];
                            setStatementUploading(true);
                            setStatementName(f.name);
                            setTimeout(() => {
                              setStatementUploading(false);
                              setBankFeed(statementTemplates.fnb);
                              setSelectedLedgerId(null);
                              setSelectedBankTxId(null);
                            }, 1000);
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Demo Statement Loaders */}
            <div className="bg-[color:var(--glass-line)] border border-white/5 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <h4 className="text-[13px] font-semibold text-[color:var(--cyan)] tracking-normal">Select Example Statements</h4>
                <p className="text-[13px] text-[rgba(232,234,230,0.72)] mt-0.5 leading-relaxed">
                  Click any standard template below to instantly load and test offline statement parsing.
                </p>
              </div>

              <div className="space-y-2 mt-3">
                <button
                  onClick={() => handleLoadStatementTemplate("fnb", "FNB_Corporate_July2026.csv")}
                  className="w-full p-2 bg-[color:var(--glass)] hover:bg-white/5 border border-white/5 rounded-lg text-left text-[13px] text-[color:var(--white)] flex justify-between items-center transition-all cursor-pointer"
                >
                  <div className="flex flex-col">
                    <span className="font-bold">FNB Commercial Account</span>
                    <span className="text-[13px] text-[rgba(232,234,230,0.72)]">7 Transactions parsed</span>
                  </div>
                  <ChevronRight size={12} className="text-[rgba(232,234,230,0.72)]" />
                </button>

                <button
                  onClick={() => handleLoadStatementTemplate("nedbank", "Nedbank_DealerStatement.pdf")}
                  className="w-full p-2 bg-[color:var(--glass)] hover:bg-white/5 border border-white/5 rounded-lg text-left text-[13px] text-[color:var(--white)] flex justify-between items-center transition-all cursor-pointer"
                >
                  <div className="flex flex-col">
                    <span className="font-bold">Nedbank Business Ledger</span>
                    <span className="text-[13px] text-[rgba(232,234,230,0.72)]">5 Transactions parsed</span>
                  </div>
                  <ChevronRight size={12} className="text-[rgba(232,234,230,0.72)]" />
                </button>

                <button
                  onClick={() => handleLoadStatementTemplate("standard", "StandardBank_Main_July.ofx")}
                  className="w-full p-2 bg-[color:var(--glass)] hover:bg-white/5 border border-white/5 rounded-lg text-left text-[13px] text-[color:var(--white)] flex justify-between items-center transition-all cursor-pointer"
                >
                  <div className="flex flex-col">
                    <span className="font-bold">Standard Bank Showroom</span>
                    <span className="text-[13px] text-[rgba(232,234,230,0.72)]">4 Transactions parsed</span>
                  </div>
                  <ChevronRight size={12} className="text-[rgba(232,234,230,0.72)]" />
                </button>
              </div>
            </div>
          </div>

          {/* Left Column: Showroom Ledger Entries (unreconciled expenses and invoices) */}
          <div className="lg:col-span-6 card p-5 flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-white/5 pb-2">
              <h3 className="font-bold text-[13px] text-[rgba(232,234,230,0.72)] tracking-normal">1. Showroom Ledger Entries</h3>
              <span className="text-[13px] bg-[color:var(--danger)] text-[color:var(--danger)] font-bold px-2 py-0.5 rounded border border-[color:var(--danger)]">Reconciliation Required</span>
            </div>

            <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto pr-1">
              {/* Filtered unreconciled expenses */}
              {(state.expenses || []).filter(e => !e.reconciled).map((e) => (
                <button
                  key={e.id}
                  onClick={() => setSelectedLedgerId(selectedLedgerId === e.id ? null : e.id)}
                  className={`p-4 rounded-xl border text-left flex justify-between items-center transition-all cursor-pointer ${
                    selectedLedgerId === e.id
                      ? "bg-[color:var(--cyan-faint)] border-[color:var(--cyan)] text-[color:var(--white)]"
                      : "bg-[color:var(--glass)] border-white/5 hover:bg-[color:var(--glass)] text-[rgba(232,234,230,0.72)]"
                  }`}
                >
                  <div className="flex flex-col gap-2">
                    <span className="text-[13px] font-semibold text-[color:var(--white)] truncate">{e.description}</span>
                    <div className="flex items-center gap-2 text-[13px]">
                      <span className="bg-[color:var(--glass)] px-2 py-0.5 rounded text-[rgba(232,234,230,0.72)] text-[13px]  font-bold">{e.category}</span>
                      <span className="text-[rgba(232,234,230,0.72)]">Date: {e.date}</span>
                    </div>
                  </div>
                  <div className="text-right flex flex-col gap-1">
                    <span className="text-[13px] font-mono font-bold text-[color:var(--danger)]">{formatZAR(-e.amount)}</span>
                    <span className="text-[13px] text-[rgba(232,234,230,0.72)]">Internal Debit</span>
                  </div>
                </button>
              ))}

              {/* Also show unpaid/sent invoices as potential reconciliation points */}
              {state.invoices.filter(i => i.status === 'Sent').map((inv) => (
                <div
                  key={inv.id}
                  className="p-4 rounded-xl border border-white/5 text-left flex justify-between items-center bg-[color:var(--glass)] opacity-60"
                >
                  <div className="flex flex-col gap-1">
                    <span className="text-[13px] font-semibold text-[rgba(232,234,230,0.72)] truncate">Invoice {inv.invoiceNumber}</span>
                    <span className="text-[13px] text-[rgba(232,234,230,0.72)]">Sent to {getVehicleLabel(inv.vehicleId)}</span>
                  </div>
                  <div className="text-right flex flex-col gap-1">
                    <span className="text-[13px] font-mono font-bold text-[color:var(--cyan)]">{formatZAR(inv.amount)}</span>
                    <span className="text-[13px] text-[rgba(232,234,230,0.72)]">Awaiting Deposit</span>
                  </div>
                </div>
              ))}

              {state.expenses?.filter(e => !e.reconciled).length === 0 && (
                <div className="py-12 text-center text-[rgba(232,234,230,0.72)] italic text-[13px]">
                  All logged showroom expenditures are reconciled with FNB feed. Outstanding.
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Live Bank Feed Simulation */}
          <div className="lg:col-span-6 card p-5 flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-white/5 pb-2">
              <h3 className="font-bold text-[13px] text-[rgba(232,234,230,0.72)] tracking-normal">2. Live Corporate Bank Feed</h3>
              <span className="text-[13px] bg-emerald-500/10 text-[color:var(--cyan)] font-mono px-2 py-0.5 rounded border border-[color:var(--cyan-faint)] font-bold">Bank feed</span>
            </div>

            <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto pr-1">
              {bankFeed.map((tx) => (
                <button
                  key={tx.id}
                  disabled={tx.matched}
                  onClick={() => setSelectedBankTxId(selectedBankTxId === tx.id ? null : tx.id)}
                  className={`p-4 rounded-xl border text-left flex justify-between items-center transition-all ${
                    tx.matched
                      ? "bg-[color:var(--glass)] border-white/3 opacity-45 cursor-not-allowed"
                      : selectedBankTxId === tx.id
                      ? "bg-[color:var(--cyan-faint)] border-[color:var(--cyan)] text-[color:var(--white)] cursor-pointer"
                      : "bg-[color:var(--glass)] border-white/5 hover:bg-[color:var(--glass)] text-[rgba(232,234,230,0.72)] cursor-pointer"
                  }`}
                >
                  <div className="flex flex-col gap-1">
                    <span className="text-[13px] font-bold text-[color:var(--white)] tracking-tight leading-none truncate">{tx.sender}</span>
                    <div className="flex items-center gap-2 text-[13px] text-[rgba(232,234,230,0.72)] mt-1">
                      <span>{tx.date}</span>
                      <span>•</span>
                      <span className=" font-mono">{tx.type}</span>
                    </div>
                  </div>

                  <div className="text-right flex flex-col items-end gap-1">
                    <span className={`text-[13px] font-mono font-semibold ${tx.amount > 0 ? "text-[color:var(--cyan)]" : "text-[color:var(--danger)]"}`}>
                      {tx.amount > 0 ? "+" : ""}{formatZAR(tx.amount)}
                    </span>
                    {tx.matched ? (
                      <span className="bg-[color:var(--cyan-faint)] border border-[color:var(--cyan-soft)] text-[color:var(--cyan)] px-2 py-0.5 rounded text-[13px] font-semibold tracking-normal">
                        Linked Match
                      </span>
                    ) : (
                      <span className="text-[13px] text-[rgba(232,234,230,0.72)] italic">Unlinked</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Match Button Panel */}
          <div className="lg:col-span-12 flex flex-col md:flex-row justify-between items-center gap-4 bg-[color:var(--glass-line)] border border-white/5 rounded-xl p-4">
            <div className="flex gap-4 items-center">
              <div className="flex flex-col gap-0.5">
                <span className="text-[13px] text-[rgba(232,234,230,0.72)] font-bold ">Selected Showroom Entry</span>
                <span className="text-[13px] text-[color:var(--white)] font-semibold truncate max-w-[200px]">
                  {selectedLedgerId ? state.expenses?.find(e => e.id === selectedLedgerId)?.description : "None Selected"}
                </span>
              </div>
              <div className="text-[rgba(232,234,230,0.72)] font-semibold text-[16px]">↔</div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[13px] text-[rgba(232,234,230,0.72)] font-bold ">Selected Bank Feed</span>
                <span className="text-[13px] text-[color:var(--white)] font-semibold truncate max-w-[200px]">
                  {selectedBankTxId ? bankFeed.find(tx => tx.id === selectedBankTxId)?.sender : "None Selected"}
                </span>
              </div>
            </div>

            <button
              onClick={handleReconcileMatch}
              disabled={!selectedLedgerId || !selectedBankTxId}
              className="px-6 py-3 bg-gradient-to-r from-[color:var(--cyan)] to-[color:var(--cyan)] text-[color:var(--ink)] hover:brightness-115 disabled:opacity-40 rounded-xl font-bold text-[13px] flex items-center gap-2 transition-all shadow-lg active:scale-95 cursor-pointer disabled:cursor-not-allowed"
            >
              <Check size={14} /> Link & Reconcile Transaction Match
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
