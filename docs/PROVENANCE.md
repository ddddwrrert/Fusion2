# Fusion2 provenance layer (溯源)

Fusion2-only. Not present in the Fusion repo.

## Artifacts under `run/fuse/`

| Path | Role |
|------|------|
| `trace/<child>.json` | Per-step provenance: parent/child, fitness, delta, outcome, true patch |
| `breakthrough.json` | Latest breakthrough / failure_signal / repeat_failure for next fuse |
| `working.json` | Fast layer (also mirrors breakthrough pointers) |
| `chain.jsonl` | Accepted true diffs only (`fitness > parent`) — same as Fusion |

## Rules (no LLM)

1. **breakthrough** if `outcome === 'up'` and patch non-empty  
2. **failure_signal** if down/flat/error  
3. **repeat_failure** if last ≥2 traces are non-up (flag if same patch fingerprint)

## Gate priority

`breakthrough` > `repeat_failure` > deficit > score > sibling_diff > working > chain_diff

## Disable

`DSH_EVOLVE_FUSION2_TRACE=0` — commit skips trace/provenance; evidence skips those channels.
