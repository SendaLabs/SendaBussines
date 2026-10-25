import { API_ROUTES } from "@senda/shared";

export const BUSINESS_API = {
  sep10Challenge: `/senda-api${API_ROUTES.sep10Challenge}`,
  sep10Token: `/senda-api${API_ROUTES.sep10Token}`,
  session: `/senda-api${API_ROUTES.businessSession}`,
} as const;
