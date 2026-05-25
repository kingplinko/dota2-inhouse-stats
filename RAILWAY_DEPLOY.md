# 🚂 Deploy Parser Service to Railway - Exact Steps

Follow these **exact steps** to deploy your .dem parser service to Railway.

---

## Step 1: Create Railway Account (2 minutes)

1. Go to: **https://railway.app**
2. Click **"Start a New Project"** or **"Login"**
3. Sign up with **GitHub** (recommended) or email
4. ✅ You get **$5 free credit** (no credit card needed)

---

## Step 2: Prepare Your Code (Already Done ✅)

Your parser service is already created in `/app/parser-service/`:
- ✅ `app.py` - Python Flask parser service
- ✅ `Dockerfile` - Railway deployment config
- ✅ `requirements.txt` - Python dependencies

---

## Step 3: Push to GitHub (5 minutes)

### Option A: If you already have this project on GitHub
```bash
cd /app
git add parser-service/
git commit -m "Add parser service for Railway deployment"
git push origin main
```

### Option B: If you DON'T have GitHub yet

**On GitHub.com:**
1. Go to **https://github.com/new**
2. Repository name: `dota2-inhouse-stats`
3. Set to **Public** (required for Railway free tier)
4. Click **"Create repository"**

**In your terminal:**
```bash
cd /app

# Initialize git if not already done
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit with parser service"

# Add GitHub remote (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/dota2-inhouse-stats.git

# Push to GitHub
git branch -M main
git push -u origin main
```

---

## Step 4: Deploy to Railway (3 minutes)

### 4.1 Create New Project

1. Go to: **https://railway.app/new**
2. Click **"Deploy from GitHub repo"**
3. **Authorize Railway** to access your GitHub account (click "Authorize")
4. Select your repository: **`dota2-inhouse-stats`**

### 4.2 Configure Service

Railway will detect your code. Now:

1. Click **"Add variables"** or **"Variables"** tab
2. You don't need to add any variables yet (we'll get the URL first)
3. Click **"Settings"** tab
4. Scroll to **"Root Directory"**
5. Set it to: **`parser-service`** ⚠️ *This is important!*
6. Click **"Deploy"**

### 4.3 Wait for Deployment

- Railway will build your Docker container
- This takes **2-3 minutes**
- You'll see build logs in real-time
- Wait for: ✅ **"Success - Deployed"**

### 4.4 Get Your Service URL

1. Click on your deployed service
2. Click **"Settings"** tab
3. Scroll down to **"Networking"**
4. Click **"Generate Domain"**
5. Railway will give you a URL like:
   ```
   https://your-service.up.railway.app
   ```
6. **Copy this URL** 📋

---

## Step 5: Update Your Dashboard (1 minute)

Now connect your dashboard to the parser service:

### 5.1 Edit Environment Variables

```bash
# Open your .env file
nano /app/.env
```

### 5.2 Add These Lines

```bash
# Parser Service Configuration
PARSER_SERVICE_ENABLED=true
PARSER_SERVICE_URL=https://your-service.up.railway.app/parse
```

**⚠️ Replace `your-service.up.railway.app` with YOUR actual Railway URL**

### 5.3 Save and Exit

```bash
# Press Ctrl+X
# Press Y
# Press Enter
```

### 5.4 Restart Next.js

```bash
sudo supervisorctl restart nextjs
```

---

## Step 6: Test It! (1 minute)

### 6.1 Test Parser Service Directly

Open your browser or use curl:

```bash
curl https://your-service.up.railway.app/health
```

You should see:
```json
{"status":"healthy","service":"dota2-parser"}
```

### 6.2 Upload a .dem File

1. Go to your dashboard: **http://localhost:3000/replays**
2. Click **"Choose File"**
3. Select your `.dem` file
4. Click **"Upload Replay"**
5. Watch the status change:
   - ⏳ `uploaded`
   - ⏳ `parser_pending`
   - ✅ `complete`

### 6.3 Check Leaderboard

1. Go to: **http://localhost:3000**
2. ✅ **Leaderboard should now show players!**

