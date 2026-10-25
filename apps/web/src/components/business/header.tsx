"use client";

import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { BUSINESS_LOGIN_PATH, BUSINESS_PATH } from "@/lib/site";
import { cn } from "@/lib/utils";

const nav = [
  { href: BUSINESS_PATH, label: "Empresas", active: true },
  { href: "#mundo", label: "Alcance" },
  { href: "#pilares", label: "Beneficios" },
];

export function BusinessHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 rounded-b-2xl border-b border-stone/70 bg-white">
      <div className="mx-auto flex h-[4.5rem] w-full max-w-[1440px] items-center justify-between gap-4 px-5 md:px-8 lg:px-12">
        <Link href={BUSINESS_PATH} className="shrink-0" aria-label="Senda">
          <Image
            src="/images/logoverde.png"
            alt="Senda"
            width={430}
            height={101}
            className="h-8 w-auto"
            sizes="160px"
            priority
          />
        </Link>

        <nav aria-label="Principal" className="hidden items-center gap-7 lg:flex">
          {nav.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "text-[0.95rem] text-charcoal underline-offset-4 hover:underline",
                item.active && "font-semibold text-forest",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href={BUSINESS_LOGIN_PATH}
            className="hidden sm:inline-flex"
          >
            <Button variant="senda" size="md" className="px-6">
              Iniciar sesión
            </Button>
          </Link>
          <button
            type="button"
            className="inline-flex size-10 items-center justify-center rounded-full text-forest lg:hidden"
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-stone bg-cream px-5 py-4 lg:hidden">
          <nav className="flex flex-col gap-1" aria-label="Móvil">
            {nav.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex min-h-11 items-center rounded-xl px-3 text-lg text-forest",
                  item.active && "bg-cream-deep font-semibold",
                )}
              >
                {item.label}
              </Link>
            ))}
            <Link
              href={BUSINESS_LOGIN_PATH}
              onClick={() => setOpen(false)}
              className="mt-3"
            >
              <Button variant="senda" size="md" className="w-full">
                Iniciar sesión
              </Button>
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
