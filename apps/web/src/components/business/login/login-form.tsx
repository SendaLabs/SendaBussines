"use client";

import { ArrowRight, Info, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ApiErrorBody, Sep10ChallengeResponse } from "@senda/shared";

import { BUSINESS_API } from "@/lib/business-api";
import { BUSINESS_DASHBOARD_PATH, site } from "@/lib/site";
import { cn } from "@/lib/utils";

const INSTALL_FREIGHTER = "Instalá Freighter para entrar.";

export function LoginForm() {
  const router = useRouter();
  const [isNavigating, startNavigation] = useTransition();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNotice, setShowNotice] = useState(false);
  const busy = pending || isNavigating;

  async function onEnter() {
    if (busy) return;
    setError(null);
    setShowNotice(false);
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
        Entrá con la billetera de la empresa.
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

      <div
        role="status"
        aria-live="polite"
        className={cn(showNotice ? "mt-5" : "sr-only")}
      >
        {showNotice ? (
          <div className="flex gap-3 rounded-xl border border-forest/15 bg-cream-deep px-4 py-3.5 text-forest">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            <div className="text-sm leading-relaxed">
              <p className="font-medium">
                Senda Business está en acceso anticipado.
              </p>
              <p className="mt-1 text-charcoal/70">
                Todavía no hay cuentas activas. El acceso abre pronto.
              </p>
              <a
                href={`mailto:${site.email}?subject=${encodeURIComponent("Solicitar acceso Senda Business")}`}
                className="mt-2 inline-flex font-medium underline underline-offset-4 hover:no-underline"
              >
                Solicitar acceso
              </a>
            </div>
          </div>
        ) : null}
      </div>

      <div className="my-6 flex items-center gap-4" aria-hidden>
        <span className="h-px flex-1 bg-stone" />
        <span className="text-xs text-charcoal/50">o continuá con</span>
        <span className="h-px flex-1 bg-stone" />
      </div>

      <button
        type="button"
        onClick={() => setShowNotice(true)}
        className="flex min-h-12 w-full items-center justify-center gap-2.5 rounded-xl border border-stone bg-white px-4 text-sm font-medium text-charcoal transition-colors outline-none hover:bg-cream focus-visible:ring-3 focus-visible:ring-forest/30"
      >
        <GoogleMark />
        Continuar con Google
      </button>
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

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-[1.1rem]" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.3h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.8 14.2a6.6 6.6 0 0 1 0-4.4V7H2.1a11 11 0 0 0 0 10l3.7-2.8Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4Z"
      />
    </svg>
  );
}
