import React from 'react';
import { Phone, Mail, MessageCircle } from 'lucide-react';

interface CommunicationBarProps {
  phone?: string;
  email?: string;
  onCall: () => void;
  onEmail: () => void;
  onWhatsApp: () => void;
  size?: 'sm' | 'md' | 'lg';
  showLabels?: boolean;
}

export const CommunicationBar: React.FC<CommunicationBarProps> = ({
  onCall,
  onEmail,
  onWhatsApp,
  size = 'sm',
  showLabels = false,
}) => {
  const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : size === 'md' ? 'w-4 h-4' : 'w-5 h-5';
  const padding = size === 'sm' ? 'px-2 py-1' : size === 'md' ? 'px-2.5 py-1.5' : 'px-3.5 py-2';

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="flex items-center gap-1 bg-[#EFEDE8] p-1 rounded-xl border border-[rgba(10,20,32,0.08)] w-fit"
    >
      <button
        type="button"
        onClick={onCall}
        className={`${padding} text-[#0E9D98] hover:text-white hover:bg-[#0E9D98] rounded-lg transition-all flex items-center gap-1.5 font-bold text-[11px]`}
        title="Start Call / Log Phone Call"
      >
        <Phone className={iconSize} />
        {showLabels && <span>Call</span>}
      </button>

      <button
        type="button"
        onClick={onEmail}
        className={`${padding} text-blue-600 hover:text-white hover:bg-blue-600 rounded-lg transition-all flex items-center gap-1.5 font-bold text-[11px]`}
        title="Send Direct Email"
      >
        <Mail className={iconSize} />
        {showLabels && <span>Email</span>}
      </button>

      <button
        type="button"
        onClick={onWhatsApp}
        className={`${padding} text-emerald-600 hover:text-white hover:bg-emerald-600 rounded-lg transition-all flex items-center gap-1.5 font-bold text-[11px]`}
        title="Open WhatsApp Chat"
      >
        <MessageCircle className={iconSize} />
        {showLabels && <span>WhatsApp</span>}
      </button>
    </div>
  );
};
