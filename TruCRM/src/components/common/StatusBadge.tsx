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
          className={`inline-flex items-center gap-1.5 rounded-full font-semibold bg-white text-black border border-white shadow-xs shrink-0 ${paddingClass}`}
        >
          <CheckCircle2 className="w-3 h-3 text-black" />
          <span>{label}</span>
        </span>
      );

    case 'Overdue':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full font-semibold bg-zinc-900 text-zinc-100 border border-zinc-600 shadow-xs shrink-0 ${paddingClass}`}
        >
          <AlertCircle className="w-3 h-3 text-zinc-200" />
          <span>{label}</span>
        </span>
      );

    case 'In Progress':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full font-semibold bg-zinc-900 text-zinc-200 border border-zinc-700 shadow-xs shrink-0 ${paddingClass}`}
        >
          <Clock className="w-3 h-3 text-zinc-300" />
          <span>{label}</span>
        </span>
      );

    case 'In Review':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full font-semibold bg-zinc-900 text-zinc-200 border border-zinc-700 shadow-xs shrink-0 ${paddingClass}`}
        >
          <FileCheck className="w-3 h-3 text-zinc-300" />
          <span>{label}</span>
        </span>
      );

    case 'Planning':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full font-semibold bg-zinc-950 text-zinc-300 border border-zinc-800 shadow-xs shrink-0 ${paddingClass}`}
        >
          <Compass className="w-3 h-3 text-zinc-400" />
          <span>{label}</span>
        </span>
      );

    case 'On Hold':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full font-semibold bg-zinc-900 text-zinc-300 border border-zinc-700 shadow-xs shrink-0 ${paddingClass}`}
        >
          <PauseCircle className="w-3 h-3 text-zinc-400" />
          <span>{label}</span>
        </span>
      );

    case 'To Do':
    default:
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full font-semibold bg-zinc-950 text-zinc-400 border border-zinc-800 shadow-xs shrink-0 ${paddingClass}`}
        >
          <Play className="w-3 h-3 text-zinc-500" />
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
