# Vendored upstream-identical code (Organon `dsh-evolve-loop`)

**Fusion2** is an independent fork of Fusion. Vendored Organon files below are
unchanged from Fusion; Fusion2 adds `src/fuse/trace.js`, `breakthrough.js`, and
commit/evidence/gate hooks (see `docs/PROVENANCE.md`).

These files are **written out** from Organon so the stack can be reviewed and can
depend on **DSH** at runtime. Behavior matches upstream defaults unless noted.

Full dependency map: [`docs/UPSTREAM.md`](docs/UPSTREAM.md).

## Exact copies

| Fusion path | Upstream source | Notes |
|-------------|-----------------|-------|
| `src/population.js` | `dsh-evolve-loop/src/population.js` | `alive` / `merit` / population.jsonl IO |
| `src/lib/population.js` | (re-export) | convenience alias |
| `src/providers/loop.js` | `.../providers/loop.js` | baseline loop **without** fuse/commit |
| `src/providers/select.js` | `.../providers/select.js` | fitness-proportional select |
| `src/providers/mutate.js` | `.../providers/mutate.js` | default candidate-builder |
| `src/providers/evaluate.js` | `.../providers/evaluate.js` | needs DSH `subprocess` (+ optional sandbox) |
| `src/providers/run_evaluator.py` | `.../providers/run_evaluator.py` | evaluator runner |
| `src/providers/survive.js` | `.../providers/survive.js` | top-k survive |

## Fusion deltas (same skeleton, documented DIFF)

| Path | What changed vs upstream |
|------|---------------------------|
| `src/providers/fuse-loop.js` | = `loop.js` + **fuse** after select + **commit** after append |
| `src/providers/fuse-mutate.js` | = `mutate.js` + append fused `K_t` to instruction |

## Fusion-only (not in upstream)

`src/fuse/**` — evidence / gate / working / chain / commit / diff / paths.

## DSH runtime dependency (not reimplemented)

Cordis injects `evolve` from `dsh-evolve-loop`. Fusion calls:

`register`, `context`, `population`, `copyTask`, `select`, `mutate`, `evaluate`,
`survive`, `allocate`, `spawnWorker`, `currentRun`, …

Peer packages: `@deepseek-ai/cordis`, `@deepseek-ai/dsh-tools`, `dsh-evolve-loop`.
