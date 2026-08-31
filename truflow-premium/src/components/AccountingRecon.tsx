import React, { useState } from "react";
import { DMSState, Vehicle, Expense } from "../types";
import {
  Wrench,
  Activity,
  Plus,
  Check,
  AlertCircle,
  ArrowUpRight,
  Briefcase,
  FileSpreadsheet,
  Banknote,
} from "lucide-react";
import { useMoney } from "../contexts/MarketContext";

interface AccountingReconProps {
  state: DMSState;
  onUpdateVehicle: (id: string, updates: Partial<Vehicle>) => Promise<void>;
  onAddExpense: (expense: Partial<Expense>) => Promise<void>;
  onReconcileExpense: (id: string, reconciled: boolean) => Promise<void>;
  role?: 'salesperson' | 'manager' | 'owner';
}

export default function AccountingRecon({ state, onUpdateVehicle, onAddExpense, onReconcileExpense, role }: AccountingReconProps) {
  const money = useMoney();
  const [activeTab, setActiveTab] = useState<"pl" | "deals" | "aging" | "recon" | "floor">("pl");
  const [floorPlanRate, setFloorPlanRate] = useState(13.75);

  const [expenseForm, setExpenseForm] = useState({
    description: "",
    amount: "",
    category: "Operations",
    date: new Date().toISOString().slice(0, 10),
    referenceId: "",
  });

  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(
    state.vehicles.length > 0 ? state.vehicles[0].id : ""
  );

  const [reconForm, setReconForm] = useState({
    name: "",
    cost: "",
    status: "Pending" as "Pending" | "In Progress" | "Completed"
  });

  const formatZAR = (num: number) => {
    return money(num);
  };

  // P&L calculations
  const soldVehicles = state.vehicles.filter((v) => v.status === "SOLD");
  const revenueFromSales = state.invoices
    .filter((inv) => inv.status === "Paid")
    .reduce((sum, inv) => sum + inv.amount, 0);

  const costOfSoldUnits = soldVehicles.reduce((sum, v) => sum + v.costPrice, 0);
  const reconOnSoldUnits = soldVehicles.reduce((sum, v) => {
    const tasks = v.reconTasks || [];
    return sum + tasks.filter((t) => t.status === "Completed").reduce((s, t) => s + t.cost, 0);
  }, 0);

  const totalCostOfSales = costOfSoldUnits + reconOnSoldUnits;
  const grossProfit = revenueFromSales - totalCostOfSales;
  const grossMarginPercentage = revenueFromSales > 0 ? (grossProfit / revenueFromSales) * 100 : 0;

  const totalLedgerExpenses = (state.expenses || []).reduce((sum, e) => sum + e.amount, 0);
  const netProfit = grossProfit - totalLedgerExpenses;

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

    setReconForm({ name: "", cost: "", status: "Pending" });
  };

  const toggleReconTaskStatus = async (vehicleId: string, taskId: string, newStatus: "Pending" | "In Progress" | "Completed") => {
    const v = state.vehicles.find((item) => item.id === vehicleId);
    if (!v) return;

    const updatedTasks = (v.reconTasks || []).map((t) =>
      t.id === taskId ? { ...t, status: newStatus } : t
    );

    await onUpdateVehicle(vehicleId, { reconTasks: updatedTasks });
  };

  const selectedVehicle = state.vehicles.find((v) => v.id === selectedVehicleId);
  const reconTasks = selectedVehicle?.reconTasks || [];
  const totalReconSpent = reconTasks.reduce((sum, t) => sum + t.cost, 0);

  return (
    <div className="flex flex-col gap-6" id="accounting_recon_dashboard">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-[color:var(--white)] flex items-center gap-2">
            <FileSpreadsheet className="text-[color:var(--cyan)]" size={20} />
            Finance &amp; reconditioning
          </h2>
          <p className="text-[13px] text-[rgba(232,234,230,0.72)] mt-1">
            Profit &amp; Loss ledger, expense tracking and vehicle reconditioning costs.
          </p>
        </div>

        <div className="flex bg-[color:var(--ink-2)] border border-white/5 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab("pl")}
            className={`px-4 py-2 text-[13px] font-semibold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "pl" ? "bg-[color:var(--cyan)] text-[color:var(--ink)]" : "text-[rgba(232,234,230,0.72)] hover:text-[color:var(--white)]"
            }`}
          >
            <Activity size={13} />
            Profit &amp; Loss
          </button>
          <button
            onClick={() => setActiveTab("deals")}
            className={`px-4 py-2 text-[13px] font-semibold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "deals" ? "bg-[color:var(--cyan)] text-[color:var(--ink)]" : "text-[rgba(232,234,230,0.72)] hover:text-[color:var(--white)]"
            }`}
          >
            <Briefcase size={13} />
            Deal Profit
          </button>
          <button
            onClick={() => setActiveTab("aging")}
            className={`px-4 py-2 text-[13px] font-semibold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "aging" ? "bg-[color:var(--cyan)] text-[color:var(--ink)]" : "text-[rgba(232,234,230,0.72)] hover:text-[color:var(--white)]"
            }`}
          >
            <AlertCircle size={13} />
            Stock Aging
          </button>
          <button
            onClick={() => setActiveTab("recon")}
            className={`px-4 py-2 text-[13px] font-semibold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "recon" ? "bg-[color:var(--cyan)] text-[color:var(--ink)]" : "text-[rgba(232,234,230,0.72)] hover:text-[color:var(--white)]"
            }`}
          >
            <Wrench size={13} />
            Reconditioning
          </button>
          <button
            onClick={() => setActiveTab("floor")}
            className={`px-4 py-2 text-[13px] font-semibold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "floor" ? "bg-[color:var(--cyan)] text-[color:var(--ink)]" : "text-[rgba(232,234,230,0.72)] hover:text-[color:var(--white)]"
            }`}
          >
            <Banknote size={13} />
            Floor Plan
          </button>
        </div>
      </div>

      {/* PROFIT & LOSS */}
      {activeTab === "pl" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
          <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-[color:var(--glass-line)] border border-white/5 rounded-xl p-4 flex flex-col gap-2">
              <span className="text-[13px] text-[rgba(232,234,230,0.72)] font-semibold tracking-wider">Sales Revenue</span>
              <span className="text-lg font-mono text-[color:var(--cyan)] font-semibold">{formatZAR(revenueFromSales)}</span>
              <span className="text-[13px] text-[rgba(232,234,230,0.72)] flex items-center gap-1"><ArrowUpRight size={10} className="text-[color:var(--cyan)]" /> From paid invoices</span>
            </div>

            <div className="bg-[color:var(--glass-line)] border border-white/5 rounded-xl p-4 flex flex-col gap-2">
              <span className="text-[13px] text-[rgba(232,234,230,0.72)] font-semibold tracking-wider">Cost of Sales</span>
              <span className="text-lg font-mono text-[color:var(--muted)] font-semibold">{formatZAR(totalCostOfSales)}</span>
              <span className="text-[13px] text-[rgba(232,234,230,0.72)]">Units cost + recon</span>
            </div>

            <div className="bg-[color:var(--glass-line)] border border-white/5 rounded-xl p-4 flex flex-col gap-2">
              <span className="text-[13px] text-[rgba(232,234,230,0.72)] font-semibold tracking-wider">Gross Profit</span>
              <span className="text-lg font-mono text-[color:var(--white)] font-semibold">{formatZAR(grossProfit)}</span>
              <span className="text-[13px] text-[color:var(--cyan)] font-semibold">{grossMarginPercentage.toFixed(1)}% margin</span>
            </div>

            <div className="bg-[color:var(--glass-line)] border border-white/5 rounded-xl p-4 flex flex-col gap-2">
              <span className="text-[13px] text-[rgba(232,234,230,0.72)] font-semibold tracking-wider">Operating Expenses</span>
              <span className="text-lg font-mono text-[color:var(--muted)] font-semibold">{formatZAR(totalLedgerExpenses)}</span>
              <span className="text-[13px] text-[rgba(232,234,230,0.72)]">Marketing, rent &amp; ops</span>
            </div>

            <div className="bg-[color:var(--cyan-faint)] border border-[color:var(--cyan-faint)] rounded-xl p-4 flex flex-col gap-2 col-span-2 md:col-span-1">
              <span className="text-[13px] text-[color:var(--cyan)] font-semibold tracking-wider">Net Income</span>
              <span className={`text-lg font-mono font-semibold ${netProfit >= 0 ? "text-[color:var(--cyan)]" : "text-[color:var(--muted)]"}`}>
                {formatZAR(netProfit)}
              </span>
              <span className="text-[13px] text-[rgba(232,234,230,0.72)]">Bottom line</span>
            </div>
          </div>

          <div className="lg:col-span-2 card p-5 flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-[16px] text-[color:var(--white)] flex items-center gap-2">
                <Briefcase size={14} className="text-[color:var(--cyan)]" />
                Expense Ledger
              </h3>
              <span className="text-[13px] font-mono bg-[color:var(--glass)] px-3 py-1 rounded-full text-[rgba(232,234,230,0.72)]">
                {state.expenses?.length || 0} entries
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px] border-collapse stack-mobile">
                <thead>
                  <tr className="border-b border-white/5 text-[rgba(232,234,230,0.72)]">
                    <th className="pb-3 font-semibold tracking-normal text-[13px]">Date</th>
                    <th className="pb-3 font-semibold tracking-normal text-[13px]">Description</th>
                    <th className="pb-3 font-semibold tracking-normal text-[13px]">Category</th>
                    <th className="pb-3 font-semibold tracking-normal text-[13px]">Reference</th>
                    <th className="pb-3 font-semibold tracking-normal text-[13px] text-right">Amount</th>
                    <th className="pb-3 font-semibold tracking-normal text-[13px] text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {(state.expenses || []).map((e) => (
                    <tr key={e.id} className="hover:bg-[color:var(--glass)] transition-all group">
                      <td data-label="Date" className="py-3 font-mono text-[13px] md:text-[15px] text-[rgba(232,234,230,0.72)]">{e.date}</td>
                      <td data-label="Description" className="py-3 text-[13px] md:text-[15px] text-[color:var(--white)] font-semibold">{e.description}</td>
                      <td data-label="Category" className="py-3">
                        <span className="bg-[color:var(--glass)] border border-white/5 text-[13px] text-[rgba(232,234,230,0.72)] px-2 py-0.5 rounded">
                          {e.category}
                        </span>
                      </td>
                      <td data-label="Reference" className="py-3 font-mono text-[13px] md:text-[15px] text-[rgba(232,234,230,0.72)]">
                        {e.referenceId || "—"}
                      </td>
                      <td data-label="Amount" className="py-3 text-right font-mono text-[13px] md:text-[15px] font-semibold text-[color:var(--white)]">
                        {formatZAR(e.amount)}
                      </td>
                      <td data-label="Status" className="py-3 text-center">
                        {e.reconciled ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[13px] bg-[color:var(--cyan-faint)] text-[color:var(--cyan)] border border-[color:var(--cyan-faint)] font-semibold">
                            <Check size={8} /> Reconciled
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[13px] bg-[color:var(--glass)] text-[color:var(--muted)] border border-[color:var(--glass-line)] font-semibold">
                            <AlertCircle size={8} /> Open
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {(!state.expenses || state.expenses.length === 0) && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-[rgba(232,234,230,0.72)] italic">
                        No expenses logged yet. Use the form to record overheads.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card p-5 flex flex-col gap-4 bg-[color:var(--glass-line)]">
            <div>
              <h3 className="font-semibold text-[16px] text-[color:var(--white)]">Log Expense</h3>
              <p className="text-[13px] text-[rgba(232,234,230,0.72)] mt-0.5">Rent, marketing, utilities or other overheads.</p>
            </div>

            <form onSubmit={handleAddExpenseSubmit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[13px] font-semibold text-[rgba(232,234,230,0.72)]">Description / Payee</label>
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
                  <label className="text-[13px] font-semibold text-[rgba(232,234,230,0.72)]">Amount (ZAR)</label>
                  <input
                    type="number"
                    placeholder="R 4500"
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                    className="w-full px-3 py-2 bg-[color:var(--ink-2)] border border-white/5 rounded-lg text-[13px] text-[color:var(--white)] outline-none focus:border-[color:var(--cyan)] font-mono"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[13px] font-semibold text-[rgba(232,234,230,0.72)]">Category</label>
                  <select
                    value={expenseForm.category}
                    onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                    className="w-full px-3 py-2 bg-[color:var(--ink-2)] border border-white/5 rounded-lg text-[13px] text-[color:var(--white)] outline-none focus:border-[color:var(--cyan)]"
                  >
                    <option value="Rent">Rent / Lease</option>
                    <option value="Marketing">Marketing / Ads</option>
                    <option value="Utilities">Utilities</option>
                    <option value="Operations">Operations</option>
                    <option value="Salaries">Salaries &amp; Commissions</option>
                    <option value="Reconditioning">Reconditioning</option>
                    <option value="Others">Others</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[13px] font-semibold text-[rgba(232,234,230,0.72)]">Date</label>
                  <input
                    type="date"
                    value={expenseForm.date}
                    onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                    className="w-full px-3 py-2 bg-[color:var(--ink-2)] border border-white/5 rounded-lg text-[13px] text-[color:var(--white)] outline-none focus:border-[color:var(--cyan)] font-mono"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[13px] font-semibold text-[rgba(232,234,230,0.72)]">Stock ID (optional)</label>
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
                className="w-full py-2 bg-[color:var(--cyan)] on-fill hover:bg-opacity-80 transition-all font-semibold text-[13px] rounded-lg flex items-center justify-center gap-1 cursor-pointer mt-2"
              >
                <Plus size={14} /> Log Expense
              </button>
            </form>
          </div>
        </div>
      )}

      {/* DEAL PROFIT REPORT */}
      {activeTab === "deals" && (() => {
        const leads = (state as any).leads || [];
        const dealLeads = leads.filter((l: any) => l.status === 'Closed Won' || l.soldDate || l.soldPrice);
        const dealRows = dealLeads.map((l: any) => {
          const v = state.vehicles.find((vv: any) => vv.id === l.vehicleId);
          const cost = v?.costPrice || 0;
          const recon = (v?.reconTasks || []).filter((t: any) => t.status === 'Completed').reduce((s: number, t: any) => s + t.cost, 0);
          const selling = l.sellingPrice || l.soldPrice || v?.retailPrice || 0;
          const extras = (l.invoiceExtras || []).reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);
          const secondGross = (l.invoiceExtras || []).filter((e: any) => e.secondGross).reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);
          const firstGross = selling - cost - recon;
          const totalGross = firstGross + secondGross;
          return { lead: l, vehicle: v, cost, recon, selling, extras, firstGross, secondGross, totalGross };
        });
        const totalFirstGross = dealRows.reduce((s: number, r: any) => s + r.firstGross, 0);
        const totalSecondGross = dealRows.reduce((s: number, r: any) => s + r.secondGross, 0);
        const totalAllGross = dealRows.reduce((s: number, r: any) => s + r.totalGross, 0);

        return (
          <div className="flex flex-col gap-4 animate-fadeIn">
            <div className={`grid ${role === 'salesperson' ? 'grid-cols-1' : 'grid-cols-3'} gap-4`}>
              <div className="bg-[color:var(--glass-line)] border border-white/5 rounded-xl p-4 flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-wider text-[rgba(232,234,230,0.55)]">Deals Closed</span>
                <span className="text-2xl font-mono font-semibold text-[color:var(--white)]">{dealRows.length}</span>
              </div>
              {role !== 'salesperson' && (
              <div className="bg-[color:var(--glass-line)] border border-white/5 rounded-xl p-4 flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-wider text-[rgba(232,234,230,0.55)]">Total 1st Gross</span>
                <span className={`text-2xl font-mono font-semibold ${totalFirstGross >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatZAR(totalFirstGross)}</span>
              </div>
              )}
              {role !== 'salesperson' && (
              <div className="bg-[color:var(--cyan-faint)] border border-[color:var(--cyan-faint)] rounded-xl p-4 flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-wider text-[color:var(--cyan)]">Total Gross (1st + 2nd)</span>
                <span className={`text-2xl font-mono font-semibold ${totalAllGross >= 0 ? 'text-[color:var(--cyan)]' : 'text-red-400'}`}>{formatZAR(totalAllGross)}</span>
              </div>
              )}
            </div>

            <div className="overflow-x-auto rounded-xl border border-white/5">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-[rgba(232,234,230,0.45)] bg-[rgba(255,255,255,0.02)]">
                    <th className="px-4 py-3">Vehicle</th>
                    <th className="px-4 py-3">Customer</th>
                    {role !== 'salesperson' && <th className="px-4 py-3 text-right">Cost</th>}
                    {role !== 'salesperson' && <th className="px-4 py-3 text-right">Recon</th>}
                    <th className="px-4 py-3 text-right">Selling</th>
                    {role !== 'salesperson' && <th className="px-4 py-3 text-right">1st Gross</th>}
                    {role !== 'salesperson' && <th className="px-4 py-3 text-right">2nd Gross</th>}
                    {role !== 'salesperson' && <th className="px-4 py-3 text-right font-bold">Total</th>}
                    {role !== 'salesperson' && <th className="px-4 py-3 text-right">Margin</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {dealRows.length === 0 ? (
                    <tr><td colSpan={role === 'salesperson' ? 3 : 9} className="px-4 py-8 text-center text-[rgba(232,234,230,0.45)]">No closed deals yet.</td></tr>
                  ) : dealRows.map((r: any) => {
                    const margin = r.selling > 0 ? ((r.firstGross / r.selling) * 100) : 0;
                    return (
                      <tr key={r.lead.id} className="hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                        <td className="px-4 py-3 text-[color:var(--white)] font-medium">{r.vehicle ? `${r.vehicle.year} ${r.vehicle.make} ${r.vehicle.model}` : '—'}</td>
                        <td className="px-4 py-3 text-[rgba(232,234,230,0.72)]">{r.lead.firstName || ''} {r.lead.lastName || ''}</td>
                        {role !== 'salesperson' && <td className="px-4 py-3 text-right font-mono text-[rgba(232,234,230,0.55)]">{formatZAR(r.cost)}</td>}
                        {role !== 'salesperson' && <td className="px-4 py-3 text-right font-mono text-[rgba(232,234,230,0.55)]">{r.recon > 0 ? formatZAR(r.recon) : '—'}</td>}
                        <td className="px-4 py-3 text-right font-mono text-[color:var(--white)]">{formatZAR(r.selling)}</td>
                        {role !== 'salesperson' && <td className={`px-4 py-3 text-right font-mono font-semibold ${r.firstGross >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatZAR(r.firstGross)}</td>}
                        {role !== 'salesperson' && <td className="px-4 py-3 text-right font-mono text-[rgba(232,234,230,0.55)]">{r.secondGross > 0 ? formatZAR(r.secondGross) : '—'}</td>}
                        {role !== 'salesperson' && <td className={`px-4 py-3 text-right font-mono font-bold ${r.totalGross >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatZAR(r.totalGross)}</td>}
                        {role !== 'salesperson' && <td className={`px-4 py-3 text-right font-mono text-[12px] ${margin >= 15 ? 'text-emerald-400' : margin >= 5 ? 'text-amber-400' : 'text-red-400'}`}>{margin.toFixed(1)}%</td>}
                      </tr>
                    );
                  })}
                </tbody>
                {dealRows.length > 0 && role !== 'salesperson' && (
                  <tfoot>
                    <tr className="border-t-2 border-white/10 bg-[rgba(255,255,255,0.02)]">
                      <td colSpan={5} className="px-4 py-3 text-right text-[11px] uppercase tracking-wider text-[rgba(232,234,230,0.45)] font-semibold">Totals</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400">{formatZAR(totalFirstGross)}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-[rgba(232,234,230,0.55)]">{totalSecondGross > 0 ? formatZAR(totalSecondGross) : '—'}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-[color:var(--cyan)]">{formatZAR(totalAllGross)}</td>
                      <td className="px-4 py-3 text-right font-mono text-[12px] text-[rgba(232,234,230,0.45)]">
                        {dealRows.reduce((s: number, r: any) => s + r.selling, 0) > 0
                          ? ((totalFirstGross / dealRows.reduce((s: number, r: any) => s + r.selling, 0)) * 100).toFixed(1) + '%'
                          : '—'}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        );
      })()}

      {/* STOCK AGING */}
      {activeTab === "aging" && (() => {
        const inStock = state.vehicles.filter(v => v.status !== 'SOLD');
        const now = Date.now();
        const withAge = inStock.map(v => {
          const created = v.createdAt ? new Date(v.createdAt).getTime() : now;
          const days = Math.floor((now - created) / (1000 * 60 * 60 * 24));
          const recon = (v.reconTasks || []).filter((t: any) => t.status === 'Completed').reduce((s: number, t: any) => s + t.cost, 0);
          const totalInvested = v.costPrice + recon;
          return { ...v, days, recon, totalInvested };
        }).sort((a, b) => b.days - a.days);

        const avgDays = withAge.length > 0 ? Math.round(withAge.reduce((s, v) => s + v.days, 0) / withAge.length) : 0;
        const totalFloorValue = withAge.reduce((s, v) => s + v.totalInvested, 0);
        const over60 = withAge.filter(v => v.days > 60).length;
        const over90 = withAge.filter(v => v.days > 90).length;

        const ageBadge = (days: number) => {
          if (days > 90) return 'bg-red-500/15 text-red-400 border-red-500/30';
          if (days > 60) return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
          if (days > 30) return 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30';
          return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
        };

        return (
          <div className="flex flex-col gap-4 animate-fadeIn">
            <div className={`grid ${role === 'salesperson' ? 'grid-cols-3' : 'grid-cols-4'} gap-4`}>
              <div className="bg-[color:var(--glass-line)] border border-white/5 rounded-xl p-4 flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-wider text-[rgba(232,234,230,0.55)]">Units in Stock</span>
                <span className="text-2xl font-mono font-semibold text-[color:var(--white)]">{withAge.length}</span>
              </div>
              <div className="bg-[color:var(--glass-line)] border border-white/5 rounded-xl p-4 flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-wider text-[rgba(232,234,230,0.55)]">Avg Days in Stock</span>
                <span className={`text-2xl font-mono font-semibold ${avgDays > 60 ? 'text-amber-400' : 'text-[color:var(--white)]'}`}>{avgDays}</span>
              </div>
              {role !== 'salesperson' && (
              <div className="bg-[color:var(--glass-line)] border border-white/5 rounded-xl p-4 flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-wider text-[rgba(232,234,230,0.55)]">Floor Value</span>
                <span className="text-2xl font-mono font-semibold text-[color:var(--white)]">{formatZAR(totalFloorValue)}</span>
              </div>
              )}
              <div className={`rounded-xl p-4 flex flex-col gap-1 border ${over90 > 0 ? 'bg-red-500/10 border-red-500/20' : over60 > 0 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
                <span className="text-[11px] uppercase tracking-wider text-[rgba(232,234,230,0.55)]">Over 60 Days</span>
                <span className={`text-2xl font-mono font-semibold ${over60 > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>{over60}</span>
                {over90 > 0 && <span className="text-[11px] text-red-400 font-semibold">{over90} over 90 days</span>}
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-white/5">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-[rgba(232,234,230,0.45)] bg-[rgba(255,255,255,0.02)]">
                    <th className="px-4 py-3">Stock #</th>
                    <th className="px-4 py-3">Vehicle</th>
                    {role !== 'salesperson' && <th className="px-4 py-3 text-right">Cost</th>}
                    {role !== 'salesperson' && <th className="px-4 py-3 text-right">Recon</th>}
                    {role !== 'salesperson' && <th className="px-4 py-3 text-right">Total Invested</th>}
                    <th className="px-4 py-3 text-right">Retail Price</th>
                    <th className="px-4 py-3 text-center">Days</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {withAge.length === 0 ? (
                    <tr><td colSpan={role === 'salesperson' ? 4 : 7} className="px-4 py-8 text-center text-[rgba(232,234,230,0.45)]">No vehicles in stock.</td></tr>
                  ) : withAge.map(v => (
                    <tr key={v.id} className="hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                      <td className="px-4 py-3 font-mono text-[rgba(232,234,230,0.55)]">{v.stockNumber}</td>
                      <td className="px-4 py-3 text-[color:var(--white)] font-medium">{v.year} {v.make} {v.model}</td>
                      {role !== 'salesperson' && <td className="px-4 py-3 text-right font-mono text-[rgba(232,234,230,0.55)]">{formatZAR(v.costPrice)}</td>}
                      {role !== 'salesperson' && <td className="px-4 py-3 text-right font-mono text-[rgba(232,234,230,0.55)]">{v.recon > 0 ? formatZAR(v.recon) : '—'}</td>}
                      {role !== 'salesperson' && <td className="px-4 py-3 text-right font-mono text-[color:var(--white)] font-semibold">{formatZAR(v.totalInvested)}</td>}
                      <td className="px-4 py-3 text-right font-mono text-[color:var(--cyan)]">{formatZAR(v.retailPrice)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[12px] font-mono font-semibold border ${ageBadge(v.days)}`}>
                          {v.days}d
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* RECONDITIONING */}
      {activeTab === "recon" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
          <div className="card p-5 flex flex-col gap-4">
            <div>
              <h3 className="font-semibold text-[16px] text-[color:var(--white)]">Select Vehicle</h3>
              <p className="text-[13px] text-[rgba(232,234,230,0.72)] mt-0.5">Choose a vehicle to view or add recon tasks.</p>
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
                        <span className="font-mono text-[rgba(232,234,230,0.72)]">{v.stockNumber}</span>
                        {totalTasksCount > 0 && (
                          <span className="text-[color:var(--cyan)] font-semibold">
                            {completedTasks}/{totalTasksCount} done
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex flex-col gap-0.5">
                      <span className="text-[13px] font-mono font-semibold text-[color:var(--white)]">{formatZAR(totalRecon)}</span>
                      <span className="text-[13px] text-[rgba(232,234,230,0.72)]">Recon cost</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-2 card p-5 flex flex-col gap-5">
            {selectedVehicle ? (
              <>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 border-b border-white/5 pb-3">
                  <div>
                    <h3 className="font-semibold text-[16px] text-[color:var(--white)]">
                      {selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model}
                    </h3>
                    <p className="text-[13px] text-[rgba(232,234,230,0.72)] mt-0.5">
                      Stock: <span className="font-mono text-[color:var(--white)]">{selectedVehicle.stockNumber}</span> · Cost: <span className="text-[color:var(--cyan)]">{formatZAR(selectedVehicle.costPrice)}</span>
                    </p>
                  </div>
                  <div className="bg-[color:var(--ink-2)] border border-white/5 rounded-xl px-4 py-2 flex flex-col items-end">
                    <span className="text-[13px] text-[rgba(232,234,230,0.72)] font-semibold tracking-wider">Total Recon</span>
                    <span className="text-[16px] font-mono font-semibold text-[color:var(--cyan)]">{formatZAR(totalReconSpent)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-2 flex flex-col gap-4">
                    <h4 className="text-[13px] font-semibold tracking-normal text-[rgba(232,234,230,0.72)]">Tasks</h4>

                    <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto">
                      {reconTasks.map((task) => (
                        <div
                          key={task.id}
                          className="bg-[color:var(--glass-line)] border border-white/5 rounded-xl p-4 flex justify-between items-center group hover:border-[color:var(--cyan-faint)] transition-all"
                        >
                          <div className="flex flex-col gap-1">
                            <span className="text-[13px] font-semibold text-[color:var(--white)]">{task.name}</span>
                            <div className="flex items-center gap-2 text-[13px] text-[rgba(232,234,230,0.72)]">
                              <span>{task.dateAdded}</span>
                              <span>·</span>
                              <span className="font-semibold text-[color:var(--white)]">{formatZAR(task.cost)}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {(["Pending", "In Progress", "Completed"] as const).map((st) => (
                              <button
                                key={st}
                                onClick={() => toggleReconTaskStatus(selectedVehicle.id, task.id, st)}
                                className={`px-2 py-1 text-[13px] font-semibold rounded-lg transition-all cursor-pointer ${
                                  task.status === st
                                    ? st === "Completed" || st === "In Progress"
                                      ? "bg-[color:var(--cyan-faint)] text-[color:var(--cyan)] border border-[color:var(--cyan-soft)]"
                                      : "bg-[color:var(--glass)] text-[color:var(--muted)] border border-[color:var(--glass-line)]"
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
                          <p className="text-[13px] italic">No recon tasks for this unit.</p>
                          <p className="text-[13px] mt-0.5">Use the form to log detailing, repairs or safety work.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-[color:var(--glass-line)] border border-white/5 rounded-xl p-4 flex flex-col gap-3">
                    <div>
                      <h4 className="text-[13px] font-semibold text-[color:var(--white)] tracking-normal">Add Recon Task</h4>
                      <p className="text-[13px] text-[rgba(232,234,230,0.72)] mt-0.5">Adds to this vehicle's cost.</p>
                    </div>

                    <form onSubmit={handleAddReconSubmit} className="flex flex-col gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[13px] text-[rgba(232,234,230,0.72)] font-semibold">Task / Vendor</label>
                        <input
                          type="text"
                          placeholder="e.g. Dent Out Panelbeaters"
                          value={reconForm.name}
                          onChange={(e) => setReconForm({ ...reconForm, name: e.target.value })}
                          className="w-full px-3 py-2 bg-[color:var(--ink-2)] border border-white/5 rounded-lg text-[13px] text-[color:var(--white)] outline-none focus:border-[color:var(--cyan)]"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[13px] text-[rgba(232,234,230,0.72)] font-semibold">Cost (ZAR)</label>
                        <input
                          type="number"
                          placeholder="R 3500"
                          value={reconForm.cost}
                          onChange={(e) => setReconForm({ ...reconForm, cost: e.target.value })}
                          className="w-full px-3 py-2 bg-[color:var(--ink-2)] border border-white/5 rounded-lg text-[13px] text-[color:var(--white)] outline-none focus:border-[color:var(--cyan)] font-mono"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[13px] text-[rgba(232,234,230,0.72)] font-semibold">Status</label>
                        <select
                          value={reconForm.status}
                          onChange={(e) => setReconForm({ ...reconForm, status: e.target.value as any })}
                          className="w-full px-3 py-2 bg-[color:var(--ink-2)] border border-white/5 rounded-lg text-[13px] text-[color:var(--white)] outline-none"
                        >
                          <option value="Pending">Pending</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Completed">Completed</option>
                        </select>
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2 bg-[color:var(--cyan)] hover:bg-opacity-80 text-[color:var(--ink)] font-semibold text-[13px] rounded-lg flex items-center justify-center gap-1 cursor-pointer mt-1"
                      >
                        <Plus size={12} /> Add Task
                      </button>
                    </form>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-12 text-center text-[rgba(232,234,230,0.72)]">
                No vehicles in inventory.
              </div>
            )}
          </div>
        </div>
      )}

      {/* FLOOR PLAN */}
      {activeTab === "floor" && (() => {
        const inStock = state.vehicles.filter(v => v.status !== 'SOLD');
        const now = Date.now();
        const rateDecimal = floorPlanRate / 100;

        const floorRows = inStock.map(v => {
          const created = v.createdAt ? new Date(v.createdAt).getTime() : now;
          const days = Math.max(0, Math.floor((now - created) / (1000 * 60 * 60 * 24)));
          const interestAccrued = v.costPrice * rateDecimal * days / 365;
          return { ...v, days, interestAccrued };
        }).sort((a, b) => b.days - a.days);

        const totalExposure = floorRows.reduce((s, v) => s + v.costPrice, 0);
        const monthlyInterest = totalExposure * rateDecimal / 12;
        const unitsOnFloor = floorRows.length;
        const avgDays = unitsOnFloor > 0 ? Math.round(floorRows.reduce((s, v) => s + v.days, 0) / unitsOnFloor) : 0;
        const totalInterestAccrued = floorRows.reduce((s, v) => s + v.interestAccrued, 0);

        const ageBadge = (days: number) => {
          if (days > 90) return 'bg-red-500/15 text-red-400 border-red-500/30';
          if (days > 60) return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
          if (days > 30) return 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30';
          return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
        };

        return (
          <div className="flex flex-col gap-4 animate-fadeIn">
            {/* Rate input */}
            <div className="flex items-center gap-3">
              <label className="text-[13px] font-semibold text-[rgba(232,234,230,0.72)]">Annual interest rate (%)</label>
              <input
                type="number"
                step="0.25"
                min="0"
                max="50"
                value={floorPlanRate}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val)) setFloorPlanRate(val);
                }}
                className="w-24 px-3 py-1.5 bg-[color:var(--ink-2)] border border-white/5 rounded-lg text-[13px] text-[color:var(--white)] outline-none focus:border-[color:var(--cyan)] font-mono text-center"
              />
              <span className="text-[13px] text-[rgba(232,234,230,0.45)]">SA prime (11.75%) + 2% = 13.75%</span>
            </div>

            {/* Summary cards */}
            <div className={`grid ${role === 'salesperson' ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-4'} gap-4`}>
              {role !== 'salesperson' && (
                <div className="bg-[color:var(--glass-line)] border border-white/5 rounded-xl p-4 flex flex-col gap-1">
                  <span className="text-[11px] uppercase tracking-wider text-[rgba(232,234,230,0.55)]">Total Floor Plan Exposure</span>
                  <span className="text-2xl font-mono font-semibold text-[color:var(--cyan)]">{formatZAR(totalExposure)}</span>
                </div>
              )}
              {role !== 'salesperson' && (
                <div className="bg-[color:var(--glass-line)] border border-white/5 rounded-xl p-4 flex flex-col gap-1">
                  <span className="text-[11px] uppercase tracking-wider text-[rgba(232,234,230,0.55)]">Monthly Interest Est.</span>
                  <span className="text-2xl font-mono font-semibold text-[color:var(--cyan)]">{formatZAR(monthlyInterest)}</span>
                </div>
              )}
              <div className="bg-[color:var(--glass-line)] border border-white/5 rounded-xl p-4 flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-wider text-[rgba(232,234,230,0.55)]">Units on Floor Plan</span>
                <span className="text-2xl font-mono font-semibold text-[color:var(--white)]">{unitsOnFloor}</span>
              </div>
              <div className="bg-[color:var(--glass-line)] border border-white/5 rounded-xl p-4 flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-wider text-[rgba(232,234,230,0.55)]">Avg Days on Floor</span>
                <span className={`text-2xl font-mono font-semibold ${avgDays > 60 ? 'text-amber-400' : 'text-[color:var(--white)]'}`}>{avgDays}</span>
              </div>
            </div>

            {/* Total interest accrued callout */}
            {role !== 'salesperson' && (
              <div className="bg-[color:var(--cyan-faint)] border border-[color:var(--cyan-faint)] rounded-xl p-4 flex items-center justify-between">
                <span className="text-[13px] font-semibold text-[color:var(--cyan)]">Total Interest Accrued (all units)</span>
                <span className="text-xl font-mono font-semibold text-[color:var(--cyan)]">{formatZAR(totalInterestAccrued)}</span>
              </div>
            )}

            {/* Per-vehicle table */}
            <div className="overflow-x-auto rounded-xl border border-white/5">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-[rgba(232,234,230,0.45)] bg-[rgba(255,255,255,0.02)]">
                    <th className="px-4 py-3">Vehicle</th>
                    <th className="px-4 py-3">Stock #</th>
                    {role !== 'salesperson' && <th className="px-4 py-3 text-right">Cost Price</th>}
                    <th className="px-4 py-3 text-center">Days in Stock</th>
                    {role !== 'salesperson' && <th className="px-4 py-3 text-right">Est. Interest Accrued</th>}
                    <th className="px-4 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {floorRows.length === 0 ? (
                    <tr><td colSpan={role === 'salesperson' ? 4 : 6} className="px-4 py-8 text-center text-[rgba(232,234,230,0.45)]">No vehicles on floor plan.</td></tr>
                  ) : floorRows.map(v => (
                    <tr key={v.id} className="hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                      <td className="px-4 py-3 text-[color:var(--white)] font-medium">{v.year} {v.make} {v.model}</td>
                      <td className="px-4 py-3 font-mono text-[rgba(232,234,230,0.55)]">{v.stockNumber}</td>
                      {role !== 'salesperson' && <td className="px-4 py-3 text-right font-mono text-[rgba(232,234,230,0.55)]">{formatZAR(v.costPrice)}</td>}
                      <td className="px-4 py-3 text-center font-mono text-[color:var(--white)]">{v.days}</td>
                      {role !== 'salesperson' && <td className={`px-4 py-3 text-right font-mono font-semibold ${v.interestAccrued > v.costPrice * 0.05 ? 'text-red-400' : 'text-[rgba(232,234,230,0.72)]'}`}>{formatZAR(v.interestAccrued)}</td>}
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[12px] font-mono font-semibold border ${ageBadge(v.days)}`}>
                          {v.days <= 30 ? 'Fresh' : v.days <= 60 ? 'Aging' : v.days <= 90 ? 'Stale' : 'Critical'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {floorRows.length > 0 && role !== 'salesperson' && (
                  <tfoot>
                    <tr className="border-t-2 border-white/10 bg-[rgba(255,255,255,0.02)]">
                      <td colSpan={2} className="px-4 py-3 text-right text-[11px] uppercase tracking-wider text-[rgba(232,234,230,0.45)] font-semibold">Totals</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-[color:var(--white)]">{formatZAR(totalExposure)}</td>
                      <td className="px-4 py-3 text-center font-mono text-[rgba(232,234,230,0.45)]">{avgDays} avg</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-[color:var(--cyan)]">{formatZAR(totalInterestAccrued)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
