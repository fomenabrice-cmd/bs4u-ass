import React from "react";
import * as RadixAvatar from "@radix-ui/react-avatar";
import { cn } from "./cn";

interface AvatarProps {
  src?: string | null;
  alt?: string;
  fallback?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  online?: boolean;
}

const sizeClasses = {
  xs: "h-6 w-6 text-xs",
  sm: "h-8 w-8 text-sm",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
  xl: "h-16 w-16 text-lg",
};

function getInitials(name?: string) {
  if (!name) return "?";
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

export function Avatar({ src, alt, fallback, size = "md", className, online }: AvatarProps) {
  return (
    <div className="relative inline-block">
      <RadixAvatar.Root
        className={cn(
          "relative flex shrink-0 overflow-hidden rounded-full bg-brand/10",
          sizeClasses[size],
          className
        )}
      >
        {src && (
          <RadixAvatar.Image
            src={src}
            alt={alt}
            className="aspect-square h-full w-full object-cover"
          />
        )}
        <RadixAvatar.Fallback
          delayMs={300}
          className="flex h-full w-full items-center justify-center rounded-full bg-brand text-white font-semibold"
        >
          {getInitials(fallback ?? alt)}
        </RadixAvatar.Fallback>
      </RadixAvatar.Root>
      {online !== undefined && (
        <span
          className={cn(
            "absolute bottom-0 right-0 block rounded-full ring-2 ring-white dark:ring-gray-900",
            size === "xs" ? "h-1.5 w-1.5" : "h-2.5 w-2.5",
            online ? "bg-emerald-500" : "bg-gray-400"
          )}
        />
      )}
    </div>
  );
}
