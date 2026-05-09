/* ============================================
   LifeOS Mobile · mobile.js
   复用网页端数据结构（localStorage projects）
   ============================================ */

// ----- 数据 keys（与网页端完全一致） -----
const PROJECTS_KEY = "projects";
const CURRENT_PROJECT_KEY = "current_project_id";
const STREAK_KEY = "streak";
const LAST_DATE_KEY = "lastDate";

// ----- 全局状态 -----
let currentTaskType = "daily"; // daily | temp
let currentFilter = "all";     // all | active | completed
let currentPage = "today";

// 滑动删除状态
let swipe = {
  active: false,
  el: null,
  startX: 0,
  startY: 0,
  dx: 0,
  locked: null  // 'x' | 'y'
};

// ============================================
// 数据层（与 script.js 共用同一份数据）
// ============================================
function getJSON(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch(e) { return null; }
}
function setJSON(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

function getProjects() {
  const p = getJSON(PROJECTS_KEY);
  return Array.isArray(p) ? p : [];
}
function saveProjects(p) { setJSON(PROJECTS_KEY, p); }

function getCurrentProjectId() {
  return localStorage.getItem(CURRENT_PROJECT_KEY) || "work";
}
function setCurrentProjectId(id) {
  localStorage.setItem(CURRENT_PROJECT_KEY, id);
}

function getCurrentProject() {
  const projects = getProjects();
  const id = getCurrentProjectId();
  return projects.find(p => p.id === id) || projects[0] || null;
}

function updateCurrentProject(mutator) {
  const projects = getProjects();
  const id = getCurrentProjectId();
  const idx = projects.findIndex(p => p.id === id);
  if (idx < 0) return;
  const cloned = {
    ...projects[idx],
    todos: {
      daily: Array.isArray(projects[idx].todos?.daily) ? [...projects[idx].todos.daily] : [],
      temp: Array.isArray(projects[idx].todos?.temp) ? [...projects[idx].todos.temp] : []
    },
    history: Array.isArray(projects[idx].history) ? [...projects[idx].history] : []
  };
  mutator(cloned);
  projects[idx] = cloned;
  saveProjects(projects);
}

// 初始化数据：如果 localStorage 完全没数据，建一个默认项目
function ensureInitialData() {
  const projects = getProjects();
  if (projects.length === 0) {
    saveProjects([{
      id: "work",
      name: "工作",
      todos: {
        daily: [
          { text: "吃饭", done: false },
          { text: "学习编程", done: false },
          { text: "运动", done: false }
        ],
        temp: []
      },
      history: [],
      createdAt: new Date().toISOString()
    }]);
    setCurrentProjectId("work");
  }
}

// 每日重置（凌晨过后所有 daily 任务恢复未完成）
function checkDailyReset() {
  const today = new Date().toDateString();
  const last = localStorage.getItem(LAST_DATE_KEY);
  if (last !== today) {
    const projects = getProjects().map(project => ({
      ...project,
      todos: {
        daily: (project.todos?.daily || []).map(t => ({ ...t, done: false })),
        temp: Array.isArray(project.todos?.temp) ? project.todos.temp : []
      }
    }));
    saveProjects(projects);
    localStorage.setItem(LAST_DATE_KEY, today);
  }
}

function readTodos(type) {
  const p = getCurrentProject();
  if (!p || !p.todos) return [];
  return type === "daily" ? (p.todos.daily || []) : (p.todos.temp || []);
}

function saveTodos(type, list) {
  updateCurrentProject(p => { p.todos[type] = list; });
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function isTempTodoVisible(todo) {
  if (!todo) return true;
  const today = getTodayKey();
  if (todo.visibleDate && today < todo.visibleDate) return false;
  if (todo.hideAfter && today > todo.hideAfter) return false;
  return true;
}

// 历史快照
function normalizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter(i => i && i.date && Array.isArray(i.daily) && Array.isArray(i.temp))
    .map(i => ({
      date: i.date,
      daily: i.daily.map(t => ({ text: t.text, done: !!t.done })),
      temp: i.temp.map(t => ({ text: t.text, done: !!t.done }))
    }));
}

function upsertHistorySnapshot(dateKey, daily, temp) {
  const project = getCurrentProject();
  if (!project) return;
  const history = normalizeHistory(project.history);
  const record = {
    date: dateKey,
    daily: daily.map(t => ({ text: t.text, done: !!t.done })),
    temp: temp.map(t => ({ text: t.text, done: !!t.done }))
  };
  const i = history.findIndex(x => x.date === dateKey);
  if (i >= 0) history[i] = record; else history.push(record);
  updateCurrentProject(p => { p.history = history; });
}

function ensureTodayHistorySnapshot() {
  const today = getTodayKey();
  const project = getCurrentProject();
  const history = normalizeHistory(project ? project.history : []);
  if (history.some(i => i.date === today)) return;
  upsertHistorySnapshot(today, readTodos("daily"), readTodos("temp"));
}

function refreshTodayHistorySnapshot() {
  upsertHistorySnapshot(getTodayKey(), readTodos("daily"), readTodos("temp"));
}

// ============================================
// 业务逻辑
// ============================================
function addTodo() {
  const input = document.getElementById("m-todo-input");
  const value = (input.value || "").trim();
  if (!value) {
    input.focus();
    return;
  }
  const list = readTodos(currentTaskType);
  list.push({ text: value, done: false });
  saveTodos(currentTaskType, list);
  refreshTodayHistorySnapshot();
  input.value = "";
  showToast(currentTaskType === "daily" ? "已添加到每日任务" : "已添加到临时任务");
  render();
}

function toggleTodo(type, index) {
  const list = readTodos(type);
  if (!list[index]) return;
  list[index].done = !list[index].done;
  saveTodos(type, list);
  refreshTodayHistorySnapshot();
  // 触觉反馈
  if (window.navigator.vibrate) window.navigator.vibrate(10);
  render();
}

function deleteTodo(type, index) {
  const list = readTodos(type);
  if (!list[index]) return;
  list.splice(index, 1);
  saveTodos(type, list);
  refreshTodayHistorySnapshot();
  render();
}

// 智能拆解（与网页端规则完全一致）
function getAiSubtasks(text) {
  const lc = text.toLowerCase();
  const rules = [
    {
      keywords: ["网站", "web", "网页", "前端", "页面"],
      tasks: [
        { text: "需求分析", priority: "high" },
        { text: "信息架构与页面规划", priority: "medium" },
        { text: "UI 设计与交互细化", priority: "medium" },
        { text: "核心功能开发", priority: "high" },
        { text: "联调与测试", priority: "low" }
      ]
    },
    {
      keywords: ["学习", "课程", "复习", "考试"],
      tasks: [
        { text: "拆分学习目标", priority: "high" },
        { text: "制定学习计划", priority: "high" },
        { text: "完成核心章节", priority: "medium" },
        { text: "做题与查漏补缺", priority: "medium" },
        { text: "总结与复盘", priority: "low" }
      ]
    },
    {
      keywords: ["项目", "开发", "app", "系统", "产品"],
      tasks: [
        { text: "明确范围与里程碑", priority: "high" },
        { text: "拆解模块与任务", priority: "high" },
        { text: "实现核心模块", priority: "high" },
        { text: "完善边界与异常处理", priority: "medium" },
        { text: "测试与发布准备", priority: "low" }
      ]
    }
  ];
  const matched = rules.find(r => r.keywords.some(k => lc.includes(k)));
  if (matched) return matched.tasks.slice(0, 6);
  return [
    { text: "明确目标与范围", priority: "high" },
    { text: "拆分可执行步骤", priority: "high" },
    { text: "先完成关键部分", priority: "medium" },
    { text: "检查结果并优化", priority: "low" }
  ];
}

function smartDecompose() {
  const input = document.getElementById("m-todo-input");
  const raw = (input.value || "").trim();
  if (!raw) {
    showToast("请先输入要拆解的任务");
    input.focus();
    return;
  }
  const subtasks = getAiSubtasks(raw);
  const temp = readTodos("temp");
  subtasks.forEach(t => {
    temp.push({
      text: `${t.text}（来自：${raw}）`,
      done: false,
      priority: t.priority,
      aiGenerated: true
    });
  });
  saveTodos("temp", temp);
  refreshTodayHistorySnapshot();
  input.value = "";
  // 拆解后跳到 临时 tab
  currentTaskType = "temp";
  if (window.navigator.vibrate) window.navigator.vibrate([10, 30, 10]);
  showToast(`已拆解为 ${subtasks.length} 个子任务`);
  render();
}

// ============================================
// 统计
// ============================================
function getTodaySummary() {
  const daily = readTodos("daily");
  const temp = readTodos("temp").filter(isTempTodoVisible);
  const all = [...daily, ...temp];
  const total = all.length;
  const done = all.filter(t => t.done).length;
  const undone = total - done;
  const rate = total === 0 ? 0 : Math.round(done * 100 / total);
  return { total, done, undone, rate };
}

function getDailySummary() {
  const daily = readTodos("daily");
  const total = daily.length;
  const done = daily.filter(t => t.done).length;
  const rate = total === 0 ? 0 : Math.round(done * 100 / total);
  return { total, done, rate };
}

function getSortedHistory() {
  const project = getCurrentProject();
  const history = normalizeHistory(project ? project.history : []);
  return history.slice().sort((a, b) => b.date.localeCompare(a.date));
}

function getStreakFromHistory(history) {
  // history 已按日期降序
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const record = history.find(h => h.date === key);
    if (!record) {
      if (i === 0) continue; // 今天没记录不算断
      break;
    }
    const all = [...record.daily, ...record.temp];
    if (all.length === 0) {
      if (i === 0) continue;
      break;
    }
    const allDone = all.every(t => t.done);
    if (allDone) streak++;
    else if (i > 0) break;
  }
  return streak;
}

