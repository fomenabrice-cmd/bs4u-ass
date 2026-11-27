import React from "react";
import * as RadixToast from "@radix-ui/react-toast";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { cn } from "./cn";

export type ToastVariant = "success" | "error" | "warning" | "info";

interface ToastProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

const icons: Record<ToastVariant, React.ReactNode> = {
  success: <CheckCircle className="h-5 w-5 text-emerald-500" />,
  error: <AlertCircle className="h-5 w-5 text-red-500" />,
  warning: <AlertTriangle className="h-5 w-5 text-amber-500" />,
  info: <Info className="h-5 w-5 text-blue-500" />,
};

const variantClasses: Record<ToastVariant, string> = {
  success: "border-l-4 border-l-emerald-500",
  error: "border-l-4 border-l-red-500",
  warning: "border-l-4 border-l-amber-500",
  info: "border-l-4 border-l-blue-500",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <RadixToast.Provider swipeDirection="right">
      {children}
      <RadixToast.Viewport className="fixed bottom-0 right-0 z-[100] flex flex-col gap-2 p-6 max-w-sm w-full" />
    </RadixToast.Provider>
  );
}

export function Toast({ open, onOpenChange, title, description, variant = "info", duration = 4000 }: ToastProps) {
  return (
    <RadixToast.Root
      open={open}
      onOpenChange={onOpenChange}
      duration={duration}
      className={cn(
        "flex items-start gap-3 p-4 rounded-xl bg-white dark:bg-gray-900 shadow-lg border border-gray-200 dark:border-gray-700",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-80 data-[state=open]:fade-in-0",
        "data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-right-full",
        variantClasses[variant]
      )}
    >
      <div className="shrink-0 mt-0.5">{icons[variant]}</div>
      <div className="flex-1 min-w-0">
        <RadixToast.Title className="text-sm font-semibold text-gray-900 dark:text-white">
          {title}
        </RadixToast.Title>
        {description && (
          <RadixToast.Description className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {description}
          </RadixToast.Description>
        )}
      </div>
      <RadixToast.Close className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
        <X className="h-4 w-4" />
      </RadixToast.Close>
    </RadixToast.Root>
  );
}

export function useToast() {
  const [toasts, setToasts] = React.useState<
    Array<{ id: string; open: boolean; title: string; description?: string; variant?: ToastVariant }>
  >([]);

  const toast = React.useCallback(
    ({ title, description, variant = "info" }: { title: string; description?: string; variant?: ToastVariant }) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev, { id, open: true, title, description, variant }]);
    },
    []
  );

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, open: false } : t)));
  }, []);

  const ToastContainer = React.useCallback(
    () => (
      <>
        {toasts.map((t) => (
          <Toast
            key={t.id}
            open={t.open}
            onOpenChange={(open) => !open && dismiss(t.id)}
            title={t.title}
            description={t.description}
            variant={t.variant}
          />
        ))}
      </>
    ),
    [toasts, dismiss]
  );

  return { toast, ToastContainer };
}
