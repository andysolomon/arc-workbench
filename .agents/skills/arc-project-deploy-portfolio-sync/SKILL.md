---
name: arc-project-deploy-portfolio-sync
description: Vercel deploy plus andrewsolomon.dev portfolio sync. Use when a finished project should be deployed, added or updated as a portfolio case study, linked from the homepage, and verified end-to-end. Do not use for generic Vercel troubleshooting or portfolio copywriting alone.
metadata:
  short-description: Deploy app and sync portfolio entry
---
# Arc Project Deploy Portfolio Sync

Deploy a finished project and make it visible on `andrewsolomon.dev`. The leading word is **end-to-end**: app deploy, portfolio page, homepage link, redeploy, and verification must stay connected.

For the required response sections, load [references/output-contract.md](references/output-contract.md). Use helper scripts only when their target repos are available locally.

## Steps

1. **Preflight the project repo.**
   - Confirm the current repo, branch, local changes, package manager, and build/test commands.
   - Run lint/build/tests appropriate to the project before deployment.
   - Use `scripts/project_status_check.sh <project-repo>` when applicable.

   Completion criterion: deployment is either preflight-clean or blocked by exact failing commands/errors.

2. **Deploy the project app.**
   - Identify or create the Vercel project.
   - Run a production deploy only when credentials/context are available and the user has requested live deployment.
   - Capture both the deployment URL and stable alias/custom URL.

   Completion criterion: the live app URL is captured and checked, or the response names the exact deployment blocker and next command.

3. **Sync portfolio content.**
   - In the local `andrewsolomon.dev` repo, create or update the project page under `projects/`.
   - Add or update the homepage `index.html` card linking to that page.
   - Include the live demo URL on the case-study page.
   - Keep copy lightweight and consistent with existing portfolio pages.

   Completion criterion: homepage card, project page, and live demo URL all reference the same project identity.

4. **Deploy and verify the portfolio.**
   - Deploy `andrewsolomon.dev` to production.
   - Verify the homepage card, project page, and live demo link are reachable.
   - Use `scripts/portfolio_entry_check.sh <andrewsolomon.dev-repo> <keyword>` for local link checks when useful.

   Completion criterion: every public URL is verified reachable, or the exact verification/deploy blocker is reported.

5. **Commit/push only on request.**
   - Commit portfolio changes and push `main` only if the user asks.
   - Never remove existing portfolio cards unless explicitly requested.

   Completion criterion: the final response states whether changes were committed/pushed and why.

## Boundaries

- Use a Vercel-specific skill for deploy troubleshooting that does not involve portfolio sync.
- Use this skill only when the workflow requires both app deployment and portfolio visibility.
- If live external deployment is impossible in the current environment, do not fake URLs; report blockers and next commands in the output contract.
