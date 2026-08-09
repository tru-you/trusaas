import React, { useState } from 'react';
import {
  Workflow,
  Plus,
  Zap,
  ArrowRight,
  CheckCircle2,
  Clock,
  Briefcase,
  Calculator,
  Bell,
  Check,
  ShieldCheck,
  Play,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const WorkflowsSuite: React.FC = () => {
  const { workflowRules, toggleWorkflowRule, addWorkflowRule, addNotification } = useApp();

  const [showAddModal, setShowAddModal] = useState(false);
  const [ruleName, setRuleName] = useState('');
  const [triggerEvent, setTriggerEvent] = useState<'deal_won' | 'invoice_overdue' | 'receipt_scanned'>('deal_won');
  const [actionType, setActionType] = useState<'send_email' | 'flag_accounting' | 'create_invoice'>('create_invoice');

  const handleCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName) return;

    addWorkflowRule({
      name: ruleName,
      triggerEvent,
      triggerDescription: `When event "${triggerEvent.replace('_', ' ')}" occurs`,
      actionType,
      actionDescription: `Execute action "${actionType.replace('_', ' ')}" across TruSaaS modules`,
      enabled: true,
      lastTriggered: 'Never',
    });

    setRuleName('');
    setShowAddModal(false);
  };

  const testTriggerRule = (ruleName: string) => {
    addNotification('⚡ Manual Workflow Test Fired', `Executing automation sequence: "${ruleName}"`, 'success');
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto bg-[#F5F4F1] text-[#1A2332]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[rgba(10,20,32,0.08)]">
        <div>
          <h1 className="text-2xl font-bold text-[#1A2332] tracking-tight flex items-center gap-2">
            <Workflow className="w-6 h-6 text-[#0E9D98]" />
            Automated Cross-Suite Workflows
          </h1>
          <p className="text-sm text-[#6B7685]">
            Connect CRM sales milestones, invoice reconciliation, and receipt scanning with zero manual entry.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-white text-black hover:bg-[#F5F4F1] rounded-xl text-sm font-semibold flex items-center gap-2 shadow-md transition-colors"
        >
          <Plus className="w-4 h-4 text-cyan-600" />
          Create Automation Rule
        </button>
      </div>

      {/* Cross-App Visual Pipeline Flow Banner */}
      <div className="bg-[#FAFAF8] text-[#1A2332] p-6 rounded-2xl border border-[rgba(10,20,32,0.08)] shadow-xl space-y-4">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-[#0E9D98]" />
          <h3 className="font-bold text-sm text-[#1A2332]">Native Multi-App Orchestration Engine</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="p-4 bg-white rounded-xl border border-[rgba(10,20,32,0.08)] space-y-2">
            <div className="flex items-center gap-2 text-[#0E9D98] font-bold text-xs uppercase tracking-wider">
              <Briefcase className="w-4 h-4 text-[#0E9D98]" />
              1. CRM Sales Trigger
            </div>
            <p className="text-xs text-[#334155]">
              Deal stage changed to <strong className="text-[#1A2332]">"Closed Won"</strong> in pipeline board.
            </p>
          </div>

          <div className="p-4 bg-white rounded-xl border border-[rgba(10,20,32,0.08)] space-y-2 relative">
            <div className="flex items-center gap-2 text-[#0E9D98] font-bold text-xs uppercase tracking-wider">
              <Calculator className="w-4 h-4 text-[#0E9D98]" />
              2. Automated Accounting
            </div>
            <p className="text-xs text-[#334155]">
              Issues 50% deposit invoice & posts receivable entry to ledger.
            </p>
          </div>

          <div className="p-4 bg-white rounded-xl border border-[rgba(10,20,32,0.08)] space-y-2">
            <div className="flex items-center gap-2 text-[#0E9D98] font-bold text-xs uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4 text-[#0E9D98]" />
              3. CRM Follow-up
            </div>
            <p className="text-xs text-[#334155]">
              Flags the deal for follow-up and notifies the salesperson.
            </p>
          </div>
        </div>
      </div>

      {/* Rules List */}
      <div className="space-y-4">
        <h3 className="text-base font-bold text-[#1A2332]">Active Automation Rules ({workflowRules.length})</h3>

        <div className="grid grid-cols-1 gap-4">
          {workflowRules.map((rule) => (
            <div
              key={rule.id}
              className={`p-5 bg-white/80 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl backdrop-blur-md ${
                rule.enabled ? 'border-[rgba(10,20,32,0.08)]' : 'border-[rgba(10,20,32,0.08)]/40 opacity-50'
              }`}
            >
              <div className="space-y-1 max-w-xl">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-[#1A2332] text-base">{rule.name}</h4>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      rule.enabled
                        ? 'bg-emerald-50 text-emerald-400 border border-emerald-200'
                        : 'bg-[#EFEDE8] text-[rgba(10,20,32,0.50)]'
                    }`}
                  >
                    {rule.enabled ? 'Active' : 'Disabled'}
                  </span>
                </div>
                <p className="text-xs text-[#6B7685]">{rule.triggerDescription}</p>
                <p className="text-xs text-[#0E9D98] font-medium">⚡ Action: {rule.actionDescription}</p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={() => testTriggerRule(rule.name)}
                  className="px-3 py-1.5 bg-[#EFEDE8] hover:bg-[#EFEDE8] text-[#1A2332] rounded-lg text-xs font-semibold flex items-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5 text-[#0E9D98]" />
                  Test Fire
                </button>

                <button
                  onClick={() => toggleWorkflowRule(rule.id)}
                  className={`w-12 h-6 rounded-full transition-colors relative ${
                    rule.enabled ? 'bg-[#0E9D98]' : 'bg-[#EFEDE8]'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      rule.enabled ? 'right-1' : 'left-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Workflow Rule Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-[rgba(10,20,32,0.40)] backdrop-blur-md z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateRule} className="bg-white rounded-2xl shadow-2xl border border-[rgba(10,20,32,0.08)] w-full max-w-md p-6 space-y-4 text-[#1A2332]">
            <h3 className="text-lg font-bold text-[#1A2332]">Build Custom Automation Rule</h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-[#6B7685] block mb-1">Rule Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Auto-Notify Account Lead on Overdue Invoice"
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[rgba(10,20,32,0.08)] bg-[#FAFAF8] text-[#1A2332] text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#6B7685] block mb-1">When Event Triggers</label>
                <select
                  value={triggerEvent}
                  onChange={(e) => setTriggerEvent(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg border border-[rgba(10,20,32,0.08)] bg-[#FAFAF8] text-[#1A2332] text-sm"
                >
                  <option value="deal_won">CRM Deal Stage becomes "Won"</option>
                  <option value="invoice_overdue">Invoice passes Due Date without payment</option>
                  <option value="receipt_scanned">AI Receipt Document Scanned</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#6B7685] block mb-1">Then Execute Action</label>
                <select
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg border border-[rgba(10,20,32,0.08)] bg-[#FAFAF8] text-[#1A2332] text-sm"
                >
                  <option value="create_invoice">Generate draft Deposit Invoice in Accounting</option>
                  <option value="send_email">Send AI-generated email notification</option>
                  <option value="flag_accounting">Flag General Ledger entry & notify lead</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-[rgba(10,20,32,0.08)]">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-[#6B7685] hover:text-[#1A2332] text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-[#0E9D98] hover:bg-[#14B8A6] text-white rounded-xl text-xs font-semibold shadow-md shadow-[rgba(14,157,152,0.15)]"
              >
                Save Automation
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
