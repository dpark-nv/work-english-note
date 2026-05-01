const icons = {
  archive: '<svg viewBox="0 0 24 24"><path d="M3 7h18"/><path d="M5 7v12h14V7"/><path d="M9 11h6"/><path d="M6 3h12l3 4H3z"/></svg>',
  calendar:
    '<svg viewBox="0 0 24 24"><path d="M8 2v4"/><path d="M16 2v4"/><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18"/></svg>',
  database:
    '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></svg>',
  delete:
    '<svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v5"/><path d="M14 11v5"/></svg>',
  download:
    '<svg viewBox="0 0 24 24"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>',
  notebook:
    '<svg viewBox="0 0 24 24"><path d="M6 3h12a2 2 0 0 1 2 2v16H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M8 3v18"/><path d="M11 8h5"/><path d="M11 12h4"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14"/><path d="M5 12h14"/></svg>',
  refresh:
    '<svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 0 1-15.4 6.4L3 16"/><path d="M3 21v-5h5"/><path d="M3 12a9 9 0 0 1 15.4-6.4L21 8"/><path d="M16 8h5V3"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.1L12 17.2 6.4 20.1 7.5 14 3 9.6l6.2-.9z"/></svg>',
  sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.9 4.9 1.4 1.4"/><path d="m17.7 17.7 1.4 1.4"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m4.9 19.1 1.4-1.4"/><path d="m17.7 6.3 1.4-1.4"/></svg>',
  target: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3"/><path d="M12 19v3"/><path d="M2 12h3"/><path d="M19 12h3"/></svg>'
};

const emptyAnalysis = {
  translation: "",
  naturalRewrite: "",
  tone: "",
  difficulty: "easy",
  keywords: [],
  idioms: [],
  structure: [],
  grammar: [],
  pronunciation: { ipa: "", chunks: [], stress: "", tips: [] },
  reviewQuestions: []
};

const state = {
  entries: [],
  status: null,
  filter: "today",
  sort: "recent",
  search: "",
  selectedTag: "",
  selectedId: "",
  inspectorTab: "analysis",
  savingNotes: false
};

const el = {
  addButton: document.querySelector("#addButton"),
  aiState: document.querySelector("#aiState"),
  contextInput: document.querySelector("#contextInput"),
  entryForm: document.querySelector("#entryForm"),
  entryList: document.querySelector("#entryList"),
  exportButton: document.querySelector("#exportButton"),
  installButton: document.querySelector("#installButton"),
  inspectorContent: document.querySelector("#inspectorContent"),
  listSummary: document.querySelector("#listSummary"),
  loginError: document.querySelector("#loginError"),
  loginForm: document.querySelector("#loginForm"),
  loginScreen: document.querySelector("#loginScreen"),
  logoutButton: document.querySelector("#logoutButton"),
  passwordInput: document.querySelector("#passwordInput"),
  searchInput: document.querySelector("#searchInput"),
  sentenceInput: document.querySelector("#sentenceInput"),
  sourceDateInput: document.querySelector("#sourceDateInput"),
  statusLine: document.querySelector("#statusLine"),
  storageText: document.querySelector("#storageText"),
  tagCloud: document.querySelector("#tagCloud"),
  tagInput: document.querySelector("#tagInput")
};

const today = new Date().toISOString().slice(0, 10);
el.sourceDateInput.value = today;
let deferredInstallPrompt = null;

