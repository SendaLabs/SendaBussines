import type { Metadata } from "next";

import { BusinessPage } from "@/components/business/business-page";

export const metadata: Metadata = {
  title: "Senda Business — Pagos de empresa a través de fronteras",
  description:
    "Gestión de gastos, cuentas a pagar, pagos transfronterizos y tarjetas corporativas, construido como una única plataforma.",
};

export default function EmpresasPage() {
  return <BusinessPage />;
}
