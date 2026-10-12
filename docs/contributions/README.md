# Contribution effort records

These records link real work to outcomes and supporting source changes. They
illustrate how agents can leave the small amount of additional information needed
for delivery and effort reporting as part of their normal work.

**The work evidence is real. All hours in this initial sample are retrospective
demonstration estimates selected by an agent on 12 October 2026 under Jon's
authorisation. Classifications are proposals, not approved accounting treatment.**

## Current sample

| Record                | Outcome                         | Allocation date (inferred) | Estimated human hours | Proposed category |
| --------------------- | ------------------------------- | -------------------------- | --------------------: | ----------------- |
| [FWC-001](FWC-001.md) | [FW-002](../outcomes/FW-002.md) | 31 August 2026             |                     4 | Capex             |
| [FWC-002](FWC-002.md) | [FW-003](../outcomes/FW-003.md) | 3 October 2026             |                     3 | Capex             |
| [FWC-003](FWC-003.md) | [FW-002](../outcomes/FW-002.md) | 3 October 2026             |                   0.5 | Opex              |
| [FWC-004](FWC-004.md) | [FW-001](../outcomes/FW-001.md) | 9 October 2026             |                     2 | Capex             |

For this partial sample, August contains 4 proposed Capex hours. October contains
5 proposed Capex hours and 0.5 proposed Opex hours. With an October financial-year
start and ending-year naming, those belong to FY2026 Q4 and FY2027 Q1 respectively.
The 9.5 hours are not the product's total development time or a full monthly
allocation. No labour rates, monetary cost or agent runtime is estimated.

FWC-002 references several commits but counts its effort only once. FWC-003 covers
only the copying repair within its commit, excluding that commit's other changes.
No record claims historical work for the planned FW-004 maintenance outcome.

## How agents would maintain this

1. At the start, resolve the outcome and its revision, establish the activity,
   and create or reuse one stable contribution ID.
2. At a checkpoint or commit, update the work performed, effort and its basis,
   proposed classification and evidence references in the same record.
3. Publish through the repository's ordinary review/check process. A reporting
   service can ingest the source revision directly or receive its reference
   through a future MCP interface.

This is a source convention, not an installed hook or a running MCP integration.
It creates no implementation ticket or assignment roster. Work producing a
specification, design or review can be recorded even without an application-code
change. Commit count and agent runtime must not be used as human hours.

The record identity is its repository and stable ID. Later revisions replace the
previous version in reporting; repeated ingestion and additional evidence links
must not add the original hours again. A contribution shared across outcomes needs
explicit allocations whose sum does not exceed the total effort. Work spanning
months needs separate dated allocations, not an arbitrary choice of month.

## Retrospective association

Original commits and release tags are untouched. These new files reference their
full immutable SHAs and distinguish the writing date from the inferred work date.
The pinned outcome revisions were written later; they establish today's mapping,
not a claim that those outcomes were the original briefs.

Corrections update the same record with a reason preserved in Git history.
Unknown effort stays unknown, not zero. Confirmed, measured and estimated effort
must remain distinguishable in any future reporting.

## Demonstration policy: wishlist-demo-v1

For this sample, bounded new-capability work is proposed as Capex and a bounded
repair maintaining an existing journey is proposed as Opex. Each record explains
its scope. This is an illustrative allocation convention, not a finding that
accounting recognition criteria have been met.

Activity context, applicable policy and eligibility dates determine actual
treatment. A new feature or a bug fix does not by itself establish classification.
Missing evidence should remain unclassified. An outcome can contain several
classes of work; its existing investment planning label does not allocate hours.

No contributor's salary, confidential information, client policy or finance
approval is recorded here. Accountable outcome acceptance is unchanged.
