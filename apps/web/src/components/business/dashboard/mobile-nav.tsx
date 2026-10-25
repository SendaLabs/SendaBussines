"use client";

import { Menu, X } from "lucide-react";
import { useState } from "react";

export function MobileNav({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label={open ? "Cerrar menú del panel" : "Abrir menú del panel"}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="rounded-lg p-2 text-white outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/40"
      >
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 bg-[#061f1b] lg:hidden">
          <div className="flex h-16 items-center justify-end px-4">
            <button
              type="button"
              aria-label="Cerrar menú del panel"
              onClick={() => setOpen(false)}
              className="rounded-lg p-2 text-white outline-none hover:bg-white/10"
            >
              <X className="size-5" />
            </button>
          </div>
          <div className="h-[calc(100dvh-4rem)] overflow-y-auto">{children}</div>
        </div>
      ) : null}
    </>
  );
}
