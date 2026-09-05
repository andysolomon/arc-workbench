<!-- Save as .gitlab/merge_request_templates/Default.md in the repo to make it the default MR
description. Adapt the Definition-of-Done lines to your stack. -->

# Merge Request

## Change classification

- [ ] Immediate / Minor / Major / Hotfix (circle one) — Major or scope change: link the change-control entry below
- **Requirement / ticket ID(s):**
- **Change-control / CCB entry (if required):**

## What & why

<!-- One paragraph. Link the requirement, don't just describe the diff. -->

## Definition of Done

- [ ] One classified change only
- [ ] Tests: positive + negative (+ permission/auth where it matters); no fixture leakage
- [ ] Cost/limit-sensitive paths exercised at realistic volume
- [ ] Docs/diagrams/ADRs updated if architecture, schema, security, or pipeline changed
- [ ] CHANGELOG entry if user-visible
- [ ] No secret/endpoint in source; CI variables masked (base64 if charset rejected)

## Pipeline

- [ ] Pipeline green (or: planted-failure drill went red then green for gate changes)

## Reviewer (cooling-off: not the authoring session)

- [ ] Reviewed against the team's review checklist
- **Reviewer & rationale:**
