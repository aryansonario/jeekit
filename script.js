/* ============================================================
   JEEkit – script.js
   Modular study dashboard logic
   ============================================================ */

'use strict';

// ============================================================
// STATE
// ============================================================
let userData = {};
let subjects = [];
let sessionLog = [];
let studyData = {}; // { 'YYYY-MM-DD': totalSeconds }
let reminders = {}; // { 'YYYY-MM-DD': ['reminder1', ...] }

// Timer state
let timerMode = 'stopwatch';
let timerRunning = false;
let timerSeconds = 0;
let timerInterval = null;
let countdownTotal = 0;

// Pomodoro state
let pomodoroPhase = 'focus'; // 'focus' | 'break' | 'longbreak'
let pomodoroSession = 1;
const POMO_FOCUS = 25 * 60;
const POMO_BREAK = 5 * 60;
const POMO_LONG = 15 * 60;

// Calendar state
let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth();
let selectedDate = null;

// Calculator state
let calcExpression = '';
let calcHistory = [];

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  loadAllData();
  checkOnboarding();
  updateStreakDisplay();
  updateCountdown();
  renderSubjects();
  updateSubjectSelect();
  renderSessionLog();
  updateStats();
  renderCalendar();
  setMode('stopwatch', document.querySelector('.mode-btn'));
});

// ============================================================
// DATA PERSISTENCE
// ============================================================
function loadAllData() {
  userData = JSON.parse(localStorage.getItem('jeekit_user') || '{"exam":"JEE","class":"Class 11","name":""}');
  subjects = JSON.parse(localStorage.getItem('jeekit_subjects') || '[]');
  sessionLog = JSON.parse(localStorage.getItem('jeekit_sessions_' + todayKey()) || '[]');
  studyData = JSON.parse(localStorage.getItem('jeekit_studydata') || '{}');
  reminders = JSON.parse(localStorage.getItem('jeekit_reminders') || '{}');

  // Defaults
  if (subjects.length === 0 && userData.exam === 'JEE') {
    subjects = [
      { id: uid(), name: 'Mathematics', targetHours: 2, studiedSeconds: 0, done: false },
      { id: uid(), name: 'Physics', targetHours: 1.5, studiedSeconds: 0, done: false },
      { id: uid(), name: 'Chemistry', targetHours: 2, studiedSeconds: 0, done: false },
    ];
    saveSubjects();
  }
  if (subjects.length === 0 && userData.exam === 'NEET') {
    subjects = [
      { id: uid(), name: 'Biology', targetHours: 2, studiedSeconds: 0, done: false },
      { id: uid(), name: 'Physics', targetHours: 1.5, studiedSeconds: 0, done: false },
      { id: uid(), name: 'Chemistry', targetHours: 2, studiedSeconds: 0, done: false },
    ];
    saveSubjects();
  }
}

function saveSubjects() {
  localStorage.setItem('jeekit_subjects', JSON.stringify(subjects));
}

function saveSessionLog() {
  localStorage.setItem('jeekit_sessions_' + todayKey(), JSON.stringify(sessionLog));
}

function saveStudyData() {
  localStorage.setItem('jeekit_studydata', JSON.stringify(studyData));
}

function saveReminders() {
  localStorage.setItem('jeekit_reminders', JSON.stringify(reminders));
}

function saveUserData() {
  localStorage.setItem('jeekit_user', JSON.stringify(userData));
}

// ============================================================
// HELPERS
// ============================================================
function uid() {
  return Math.random().toString(36).substr(2, 9);
}

function todayKey() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
  return String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0') + ':00'.replace(':00','');
}

function formatTimeHHMMSS(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
}

function showToast(msg, type = '') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = 'toast show ' + type;
  setTimeout(() => { toast.className = 'toast hidden'; }, 2800);
}

