---
description: <appeal> --outcome=uphold|re-evaluate --evidence --actor
---

Read CLAUDE.md. Confirm the intended record from a current read, then perform the authorised change. Record the operator with --actor. Use --dry-run first for imports. Never infer a score or approval from missing evidence.

Run `node scripts/evaluation.mjs resolve-appeal` with these arguments: <appeal> --outcome=uphold|re-evaluate --evidence --actor. Use `--json` for structured results. Options use `--key=value`. Read `help` if arguments are unclear.

Report the result and any evidence gaps. On ambiguity, present the listed candidates; never choose silently.
