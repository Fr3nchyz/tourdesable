# Tour de Sable

A turn-based 3D beach cycling game set on the real Breton coastline. Players flick their cyclist down a hand-carved sand path, competing against three AI opponents to reach the finish line first.

Inspired by a childhood game played with marbles and cyclist figurines on Brittany beaches. Built with **Next.js (App Router) · TypeScript · React Three Fiber · Rapier physics · Tailwind CSS**.

---

## Quickstart

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # Vitest unit suite
npm run build    # production build
```

---

## How to play

### Lobby
Three real Breton beach maps are available. Pick one — each has a different difficulty and terrain character.

| Map | Location | Difficulty |
|-----|----------|------------|
| Trez-Hir | Crozon peninsula | Easy — gentle dunes, wide path |
| Le Minou | Plouzané headland | Medium — rolling hills, cliff edge |
| Bertheaume | Fort de Bertheaume | Hard — dramatic elevation, tight curves |

### Your turn
1. **Aim** — click and drag *backwards* from your cyclist to set direction and power (slingshot mechanic). The arrow shows direction; colour shifts red as power increases.
2. **Release** — your cyclist launches along the carved sand path.
3. **Wait** — the turn resolves when your cyclist settles. Then the next racer goes.

### Camera controls
| Input | Action |
|-------|--------|
| Mouse drag | Orbit around the scene |
| Scroll wheel | Zoom in / out |
| Arrow keys | Pan the camera across the course |
| ESC | Open the pause menu |

### Rules
- **Finish line** — first cyclist to reach the beacon at the far end wins.
- **Out of bounds** — fall off the path and you skip your next turn, respawning near the course centre.
- **Obstacles** — rocks and terrain bumps slow you down or deflect your path.

---

## Architecture

```
src/
  app/            Next.js App Router entry
  game/           Pure headless simulation — no DOM, fully unit-tested
    constants.ts    All tuning values (physics, course, camera)
    track.ts        Procedural A→B course generation + heightAt terrain
    surface.ts      Material-driven sand feel (grain, damping, trails)
    engine.ts       Turn resolution, off-course respawn, trail recording
    stateMachine.ts Game phase transitions (lobby → race → victory)
    rng.ts          Mulberry32 deterministic RNG
    vector.ts       2D vector math
    types.ts        Shared interfaces
  render3d/       React Three Fiber scene
    Scene.tsx       Physics world, lighting, environment planes, input plane
    Terrain.tsx     Heightfield mesh + Rapier trimesh collider
    Racers3D.tsx    Active cyclist (RigidBody) + idle figurines
    Cyclist.tsx     Stylized low-poly cyclist built from primitives
    OrbitCamera.tsx Orbit + arrow-key pan camera
    Rocks3D.tsx     Rock colliders and visuals
    Trails3D.tsx    Persistent carved-sand channel rendering
    DirectionArrow  Heading indicator over the active cyclist
    FinishBeacon    Animated goal marker
  components/     React UI shell
    GameCanvas.tsx  Main game controller — state, input, bot AI loop
    LobbyVote.tsx   Map selection screen
    HUD.tsx         In-race scoreboard and turn indicator
    EscMenu.tsx     Pause overlay (sound, reset, lobby)
  audio/          Procedural WebAudio — no asset files
```

The game logic layer (`src/game/`) is fully decoupled from React and Three.js, making physics, AI, and collision rules independently testable.

---

## Physics

The game uses **Rapier** (via `@react-three/rapier`) for rigid-body simulation:

- Each active cyclist is a `RigidBody` with a `BallCollider` of radius `MARBLE_RADIUS`. Rotation is locked so the figurine stays upright.
- Idle cyclists use a `CylinderCollider` so the active cyclist can collide with them.
- The terrain is a `TrimeshCollider` built from the same vertex grid that's rendered.
- Per-frame surface displacement applies sand drag, grain variance, and carved-channel fast lanes from `surface.ts`.

Key tuning constants in `src/game/constants.ts`:

| Constant | Value | Purpose |
|----------|-------|---------|
| `GRAVITY` | -20 | Keeps cyclists firmly on terrain |
| `MAX_IMPULSE` | 17 | Peak launch force |
| `MARBLE_LINEAR_DAMPING` | 0.7 | Base sand drag |
| `SAND_MATERIAL.grainResistance` | 0.4 | Grain variance ± this |

---

## Course generation

Each map is seeded and deterministic. The generator (`src/game/track.ts`):

1. Places a start and finish point.
2. Builds a wandering centerline with `PATH_POINTS = 20` waypoints. A sinusoidal macro curve forces the S-curves; per-theme `curveFreq` sets the silhouette (2π = one S, 3π = 1.5 S, 4π = double S) and `curveAmp` scales how far the path swings, plus a 15% random nudge per point.
3. Scatters rocks along the course, cleared from the start/finish zones.
4. Computes terrain height via `heightAt()`: rolling dunes + slope + optional seaward cliff + carved channel depression + sand berm shoulders.

---

## AI opponents

Three bots take turns automatically. Bot think time is `BOT_THINK_MS = 750 ms` — a small delay so turns feel natural rather than instant.

Bot strategy lives in `src/game/ai.ts` as six deterministic archetypes, each returning a `Launch {dir, power}`:

| Archetype | Behaviour |
|-----------|-----------|
| Bully | Rams the nearest opponent within range; else charges ahead |
| Sniper | Sweeps angles for a rock-clear line, precise power |
| Beach-comber | Erratic power and aim wobble |
| Navigator | Sniper when leading, Bully when trailing |
| Coast-Glider | Hugs the racing line at efficient low power |
| Daredevil | Full power toward a finish/path blend |

`computeLaunch` dispatches by `self.botType`. (Per-opponent assignment in `GameCanvas` is still being finalised.)

---

## Development

```bash
npm test              # run Vitest suite
npm run lint          # ESLint
```

The test suite covers: track generation, path geometry, surface material sampling, trail decay, and camber/grain physics helpers.