// ============================================================
// ONBOARDING
// ============================================================
function checkOnboarding() {
  const hasUser = localStorage.getItem('jeekit_user');
  if (!hasUser) {
    document.getElementById('onboardingModal').classList.remove('hidden');
  } else {
    applyUserData();
  }
}

/** Handle selection buttons (exam / class) */
function selectOption(btn) {
  const group = btn.dataset.group;
  document.querySelectorAll(`[data-group="${group}"]`).forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function saveOnboarding() {
  const name = document.getElementById('onboardName').value.trim();
  const examBtn = document.querySelector('[data-group="exam"].active');
  const classBtn = document.querySelector('[data-group="class"].active');
  userData = {
    name: name,
    exam: examBtn ? examBtn.dataset.value : 'JEE',
    class: classBtn ? classBtn.dataset.value : 'Class 11',
  };
  saveUserData();
  document.getElementById('onboardingModal').classList.add('hidden');
  loadAllData();
  applyUserData();
  renderSubjects();
  updateSubjectSelect();
  showToast('Welcome' + (name ? ', ' + name : '') + '! Let\'s study 🚀', 'success');
}

function applyUserData() {
  document.getElementById('headerExam').textContent = userData.exam || 'JEE';
  document.getElementById('headerClass').textContent = userData.class || 'Class 11';
  updateCountdown();
}

// ============================================================
// COUNTDOWN
// ============================================================
function updateCountdown() {
  const exam = userData.exam || 'JEE';
  const cls = userData.class || 'Class 11';
  let targetDate;

  if (exam === 'NEET') {
    targetDate = cls === 'Class 11' ? new Date('2027-05-03') : new Date('2026-05-03');
  } else {
    // JEE Advanced
    if (cls === 'Class 11') targetDate = new Date('2027-05-25');
    else targetDate = new Date('2026-05-25'); // Class 12 or Dropper
  }

  const now = new Date();
  const diff = Math.ceil((targetDate - now) / (1000 * 60 * 60 * 24));
  const el = document.getElementById('countdownDays');
  if (el) el.textContent = diff > 0 ? diff : '0';
}

// ============================================================
// STREAK SYSTEM
// ============================================================
function updateStreakDisplay() {
  const streak = calculateStreak();
  document.getElementById('streakCount').textContent = streak;
}

function calculateStreak() {
  const streak = parseInt(localStorage.getItem('jeekit_streak') || '0');
  const lastStudyDay = localStorage.getItem('jeekit_last_study_day') || '';
  const today = todayKey();
  const yesterday = (() => {
    const d = new Date(); d.setDate(d.getDate() - 1);
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  })();

  if (lastStudyDay === today) return streak;
  if (lastStudyDay === yesterday) return streak; // ongoing, not broken
  if (lastStudyDay === '') return 0;
  // Break streak
  if (lastStudyDay < yesterday) {
    localStorage.setItem('jeekit_streak', '0');
    return 0;
  }
  return streak;
}

/** Call this when user studies ≥30 min today */
function updateStreak() {
  const today = todayKey();
  const lastDay = localStorage.getItem('jeekit_last_study_day') || '';
  if (lastDay === today) return; // Already counted today

  const yesterday = (() => {
    const d = new Date(); d.setDate(d.getDate() - 1);
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  })();

  let streak = parseInt(localStorage.getItem('jeekit_streak') || '0');
  if (lastDay === yesterday) streak += 1;
  else streak = 1;

  localStorage.setItem('jeekit_streak', String(streak));
  localStorage.setItem('jeekit_last_study_day', today);
  updateStreakDisplay();
  if (streak > 1) showToast('🔥 ' + streak + '-day streak! Keep it up!', 'success');
}

// ============================================================
// SUBJECT SYSTEM
// ============================================================
function renderSubjects() {
  const list = document.getElementById('subjectList');
  if (!list) return;
  list.innerHTML = '';

  if (subjects.length === 0) {
    list.innerHTML = '<p class="text-gray-600 text-xs text-center py-4">No subjects yet. Add one!</p>';
    updateSummary();
    return;
  }

  subjects.forEach(sub => {
    const targetSecs = sub.targetHours * 3600;
    const pct = Math.min(100, Math.round((sub.studiedSeconds / targetSecs) * 100));
    const studied = formatStudied(sub.studiedSeconds);
    const done = pct >= 100 || sub.done;

    const item = document.createElement('div');
    item.className = 'subject-item' + (done ? ' completed' : '');
    item.id = 'subject-' + sub.id;
    item.innerHTML = `
      <div class="subject-top" style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <div class="subject-check ${done ? 'checked' : ''}" onclick="toggleSubjectDone('${sub.id}')"></div>
        <span class="subject-name">${sub.name}</span>
        <div class="subject-actions">
          <button class="subject-action-btn" onclick="selectSubjectTimer('${sub.id}')" title="Study this">▶</button>
          <button class="subject-action-btn" onclick="editSubject('${sub.id}')" title="Edit">✎</button>
          <button class="subject-action-btn" onclick="deleteSubject('${sub.id}')" title="Delete" style="color:#EF4444">✕</button>
        </div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
        <span style="font-size:11px;color:var(--muted);">${studied} / ${sub.targetHours}h</span>
        <span style="font-size:11px;color:${done?'var(--teal)':'var(--purple-light)'};">${pct}%</span>
      </div>
      <div class="subject-progress-bar">
        <div class="subject-progress-fill ${done?'done':''}" style="width:${pct}%"></div>
      </div>
    `;
    list.appendChild(item);
  });

  updateSummary();
}

function formatStudied(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return h + 'h ' + m + 'm';
  return m + 'm';
}

function updateSummary() {
  const totalTarget = subjects.reduce((a, s) => a + s.targetHours, 0);
  const totalStudiedSecs = subjects.reduce((a, s) => a + s.studiedSeconds, 0);
  const sh = Math.floor(totalStudiedSecs / 3600);
  const sm = Math.floor((totalStudiedSecs % 3600) / 60);

  document.getElementById('totalTarget').textContent = totalTarget + 'h';
  document.getElementById('totalStudied').textContent = sh + 'h ' + sm + 'm';
}

function toggleSubjectDone(id) {
  const sub = subjects.find(s => s.id === id);
  if (sub) {
    sub.done = !sub.done;
    saveSubjects();
    renderSubjects();
  }
}

function selectSubjectTimer(id) {
  const sub = subjects.find(s => s.id === id);
  if (!sub) return;
  const sel = document.getElementById('timerSubjectSelect');
  sel.value = id;

  // Highlight sidebar item
  document.querySelectorAll('.subject-item').forEach(el => el.classList.remove('active-subject'));
  const el = document.getElementById('subject-' + id);
  if (el) el.classList.add('active-subject');

  showToast('Studying: ' + sub.name);
}

function editSubject(id) {
  const sub = subjects.find(s => s.id === id);
  if (!sub) return;
  const newName = prompt('Subject name:', sub.name);
  if (newName === null) return;
  const newHours = parseFloat(prompt('Target hours:', sub.targetHours));
  if (isNaN(newHours)) return;
  sub.name = newName.trim() || sub.name;
  sub.targetHours = Math.max(0.5, newHours);
  saveSubjects();
  renderSubjects();
  updateSubjectSelect();
}

function deleteSubject(id) {
  if (!confirm('Delete this subject?')) return;
  subjects = subjects.filter(s => s.id !== id);
  saveSubjects();
  renderSubjects();
  updateSubjectSelect();
}

function openAddSubject() {
  document.getElementById('addSubjectPanel').classList.remove('hidden');
  document.getElementById('newSubjectName').focus();
}

function closeAddSubject() {
  document.getElementById('addSubjectPanel').classList.add('hidden');
  document.getElementById('newSubjectName').value = '';
  document.getElementById('newSubjectHours').value = '';
}

function addSubject() {
  const name = document.getElementById('newSubjectName').value.trim();
  const hours = parseFloat(document.getElementById('newSubjectHours').value);
  if (!name) { showToast('Enter a subject name'); return; }
  if (isNaN(hours) || hours <= 0) { showToast('Enter valid hours'); return; }
  subjects.push({ id: uid(), name, targetHours: hours, studiedSeconds: 0, done: false });
  saveSubjects();
  renderSubjects();
  updateSubjectSelect();
  closeAddSubject();
  showToast(name + ' added!', 'success');
}

function updateSubjectSelect() {
  const sel = document.getElementById('timerSubjectSelect');
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">Select a subject…</option>';
  subjects.forEach(sub => {
    const opt = document.createElement('option');
    opt.value = sub.id;
    opt.textContent = sub.name;
    sel.appendChild(opt);
  });
  if (cur) sel.value = cur;
}

// ============================================================
// TIMER SYSTEM
// ============================================================
function setMode(mode, btn) {
  timerMode = mode;
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  // Reset
  resetTimer();

  // Show/hide UI
  const pomStatus = document.getElementById('pomodoroStatus');
  const cdInput = document.getElementById('countdownInput');
  pomStatus.classList.add('hidden');
  cdInput.classList.add('hidden');

  if (mode === 'pomodoro') {
    pomodoroSession = 1;
    pomodoroPhase = 'focus';
    timerSeconds = POMO_FOCUS;
    pomStatus.classList.remove('hidden');
    updatePomodoroStatus();
    document.getElementById('timerDisplay').textContent = formatTimeHHMMSS(POMO_FOCUS);
    setRingProgress(0, POMO_FOCUS);
  } else if (mode === 'countdown') {
    cdInput.classList.remove('hidden');
    timerSeconds = getCountdownInput();
    countdownTotal = timerSeconds;
    document.getElementById('timerDisplay').textContent = formatTimeHHMMSS(timerSeconds);
    setRingProgress(0, timerSeconds);
  } else {
    timerSeconds = 0;
    document.getElementById('timerDisplay').textContent = '00:00:00';
    setRingProgress(0, 0);
  }

  document.getElementById('timerStatus').textContent = 'Ready';
  document.getElementById('ringProgress').classList.remove('break-mode');
}

function getCountdownInput() {
  const h = parseInt(document.getElementById('countdownHours').value) || 0;
  const m = parseInt(document.getElementById('countdownMins').value) || 0;
  const s = parseInt(document.getElementById('countdownSecs').value) || 0;
  return h*3600 + m*60 + s;
}

function toggleTimer() {
  if (timerRunning) pauseTimer();
  else startTimer();
}

function startTimer() {
  if (timerMode === 'countdown' && timerSeconds === 0) {
    timerSeconds = getCountdownInput();
    countdownTotal = timerSeconds;
    if (timerSeconds === 0) { showToast('Set a time first!'); return; }
  }

  timerRunning = true;
  document.getElementById('startPauseIcon').textContent = '⏸';
  document.getElementById('timerStatus').textContent = timerMode === 'pomodoro' ?
    (pomodoroPhase === 'focus' ? 'Focusing…' : 'On break…') : 'Running…';

  timerInterval = setInterval(() => {
    if (timerMode === 'stopwatch') {
      timerSeconds++;
      updateTimerDisplay();
      setRingProgress(timerSeconds % 3600, 3600);
    } else if (timerMode === 'countdown' || timerMode === 'pomodoro') {
      if (timerSeconds > 0) {
        timerSeconds--;
        updateTimerDisplay();
        const total = timerMode === 'pomodoro' ? getPomodoroTotal() : countdownTotal;
        setRingProgress(total - timerSeconds, total);
      } else {
        handleTimerEnd();
      }
    }
  }, 1000);
}

function pauseTimer() {
  timerRunning = false;
  clearInterval(timerInterval);
  document.getElementById('startPauseIcon').textContent = '▶';
  document.getElementById('timerStatus').textContent = 'Paused';
}

function resetTimer() {
  pauseTimer();
  timerSeconds = 0;
  document.getElementById('timerDisplay').textContent = '00:00:00';
  document.getElementById('timerStatus').textContent = 'Ready';
  setRingProgress(0, 1);
  if (timerMode === 'pomodoro') {
    timerSeconds = POMO_FOCUS;
    pomodoroPhase = 'focus';
    pomodoroSession = 1;
    document.getElementById('timerDisplay').textContent = formatTimeHHMMSS(POMO_FOCUS);
    updatePomodoroStatus();
    document.getElementById('ringProgress').classList.remove('break-mode');
  }
}

function updateTimerDisplay() {
  document.getElementById('timerDisplay').textContent = formatTimeHHMMSS(timerSeconds);
}

function getPomodoroTotal() {
  if (pomodoroPhase === 'focus') return POMO_FOCUS;
  if (pomodoroPhase === 'longbreak') return POMO_LONG;
  return POMO_BREAK;
}

function updatePomodoroStatus() {
  const label = document.getElementById('pomodoroLabel');
  const session = document.getElementById('pomodoroSession');
  if (!label) return;
  label.textContent = pomodoroPhase === 'focus' ? '🎯 Focus Time' : pomodoroPhase === 'longbreak' ? '☕ Long Break' : '😴 Short Break';
  session.textContent = 'Session ' + pomodoroSession + ' of 4';
  const ring = document.getElementById('ringProgress');
  if (pomodoroPhase !== 'focus') ring.classList.add('break-mode');
  else ring.classList.remove('break-mode');
}

function handleTimerEnd() {
  clearInterval(timerInterval);
  timerRunning = false;
  document.getElementById('startPauseIcon').textContent = '▶';

  if (timerMode === 'countdown') {
    showToast('⏰ Time\'s up!');
    playBell();
    document.getElementById('timerStatus').textContent = 'Done!';
    setRingProgress(countdownTotal, countdownTotal);
  } else if (timerMode === 'pomodoro') {
    playBell();
    if (pomodoroPhase === 'focus') {
      logPomodoroFocus();
      if (pomodoroSession % 4 === 0) {
        pomodoroPhase = 'longbreak';
        timerSeconds = POMO_LONG;
        showToast('🎉 Great work! Long break time (' + (POMO_LONG/60) + ' min)', 'success');
      } else {
        pomodoroPhase = 'break';
        timerSeconds = POMO_BREAK;
        showToast('😴 Take a 5 min break!');
      }
    } else {
      pomodoroPhase = 'focus';
      if (pomodoroSession < 4) pomodoroSession++;
      else pomodoroSession = 1;
      timerSeconds = POMO_FOCUS;
      showToast('🎯 Back to focus!');
    }
    updatePomodoroStatus();
    updateTimerDisplay();
    setRingProgress(0, getPomodoroTotal());
    startTimer();
  }
}

function logPomodoroFocus() {
  const subId = document.getElementById('timerSubjectSelect').value;
  recordStudyTime(POMO_FOCUS, subId);
}

function setRingProgress(elapsed, total) {
  const ring = document.getElementById('ringProgress');
  const circumference = 596.9;
  if (total === 0) { ring.style.strokeDashoffset = circumference; return; }
  const pct = Math.min(1, elapsed / total);
  ring.style.strokeDashoffset = circumference * (1 - pct);
}

function playBell() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 1.5);
  } catch(e) {}
}

