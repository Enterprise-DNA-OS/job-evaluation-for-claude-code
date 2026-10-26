# Bring job records across from gradar

Keep the original exports and reconcile before ending any subscription. This import covers job report records and their source grades. It does not recreate the vendor's method or convert its grades into an owned framework.

## Export

The [vendor's current price sheet](https://cdn.prod.website-files.com/69946a85b04ea618c7ba317c/6a95a26b02da563d4b8e1e3a_gradar%20Pricing%202026.1%20-%20USD.pdf), linked from [its pricing page](https://gradar.com/pricing/price-list), lists CSV and XLSX report exports for jobs and grading results. The [vendor's job-evaluation guide](https://www.gradar.com/frontend/gradar/files/gradar_the_job_evaluation_engine_-_job_grading_easily_done.pdf) shows Export in Job overview and the job list. Open the job list, select all required organisational units and statuses, and export the job report as CSV. Include the stable job code. If you export XLSX, save the relevant sheet as UTF-8 CSV before importing. This program does not read XLSX directly.

Public screenshots show Job code, Job title, Global Job family, Organisational unit, Career, Grade and Grading status. Exact headings can vary with language and account customisation. The bundled example is synthetic; no authenticated tenant export has been tested. Inspect your header first. If your headings differ, supply a mapping file such as examples/column-map.json. Do not export employee compensation or personal information into this job-only workflow.

## One-command import

Start a clean DATA_DIR, run npm run migrate, then test the export:

```bash
node scripts/evaluation.mjs import gradar jobs.csv --source=gradar-job-report --actor='Migration operator' --dry-run
node scripts/evaluation.mjs import gradar jobs.csv --source=gradar-job-report --actor='Migration operator'
```

For customised headings append `--mapping=our-columns.json`. The mapping's keys are code, name, family, unit, career, source_grade and source_status; its values are the exact column names. Only code and name are mandatory. Missing optional fields stay blank and require review. No field is inferred from a grade.

## Mapping

| Export column | Owned record |
|---|---|
| Job code | Stable code, matched without case sensitivity |
| Job title | Job name |
| Global Job family or Job family | Family |
| Organisational unit | Business unit |
| Career | Career path text |
| Grade | Source grade only |
| Grading status | Source status only |
| Other columns | Preserved in the source row; not interpreted |

Imported jobs have no local evaluation, no review owner, and a review date of today. Enter duties and purpose, assign an owner and agree a method before grading. Vendor factor weights, the full evaluation timeline, attachments, competencies, survey licences, access rights, integrations and compensation analytics are not recreated. Export and retain those separately and agree their mapping if they are in scope for your version.

The importer uses a stable source name and job code. An identical source row is skipped; a changed row or a collision with an existing local job aborts the entire import. Nothing is silently overwritten. A failed row rolls back all database changes. Source rows, file hashes, counts and actor labels are recorded. Dry run rolls back everything. Keep the same source label on a retry.

## Reconcile

Compare total and per-unit job counts, source grades and statuses, sample job codes and all required columns against the original report. Run jobs, show, imports and export. Store the original file alongside the manifest. Agree what historic evidence must be retained and test the new workflow before retiring the old one. This import is one command once the report and column mapping are prepared; it is not a guarantee that a complete enterprise deployment switches in a day.
