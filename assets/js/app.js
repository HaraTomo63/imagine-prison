// セーブデータの保存キー
const STORAGE_KEYS = {
  slot: (slot) => `imagine-prison-slot-${slot}`
};

// システムの既定値
const DEFAULT_SYSTEM = {
  invalidAccessPenalty: 5,
};

// DOM参照
const elements = {
  identity: document.getElementById("identity"),
  action: document.getElementById("action"),
  supplement: document.getElementById("supplement"),
  executeBtn: document.getElementById("executeBtn"),
  log: document.getElementById("log"),
  resultOverlay: document.getElementById("resultOverlay"),
  resultText: document.getElementById("resultText"),
  resultStatus: document.getElementById("resultStatus"),
  confirmBtn: document.getElementById("confirmBtn"),
  statusKey: document.getElementById("statusKey"),
  statusBtn: document.getElementById("statusBtn"),
  statusOverlay: document.getElementById("statusOverlay"),
  statusBody: document.getElementById("statusBody"),
  statusCloseBtn: document.getElementById("statusCloseBtn"),
  effectLayer: document.getElementById("effectLayer"),
  flashLayer: document.getElementById("flashLayer"),
  gmOverlay: document.getElementById("gmOverlay"),
  gmCloseBtn: document.getElementById("gmCloseBtn"),
  gmConfirm: document.getElementById("gmConfirm"),
  gmConfirmText: document.getElementById("gmConfirmText"),
  gmConfirmYes: document.getElementById("gmConfirmYes"),
  gmConfirmNo: document.getElementById("gmConfirmNo"),
  slotMeta1: document.getElementById("slotMeta1"),
  slotMeta2: document.getElementById("slotMeta2"),
  slotMeta3: document.getElementById("slotMeta3")
};

// ランタイム状態
let players = {};
let actionRules = [];
let systemSettings = { ...DEFAULT_SYSTEM };
let logHistory = [];
let pendingGmAction = null;

const clampMp = (value) => Math.max(0, value);

const formatDelta = (value) => {
  if (value === 0) {
    return "±0";
  }
  return value > 0 ? `+${value}` : `${value}`;
};

const formatTime = () => {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
};

const normalizeIdentity = (value) => value.trim().toLowerCase();

const normalizeAction = (value) => value.trim();

const logLine = (text, recordHistory = true) => {
  const line = document.createElement("div");
  line.className = "log-line";
  line.textContent = `[${formatTime()}] ${text}`;
  elements.log.appendChild(line);
  elements.log.scrollTop = elements.log.scrollHeight;
  if (recordHistory) {
    logHistory.push(line.textContent);
  }
};

const renderIdleLog = () => {
  elements.log.innerHTML = "";
  logLine("SYSTEM READY. INPUT WAITING...", false);
};

const flashScreen = () => {
  elements.flashLayer.classList.add("active");
  window.setTimeout(() => {
    elements.flashLayer.classList.remove("active");
  }, 600);
};

const triggerEffect = (type, duration = 1800) => {
  if (!type) {
    return;
  }
  elements.effectLayer.className = "";
  elements.effectLayer.classList.add(type);
  window.setTimeout(() => {
    elements.effectLayer.className = "";
  }, duration);
};

const typeText = (element, text, speed = 18) =>
  new Promise((resolve) => {
    element.textContent = "";
    let index = 0;
    const tick = () => {
      element.textContent += text.charAt(index);
      index += 1;
      if (index < text.length) {
        window.setTimeout(tick, speed);
      } else {
        resolve();
      }
    };
    if (text.length === 0) {
      resolve();
      return;
    }
    tick();
  });

const anyPlayerLow = () =>
  Object.values(players).some((player) => player.mp <= 20);

const applyPenaltyToAll = (amount) => {
  Object.values(players).forEach((player) => {
    player.mp = clampMp(player.mp - amount);
  });
};

const buildStatusLine = (player, appliedMp, appliedCred) =>
  `MP ${player.mp} (${formatDelta(appliedMp)}) / CRED ${player.cred} (${formatDelta(
    appliedCred
  )})`;

// ローカル保存用のスナップショット
const buildSnapshot = () => ({
  version: 1,
  savedAt: new Date().toISOString(),
  players: JSON.parse(JSON.stringify(players)),
  logHistory: [...logHistory]
});

const saveSnapshot = (key) => {
  const payload = buildSnapshot();
  localStorage.setItem(key, JSON.stringify(payload));
  return payload;
};

const loadSnapshot = (key) => {
  const raw = localStorage.getItem(key);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
};