// ============================================================
// SESSION LOGGING
// ============================================================
function logSession() {
  const elapsed = timerMode === 'stopwatch' ? timerSeconds :
                  timerMode === 'countdown' ? (countdownTotal - timerSeconds) : 0;

  if (elapsed < 30) { showToast('Study for at least 30 seconds first!'); return; }

  const subId = document.getElementById('timerSubjectSelect').value;
  recordStudyTime(elapsed, subId);

  pauseTimer();
  timerSeconds = 0;
  document.getElementById('timerDisplay').textContent = '00:00:00';
  setRingProgress(0, 0);
  showToast('Session saved! ' + formatStudied(elapsed) + ' logged ✓', 'success');
}

function recordStudyTime(seconds, subId) {
  // Update subject studied time
  if (subId) {
    const sub = subjects.find(s => s.id === subId);
    if (sub) {
      sub.studiedSeconds = (sub.studiedSeconds || 0) + seconds;
      saveSubjects();
    }
  }

  // Update today's total
  const key = todayKey();
  studyData[key] = (studyData[key] || 0) + seconds;
  saveStudyData();

  // Session log entry
  const subName = subId ? (subjects.find(s => s.id === subId)?.name || 'General') : 'General';
  sessionLog.push({ subject: subName, seconds, time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) });
  saveSessionLog();

  // Check streak (30min = 1800s)
  if (studyData[key] >= 1800) updateStreak();

  renderSubjects();
  renderSessionLog();
  updateStats();
}

