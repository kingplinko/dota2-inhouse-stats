# 🎯 QUICK START: Railway Deployment

## What You'll Do (10 Minutes Total)

```
Your Computer → GitHub → Railway → Your Dashboard
```

---

## EXACT STEPS

### 1️⃣ Create Railway Account (2 min)
- Go to: https://railway.app
- Click "Start a New Project"
- Sign up with GitHub
- ✅ Get $5 free credit

### 2️⃣ Push to GitHub (5 min)

**If you DON'T have GitHub yet:**

```bash
# On GitHub.com, create new repo: "dota2-inhouse-stats" (Public)
# Then in your terminal:

cd /app
git init
git add .
git commit -m "Add parser service"
git remote add origin https://github.com/YOUR_USERNAME/dota2-inhouse-stats.git
git branch -M main
git push -u origin main
```

**If you ALREADY have GitHub:**
```bash
cd /app
git add parser-service/
git commit -m "Add parser service"
git push
```

### 3️⃣ Deploy on Railway (3 min)

1. Go to: https://railway.app/new
2. Click **"Deploy from GitHub repo"**
3. Select **your repository**
4. Click **"Settings"** → Set **"Root Directory"** to: `parser-service`
5. Click **"Deploy"**
6. Wait 2-3 minutes ⏳
7. Click **"Settings"** → **"Networking"** → **"Generate Domain"**
8. Copy the URL (looks like: `https://xyz.up.railway.app`)

### 4️⃣ Connect to Dashboard (1 min)

```bash
# Edit .env file
nano /app/.env

# Add these lines (paste YOUR Railway URL):
PARSER_SERVICE_ENABLED=true
PARSER_SERVICE_URL=https://YOUR-RAILWAY-URL.up.railway.app/parse

# Save: Ctrl+X, Y, Enter

# Restart:
sudo supervisorctl restart nextjs
```

### 5️⃣ Test It!

```bash
# Test parser health:
curl https://YOUR-RAILWAY-URL.up.railway.app/health

# Should return: {"status":"healthy","service":"dota2-parser"}
```

Then:
1. Go to: http://localhost:3000/replays
2. Upload your .dem file
3. Wait 30-60 seconds
4. Go to: http://localhost:3000
5. ✅ See your leaderboard populated!

---

## Troubleshooting

**Problem: Build fails on Railway**
→ Make sure "Root Directory" = `parser-service`

**Problem: "Parser not connected"**
→ Check `.env` has `PARSER_SERVICE_ENABLED=true`

**Problem: "Service timeout"**
→ Check Railway logs (click "View Logs" in Railway dashboard)

---

## That's It! 🎉

You can now upload .dem files and they'll automatically:
- Parse
- Extract stats
- Populate database
- Update leaderboard

**Fully automated!**

---

## Full Details

See `/app/RAILWAY_DEPLOY.md` for complete step-by-step guide with troubleshooting.
