import type { Metadata } from "next";

import { BusinessLoginPage } from "@/components/business/login/login-page";

export const metadata: Metadata = {
  title: "Iniciar sesión",
  description: "Ingresá a tu cuenta de Senda Business.",
  robots: { index: false },
};

export default function IngresarPage() {
  return <BusinessLoginPage />;
}