function renderSessionLog() {
  const log = document.getElementById('sessionLog');
  if (!log) return;
  if (sessionLog.length === 0) {
    log.innerHTML = '<p class="text-gray-600 text-xs text-center py-4">No sessions yet today</p>';
    return;
  }
  log.innerHTML = [...sessionLog].reverse().slice(0, 8).map(s => `
    <div class="session-item">
      <div>
        <div class="session-subject">${s.subject}</div>
        <div style="font-size:10px;color:var(--muted)">${s.time}</div>
      </div>
      <div class="session-duration">${formatStudied(s.seconds)}</div>
    </div>
  `).join('');
}

// ============================================================
// STATS
// ============================================================
function updateStats() {
  const key = todayKey();
  const todaySecs = studyData[key] || 0;
  document.getElementById('todayTotal').textContent = formatStudied(todaySecs) || '0m';

  // Weekly total
  let weekSecs = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const k = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    weekSecs += studyData[k] || 0;
  }
  document.getElementById('weekTotal').textContent = (weekSecs / 3600).toFixed(1) + 'h';

  // Daily avg (last 7 days)
  const avgSecs = weekSecs / 7;
  document.getElementById('avgDaily').textContent = formatStudied(Math.round(avgSecs)) || '0m';
}

// ============================================================
// SIDEBAR TOGGLE
// ============================================================
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.toggle('collapsed');
}