const applySnapshot = (snapshot) => {
  if (!snapshot || !snapshot.players) {
    return false;
  }
  players = JSON.parse(JSON.stringify(snapshot.players));
  logHistory = Array.isArray(snapshot.logHistory) ? [...snapshot.logHistory] : [];
  renderIdleLog();
  return true;
};
const formatSlotMeta = (snapshot) => {
  if (!snapshot) {
    return "EMPTY";
  }
  const saved = new Date(snapshot.savedAt);
  const stamp = saved.toLocaleString("ja-JP");
  const historyCount = snapshot.logHistory ? snapshot.logHistory.length : 0;
  return `SAVED: ${stamp}\nLOGS: ${historyCount}`;
};

const refreshSlotMeta = () => {
  elements.slotMeta1.textContent = formatSlotMeta(
    loadSnapshot(STORAGE_KEYS.slot(1))
  );
  elements.slotMeta2.textContent = formatSlotMeta(
    loadSnapshot(STORAGE_KEYS.slot(2))
  );
  elements.slotMeta3.textContent = formatSlotMeta(
    loadSnapshot(STORAGE_KEYS.slot(3))
  );
};

// GM画面の開閉と確認フロー
const openGmOverlay = () => {
  refreshSlotMeta();
  elements.gmConfirm.classList.add("hidden");
  elements.gmOverlay.classList.remove("hidden");
};

const closeGmOverlay = () => {
  elements.gmOverlay.classList.add("hidden");
  pendingGmAction = null;
};

const promptGmConfirm = (mode, slot) => {
  pendingGmAction = { mode, slot };
  elements.gmConfirmText.textContent =
    mode === "save"
      ? `SLOT ${slot} にセーブしますか？`
      : `SLOT ${slot} をロードしますか？`;
  elements.gmConfirm.classList.remove("hidden");
};

const resolveGmConfirm = () => {
  if (!pendingGmAction) {
    return;
  }
  const { mode, slot } = pendingGmAction;
  if (mode === "save") {
    saveSnapshot(STORAGE_KEYS.slot(slot));
    elements.gmConfirmText.textContent = `SLOT ${slot} にセーブ完了。`;
  } else {
    const snapshot = loadSnapshot(STORAGE_KEYS.slot(slot));
    if (snapshot) {
      applySnapshot(snapshot);
      elements.gmConfirmText.textContent = `SLOT ${slot} をロード完了。`;
    } else {
      elements.gmConfirmText.textContent = `SLOT ${slot} は空です。`;
    }
  }
  refreshSlotMeta();
  pendingGmAction = null;
  window.setTimeout(() => {
    elements.gmConfirm.classList.add("hidden");
    elements.gmConfirmText.textContent = "";
  }, 1200);
};

const hideGmConfirm = () => {
  elements.gmConfirm.classList.add("hidden");
  elements.gmConfirmText.textContent = "";
  pendingGmAction = null;
};

// JSONルールから最適な行動を選ぶ
const findActionRule = (identity, action, supplement) => {
  const candidates = actionRules.filter((rule) => rule.action === action);
  if (!candidates.length) {
    return null;
  }
  let best = null;
  let bestScore = -1;
  candidates.forEach((rule) => {
    if (rule.identity && rule.identity !== identity) {
      return;
    }
    if (rule.supplement && rule.supplement !== supplement) {
      return;
    }
    if (rule.supplementPattern) {
      try {
        const pattern = new RegExp(rule.supplementPattern);
        if (!pattern.test(supplement)) {
          return;
        }
      } catch (error) {
        return;
      }
    }
    let score = 0;
    if (rule.identity) {
      score += 2;
    }
    if (rule.supplement || rule.supplementPattern) {
      score += 1;
    }
    if (score > bestScore) {
      best = rule;
      bestScore = score;
    }
  });
  return best;
};

// 入力を処理して結果を返す
const performAction = (identityInput, actionInput, supplementInput) => {
  const identity = normalizeIdentity(identityInput);
  const action = normalizeAction(actionInput);
  const supplement = supplementInput.trim();

  if (!identity || !action) {
    return {
      text: "SYSTEM >> Identity と Action は必須入力です。",
      status: "NO STATE CHANGE",
      log: "SYSTEM / 入力不足"
    };
  }

  const player = players[identity];
  if (!player) {
    applyPenaltyToAll(systemSettings.invalidAccessPenalty);
    return {
      text:
        "先生 >> おや、不審なアクセスですね？ 教育が必要なようです。\n" +
        `警告: アクセスキー不一致。全囚人 MP -${systemSettings.invalidAccessPenalty}。`,
      status: "SYSTEM PENALTY",
      log: `SYSTEM / 不審アクセス / MP -${systemSettings.invalidAccessPenalty} (ALL)`,
      danger: true
    };
  }

  const actionRule = findActionRule(identity, action, supplement);
  if (!actionRule) {
    return {
      text: `${player.name} >> 未定義コマンド「${action}」。`,
      status: "NO STATE CHANGE",
      log: `${player.name} / ${action} / 未定義`
    };
  }

  const mpDelta = Number(actionRule.mp || 0);
  const credDelta = Number(actionRule.cred || 0);

  const beforeMp = player.mp;
  const beforeCred = player.cred;

  player.mp = clampMp(player.mp + mpDelta);
  player.cred += credDelta;

  const appliedMp = player.mp - beforeMp;
  const appliedCred = player.cred - beforeCred;

  const detail = supplement ? `補足: ${supplement}` : "補足: なし";
  const text = `${player.name} >> ${action}\n${detail}\n${actionRule.msg || ""}`.trim();

  return {
    text,
    status: buildStatusLine(player, appliedMp, appliedCred),
    log: `${player.name} / ${action} / MP ${formatDelta(appliedMp)} / CRED ${formatDelta(
      appliedCred
    )}`,
    effect: actionRule.effect || null,
    danger: player.mp <= 20 || anyPlayerLow()
  };
};

