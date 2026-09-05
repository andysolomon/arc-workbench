# Great Skill Principles

Use this reference when creating or reviewing a skill.

## Invocation

- **Model-invoked:** keep `description`; write model-facing trigger language with genuinely distinct branches. This pays context load every turn, so use it only when autonomous discovery matters.
- **User-invoked:** set `disable-model-invocation: true`; keep the description as a short human summary. This avoids context load but requires the user to remember the skill.
- If many user-invoked skills accumulate, create one router skill rather than making every helper model-invoked.

## Information hierarchy

1. Inline steps: ordered actions needed every run.
2. Inline reference: short rules needed by most runs.
3. Disclosed reference: branch-specific or long material behind a context pointer.

A context pointer must say when to read its file. If a target is always required, either sharpen the pointer or inline the material.

## Completion criteria

Every step needs a checkable completion criterion. Strong criteria are both clear and demanding: "every linked markdown reference resolves" is better than "review links".

## Leading words

Use compact pretrained concepts to steer behavior. A strong leading word can replace repeated explanation; a weak one like "be thorough" is usually a no-op.

## Pruning checks

- **Duplication:** one meaning in multiple places. Keep one source of truth.
- **Sediment:** stale or irrelevant layers. Delete instead of adding caveats.
- **Sprawl:** `SKILL.md` is too long to scan. Disclose reference or split by branch/sequence.
- **No-op:** a line the model would follow anyway. Delete or replace with a sharper instruction.

## Minimum quality bar

- Frontmatter has `name` and either a model-facing `description` or `disable-model-invocation: true`.
- The body has a clear behavior spine.
- Long templates/checklists live in sibling reference files.
- The skill states concrete outputs or completion criteria.
- Adjacent negative behavior is covered by evals when eval infrastructure is present.
