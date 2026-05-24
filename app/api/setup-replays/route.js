import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SECRET_KEY
    )

    // Create replay_uploads table
    const { error: tableError } = await supabase.rpc('exec_sql', {
      sql: `
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
        ALTER TABLE replay_uploads ENABLE ROW LEVEL SECURITY;
        CREATE POLICY IF NOT EXISTS "Public read replay_uploads" ON replay_uploads FOR SELECT USING (true);
      `
    })

    // Create storage bucket
    const { data: buckets } = await supabase.storage.listBuckets()
    const replaysBucketExists = buckets?.some(b => b.name === 'replays')
    
    if (!replaysBucketExists) {
      const { error: bucketError } = await supabase.storage.createBucket('replays', {
        public: true
      })
      
      if (bucketError && !bucketError.message.includes('already exists')) {
        return NextResponse.json({ error: `Bucket creation failed: ${bucketError.message}` })
      }
    }

    return NextResponse.json({ 
      success: true,
      message: 'Setup complete! Ready to upload replays.'
    })

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
