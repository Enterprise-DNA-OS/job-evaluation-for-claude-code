import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "evaluation-test-"));
process.env.DATA_DIR = path.join(temp, "db");
process.env.OUTPUT_DIR = temp;
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || "";
const { getDb, REPO_ROOT } = await import("./lib/db.mjs");
const { migrate } = await import("./migrate.mjs");
const { seed } = await import("./seed.mjs");
const { run, commands, validateFramework, date } = await import(
  "./evaluation.mjs"
);
const { parseCsv } = await import("./lib/csv.mjs");
const { page, table } = await import("./lib/render.mjs");
const db = await getDb(),
  visited = new Set();
let assertions = 0,
  closed = false;
const eq = (a, b) => {
  assert.deepEqual(a, b);
  assertions++;
};
const ok = (v) => {
  assert.ok(v);
  assertions++;
};
const fail = async (a, re) => {
  await assert.rejects(() => call(...a), re);
  assertions++;
};
const call = async (...a) => {
  visited.add(a[0]);
  return run(db, a);
};
const count = async (t) =>
  Number((await db.query(`select count(*) as n from ${t}`))[0].n);
const write = (n, s) => {
  const p = path.join(temp, n);
  fs.writeFileSync(p, s);
  return p;
};
const actor = "--actor=Evaluator",
  panel = "--actor=Panel chair";
