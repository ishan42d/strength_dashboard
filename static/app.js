/* ─── Strength Lab Dashboard ─── */

const COLORS = {
  accent: '#fc4c02',
  green: '#22c55e',
  blue: '#3b82f6',
  amber: '#f59e0b',
  red: '#ef4444',
  purple: '#a855f7',
  text: '#f5f5f5',
  muted: '#7a7a7a',
  faint: '#525252',
  grid: '#1c1c1c',
  cardBg: '#131313',
};

const MUSCLE_COLORS = {
  Chest: COLORS.accent,
  Shoulders: COLORS.blue,
  Triceps: COLORS.amber,
  Back: COLORS.green,
  Biceps: COLORS.purple,
  Core: '#06b6d4',
  Legs: '#84cc16',
  'Rear Shoulders': '#ec4899',
};

// Exercises by muscle group (loaded from Excel file)
let LOADED_EXERCISES = {};

Chart.defaults.color = COLORS.muted;
Chart.defaults.borderColor = COLORS.grid;
Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.font.size = 11;
Chart.defaults.plugins.legend.labels.boxWidth = 8;
Chart.defaults.plugins.legend.labels.boxHeight = 8;
Chart.defaults.plugins.legend.labels.padding = 14;
Chart.defaults.plugins.legend.labels.usePointStyle = true;
Chart.defaults.plugins.legend.labels.pointStyle = 'circle';
Chart.defaults.plugins.tooltip.backgroundColor = '#0a0a0a';
Chart.defaults.plugins.tooltip.borderColor = '#262626';
Chart.defaults.plugins.tooltip.borderWidth = 1;
Chart.defaults.plugins.tooltip.padding = 10;
Chart.defaults.plugins.tooltip.titleColor = '#f5f5f5';
Chart.defaults.plugins.tooltip.bodyColor = '#b0b0b0';
Chart.defaults.plugins.tooltip.cornerRadius = 8;
Chart.defaults.plugins.tooltip.displayColors = true;
Chart.defaults.plugins.tooltip.boxPadding = 4;

let trainingData = [];
let weightData = [];
let stepsData = [];
let statusFilter = 'all';
let insightsLoaded = false;
const charts = {};

/* ─── INIT ─── */
document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  setupStatusFilter();
  setupForms();
  loadExercises();
  loadData();
});

/* ─── TABS ─── */
function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
      if (btn.dataset.tab === 'insights' && !insightsLoaded) loadInsights();
    });
  });
}

/* ─── STATUS FILTER ─── */
function setupStatusFilter() {
  // Filter removed - only showing completed entries now
}

/* ─── LOAD EXERCISES ─── */
async function loadExercises() {
  try {
    const res = await fetch('/api/exercises');
    const data = await res.json();
    console.log('[exercises] API response:', data);
    if (data && typeof data === 'object' && !data.error) {
      LOADED_EXERCISES = data;
      console.log('[exercises] Loaded:', Object.keys(LOADED_EXERCISES));
    } else {
      console.warn('[exercises] API returned error or invalid data:', data);
    }
  } catch (e) {
    console.error('[exercises] Failed to load:', e);
  }
}

/* ─────────────────────────────────────
   ANALYTICS DASHBOARD
   ───────────────────────────────────── */

async function loadAIInsights() {
  const container = document.getElementById('ai-insights-container');
  if (!container) return;
  
  try {
    const res = await fetch('/api/insights');
    const insights = await res.json();
    
    if (!insights || insights.length === 0) {
      container.innerHTML = '<p class="muted">Log more sessions to get personalized insights...</p>';
      return;
    }
    
    const top3 = insights.slice(0, 3);
    container.innerHTML = top3.map(insight => {
      return `
        <div class="insight-card">
          <div>
            <h4>${insight.title || 'Insight'}</h4>
            <p>${insight.body || insight.text || ''}</p>
          </div>
        </div>
      `;
    }).join('');
  } catch (e) {
    console.error('Failed to load insights:', e);
  }
}

function computeAnalytics(trainingData, weightData, stepsData) {
  const analytics = {};
  
  // Ensure data is arrays
  if (!Array.isArray(trainingData)) trainingData = [];
  if (!Array.isArray(weightData)) weightData = [];
  if (!Array.isArray(stepsData)) stepsData = [];
  
  // Training volume & frequency
  const allSessions = trainingData.filter(r => r && r.Date).sort((a, b) => new Date(b.Date) - new Date(a.Date));
  
  // Only compute weeks if we have data
  let weeksOfData = 1;
  if (allSessions.length > 1) {
    weeksOfData = Math.max(1, Math.ceil((new Date(allSessions[0].Date) - new Date(allSessions[allSessions.length - 1].Date)) / (7 * 24 * 60 * 60 * 1000)));
  }
  
  const thisWeekStart = new Date();
  thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay());
  const thisWeekSessions = allSessions.filter(r => new Date(r.Date) >= thisWeekStart).length;
  
  analytics.thisWeekVolume = thisWeekSessions;
  analytics.avgWorkoutsPerWeek = (allSessions.length / weeksOfData).toFixed(1);
  analytics.totalSessions = allSessions.length;
  
  // Muscle group breakdown
  const muscleGroups = {};
  allSessions.forEach(r => {
    const muscle = r['Muscle Group'] || 'Unknown';
    muscleGroups[muscle] = (muscleGroups[muscle] || 0) + 1;
  });
  analytics.muscleGroups = muscleGroups;
  analytics.totalMuscleExercises = Object.values(muscleGroups).reduce((a, b) => a + b, 0);
  
  // Exercise progression (PRs)
  const exerciseProgress = {};
  allSessions.forEach(r => {
    const ex = r['Exercise'];
    if (!ex) return;
    if (!exerciseProgress[ex]) {
      exerciseProgress[ex] = [];
    }
    exerciseProgress[ex].push({
      date: new Date(r['Date']),
      weight: parseFloat(r['Weight (kg)']) || 0,
      reps: parseFloat(r['Avg Reps (3 sets)']) || 0
    });
  });
  
  // Calculate PR changes
  const prChanges = Object.entries(exerciseProgress).map(([exercise, sessions]) => {
    if (sessions.length < 2) return null;
    sessions.sort((a, b) => a.date - b.date);
    const firstWeight = sessions[0].weight;
    const lastWeight = sessions[sessions.length - 1].weight;
    const weightChange = lastWeight - firstWeight;
    return { exercise, firstWeight, lastWeight, weightChange, lastReps: sessions[sessions.length - 1].reps };
  }).filter(x => x).sort((a, b) => b.weightChange - a.weightChange);
  
  analytics.topExercises = prChanges.slice(0, 3);
  
  // Weight goal
  const weightGoal = parseFloat(localStorage.getItem('WEIGHT_GOAL')) || null;
  if (weightGoal && weightData.length > 0) {
    const startingWeight = parseFloat(weightData[0].Weight);
    const currentWeight = parseFloat(weightData[weightData.length - 1].Weight);
    const remaining = weightGoal - currentWeight;
    const progress = ((currentWeight - startingWeight) / (weightGoal - startingWeight) * 100);
    analytics.weightGoal = {
      starting: startingWeight,
      target: weightGoal,
      current: currentWeight,
      remaining,
      progress: Math.max(0, Math.min(100, progress)),
      direction: remaining < 0 ? 'lose' : 'gain',
      remainingAbsolute: Math.abs(remaining)
    };
  }
  
  // Steps analytics - 7-day rolling average
  if (stepsData.length > 0) {
    const last7Days = stepsData.slice(-7).map(r => parseFloat(r.Steps) || 0);
    const avgSteps = Math.round(last7Days.reduce((a, b) => a + b, 0) / last7Days.length);
    analytics.stepsAverage = avgSteps;
  }
  
  return analytics;
}

