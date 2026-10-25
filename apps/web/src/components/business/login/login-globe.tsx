"use client";

import dynamic from "next/dynamic";
import { Component, type ReactNode, useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

import type { GlobePalette } from "@/components/business/globe-scene";

const GlobeScene = dynamic(
  () =>
    import("@/components/business/globe-scene").then((mod) => mod.GlobeScene),
  { ssr: false, loading: () => <GlobeFallback /> },
);

const PALETTE: GlobePalette = {
  sphere: "#08251f",
  wire: "#3f8a72",
  wireOpacity: 0.2,
  points: "#f0d9a0",
};

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
      className="absolute inset-[16%] rounded-full bg-[radial-gradient(circle_at_40%_30%,#1f5a4a,transparent_55%),radial-gradient(circle_at_50%_50%,#0c3129_0%,#061c17_78%)]"
      aria-hidden
    />
  );
}

export function LoginGlobe() {
  const reduce = useReducedMotion() ?? false;
  const [useScene, setUseScene] = useState(false);

  useEffect(() => {
    setUseScene(true);
  }, []);

  return (
    <div
      className="pointer-events-none absolute top-[38%] left-1/2 aspect-square w-[170%] -translate-x-1/2"
      aria-hidden
    >
      <div className="absolute inset-[14%] rounded-full bg-[#2f8f72]/25 blur-3xl" />
      {useScene ? (
        <WebGLErrorBoundary>
          <GlobeScene reduced={reduce} palette={PALETTE} spin={0.18} />
        </WebGLErrorBoundary>
      ) : (
        <GlobeFallback />
      )}
    </div>
  );
}
