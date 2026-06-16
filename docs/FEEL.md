# Tour de Sable — Feel Doc (living draft)

> **Status:** draft, in the creator's words. This is NOT a spec of what the code does — it's a description of the *experience we want* and where the current build falls short. Everything here is feel-first; implementation is downstream. Correct freely.
>
> The framing that started this doc: *the game isn't missing features — it's missing enhancements. The experience of playing it is lame.* The job of v5 is to make the existing simulation **feel** like flicking a glass marble through Breton beach sand, crouched over it as a kid.

---

## 1. The flick is wrong

**Problem:** dragging the marble back and releasing resembles a **pinball plunger or a billiard cue** — power is "how far you pull back." That is not flicking a marble. A real marble flick is a **thumb snap**: short, explosive, and the skill is in the *speed and crispness of the gesture*, not a measured pull-back distance. Right now the act feels like setting a vector, not performing a flick.

**Direction:** stop measuring drag distance; measure **gesture velocity**.
- Power comes from how *fast* you flick, not how far you drag.
- Direction comes from the swipe vector.
- There's a short release/snap window — a crisp, quick motion reads as a strong flick; a slow drag does almost nothing.
- Skill = a clean, committed flick. Mistakes = mushy, hesitant, or mis-angled snaps.

**Open question for playtest:** does the gesture want to be *toward* the target (push the marble) or a *flick away* like the real thumb motion? To be felt in the prototype, not decided on paper.

---

## 2. The scale is off

**Problem:** as a kid (≈4–14) everything loomed larger, and the game was played **crouched and leaned in**, eyes close to the sand. The current game is played from an **adult overview** — too high. The high angle is genuinely useful (you can see your rider and the others), but it kills the intimacy and the sense of scale.

**Direction:** map the camera to the **physical posture** — *crouch to flick, look up to watch.*
- While aiming, the camera **dips low and close** behind the marble. You lean into the sand, the berms loom, scale comes back, the flick feels committal.
- On release, it **lifts back to the high overview** to watch the roll play out among the rivals.
- This is the actual rhythm of how the game was played, not a toggle.

Supporting: heavier tilt-shift / depth-of-field when low; slightly oversized grain and berms to recover the child's-eye scale. The crouch/lift rhythm is the primary lever.

---

## 3. Sand doesn't feel like sand

**Problem:** the marble rolls *on* a surface; it should roll *in* one. A marble in beach sand sits **half-sunk in a groove**, bites, chews speed unevenly, throws a little spray at pace, and leaves a deepening track. The current build has the damping/grain math but none of the *sensory* grit.

**Direction (feedback layer, not new physics):**
- The marble visually **settles into the channel** — contact below the surface line, not perched on top.
- **Sand spray** particle kick that scales with speed.
- A **groove that visibly deepens** as the marble passes.
- A **micro speed-ripple** you can see in the roll (it doesn't glide — it grinds).
- **Grain audio** whose pitch/gain track speed — this is what fuses all of the above into "sand."

---

## 4. The circuits are too wide

**Problem:** wide channels make every shot forgiving — nothing feels skillful. The macro S-curves are nice but there's no demand for precision.

**Direction:**
- **Narrow** the racing line overall.
- Add **bottlenecks / pinch points** that demand a precise flick.
- A **tunnel** on the hard map (Bertheaume) — a brief occluded stretch. Drama + risk, and it plays against the crouch-low camera: you lose sight, you have to commit.
- Lean into the **heritage cliff** — a too-hot shot can sail off the seaward edge into the sea (already a reset condition); make that a dramatic *event*, not a silent respawn.

---

## 5. Decision: stop generating maps — author the three

Procedural generation was solving a problem we don't have (content volume) and actively fights everything in §4 — you can't place a tunnel or tune a pinch point in noise.

**Decision:** **fixed authored layout + cosmetic-only seed variation.**
- Layout, width profile, bottlenecks, tunnel, cliff, finish = hand-sculpted per map, identical every play.
- Seed drives **cosmetic** jitter only (shell flecks, dune micro-texture) so a course never looks pixel-identical.
- Trez-Hir / Le Minou / Bertheaume become three memorable, individually-tuned courses, not seeds of a generator.

---

## Working order

1. **This doc** — capture the feel in the creator's words (you're reading the draft).
2. **Prototype the flick** in isolation — compare input models by *feel*, no terrain, throwaway. (Owed playtest of the current build comes first before any of this is implemented.)
3. **Commit to authored maps** — sculpt one map (likely Bertheaume, for the tunnel/cliff) as a vertical slice.

*Nothing here is implemented yet. The current build still has an owed playtest; this doc and the flick prototype are exploration ahead of that.*
