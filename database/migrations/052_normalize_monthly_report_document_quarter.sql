-- Monthly report documents used to store their containing quarter (for example
-- 2026-Q3) even though their title identifies a month (for example 09 2026 Torbay).
-- Normalize those legacy rows to YYYY-MM so the reports sidebar shows 2026-09.
UPDATE report_documents
SET quarter = substring(title FROM 4 FOR 4) || '-' || substring(title FROM 1 FOR 2)
WHERE doc_type = 'report'
  AND quarter ~ '^[0-9]{4}-Q[1-4]$'
  AND title ~ '^(0[1-9]|1[0-2]) [0-9]{4} ';
