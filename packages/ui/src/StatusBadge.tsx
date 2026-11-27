import React from "react";
import { cn } from "./cn";

type StatusColor = "green" | "red" | "yellow" | "blue" | "gray" | "purple" | "orange";

interface StatusBadgeProps {
  label: string;
  color?: StatusColor;
  dot?: boolean;
  size?: "sm" | "md";
  className?: string;
}

const colorClasses: Record<StatusColor, string> = {
  green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  red: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  yellow: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  gray: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  purple: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  orange: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
};

const dotColors: Record<StatusColor, string> = {
  green: "bg-emerald-500",
  red: "bg-red-500",
  yellow: "bg-amber-500",
  blue: "bg-blue-500",
  gray: "bg-gray-400",
  purple: "bg-purple-500",
  orange: "bg-orange-500",
};

export function StatusBadge({ label, color = "gray", dot = false, size = "md", className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-medium rounded-full",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs",
        colorClasses[color],
        className
      )}
    >
      {dot && (
        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", dotColors[color])} />
      )}
      {label}
    </span>
  );
}
