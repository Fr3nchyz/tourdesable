"use client";

// ============================================================================
// CanvasErrorBoundary — catches any error thrown inside the R3F <Canvas> tree
// (shader/geometry failures, lost-then-thrown WebGL state, etc.) so a GPU
// hiccup shows a recoverable "tap to restart" panel instead of a blank screen.
// WebGL *context loss* (a DOM event, not a thrown error) is handled separately
// in GameCanvas; both surface the same fallback.
// ============================================================================

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Reset the game to a clean state when the user taps restart. */
  onReset: () => void;
}

interface State {
  hasError: boolean;
}

export default class CanvasErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    // Surface for debugging; the fallback already informs the user.
    console.error("Canvas crashed:", error);
  }

  private handleRestart = () => {
    this.props.onReset();
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-gradient-to-b from-slate-800 via-sky-900 to-amber-950 text-center text-amber-50">
          <p className="text-lg font-semibold">The race hit a graphics snag.</p>
          <button
            onClick={this.handleRestart}
            className="rounded-lg bg-amber-500 px-5 py-2.5 font-medium text-slate-900 shadow-lg transition hover:bg-amber-400"
          >
            Tap to restart
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