function getLast7Days(history) {
  const out = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const r = history.find(h => h.date === key);
    if (!r) {
      out.push({ date: key, total: 0, done: 0, rate: 0 });
    } else {
      const all = [...r.daily, ...r.temp];
      const done = all.filter(t => t.done).length;
      out.push({
        date: key,
        total: all.length,
        done,
        rate: all.length === 0 ? 0 : Math.round(done * 100 / all.length)
      });
    }
  }
  return out; // 从今天到 6 天前
}

// ============================================
// 渲染
// ============================================
function render() {
  renderHeader();
  renderTodoList();
  renderProjectsPage();
  renderStatsPage();
  renderHistoryPage();
}

function renderHeader() {
  const project = getCurrentProject();
  const projectName = document.getElementById("m-current-project");
  if (projectName) projectName.textContent = project ? project.name : "未命名";

  const summary = getDailySummary();
  const label = document.getElementById("m-progress-label");
  const value = document.getElementById("m-progress-value");
  const fill = document.getElementById("m-progress-fill");
  if (label) label.textContent = `每日完成率 · ${summary.done}/${summary.total}`;
  if (value) value.textContent = summary.rate + "%";
  if (fill) fill.style.width = summary.rate + "%";
}

function renderTodoList() {
  const listEl = document.getElementById("m-todo-list");
  const emptyEl = document.getElementById("m-empty");
  if (!listEl) return;

  const raw = readTodos(currentTaskType);
  // 临时任务过滤可见性
  const indexed = raw
    .map((t, i) => ({ ...t, __index: i }))
    .filter(t => {
      if (currentTaskType === "temp" && !isTempTodoVisible(t)) return false;
      if (currentFilter === "active") return !t.done;
      if (currentFilter === "completed") return t.done;
      return true;
    });

  // 计数（基于全部可见任务，而不是 filter 过的）
  const dailyCount = readTodos("daily").length;
  const tempCount = readTodos("temp").filter(isTempTodoVisible).length;
  const dCountEl = document.getElementById("m-count-daily");
  const tCountEl = document.getElementById("m-count-temp");
  if (dCountEl) dCountEl.textContent = dailyCount;
  if (tCountEl) tCountEl.textContent = tempCount;

  // 空状态
  if (indexed.length === 0) {
    listEl.innerHTML = "";
    if (emptyEl) emptyEl.classList.remove("hidden");
    return;
  }
  if (emptyEl) emptyEl.classList.add("hidden");

  listEl.innerHTML = "";
  indexed.forEach(todo => {
    const wrap = document.createElement("li");
    wrap.className = "m-item-wrap";

    const item = document.createElement("div");
    item.className = "m-item";
    if (todo.done) item.classList.add("done");
    if (todo.aiGenerated) item.classList.add("ai-subtask");
    item.dataset.type = currentTaskType;
    item.dataset.index = String(todo.__index);

    // checkbox
    const cb = document.createElement("button");
    cb.className = "m-checkbox" + (todo.done ? " checked" : "");
    cb.setAttribute("aria-label", todo.done ? "标记为未完成" : "标记为完成");
    cb.innerHTML = '<span class="m-checkbox-tick">✓</span>';
    cb.addEventListener("click", function(e) {
      e.stopPropagation();
      toggleTodo(currentTaskType, todo.__index);
    });

    // body
    const body = document.createElement("div");
    body.className = "m-item-body";

    const text = document.createElement("div");
    text.className = "m-item-text";
    text.textContent = todo.text;

    if (todo.priority) {
      const badge = document.createElement("span");
      const labelMap = { high: "高", medium: "中", low: "低" };
      badge.className = "m-priority-badge m-priority-" + todo.priority;
      badge.textContent = labelMap[todo.priority] || todo.priority;
      text.appendChild(badge);
    }
    if (todo.aiGenerated) {
      const tag = document.createElement("span");
      tag.className = "m-ai-tag";
      tag.textContent = "AI";
      text.appendChild(tag);
    }

    body.appendChild(text);

    // 点击文本切换完成
    body.addEventListener("click", function() {
      toggleTodo(currentTaskType, todo.__index);
    });

    item.appendChild(cb);
    item.appendChild(body);
    wrap.appendChild(item);

    // 滑动删除
    bindSwipeDelete(item, currentTaskType, todo.__index);

    listEl.appendChild(wrap);
  });
}

