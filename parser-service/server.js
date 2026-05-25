const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

// Lazy load Supabase to avoid startup crashes
let supabaseClient = null;

function getSupabase() {
  if (supabaseClient) {
    return supabaseClient;
  }
  
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;
  
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_KEY must be set');
  }
  
  const { createClient } = require('@supabase/supabase-js');
  supabaseClient = createClient(url, key);
  return supabaseClient;
}

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'dota2-parser' });
});

app.get('/', (req, res) => {
  res.json({ 
    service: 'dota2-parser',
    endpoints: {
      health: '/health',
      parseReplay: 'POST /parse-replay'
    }
  });
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
    
    console.log('[Step 6] Match data generated:');
    console.log(`  - Players: ${matchData.players.length}`);
    console.log(`  - Radiant win: ${matchData.radiant_win}`);
    console.log(`  - Duration: ${matchData.duration}s`);
    console.log('[Step 6] Full player data:');
    console.log(JSON.stringify(matchData.players, null, 2));
    
    if (matchData.players.length === 0) {
      throw new Error('Replay parsed but no player stats were extracted');
    }
    
    // Step 7: Insert into database
    console.log('[Step 7] Inserting data into database...');
    const result = await insertMatchData(supabase, matchData, replay_upload_id);
    
    console.log('[Step 7] Database insertion results:');
    console.log(`  - Match ID: ${result.match_id}`);
    console.log(`  - Players inserted: ${result.players_inserted}`);
    console.log(`  - Stats inserted: ${result.stats_inserted}`);
    
    // Validate insertion
    if (result.players_inserted === 0 || result.stats_inserted === 0) {
      throw new Error(`Database insertion failed: ${result.players_inserted} players, ${result.stats_inserted} stats inserted`);
    }
    
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
      stats_inserted: result.stats_inserted,
      parsed_player_count: matchData.players.length,
      inserted_players_count: result.players_inserted,
      inserted_player_match_stats_count: result.stats_inserted,
      inserted_match_count: 1
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
      steam_id: `7656119800000000${i}`, // Mock Steam ID
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
      damage: Math.floor(Math.random() * 30000) + 10000,
      mmr_before: 3000 + Math.floor(Math.random() * 2000),
      mmr_after: 3000 + Math.floor(Math.random() * 2000)
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
    console.log('[insertMatchData] Starting database transaction...');
    
    // Get active season
    console.log('[insertMatchData] Fetching active season...');
    const { data: seasons, error: seasonError } = await supabase
      .from('seasons')
      .select('id')
      .eq('is_active', true)
      .limit(1);
    
    if (seasonError) {
      console.error('[insertMatchData] Season query error:', seasonError);
      throw new Error(`Failed to fetch season: ${seasonError.message}`);
    }
    
    if (!seasons || seasons.length === 0) {
      throw new Error('No active season found');
    }
    
    const seasonId = seasons[0].id;
    console.log(`[insertMatchData] Active season ID: ${seasonId}`);
    
    // Insert match
    console.log('[insertMatchData] Inserting match...');
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
      console.error('[insertMatchData] Match insert error:', matchError);
      throw new Error(`Failed to insert match: ${matchError.message}`);
    }
    
    const matchId = match.id;
    console.log(`[insertMatchData] Match inserted with ID: ${matchId}`);
    
    let playersInserted = 0;
    let statsInserted = 0;
    
    // Insert players and stats
    console.log(`[insertMatchData] Inserting ${matchData.players.length} players...`);
    
    for (let i = 0; i < matchData.players.length; i++) {
      const playerData = matchData.players[i];
      console.log(`[insertMatchData] Processing player ${i + 1}/${matchData.players.length}: ${playerData.player_name}`);
      
      // Prepare player insert data
      const playerInsertData = { 
        name: playerData.player_name
      };
      console.log(`[insertMatchData] Inserting player:`, JSON.stringify(playerInsertData));
      
      // Upsert player
      const { data: player, error: playerError } = await supabase
        .from('players')
        .upsert(playerInsertData, { onConflict: 'name' })
        .select()
        .single();
      
      if (playerError) {
        console.error(`[insertMatchData] ❌ Player upsert error for ${playerData.player_name}:`);
        console.error(`  Error code: ${playerError.code}`);
        console.error(`  Error message: ${playerError.message}`);
        console.error(`  Error details:`, JSON.stringify(playerError, null, 2));
        continue;
      }
      
      if (!player || !player.id) {
        console.error(`[insertMatchData] ❌ Player upsert returned no data for ${playerData.player_name}`);
        continue;
      }
      
      console.log(`[insertMatchData] ✅ Player ${playerData.player_name} upserted with ID: ${player.id}`);
      playersInserted++;
      
      // Insert player match stats
      const statsData = {
        match_id: matchId,
        steam_id: playerData.steam_id,
        player_name: playerData.player_name,
        hero: playerData.hero,
        position: playerData.position,
        team: playerData.team,
        result: playerData.result,
        kills: playerData.kills,
        deaths: playerData.deaths,
        assists: playerData.assists,
        gpm: playerData.gpm,
        xpm: playerData.xpm,
        damage: playerData.damage,
        mmr_before: playerData.mmr_before,
        mmr_after: playerData.mmr_after
      };
      
      console.log(`[insertMatchData] Inserting stats:`, JSON.stringify(statsData));
      
      const { data: insertedStats, error: statsError } = await supabase
        .from('player_match_stats')
        .insert(statsData)
        .select();
      
      if (statsError) {
        console.error(`[insertMatchData] ❌ Stats insert error for ${playerData.player_name}:`);
        console.error(`  Error code: ${statsError.code}`);
        console.error(`  Error message: ${statsError.message}`);
        console.error(`  Error details:`, JSON.stringify(statsError, null, 2));
        continue;
      }
      
      console.log(`[insertMatchData] ✅ Stats inserted for ${playerData.player_name}`);
      statsInserted++;
    }
    
    console.log(`[insertMatchData] Summary: ${playersInserted} players, ${statsInserted} stats inserted`);
    
    return {
      match_id: matchId,
      players_inserted: playersInserted,
      stats_inserted: statsInserted
    };
    
  } catch (error) {
    console.error('[insertMatchData] Fatal error:', error);
    throw new Error(`Database insertion failed: ${error.message}`);
  }
}

app.listen(PORT, '0.0.0.0', () => {
  console.log('='.repeat(50));
  console.log(`✅ Dota 2 Parser Service STARTED`);
  console.log(`Port: ${PORT}`);
  console.log(`Health: http://0.0.0.0:${PORT}/health`);
  console.log(`Parse: http://0.0.0.0:${PORT}/parse-replay`);
  console.log(`Supabase URL: ${process.env.SUPABASE_URL ? 'SET' : 'NOT SET'}`);
  console.log(`Supabase KEY: ${process.env.SUPABASE_KEY ? 'SET' : 'NOT SET'}`);
  console.log('='.repeat(50));
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled Rejection:', error);
});