function mountIcons(root = document) {
  root.querySelectorAll("[data-icon]").forEach((node) => {
    const name = node.dataset.icon;
    if (icons[name]) node.innerHTML = icons[name];
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric" }).format(date);
}

function daysAgoDate(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function difficultyLabel(value) {
  return { easy: "쉬움", medium: "보통", hard: "어려움" }[value] || "보통";
}

function statusLabel(entry) {
  if (entry.status === "mastered") return "익숙함";
  if (isDue(entry)) return "복습";
  if (entry.status === "reviewing") return "진행 중";
  return "새 문장";
}

function isDue(entry) {
  if (!entry.nextReviewAt) return false;
  return new Date(entry.nextReviewAt).getTime() <= Date.now();
}

function analysisOf(entry) {
  return { ...emptyAnalysis, ...(entry?.analysis || {}) };
}

function entrySearchText(entry) {
  const analysis = analysisOf(entry);
  return [
    entry.text,
    entry.context,
    entry.notes,
    entry.tags?.join(" "),
    analysis.translation,
    analysis.naturalRewrite,
    analysis.keywords?.map((item) => `${item.term} ${item.meaningKo}`).join(" "),
    analysis.idioms?.map((item) => `${item.phrase} ${item.meaningKo}`).join(" ")
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function filteredEntries() {
  const query = state.search.trim().toLowerCase();
  const weekStart = daysAgoDate(6);
  let entries = [...state.entries];

  entries = entries.filter((entry) => {
    if (state.filter === "today") return entry.sourceDate === today;
    if (state.filter === "week") return entry.sourceDate >= weekStart;
    if (state.filter === "due") return isDue(entry);
    if (state.filter === "favorites") return Boolean(entry.favorite);
    return true;
  });

  if (state.selectedTag) {
    entries = entries.filter((entry) => entry.tags?.includes(state.selectedTag));
  }

  if (query) {
    entries = entries.filter((entry) => entrySearchText(entry).includes(query));
  }

  const difficultyWeight = { hard: 3, medium: 2, easy: 1 };
  entries.sort((a, b) => {
    if (state.sort === "due") {
      return new Date(a.nextReviewAt || 0).getTime() - new Date(b.nextReviewAt || 0).getTime();
    }
    if (state.sort === "hard") {
      return (difficultyWeight[analysisOf(b).difficulty] || 0) - (difficultyWeight[analysisOf(a).difficulty] || 0);
    }
    return String(b.createdAt).localeCompare(String(a.createdAt));
  });

  return entries;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && payload.authRequired) showLogin();
    throw new Error(payload.error || `Request failed: ${response.status}`);
  }
  return payload;
}

function showLogin() {
  el.loginScreen.hidden = false;
  el.passwordInput.focus();
}

function hideLogin() {
  el.loginScreen.hidden = true;
  el.loginError.textContent = "";
  el.passwordInput.value = "";
}

async function ensureAuthenticated() {
  const auth = await api("/api/auth/status");
  el.logoutButton.hidden = !auth.authEnabled;
  if (auth.authEnabled && !auth.authenticated) {
    showLogin();
    return false;
  }
  hideLogin();
  return true;
}

async function loadStatus() {
  state.status = await api("/api/status");
  el.aiState.classList.toggle("ready", state.status.aiReady);
  el.aiState.classList.toggle("fallback", !state.status.aiReady);
  el.aiState.innerHTML = `<span class="state-dot"></span>${
    state.status.aiReady ? `AI 분석 켜짐 · ${escapeHtml(state.status.model)}` : "기본 분석 모드"
  }`;
  el.storageText.textContent = "로컬 파일 저장 중";
}

async function loadEntries() {
  const payload = await api("/api/entries");
  state.entries = payload.entries || [];
  if (!state.selectedId && state.entries.length) state.selectedId = state.entries[0].id;
  render();
}

function render() {
  renderStats();
  renderTags();
  renderEntries();
  renderInspector();
  mountIcons();
}

function renderStats() {
  const todayCount = state.entries.filter((entry) => entry.sourceDate === today).length;
  const weekCount = state.entries.filter((entry) => entry.sourceDate >= daysAgoDate(6)).length;
  const dueCount = state.entries.filter(isDue).length;
  const favoriteCount = state.entries.filter((entry) => entry.favorite).length;
  const masteredCount = state.entries.filter((entry) => entry.status === "mastered").length;

  document.querySelector("#countToday").textContent = todayCount;
  document.querySelector("#countWeek").textContent = weekCount;
  document.querySelector("#countDue").textContent = dueCount;
  document.querySelector("#countFavorites").textContent = favoriteCount;
  document.querySelector("#countArchive").textContent = state.entries.length;
  document.querySelector("#statAddedToday").textContent = todayCount;
  document.querySelector("#statDue").textContent = dueCount;
  document.querySelector("#statMastered").textContent = masteredCount;

  const aiText = state.status?.aiReady ? "AI 분석이 자동으로 붙습니다." : "키 없이도 저장과 발음은 바로 됩니다.";
  el.statusLine.textContent = `${state.entries.length}개 문장 보관 중 · ${aiText}`;
}

function renderTags() {
  const counts = new Map();
  state.entries.forEach((entry) => {
    (entry.tags || []).forEach((tag) => counts.set(tag, (counts.get(tag) || 0) + 1));
  });

  if (!counts.size) {
    el.tagCloud.innerHTML = '<span class="tag-pill">태그 없음</span>';
    return;
  }

  const buttons = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(
      ([tag, count]) =>
        `<button class="tag-button ${state.selectedTag === tag ? "active" : ""}" type="button" data-tag="${escapeHtml(
          tag
        )}">#${escapeHtml(tag)} ${count}</button>`
    );

  const clear = state.selectedTag
    ? '<button class="tag-button" type="button" data-tag="">전체</button>'
    : "";
  el.tagCloud.innerHTML = clear + buttons.join("");
}

function renderEntries() {
  const entries = filteredEntries();
  el.listSummary.textContent = `${entries.length}개 문장${state.selectedTag ? ` · #${state.selectedTag}` : ""}`;

  if (!entries.length) {
    el.entryList.innerHTML = `
      <div class="empty-state" style="min-height: 260px;">
        <div class="empty-mark"><span class="nav-icon" data-icon="notebook"></span></div>
        <h2>조건에 맞는 문장이 없습니다</h2>
        <p>새 문장을 추가하거나 필터와 검색어를 바꿔 보세요.</p>
      </div>
    `;
    return;
  }

  el.entryList.innerHTML = entries
    .map((entry) => {
      const analysis = analysisOf(entry);
      const due = isDue(entry);
      const tags = (entry.tags || [])
        .slice(0, 3)
        .map((tag) => `<span class="tag-pill">#${escapeHtml(tag)}</span>`)
        .join("");
      return `
        <article class="sentence-card ${entry.id === state.selectedId ? "selected" : ""}" data-entry-id="${entry.id}">
          <div class="sentence-body">
            <div class="sentence-meta">
              <span class="status-pill ${due ? "due" : entry.status === "mastered" ? "mastered" : ""}">${statusLabel(entry)}</span>
              <span class="date-pill">${formatDate(entry.sourceDate)}</span>
              <span class="difficulty-pill">${difficultyLabel(analysis.difficulty)}</span>
              ${tags}
            </div>
            <p class="sentence-text">${escapeHtml(entry.text)}</p>
            <p class="translation-preview">${escapeHtml(analysis.translation || "분석 대기 중")}</p>
          </div>
          <div class="sentence-actions">
            <button class="icon-button" type="button" title="발음 재생" data-action="speak" data-id="${entry.id}">
              <span class="nav-icon" data-icon="play"></span>
            </button>
            <button class="icon-button ${entry.favorite ? "active" : ""}" type="button" title="즐겨찾기" data-action="favorite" data-id="${entry.id}">
              <span class="nav-icon" data-icon="star"></span>
            </button>
            <button class="icon-button" type="button" title="삭제" data-action="delete" data-id="${entry.id}">
              <span class="nav-icon" data-icon="delete"></span>
            </button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderInspector() {
  const entry = state.entries.find((item) => item.id === state.selectedId);
  if (!entry) {
    el.inspectorContent.innerHTML = document.querySelector("#emptyTemplate").innerHTML;
    return;
  }

  const analysis = analysisOf(entry);
  const tabs = [
    ["analysis", "분석"],
    ["words", "단어"],
    ["review", "복습"]
  ];

  el.inspectorContent.innerHTML = `
    <div class="detail-header">
      <p class="detail-date">${formatDate(entry.sourceDate)} · ${escapeHtml(entry.context || "업무 문장")}</p>
      <p class="detail-sentence">${escapeHtml(entry.text)}</p>
      <div class="detail-actions">
        <button class="text-button" type="button" data-detail-action="speak-normal">
          <span class="nav-icon" data-icon="play"></span>보통 속도
        </button>
        <button class="text-button" type="button" data-detail-action="speak-slow">
          <span class="nav-icon" data-icon="play"></span>느리게
        </button>
        <button class="text-button" type="button" data-detail-action="reanalyze">
          <span class="nav-icon" data-icon="refresh"></span>재분석
        </button>
      </div>
    </div>
    <div class="detail-tabs">
      ${tabs
        .map(
          ([id, label]) =>
            `<button class="${state.inspectorTab === id ? "active" : ""}" type="button" data-tab="${id}">${label}</button>`
        )
        .join("")}
    </div>
    ${renderInspectorTab(entry, analysis)}
  `;
}

function renderInspectorTab(entry, analysis) {
  if (state.inspectorTab === "words") {
    const idioms = analysis.idioms?.length
      ? analysis.idioms
      : [{ phrase: "감지된 숙어 없음", meaningKo: "이 문장에서는 명확한 숙어가 적습니다.", usageKo: "" }];
    return `
      <section class="detail-section">
        <div class="analysis-block">
          <h3>주요 단어</h3>
          <ul class="keyword-list">
            ${(analysis.keywords || [])
              .map(
                (item) => `
                  <li class="keyword-item">
                    <strong>${escapeHtml(item.term)} · ${escapeHtml(item.meaningKo)}</strong>
                    <span>${escapeHtml(item.note || item.type || "")}</span>
                  </li>
                `
              )
              .join("") || '<li class="keyword-item"><strong>단어 분석 대기 중</strong><span>AI 분석을 켜면 문맥 단어가 채워집니다.</span></li>'}
          </ul>
        </div>
        <div class="analysis-block">
          <h3>숙어와 표현</h3>
          <ul class="keyword-list">
            ${idioms
              .map(
                (item) => `
                  <li class="keyword-item">
                    <strong>${escapeHtml(item.phrase)} · ${escapeHtml(item.meaningKo)}</strong>
                    <span>${escapeHtml(item.usageKo || "")}</span>
                  </li>
                `
              )
              .join("")}
          </ul>
        </div>
      </section>
    `;
  }

  if (state.inspectorTab === "review") {
    return `
      <section class="detail-section">
        <div class="analysis-block">
          <h3>복습 질문</h3>
          <ul class="question-list">
            ${(analysis.reviewQuestions || [])
              .map((question) => `<li class="question-item"><strong>${escapeHtml(question)}</strong></li>`)
              .join("")}
          </ul>
        </div>
        <div class="analysis-block">
          <h3>복습 결과</h3>
          <div class="review-actions">
            <button class="review-button" type="button" data-review-quality="1">어려움</button>
            <button class="review-button" type="button" data-review-quality="2">보통</button>
            <button class="review-button" type="button" data-review-quality="3">익숙함</button>
          </div>
          <p>마지막 복습: ${entry.lastReviewedAt ? formatDate(entry.lastReviewedAt) : "아직 없음"} · 다음 복습: ${
      entry.nextReviewAt ? formatDate(entry.nextReviewAt) : "미정"
    }</p>
        </div>
        <div class="analysis-block">
          <h3>개인 메모</h3>
          <textarea class="notes-field" id="notesField" placeholder="내가 헷갈린 포인트나 실제 사용 맥락">${escapeHtml(
            entry.notes || ""
          )}</textarea>
        </div>
      </section>
    `;
  }

  return `
    <section class="detail-section">
      <div class="analysis-block">
        <h3>번역</h3>
        <p class="translation-main">${escapeHtml(analysis.translation)}</p>
      </div>
      <div class="analysis-block">
        <h3>자연스러운 대체 표현</h3>
        <p>${escapeHtml(analysis.naturalRewrite || entry.text)}</p>
      </div>
      <div class="analysis-block">
        <h3>문장 구조</h3>
        <ul class="chunk-list">
          ${(analysis.structure || [])
            .map(
              (item) => `
                <li class="chunk-item">
                  <strong>${escapeHtml(item.chunk)} · ${escapeHtml(item.role)}</strong>
                  <span>${escapeHtml(item.explanationKo)}</span>
                </li>
              `
            )
            .join("")}
        </ul>
      </div>
      <div class="analysis-block">
        <h3>문법 포인트</h3>
        <ul class="chunk-list">
          ${(analysis.grammar || [])
            .map(
              (item) => `
                <li class="chunk-item">
                  <strong>${escapeHtml(item.point)}</strong>
                  <span>${escapeHtml(item.explanationKo)} ${item.example ? `예: ${escapeHtml(item.example)}` : ""}</span>
                </li>
              `
            )
            .join("")}
        </ul>
      </div>
      <div class="analysis-block">
        <h3>발음</h3>
        <div class="pronunciation-box">
          <p><strong>IPA</strong> ${escapeHtml(analysis.pronunciation?.ipa || "")}</p>
          <p><strong>끊어 읽기</strong> ${(analysis.pronunciation?.chunks || []).map(escapeHtml).join(" / ")}</p>
          <p>${escapeHtml(analysis.pronunciation?.stress || "")}</p>
          <div class="pronunciation-actions">
            <button class="review-button" type="button" data-detail-action="speak-normal">
              <span class="nav-icon" data-icon="play"></span>보통 속도
            </button>
            <button class="review-button" type="button" data-detail-action="speak-slow">
              <span class="nav-icon" data-icon="play"></span>느리게
            </button>
          </div>
        </div>
      </div>
    </section>
  `;
}

function speak(text, rate = 1) {
  if (!("speechSynthesis" in window)) {
    showToast("이 브라우저에서는 발음 재생을 지원하지 않습니다.");
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const voices = window.speechSynthesis.getVoices();
  utterance.voice =
    voices.find((voice) => voice.lang === "en-US" && /natural|online|aria|jenny|guy/i.test(voice.name)) ||
    voices.find((voice) => voice.lang === "en-US") ||
    voices.find((voice) => voice.lang?.startsWith("en"));
  utterance.lang = utterance.voice?.lang || "en-US";
  utterance.rate = rate;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
}

function selectEntry(id) {
  state.selectedId = id;
  render();
}

function replaceEntry(updatedEntry) {
  state.entries = state.entries.map((entry) => (entry.id === updatedEntry.id ? updatedEntry : entry));
  render();
}

async function patchEntry(id, body) {
  const payload = await api(`/api/entries/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(body)
  });
  replaceEntry(payload.entry);
}

async function addEntries(event) {
  event.preventDefault();
  const text = el.sentenceInput.value.trim();
  if (!text) return;

  el.addButton.disabled = true;
  el.addButton.innerHTML = '<span class="nav-icon" data-icon="refresh"></span>분석 중';
  mountIcons(el.addButton);

  try {
    const payload = await api("/api/entries", {
      method: "POST",
      body: JSON.stringify({
        text,
        context: el.contextInput.value,
        tags: el.tagInput.value,
        sourceDate: el.sourceDateInput.value || today
      })
    });
    state.entries = [...(payload.entries || []), ...state.entries];
    state.selectedId = payload.entries?.[0]?.id || state.selectedId;
    el.sentenceInput.value = "";
    showToast("학습 노트 1개를 저장했습니다.");
    render();
  } catch (error) {
    showToast(error.message);
  } finally {
    el.addButton.disabled = false;
    el.addButton.innerHTML = '<span class="nav-icon" data-icon="plus"></span>추가 및 분석';
    mountIcons(el.addButton);
  }
}

async function handleEntryListClick(event) {
  const actionButton = event.target.closest("[data-action]");
  const card = event.target.closest("[data-entry-id]");
  if (!card) return;

  const id = actionButton?.dataset.id || card.dataset.entryId;
  const entry = state.entries.find((item) => item.id === id);
  if (!entry) return;

  if (!actionButton) {
    selectEntry(id);
    return;
  }

  event.stopPropagation();
  if (actionButton.dataset.action === "speak") speak(entry.text);
  if (actionButton.dataset.action === "favorite") await patchEntry(id, { favorite: !entry.favorite });
  if (actionButton.dataset.action === "delete") await deleteEntry(id);
}

async function deleteEntry(id) {
  const entry = state.entries.find((item) => item.id === id);
  if (!entry) return;
  const ok = window.confirm("이 문장을 삭제할까요?");
  if (!ok) return;
  await api(`/api/entries/${encodeURIComponent(id)}`, { method: "DELETE" });
  state.entries = state.entries.filter((item) => item.id !== id);
  if (state.selectedId === id) state.selectedId = state.entries[0]?.id || "";
  render();
}

async function handleInspectorClick(event) {
  const tab = event.target.closest("[data-tab]");
  if (tab) {
    state.inspectorTab = tab.dataset.tab;
    renderInspector();
    mountIcons(el.inspectorContent);
    return;
  }

  const entry = state.entries.find((item) => item.id === state.selectedId);
  if (!entry) return;

  const detailAction = event.target.closest("[data-detail-action]");
  if (detailAction) {
    const action = detailAction.dataset.detailAction;
    if (action === "speak-normal") speak(entry.text, 1);
    if (action === "speak-slow") speak(entry.text, 0.75);
    if (action === "reanalyze") await reanalyzeEntry(entry.id, detailAction);
    return;
  }

  const review = event.target.closest("[data-review-quality]");
  if (review) {
    const payload = await api(`/api/entries/${encodeURIComponent(entry.id)}/review`, {
      method: "POST",
      body: JSON.stringify({ quality: Number(review.dataset.reviewQuality) })
    });
    replaceEntry(payload.entry);
    showToast("복습 상태를 저장했습니다.");
  }
}

async function reanalyzeEntry(id, button) {
  const original = button.innerHTML;
  button.disabled = true;
  button.innerHTML = '<span class="nav-icon" data-icon="refresh"></span>분석 중';
  mountIcons(button);

  try {
    const payload = await api(`/api/entries/${encodeURIComponent(id)}/reanalyze`, { method: "POST" });
    replaceEntry(payload.entry);
    showToast("문장을 다시 분석했습니다.");
  } catch (error) {
    showToast(error.message);
  } finally {
    button.disabled = false;
    button.innerHTML = original;
    mountIcons(button);
  }
}

let noteTimer = 0;
function handleInspectorInput(event) {
  if (event.target.id !== "notesField") return;
  const entry = state.entries.find((item) => item.id === state.selectedId);
  if (!entry) return;
  entry.notes = event.target.value;
  clearTimeout(noteTimer);
  noteTimer = window.setTimeout(async () => {
    await patchEntry(entry.id, { notes: event.target.value });
  }, 550);
}

function exportMarkdown() {
  const lines = ["# Work English Sentence Notes", ""];
  filteredEntries().forEach((entry) => {
    const analysis = analysisOf(entry);
    lines.push(`## ${entry.text}`);
    lines.push("");
    lines.push(`- 날짜: ${entry.sourceDate}`);
    lines.push(`- 태그: ${(entry.tags || []).join(", ") || "없음"}`);
    lines.push(`- 번역: ${analysis.translation}`);
    lines.push(`- 대체 표현: ${analysis.naturalRewrite || entry.text}`);
    lines.push(`- 주요 단어: ${(analysis.keywords || []).map((item) => `${item.term}(${item.meaningKo})`).join(", ")}`);
    lines.push("");
  });

  const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `work-english-notes-${today}.md`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function showToast(message) {
  document.querySelector(".toast")?.remove();
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.append(toast);
  window.setTimeout(() => toast.remove(), 3200);
}

function bindEvents() {
  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      state.selectedTag = "";
      document.querySelectorAll("[data-filter]").forEach((item) => item.classList.toggle("active", item === button));
      render();
    });
  });

  document.querySelectorAll("[data-sort]").forEach((button) => {
    button.addEventListener("click", () => {
      state.sort = button.dataset.sort;
      document.querySelectorAll("[data-sort]").forEach((item) => item.classList.toggle("active", item === button));
      renderEntries();
      mountIcons(el.entryList);
    });
  });

  el.tagCloud.addEventListener("click", (event) => {
    const button = event.target.closest("[data-tag]");
    if (!button) return;
    state.selectedTag = button.dataset.tag;
    render();
  });

  el.entryForm.addEventListener("submit", addEntries);
  el.entryList.addEventListener("click", handleEntryListClick);
  el.inspectorContent.addEventListener("click", handleInspectorClick);
  el.inspectorContent.addEventListener("input", handleInspectorInput);
  el.searchInput.addEventListener("input", (event) => {
    state.search = event.target.value;
    renderEntries();
    mountIcons(el.entryList);
  });
  el.exportButton.addEventListener("click", exportMarkdown);
  el.loginForm.addEventListener("submit", login);
  el.logoutButton.addEventListener("click", logout);
  el.installButton.addEventListener("click", installApp);
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    el.installButton.hidden = false;
  });
  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    el.installButton.hidden = true;
    showToast("앱으로 설치했습니다.");
  });
}

