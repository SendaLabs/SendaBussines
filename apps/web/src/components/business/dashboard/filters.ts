import { z } from "zod";

export const DASHBOARD_COUNTRIES = ["AR", "CR", "US", "ES"] as const;
export type DashboardCountry = (typeof DASHBOARD_COUNTRIES)[number];

export const REGION_OPTIONS = ["global", ...DASHBOARD_COUNTRIES] as const;
export type Region = (typeof REGION_OPTIONS)[number];

export const RANGE_OPTIONS = ["12", "6"] as const;
export type Range = (typeof RANGE_OPTIONS)[number];

export const CATEGORY_PERIOD_OPTIONS = ["current", "previous"] as const;
export type CategoryPeriod = (typeof CATEGORY_PERIOD_OPTIONS)[number];

export const FILTER_PARAMS = {
  region: "region",
  range: "range",
  categoryPeriod: "categories",
} as const;

type SearchParams = Record<string, string | string[] | undefined>;

const first = (value: unknown): unknown =>
  Array.isArray(value) ? (value as unknown[])[0] : value;

const filtersSchema = z.object({
  region: z.preprocess(first, z.enum(REGION_OPTIONS)).catch("global"),
  range: z.preprocess(first, z.enum(RANGE_OPTIONS)).catch("12"),
  categoryPeriod: z
    .preprocess(first, z.enum(CATEGORY_PERIOD_OPTIONS))
    .catch("current"),
});

export type DashboardFilters = z.infer<typeof filtersSchema>;

/** Unknown or malformed query values fall back to defaults instead of failing. */
export function parseDashboardFilters(
  searchParams: SearchParams,
): DashboardFilters {
  return filtersSchema.parse({
    region: searchParams[FILTER_PARAMS.region],
    range: searchParams[FILTER_PARAMS.range],
    categoryPeriod: searchParams[FILTER_PARAMS.categoryPeriod],
  });
}