const showResult = async ({ text, status }) => {
  elements.executeBtn.disabled = true;
  elements.resultOverlay.classList.remove("hidden");
  await typeText(elements.resultText, text);
  elements.resultStatus.textContent = status;
};

const resetSession = () => {
  elements.identity.value = "";
  elements.action.value = "";
  elements.supplement.value = "";
  elements.resultText.textContent = "";
  elements.resultStatus.textContent = "";
  elements.resultOverlay.classList.add("hidden");
  elements.executeBtn.disabled = false;
  renderIdleLog();
  elements.identity.focus();
};

const showStatus = (player) => {
  elements.statusBody.textContent = [
    `NAME: ${player.name}`,
    `MP: ${player.mp}`,
    `CRED: ${player.cred}`,
    `SECRET: ${player.secret || "-"}`
  ].join("\n");
  elements.statusOverlay.classList.remove("hidden");
};

const clearStatus = () => {
  elements.statusBody.textContent = "";
  elements.statusOverlay.classList.add("hidden");
  elements.statusKey.value = "";
};

// GMコマンドは通常処理の前に判定
const handleExecute = async () => {
  const identityRaw = elements.identity.value.trim();
  const actionRaw = elements.action.value.trim();

  if (identityRaw.toLowerCase() === "gm" && actionRaw === "9999") {
    openGmOverlay();
    return;
  }

  flashScreen();
  const result = performAction(identityRaw, actionRaw, elements.supplement.value);
  logLine(result.log);

  if (result.effect) {
    triggerEffect(result.effect);
  }

  if (result.danger && !result.effect) {
    triggerEffect("danger", 2400);
  } else if (result.danger && result.effect) {
    window.setTimeout(() => triggerEffect("danger", 2000), 900);
  }

  await showResult(result);
};

// Status Check 用の一時表示
const handleStatusCheck = () => {
  const key = normalizeIdentity(elements.statusKey.value);
  const player = players[key];
  if (!player) {
    elements.statusBody.textContent =
      "SYSTEM >> アクセスキー不一致。表示データなし。";
    elements.statusOverlay.classList.remove("hidden");
    return;
  }
  showStatus(player);
};

// JSONデータを読み込む（失敗時は空データ）
const loadGameData = async () => {
  try {
    const response = await fetch("assets/data/game-data.json", {
      cache: "no-cache"
    });
    if (!response.ok) {
      throw new Error("Failed to load data");
    }
    return await response.json();
  } catch (error) {
    return {
      system: { ...DEFAULT_SYSTEM },
      players: {},
      actions: []
    };
  }
};

const applyInitialData = (data) => {
  systemSettings = { ...DEFAULT_SYSTEM, ...(data.system || {}) };
  players = JSON.parse(JSON.stringify(data.players || {}));
  actionRules = Array.isArray(data.actions) ? data.actions : [];
};

// 初期データ反映
const init = async () => {
  const data = await loadGameData();
  applyInitialData(data);
  renderIdleLog();
  elements.identity.focus();
};

document.querySelectorAll(".gm-save").forEach((button) => {
  button.addEventListener("click", () =>
    promptGmConfirm("save", Number(button.dataset.slot))
  );
});

document.querySelectorAll(".gm-load").forEach((button) => {
  button.addEventListener("click", () =>
    promptGmConfirm("load", Number(button.dataset.slot))
  );
});

elements.executeBtn.addEventListener("click", handleExecute);
elements.confirmBtn.addEventListener("click", resetSession);
elements.statusBtn.addEventListener("click", handleStatusCheck);
elements.statusCloseBtn.addEventListener("click", clearStatus);
elements.gmCloseBtn.addEventListener("click", closeGmOverlay);
elements.gmConfirmYes.addEventListener("click", resolveGmConfirm);
elements.gmConfirmNo.addEventListener("click", hideGmConfirm);

document.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !elements.resultOverlay.classList.contains("hidden")) {
    resetSession();
    return;
  }
  if (event.key === "Enter" && event.target.tagName === "INPUT") {
    handleExecute();
  }
  if (event.key === "Escape" && !elements.gmOverlay.classList.contains("hidden")) {
    closeGmOverlay();
  }
});

init();