function renderProjectsPage() {
  const listEl = document.getElementById("m-project-list");
  if (!listEl) return;
  const projects = getProjects();
  const currentId = getCurrentProjectId();
  listEl.innerHTML = "";
  projects.forEach(p => {
    const li = document.createElement("li");
    li.className = "m-project-card" + (p.id === currentId ? " active" : "");

    const left = document.createElement("div");
    left.className = "m-project-card-left";
    const name = document.createElement("div");
    name.className = "m-project-name";
    name.textContent = p.name;
    const meta = document.createElement("div");
    meta.className = "m-project-meta";
    const dailyN = (p.todos?.daily || []).length;
    const tempN = (p.todos?.temp || []).length;
    meta.textContent = `每日 ${dailyN} · 临时 ${tempN}`;
    left.appendChild(name);
    left.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "m-project-actions";
    if (p.id !== currentId) {
      const useBtn = document.createElement("button");
      useBtn.className = "m-project-pill primary";
      useBtn.textContent = "切换";
      useBtn.addEventListener("click", function() {
        setCurrentProjectId(p.id);
        showToast(`已切换到 ${p.name}`);
        currentTaskType = "daily";
        currentFilter = "all";
        switchPage("today");
        render();
      });
      actions.appendChild(useBtn);
    } else {
      const tag = document.createElement("span");
      tag.className = "m-project-pill";
      tag.textContent = "当前";
      tag.style.color = "var(--accent)";
      actions.appendChild(tag);
    }

    if (projects.length > 1) {
      const delBtn = document.createElement("button");
      delBtn.className = "m-project-pill";
      delBtn.textContent = "删除";
      delBtn.addEventListener("click", function() {
        if (!confirm(`确定删除项目 "${p.name}"？该项目下所有任务和历史都会被删除。`)) return;
        const remaining = getProjects().filter(x => x.id !== p.id);
        saveProjects(remaining);
        if (currentId === p.id) {
          setCurrentProjectId(remaining[0].id);
        }
        showToast(`已删除 ${p.name}`);
        render();
      });
      actions.appendChild(delBtn);
    }

    li.appendChild(left);
    li.appendChild(actions);
    listEl.appendChild(li);
  });
}

