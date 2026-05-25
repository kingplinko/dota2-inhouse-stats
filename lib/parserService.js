/**
 * External Parser Service Integration
 * 
 * Connects to Railway-deployed parser microservice
 * 
 * Expected parser service to return:
 * {
 *   success: true,
 *   match: {
 *     radiant_win: boolean,
 *     duration: number (seconds),
 *     match_date: ISO timestamp
 *   },
 *   players: [
 *     {
 *       name: string,
 *       hero: string,
 *       team: 'radiant' | 'dire',
 *       kills: number,
 *       deaths: number,
 *       assists: number,
 *       last_hits: number,
 *       denies: number,
 *       gpm: number,
 *       xpm: number,
 *       hero_damage: number,
 *       tower_damage: number,
 *       hero_healing: number,
 *       position: number (1-5)
 *     }
 *   ]
 * }
 */

const FormData = require('form-data');
const fs = require('fs');

async function parseReplayWithExternalService(filePath) {
  // Check if parser service is enabled
  if (process.env.PARSER_SERVICE_ENABLED !== 'true') {
    throw new Error('Replay uploaded, but parser service is not connected yet. Deploy to Railway first - see RAILWAY_DEPLOY.md');
  }

  const parserUrl = process.env.PARSER_SERVICE_URL;
  const apiKey = process.env.PARSER_SERVICE_API_KEY;
  const timeout = parseInt(process.env.PARSER_SERVICE_TIMEOUT || '300000'); // 5 min default

  if (!parserUrl) {
    throw new Error('PARSER_SERVICE_URL not configured in .env file');
  }

  console.log(`Sending file to parser service: ${parserUrl}`);

  try {
    // Create form data with the .dem file
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));

    // Prepare request headers
    const headers = {
      ...form.getHeaders()
    };

    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    // Send file to parser service
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(parserUrl, {
      method: 'POST',
      body: form,
      headers: headers,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    console.log(`Parser service response status: ${response.status}`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Parser service error: ${response.status}`);
    }

    const result = await response.json();
    console.log(`Parser service result:`, JSON.stringify(result).substring(0, 200));

    if (!result.success) {
      throw new Error(result.error || 'Parser service returned unsuccessful response');
    }

    // Transform response to expected format
    return {
      match: {
        radiant_win: result.radiant_win,
        duration: result.duration,
        match_date: result.match_date
      },
      players: result.players.map(p => ({
        name: p.player_name,
        hero: p.hero,
        team: p.team,
        position: p.position,
        kills: p.kills,
        deaths: p.deaths,
        assists: p.assists,
        last_hits: p.last_hits,
        denies: p.denies,
        gpm: p.gpm,
        xpm: p.xpm,
        hero_damage: p.hero_damage,
        tower_damage: p.tower_damage,
        hero_healing: p.hero_healing
      }))
    };

  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Parser service timeout - file too large or service unresponsive');
    }
    console.error('Parser service error:', error);
    throw error;
  }
}

module.exports = { parseReplayWithExternalService };