// ============================================================
// TAB NAVIGATION
// ============================================================
function switchTab(name, btn) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
  const tab = document.getElementById('tab-' + name);
  if (tab) tab.classList.add('active');
  if (btn) btn.classList.add('active');
}

// ============================================================
// FLOATING TOOLS
// ============================================================
let openPanel = null;

function toggleTool(name) {
  const panel = document.getElementById(name + 'Panel');
  if (!panel) return;

  if (panel.classList.contains('hidden')) {
    // Close others
    ['calculator', 'calendar', 'music'].forEach(t => {
      if (t !== name) {
        const p = document.getElementById(t + 'Panel');
        if (p) p.classList.add('hidden');
      }
    });
    // Position relative to floating buttons
    positionPanel(panel);
    panel.classList.remove('hidden');
    openPanel = name;
  } else {
    closePanel(name);
  }
}

function positionPanel(panel) {
  const isMobile = window.innerWidth <= 768;
  if (isMobile) return; // CSS handles mobile
  panel.style.right = '80px';
  panel.style.bottom = '80px';
}

function closePanel(name) {
  const panel = document.getElementById(name + 'Panel');
  if (panel) panel.classList.add('hidden');
  if (openPanel === name) openPanel = null;
}

// Close panels on outside click
document.addEventListener('click', (e) => {
  const panels = ['calculator', 'calendar', 'music'];
  const tools = document.querySelector('.floating-tools');
  panels.forEach(name => {
    const panel = document.getElementById(name + 'Panel');
    if (!panel || panel.classList.contains('hidden')) return;
    if (!panel.contains(e.target) && tools && !tools.contains(e.target)) {
      closePanel(name);
    }
  });
});

