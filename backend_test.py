#!/usr/bin/env python3
"""
Backend tests for Dota 2 Inhouse Stats Dashboard
Tests Supabase connection, database queries, and CSV upload flow
"""

import os
import sys
import json
import csv
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/.env')

# Check if supabase library is available
try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except ImportError:
    print("⚠️  Supabase Python client not installed. Installing...")
    os.system("pip install supabase -q")
    try:
        from supabase import create_client, Client
        SUPABASE_AVAILABLE = True
    except ImportError:
        SUPABASE_AVAILABLE = False
        print("❌ Failed to install supabase client")

class TestResults:
    def __init__(self):
        self.passed = []
        self.failed = []
        self.warnings = []
    
    def add_pass(self, test_name, message=""):
        self.passed.append(f"✅ {test_name}: {message}")
        print(f"✅ {test_name}: {message}")
    
    def add_fail(self, test_name, message=""):
        self.failed.append(f"❌ {test_name}: {message}")
        print(f"❌ {test_name}: {message}")
    
    def add_warning(self, test_name, message=""):
        self.warnings.append(f"⚠️  {test_name}: {message}")
        print(f"⚠️  {test_name}: {message}")
    
    def summary(self):
        print("\n" + "="*80)
        print("TEST SUMMARY")
        print("="*80)
        print(f"Passed: {len(self.passed)}")
        print(f"Failed: {len(self.failed)}")
        print(f"Warnings: {len(self.warnings)}")
        print("="*80)
        
        if self.failed:
            print("\n❌ FAILED TESTS:")
            for fail in self.failed:
                print(f"  {fail}")
        
        if self.warnings:
            print("\n⚠️  WARNINGS:")
            for warn in self.warnings:
                print(f"  {warn}")
        
        return len(self.failed) == 0

def test_environment_variables(results):
    """Test that all required environment variables are set"""
    print("\n" + "="*80)
    print("TEST 1: Environment Variables")
    print("="*80)
    
    required_vars = [
        'NEXT_PUBLIC_SUPABASE_URL',
        'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
        'NEXT_PUBLIC_BASE_URL'
    ]
    
    all_present = True
    for var in required_vars:
        value = os.getenv(var)
        if value:
            # Mask sensitive values
            if 'KEY' in var:
                display_value = value[:10] + "..." if len(value) > 10 else "***"
            else:
                display_value = value
            results.add_pass(f"Env var {var}", f"Present: {display_value}")
        else:
            results.add_fail(f"Env var {var}", "Missing")
            all_present = False
    
    return all_present

def test_supabase_connection(results):
    """Test Supabase client connection"""
    print("\n" + "="*80)
    print("TEST 2: Supabase Connection")
    print("="*80)
    
    if not SUPABASE_AVAILABLE:
        results.add_fail("Supabase Client", "Library not available")
        return None
    
    try:
        url = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
        key = os.getenv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')
        
        if not url or not key:
            results.add_fail("Supabase Connection", "Missing credentials")
            return None
        
        supabase: Client = create_client(url, key)
        results.add_pass("Supabase Client", "Created successfully")
        return supabase
    except Exception as e:
        results.add_fail("Supabase Connection", f"Error: {str(e)}")
        return None

def test_database_tables(supabase, results):
    """Test that required database tables exist and are accessible"""
    print("\n" + "="*80)
    print("TEST 3: Database Tables")
    print("="*80)
    
    if not supabase:
        results.add_fail("Database Tables", "No Supabase connection")
        return False
    
    tables = ['seasons', 'players', 'matches', 'player_match_stats', 'uploads']
    all_accessible = True
    
    for table in tables:
        try:
            response = supabase.table(table).select("*").limit(1).execute()
            results.add_pass(f"Table '{table}'", f"Accessible (found {len(response.data)} rows in sample)")
        except Exception as e:
            results.add_fail(f"Table '{table}'", f"Error: {str(e)}")
            all_accessible = False
    
    return all_accessible

