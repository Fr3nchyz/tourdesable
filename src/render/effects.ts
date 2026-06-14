// ============================================================================
// tour-de-sable — localized screen shake
// A faint 2px rumble fired on wave impacts / hard collisions. Decays quickly.
// ============================================================================

import { SCREEN_SHAKE_PX } from "@/game/constants";

export class ScreenShake {
  private intensity = 0;

  /** Trigger a rumble. `scale` 1 = standard 2px. */
  trigger(scale = 1): void {
    this.intensity = Math.max(this.intensity, SCREEN_SHAKE_PX * scale);
  }

  /** Advance one frame and return the current pixel offset. */
  step(): { x: number; y: number } {
    if (this.intensity < 0.1) {
      this.intensity = 0;
      return { x: 0, y: 0 };
    }
    const x = (Math.random() * 2 - 1) * this.intensity;
    const y = (Math.random() * 2 - 1) * this.intensity;
    this.intensity *= 0.85;
    return { x, y };
  }
}
