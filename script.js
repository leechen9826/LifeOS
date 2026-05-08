const dailyKey = "todos_daily";
const tempKey = "todos_temp";
const historyKey = "todo_history";
const projectsKey = "projects";
const currentProjectKey = "current_project_id";
let currentFilter = "all";
let draggingTodo = null;
let historyPanelVisible = false;
let selectedHistoryDate = null;
let dashboardPanelVisible = false;
const deleteAnimationMs = 120;

function get(key) {
  return JSON.parse(localStorage.getItem(key));
}

function save(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

function getStreak() {
  return parseInt(localStorage.getItem("streak"), 10) || 0;
}

function setStreak(value) {
  localStorage.setItem("streak", value);
}

function getProjects() {
  const projects = get(projectsKey);
  return Array.isArray(projects) ? projects : [];
}

function saveProjects(projects) {
  save(projectsKey, projects);
}

function getCurrentProjectId() {
  return localStorage.getItem(currentProjectKey) || "work";
}

function setCurrentProjectId(projectId) {
  localStorage.setItem(currentProjectKey, projectId);
}

function getCurrentProject() {
  const projects = getProjects();
  const currentId = getCurrentProjectId();
  return projects.find(function findProject(project) {
    return project.id === currentId;
  }) || projects[0] || null;
}

function updateCurrentProject(mutator) {
  const projects = getProjects();
  const currentId = getCurrentProjectId();
  const targetIndex = projects.findIndex(function findProject(project) {
    return project.id === currentId;
  });
  if (targetIndex < 0) return;

  const cloned = {
    ...projects[targetIndex],
    todos: {
      daily: Array.isArray(projects[targetIndex].todos?.daily)
        ? [...projects[targetIndex].todos.daily]
        : [],
      temp: Array.isArray(projects[targetIndex].todos?.temp)
        ? [...projects[targetIndex].todos.temp]
        : []
    },
    history: Array.isArray(projects[targetIndex].history)
      ? [...projects[targetIndex].history]
      : []
  };

  mutator(cloned);
  projects[targetIndex] = cloned;
  saveProjects(projects);
}

function ensureInitialData() {
  const daily = get(dailyKey);
  if (!Array.isArray(daily)) {
    save(dailyKey, [
      { text: "吃饭", done: false },
      { text: "学习编程", done: false },
      { text: "运动", done: false }
    ]);
  }

  const temp = get(tempKey);
  if (!Array.isArray(temp)) {
    save(tempKey, []);
  }

  const history = get(historyKey);
  if (!Array.isArray(history)) {
    save(historyKey, []);
  }

  const existingProjects = getProjects();
  if (existingProjects.length === 0) {
    const legacyDaily = get(dailyKey) || [];
    const legacyTemp = get(tempKey) || [];
    const legacyHistory = get(historyKey) || [];
    const defaultProject = {
      id: "work",
      name: "工作",
      todos: {
        daily: Array.isArray(legacyDaily) ? legacyDaily : [],
        temp: Array.isArray(legacyTemp) ? legacyTemp : []
      },
      history: normalizeHistory(legacyHistory),
      createdAt: new Date().toISOString()
    };
    saveProjects([defaultProject]);
  }

  if (!getCurrentProject()) {
    setCurrentProjectId("work");
  }
}

function checkDailyReset() {
  const today = new Date().toDateString();
  const lastDate = localStorage.getItem("lastDate");

  if (lastDate !== today) {
    const projects = getProjects().map(function resetProjectDaily(project) {
      const nextDaily = (project.todos?.daily || []).map(function mapDailyTodo(todo) {
        return {
          ...todo,
          done: false
        };
      });

      return {
        ...project,
        todos: {
          daily: nextDaily,
          temp: Array.isArray(project.todos?.temp) ? project.todos.temp : []
        }
      };
    });

    saveProjects(projects);
    localStorage.setItem("lastDate", today);
  }
}

function readTodos(type) {
  const project = getCurrentProject();
  if (!project || !project.todos) return [];
  return type === "daily" ? project.todos.daily || [] : project.todos.temp || [];
}

function saveTodos(type, list) {
  updateCurrentProject(function updateTodos(project) {
    project.todos[type] = list;
  });
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter(function isSnapshotRecord(item) {
      return item && item.date && Array.isArray(item.daily) && Array.isArray(item.temp);
    })
    .map(function normalizeRecord(item) {
      return {
        date: item.date,
        daily: item.daily.map(function cloneDaily(todo) {
          return { text: todo.text, done: !!todo.done };
        }),
        temp: item.temp.map(function cloneTemp(todo) {
          return { text: todo.text, done: !!todo.done };
        })
      };
    });
}

function upsertHistorySnapshot(dateKey, daily, temp) {
  const project = getCurrentProject();
  if (!project) return;
  const history = normalizeHistory(project.history);
  const nextRecord = {
    date: dateKey,
    daily: daily.map(function cloneDaily(todo) {
      return { text: todo.text, done: !!todo.done };
    }),
    temp: temp.map(function cloneTemp(todo) {
      return { text: todo.text, done: !!todo.done };
    })
  };
  const existingIndex = history.findIndex(function findByDate(item) {
    return item.date === dateKey;
  });

  if (existingIndex >= 0) {
    history[existingIndex] = nextRecord;
  } else {
    history.push(nextRecord);
  }

  updateCurrentProject(function updateHistory(targetProject) {
    targetProject.history = history;
  });
}

function ensureTodayHistorySnapshot() {
  const today = getTodayKey();
  const project = getCurrentProject();
  const history = normalizeHistory(project ? project.history : []);
  const exists = history.some(function hasToday(item) {
    return item.date === today;
  });
  if (exists) return;

  upsertHistorySnapshot(today, readTodos("daily"), readTodos("temp"));
}

function refreshTodayHistorySnapshot() {
  upsertHistorySnapshot(getTodayKey(), readTodos("daily"), readTodos("temp"));
}

function addTodo() {
  const input = document.getElementById("todo-input");
  const value = input.value.trim();
  const category = document.getElementById("category").value;

  if (!value) return;

  const list = readTodos(category);
  list.push({ text: value, done: false });
  saveTodos(category, list);
  refreshTodayHistorySnapshot();

  input.value = "";
  render();
}

function getAiSubtasksByRules(taskText) {
  const text = taskText.toLowerCase();
  const ruleMap = [
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

  const matchedRule = ruleMap.find(function matchRule(rule) {
    return rule.keywords.some(function hit(keyword) {
      return text.includes(keyword);
    });
  });

  if (matchedRule) return matchedRule.tasks.slice(0, 6);

  return [
    { text: "明确目标与范围", priority: "high" },
    { text: "拆分可执行步骤", priority: "high" },
    { text: "先完成关键部分", priority: "medium" },
    { text: "检查结果并优化", priority: "low" }
  ];
}

function smartDecomposeTask() {
  const input = document.getElementById("todo-input");
  const rawText = input.value.trim();
  if (!rawText) return;

  const subtasks = getAiSubtasksByRules(rawText);
  const temp = readTodos("temp");

  subtasks.forEach(function pushAiSubtask(task) {
    temp.push({
      text: `${task.text}（来自：${rawText}）`,
      done: false,
      priority: task.priority,
      aiGenerated: true
    });
  });

  saveTodos("temp", temp);
  refreshTodayHistorySnapshot();
  input.value = "";
  render();
}

function toggleTodo(type, index) {
  const list = readTodos(type);
  const target = list[index];

  if (!target) return;

  target.done = !target.done;
  saveTodos(type, list);
  refreshTodayHistorySnapshot();
  render();
}

function deleteTodo(type, index) {
  const list = readTodos(type);
  const target = list[index];

  if (!target) return;

  list.splice(index, 1);
  saveTodos(type, list);
  refreshTodayHistorySnapshot();
  render();
}

function deleteTodoWithAnimation(type, index, buttonEl) {
  if (!buttonEl) {
    deleteTodo(type, index);
    return;
  }

  const itemEl = buttonEl.closest(".item");
  if (!itemEl) {
    deleteTodo(type, index);
    return;
  }

  itemEl.style.opacity = "0";
  itemEl.style.transform = "translateY(6px)";
  itemEl.style.pointerEvents = "none";

  window.setTimeout(function runDelete() {
    deleteTodo(type, index);
  }, deleteAnimationMs);
}

function getStats(daily) {
  const total = daily.length;
  const done = daily.filter(function isDone(todo) {
    return todo.done;
  }).length;
  const rate = total === 0 ? 0 : Math.round((done / total) * 100);

  return { total, done, rate };
}

function matchFilter(todo) {
  if (currentFilter === "active") return !todo.done;
  if (currentFilter === "completed") return todo.done;
  return true;
}

function setFilter(nextFilter) {
  currentFilter = nextFilter;
  render();
}

function updateFilterButtons() {
  const allBtn = document.getElementById("filter-all");
  const activeBtn = document.getElementById("filter-active");
  const completedBtn = document.getElementById("filter-completed");

  if (!allBtn || !activeBtn || !completedBtn) return;

  allBtn.classList.toggle("active", currentFilter === "all");
  activeBtn.classList.toggle("active", currentFilter === "active");
  completedBtn.classList.toggle("active", currentFilter === "completed");
}

function onTodoDragStart(type, index) {
  draggingTodo = { type, index };
}

function onTodoDragOver(event) {
  event.preventDefault();
}

function onTodoDrop(type, targetIndex) {
  if (!draggingTodo) return;
  if (draggingTodo.type !== type) {
    draggingTodo = null;
    return;
  }

  const list = readTodos(type);
  const sourceIndex = draggingTodo.index;
  draggingTodo = null;

  if (
    sourceIndex === targetIndex ||
    sourceIndex < 0 ||
    targetIndex < 0 ||
    sourceIndex >= list.length ||
    targetIndex >= list.length
  ) {
    return;
  }

  const [moved] = list.splice(sourceIndex, 1);
  const insertIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
  list.splice(insertIndex, 0, moved);

  saveTodos(type, list);
  refreshTodayHistorySnapshot();
  render();
}

function getSortedHistory() {
  const project = getCurrentProject();
  const projectHistory = project ? project.history : [];
  return normalizeHistory(projectHistory).sort(function sortByDateDesc(a, b) {
    return b.date.localeCompare(a.date);
  });
}

function getTodaySummary() {
  const daily = readTodos("daily");
  const temp = readTodos("temp");
  const all = daily.concat(temp);
  const done = all.filter(function isDone(todo) {
    return todo.done;
  }).length;
  const total = all.length;
  const undone = total - done;
  const rate = total === 0 ? 0 : Math.round((done / total) * 100);

  return { total, done, undone, rate };
}

function getRecordDoneCount(record) {
  const dailyDone = record.daily.filter(function dailyDone(todo) {
    return todo.done;
  }).length;
  const tempDone = record.temp.filter(function tempDone(todo) {
    return todo.done;
  }).length;
  return dailyDone + tempDone;
}

function getStreakFromHistory(history) {
  const recordMap = {};
  history.forEach(function mapRecord(record) {
    recordMap[record.date] = getRecordDoneCount(record) > 0;
  });

  let streak = 0;
  const cursor = new Date();
  while (true) {
    const key = cursor.toISOString().slice(0, 10);
    if (!recordMap[key]) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function getLast7DaysStats(history) {
  const recordMap = {};
  history.forEach(function mapRecord(record) {
    recordMap[record.date] = {
      total: record.daily.length + record.temp.length,
      done: getRecordDoneCount(record)
    };
  });

  const result = [];
  const cursor = new Date();
  for (let i = 0; i < 7; i += 1) {
    const key = cursor.toISOString().slice(0, 10);
    const current = recordMap[key] || { total: 0, done: 0 };
    const rate = current.total === 0 ? 0 : Math.round((current.done / current.total) * 100);
    result.push({
      date: key,
      done: current.done,
      total: current.total,
      rate
    });
    cursor.setDate(cursor.getDate() - 1);
  }

  return result;
}

function selectHistoryDate(dateKey) {
  selectedHistoryDate = dateKey;
  renderHistoryPanel();
}

function toggleHistoryPanel() {
  historyPanelVisible = !historyPanelVisible;
  const panel = document.getElementById("history-panel");
  if (!panel) return;
  panel.classList.toggle("hidden", !historyPanelVisible);
  renderHistoryPanel();
}

function toggleDashboardPanel() {
  dashboardPanelVisible = !dashboardPanelVisible;
  const panel = document.getElementById("dashboard-panel");
  const button = document.getElementById("dashboard-toggle");
  if (!panel) return;
  panel.classList.toggle("hidden", !dashboardPanelVisible);
  if (button) button.classList.toggle("active", dashboardPanelVisible);
  renderDashboardPanel();
}

function createProject() {
  const input = window.prompt("请输入项目名称");
  const name = input ? input.trim() : "";
  if (!name) return;

  const projects = getProjects();
  const idBase = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-_]/g, "");
  const base = idBase || `project-${Date.now()}`;
  let id = base;
  let suffix = 1;
  while (projects.some(function hasSameId(project) { return project.id === id; })) {
    suffix += 1;
    id = `${base}-${suffix}`;
  }

  projects.push({
    id,
    name,
    todos: { daily: [], temp: [] },
    history: [],
    createdAt: new Date().toISOString()
  });
  saveProjects(projects);
  setCurrentProjectId(id);
  selectedHistoryDate = null;
  render();
}

function switchProject(projectId) {
  setCurrentProjectId(projectId);
  selectedHistoryDate = null;
  render();
}

function deleteProject(projectId) {
  const projects = getProjects();
  if (projects.length <= 1) {
    window.alert("至少保留一个项目");
    return;
  }
  const target = projects.find(function findProject(project) {
    return project.id === projectId;
  });
  if (!target) return;
  const confirmed = window.confirm(`删除项目「${target.name}」？`);
  if (!confirmed) return;

  const nextProjects = projects.filter(function keepProject(project) {
    return project.id !== projectId;
  });
  saveProjects(nextProjects);
  if (getCurrentProjectId() === projectId) {
    setCurrentProjectId(nextProjects[0].id);
  }
  selectedHistoryDate = null;
  render();
}

function renderProjectBar() {
  const listEl = document.getElementById("project-list");
  if (!listEl) return;

  const currentId = getCurrentProjectId();
  const projects = getProjects();
  listEl.innerHTML = "";

  projects.forEach(function renderProjectItem(project) {
    const item = document.createElement("div");
    item.className = `project-item${project.id === currentId ? " active" : ""}`;

    const nameBtn = document.createElement("button");
    nameBtn.className = "project-switch";
    nameBtn.textContent = project.name;
    nameBtn.onclick = function onSwitchProject() {
      switchProject(project.id);
    };

    const removeBtn = document.createElement("button");
    removeBtn.className = "project-remove";
    removeBtn.textContent = "×";
    removeBtn.onclick = function onDeleteProject(event) {
      event.stopPropagation();
      deleteProject(project.id);
    };

    item.appendChild(nameBtn);
    item.appendChild(removeBtn);
    listEl.appendChild(item);
  });
}

function renderHistoryPanel() {
  const panel = document.getElementById("history-panel");
  const dateListEl = document.getElementById("history-date-list");
  const detailTitleEl = document.getElementById("history-detail-title");
  const detailContentEl = document.getElementById("history-detail-content");

  if (!panel || !dateListEl || !detailTitleEl || !detailContentEl) return;
  panel.classList.toggle("hidden", !historyPanelVisible);
  if (!historyPanelVisible) return;

  const history = getSortedHistory();
  if (!selectedHistoryDate && history.length > 0) {
    selectedHistoryDate = history[0].date;
  }

  dateListEl.innerHTML = "";
  history.forEach(function renderHistoryDate(item) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.textContent = item.date;
    btn.classList.toggle("active", item.date === selectedHistoryDate);
    btn.onclick = function onSelectDate() {
      selectHistoryDate(item.date);
    };
    li.appendChild(btn);
    dateListEl.appendChild(li);
  });

  const selected = history.find(function findSelected(item) {
    return item.date === selectedHistoryDate;
  });

  if (!selected) {
    detailTitleEl.textContent = "暂无历史记录";
    detailContentEl.innerHTML = "";
    return;
  }

  const dailyDone = selected.daily.filter(function isDone(todo) {
    return todo.done;
  }).length;
  const tempDone = selected.temp.filter(function isDone(todo) {
    return todo.done;
  }).length;

  detailTitleEl.textContent = selected.date;
  detailContentEl.innerHTML = `
    <div>每日任务：${dailyDone}/${selected.daily.length}</div>
    <ul>${selected.daily
      .map(function renderDaily(todo) {
        return `<li>${todo.done ? "✅" : "⬜"} ${todo.text}</li>`;
      })
      .join("")}</ul>
    <div>临时任务：${tempDone}/${selected.temp.length}</div>
    <ul>${selected.temp
      .map(function renderTemp(todo) {
        return `<li>${todo.done ? "✅" : "⬜"} ${todo.text}</li>`;
      })
      .join("")}</ul>
  `;
}

function renderDashboardPanel() {
  const panel = document.getElementById("dashboard-panel");
  if (!panel) return;
  panel.classList.toggle("hidden", !dashboardPanelVisible);
  if (!dashboardPanelVisible) return;

  const rateEl = document.getElementById("dashboard-rate");
  const rateDetailEl = document.getElementById("dashboard-rate-detail");
  const totalEl = document.getElementById("dashboard-count-total");
  const countDetailEl = document.getElementById("dashboard-count-detail");
  const streakEl = document.getElementById("dashboard-streak");
  const last7El = document.getElementById("dashboard-last7");
  const history = getSortedHistory();
  const todaySummary = getTodaySummary();
  const streak = getStreakFromHistory(history);
  const last7 = getLast7DaysStats(history);

  setStreak(streak);

  if (rateEl) rateEl.textContent = `${todaySummary.rate}%`;
  if (rateDetailEl) {
    rateDetailEl.textContent = `${todaySummary.done}/${todaySummary.total}（daily + temp）`;
  }
  if (totalEl) totalEl.textContent = `${todaySummary.total}`;
  if (countDetailEl) {
    countDetailEl.textContent = `已完成 ${todaySummary.done} · 未完成 ${todaySummary.undone}`;
  }
  if (streakEl) streakEl.textContent = `${streak} 天`;

  if (!last7El) return;
  last7El.innerHTML = "";
  last7.forEach(function renderLast7(item) {
    const li = document.createElement("li");
    li.innerHTML = `<span>${item.date}</span><span>${item.done}/${item.total} · ${item.rate}%</span>`;
    last7El.appendChild(li);
  });
}

function renderList(targetEl, list, type) {
  targetEl.innerHTML = "";

  list.forEach(function renderTodo(todo, index) {
    const todoIndex = Object.prototype.hasOwnProperty.call(todo, "__index")
      ? todo.__index
      : index;
    const li = document.createElement("li");
    li.className = todo.aiGenerated ? "item ai-subtask" : "item";
    if (todo.done) li.classList.add("done");
    li.draggable = true;
    li.ondragstart = function onDragStart() {
      onTodoDragStart(type, todoIndex);
    };
    li.ondragover = onTodoDragOver;
    li.ondrop = function onDrop(event) {
      onTodoDragOver(event);
      onTodoDrop(type, todoIndex);
    };

    const priorityLabelMap = {
      high: "高优先级",
      medium: "中优先级",
      low: "低优先级"
    };
    const priorityBadge = todo.priority
      ? `<span class="priority-badge priority-${todo.priority}">${priorityLabelMap[todo.priority] || todo.priority}</span>`
      : "";

    li.innerHTML = `
      <span onclick="toggleTodo('${type}', ${todoIndex})">
        ${todo.done ? "✅" : "⬜"} ${todo.text} ${priorityBadge}
      </span>
      <button onclick="deleteTodoWithAnimation('${type}', ${todoIndex}, this)" style="margin-left:auto;">
        🗑
      </button>
    `;

    targetEl.appendChild(li);
  });
}

function render() {
  renderProjectBar();
  const currentProject = getCurrentProject();
  if (!currentProject) return;

  const daily = readTodos("daily");
  const temp = readTodos("temp");
  const dailyList = document.getElementById("daily-list");
  const tempList = document.getElementById("temp-list");
  const statsEl = document.getElementById("stats");

  const filteredDaily = daily
    .map(function mapDaily(todo, index) {
      return { ...todo, __index: index };
    })
    .filter(function dailyByFilter(todo) {
      return matchFilter(todo);
    });

  const filteredTemp = temp
    .map(function mapTemp(todo, index) {
      return { ...todo, __index: index };
    })
    .filter(function tempByFilter(todo) {
      return matchFilter(todo);
    });

  renderList(dailyList, filteredDaily, "daily");
  renderList(tempList, filteredTemp, "temp");
  updateFilterButtons();

  const stats = getStats(daily);
  statsEl.textContent = `项目「${currentProject.name}」每日完成率：${stats.rate}%（${stats.done}/${stats.total}）`;
  renderHistoryPanel();
  renderDashboardPanel();
}

function init() {
  ensureInitialData();
  checkDailyReset();
  ensureTodayHistorySnapshot();
  render();
}

init();