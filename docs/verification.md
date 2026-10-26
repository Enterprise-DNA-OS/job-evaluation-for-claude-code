# Verification

The smoke suite uses a disposable database and never seeds live records. It covers all CLI commands, profile revisions, grade boundaries, independent review, missing factor evidence, appeals, immutable history, dry-run rollback, duplicate imports, malformed files, custom headings, export protection and HTML escaping.

The example import is synthetic and based on published vendor field labels. A real tenant export still needs heading inspection and count reconciliation. No live customer system was queried.

Local and hosted check results are recorded here when complete. The manual CI workflow tests Node 20 and 22 on Linux and Windows, and Postgres 17. Configuration alone is not a passing result.

Local Linux, Node 22, PGlite: PASS, all 27 CLI commands and 164 assertions. Demo, three views and ten generated documents: PASS. Page gate: PASS.
