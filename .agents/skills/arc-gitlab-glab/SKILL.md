---
name: arc-gitlab-glab
description: GitLab delivery via the glab CLI and GitLab CI/CD YAML. Use when creating/protecting GitLab projects, opening or merging MRs, setting masked/protected CI variables, scheduling pipelines, or authoring/debugging .gitlab-ci.yml — including reusable pipeline templates (hidden jobs + extends + include), rules-based conditional execution, dotenv artifact passing, manual release gates, scheduled drift/backup jobs, and Kaniko image builds. Triggers on glab, .gitlab-ci.yml, GitLab CI, GitLab pipeline, protected branch, CI variable, GitLab schedule, merge request, or "set up GitLab CI". Encodes hard-won gotchas (masked-variable charset, protected-vars-vs-MR-pipelines, protected-ref hotfix gating, YAML-anchor script splice).
license: Proprietary — internal use
compatibility: Requires the glab CLI (authenticated) and git. GitLab SaaS or self-managed. Some steps assume GitLab shared runners.
metadata:
  author: andysolomon
  version: "1.0"
  source: "Extracted from gitlab.com/andysolomon/sf-todo + sf-platform-enablement (canvaser)"
allowed-tools: Bash(glab:*) Bash(git:*) Read
---

# GitLab delivery with glab + CI/CD

Operate GitLab from the terminal with `glab` and build maintainable `.gitlab-ci.yml`
pipelines. This skill encodes patterns and gotchas proven on real MR-gated, package-
releasing pipelines — not textbook defaults.

## When to use

- Stand up a GitLab project and protect `main` (MR-only) the right way.
- Author or refactor `.gitlab-ci.yml`: stages, `rules:` conditional execution, reusable
  templates, manual release gates, scheduled jobs, artifact passing.
- Manage MRs, CI/CD variables, and pipeline schedules from the CLI.
- Debug the classic failures: masked-variable rejection, secrets not reaching a pipeline,
  hotfix jobs missing protected credentials, YAML anchors breaking `script:`.

## How to work

1. **Confirm auth first:** `glab auth status` (and `glab api user` to confirm the account).
   Never assume; the session may not be logged in.
2. **Prefer the CLI/API over the UI**, but know the few things that are UI/API-only
   (pipeline *schedules*, some protected-branch nuances) — see references.
3. **Design the pipeline before the YAML.** Decide stages, which jobs burn cost (runners,
   external orgs, deploys), what gates each change class through, and where secrets are
   needed. Write that down, then implement.
4. **Validate, don't guess.** `glab ci lint` for syntax; but note local `include:` only
   resolves *after push* (see gotchas). Push to a feature branch and read the real pipeline.
5. **Outward actions need authorization.** Creating projects, pushing, merging, and
   setting variables are real, hard-to-undo actions — confirm intent before running them.

## glab CLI — the essentials

```bash
glab auth status                       # verify login + protocol (https vs ssh)
glab repo create NAME --private --description "..."   # create a project
glab repo list                         # your projects
glab mr create / glab mr merge <id> / glab mr list / glab mr view
glab variable set NAME value --masked [--protected]   # CI/CD variable
glab ci lint            # lint .gitlab-ci.yml (caveat: include:local needs a push)
glab ci status / glab ci view / glab pipeline list
glab api <endpoint>     # anything the CLI doesn't wrap (protected branches, schedules)
```

Full command catalog + the `glab api` recipes (protect branch, set merge method, create
schedule, access-level codes): **[references/glab-cli.md](references/glab-cli.md)**.

## Protecting `main` MR-only (the right way)

GitLab **auto-protects the default branch on creation** with `push=Maintainers`. For a
true MR-only gate you usually want `push=No one`. Because POST on an already-protected
branch errors, **DELETE then re-POST**:

```bash
PID="andysolomon%2Fmy-project"   # URL-encoded path/with/slashes → %2F
glab api -X DELETE "projects/$PID/protected_branches/main"
glab api -X POST   "projects/$PID/protected_branches?name=main&push_access_level=0&merge_access_level=40"
glab api -X PUT    "projects/$PID?only_allow_merge_if_pipeline_succeeds=true&merge_method=merge&remove_source_branch_after_merge=true"
```

Access levels: `0`=No one, `30`=Developer, `40`=Maintainer, `60`=Admin. Merge-commit
(`merge_method=merge`, not ff/squash) keeps the merge event as the audit record.

## CI/CD architecture — the patterns that scale

