-- Create replay_uploads table for tracking .dem file processing
CREATE TABLE IF NOT EXISTS replay_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  file_path text NOT NULL,
  status text NOT NULL DEFAULT 'uploaded',
  match_id text,
  error_message text,
  uploaded_at timestamp DEFAULT now(),
  parsed_at timestamp,
  created_at timestamp DEFAULT now()
);

-- Create index for querying by status
CREATE INDEX IF NOT EXISTS idx_replay_uploads_status ON replay_uploads(status);

-- Enable RLS
ALTER TABLE replay_uploads ENABLE ROW LEVEL SECURITY;

-- Public read policy
CREATE POLICY "Public read replay_uploads" ON replay_uploads FOR SELECT USING (true);

-- Grant access
GRANT SELECT ON replay_uploads TO anon, authenticated;
