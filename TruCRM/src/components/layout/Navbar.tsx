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
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useNotifications } from '../../context/NotificationContext';
import truMark from '../../assets/brand/tru-mark.png';

export const Navbar: React.FC = () => {
  const {
    profile,
    setActiveView,
  } = useApp();
  const { notifications, markAsRead, clearNotifications, unreadCount } = useNotifications();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <header className="h-16 border-b border-zinc-800 bg-black sticky top-0 z-30 px-4 md:px-6 flex items-center justify-between shadow-lg">
      {/* Search Bar */}
      <div className="flex items-center gap-3 flex-1 max-w-md">
        <div className="relative w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-cyan-400" />
          <input
            type="text"
            placeholder="Search deals, invoices, or contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-200 placeholder-zinc-500 focus:outline-hidden focus:ring-2 focus:ring-zinc-700 focus:border-zinc-500 transition-all"
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
            className="flex items-center gap-1.5 px-3 py-2 bg-white text-black rounded-lg text-sm font-bold hover:bg-zinc-200 transition-colors shadow-md"
          >
            <Plus className="w-4 h-4 text-cyan-600" />
            <span className="hidden sm:inline">Create</span>
            <ChevronDown className="w-3.5 h-3.5 opacity-70" />
          </button>

          {showQuickCreate && (
            <div className="absolute right-0 mt-2 w-52 bg-black rounded-xl shadow-2xl border border-zinc-800 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-3 py-1.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Quick Actions
              </div>
              <button
                onClick={() => {
                  setShowQuickCreate(false);
                  setActiveView('trucrm');
                }}
                className="w-full text-left px-3.5 py-2 text-sm text-zinc-300 hover:bg-zinc-900 hover:text-white flex items-center gap-2.5 transition-colors"
              >
                <Briefcase className="w-4 h-4 text-cyan-400" />
                <span>New Lead</span>
              </button>
              <button
                onClick={() => {
                  setShowQuickCreate(false);
                  setActiveView('accounting');
                }}
                className="w-full text-left px-3.5 py-2 text-sm text-zinc-300 hover:bg-zinc-900 hover:text-white flex items-center gap-2.5 transition-colors"
              >
                <FilePlus className="w-4 h-4 text-cyan-400" />
                <span>Issue Invoice</span>
              </button>
              <button
                onClick={() => {
                  setShowQuickCreate(false);
                  setActiveView('accounting');
                }}
                className="w-full text-left px-3.5 py-2 text-sm text-zinc-300 hover:bg-zinc-900 hover:text-white flex items-center gap-2.5 transition-colors"
              >
                <Receipt className="w-4 h-4 text-cyan-400" />
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
            className="p-2 text-zinc-300 hover:bg-zinc-900 rounded-lg relative transition-colors"
            title="Notifications"
          >
            <Bell className="w-5 h-5 text-cyan-400" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-cyan-400 rounded-full ring-2 ring-black animate-pulse" />
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-black rounded-xl shadow-2xl border border-zinc-800 z-50 overflow-hidden">
              <div className="px-4 py-3 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-zinc-200">Alerts & Automation Feed</h4>
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 bg-zinc-900 text-cyan-300 border border-zinc-700 rounded-full text-xs font-semibold">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                <button
                  onClick={clearNotifications}
                  className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5 text-cyan-400" />
                  Clear all
                </button>
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-zinc-800">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-zinc-500 text-sm">
                    No active notifications
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => markAsRead(n.id)}
                      className={`p-3.5 hover:bg-zinc-900 transition-colors cursor-pointer flex gap-3 items-start ${
                        !n.read ? 'bg-zinc-900/60' : ''
                      }`}
                    >
                      <div
                        className="w-2 h-2 rounded-full mt-1.5 shrink-0 bg-white"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-zinc-200 truncate">{n.title}</p>
                          <span className="text-[10px] text-zinc-400 shrink-0">{n.timestamp}</span>
                        </div>
                        <p className="text-xs text-zinc-400 mt-0.5 line-clamp-2">{n.message}</p>
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
          className="flex items-center gap-2.5 pl-2 border-l border-zinc-800 cursor-pointer hover:opacity-90 transition-opacity"
        >
          <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-700 overflow-hidden shrink-0 shadow-md">
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
