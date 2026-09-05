# glab CLI reference

The official GitLab CLI. Install: `brew install glab` (macOS). Config lives at
`~/Library/Application Support/glab-cli/config.yml` (macOS) / `~/.config/glab-cli/`.

## Auth

```bash
glab auth login              # interactive: choose gitlab.com or self-managed, token, protocol
glab auth status            # shows account, host, git protocol (https/ssh), API endpoint
glab api user               # confirm WHICH account is active (don't assume)
```

Notes:
- glab can configure git to use **https** for git operations (then pushes use the stored
  token, no SSH key needed). `glab auth status` prints the chosen protocol.
- In headless/CI-style sessions the macOS keychain may be unavailable; a `git push` can
  print `failed to store: -61` (a credential-cache warning) while **still succeeding** —
  check the push result lines, not the warning.

## Repositories

```bash
glab repo create NAME --private --description "..."   # create under your namespace
glab repo create GROUP/NAME --internal               # under a group; visibility flags: --private/--internal/--public
glab repo list                                        # your projects (path + git URL)
glab repo view [PATH] [--web]
glab repo clone PATH
```

After `repo create` outside a git repo, only the remote is created — you still
`git init`, add the remote, commit, and push locally.

## Merge requests

```bash
glab mr create --fill --source-branch feature/x --target-branch main   # --fill from commits
glab mr create --draft --title "..." --description "..."
glab mr list [--mine] [--state opened|merged|closed]
glab mr view <id|branch> [--web]
glab mr approve <id>
glab mr merge <id>                 # respects project merge settings
glab mr merge <id> --squash        # or --merge / --rebase per project policy
glab mr merge <id> --remove-source-branch --yes
```

## CI / pipelines

```bash
glab ci lint                       # validate .gitlab-ci.yml (SEE CAVEAT below)
glab ci view [BRANCH]              # interactive pipeline view
glab ci status [--branch BRANCH]
glab ci trace [JOB]                # stream a job log
glab pipeline list
glab pipeline run --branch main    # trigger a pipeline
glab ci get --pipeline-id <id>
```

**`glab ci lint` caveat:** it validates syntax against the API but **cannot resolve
`include: local:`** entries until the file is pushed (the included file is read
server-side from the repo). A lint "config error" for an unpushed local include is
expected and harmless (costs nothing). To truly validate, push to a feature branch and
read the real pipeline, or use the Pipeline Editor (UI) which resolves includes.

## CI/CD variables

```bash
glab variable set NAME "value" --masked                 # masked (hidden in logs)
glab variable set NAME "value" --masked --protected     # + only on protected refs
glab variable set NAME "value" --raw                    # no expansion
glab variable list
glab variable get NAME
glab variable delete NAME
# scope/environment:
glab variable set NAME "value" --scope "production"
```

Masking rules (why `--masked` sometimes refuses the value): the value must be a single
line, **≥ 8 characters**, and from a restricted alphabet (base64-ish; no spaces, limited
punctuation). If it refuses, **base64-encode** and store as `NAME_B64` (see
gotchas.md #1).

## `glab api` — for everything the CLI doesn't wrap

`glab api` calls the GitLab REST API with auth handled. The project id can be numeric or
the **URL-encoded path** (`group/project` → `group%2Fproject`).

### Protected branches

```bash
PID="group%2Fproject"
# list
glab api "projects/$PID/protected_branches"
# protect main MR-only: push=No one(0), merge=Maintainer(40)
glab api -X POST "projects/$PID/protected_branches?name=main&push_access_level=0&merge_access_level=40"
# wildcard (protect all hotfix branches so they receive protected vars)
glab api -X POST "projects/$PID/protected_branches?name=hotfix/*&push_access_level=40&merge_access_level=40"
# remove (needed before re-protecting; POST on an already-protected branch errors)
glab api -X DELETE "projects/$PID/protected_branches/main"
```

Access-level codes: `0`=No one, `30`=Developer, `40`=Maintainer, `60`=Admin.

### Project merge settings

```bash
glab api -X PUT "projects/$PID?only_allow_merge_if_pipeline_succeeds=true&merge_method=merge&remove_source_branch_after_merge=true"
# merge_method: merge (merge commit) | rebase_merge | ff (fast-forward)
```

### Pipeline schedules

```bash
# create a daily schedule on main (cron in UTC unless cron_timezone set)
glab api -X POST "projects/$PID/pipeline_schedules" \
  -f description="nightly-drift" -f ref="main" -f cron="0 3 * * *" -f cron_timezone="UTC" -f active=true
glab api "projects/$PID/pipeline_schedules"                       # list
glab api -X POST "projects/$PID/pipeline_schedules/<id>/play"      # run now
# schedule variables (passed to the scheduled pipeline):
glab api -X POST "projects/$PID/pipeline_schedules/<id>/variables" -f key=MODE -f value=backup
```

The UI path is **Settings → CI/CD → Schedules**. Scheduled pipelines only run jobs whose
rules match `$CI_PIPELINE_SOURCE == "schedule"`.

### CI variables via API (when you need scope/raw flags glab doesn't expose)

```bash
glab api -X POST "projects/$PID/variables" -f key=NAME_B64 -f value="..." -f masked=true -f protected=false
glab api -X PUT  "projects/$PID/variables/NAME_B64" -f value="..."
```

### Useful predefined CI variables (read inside jobs)

`CI_PIPELINE_SOURCE` (push|merge_request_event|schedule|web|trigger),
`CI_COMMIT_BRANCH`, `CI_COMMIT_TAG`, `CI_MERGE_REQUEST_IID`, `CI_PROJECT_PATH`,
`CI_PROJECT_DIR`, `CI_SERVER_HOST`, `CI_REGISTRY`, `CI_REGISTRY_IMAGE`,
`CI_REGISTRY_USER`/`CI_REGISTRY_PASSWORD` (job-token registry auth), `CI_JOB_ID`,
`CI_PIPELINE_CREATED_AT`, `CI_DEFAULT_BRANCH`.

## Pushing from CI back into the repo (e.g. a backup branch)

The default `CI_JOB_TOKEN` **cannot push**. Use a **Project Access Token** with the
`write_repository` scope, stored as a masked CI variable (e.g. `GITLAB_PUSH_TOKEN`):

```bash
git push "https://oauth2:${GITLAB_PUSH_TOKEN}@${CI_SERVER_HOST}/${CI_PROJECT_PATH}.git" HEAD:prod-backup
```

Add `[skip ci]` to the commit message to avoid a push→pipeline→push loop, and guard with
`git diff --cached --quiet` so you only commit on real change.
