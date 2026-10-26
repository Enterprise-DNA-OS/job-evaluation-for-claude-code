# A job evaluation desk without a front end

The database holds profiles, evaluation evidence, panel decisions and appeals. A trusted operator asks their coding agent to read or change those records using the one CLI. Read-only HTML gives the panel a job profile, factor evidence, a decision record and the weekly review.

A web application would add browser editing, concurrent forms, a staff portal, mobile use, authenticated approval and drag-and-drop interaction. This base has none of those. Local PGlite supports one operator; a shared Postgres database requires controlled access and operational setup. The supplied actor labels do not authenticate reviewers. Reports are snapshots and must be regenerated after changes.

The database is useful for a trusted HR or evaluation team without a screen to click through. Enterprise DNA can build the access model, integrations and browser experience your business needs as part of an agreed implementation. This base does not deliver courses, process recruitment or run payroll.
