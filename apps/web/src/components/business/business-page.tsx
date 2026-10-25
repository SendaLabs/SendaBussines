import { BusinessFooter } from "@/components/business/footer";
import { BusinessGlobeSection } from "@/components/business/globe-section";
import { BusinessHeader } from "@/components/business/header";
import { BusinessHero } from "@/components/business/hero";

export function BusinessPage() {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:top-4 focus-visible:left-4 focus-visible:z-[80] focus-visible:bg-cream focus-visible:px-3 focus-visible:py-2 focus-visible:text-forest"
      >
        Saltar al contenido
      </a>
      <BusinessHeader />
      <main id="main">
        <BusinessHero />
        <BusinessGlobeSection />
      </main>
      <BusinessFooter />
    </>
  );
}
