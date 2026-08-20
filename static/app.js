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
    if (data && typeof data === 'object' && !data.error) {
      LOADED_EXERCISES = data;
    }
  } catch (e) {
    console.error('Failed to load exercises:', e);
  }
}

/* ─── LOAD DATA ─── */
async function loadData() {
  const [tRes, wRes, sRes] = await Promise.all([fetch('/api/training'), fetch('/api/weight'), fetch('/api/steps')]);
  trainingData = (await tRes.json()) || [];
  weightData = (await wRes.json()) || [];
  stepsData = (await sRes.json()) || [];
  
  // Ensure they're arrays even if API returns error objects
  if (!Array.isArray(trainingData)) trainingData = [];
  if (!Array.isArray(weightData)) weightData = [];
  if (!Array.isArray(stepsData)) stepsData = [];
  
  renderOverview();
  renderStrengthTable();
  renderWeightTab();
}

/* ─── OVERVIEW ─── */
function renderOverview() {
  const completed = Array.isArray(trainingData) ? trainingData.filter(r => r.Date) : [];
  const exercises = [...new Set(completed.map(r => r.Exercise))];
  const totalVol = completed.reduce((s, r) => s + (r.Volume || 0), 0);

  document.getElementById('stat-sessions').textContent = new Set(completed.map(r => r.Date)).size;
  document.getElementById('stat-exercises').textContent = exercises.length;
  document.getElementById('stat-volume').textContent = totalVol > 1000 ? (totalVol / 1000).toFixed(1) + 'k' : Math.round(totalVol);

  if (weightData.length) {
    const latest = weightData[weightData.length - 1];
    document.getElementById('stat-weight').textContent = parseFloat(latest.Weight).toFixed(1) + ' kg';
    if (weightData.length > 1) {
      const prev = weightData[weightData.length - 2];
      const delta = latest.Weight - prev.Weight;
      const el = document.getElementById('stat-weight-delta');
      el.textContent = (delta >= 0 ? '+' : '') + delta.toFixed(1) + ' kg';
      el.className = 'stat-delta ' + (delta > 0 ? 'positive' : delta < 0 ? 'negative' : '');
    }
  }

  if (stepsData.length) {
    const today = new Date().toISOString().slice(0, 10);
    const todayEntry = stepsData.find(r => r.Date === today);
    document.getElementById('stat-steps').textContent = todayEntry ? Number(todayEntry.Steps).toLocaleString() : '--';
    const avg = Math.round(stepsData.reduce((s, r) => s + (r.Steps || 0), 0) / stepsData.length);
    const el = document.getElementById('stat-steps-avg');
    el.textContent = 'avg ' + avg.toLocaleString() + '/day';
    el.className = 'stat-delta';
  }

  renderVolumeChart(completed);
  renderWeightChart();
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
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ctx.parsed.y.toLocaleString() + ' steps' } }
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
          ${day.exercises.map(ex => `
            <div style="padding:10px;background:var(--bg-input);border-radius:6px;border-left:3px solid var(${day.color})">
              <div style="font-size:0.85rem;font-weight:600;color:var(--text);margin-bottom:4px">${ex.name}</div>
              <div style="font-size:0.75rem;color:var(--text-3);display:flex;gap:12px">
                <span>📊 ${ex.sets} sets × ${ex.reps} reps</span>
                ${ex.note ? `<span style="color:var(--text-4);font-style:italic">💡 ${ex.note}</span>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
        ${day.muscleGroups.length ? `<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);font-size:0.7rem;color:var(--text-4);letter-spacing:0.05em;font-weight:600">MUSCLE GROUPS: ${day.muscleGroups.join(', ')}</div>` : ''}
      </div>
    `;
  }).join('');
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
    const icons = { success: '↑', warning: '!', info: 'i' };
    list.innerHTML = data.map(d => {
      const type = d.type || 'info';
      return `<div class="insight-card type-${type}"><div class="insight-icon">${icons[type] || 'i'}</div><div class="insight-body"><h4>${d.title || 'Insight'}</h4><p>${d.text || d.body || ''}</p></div></div>`;
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

document.addEventListener('DOMContentLoaded', () => {
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

  // Function to get exercises from loaded data (Excel file)
  function getExercisesForMuscleGroup(muscleGroup) {
    // First try to use exercises loaded from Excel
    if (LOADED_EXERCISES[muscleGroup]) {
      return LOADED_EXERCISES[muscleGroup];
    }
    // Fallback to exercises from database
    const existing = [...new Set(trainingData.filter(Array.isArray).map(r => r.Exercise).filter(Boolean))].sort();
    return existing;
  }

  // Populate exercise dropdown based on Muscle Group selection
  const muscleGroupSelect = document.querySelector('#form-training-modal select[name="Muscle Group"]');
  const exerciseSelect = document.querySelector('#form-training-modal select[name="Exercise"]');
  
  if (muscleGroupSelect && exerciseSelect) {
    const updateExercises = () => {
      const muscleGroup = muscleGroupSelect.value;
      const exercises = muscleGroup ? getExercisesForMuscleGroup(muscleGroup) : [...new Set((Array.isArray(trainingData) ? trainingData : []).map(r => r.Exercise).filter(Boolean))].sort();
      exerciseSelect.innerHTML = '<option value="">Select exercise...</option>' + exercises.map(e => `<option value="${e}">${e}</option>`).join('');
    };
    
    muscleGroupSelect.addEventListener('change', updateExercises);
    
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
