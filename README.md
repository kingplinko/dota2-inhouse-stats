# Dota 2 Inhouse Statistics Dashboard

A modern, comprehensive statistics dashboard for Dota 2 inhouse leagues with player tracking, match analytics, hero statistics, and more.

## 🎮 Features

### Pages
1. **Leaderboard** - Comprehensive player rankings with MMR, win rates, KDA, impact scores, streaks, and form
2. **Player Profiles** - Detailed player stats with MMR history charts, position breakdowns, hero performance, and recent matches
3. **Heroes** - Hero statistics including pick rates, win rates, and average performance metrics
4. **Positions** - Role-based statistics and performance analysis (Carry, Mid, Offlane, Supports)
5. **Synergy** - Best hero combinations based on win rates
6. **Matches** - Complete match history with team compositions and scores
7. **Seasons** - Season management and historical data
8. **Admin Upload** - CSV/Excel file upload for bulk match data import

### Key Features
- ✅ Sortable and searchable tables using TanStack Table
- ✅ Interactive charts and visualizations using Recharts
- ✅ Season-based filtering
- ✅ Real-time statistics calculation
- ✅ Clean, modern esports-style UI
- ✅ Responsive design with Tailwind CSS
- ✅ Supabase backend with Row Level Security
- ✅ CSV upload for easy data management

## 🚀 Tech Stack

- **Frontend**: Next.js 14 (App Router), React 18
- **Styling**: Tailwind CSS, shadcn/ui components
- **Database**: Supabase (PostgreSQL)
- **Charts**: Recharts
- **Tables**: TanStack Table
- **File Parsing**: PapaParse (CSV)

## 📋 Setup Instructions

### 1. Database Setup

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project (or create a new one)
3. Navigate to the SQL Editor (left sidebar)
4. Click "New Query"
5. Copy the entire contents of `/app/lib/supabase/setup.sql`
6. Paste into the SQL editor and click "Run"

This will create:
- All required tables (players, matches, player_match_stats, seasons, uploads)
- Indexes for optimal performance
- Row Level Security policies (public read access)
- A default "Season 1" to get started

### 2. Environment Variables

The Supabase credentials are already configured in `/app/.env`:
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: Public API key
- `SUPABASE_SECRET_KEY`: Secret key (server-only)

### 3. Install Dependencies

Dependencies are already installed, including:
- @supabase/supabase-js
- @supabase/ssr
- @tanstack/react-table
- recharts
- papaparse

### 4. Run the Application

The application is already running at:
- **Preview URL**: https://inhouse-stats.preview.emergentagent.com

## 📊 CSV Upload Format

To upload match data, use the Admin page with a CSV file in this format:

```csv
player,hero,team,kills,deaths,assists,last_hits,denies,gpm,xpm,hero_damage,tower_damage,hero_healing,performance_score,position,dota_rank,match_date,win
Player1,Anti-Mage,radiant,10,2,5,450,20,650,700,15000,3000,0,8.5,1,Divine 5,2024-01-15,true
Player2,Crystal Maiden,radiant,2,8,15,50,5,250,300,8000,500,5000,7.2,5,Ancient 3,2024-01-15,true
Player3,Pudge,dire,5,6,10,150,8,350,400,12000,1000,2000,6.8,4,Legend 5,2024-01-15,false
```

### Required CSV Columns:
- **player**: Player name
- **hero**: Hero name
- **team**: "radiant" or "dire"
- **kills, deaths, assists**: Player statistics
- **last_hits, denies**: Farming stats
- **gpm, xpm**: Gold/Experience per minute
- **hero_damage, tower_damage, hero_healing**: Damage and healing stats
- **performance_score**: Overall rating (0-10)
- **position**: 1-5 (1=Carry, 2=Mid, 3=Offlane, 4=Soft Support, 5=Hard Support)
- **dota_rank**: Player's Dota 2 rank (optional)
- **match_date**: Date of match (YYYY-MM-DD format)
- **win**: "true" or "false" (whether the player won)

## 🎨 Design System

The dashboard follows a clean, modern esports aesthetic:

- **Background**: Light grey (#f5f5f5)
- **Cards**: White with rounded corners and subtle borders
- **Links/Accents**: Blue (#3b82f6)
- **Positive Stats**: Green (#22c55e) for wins, positive trends
- **Negative Stats**: Red (#ef4444) for losses, negative trends
- **Typography**: Inter font family
- **Layout**: Responsive sidebar navigation with main content area

Similar to popular esports stats sites like STRATZ and OpenDota.

## 📈 Statistics Calculated

### Leaderboard Metrics:
- **MMR**: Calculated based on wins/losses and performance
- **Win Rate**: Percentage of games won
- **KDA**: Kill/Death/Assist ratio
- **Impact Score**: KDA × Win Rate (weighted performance metric)
- **Avg Performance**: Average performance score across all games
- **Streak**: Wins in last 5 games
- **Form**: Win/loss record of last 10 games

### Hero Metrics:
- Pick rate, win rate
- Average K/D/A
- Average GPM/XPM
- Games played

### Position Metrics:
- Games and win rate per position
- Average K/D/A per role
- Average farm (GPM/XPM) per role

### Synergy:
- Hero pair combinations
- Win rates for duos
- Minimum 2 games together

## 🔐 Security

- Row Level Security (RLS) enabled on all tables
- Public read access for viewing statistics
- Secure server-side operations for data modifications
- Environment variables properly separated (public vs server-only)

## 📱 Pages Overview

### Leaderboard (`/`)
Main page showing all players ranked by MMR with comprehensive statistics. Includes search and season filtering.

### Players (`/players`)
Grid view of all players with links to individual profiles.

### Player Profile (`/players/[id]`)
Detailed player page with:
- Key stat cards
- MMR history line chart
- Position breakdown bar chart
- Top 5 heroes with stats
- Recent match history

### Heroes (`/heroes`)
Complete hero statistics table with sortable columns and summary cards.

### Positions (`/positions`)
Position-based analysis with KDA and farm charts, plus detailed comparison table.

### Synergy (`/synergy`)
Top 50 hero combinations ranked by win rate.

### Matches (`/matches`)
Recent match history with team compositions and KDA for each player.

### Seasons (`/seasons`)
All seasons with match and player counts, indicating active season.

### Admin (`/admin`)
Upload interface for CSV files with format documentation and examples.

## 🛠️ Development

The application uses Next.js App Router with:
- Server Components for data fetching
- Client Components for interactivity
- Supabase client utilities for browser and server contexts
- shadcn/ui components for consistent UI
- Recharts for data visualization
- TanStack Table for advanced table features

## 🎯 Next Steps

1. **Run the SQL setup** (see DATABASE_SETUP.md)
2. **Upload match data** via the Admin page
3. **View the leaderboard** and explore all statistics
4. **Add more seasons** as needed
5. **Share player profiles** using the direct links

## 📝 Notes

- The application automatically calculates all statistics from raw match data
- No need to manually calculate MMR, KDA, or other metrics
- Each CSV upload creates new matches and updates player stats
- Seasons can be managed directly in the Supabase dashboard
- All pages are optimized for performance with proper indexing

## 🤝 Support

For issues or questions:
1. Check the DATABASE_SETUP.md for database configuration
2. Verify your CSV format matches the example
3. Check the browser console for any errors
4. Ensure Supabase credentials are correct in .env

---

Built with ❤️ for Dota 2 inhouse communities
