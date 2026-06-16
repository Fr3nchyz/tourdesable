# Tour de Sable — Portable Context Pack

> **Purpose.** This is a single, self-contained, model-agnostic brief for anyone — human or AI — picking up **Tour de Sable** cold. Paste it wholesale into any agent/model as context. It explains what the game is, how it works, every major design and architecture decision (and *why*), the current tuning, known issues, the roadmap, and the guardrails that keep a fresh agent from re-making mistakes that were already solved.
>
> Last synced from source: `feat/v4-improvements` branch. Tuning numbers below are verified against `src/game/constants.ts` and `src/game/track.ts` (these override any older figures that may appear elsewhere in repo docs).

---

## Contents

1. [TL;DR](#1-tldr)
2. [Origin & concept](#2-origin--concept)
3. [Core loop & rules](#3-core-loop--rules)
4. [Controls & the flick mechanic](#4-controls--the-flick-mechanic)
5. [Tech stack](#5-tech-stack)
6. [Architecture](#6-architecture)
7. [Course generation & the three maps](#7-course-generation--the-three-maps)
8. [Design vision & game feel](#8-design-vision--game-feel)
9. [Physics & surface tuning](#9-physics--surface-tuning)
10. [AI opponents](#10-ai-opponents)
11. [Current state, known issues & roadmap](#11-current-state-known-issues--roadmap)
12. [Decisions & guardrails for agents](#12-decisions--guardrails-for-agents)
13. [Repo pointers & how to run](#13-repo-pointers--how-to-run)

---

## 1. TL;DR

**Tour de Sable** ("Tour of Sand") is a turn-based 3D beach-cycling game: a digital recreation of a childhood game played with glass marbles and Tour-de-France cyclist figurines on the sand beaches of Brittany, France. Players take turns **flicking** their cyclist (a slingshot drag-back) down a hand-carved, procedurally generated sand channel; the marble's distance and direction decide how far the cyclist advances. **First to the finish beacon wins.** It is an **open A→B sprint, not a lap circuit.** Built with Next.js (App Router) + TypeScript + React Three Fiber + Rapier physics + Tailwind. No backend, no database, no asset files — all geometry is Three.js primitives and all audio is procedural WebAudio. Tone: a tactile, nostalgic **toy**, not a simulation.

---

## 2. Origin & concept

The original game used real glass marbles representing Tour de France cyclists moving along a sand track carved by hand with shovels on Breton beaches. Players took turns flicking their marble forward; travel distance and direction determined how far the cyclist advanced; first to the finish won.

The digital version preserves that turn-based flick. The "marble" is still the physics primitive under the hood (a ball collider), but the visible piece is a stylized low-poly cyclist figurine sitting on top of it. The sand course is procedurally generated and themed after **real Breton beach locations** on the Crozon / Plouzané coastline.

**Heritage note (important, keep it):** the courses have a deliberately **asymmetric tall cliff on one flank** (the seaward +X edge). This is intentional and personally meaningful — the creator and his grandfather built the original physical sand courses on the side of a real cliff. It is a signature of the game's identity, strongest on the Bertheaume map (`cliffAmp = 9`). It is heritage, not a bug — preserve and lean into it.

**Tone:** casual, tactile, nostalgic. The feel of sand drag, the unpredictability of bumps and curves, the satisfaction of a perfect flick. Not a physics sim — a toy.

---

## 3. Core loop & rules

```
Lobby (LobbyVote)
  → player picks a map theme (+ seed)
  → generateTrack(seed, theme) builds the course deterministically

Race (GameCanvas + Scene)
  → turns cycle through 4 racers in order: 1 human first, then 3 bots
  → Human turn:
      1. inPhysics = false — cyclist pinned at spawn while the player aims
      2. drag back from the cyclist (slingshot) → release
      3. inPhysics = true — BallCollider launched with impulse = dir * power * MAX_IMPULSE
      4. physics runs until the body settles (speed < SLEEP_SPEED for SETTLE_FRAMES)
      5. turn ends → next racer
  → Bot turn: BOT_THINK_MS (~750 ms) pause, then the same physics flow

Victory (VictoryScreen)
  → shown when any racer reaches the finish beacon
```

**Rules:**
- **Win:** first cyclist to reach the finish beacon (within `FINISH_RADIUS = 4.5 m`) wins.
- **Open A→B sprint:** start near z=0, finish near z=190. There are **no laps**, no circuit, no half-way gate. (A circuit mode is a deferred future epic, not the current game.)
- **Out of bounds:** leave the playable beach and you skip your next turn and respawn near the course centerline.
- **Obstacles:** rocks and terrain bumps slow you down or deflect you.
- **Sea reset:** a marble that falls below `SEA_LEVEL_Y = -3` (off the coast into the sea) is reset.

**Turn-based invariant:** the game is *strictly* turn-based — only the **active** racer is a dynamic Rapier body; all others are `fixed`. Exactly one marble is ever in motion.

---

## 4. Controls & the flick mechanic

The player interacts with an **invisible flat input plane at y=0** that covers the whole scene. R3F pointer events on this plane drive the aim via **camera raycasting** (`e.point` → ground `{x, y:z}`); there is no separate screen-to-world coordinate module.

- `onPointerDown` → record ground point as the drag origin.
- `onPointerMove` → compute `dir` (unit vector) and `power` (0–1) from drag distance. `MAX_DRAG_WORLD = 12 m` of drag maps to 100% power.
- `onPointerUp` → fire impulse `dir * power * MAX_IMPULSE`, stored in a shared `impulseRef`. On the first physics frame after `inPhysics` flips true, the active body reads the ref, applies the impulse, and clears it.

**Slingshot feel:** drag *backwards* from the cyclist (like a slingshot/pool cue). The aim arrow shows direction; colour shifts toward red as power rises. Near max power (`TENSION_THRESHOLD = 0.82`) the arrow visibly jitters (`TENSION_JITTER = 0.14 m`) as strain feedback.

**Camera (`OrbitCamera.tsx`, drei `OrbitControls`):**

| Input | Action |
|---|---|
| Mouse drag | Orbit around the scene |
| Scroll wheel | Zoom (`CAM_MIN_DIST = 6`, `CAM_MAX_DIST = 60`) |
| Arrow keys | Pan the whole camera across the course (moves both target and position) |
| ESC | Pause menu |

- **Smart recenter:** at the start of each turn the camera snaps to ~`(tx, 16, tz−28)` — about 30° above horizontal, looking forward down the course.
- **Aim lock:** OrbitControls are disabled (`enabled={!isAiming}`) while dragging, so the flick doesn't orbit the camera.
- `maxPolarAngle ≈ π/2 − 0.04` keeps the camera above the horizon.

---

## 5. Tech stack

| Layer | Technology (exact version) |
|---|---|
| Framework | **Next.js 16.2.9** (App Router) |
| Language | **TypeScript 5** |
| 3D rendering | **React Three Fiber 9.6.1** + **Three.js 0.184.0** |
| Physics | **Rapier** via **@react-three/rapier 2.2.0** (wasm) |
| Helpers / post | **@react-three/drei 10.7.7**, **@react-three/postprocessing 3.0.4** |
| UI | **React 19.2.4**, **react-dom 19.2.4** |
| Styling | **Tailwind CSS 4** |
| Tests | **Vitest 4.1.8** |
| Hosting (target) | Vercel — `tourdesable.amaurymarque.com` (not yet deployed) |

**No backend. No database. No asset files** — all geometry is built from Three.js primitives; all audio is procedural WebAudio.

---

## 6. Architecture

**Key architectural rule:** `src/game/` (the headless simulation) has **zero dependencies on React, Three.js, or the DOM**. All physics decisions, AI, and state transitions are pure functions or plain classes — fast to unit-test, easy to reason about. React + R3F are a thin shell around this core.

**Coordinate system:**
- **+Z** = forward along the course (start ≈ z=6, finish ≈ z=184; `COURSE_LENGTH = 190`).
- **+X** = cross-course (left/right); `COURSE_WIDTH = 40`.
- **+Y** = up.
- `racer.pos` is a `Vector2D` where **`.x` = world X and `.y` = world Z** (not screen Y). The logic layer pre-dates the 3D renderer and works in ground-plane coordinates.

**File map** (verified against the real `src/` tree):

```
src/
  app/
    page.tsx          Mounts GameCanvas
    layout.tsx, globals.css, favicon.ico
  game/               Pure headless simulation — no DOM, no Three.js, unit-tested
    constants.ts        Single source of truth for ALL tuning (physics, course, camera, themes)
    types.ts            Shared TS interfaces (Racer, Track, Launch, Zone, SurfaceMaterial…)
    rng.ts              Mulberry32 deterministic seeded RNG
    vector.ts           2D vector math (add, sub, dot, normalize, lerp…)
    track.ts            Procedural A→B course generation + heightAt() terrain + path geometry
    surface.ts          Per-frame sand material engine (damping, grain, sink, trails, zones)
    engine.ts           Turn resolution, off-course detection, trail recording (Rapier-backed)
    ai.ts               Bot archetypes → Launch {dir, power} (see §10)
    stateMachine.ts     Phase transitions: lobby → race → victory
    *.test.ts           Vitest suite: vector, rng, track, surface, engine, ai
  render3d/           React Three Fiber scene components
    Scene.tsx           Root: Physics world, lighting, env planes, y=0 input plane
    Terrain.tsx         Heightfield visual mesh + Rapier TrimeshCollider + per-vertex zone tint
    Racers3D.tsx        Active cyclist RigidBody + idle figurines; per-frame zone friction
    Cyclist.tsx         Low-poly cyclist built entirely from R3F primitives
    OrbitCamera.tsx     Orbit camera + arrow-key pan + smart recenter
    Rocks3D.tsx         Rock visuals + BallColliders
    Trails3D.tsx        Persistent carved-channel trail rendering
    SandGround.tsx      Surrounding ground plane
    DirectionArrow.tsx  Heading / power indicator over the active cyclist
    FinishBeacon.tsx    Animated goal marker at the finish
    three-jsx.d.ts      JSX typing for R3F intrinsics
  components/         React UI shell
    GameCanvas.tsx      Master controller: game loop, state, turn order, bot driver, input refs
    LobbyVote.tsx       Map selection screen with difficulty cards
    HUD.tsx             In-race scoreboard + turn indicator
    EscMenu.tsx         Pause overlay: sound toggle, volume, reset, back-to-lobby
    VictoryScreen.tsx   End-of-race screen
  audio/
    audio.ts            Procedural WebAudio (no audio files on disk; largely stubbed)
```

**Physics integration:** `engine.ts` is Rapier-backed and event-driven — **Rapier owns the per-frame integration**. `src/game/` only computes impulses, syncs racer positions, and resolves turns. `<Physics>` runs with an explicit `timeStep={1/60} interpolate`; the active marble uses CCD.

---

## 7. Course generation & the three maps

Each course is **fully deterministic** from a `(seed, theme)` pair — `generateTrack(seed, theme)` always yields the same course. Source of truth: `THEME_PARAMS` in `src/game/track.ts`.

**Generation steps:**
1. Place `start` (x ∈ [−4,4], z=6) and `finish` (x ∈ [−6,6], z=length−6).
2. Build a wandering centerline of `PATH_POINTS = 20` waypoints. Each interior point X = linear baseline + **macro curve** `sin(t · curveFreq) · maxSwing` + **15% random nudge**, clamped 2 m from the edges. `maxSwing = (width/2 − 3) · curveAmp`. The macro curve is what gives each theme its recognisable **C / S / double-S** silhouette; the nudge keeps each seed unique.
3. Scatter theme-specific rocks (count/size), keeping start & finish clear (8 m).
4. Build the terrain via `heightAt()`.

**`heightAt(track, x, z)`** layers (in order):
- **Macro profile** — a per-theme set of Gaussian peaks/valleys (`macroProfile`) on a constant `base` height. This is the **Tour de France stage-profile** elevation (plains → cols → descents). It *replaced* the old linear slope (`slope = 0` everywhere now).
- **Rolling dunes** — two sine waves (`amp`, `freq`) for texture.
- **Seaward cliff** — rises toward the +X edge when `cliffAmp > 0` (Le Minou & Bertheaume only). This is the heritage cliff.
- **Carved channel** — parabolic scoop (−0.4 m) centered on the path centerline, half-width 5 m.
- **Berm shoulders** — smooth pushed-up bumps just outside the channel (5–9 m from centerline).
- **Micro-bumps** — high-frequency sine (`0.12·sin(x·3.1 + z·2.3 + …)`) for a hand-patted feel.

**The three maps** (all real Crozon / Plouzané locations):

| Map | Location | Difficulty | Macro shape | Elevation profile (TdF analogy) | `elevation` (amp/freq/cliffAmp) | `curveAmp` / `curveFreq` | Rocks |
|---|---|---|---|---|---|---|---|
| **Trez-Hir** | Crozon peninsula | Easy | gentle **C → S** (one full S) | "Flat stage with a col": broad crest ~45%, shallow dip ~72% | 0.35 / 0.14 / 0 | 0.55 / 2π (~18° sweeps) | 4–7 small |
| **Le Minou** | Plouzané headland (lighthouse) | Medium | **1.5 S** | "Coastal summit finish": headland summit ~36%, valley ~58%, bump ~80%, then sea-cliff descent | 0.9 / 0.17 / 1.6 | 0.72 / 3π (~32° sweeps) | 6–10 medium |
| **Bertheaume** | Fort de Bertheaume promontory | Hard | **double S** | "Alpine queen stage": two cols (~26%, ~62%) with a deep saddle (~46%), descent valley ~84% | 2.0 / 0.2 / **9** | 0.82 / 4π (~43° committed sweeps) | 10–15 large |

`base` heights (lift valley floors above the sea-reset line): Trez-Hir 1.5, Le Minou 2.5, Bertheaume 3.5.

---

## 8. Design vision & game feel

### The dense marble (the single most important feel target)
The marble should feel like a **real glass marble dropped into a sand channel — dense, not light.** It rolls and keeps constant contact with the sand. It must **NOT**:
- Float or bounce off bumps (dead restitution + constant downforce).
- Skid or slide like a hockey puck (rolling physics on, high friction).
- Run away on descents (sand drag + linear damping).

Natural stops happen *organically*: uncompacted sand varies in resistance, wide berms are draggy, cresting a hill kills momentum. The player should feel they're **judging the weight of the marble against the terrain**, not just angle + power.

### Elevation as genuine challenge
Inspired by **Tour de France stage elevation maps** — each stage has a character (flat plain, mountain col, technical descent), recreated as hills of sand with the racing channel carved through them. **Key constraint: the course is NOT constantly downhill.** A weak shot going uphill naturally stops before the summit and rolls back slightly. The player must judge power to crest a col, then manage speed on the descent. Do **not** add a global downhill slope that makes gravity do all the work.

### Course shapes are deliberate macro forms
Each theme has a recognisable macro curve, not random wandering — Trez-Hir a gentle C/S, Le Minou one S, Bertheaume a double S. The shape should be readable from the lobby card and from the start-of-race camera angle. A 15% per-waypoint random nudge keeps seeds unique without losing the silhouette. **Never make the course a straight line.**

### Cliff heritage
The tall asymmetric cliff on the seaward (+X) flank is intentional and personal (the creator built the real courses on a cliffside with his grandfather). Keep the dramatic cliff on one side when tuning terrain; Bertheaume's `cliffAmp = 9` is its boldest expression.

### Visual language (from reference photos of the physical game)
- Golden Breton beach sand with sparse shell flecks (warm tone).
- Crumbly, irregular **hand-patted berms** — not smooth walls.
- The marble is real translucent green/blue glass; the trajectory preview is rendered as **glass beads**.
- **Cyclist figurines** are the playing pieces — the marble is what physically moves; the cyclist sits on top.
- **Zone-coded sand:** lighter/smoother in the carved channel (fast), darker/rough on the berms (slow), grey granite near rocks (slick). Visuals match the physics.
- Tilt-shift / toy scale; `DepthOfField` post-processing reinforces the miniature feel.

Reference photos live in `docs/reference/` (`tds figurines cyclists.jpeg`, `tds-circuit-riders.jpeg`, `tds-marbleflick-circuit.jpeg`, `tds-marbles-flick.jpeg`).

### What NOT to do
- Don't make the course a straight line (macro curve is the first thing the player reads).
- Don't add a downhill slope that makes all shots feel like gravity is doing the work.
- Don't add bouncy restitution — the marble should **thud, not bounce**.
- Don't load the R3F `<Canvas>` via `next/dynamic({ ssr:false })` (see §12 — it causes WebGL context loss).

---

## 9. Physics & surface tuning

All tuning is centralized in `src/game/constants.ts`. **Edit that file to change feel.** Source-verified values:

### Marble / rigid body
| Constant | Value | Purpose |
|---|---|---|
| `MARBLE_RADIUS` | 0.45 m | Ball collider radius; cyclist visual offset |
| `GRAVITY` | −20 | High gravity keeps cyclists firmly on terrain (earlier −7 felt floaty) |
| `MARBLE_LINEAR_DAMPING` | 0.7 | Base sand drag |
| `MARBLE_ANGULAR_DAMPING` | 0.7 | Prevents excessive spin |
| `MARBLE_FRICTION` | 0.95 | High grip (rolls, doesn't skid) |
| `MARBLE_RESTITUTION` | 0.08 | Near-dead bounce (thud, not bounce) |
| `MARBLE_DOWNFORCE` | 6.0 N/step | Extra downward force pressing the marble into terrain contours |
| `MAX_IMPULSE` | 17 | Peak launch force at 100% power |
| `MAX_DRAG_WORLD` | 12 m | Drag distance mapping to 100% power |

### Turn resolution
| Constant | Value | Purpose |
|---|---|---|
| `SLEEP_SPEED` | 0.18 m/s | Below this = at rest |
| `SETTLE_FRAMES` | 14 | Consecutive rest frames before the turn resolves |
| `MAX_SETTLE_MS` | 7000 | Hard timeout so a turn never hangs |

### Course / world
`COURSE_WIDTH = 40`, `COURSE_LENGTH = 190`, `FINISH_RADIUS = 4.5`, `SEA_LEVEL_Y = −3`, `RACER_COUNT = 4`, `CAM_MIN_DIST = 6`, `CAM_MAX_DIST = 60`.

### Surface material engine (`surface.ts`)
Each frame, `surfaceAt(track, trails, pos, vel)` returns an effective damping (and optional lateral impulse) pushed into the Rapier body:
- **Base friction** from the active **zone** material.
- **Grain variance** — low-frequency value noise (`GRAIN_FREQ = 0.09`) adds ±`grainResistance` so no two patches feel identical.
- **Sink-to-stop** — damping spikes as speed→0 (`SINK_GAIN = 1.0`, `SINK_SCALE = 1.1`): the settling "thud."
- **Trail fast lanes** — riding a previously carved channel reduces damping (`TRAIL_WIDTH = 1.6 m`, `TRAIL_LIFETIME = 4` turns).
- **Grain wobble** — tiny lateral impulse ∝ speed (`WOBBLE_GAIN = 0.008`), suppressed below `WOBBLE_MIN_SPEED = 0.45`.
- **Camber** — currently `CAMBER_GAIN = 0` (disabled; it felt like sideways gravity on slopes). `LANE_HALF_WIDTH = 5`.

### v4 terrain zones (B3)
`Zone = sand | loose_sand_berm | granite_rock` (`types.ts`), classified by `zoneAt()` in `surface.ts`:
| Zone | baseFriction | Collider friction | Feel |
|---|---|---|---|
| `sand` (carved channel) | 0.7 | 0.9 | Fast racing line |
| `loose_sand_berm` | 1.4 | 1.0 | Draggy; punishes straying off the channel |
| `granite_rock` (apron, `GRANITE_MARGIN = 0.9 m` around rocks) | 0.28 | 0.3 | Hard, slick, skittish |

Per-frame collider friction is set in `Racers3D`; per-vertex zone tint in `Terrain.tsx` makes the visuals match the physics.

### Why two key tricks exist
- **`lockRotations` on the active body:** without it the ball collider tumbles the cyclist child mesh. Locking keeps the figurine upright through the shot. (It prevents spinning but not all leaning — see §11.)
- **Freeze-before-flick:** before launch, `inPhysics = false` and `useFrame` pins the body at spawn every frame (translation/linvel/angvel zeroed). Otherwise gravity would drop/slide the cyclist the instant it spawns.

---

## 10. AI opponents

Three bots take turns automatically after the human, each with a `BOT_THINK_MS ≈ 750 ms` pause so turns feel natural rather than instant. Bot logic is a **pure, deterministic** function of `(self, state, rng)` returning a `Launch {dir, power}` (`src/game/ai.ts`). `dir` is in ground-plane coords; `computeLaunch` normalizes `dir` and clamps `power` to [0.05, 1].

**Six archetypes are implemented** (dispatched by `self.botType`):
| Archetype | Behaviour |
|---|---|
| **Bully** | Rams the nearest opponent within `BULLY_RANGE = 18 m` at power 0.95; else charges the path ahead at 0.85 |
| **Sniper** | Sweeps candidate angles (0, ±5°… up to ±35°) to find a rock-clear line (`pathClear`, `SAFE_MARGIN = 4 m`), shoots precise power ~0.72 |
| **Beach-comber** | Erratic: power 0.4–1.0, aim wobble ±15° |
| **Navigator** | Plays Sniper when 1st/2nd, Bully when trailing (uses `placement`) |
| **Coast-Glider** | Hugs the racing line at efficient low power (~0.5) |
| **Daredevil** | 100% power, aimed at a blend of finish direction + immediate path |

Shared helpers: `aheadPoint` looks `LOOKAHEAD_T = 0.14` of progress ahead along the centerline; `nearestOpponent`, `placement`, `pathClear` (10-step ray-march against rocks and rival marbles).

> **Doc/source discrepancy to be aware of:** older repo docs (`README.md`, `CONTEXT.md`) state "no archetype system yet — bots just aim ahead and scale power by distance." That description is **stale** — the archetypes exist and are unit-tested in `ai.ts` (`ai.test.ts`). What is *unconfirmed* is how fully `GameCanvas.tsx` assigns `botType` per opponent and wires `computeLaunch` into the live turn loop. If you touch bot behaviour, verify the wiring in `GameCanvas.tsx` rather than trusting either the prose docs or this note alone.

---

## 11. Current state, known issues & roadmap

**Current branch:** `feat/v4-improvements` (PR #2). v4 shipped: physics robustness (explicit fixed timestep + interpolation, CCD on the active marble), B3 coastal terrain zones (physics + legible per-vertex tint), a glass-bead trajectory preview, `touch-action:none` mobile-safe input, and sand polish (golden tone, shell flecks, hand-patted berms). Test suite was ~84 green at last sync.

**Known issues / quirks:**
- **Cyclist leans/tips on steep Bertheaume slopes** — the ball collider slides on steep grades; `lockRotations` stops spin but not lean. Visual quirk, not a physics bug.
- **Off-course respawn snaps instantly** to the centerline. Original intent was a *gradual* rescue (move ~one marble's width toward center per missed turn).
- **No audio yet** — `audio.ts` exists and the ESC menu has a sound toggle + volume slider, but ocean ambient / flick / settle sounds are stubbed.
- **Lobby thumbnails are text cards**, not real map previews.
- **AI wiring** — archetypes exist (§10) but live per-opponent assignment in `GameCanvas` is unverified.

**Roadmap (priority order):**
- *Near-term:* cyclist leans with the terrain normal; gradual off-course rescue; collision momentum transfer (the classic marble shunt when the active cyclist hits an idle one); basic ambient audio.
- *Mid-term:* finish wiring/ tuning the bot archetypes; lobby map-preview thumbnails (mini top-down render); cyclist animation (lean during shot, pedalling legs); victory podium + confetti; deploy to `tourdesable.amaurymarque.com`.
- *Later:* local hot-seat multiplayer (2 humans + 2 bots); mobile touch flick; wind mechanic; rogue-wave event (waterlogged sand for 2 rounds); course editor / custom seed entry; possible circuit/lap mode (deferred — current game is strictly A→B).

---

## 12. Decisions & guardrails for agents

Read this before changing anything. These are settled decisions; several encode mistakes already made and reverted.

**Environment / path traps**
- **The real project is at `/Users/amaurybat/personalProjects/claude/tourDeSable`** (all lowercase, no space). A near-empty decoy exists at `/Users/amaurybat/Personal Projects/Claude/tourDeSable` (capitalized, with a space) containing only `.next` artifacts — it is **not** the project. Tooling cwd tends to reset to the decoy; always `cd` to the lowercase path.
- GitHub: **https://github.com/Fr3nchyz/tourdesable**.

**Hard "do not" (already tried, already reverted)**
- **Do NOT load `GameCanvas` / the R3F `<Canvas>` via `next/dynamic({ ssr:false })`.** Under Next 16 + Turbopack + StrictMode it churns the Canvas mount and leaks WebGL contexts → repeated `WebGLRenderer: Context Lost` + blank canvas. `GameCanvas` is already `"use client"`; use a plain import. (Bisected and reverted in v4.)
- **Do NOT add bouncy restitution.** The marble must thud, not bounce (`MARBLE_RESTITUTION = 0.08`).
- **Do NOT add a global downhill slope** (`slope = 0` by design; elevation comes from the Gaussian `macroProfile`). Uphill challenge is the point.
- **Do NOT make the course a straight line** — the macro C/S/double-S curve is core identity.
- **Do NOT remove or flatten the seaward cliff** — it's heritage.

**Rejected external recommendations (don't re-evaluate these — they target an architecture this build doesn't have):**
- Custom fixed-timestep accumulator / sub-stepping / a hand-rolled `collision.ts` CCD — **Rapier already does CCD and fixed-step by default.**
- Two-pass jitter fix — the game is turn-based with one mover; unnecessary.
- In-place vector mutation for the hot loop — the hot loop is wasm (Rapier), not JS.
- `lastTrackSegmentIndex` windowing on a `nearestOnLoop` — there is no loop; it's a 19-segment open polyline.
- Manual `−g·∇H` slope gravity — the Rapier trimesh already produces slope response.
- Lap-gate / `passedHalf` logic — there are no laps.
- zustand store / `instancedMesh` / fancy glass-marble transmission material — overkill for 4 racers; the marble isn't the visible piece.
- Lockstep multiplayer — no net layer, and Rapier determinism across clients is unreliable.
- These recs invented files that don't (and shouldn't) exist: `collision.ts`, `physics.ts`, `friction.ts`, `FollowCamera.tsx`. The camera is `OrbitCamera.tsx`, not a follow cam; there is no `coords.ts` (input is direct camera raycasting); friction lives in `surface.ts` + `constants.ts`, not a `friction.ts`.

**Where to make common changes**
- **Feel / physics:** `src/game/constants.ts` (single source of truth).
- **A map's shape/terrain/rocks:** `THEME_PARAMS` in `src/game/track.ts`.
- **The cyclist model:** `src/render3d/Cyclist.tsx` (all inline primitives — no asset files).
- **Add a new map theme:** add to `THEMES`/`THEME_NAMES` in `constants.ts`, a `THEME_PARAMS` entry in `track.ts`, and theme metadata in `LobbyVote.tsx`.
- **Testing note:** when sampling "sand" in surface tests, sample **on the centerline** via `pathPointAt` — the wandering channel often puts x=0 in the berm zone. Two camber tests reflect `CAMBER_GAIN = 0` (deliberately disabled).

---

## 13. Repo pointers & how to run

- **GitHub:** https://github.com/Fr3nchyz/tourdesable
- **Local path (real):** `/Users/amaurybat/personalProjects/claude/tourDeSable`
- **Current branch:** `feat/v4-improvements` · other branches: `main`, `feat/3d-circuit-overhaul`, `feat/game-implementation`
- **Deploy target:** `tourdesable.amaurymarque.com` (Vercel; not yet deployed)

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # Vitest unit suite (game logic only; rendering/physics are manual playtest)
npm run build    # production build
npm run lint     # ESLint
```

**Entry points worth reading first, in order:** `src/components/GameCanvas.tsx` (the controller) → `src/render3d/Scene.tsx` (the world + input plane) → `src/game/track.ts` and `src/game/constants.ts` (everything tunable) → `src/game/ai.ts` (bots) → `src/game/surface.ts` (the sand feel).

*The Vitest suite covers the headless layer (vector, rng, track generation, path geometry, surface material, trail decay, engine, ai). It does not cover rendering or live physics — those are manual playtest only.*