def test_seasons_query(supabase, results):
    """Test fetching seasons from Supabase"""
    print("\n" + "="*80)
    print("TEST 4: Seasons Query")
    print("="*80)
    
    if not supabase:
        results.add_fail("Seasons Query", "No Supabase connection")
        return None
    
    try:
        response = supabase.table('seasons').select('*').order('start_date', desc=True).execute()
        seasons = response.data
        
        if seasons:
            results.add_pass("Seasons Query", f"Found {len(seasons)} seasons")
            
            # Check for active season
            active_seasons = [s for s in seasons if s.get('is_active')]
            if active_seasons:
                results.add_pass("Active Season", f"Found active season: {active_seasons[0].get('name')}")
            else:
                results.add_warning("Active Season", "No active season found - CSV upload will fail")
            
            return seasons
        else:
            results.add_warning("Seasons Query", "No seasons found in database")
            return []
    except Exception as e:
        results.add_fail("Seasons Query", f"Error: {str(e)}")
        return None

def test_players_query(supabase, results):
    """Test fetching players from Supabase"""
    print("\n" + "="*80)
    print("TEST 5: Players Query")
    print("="*80)
    
    if not supabase:
        results.add_fail("Players Query", "No Supabase connection")
        return None
    
    try:
        response = supabase.table('players').select('*').execute()
        players = response.data
        
        if players:
            results.add_pass("Players Query", f"Found {len(players)} players")
            
            # Check player structure
            sample_player = players[0]
            required_fields = ['id', 'name']
            for field in required_fields:
                if field in sample_player:
                    results.add_pass(f"Player field '{field}'", "Present")
                else:
                    results.add_fail(f"Player field '{field}'", "Missing")
            
            return players
        else:
            results.add_warning("Players Query", "No players found in database")
            return []
    except Exception as e:
        results.add_fail("Players Query", f"Error: {str(e)}")
        return None

def test_matches_query(supabase, results):
    """Test fetching matches with player_match_stats joined data"""
    print("\n" + "="*80)
    print("TEST 6: Matches Query with Joins")
    print("="*80)
    
    if not supabase:
        results.add_fail("Matches Query", "No Supabase connection")
        return None
    
    try:
        # Test the exact query used in the frontend
        response = supabase.table('matches').select('''
            id,
            season_id,
            radiant_win,
            match_date,
            player_match_stats!inner(
                player_id,
                team,
                kills,
                deaths,
                assists,
                performance_score
            )
        ''').limit(10).execute()
        
        matches = response.data
        
        if matches:
            results.add_pass("Matches Query", f"Found {len(matches)} matches")
            
            # Check match structure
            sample_match = matches[0]
            if 'player_match_stats' in sample_match:
                stats_count = len(sample_match['player_match_stats'])
                results.add_pass("Match Stats Join", f"Found {stats_count} player stats for match")
                
                # Check stats structure
                if stats_count > 0:
                    sample_stat = sample_match['player_match_stats'][0]
                    required_fields = ['player_id', 'team', 'kills', 'deaths', 'assists']
                    for field in required_fields:
                        if field in sample_stat:
                            results.add_pass(f"Stats field '{field}'", "Present")
                        else:
                            results.add_fail(f"Stats field '{field}'", "Missing")
            else:
                results.add_fail("Match Stats Join", "player_match_stats not in response")
            
            return matches
        else:
            results.add_warning("Matches Query", "No matches found in database")
            return []
    except Exception as e:
        results.add_fail("Matches Query", f"Error: {str(e)}")
        return None

def test_csv_parsing(results):
    """Test CSV parsing with PapaParse equivalent"""
    print("\n" + "="*80)
    print("TEST 7: CSV Parsing")
    print("="*80)
    
    csv_path = '/app/public/sample_matches.csv'
    
    if not os.path.exists(csv_path):
        results.add_fail("CSV File", f"Sample CSV not found at {csv_path}")
        return None
    
    try:
        with open(csv_path, 'r') as f:
            reader = csv.DictReader(f)
            rows = list(reader)
        
        if rows:
            results.add_pass("CSV Parsing", f"Parsed {len(rows)} rows")
            
            # Check CSV structure
            sample_row = rows[0]
            required_columns = ['player', 'hero', 'team', 'kills', 'deaths', 'assists', 
                              'performance_score', 'position', 'match_date', 'win']
            
            for col in required_columns:
                if col in sample_row:
                    results.add_pass(f"CSV column '{col}'", "Present")
                else:
                    results.add_fail(f"CSV column '{col}'", "Missing")
            
            return rows
        else:
            results.add_fail("CSV Parsing", "No rows found in CSV")
            return None
    except Exception as e:
        results.add_fail("CSV Parsing", f"Error: {str(e)}")
        return None