const future = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
const fixture = path.join(REPO_ROOT, "examples/gradar-jobs.csv");
const schema = "evaluation_test_" + Date.now();
try {
  if (db.mode === "postgres")
    await db.exec(`create schema ${schema};set search_path to ${schema};`);
  eq((await migrate(db)).ran.length, 1);
  eq((await migrate(db)).ran.length, 0);
  await seed(db);
  await seed(db);
  eq(await count("jobs"), 5);
  eq(await count("evaluations"), 4);
  eq(await count("scores"), 13);
  eq(await count("appeals"), 1);
  eq((await call("help")).length, Object.keys(commands).length);
  for (const cmd of [
    "jobs",
    "job-week",
    "attention",
    "panel-queue",
    "calibration",
    "appeals",
    "frameworks",
    "compliance",
  ])
    ok((await call(cmd)).length > 0);
  eq((await call("insights")).length, 10);
  eq((await call("show", "operations coordinator")).job.code, "OPS-01");
  eq(
    (await call("show", "20000000-0000-4000-8000-000000000001")).job.code,
    "OPS-01",
  );
  await fail(["show", "coordinator"], /Ambiguous.*OPS-01/s);
  await fail(["show", "unknown"], /No matching/);
  await fail(["add", "--code=X"], /actor/);
  await fail(["jobs", "--typo=true"], /Unknown option/);
  await fail(["jobs", "excess"], /Usage/);
  await fail(["jobs", "--json=false"], /takes no value/);
  await fail(
    [
      "decide",
      "EV-DEMO-2",
      "--outcome=approve",
      "--note=Reviewed",
      "--bias-evidence=Checked",
      panel,
    ],
    /overdue/,
  );
  await fail(
    [
      "score",
      "EV-DEMO-1",
      "--factor=skills",
      "--level=2",
      "--rationale=R",
      "--evidence=E",
      "--actor=Demo evaluator",
    ],
    /draft/,
  );
  const j = await call(
    "add",
    "--code=TEST",
    "--name=Test analyst",
    "--family=Operations",
    "--unit=Wellington",
    "--career=Individual contributor",
    "--purpose=Handle exceptions",
    "--responsibilities=Investigate and reconcile exception records",
    "--owner=Mara",
    "--review-due=" + future,
    actor,
  );
  eq(j.revision, 1);
  await fail(
    [
      "add",
      "--code=test",
      "--name=Duplicate",
      "--family=X",
      "--unit=X",
      "--career=X",
      "--purpose=X",
      "--responsibilities=X",
      "--owner=X",
      "--review-due=" + future,
      actor,
    ],
    /unique|duplicate/,
  );
  await fail(["update-job", "TEST", "--review-due=2026-02-30", actor], /valid/);
  await fail(["update-job", "TEST", "--owner=", actor], /required/);
  eq(
    (await call("update-job", "TEST", "--owner=New owner", actor, "--dry-run"))
      .revision,
    2,
  );
  eq((await call("show", "TEST")).job.revision, 1);
  const definition = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, "examples/framework.json")),
  );
  const f = await call(
    "add-framework",
    write("method.json", JSON.stringify(definition)),
    "--code=TEST-METHOD",
    "--name=Test method",
    actor,
  );
  eq(f.code, "TEST-METHOD");
  const invalid = structuredClone(definition);
  invalid.grades[1].min = 7;
  await fail(
    [
      "add-framework",
      write("bad-method.json", JSON.stringify(invalid)),
      "--code=BAD",
      "--name=Bad",
      actor,
    ],
    /contiguous/,
  );
  assert.throws(
    () =>
      validateFramework({
        ...definition,
        factors: definition.factors.slice(1),
      }),
    /four factors/,
  );
  assertions++;
  assert.throws(() => date("2026-13-01"), /valid/);
  assertions++;
  const ev = await call(
    "evaluate",
    "TEST",
    "--framework=TEST-METHOD",
    "--code=EV-TEST",
    actor,
  );
  eq(ev.job_revision, 1);
  await fail(
    ["evaluate", "TEST", "--framework=OPEN-1", "--code=EV-DUP", actor],
    /unique|duplicate/,
  );
  await fail(["submit", "EV-TEST", actor], /Missing factor/);
  await fail(
    [
      "score",
      "EV-TEST",
      "--factor=skills",
      "--level=1.2",
      "--rationale=R",
      "--evidence=E",
      actor,
    ],
    /integer/,
  );
  await fail(
    [
      "score",
      "EV-TEST",
      "--factor=not-a-factor",
      "--level=1",
      "--rationale=R",
      "--evidence=E",
      actor,
    ],
    /Unknown factor/,
  );
  for (const f of definition.factors)
    await call(
      "score",
      ev.id.slice(0, 10),
      "--factor=" + f.code,
      "--level=2",
      "--rationale=Role evidence supports level two",
      "--evidence=Job interview reference 2026",
      actor,
    );
  eq((await call("show", "TEST")).scores.length, 4);
  eq((await call("submit", "EV-TEST", actor)).status, "submitted");
  await fail(
    [
      "score",
      "EV-TEST",
      "--factor=skills",
      "--level=3",
      "--rationale=R",
      "--evidence=E",
      actor,
    ],
    /draft/,
  );
  await fail(
    [
      "decide",
      "EV-TEST",
      "--outcome=approve",
      "--note=Reviewed",
      "--bias-evidence=Checked",
      "--actor= evaluator ",
    ],
    /Independent/,
  );
  await fail(
    ["decide", "EV-TEST", "--outcome=approve", "--note=Reviewed", panel],
    /bias-evidence/,
  );
  const result = await call(
    "decide",
    "EV-TEST",
    "--outcome=approve",
    "--note=Calibrated against duties",
    "--bias-evidence=Checked overlooked communication and emotional effort",
    panel,
  );
  eq(result.grade, "E2");
  eq(result.total, 8);
  eq((await call("jobs")).find((x) => x.code === "TEST").current_grade, "E2");
  await fail(
    ["decide", "EV-TEST", "--outcome=reject", "--note=Changed mind", panel],
    /already decided/,
  );
  await assert.rejects(
    () =>
      db.query("update frameworks set name=$1 where id=$2", ["Changed", f.id]),
    /immutable/,
  );
  assertions++;
  await assert.rejects(
    () =>
      db.query("update evaluations set grade=$1 where id=$2", ["E4", ev.id]),
    /immutable/,
  );
  assertions++;
  await assert.rejects(
    () => db.query("delete from scores where evaluation_id=$1", [ev.id]),
    /draft/,
  );
  assertions++;
  const a = await call(
    "appeal",
    "EV-TEST",
    "--code=AP-TEST",
    "--name=Reassess specialist knowledge",
    "--owner=Mara",
    "--due=" + future,
    actor,
  );
  eq(a.status, "open");
  eq((await call("jobs")).find((x) => x.code === "TEST").current_grade, null);
  await fail(
    [
      "resolve-appeal",
      "AP-TEST",
      "--outcome=uphold",
      "--evidence=Reviewed",
      actor,
    ],
    /Independent/,
  );
  await call(
    "resolve-appeal",
    "AP-TEST",
    "--outcome=uphold",
    "--evidence=Evidence confirms the recorded factor level",
    panel,
  );
  eq((await call("jobs")).find((x) => x.code === "TEST").current_grade, "E2");
  await fail(
    [
      "resolve-appeal",
      "AP-TEST",
      "--outcome=uphold",
      "--evidence=Again",
      panel,
    ],
    /already closed/,
  );
  await call(
    "appeal",
    "EV-TEST",
    "--code=AP-REVIEW",
    "--name=Changed duties",
    "--owner=Mara",
    "--due=" + future,
    actor,
  );
  await call(
    "resolve-appeal",
    "AP-REVIEW",
    "--outcome=re-evaluate",
    "--evidence=New work changes responsibility",
    panel,
  );
  eq((await call("jobs")).find((x) => x.code === "TEST").current_grade, null);
  await call(
    "evaluate",
    "TEST",
    "--framework=OPEN-1",
    "--code=EV-STALE",
    actor,
  );
  await call("update-job", "TEST", "--purpose=Expanded role purpose", actor);
  await fail(["submit", "EV-STALE", actor], /Job changed/);
  await call(
    "decide",
    "EV-STALE",
    "--outcome=reject",
    "--note=Restart against current duties",
    panel,
  );
  await call("evaluate", "TEST", "--framework=OPEN-1", "--code=EV-LOW", actor);
  for (const f of definition.factors)
    await call(
      "score",
      "EV-LOW",
      "--factor=" + f.code,
      "--level=1",
      "--rationale=Demo lower boundary",
      "--evidence=Current job description",
      actor,
    );
  await call("submit", "EV-LOW", actor);
  eq(
    (
      await call(
        "decide",
        "EV-LOW",
        "--outcome=approve",
        "--note=Checked lower boundary",
        "--bias-evidence=All four demands considered",
        panel,
      )
    ).grade,
    "E1",
  );
  await call(
    "update-job",
    "TEST",
    "--responsibilities=Expanded responsibilities",
    actor,
  );
  await call("evaluate", "TEST", "--framework=OPEN-1", "--code=EV-HIGH", actor);
  for (const f of definition.factors)
    await call(
      "score",
      "EV-HIGH",
      "--factor=" + f.code,
      "--level=5",
      "--rationale=Demo upper boundary",
      "--evidence=Current job description",
      actor,
    );
  await call("submit", "EV-HIGH", actor);
  eq(
    (
      await call(
        "decide",
        "EV-HIGH",
        "--outcome=approve",
        "--note=Checked upper boundary",
        "--bias-evidence=All four demands considered",
        panel,
      )
    ).grade,
    "E4",
  );
  await call("log", "TEST", "--note=Panel pack prepared", actor);
  ok((await call("history", "TEST")).length >= 25);
  const before = await count("jobs");
  eq(
    (
      await call(
        "import",
        "gradar",
        fixture,
        "--source=demo",
        actor,
        "--dry-run",
      )
    ).added,
    2,
  );
  eq(await count("jobs"), before);
  eq(await count("imports"), 0);
  eq(
    (await call("import", "gradar", fixture, "--source=demo", actor)).added,
    2,
  );
  eq(
    (await call("import", "gradar", fixture, "--source=demo", actor)).skipped,
    2,
  );
  eq((await call("imports")).length, 2);
  const imp = await call("show", "IMP-01");
  eq(imp.job.source_grade, "8");
  eq(imp.evaluations.length, 0);
  eq(imp.job.owner, "");
  eq((await call("jobs")).find((x) => x.code === "IMP-01").current_grade, null);
  ok(
    imp.job.source_row.row["Custom context"].includes("fictional") ||
      imp.job.source_row.row["Custom context"].includes("Fictional"),
  );
  const changed = write(
    "changed.csv",
    fs
      .readFileSync(fixture, "utf8")
      .replace("Warehouse coordinator", "Warehouse manager"),
  );
  await fail(
    ["import", "gradar", changed, "--source=demo", actor],
    /Changed source/,
  );
  await fail(
    ["import", "gradar", fixture, "--source=other", actor],
    /Changed source/,
  );
  const rollback = write(
    "rollback.csv",
    "Job code,Job title\nNEW-ROLLBACK,First valid row\nTEST,Conflict\n",
  );
  await fail(
    ["import", "gradar", rollback, "--source=rollback", actor],
    /existing local/,
  );
  eq(await count("jobs"), before + 2);
  for (const [name, text, re] of [
    ["duplicate", "Job code,Job title\nA,A\na,B\n", /Duplicate Job/],
    ["missing", "Job title\nName\n", /Job code/],
    ["empty", "Job code,Job title\n", /no data/],
    ["bad", 'Job code,Job title\nA,"Unclosed', /unclosed/],
  ])
    await fail(
      ["import", "gradar", write(name + ".csv", text), "--source=bad", actor],
      re,
    );
  const renamed = write(
      "renamed.csv",
      "Role ID,Role name\nMAPPED,Mapped job\n",
    ),
    map = write(
      "map.json",
      JSON.stringify({ code: "Role ID", name: "Role name" }),
    );
  eq(
    (
      await call(
        "import",
        "gradar",
        renamed,
        "--source=mapped",
        "--mapping=" + map,
        actor,
      )
    ).added,
    1,
  );
  await fail(
    [
      "import",
      "gradar",
      renamed,
      "--source=mapped",
      "--mapping=" + write("badmap.json", '{"code":"Absent"}'),
      actor,
    ],
    /Missing mapped/,
  );
  eq(
    parseCsv('\ufeffJob code,Job title\r\nA,"Quoted, name"\r\n')[0][
      "Job title"
    ],
    "Quoted, name",
  );
  assert.throws(() => parseCsv("a,A\n1,2"), /unique/);
  assertions++;
  await fail(
    ["import", "gradar", fixture, "--source=demo", actor, "--dryrun"],
    /Unknown option/,
  );
  await fail(
    ["import", "gradar", fixture, "--source=demo", actor, "--dry-run=false"],
    /takes no value/,
  );
  const snapshot = path.join(temp, "snapshot.json");
  await call("export", "--out=" + snapshot);
  eq(Object.keys(JSON.parse(fs.readFileSync(snapshot)).records), [
    "jobs",
    "frameworks",
    "evaluations",
    "scores",
    "appeals",
    "events",
    "imports",
  ]);
  await fail(["export", "--out=" + snapshot], /EEXIST/);
  const csv = path.join(temp, "jobs.csv");
  await call("export", "--out=" + csv, "--format=csv");
  eq(parseCsv(fs.readFileSync(csv, "utf8")).length, await count("jobs"));
  for (const cmd of ["draft-job-profile", "weekly-review"]) {
    const r = await call(cmd, ...(cmd === "draft-job-profile" ? ["TEST"] : []));
    ok(fs.readFileSync(r.file, "utf8").startsWith("# Draft"));
  }
  for (const v of JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, "views.json")),
  ))
    for (const s of v.sections) ok(Array.isArray(await db.query(s.sql)));
  for (const d of JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, "documents.json")),
  ))
    for (const r of await db.query(d.for_each))
      for (const s of d.sections)
        ok(Array.isArray(await db.query(s.sql, [r.id])));
  ok(!table([{ name: "<script>alert(1)</script>" }]).includes("<script>"));
  ok(page({ title: "<img onerror=x>", sections: [] }).includes("&lt;img"));
  eq(
    Object.keys(commands).filter((k) => !visited.has(k)),
    [],
  );
  if (db.mode === "postgres")
    await db.exec(`set search_path to public;drop schema ${schema} cascade;`);
  await db.close();
  closed = true;
  if (!process.env.TEST_DATABASE_URL) {
    for (const script of ["view.mjs", "docs.mjs"]) {
      const res = spawnSync(
        process.execPath,
        [path.join(REPO_ROOT, "scripts", script)],
        { env: process.env, encoding: "utf8" },
      );
      assert.equal(res.status, 0, res.stderr);
      assertions++;
    }
    const good = spawnSync(
      process.execPath,
      [path.join(REPO_ROOT, "scripts/evaluation.mjs"), "jobs", "--json"],
      { env: process.env, encoding: "utf8" },
    );
    eq(good.status, 0);
    ok(Array.isArray(JSON.parse(good.stdout)));
    const bad = spawnSync(
      process.execPath,
      [
        path.join(REPO_ROOT, "scripts/evaluation.mjs"),
        "show",
        "coordinator",
        "--json",
      ],
      { env: process.env, encoding: "utf8" },
    );
    eq(bad.status, 1);
    ok(JSON.parse(bad.stderr).error.includes("Ambiguous"));
  }
  console.log(
    `PASS: ${Object.keys(commands).length} CLI commands, ${assertions} assertions; immutable decisions, stale profiles, independent review, appeals, import rollback and reports`,
  );
} finally {
  if (!closed) await db.close();
  fs.rmSync(temp, { recursive: true, force: true });
}
