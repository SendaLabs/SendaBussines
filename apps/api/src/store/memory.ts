import { buildDashboard } from "../dashboard/project.js";
import { DEMO_BOOK } from "./seed.js";
import type { BusinessStore, CompanyBook } from "./types.js";

export function createMemoryBusinessStore(book: CompanyBook = DEMO_BOOK): BusinessStore {
  return {
    async getDashboard(filters) {
      return buildDashboard(book, filters);
    },
  };
}
