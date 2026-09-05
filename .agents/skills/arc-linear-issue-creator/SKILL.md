---
name: arc-linear-issue-creator
description: >
  Bulk-creates Linear issues with verifiable checklist acceptance criteria, W-number sequencing,
  label taxonomy, and dependency tracking. Integrates with arc-creating-user-stories
  and arc-defining-work story format.
  TRIGGER when: user wants to create issues in Linear, bulk-create stories,
  push user stories to Linear, or populate a Linear project backlog.
  DO NOT TRIGGER when: managing existing Linear issues (triage, sprint planning,
  status updates), creating GitHub Issues, or creating Agile Accelerator records.
---

# Linear Issue Creator

Bulk-creates Linear issues from story definitions using the Linear GraphQL API. Handles label taxonomy, W-number sequencing, and local file sync.

## Prerequisites

- `LINEAR_API_KEY` environment variable (or prompt user to paste a `lin_api_*` key)
- Team key (required — always ask, e.g., `ARC`, `ENG`)
- Project name (optional — will match existing or note for user to create)

## Step 0: Resolve Linear Context (Always Run First)

Before creating anything, query Linear to build a context map.

### 0a. Find team ID from key

```graphql
{
  teams {
    nodes { id name key }
  }
}
```

Match the user-provided team key (e.g., `ARC`) to get the `teamId`.

### 0b. Find project (if specified)

```graphql
{
  team(id: "<teamId>") {
    projects {
      nodes { id name }
    }
  }
}
```

Match by name. If not found, inform the user they need to create it in Linear first.

### 0c. Determine W-number high-water mark

```graphql
{
  issues(filter: { team: { key: { eq: "<TEAM_KEY>" } } }, first: 100, orderBy: createdAt) {
    nodes { title }
  }
}
```

Extract `W-\d{6}` from titles, find the maximum. If none exist, start at `W-000001`.

### 0d. Get existing labels

```graphql
{
  team(id: "<teamId>") {
    labels {
      nodes { id name }
    }
  }
}
```

Cache label IDs to avoid duplicates in Step 1.

## Step 1: Label Taxonomy Setup

Create any missing labels from the standard taxonomy:

| Category | Labels |
|----------|--------|
| Epic | `epic:<name>` (project-specific, e.g., `epic:foundation`, `epic:auth`) |
| Priority | `priority:P0`, `priority:P1`, `priority:P2` |
| Size | `size:S`, `size:M`, `size:L`, `size:XL` |

### Create label mutation

```graphql
mutation {
  issueLabelCreate(input: {
    name: "<label-name>",
    teamId: "<teamId>"
  }) {
    success
    issueLabel { id name }
  }
}
```

Skip labels that already exist (matched by name from Step 0d).

## Step 2: Story Body Format

Every issue follows `arc-creating-user-stories/STORY_FORMAT.md`:

### Title format

```
[W-XXXXXX] <short descriptive title>
```

### Body format

```markdown
## User Story
**ID:** W-XXXXXX

When [situation], I want [motivation], so that [outcome].

## Acceptance Criteria

- [ ] [Observable outcome stated as a checkable fact]
  - Verify: [test command, CLI check, or manual observation]
- [ ] [Another observable outcome]
  - Verify: [how an implementer proves this criterion]

## Context
Technical context: affected files, patterns, dependencies.

**Type:** AFK | HITL
**Dependencies:** W-XXXXXX, W-XXXXXX
**Branch:** `feat/W-XXXXXX-short-name` | `fix/W-XXXXXX-short-name`
```

### Required metadata per issue

| Field | Source | Required |
|-------|--------|----------|
| Title | `[W-number] description` | Yes |
| Description | Full story body above | Yes |
| Team ID | From Step 0a | Yes |
| Project ID | From Step 0b | If specified |
| Label IDs | From Step 1 (epic + priority + size) | Yes (3 labels minimum) |

### Type definitions

- **AFK** (Away From Keyboard): Fully implementable by an AI agent without human input
- **HITL** (Human In The Loop): Requires human action (API keys, account setup, manual config)

## Step 3: Bulk Issue Creation

### Create issue mutation

```graphql
mutation CreateIssue($input: IssueCreateInput!) {
  issueCreate(input: $input) {
    success
    issue {
      id
      identifier
      url
    }
  }
}
```

### Variables