function renderStatsPage() {
  const todaySum = getTodaySummary();
  const history = getSortedHistory();
  const streak = getStreakFromHistory(history);
  const last7 = getLast7Days(history);

  // 统计卡
  const rateEl = document.getElementById("m-stat-rate");
  if (rateEl) rateEl.textContent = todaySum.rate + "%";
  const rateDetailEl = document.getElementById("m-stat-rate-detail");
  if (rateDetailEl) rateDetailEl.textContent = `${todaySum.done}/${todaySum.total} 任务`;
  const statFill = document.getElementById("m-stat-progress-fill");
  if (statFill) statFill.style.width = todaySum.rate + "%";
  const totalEl = document.getElementById("m-stat-total");
  if (totalEl) totalEl.textContent = todaySum.total;
  const totalDetailEl = document.getElementById("m-stat-total-detail");
  if (totalDetailEl) totalDetailEl.textContent = `已完成 ${todaySum.done} · 未完成 ${todaySum.undone}`;
  const streakEl = document.getElementById("m-stat-streak");
  if (streakEl) streakEl.textContent = streak;

  // 柱状图
  const chart = document.getElementById("m-chart");
  const chartLabels = document.getElementById("m-chart-labels");
  if (!chart || !chartLabels) return;
  chart.innerHTML = "";
  chartLabels.innerHTML = "";

  const reversed = last7.slice().reverse(); // 从旧到新
  const todayKey = getTodayKey();

  reversed.forEach(item => {
    const isToday = item.date === todayKey;

    const barItem = document.createElement("div");
    barItem.className = "m-bar-item";

    const pct = document.createElement("span");
    pct.className = "m-bar-pct";
    pct.textContent = item.total === 0 ? "" : item.rate + "%";

    const fill = document.createElement("div");
    fill.className = "m-bar-fill" + (isToday ? " today" : "") + (item.total === 0 ? " zero" : "");
    const heightPct = item.total === 0 ? 4 : Math.max(8, item.rate);
    fill.style.height = heightPct + "%";

    barItem.appendChild(pct);
    barItem.appendChild(fill);
    chart.appendChild(barItem);

    const label = document.createElement("div");
    label.className = "m-bar-label" + (isToday ? " today" : "");
    label.textContent = isToday ? "今天" : item.date.slice(5);
    chartLabels.appendChild(label);
  });
}

