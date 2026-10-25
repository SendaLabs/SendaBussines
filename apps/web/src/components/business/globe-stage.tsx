"use client";

import dynamic from "next/dynamic";
import {
  Component,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { useReducedMotion } from "framer-motion";

const GlobeScene = dynamic(
  () =>
    import("@/components/business/globe-scene").then((mod) => mod.GlobeScene),
  { ssr: false, loading: () => <GlobeFallback /> },
);

const chips = [
  { code: "CAD", mark: "CA" },
  { code: "USD", mark: "US" },
  { code: "MXN", mark: "MX" },
  { code: "COP", mark: "CO" },
  { code: "BRL", mark: "BR" },
  { code: "EUR", mark: "EU" },
  { code: "GBP", mark: "GB" },
  { code: "ARS", mark: "AR" },
  { code: "GTQ", mark: "GT" },
  { code: "PYG", mark: "PY" },
  { code: "BOB", mark: "BO" },
  { code: "PAB / USD", mark: "PA" },
  { code: "USD", mark: "EC", key: "usd-ec" },
] as const;

const LANES = [4, 5, 4] as const;

class WebGLErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) return <GlobeFallback />;
    return this.props.children;
  }
}

function GlobeFallback() {
  return (
    <div
      className="absolute inset-[18%] rounded-full bg-[radial-gradient(circle_at_32%_28%,#3a3d3c,transparent_46%),radial-gradient(circle_at_50%_50%,#1b1d1c_0%,#111_78%)]"
      aria-hidden
    />
  );
}

export function BusinessGlobeStage({ label }: { label: string }) {
  const reduce = useReducedMotion() ?? false;
  const [useScene, setUseScene] = useState(false);
  const layerRef = useRef<HTMLDivElement>(null);
  const pillsRef = useRef<Array<HTMLSpanElement | null>>([]);

  useEffect(() => {
    setUseScene(!reduce);
  }, [reduce]);

  useEffect(() => {
    if (reduce) return;
    const layer = layerRef.current;
    if (!layer) return;

    let frame = 0;
    let angle = 0;
    let last = 0;

    const tick = (now: number) => {
      if (last) angle += Math.min(now - last, 48) * 0.00032;
      last = now;

      const width = layer.clientWidth;
      const height = layer.clientHeight;
      let offset = 0;

      LANES.forEach((count, lane) => {
        for (let index = 0; index < count; index++) {
          const pill = pillsRef.current[offset + index];
          if (!pill) continue;
          const orbit =
            angle * (lane === 1 ? -0.82 : 1) +
            (index / count) * Math.PI * 2 +
            lane * 0.7;
          const depth = (Math.sin(orbit) + 1) / 2;
          const x = Math.cos(orbit) * (width / 2 - 70);
          const y = (lane - 1) * height * 0.24 + Math.sin(orbit) * height * 0.08;
          pill.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(${0.74 + depth * 0.28})`;
          pill.style.opacity = String(0.5 + depth * 0.5);
          pill.style.zIndex = String(Math.round(depth * 100));
        }
        offset += count;
      });

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reduce]);

  return (
    <div
      className="relative mx-auto aspect-square w-full max-w-[30rem] lg:max-w-[34rem]"
      role="img"
      aria-label={label}
    >
      <div className="pointer-events-none absolute inset-[8%]" aria-hidden>
        {useScene ? (
          <WebGLErrorBoundary>
            <GlobeScene reduced={reduce} />
          </WebGLErrorBoundary>
        ) : (
          <GlobeFallback />
        )}
      </div>

      <div ref={layerRef} className="absolute inset-0" aria-hidden>
        {chips.map((chip, index) => {
          const lane = index < 4 ? 0 : index < 9 ? 1 : 2;
          const slot = index < 4 ? index : index < 9 ? index - 4 : index - 9;
          const laneCount = lane === 1 ? 5 : 4;
          const orbit = (slot / laneCount) * Math.PI * 2 + lane * 0.7;
          const staticX = Math.cos(orbit) * 38;
          const staticY = (lane - 1) * 26 + Math.sin(orbit) * 8;

          return (
            <span
              key={"key" in chip ? chip.key : `${chip.mark}-${chip.code}`}
              ref={(node) => {
                pillsRef.current[index] = node;
              }}
              className="absolute top-1/2 left-1/2 inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-full bg-[#171918] px-2.5 py-1 text-[0.65rem] tracking-[0.03em] text-cream shadow-[0_10px_22px_rgba(23,25,24,0.22)] sm:px-3 sm:py-1.5 sm:text-[0.7rem]"
              style={
                reduce
                  ? {
                      transform: `translate(calc(-50% + ${staticX}%), calc(-50% + ${staticY}%))`,
                    }
                  : undefined
              }
            >
              <span className="flex size-5 items-center justify-center rounded-full bg-cream/12 text-[0.52rem] font-medium">
                {chip.mark}
              </span>
              {chip.code}
            </span>
          );
        })}
      </div>
    </div>
  );
}
