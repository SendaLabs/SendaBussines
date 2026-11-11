import { House, type LucideIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import {
  supplierPaymentCanBeFunded,
  supplierPaymentCanBeReleased,
  type BusinessDashboard,
  type BusinessPaymentStatus,
} from "@senda/shared";

import { DashboardFilterBar } from "@/components/business/dashboard/dashboard-filter-bar";
import type { DashboardFilters } from "@/components/business/dashboard/filters";
import { FundEscrowButton } from "@/components/business/dashboard/fund-escrow-button";
import { LogoutButton } from "@/components/business/dashboard/logout-button";
import { MobileNav } from "@/components/business/dashboard/mobile-nav";
import { NewSupplierPaymentButton } from "@/components/business/dashboard/new-supplier-payment-dialog";
import { ReleaseMilestoneButton } from "@/components/business/dashboard/release-milestone-button";
import { BUSINESS_DASHBOARD_PATH } from "@/lib/site";
import { cn } from "@/lib/utils";

const money = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const NAV: readonly { label: string; icon: LucideIcon }[] = [
  { label: "Inicio", icon: House },
];

const STATUS_LABELS: Record<BusinessPaymentStatus, string> = {
  pending: "Pendiente",
  scheduled: "Programado",
  approved: "Aprobado",
  released: "Liberado",
};

function paymentStatusLabel(payment: BusinessDashboard["upcomingPayments"][number]): string {
  if (payment.status === "approved" && (payment.escrowContractId?.trim() ?? "").length === 0) {
    return "Sin depósito";
  }
  return STATUS_LABELS[payment.status];
}

const ACTIVITY_LABELS = {
  supplierPayment: "Pago a proveedor",
  internationalTransfer: "Transferencia internacional",
  fundsReceived: "Fondos recibidos",
  cardSpend: "Consumo con tarjeta",
} as const;

const COUNTRY_LABELS: Record<string, string> = {
  AR: "Argentina",
  CR: "Costa Rica",
  US: "Estados Unidos",
  ES: "España",
  global: "Global · Todos los países",
};

export function BusinessDashboardPage({
  data,
  filters,
  treasuryAccount,
}: {
  data: BusinessDashboard;
  filters: DashboardFilters;
  treasuryAccount: string;
}) {
  const sidebar = <Sidebar company={data.company} user={data.user} />;

  return (
    <>
      <a
        href="#panel"
        className="sr-only z-[60] rounded-lg bg-forest px-4 py-2 text-cream focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Saltar al contenido
      </a>

      <div className="min-h-dvh bg-[#f3f1ea] lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)]">
        <aside className="sticky top-0 hidden h-dvh overflow-y-auto bg-[#061f1b] text-white lg:block">
          {sidebar}
        </aside>

        <div className="min-w-0">
          <div className="sticky top-0 z-40 flex h-16 items-center justify-between bg-[#061f1b] px-4 lg:hidden">
            <Link
              href={BUSINESS_DASHBOARD_PATH}
              aria-label="Senda Business, inicio"
              className="flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              <Image
                src="/images/logoblanco.png"
                alt=""
                width={420}
                height={110}
                className="h-6 w-auto"
                sizes="100px"
                priority
              />
              <span className="border-l border-white/30 pl-2.5 text-sm text-white/75">
                business
              </span>
            </Link>
            <MobileNav>{sidebar}</MobileNav>
          </div>

          <main
            id="panel"
            tabIndex={-1}
            className="mx-auto w-full max-w-[1520px] space-y-5 px-4 py-6 outline-none sm:px-6 lg:px-8 lg:py-8"
          >
            <Header
              data={data}
              filters={filters}
              treasuryAccount={treasuryAccount}
            />
            <KpiGrid data={data} />

            <div className="grid gap-5 lg:grid-cols-2">
              <Upcoming data={data} />
              <Activity data={data} />
            </div>
          </main>
        </div>
      </div>
    </>
  );
}

function Sidebar({
  company,
  user,
}: Pick<BusinessDashboard, "company" | "user">) {
  return (
    <div className="flex h-full flex-col px-4 pt-6 pb-4">
      <Link
        href={BUSINESS_DASHBOARD_PATH}
        aria-label="Senda Business, inicio"
        className="flex w-fit items-center gap-2.5 rounded-lg px-2 outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      >
        <Image
          src="/images/logoblanco.png"
          alt=""
          width={420}
          height={110}
          className="h-6 w-auto"
          sizes="100px"
        />
        <span className="border-l border-white/30 pl-2.5 text-sm text-white/75">
          business
        </span>
      </Link>

      <nav aria-label="Secciones del panel" className="mt-9">
        <ul className="space-y-1">
          {NAV.map(({ label, icon: Icon }) => (
            <li key={label}>
              <Link
                href={BUSINESS_DASHBOARD_PATH}
                aria-current="page"
                className="flex min-h-10 items-center gap-3 rounded-xl bg-white/10 px-3 text-sm font-medium text-white outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              >
                <Icon className="size-[1.1rem]" strokeWidth={1.75} aria-hidden />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-auto space-y-3 pt-8">
        {company.name ? (
          <div className="flex items-center gap-3 rounded-xl bg-white/6 px-3 py-3">
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#3f8a72] text-sm font-semibold"
              aria-hidden
            >
              {company.name.charAt(0)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{company.name}</p>
              <p className="text-xs text-white/60">{company.countries} países</p>
            </div>
          </div>
        ) : null}

        <div className="flex items-center gap-3 px-2">
          {user.avatar ? (
            <Image
              src={user.avatar}
              alt=""
              width={36}
              height={36}
              className="size-9 rounded-full object-cover"
            />
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {user.fullName || "Sesión"}
            </p>
            <p className="text-xs text-white/60">Admin</p>
          </div>
          <LogoutButton />
        </div>
      </div>
    </div>
  );
}

function Header({
  data,
  filters,
  treasuryAccount,
}: {
  data: BusinessDashboard;
  filters: DashboardFilters;
  treasuryAccount: string;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-forest sm:text-[1.75rem]">
          {data.user.firstName ? `Buenas, ${data.user.firstName}.` : "Buenas."}
        </h1>
        <p className="mt-1 text-sm text-charcoal/65">
          Acá tenés los pagos de la empresa. Montos en USD.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <DashboardFilterBar filters={filters} />
        <NewSupplierPaymentButton treasuryAccount={treasuryAccount} />
      </div>
    </div>
  );
}

function KpiGrid({ data }: { data: BusinessDashboard }) {
  return (
    <section aria-label="Indicadores principales" className="grid gap-3 sm:max-w-sm">
      <article className="rounded-2xl border border-stone/80 bg-white px-4 py-4 shadow-[0_1px_0_rgba(23,25,24,0.04)]">
        <p className="text-sm text-charcoal/55">Por pagar</p>
        <p className="mt-2 text-2xl font-semibold tracking-tight text-forest">
          {money.format(data.kpis.payable.value)}
        </p>
        <p className="mt-1 text-xs text-charcoal/50">
          {data.kpis.payable.invoices} facturas pendientes
        </p>
      </article>
    </section>
  );
}

function Panel({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-stone/80 bg-white p-4 shadow-[0_1px_0_rgba(23,25,24,0.04)] sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-forest">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Upcoming({ data }: { data: BusinessDashboard }) {
  return (
    <Panel title="Próximos pagos">
      {data.upcomingPayments.length === 0 ? (
        <p className="text-sm text-charcoal/55">No hay pagos registrados.</p>
      ) : (
        <ul className="divide-y divide-stone/70">
          {data.upcomingPayments.map((payment) => (
            <li key={payment.id} className="py-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-charcoal">
                    {payment.supplier}
                  </p>
                  <p className="text-xs text-charcoal/50">
                    {payment.dueDate === data.today ? "Hoy" : payment.dueDate} ·{" "}
                    {COUNTRY_LABELS[payment.country]}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-forest">
                    {money.format(payment.amount)}
                  </p>
                  <p className="text-xs text-charcoal/50">
                    {paymentStatusLabel(payment)}
                  </p>
                </div>
              </div>
              {supplierPaymentCanBeFunded(payment) ? (
                <FundEscrowButton paymentId={payment.id} />
              ) : null}
              {supplierPaymentCanBeReleased(payment) ? (
                <ReleaseMilestoneButton paymentId={payment.id} />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function Activity({ data }: { data: BusinessDashboard }) {
  return (
    <Panel title="Actividad reciente">
      {data.activity.length === 0 ? (
        <p className="text-sm text-charcoal/55">No hay movimientos registrados.</p>
      ) : (
        <ul className="divide-y divide-stone/70">
          {data.activity.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 py-3 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-charcoal">
                  {ACTIVITY_LABELS[item.kind]} · {item.counterparty}
                </p>
                <p className="text-xs text-charcoal/50">
                  De {COUNTRY_LABELS[item.from]} a {COUNTRY_LABELS[item.to]}
                </p>
              </div>
              <p
                className={cn(
                  "shrink-0 font-medium",
                  item.amount >= 0 ? "text-forest" : "text-charcoal",
                )}
              >
                {money.format(item.amount)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

