create table jobs (
 id uuid primary key default gen_random_uuid(), code text not null unique check(length(trim(code))>0),
 name text not null check(length(trim(name))>0), family text not null default '', unit text not null default '', career text not null default '',
 purpose text not null default '', responsibilities text not null default '', owner text not null default '',
 review_due date not null, revision integer not null default 1 check(revision>0),
 source_grade text, source_status text, source_row jsonb, source_hash text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index jobs_code_ci on jobs(lower(code));
create table frameworks (
 id uuid primary key default gen_random_uuid(), code text not null unique, name text not null,
 definition jsonb not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index framework_code_ci on frameworks(lower(code));
create table evaluations (
 id uuid primary key default gen_random_uuid(), code text not null unique, job_id uuid not null references jobs,
 job_revision integer not null, job_snapshot jsonb not null, framework_id uuid not null references frameworks,
 framework_snapshot jsonb not null, author text not null check(length(trim(author))>0),
 status text not null default 'draft' check(status in ('draft','submitted','approved','rejected')),
 total integer, grade text, submitted_at timestamptz, reviewer text, review_note text, bias_evidence text, decided_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(status not in ('approved','rejected') or (reviewer is not null and lower(trim(reviewer))<>lower(trim(author)) and length(trim(review_note))>0 and decided_at is not null)),
 check(status<>'approved' or (total is not null and grade is not null and length(trim(bias_evidence))>0))
);
create unique index evaluation_code_ci on evaluations(lower(code));
create unique index one_open_evaluation on evaluations(job_id) where status in ('draft','submitted');
create table scores (
 id uuid primary key default gen_random_uuid(), evaluation_id uuid not null references evaluations,
 factor text not null, level integer not null check(level between 1 and 5), rationale text not null check(length(trim(rationale))>0),
 evidence text not null check(length(trim(evidence))>0), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(evaluation_id,factor)
);
create table appeals (
 id uuid primary key default gen_random_uuid(), code text not null unique, evaluation_id uuid not null references evaluations,
 name text not null, owner text not null check(length(trim(owner))>0), due date not null,
 status text not null default 'open' check(status in ('open','closed')), outcome text check(outcome in ('uphold','re-evaluate')),
 evidence text, resolved_by text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(status<>'closed' or (outcome is not null and length(trim(evidence))>0 and length(trim(resolved_by))>0))
);
create unique index appeal_code_ci on appeals(lower(code));
create table events (
 id uuid primary key default gen_random_uuid(), job_id uuid references jobs, actor text not null, action text not null, detail jsonb not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table imports (
 id uuid primary key default gen_random_uuid(), source text not null, sha256 text not null, added integer not null, skipped integer not null, actor text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create function touch_updated() returns trigger language plpgsql as $$ begin new.updated_at=clock_timestamp();return new;end $$;
create function immutable_record() returns trigger language plpgsql as $$ begin raise exception 'History is immutable; create a new version'; end $$;
create trigger immutable_framework before update or delete on frameworks for each row execute function immutable_record();
create trigger immutable_event before update or delete on events for each row execute function immutable_record();
create trigger immutable_import before update or delete on imports for each row execute function immutable_record();
create function protect_score() returns trigger language plpgsql as $$
 declare eid uuid; st text;
 begin
 eid=case when TG_OP='DELETE' then old.evaluation_id else new.evaluation_id end;
 select status into st from evaluations where id=eid for update;
 if st<>'draft' then raise exception 'Only draft scores can change'; end if;
 if TG_OP='UPDATE' and new.evaluation_id<>old.evaluation_id then raise exception 'Cannot move scores'; end if;
 if TG_OP='DELETE' then return old; end if;return new;
 end $$;
create trigger score_guard before insert or update or delete on scores for each row execute function protect_score();
create function protect_evaluation() returns trigger language plpgsql as $$ begin
 if TG_OP='DELETE' or old.status in ('approved','rejected') then raise exception 'Evaluation history is immutable';end if;
 if new.job_id<>old.job_id or new.job_revision<>old.job_revision or new.job_snapshot<>old.job_snapshot or new.framework_snapshot<>old.framework_snapshot or new.author<>old.author or new.framework_id<>old.framework_id then raise exception 'Evaluation basis is immutable';end if;
 return new;end $$;
create trigger evaluation_guard before update or delete on evaluations for each row execute function protect_evaluation();
do $$ declare t text; begin foreach t in array array['jobs','frameworks','evaluations','scores','appeals','events','imports'] loop
 execute format('create trigger touch_updated before update on %I for each row execute function touch_updated()',t);
 execute format('alter table %I enable row level security',t); execute format('revoke all on %I from public',t);
 end loop;end $$;
create view v_latest with(security_invoker=true) as select distinct on(job_id) * from evaluations order by job_id,created_at desc,id desc;
create view v_register with(security_invoker=true) as
 select j.id,j.code,j.name,j.family,j.unit,j.owner,j.review_due,j.revision,j.source_grade,
 e.code as evaluation,e.status,e.total,e.grade as evaluated_grade,
 case when e.status='approved' and e.job_revision=j.revision and not exists(select 1 from appeals a join evaluations ae on ae.id=a.evaluation_id where ae.job_id=j.id and a.status='open') then e.grade end as current_grade,
 e.job_revision as evaluated_revision from jobs j left join v_latest e on e.job_id=j.id;
create view v_compliance with(security_invoker=true) as
 select j.id as job_id,j.code as job,'PROFILE'::text as rule,'Job purpose and duties need evidence'::text as finding,'NZ-EJE'::text as source from jobs j where trim(purpose)='' or trim(responsibilities)=''
 union all select id,code,'OWNER','Assign a review owner','HOUSE' from jobs where trim(owner)=''
 union all select id,code,'REVIEW_DUE','Profile review is overdue','HOUSE' from jobs where review_due<current_date
 union all select j.id,j.code,'NO_EVALUATION','No local evaluation recorded','NZ-EJE' from jobs j where not exists(select 1 from evaluations e where e.job_id=j.id)
 union all select j.id,j.code,'STALE_BASIS','Job changed after evaluation started','HOUSE' from jobs j join v_latest e on e.job_id=j.id where e.job_revision<>j.revision
 union all select j.id,j.code,'MISSING_FACTOR','Evidence missing for '||(f->>'code'),'NZ-EJE' from jobs j join v_latest e on e.job_id=j.id cross join lateral jsonb_array_elements(e.framework_snapshot->'factors') f where not exists(select 1 from scores s where s.evaluation_id=e.id and s.factor=f->>'code')
 union all select j.id,j.code,'PANEL_REVIEW','Independent panel decision is outstanding','HOUSE' from jobs j join v_latest e on e.job_id=j.id where e.status in ('draft','submitted')
 union all select j.id,j.code,'REJECTED','Latest evaluation was rejected','HOUSE' from jobs j join v_latest e on e.job_id=j.id where e.status='rejected'
 union all select j.id,j.code,'OPEN_APPEAL',a.code||': '||a.name,'HOUSE' from appeals a join evaluations e on e.id=a.evaluation_id join jobs j on j.id=e.job_id where a.status='open';
create view v_attention with(security_invoker=true) as
 select job,rule,finding from v_compliance
 union all select j.code,'APPEAL_OVERDUE',a.code||': '||a.name from appeals a join evaluations e on e.id=a.evaluation_id join jobs j on j.id=e.job_id where a.status='open' and a.due<current_date;
create view v_panel with(security_invoker=true) as
 select e.code,j.code as job,j.name,e.author,e.status,e.job_revision,j.revision as current_revision,
 (select count(*) from scores s where s.evaluation_id=e.id) as scored_factors,e.submitted_at
 from evaluations e join jobs j on j.id=e.job_id where e.status in ('draft','submitted');
create view v_calibration with(security_invoker=true) as
 select family,unit,coalesce(current_grade,'Needs review') as grade,count(*) as jobs from v_register group by family,unit,current_grade;