function renderAnalyticsDashboard(analytics) {
  // Week volume
  const weekVolEl = document.getElementById('stat-week-volume');
  const weekTrendEl = document.getElementById('stat-week-trend');
  if (weekVolEl) {
    weekVolEl.textContent = analytics.thisWeekVolume || '–';
    weekTrendEl.textContent = `${analytics.avgWorkoutsPerWeek}/wk avg`;
  }
  
  // Workout average
  const workoutAvgEl = document.getElementById('stat-workout-avg');
  const consistencyEl = document.getElementById('stat-consistency');
  if (workoutAvgEl) {
    workoutAvgEl.textContent = analytics.avgWorkoutsPerWeek || '–';
    consistencyEl.textContent = `${analytics.thisWeekVolume} this week`;
  }
  
  // Weight goal KPI
  const goalEl = document.getElementById('stat-goal');
  const goalProgressEl = document.getElementById('stat-goal-progress');
  if (goalEl && analytics.weightGoal) {
    const goal = analytics.weightGoal;
    goalEl.textContent = goal.target.toFixed(1) + ' kg';
    goalProgressEl.textContent = `${goal.remainingAbsolute.toFixed(1)} kg to ${goal.direction}`;
    // Positive styling: when goal has been reached
    const isPositive = goal.direction === 'lose' ? goal.current <= goal.target : goal.current >= goal.target;
    goalProgressEl.className = 'stat-delta ' + (isPositive ? 'positive' : '');
  }
  
  // Muscle group breakdown
  const muscleEl = document.getElementById('muscle-breakdown');
  if (muscleEl && analytics.muscleGroups) {
    const total = analytics.totalMuscleExercises;
    const bars = Object.entries(analytics.muscleGroups)
      .sort((a, b) => b[1] - a[1])
      .map(([muscle, count]) => {
        const pct = ((count / total) * 100).toFixed(0);
        return `
          <div class="muscle-item">
            <div class="muscle-label">
              <span class="muscle-label-name">${muscle}</span>
              <span class="muscle-label-value">${pct}%</span>
            </div>
            <div class="muscle-bar-bg">
              <div class="muscle-bar-fill" style="width: ${pct}%"></div>
            </div>
          </div>
        `;
      }).join('');
    muscleEl.innerHTML = bars || '<p class="muted">No muscle data yet</p>';
  }
  
  // Top exercises (PRs)
  const topExEl = document.getElementById('top-exercises');
  if (topExEl && analytics.topExercises && analytics.topExercises.length > 0) {
    const cards = analytics.topExercises.map(ex => `
      <div class="exercise-card">
        <div class="exercise-name">${ex.exercise}</div>
        <div class="exercise-stat">
          <span>Current: <strong>${ex.lastWeight.toFixed(1)}kg × ${ex.lastReps.toFixed(0)}</strong></span>
          <span class="exercise-trend ${ex.weightChange > 0 ? '' : 'negative'}">
            ${ex.weightChange > 0 ? '↑' : '↓'} ${Math.abs(ex.weightChange).toFixed(1)}kg
          </span>
        </div>
        <div style="font-size: 0.75rem; color: var(--text-4); margin-top: 4px">
          From ${ex.firstWeight.toFixed(1)}kg
        </div>
      </div>
    `).join('');
    topExEl.innerHTML = cards;
  } else {
    topExEl.innerHTML = '<p class="muted">Log exercises to track progression</p>';
  }
  
  // Weight goal
  if (analytics.weightGoal) {
    const goal = analytics.weightGoal;
    document.getElementById('goal-starting').textContent = goal.starting.toFixed(1) + ' kg';
    document.getElementById('goal-current').textContent = goal.current.toFixed(1) + ' kg';
    document.getElementById('goal-target').textContent = goal.target.toFixed(1) + ' kg';
    
    // Goal reached when current weight has reached the target
    const goalReached = goal.direction === 'lose' ? goal.current <= goal.target : goal.current >= goal.target;
    document.getElementById('goal-status').textContent = 
      goalReached
        ? '✅ GOAL REACHED! Awesome work!'
        : `${goal.remainingAbsolute.toFixed(1)} kg to ${goal.direction}`;
  } else {
    document.getElementById('goal-status').textContent = 'Set a weight goal to track your progress';
  }
  
  // Steps - show 7-day average only
  if (analytics.stepsAverage) {
    const stepsEl = document.getElementById('stat-steps-avg-value');
    const statusEl = document.getElementById('stat-steps-status');
    stepsEl.textContent = analytics.stepsAverage.toLocaleString();
    statusEl.textContent = 'Last 7 days';
    statusEl.className = 'stat-delta';
  }
  
  // BMI Calculation
  const height = parseFloat(localStorage.getItem('USER_HEIGHT'));
  const currentWeight = analytics.weightGoal ? analytics.weightGoal.current : (weightData.length > 0 ? parseFloat(weightData[weightData.length - 1].Weight) : null);
  
  if (currentWeight) {
    localStorage.setItem('CURRENT_WEIGHT', currentWeight);
  }
  
  if (height && currentWeight) {
    const bmi = currentWeight / ((height / 100) ** 2);
    const bmiEl = document.getElementById('stat-bmi');
    const bmiStatusEl = document.getElementById('stat-bmi-status');
    
    if (bmiEl) {
      bmiEl.textContent = bmi.toFixed(1);
      
      let bmiCategory = '';
      let bmiClass = '';
      if (bmi < 18.5) {
        bmiCategory = 'Underweight';
        bmiClass = 'negative';
      } else if (bmi < 25) {
        bmiCategory = 'Normal';
        bmiClass = 'positive';
      } else if (bmi < 30) {
        bmiCategory = 'Overweight';
        bmiClass = 'negative';
      } else {
        bmiCategory = 'Obese';
        bmiClass = 'negative';
      }
      
      bmiStatusEl.textContent = bmiCategory;
      bmiStatusEl.className = 'stat-delta ' + bmiClass;
    }
  }
  
  // Waist-to-Height Ratio Calculation
  const waistInches = parseFloat(localStorage.getItem('USER_WAIST'));
  if (height && waistInches) {
    const waistCm = waistInches * 2.54; // Convert inches to cm
    const whr = waistCm / height; // height is in cm
    const whrEl = document.getElementById('stat-whr');
    const whrStatusEl = document.getElementById('stat-whr-status');
    
    if (whrEl) {
      whrEl.textContent = whr.toFixed(2);
      
      let whrCategory = '';
      let whrClass = '';
      if (whr < 0.4) {
        whrCategory = 'Excellent';
        whrClass = 'positive';
      } else if (whr < 0.5) {
        whrCategory = 'Good';
        whrClass = 'positive';
      } else if (whr < 0.6) {
        whrCategory = 'At Risk';
        whrClass = 'negative';
      } else {
        whrCategory = 'High Risk';
        whrClass = 'negative';
      }
      
      whrStatusEl.textContent = whrCategory;
      whrStatusEl.className = 'stat-delta ' + whrClass;
    }
  }
}