let selectedHistoryDate = null;
function renderHistoryPage() {
  const datesEl = document.getElementById("m-history-dates");
  const detailEl = document.getElementById("m-history-detail");
  if (!datesEl || !detailEl) return;

  const history = getSortedHistory();
  if (history.length === 0) {
    datesEl.innerHTML = "";
    detailEl.innerHTML = '<p class="m-history-empty">还没有历史记录</p>';
    return;
  }

  if (!selectedHistoryDate || !history.find(h => h.date === selectedHistoryDate)) {
    selectedHistoryDate = history[0].date;
  }

  // 日期 pills
  datesEl.innerHTML = "";
  history.forEach(h => {
    const btn = document.createElement("button");
    btn.className = "m-history-pill" + (h.date === selectedHistoryDate ? " active" : "");
    const isToday = h.date === getTodayKey();
    btn.textContent = isToday ? "今天" : h.date.slice(5);
    btn.addEventListener("click", function() {
      selectedHistoryDate = h.date;
      renderHistoryPage();
    });
    datesEl.appendChild(btn);
  });

  // 详情
  const sel = history.find(h => h.date === selectedHistoryDate);
  if (!sel) {
    detailEl.innerHTML = '<p class="m-history-empty">未找到记录</p>';
    return;
  }
  const dailyDone = sel.daily.filter(t => t.done).length;
  const tempDone = sel.temp.filter(t => t.done).length;

  detailEl.innerHTML = `
    <span class="m-history-section-title">📅 每日任务 ${dailyDone}/${sel.daily.length}</span>
    <div class="m-history-list">
      ${sel.daily.length === 0
        ? '<div class="m-history-item" style="color:var(--text-muted)">暂无</div>'
        : sel.daily.map(t => `<div class="m-history-item${t.done ? ' done' : ''}">${t.done ? '✅' : '⬜'} ${escapeHtml(t.text)}</div>`).join('')}
    </div>
    <span class="m-history-section-title">🧠 临时任务 ${tempDone}/${sel.temp.length}</span>
    <div class="m-history-list">
      ${sel.temp.length === 0
        ? '<div class="m-history-item" style="color:var(--text-muted)">暂无</div>'
        : sel.temp.map(t => `<div class="m-history-item${t.done ? ' done' : ''}">${t.done ? '✅' : '⬜'} ${escapeHtml(t.text)}</div>`).join('')}
    </div>
  `;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ============================================
// 滑动删除
// ============================================
function bindSwipeDelete(itemEl, type, index) {
  let startX = 0, startY = 0, dx = 0, locked = null, swiping = false;
  const wrap = itemEl.parentElement; // .m-item-wrap

  itemEl.addEventListener("touchstart", function(e) {
    if (e.touches.length !== 1) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    dx = 0;
    locked = null;
    swiping = false;
    itemEl.classList.add("swiping");
  }, { passive: true });

  itemEl.addEventListener("touchmove", function(e) {
    if (e.touches.length !== 1) return;
    const x = e.touches[0].clientX;
    const y = e.touches[0].clientY;
    const dxNow = x - startX;
    const dyNow = y - startY;

    if (locked === null) {
      if (Math.abs(dxNow) > 8 || Math.abs(dyNow) > 8) {
        locked = Math.abs(dxNow) > Math.abs(dyNow) ? "x" : "y";
      }
    }

    if (locked === "x") {
      // 只允许左滑
      dx = Math.min(0, dxNow);
      itemEl.style.transform = `translateX(${dx}px)`;
      // 滑动距离超过 12px 才显示删除背景，避免误触显示
      if (wrap && dx < -12) wrap.classList.add("is-swiping");
      else if (wrap) wrap.classList.remove("is-swiping");
      swiping = true;
      e.preventDefault && e.preventDefault();
    }
  }, { passive: false });

  itemEl.addEventListener("touchend", function() {
    itemEl.classList.remove("swiping");
    if (locked !== "x") {
      itemEl.style.transform = "";
      if (wrap) wrap.classList.remove("is-swiping");
      return;
    }
    if (dx < -88) {
      // 触发删除
      itemEl.classList.add("m-item-removing");
      setTimeout(function() {
        deleteTodo(type, index);
      }, 280);
    } else {
      itemEl.style.transform = "";
      if (wrap) wrap.classList.remove("is-swiping");
    }
  });

  itemEl.addEventListener("touchcancel", function() {
    itemEl.classList.remove("swiping");
    itemEl.style.transform = "";
    if (wrap) wrap.classList.remove("is-swiping");
  });
}

// ============================================
// 页面切换
// ============================================
function switchPage(page) {
  currentPage = page;
  document.querySelectorAll(".m-page").forEach(s => s.classList.remove("active"));
  const target = document.getElementById("page-" + page);
  if (target) target.classList.add("active");

  document.querySelectorAll(".m-tab").forEach(t => {
    t.classList.toggle("active", t.dataset.page === page);
  });

  document.body.classList.toggle("page-today", page === "today");
  // 切到不同页时刷新对应数据
  if (page === "stats") renderStatsPage();
  if (page === "history") renderHistoryPage();
  if (page === "projects") renderProjectsPage();

  window.scrollTo(0, 0);
}

// ============================================
// 抽屉
// ============================================
function openDrawer() {
  const drawer = document.getElementById("m-drawer");
  if (!drawer) return;
  renderDrawerList();
  drawer.classList.remove("hidden");
}

function closeDrawer() {
  const drawer = document.getElementById("m-drawer");
  if (!drawer) return;
  drawer.classList.add("hidden");
}

function renderDrawerList() {
  const listEl = document.getElementById("m-drawer-list");
  if (!listEl) return;
  const projects = getProjects();
  const currentId = getCurrentProjectId();
  listEl.innerHTML = "";
  projects.forEach(p => {
    const li = document.createElement("li");
    li.className = "m-drawer-item" + (p.id === currentId ? " active" : "");
    li.innerHTML = `<span>${escapeHtml(p.name)}</span>${p.id === currentId ? '<span class="m-drawer-item-check">✓</span>' : ''}`;
    li.addEventListener("click", function() {
      setCurrentProjectId(p.id);
      currentTaskType = "daily";
      currentFilter = "all";
      closeDrawer();
      showToast(`已切换到 ${p.name}`);
      render();
    });
    listEl.appendChild(li);
  });
}

// 创建项目
function createProject() {
  const name = prompt("项目名称（如：工作、副业、健身）", "");
  if (!name) return;
  const trimmed = name.trim();
  if (!trimmed) return;
  const projects = getProjects();
  if (projects.some(p => p.name === trimmed)) {
    showToast("已存在同名项目");
    return;
  }
  const newProject = {
    id: "p_" + Date.now(),
    name: trimmed,
    todos: { daily: [], temp: [] },
    history: [],
    createdAt: new Date().toISOString()
  };
  projects.push(newProject);
  saveProjects(projects);
  setCurrentProjectId(newProject.id);
  showToast(`已创建项目：${trimmed}`);
  render();
}

// ============================================
// Toast
// ============================================
let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById("m-toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.remove("hidden");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(function() {
    el.classList.add("hidden");
  }, 1800);
}

