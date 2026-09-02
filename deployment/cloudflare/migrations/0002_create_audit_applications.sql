CREATE TABLE IF NOT EXISTS audit_applications (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'delivered', 'qualified', 'declined', 'withdrawn')),
  contact_name TEXT NOT NULL,
  work_email TEXT NOT NULL,
  dealership_name TEXT NOT NULL,
  dealership_website TEXT NOT NULL,
  role TEXT NOT NULL,
  rooftop_count TEXT NOT NULL,
  market TEXT NOT NULL,
  audit_goal TEXT NOT NULL,
  consent INTEGER NOT NULL CHECK (consent = 1),
  source_path TEXT NOT NULL DEFAULT '/audit/'
);

CREATE INDEX IF NOT EXISTS idx_audit_applications_status_created
  ON audit_applications (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_applications_email
  ON audit_applications (work_email);
