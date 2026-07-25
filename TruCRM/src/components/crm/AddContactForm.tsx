import React, { useState } from 'react';
import {
  UserPlus,
  X,
  Building2,
  Mail,
  Phone,
  Briefcase,
  Sparkles,
  Check,
  Tag,
  DollarSign,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Contact } from '../../types';
import { useFormAutoSave } from '../../hooks/useFormAutoSave';

interface AddContactFormProps {
  onClose?: () => void;
  onSuccess?: (contactName: string) => void;
  isModal?: boolean;
}

export const AddContactForm: React.FC<AddContactFormProps> = ({
  onClose,
  onSuccess,
  isModal = true,
}) => {
  const { addContact, addDeal, addNotification } = useApp();

  // Form Fields with localStorage auto-save
  const [formData, setFormData, clearDraft, hasDraft, lastSaved] = useFormAutoSave('crm_contact_form', {
    name: '',
    company: '',
    role: 'Decision Maker',
    email: '',
    phone: '',
    status: 'Prospect' as Contact['status'],
    industry: 'SaaS / Technology',
    notes: '',
    createInitialDeal: false,
    dealTitle: '',
    dealValue: '25000',
  });

  const {
    name,
    company,
    role,
    email,
    phone,
    status,
    industry,
    notes,
    createInitialDeal,
    dealTitle,
    dealValue,
  } = formData;

  const updateField = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const setName = (val: string) => updateField('name', val);
  const setCompany = (val: string) => updateField('company', val);
  const setRole = (val: string) => updateField('role', val);
  const setEmail = (val: string) => updateField('email', val);
  const setPhone = (val: string) => updateField('phone', val);
  const setStatus = (val: any) => updateField('status', val);
  const setIndustry = (val: string) => updateField('industry', val);
  const setNotes = (val: string) => updateField('notes', val);
  const setCreateInitialDeal = (val: boolean) => updateField('createInitialDeal', val);
  const setDealTitle = (val: string) => updateField('dealTitle', val);
  const setDealValue = (val: string) => updateField('dealValue', val);

  // Error & Submission state
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = () => {
    const errs: { [key: string]: string } = {};
    if (!name.trim()) errs.name = 'Full name is required';
    if (!company.trim()) errs.company = 'Company name is required';
    if (!email.trim()) {
      errs.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = 'Please enter a valid email address';
    }
    if (createInitialDeal && !dealTitle.trim()) {
      errs.dealTitle = 'Deal title is required when auto-creating a deal';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);

    try {
      // 1. Add Contact to App State
      const formattedPhone = phone.trim() || '+1 (555) 019-2834';
      addContact({
        name: name.trim(),
        company: company.trim(),
        role: role.trim() || 'Executive Lead',
        email: email.trim(),
        phone: formattedPhone,
        status,
        lastContactDate: new Date().toISOString().split('T')[0],
      });

      // 2. Optionally Create Initial Deal
      if (createInitialDeal && dealTitle.trim()) {
        addDeal({
          title: dealTitle.trim(),
          company: company.trim(),
          contactName: name.trim(),
          contactEmail: email.trim(),
          value: parseFloat(dealValue) || 10000,
          stage: 'qualified',
          probability: 60,
          closeDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          healthScore: 88,
          notes: notes ? `Contact Notes: ${notes}` : undefined,
        });
      }

      // Clear draft on successful submission
      clearDraft();

      if (onSuccess) {
        onSuccess(name);
      }

      if (onClose) {
        onClose();
      }
    } catch (err) {
      console.error('Error adding contact:', err);
      addNotification('Error', 'Could not create contact record.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-5 text-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-950/80 border border-cyan-800/60 text-cyan-400 flex items-center justify-center shadow-md">
            <UserPlus className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-white tracking-tight">Add New Client Contact</h3>
              {lastSaved && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-800/60 text-emerald-400 text-[10px] font-semibold flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{lastSaved}</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">Save new customer contact details to the CRM database</p>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Main Form Fields */}
      <div className="space-y-4 text-xs">
        {/* Full Name & Role */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="font-semibold text-slate-300 block mb-1">
              Contact Full Name <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name) setErrors({ ...errors, name: '' });
                }}
                placeholder="e.g. Victoria Sterling"
                className={`w-full px-3.5 py-2.5 rounded-xl border bg-slate-950 text-slate-200 text-sm focus:outline-hidden focus:ring-2 ${
                  errors.name
                    ? 'border-rose-500 focus:ring-rose-500/30'
                    : 'border-slate-800 focus:ring-cyan-500/30'
                }`}
              />
            </div>
            {errors.name && <p className="text-rose-400 text-[11px] mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.name}</p>}
          </div>

          <div>
            <label className="font-semibold text-slate-300 block mb-1">
              Job Title / Role
            </label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. VP of Global Engineering"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-cyan-500/30"
            />
          </div>
        </div>

        {/* Company & Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="font-semibold text-slate-300 block mb-1">
              Company Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={company}
              onChange={(e) => {
                setCompany(e.target.value);
                if (errors.company) setErrors({ ...errors, company: '' });
                if (!dealTitle && e.target.value) {
                  setDealTitle(`${e.target.value} Enterprise Deal`);
                }
              }}
              placeholder="e.g. Zenith Analytics Corp"
              className={`w-full px-3.5 py-2.5 rounded-xl border bg-slate-950 text-slate-200 text-sm focus:outline-hidden focus:ring-2 ${
                errors.company
                  ? 'border-rose-500 focus:ring-rose-500/30'
                  : 'border-slate-800 focus:ring-cyan-500/30'
              }`}
            />
            {errors.company && <p className="text-rose-400 text-[11px] mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.company}</p>}
          </div>

          <div>
            <label className="font-semibold text-slate-300 block mb-1">
              Contact Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-cyan-500/30"
            >
              <option value="Prospect">Prospect</option>
              <option value="Lead">Sales Lead</option>
              <option value="Customer">Active Customer</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>

        {/* Email & Phone */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="font-semibold text-slate-300 block mb-1">
              Email Address <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors({ ...errors, email: '' });
                }}
                placeholder="victoria@zenith.com"
                className={`w-full px-3.5 py-2.5 rounded-xl border bg-slate-950 text-slate-200 text-sm focus:outline-hidden focus:ring-2 ${
                  errors.email
                    ? 'border-rose-500 focus:ring-rose-500/30'
                    : 'border-slate-800 focus:ring-cyan-500/30'
                }`}
              />
            </div>
            {errors.email && <p className="text-rose-400 text-[11px] mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.email}</p>}
          </div>

          <div>
            <label className="font-semibold text-slate-300 block mb-1">
              Phone Number
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 (555) 849-2011"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-cyan-500/30 font-mono"
            />
          </div>
        </div>

        {/* Industry Sector & Notes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="font-semibold text-slate-300 block mb-1">
              Industry Sector
            </label>
            <select
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-cyan-500/30"
            >
              <option value="SaaS / Technology">SaaS / Technology</option>
              <option value="Financial Services">Financial Services</option>
              <option value="Healthcare & Biotech">Healthcare & Biotech</option>
              <option value="Enterprise Retail">Enterprise Retail</option>
              <option value="Media & Logistics">Media & Logistics</option>
            </select>
          </div>

          <div>
            <label className="font-semibold text-slate-300 block mb-1">
              Background Notes / Tags
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Met at Tech Summit, decision maker for Q4 budget..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-cyan-500/30"
            />
          </div>
        </div>

        {/* Auto-create initial deal toggle */}
        <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800/80 space-y-3">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={createInitialDeal}
              onChange={(e) => setCreateInitialDeal(e.target.checked)}
              className="w-4 h-4 rounded-md border-slate-700 bg-slate-900 text-cyan-600 focus:ring-cyan-500/30"
            />
            <span className="font-semibold text-slate-200 text-xs flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Auto-create an initial pipeline deal for this contact
            </span>
          </label>

          {createInitialDeal && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-900">
              <div>
                <label className="font-semibold text-slate-400 block mb-1">Deal Title *</label>
                <input
                  type="text"
                  value={dealTitle}
                  onChange={(e) => setDealTitle(e.target.value)}
                  placeholder="e.g. Zenith Analytics Platform Deal"
                  className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-slate-900 text-slate-200 text-xs focus:ring-2 focus:ring-cyan-500/30"
                />
                {errors.dealTitle && <p className="text-rose-400 text-[10px] mt-0.5">{errors.dealTitle}</p>}
              </div>

              <div>
                <label className="font-semibold text-slate-400 block mb-1">Estimated Value ($)</label>
                <input
                  type="number"
                  value={dealValue}
                  onChange={(e) => setDealValue(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-slate-900 text-slate-200 text-xs font-mono"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-5 py-2.5 bg-white text-black hover:bg-white/90 text-xs font-bold rounded-xl shadow-md shadow-white/5 flex items-center gap-2 transition-all disabled:opacity-50"
        >
          <UserPlus className="w-4 h-4" />
          <span>{isSubmitting ? 'Saving Contact...' : 'Save Client Contact'}</span>
        </button>
      </div>
    </form>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
        <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 w-full max-w-lg p-6 sm:p-8 my-8 animate-in fade-in zoom-in-95 duration-150">
          {formContent}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 shadow-xl backdrop-blur-md">
      {formContent}
    </div>
  );
};
