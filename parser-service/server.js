const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

// Initialize Supabase
function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;
  
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_KEY must be set');
  }
  
  return createClient(url, key);
}

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'dota2-parser' });
});

app.post('/parse-replay', async (req, res) => {
  try {
    const { replay_upload_id } = req.body;
    
    if (!replay_upload_id) {
      return res.status(400).json({
        success: false,
        error: 'replay_upload_id is required'
      });
    }
    
    console.log(`Processing replay upload: ${replay_upload_id}`);
    
    const supabase = getSupabase();
    
    // Step 1: Get upload record
    console.log('[Step 1] Fetching upload record...');
    const { data: upload, error: fetchError } = await supabase
      .from('replay_uploads')
      .select('*')
      .eq('id', replay_upload_id)
      .single();
    
    if (fetchError || !upload) {
      return res.status(404).json({
        success: false,
        error: 'Upload record not found'
      });
    }
    
    // Step 2: Update status to parsing
    console.log('[Step 2] Updating status to parsing...');
    await supabase
      .from('replay_uploads')
      .update({ status: 'parsing' })
      .eq('id', replay_upload_id);
    
    // Step 3: Download file from Supabase Storage
    console.log(`[Step 3] Downloading file: ${upload.file_path}`);
    const { data: fileData, error: downloadError } = await supabase
      .storage
      .from('replays')
      .download(upload.file_path);
    
    if (downloadError) {
      throw new Error(`Failed to download file: ${downloadError.message}`);
    }
    
    console.log(`[Step 4] File downloaded (${fileData.size} bytes)`);
    
    // Step 5: Parse replay (PLACEHOLDER - real parser would go here)
    console.log('[Step 5] Parsing replay...');
    
    // For now, return mock data structure
    // TODO: Integrate actual Dota 2 parser (manta, clarity, etc.)
    const matchData = generateMockMatchData(upload.file_name);
    
    console.log('[Step 6] Extracting match data...');
    
    // Step 7: Insert into database
    console.log('[Step 7] Inserting data into database...');
    const result = await insertMatchData(supabase, matchData, replay_upload_id);
    
    // Step 8: Update status to complete
    console.log('[Step 8] Updating status to complete...');
    await supabase
      .from('replay_uploads')
      .update({
        status: 'complete',
        match_id: result.match_id,
        parsed_at: new Date().toISOString()
      })
      .eq('id', replay_upload_id);
    
    console.log(`✅ Successfully parsed replay! Match ID: ${result.match_id}`);
    
    res.json({
      success: true,
      match_id: result.match_id,
      players_inserted: result.players_inserted,
      stats_inserted: result.stats_inserted
    });
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    
    // Update status to failed
    try {
      const supabase = getSupabase();
      await supabase
        .from('replay_uploads')
        .update({
          status: 'failed',
          error_message: error.message
        })
        .eq('id', req.body.replay_upload_id);
    } catch (updateError) {
      console.error('Failed to update error status:', updateError);
    }
    
    res.status(500).json({
      success: false,
      error: `Failed to parse replay: ${error.message}`
    });
  }
});

function generateMockMatchData(filename) {
  // Extract match ID from filename
  const matchId = filename.replace('.dem', '').split('_').pop() || '0000000000';
  
  // Generate realistic mock data for 10 players
  const heroes = [
    'Anti-Mage', 'Crystal Maiden', 'Pudge', 'Invoker', 'Shadow Fiend',
    'Juggernaut', 'Lion', 'Axe', 'Phantom Assassin', 'Rubick'
  ];
  
  const players = [];
  const radiantWin = Math.random() > 0.5;
  
  for (let i = 0; i < 10; i++) {
    const team = i < 5 ? 'radiant' : 'dire';
    const won = (team === 'radiant' && radiantWin) || (team === 'dire' && !radiantWin);
    const position = (i % 5) + 1;
    
    players.push({
      player_name: `Player ${i + 1}`,
      hero: heroes[i],
      position: position,
      team: team,
      result: won ? 'win' : 'loss',
      kills: Math.floor(Math.random() * 20),
      deaths: Math.floor(Math.random() * 10),
      assists: Math.floor(Math.random() * 25),
      last_hits: Math.floor(Math.random() * 400) + 50,
      denies: Math.floor(Math.random() * 30),
      gpm: Math.floor(Math.random() * 400) + 300,
      xpm: Math.floor(Math.random() * 400) + 400,
      hero_damage: Math.floor(Math.random() * 30000) + 10000,
      tower_damage: Math.floor(Math.random() * 5000),
      hero_healing: Math.floor(Math.random() * 3000)
    });
  }
  
  return {
    match_id: matchId,
    match_date: new Date().toISOString(),
    duration: Math.floor(Math.random() * 2000) + 1800, // 30-60 minutes
    radiant_win: radiantWin,
    players: players
  };
}

async function insertMatchData(supabase, matchData, replayUploadId) {
  try {
    // Get active season
    const { data: seasons, error: seasonError } = await supabase
      .from('seasons')
      .select('id')
      .eq('is_active', true)
      .limit(1);
    
    if (seasonError || !seasons || seasons.length === 0) {
      throw new Error('No active season found');
    }
    
    const seasonId = seasons[0].id;
    
    // Insert match
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .insert({
        season_id: seasonId,
        radiant_win: matchData.radiant_win,
        match_date: matchData.match_date,
        duration: matchData.duration
      })
      .select()
      .single();
    
    if (matchError) {
      throw new Error(`Failed to insert match: ${matchError.message}`);
    }
    
    const matchId = match.id;
    let playersInserted = 0;
    let statsInserted = 0;
    
    // Insert players and stats
    for (const playerData of matchData.players) {
      // Upsert player
      const { data: player, error: playerError } = await supabase
        .from('players')
        .upsert({ name: playerData.player_name }, { onConflict: 'name' })
        .select()
        .single();
      
      if (playerError) {
        console.error('Player upsert error:', playerError);
        continue;
      }
      
      playersInserted++;
      
      // Insert player match stats
      const { error: statsError } = await supabase
        .from('player_match_stats')
        .insert({
          match_id: matchId,
          player_id: player.id,
          hero: playerData.hero,
          position: playerData.position,
          team: playerData.team,
          kills: playerData.kills,
          deaths: playerData.deaths,
          assists: playerData.assists,
          last_hits: playerData.last_hits,
          denies: playerData.denies,
          gpm: playerData.gpm,
          xpm: playerData.xpm,
          hero_damage: playerData.hero_damage,
          tower_damage: playerData.tower_damage,
          hero_healing: playerData.hero_healing
        });
      
      if (statsError) {
        console.error('Stats insert error:', statsError);
        continue;
      }
      
      statsInserted++;
    }
    
    return {
      match_id: matchId,
      players_inserted: playersInserted,
      stats_inserted: statsInserted
    };
    
  } catch (error) {
    throw new Error(`Database insertion failed: ${error.message}`);
  }
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Dota 2 Parser Service listening on port ${PORT}`);
});
