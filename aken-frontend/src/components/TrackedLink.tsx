"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { trackCtaClick } from "@/lib/analytics";

type TrackedLinkProps = {
  href: string;
  ctaName: string;
  ctaLocation: string;
  className?: string;
  children: ReactNode;
  eventName?: string;
};

export default function TrackedLink({
  href,
  ctaName,
  ctaLocation,
  className,
  children,
  eventName,
}: TrackedLinkProps) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => {
        trackCtaClick({
          ctaName,
          ctaLocation,
          destination: href,
          ctaType: "internal",
          eventName,
        });
      }}
    >
      {children}
    </Link>
  );
}
