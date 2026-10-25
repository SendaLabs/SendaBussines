import {
  ArrowLeftRight,
  Blocks,
  ChartColumn,
  CreditCard,
  FileText,
  House,
  Landmark,
  Receipt,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import {
  supplierPaymentCanBeFunded,
  supplierPaymentCanBeReleased,
  type BusinessDashboard,
  type BusinessPaymentStatus,
} from "@senda/shared";

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

const pct = new Intl.NumberFormat("es-AR", {
  style: "percent",
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
});

const NAV: readonly { label: string; icon: LucideIcon; soon?: boolean }[] = [
  { label: "Inicio", icon: House },
  { label: "Pagos", icon: ArrowLeftRight, soon: true },
  { label: "Cuentas a pagar", icon: FileText, soon: true },
  { label: "Gastos", icon: Receipt, soon: true },
  { label: "Tarjetas", icon: CreditCard, soon: true },
  { label: "Tesorería", icon: Landmark, soon: true },
  { label: "Reportes", icon: ChartColumn, soon: true },
  { label: "Integraciones", icon: Blocks, soon: true },
];

const CATEGORY_LABELS: Record<string, string> = {
  software: "Software",
  services: "Servicios",
  marketing: "Marketing",
  operations: "Operaciones",
  people: "RRHH",
  other: "Otros",
};

const STATUS_LABELS: Record<BusinessPaymentStatus, string> = {
  pending: "Pendiente",
  scheduled: "Programado",
  approved: "Aprobado",
  released: "Liberado",
};

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
              region={filters.region}
              treasuryAccount={treasuryAccount}
            />
            <KpiGrid data={data} />

            <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,0.8fr)]">
              <CashFlow points={data.cashFlow} range={filters.range} />
              <Categories data={data} />
              <Cards data={data} />
            </div>

            <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1.1fr)_minmax(0,0.75fr)]">
              <Upcoming data={data} />
              <Activity data={data} />
              <Countries data={data} region={filters.region} />
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
          {NAV.map(({ label, icon: Icon, soon }) => (
            <li key={label}>
              {soon ? (
                <span className="flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm text-white/60">
                  <Icon className="size-[1.1rem]" strokeWidth={1.75} aria-hidden />
                  <span className="flex-1">{label}</span>
                  <span className="rounded-full bg-white/8 px-2 py-0.5 text-[0.65rem] text-white/55">
                    Pronto
                  </span>
                </span>
              ) : (
                <Link
                  href={BUSINESS_DASHBOARD_PATH}
                  aria-current="page"
                  className="flex min-h-10 items-center gap-3 rounded-xl bg-white/10 px-3 text-sm font-medium text-white outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                >
                  <Icon className="size-[1.1rem]" strokeWidth={1.75} aria-hidden />
                  {label}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-auto space-y-3 pt-8">
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

        <div className="flex items-center gap-3 px-2">
          <Image
            src={user.avatar}
            alt=""
            width={36}
            height={36}
            className="size-9 rounded-full object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user.fullName}</p>
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
  region,
  treasuryAccount,
}: {
  data: BusinessDashboard;
  region: DashboardFilters["region"];
  treasuryAccount: string;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="mb-2 inline-flex items-center gap-2">
          <span className="rounded-full bg-forest/10 px-2.5 py-0.5 text-[0.68rem] font-medium tracking-wide text-forest uppercase">
            Demo
          </span>
          <span className="text-xs text-charcoal/55">
            Datos de ejemplo. Montos en USD.
          </span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-forest sm:text-[1.75rem]">
          Buenas, {data.user.firstName}.
        </h1>
        <p className="mt-1 text-sm text-charcoal/65">
          Acá tenés el resumen de tu operación.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-xl border border-stone bg-white px-3 py-2 text-sm text-charcoal">
          {COUNTRY_LABELS[region] ?? region}
        </span>
        <span className="rounded-xl border border-stone bg-white px-3 py-2 text-sm text-charcoal">
          {data.period.from.slice(8)}/{data.period.from.slice(5, 7)} –{" "}
          {data.period.to.slice(8)}/{data.period.to.slice(5, 7)}
        </span>
        <NewSupplierPaymentButton treasuryAccount={treasuryAccount} />
      </div>
    </div>
  );
}

function KpiGrid({ data }: { data: BusinessDashboard }) {
  const items = [
    {
      label: "Saldo total",
      value: money.format(data.kpis.balance.value),
      hint: `${pct.format(data.kpis.balance.change)} vs. mes anterior`,
    },
    {
      label: "Por pagar",
      value: money.format(data.kpis.payable.value),
      hint: `${data.kpis.payable.invoices} facturas · próximo vencimiento`,
    },
    {
      label: "Gastos este mes",
      value: money.format(data.kpis.spend.value),
      hint: `${pct.format(data.kpis.spend.change)} vs. mes anterior`,
    },
    {
      label: "Pagos internacionales",
      value: money.format(data.kpis.international.value),
      hint: `${data.kpis.international.payments} pagos procesados`,
    },
  ];

  return (
    <section
      aria-label="Indicadores principales"
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
    >
      {items.map((item) => (
        <article
          key={item.label}
          className="rounded-2xl border border-stone/80 bg-white px-4 py-4 shadow-[0_1px_0_rgba(23,25,24,0.04)]"
        >
          <p className="text-sm text-charcoal/55">{item.label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-forest">
            {item.value}
          </p>
          <p className="mt-1 text-xs text-charcoal/50">{item.hint}</p>
        </article>
      ))}
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

function CashFlow({
  points,
  range,
}: {
  points: BusinessDashboard["cashFlow"];
  range: DashboardFilters["range"];
}) {
  const slice = range === "6" ? points.slice(-6) : points;
  const max = Math.max(...slice.flatMap((p) => [p.income, p.expenses]), 1);

  return (
    <Panel
      title="Flujo de caja"
      action={
        <span className="text-xs text-charcoal/55">
          {range === "6" ? "Últimos 6 meses" : "Últimos 12 meses"}
        </span>
      }
    >
      <div className="flex h-44 items-end gap-1.5 sm:gap-2">
        {slice.map((point) => (
          <div key={point.month} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <div className="flex h-36 w-full items-end justify-center gap-0.5">
              <span
                className="w-[45%] rounded-t-md bg-forest/85"
                style={{ height: `${(point.income / max) * 100}%` }}
                title={`Ingresos ${money.format(point.income)}`}
              />
              <span
                className="w-[45%] rounded-t-md bg-stone"
                style={{ height: `${(point.expenses / max) * 100}%` }}
                title={`Gastos ${money.format(point.expenses)}`}
              />
            </div>
            <span className="text-[0.58rem] text-charcoal/45">
              {point.month.slice(5)}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-4 text-xs text-charcoal/60">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-forest/85" /> Ingresos
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-stone" /> Gastos
        </span>
      </div>
    </Panel>
  );
}

function Categories({ data }: { data: BusinessDashboard }) {
  const total = data.categories.slices.reduce((sum, s) => sum + s.amount, 0) || 1;
  return (
    <Panel title="Gastos por categoría">
      <ul className="space-y-3">
        {data.categories.slices.map((slice) => {
          const share = slice.amount / total;
          return (
            <li key={slice.key}>
              <div className="mb-1 flex justify-between text-sm">
                <span className="text-charcoal">
                  {CATEGORY_LABELS[slice.key] ?? slice.key}
                </span>
                <span className="font-medium text-forest">
                  {money.format(slice.amount)}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-cream-deep">
                <div
                  className="h-full rounded-full bg-forest"
                  style={{ width: `${share * 100}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

function Cards({ data }: { data: BusinessDashboard }) {
  return (
    <Panel title="Tarjetas corporativas">
      <div className="rounded-2xl bg-gradient-to-br from-[#1b4a43] to-[#0c241f] p-4 text-white">
        <p className="text-xs tracking-[0.16em] uppercase text-white/65">Senda</p>
        <p className="mt-8 font-mono text-lg tracking-[0.28em]">
          •••• {data.cards.last4}
        </p>
        <div className="mt-6 flex items-end justify-between text-sm">
          <span className="text-white/70">{data.cards.currency}</span>
          <span className="italic">VISA</span>
        </div>
      </div>
      <p className="mt-3 text-sm text-charcoal/65">
        {data.cards.active}/{data.cards.total} tarjetas activas
      </p>
    </Panel>
  );
}

function Upcoming({ data }: { data: BusinessDashboard }) {
  return (
    <Panel title="Próximos pagos">
      {data.upcomingPayments.length === 0 ? (
        <p className="text-sm text-charcoal/55">
          No hay pagos programados para este país.
        </p>
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
                    {STATUS_LABELS[payment.status]}
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
        <p className="text-sm text-charcoal/55">
          No hay movimientos recientes para este país.
        </p>
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

function Countries({
  data,
  region,
}: {
  data: BusinessDashboard;
  region: DashboardFilters["region"];
}) {
  const volumes =
    region === "global"
      ? data.countryVolumes
      : data.countryVolumes.filter((item) => item.country === region);

  return (
    <Panel title="Operación por país">
      <ul className="space-y-3">
        {volumes.map((item) => (
          <li
            key={item.country}
            className="flex items-center justify-between rounded-xl bg-cream/60 px-3 py-2.5 text-sm"
          >
            <span className="font-medium text-charcoal">
              {COUNTRY_LABELS[item.country]}
            </span>
            <span className="text-forest">{money.format(item.amount)}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
