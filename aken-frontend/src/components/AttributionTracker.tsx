"use client";

import { useEffect } from "react";
import { persistAttributionFromUrl } from "@/lib/utm";

export default function AttributionTracker() {
  useEffect(() => {
    persistAttributionFromUrl();
  }, []);

  return null;
}
