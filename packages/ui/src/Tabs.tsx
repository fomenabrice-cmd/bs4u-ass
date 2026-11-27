import React from "react";
import * as RadixTabs from "@radix-ui/react-tabs";
import { cn } from "./cn";

interface TabItem {
  value: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
  disabled?: boolean;
}

interface TabsProps {
  value: string;
  onValueChange: (value: string) => void;
  tabs: TabItem[];
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "pills";
}

export function Tabs({ value, onValueChange, tabs, children, className, variant = "default" }: TabsProps) {
  return (
    <RadixTabs.Root value={value} onValueChange={onValueChange} className={className}>
      <RadixTabs.List
        className={cn(
          "flex gap-1 mb-6",
          variant === "default" && "border-b border-gray-200 dark:border-gray-700",
          variant === "pills" && "bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-fit"
        )}
      >
        {tabs.map((tab) => (
          <RadixTabs.Trigger
            key={tab.value}
            value={tab.value}
            disabled={tab.disabled}
            className={cn(
              "flex items-center gap-2 text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed",
              variant === "default" && [
                "px-4 py-2.5 -mb-px border-b-2 border-transparent text-gray-500 dark:text-gray-400",
                "hover:text-gray-700 dark:hover:text-gray-300",
                "data-[state=active]:border-brand data-[state=active]:text-brand dark:data-[state=active]:text-brand-gold",
              ],
              variant === "pills" && [
                "px-3 py-1.5 rounded-lg text-gray-600 dark:text-gray-400",
                "hover:bg-white dark:hover:bg-gray-700",
                "data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-gray-900 dark:data-[state=active]:text-white data-[state=active]:shadow-sm",
              ]
            )}
          >
            {tab.icon}
            {tab.label}
            {tab.badge !== undefined && (
              <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                {tab.badge}
              </span>
            )}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {children}
    </RadixTabs.Root>
  );
}

export const TabContent = RadixTabs.Content;
