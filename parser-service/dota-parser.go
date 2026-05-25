package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"

	"github.com/dotabuff/manta"
	"github.com/dotabuff/manta/dota"
)

type PlayerData struct {
	SteamID    string  `json:"steam_id"`
	PlayerName string  `json:"player_name"`
	Hero       string  `json:"hero"`
	Team       string  `json:"team"`
	Kills      int32   `json:"kills"`
	Deaths     int32   `json:"deaths"`
	Assists    int32   `json:"assists"`
	LastHits   int32   `json:"last_hits"`
	Denies     int32   `json:"denies"`
	GPM        int32   `json:"gpm"`
	XPM        int32   `json:"xpm"`
	HeroDamage int32   `json:"hero_damage"`
	Position   int     `json:"position"`
}

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

	// Parse replay
	parser, err := manta.NewStreamParser(os.Stdin)
	if err != nil {
		log.Fatalf("Failed to create parser: %v", err)
	}

	file, err := os.Open(filename)
	if err != nil {
		log.Fatalf("Failed to open file: %v", err)
	}
	defer file.Close()

	parser, err = manta.NewStreamParser(file)
	if err != nil {
		log.Fatalf("Failed to create parser: %v", err)
	}

	var matchData MatchData
	var players []PlayerData

	// Register callbacks to extract data
	parser.Callbacks.OnCDemoFileInfo(func(m *dota.CDemoFileInfo) error {
		// Extract basic match info
		return nil
	})

	// Parse the replay
	if err := parser.Start(); err != nil {
		log.Fatalf("Parse error: %v", err)
	}

	// Extract player data from parser state
	// This is simplified - actual implementation needs to access game state
	matchData.Players = players
	matchData.RadiantWin = false // TODO: Extract from game state
	matchData.Duration = 0       // TODO: Extract from game state

	// Output as JSON
	output, err := json.MarshalIndent(matchData, "", "  ")
	if err != nil {
		log.Fatalf("JSON marshal error: %v", err)
	}

	fmt.Println(string(output))
}
