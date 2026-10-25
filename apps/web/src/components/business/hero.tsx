import {
  ArrowRight,
  CreditCard,
  Globe2,
  Mail,
  Shield,
  Zap,
} from "lucide-react";
import Link from "next/link";

import { BusinessHeroStage } from "@/components/business/hero-stage";
import { Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { BUSINESS_LOGIN_PATH, getBusinessMailto } from "@/lib/site";

const pillars = [
  {
    title: "Más control",
    copy: "Visibilidad de tus fondos y gastos, en tiempo real.",
    icon: Shield,
  },
  {
    title: "Pagos más simples",
    copy: "Automatizá pagos masivos y ahorrá tiempo.",
    icon: Zap,
  },
  {
    title: "Tarjetas corporativas",
    copy: "Físicas y virtuales, con control total desde un solo lugar.",
    icon: CreditCard,
  },
  {
    title: "Alcance global",
    copy: "Operá en LATAM con la seguridad de la red Stellar.",
    icon: Globe2,
  },
] as const;

export function BusinessHero() {
  return (
    <section id="top" className="relative isolate">
      <div className="relative -mt-[4.5rem] overflow-x-clip bg-[#061f1b] pt-[4.5rem] text-cream">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_72%_42%,rgba(28,92,74,0.55),transparent_58%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/25 to-transparent"
          aria-hidden
        />

        <Shell className="relative z-10 grid items-center gap-12 py-16 lg:grid-cols-[32rem_minmax(0,1fr)] lg:gap-4 lg:py-[4.5rem]">
          <div>
            <p className="inline-flex rounded-full border border-white/15 bg-white/8 px-3.5 py-1 text-[0.68rem] tracking-[0.2em] text-white/75 uppercase">
              Senda Business
            </p>
            <h1 className="mt-7 max-w-[13ch] text-[2.6rem] leading-[1.02] font-medium tracking-[-0.04em] text-white md:text-5xl lg:text-[3.55rem]">
              El poder de Senda, ahora para tu empresa.
            </h1>
            <p className="mt-5 max-w-[48ch] text-base leading-relaxed text-white/70 md:text-lg">
              Gestión de gastos, cuentas a pagar, pagos transfronterizos y
              tarjetas corporativas, construido como una única plataforma. Una
              cuenta, un panel de control, una fuente de verdad para cada país
              en el que operes.
            </p>
            <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:flex-nowrap">
              <a href={getBusinessMailto()}>
                <Button
                  variant="cream"
                  size="md"
                  className="min-h-11 px-5 text-[0.95rem]"
                >
                  <Mail className="size-4" aria-hidden />
                  Correo electrónico corporativo
                </Button>
              </a>
              <Link href={BUSINESS_LOGIN_PATH}>
                <Button
                  variant="ghostForest"
                  size="md"
                  className="min-h-11 px-5 text-[0.95rem]"
                >
                  Unirme a la lista de espera
                  <ArrowRight className="size-4" aria-hidden />
                </Button>
              </Link>
            </div>
          </div>

          <BusinessHeroStage />
        </Shell>
      </div>

      <div id="pilares" className="bg-white">
        <Shell className="grid grid-cols-2 gap-x-6 gap-y-10 py-12 lg:grid-cols-4 lg:gap-8 lg:py-14">
          {pillars.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <div
                key={pillar.title}
                className="flex flex-col items-center text-center"
              >
                <span
                  className="mb-3 flex size-10 items-center justify-center rounded-full border border-forest/15 text-forest"
                  aria-hidden
                >
                  <Icon className="size-4" strokeWidth={1.6} />
                </span>
                <h2 className="text-[1.05rem] font-medium tracking-tight text-forest">
                  {pillar.title}
                </h2>
                <p className="mt-1.5 max-w-[28ch] text-sm leading-relaxed text-charcoal/68">
                  {pillar.copy}
                </p>
              </div>
            );
          })}
        </Shell>
      </div>
    </section>
  );
}
