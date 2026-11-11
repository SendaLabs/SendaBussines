"use client";

import { useRouter } from "next/navigation";

import {
  FILTER_PARAMS,
  REGION_OPTIONS,
  type DashboardFilters,
} from "@/components/business/dashboard/filters";
import { BUSINESS_DASHBOARD_PATH } from "@/lib/site";

const REGION_LABELS: Record<(typeof REGION_OPTIONS)[number], string> = {
  global: "Global · Todos los países",
  AR: "Argentina",
  CR: "Costa Rica",
  US: "Estados Unidos",
  ES: "España",
};

export function DashboardFilterBar({ filters }: { filters: DashboardFilters }) {
  const router = useRouter();

  function update(value: string) {
    const params = new URLSearchParams({ [FILTER_PARAMS.region]: value });
    router.push(`${BUSINESS_DASHBOARD_PATH}?${params.toString()}`);
  }

  return (
    <select
      aria-label="País"
      value={filters.region}
      onChange={(event) => update(event.target.value)}
      className="h-10 rounded-xl border border-stone bg-white px-3 text-sm text-charcoal outline-none focus-visible:ring-2 focus-visible:ring-forest/30"
    >
      {REGION_OPTIONS.map((value) => (
        <option key={value} value={value}>
          {REGION_LABELS[value]}
        </option>
      ))}
    </select>
  );
}
