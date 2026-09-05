# GitLab CI/CD gotchas — each one cost a red pipeline

Read this before debugging a weird failure. Every item here was learned the hard way on a
real MR-gated, package-releasing GitLab pipeline.

## 1. Masked variables reject many charsets → base64 the secret

**Symptom:** `glab variable set --masked` (or the UI) refuses the value, or the variable
silently isn't masked.
**Cause:** a masked value must be a **single line, ≥ 8 chars, base64-alphabet-ish** (no
spaces, limited punctuation). Real secrets — auth URLs (`force://…`), connection strings,
PEM keys — contain disallowed characters.
**Fix:** base64-encode the secret, store it as `NAME_B64` (masked), and decode at point of
use, never logging it:
```bash
echo "$SECRET_B64" | base64 -d | some-tool login --stdin -
```

## 2. Protected variables don't reach MR/feature-branch pipelines

**Symptom:** a job works on `main` but the same job fails on an MR pipeline because a
secret is empty.
**Cause:** a **protected** CI variable is injected **only** on pipelines for protected
refs (protected branches/tags). MR pipelines run on the (unprotected) feature branch.
**Fix:** a secret an MR pipeline legitimately needs (e.g. a non-prod credential to create
ephemeral test infra) must be **masked but UNPROTECTED**. Keep **production** secrets
protected. Document the split (which var is protected, and why) in your pipeline-design doc.
**Hardening path:** a dedicated low-privilege CI identity for the unprotected credential.

## 3. Protected refs are evaluated per-pipeline → protect `hotfix/*`

**Symptom:** a `hotfix/*` deploy job fails because the protected prod secret is missing
(same root cause as #2).
**Fix:** protect the **`hotfix/*` branch pattern** so its pipelines receive protected
vars:
```bash
glab api -X POST "projects/$PID/protected_branches?name=hotfix/*&push_access_level=40&merge_access_level=40"
```
**Bonus:** a **free job retry re-evaluates protected-ref status**. After protecting the
branch, just **retry the failed job** — no re-push, no new pipeline needed.

## 4. YAML anchors splice into `script:` as a nested list → broken script

**Symptom:** `script:` fails with a nested-sequence/`mapping` error after you anchored a
command to reuse it.
**Cause:** a YAML anchor of a **single list item** spliced into another list nests it
(`script:` becomes a list-containing-a-list), which GitLab rejects.
**Fix:** anchors work great for **whole mappings/lists** (e.g. anchor a `changes:` path
list with `&code-paths` and alias it with `*code-paths`). For a repeated *command line*,
just **inline it** in each job, or move it into a base template's `before_script` and
`extends:` that. Don't anchor individual script lines.

## 5. `glab ci lint` can't resolve `include: local:` until pushed

**Symptom:** `glab ci lint` reports a config error for a perfectly good local include.
**Cause:** the included file is read **server-side from the repo**, so an unpushed
`include: local:` can't be resolved by lint.
**Fix:** this error is expected and **costs nothing** (no runners, no scratch infra). To
truly validate, push to a feature branch and read the real pipeline, or use the
**Pipeline Editor** in the UI (it resolves includes). Treat green/red on a real MR as the
source of truth, not local lint.

## 6. `only_allow_merge_if_pipeline_succeeds` + a docs-only MR = stuck

**Symptom:** a docs-only MR can't merge because its pipeline has **no jobs** (all jobs
were `changes:`-gated to code paths) and the project requires a successful pipeline.
**Fix:** keep **one unconditional anchor job** (typically the cheap `scan`/lint) that runs
on every MR. The reusable template should leave that job's `rules:` to the consumer so
each consumer can make exactly one job unconditional.

## 7. Scheduled pipeline fires the whole build

**Symptom:** a nightly drift/backup schedule triggers your build/test/deploy jobs and
burns runners or external resources.
**Fix:** add `&& $CI_PIPELINE_SOURCE != "schedule"` to every normal job's rules; give
schedule-only jobs `if: '$CI_PIPELINE_SOURCE == "schedule"'`. A scheduled pipeline then
runs *only* the maintenance jobs.

## 8. CI can't push to the repo with the default job token

**Symptom:** a job that commits back (e.g. a metadata/backup branch) gets 403 on push.
**Cause:** `CI_JOB_TOKEN` has no write-repository permission.
**Fix:** create a **Project Access Token** with `write_repository`, store it masked (e.g.
`GITLAB_PUSH_TOKEN`), and push via:
```bash
git push "https://oauth2:${GITLAB_PUSH_TOKEN}@${CI_SERVER_HOST}/${CI_PROJECT_PATH}.git" HEAD:backup-branch
```
Add `[skip ci]` to the commit message (avoid a push→pipeline→push loop) and guard with
`git diff --cached --quiet` so you only commit on real change.

## 9. Default branch auto-protected as push=Maintainers (not "No one")

**Symptom:** you wanted MR-only (`push=No one`) but direct pushes by maintainers still
work.
**Cause:** GitLab **auto-protects the default branch on creation** with
`push=Maintainers`.
**Fix:** re-protect — and because **POST fails on an already-protected branch**, DELETE
then POST:
```bash
glab api -X DELETE "projects/$PID/protected_branches/main"
glab api -X POST   "projects/$PID/protected_branches?name=main&push_access_level=0&merge_access_level=40"
```

## 10. `needs:` dangles when its dependency is rules-skipped

**Symptom:** pipeline error: a job needs another job that wasn't created (because `rules:`
skipped it on that pipeline).
**Fix:** share the **same rule anchor** across a `needs:` chain so the whole chain is
present-or-absent together (e.g. build + install + release all gated identically). Then
`needs:` never points at a missing job.

## 11. Kaniko on shared runners; and "measure before optimizing"

- Shared runners have **no Docker daemon** → build images with **Kaniko**
  (`gcr.io/kaniko-project/executor:debug`, registry auth via `CI_REGISTRY_*`).
- A prebaked CI image *sounds* faster but **measure it**: shared runners often pre-cache
  common base images (`node:22`), so the custom-image pull can cancel the install savings.
  A real before/after showed only ~5s saved → not worth it without a caching runner.

## 12. CLI flags that take a value need the explicit `-` stdin sentinel

**Symptom:** `... --some-url-stdin` errors with "expects a value", or swallows the next
flag.
**Cause:** some CLIs (e.g. `sf org login sfdx-url --sfdx-url-stdin`) require an explicit
`-` to mean "read from stdin".
**Fix:** pass the sentinel: `echo "$SECRET_B64" | base64 -d | sf org login sfdx-url --sfdx-url-stdin -`.
(General lesson: when piping a secret into a login command, check whether the stdin flag
needs a trailing `-`.)

## 13. Pipeline schedules are UI/API-only and need a `ref`

`glab` has no first-class `schedule create`; use the UI (**Settings → CI/CD →
Schedules**) or `glab api .../pipeline_schedules` (see glab-cli.md). The schedule's `ref`
is the branch the scheduled pipeline runs on (usually `main`); cron is UTC unless
`cron_timezone` is set.

---

### Debugging order when a pipeline misbehaves
1. Is the job even **created**? (rules / changes / pipeline source) — most "it didn't run"
   bugs are rules, not failures.
2. Is a **secret empty**? → protected-var-vs-ref (#2/#3) or masking-charset (#1).
3. Did `needs:` **dangle**? (#10)
4. Is it a **YAML structure** error? (anchors in script #4)
5. Only then read the actual command output.
