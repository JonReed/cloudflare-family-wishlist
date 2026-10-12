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

For an accepted outcome, record known actual delivery separately as `delivery`:

```yaml
delivery:
  date: '2026-09-07'
  evidence:
    - title: v1.0.0 published delivery
      url: https://github.com/JonReed/cloudflare-family-wishlist/releases/tag/v1.0.0
```

This explicitly associates the outcome with its delivery evidence; the platform
does not match releases automatically. The roadmap places Done outcomes on this
date. Keep the original target and retrospective acceptance date unchanged. Omit
`delivery` if its date is unknown; do not substitute the acceptance date.

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

## Executive priorities and investment

- [FWO-001](../objectives/FWO-001.md): new objective for combined family and guest
  coordination, supported by FW-001 and FW-002. Its own acceptance is still needed.
- [FW-004](FW-004.md): proposed maintenance of existing household journeys; planned,
  with a provisional FY2027 Q1 window and no completed work claimed.

Set `executivePriority: true` to highlight a key outcome or objective. Objectives
live in `docs/objectives`, use their own stable ID and criteria, and list the
contributing `outcomeIds`. Membership is optional, can span several outcomes and
does not create implementation tickets. Completing contributions does not
implicitly accept the objective.

Optional `investment` metadata contains a `category` (`capex`, `opex`, `mixed` or
`unclassified`) and a `rationale`. These are proposed planning labels, not finance
approval, expenditure or an accounting determination. Missing labels remain
unclassified. FW-001 and FW-002 propose Capex; FW-004 proposes Opex; FW-003 remains
unclassified pending review. No historical accounting treatment is asserted.

Optional `assessment` records a dated outlook with `status` (`on_track`, `at_risk`
or `off_track`), `summary`, `asOf`, `by` and `basis` (`human` or `agent`). This is
separate from acceptance. Missing assessments mean Not assessed, not on track.
