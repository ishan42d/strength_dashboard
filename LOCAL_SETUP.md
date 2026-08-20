# Local Development Setup Guide

Complete guide for running Strength Dashboard locally with PostgreSQL.

## Prerequisites

- Python 3.13+
- PostgreSQL server running
- Git
- Azure OpenAI API credentials

## Installation Steps

### 1. Clone Repository
```bash
cd ~/Documents/Other\ Projects
git clone https://github.com/ishan42d/strength_dashboard.git
cd strength_dashboard
```

### 2. Create Virtual Environment
```bash
python3 -m venv myenv
source myenv/bin/activate  # On Windows: myenv\Scripts\activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Set Up PostgreSQL

#### Option A: Using Homebrew (macOS)
```bash
# Install PostgreSQL
brew install postgresql@15

# Start PostgreSQL
brew services start postgresql@15

# Create database
createdb strength_dashboard

# Create user (optional but recommended)
psql -c "CREATE USER dashboard_user WITH PASSWORD 'your_password';"
psql -c "ALTER USER dashboard_user CREATEDB;"
```

#### Option B: Using Docker
```bash
docker run --name strength-db \
  -e POSTGRES_DB=strength_dashboard \
  -e POSTGRES_PASSWORD=yourpassword \
  -p 5432:5432 \
  -d postgres:15
```

#### Option C: Pre-installed PostgreSQL
- Just ensure it's running on default port 5432

### 5. Configure Environment Variables
```bash
# Copy example config
cp .env.example .env

# Edit .env with your settings
nano .env
```

Set values:
```
DATABASE_URL=postgresql://username:password@localhost:5432/strength_dashboard
AZURE_OPENAI_KEY=your-key-here
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT=gpt-5.2
FLASK_ENV=development
PORT=5050
```

### 6. Initialize Database
```bash
python init_db.py
```

Expected output:
```
Creating database tables...
✓ Database initialized successfully!
```

### 7. Start Development Server
```bash
python server.py
```

Expected output:
```
WARNING: This is a development server. Do not use it in production.
Running on http://0.0.0.0:5050
```

### 8. Open in Browser
Visit: `http://localhost:5050`

## Database Commands

### Connect to Database
```bash
psql strength_dashboard
```

### View Tables
```sql
\dt                          -- List all tables
\d training_log              -- Describe training_log table
SELECT * FROM training_log;  -- View all entries
```

### Reset Database
```bash
# Completely clear all data
python
>>> from server import app, db
>>> with app.app_context():
...     db.drop_all()
...     db.create_all()
>>> exit()
```

### Export Data
```bash
# Backup database
pg_dump strength_dashboard > backup.sql

# Restore database
psql strength_dashboard < backup.sql
```

## Development Workflow

### Making Changes

1. **Backend changes (Python)**
   ```bash
   # Edit server.py, models.py, db_utils.py, etc.
   # Server auto-reloads (FLASK_ENV=development)
   ```

2. **Frontend changes (JavaScript)**
   ```bash
   # Edit static/app.js, static/index.html, etc.
   # Refresh browser to see changes
   ```

3. **Database schema changes**
   ```bash
   # Edit models.py with new columns/tables
   # Reset database:
   python init_db.py
   # Or use: python -c "from server import app, db; app.app_context().push(); db.drop_all(); db.create_all()"
   ```

### Testing API Endpoints

```bash
# Get all training entries
curl http://localhost:5050/api/training

# Add new training entry
curl -X POST http://localhost:5050/api/training \
  -H "Content-Type: application/json" \
  -d '{
    "Exercise": "Bench Press",
    "Date": "2024-08-20",
    "Weight (kg)": 100,
    "Avg Reps (3 sets)": 8,
    "Muscle Group": "Chest",
    "Target Sets/Reps": "3x8"
  }'

# Get weight logs
curl http://localhost:5050/api/weight

# Get insights
curl http://localhost:5050/api/insights
```

## Importing Data from Excel

If you have an existing `Strength_Training_Log.xlsx` file:

```bash
python migrate_excel_to_db.py
```

This will:
1. Read data from Excel sheets
2. Import to PostgreSQL database
3. Show import summary

Expected output:
```
Migrating data from Strength_Training_Log.xlsx...

📝 Importing Training Log...
   ✓ Imported 150 training entries

⚖️  Importing Weight Log...
   ✓ Imported 30 weight entries

👟 Importing Steps Log...
   ✓ Imported 45 steps entries

✓ Migration completed successfully!
```

## Common Issues

### "psycopg2.OperationalError: could not connect to server"
- PostgreSQL not running
- Wrong DATABASE_URL
- Check with: `psql strength_dashboard`

### "ModuleNotFoundError: No module named 'flask'"
- Virtual environment not activated
- Dependencies not installed
- Run: `pip install -r requirements.txt`

### "No such table: training_log"
- Database not initialized
- Run: `python init_db.py`

### Port 5050 Already in Use
- Change PORT in .env
- Or kill process: `lsof -ti:5050 | xargs kill -9`

### Azure OpenAI API Errors
- Check credentials in .env
- App will fall back to rule-based insights
- Check Azure Portal for API status

## Debugging

### Enable Verbose Logging
```python
# In server.py, add:
import logging
logging.basicConfig(level=logging.DEBUG)
```

### Database Debugging
```bash
# Check database size
psql strength_dashboard -c "SELECT pg_size_pretty(pg_database_size(current_database()));"

# List all records
psql strength_dashboard -c "SELECT COUNT(*) FROM training_log;"
```

### API Debugging
```bash
# Use verbose curl
curl -v http://localhost:5050/api/training

# Or use Python requests
python
>>> import requests
>>> r = requests.get('http://localhost:5050/api/training')
>>> r.status_code
>>> r.json()
```

## Switching Between Environments

### Local Development
```bash
export DATABASE_URL="postgresql://localhost/strength_dashboard"
export FLASK_ENV=development
python server.py
```

### Production (Railway)
```bash
# Set in Railway dashboard, not local .env
# Database URL auto-generated
# FLASK_ENV=production
```

## Deactivate Virtual Environment
```bash
deactivate
```

## Stop PostgreSQL
```bash
# Homebrew
brew services stop postgresql@15

# Docker
docker stop strength-db
```

## Next Steps

1. ✅ Run locally and test features
2. ✅ Import data from Excel (if applicable)
3. ✅ Make sure AI insights work
4. ✅ Push any local changes: `git push origin main`
5. ✅ Deploy to Railway (see RAILWAY_DEPLOYMENT.md)

## Resources

- Flask: https://flask.palletsprojects.com
- SQLAlchemy: https://www.sqlalchemy.org
- PostgreSQL: https://www.postgresql.org/docs
- Azure OpenAI: https://learn.microsoft.com/azure/cognitive-services/openai

Happy coding! 🚀
