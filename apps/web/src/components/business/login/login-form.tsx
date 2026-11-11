"use client";

import { ArrowRight, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ApiErrorBody, Sep10ChallengeResponse } from "@senda/shared";

import { BUSINESS_API } from "@/lib/business-api";
import { BUSINESS_DASHBOARD_PATH } from "@/lib/site";

const INSTALL_FREIGHTER = "Instalá Freighter para entrar.";

export function LoginForm() {
  const router = useRouter();
  const [isNavigating, startNavigation] = useTransition();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = pending || isNavigating;

  async function onEnter() {
    if (busy) return;
    setError(null);
    setPending(true);
    try {
      let freighter: typeof import("@stellar/freighter-api");
      try {
        freighter = await import("@stellar/freighter-api");
      } catch {
        setError(INSTALL_FREIGHTER);
        return;
      }

      let connected = false;
      try {
        const result = await freighter.isConnected();
        connected = result.isConnected && !result.error;
      } catch {
        connected = false;
      }
      if (!connected) {
        setError(INSTALL_FREIGHTER);
        return;
      }

      const access = await freighter.requestAccess();
      if (access.error || !access.address) {
        setError("No pudimos conectar la billetera.");
        return;
      }

      const challengeResponse = await fetch(BUSINESS_API.sep10Challenge, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ account: access.address }),
      });
      if (!challengeResponse.ok) {
        setError(await readError(challengeResponse, "No se pudo preparar el ingreso."));
        return;
      }
      const challenge: unknown = await challengeResponse.json();
      if (!isChallenge(challenge)) {
        setError("No se pudo preparar el ingreso.");
        return;
      }

      const signed = await freighter.signTransaction(challenge.transaction, {
        networkPassphrase: challenge.networkPassphrase,
        address: access.address,
      });
      if (signed.error || !signed.signedTxXdr) {
        setError("No se pudo verificar la firma.");
        return;
      }

      const tokenResponse = await fetch(BUSINESS_API.sep10Token, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ transaction: signed.signedTxXdr }),
      });
      if (tokenResponse.status !== 204) {
        setError(await readError(tokenResponse, "No se pudo verificar la firma."));
        return;
      }

      startNavigation(() => router.push(BUSINESS_DASHBOARD_PATH));
    } catch {
      setError("No pudimos completar el ingreso.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="w-full max-w-[22.5rem]">
      <h1 className="text-[2rem] leading-tight font-semibold tracking-[-0.03em] text-forest">
        Iniciar sesión
      </h1>
      <p className="mt-1.5 text-[0.95rem] text-charcoal/60">
        Entrá con cualquier billetera Stellar.
      </p>

      <div className="mt-8">
        {error ? (
          <p
            role="alert"
            className="mb-4 rounded-xl border border-red-600/20 bg-white px-4 py-3 text-sm text-red-800"
          >
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={onEnter}
          disabled={busy}
          aria-busy={busy || undefined}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-forest text-[0.95rem] font-medium text-cream transition-colors outline-none hover:bg-forest-soft focus-visible:ring-3 focus-visible:ring-forest/40 disabled:cursor-wait disabled:opacity-80"
        >
          <Wallet className="size-4" aria-hidden />
          {busy ? "Ingresando…" : "Entrar con la billetera"}
          <ArrowRight className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (isApiError(body)) return body.error;
  } catch {
    return fallback;
  }
  return fallback;
}

function isApiError(value: unknown): value is ApiErrorBody {
  if (typeof value !== "object" || value === null || !("error" in value)) return false;
  return typeof value.error === "string" && value.error.length > 0;
}

function isChallenge(value: unknown): value is Sep10ChallengeResponse {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.transaction === "string" &&
    record.transaction.length > 0 &&
    typeof record.networkPassphrase === "string" &&
    record.networkPassphrase.length > 0
  );
}
