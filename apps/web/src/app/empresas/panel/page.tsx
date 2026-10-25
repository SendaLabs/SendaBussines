import type { Metadata } from "next";
import { Suspense } from "react";

import { BusinessDashboardPage } from "@/components/business/dashboard/dashboard-page";
import { parseDashboardFilters } from "@/components/business/dashboard/filters";

export const metadata: Metadata = {
  title: "Panel",
  description: "Demostración del panel de Senda Business con datos de ejemplo.",
  robots: { index: false, follow: false },
};

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function PanelContent({
  searchParams,
}: {
  searchParams: Props["searchParams"];
}) {
  const query = await searchParams;
  return <BusinessDashboardPage filters={parseDashboardFilters(query)} />;
}

export default function PanelPage({ searchParams }: Props) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-[#f3f1ea] text-sm text-charcoal/60">
          Cargando panel…
        </div>
      }
    >
      <PanelContent searchParams={searchParams} />
    </Suspense>
  );
}
