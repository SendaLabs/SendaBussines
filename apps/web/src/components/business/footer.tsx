import Image from "next/image";
import Link from "next/link";

import { Shell } from "@/components/shell";
import { BUSINESS_PATH, site } from "@/lib/site";

function SocialLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      aria-label={label}
      className="flex size-7 items-center justify-center rounded-full border border-forest/25 text-forest transition-colors hover:bg-forest hover:text-white"
    >
      {children}
    </a>
  );
}

export function BusinessFooter() {
  return (
    <footer className="border-t border-stone bg-white text-forest">
      <Shell className="grid gap-6 py-6 md:grid-cols-[1.3fr_1fr_1fr_1fr] md:gap-7 md:py-7">
        <div>
          <Image
            src="/images/logoverde.png"
            alt="Senda"
            width={430}
            height={101}
            className="h-9 w-auto"
          />
          <div className="mt-4 flex gap-2">
            <SocialLink href={site.linkedin} label="LinkedIn">
              <svg viewBox="0 0 24 24" className="size-3.5 fill-current" aria-hidden>
                <path d="M5.2 3.8A2.2 2.2 0 1 1 5.2 8.2 2.2 2.2 0 0 1 5.2 3.8ZM3.4 9.8h3.6V20H3.4V9.8Zm5.8 0h3.4v1.4h.1c.5-.9 1.7-1.8 3.5-1.8 3.7 0 4.4 2.4 4.4 5.6V20H17v-4.4c0-1.1 0-2.6-1.6-2.6s-1.9 1.2-1.9 2.5V20H9.2V9.8Z" />
              </svg>
            </SocialLink>
            <SocialLink href={site.x} label="X">
              <span className="text-sm font-semibold">X</span>
            </SocialLink>
            <SocialLink href={site.instagram} label="Instagram">
              <svg
                viewBox="0 0 24 24"
                className="size-3.5 fill-none stroke-current stroke-[1.8]"
                aria-hidden
              >
                <rect width="16" height="16" x="4" y="4" rx="4" />
                <circle cx="12" cy="12" r="3.5" />
                <circle cx="17.3" cy="6.8" r="1" className="fill-current stroke-none" />
              </svg>
            </SocialLink>
          </div>
        </div>

        <div>
          <p className="text-sm">Empresa</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href={BUSINESS_PATH} className="hover:underline">
                Senda Business
              </Link>
            </li>
            <li>
              <a href={site.mailto} className="hover:underline">
                Contacto
              </a>
            </li>
          </ul>
        </div>

        <div>
          <p className="text-sm">Producto</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <a href="#pilares" className="hover:underline">
                Beneficios
              </a>
            </li>
            <li>
              <a href="#mundo" className="hover:underline">
                Alcance global
              </a>
            </li>
          </ul>
        </div>

        <div>
          <p className="text-sm">Legal</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <span className="text-charcoal/55">© 2026 Senda</span>
            </li>
          </ul>
        </div>
      </Shell>
    </footer>
  );
}
