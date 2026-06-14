# Tour de Sable 🏖️

Local, single-player, turn-based 2D physics marble racing — an homage to childhood
beach marble-cyclist racing on the Brittany coast (the Blancs-Sablons flatlands).

Built with **Next.js (App Router) + TypeScript + Tailwind**. All physics run natively
in TypeScript on an HTML5 Canvas. No backend, no database — it initialises on run.

## Run

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # Vitest unit suite (physics / AI / collisions / waves)
npm run build    # production build
```

## How to play

1. **Lobby** — three randomized track seeds are shown as thumbnails. Click one.
2. **Flick** — on your turn, drag *backwards* from your marble (slingshot) to set
   direction + power, then release to launch. Heavy sand drag bleeds your speed.
3. Outrun 3 AI bots (drawn from 6 archetypes) to the finish line at the top.

### Mechanics
- **Friction zones** — racing lane (fast), dry shoulder (2× drag), kelp (instant stop).
- **Pocket-Stealer Shunt** — ram a stopped marble: 70% of your speed transfers to it
  (shoving it to the shoulder) while you stop dead in its vacated pocket.
- **Driftwood** bounces elastically; **wind ripples** speed you up along them, wobble
  you across them.
- **Rogue Wave** — from round 3, a 20% chance the Blancs-Sablons Surge sweeps the lower
  track, shoving marbles back and leaving 2 rounds of near-frictionless waterlogged sand.
- **Out of bounds** = tipped over: miss a turn, respawn at the ledge (mini-golf reset).

## Architecture

```
src/game/      Pure, headless, unit-tested simulation (no DOM)
  vector, rng, track, friction, physics, collision, ai, wave, stateMachine, engine
src/render/    Canvas drawing: renderer, trails, particles, effects
src/audio/     Procedural WebAudio (clink + ocean), no asset files
src/components/ React shell: GameCanvas (rAF loop + input), LobbyVote, HUD, VictoryScreen
```

The game logic is fully decoupled from React so physics/AI/collisions are testable in
isolation; React is a thin shell that mounts the canvas, runs the animation loop, draws
the phase UI, and forwards pointer input.

### 6 AI archetypes
Bully (rams nearest), Sniper (precise, kelp-avoidant), Beach-Comber (erratic),
Navigator (adaptive: snipes while leading, bullies while trailing),
Coast-Glider (rides low-friction lines), Daredevil (always full power).
