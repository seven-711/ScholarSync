

declare module 'lucide-react' {
  import { FC, SVGProps } from 'react';

  export interface IconProps extends SVGProps<SVGSVGElement> {
    size?: string | number;
    color?: string;
    strokeWidth?: string | number;
    absoluteStrokeWidth?: boolean;
  }

  export type Icon = FC<IconProps>;

  // Navigation & Layout
  export const LayoutDashboard: Icon;
  export const Menu: Icon;
  export const X: Icon;
  export const LogOut: Icon;
  export const Settings: Icon;
  export const ChevronLeft: Icon;
  export const ChevronRight: Icon;
  export const ChevronDown: Icon;
  export const ChevronUp: Icon;
  export const ArrowRight: Icon;
  export const ArrowLeft: Icon;
  
  // Users & Auth
  export const User: Icon;
  export const Users: Icon;
  export const GraduationCap: Icon;
  export const Shield: Icon;
  export const ShieldCheck: Icon;
  export const ShieldAlert: Icon;
  export const Lock: Icon;
  export const KeyRound: Icon;
  export const UserX: Icon;
  export const UserCheck: Icon;
  export const IdCard: Icon;
  export const Building: Icon;

  // Documents & Data
  export const FileText: Icon;
  export const FileCheck: Icon;
  export const ScrollText: Icon;
  export const Database: Icon;
  export const Copy: Icon;
  export const BookOpen: Icon;
  
  // Actions & Status
  export const Check: Icon;
  export const CheckCircle: Icon;
  export const CheckCircle2: Icon;
  export const AlertCircle: Icon;
  export const AlertTriangle: Icon;
  export const AlertOctagon: Icon;
  export const XCircle: Icon;
  export const Loader2: Icon;
  export const Activity: Icon;
  export const Clock: Icon;
  export const Search: Icon;
  export const Plus: Icon;
  export const Trash2: Icon;
  export const Send: Icon;
  export const Upload: Icon;
  export const RefreshCw: Icon;
  export const RefreshCcw: Icon;
  export const RotateCcw: Icon;
  export const Eye: Icon;
  export const Download: Icon;
  export const Undo: Icon;
  export const MessageSquare: Icon;
  export const MessageCircleQuestion: Icon;
  export const Reply: Icon;
  export const Inbox: Icon;
  export const Quote: Icon;
  
  // Media & Misc
  export const Image: Icon;
  export const Camera: Icon;
  export const Bell: Icon;
  export const Calendar: Icon;
  export const Mail: Icon;
  export const Sparkles: Icon;
  export const Megaphone: Icon;
  export const Pin: Icon;
  
  // AI Features
  export const Mic: Icon;
  export const MicOff: Icon;
  export const Bot: Icon;
  export const Play: Icon;
  export const Pause: Icon;
  export const Volume2: Icon;
  export const StopCircle: Icon;
  export const Ratio: Icon;
  export const Wand2: Icon;
  export const Zap: Icon;
  export const SkipForward: Icon;
}