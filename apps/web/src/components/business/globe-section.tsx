import { Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { getBusinessMailto } from "@/lib/site";

const chips = [
  { code: "CAD", mark: "CA" },
  { code: "USD", mark: "US" },
  { code: "MXN", mark: "MX" },
  { code: "COP", mark: "CO" },
  { code: "BRL", mark: "BR" },
  { code: "EUR", mark: "EU" },
  { code: "GBP", mark: "GB" },
  { code: "ARS", mark: "AR" },
  { code: "GTQ", mark: "GT" },
  { code: "PYG", mark: "PY" },
  { code: "BOB", mark: "BO" },
  { code: "PAB / USD", mark: "PA" },
] as const;

export function BusinessGlobeSection() {
  return (
    <section id="mundo" className="bg-white text-charcoal">
      <Shell className="grid items-center gap-12 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8 lg:py-24">
        <div
          className="relative mx-auto aspect-square w-full max-w-[28rem]"
          role="img"
          aria-label="Corredores y monedas disponibles"
        >
          <div
            className="absolute inset-[12%] rounded-full bg-[radial-gradient(circle_at_32%_28%,#3a6b5f,transparent_46%),radial-gradient(circle_at_50%_50%,#1b3d36_0%,#0b1a17_78%)] shadow-[0_40px_80px_rgba(6,31,27,0.35)]"
            aria-hidden
          />
          <div
            className="absolute inset-[22%] rounded-full border border-white/10"
            aria-hidden
          />
          <div
            className="absolute inset-[34%] rounded-full border border-white/8"
            aria-hidden
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="grid max-w-[16rem] grid-cols-3 gap-2">
              {chips.map((chip) => (
                <span
                  key={`${chip.mark}-${chip.code}`}
                  className="rounded-full border border-white/15 bg-white/10 px-2 py-1 text-center text-[0.65rem] font-medium tracking-wide text-cream backdrop-blur-sm"
                >
                  <span className="mr-1 text-cream/55">{chip.mark}</span>
                  {chip.code}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-xl lg:justify-self-end">
          <h2 className="max-w-[14ch] text-4xl leading-[1.05] font-medium tracking-[-0.035em] text-forest md:text-5xl lg:text-[3.35rem]">
            Diseñado para equipos financieros que mueven el mundo.
          </h2>
          <p className="mt-6 max-w-[42ch] text-base leading-relaxed text-charcoal/70 md:text-lg">
            Combiná la visibilidad en tiempo real con la facilidad global para
            controlar cada transacción, cada presupuesto, cada mercado.
          </p>
          <a href={getBusinessMailto()} className="mt-8 inline-flex">
            <Button variant="senda" size="cta">
              Solicitar ahora
            </Button>
          </a>
        </div>
      </Shell>
    </section>
  );
}
