import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Senda Business — Pagos de empresa a través de fronteras",
    template: "%s — Senda Business",
  },
  description:
    "Gestión de gastos, cuentas a pagar, pagos transfronterizos y tarjetas corporativas para tu empresa.",
  icons: {
    icon: "/images/favicon.png",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-cream text-charcoal">
        {children}
      </body>
    </html>
  );
}
