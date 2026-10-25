import { BusinessGlobeStage } from "@/components/business/globe-stage";
import { Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { getBusinessMailto } from "@/lib/site";

export function BusinessGlobeSection() {
  return (
    <section id="mundo" className="bg-white text-charcoal">
      <Shell className="grid items-center gap-12 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8 lg:py-24">
        <BusinessGlobeStage label="Globo ilustrativo con monedas de corredores" />

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
