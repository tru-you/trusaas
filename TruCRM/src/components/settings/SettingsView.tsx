import React, { useState } from 'react';
import {
  Settings,
  Building2,
  DollarSign,
  Download,
  RotateCcw,
  Check,
  ShieldCheck,
  Zap,
  Image as ImageIcon,
  Sparkles,
  Upload,
  Trash2,
  LogOut,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useRemoveBg } from '../../hooks/useRemoveBg';
import defaultLogo from '../../assets/images/truesaas_logo_1784747570605.jpg';
import tsMark from '../../assets/brand/ts-mark.png';
import wordmark from '../../assets/brand/trusaas-wordmark.png';

export const SettingsView: React.FC = () => {
  const { profile, updateProfile, resetToSampleData, deleteAllData, addNotification } = useApp();

  const [companyName, setCompanyName] = useState(profile.companyName);
  const [tagline, setTagline] = useState(profile.tagline);
  const [currency, setCurrency] = useState(profile.currency);
  const [taxRate, setTaxRate] = useState(profile.taxRate.toString());
  const [customLogoUrl, setCustomLogoUrl] = useState(profile.logoUrl || '');
  const [email, setEmail] = useState(profile.email);
  const [phone, setPhone] = useState(profile.phone || '');
  const [address, setAddress] = useState(profile.address || '');
  const [regNumber, setRegNumber] = useState(profile.regNumber || '');
  const [bankName, setBankName] = useState(profile.bank?.bankName || '');
  const [accountName, setAccountName] = useState(profile.bank?.accountName || '');
  const [accountNumber, setAccountNumber] = useState(profile.bank?.accountNumber || '');
  const [branchCode, setBranchCode] = useState(profile.bank?.branchCode || '');
  const [swift, setSwift] = useState(profile.bank?.swift || '');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile({
      companyName,
      tagline,
      currency,
      taxRate: Number(taxRate) || 8.5,
      email,
      phone,
      address,
      regNumber,
      bank: {
        bankName,
        accountName,
        accountNumber,
        branchCode,
        swift,
      },
      logoUrl: customLogoUrl.trim() || undefined,
    });
    setSavedSuccess(true);
    addNotification('Branding & Settings Saved', `Updated company branding and profile settings.`, 'success');
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleExportData = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(localStorage));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "truesaas_backup_data.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    addNotification('Export Complete', 'Exported TruSaaS workspace backup JSON.', 'info');
  };

  const activeLogo = customLogoUrl.trim() || defaultLogo;
  const tsMarkSrc = useRemoveBg(tsMark, 'light', 15);

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-5xl mx-auto bg-[#F5F4F1] text-[#1A2332]">
      {/* Header */}
      <div className="pb-4 border-b border-[rgba(10,20,32,0.08)]">
        <h1 className="text-2xl font-bold text-[#1A2332] tracking-tight flex items-center gap-2">
          <Settings className="w-6 h-6 text-[#0E9D98]" />
          Settings & Workspace Studio
        </h1>
        <p className="text-sm text-[#6B7685]">
          Customize your business logo, accounting tax rules, and workspace data backup.
        </p>
      </div>

      <form onSubmit={handleSaveProfile} className="space-y-6">
        {/* Logo & Visual Identity Card */}
        <div className="bg-white p-6 rounded-2xl border border-[rgba(10,20,32,0.08)] shadow-xl space-y-6 text-[#1A2332]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-[#334155]" />
              <h3 className="font-bold text-[#1A2332] text-base">Company Logo & Emblem</h3>
            </div>
            <span className="text-xs text-[#6B7685] bg-[#FAFAF8] px-2.5 py-1 rounded-lg border border-[rgba(10,20,32,0.08)]">
              High Resolution Asset
            </span>
          </div>

          <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="flex flex-col items-center gap-2 shrink-0">
              <div className="w-24 h-24 rounded-2xl bg-[#FAFAF8] border border-[rgba(10,20,32,0.10)]/80 p-2 shadow-2xl relative group overflow-hidden">
                <img
                  src={activeLogo}
                  alt="App Logo Preview"
                  className="w-full h-full object-cover rounded-xl"
                  referrerPolicy="no-referrer"
                />
              </div>
              <p className="text-[11px] text-[#6B7685] text-center font-medium">Current Active Logo</p>
            </div>

            <div className="flex-1 space-y-4 w-full">
              <div>
                <label className="text-xs font-semibold text-[#334155] block mb-1">
                  Logo Asset URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="https://example.com/logo.png or leave empty for default"
                    value={customLogoUrl}
                    onChange={(e) => setCustomLogoUrl(e.target.value)}
                    className="flex-1 px-3.5 py-2 rounded-xl border border-[rgba(10,20,32,0.08)] bg-[#FAFAF8] text-[#1A2332] text-sm placeholder-[rgba(10,20,32,0.40)] focus:outline-hidden focus:ring-2 focus:ring-[rgba(14,157,152,0.20)]"
                  />
                  {customLogoUrl && (
                    <button
                      type="button"
                      onClick={() => setCustomLogoUrl('')}
                      className="px-3 py-2 bg-[#EFEDE8] hover:bg-[#EFEDE8] text-xs font-semibold rounded-xl text-[#334155] transition-colors"
                    >
                      Reset to Default
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-[#6B7685] mt-1.5">
                  High contrast monochrome branding applied across all workspace reports.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Business Form */}
        <div className="bg-white p-6 rounded-2xl border border-[rgba(10,20,32,0.08)] shadow-xl space-y-6 text-[#1A2332]">
          <h3 className="font-bold text-[#1A2332] text-base">Business Configuration</h3>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-[#6B7685] block mb-1">Company / Workspace Name</label>
              <input
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[rgba(10,20,32,0.08)] bg-[#FAFAF8] text-[#1A2332] text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-[#6B7685] block mb-1">Tagline / Subtitle</label>
              <input
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[rgba(10,20,32,0.08)] bg-[#FAFAF8] text-[#1A2332] text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-[#6B7685] block mb-1">Currency Symbol</label>
                <input
                  type="text"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[rgba(10,20,32,0.08)] bg-[#FAFAF8] text-[#1A2332] text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#6B7685] block mb-1">Default Sales Tax Rate (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[rgba(10,20,32,0.08)] bg-[#FAFAF8] text-[#1A2332] text-sm"
                />
              </div>
            </div>
          </div>

          {/* Business Information */}
          <div className="pt-6 border-t border-[rgba(10,20,32,0.08)]">
            <h4 className="font-bold text-[#1A2332] text-sm mb-4 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#0E9D98]" />
              Business Information
            </h4>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-[#6B7685] block mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[rgba(10,20,32,0.08)] bg-[#FAFAF8] text-[#1A2332] text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#6B7685] block mb-1">Phone</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+27 00 000 0000"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[rgba(10,20,32,0.08)] bg-[#FAFAF8] text-[#1A2332] text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#6B7685] block mb-1">Address</label>
                <textarea
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street address&#10;City, Province, Postal code"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[rgba(10,20,32,0.08)] bg-[#FAFAF8] text-[#1A2332] text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#6B7685] block mb-1">Reg / VAT number</label>
                <input
                  type="text"
                  value={regNumber}
                  onChange={(e) => setRegNumber(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[rgba(10,20,32,0.08)] bg-[#FAFAF8] text-[#1A2332] text-sm"
                />
              </div>
            </div>
          </div>

          {/* Banking Details */}
          <div className="pt-6 border-t border-[rgba(10,20,32,0.08)]">
            <h4 className="font-bold text-[#1A2332] text-sm mb-4 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-[#0E9D98]" />
              Banking Details
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-[#6B7685] block mb-1">Bank Name</label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="e.g. Absa, FNB, Standard Bank"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[rgba(10,20,32,0.08)] bg-[#FAFAF8] text-[#1A2332] text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#6B7685] block mb-1">Account Name</label>
                <input
                  type="text"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[rgba(10,20,32,0.08)] bg-[#FAFAF8] text-[#1A2332] text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#6B7685] block mb-1">Account Number</label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[rgba(10,20,32,0.08)] bg-[#FAFAF8] text-[#1A2332] text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#6B7685] block mb-1">Branch Code</label>
                <input
                  type="text"
                  value={branchCode}
                  onChange={(e) => setBranchCode(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[rgba(10,20,32,0.08)] bg-[#FAFAF8] text-[#1A2332] text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#6B7685] block mb-1">SWIFT / BIC</label>
                <input
                  type="text"
                  value={swift}
                  onChange={(e) => setSwift(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[rgba(10,20,32,0.08)] bg-[#FAFAF8] text-[#1A2332] text-sm"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-[rgba(10,20,32,0.08)]">
            {savedSuccess && (
              <span className="text-xs text-[#334155] font-bold flex items-center gap-1">
                <Check className="w-4 h-4 text-[#1A2332]" /> Logo & Settings Saved!
              </span>
            )}

            <button
              type="submit"
              className="ml-auto px-6 py-2.5 bg-white text-black hover:bg-[#EFEDE8] rounded-xl text-xs font-bold shadow-lg transition-all flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-black" />
              Save Workspace Settings
            </button>
          </div>
        </div>
      </form>

      {/* TruSaaS Platform Assets */}
      <div className="bg-white p-6 rounded-2xl border border-[rgba(10,20,32,0.08)] shadow-xl">
        <div className="flex items-center gap-2 mb-5">
          <Zap className="w-4 h-4 text-[#0E9D98]" />
          <h3 className="font-bold text-[#1A2332] text-sm">TruSaaS Platform</h3>
          <span className="ml-auto text-[11px] text-[rgba(10,20,32,0.50)] bg-[#FAFAF8] px-2.5 py-1 rounded-lg border border-[rgba(10,20,32,0.08)]">
            Read-only
          </span>
        </div>
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-[#FAFAF8] ring-1 ring-[rgba(10,20,32,0.08)] overflow-hidden flex items-center justify-center shrink-0">
            <img
              src={tsMarkSrc}
              alt="TruSaaS mark"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <div className="overflow-hidden" style={{ height: '1.5rem' }}>
              <img
                src={wordmark}
                alt="TruSaaS"
                style={{ height: '2.4rem', width: 'auto' }}
                referrerPolicy="no-referrer"
              />
            </div>
            <p className="text-[11px] text-[rgba(10,20,32,0.50)] mt-1.5">Future Automotive · v2.5 Pro</p>
          </div>
        </div>
      </div>

      {/* Backup & Reset */}
      <div className="bg-white p-6 rounded-2xl border border-[rgba(10,20,32,0.08)] shadow-xl space-y-4">
        <h3 className="font-bold text-[#1A2332] text-base">Data Backup & Demo Reset</h3>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleExportData}
            className="px-4 py-2.5 bg-white hover:bg-[#F5F4F1] text-[#1A2332] border border-[rgba(10,20,32,0.10)] rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export Backup JSON
          </button>

          <button
            onClick={resetToSampleData}
            className="px-4 py-2.5 bg-white text-[#1A2332] border border-[rgba(10,20,32,0.10)] hover:bg-[#F5F4F1] rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Reset to Sample Demo Data
          </button>

          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="px-4 py-2.5 bg-white text-[#334155] border border-[rgba(10,20,32,0.10)] hover:bg-[#F5F4F1] rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors ml-auto"
          >
            <Trash2 className="w-4 h-4 text-[#6B7685]" />
            Delete All Data
          </button>

          <button
            onClick={() => {
              try {
                localStorage.removeItem('trusaas_demo_session_v1');
              } catch {
                // ignore
              }
              window.location.reload();
            }}
            className="px-4 py-2.5 bg-white text-[#334155] border border-[rgba(10,20,32,0.10)] hover:bg-[#F5F4F1] rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors"
          >
            <LogOut className="w-4 h-4 text-[#0E9D98]" />
            Sign Out
          </button>
        </div>
      </div>

      {/* Delete All Data Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-[rgba(10,20,32,0.40)] backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-[rgba(10,20,32,0.08)] w-full max-w-md p-6 space-y-5 text-[#1A2332] animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-950/80 border border-rose-800/60 text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#1A2332]">Delete All Workspace Data</h3>
                <p className="text-xs text-[#6B7685]">Permanently clear CRM & workspace records</p>
              </div>
            </div>

            <div className="p-3.5 bg-[#F5F4F1] rounded-xl border border-[rgba(10,20,32,0.08)]/80 text-xs text-[#334155] space-y-2">
              <p>
                Are you sure you want to <span className="font-bold text-rose-400">delete all data</span>?
              </p>
              <ul className="list-disc list-inside text-[#6B7685] space-y-1 pl-1">
                <li>All Client Contacts & Pipeline Deals</li>
                <li>All Project Tasks & Logged Hours</li>
                <li>All Invoices & Financial Transactions</li>
              </ul>
            </div>

            <p className="text-xs text-rose-400/90 font-medium">
              This operation will permanently purge local storage and reset all lists.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-[rgba(10,20,32,0.08)]">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 bg-[#EFEDE8] hover:bg-[#EFEDE8] text-[#334155] text-xs font-semibold rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteAllData();
                  setShowDeleteConfirm(false);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-md shadow-rose-600/20 transition-all flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirm Delete All</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
