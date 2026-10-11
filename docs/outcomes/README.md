# Outcomes

These documents record intended user outcomes, current human-reported delivery
status and acceptance evidence. They are versioned alongside the product.

Each outcome has a stable ID and a Markdown document with YAML front matter.
The filename matches its ID, for example `FW-001.md`. Add another document here
for another outcome; editing the existing document updates the same outcome.

A release or completed implementation does not itself mean an outcome is done.
Only record `status: done` once the product owner has agreed the criteria,
each criterion has `verified: true` and evidence links, no remaining work is
listed, and an `acceptance` record names the same owner with a date and evidence.
These are human assertions recorded in source, not automatic certification.

For retrospective outcomes, keep `retrospective: true` and set `recorded` to the
actual date of writing. Describe historic delivery separately; do not backdate
this record or invent acceptance.

Use `target: { kind: unscheduled }` where no target is agreed. Supported targets
also include date, week, month, financial quarter and financial year. Targets are
planning intent, not inferred from release dates.

Evidence is linked, not copied into a second ticket system. Prefer immutable
source links for files. A commit can explicitly associate itself with an outcome
using a trailer such as `Outcome: FW-001`; it does not establish acceptance.

## Current outcomes

- [FW-001](FW-001.md): anonymous guests can coordinate gift buying; awaiting Jon's QA.
- [FW-002](FW-002.md): private family gift coordination; delivered in v1.0.0 and retrospectively accepted.
- [FW-003](FW-003.md): optional automatic household updates; delivered in v1.1.1 and retrospectively accepted.

Jon confirmed FW-002 and FW-003 on 11 October 2026. The
[acceptance record](acceptance/2026-10-11-retrospective.md) keeps that confirmation
separate from the earlier delivery dates.
