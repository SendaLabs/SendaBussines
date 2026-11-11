"use client";

import { ArrowRight, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { ApiErrorBody, Sep10ChallengeResponse } from "@senda/shared";

import { BUSINESS_API } from "@/lib/business-api";
import { BUSINESS_DASHBOARD_PATH } from "@/lib/site";

const GOOGLE_ENABLED = Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID);
const INSTALL_FREIGHTER = "Instalá Freighter para entrar.";
const GOOGLE_FAILED = "No pudimos entrar con Google.";

export function LoginForm() {
  const router = useRouter();
  const [isNavigating, startNavigation] = useTransition();
  const [pending, setPending] = useState<"wallet" | "google" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = pending !== null || isNavigating;

  useEffect(() => {
    if (!GOOGLE_ENABLED) return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("privy_oauth_code");
    const state = params.get("privy_oauth_state");
    if (!code || !state) return;
    window.history.replaceState(null, "", window.location.pathname);
    setPending("google");
    void import("@/lib/privy-google")
      .then(({ completeGoogleLogin, googleLoginMessage }) =>
        completeGoogleLogin(code, state).then(
          () => startNavigation(() => router.push(BUSINESS_DASHBOARD_PATH)),
          (caught: unknown) => {
            const message = googleLoginMessage(caught);
            if (message) setError(message);
          },
        ),
      )
      .catch(() => setError(GOOGLE_FAILED))
      .finally(() => setPending(null));
  }, [router, startNavigation]);

  async function onEnter() {
    if (busy) return;
    setError(null);
    setPending("wallet");
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
      setPending(null);
    }
  }

  async function onGoogle() {
    if (busy) return;
    setError(null);
    setPending("google");
    const privy = await import("@/lib/privy-google").catch(() => null);
    if (!privy) {
      setError(GOOGLE_FAILED);
      setPending(null);
      return;
    }
    try {
      await privy.startGoogleLogin();
    } catch (caught) {
      setError(privy.googleLoginMessage(caught) ?? GOOGLE_FAILED);
      setPending(null);
    }
  }

  return (
    <div className="w-full max-w-[22.5rem]">
      <h1 className="text-[2rem] leading-tight font-semibold tracking-[-0.03em] text-forest">
        Iniciar sesión
      </h1>
      <p className="mt-1.5 text-[0.95rem] text-charcoal/60">
        {GOOGLE_ENABLED
          ? "Entrá con Google o con cualquier billetera Stellar."
          : "Entrá con cualquier billetera Stellar."}
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

        {GOOGLE_ENABLED ? (
          <>
            <button
              type="button"
              onClick={onGoogle}
              disabled={busy}
              aria-busy={pending === "google" || undefined}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-stone bg-white text-[0.95rem] font-medium text-charcoal transition-colors outline-none hover:bg-cream-deep focus-visible:ring-3 focus-visible:ring-forest/40 disabled:cursor-wait disabled:opacity-80"
            >
              <GoogleMark />
              {pending === "google" ? "Ingresando…" : "Continuar con Google"}
            </button>
            <div className="my-4 flex items-center gap-3 text-xs tracking-[0.14em] text-charcoal/45 uppercase">
              <span className="h-px flex-1 bg-stone" />
              o
              <span className="h-px flex-1 bg-stone" />
            </div>
          </>
        ) : null}

        <button
          type="button"
          onClick={onEnter}
          disabled={busy}
          aria-busy={pending === "wallet" || undefined}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-forest text-[0.95rem] font-medium text-cream transition-colors outline-none hover:bg-forest-soft focus-visible:ring-3 focus-visible:ring-forest/40 disabled:cursor-wait disabled:opacity-80"
        >
          <Wallet className="size-4" aria-hidden />
          {pending === "wallet" ? "Ingresando…" : "Entrar con la billetera"}
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

function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" className="size-4" aria-hidden>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58Z"
      />
    </svg>
  );
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
