"use client";

import { useEffect, useRef, useState } from "react";
import { trackCtaClick } from "@/lib/analytics";

const MAP_SRC = "https://www.google.com/maps?q=Sambalpur,Odisha,India&output=embed";

export default function LazyMapEmbed() {
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
      className="w-full h-96 rounded-xl overflow-hidden shadow-lg bg-gray-100 flex items-center justify-center"
    >
      {shouldLoad ? (
        <iframe
          src={MAP_SRC}
          width="100%"
          height="100%"
          loading="lazy"
          title="A K ENGINEERING Location Map"
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
