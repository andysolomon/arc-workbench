# Output Contract

Always emit these sections in order:

1. Detected Idea
2. Subpage Coverage
3. Structured Extraction
4. Scaffold Spec
5. Commands To Execute (on approval)
6. Risks / Missing Fields

Rules:
- Mark unknown values as `unknown`.
- Do not invent missing data.
- Do not execute mutating actions unless explicitly requested.
- In `Subpage Coverage`, include status per page: `ok`, `missing`, or `blocked`.