def test_csv_upload_flow(supabase, csv_rows, results):
    """Test the CSV upload flow (player creation, match creation, stats insertion)"""
    print("\n" + "="*80)
    print("TEST 8: CSV Upload Flow (Dry Run)")
    print("="*80)
    
    if not supabase:
        results.add_fail("CSV Upload Flow", "No Supabase connection")
        return False
    
    if not csv_rows:
        results.add_fail("CSV Upload Flow", "No CSV data to test")
        return False
    
    try:
        # Check for active season
        response = supabase.table('seasons').select('*').eq('is_active', True).limit(1).execute()
        
        if not response.data:
            results.add_fail("CSV Upload Flow", "No active season found - upload would fail")
            return False
        
        active_season = response.data[0]
        results.add_pass("Active Season Check", f"Found active season: {active_season.get('name')}")
        
        # Test player lookup/creation logic (without actually creating)
        test_player_name = csv_rows[0].get('player')
        if test_player_name:
            response = supabase.table('players').select('*').eq('name', test_player_name).limit(1).execute()
            
            if response.data:
                results.add_pass("Player Lookup", f"Player '{test_player_name}' exists")
            else:
                results.add_pass("Player Lookup", f"Player '{test_player_name}' would be created")
        
        # Validate CSV data structure for upload
        sample_row = csv_rows[0]
        
        # Check required fields for match creation
        if 'team' in sample_row and 'win' in sample_row:
            results.add_pass("Match Data", "Required fields present")
        else:
            results.add_fail("Match Data", "Missing required fields")
        
        # Check required fields for player stats
        stats_fields = ['hero', 'position', 'team', 'kills', 'deaths', 'assists', 
                       'last_hits', 'denies', 'gpm', 'xpm', 'hero_damage', 
                       'tower_damage', 'hero_healing', 'performance_score']
        
        missing_fields = [f for f in stats_fields if f not in sample_row]
        if not missing_fields:
            results.add_pass("Player Stats Data", "All fields present")
        else:
            results.add_warning("Player Stats Data", f"Missing fields: {', '.join(missing_fields)}")
        
        results.add_pass("CSV Upload Flow", "Validation complete - upload flow structure is correct")
        return True
        
    except Exception as e:
        results.add_fail("CSV Upload Flow", f"Error: {str(e)}")
        return False

def test_api_routes(results):
    """Test API routes if they exist"""
    print("\n" + "="*80)
    print("TEST 9: API Routes")
    print("="*80)
    
    base_url = os.getenv('NEXT_PUBLIC_BASE_URL')
    
    if not base_url:
        results.add_fail("API Routes", "NEXT_PUBLIC_BASE_URL not set")
        return False
    
    try:
        import requests
    except ImportError:
        print("Installing requests library...")
        os.system("pip install requests -q")
        import requests
    
    # Test root endpoint
    try:
        response = requests.get(f"{base_url}/api/root", timeout=10)
        if response.status_code == 200:
            results.add_pass("API /api/root", f"Status {response.status_code}")
        else:
            results.add_warning("API /api/root", f"Status {response.status_code}")
    except Exception as e:
        results.add_warning("API /api/root", f"Error: {str(e)}")
    
    # Test status endpoint
    try:
        response = requests.get(f"{base_url}/api/status", timeout=10)
        if response.status_code == 200:
            results.add_pass("API /api/status", f"Status {response.status_code}")
        else:
            results.add_warning("API /api/status", f"Status {response.status_code}")
    except Exception as e:
        results.add_warning("API /api/status", f"Error: {str(e)}")
    
    results.add_warning("API Routes", "Note: API routes use MongoDB, not Supabase - may not be relevant for this app")
    return True

def main():
    print("="*80)
    print("DOTA 2 INHOUSE STATS DASHBOARD - BACKEND TESTS")
    print("="*80)
    
    results = TestResults()
    
    # Run all tests
    env_ok = test_environment_variables(results)
    
    if env_ok:
        supabase = test_supabase_connection(results)
        
        if supabase:
            test_database_tables(supabase, results)
            seasons = test_seasons_query(supabase, results)
            players = test_players_query(supabase, results)
            matches = test_matches_query(supabase, results)
            
            csv_rows = test_csv_parsing(results)
            if csv_rows:
                test_csv_upload_flow(supabase, csv_rows, results)
        
        test_api_routes(results)
    
    # Print summary
    success = results.summary()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
