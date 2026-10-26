import type { Metadata } from "next";
import { Suspense } from "react";

import { BusinessDashboardPage } from "@/components/business/dashboard/dashboard-page";
import { parseDashboardFilters } from "@/components/business/dashboard/filters";
import { loadBusinessDashboard } from "@/lib/business-dashboard";
import { requireBusinessSession } from "@/lib/session";

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
  await requireBusinessSession();
  const filters = parseDashboardFilters(await searchParams);
  const data = await loadBusinessDashboard(filters);
  const treasuryAccount = process.env.STELLAR_ADMIN_PUBLIC?.trim() ?? "";
  return (
    <BusinessDashboardPage
      data={data}
      filters={filters}
      treasuryAccount={treasuryAccount}
    />
  );
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
