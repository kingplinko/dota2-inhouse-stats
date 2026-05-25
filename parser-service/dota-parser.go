package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/dotabuff/manta"
	"github.com/dotabuff/manta/dota"
)

// PlayerData represents extracted player stats
type PlayerData struct {
	SteamID    string `json:"steam_id"`
	PlayerName string `json:"player_name"`
	Hero       string `json:"hero"`
	Team       string `json:"team"`
	Kills      int    `json:"kills"`
	Deaths     int    `json:"deaths"`
	Assists    int    `json:"assists"`
	LastHits   int    `json:"last_hits"`
	Denies     int    `json:"denies"`
	GPM        int    `json:"gpm"`
	XPM        int    `json:"xpm"`
	HeroDamage int    `json:"hero_damage"`
	Position   int    `json:"position"`
}

// MatchData represents the full match result
type MatchData struct {
	MatchID    string       `json:"match_id"`
	Duration   float32      `json:"duration"`
	RadiantWin bool         `json:"radiant_win"`
	Players    []PlayerData `json:"players"`
}

func main() {
	if len(os.Args) < 2 {
		log.Fatal("Usage: dota-parser <replay.dem>")
	}

	filename := os.Args[1]

	// Open the replay file
	file, err := os.Open(filename)
	if err != nil {
		log.Fatalf("Failed to open file: %v", err)
	}
	defer file.Close()

	// Create parser
	parser, err := manta.NewStreamParser(file)
	if err != nil {
		log.Fatalf("Failed to create parser: %v", err)
	}

	// Initialize match data
	matchData := &MatchData{
		MatchID: extractMatchID(filename),
		Players: []PlayerData{},
	}

	// Track player stats by player index
	playerStats := make(map[int]*PlayerData)

	// Track player hero mapping
	playerHeroes := make(map[int]string)
	playerNames := make(map[int]string)
	playerSteamIDs := make(map[int]string)
	playerTeams := make(map[int]string)

	// Helper to get or create player stats
	getPlayerStats := func(playerID int) *PlayerData {
		if stats, exists := playerStats[playerID]; exists {
			return stats
		}
		stats := &PlayerData{
			Position: (playerID % 5) + 1,
		}
		playerStats[playerID] = stats
		return stats
	}

	// Track match outcome
	var radiantWin bool
	var matchDuration float32

	// Callback: Combat Log for kills/deaths/assists
	parser.Callbacks.OnCMsgDOTACombatLogEntry(func(m *dota.CMsgDOTACombatLogEntry) error {
		logType := m.GetType()

		switch logType {
		case dota.DOTA_COMBATLOG_DEATH:
			// Track deaths and kills
			targetPlayer := int(m.GetTargetSourceName())
			attackerPlayer := int(m.GetAttackerName())

			if targetPlayer >= 0 && targetPlayer < 10 {
				stats := getPlayerStats(targetPlayer)
				stats.Deaths++
			}

			if attackerPlayer >= 0 && attackerPlayer < 10 && attackerPlayer != targetPlayer {
				stats := getPlayerStats(attackerPlayer)
				stats.Kills++
			}

		case dota.DOTA_COMBATLOG_DAMAGE:
			// Could track damage here if needed

		case dota.DOTA_COMBATLOG_PURCHASE:
			// Could track item purchases
		}

		return nil
	})

	// Callback: Match metadata for player info
	parser.Callbacks.OnCDOTAUserMsg_StatsMatchDetails(func(m *dota.CDOTAUserMsg_StatsMatchDetails) error {
		// Extract player details
		heroStats := m.GetHeroStats()
		for i, heroStat := range heroStats {
			if i >= 10 {
				break
			}

			stats := getPlayerStats(i)
			stats.Kills = int(heroStat.GetKills())
			stats.Deaths = int(heroStat.GetDeaths())
			stats.Assists = int(heroStat.GetAssists())
			stats.LastHits = int(heroStat.GetLastHits())
			stats.Denies = int(heroStat.GetDenies())
			stats.GPM = int(heroStat.GetGoldPerMin())
			stats.XPM = int(heroStat.GetXpPerMin())
			stats.HeroDamage = int(heroStat.GetHeroDamage())

			// Get player name if available
			if name := heroStat.GetPlayerName(); name != "" {
				stats.PlayerName = name
				playerNames[i] = name
			}

			// Get hero name
			if hero := heroStat.GetHeroName(); hero != "" {
				heroName := cleanHeroName(hero)
				stats.Hero = heroName
				playerHeroes[i] = heroName
			}

			// Determine team (first 5 are radiant, next 5 are dire)
			if i < 5 {
				stats.Team = "radiant"
				playerTeams[i] = "radiant"
			} else {
				stats.Team = "dire"
				playerTeams[i] = "dire"
			}

			// Generate Steam ID (placeholder - not in stats)
			stats.SteamID = fmt.Sprintf("7656119800000%04d", i)
			playerSteamIDs[i] = stats.SteamID
		}

		// Extract match outcome
		radiantWin = m.GetRadiantWin()
		matchDuration = m.GetDuration()

		return nil
	})

	// Callback: Hero details for more stats
	parser.Callbacks.OnCDOTAUserMsg_StatsHeroDetails(func(m *dota.CDOTAUserMsg_StatsHeroDetails) error {
		// Additional hero-specific stats if needed
		return nil
	})

	// Parse the replay
	log.Println("Starting replay parse...")
	if err := parser.Start(); err != nil {
		log.Fatalf("Parse error: %v", err)
	}

	log.Println("Parse complete, extracting final stats...")

	// Build final player list
	players := make([]PlayerData, 0, 10)
	for i := 0; i < 10; i++ {
		if stats, exists := playerStats[i]; exists {
			// Set default name if not found
			if stats.PlayerName == "" {
				stats.PlayerName = fmt.Sprintf("Player %d", i+1)
			}
			// Set default hero if not found
			if stats.Hero == "" {
				stats.Hero = "Unknown"
			}
			// Set Steam ID
			if stats.SteamID == "" {
				stats.SteamID = fmt.Sprintf("7656119800000%04d", i)
			}

			players = append(players, *stats)
		}
	}

	// If we didn't extract players from stats, return error
	if len(players) == 0 {
		errorResponse := map[string]interface{}{
			"success": false,
			"error":   "No player stats found in replay. File may be corrupted or parser needs adjustment.",
		}
		output, _ := json.MarshalIndent(errorResponse, "", "  ")
		fmt.Println(string(output))
		os.Exit(1)
	}

	// Set match outcome
	matchData.RadiantWin = radiantWin
	matchData.Duration = matchDuration
	matchData.Players = players

	// Output JSON
	output, err := json.MarshalIndent(matchData, "", "  ")
	if err != nil {
		log.Fatalf("JSON marshal error: %v", err)
	}

	fmt.Println(string(output))
}

// Helper: Extract match ID from filename
func extractMatchID(filename string) string {
	// Remove path and extension
	base := filename
	if idx := strings.LastIndex(base, "/"); idx != -1 {
		base = base[idx+1:]
	}
	if idx := strings.LastIndex(base, "."); idx != -1 {
		base = base[:idx]
	}
	return base
}

// Helper: Clean hero name
func cleanHeroName(raw string) string {
	// Remove "npc_dota_hero_" prefix if present
	name := strings.TrimPrefix(raw, "npc_dota_hero_")
	// Convert underscores to spaces and capitalize
	name = strings.ReplaceAll(name, "_", " ")
	return strings.Title(name)
}
