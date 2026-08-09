import React, { createContext, useContext, useState, useEffect } from 'react';
import { socket } from '../lib/socket';
import {
  Deal,
  Contact,
  Transaction,
  Invoice,
  WorkflowRule,
  BusinessProfile,
  StageId,
  InvoiceStatus,
  Proposal,
  ProposalStatus,
  SlaContract,
} from '../types';
import {
  initialDeals,
  initialContacts,
  initialTransactions,
  initialInvoices,
  initialWorkflowRules,
  initialProfile,
  initialProposals,
  initialSlaContracts,
} from '../data/mockData';

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
}

interface AppContextType {
  // Navigation & UI State
  activeView: string;
  setActiveView: (view: string) => void;
  notifications: NotificationItem[];
  markNotificationRead: (id: string) => void;
  clearNotifications: () => void;
  addNotification: (title: string, description: string, type?: 'info' | 'success' | 'warning' | 'error') => void;

  // Profile
  profile: BusinessProfile;
  updateProfile: (updated: Partial<BusinessProfile>) => void;

  // CRM Suite
  deals: Deal[];
  contacts: Contact[];
  addDeal: (deal: Omit<Deal, 'id' | 'createdAt'>) => Deal;
  updateDealStage: (dealId: string, newStage: StageId) => void;
  updateDeal: (deal: Deal) => void;
  deleteDeal: (dealId: string) => void;
  addContact: (contact: Omit<Contact, 'id' | 'totalSpent' | 'dealsCount'>) => void;
  deleteContact: (contactId: string) => void;

  // Accounting Suite
  transactions: Transaction[];
  invoices: Invoice[];
  addTransaction: (tx: Omit<Transaction, 'id'>) => void;
  addInvoice: (inv: Omit<Invoice, 'id' | 'invoiceNumber'>) => Invoice;
  updateInvoice: (inv: Invoice) => void;
  updateInvoiceStatus: (id: string, status: InvoiceStatus) => void;
  
  // Automated Workflows
  workflowRules: WorkflowRule[];
  toggleWorkflowRule: (id: string) => void;
  addWorkflowRule: (rule: Omit<WorkflowRule, 'id'>) => void;

  // Proposals & SLAs Suite
  proposals: Proposal[];
  addProposal: (proposal: Omit<Proposal, 'id' | 'proposalNumber' | 'createdDate'>) => Proposal;
  updateProposal: (proposal: Proposal) => void;
  deleteProposal: (id: string) => void;
  sendProposal: (id: string) => void;
  acceptProposal: (id: string) => void;

  slaContracts: SlaContract[];
  addSlaContract: (sla: Omit<SlaContract, 'id' | 'startDate'>) => void;
  updateSlaContract: (sla: SlaContract) => void;
  deleteSlaContract: (id: string) => void;

  // Computed Financial Summary
  getFinancialSummary: () => {
    totalRevenue: number;
    totalExpenses: number;
    netProfit: number;
    mrr: number;
    arr: number;
    pendingInvoicesAmount: number;
    pipelineValue: number;
    cashBalance: number;
  };

