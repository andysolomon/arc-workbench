---
name: arc-ideabrowser-openclaw-flow
description: IdeaBrowser extraction into scaffold-ready specs. Use when crawling an IdeaBrowser idea page, extracting startup idea details, or producing a deterministic scaffold spec for implementation planning/progress tracking. Playwright CLI is primary; OpenClaw is fallback.
metadata:
  short-description: Crawl IdeaBrowser pages and generate scaffold-ready extraction
---
# Arc IdeaBrowser OpenClaw Flow

Extract an IdeaBrowser startup idea into a scaffold-ready spec. The leading word is **coverage**: every expected subpage is either `ok`, `missing`, or `blocked`.

Default boundary: **safe-by-default**. Do not write files, commit, push, deploy, or execute scaffold commands unless the user explicitly asks.

For required output sections, load [references/output-contract.md](references/output-contract.md). For subpage names and normalized fields, load [IDEA_SCHEMA.md](IDEA_SCHEMA.md). For scaffold stack defaults, load [STACK_PROFILE.md](STACK_PROFILE.md) when producing the scaffold spec.

## Steps

1. **Verify browser path.**
   - Prefer `playwright-cli` with the Chrome extension bridge.
   - Use OpenClaw only when Playwright bridge is blocked or unavailable.
   - If auth/checkpoint blocks access, stop and give minimal remediation steps.

   Completion criterion: there is an attached/readable browser session, or the response reports the exact blocker and next command.

2. **Detect the target idea.**
   - Use an explicit slug or URL when provided.
   - Otherwise infer the slug/title from the current URL, page title, or browser snapshot.

   Completion criterion: `Detected Idea` has slug/URL/title where observable; unknown fields are marked `unknown`.

3. **Crawl core subpages.**
   - Visit the core IdeaBrowser subpages from `IDEA_SCHEMA.md`.
   - Use helper scripts for deterministic logs when available:
     - `scripts/crawl_idea_subpages_playwright.sh [target] [snap_limit]`
     - `scripts/crawl_idea_subpages.sh [target] [snap_limit]` as OpenClaw fallback

   Completion criterion: `Subpage Coverage` lists every expected page with `ok`, `missing`, or `blocked`.

4. **Extract normalized fields.**
   - Extract only what is visible in snapshots/pages.
   - Do not infer missing market claims, scores, proof, or keywords.
   - Use `scripts/extract_idea_fields.sh [target] [limit]` when useful.

   Completion criterion: `Structured Extraction` contains every normalized field from `IDEA_SCHEMA.md`, with unknowns explicit.

5. **Produce scaffold spec.**
   - Recommend a repo slug; use `scripts/propose_repo_name.sh` when useful.
   - Include stack profile, README summary block, `IMPLEMENTATION_PLAN.md` phase outline, `progress.txt` starter entries, and command checklist.
   - Put commands under `Commands To Execute (on approval)` unless the user explicitly approved execution.

   Completion criterion: the final output follows `references/output-contract.md` section order and contains no unapproved mutations.

## Failure handling

If extraction cannot proceed, output only:

1. blocker
2. minimal user action
3. exact next command
