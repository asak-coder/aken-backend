"use client";

import Image from "next/image";

/**
 * HeroMedia
 * - Desktop (>= md): autoplay muted looping background video (if available)
 * - Mobile: poster-only for performance (per user preference A)
 * - Respects `prefers-reduced-motion`
 */
export default function HeroMedia({
  // Use an existing public asset by default (prevents 404s in production)
  posterSrc = "/hero-steel.jpg",
  videoMp4Src = "/hero-fabrication.mp4",
  videoWebmSrc = "/hero-fabrication.webm",
  alt = "",
}: {
  posterSrc?: string;
  videoMp4Src?: string;
  videoWebmSrc?: string;
  alt?: string;
}) {
  return (
    <div className="absolute inset-0">
      {/* Mobile poster (default) */}
      <Image
        src={posterSrc}
        alt={alt}
        className="object-cover opacity-70 md:hidden"
        fill
        priority
        sizes="100vw"
      />

      {/* Desktop video */}
      <video
        className="hidden h-full w-full object-cover opacity-60 md:block motion-reduce:hidden"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        poster={posterSrc}
        aria-hidden="true"
      >
        {/* If you later add real assets, keep both sources for best coverage */}
        <source src={videoWebmSrc} type="video/webm" />
        <source src={videoMp4Src} type="video/mp4" />
      </video>

      {/* Desktop fallback (if video fails) */}
      <Image
        src={posterSrc}
        alt={alt}
        className="hidden object-cover opacity-70 md:block"
        fill
        priority
        sizes="100vw"
      />

      {/* Overlays */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/60 to-black/85" />
    </div>
  );
}