/* ─── LOAD DATA ─── */
async function loadData() {
  try {
    const [tRes, wRes, sRes] = await Promise.all([
      fetch('/api/training'),
      fetch('/api/weight'),
      fetch('/api/steps')
    ]).catch(e => {
      console.error('Fetch error:', e);
      return [{status: 500}, {status: 500}, {status: 500}];
    });
    
    // Parse training data
    if (tRes && tRes.ok) {
      try {
        trainingData = await tRes.json();
        if (!Array.isArray(trainingData)) trainingData = [];
      } catch (e) {
        console.error('Error parsing training data:', e);
        trainingData = [];
      }
    } else {
      console.warn('Training API error:', tRes?.status);
      trainingData = [];
    }
    
    // Parse weight data
    if (wRes && wRes.ok) {
      try {
        weightData = await wRes.json();
        if (!Array.isArray(weightData)) weightData = [];
      } catch (e) {
        console.error('Error parsing weight data:', e);
        weightData = [];
      }
    } else {
      console.warn('Weight API error:', wRes?.status);
      weightData = [];
    }
    
    // Parse steps data
    if (sRes && sRes.ok) {
      try {
        stepsData = await sRes.json();
        if (!Array.isArray(stepsData)) stepsData = [];
      } catch (e) {
        console.error('Error parsing steps data:', e);
        stepsData = [];
      }
    } else {
      console.warn('Steps API error:', sRes?.status);
      stepsData = [];
    }
    
    renderOverview();
    renderStrengthTable();
    renderWeightTab();
  } catch (error) {
    console.error('Error in loadData:', error);
    // Initialize empty arrays to prevent crashes
    trainingData = [];
    weightData = [];
    stepsData = [];
    try {
      renderOverview();
    } catch (e) {
      console.error('Error rendering overview with empty data:', e);
    }
  }
}

/* ─── OVERVIEW ─── */
function renderOverview() {
  // Load analytics dashboard (no AI insights - those go to insights tab)
  const analytics = computeAnalytics(trainingData, weightData, stepsData);
  renderAnalyticsDashboard(analytics);

  const completed = Array.isArray(trainingData) ? trainingData.filter(r => r.Date) : [];
  const uniqueDates = new Set(completed.map(r => r.Date));
  const exercises = [...new Set(completed.map(r => r.Exercise))];

  document.getElementById('stat-sessions').textContent = uniqueDates.size;

  if (weightData.length) {
    const latest = weightData[weightData.length - 1];
    document.getElementById('stat-weight').textContent = parseFloat(latest.Weight).toFixed(1) + ' kg';
    const weightDate = document.getElementById('stat-weight-delta');
    weightDate.textContent = `as of ${formatDate(latest.Date)}`;
    weightDate.className = 'stat-delta';
  } else {
    document.getElementById('stat-weight').textContent = '–';
    const weightDate = document.getElementById('stat-weight-delta');
    weightDate.textContent = 'Log weight in Body tab';
    weightDate.className = 'stat-delta muted';
  }

  renderVolumeChart(completed);
  renderWeightChart();
  renderWeightGoalChart();
  renderMuscleChart(completed);
  renderExercisePicker(completed, 'exercise-picker', 'chart-exercise');
  renderStepsChart();
  renderSchedule();
}

function renderVolumeChart(completed) {
  const byDate = {};
  completed.forEach(r => {
    if (!r.Date) return;
    byDate[r.Date] = (byDate[r.Date] || 0) + (r.Volume || 0);
  });
  const dates = Object.keys(byDate).sort();
  destroyChart('volume');
  charts.volume = new Chart(document.getElementById('chart-volume'), {
    type: 'bar',
    data: {
      labels: dates.map(d => formatDate(d)),
      datasets: [{
        label: 'Volume',
        data: dates.map(d => byDate[d]),
        backgroundColor: COLORS.accent + 'cc',
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: COLORS.grid } }, x: { grid: { display: false } } } }
  });
}

function renderWeightChart() {
  if (!weightData.length) return;
  destroyChart('weight');
  charts.weight = new Chart(document.getElementById('chart-weight'), {
    type: 'line',
    data: {
      labels: weightData.map(r => formatDate(r.Date)),
      datasets: [{
        label: 'Weight (kg)',
        data: weightData.map(r => r.Weight),
        borderColor: COLORS.accent,
        backgroundColor: COLORS.accent + '20',
        fill: true,
        tension: 0.3,
        pointRadius: 5,
        pointBackgroundColor: COLORS.accent,
        pointBorderColor: '#111',
        pointBorderWidth: 2,
      }]
    },
    options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { grid: { color: COLORS.grid } }, x: { grid: { display: false } } } }
  });
}

function renderMuscleChart(completed) {
  const byMuscle = {};
  completed.forEach(r => { byMuscle[r['Muscle Group']] = (byMuscle[r['Muscle Group']] || 0) + (r.Volume || 0); });
  const labels = Object.keys(byMuscle);
  destroyChart('muscle');
  charts.muscle = new Chart(document.getElementById('chart-muscle'), {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: labels.map(l => byMuscle[l]),
        backgroundColor: labels.map(l => MUSCLE_COLORS[l] || COLORS.muted),
        borderWidth: 0,
        spacing: 2,
      }]
    },
    options: { responsive: true, cutout: '65%', plugins: { legend: { position: 'right' } } }
  });
}

function renderExercisePicker(completed, selectId, canvasId) {
  const exercises = [...new Set(completed.map(r => r.Exercise))].sort();
  const sel = document.getElementById(selectId);
  sel.innerHTML = exercises.map(e => `<option value="${e}">${e}</option>`).join('');
  const render = () => renderExerciseProgress(completed, sel.value, canvasId);
  sel.onchange = render;
  if (exercises.length) render();
}

