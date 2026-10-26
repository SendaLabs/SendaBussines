"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { releaseMilestoneUrl } from "@/lib/business-api";

const NETWORK_ERROR = "No se pudo liberar el hito. El depósito sigue fondeado.";

export function ReleaseMilestoneButton({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const pendingRef = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(releaseMilestoneUrl(paymentId), {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });
      if (response.ok) {
        router.refresh();
        return;
      }
      setError(await readError(response));
    } catch {
      setError(NETWORK_ERROR);
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  return (
    <div className="mt-2">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void onClick()}
          disabled={pending}
          aria-busy={pending || undefined}
          className="inline-flex min-h-9 items-center rounded-full bg-forest px-3 text-xs font-medium text-cream outline-none hover:bg-forest-soft focus-visible:ring-2 focus-visible:ring-forest/40 disabled:cursor-wait disabled:opacity-60"
        >
          {pending ? "Liberando…" : "Liberar hito"}
        </button>
      </div>
      {error ? (
        <p role="alert" className="mt-1 text-right text-xs text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

async function readError(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof body.error === "string" &&
      body.error.length > 0
    ) {
      return body.error;
    }
  } catch {
    return NETWORK_ERROR;
  }
  return NETWORK_ERROR;
}
