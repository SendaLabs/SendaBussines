"use client";

import {
  SUPPLIER_PAYMENT_ERRORS,
  parseSupplierPayment,
  type SupplierPaymentField,
} from "@senda/shared";
import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useId, useRef, useState } from "react";

import { SUPPLIER_PAYMENTS_URL } from "@/lib/business-api";
import { cn } from "@/lib/utils";

const COUNTRIES = [
  { value: "AR", label: "Argentina" },
  { value: "CR", label: "Costa Rica" },
  { value: "US", label: "Estados Unidos" },
  { value: "ES", label: "España" },
] as const;

const FIELD_BY_MESSAGE: Record<string, SupplierPaymentField> = {
  [SUPPLIER_PAYMENT_ERRORS.supplierName]: "supplierName",
  [SUPPLIER_PAYMENT_ERRORS.supplierNameLength]: "supplierName",
  [SUPPLIER_PAYMENT_ERRORS.stellarAccount]: "stellarAccount",
  [SUPPLIER_PAYMENT_ERRORS.treasury]: "stellarAccount",
  [SUPPLIER_PAYMENT_ERRORS.country]: "country",
  [SUPPLIER_PAYMENT_ERRORS.amountUsd]: "amountUsd",
  [SUPPLIER_PAYMENT_ERRORS.dueOn]: "dueOn",
};

const SAVE_FAILED = "No se pudo registrar el pago.";