function renderExerciseProgress(data, exercise, canvasId) {
  const rows = data.filter(r => r.Exercise === exercise && r.Date).sort((a, b) => a.Date.localeCompare(b.Date));
  const key = canvasId;
  destroyChart(key);
  charts[key] = new Chart(document.getElementById(canvasId), {
    type: 'line',
    data: {
      labels: rows.map(r => formatDate(r.Date)),
      datasets: [{
        label: 'Weight (kg)',
        data: rows.map(r => r['Weight (kg)']),
        borderColor: COLORS.accent,
        backgroundColor: COLORS.accent + '20',
        fill: true,
        tension: 0.3,
        pointRadius: 5,
        pointBackgroundColor: COLORS.accent,
        pointBorderColor: '#111',
        pointBorderWidth: 2,
      }]
    },
    options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { grid: { color: COLORS.grid } }, x: { grid: { display: false } } } }
  });
}

function renderStepsChart() {
  destroyChart('steps');
  if (!stepsData.length) return;
  const sorted = [...stepsData].sort((a, b) => a.Date.localeCompare(b.Date));
  
  // Calculate average for the chart
  const avgSteps = Math.round(sorted.map(r => parseFloat(r.Steps) || 0).reduce((a, b) => a + b, 0) / sorted.length);
  
  charts.steps = new Chart(document.getElementById('chart-steps'), {
    type: 'bar',
    data: {
      labels: sorted.map(r => formatDate(r.Date)),
      datasets: [{
        label: 'Steps',
        data: sorted.map(r => r.Steps),
        backgroundColor: sorted.map(r => r.Steps >= 10000 ? COLORS.green + 'cc' : COLORS.blue + 'cc'),
        borderRadius: 6,
        borderSkipped: false,
        type: 'bar',
        order: 2
      }, {
        label: 'Average',
        data: sorted.map(() => avgSteps),
        borderColor: COLORS.orange,
        borderWidth: 2,
        borderDash: [5, 5],
        fill: false,
        type: 'line',
        order: 1,
        pointRadius: 0,
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: true, labels: { usePointStyle: true } },
        tooltip: { callbacks: { label: ctx => ctx.parsed.y.toLocaleString() + (ctx.dataset.label === 'Average' ? ' avg' : ' steps') } }
      },
      scales: {
        y: { beginAtZero: true, grid: { color: COLORS.grid }, ticks: { callback: v => v >= 1000 ? (v/1000) + 'k' : v } },
        x: { grid: { display: false } }
      }
    }
  });
}

/* ─── TRAINING LOG TABLE ─── */
const VISIBLE_COLS = ['Date', 'Day', 'Workout', 'Muscle Group', 'Exercise', 'Weight (kg)', 'Avg Reps (3 sets)', 'Volume', 'Notes'];
const DROPDOWN_OPTS = {
  Workout: ['Push Day', 'Pull Day', 'Arms & Core', 'Legs & Rear Delts'],
  Day: ['Day 1', 'Day 2', 'Day 3', 'Day 4'],
  'Muscle Group': ['Chest', 'Shoulders', 'Triceps', 'Back', 'Biceps', 'Core', 'Legs', 'Rear Shoulders'],
};

function workoutBadge(val) {
  if (!val) return '';
  const cls = val.includes('Push') ? 'badge-push' : val.includes('Pull') ? 'badge-pull' : val.includes('Arms') ? 'badge-arms' : 'badge-legs';
  return `<span class="badge ${cls}">${val}</span>`;
}


function renderStrengthTable() {
  const thead = document.querySelector('#strength-table thead');
  const tbody = document.querySelector('#strength-table tbody');
  thead.innerHTML = '<tr>' + VISIBLE_COLS.map(c => `<th>${c}</th>`).join('') + '<th></th></tr>';

  const rows = Array.isArray(trainingData) ? trainingData.filter(r => r.Date).sort((a, b) => new Date(b.Date) - new Date(a.Date)) : [];

  tbody.innerHTML = rows.map(r => {
    const cells = VISIBLE_COLS.map(col => {
      const val = r[col];
      const editable = col !== 'Volume' ? 'editable' : '';
      if (col === 'Workout') return `<td class="${editable}" data-col="${col}" data-idx="${r._idx}">${workoutBadge(val)}</td>`;
      if (col === 'Date' && val) return `<td class="${editable}" data-col="${col}" data-idx="${r._idx}">${formatDate(val)}</td>`;
      const display = val != null && val !== '' ? val : '';
      return `<td class="${editable}" data-col="${col}" data-idx="${r._idx}">${display}</td>`;
    }).join('');
    return `<tr>${cells}<td><button class="row-action-btn" onclick="confirmDelete(this, ${r._idx})">&#10005;</button></td></tr>`;
  }).join('');

  tbody.querySelectorAll('td.editable').forEach(td => {
    td.addEventListener('click', () => startEdit(td));
  });
}

function startEdit(td) {
  if (td.classList.contains('editing')) return;
  const col = td.dataset.col;
  const idx = parseInt(td.dataset.idx);
  const row = Array.isArray(trainingData) ? trainingData.find(r => r._idx === idx) : null;
  const oldVal = row[col] != null ? row[col] : '';

  td.classList.add('editing');

  if (DROPDOWN_OPTS[col]) {
    const sel = document.createElement('select');
    sel.innerHTML = '<option value="">--</option>' + DROPDOWN_OPTS[col].map(o => `<option value="${o}" ${o === oldVal ? 'selected' : ''}>${o}</option>`).join('');
    td.innerHTML = '';
    td.appendChild(sel);
    sel.focus();
    const finish = () => saveEdit(td, idx, col, sel.value, oldVal);
    sel.addEventListener('change', finish);
    sel.addEventListener('blur', finish);
    return;
  }

  if (col === 'Exercise') {
    const exercises = [...new Set((Array.isArray(trainingData) ? trainingData : []).map(r => r.Exercise).filter(Boolean))].sort();
    const sel = document.createElement('select');
    sel.innerHTML = '<option value="">--</option>' + exercises.map(e => `<option value="${e}" ${e === oldVal ? 'selected' : ''}>${e}</option>`).join('');
    td.innerHTML = '';
    td.appendChild(sel);
    sel.focus();
    const finish = () => saveEdit(td, idx, col, sel.value, oldVal);
    sel.addEventListener('change', finish);
    sel.addEventListener('blur', finish);
    return;
  }

  const input = document.createElement('input');
  if (col === 'Date') { input.type = 'date'; input.value = oldVal || ''; }
  else if (['Weight (kg)', 'Avg Reps (3 sets)'].includes(col)) { input.type = 'number'; input.step = col.includes('Weight') ? '0.5' : '1'; input.value = oldVal; }
  else { input.type = 'text'; input.value = oldVal; }

  td.innerHTML = '';
  td.appendChild(input);
  input.focus();
  input.select();

  const finish = () => saveEdit(td, idx, col, input.value, oldVal);
  input.addEventListener('blur', finish);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') finish(); if (e.key === 'Escape') { td.classList.remove('editing'); td.textContent = oldVal; } });
}

