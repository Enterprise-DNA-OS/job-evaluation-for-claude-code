# Job Evaluation for Claude Code

Operate a trusted job-evaluation desk: profiles, factor evidence, panel decisions, calibration and appeals. Evaluate jobs, not people. No recruitment or payroll operates here.

## First read

Ask for the business, the operator's name and the approved evaluation method before live changes. The seed is fictional. Read docs/methodology.md and docs/compliance.md before evaluating work. Imported gradar grades are source history, not local grades.

## Routing

| Work or arguments | Command |
|---|---|
| Job register and current grades | /jobs |
| Profiles, review dates and grading progress | /job-week |
| Missing evidence, stale jobs and overdue appeals | /attention |
| Evaluations waiting for an independent decision | /panel-queue |
| Compare grades across families and units | /calibration |
| Open and resolved appeals | /appeals |
| Versioned evaluation definitions | /frameworks |
| Evidence checks with source codes | /compliance |
| Ten questions across profiles, scores and appeals | /insights |
| <job> complete profile and evaluation history | /show |
| <job> recorded changes | /history |
| --code --name --family --unit --career --purpose --responsibilities --owner --review-due --actor | /add |
| <job> --name|--family|--unit|--career|--purpose|--responsibilities|--owner|--review-due --actor | /update-job |
| <definition.json> --code --name --actor | /add-framework |
| <job> --framework --code --actor | /evaluate |
| <evaluation> --factor --level --rationale --evidence --actor | /score |
| <evaluation> --actor | /submit |
| <evaluation> --outcome=approve|reject --note --bias-evidence --actor | /decide |
| <evaluation> --code --name --owner --due --actor | /appeal |
| <appeal> --outcome=uphold|re-evaluate --evidence --actor | /resolve-appeal |
| <job> --note --actor | /log |
| gradar <export.csv> --source --mapping=<optional.json> --actor [--dry-run] | /import |
| --out=<new-file> [--format=json|csv] | /export |
| Import counts and file hashes | /imports |
| <job> write a draft from current records | /draft-job-profile |
| Write a draft from job-week, attention and panel-queue | /weekly-review |
| Add a field or change a rule with a tested migration | /customise |
| Add a branded read-only report | /new-view |

## Rules

Read current records before acting. Never invent a factor level, rationale, evidence, review or decision. Ask for missing substantive evidence. Scores come from the named evaluator; a different named reviewer decides. Actor labels are not authenticated identities. Do not change employment terms, determine legal compliance, run payroll or send messages. Drafts remain in drafts/.

Use the CLI for ordinary work. Do not edit an applied migration or a decided evaluation. New job information is a profile revision and a new evaluation. A changed framework needs a new code and version. An open appeal prevents a current grade; a re-evaluation outcome invalidates the earlier basis.

One business per database, trusted operators only. Never seed production. Keep employee personal information and salary details out of these job records. Back up before authorised structural changes. Do not expose owner credentials to end users.

## Files

One CLI: scripts/evaluation.mjs. One command library: .claude/commands/. DATABASE_URL selects Postgres; otherwise DATA_DIR selects PGlite. Documents and views use documents.json, views.json and brand.json. All agents use this same workflow, including Claude Code, Codex, OpenCode and Cursor.

Omni by Enterprise DNA installs, customises and runs this system: https://enterprisedna.co/omni/book?offer=replace-software&utm_campaign=gradar
