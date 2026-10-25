import type { Metadata } from "next";

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

export default async function PanelPage({ searchParams }: Props) {
  const query = await searchParams;
  return <BusinessDashboardPage filters={parseDashboardFilters(query)} />;
}
