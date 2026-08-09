import React from 'react';
import {
  Clock,
  AlertCircle,
  CheckCircle2,
  Play,
  PauseCircle,
  Compass,
  FileCheck,
} from 'lucide-react';

export type ProgressStatus = 'In Progress' | 'Overdue' | 'Closed' | 'Planning' | 'On Hold' | 'To Do' | 'In Review';

interface ProgressBadgeProps {
  status: ProgressStatus;
  customLabel?: string;
  size?: 'sm' | 'md';
}

export const ProgressBadge: React.FC<ProgressBadgeProps> = ({ status, customLabel, size = 'sm' }) => {
  const label = customLabel || status;
  const paddingClass = size === 'sm' ? 'px-2.5 py-0.5 text-[11px]' : 'px-3 py-1 text-xs';

  switch (status) {
    case 'Closed':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs shrink-0 ${paddingClass}`}
        >
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          <span>{label}</span>
        </span>
      );

    case 'Overdue':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full font-semibold bg-rose-50 text-rose-700 border border-rose-200 shadow-xs shrink-0 ${paddingClass}`}
        >
          <AlertCircle className="w-3 h-3 text-rose-500" />
          <span>{label}</span>
        </span>
      );

    case 'In Progress':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full font-semibold bg-blue-50 text-blue-700 border border-blue-200 shadow-xs shrink-0 ${paddingClass}`}
        >
          <Clock className="w-3 h-3 text-blue-500" />
          <span>{label}</span>
        </span>
      );

    case 'In Review':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full font-semibold bg-violet-50 text-violet-700 border border-violet-200 shadow-xs shrink-0 ${paddingClass}`}
        >
          <FileCheck className="w-3 h-3 text-violet-500" />
          <span>{label}</span>
        </span>
      );

    case 'Planning':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full font-semibold bg-amber-50 text-amber-700 border border-amber-200 shadow-xs shrink-0 ${paddingClass}`}
        >
          <Compass className="w-3 h-3 text-amber-500" />
          <span>{label}</span>
        </span>
      );

    case 'On Hold':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full font-semibold bg-[#EFEDE8] text-[#6B7685] border border-[rgba(10,20,32,0.10)] shadow-xs shrink-0 ${paddingClass}`}
        >
          <PauseCircle className="w-3 h-3 text-[#6B7685]" />
          <span>{label}</span>
        </span>
      );

    case 'To Do':
    default:
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full font-semibold bg-[#FAFAF8] text-[rgba(10,20,32,0.50)] border border-[rgba(10,20,32,0.08)] shadow-xs shrink-0 ${paddingClass}`}
        >
          <Play className="w-3 h-3 text-[rgba(10,20,32,0.40)]" />
          <span>{label}</span>
        </span>
      );
  }
};

/** Helper functions to calculate status based on current date (2026-07-22) */
export const getTodayDateString = (): string => '2026-07-22';

export const getDealProgressStatus = (stage: string, closeDate: string): ProgressStatus => {
  if (stage === 'won' || stage === 'lost') {
    return 'Closed';
  }
  const today = getTodayDateString();
  if (closeDate && closeDate < today) {
    return 'Overdue';
  }
  return 'In Progress';
};

export const getProjectProgressStatus = (status: string, progress: number, dueDate: string): ProgressStatus => {
  if (status === 'Completed' || progress >= 100) {
    return 'Closed';
  }
  if (status === 'On Hold') {
    return 'On Hold';
  }
  if (status === 'Planning') {
    return 'Planning';
  }
  const today = getTodayDateString();
  if (dueDate && dueDate < today) {
    return 'Overdue';
  }
  return 'In Progress';
};

export const getTaskProgressStatus = (status: string, dueDate: string): ProgressStatus => {
  if (status === 'Done') {
    return 'Closed';
  }
  if (status === 'Review') {
    return 'In Review';
  }
  const today = getTodayDateString();
  if (dueDate && dueDate < today) {
    return 'Overdue';
  }
  if (status === 'In Progress') {
    return 'In Progress';
  }
  return 'To Do';
};
