# GitLab CI/CD YAML architecture

How to structure a `.gitlab-ci.yml` that stays maintainable as it grows from one app to a
platform serving many. Patterns below are proven on an MR-gated, package-releasing
pipeline (validate → test → build → test-release → release, plus scheduled drift/backup).

## Core anatomy

```yaml
stages: [validate, test, package, test-release, release]

variables:           # global; overridable per-job and by CI/CD settings variables
  FOO: "bar"

job-name:
  stage: test
  image: node:22
  before_script: [ ... ]   # runs before script
  script: [ ... ]          # the work (required)
  after_script: [ ... ]    # runs even if script fails (cleanup)
  rules: [ ... ]           # when this job is created (prefer over only/except)
  needs: [ ... ]           # DAG: start as soon as deps finish (not whole prior stage)
  artifacts: { ... }       # files/reports to keep + pass downstream
  cache: { ... }           # speed up repeat runs
```

Use **`rules:`**, not the legacy `only/except`.

## Reusable templates: hidden jobs + `extends` + `include`

A job whose name starts with `.` is a **template** — it never runs. Consumers `extends:`
it and supply `stage:` (and `rules:`/`needs:` as needed). Factor shared setup into small
templates and compose with a list.

```yaml
# in the shared template file
.cli:                         # base: image + tool install
  image: $CI_IMAGE
  before_script:
    - command -v tool >/dev/null 2>&1 || install-tool
.cache:
  cache: { key: "$CI_COMMIT_REF_SLUG", paths: [.npm/] }
.unit-test:                   # composes the two
  extends: [.cli, .cache]
  script: [ npm ci, npm test ]
```

```yaml
# in the consuming .gitlab-ci.yml
include:
  - local: ci-templates/pipeline.yml          # same repo
  # cross-repo (PIN ref TO A TAG, not a moving branch):
  - project: "group/platform-ci"
    file: "templates/pipeline.yml"
    ref: "v1.3.0"
  # or a URL / a published CI Component:
  # - remote: "https://example.com/pipeline.yml"
  # - component: "$CI_SERVER_FQDN/group/comp/my-pipeline@1.0.0"

unit-test:
  extends: .unit-test
  stage: test
```

**`include` scope choice:**
- `local:` — single-repo dogfood; simplest.
- `project:`/`file:`/`ref:` — a platform team ships one template to many app teams.
  **Always pin `ref:` to a tag**; `ref: main` couples consumers to the platform's default
  branch and a change there can break every consumer without warning.
- `component:` — **CI Components** are GitLab's modern, versioned, input-typed reusable
  unit (the successor to hand-rolled template files). Prefer Components for new multi-team
  platforms; the hidden-job+include pattern remains great within one repo.

## `rules:` — conditional execution

`rules` decide whether a job is **created** for a given pipeline. Combine `if:` (context)
with `changes:` (paths) to run cost-burning jobs only when relevant.

```yaml
.code-gated:
  rules:
    - if: '$CI_PIPELINE_SOURCE == "merge_request_event"'
      changes: &code-paths            # YAML anchor: reuse this list elsewhere
        - "src/**/*"
        - "package.json"
        - ".gitlab-ci.yml"
    - if: '$CI_COMMIT_BRANCH == "main" && $CI_PIPELINE_SOURCE != "schedule"'
      changes: *code-paths            # alias the anchored list
    - if: '$CI_COMMIT_BRANCH =~ /^hotfix\// && $CI_PIPELINE_SOURCE != "schedule"'
      changes: *code-paths
```

Key practices:
- **Keep one unconditional anchor job** (e.g. `scan`) so a docs-only MR still produces a
  passing pipeline — required under `only_allow_merge_if_pipeline_succeeds` (a no-job
  pipeline blocks the merge). The consumer supplies this job's broad rule; the template
  leaves it open.
