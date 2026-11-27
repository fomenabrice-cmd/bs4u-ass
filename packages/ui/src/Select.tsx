import React from "react";
import * as RadixSelect from "@radix-ui/react-select";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "./cn";

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectGroup {
  label: string;
  options: SelectOption[];
}

interface SelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  options?: SelectOption[];
  groups?: SelectGroup[];
  disabled?: boolean;
  className?: string;
  error?: string;
}

export function Select({ value, onValueChange, placeholder, options, groups, disabled, className, error }: SelectProps) {
  const allOptions = options ?? groups?.flatMap((g) => g.options) ?? [];

  const renderOptions = (opts: SelectOption[]) =>
    opts.map((opt) => (
      <RadixSelect.Item
        key={opt.value}
        value={opt.value}
        disabled={opt.disabled}
        className={cn(
          "relative flex cursor-pointer select-none items-center rounded-lg py-2 pl-8 pr-4 text-sm outline-none",
          "text-gray-700 dark:text-gray-300",
          "data-[highlighted]:bg-brand/10 data-[highlighted]:text-brand dark:data-[highlighted]:text-brand-gold",
          "data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed"
        )}
      >
        <RadixSelect.ItemText>{opt.label}</RadixSelect.ItemText>
        <RadixSelect.ItemIndicator className="absolute left-2 flex items-center">
          <Check className="h-3.5 w-3.5" />
        </RadixSelect.ItemIndicator>
      </RadixSelect.Item>
    ));

  return (
    <div className={className}>
      <RadixSelect.Root value={value} onValueChange={onValueChange} disabled={disabled}>
        <RadixSelect.Trigger
          className={cn(
            "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm bg-white dark:bg-gray-900",
            "border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300",
            "hover:border-brand dark:hover:border-brand-gold focus:outline-none focus:ring-2 focus:ring-brand/30",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            error && "border-red-500 focus:ring-red-500/30"
          )}
        >
          <RadixSelect.Value placeholder={placeholder ?? "Sélectionner…"} />
          <RadixSelect.Icon>
            <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
          </RadixSelect.Icon>
        </RadixSelect.Trigger>
        <RadixSelect.Portal>
          <RadixSelect.Content
            position="popper"
            sideOffset={4}
            className={cn(
              "z-50 min-w-[8rem] overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700",
              "bg-white dark:bg-gray-900 shadow-xl",
              "data-[state=open]:animate-in data-[state=closed]:animate-out",
              "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
              "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
              "w-[var(--radix-select-trigger-width)] max-h-60"
            )}
          >
            <RadixSelect.ScrollUpButton className="flex items-center justify-center h-6 bg-white dark:bg-gray-900 cursor-default">
              <ChevronDown className="h-3 w-3 rotate-180" />
            </RadixSelect.ScrollUpButton>
            <RadixSelect.Viewport className="p-1">
              {groups
                ? groups.map((group) => (
                    <RadixSelect.Group key={group.label}>
                      <RadixSelect.Label className="px-3 py-1 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                        {group.label}
                      </RadixSelect.Label>
                      {renderOptions(group.options)}
                    </RadixSelect.Group>
                  ))
                : renderOptions(allOptions)}
            </RadixSelect.Viewport>
            <RadixSelect.ScrollDownButton className="flex items-center justify-center h-6 bg-white dark:bg-gray-900 cursor-default">
              <ChevronDown className="h-3 w-3" />
            </RadixSelect.ScrollDownButton>
          </RadixSelect.Content>
        </RadixSelect.Portal>
      </RadixSelect.Root>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
