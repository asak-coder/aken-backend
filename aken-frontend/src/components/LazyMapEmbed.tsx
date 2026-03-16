"use client";

import { useEffect, useRef, useState } from "react";
import { trackCtaClick } from "@/lib/analytics";

const DEFAULT_MAP_TITLE = "A K ENGINEERING Location Map";
const DEFAULT_LAT = 21.5367316772452;
const DEFAULT_LNG = 83.89499883022955;

type LazyMapEmbedProps = {
  title?: string;
  lat?: number;
  lng?: number;
  className?: string;
};

function buildMapSrc(lat: number, lng: number) {
  return `https://www.google.com/maps?q=${lat},${lng}&z=15&output=embed`;
}

export default function LazyMapEmbed({
  title = DEFAULT_MAP_TITLE,
  lat = DEFAULT_LAT,
  lng = DEFAULT_LNG,
  className,
}: LazyMapEmbedProps) {
  const MAP_SRC = buildMapSrc(lat, lng);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [shouldLoad, setShouldLoad] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return !("IntersectionObserver" in window);
  });

  useEffect(() => {
    if (shouldLoad) {
      return;
    }

    const node = containerRef.current;
    if (!node) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [shouldLoad]);

  return (
    <div
      ref={containerRef}
      className={
        className ??
        "w-full h-96 rounded-xl overflow-hidden shadow-lg bg-gray-100 flex items-center justify-center"
      }
    >
      {shouldLoad ? (
        <iframe
          src={MAP_SRC}
          width="100%"
          height="100%"
          loading="lazy"
          title={title}
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
        />
      ) : (
        <button
          type="button"
          className="rounded-lg bg-black px-5 py-2 text-white hover:bg-gray-800 transition"
          onClick={() => {
            setShouldLoad(true);
            trackCtaClick({
              ctaName: "Load Map",
              ctaLocation: "contact_map",
              destination: MAP_SRC,
              ctaType: "button",
              eventName: "map_load_click",
            });
          }}
        >
          Load Map
        </button>
      )}
    </div>
  );
}
