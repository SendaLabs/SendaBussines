import Image from "next/image";
import Link from "next/link";

import { LoginForm } from "@/components/business/login/login-form";
import { BUSINESS_PATH } from "@/lib/site";

const stats = [
  { value: "LATAM", label: "Corredores" },
  { value: "", label: "Pagos en stablecoins" },
  { value: "", label: "Seguridad empresarial" },
] as const;

export function BusinessLoginPage() {
  return (
    <main className="min-h-dvh bg-cream lg:grid lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
      <aside className="relative isolate flex min-h-[19rem] flex-col overflow-hidden bg-[#061f1b] px-6 pt-7 pb-6 text-white sm:px-10 lg:min-h-dvh lg:px-12 lg:pt-10 lg:pb-8">
        <div
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_30%_20%,rgba(28,92,74,0.45),transparent_60%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-[18%] -z-10 rounded-full bg-[radial-gradient(circle_at_32%_28%,#3a6b5f,transparent_46%),radial-gradient(circle_at_50%_50%,#1b3d36_0%,#0b1a17_78%)] opacity-80"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#061f1b] via-[#061f1b]/70 to-transparent"
          aria-hidden
        />

        <Link
          href={BUSINESS_PATH}
          className="relative flex w-fit items-center gap-2.5"
          aria-label="Senda Business, inicio"
        >
          <Image
            src="/images/logoblanco.png"
            alt=""
            width={420}
            height={110}
            className="h-7 w-auto"
            sizes="120px"
            priority
          />
          <span className="border-l border-white/35 pl-2.5 text-[0.95rem] text-white/80">
            business
          </span>
        </Link>

        <div className="relative mt-10 lg:mt-24">
          <p className="max-w-[13ch] text-[2rem] leading-[1.1] font-medium tracking-[-0.03em] sm:text-[2.4rem] lg:text-[2.6rem]">
            Una plataforma para ir más lejos.
          </p>
          <p className="mt-5 hidden max-w-[36ch] text-[0.95rem] leading-relaxed text-white/75 sm:block">
            Gestioná tu operación financiera global desde un solo lugar. Pagos,
            gastos, cuentas y tarjetas, en todos los países donde operes.
          </p>
        </div>

        <ul className="relative mt-auto hidden grid-cols-3 divide-x divide-white/20 pt-10 text-center lg:grid">
          {stats.map((stat) => (
            <li
              key={stat.label}
              className="flex flex-col items-center justify-center px-3"
            >
              {stat.value ? (
                <span className="text-lg font-semibold">{stat.value}</span>
              ) : null}
              <span className="max-w-[12ch] text-xs leading-snug text-white/70">
                {stat.label}
              </span>
            </li>
          ))}
        </ul>
      </aside>

      <section className="flex min-h-[calc(100dvh-19rem)] flex-col px-6 py-6 sm:px-10 lg:min-h-dvh lg:px-14 lg:py-8">
        <div className="flex items-center justify-end gap-4">
          <p className="text-sm text-charcoal/65">
            ¿No tenés una cuenta?{" "}
            <a
              href={`mailto:hola@withsenda.site?subject=${encodeURIComponent("Registro Senda Business")}`}
              className="cursor-pointer font-medium text-forest underline underline-offset-4 hover:no-underline"
            >
              Registrate
            </a>
          </p>
        </div>

        <div className="flex flex-1 items-center justify-center py-10 lg:justify-start lg:pl-[8%]">
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
