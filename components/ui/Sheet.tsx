"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { C, radius } from "@/lib/design";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
};

/** 下からせり上がるシート。背景をタップすると閉じる。 */
export function Sheet({ open, onClose, title, subtitle, children }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900 opacity-40 anim-fade" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full bg-white p-4 space-y-3 anim-sheet max-h-[85vh] overflow-y-auto"
        style={{ borderRadius: radius.sheet, borderTop: `3px solid ${C.ink}` }}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || subtitle) && (
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              {title && <div className="text-base font-extrabold truncate">{title}</div>}
              {subtitle && <div className="text-sm text-slate-400 truncate">{subtitle}</div>}
            </div>
            <button onClick={onClose} className="text-slate-400 shrink-0" aria-label="閉じる">
              <X size={20} />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
