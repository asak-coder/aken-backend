"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { trackPageView } from "@/lib/analytics";

export default function GA4PageTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryString = searchParams?.toString() || "";

  useEffect(() => {
    const pagePath = queryString ? `${pathname}?${queryString}` : pathname;
    trackPageView(pagePath || "/");
  }, [pathname, queryString]);

  return null;
}