  // State Reset
  resetToSampleData: () => void;
  deleteAllData: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'trusaas_app_state_v2';

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeView, setActiveView] = useState<string>('trucrm');

  // Load from local storage or fallback to mock data
  const [profile, setProfile] = useState<BusinessProfile>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_profile`);
    return saved ? JSON.parse(saved) : initialProfile;
  });

  const [deals, setDeals] = useState<Deal[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_deals`);
    return saved ? JSON.parse(saved) : initialDeals;
  });

  const [contacts, setContacts] = useState<Contact[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_contacts`);
    return saved ? JSON.parse(saved) : initialContacts;
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_transactions`);
    return saved ? JSON.parse(saved) : initialTransactions;
  });

  const [invoices, setInvoices] = useState<Invoice[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_invoices`);
    return saved ? JSON.parse(saved) : initialInvoices;
  });

  const [workflowRules, setWorkflowRules] = useState<WorkflowRule[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_workflows`);
    return saved ? JSON.parse(saved) : initialWorkflowRules;
  });

  const [proposals, setProposals] = useState<Proposal[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_proposals`);
    return saved ? JSON.parse(saved) : initialProposals;
  });

  const [slaContracts, setSlaContracts] = useState<SlaContract[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_slas`);
    return saved ? JSON.parse(saved) : initialSlaContracts;
  });

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // Sync to local storage
  useEffect(() => {
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_profile`, JSON.stringify(profile));
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_deals`, JSON.stringify(deals));
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_contacts`, JSON.stringify(contacts));
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_transactions`, JSON.stringify(transactions));
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_invoices`, JSON.stringify(invoices));
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_workflows`, JSON.stringify(workflowRules));
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_proposals`, JSON.stringify(proposals));
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_slas`, JSON.stringify(slaContracts));
  }, [profile, deals, contacts, transactions, invoices, workflowRules, proposals, slaContracts]);

  // Helper notification adder
  const addNotification = (title: string, description: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const newNotif: NotificationItem = {
      id: `notif-${Date.now()}`,
      title,
      description,
      timestamp: 'Just now',
      type,
      read: false,
    };
    setNotifications((prev) => [newNotif, ...prev]);
    socket.emit('notification', {
        id: newNotif.id,
        title: newNotif.title,
        message: newNotif.description,
        timestamp: newNotif.timestamp,
        type: newNotif.type,
        read: newNotif.read
    });
  };

  const markNotificationRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  const updateProfile = (updated: Partial<BusinessProfile>) => {
    setProfile((prev) => ({ ...prev, ...updated }));
  };

  // CRM Actions
  const addDeal = (dealData: Omit<Deal, 'id' | 'createdAt'>) => {
    const newDeal: Deal = {
      ...dealData,
      id: `deal-${Date.now()}`,
      createdAt: new Date().toISOString().split('T')[0],
    };
    setDeals((prev) => [newDeal, ...prev]);
    addNotification('New CRM Deal Created', `Created deal "${newDeal.title}" worth $${newDeal.value.toLocaleString()}`, 'info');
    return newDeal;
  };

  const updateDealStage = (dealId: string, newStage: StageId) => {
    setDeals((prev) =>
      prev.map((d) => {
        if (d.id === dealId) {
          const oldStage = d.stage;
          const updated = { ...d, stage: newStage };

          // Cross-Suite Automation Rule: If deal moved to 'won'
          if (newStage === 'won' && oldStage !== 'won') {
            triggerDealWonAutomation(updated);
            addNotification('Deal Won!', `Deal "${updated.title}" has been closed won.`, 'success');
          }
          return updated;
        }
        return d;
      })
    );
  };

  const updateDeal = (updatedDeal: Deal) => {
    setDeals((prev) => prev.map((d) => (d.id === updatedDeal.id ? updatedDeal : d)));
  };

  const deleteDeal = (dealId: string) => {
    setDeals((prev) => prev.filter((d) => d.id !== dealId));
    addNotification('Deal Deleted', `Deal was removed from CRM pipeline.`, 'warning');
  };

  const addContact = (contactData: Omit<Contact, 'id' | 'totalSpent' | 'dealsCount'>) => {
    const newContact: Contact = {
      ...contactData,
      id: `cnt-${Date.now()}`,
      totalSpent: 0,
      dealsCount: 0,
    };
    setContacts((prev) => [newContact, ...prev]);
    addNotification('New Contact Added', `Added ${newContact.name} (${newContact.company})`, 'info');
  };

  const deleteContact = (contactId: string) => {
    const targetContact = contacts.find((c) => c.id === contactId);
    setContacts((prev) => prev.filter((c) => c.id !== contactId));
    addNotification(
      'Contact Deleted',
      targetContact ? `Removed contact ${targetContact.name} (${targetContact.company})` : 'Contact deleted from CRM.',
      'warning'
    );
  };

  // Cross-Suite Automated Rule Engine Trigger
  const triggerDealWonAutomation = (wonDeal: Deal) => {
    const rule2 = workflowRules.find((r) => r.id === 'wf-2' && r.enabled);
    if (rule2) {
      // 2. Auto-create 50% deposit draft invoice in Accounting
      const depositAmount = wonDeal.value * 0.5;
      const invNum = `INV-2026-${Math.floor(100 + Math.random() * 900)}`;
      const newInvoice: Invoice = {
        id: `inv-auto-${Date.now()}`,
        invoiceNumber: invNum,
        clientName: wonDeal.company,
        clientEmail: wonDeal.contactEmail,
        amount: depositAmount,
        status: 'Draft',
        issueDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        taxRate: profile.taxRate,
        notes: `50% Deposit Invoice auto-generated on deal win for "${wonDeal.title}".`,
        items: [
          {
            id: `item-1-${Date.now()}`,
            description: `Deposit (50%) - ${wonDeal.title}`,
            quantity: 1,
            unitPrice: depositAmount,
            amount: depositAmount,
          },
        ],
      };
      setInvoices((prev) => [newInvoice, ...prev]);

      addNotification(
        '⚡ Workflow Triggered: Draft Deposit Invoice Generated',
        `Draft invoice ${invNum} for $${depositAmount.toLocaleString()} created in Accounting!`,
        'success'
      );
    }
  };

  // Accounting Actions
  const addTransaction = (txData: Omit<Transaction, 'id'>) => {
    const newTx: Transaction = {
      ...txData,
      id: `tx-${Date.now()}`,
    };
    setTransactions((prev) => [newTx, ...prev]);

    // If it's income, trigger workflow check
    addNotification(
      'Transaction Logged',
      `${newTx.type === 'Income' ? '+' : '-'}$${newTx.amount.toLocaleString()} logged under ${newTx.category}`,
      newTx.type === 'Income' ? 'success' : 'info'
    );
  };

  const addInvoice = (invData: Omit<Invoice, 'id' | 'invoiceNumber'>) => {
    const newInvoice: Invoice = {
      ...invData,
      id: `inv-${Date.now()}`,
      invoiceNumber: `INV-2026-${Math.floor(100 + Math.random() * 900)}`,
    };
    setInvoices((prev) => [newInvoice, ...prev]);
    addNotification('Invoice Issued', `Invoice ${newInvoice.invoiceNumber} ($${newInvoice.amount.toLocaleString()}) created.`, 'info');
    return newInvoice;
  };

  const updateInvoice = (updated: Invoice) => {
    setInvoices((prev) => prev.map((inv) => (inv.id === updated.id ? updated : inv)));
  };

  const updateInvoiceStatus = (id: string, status: InvoiceStatus) => {
    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id === id) {
          const updated = { ...inv, status };
          if (status === 'Paid') {
            // Auto-create income transaction
            addTransaction({
              type: 'Income',
              category: 'Client Invoices',
              amount: inv.amount,
              vendorOrClient: inv.clientName,
              date: new Date().toISOString().split('T')[0],
              status: 'Reconciled',
              paymentMethod: 'Invoice Payment',
              notes: `Payment for Invoice ${inv.invoiceNumber}`,
              taxDeductible: false,
            });
            addNotification('Invoice Marked Paid', `Recorded $${inv.amount.toLocaleString()} revenue in accounting ledger.`, 'success');
          }
          return updated;
        }
        return inv;
      })
    );
  };

  // Workflows
  const toggleWorkflowRule = (id: string) => {
    setWorkflowRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    );
  };

  const addWorkflowRule = (ruleData: Omit<WorkflowRule, 'id'>) => {
    const newRule: WorkflowRule = {
      ...ruleData,
      id: `wf-${Date.now()}`,
    };
    setWorkflowRules((prev) => [...prev, newRule]);
    addNotification('Workflow Created', `Automation rule "${newRule.name}" active.`, 'success');
  };

  // Proposals & SLAs Handlers
  const addProposal = (propData: Omit<Proposal, 'id' | 'proposalNumber' | 'createdDate'>) => {
    const count = proposals.length + 1;
    const year = new Date().getFullYear();
    const proposalNumber = `PROP-${year}-${String(count).padStart(3, '0')}`;
    const createdDate = new Date().toISOString().split('T')[0];

    const newProposal: Proposal = {
      ...propData,
      id: `prop-${Date.now()}`,
      proposalNumber,
      createdDate,
      signatureStatus: 'Unsigned',
    };

    setProposals((prev) => [newProposal, ...prev]);
    addNotification(
      'Proposal Created',
      `Proposal ${proposalNumber} generated for ${newProposal.company} ($${newProposal.amount.toLocaleString()}).`,
      'success'
    );
    return newProposal;
  };

  const updateProposal = (updatedProp: Proposal) => {
    setProposals((prev) => prev.map((p) => (p.id === updatedProp.id ? updatedProp : p)));
    addNotification('Proposal Updated', `Updated proposal ${updatedProp.proposalNumber}.`, 'info');
  };

  const deleteProposal = (id: string) => {
    const target = proposals.find((p) => p.id === id);
    setProposals((prev) => prev.filter((p) => p.id !== id));
    addNotification(
      'Proposal Deleted',
      target ? `Deleted proposal ${target.proposalNumber} (${target.company}).` : 'Proposal deleted.',
      'warning'
    );
  };

  const sendProposal = (id: string) => {
    const prop = proposals.find((p) => p.id === id);
    setProposals((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          const updated = { ...p, status: 'Sent' as const };
          if (prop) {
            window.open(
              `mailto:${encodeURIComponent(prop.clientEmail)}?subject=${encodeURIComponent(
                `Proposal ${prop.proposalNumber} — ${prop.title}`
              )}&body=${encodeURIComponent(
                `Hi ${prop.clientName},\n\nPlease find attached proposal ${prop.proposalNumber} (${prop.title}) from ${profile.companyName}.\n\n` +
                  `Proposal total: ${profile.currency}${prop.amount.toLocaleString()} (incl. ${profile.taxRate}% VAT)\n` +
                  `Valid until: ${prop.validUntil}\n\n${prop.scopeSummary}\n\n` +
                  `To attach the branded PDF: open Quotes & SLAs in the CRM, use Export Doc on this proposal, then Print → Save as PDF.\n\nBest regards,\n${profile.companyName}`
              )}`,
              '_blank'
            );
          }
          addNotification(
            'Proposal Sent to Client',
            `Opened your mail client for ${prop?.clientEmail || 'the client'} with proposal ${p.proposalNumber}.`,
            'info'
          );
          return updated;
        }
        return p;
      })
    );
  };

  const acceptProposal = (id: string) => {
    setProposals((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          const updatedDate = new Date().toISOString().split('T')[0];
          const updated: Proposal = {
            ...p,
            status: 'Accepted' as const,
            signatureStatus: 'Signed' as const,
            signedDate: updatedDate,
          };

          // Auto-update linked CRM Deal or create Won Deal if linked
          if (p.dealId) {
            setDeals((currentDeals) =>
              currentDeals.map((d) => (d.id === p.dealId ? { ...d, stage: 'won', probability: 100 } : d))
            );
          }

          // Also trigger automated rule check or notification
          addNotification(
            'Proposal Accepted & Signed!',
            `Proposal ${p.proposalNumber} accepted by ${p.company} ($${p.amount.toLocaleString()}).`,
            'success'
          );
          return updated;
        }
        return p;
      })
    );
  };

  const addSlaContract = (slaData: Omit<SlaContract, 'id' | 'startDate'>) => {
    const startDate = new Date().toISOString().split('T')[0];
    const newSla: SlaContract = {
      ...slaData,
      id: `sla-${Date.now()}`,
      startDate,
      incidents: slaData.incidents || [],
    };
    setSlaContracts((prev) => [newSla, ...prev]);
    addNotification('SLA Agreement Activated', `Activated ${newSla.tier} SLA for ${newSla.company}.`, 'success');
  };

  const updateSlaContract = (updatedSla: SlaContract) => {
    setSlaContracts((prev) => prev.map((s) => (s.id === updatedSla.id ? updatedSla : s)));
    addNotification('SLA Updated', `Updated SLA terms for ${updatedSla.company}.`, 'info');
  };

  const deleteSlaContract = (id: string) => {
    const target = slaContracts.find((s) => s.id === id);
    setSlaContracts((prev) => prev.filter((s) => s.id !== id));
    addNotification(
      'SLA Contract Removed',
      target ? `Removed SLA contract for ${target.company}.` : 'SLA removed.',
      'warning'
    );
  };

  // Computed Totals
  const getFinancialSummary = () => {
    const totalRevenue = transactions
      .filter((t) => t.type === 'Income')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpenses = transactions
      .filter((t) => t.type === 'Expense')
      .reduce((sum, t) => sum + t.amount, 0);

    const netProfit = totalRevenue - totalExpenses;

    const mrr = deals
      .filter((d) => d.stage === 'won')
      .reduce((sum, d) => sum + Math.round(d.value / 12), 0);

    const arr = mrr * 12;

    const pendingInvoicesAmount = invoices
      .filter((i) => i.status === 'Pending' || i.status === 'Overdue')
      .reduce((sum, i) => sum + i.amount, 0);

    const pipelineValue = deals
      .filter((d) => d.stage !== 'won' && d.stage !== 'lost')
      .reduce((sum, d) => sum + d.value, 0);

    const cashBalance = 124500 + netProfit;

    return {
      totalRevenue,
      totalExpenses,
      netProfit,
      mrr,
      arr,
      pendingInvoicesAmount,
      pipelineValue,
      cashBalance,
    };
  };

  const resetToSampleData = () => {
    localStorage.clear();
    setProfile(initialProfile);
    setDeals(initialDeals);
    setContacts(initialContacts);
    setTransactions(initialTransactions);
    setInvoices(initialInvoices);
    setWorkflowRules(initialWorkflowRules);
    setProposals(initialProposals);
    setSlaContracts(initialSlaContracts);
    addNotification('System Reset', 'Started a fresh TruSaaS workspace.', 'info');
  };

  const deleteAllData = () => {
    localStorage.clear();
    setDeals([]);
    setContacts([]);
    setTransactions([]);
    setInvoices([]);
    setWorkflowRules([]);
    setProposals([]);
    setSlaContracts([]);
    addNotification('All Data Deleted', 'Successfully purged all contacts, deals, proposals, and SLAs.', 'warning');
  };

  return (
    <AppContext.Provider
      value={{
        activeView,
        setActiveView,
        notifications,
        markNotificationRead,
        clearNotifications,
        addNotification,
        profile,
        updateProfile,
        deals,
        contacts,
        addDeal,
        updateDealStage,
        updateDeal,
        deleteDeal,
        addContact,
        deleteContact,
        transactions,
        invoices,
        addTransaction,
        addInvoice,
        updateInvoice,
        updateInvoiceStatus,
        workflowRules,
        toggleWorkflowRule,
        addWorkflowRule,
        proposals,
        addProposal,
        updateProposal,
        deleteProposal,
        sendProposal,
        acceptProposal,
        slaContracts,
        addSlaContract,
        updateSlaContract,
        deleteSlaContract,
        getFinancialSummary,
        resetToSampleData,
        deleteAllData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
