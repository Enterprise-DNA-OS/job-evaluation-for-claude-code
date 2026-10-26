#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { getDb, REPO_ROOT } from "./lib/db.mjs";
import { parseCsv, pick } from "./lib/csv.mjs";
import { table } from "./lib/format.mjs";
const readViews = {
  jobs: "v_register",
  "job-week": "v_register",
  attention: "v_attention",
  "panel-queue": "v_panel",
  calibration: "v_calibration",
  appeals: "appeals",
  frameworks: "frameworks",
  compliance: "v_compliance",
  imports: "imports",
};
export const commands = {
  help: "List commands and their arguments",
  jobs: "Job register and current grades",
  "job-week": "Profiles, review dates and grading progress",
  attention: "Missing evidence, stale jobs and overdue appeals",
  "panel-queue": "Evaluations waiting for an independent decision",
  calibration: "Compare grades across families and units",
  appeals: "Open and resolved appeals",
  frameworks: "Versioned evaluation definitions",
  compliance: "Evidence checks with source codes",
  insights: "Ten questions across profiles, scores and appeals",
  show: "<job> complete profile and evaluation history",
  history: "<job> recorded changes",
  add: "--code --name --family --unit --career --purpose --responsibilities --owner --review-due --actor",
  "update-job":
    "<job> --name|--family|--unit|--career|--purpose|--responsibilities|--owner|--review-due --actor",
  "add-framework": "<definition.json> --code --name --actor",
  evaluate: "<job> --framework --code --actor",
  score: "<evaluation> --factor --level --rationale --evidence --actor",
  submit: "<evaluation> --actor",
  decide:
    "<evaluation> --outcome=approve|reject --note --bias-evidence --actor",
  appeal: "<evaluation> --code --name --owner --due --actor",
  "resolve-appeal": "<appeal> --outcome=uphold|re-evaluate --evidence --actor",
  log: "<job> --note --actor",
  import:
    "gradar <export.csv> --source --mapping=<optional.json> --actor [--dry-run]",
  export: "--out=<new-file> [--format=json|csv]",
  imports: "Import counts and file hashes",
  "draft-job-profile": "<job> write a draft from current records",
  "weekly-review": "Write a draft from job-week, attention and panel-queue",
};
const specs = {
  add: [
    0,
    0,
    "code name family unit career purpose responsibilities owner review-due",
  ],
  "update-job": [
    1,
    1,
    "name family unit career purpose responsibilities owner review-due",
  ],
  "add-framework": [1, 1, "code name"],
  evaluate: [1, 1, "framework code"],
  score: [1, 1, "factor level rationale evidence"],
  submit: [1, 1, ""],
  decide: [1, 1, "outcome note bias-evidence"],
  appeal: [1, 1, "code name owner due"],
  "resolve-appeal": [1, 1, "outcome evidence"],
  log: [1, 1, "note"],
  import: [2, 2, "source mapping"],
  export: [0, 0, "out format"],
  show: [1, 1, ""],
  history: [1, 1, ""],
  "draft-job-profile": [1, 1, ""],
};
const mutations = new Set([
  "add",
  "update-job",
  "add-framework",
  "evaluate",
  "score",
  "submit",
  "decide",
  "appeal",
  "resolve-appeal",
  "log",
  "import",
]);
const tables = [
  "jobs",
  "frameworks",
  "evaluations",
  "scores",
  "appeals",
  "events",
  "imports",
];
const hash = (x) => createHash("sha256").update(x).digest("hex");
const required = (o, k) => {
  if (typeof o[k] !== "string" || !o[k].trim())
    throw Error(`--${k} is required`);
  return o[k].trim();
};
export function date(s) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(s) ||
    !Number.isFinite(Date.parse(s)) ||
    new Date(s).toISOString().slice(0, 10) !== s
  )
    throw Error("Expected a valid YYYY-MM-DD date");
  return s;
}
const today = () => new Date().toISOString().slice(0, 10);
const integer = (s) => {
  if (!/^[1-5]$/.test(String(s)))
    throw Error("Level must be an integer from 1 to 5");
  return Number(s);
};
export function validateFramework(d) {
  if (
    !d ||
    typeof d.version !== "string" ||
    !d.version.trim() ||
    !Array.isArray(d.factors) ||
    d.factors.length !== 4 ||
    !Array.isArray(d.grades) ||
    !d.grades.length
  )
    throw Error("Framework needs version, four factors and grades");
  if (
    ["skills", "effort", "responsibility", "conditions"].some(
      (c) => !d.factors.some((f) => f.code === c),
    )
  )
    throw Error(
      "Framework must cover skills, effort, responsibility and conditions",
    );
  for (const f of d.factors) {
    if (
      typeof f.name !== "string" ||
      !f.name.trim() ||
      !Number.isInteger(f.weight) ||
      f.weight < 1 ||
      f.weight > 100 ||
      !Array.isArray(f.levels) ||
      f.levels.length !== 5 ||
      f.levels.some((x) => typeof x !== "string" || !x.trim())
    )
      throw Error(
        "Each factor needs a name, positive integer weight and five level descriptions",
      );
  }
  const min = d.factors.reduce((n, f) => n + f.weight, 0),
    max = min * 5;
  let next = min;
  const codes = new Set();
  for (const g of d.grades) {
    if (
      typeof g.code !== "string" ||
      !g.code.trim() ||
      codes.has(g.code.toLowerCase()) ||
      !Number.isInteger(g.min) ||
      !Number.isInteger(g.max) ||
      g.min !== next ||
      g.max < g.min ||
      g.max > max
    )
      throw Error(
        "Grade ranges must be unique, ordered and contiguous across all possible scores",
      );
    codes.add(g.code.toLowerCase());
    next = g.max + 1;
  }
  if (next !== max + 1) throw Error("Grade ranges must cover all scores");
  return d;
}
function parse(args) {
  const cmd = args[0] || "help",
    pos = [],
    o = {};
  if (!(cmd in commands)) throw Error("Unknown command: " + cmd);
  for (const a of args.slice(1)) {
    if (a.startsWith("--")) {
      const [k, ...v] = a.slice(2).split("=");
      if (k in o) throw Error("Duplicate option --" + k);
      if (["json", "dry-run"].includes(k)) {
        if (v.length) throw Error("--" + k + " takes no value");
        o[k] = true;
      } else {
        if (!v.length) throw Error("Unknown option or missing =value: --" + k);
        o[k] = v.join("=");
      }
    } else pos.push(a);
  }
  const [min, max, flags] = specs[cmd] || [0, 0, ""];
  if (pos.length < min || pos.length > max)
    throw Error("Usage: " + cmd + " " + commands[cmd]);
  const allowed = new Set(
    (flags + " json" + (mutations.has(cmd) ? " actor dry-run" : "")).split(" "),
  );
  for (const k of Object.keys(o))
    if (!allowed.has(k)) throw Error("Unknown option --" + k);
  if (mutations.has(cmd)) required(o, "actor");
  return { cmd, pos, o };
}
async function find(db, t, ref) {
  if (!ref) throw Error("Record reference required");
  const rows = await db.query(
    `select * from ${t} where lower(code)=lower($1) or lower(${t === "evaluations" ? "code" : "name"})=lower($1) or id::text ilike $2 order by code`,
    [ref, ref + "%"],
  );
  if (rows.length === 1) return rows[0];
  if (!rows.length) {
    const matches = await db.query(
      `select * from ${t} where position(lower($1) in lower(${t === "evaluations" ? "code" : "name"}))>0 order by code`,
      [ref],
    );
    if (matches.length === 1) return matches[0];
    if (matches.length)
      throw Error(
        "Ambiguous reference; choose: " +
          matches
            .map((r) => r.code + " " + r.id + " " + (r.name || ""))
            .join("\n"),
      );
    throw Error("No matching " + t + " record: " + ref);
  }
  throw Error(
    "Ambiguous reference; choose: " +
      rows.map((r) => r.code + " " + r.id + " " + (r.name || "")).join("\n"),
  );
}
const event = (db, j, actor, action, detail) =>
  db.query(
    "insert into events(job_id,actor,action,detail) values($1,$2,$3,$4::jsonb)",
    [j, actor, action, JSON.stringify(detail)],
  );
