# Upstream / DSH dependency map

Fusion is a **companion** to Organon `dsh-evolve-loop` on DeepSeek Harness (DSH).
It **may depend on DSH** / `dsh-evolve-loop` at runtime. Short index: [`ORIGIN.md`](../ORIGIN.md).

## 1. Runtime dependency (live evolve service)

These APIs come from **`dsh-evolve-loop`’s `evolve` service** (Cordis inject).
Fusion calls them; it does not reimplement the service.

| Fusion call site | Evolve API |
|------------------|------------|
| `src/index.js` | `inject: ['evolve']` |
| `src/install.js` | `evolve.register(slot, provider)` |
| `fuse-loop.js` / `loop.js` | `context`, `population`, `copyTask`, `select`, `mutate`, `evaluate`, `survive`, `currentRun` |
| `fuse-mutate.js` / `mutate.js` | `allocate`, `spawnWorker`, `population` |
| `evaluate.js` (vendored) | DSH `subprocess` (+ optional `sandbox`) |

**Peers:** `@deepseek-ai/cordis`, `@deepseek-ai/dsh-tools`, `dsh-evolve-loop`  
**Enable:** `DSH_EVOLVE_FUSION2=1` (this repo). Original Fusion uses `DSH_EVOLVE_FUSION`.

## 2. Vendored identical source (written out in this repo)

`dsh-evolve-loop` npm `exports` only `"."`, so helpers are copied with the **same
relative import shape** (`providers/*` → `../population.js`).

| Fusion | Upstream | Identical? |
|--------|----------|------------|
| `src/population.js` | `.../population.js` | yes |
| `src/providers/loop.js` | `.../providers/loop.js` | yes |
| `src/providers/select.js` | `.../providers/select.js` | yes |
| `src/providers/mutate.js` | `.../providers/mutate.js` | yes |
| `src/providers/evaluate.js` | `.../providers/evaluate.js` | yes (needs DSH) |
| `src/providers/run_evaluator.py` | `.../providers/run_evaluator.py` | yes |
| `src/providers/survive.js` | `.../providers/survive.js` | yes |

## 3. Forks with DIFF only

| Fusion | Based on | DIFF |
|--------|----------|------|
| `fuse-loop.js` | `loop.js` | after select → `fuse`; after append → `commit`; pass `fuseKt` |
| `fuse-mutate.js` | `mutate.js` | append `K_t.text` to instruction; `candidate.fusion` |

## 4. Fusion-original

`src/fuse/evidence.js`, `gate.js`, `fuse.js`, `working.js`, `chain.js`, `commit.js`, `diff.js`, `paths.js`

## 5. Install both plugins in one DSH profile

```bash
dsh plugin --profile web add /path/to/Organon-adversarial/plugins/dsh-evolve-loop
dsh plugin --profile web add /path/to/Fusion
export DSH_EVOLVE_FUSION2=1
```

Fusion2-only provenance: see [`PROVENANCE.md`](PROVENANCE.md).