async function init() {
  mountIcons();
  bindEvents();
  registerServiceWorker();
  try {
    const authenticated = await ensureAuthenticated();
    if (!authenticated) return;
    await loadStatus();
    await loadEntries();
  } catch (error) {
    state.status = { aiReady: false, model: "offline" };
    state.entries = [];
    el.aiState.classList.add("fallback");
    el.aiState.innerHTML = '<span class="state-dot"></span>서버 연결 필요';
    el.storageText.textContent = "서버 실행 대기 중";
    render();
    el.statusLine.textContent = "서버를 실행하면 문장 저장과 분석을 사용할 수 있습니다.";
    showToast(error.message);
  }
}

async function login(event) {
  event.preventDefault();
  el.loginError.textContent = "";
  try {
    await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ password: el.passwordInput.value })
    });
    hideLogin();
    await loadStatus();
    await loadEntries();
  } catch (error) {
    el.loginError.textContent = "비밀번호가 맞지 않습니다.";
  }
}

async function logout() {
  await api("/api/auth/logout", { method: "POST" }).catch(() => {});
  showLogin();
}

async function installApp() {
  if (!deferredInstallPrompt) {
    showToast("이 브라우저에서는 메뉴에서 앱 설치 또는 홈 화면 추가를 선택하세요.");
    return;
  }
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  el.installButton.hidden = true;
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (location.protocol !== "https:" && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") {
    return;
  }
  navigator.serviceWorker.register("service-worker.js").catch(() => {});
}

init();
