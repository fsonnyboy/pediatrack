# Milestone checklist data — provenance and what to verify

The `MILESTONE_CHECKLIST_DATA` in `seed.ts` is the CDC/AAP 2022-revision
developmental milestone checklist (12 ages, 2 months through 5 years; 4
domains each — 48 age/domain groups, 100+ individual milestones). This is the
same class of risk `GROWTH-DATA-WARNING.md` documents for the WHO growth
tables — reference data is the part of a clinical feature that looks easiest
to seed and goes wrong most quietly — so this file exists to make the
sourcing explicit *before* the data ships, rather than after a disagreement
surfaces one.

## Why the 2022 revision specifically

CDC and AAP revised the checklists in 2022, moving the threshold from the
50th percentile ("the average age of achievement") to 75% or more of
children. A checklist built on pre-2022 data flags a large share of normally
developing children — worse than not having the feature, because it teaches
clinicians to distrust it. The revision also added checklists at 15 and 30
months. `MilestoneDefinition.sourceVersion` is set to `"2022"` on every row
so this stays checkable later.

## What was actually done to source this data

`cdc.gov` blocks automated fetches outright (every path returns HTTP 403,
including PDF assets and the `stacks.cdc.gov` mirror) — it could not be read
directly. Instead:

- **12, 18, 24, 30, 36, 48, 60 months** — transcribed from a New Jersey
  Department of Education reproduction, *"CDC Developmental Milestones – Ages
  1 through 5"* (`nj.gov/education/specialed/monitor/docs/CDCMilestones.pdf`,
  explicitly labeled "Adapted from CDC Milestones"). This is a single
  document covering seven ages, fetched and read directly — full text, not a
  summary.
- **18 and 30 months were independently cross-checked**: web search results
  quoting the live `cdc.gov/act-early/milestones/18-months.html` and
  `.../30-months.html` pages matched the NJ document's 1½-year and 2½-year
  rows verbatim. That agreement is the basis for trusting the other five ages
  in the same document.
- **2, 4, 6, 9, 15 months** — reconstructed from search-engine summaries of
  the live CDC pages, since the pages themselves were unreachable. The
  9-month result explicitly self-identified as the 75%-threshold (2022)
  version, and differs substantially from an old (pre-2022, 50th-percentile)
  "Your Baby at 9 Months" PDF that was fetched directly for comparison —
  which is worth knowing about on its own: that outdated document is still
  being served from a live, working, non-CDC URL
  (`docsfortots.org/wp-content/uploads/2017/01/CDC-Milestones-9-months-English.pdf`)
  with no version indicator, and is exactly the trap §03 of the source review
  warns about. It was identified and discarded, not used.

## What to verify before clinical use

The 2/4/6/9/15-month entries (32 of the 48 groups) were never read directly
from an authoritative document — only reconstructed from search summaries.
Spot-check those five ages against CDC's live checklist pages or milestone
tracker app before this feature informs a clinical decision. The 12/18/24/30/
36/48/60-month entries (16 groups) carry higher confidence from the direct
NJ-DOE transcription plus the 18- and 30-month cross-check, but were not
verified against the CDC source itself either, since it could not be reached.

## Consistency check to add, mirroring the growth-table one

`GROWTH-DATA-WARNING.md` describes a numeric cross-check (derived BMI vs.
published BMI) that catches a bad LMS table. Milestone text has no numeric
invariant to check the same way, but the structural one is cheap and already
enforced: `seed.ts` throws if `MILESTONE_CHECKLIST_DATA.length !== 48`
(12 ages × 4 domains) before seeding anything, so a truncated or malformed
source list fails the seed loudly instead of silently shipping an incomplete
checklist.
