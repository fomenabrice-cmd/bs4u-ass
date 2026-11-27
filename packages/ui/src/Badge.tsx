import { HTMLAttributes } from "react";

type BadgeVariant =
  | "default" | "success" | "warning" | "danger" | "info"
  | "draft" | "pending" | "active" | "paid" | "partial" | "overdue"
  | "open" | "closed" | "approved" | "rejected" | "sent";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const styles: Record<BadgeVariant, string> = {
  default:   "bg-slate-100 text-slate-700",
  success:   "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200",
  warning:   "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
  danger:    "bg-red-50 text-red-700 ring-1 ring-red-200",
  info:      "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  draft:     "bg-slate-100 text-slate-600",
  pending:   "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  active:    "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200",
  paid:      "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200",
  partial:   "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  overdue:   "bg-red-50 text-red-700 ring-1 ring-red-200",
  open:      "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200",
  closed:    "bg-slate-100 text-slate-600",
  approved:  "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200",
  rejected:  "bg-red-50 text-red-700 ring-1 ring-red-200",
  sent:      "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
};

const statusMap: Partial<Record<string, BadgeVariant>> = {
  draft: "draft", brouillon: "draft",
  pending: "pending", "en attente": "pending",
  active: "active", actif: "active",
  paid: "paid", payé: "paid",
  partial: "partial", partiel: "partial",
  overdue: "overdue", "en retard": "overdue",
  open: "open", ouverte: "open",
  closed: "closed", clôturée: "closed",
  approved: "approved", approuvé: "approved",
  rejected: "rejected", rejeté: "rejected",
  sent: "sent", envoyé: "sent",
};

export function Badge({ variant, children, className = "", ...props }: BadgeProps) {
  const v = variant ?? statusMap[String(children).toLowerCase()] ?? "default";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${styles[v]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
