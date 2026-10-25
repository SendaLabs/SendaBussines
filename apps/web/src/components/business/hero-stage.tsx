import {
  ArrowLeftRight,
  CreditCard,
  Home,
  Landmark,
  Settings,
} from "lucide-react";
import Image from "next/image";

const nav = [
  { label: "Inicio", icon: Home, active: true },
  { label: "Tesorería", icon: Landmark, active: false },
  { label: "Pagos masivos", icon: ArrowLeftRight, active: false },
  { label: "Tarjetas", icon: CreditCard, active: false },
  { label: "Configuración", icon: Settings, active: false },
] as const;

const rows = [
  ["17 ago", "Proveedor LATAM", "$ 12.360,00", "Completado"],
  ["10 ago", "Pago México", "$ 8.210,00", "Completado"],
  ["4 ago", "Nómina Chile", "$ 18.450,00", "Completado"],
] as const;

export function BusinessHeroStage() {
  return (
    <div className="relative mx-auto w-full max-w-[42rem] lg:max-w-none lg:pr-6 lg:pl-8">
      <div
        className="pointer-events-none absolute top-[18%] left-[12%] h-[58%] w-[76%] rounded-full bg-[#1d6b58]/40 blur-3xl"
        aria-hidden
      />

      <div className="[perspective:1800px]">
        <div className="relative mx-auto w-[90%] origin-bottom [transform:rotateX(7deg)_rotateY(-6deg)]">
          <div className="rounded-[1.45rem] bg-[#0b0e0d] p-[0.7rem] pt-3 shadow-[0_50px_90px_rgba(0,0,0,0.5)] ring-1 ring-white/12">
            <div className="mb-2 flex items-center justify-center" aria-hidden>
              <span className="size-1.5 rounded-full bg-[#2b3330] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]" />
            </div>
            <div
              className="overflow-hidden rounded-[0.65rem] bg-[#f7f6f2]"
              role="img"
              aria-label="Vista previa del panel de Senda Business"
            >
              <DashboardScreen />
            </div>
          </div>
          <div
            className="mx-auto h-3 w-[102%] -translate-x-[1%] rounded-b-[1.25rem] bg-gradient-to-b from-[#2f3633] via-[#171c1a] to-[#0a0c0b]"
            aria-hidden
          />
          <div
            className="mx-auto -mt-0.5 h-3 w-[64%] rounded-[100%] bg-black/45 blur-md"
            aria-hidden
          />
        </div>
      </div>

      <article className="absolute top-[3%] right-4 z-10 hidden w-[11.4rem] rounded-2xl border border-white/20 bg-gradient-to-br from-[#1b4a43]/92 to-[#0c241f]/92 p-3.5 text-white shadow-[0_18px_40px_rgba(0,0,0,0.32)] backdrop-blur-md sm:block">
        <div className="flex items-center justify-between text-[0.62rem] tracking-[0.16em] uppercase">
          <span className="font-medium">Senda</span>
          <span className="text-white/65">Virtual</span>
        </div>
        <p className="mt-7 font-mono text-[0.8rem] tracking-[0.28em] text-white/90">
          •••• 4587
        </p>
        <div className="mt-5 flex items-end justify-between">
          <p className="text-[0.62rem] tracking-[0.18em] text-white/50 uppercase">
            Virtual
          </p>
          <p className="text-[0.78rem] font-semibold tracking-[0.12em] italic">
            VISA
          </p>
        </div>
      </article>

      <article className="absolute top-[38%] right-3 z-10 hidden w-[12.2rem] rounded-2xl border border-white/45 bg-white/92 p-3.5 text-[#123c36] shadow-[0_16px_36px_rgba(0,0,0,0.2)] backdrop-blur-md sm:block">
        <p className="text-[0.72rem] font-medium">Límites y control</p>
        <dl className="mt-2.5 space-y-2 text-[0.68rem]">
          <LimitRow label="Gasto diario" value="$ 2.000.000 / mes" delta="+12" />
          <LimitRow label="Tarjetas activas" value="12" />
          <LimitRow label="Países habilitados" value="15" delta="+35" />
        </dl>
      </article>

      <article className="absolute bottom-[10%] left-0 z-10 flex items-center gap-2 rounded-2xl border border-white/45 bg-white/92 px-3 py-2 text-[#123c36] shadow-[0_14px_30px_rgba(0,0,0,0.18)] backdrop-blur-md">
        <span
          className="flex size-6 items-center justify-center rounded-full bg-[#123c36] text-white"
          aria-hidden
        >
          <svg viewBox="0 0 24 24" className="size-3.5" fill="currentColor">
            <path d="M12 2.2 14.1 9.9 21.8 12 14.1 14.1 12 21.8 9.9 14.1 2.2 12 9.9 9.9Z" />
          </svg>
        </span>
        <p className="text-[0.72rem] font-medium">Impulsado por Stellar</p>
      </article>
    </div>
  );
}

