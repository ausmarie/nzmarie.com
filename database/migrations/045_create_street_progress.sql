-- Street walking/progress tracking for the admin Properties street-mode flow.
-- Records whether each suburb/street has been "completed" (all liked addresses handled).
CREATE TABLE IF NOT EXISTS admin_street_progress (
  suburb VARCHAR(100) NOT NULL,
  street VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'in_progress',
  liked_count INT NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by VARCHAR(255),
  PRIMARY KEY (suburb, street)
);

CREATE INDEX IF NOT EXISTS idx_street_progress_suburb ON admin_street_progress(suburb);