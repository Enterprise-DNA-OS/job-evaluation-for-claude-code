# Verification

The smoke suite uses a disposable database and never seeds live records. It covers all CLI commands, profile revisions, grade boundaries, independent review, missing factor evidence, appeals, immutable history, dry-run rollback, duplicate imports, malformed files, custom headings, export protection and HTML escaping.

The example import is synthetic and based on published vendor field labels. A real tenant export still needs heading inspection and count reconciliation. No live customer system was queried.

Local and hosted check results are recorded here when complete. The manual CI workflow tests Node 20 and 22 on Linux and Windows, and Postgres 17. Configuration alone is not a passing result.

Local Linux, Node 22, PGlite: PASS, all 27 CLI commands and 164 assertions. Demo, three views and ten generated documents: PASS. Page gate: PASS.

The real Landing Pages template rendered at desktop and mobile widths with noindex, three offer paths, three captured output tables and tracked booking links. Browser checks found no page overflow or JavaScript errors. Screenshots were inspected, and the panel dashboard was reduced to six columns for readability.

A disposable local Postgres 18.4 instance passed all 27 CLI commands and 158 assertions. It was stopped and its data directory removed after the check. The Postgres path skips the six subprocess checks that exercise embedded storage after closing the primary connection.

GitHub Actions run https://github.com/Enterprise-DNA-OS/job-evaluation-for-claude-code/actions/runs/40412064427 did not start any test steps. GitHub reported that recent account payments failed or the spending limit needs to be increased. Consequently the Windows and hosted Node 20/22 matrix is unverified, not a test failure in the implementation. No billing settings were changed.

The Landing Pages change was pushed as commit a2d57c0f9dfcd45a0b2e838d713523632fc9391e. Its generated entry is drafted with live=false. The local rendered page passed the noindex and booking-link checks. The public URL still returned HTTP 404 immediately after the push, so host deployment is not confirmed. Publication remains the runner's responsibility.
