# Living streets · Step 09

## Planner, rendering and shared physics

- `src/npc/traffic.ts` derives directed lane paths from the actual city road graph, respecting lane offset, direction and speed limit. Cautious/normal/aggressive drivers use different speed, headway, gaps, acceleration, braking and patience.
- Front-to-back leader constraints and receiving-lane clearance prevent queue through-driving. Oldest eligible lane heads get priority. Turns reserve an intersection exclusively; geometrically separated parallel straight lanes may share green. Straight curves preserve lane separation instead of converging to the node center.
- Signals, braking, turn indicators, overtaking and impatience honks are implemented. Player-obstruction/crash and siren reactions exist; future gunfire-flee is an API hook only. No gun, police AI or combat is introduced.
- Pedestrians use a connected sidewalk graph with cached A* routes. It includes legal crossings, destination walking, paired chats, eligible physical benches and timed entry/exit at actual parked cars. The near pool plays CC0 glTF Walk/Idle/Run/Flee/Sit/Chat; Chat is a renamed greeting and Flee a retimed Run, not newly captured motion. Far people use one cheap instanced draw.
- Day/night reduces people and increases headlights. The Medium/Balanced starting budget is **60 moving cars + 120 people**, with up to 16 additional parked cars in the local pool. These agents are distributed over nearby connected blocks, not all squeezed into 80 m.
- Only within **80 m** and an appropriate vertical range are full Rapier raycast cars and pedestrian capsules installed. Their bodies join the **same** city world. Population never calls `world.step()`; the game performs exactly one shared step per fixed tick. Near bodies feed actual positions/velocities back into planning. Far cars are not separate full-physics vehicles.
- Twelve decoded car models share a `BatchedMesh`; far stand-ins use simpler geometry. Near skinned-pedestrian caps are Low 3 / Balanced 6 / High 8 / Ultra 12. Moving batches disable only their stale outer frustum bound; per-instance culling remains active.

## Signals and queue interpretation

The conservative 80-second cycle is X green 0–18, amber 18–20; Z green 22–40, amber 40–42; pedestrian start/clearance 44–78, phase until 80. Node offsets stagger signals. Pedestrians cannot start while active vehicle transitions occupy the intersection, and cannot start without enough time to finish. Vehicle entry requires green; an already-entered turn clears normally.

**Long red/queue stops are not hidden by the “unexplained stop” counter.** The independent loaded-city run records a maximum stationary wait of approximately 78 seconds; the 240-second pure-planner soak records approximately 119 seconds. Independent sampled rectangle/red/crossing audits find no violations in those specific runs, but the pure report also lists **13 later observed IDs with no recorded intersection entry**, and the loaded report lists **9 initial-cohort IDs with none observed**. Retirement/recycling can affect that coverage; neither list is silently treated as a progress guarantee. These queues span signal cycles, so the strict **“no stuck cars” visual acceptance is not signed off**. Do not infer success from a small `maxUnexplainedStop` value, snapshots alone or recycled far agents.

## Adaptive cost controls

`PopulationBudget` observes actual render-frame intervals, including severe multi-second frames. It reduces density multiplicatively under sustained load (floor 25%; absolute floors 8 cars/16 people), and recovers slowly after sustained fast rendering. Density adapts even with a fixed graphics tier. The existing Auto renderer separately lowers resolution/effect/shadow/chunk budgets; manual graphics choice stays manual. Hidden/paused animation time and >30-second background gaps are not treated as normal render samples. Explicit test density locks adaptation and is labeled as such in evidence.

Low now retains a 3×3 local-detail chunk neighborhood; Balanced/High 5×5 and Ultra 7×7. Retired chunks follow the same square bounds, avoiding repeated retire/reinstall churn at corners. Distant city coverage, boats/aircraft, road/city features and the full selectable parkour route are retained. Wet effects/mirrors remain quality-dependent.

## Reproduce acceptance

```bash
npx tsx tools/accept-traffic.ts             # Pure 240-second / 3-cycle planner soak
npx tsx tools/accept-roster.ts              # Actual Rapier handling/braking, all 12
node tools/accept-population.mjs            # Loaded-city 120 simulated seconds
WATCH=1 POP_LABEL=rendered-watch node tools/accept-population.mjs
# Separate actual unpaused two-minute wall-time observation; not accelerated FPS proof.
```

`accept-population.mjs` has an independent four-corner rectangle SAT (not the game overlap helper), per-tick new-intersection signal checks, sampled crossing checks, actual near-body states and explicit waits. It labels software rendering, wall time, simulation time and forced density. Its manual stepping is **not** two minutes of smooth rendering. `WATCH=1` records real display cadence separately; severe low FPS can make simulated time lag far behind wall time.

The siren test switch is in **Esc → The motor club**. It is a reaction flag, not a new police/siren vehicle. Test hooks are available in development or `?test`; normal play has no gunfire control. The future gunfire API changes fear states only.

## Executed 0.9 observation boundary

- Loaded real shared-world 120 simulated seconds: 7,200 ticks in **20.281 wall seconds**, forced 60/120, maximum **12** full proxies. Independent samples: overlap/red entry/illegal crossing/nonfinite 0; 67 agents observed ≥30 s, no <1 m starvation. Raw maximum stopped wait **78.183 s** remains a concern.
- Actual fixed Balanced occupied parked car: **120.228 wall seconds**; 216 rAF intervals over 116.162 s, **1.859 FPS**, only **20.883 simulated seconds** observed. No duration-qualified starvation cohort. Density is deliberately locked for this stress check.
- Separate actual Auto occupied-car watch: **120.116 wall seconds**; 291 intervals over 118.229 s, **2.461 FPS**, **27.333 simulated seconds** observed. Auto reaches Low; actual density factor **0.25**, six reductions, **8 cars / 16 people**. Again, no ≥30-s observed cohort.
- Actual player/NPC shared-world crash: 80 chassis-contact samples; both cars damaged, braking and **one** evasive lane change; siren produces **12** pull-overs. Night reduces the sampled 85 people to 58 and all moving cars enable headlights. The future fear API introduces no weapon.

The raw simulation state is compressed separately; the readable summaries, full audit counters, cadence and `rawEvidence` paths are in `evidence/crosstown-0.9.0/population-*.json`. Explicitly retired agents do not accrue fake observation age. A long red or queue is never hidden behind `maxUnexplainedStop`. The wall-time checks passed their sampled constraints, **not the native FPS or strict no-stuck gate**.

## Open gates

Near-60 FPS in busy Medium and with ten near cars is not accepted on this software-rendered machine or on the unavailable target laptop. Visual no-stuck acceptance, subjective social-animation quality, broad intersection/traffic seed coverage and long GPU-memory soaks remain open. Original 0.7/0.5 evidence is historical, not proof of the new population. See `TEST-RESULTS.json`, `PROGRESS.md` and `FINDINGS.md`.
