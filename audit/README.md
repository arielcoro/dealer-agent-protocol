# AI Answer Audit

The Answer Audit is the zero-integration entry point for the founding dealer pilot. It measures public answers before asking a dealer for a feed or gateway connection. It is diagnostic, repeatable, and not legal advice.

## Delivery contract

- 20 shopper questions across ChatGPT, Gemini, Claude, Perplexity, and Copilot.
- Five-page dealer-facing report within five business days.
- No DMS/CRM credentials and no customer data.
- Evidence captured with platform, model where visible, query, answer, citations, timestamp, and reviewer.
- Any FTC exposure label is a flag for counsel, never an automated legal conclusion.

Use `questions.csv`, `RUBRIC.md`, `responses.example.json`, and `python3 scripts/run_answer_audit.py` to create a scored JSON summary. The printable HTML report template lives in `report-template.html`.
