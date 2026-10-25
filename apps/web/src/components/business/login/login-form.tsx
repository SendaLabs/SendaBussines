"use client";

import { ArrowRight, Eye, EyeOff, Info, Lock, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useId, useState, useTransition } from "react";

import { BUSINESS_DASHBOARD_PATH, site } from "@/lib/site";
import { cn } from "@/lib/utils";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FieldErrors = { email?: string; password?: string };

export function LoginForm() {
  const id = useId();
  const router = useRouter();
  const [isNavigating, startNavigation] = useTransition();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [showNotice, setShowNotice] = useState(false);

  const emailId = `${id}-email`;
  const passwordId = `${id}-password`;
  const forgotHref = `mailto:${site.email}?subject=${encodeURIComponent("Recuperar acceso a Senda Business")}`;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: FieldErrors = {};
    if (!EMAIL_PATTERN.test(email.trim())) {
      next.email = "Ingresá un email válido.";
    }
    if (!password) {
      next.password = "Ingresá tu contraseña.";
    }
    setErrors(next);
    setShowNotice(false);
    if (Object.keys(next).length > 0) return;
    setPassword("");
    startNavigation(() => router.push(BUSINESS_DASHBOARD_PATH));
  }

  return (
    <div className="w-full max-w-[22.5rem]">
      <h1 className="text-[2rem] leading-tight font-semibold tracking-[-0.03em] text-forest">
        Iniciar sesión
      </h1>
      <p className="mt-1.5 text-[0.95rem] text-charcoal/60">
        Ingresá a tu cuenta de Senda Business.
      </p>

      <form className="mt-8 space-y-5" onSubmit={onSubmit} noValidate>
        <div>
          <label
            htmlFor={emailId}
            className="mb-2 block text-sm font-medium text-charcoal"
          >
            Email
          </label>
          <div className="relative">
            <Mail
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-charcoal/45"
              strokeWidth={1.75}
              aria-hidden
            />
            <input
              id={emailId}
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              placeholder="tu@empresa.com"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                if (errors.email) {
                  setErrors((prev) => ({ ...prev, email: undefined }));
                }
              }}
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={errors.email ? `${emailId}-error` : undefined}
              className={inputClass(Boolean(errors.email))}
            />
          </div>
          {errors.email ? (
            <p id={`${emailId}-error`} className="mt-1.5 text-xs text-red-700">
              {errors.email}
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor={passwordId}
            className="mb-2 block text-sm font-medium text-charcoal"
          >
            Contraseña
          </label>
          <div className="relative">
            <Lock
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-charcoal/45"
              strokeWidth={1.75}
              aria-hidden
            />
            <input
              id={passwordId}
              type={showPassword ? "text" : "password"}
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                if (errors.password) {
                  setErrors((prev) => ({ ...prev, password: undefined }));
                }
              }}
              aria-invalid={errors.password ? true : undefined}
              aria-describedby={
                errors.password ? `${passwordId}-error` : undefined
              }
              className={cn(inputClass(Boolean(errors.password)), "pr-11")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              aria-pressed={showPassword}
              className="absolute top-1/2 right-1.5 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-charcoal/50 outline-none hover:text-forest focus-visible:ring-2 focus-visible:ring-forest/30"
            >
              {showPassword ? (
                <EyeOff className="size-4" strokeWidth={1.75} />
              ) : (
                <Eye className="size-4" strokeWidth={1.75} />
              )}
            </button>
          </div>
          {errors.password ? (
            <p
              id={`${passwordId}-error`}
              className="mt-1.5 text-xs text-red-700"
            >
              {errors.password}
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3 text-sm">
          <label className="flex cursor-pointer items-center gap-2.5 text-charcoal">
            <input
              type="checkbox"
              name="remember"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
              className="size-4 cursor-pointer rounded accent-forest"
            />
            Recordarme
          </label>
          <a
            href={forgotHref}
            className="font-medium text-forest underline underline-offset-4 hover:no-underline"
          >
            ¿Olvidaste tu contraseña?
          </a>
        </div>

        <button
          type="submit"
          disabled={isNavigating}
          aria-busy={isNavigating || undefined}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-forest text-[0.95rem] font-medium text-cream transition-colors outline-none hover:bg-forest-soft focus-visible:ring-3 focus-visible:ring-forest/40 disabled:cursor-wait disabled:opacity-80"
        >
          {isNavigating ? "Ingresando…" : "Iniciar sesión"}
          <ArrowRight className="size-4" aria-hidden />
        </button>
      </form>

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

function inputClass(invalid: boolean) {
  return cn(
    "h-12 w-full rounded-xl border bg-white pr-3.5 pl-10 text-[0.95rem] text-charcoal outline-none transition-colors placeholder:text-charcoal/40 focus-visible:ring-3",
    invalid
      ? "border-red-600/70 focus-visible:ring-red-600/15"
      : "border-stone focus-visible:border-forest/50 focus-visible:ring-forest/15",
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
