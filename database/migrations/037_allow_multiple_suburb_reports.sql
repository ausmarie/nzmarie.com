-- Migration: 037 - Allow multiple PDF documents per quarterly suburb report
-- Purpose: A quarterly suburb report (suburb + year + quarter) may contain multiple
--          PDF documents (e.g. cover letter, main report, About Marie). Add a
--          doc_label column and scope uniqueness to (suburb, quarter, year, doc_label)
--          so multiple documents can coexist while re-uploading the same label replaces it.

ALTER TABLE suburb_reports ADD COLUMN IF NOT EXISTS doc_label VARCHAR(100) NOT NULL DEFAULT 'Main Report';

DROP INDEX IF EXISTS idx_suburb_reports_suburb_quarter;

CREATE UNIQUE INDEX IF NOT EXISTS idx_suburb_reports_suburb_quarter_label
ON suburb_reports(suburb, quarter, year, doc_label);

CREATE INDEX IF NOT EXISTS idx_suburb_reports_doc_label ON suburb_reports(doc_label);

COMMENT ON COLUMN suburb_reports.doc_label IS 'Document label within the quarterly report, e.g. Main Report, Cover Letter, About Marie';
