"use client";

import { useEffect, useRef } from "react";

type Props = {
  /** Colour the chip shows while nobody is reading the lock. */
  storedHex: string;
  storedLabel: string;
};

// One lock of hair drawn from fine strands on a single cubic S-curve, plus a reading
// ring that samples the strands under it. The canvas is decorative; the stored value is
// what the chip shows at rest, so the number on screen never drifts on its own.
export function Lock({ storedHex, storedLabel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const readingRef = useRef<HTMLDivElement>(null);
  const hexRef = useRef<HTMLElement>(null);
  const labelRef = useRef<HTMLElement>(null);
  const swRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cv = canvasRef.current!;
    const ctx = cv.getContext("2d", { willReadFrequently: true })!;
    const ring = ringRef.current!;
    const reading = readingRef.current!;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

    type Strand = { u: number; t0: number; t1: number; ph: number; f: number; amp: number; sp: number; w: number; c: string };
    let W = 0, H = 0, dpr = 1, mobile = false;
    let P: number[][] = [];
    let strands: Strand[] = [];
    let w0 = 0, w1 = 0;
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const gauss = () => { let u = 0; for (let i = 0; i < 4; i++) u += rnd(); return (u / 4 - 0.5) * 2; };
    const bez = (t: number, i: number) => { const m = 1 - t; return m * m * m * P[0]![i]! + 3 * m * m * t * P[1]![i]! + 3 * m * t * t * P[2]![i]! + t * t * t * P[3]![i]!; };
    const der = (t: number, i: number) => { const m = 1 - t; return 3 * m * m * (P[1]![i]! - P[0]![i]!) + 6 * m * t * (P[2]![i]! - P[1]![i]!) + 3 * t * t * (P[3]![i]! - P[2]![i]!); };
    const pointAt = (t: number) => ({ x: bez(t, 0), y: bez(t, 1) });

    let target = { x: 0, y: 0 }, cur = { x: 0, y: 0 };
    let reading_ = false;
    const col: [number, number, number] = [0, 0, 0];

    function layout() {
      dpr = Math.min(devicePixelRatio || 1, 2);
      W = cv.clientWidth; H = cv.clientHeight; mobile = W < 640;
      cv.width = W * dpr; cv.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      P = mobile
        ? [[0.56 * W, -0.1 * H], [1.0 * W, 0.1 * H], [0.3 * W, 0.25 * H], [0.74 * W, 0.47 * H]]
        : [[0.565 * W, -0.1 * H], [0.99 * W, 0.3 * H], [0.46 * W, 0.6 * H], [0.8 * W, 1.08 * H]];
      seed = 7;
      const n = mobile ? 300 : 540;
      w0 = mobile ? 0.05 * W : 0.028 * W; w1 = mobile ? 0.4 * W : 0.24 * W;
      strands = [];
      for (let i = 0; i < n; i++) {
        const hi = rnd() < 0.12, deep = rnd() < 0.22, fly = rnd() < 0.07;
        const l = hi ? 40 + rnd() * 14 : deep ? 12 + rnd() * 8 : 20 + rnd() * 14;
        const h = hi ? 26 + rnd() * 6 : 18 + rnd() * 8;
        const s = hi ? 40 + rnd() * 10 : 34 + rnd() * 14;
        strands.push({
          u: gauss(), t0: rnd() * 0.05, t1: 0.78 + rnd() * 0.24, ph: rnd() * 6.283, f: 2 + rnd() * 3.5,
          amp: fly ? 18 + rnd() * 30 : 3 + rnd() * 9, sp: 0.18 + rnd() * 0.22,
          w: fly ? 0.5 : hi ? 0.55 + rnd() * 0.4 : 0.55 + rnd() * 0.7,
          c: `hsla(${h},${s}%,${l}%,${fly ? 0.22 + rnd() * 0.15 : hi ? 0.5 + rnd() * 0.3 : 0.28 + rnd() * 0.42})`,
        });
      }
      target = pointAt(0.42); cur = { ...target };
    }

    let time = 0, last = performance.now(), raf = 0;
    function frame(now: number) {
      const dt = Math.min(50, now - last); last = now;
      if (!reduce) time += dt / 1000;
      ctx.clearRect(0, 0, W, H);
      const STEPS = mobile ? 40 : 56;
      for (const s of strands) {
        ctx.beginPath();
        for (let k = 0; k <= STEPS; k++) {
          const t = s.t0 + (s.t1 - s.t0) * (k / STEPS);
          const x = bez(t, 0), y = bez(t, 1);
          let dx = der(t, 0), dy = der(t, 1); const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
          const fan = (w0 + (w1 - w0) * Math.pow(Math.max(t, 0), 1.15)) * 0.5;
          const wave = Math.sin(t * s.f * 3.1 + s.ph + time * s.sp * 2) * s.amp * t + Math.sin(time * 0.24 + t * 2.2) * 14 * t * t;
          const off = s.u * fan + wave;
          const px = x - dy * off, py = y + dx * off;
          if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py);
        }
        ctx.strokeStyle = s.c; ctx.lineWidth = s.w; ctx.stroke();
      }
      if (mobile) {
        const g = ctx.createLinearGradient(0, 0.3 * H, 0, 0.42 * H);
        g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,1)");
        ctx.globalCompositeOperation = "destination-out";
        ctx.fillStyle = g; ctx.fillRect(0, 0.3 * H, W, 0.7 * H);
        ctx.globalCompositeOperation = "source-over";
      }
      cur.x += (target.x - cur.x) * 0.12; cur.y += (target.y - cur.y) * 0.12;
      let hex = storedHex.toUpperCase(), label = storedLabel;
      if (reading_) {
        const R = 9, sx = Math.round(cur.x * dpr) - R * dpr, sy = Math.round(cur.y * dpr) - R * dpr;
        const d = ctx.getImageData(Math.max(0, sx), Math.max(0, sy), 2 * R * dpr, 2 * R * dpr).data;
        let r = 0, gg = 0, b = 0, a = 0;
        for (let i = 0; i < d.length; i += 4) { const w = d[i + 3]!; r += d[i]! * w; gg += d[i + 1]! * w; b += d[i + 2]! * w; a += w; }
        if (a > 2000) {
          if (col[0] === 0) { col[0] = r / a; col[1] = gg / a; col[2] = b / a; }
          col[0] += (r / a - col[0]) * 0.08; col[1] += (gg / a - col[1]) * 0.08; col[2] += (b / a - col[2]) * 0.08;
          hex = "#" + col.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase();
          label = "reading the strands";
        }
      }
      hexRef.current!.textContent = hex; labelRef.current!.textContent = label; swRef.current!.style.background = hex;
      ring.style.left = `${cur.x}px`; ring.style.top = `${cur.y}px`;
      const rw = reading.offsetWidth;
      const leftSide = cur.x + 52 + rw > W - 12;
      reading.style.left = `${Math.max(12, leftSide ? cur.x - 52 - rw : cur.x + 52)}px`;
      reading.style.top = `${cur.y - reading.offsetHeight / 2}px`;
      raf = requestAnimationFrame(frame);
    }

    const move = (e: PointerEvent) => {
      const rect = cv.getBoundingClientRect();
      const x = e.clientX - rect.left, y = e.clientY - rect.top;
      if (mobile ? y < 0.48 * H : x > 0.48 * W) { target = { x, y }; reading_ = true; }
    };
    const leave = () => { target = pointAt(0.42); reading_ = false; col[0] = 0; };
    cv.addEventListener("pointermove", move);
    cv.addEventListener("pointerdown", move);
    cv.addEventListener("pointerleave", leave);
    addEventListener("resize", layout);
    layout();
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      cv.removeEventListener("pointermove", move);
      cv.removeEventListener("pointerdown", move);
      cv.removeEventListener("pointerleave", leave);
      removeEventListener("resize", layout);
    };
  }, [storedHex, storedLabel]);

  return (
    <div className="absolute inset-0 z-[2]">
      <canvas ref={canvasRef} aria-hidden="true" className="h-full w-full cursor-crosshair" />
      <div
        ref={ringRef}
        aria-hidden="true"
        className="pointer-events-none absolute -ml-[38px] -mt-[38px] h-[76px] w-[76px] rounded-full border-[1.5px] border-oat-50/95 outline outline-1 outline-offset-1 outline-oat-900/20 [animation:breathe_6s_ease-in-out_infinite] max-sm:-ml-[30px] max-sm:-mt-[30px] max-sm:h-[60px] max-sm:w-[60px]"
      >
        <i className="absolute left-1/2 top-1/2 -m-0.5 h-1 w-1 rounded-full bg-oat-50" />
      </div>
      <div
        ref={readingRef}
        className="pointer-events-none absolute flex items-center gap-2.5 whitespace-nowrap rounded-chip border border-[var(--line)] bg-oat-50/85 py-1.5 pl-1.5 pr-3.5 backdrop-blur-md"
      >
        <div ref={swRef} className="h-[26px] w-[26px] rounded-full border border-oat-900/10 max-sm:h-[22px] max-sm:w-[22px]" style={{ background: storedHex }} />
        <div>
          <b ref={hexRef} className="block text-[14px] font-semibold leading-tight tabular-nums tracking-[0.01em] max-sm:text-[13px]">{storedHex.toUpperCase()}</b>
          <small ref={labelRef} className="mt-0.5 block text-[12px] font-medium leading-tight text-[var(--ink-2)] max-sm:text-[11px]">{storedLabel}</small>
        </div>
      </div>
    </div>
  );
}
