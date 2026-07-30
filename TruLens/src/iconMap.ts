import type React from 'react';
import { Camera, ClipboardList, Wrench, AlertTriangle, FileText } from 'lucide-react';

export const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>> = {
  camera: Camera,
  clipboard: ClipboardList,
  wrench: Wrench,
  alert: AlertTriangle,
  file: FileText,
};