export function NewSupplierPaymentButton({
  treasuryAccount,
}: {
  treasuryAccount: string;
}) {
  const router = useRouter();
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const formSession = useRef(0);
  const requestId = useRef(0);
  const [supplierName, setSupplierName] = useState("");
  const [stellarAccount, setStellarAccount] = useState("");
  const [country, setCountry] = useState("");
  const [amount, setAmount] = useState("");
  const [dueOn, setDueOn] = useState("");
  const [errors, setErrors] = useState<Partial<Record<SupplierPaymentField, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const nameId = `${titleId}-name`;
  const accountId = `${titleId}-account`;
  const countryId = `${titleId}-country`;
  const amountId = `${titleId}-amount`;
  const dueId = `${titleId}-due`;

  function openDialog() {
    formSession.current += 1;
    setSupplierName("");
    setStellarAccount("");
    setCountry("");
    setAmount("");
    setDueOn("");
    setErrors({});
    setError(null);
    setPending(false);
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    nameRef.current?.focus();
  }

  function closeDialog() {
    dialogRef.current?.close();
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const session = formSession.current;
    const current = ++requestId.current;
    setError(null);
    setPending(true);

    try {
      const { StrKey } = await import("@stellar/stellar-sdk");
      const parsed = parseSupplierPayment(
        {
          supplierName,
          stellarAccount,
          country,
          amountUsd: amount,
          dueOn,
        },
        {
          treasuryAccount,
          isEd25519PublicKey: (account) => {
            try {
              return StrKey.isValidEd25519PublicKey(account);
            } catch {
              return false;
            }
          },
        },
      );
      if (formSession.current !== session || requestId.current !== current) return;
      if (!parsed.ok) {
        setErrors(parsed.fields);
        return;
      }
      setErrors({});

      const response = await fetch(SUPPLIER_PAYMENTS_URL, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.value),
      });
      if (response.ok) {
        dialogRef.current?.close();
        router.refresh();
        return;
      }
      if (formSession.current !== session || requestId.current !== current) return;
      const message = await readError(response);
      const field = FIELD_BY_MESSAGE[message];
      if (field) setErrors({ [field]: message });
      setError(message);
    } catch {
      if (formSession.current === session && requestId.current === current) {
        setError(SAVE_FAILED);
      }
    } finally {
      if (requestId.current === current) setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="inline-flex min-h-10 items-center rounded-full bg-forest px-4 text-sm font-medium text-cream outline-none hover:bg-forest-soft focus-visible:ring-2 focus-visible:ring-forest/40"
      >
        Nuevo pago
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="m-auto w-[min(32rem,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border border-stone bg-white p-0 text-left text-charcoal shadow-xl backdrop:bg-[#061f1b]/50"
      >
        <form className="p-5 sm:p-6" onSubmit={(event) => void onSubmit(event)} noValidate>
          <h2 id={titleId} className="text-lg font-semibold text-forest">
            Registrar pago a proveedor
          </h2>
          {error ? (
            <p
              role="alert"
              className="mt-4 rounded-xl border border-red-600/20 bg-white px-3 py-2.5 text-sm text-red-800"
            >
              {error}
            </p>
          ) : null}
          <div className="mt-4 space-y-4">
            <Field id={nameId} label="Nombre del proveedor" error={errors.supplierName}>
              <input
                ref={nameRef}
                id={nameId}
                name="supplierName"
                type="text"
                autoComplete="organization"
                value={supplierName}
                onChange={(event) => setSupplierName(event.target.value)}
                aria-invalid={errors.supplierName ? true : undefined}
                aria-describedby={errors.supplierName ? `${nameId}-error` : undefined}
                className={controlClass(Boolean(errors.supplierName))}
              />
            </Field>
            <Field id={accountId} label="Cuenta Stellar" error={errors.stellarAccount}>
              <input
                id={accountId}
                name="stellarAccount"
                type="text"
                autoComplete="off"
                spellCheck={false}
                value={stellarAccount}
                onChange={(event) => setStellarAccount(event.target.value)}
                aria-invalid={errors.stellarAccount ? true : undefined}
                aria-describedby={errors.stellarAccount ? `${accountId}-error` : undefined}
                className={cn(controlClass(Boolean(errors.stellarAccount)), "font-mono text-sm")}
              />
            </Field>
            <Field id={countryId} label="País" error={errors.country}>
              <select
                id={countryId}
                name="country"
                value={country}
                onChange={(event) => setCountry(event.target.value)}
                aria-invalid={errors.country ? true : undefined}
                aria-describedby={errors.country ? `${countryId}-error` : undefined}
                className={controlClass(Boolean(errors.country))}
              >
                <option value="">Elegí un país</option>
                {COUNTRIES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field id={amountId} label="Monto (USD)" error={errors.amountUsd}>
              <input
                id={amountId}
                name="amountUsd"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                aria-invalid={errors.amountUsd ? true : undefined}
                aria-describedby={errors.amountUsd ? `${amountId}-error` : undefined}
                className={controlClass(Boolean(errors.amountUsd))}
              />
            </Field>
            <Field id={dueId} label="Vencimiento" error={errors.dueOn}>
              <input
                id={dueId}
                name="dueOn"
                type="date"
                value={dueOn}
                onChange={(event) => setDueOn(event.target.value)}
                aria-invalid={errors.dueOn ? true : undefined}
                aria-describedby={errors.dueOn ? `${dueId}-error` : undefined}
                className={controlClass(Boolean(errors.dueOn))}
              />
            </Field>
          </div>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={closeDialog}
              className="inline-flex min-h-10 items-center rounded-full px-4 text-sm font-medium text-charcoal outline-none hover:bg-cream focus-visible:ring-2 focus-visible:ring-forest/30"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              aria-busy={pending || undefined}
              className="inline-flex min-h-10 items-center rounded-full bg-forest px-4 text-sm font-medium text-cream outline-none hover:bg-forest-soft focus-visible:ring-2 focus-visible:ring-forest/40 disabled:cursor-wait disabled:opacity-60"
            >
              {pending ? "Registrando…" : "Registrar pago"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-charcoal">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function controlClass(invalid: boolean) {
  return cn(
    "h-12 w-full rounded-xl border bg-white px-3.5 text-[0.95rem] text-charcoal outline-none focus-visible:ring-3",
    invalid
      ? "border-red-600/70 focus-visible:ring-red-600/15"
      : "border-stone focus-visible:border-forest/50 focus-visible:ring-forest/15",
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
    return SAVE_FAILED;
  }
  return SAVE_FAILED;
}
