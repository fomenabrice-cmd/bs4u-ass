import React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "./cn";

interface KPICardProps {
  title: string;
  value: string | number;
  unit?: string;
  trend?: number;
  trendLabel?: string;
  icon?: React.ReactNode;
  variant?: "default" | "brand" | "gold" | "success" | "danger";
  loading?: boolean;
  className?: string;
}

const variantClasses = {
  default: "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700",
  brand: "bg-brand text-white border-brand",
  gold: "bg-brand-gold text-white border-brand-gold",
  success: "bg-emerald-500 text-white border-emerald-500",
  danger: "bg-red-500 text-white border-red-500",
};

export function KPICard({
  title,
  value,
  unit,
  trend,
  trendLabel,
  icon,
  variant = "default",
  loading,
  className,
}: KPICardProps) {
  const isColored = variant !== "default";
  const TrendIcon = trend === undefined ? null : trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus;
  const trendColor =
    isColored
      ? "text-white/80"
      : trend === undefined
      ? ""
      : trend > 0
      ? "text-emerald-600 dark:text-emerald-400"
      : trend < 0
      ? "text-red-600 dark:text-red-400"
      : "text-gray-500";

  if (loading) {
    return (
      <div className={cn("rounded-2xl border p-5 animate-pulse bg-gray-100 dark:bg-gray-800", className)}>
        <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-3" />
        <div className="h-8 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-2xl border p-5 transition-all duration-200 hover:shadow-md",
        variantClasses[variant],
        className
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <p
          className={cn(
            "text-sm font-medium",
            isColored ? "text-white/80" : "text-gray-500 dark:text-gray-400"
          )}
        >
          {title}
        </p>
        {icon && (
          <div
            className={cn(
              "p-2 rounded-xl",
              isColored ? "bg-white/15" : "bg-brand/10 text-brand"
            )}
          >
            {icon}
          </div>
        )}
      </div>
      <div className="flex items-baseline gap-1">
        <span
          className={cn(
            "text-2xl font-bold tracking-tight",
            isColored ? "text-white" : "text-gray-900 dark:text-white"
          )}
        >
          {value}
        </span>
        {unit && (
          <span
            className={cn(
              "text-sm font-medium",
              isColored ? "text-white/70" : "text-gray-500 dark:text-gray-400"
            )}
          >
            {unit}
          </span>
        )}
      </div>
      {(TrendIcon || trendLabel) && (
        <div className={cn("flex items-center gap-1 mt-2 text-xs font-medium", trendColor)}>
          {TrendIcon && <TrendIcon className="h-3.5 w-3.5" />}
          {trend !== undefined && (
            <span>
              {trend > 0 ? "+" : ""}
              {trend}%
            </span>
          )}
          {trendLabel && <span className={cn(isColored ? "text-white/60" : "text-gray-500")}>{trendLabel}</span>}
        </div>
      )}
    </div>
  );
}
