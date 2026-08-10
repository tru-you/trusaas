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
} from "lucide-react";

interface AccountingReconProps {
  state: DMSState;
  onUpdateVehicle: (id: string, updates: Partial<Vehicle>) => Promise<void>;
  onAddExpense: (expense: Partial<Expense>) => Promise<void>;
  onReconcileExpense: (id: string, reconciled: boolean) => Promise<void>;
}

export default function AccountingRecon({ state, onUpdateVehicle, onAddExpense, onReconcileExpense }: AccountingReconProps) {
  const [activeTab, setActiveTab] = useState<"pl" | "recon">("pl");

  const [expenseForm, setExpenseForm] = useState({
    description: "",
    amount: "",
    category: "Operations",
    date: new Date().toISOString().slice(0, 10),
    referenceId: "",
  });

  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(
    state.properties.length > 0 ? state.properties[0].id : ""
  );

  const [reconForm, setReconForm] = useState({
    name: "",
    cost: "",
    status: "Pending" as "Pending" | "In Progress" | "Completed"
  });

  const formatZAR = (num: number) => {
    return "R " + Math.round(num).toLocaleString("en-ZA");
  };

  // P&L calculations
  const soldVehicles = state.properties.filter((v) => v.status === "SOLD");
  const revenueFromSales = state.invoices
    .filter((inv) => inv.status === "Paid")
    .reduce((sum, inv) => sum + inv.amount, 0);

  const costOfSoldUnits = soldVehicles.reduce((sum, v) => sum + v.costPrice, 0);
  const reconOnSoldUnits = soldVehicles.reduce((sum, v) => {
    const tasks = v.maintenanceTasks || [];
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

    const targetVehicle = state.properties.find((v) => v.id === selectedVehicleId);
    if (!targetVehicle) return;

    const currentTasks = targetVehicle.maintenanceTasks || [];
    const newTask = {
      id: "rc_" + Date.now(),
      name: reconForm.name,
      cost: costAmt,
      status: reconForm.status,
      dateAdded: new Date().toISOString().slice(0, 10)
    };

    await onUpdateVehicle(selectedVehicleId, {
      maintenanceTasks: [...currentTasks, newTask]
    });

    setReconForm({ name: "", cost: "", status: "Pending" });
  };

  const toggleReconTaskStatus = async (propertyId: string, taskId: string, newStatus: "Pending" | "In Progress" | "Completed") => {
    const v = state.properties.find((item) => item.id === propertyId);
    if (!v) return;

    const updatedTasks = (v.maintenanceTasks || []).map((t) =>
      t.id === taskId ? { ...t, status: newStatus } : t
    );

    await onUpdateVehicle(propertyId, { maintenanceTasks: updatedTasks });
  };

  const selectedVehicle = state.properties.find((v) => v.id === selectedVehicleId);
  const maintenanceTasks = selectedVehicle?.maintenanceTasks || [];
  const totalReconSpent = maintenanceTasks.reduce((sum, t) => sum + t.cost, 0);

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
            onClick={() => setActiveTab("recon")}
            className={`px-4 py-2 text-[13px] font-semibold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "recon" ? "bg-[color:var(--cyan)] text-[color:var(--ink)]" : "text-[rgba(232,234,230,0.72)] hover:text-[color:var(--white)]"
            }`}
          >
            <Wrench size={13} />
            Reconditioning
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

      {/* RECONDITIONING */}
      {activeTab === "recon" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
          <div className="card p-5 flex flex-col gap-4">
            <div>
              <h3 className="font-semibold text-[16px] text-[color:var(--white)]">Select Vehicle</h3>
              <p className="text-[13px] text-[rgba(232,234,230,0.72)] mt-0.5">Choose a vehicle to view or add recon tasks.</p>
            </div>

            <div className="flex flex-col gap-2 max-h-[450px] overflow-y-auto">
              {state.properties.map((v) => {
                const totalRecon = (v.maintenanceTasks || []).reduce((s, t) => s + t.cost, 0);
                const isSelected = v.id === selectedVehicleId;
                const completedTasks = (v.maintenanceTasks || []).filter(t => t.status === 'Completed').length;
                const totalTasksCount = (v.maintenanceTasks || []).length;

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
                      {maintenanceTasks.map((task) => (
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

                      {maintenanceTasks.length === 0 && (
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
                No properties in inventory.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