These are the load-bearing patterns; full explanations and worked YAML in
**[references/ci-architecture.md](references/ci-architecture.md)**.

- **Reusable templates = hidden jobs + `extends` + `include`.** A job whose name starts
  with `.` (e.g. `.sf-apex-test`) is a *template*; it never runs. A consuming pipeline
  `include:`s the file and defines thin real jobs that `extends:` the templates and assign
  a `stage:`. This is how one platform team serves many app teams.
- **`include` scope:** `local:` (same repo), `project:`/`file:`/`ref:` (another repo —
  **pin `ref:` to a tag**, never a moving branch), `remote:` (URL), `component:` (modern
  CI Components — the successor to hand-rolled templates; consider it for new work).
- **Conditional execution with `rules:` + `changes:`.** Gate cost-burning jobs on
  source/config paths so docs-only MRs skip them — but keep **one unconditional job**
  (e.g. `scan`) so every MR has a passing pipeline under
  `only_allow_merge_if_pipeline_succeeds`.
- **Scheduled-pipeline guard.** Add `$CI_PIPELINE_SOURCE != "schedule"` to normal jobs so
  a scheduled run (drift/backup) doesn't trigger the build jobs; schedule-only jobs use
  `if: $CI_PIPELINE_SOURCE == "schedule"`.
- **Pass values between jobs with dotenv artifacts.** A build job writes `X=...` to a file
  and exposes it via `artifacts: reports: dotenv:`; downstream jobs `needs: [build]`
  inherit `$X`. (Used to hand a built package-version id to install jobs.)
- **Manual release gate.** The prod/deploy job uses `when: manual`, `allow_failure: false`
  — clicking it *is* the release-manager action.
- **Decode secrets at point of use, never log them.** `echo "$SECRET_B64" | base64 -d | tool ...`.

Starter files you can copy: a thin consumer **[assets/gitlab-ci.starter.yml](assets/gitlab-ci.starter.yml)**,
a reusable template **[assets/reusable-pipeline.template.yml](assets/reusable-pipeline.template.yml)**,
and an MR template **[assets/merge_request_template.md](assets/merge_request_template.md)**.

## Secrets & variables — the rules that bite

1. **GitLab masking rejects many charsets.** A masked variable's value must be a single
   line, ≥8 chars, base64-alphabet-ish (no spaces, limited punctuation). Secrets with
   other characters (URLs, `force://…`, PEM keys) **fail to mask**. → **base64-encode the
   secret**, store as `NAME_B64` (masked), and `base64 -d` it at point of use.
2. **Protected variables only reach protected refs.** A *protected* variable is injected
   only on pipelines for protected branches/tags — **MR/feature-branch pipelines don't get
   it.** So a secret an MR pipeline needs (e.g. a non-prod credential) must be masked but
   **unprotected**; production secrets stay protected.
3. **Protected refs are evaluated per-pipeline.** If a `hotfix/*` job needs a protected
   prod secret, **protect the `hotfix/*` branch pattern** too. A **free job retry**
   re-evaluates protected-ref status — after protecting the branch, just retry the job; no
   re-push needed.

The complete gotcha catalog (these three plus YAML-anchor `script:` splicing, glab-lint
vs local include, CI push-back-to-repo with a Project Access Token, Kaniko image build,
"measure before optimizing") lives in **[references/gotchas.md](references/gotchas.md)** —
read it before debugging a weird pipeline failure.

## Pipeline schedules (drift, backups, nightly)

Scheduled pipelines are created in **Settings → CI/CD → Schedules** (UI) or via
`glab api` (see references), with a `ref` (usually `main`). They only run jobs whose rules
match `$CI_PIPELINE_SOURCE == "schedule"`. Pair with the scheduled-guard above so a
schedule doesn't fire the build pipeline. A scheduled job can push back to the repo (e.g.
a metadata-backup branch) using a Project Access Token (`write_repository`) — see gotchas.

## Quick checklist for a new pipeline

- [ ] `glab auth status` green; correct account
- [ ] Project created; `main` protected (push=No one, merge=Maintainers, pipeline-must-succeed, merge-commit)
- [ ] Secrets stored base64+masked; prod protected, non-prod unprotected; `hotfix/*` protected if it deploys
- [ ] Stages + `rules:` conditional execution; one unconditional anchor job
- [ ] Scheduled-pipeline guard on normal jobs
- [ ] Reusable bits factored into `extends` templates / `include`d file (pin cross-project `ref:` to a tag)
- [ ] Gates verified by a real MR (planted failure goes red, then green) — not just `glab ci lint`
