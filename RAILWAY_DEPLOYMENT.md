# Railway Deployment Guide

This guide will walk you through deploying your Strength Dashboard to Railway with PostgreSQL database.

## Prerequisites

✅ Completed:
- GitHub repository created: `https://github.com/ishan42d/strength_dashboard`
- All code committed and pushed
- Azure OpenAI credentials available

## Step-by-Step Deployment

### 1. Create Railway Account (if you don't have one)
- Go to [railway.app](https://railway.app)
- Sign up with GitHub (easier for future deployments)
- Authorize Railway to access your GitHub account

### 2. Create New Railway Project
1. Click **"New Project"** button
2. Select **"Deploy from GitHub repo"**
3. Find and select `strength_dashboard` repository
4. Click **"Deploy Now"**

### 3. Add PostgreSQL Database
1. In your Railway project dashboard, click **"+ Add Service"**
2. Select **"Database"** → **"PostgreSQL"**
3. Railway will automatically create a PostgreSQL instance
4. It will automatically add `DATABASE_URL` to environment variables

### 4. Configure Environment Variables
1. Click on your **Flask service** (the main app)
2. Go to the **"Variables"** tab
3. Add the following environment variables:

```
AZURE_OPENAI_KEY=your-azure-openai-key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT=gpt-5.2
FLASK_ENV=production
```

**Getting Azure OpenAI credentials:**
- Azure OpenAI Key: Your API key from Azure Portal
- Endpoint: From your Azure OpenAI resource details
- Deployment: The name of your deployed model (e.g., "gpt-5.2")

### 5. Database Initialization
- The `Procfile` in your repository includes a release phase
- Railway automatically runs: `python init_db.py` before deploying
- This creates all necessary database tables
- You only need to do this once on first deployment

### 6. Monitor Deployment
1. Go to the **"Deployments"** tab
2. You should see your deployment in progress
3. Look for the **green checkmark** indicating successful deployment
4. If there are errors, click on the deployment to see logs

### 7. Get Your Public URL
1. Click on your Flask service
2. Look for the **"Domains"** section
3. You'll see a URL like: `https://strength-dashboard-production-xxx.railway.app`
4. This is your live app URL!

### 8. Import Historical Data (Optional)
If you have existing Excel data:

1. Connect to Railway PostgreSQL locally:
   ```bash
   # Get DATABASE_URL from Railway dashboard
   export DATABASE_URL="postgresql://user:pass@host/db"
   python migrate_excel_to_db.py
   ```

2. Or run it on Railway:
   - Use Railway CLI to connect to your database
   - Run migration script

### 9. Update Frontend (if needed)
If your frontend makes API calls:
1. Update `app.js` API base URL to your Railway domain
2. Change from `http://localhost:5050` to `https://your-railway-url`
3. Redeploy by pushing to GitHub

## Database Schema (Auto-created)

When `init_db.py` runs, it creates these tables:

```sql
-- Training sessions
training_log (id, week, day, workout, date, muscle_group, exercise, 
              target_sets_reps, weight_kg, avg_reps_3_sets, notes,
              created_at, updated_at)

-- Body weight tracking
weight_log (id, date, weight, created_at, updated_at)

-- Daily steps
steps_log (id, date, steps, created_at, updated_at)
```

## Continuous Deployment

After the initial deployment:
1. Any push to the `main` branch automatically triggers a redeploy
2. Railway will:
   - Pull latest code from GitHub
   - Install dependencies from `requirements.txt`
   - Run `python init_db.py` (release phase) - idempotent
   - Start Flask app with Gunicorn

## API Endpoints

Your live API will be:
- Base URL: `https://your-railway-url/api/`
- Training: `/api/training`
- Weight: `/api/weight`
- Steps: `/api/steps`
- Insights: `/api/insights`

## Environment Variables Reference

| Variable | Purpose | Example |
|----------|---------|---------|
| `DATABASE_URL` | PostgreSQL connection | Auto-set by Railway |
| `AZURE_OPENAI_KEY` | AI API key | your-key-here |
| `AZURE_OPENAI_ENDPOINT` | AI endpoint | https://xxx.openai.azure.com/ |
| `AZURE_OPENAI_DEPLOYMENT` | Model deployment name | gpt-5.2 |
| `FLASK_ENV` | Environment | production |
| `PORT` | App port | 5000 (Railway sets this) |

## Troubleshooting

### Deployment Fails
1. Check deployment logs in Railway dashboard
2. Common issues:
   - Missing dependencies: verify `requirements.txt`
   - Python version: we use `python-3.13.1`
   - Procfile syntax: must have exactly two lines

### Database Connection Error
1. Verify PostgreSQL service is running in Railway
2. Check `DATABASE_URL` is set (Railway does this automatically)
3. Database tables not created? Railway runs `init_db.py` automatically

### 502 Bad Gateway
1. App crashed during deployment
2. Check logs in Railway dashboard
3. Usually means missing environment variables or dependency issue

### Slow Response Times
1. Cold start is normal for first request
2. Railway puts idle apps to sleep
3. Consider upgrading to paid plan for always-on instances

## Local Development vs Production

**Local (`http://localhost:5050`)**
- Uses environment variables from `.env`
- Can use SQLite or PostgreSQL
- Debug mode enabled
- Fast iteration

**Production (Railway)**
- Uses environment variables set in Railway dashboard
- Always uses PostgreSQL
- Debug mode disabled
- Auto-scaling, backup, monitoring

## Scale Your Database

As your data grows:
1. Railway PostgreSQL is scalable
2. Default storage increases with data
3. Monitor database size in Railway dashboard
4. Upgrade plan if needed for better performance

## Rollback to Previous Version

If something breaks:
1. Go to Railway Deployments tab
2. Find the previous good deployment
3. Click the rollback button
4. Instantly reverts to previous working version

## Next Steps

1. ✅ Deploy to Railway (this guide)
2. ✅ Verify database is working
3. Test API endpoints with cURL or Postman:
   ```bash
   curl https://your-railway-url/api/training
   ```
4. Add first data entry from the dashboard
5. Monitor logs in Railway dashboard

## Support

- Railway Docs: https://docs.railway.app
- Flask-SQLAlchemy: https://flask-sqlalchemy.palletsprojects.com
- PostgreSQL: https://www.postgresql.org/docs

Good luck with your deployment! 🚀
