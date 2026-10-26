import {
  BUSINESS_CATEGORY_PERIODS,
  BUSINESS_RANGES,
  BUSINESS_REGIONS,
  type BusinessDashboardFilters,
} from "@senda/shared";
import { z } from "zod";

const first = (value: unknown): unknown => (Array.isArray(value) ? value[0] : value);

const filtersSchema = z.object({
  region: z.preprocess(first, z.enum(BUSINESS_REGIONS)).catch("global"),
  range: z.preprocess(first, z.enum(BUSINESS_RANGES)).catch("12"),
  categoryPeriod: z.preprocess(first, z.enum(BUSINESS_CATEGORY_PERIODS)).catch("current"),
});

/** Unknown query values fall back to defaults, matching the panel's parseDashboardFilters. */
export function parseDashboardFilters(searchParams: Record<string, unknown>): BusinessDashboardFilters {
  return filtersSchema.parse({
    region: searchParams.region,
    range: searchParams.range,
    categoryPeriod: searchParams.categories,
  });
}
