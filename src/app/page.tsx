"use client";

// The race is an all-client WebGL canvas (R3F + Rapier wasm). Load it with
// ssr:false so Next never attempts to server-render the canvas — avoids
// hydration churn and SSR-time `window`/WebGL access. `ssr:false` is only
// valid inside a Client Component, hence the directive above.
import dynamic from "next/dynamic";

const GameCanvas = dynamic(() => import("@/components/GameCanvas"), {
  ssr: false,
});

export default function Home() {
  return <GameCanvas />;
}