```json
{
  "input": {
    "title": "[W-000001] Repository scaffold and CI/CD",
    "description": "<full story body>",
    "teamId": "<teamId>",
    "projectId": "<projectId>",
    "labelIds": ["<epicLabelId>", "<priorityLabelId>", "<sizeLabelId>"]
  }
}
```

### Execution rules

1. **Create issues sequentially** (not parallel) to preserve ordering
2. **Rate limiting**: pause 500ms every 5 issues to avoid API throttling
3. **Error handling**: log failures but continue creating remaining issues
4. **Track results**: collect `{W-number, identifier, url}` for every created issue
5. **Summary**: print a table of all created issues at the end

### Implementation pattern (Python)

```python
import json, urllib.request, time

API_KEY = "<LINEAR_API_KEY>"
ENDPOINT = "https://api.linear.app/graphql"

def gql(query, variables=None):
    payload = {"query": query}
    if variables:
        payload["variables"] = variables
    req = urllib.request.Request(
        ENDPOINT,
        data=json.dumps(payload).encode(),
        headers={
            "Content-Type": "application/json",
            "Authorization": API_KEY,
        },
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())

# Create issues in a loop
for i, issue in enumerate(issues):
    result = gql(CREATE_MUTATION, {"input": { ... }})
    # Track result
    if (i + 1) % 5 == 0:
        time.sleep(0.5)
```

### Alternative: curl (for small batches)

```bash
curl -s -X POST https://api.linear.app/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: $LINEAR_API_KEY" \
  -d '{"query": "mutation { issueCreate(input: { title: \"...\", description: \"...\", teamId: \"...\", labelIds: [\"...\"] }) { success issue { identifier url } } }"}'
```

## Step 4: Local File Sync

After all issues are created, update local tracking files.

### progress.txt format

```
## Phase Name
[ ] W-000001 (ARC-11) Short title
[ ] W-000002 (ARC-12) Short title [HITL]
[x] W-000003 (ARC-13) Completed title
```

### IMPLEMENTATION_PLAN.md format

Add Linear cross-references to each phase:

```markdown
## Phase 1: Foundation (ARC-11 through ARC-16)
- W-000001 (ARC-11): Description of the story.
- W-000002 (ARC-12): Description of the story.
```

## Cross-Skill Delegation

| Requirement | Delegate to | Why |
|---|---|---|
| Story format & acceptance criteria | [arc-creating-user-stories](../arc-creating-user-stories/STORY_FORMAT.md) | Canonical story body format |
| Vertical slice breakdown | [arc-prd-to-issues](../arc-prd-to-issues/SKILL.md) | Tracer-bullet slice rules |
| Commit conventions & branch naming | [arc-conventional-commits](../arc-conventional-commits/SKILL.md) | `feat/W-XXXXXX-*` branch pattern |
| Plan pressure-testing | `grill-me` (global skill, not in this repo) | Decision-complete plan before issue creation |
| Ongoing issue management | Linear MCP server | Triage, sprint planning, retrospectives |

## Verification Checklist

After creating all issues, verify:

- [ ] All issues exist in Linear with correct project assignment
- [ ] Each issue has exactly 3 labels (epic + priority + size)
- [ ] No duplicate W-numbers in the team
- [ ] W-numbers are sequential from the high-water mark
- [ ] Dependency references in issue bodies are valid (W-numbers exist)
- [ ] `progress.txt` updated with W-number -> Linear ID mapping
- [ ] `IMPLEMENTATION_PLAN.md` updated with Linear cross-references
- [ ] HITL issues are clearly marked in both Linear and local files

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| `401 Unauthorized` | Invalid or expired API key | Re-generate at Linear Settings > API > Personal API Keys |
| `Team not found` | Wrong team key | Run teams query to list available keys |
| `Label already exists` | Duplicate creation attempt | Query existing labels first (Step 0d), skip matches |
| Rate limit errors | Too many requests | Increase pause interval between batches |
| Missing project | Project doesn't exist yet | User must create it in Linear dashboard first |
| W-number collision | Concurrent issue creation | Re-query high-water mark before each batch |

## Authentication

The Linear GraphQL API uses a personal API key for authentication:

```
Authorization: lin_api_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Keys are created at: **Linear > Settings > Account > API > Personal API Keys**

The key must have write access to the target team. Store as `LINEAR_API_KEY` environment variable or prompt the user to paste it at runtime.

**Security**: Never commit API keys to git. If pasted in session, write to a temp file and delete after use. Do not store in SKILL.md or any tracked file.
