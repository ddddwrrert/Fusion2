# Fusion2

Independent fork of [Fusion](https://github.com/ddddwrrert/Fusion): **gate-fused mutate context** plus **rule-based provenance (溯源)**.

Does **not** modify the Fusion repository. Opt-in: `DSH_EVOLVE_FUSION2=1`.

## What changed vs Fusion

| | Fusion | Fusion2 |
|--|--------|---------|
| Env | `DSH_EVOLVE_FUSION` | `DSH_EVOLVE_FUSION2` |
| After evaluate | Working + Chain | + **Trace** + **Breakthrough / repeat_failure** |
| Next fuse | multi-source \(K_t\) | same, but **breakthrough / repeat_failure first** in gate |
| A/B | — | `DSH_EVOLVE_FUSION2_TRACE=0` disables provenance |

Loop:

```text
select → fuse(K_t) → mutate|K_t → evaluate → commit
         (Working + Chain + Trace + Provenance) → survive
```

Provenance is **rule-based** (fitness delta + true unified diff + streak). No LLM attribution.

## Install (DSH)

```bash
dsh plugin --profile web add /path/to/Fusion2
export DSH_EVOLVE_FUSION2=1
# optional A/B:
# export DSH_EVOLVE_FUSION2_TRACE=0
```

Requires `dsh-evolve-loop` for the live `evolve` service. Do not load Fusion and Fusion2 together unless you know which register wins.

## Offline

```bash
npm install
npm test
npm run example:mock
```

## Docs

- [`ORIGIN.md`](ORIGIN.md) — vendored Organon-identical files  
- [`docs/UPSTREAM.md`](docs/UPSTREAM.md) — DSH deps + DIFF map  
- [`docs/PROVENANCE.md`](docs/PROVENANCE.md) — Fusion2-only 溯源 layer  

## License

MIT
