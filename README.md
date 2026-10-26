# Job Evaluation for Claude Code

Keep the reasons behind every job grade. Evaluate the work, record the evidence, take it to a panel and retain the decision when a role changes.

| Do it yourself | We customise it | We run it for you |
|---|---|---|
| Free MIT code. Install and operate it yourself. | Your evaluation method, job fields, documents and reports. | Installed and operated through Omni by Enterprise DNA. |
| [Quick start](#quick-start) | One setup fee, then a retainer. [Build our version](https://enterprisedna.co/omni/book?offer=replace-software&utm_campaign=gradar) | One setup fee, then a retainer. [Talk to Sam](https://enterprisedna.co/omni/book?offer=replace-software&utm_campaign=gradar) |

## The annual bill

[gradar's pricing page](https://gradar.com/pricing/price-list) links a [2026.1 US dollar price sheet](https://cdn.prod.website-files.com/69946a85b04ea618c7ba317c/6a95a26b02da563d4b8e1e3a_gradar%20Pricing%202026.1%20-%20USD.pdf): Professional Complete US$10,500, Enterprise Complete US$15,000 and Ultimate US$50,000 per year. Checked 26 October 2026. These are licence tiers, not a verified customer invoice or a claim about what a small business normally pays. Ultimate covers a broader enterprise deployment.

This independent project covers job profiles, evaluation evidence, panel decisions, calibration, appeals and reports. It is not affiliated with gradar. It does not reproduce gradar's scoring method, job-family library, compensation surveys, salary analysis or pay-transparency reporting. Imported grades remain source history, not equivalent grades under the new method. No recruitment, payroll, payments or employee assessment operates here.

## Quick start

Node 20 or later. PGlite runs locally; Postgres 15 or later supports a shared deployment.

```bash
git clone https://github.com/Enterprise-DNA-OS/job-evaluation-for-claude-code.git
cd job-evaluation-for-claude-code
npm install
npm test
npm run demo
npm run view
npm run docs
node scripts/evaluation.mjs help
```

Open the folder in Claude Code, Codex, OpenCode or Cursor. Every runtime uses the same `.claude/commands/` library and database. The seed is fictional, idempotent and deliberately includes an incomplete role, overdue profile reviews, an unfinished evaluation and an overdue appeal. Dates are relative to first seeding. Never seed a working business database. Start live records with a new `DATA_DIR` and `npm run migrate` only.

## The weekly work

- `/job-week`: review job owners, review dates and grading progress.
- `/panel-queue`: prepare the evaluations waiting for a decision.
- `/calibration`: compare current grades across job families and business units.
- `/appeals`: review open challenges and their owners.
- `/attention`: find missing evidence and overdue work.
- `/weekly-review`: draft a Monday review from three real reads.
- `/draft-job-profile`: create a draft from the recorded role and evaluation history.
- `/compliance`: check evidence gaps; read [what those checks mean](docs/compliance.md).

Every CLI command supports `--json`. Options use `--key=value`. Quotes preserve spaces. Exact codes and names match without case sensitivity; UUID prefixes and name fragments also work. Ambiguous references list the candidates and exit 1. Mutations require `--actor='Name'`, a recorded label rather than an authenticated identity. Only an evaluation's author can edit its factor scores; a different named reviewer must decide it.

```bash
node scripts/evaluation.mjs import gradar examples/gradar-jobs.csv --source=demo --actor='Demo operator' --dry-run
node scripts/evaluation.mjs import gradar examples/gradar-jobs.csv --source=demo --actor='Demo operator'
node scripts/evaluation.mjs export --out=job-evaluation-export.json
node scripts/evaluation.mjs export --format=csv --out=job-register.csv
```

[Switching guide](docs/replace-gradar.md): use the vendor's job report CSV export, map any customised headings and reconcile counts. The example is an export-shaped synthetic fixture, not a captured vendor file.

## Evidence before a grade

The supplied `OPEN-1` framework is an illustrative four-factor method covering skills, effort, responsibility and working conditions. Each factor has five described levels. Equal weights yield scores from 4 to 20, assigned to E1 through E4 by explicit ranges. These are demonstration choices, not legal thresholds or gradar equivalents. A competent evaluator must validate the method and its application before business use. See [methodology](docs/methodology.md).

```bash
node scripts/evaluation.mjs evaluate OPS-01 --framework=OPEN-1 --code=EV-NEW --actor='Evaluator'
node scripts/evaluation.mjs score EV-NEW --factor=skills --level=2 --rationale='Independent application of established practices' --evidence='Interview record J-1' --actor='Evaluator'
```

Record all four factor scores with rationale and evidence. Then submit and decide:

```bash
node scripts/evaluation.mjs submit EV-NEW --actor='Evaluator'
node scripts/evaluation.mjs decide EV-NEW --outcome=approve --note='Panel compared demands with reference jobs' --bias-evidence='Checked overlooked emotional effort and communication demands' --actor='Panel chair'
```

The sample above is incomplete until all factors are scored. Submission and approval reject missing profile information, overdue profile reviews, stale job revisions, missing factor evidence and unresolved appeals. A decision is immutable. New information requires a new evaluation. Framework versions are immutable too. Any profile update advances its revision, including an owner or review-date update; review the evaluation again after such an update. Reject a stale unfinished evaluation before starting its replacement.

An open appeal removes the job's grade from the current-grade view. Upholding the decision restores it if the profile is unchanged. Resolving an appeal with `re-evaluate` advances the profile revision and requires fresh evaluation. Prior results remain visible as history. None of these gates proves equal pay or a legally valid evaluation.

## Ten questions to ask

`insights` answers these from the records today. These are useful cross-record questions, not a claim that gradar cannot produce an equivalent report.

1. Which jobs have no local evaluation?
2. Which approved grades have become stale?
3. Which profiles are overdue for review?
4. Which jobs lack purpose or responsibility evidence?
5. Which jobs have no review owner?
6. Which jobs are missing working-condition evidence?
7. Which evaluations await a panel decision?
8. Which jobs have an overdue appeal?
9. Which imported grades still need local evaluation?
10. Which current grades cross job families?

## Documents and views

`npm run docs` writes job profiles, panel records and appeal records to `docs-out/`. `npm run view` writes the week, attention and calibration views to `views/`. They are read-only branded HTML, with no web application or server. Change business name, logo and colours in `brand.json`. Imported text is escaped; private outputs are created with restrictive file permissions where the operating system supports them. `/new-view` adds a report.

## Your first hour: ten things to ask for

1. Put our name and colours on the panel pack.
2. Import a small job export and reconcile its count.
3. Assign each imported job a review owner.
4. Add the actual purpose and duties of one role.
5. Draft a new framework version using our approved method.
6. Record the overlooked emotional demands in a service role.
7. Show the jobs waiting for a second person's decision.
8. Record an appeal and its due date.
9. Compare current grades across our business units.
10. Add a location field with `/customise` and a tested migration.

## Operating boundaries

One database per business; trusted internal operators only. No employee salary data is needed. Keep personal information out of job descriptions and evidence notes. No public portal, authentication service, automatic sending, external connection or scheduler ships in this base. Enterprise DNA scopes those separately. Database owners can bypass application checks; actor labels are not identity assurance. Row-level security denies untrusted database roles by default. Use protected storage, appropriate access controls and tested native database backups. JSON export is a portable record copy, not a tested disaster-recovery restore.

`npm test` uses disposable storage and covers every CLI command, review gates, immutable decisions, grade boundaries, appeals, import rollback, duplicate detection and reports. The manual CI workflow covers Linux and Windows with Node 20/22, plus Postgres 17. See [verification](docs/verification.md) for results rather than assuming a configured workflow has run.

MIT. gradar is its owner's trademark.