---

## Troubleshooting

### ❌ Problem: "Build failed"

**Solution:**
1. Check Railway build logs
2. Make sure `Root Directory` is set to `parser-service`
3. Verify Dockerfile exists in `/app/parser-service/`

### ❌ Problem: "Service not responding"

**Solution:**
1. Check Railway deployment status (should be green)
2. Test health endpoint: `curl https://your-url/health`
3. Check Railway logs for errors

### ❌ Problem: "Parser service not connected"

**Solution:**
1. Verify `PARSER_SERVICE_ENABLED=true` in `.env`
2. Verify `PARSER_SERVICE_URL` is correct (include `/parse` at the end)
3. Restart Next.js: `sudo supervisorctl restart nextjs`

### ❌ Problem: "Failed to parse replay"

**Solution:**
1. Check Railway logs (click "View Logs" in Railway dashboard)
2. Verify .dem file is valid
3. Check file size (Railway free tier: max 2GB RAM)

---

## Railway Dashboard Cheat Sheet

### Where to Find Things:

- **Deployment Status:** Main project page (green = deployed)
- **Build Logs:** Click service → "Deployments" tab → Click latest deployment
- **Runtime Logs:** Click service → "Deployments" tab → "View Logs"
- **Service URL:** Click service → "Settings" → "Networking" → "Generate Domain"
- **Environment Variables:** Click service → "Variables" tab
- **Change Root Directory:** Click service → "Settings" → "Root Directory"

---

## Cost & Limits (Railway Free Tier)

- ✅ **Free Credits:** $5/month
- ✅ **Execution Time:** Up to 500 hours/month
- ✅ **RAM:** 8GB max per service
- ✅ **Storage:** 100GB
- ⚠️ **After $5 used:** Service pauses (upgrade to continue)

**Estimated usage for this parser:**
- ~$0.05 per replay parse
- **You can parse ~100 replays/month for free** 🎉

---

## What Happens After Deployment?

1. **Upload .dem file** → Stored in Supabase Storage
2. **Next.js API** → Downloads file, sends to Railway parser
3. **Railway parser** → Parses .dem, returns JSON
4. **Next.js API** → Inserts data into database
5. **Leaderboard** → Updates automatically! ✨

**Fully automated!** 🚀

---

## Next Steps After Success

Once it's working, you can:

1. **Monitor Usage:**
   - Railway Dashboard → Usage tab
   - Track how many replays you've parsed

2. **View Logs:**
   - Railway Dashboard → View Logs
   - See parse times and any errors

3. **Scale Up (Optional):**
   - Upgrade Railway plan if you parse >100 replays/month
   - Add more RAM for faster parsing

4. **Add Authentication (Optional):**
   - Add `PARSER_SERVICE_API_KEY` to Railway variables
   - Add same key to dashboard `.env`

---

## Quick Reference Commands

```bash
# Check if parser is enabled
grep PARSER_SERVICE /app/.env

# Restart Next.js
sudo supervisorctl restart nextjs

# Test parser health
curl https://your-service.up.railway.app/health

# View Next.js logs
tail -f /var/log/supervisor/nextjs.out.log

# Check recent uploads
psql $DATABASE_URL -c "SELECT file_name, status FROM replay_uploads ORDER BY created_at DESC LIMIT 5;"
```

---

## Support

If you get stuck:
1. Check Railway logs first (most issues show here)
2. Verify all environment variables are set
3. Test the health endpoint
4. Check this guide's Troubleshooting section

---

## Summary Checklist

- [ ] Created Railway account
- [ ] Pushed code to GitHub
- [ ] Created Railway project from GitHub repo
- [ ] Set Root Directory to `parser-service`
- [ ] Generated domain/URL
- [ ] Added `PARSER_SERVICE_ENABLED=true` to `.env`
- [ ] Added `PARSER_SERVICE_URL` to `.env`
- [ ] Restarted Next.js
- [ ] Tested health endpoint
- [ ] Uploaded test .dem file
- [ ] Verified leaderboard populated

✅ **If all checked, you're done!** 🎉
