---
description: --out=<new-file> [--format=json|csv]
---

Read CLAUDE.md. Read current records; do not infer an answer from the demo or a previous report.

Run `node scripts/evaluation.mjs export` with these arguments: --out=<new-file> [--format=json|csv]. Use `--json` for structured results. Options use `--key=value`. Read `help` if arguments are unclear.

Report the result and any evidence gaps. On ambiguity, present the listed candidates; never choose silently.