// ============================================================
// CALCULATOR
// ============================================================
function calcInput(val) {
  calcExpression += val;
  document.getElementById('calcExpression').textContent = calcExpression;
  calcLiveEval();
}

function calcLiveEval() {
  try {
    const expr = calcExpression
      .replace(/sin\(/g, 'Math.sin(Math.PI/180*')
      .replace(/cos\(/g, 'Math.cos(Math.PI/180*')
      .replace(/tan\(/g, 'Math.tan(Math.PI/180*')
      .replace(/log\(/g, 'Math.log10(')
      .replace(/ln\(/g, 'Math.log(')
      .replace(/sqrt\(/g, 'Math.sqrt(');
    // eslint-disable-next-line no-new-func
    const result = Function('"use strict"; return (' + expr + ')')();
    if (typeof result === 'number' && isFinite(result)) {
      document.getElementById('calcResult').textContent = parseFloat(result.toFixed(10)).toString();
    }
  } catch(e) {
    // Invalid expression mid-typing, ignore
  }
}

function calcEquals() {
  try {
    const expr = calcExpression
      .replace(/sin\(/g, 'Math.sin(Math.PI/180*')
      .replace(/cos\(/g, 'Math.cos(Math.PI/180*')
      .replace(/tan\(/g, 'Math.tan(Math.PI/180*')
      .replace(/log\(/g, 'Math.log10(')
      .replace(/ln\(/g, 'Math.log(')
      .replace(/sqrt\(/g, 'Math.sqrt(');
    // eslint-disable-next-line no-new-func
    const result = Function('"use strict"; return (' + expr + ')')();
    const finalResult = parseFloat(result.toFixed(10)).toString();

    // Add to history
    calcHistory.unshift(calcExpression + ' = ' + finalResult);
    if (calcHistory.length > 8) calcHistory.pop();

    document.getElementById('calcResult').textContent = finalResult;
    document.getElementById('calcExpression').textContent = calcExpression + ' =';
    calcExpression = finalResult;
  } catch(e) {
    document.getElementById('calcResult').textContent = 'Error';
    calcExpression = '';
  }
}

function calcClear() {
  calcExpression = '';
  document.getElementById('calcExpression').textContent = '';
  document.getElementById('calcResult').textContent = '0';
}

function calcBackspace() {
  calcExpression = calcExpression.slice(0, -1);
  document.getElementById('calcExpression').textContent = calcExpression;
  calcLiveEval();
}

function copyCalcResult() {
  const result = document.getElementById('calcResult').textContent;
  navigator.clipboard.writeText(result).then(() => showToast('Copied: ' + result, 'success')).catch(() => showToast('Copy failed'));
}

function clearCalcHistory() {
  const histEl = document.getElementById('calcHistory');
  histEl.classList.toggle('hidden');
  if (!histEl.classList.contains('hidden')) {
    histEl.innerHTML = calcHistory.length ? calcHistory.map(h => `<div style="padding:3px 0;border-bottom:1px solid var(--border)">${h}</div>`).join('') : '<div style="color:var(--muted)">No history yet</div>';
  }
}

// ============================================================
// CALENDAR SYSTEM
// ============================================================
function renderCalendar() {
  const title = document.getElementById('calendarTitle');
  const grid = document.getElementById('calendarGrid');
  if (!title || !grid) return;

  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  title.textContent = months[calMonth] + ' ' + calYear;

  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth+1, 0).getDate();
  const today = new Date();

  grid.innerHTML = '';

  // Fill blanks
  for (let i = 0; i < firstDay; i++) {
    const blank = document.createElement('div');
    blank.className = 'cal-day other-month';
    const prevDay = new Date(calYear, calMonth, -firstDay + i + 1);
    blank.textContent = prevDay.getDate();
    grid.appendChild(blank);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const btn = document.createElement('div');
    btn.className = 'cal-day';
    btn.textContent = d;

    const dateKey = calYear + '-' + String(calMonth+1).padStart(2,'0') + '-' + String(d).padStart(2,'0');

    if (d === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear()) {
      btn.classList.add('today');
    }
    if (dateKey === selectedDate) btn.classList.add('selected');
    if (reminders[dateKey] && reminders[dateKey].length > 0) btn.classList.add('has-reminder');

    btn.addEventListener('click', () => selectCalendarDate(dateKey, d));
    grid.appendChild(btn);
  }
}

function selectCalendarDate(dateKey, day) {
  selectedDate = dateKey;
  renderCalendar();

  // Show reminder input
  const area = document.getElementById('reminderInputArea');
  const label = document.getElementById('reminderDateLabel');
  area.classList.remove('hidden');
  label.textContent = 'Reminder for ' + dateKey;
  document.getElementById('reminderText').focus();

  // Show existing reminders
  renderRemindersForDate(dateKey);
}

function renderRemindersForDate(dateKey) {
  const list = document.getElementById('remindersForDate');
  const rems = reminders[dateKey] || [];
  if (rems.length === 0) { list.classList.add('hidden'); return; }

  list.classList.remove('hidden');
  list.innerHTML = '<div style="font-size:11px;color:var(--muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:1px;">Reminders</div>' +
    rems.map((r, i) => `
      <div class="reminder-item">
        <span style="font-size:13px;">📌 ${r}</span>
        <button class="reminder-delete-btn" onclick="deleteReminder('${dateKey}', ${i})">✕</button>
      </div>
    `).join('');
}

function saveReminder() {
  if (!selectedDate) return;
  const text = document.getElementById('reminderText').value.trim();
  if (!text) { showToast('Enter a reminder'); return; }
  if (!reminders[selectedDate]) reminders[selectedDate] = [];
  reminders[selectedDate].push(text);
  saveReminders();
  document.getElementById('reminderText').value = '';
  renderCalendar();
  renderRemindersForDate(selectedDate);
  showToast('Reminder saved! 📌', 'success');
}

function deleteReminder(dateKey, index) {
  if (reminders[dateKey]) {
    reminders[dateKey].splice(index, 1);
    if (reminders[dateKey].length === 0) delete reminders[dateKey];
    saveReminders();
    renderCalendar();
    renderRemindersForDate(dateKey);
  }
}

function closeReminderInput() {
  document.getElementById('reminderInputArea').classList.add('hidden');
  document.getElementById('remindersForDate').classList.add('hidden');
  selectedDate = null;
  renderCalendar();
}

function changeMonth(dir) {
  calMonth += dir;
  if (calMonth < 0) { calMonth = 11; calYear--; }
  if (calMonth > 11) { calMonth = 0; calYear++; }
  renderCalendar();
}

// ============================================================
// KEYBOARD SHORTCUTS
// ============================================================
document.addEventListener('keydown', (e) => {
  // Space = toggle timer (when not in input)
  if (e.code === 'Space' && !['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) {
    e.preventDefault();
    toggleTimer();
  }
  // Esc = close panels
  if (e.key === 'Escape') {
    ['calculator','calendar','music'].forEach(closePanel);
  }
  // Enter in reminder input
  if (e.key === 'Enter' && e.target.id === 'reminderText') saveReminder();
  // Enter in add subject
  if (e.key === 'Enter' && (e.target.id === 'newSubjectName' || e.target.id === 'newSubjectHours')) addSubject();
});

// ============================================================
// WINDOW RESIZE – reposition panels
// ============================================================
window.addEventListener('resize', () => {
  ['calculator','calendar','music'].forEach(name => {
    const panel = document.getElementById(name + 'Panel');
    if (panel && !panel.classList.contains('hidden')) positionPanel(panel);
  });
});
