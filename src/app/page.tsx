import GameCanvas from "@/components/GameCanvas";

// NOTE: do NOT load this via next/dynamic({ ssr: false }). Under Next 16 +
// Turbopack + React StrictMode that swap churns the R3F <Canvas> mount and
// leaks WebGL contexts until the browser kills them ("WebGLRenderer: Context
// Lost", blank canvas). GameCanvas is already "use client", so the canvas only
// mounts client-side anyway — a plain import is correct here.
export default function Home() {
  return <GameCanvas />;
}
