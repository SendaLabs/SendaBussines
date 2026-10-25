"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { BufferGeometry, Float32BufferAttribute, type Group } from "three";

const SPIN_RAD_PER_SEC = 1.55;

function useSpherePoints(count: number, radius: number) {
  return useMemo(() => {
    const positions = new Float32Array(count * 3);
    const phi = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2;
      const radiusAtY = Math.sqrt(1 - y * y);
      const theta = phi * i;
      positions[i * 3] = Math.cos(theta) * radiusAtY * radius;
      positions[i * 3 + 1] = y * radius;
      positions[i * 3 + 2] = Math.sin(theta) * radiusAtY * radius;
    }
    return positions;
  }, [count, radius]);
}

export type GlobePalette = {
  sphere: string;
  wire: string;
  wireOpacity: number;
  points: string;
};

const DEFAULT_PALETTE: GlobePalette = {
  sphere: "#171918",
  wire: "#6d6f6e",
  wireOpacity: 0.42,
  points: "#c8c6be",
};

function DottedGlobe({
  reduced,
  palette,
  spin,
}: {
  reduced: boolean;
  palette: GlobePalette;
  spin: number;
}) {
  const group = useRef<Group>(null);
  const points = useSpherePoints(2200, 1.62);
  const geometry = useMemo(() => {
    const geo = new BufferGeometry();
    geo.setAttribute("position", new Float32BufferAttribute(points, 3));
    return geo;
  }, [points]);

  useFrame((_, delta) => {
    const node = group.current;
    if (!node || reduced) return;
    node.rotation.y += delta * spin;
  });

  return (
    <group ref={group} rotation={[0.42, 0.55, 0.06]}>
      <mesh>
        <sphereGeometry args={[1.54, 64, 64]} />
        <meshBasicMaterial color={palette.sphere} />
      </mesh>
      <mesh>
        <icosahedronGeometry args={[1.585, 3]} />
        <meshBasicMaterial
          color={palette.wire}
          wireframe
          transparent
          opacity={palette.wireOpacity}
        />
      </mesh>
      <points geometry={geometry}>
        <pointsMaterial
          color={palette.points}
          size={0.018}
          sizeAttenuation
          transparent
          opacity={0.92}
          depthWrite={false}
        />
      </points>
    </group>
  );
}

export function GlobeScene({
  reduced,
  palette = DEFAULT_PALETTE,
  spin = SPIN_RAD_PER_SEC,
}: {
  reduced: boolean;
  palette?: GlobePalette;
  spin?: number;
}) {
  return (
    <Canvas
      className="absolute inset-0 !h-full !w-full"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      dpr={[1, 1.5]}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      }}
      camera={{ position: [0, 0, 8.2], fov: 32 }}
      frameloop={reduced ? "demand" : "always"}
    >
      <DottedGlobe reduced={reduced} palette={palette} spin={spin} />
    </Canvas>
  );
}