function DashboardScreen() {
  return (
    <div className="grid min-h-[18.5rem] grid-cols-[4.4rem_1fr] text-[#171918] sm:min-h-[24rem] sm:grid-cols-[7.6rem_1fr]">
      <aside className="border-r border-[#e4e0d6] bg-[#f3f0e8] px-2 py-3 sm:px-3">
        <Image
          src="/images/logoverde.png"
          alt=""
          width={120}
          height={28}
          className="mb-4 h-3.5 w-auto sm:h-4"
        />
        <ul className="space-y-1">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <li
                key={item.label}
                className={
                  item.active
                    ? "flex items-center gap-1.5 rounded-md bg-[#123c36] px-1.5 py-1.5 text-[0.58rem] text-[#f4f1e8] sm:text-[0.65rem]"
                    : "flex items-center gap-1.5 rounded-md px-1.5 py-1.5 text-[0.58rem] text-[#123c36]/75 sm:text-[0.65rem]"
                }
              >
                <Icon className="size-3 shrink-0" strokeWidth={1.75} />
                <span className="truncate">{item.label}</span>
              </li>
            );
          })}
        </ul>
      </aside>

      <div className="space-y-2 bg-[#fbfaf6] px-2.5 py-2.5 sm:space-y-2.5 sm:px-3.5 sm:py-3">
        <div className="flex items-center justify-between">
          <p className="text-[0.78rem] font-medium sm:text-[0.9rem]">
            Hola, equipo
          </p>
          <p className="text-[0.58rem] text-[#123c36]/50">Últimos 30 días</p>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          <Kpi label="Saldo total" value="$ 245.320,00" />
          <Kpi label="Pagos realizados" value="128" />
          <Kpi label="Comisión" value="$ 2.730,00" hint="2%" />
        </div>

        <div className="grid grid-cols-[1.45fr_0.85fr] gap-1.5">
          <div className="rounded-lg border border-[#e6e2d6] bg-white px-2 py-1.5">
            <p className="text-[0.55rem] text-[#123c36]/55">Flujo de fondos</p>
            <svg
              viewBox="0 0 160 52"
              className="mt-1 h-11 w-full sm:h-14"
              aria-hidden
            >
              <path
                d="M0 38 C18 36 28 22 46 24 C64 26 72 12 90 16 C108 20 118 32 140 14 L160 10 L160 52 L0 52 Z"
                fill="#123c36"
                fillOpacity="0.08"
              />
              <path
                d="M0 38 C18 36 28 22 46 24 C64 26 72 12 90 16 C108 20 118 32 140 14 L160 10"
                fill="none"
                stroke="#123c36"
                strokeWidth="1.6"
              />
            </svg>
          </div>
          <div className="rounded-lg border border-[#e6e2d6] bg-white px-2 py-1.5">
            <p className="text-[0.55rem] text-[#123c36]/55">
              Distribución de gastos
            </p>
            <div className="mt-1.5 flex items-center gap-2">
              <div
                className="size-9 shrink-0 rounded-full sm:size-11"
                style={{
                  background:
                    "conic-gradient(#123c36 0 42%, #3d5c56 42% 74%, #d9d5ca 74% 100%)",
                }}
                aria-hidden
              />
              <ul className="text-[0.5rem] leading-tight text-[#123c36]/80 sm:text-[0.58rem]">
                <li>42% Operativo</li>
                <li>32% Nómina</li>
                <li>26% Otros</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-[#e6e2d6] bg-white px-2 py-1.5">
          <p className="text-[0.55rem] text-[#123c36]/55">Pagos recientes</p>
          <table className="mt-1 w-full text-left text-[0.5rem] sm:text-[0.58rem]">
            <thead className="text-[#123c36]/40">
              <tr>
                <th className="py-0.5 font-medium">Fecha</th>
                <th className="font-medium">Destinatario</th>
                <th className="font-medium">Monto</th>
                <th className="hidden font-medium sm:table-cell">Estado</th>
              </tr>
            </thead>
            <tbody className="text-[#171918]/85">
              {rows.map((row) => (
                <tr key={row[1]}>
                  <td className="py-0.5">{row[0]}</td>
                  <td>{row[1]}</td>
                  <td>{row[2]}</td>
                  <td className="hidden sm:table-cell">{row[3]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-[#e6e2d6] bg-white px-1.5 py-1.5 sm:px-2">
      <p className="truncate text-[0.5rem] text-[#123c36]/50 sm:text-[0.55rem]">
        {label}
      </p>
      <p className="text-[0.68rem] font-medium tracking-tight sm:text-[0.8rem]">
        {value}
      </p>
      {hint ? (
        <p className="text-[0.5rem] text-[#123c36]/45">{hint}</p>
      ) : null}
    </div>
  );
}

function LimitRow({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-[#123c36]/60">{label}</dt>
      <dd className="text-right">
        <span className="block font-medium">{value}</span>
        {delta ? (
          <span className="text-[0.6rem] text-[#123c36]/45">{delta}</span>
        ) : null}
      </dd>
    </div>
  );
}
