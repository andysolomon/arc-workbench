---
name: arc-contract-review
description: Contract review for legal agreements, NDAs, employment terms, SaaS/MSA terms, payment agreements, finder/broker agreements, and M&A documents. Use when analyzing contract risk, extracting key terms, suggesting redlines, or preparing negotiation priorities. Informational only, not legal advice.
version: 3.0.0
---
# Arc Contract Review

Review contracts for risk, key terms, missing provisions, and negotiation priorities. The leading word is **position-aware**: a risky clause depends on who the user is in the deal.

For output shape and example structure, load [OUTPUT_CONTRACT.md](OUTPUT_CONTRACT.md). For red flags, document-type checklists, risk categories, and market benchmarks, load [REVIEW_REFERENCE.md](REVIEW_REFERENCE.md) after identifying the document type.

## Steps

1. **Preflight document completeness.**
   - Check for blank fields such as `$____`, `TBD`, `[amount]`, and underscores.
   - Identify referenced but missing schedules, exhibits, attachments, or links.
   - Determine whether the document is draft, unsigned, signed, or already executed.
   - Note visible truncation or missing pages.

   Completion criterion: pre-signing alerts list every visible blank/missing artifact, or state that none were found.

2. **Identify document type and user position.**
   - Determine the document type: NDA, SaaS/MSA, payment/merchant, M&A, finder/broker, employment, or other.
   - Determine the user's position: customer/vendor, buyer/seller, licensor/licensee, receiving/disclosing party, employee/employer, etc.
   - If position materially changes the review and is unclear, ask once; otherwise state the assumed position.
   - Assess power dynamic: standard form vs negotiated, startup vs enterprise, regulated terms, sole-source leverage.

   Completion criterion: the review states document type, user position, counterparty role, and any assumptions.

3. **Extract key terms and quick-scan red flags.**
   - Extract dates, parties, term, renewal, termination, payment, liability cap, indemnity, governing law, venue, assignment, confidentiality, IP/data ownership, and any document-specific terms.
   - Run the red-flag scan in `REVIEW_REFERENCE.md` before deep analysis.
   - Tie every finding to a section, quote, or visible clause text.

   Completion criterion: key terms and red flags are grounded in cited document text; unknown terms are marked `not found` or `unclear`.

4. **Analyze risks and redlines.**
   - Prioritize issues as critical, important, or acceptable.
   - For each issue, explain the risk, market standard, negotiability, preferred redline, and fallback.
   - Include missing provisions and internal consistency issues.
   - Always include a reviewed-and-acceptable section so absence of comments is explicit.

   Completion criterion: every material risky clause has an ask and fallback, and every major document-specific category is either analyzed or marked not found.

5. **Summarize negotiation priorities.**
   - Rank the top asks in order of practical importance.
   - Adjust recommendations for the user's position and leverage.
   - Include the informational-only / attorney-review disclaimer for material terms.

   Completion criterion: the user can see what to negotiate first, why, and what compromise to accept.

## Guardrails

- This is contract analysis, not legal advice.
- Do not hallucinate clauses; only reference text actually in the document.
- Say when enforceability depends on jurisdiction.
- Flag tax/accounting/regulatory issues without opining beyond the document text.
- If the user asks for a definitive legal conclusion, recommend qualified counsel.
