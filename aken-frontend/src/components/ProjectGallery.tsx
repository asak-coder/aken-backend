"use client";

import Image from "next/image";
import { useCallback, useEffect, useId, useMemo, useState } from "react";

export type ProjectGalleryItem = {
  src: string;
  alt: string;
  title?: string;
};

type Props = {
  title?: string;
  items: ProjectGalleryItem[];
  className?: string;
};

function cn(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

export default function ProjectGallery({ title, items, className }: Props) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const dialogTitleId = useId();

  const activeItem = useMemo(() => {
    if (activeIndex === null) return null;
    return items[activeIndex] ?? null;
  }, [activeIndex, items]);

  const close = useCallback(() => setActiveIndex(null), []);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (activeIndex === null) return;

      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }

      if (e.key === "ArrowRight") {
        e.preventDefault();
        setActiveIndex((prev) => {
          if (prev === null) return prev;
          return (prev + 1) % items.length;
        });
        return;
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setActiveIndex((prev) => {
          if (prev === null) return prev;
          return (prev - 1 + items.length) % items.length;
        });
      }
    },
    [activeIndex, close, items.length]
  );

  useEffect(() => {
    if (activeIndex === null) return;
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, onKeyDown]);

  // Basic scroll lock when dialog is open
  useEffect(() => {
    if (activeIndex === null) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [activeIndex]);

  return (
    <section className={cn("w-full", className)}>
      {title ? (
        <div className="mb-6">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900">
            {title}
          </h2>
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {items.map((item, idx) => (
          <button
            key={`${item.src}-${idx}`}
            type="button"
            onClick={() => setActiveIndex(idx)}
            className="group relative overflow-hidden rounded-xl bg-gray-100 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-yellow-500"
            aria-label={`Open image preview: ${item.alt}`}
          >
            <div className="relative aspect-[4/3]">
              <Image
                src={item.src}
                alt={item.alt}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                loading="lazy"
              />
            </div>

            {(item.title || item.alt) && (
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent p-3">
                <p className="text-left text-sm text-white line-clamp-2">
                  {item.title ?? item.alt}
                </p>
              </div>
            )}
          </button>
        ))}
      </div>

      {activeItem ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={dialogTitleId}
          className="fixed inset-0 z-50"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/80"
            onClick={close}
            aria-label="Close image preview"
          />

          <div className="relative mx-auto h-full max-w-6xl px-4 py-10 flex items-center">
            <div className="relative w-full">
              <div className="flex items-start justify-between gap-4 mb-3">
                <h3
                  id={dialogTitleId}
                  className="text-white font-semibold text-base md:text-lg"
                >
                  {activeItem.title ?? activeItem.alt}
                </h3>
                <button
                  type="button"
                  onClick={close}
                  className="text-white/90 hover:text-white border border-white/30 hover:border-white/70 rounded-lg px-3 py-2 text-sm"
                >
                  Close
                </button>
              </div>

              <div className="relative w-full max-h-[75vh] aspect-[16/9] bg-black rounded-xl overflow-hidden border border-white/10">
                <Image
                  src={activeItem.src}
                  alt={activeItem.alt}
                  fill
                  sizes="(max-width: 1024px) 100vw, 1024px"
                  className="object-contain"
                  priority={false}
                />
              </div>

              {items.length > 1 ? (
                <div className="mt-4 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setActiveIndex((prev) => {
                        if (prev === null) return prev;
                        return (prev - 1 + items.length) % items.length;
                      })
                    }
                    className="text-white border border-white/20 hover:border-white/60 rounded-lg px-4 py-2 text-sm"
                    aria-label="Previous image"
                  >
                    Prev
                  </button>

                  <p className="text-white/80 text-sm">
                    {(activeIndex ?? 0) + 1} / {items.length}
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      setActiveIndex((prev) => {
                        if (prev === null) return prev;
                        return (prev + 1) % items.length;
                      })
                    }
                    className="text-white border border-white/20 hover:border-white/60 rounded-lg px-4 py-2 text-sm"
                    aria-label="Next image"
                  >
                    Next
                  </button>
                </div>
              ) : null}

              <p className="mt-3 text-white/70 text-xs">
                Tip: Use Esc to close, ←/→ to navigate.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
