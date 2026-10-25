import "server-only";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { API_ROUTES, type BusinessDashboard } from "@senda/shared";

import {
  FILTER_PARAMS,
  type DashboardFilters,
} from "@/components/business/dashboard/filters";
import { BUSINESS_LOGIN_PATH } from "@/lib/site";

const SESSION_COOKIE = "senda_session";
const DEFAULT_API_URL = "http://127.0.0.1:4000";

function apiOrigin(): string {
  const configured = process.env.API_URL?.trim();
  const origin = configured && configured.length > 0 ? configured : DEFAULT_API_URL;
  return origin.replace(/\/$/, "");
}

/**
 * Loads the company book for the panel. The session cookie is read here, inside
 * the page Suspense boundary, so Cache Components does not prerender this fetch.
 */
export async function loadBusinessDashboard(
  filters: DashboardFilters,
): Promise<BusinessDashboard> {
  const headerList = await headers();
  const session = (await cookies()).get(SESSION_COOKIE)?.value;
  const incoming = headerList.get("cookie");
  const cookieHeader =
    incoming ?? (session ? `${SESSION_COOKIE}=${session}` : undefined);

  const query = new URLSearchParams({
    [FILTER_PARAMS.region]: filters.region,
    [FILTER_PARAMS.range]: filters.range,
    [FILTER_PARAMS.categoryPeriod]: filters.categoryPeriod,
  });

  const response = await fetch(
    `${apiOrigin()}${API_ROUTES.businessDashboard}?${query.toString()}`,
    {
      cache: "no-store",
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    },
  );

  if (response.status === 401) {
    redirect(BUSINESS_LOGIN_PATH);
  }

  if (!response.ok) {
    throw new Error("No se pudo cargar el panel.");
  }

  return (await response.json()) as BusinessDashboard;
}
