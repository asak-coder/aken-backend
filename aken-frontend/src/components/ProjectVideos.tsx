"use client";

import { useMemo, useState } from "react";

export type ProjectVideoItem =
  | {
      type: "mp4";
      src: string; // e.g. "/projects/videos/crane-lifting.mp4"
      title: string;
      poster?: string; // optional poster image in /public
    }
  | {
      type: "youtube";
      youtubeId: string; // e.g. "dQw4w9WgXcQ"
      title: string;
    };

type Props = {
  title?: string;
  items: ProjectVideoItem[];
  className?: string;
};

function cn(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

function YouTubeLite({
  youtubeId,
  title,
}: {
  youtubeId: string;
  title: string;
}) {
  const [activated, setActivated] = useState(false);

  const thumbnail = useMemo(
    () => `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`,
    [youtubeId]
  );

  if (activated) {
    return (
      <iframe
        className="absolute inset-0 h-full w-full"
        src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&rel=0`}
        title={title}
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setActivated(true)}
      className="absolute inset-0 h-full w-full"
      aria-label={`Play video: ${title}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={thumbnail}
        alt={`YouTube preview thumbnail: ${title}`}
        loading="lazy"
        className="h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-black/30" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="rounded-full bg-white/90 text-black px-4 py-3 text-sm font-semibold shadow">
          Play
        </div>
      </div>
    </button>
  );
}

export default function ProjectVideos({ title, items, className }: Props) {
  return (
    <section className={cn("w-full", className)}>
      {title ? (
        <div className="mb-6">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900">
            {title}
          </h2>
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {items.map((item, idx) => (
          <figure
            key={`${item.type}-${"src" in item ? item.src : item.youtubeId}-${idx}`}
            className="rounded-xl border border-gray-200 bg-white overflow-hidden"
          >
            <div className="relative aspect-video bg-black">
              {item.type === "mp4" ? (
                <video
                  className="absolute inset-0 h-full w-full object-contain bg-black"
                  controls
                  preload="none"
                  playsInline
                  poster={item.poster}
                >
                  <source src={item.src} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              ) : (
                <YouTubeLite youtubeId={item.youtubeId} title={item.title} />
              )}
            </div>

            <figcaption className="p-4">
              <p className="text-sm md:text-base font-semibold text-gray-900">
                {item.title}
              </p>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
