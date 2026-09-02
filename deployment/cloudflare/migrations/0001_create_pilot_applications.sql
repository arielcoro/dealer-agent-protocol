CREATE TABLE IF NOT EXISTS pilot_applications (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'contacted', 'accepted', 'declined', 'withdrawn')),
  contact_name TEXT NOT NULL,
  work_email TEXT NOT NULL,
  dealership_name TEXT NOT NULL,
  dealership_website TEXT NOT NULL,
  role TEXT NOT NULL,
  rooftop_count TEXT NOT NULL,
  pilot_goal TEXT NOT NULL,
  timeline TEXT,
  consent INTEGER NOT NULL CHECK (consent = 1),
  source_path TEXT NOT NULL DEFAULT '/pilot/'
);

CREATE INDEX IF NOT EXISTS idx_pilot_applications_status_created
  ON pilot_applications (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pilot_applications_email
  ON pilot_applications (work_email);
