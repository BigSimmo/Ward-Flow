"use client";

// The kind icon beside each global search result, split out of `ward-global-search.tsx` (18 October
// 2026) to keep that file under the line cap. The phone menu's search results draw the same icon.

import {
  AlertTriangle,
  ArrowRightLeft,
  BarChart2,
  BedSingle,
  Building2,
  CheckSquare,
  ClipboardList,
  Clock,
  FileText,
  Hospital,
  Inbox,
  LayoutDashboard,
  PhoneCall,
  Plus,
  Route,
  Scale,
  Search,
  Settings,
  UserPlus,
  UserRound,
  Users,
} from "lucide-react";

import styles from "./ward-global-search.module.css";

export function SearchResultIcon({
  kind,
  id,
  className = styles.itemIcon,
}: {
  kind: string;
  id?: string;
  className?: string;
}) {
  switch (kind) {
    case "person":
      return <UserRound className={className} aria-hidden="true" />;
    case "movement":
      return <Route className={className} aria-hidden="true" />;
    case "ward":
      return <BedSingle className={className} aria-hidden="true" />;
    case "ed":
      return <Hospital className={className} aria-hidden="true" />;
    case "community":
      return <Users className={className} aria-hidden="true" />;
    case "form":
      return <FileText className={className} aria-hidden="true" />;
    case "task":
      return <CheckSquare className={className} aria-hidden="true" />;
    case "action":
      return id === "add-patient" ? (
        <UserPlus className={className} aria-hidden="true" />
      ) : (
        <Plus className={className} aria-hidden="true" />
      );
    case "view": {
      switch (id) {
        case "delays":
          return <Clock className={className} aria-hidden="true" />;
        case "movements":
          return <ArrowRightLeft className={className} aria-hidden="true" />;
        case "handover":
          return <ClipboardList className={className} aria-hidden="true" />;
        case "capacity":
          return <BedSingle className={className} aria-hidden="true" />;
        case "escalation":
          return <AlertTriangle className={className} aria-hidden="true" />;
        case "statistics":
          return <BarChart2 className={className} aria-hidden="true" />;
        case "on-call":
          return <PhoneCall className={className} aria-hidden="true" />;
        case "hub":
          return <Building2 className={className} aria-hidden="true" />;
        case "settings":
          return <Settings className={className} aria-hidden="true" />;
        case "legal-forms":
          return <Scale className={className} aria-hidden="true" />;
        case "referrals":
          return <Inbox className={className} aria-hidden="true" />;
        case "community":
          return <Users className={className} aria-hidden="true" />;
        default:
          return <LayoutDashboard className={className} aria-hidden="true" />;
      }
    }
    default:
      return <Search className={className} aria-hidden="true" />;
  }
}
