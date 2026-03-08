"use client";

import type { ReactNode } from "react";
import { trackCtaClick } from "@/lib/analytics";

type TrackedAnchorProps = {
  href: string;
  ctaName: string;
  ctaLocation: string;
  className?: string;
  children: ReactNode;
  eventName?: string;
  target?: "_self" | "_blank" | "_parent" | "_top";
  rel?: string;
};

function inferCtaType(href: string) {
  if (href.startsWith("tel:")) {
    return "phone";
  }

  if (href.includes("wa.me") || href.includes("whatsapp")) {
    return "whatsapp";
  }

  if (href.startsWith("mailto:")) {
    return "email";
  }

  return "external";
}

export default function TrackedAnchor({
  href,
  ctaName,
  ctaLocation,
  className,
  children,
  eventName,
  target,
  rel,
}: TrackedAnchorProps) {
  return (
    <a
      href={href}
      className={className}
      target={target}
      rel={rel}
      onClick={() => {
        trackCtaClick({
          ctaName,
          ctaLocation,
          destination: href,
          ctaType: inferCtaType(href),
          eventName,
        });
      }}
    >
      {children}
    </a>
  );
}