- **Scheduled-pipeline guard:** add `&& $CI_PIPELINE_SOURCE != "schedule"` to normal jobs
  so a scheduled run (drift/backup) doesn't fire the build pipeline; schedule-only jobs
  use `if: '$CI_PIPELINE_SOURCE == "schedule"'`.
- **Manual gate:** add `when: manual` (+ `allow_failure: false`) to a release/deploy job.
  Clicking it is the human release action.
- Order matters: rules evaluate top-to-bottom; first match wins. No match → job not added.

## Passing values between jobs: dotenv artifacts

```yaml
build:
  stage: package
  script:
    - ID=$(produce-id)
    - echo "ARTIFACT_ID=$ID" > build.env
  artifacts:
    reports:
      dotenv: build.env       # exports ARTIFACT_ID to downstream jobs

install:
  stage: test-release
  needs: [build]              # inherits ARTIFACT_ID via the dotenv report
  script: [ install "$ARTIFACT_ID" ]
```

Plain file artifacts (logs, reports) use `artifacts: paths:` with `when:` and `expire_in:`.

## `needs:` — DAG execution

`needs:` lets a job start as soon as its named deps finish, rather than waiting for the
whole previous stage. Use it to shorten the critical path (e.g. `install` needs only
`build`, not every test job). A job with `needs:` also *requires* those jobs to exist in
the pipeline — beware: if `build` is skipped by `rules`, a job that `needs: [build]` can
error. Share the same rule anchor across the chain so `needs:` never dangles.

## Caching

```yaml
cache:
  key: "$CI_COMMIT_REF_SLUG"     # per-branch cache
  paths: [.npm/, .cache/]
```
Set tool caches to a repo-relative dir (`npm_config_cache: "$CI_PROJECT_DIR/.npm"`) so the
`cache:` entry can capture them. Separate cache keys for heavy extras (e.g. browser
binaries) so the common cache stays small.

## Building a prebaked CI image (Kaniko)

GitLab shared runners have no Docker daemon — build images with **Kaniko**:

```yaml
build-image:
  image: { name: "gcr.io/kaniko-project/executor:debug", entrypoint: [""] }
  rules:
    - if: '$CI_PIPELINE_SOURCE == "merge_request_event"'
      changes: ["ci/Dockerfile"]
    - when: manual
      allow_failure: true
  script:
    - mkdir -p /kaniko/.docker
    - echo "{\"auths\":{\"$CI_REGISTRY\":{\"username\":\"$CI_REGISTRY_USER\",\"password\":\"$CI_REGISTRY_PASSWORD\"}}}" > /kaniko/.docker/config.json
    - /kaniko/executor --context "$CI_PROJECT_DIR/ci" --dockerfile "$CI_PROJECT_DIR/ci/Dockerfile"
        --destination "$CI_REGISTRY_IMAGE/ci:latest"
```

Gate it on Dockerfile changes (+ manual) so it doesn't run every pipeline. **Measure
before adopting** a prebaked image: on shared runners the base image (e.g. `node:22`) is
often pre-cached, so the custom-image *pull* can offset the install savings (a real
measurement showed only ~5s saved → not adopted). A caching/self-hosted runner changes
the math.

## workflow:rules (pipeline-level on/off)

Use a top-level `workflow:` to suppress whole pipelines (e.g. avoid duplicate
branch+MR pipelines):

```yaml
workflow:
  rules:
    - if: '$CI_PIPELINE_SOURCE == "merge_request_event"'
    - if: '$CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH'
    - if: '$CI_COMMIT_TAG'
    - when: never   # otherwise no pipeline
```

## Branching & release model that fits MR-gated CI

GitHub Flow on GitLab: protected `main`, short-lived `feature/<slug>` branches, **merge
commits** (the merge event is the audit record), `hotfix/<slug>` cut **from the release
tag** (not main) and back-merged, semver on the **release artifact** with `vX.Y.Z` tags
pointing at the commit that built it. See assets/merge_request_template.md for the gate
checklist.
