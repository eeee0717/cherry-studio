---
title: Knowledge folders need a manual re-embed after the v1 → v2 migration
category: data-migration
severity: breaking
introduced_in_pr: TBD
date: 2026-06-11
---

## What changed

Folders added to a v1 knowledge base do not carry their search index through the v1 → v2 migration. A migrated folder shows an amber "Re-embed needed" badge (with an explanatory tooltip) instead of pretending to be ready; its files become searchable again after the user re-indexes it.

## Why this matters to the user

In v1, a folder's files were embedded under the folder entry itself without per-file records, and that container-level index has no home in the v2 per-file model — the migration drops it rather than migrating it wrong. Until the user re-indexes the folder, its content does not appear in knowledge search or assistant RAG answers. Re-indexing reads the original folder path on disk, so it also re-spends embedding API calls for those files.

## What the user should do

Open the knowledge base, find folder entries marked "Re-embed needed", and re-index them. The original folder must still exist at its old path; if it was moved or deleted, re-add the folder from its new location.

## Notes for release manager

- The legacy v1 vector database is intentionally left on disk per base (rollback safety), which also means every migrated base's vectors exist twice on disk until a future v1-leftover cleanup ships. That cleanup is a separate, undecided work item — see "v1 leftover cleanup (gap)" in `docs/references/knowledge/experiment/knowledge-technical-design.md` §7. Consider mentioning the disk overhead in the release note if the cleanup has not shipped.
- A recovery tool that restores folder indexes from the preserved v1 data (no re-embedding) remains technically possible; if it ships before release, this entry softens to "automatic for most users".
