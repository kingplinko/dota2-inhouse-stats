/**
 * External Parser Service Integration
 * 
 * PLACEHOLDER: Replace this with actual parser service call when ready
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
async function parseReplayWithExternalService(filePath) {
  // TODO: Replace with actual parser service call
  // Example: POST to parser-service.com/parse with file
  
  throw new Error('Replay uploaded, but parser service is not connected yet. Implementation pending.')
  
  /*
  // FUTURE IMPLEMENTATION:
  const FormData = require('form-data');
  const form = new FormData();
  form.append('replay', fs.createReadStream(filePath));
  
  const response = await fetch('https://parser-service.com/parse', {
    method: 'POST',
    body: form
  });
  
  return await response.json();
  */
}

module.exports = { parseReplayWithExternalService };
