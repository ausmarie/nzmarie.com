CREATE TABLE IF NOT EXISTS report_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL,
  parent_id       UUID REFERENCES report_documents(id) ON DELETE CASCADE,
  doc_type        VARCHAR(20) NOT NULL DEFAULT 'general'
                  CHECK (doc_type IN ('report', 'letter', 'suburb_intro', 'general')),
  suburb_id       UUID REFERENCES report_suburbs(id) ON DELETE SET NULL,
  quarter         VARCHAR(10),
  title           VARCHAR(500) NOT NULL DEFAULT 'Untitled',
  content         JSONB,
  icon            VARCHAR(100),
  cover_type      VARCHAR(20),
  cover_value     VARCHAR(500),
  sort_order      INTEGER NOT NULL DEFAULT 0,
  status          VARCHAR(20) NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'finalised', 'archived')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_user ON report_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_type ON report_documents(doc_type);
CREATE INDEX IF NOT EXISTS idx_documents_suburb ON report_documents(suburb_id);
CREATE INDEX IF NOT EXISTS idx_documents_quarter ON report_documents(quarter);
CREATE INDEX IF NOT EXISTS idx_documents_parent ON report_documents(parent_id);