// ============================================
// 事件绑定
// ============================================
function bindEvents() {
  // 添加按钮
  document.getElementById("m-btn-add").addEventListener("click", addTodo);
  document.getElementById("m-btn-decompose").addEventListener("click", smartDecompose);

  // 输入框回车
  const input = document.getElementById("m-todo-input");
  input.addEventListener("keydown", function(e) {
    if (e.key === "Enter") {
      addTodo();
      input.blur();
    }
  });

  // segmented 切换
  document.querySelectorAll(".m-seg-btn").forEach(btn => {
    btn.addEventListener("click", function() {
      const type = btn.dataset.type;
      currentTaskType = type;
      document.querySelectorAll(".m-seg-btn").forEach(b => b.classList.toggle("active", b === btn));
      renderTodoList();
    });
  });

  // filter
  document.querySelectorAll(".m-filter-btn").forEach(btn => {
    btn.addEventListener("click", function() {
      currentFilter = btn.dataset.filter;
      document.querySelectorAll(".m-filter-btn").forEach(b => b.classList.toggle("active", b === btn));
      renderTodoList();
    });
  });

  // 底部 tab
  document.querySelectorAll(".m-tab").forEach(t => {
    t.addEventListener("click", function() {
      switchPage(t.dataset.page);
    });
  });

  // header 项目切换按钮（打开抽屉）
  document.getElementById("m-project-switch").addEventListener("click", openDrawer);

  // 抽屉背景点击关闭
  document.querySelector(".m-drawer-backdrop").addEventListener("click", closeDrawer);

  // 新项目
  document.getElementById("m-btn-new-project").addEventListener("click", createProject);
}

// ============================================
// 初始化
// ============================================
function init() {
  ensureInitialData();
  checkDailyReset();
  ensureTodayHistorySnapshot();
  bindEvents();
  document.body.classList.add("page-today");
  render();

  // 监听 storage 事件，与网页端同步
  window.addEventListener("storage", function(e) {
    if (e.key === PROJECTS_KEY || e.key === CURRENT_PROJECT_KEY) {
      render();
    }
  });

  // 页面可见时重新渲染（处理跨日重置等）
  document.addEventListener("visibilitychange", function() {
    if (!document.hidden) {
      checkDailyReset();
      render();
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
