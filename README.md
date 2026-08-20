# Strength Dashboard

A full-stack fitness tracking dashboard with AI-powered insights. Track your training sessions, body weight, and daily steps with real-time analytics and AI-generated coaching insights.

## Features

- 📊 **Training Log** - Log exercises with weight, reps, and muscle groups
- ⚖️ **Weight Tracking** - Monitor body weight trends over time
- 👟 **Steps Counter** - Track daily step count
- 🤖 **AI Insights** - Get personalized coaching insights via Azure OpenAI (GPT-4)
- 📈 **Real-time Dashboard** - See your progress instantly
- 💾 **PostgreSQL Database** - Persistent data storage for production deployments
- 🚀 **Production Ready** - Deployed to Railway with automatic database initialization

## Tech Stack

- **Frontend**: HTML, CSS, JavaScript (vanilla)
- **Backend**: Flask (Python)
- **Database**: PostgreSQL (production) / SQLite (local dev)
- **AI**: Azure OpenAI (GPT-4)
- **Deployment**: Railway

## Local Development

### Prerequisites

- Python 3.13+
- PostgreSQL (or SQLite for testing)
- Git
- Azure OpenAI API key

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/strength_dashboard.git
   cd strength_dashboard
   ```

2. **Create virtual environment**
   ```bash
   python3 -m venv myenv
   source myenv/bin/activate  # On Windows: myenv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

5. **Initialize database**
   ```bash
   python init_db.py
   ```

6. **Run the server**
   ```bash
   python server.py
   ```

   The app will be available at `http://localhost:5050`

## Deployment to Railway

### Prerequisites

- GitHub account with the repository pushed
- Railway account (free tier available)
- Azure OpenAI API key

### Steps

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Initial commit with database setup"
   git push origin main
   ```

2. **Create Railway Project**
   - Go to [railway.app](https://railway.app)
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Connect your GitHub account and select `strength_dashboard` repository

3. **Add PostgreSQL Database**
   - In Railway dashboard, click "Add Service" → "Database" → "PostgreSQL"
   - Railway will automatically set `DATABASE_URL` environment variable

4. **Set Environment Variables**
   - Click on your Flask service
   - Go to "Variables" tab
   - Add:
     ```
     AZURE_OPENAI_KEY=your-key-here
     AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
     AZURE_OPENAI_DEPLOYMENT=gpt-5.2
     FLASK_ENV=production
     PORT=5000
     ```

5. **Deploy**
   - Railway automatically deploys when you push to GitHub
   - The `Procfile` will:
     - Run `python init_db.py` to initialize the database (release phase)
     - Start the Flask app with Gunicorn (web process)
   - Wait for deployment to complete (green checkmark)

6. **Get Public URL**
   - Railway provides a public URL (e.g., `https://strength-dashboard-production.up.railway.app`)
   - Update your frontend to point to this URL

## API Endpoints

### Training Log
- `GET /api/training` - Get all training entries
- `POST /api/training` - Add new training entry
- `PUT /api/training/<id>` - Update training entry
- `DELETE /api/training/<id>` - Delete training entry

### Weight Log
- `GET /api/weight` - Get all weight entries
- `POST /api/weight` - Add weight entry

### Steps Log
- `GET /api/steps` - Get all steps entries
- `POST /api/steps` - Add steps entry

### AI Insights
- `GET /api/insights` - Get AI-generated insights based on your data

## Database Schema

### training_log
- id (PK)
- week, day, workout, date
- muscle_group, exercise
- target_sets_reps, weight_kg, avg_reps_3_sets
- notes
- created_at, updated_at

### weight_log
- id (PK)
- date (unique per date)
- weight
- created_at, updated_at

### steps_log
- id (PK)
- date (unique per date)
- steps
- created_at, updated_at

## AI Insights Engine

The app uses Azure OpenAI (GPT-4) to generate personalized coaching insights based on:
- Exercise progression trends
- Body weight changes
- Training volume analysis
- Muscle group distribution
- Session frequency

Falls back to rule-based insights if AI is unavailable.

## Troubleshooting

### Database Connection Issues
- Verify `DATABASE_URL` is set correctly
- For Railway: database URL is auto-generated, no manual setup needed
- Check PostgreSQL service is running (local dev)

### AI Insights Not Working
- Verify Azure OpenAI credentials in `.env`
- Check API key has proper permissions
- App will fall back to rule-based insights automatically

### Port Already in Use
- Change `PORT` in `.env` (default: 5050)

## Future Enhancements

- [ ] User authentication
- [ ] Mobile app
- [ ] Advanced analytics dashboard
- [ ] Export data to Excel/CSV
- [ ] Workout templates
- [ ] Social features

## License

MIT

## Support

For issues or questions, open a GitHub issue or contact the maintainer.
