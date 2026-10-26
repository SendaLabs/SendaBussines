"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { BUSINESS_API } from "@/lib/business-api";
import { BUSINESS_LOGIN_PATH } from "@/lib/site";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onLogout() {
    if (pending) return;
    setPending(true);
    try {
      await fetch(BUSINESS_API.session, {
        method: "DELETE",
        credentials: "include",
      });
    } finally {
      router.push(BUSINESS_LOGIN_PATH);
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={onLogout}
      disabled={pending}
      aria-label="Cerrar sesión"
      aria-busy={pending || undefined}
      className="rounded-lg p-2 text-white/70 outline-none hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/40 disabled:opacity-50"
    >
      <LogOut className="size-4" aria-hidden />
    </button>
  );
}