async function saveEdit(td, idx, col, newVal, oldVal) {
  td.classList.remove('editing');
  if (newVal === oldVal || (newVal === '' && (oldVal == null || oldVal === ''))) {
    renderStrengthTable();
    return;
  }
  td.textContent = 'Saving...';
  td.style.color = COLORS.muted;
  try {
    const res = await fetch(`/api/training/${idx}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [col]: newVal || null })
    });
    if (!res.ok) throw new Error('Save failed');
    await loadData();
  } catch (e) {
    td.textContent = oldVal;
    td.style.color = '';
  }
}

function confirmDelete(btn, idx) {
  const td = btn.parentElement;
  td.innerHTML = `<div class="confirm-delete"><span>Delete?</span><button class="btn-yes" onclick="doDelete(${idx})">Yes</button><button class="btn-no" onclick="renderStrengthTable()">No</button></div>`;
}

async function doDelete(idx) {
  await fetch(`/api/training/${idx}`, { method: 'DELETE' });
  await loadData();
}

/* ─── WEIGHT TAB ─── */
function renderWeightTab() {
  const thead = document.querySelector('#weight-table thead');
  const tbody = document.querySelector('#weight-table tbody');
  thead.innerHTML = '<tr><th>Date</th><th>Weight (kg)</th></tr>';
  tbody.innerHTML = weightData.map(r => `<tr><td>${formatDate(r.Date)}</td><td>${parseFloat(r.Weight).toFixed(1)}</td></tr>`).join('');

  destroyChart('weightFull');
  if (!weightData.length) return;
  charts.weightFull = new Chart(document.getElementById('chart-weight-full'), {
    type: 'line',
    data: {
      labels: weightData.map(r => formatDate(r.Date)),
      datasets: [{
        label: 'Weight (kg)',
        data: weightData.map(r => r.Weight),
        borderColor: COLORS.accent,
        backgroundColor: COLORS.accent + '20',
        fill: true,
        tension: 0.3,
        pointRadius: 6,
        pointBackgroundColor: COLORS.accent,
        pointBorderColor: '#111',
        pointBorderWidth: 2,
      }]
    },
    options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { grid: { color: COLORS.grid } }, x: { grid: { display: false } } } }
  });
}

function renderWeightGoalChart() {
  const goalValue = parseFloat(localStorage.getItem('WEIGHT_GOAL'));
  const canvasEl = document.getElementById('chart-weight-goal');
  
  destroyChart('weightGoal');
  if (!weightData.length || !goalValue) {
    if (canvasEl) canvasEl.style.display = 'none';
    return;
  }
  
  if (canvasEl) canvasEl.style.display = 'block';
  
  const startWeight = parseFloat(weightData[0].Weight);
  const currentWeight = parseFloat(weightData[weightData.length - 1].Weight);
  
  // Create dataset for weight progression
  const labels = weightData.map(r => formatDate(r.Date));
  const weights = weightData.map(r => parseFloat(r.Weight));
  
  // Create target line (flat line at goal value)
  const targetLine = Array(weights.length).fill(goalValue);
  
  charts.weightGoal = new Chart(canvasEl, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Your Weight',
          data: weights,
          borderColor: COLORS.accent,
          backgroundColor: COLORS.accent + '15',
          fill: true,
          tension: 0.3,
          pointRadius: 5,
          pointBackgroundColor: COLORS.accent,
          pointBorderColor: '#111',
          pointBorderWidth: 2,
          borderWidth: 2.5
        },
        {
          label: 'Goal',
          data: targetLine,
          borderColor: COLORS.green,
          borderDash: [5, 5],
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
          tension: 0
        },
        {
          label: 'Starting Weight',
          data: Array(weights.length).fill(startWeight),
          borderColor: COLORS.muted,
          borderDash: [3, 3],
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
          tension: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { 
          display: true,
          position: 'top',
          labels: { boxWidth: 12, padding: 12, font: { size: 11 } }
        },
        tooltip: { backgroundColor: '#0a0a0a', borderColor: '#262626', borderWidth: 1, titleColor: '#f5f5f5', bodyColor: '#b0b0b0' }
      },
      scales: {
        y: { 
          grid: { color: COLORS.grid },
          title: { display: true, text: 'Weight (kg)' }
        },
        x: { 
          grid: { display: false }
        }
      }
    }
  });
}

/* ─── FORMS ─── */
function setupForms() {
  // Forms are now modal-based, set up in DOMContentLoaded below
}

function populateExerciseFormPicker() {
  const exercises = [...new Set((Array.isArray(trainingData) ? trainingData : []).map(r => r.Exercise).filter(Boolean))].sort();
  const sel = document.getElementById('exercise-form-picker');
  const current = sel.value;
  sel.innerHTML = '<option value="">Select exercise...</option>' + exercises.map(e => `<option value="${e}">${e}</option>`).join('');
  if (current) sel.value = current;
}

/* ─── SCHEDULE ─── */
// Static workout plan - your structured weekly split
const WORKOUT_PLAN = {
  'Day 1': {
    name: 'Push Day',
    color: '--accent',
    muscleGroups: ['Chest', 'Shoulders', 'Triceps'],
    exercises: [
      { name: 'Chest Press Machine', sets: 3, reps: '8-12' },
      { name: 'Smith Machine Incline Press', sets: 3, reps: '8-12', note: 'Adjust bench to 30°' },
      { name: 'Pec Deck / Seated Machine Fly', sets: 3, reps: '10-12' },
      { name: 'Lateral Raises (Dumbbell or Cable)', sets: 3, reps: '12-15' },
      { name: 'Cable Triceps Rope Pushdown', sets: 3, reps: '10-12' }
    ]
  },
  'Day 2': {
    name: 'Pull Day',
    color: '--blue',
    muscleGroups: ['Back', 'Biceps'],
    exercises: [
      { name: 'Lat Pulldown Machine', sets: 3, reps: '8-12' },
      { name: 'Seated Cable Row', sets: 3, reps: '8-12' },
      { name: 'Chest-Supported Machine Row', sets: 3, reps: '8-12' },
      { name: 'Dumbbell or Rod Biceps Curl', sets: 3, reps: '8-12' }
    ]
  },
  'Day 3': {
    name: 'Arms & Core',
    color: '--amber',
    muscleGroups: ['Biceps', 'Triceps', 'Core'],
    exercises: [
      { name: 'Machine Preacher Curl', sets: 3, reps: '10-12' },
      { name: 'Cable Biceps Hammer Curl', sets: 3, reps: '10-12', note: 'Rope attachment' },
      { name: 'Seated Dip Machine', sets: 3, reps: '10-12' },
      { name: 'Overhead Cable Triceps Extension', sets: 3, reps: '10-12' },
      { name: 'Machine Ab Crunch or Cable Rope Crunch', sets: 3, reps: '12-15' }
    ]
  },
  'Day 4': {
    name: 'Legs + Rear Shoulders',
    color: '--green',
    muscleGroups: ['Legs', 'Rear Shoulders'],
    exercises: [
      { name: 'Lying or Seated Leg Curl Machine', sets: 3, reps: '10-12', note: 'Warms up knees first' },
      { name: 'Seated Leg Press Machine', sets: 3, reps: '8-12' },
      { name: 'Leg Extension Machine', sets: 3, reps: '10-12' },
      { name: 'Seated Machine Calf Raise or Adductor', sets: 3, reps: '12-15' },
      { name: 'Reverse Machine Fly or Cable Face Pulls', sets: 3, reps: '10-12', note: 'Targeting rear delts' }
    ]
  }
};

// Load custom workout plan from localStorage if it exists
const savedPlan = localStorage.getItem('WORKOUT_PLAN');
if (savedPlan) {
  try {
    const parsed = JSON.parse(savedPlan);
    Object.assign(WORKOUT_PLAN, parsed);
    console.log('[schedule] Loaded custom workout plan from localStorage');
  } catch (e) {
    console.warn('[schedule] Failed to parse saved workout plan:', e);
  }
}

function renderSchedule() {
  const grid = document.getElementById('schedule-grid');
  grid.innerHTML = Object.entries(WORKOUT_PLAN).map(([dayKey, day]) => {
    return `
      <div class="schedule-card" style="border-left:4px solid var(${day.color})">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">
          <div>
            <h4 style="font-size:0.9rem;font-weight:700;color:var(--text);margin-bottom:4px">${dayKey}</h4>
            <p style="font-size:0.8rem;color:var(--text-3);font-weight:500">${day.name}</p>
          </div>
          <span style="display:inline-block;padding:4px 8px;background:var(${day.color});background:linear-gradient(135deg,var(${day.color}),rgba(255,255,255,0.1));color:var(--text);font-size:0.65rem;font-weight:700;border-radius:4px;letter-spacing:0.05em">${day.exercises.length} exercises</span>
        </div>
        <div style="display:grid;gap:10px">
          ${day.exercises.map((ex, idx) => `
            <div style="padding:10px;background:var(--bg-input);border-radius:6px;border-left:3px solid var(${day.color});display:flex;justify-content:space-between;align-items:flex-start">
              <div style="flex:1">
                <div style="font-size:0.85rem;font-weight:600;color:var(--text);margin-bottom:4px">${ex.name}</div>
                <div style="font-size:0.75rem;color:var(--text-3);display:flex;gap:12px">
                  <span>${ex.sets} sets × ${ex.reps} reps</span>
                  ${ex.note ? `<span style="color:var(--text-4);font-style:italic">💡 ${ex.note}</span>` : ''}
                </div>
              </div>
              <div style="display:flex;gap:4px">
                <button onclick="editExercise('${dayKey}', ${idx})" style="background:none;border:none;color:#999;cursor:pointer;font-size:0.9rem;padding:4px 8px;border-radius:4px;transition:color 0.2s">✎</button>
                <button onclick="deleteExercise('${dayKey}', ${idx})" style="background:none;border:none;color:#999;cursor:pointer;font-size:0.85rem;padding:4px 8px;border-radius:4px;transition:color 0.2s">✕</button>
              </div>
            </div>
          `).join('')}
        </div>
        ${day.muscleGroups.length ? `<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);font-size:0.7rem;color:var(--text-4);letter-spacing:0.05em;font-weight:600">MUSCLE GROUPS: ${day.muscleGroups.join(', ')}</div>` : ''}
      </div>
    `;
  }).join('');
}

function editExercise(dayKey, index) {
  console.log('[editExercise] Opening modal for dayKey:', dayKey, 'index:', index);
  const day = WORKOUT_PLAN[dayKey];
  const exercise = day.exercises[index];
  const modal = document.createElement('div');
  
  // Set styles individually for better browser compatibility
  modal.style.position = 'fixed';
  modal.style.top = '0';
  modal.style.left = '0';
  modal.style.width = '100%';
  modal.style.height = '100%';
  modal.style.backgroundColor = 'rgba(0,0,0,0.7)';
  modal.style.display = 'flex';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';
  modal.style.zIndex = '9999';
  
  modal.innerHTML = `
    <div style="width:90%;max-width:400px;background:#1a1a1a;border-radius:12px;padding:24px;box-shadow:0 4px 6px rgba(0,0,0,0.3)">
      <h3 style="font-size:1.2rem;font-weight:700;margin-bottom:16px;color:#fff">Edit Exercise</h3>
      <div style="display:grid;gap:12px">
        <label style="display:grid;gap:4px">
          <span style="font-size:0.85rem;font-weight:600;color:#fff">Exercise Name</span>
          <input type="text" id="edit-name" value="${exercise.name}" style="padding:8px;background:#2a2a2a;border:1px solid #444;border-radius:6px;color:#fff">
        </label>
        <label style="display:grid;gap:4px">
          <span style="font-size:0.85rem;font-weight:600;color:#fff">Sets</span>
          <input type="number" id="edit-sets" value="${exercise.sets}" min="1" max="10" style="padding:8px;background:#2a2a2a;border:1px solid #444;border-radius:6px;color:#fff">
        </label>
        <label style="display:grid;gap:4px">
          <span style="font-size:0.85rem;font-weight:600;color:#fff">Reps (e.g., 8-12)</span>
          <input type="text" id="edit-reps" value="${exercise.reps}" style="padding:8px;background:#2a2a2a;border:1px solid #444;border-radius:6px;color:#fff">
        </label>
        <label style="display:grid;gap:4px">
          <span style="font-size:0.85rem;font-weight:600;color:#fff">Note (optional)</span>
          <input type="text" id="edit-note" value="${exercise.note || ''}" placeholder="Form cue, tempo, etc." style="padding:8px;background:#2a2a2a;border:1px solid #444;border-radius:6px;color:#fff">
        </label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">
          <button id="cancel-edit" style="padding:10px;background:#2a2a2a;border:1px solid #444;color:#fff;border-radius:6px;cursor:pointer;font-weight:600">Cancel</button>
          <button id="save-edit" style="padding:10px;background:#ff8c00;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600">Save</button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  console.log('[editExercise] Modal appended to body');
  
  document.getElementById('cancel-edit').onclick = () => {
    console.log('[editExercise] Cancel clicked');
    modal.remove();
  };
  
  document.getElementById('save-edit').onclick = () => {
    console.log('[editExercise] Save clicked');
    exercise.name = document.getElementById('edit-name').value.trim();
    exercise.sets = parseInt(document.getElementById('edit-sets').value) || 3;
    exercise.reps = document.getElementById('edit-reps').value.trim();
    exercise.note = document.getElementById('edit-note').value.trim() || undefined;
    saveWorkoutPlan();
    refreshExerciseDropdowns();
    renderSchedule();
    modal.remove();
    console.log('[editExercise] Exercise saved and modal closed');
  };
}

function deleteExercise(dayKey, index) {
  console.log('[deleteExercise] Deleting exercise at dayKey:', dayKey, 'index:', index);
  const day = WORKOUT_PLAN[dayKey];
  const exercise = day.exercises[index];
  
  if (confirm(`Delete "${exercise.name}"? This cannot be undone.`)) {
    day.exercises.splice(index, 1);
    saveWorkoutPlan();
    refreshExerciseDropdowns();
    renderSchedule();
    console.log('[deleteExercise] Exercise deleted');
  }
}

function openAddExerciseModal() {
  addExercise();
}

function addExercise() {
  console.log('[addExercise] Opening modal');
  const modal = document.createElement('div');
  
  // Set styles individually for better browser compatibility
  modal.style.position = 'fixed';
  modal.style.top = '0';
  modal.style.left = '0';
  modal.style.width = '100%';
  modal.style.height = '100%';
  modal.style.backgroundColor = 'rgba(0,0,0,0.7)';
  modal.style.display = 'flex';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';
  modal.style.zIndex = '9999';
  
  modal.innerHTML = `
    <div style="width:90%;max-width:400px;background:#1a1a1a;border-radius:12px;padding:24px;box-shadow:0 4px 6px rgba(0,0,0,0.3)">
      <h3 style="font-size:1.2rem;font-weight:700;margin-bottom:16px;color:#fff">Add Exercise</h3>
      <div style="display:grid;gap:12px">
        <label style="display:grid;gap:4px">
          <span style="font-size:0.85rem;font-weight:600;color:#fff">Day *</span>
          <select id="add-day" style="padding:8px;background:#2a2a2a;border:1px solid #444;border-radius:6px;color:#fff;font-size:0.9rem">
            <option value="">Select a day...</option>
            <option value="Day 1">Day 1 - Push Day</option>
            <option value="Day 2">Day 2 - Pull Day</option>
            <option value="Day 3">Day 3 - Arms & Core</option>
            <option value="Day 4">Day 4 - Legs + Rear Shoulders</option>
          </select>
        </label>
        <label style="display:grid;gap:4px">
          <span style="font-size:0.85rem;font-weight:600;color:#fff">Type</span>
          <select id="add-type" style="padding:8px;background:#2a2a2a;border:1px solid #444;border-radius:6px;color:#fff;font-size:0.9rem">
            <option value="">Auto-detect</option>
            <option value="Push">Push</option>
            <option value="Pull">Pull</option>
            <option value="Arms & Core">Arms & Core</option>
            <option value="Legs + Rear Shoulders">Legs + Rear Shoulders</option>
          </select>
        </label>
        <label style="display:grid;gap:4px">
          <span style="font-size:0.85rem;font-weight:600;color:#fff">Exercise Name *</span>
          <input type="text" id="add-name" placeholder="e.g., Chest Press Machine" style="padding:8px;background:#2a2a2a;border:1px solid #444;border-radius:6px;color:#fff">
        </label>
        <label style="display:grid;gap:4px">
          <span style="font-size:0.85rem;font-weight:600;color:#fff">Sets</span>
          <input type="number" id="add-sets" value="3" min="1" max="10" style="padding:8px;background:#2a2a2a;border:1px solid #444;border-radius:6px;color:#fff">
        </label>
        <label style="display:grid;gap:4px">
          <span style="font-size:0.85rem;font-weight:600;color:#fff">Reps (e.g., 8-12)</span>
          <input type="text" id="add-reps" value="8-12" style="padding:8px;background:#2a2a2a;border:1px solid #444;border-radius:6px;color:#fff">
        </label>
        <label style="display:grid;gap:4px">
          <span style="font-size:0.85rem;font-weight:600;color:#fff">Note (optional)</span>
          <input type="text" id="add-note" placeholder="Form cue, tempo, etc." style="padding:8px;background:#2a2a2a;border:1px solid #444;border-radius:6px;color:#fff">
        </label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">
          <button id="cancel-add" style="padding:10px;background:#2a2a2a;border:1px solid #444;color:#fff;border-radius:6px;cursor:pointer;font-weight:600">Cancel</button>
          <button id="save-add" style="padding:10px;background:#ff8c00;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600">Add</button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  console.log('[addExercise] Modal appended to body');
  
  document.getElementById('cancel-add').onclick = () => {
    console.log('[addExercise] Cancel clicked');
    modal.remove();
  };
  
  document.getElementById('save-add').onclick = () => {
    console.log('[addExercise] Save clicked');
    const dayKey = document.getElementById('add-day').value;
    const name = document.getElementById('add-name').value.trim();
    
    if (!dayKey) {
      alert('Please select a day');
      return;
    }
    if (!name) {
      alert('Exercise name is required');
      return;
    }
    
    WORKOUT_PLAN[dayKey].exercises.push({
      name: name,
      sets: parseInt(document.getElementById('add-sets').value) || 3,
      reps: document.getElementById('add-reps').value.trim(),
      note: document.getElementById('add-note').value.trim() || undefined
    });
    saveWorkoutPlan();
    refreshExerciseDropdowns();
    renderSchedule();
    modal.remove();
    console.log('[addExercise] Exercise saved and modal closed');
  };
}

function refreshExerciseDropdowns() {
  // Refresh exercise list in forms with new custom exercises
  const allExercises = new Set();
  Object.values(WORKOUT_PLAN).forEach(day => {
    day.exercises.forEach(ex => allExercises.add(ex.name));
  });
  LOADED_EXERCISES._custom = Array.from(allExercises).sort();
  console.log('[schedule] Exercise dropdowns refreshed with', allExercises.size, 'exercises');
}

function saveWorkoutPlan() {
  localStorage.setItem('WORKOUT_PLAN', JSON.stringify(WORKOUT_PLAN));
  console.log('[schedule] Workout plan saved to localStorage');
}

/* ─── AI INSIGHTS ─── */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('refresh-insights').addEventListener('click', () => { insightsLoaded = false; loadInsights(); });
});

async function loadInsights() {
  const spinner = document.getElementById('insights-spinner');
  const list = document.getElementById('insight-list');
  spinner.style.display = 'inline-block';
  list.innerHTML = '<p class="muted">Analyzing your training data...</p>';
  try {
    const res = await fetch('/api/insights');
    const data = await res.json();
    insightsLoaded = true;
    if (!data.length) { list.innerHTML = '<p class="muted">No insights available yet. Log more sessions to get personalized coaching.</p>'; return; }
    list.innerHTML = data.map(d => {
      const type = d.type || 'info';
      return `<div class="insight-card type-${type}"><div class="insight-body"><h4>${d.title || 'Insight'}</h4><p>${d.text || d.body || ''}</p></div></div>`;
    }).join('');

    const completed = Array.isArray(trainingData) ? trainingData.filter(r => r.Date) : [];
    if (completed.length) renderExercisePicker(completed, 'exercise-picker-insights', 'chart-exercise-insights');
  } catch (e) {
    list.innerHTML = `<p class="muted">Failed to load insights.</p>`;
  } finally {
    spinner.style.display = 'none';
  }
}

/* ─── HELPERS ─── */
function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function destroyChart(key) {
  if (charts[key]) { charts[key].destroy(); delete charts[key]; }
}

/* ─── MODALS ─── */
function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    // Close FAB menu if open
    const fabMenu = document.getElementById('fab-menu');
    if (fabMenu) {
      fabMenu.classList.remove('active');
    }
    modal.style.display = 'flex';
    modal.offsetHeight; // trigger reflow
    modal.classList.add('modal-show');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove('modal-show');
    setTimeout(() => { modal.style.display = 'none'; }, 200);
    document.body.style.overflow = '';
  }
}

function toggleFabMenu() {
  const fabMenu = document.getElementById('fab-menu');
  if (fabMenu) {
    fabMenu.classList.toggle('active');
  }
}

// Close FAB menu when any option is clicked
function initFabMenu() {
  const fabOptions = document.querySelectorAll('.fab-option');
  fabOptions.forEach(option => {
    option.addEventListener('click', () => {
      const fabMenu = document.getElementById('fab-menu');
      if (fabMenu) {
        fabMenu.classList.remove('active');
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initFabMenu();
  const formTrainingModal = document.getElementById('form-training-modal');
  if (formTrainingModal) {
    formTrainingModal.addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = Object.fromEntries(fd);
    body['Target Sets/Reps'] = '3 x 12';
    body['Week'] = ''; // Leave blank, user can fill if needed
    const msg = document.getElementById('msg-training-modal');
    try {
      const res = await fetch('/api/training', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error((await res.json()).error);
      msg.textContent = 'Entry added successfully';
      msg.className = 'form-msg success';
      e.target.reset();
      await loadData();
      closeModal('modal-training');
    } catch (err) {
      msg.textContent = err.message;
      msg.className = 'form-msg error';
    }
    });
  }

  const formWeightModal = document.getElementById('form-weight-modal');
  if (formWeightModal) {
    formWeightModal.addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = Object.fromEntries(fd);
    const msg = document.getElementById('msg-weight-modal');
    try {
      const res = await fetch('/api/weight', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error((await res.json()).error);
      msg.textContent = 'Weight logged successfully';
      msg.className = 'form-msg success';
      e.target.reset();
      await loadData();
      closeModal('modal-weight');
    } catch (err) {
      msg.textContent = err.message;
      msg.className = 'form-msg error';
    }
    });
  }

  const formStepsModal = document.getElementById('form-steps-modal');
  if (formStepsModal) {
    formStepsModal.addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = Object.fromEntries(fd);
    const msg = document.getElementById('msg-steps-modal');
    try {
      const res = await fetch('/api/steps', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error((await res.json()).error);
      msg.textContent = 'Steps logged successfully';
      msg.className = 'form-msg success';
      e.target.reset();
      await loadData();
      closeModal('modal-steps');
    } catch (err) {
      msg.textContent = err.message;
      msg.className = 'form-msg error';
    }
    });
  }

  const formWeightGoalModal = document.getElementById('form-weight-goal-modal');
  if (formWeightGoalModal) {
    formWeightGoalModal.addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const goal = parseFloat(fd.get('WeightGoal'));
    const msg = document.getElementById('msg-weight-goal-modal');
    
    if (isNaN(goal) || goal <= 0) {
      msg.textContent = 'Please enter a valid weight goal';
      msg.className = 'form-msg error';
      return;
    }
    
    localStorage.setItem('WEIGHT_GOAL', goal);
    msg.textContent = 'Weight goal saved successfully';
    msg.className = 'form-msg success';
    setTimeout(() => {
      e.target.reset();
      loadData();
      closeModal('modal-weight-goal');
    }, 500);
    });
  }

  const formMeasurements = document.getElementById('form-measurements');
  if (formMeasurements) {
    // Load saved measurements on modal open
    const heightInput = document.getElementById('input-height');
    const waistInput = document.getElementById('input-waist');
    const savedHeight = localStorage.getItem('USER_HEIGHT');
    const savedWaist = localStorage.getItem('USER_WAIST');
    if (savedHeight) heightInput.value = savedHeight;
    if (savedWaist) waistInput.value = savedWaist;

    formMeasurements.addEventListener('submit', async e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const height = parseFloat(fd.get('height'));
      const waistInches = parseFloat(fd.get('waist'));
      const msg = document.getElementById('msg-measurements');
      
      if (isNaN(height) || height <= 0 || isNaN(waistInches) || waistInches <= 0) {
        msg.textContent = 'Please enter valid measurements';
        msg.className = 'form-msg error';
        return;
      }
      
      try {
        // Save to backend
        const res = await fetch('/api/measurements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ height, waist: waistInches })
        });
        
        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.error || 'Failed to save measurements');
        }
        
        // Save to localStorage
        localStorage.setItem('USER_HEIGHT', height);
        localStorage.setItem('USER_WAIST', waistInches); // Store in inches
        msg.textContent = 'Measurements saved successfully';
        msg.className = 'form-msg success';
        setTimeout(() => {
          loadData();
          closeModal('modal-measurements');
        }, 500);
      } catch (err) {
        msg.textContent = err.message || 'Failed to save measurements';
        msg.className = 'form-msg error';
      }
    });
  }

  // Function to get exercises from WORKOUT_PLAN for the selected day
  function getExercisesForDay(dayKey) {
    if (!dayKey || !WORKOUT_PLAN[dayKey]) {
      console.log('[getExercises] Invalid day:', dayKey);
      return [];
    }
    const dayExercises = WORKOUT_PLAN[dayKey].exercises.map(ex => ex.name);
    console.log('[getExercises] Found', dayExercises.length, 'exercises for', dayKey);
    return dayExercises;
  }

  // Populate exercise dropdown based on Day selection
  const daySelect = document.querySelector('#form-training-modal select[name="Day"]');
  const muscleGroupSelect = document.querySelector('#form-training-modal select[name="Muscle Group"]');
  const exerciseSelect = document.querySelector('#form-training-modal select[name="Exercise"]');
  
  if (daySelect && exerciseSelect) {
    const updateExercises = () => {
      const dayKey = daySelect.value;
      console.log('[dropdown] Day changed to:', dayKey);
      const exercises = dayKey ? getExercisesForDay(dayKey) : [];
      console.log('[dropdown] Updating with', exercises.length, 'exercises');
      exerciseSelect.innerHTML = '<option value="">Select exercise...</option>' + exercises.map(e => `<option value="${e}">${e}</option>`).join('');
    };
    
    daySelect.addEventListener('change', updateExercises);
    console.log('[dropdown] Event listener registered for Day changes');
    
    // When modal opens, update exercises
    document.addEventListener('click', e => {
      if (e.target.textContent === 'Log Training') {
        setTimeout(() => {
          updateExercises();
        }, 100);
      }
    });
  }
});

function promptWeightGoal() {
  const current = localStorage.getItem('WEIGHT_GOAL') || '';
  const goal = prompt('What is your weight goal? (kg)', current);
  if (goal && parseFloat(goal)) {
    localStorage.setItem('WEIGHT_GOAL', parseFloat(goal));
    loadData(); // Refresh overview
  } else if (goal === '') {
    localStorage.removeItem('WEIGHT_GOAL');
    loadData();
  }
}
