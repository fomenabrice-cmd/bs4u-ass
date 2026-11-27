import { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: ReactNode;
  trend?: { value: number; label: string };
  accent?: "green" | "gold" | "blue" | "red";
}

const accents = {
  green: "from-brand/5 to-transparent border-brand/20",
  gold:  "from-amber-50 to-transparent border-amber-200",
  blue:  "from-blue-50 to-transparent border-blue-200",
  red:   "from-red-50 to-transparent border-red-200",
};

export function StatCard({ label, value, sub, icon, trend, accent = "green" }: StatCardProps) {
  return (
    <div className={`bg-gradient-to-br ${accents[accent]} bg-white rounded-xl border p-5 shadow-sm`}>
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs font-medium text-slate-500 tracking-wide">{label}</span>
        {icon && (
          <span className="w-8 h-8 rounded-lg bg-white/60 border border-current/10 flex items-center justify-center text-brand opacity-70">
            {icon}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-slate-900 leading-none">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
      {trend && (
        <p className={`mt-2 text-xs font-medium ${trend.value >= 0 ? "text-emerald-600" : "text-red-500"}`}>
          {trend.value >= 0 ? "+" : ""}{trend.value}% {trend.label}
        </p>
      )}
    </div>
  );
}
