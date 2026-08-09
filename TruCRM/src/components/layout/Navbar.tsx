import React, { useState } from 'react';
import {
  Bell,
  Search,
  Plus,
  Briefcase,
  FilePlus,
  Receipt,
  Trash2,
  ChevronDown,
  Settings,
  Menu,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useNotifications } from '../../context/NotificationContext';
import truMark from '../../assets/brand/tru-mark.png';

export const Navbar: React.FC<{ onMenuClick?: () => void }> = ({ onMenuClick }) => {
  const {
    profile,
    setActiveView,
  } = useApp();
  const { notifications, markAsRead, clearNotifications, unreadCount } = useNotifications();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <header className="h-16 border-b border-[rgba(10,20,32,0.08)] bg-white sticky top-0 z-30 px-4 md:px-6 flex items-center justify-between shadow-sm">
      {/* Mobile menu button */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 text-[#6B7685] hover:bg-[#F5F4F1] rounded-lg transition-colors"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Search Bar */}
      <div className="flex items-center gap-3 flex-1 max-w-md">
        <div className="relative w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#0E9D98]" />
          <input
            type="text"
            placeholder="Search deals, invoices, or contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-[rgba(10,20,32,0.10)] bg-[#F5F4F1] text-[#1A2332] placeholder-[rgba(10,20,32,0.40)] focus:outline-hidden focus:ring-2 focus:ring-[rgba(14,157,152,0.20)] focus:border-[rgba(14,157,152,0.30)] transition-all"
          />
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* Quick Create Dropdown */}
        <div className="relative">
          <button
            id="btn-quick-create"
            onClick={() => setShowQuickCreate(!showQuickCreate)}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#0E9D98] text-white rounded-lg text-sm font-bold hover:bg-[#0B8A85] transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4 text-white" />
            <span className="hidden sm:inline">Create</span>
            <ChevronDown className="w-3.5 h-3.5 opacity-70" />
          </button>

          {showQuickCreate && (
            <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-lg border border-[rgba(10,20,32,0.10)] py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-3 py-1.5 text-xs font-semibold text-[rgba(10,20,32,0.40)] uppercase tracking-wider">
                Quick Actions
              </div>
              <button
                onClick={() => {
                  setShowQuickCreate(false);
                  setActiveView('trucrm');
                }}
                className="w-full text-left px-3.5 py-2 text-sm text-[#334155] hover:bg-[#F5F4F1] hover:text-[#1A2332] flex items-center gap-2.5 transition-colors"
              >
                <Briefcase className="w-4 h-4 text-[#0E9D98]" />
                <span>New Lead</span>
              </button>
              <button
                onClick={() => {
                  setShowQuickCreate(false);
                  setActiveView('accounting');
                }}
                className="w-full text-left px-3.5 py-2 text-sm text-[#334155] hover:bg-[#F5F4F1] hover:text-[#1A2332] flex items-center gap-2.5 transition-colors"
              >
                <FilePlus className="w-4 h-4 text-[#0E9D98]" />
                <span>Issue Invoice</span>
              </button>
              <button
                onClick={() => {
                  setShowQuickCreate(false);
                  setActiveView('accounting');
                }}
                className="w-full text-left px-3.5 py-2 text-sm text-[#334155] hover:bg-[#F5F4F1] hover:text-[#1A2332] flex items-center gap-2.5 transition-colors"
              >
                <Receipt className="w-4 h-4 text-[#0E9D98]" />
                <span>Scan Receipt Document</span>
              </button>
            </div>
          )}
        </div>

        {/* Notifications Bell */}
        <div className="relative">
          <button
            id="btn-notifications"
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 text-[#6B7685] hover:bg-[#F5F4F1] rounded-lg relative transition-colors"
            title="Notifications"
          >
            <Bell className="w-5 h-5 text-[#0E9D98]" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-[#0E9D98] rounded-full ring-2 ring-white animate-pulse" />
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-lg border border-[rgba(10,20,32,0.10)] z-50 overflow-hidden">
              <div className="px-4 py-3 bg-[#FAFAF8] border-b border-[rgba(10,20,32,0.08)] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-[#1A2332]">Alerts & Automation Feed</h4>
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 bg-[rgba(14,157,152,0.08)] text-[#0E9D98] border border-[rgba(14,157,152,0.20)] rounded-full text-xs font-semibold">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                <button
                  onClick={clearNotifications}
                  className="text-xs text-[rgba(10,20,32,0.45)] hover:text-[#1A2332] flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5 text-[#0E9D98]" />
                  Clear all
                </button>
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-[rgba(10,20,32,0.06)]">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-[rgba(10,20,32,0.40)] text-sm">
                    No active notifications
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => markAsRead(n.id)}
                      className={`p-3.5 hover:bg-[#F5F4F1] transition-colors cursor-pointer flex gap-3 items-start ${
                        !n.read ? 'bg-[rgba(14,157,152,0.03)]' : ''
                      }`}
                    >
                      <div
                        className="w-2 h-2 rounded-full mt-1.5 shrink-0 bg-[#0E9D98]"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-[#1A2332] truncate">{n.title}</p>
                          <span className="text-[10px] text-[rgba(10,20,32,0.40)] shrink-0">{n.timestamp}</span>
                        </div>
                        <p className="text-xs text-[rgba(10,20,32,0.55)] mt-0.5 line-clamp-2">{n.message}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User / Profile Avatar */}
        <div
          onClick={() => setActiveView('settings')}
          className="flex items-center gap-2.5 pl-2 border-l border-[rgba(10,20,32,0.08)] cursor-pointer hover:opacity-90 transition-opacity"
        >
          <div className="w-8 h-8 rounded-lg bg-[#F5F4F1] border border-[rgba(10,20,32,0.10)] overflow-hidden shrink-0 shadow-sm">
            <img
              src={truMark}
              alt="TruSaaS"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      </div>
    </header>
  );
};
