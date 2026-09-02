# The One Price Problem

A single vehicle price cannot tell an agent what every shopper pays. It cannot express whether a required dealer charge is included, whether a discount depends on eligibility, whether offers stack, or whether taxes and registration have been calculated. Turning all of that into one number forces the agent to guess.

DAP treats a retail offer like an AI-readable window sticker:

1. **Advertised price** — a generally available number, not a best-case number.
2. **Required dealer charges** — itemized and marked included or additional.
3. **Conditional adjustments** — eligibility, evidence, validity, and stacking attached.
4. **Government charges** — calculated, estimated, unknown, or not applicable; never silently zero.

Each vector below gives the same kind of shopper question, an unsafe scalar answer, and the facts a conforming client must preserve. These are executable conformance fixtures, not advertising examples.

| Vector | Failure exposed | Required client behavior |
|---|---|---|
| [`01-conditional-incentive.json`](01-conditional-incentive.json) | Best-case rebate presented to everyone | Keep the advertised price separate and state the condition. |
| [`02-required-charge-not-included.json`](02-required-charge-not-included.json) | Mandatory documentation fee omitted | Itemize the charge and say it is additional. |
| [`03-government-charges-unknown.json`](03-government-charges-unknown.json) | Unknown taxes treated as zero | Say they are not calculated until buyer facts are known. |

Run `python3 scripts/validate_artifacts.py` to validate their invariants.
