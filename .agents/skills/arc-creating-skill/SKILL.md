---
name: arc-creating-skill
description: Creates or revises agent skills in agentskills.io `SKILL.md` format. Use when the user asks to create a new skill, turn notes into a skill, improve a skill, split/consolidate skills, apply skill-writing best practices, or make a skill predictable and concise.
---

# Creating Skills

Create or revise a skill so it predictably changes agent behavior without carrying unnecessary context.

## Steps

1. **Classify invocation.** Decide whether the skill is model-invoked or user-invoked. Keep a trigger-rich `description` only when the agent or another skill must discover it; otherwise set `disable-model-invocation: true` and make the description human-facing. Completion: the invocation choice and its reason are stated.
2. **Draft the behavior spine.** Write the smallest ordered steps that make the skill work. End every step with a checkable completion criterion. Completion: each step says how the agent knows that step is done.
3. **Disclose reference.** Keep only always-needed steps in `SKILL.md`; move branch-specific templates, rubrics, examples, command recipes, and long checklists to linked sibling markdown files. Completion: `SKILL.md` is short enough to scan and every pointer says when to read its target.
4. **Prune for predictability.** Apply [`GREAT_SKILL_PRINCIPLES.md`](GREAT_SKILL_PRINCIPLES.md): remove duplication, sediment, no-ops, vague encouragement, and weak trigger prose. Prefer one strong leading word over repeated explanation. Completion: every remaining line changes invocation or execution behavior.
5. **Add eval hooks.** If the repo uses `arc-skill-eval`, add or update `evals/evals.json` with at least one positive path and one adjacent negative. Completion: the skill has runnable coverage or an explicit reason coverage is deferred.
6. **Report the contract.** Summarize created/changed files, invocation mode, disclosed references, eval coverage, and any assumptions the user should verify. Completion: the user can run or install the skill from the paths you provide.

## Output contract

Produce file changes, not just advice, when the user asks to create or revise a skill. If information is missing, make the smallest safe assumption and call it out rather than blocking, unless the invocation mode or target skill name is ambiguous.