async function ready(db, e) {
  const j = (await db.query("select * from jobs where id=$1", [e.job_id]))[0];
  if (j.revision !== e.job_revision)
    throw Error("Job changed; reject this evaluation and start a new one");
  if (
    !j.owner.trim() ||
    !j.purpose.trim() ||
    !j.responsibilities.trim() ||
    !j.family.trim() ||
    !j.unit.trim() ||
    !j.career.trim()
  )
    throw Error(
      "Job profile needs owner, purpose, responsibilities, family, unit and career",
    );
  if (j.review_due < today()) throw Error("Job profile review is overdue");
  validateFramework(e.framework_snapshot);
  const s = await db.query("select * from scores where evaluation_id=$1", [
    e.id,
  ]);
  let total = 0;
  for (const f of e.framework_snapshot.factors) {
    const v = s.find((x) => x.factor === f.code);
    if (!v || !v.rationale.trim() || !v.evidence.trim())
      throw Error("Missing factor evidence: " + f.code);
    total += v.level * f.weight;
  }
  if (
    (
      await db.query(
        "select a.id from appeals a join evaluations ev on ev.id=a.evaluation_id where ev.job_id=$1 and a.status='open'",
        [j.id],
      )
    ).length
  )
    throw Error("Open appeal must be resolved before approval");
  const grade = e.framework_snapshot.grades.find(
    (g) => total >= g.min && total <= g.max,
  )?.code;
  if (!grade) throw Error("Score is outside grade ranges");
  return { total, grade };
}
async function insightRows(db) {
  const queries = [
    [
      "Which jobs have no local evaluation?",
      "select code from v_register where evaluation is null",
    ],
    [
      "Which approved grades have become stale?",
      "select j.code from jobs j join v_latest e on e.job_id=j.id where e.status='approved' and e.job_revision<>j.revision",
    ],
    [
      "Which profiles are overdue for review?",
      "select code from jobs where review_due<current_date",
    ],
    [
      "Which jobs lack purpose or responsibility evidence?",
      "select code from jobs where trim(purpose)='' or trim(responsibilities)=''",
    ],
    [
      "Which jobs have no review owner?",
      "select code from jobs where trim(owner)=''",
    ],
    [
      "Which jobs are missing working-condition evidence?",
      "select j.code from jobs j join v_latest e on e.job_id=j.id where not exists(select 1 from scores s where s.evaluation_id=e.id and s.factor='conditions')",
    ],
    [
      "Which evaluations await a panel decision?",
      "select job as code from v_panel where status='submitted'",
    ],
    [
      "Which jobs have an overdue appeal?",
      "select distinct j.code from appeals a join evaluations e on e.id=a.evaluation_id join jobs j on j.id=e.job_id where a.status='open' and a.due<current_date",
    ],
    [
      "Which imported grades still need local evaluation?",
      "select code from v_register where source_grade is not null and current_grade is null",
    ],
    [
      "Which current grades cross job families?",
      "select string_agg(code,', ' order by code) as code from v_register where current_grade is not null group by current_grade having count(distinct family)>1",
    ],
  ];
  const out = [];
  for (const [question, sql] of queries) {
    const rows = await db.query(sql);
    out.push({
      question,
      matches: rows.length,
      jobs: rows.map((r) => r.code).join(", ") || "None",
    });
  }
  return out;
}
function draft(name, content) {
  const dir = path.resolve(process.env.OUTPUT_DIR || REPO_ROOT, "drafts");
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = path.join(dir, name + "-" + randomUUID() + ".md");
  fs.writeFileSync(file, content, { flag: "wx", mode: 0o600 });
  return { file };
}
export function human(value) {
  if (Array.isArray(value)) {
    if (!value.length) return "(none)";
    const keys = Object.keys(value[0]);
    const rows = value.map((r) =>
      Object.fromEntries(
        keys.map((k) => [
          k,
          typeof r[k] === "object" && r[k] !== null
            ? JSON.stringify(r[k])
            : r[k],
        ]),
      ),
    );
    return table(
      rows,
      keys.map((key) => ({
        key,
        label: key.replaceAll("_", " "),
        width: key === "id" ? 12 : 70,
      })),
    );
  }
  return JSON.stringify(value, null, 2);
}
async function execute(db, cmd, pos, o) {
  const actor = o.actor?.trim();
  if (cmd === "help")
    return Object.entries(commands).map(([command, usage]) => ({
      command,
      usage,
    }));
  if (cmd in readViews) {
    const v = readViews[cmd];
    if (cmd === "frameworks")
      return db.query(
        "select code,name,definition from frameworks order by code",
      );
    if (cmd === "jobs" || cmd === "job-week")
      return db.query(
        "select code,name,owner,review_due,source_grade,current_grade,evaluation,status from v_register order by code",
      );
    return db.query(`select * from ${v} order by 1`);
  }
  if (cmd === "insights") return insightRows(db);
  if (cmd === "show" || cmd === "history" || cmd === "draft-job-profile") {
    const j = await find(db, "jobs", pos[0]);
    const events = await db.query(
      "select actor,action,detail,created_at from events where job_id=$1 order by created_at,id",
      [j.id],
    );
    if (cmd === "history") return events;
    const evaluations = await db.query(
      "select * from evaluations where job_id=$1 order by created_at,id",
      [j.id],
    );
    const scores = await db.query(
      "select e.code as evaluation,s.factor,s.level,s.rationale,s.evidence from scores s join evaluations e on e.id=s.evaluation_id where e.job_id=$1 order by e.created_at,s.factor",
      [j.id],
    );
    const record = { job: j, evaluations, scores, events };
    if (cmd === "show") return record;
    return draft(
      "job-" + j.code.replace(/[^a-z0-9-]/gi, "-"),
      "# Draft job profile: " +
        j.name +
        "\n\nGenerated from recorded evidence. Review before use.\n\n```json\n" +
        JSON.stringify(record, null, 2) +
        "\n```\n",
    );
  }
  if (cmd === "weekly-review") {
    let body = "# Draft weekly evaluation review\n\n";
    for (const c of ["job-week", "attention", "panel-queue"])
      body +=
        "## " +
        c +
        "\n\n```text\n" +
        human(await execute(db, c, [], {})) +
        "\n```\n\n";
    return draft("weekly-review", body);
  }
  if (cmd === "add" || cmd === "update-job") {
    const fields = [
      "name",
      "family",
      "unit",
      "career",
      "purpose",
      "responsibilities",
      "owner",
      "review-due",
    ];
    let j;
    if (cmd === "add") {
      const vals = fields.map((k) => required(o, k));
      date(o["review-due"]);
      j = (
        await db.query(
          "insert into jobs(code,name,family,unit,career,purpose,responsibilities,owner,review_due) values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *",
          [required(o, "code"), ...vals],
        )
      )[0];
    } else {
      const old = await find(db, "jobs", pos[0]);
      const keys = fields.filter((k) => k in o);
      if (!keys.length) throw Error("Supply a field to update");
      for (const k of keys) required(o, k);
      if (o["review-due"]) date(o["review-due"]);
      const values = keys.map((k) => o[k].trim());
      j = (
        await db.query(
          `update jobs set ${keys.map((k, i) => k.replaceAll("-", "_") + "=$" + (i + 1)).join(",")},revision=revision+1 where id=$${keys.length + 1} returning *`,
          [...values, old.id],
        )
      )[0];
    }
    await event(db, j.id, actor, cmd, j);
    return j;
  }
  if (cmd === "add-framework") {
    const d = validateFramework(JSON.parse(fs.readFileSync(pos[0], "utf8")));
    const f = (
      await db.query(
        "insert into frameworks(code,name,definition) values($1,$2,$3::jsonb) returning *",
        [required(o, "code"), required(o, "name"), JSON.stringify(d)],
      )
    )[0];
    await event(db, null, actor, cmd, { code: f.code, definition: d });
    return f;
  }
  if (cmd === "evaluate") {
    const j = await find(db, "jobs", pos[0]),
      f = await find(db, "frameworks", required(o, "framework"));
    validateFramework(f.definition);
    const e = (
      await db.query(
        "insert into evaluations(code,job_id,job_revision,job_snapshot,framework_id,framework_snapshot,author) values($1,$2,$3,$4::jsonb,$5,$6::jsonb,$7) returning *",
        [
          required(o, "code"),
          j.id,
          j.revision,
          JSON.stringify(j),
          f.id,
          JSON.stringify(f.definition),
          actor,
        ],
      )
    )[0];
    await event(db, j.id, actor, cmd, {
      evaluation: e.code,
      revision: j.revision,
      framework: f.code,
    });
    return e;
  }
  if (["score", "submit", "decide", "appeal"].includes(cmd)) {
    const e = await find(db, "evaluations", pos[0]);
    if (cmd === "score") {
      if (actor.toLowerCase() !== e.author.trim().toLowerCase())
        throw Error("Only the evaluation author can score");
      if (e.status !== "draft") throw Error("Only draft scores can change");
      const factor = required(o, "factor");
      if (!e.framework_snapshot.factors.some((f) => f.code === factor))
        throw Error("Unknown factor");
      const s = (
        await db.query(
          "insert into scores(evaluation_id,factor,level,rationale,evidence) values($1,$2,$3,$4,$5) on conflict(evaluation_id,factor) do update set level=excluded.level,rationale=excluded.rationale,evidence=excluded.evidence returning *",
          [
            e.id,
            factor,
            integer(required(o, "level")),
            required(o, "rationale"),
            required(o, "evidence"),
          ],
        )
      )[0];
      await event(db, e.job_id, actor, cmd, s);
      return s;
    }
    if (cmd === "submit") {
      if (e.status !== "draft")
        throw Error("Only draft evaluations can be submitted");
      await ready(db, e);
      await db.query(
        "update evaluations set status='submitted',submitted_at=now() where id=$1",
        [e.id],
      );
      await event(db, e.job_id, actor, cmd, { evaluation: e.code });
      return { evaluation: e.code, status: "submitted" };
    }
    if (cmd === "decide") {
      const outcome = required(o, "outcome");
      if (!["approve", "reject"].includes(outcome))
        throw Error("Outcome must be approve or reject");
      if (!["draft", "submitted"].includes(e.status))
        throw Error("Evaluation already decided");
      if (actor.toLowerCase() === e.author.trim().toLowerCase())
        throw Error("Independent reviewer must differ from author");
      const note = required(o, "note");
      let result = { total: null, grade: null };
      if (outcome === "approve") {
        if (e.status !== "submitted") throw Error("Submit before approval");
        required(o, "bias-evidence");
        result = await ready(db, e);
      }
      const status = outcome === "approve" ? "approved" : "rejected";
      await db.query(
        "update evaluations set status=$2,total=$3,grade=$4,reviewer=$5,review_note=$6,bias_evidence=$7,decided_at=now() where id=$1",
        [
          e.id,
          status,
          result.total,
          result.grade,
          actor,
          note,
          o["bias-evidence"] || null,
        ],
      );
      await event(db, e.job_id, actor, cmd, {
        evaluation: e.code,
        status,
        note,
        ...result,
      });
      return { evaluation: e.code, status, ...result };
    }
    if (cmd === "appeal") {
      if (e.status !== "approved")
        throw Error("Only an approved evaluation can be appealed");
      const a = (
        await db.query(
          "insert into appeals(code,evaluation_id,name,owner,due) values($1,$2,$3,$4,$5) returning *",
          [
            required(o, "code"),
            e.id,
            required(o, "name"),
            required(o, "owner"),
            date(required(o, "due")),
          ],
        )
      )[0];
      await event(db, e.job_id, actor, cmd, a);
      return a;
    }
  }
  if (cmd === "resolve-appeal") {
    const a = await find(db, "appeals", pos[0]);
    if (a.status !== "open") throw Error("Appeal already closed");
    const outcome = required(o, "outcome");
    if (!["uphold", "re-evaluate"].includes(outcome))
      throw Error("Outcome must be uphold or re-evaluate");
    const e = (
      await db.query("select * from evaluations where id=$1", [a.evaluation_id])
    )[0];
    if (actor.toLowerCase() === e.author.trim().toLowerCase())
      throw Error("Independent appeal reviewer required");
    await db.query(
      "update appeals set status='closed',outcome=$2,evidence=$3,resolved_by=$4 where id=$1",
      [a.id, outcome, required(o, "evidence"), actor],
    );
    if (outcome === "re-evaluate")
      await db.query("update jobs set revision=revision+1 where id=$1", [
        e.job_id,
      ]);
    await event(db, e.job_id, actor, cmd, {
      appeal: a.code,
      outcome,
      evidence: o.evidence,
    });
    return { appeal: a.code, status: "closed", outcome };
  }
  if (cmd === "log") {
    const j = await find(db, "jobs", pos[0]);
    await event(db, j.id, actor, cmd, { note: required(o, "note") });
    return { job: j.code, note: o.note };
  }
  if (cmd === "import") return importGradar(db, pos, o);
  if (cmd === "export") {
    const out = required(o, "out"),
      format = o.format || "json";
    let content;
    if (format === "json") {
      const records = {};
      for (const t of tables)
        records[t] = await db.query(`select * from ${t} order by id`);
      content =
        JSON.stringify(
          {
            format: "job-evaluation-v1",
            exported_at: new Date().toISOString(),
            records,
          },
          null,
          2,
        ) + "\n";
    } else if (format === "csv") {
      const rows = await db.query("select * from v_register order by code");
      const keys = [
        "code",
        "name",
        "family",
        "unit",
        "owner",
        "review_due",
        "source_grade",
        "evaluation",
        "status",
        "evaluated_grade",
        "current_grade",
      ];
      const cell = (x) => '"' + String(x ?? "").replaceAll('"', '""') + '"';
      content =
        [
          keys.map(cell).join(","),
          ...rows.map((r) =>
            keys
              .map((k) =>
                cell(
                  /^[=+@\-\t\r]/.test(String(r[k] ?? "")) ? "'" + r[k] : r[k],
                ),
              )
              .join(","),
          ),
        ].join("\r\n") + "\r\n";
    } else throw Error("Format must be json or csv");
    fs.writeFileSync(out, content, { flag: "wx", mode: 0o600 });
    return { file: path.resolve(out), format };
  }
  throw Error("Command not implemented: " + cmd);
}
async function importGradar(db, pos, o) {
  if (pos[0] !== "gradar") throw Error("Import supports gradar");
  const source = required(o, "source");
  const raw = fs.readFileSync(pos[1], "utf8"),
    rows = parseCsv(raw);
  if (!rows.length) throw Error("Export has no data rows");
  const mapping = o.mapping
    ? JSON.parse(fs.readFileSync(o.mapping, "utf8"))
    : {};
  const aliases = {
    code: ["Job code"],
    name: ["Job title"],
    family: ["Global Job family", "Job family"],
    unit: ["Organisational unit"],
    career: ["Career"],
    source_grade: ["Grade"],
    source_status: ["Grading status"],
  };
  for (const k of Object.keys(mapping))
    if (!(k in aliases) || typeof mapping[k] !== "string")
      throw Error("Invalid mapping field " + k);
  const mapped = [],
    seen = new Set();
  for (const row of rows) {
    const m = {};
    for (const [k, names] of Object.entries(aliases)) {
      if (mapping[k] && !Object.keys(row).includes(mapping[k]))
        throw Error("Missing mapped column " + mapping[k]);
      m[k] = pick(row, ...(mapping[k] ? [mapping[k]] : names)).trim();
    }
    if (!m.code || !m.name)
      throw Error(
        "Every row needs Job code and Job title; use --mapping for renamed headings",
      );
    if (seen.has(m.code.toLowerCase()))
      throw Error("Duplicate Job code " + m.code);
    seen.add(m.code.toLowerCase());
    mapped.push({
      ...m,
      source_row: { source, row },
      source_hash: hash(JSON.stringify({ source, row })),
    });
  }
  let added = 0,
    skipped = 0;
  for (const m of mapped) {
    const existing = (
      await db.query("select * from jobs where lower(code)=lower($1)", [m.code])
    )[0];
    if (existing) {
      if (existing.source_hash === m.source_hash) {
        skipped++;
        continue;
      }
      throw Error(
        "Changed source or existing local job " +
          m.code +
          "; reconcile explicitly, no overwrite",
      );
    }
    const j = (
      await db.query(
        "insert into jobs(code,name,family,unit,career,source_grade,source_status,source_row,source_hash,review_due) values($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,current_date) returning *",
        [
          m.code,
          m.name,
          m.family,
          m.unit,
          m.career,
          m.source_grade || null,
          m.source_status || null,
          JSON.stringify(m.source_row),
          m.source_hash,
        ],
      )
    )[0];
    await event(db, j.id, o.actor, "import", {
      source,
      hash: m.source_hash,
      imported_grade: m.source_grade,
    });
    added++;
  }
  await db.query(
    "insert into imports(source,sha256,added,skipped,actor) values($1,$2,$3,$4,$5)",
    [source, hash(raw), added, skipped, o.actor],
  );
  return {
    source,
    rows: rows.length,
    added,
    skipped,
    sha256: hash(raw),
    dry_run: Boolean(o["dry-run"]),
  };
}
export async function run(db, args) {
  const { cmd, pos, o } = parse(args);
  const mut = mutations.has(cmd);
  await db.exec(mut ? "BEGIN" : "BEGIN READ ONLY");
  try {
    if (mut)
      await db.exec(
        "LOCK TABLE jobs,frameworks,evaluations,scores,appeals,events,imports IN EXCLUSIVE MODE",
      );
    const result = await execute(db, cmd, pos, o);
    await db.exec(o["dry-run"] ? "ROLLBACK" : "COMMIT");
    return result;
  } catch (e) {
    await db.exec("ROLLBACK");
    throw e;
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  let db;
  try {
    db = await getDb();
    const result = await run(db, process.argv.slice(2));
    console.log(
      process.argv.includes("--json") ? JSON.stringify(result) : human(result),
    );
  } catch (e) {
    console.error(
      process.argv.includes("--json")
        ? JSON.stringify({ error: e.message })
        : "Error: " + e.message,
    );
    process.exitCode = 1;
  } finally {
    await db?.close();
  }
}
