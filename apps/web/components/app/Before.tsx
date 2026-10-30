"use client";

import { useState } from "react";

/** Before/after slider. With no before image it shows the render alone. */
export function Before({ before, after, beforeLabel = "Today", afterLabel = "Kept" }: { before: string | null; after: string; beforeLabel?: string; afterLabel?: string }) {
  const [pos, setPos] = useState(50);
  if (!before) {
    return (
      <figure className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={after} alt={afterLabel} className="block w-full" />
        <figcaption className="absolute bottom-3 left-3 rounded-chip bg-oat-50/90 px-3 py-1 text-[12px] font-semibold">{afterLabel}</figcaption>
      </figure>
    );
  }
  return (
    <figure className="relative select-none overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={after} alt={afterLabel} className="block w-full" />
      <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={before} alt={beforeLabel} className="block h-full w-full object-cover" />
      </div>
      <div className="pointer-events-none absolute inset-y-0 w-px bg-oat-50" style={{ left: `${pos}%` }} />
      <span className="absolute bottom-3 left-3 rounded-chip bg-oat-50/90 px-3 py-1 text-[12px] font-semibold">{beforeLabel}</span>
      <span className="absolute bottom-3 right-3 rounded-chip bg-oat-50/90 px-3 py-1 text-[12px] font-semibold">{afterLabel}</span>
      <input
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        aria-label={`Compare ${beforeLabel} and ${afterLabel}`}
        className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
      />
    </figure>
  );
}
