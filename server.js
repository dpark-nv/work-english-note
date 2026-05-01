import http from "node:http";
import { readFile, writeFile, mkdir, stat, readdir, rename, unlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "sentences.json");
const BACKUP_DIR = path.join(DATA_DIR, "backups");
const MAX_BACKUPS = Number(process.env.MAX_BACKUPS || 50);
const PORT = Number(process.env.PORT || 4177);
const HOST = process.env.HOST || "0.0.0.0";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini";
const APP_PASSWORD = process.env.APP_PASSWORD || "";
const APP_SECRET = process.env.APP_SECRET || APP_PASSWORD || "work-english-note-local";
const AUTH_COOKIE = "work_english_auth";
const DATABASE_URL = process.env.DATABASE_URL || "";
const USE_DATABASE = Boolean(DATABASE_URL);
const DATABASE_SSL = process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false };
const DATABASE_POOL_MAX = Number(process.env.DATABASE_POOL_MAX || 3);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

let storeQueue = Promise.resolve();
let databasePoolPromise = null;
let databaseInitPromise = null;

function hash(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function authToken() {
  return hash(`${APP_SECRET}:${APP_PASSWORD}`);
}

function parseCookies(req) {
  return Object.fromEntries(
    String(req.headers.cookie || "")
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const [key, ...value] = item.split("=");
        return [decodeURIComponent(key), decodeURIComponent(value.join("="))];
      })
  );
}

function isAuthenticated(req) {
  if (!APP_PASSWORD) return true;
  return parseCookies(req)[AUTH_COOKIE] === authToken();
}

function authCookieHeader(maxAge) {
  const parts = [
    `${AUTH_COOKIE}=${maxAge > 0 ? encodeURIComponent(authToken()) : ""}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`
  ];
  return parts.join("; ");
}

const stopWords = new Set([
  "about", "above", "after", "again", "against", "along", "already", "also", "although",
  "among", "because", "before", "being", "between", "could", "during", "every", "from",
  "have", "having", "into", "just", "more", "most", "only", "other", "over", "same",
  "should", "since", "some", "than", "that", "their", "them", "then", "there", "these",
  "they", "this", "through", "under", "until", "very", "were", "what", "when", "where",
  "which", "while", "with", "would", "your", "will", "been", "the", "you", "our",
  "ours", "his", "her", "hers", "its", "let", "let's", "and", "but", "for", "day",
  "end", "once"
]);

const dictionary = {
  align: "방향을 맞추다, 합의하다",
  aligned: "정렬된, 방향이 맞는",
  blocker: "진행을 막는 문제",
  consolidate: "통합하다, 정리하다",
  deliverable: "결과물, 산출물",
  dependency: "의존성, 선행 조건",
  escalate: "상위 단계로 올리다, 확대하다",
  feasible: "실현 가능한",
  follow: "따르다, 후속 조치하다",
  mitigate: "완화하다, 줄이다",
  prioritize: "우선순위를 정하다",
  proposal: "제안",
  review: "검토하다, 검토",
  shared: "공유했다",
  share: "공유하다",
  scope: "범위",
  timeline: "일정",
  update: "업데이트하다, 최신 정보",
  updated: "업데이트된",
  complete: "완료된",
  circle: "원을 그리다, 다시 돌아오다",
  back: "뒤로, 다시"
};

const idiomHints = [
  ["follow up", "후속 조치하다"],
  ["circle back", "나중에 다시 논의하다"],
  ["touch base", "간단히 연락해 상황을 맞추다"],
  ["move forward", "진행하다"],
  ["on track", "일정대로 진행 중인"],
  ["in terms of", "~의 관점에서"],
  ["take into account", "~을 고려하다"],
  ["as soon as", "~하자마자"],
  ["by end of day", "오늘 업무 종료 전까지"],
  ["at your earliest convenience", "가능한 한 빨리"],
  ["keep me posted", "계속 알려 주세요"],
  ["loop in", "논의에 포함시키다"],
  ["heads up", "미리 알림"],
  ["raise a concern", "우려를 제기하다"],
  ["get back to", "다시 연락하다"]
];

const commonVerbPattern =
  /\b(am|are|is|was|were|be|been|being|have|has|had|do|does|did|can|could|will|would|shall|should|may|might|must|need|needs|needed|want|wants|wanted|plan|plans|planned|review|reviews|reviewed|send|sends|sent|share|shares|shared|confirm|confirms|confirmed|align|aligns|aligned|update|updates|updated|follow|follows|followed|make|makes|made|take|takes|took|taken|go|goes|went|gone|meet|meets|met|discuss|discusses|discussed|provide|provides|provided)\b/i;

const analysisSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    translation: { type: "string" },
    naturalRewrite: { type: "string" },
    tone: { type: "string" },
    difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
    keywords: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          term: { type: "string" },
          meaningKo: { type: "string" },
          note: { type: "string" },
          type: { type: "string", enum: ["word", "phrase", "idiom", "grammar"] }
        },
        required: ["term", "meaningKo", "note", "type"]
      }
    },
    idioms: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          phrase: { type: "string" },
          meaningKo: { type: "string" },
          usageKo: { type: "string" }
        },
        required: ["phrase", "meaningKo", "usageKo"]
      }
    },
    structure: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          chunk: { type: "string" },
          role: { type: "string" },
          explanationKo: { type: "string" }
        },
        required: ["chunk", "role", "explanationKo"]
      }
    },
    grammar: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          point: { type: "string" },
          explanationKo: { type: "string" },
          example: { type: "string" }
        },
        required: ["point", "explanationKo", "example"]
      }
    },
    pronunciation: {
      type: "object",
      additionalProperties: false,
      properties: {
        ipa: { type: "string" },
        chunks: { type: "array", items: { type: "string" } },
        stress: { type: "string" },
        tips: { type: "array", items: { type: "string" } }
      },
      required: ["ipa", "chunks", "stress", "tips"]
    },
    reviewQuestions: { type: "array", items: { type: "string" } }
  },
  required: [
    "translation",
    "naturalRewrite",
    "tone",
    "difficulty",
    "keywords",
    "idioms",
    "structure",
    "grammar",
    "pronunciation",
    "reviewQuestions"
  ]
};

function emptyStore() {
  return { entries: [] };
}

function normalizeStore(store) {
  return {
    ...(store && typeof store === "object" ? store : {}),
    entries: Array.isArray(store?.entries) ? store.entries : []
  };
}

async function getDatabasePool() {
  if (!USE_DATABASE) return null;
  if (!databasePoolPromise) {
    databasePoolPromise = import("pg").then(({ default: pg }) => {
      const { Pool } = pg;
      return new Pool({
        connectionString: DATABASE_URL,
        ssl: DATABASE_SSL,
        max: Number.isFinite(DATABASE_POOL_MAX) && DATABASE_POOL_MAX > 0 ? DATABASE_POOL_MAX : 3,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000
      });
    });
  }
  return databasePoolPromise;
}

async function ensureDatabaseStore() {
  if (!USE_DATABASE) return;
  if (!databaseInitPromise) {
    databaseInitPromise = (async () => {
      const pool = await getDatabasePool();
      await pool.query(`
        create table if not exists work_english_note_store (
          id integer primary key,
          store jsonb not null,
          updated_at timestamptz not null default now()
        )
      `);
      await pool.query(
        `
          insert into work_english_note_store (id, store)
          values (1, $1::jsonb)
          on conflict (id) do nothing
        `,
        [JSON.stringify(emptyStore())]
      );
    })().catch((error) => {
      databaseInitPromise = null;
      throw error;
    });
  }
  await databaseInitPromise;
}

async function readDatabaseStore() {
  await ensureDatabaseStore();
  const pool = await getDatabasePool();
  const { rows } = await pool.query("select store from work_english_note_store where id = 1");
  return normalizeStore(rows[0]?.store);
}

async function updateDatabaseStore(mutator) {
  await ensureDatabaseStore();
  const pool = await getDatabasePool();
  const client = await pool.connect();

  try {
    await client.query("begin");
    const { rows } = await client.query("select store from work_english_note_store where id = 1 for update");
    const store = normalizeStore(rows[0]?.store);
    const result = await mutator(store);
    await client.query(
      "update work_english_note_store set store = $1::jsonb, updated_at = now() where id = 1",
      [JSON.stringify(store)]
    );
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function ensureFileStore() {
  await mkdir(DATA_DIR, { recursive: true });
  await mkdir(BACKUP_DIR, { recursive: true });
  try {
    await stat(DATA_FILE);
  } catch {
    await writeAtomic(DATA_FILE, JSON.stringify(emptyStore(), null, 2));
  }
}

async function readFileStore() {
  await ensureFileStore();
  const raw = await readFile(DATA_FILE, "utf8");
  try {
    const parsed = JSON.parse(raw);
    return normalizeStore(parsed);
  } catch {
    return emptyStore();
  }
}

async function writeAtomic(filePath, content) {
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempPath, content, "utf8");
  await rename(tempPath, filePath);
}

async function pruneBackups() {
  if (!Number.isFinite(MAX_BACKUPS) || MAX_BACKUPS <= 0) return;
  const files = (await readdir(BACKUP_DIR, { withFileTypes: true }))
    .filter((item) => item.isFile() && item.name.startsWith("sentences-") && item.name.endsWith(".json"))
    .map((item) => item.name)
    .sort()
    .reverse();

  await Promise.all(files.slice(MAX_BACKUPS).map((name) => unlink(path.join(BACKUP_DIR, name)).catch(() => {})));
}

async function backupCurrentStore() {
  try {
    const current = await readFile(DATA_FILE, "utf8");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    await writeFile(path.join(BACKUP_DIR, `sentences-${timestamp}.json`), current, "utf8");
    await pruneBackups();
  } catch {
    // Backups are best effort; the primary atomic write below is still the source of truth.
  }
}

async function writeStoreDirect(store) {
  await ensureFileStore();
  await backupCurrentStore();
  await writeAtomic(DATA_FILE, JSON.stringify(store, null, 2));
}

async function updateFileStore(mutator) {
  const operation = storeQueue.then(async () => {
    const store = await readFileStore();
    const result = await mutator(store);
    await writeStoreDirect(store);
    return result;
  });
  storeQueue = operation.catch(() => {});
  return operation;
}

async function ensureActiveStore() {
  if (USE_DATABASE) {
    await ensureDatabaseStore();
    return;
  }
  await ensureFileStore();
}

async function readStore() {
  return USE_DATABASE ? readDatabaseStore() : readFileStore();
}

async function updateStore(mutator) {
  return USE_DATABASE ? updateDatabaseStore(mutator) : updateFileStore(mutator);
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function sendText(res, statusCode, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(statusCode, {
    "Content-Type": contentType,
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  const text = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next.toISOString();
}

function normalizeEntryText(input) {
  return String(input || "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeTags(tags) {
  if (Array.isArray(tags)) {
    return tags.map(String).map((tag) => tag.trim()).filter(Boolean);
  }
  return String(tags || "")
    .split(/[,\s#]+/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function estimateDifficulty(sentence) {
  const words = sentence.match(/[A-Za-z']+/g) || [];
  const longWords = words.filter((word) => word.length >= 9).length;
  if (words.length > 24 || longWords >= 4 || /;|:|\bhowever\b|\balthough\b|\bwhereas\b/i.test(sentence)) {
    return "hard";
  }
  if (words.length > 13 || longWords >= 2 || /,|\bwhich\b|\bthat\b|\bwhile\b|\bif\b/i.test(sentence)) {
    return "medium";
  }
  return "easy";
}

function fallbackKeywords(sentence) {
  const words = (sentence.toLowerCase().match(/[a-z][a-z'-]{2,}/g) || [])
    .map((word) => word.replace(/^'|'$/g, ""))
    .filter((word) => !stopWords.has(word));

  const unique = [...new Set(words)];
  return unique
    .sort((a, b) => {
      const known = Number(Boolean(dictionary[b])) - Number(Boolean(dictionary[a]));
      return known || b.length - a.length;
    })
    .slice(0, 8)
    .map((word) => ({
      term: word,
      meaningKo: dictionary[word] || "AI 분석을 켜면 문맥에 맞는 뜻이 채워집니다.",
      note: dictionary[word] ? "업무 문맥에서 자주 쓰이는 표현입니다." : "기본 후보 단어입니다. 문맥 번역은 AI 분석에서 보강됩니다.",
      type: "word"
    }));
}

function fallbackIdioms(sentence) {
  const lower = sentence.toLowerCase();
  return idiomHints
    .filter(([phrase]) => lower.includes(phrase))
    .map(([phrase, meaningKo]) => ({
      phrase,
      meaningKo,
      usageKo: "업무 메일이나 미팅에서 자연스럽게 쓰이는 표현입니다."
    }));
}

function fallbackStructure(sentence) {
  const match = sentence.match(commonVerbPattern);
  if (!match || match.index === undefined) {
    return [
      {
        chunk: sentence,
        role: "전체 문장",
        explanationKo: "동사를 기준으로 한 구조 분석은 AI 분석을 켜면 더 정확해집니다."
      }
    ];
  }

  const subject = sentence.slice(0, match.index).trim();
  const predicate = sentence.slice(match.index).trim();
  const pieces = [];

  if (subject) {
    pieces.push({
      chunk: subject,
      role: "주어/도입부",
      explanationKo: "문장의 주체 또는 상황을 여는 부분입니다."
    });
  }

  pieces.push({
    chunk: predicate,
    role: "동사구/핵심 내용",
    explanationKo: "동사를 중심으로 요청, 상태, 행동, 조건이 이어지는 부분입니다."
  });

  return pieces;
}

function fallbackGrammar(sentence) {
  const grammar = [];
  if (/\b(should|could|would|might|may|can|must)\b/i.test(sentence)) {
    grammar.push({
      point: "Modal verb",
      explanationKo: "조동사가 가능성, 정중함, 의무, 제안을 표현합니다.",
      example: "Could you review this by tomorrow?"
    });
  }
  if (/\b(if|when|once|after|before|while|although|because)\b/i.test(sentence)) {
    grammar.push({
      point: "Subordinate clause",
      explanationKo: "접속사가 시간, 조건, 이유, 양보 같은 부가 정보를 연결합니다.",
      example: "If the timeline changes, please let me know."
    });
  }
  if (/\b(to\s+[a-z]+)\b/i.test(sentence)) {
    grammar.push({
      point: "To-infinitive",
      explanationKo: "to + 동사원형이 목적, 의도, 해야 할 일을 나타냅니다.",
      example: "We need to align on the scope."
    });
  }
  if (!grammar.length) {
    grammar.push({
      point: "Basic sentence pattern",
      explanationKo: "주어와 동사를 중심으로 핵심 의미를 잡고, 뒤의 전치사구나 목적어를 덧붙여 해석합니다.",
      example: "The team reviewed the proposal."
    });
  }
  return grammar;
}

function fallbackTranslation(sentence) {
  const lower = sentence.toLowerCase();
  if (/could you share/.test(lower) && /timeline/.test(lower) && /by end of day/.test(lower)) {
    return "오늘 업무 종료 전까지 업데이트된 일정을 공유해 주실 수 있을까요?";
  }
  if (/circle back/.test(lower) && /review/.test(lower) && /complete/.test(lower)) {
    return "검토가 완료되면 다시 논의합시다.";
  }
  if (/follow up/.test(lower)) {
    return "후속 조치를 하겠다는 의미의 업무 문장입니다. OPENAI_API_KEY를 설정하면 문맥에 맞게 다듬어집니다.";
  }
  if (/let me know/.test(lower)) {
    return "알려 달라는 요청 문장입니다. OPENAI_API_KEY를 설정하면 자연스러운 전체 번역이 생성됩니다.";
  }
  return "AI 분석 대기 중입니다. OPENAI_API_KEY를 설정하면 자연스러운 한국어 번역이 자동으로 생성됩니다.";
}

function chunkForSpeech(sentence) {
  const chunks = sentence
    .replace(/\s+/g, " ")
    .split(/,\s*|\s+(?:and|but|so|because|when|if|that|which)\s+/i)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
  return chunks.length ? chunks.slice(0, 5) : [sentence];
}

function fallbackAnalysis(sentence) {
  return {
    translation: fallbackTranslation(sentence),
    naturalRewrite: sentence,
    tone: "기본 분석",
    difficulty: estimateDifficulty(sentence),
    keywords: fallbackKeywords(sentence),
    idioms: fallbackIdioms(sentence),
    structure: fallbackStructure(sentence),
    grammar: fallbackGrammar(sentence),
    pronunciation: {
      ipa: "AI 분석을 켜면 IPA 표기가 보강됩니다.",
      chunks: chunkForSpeech(sentence),
      stress: "브라우저 발음 재생으로 억양과 끊어 읽기를 확인하세요.",
      tips: [
        "문장을 한 번에 읽기보다 의미 단위로 끊어 따라 읽어 보세요.",
        "재생 속도를 낮춘 뒤 같은 문장을 직접 소리 내어 반복하세요."
      ]
    },
    reviewQuestions: [
      "이 문장의 핵심 동사는 무엇인가요?",
      "업무 상황에서 같은 뜻을 더 정중하게 말하면 어떻게 바꿀 수 있을까요?"
    ]
  };
}

async function analyzeWithOpenAI(sentence, context = "") {
  if (!process.env.OPENAI_API_KEY) return fallbackAnalysis(sentence);

  const prompt = {
    sentence,
    context,
    instruction:
      "Analyze this English sentence for a Korean working professional. Explain in Korean. Keep the translation natural, not word-for-word. For pronunciation, provide IPA if confident and chunking/stress tips for native-like delivery."
  };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      reasoning: { effort: "low" },
      input: [
        {
          role: "system",
          content:
            "You are an expert Korean-English workplace language coach. Return only the requested JSON shape. Be precise, practical, and concise."
        },
        { role: "user", content: JSON.stringify(prompt) }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "english_sentence_note",
          schema: analysisSchema,
          strict: true
        }
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${errorText.slice(0, 400)}`);
  }

  const result = await response.json();
  const outputText =
    result.output_text ||
    result.output
      ?.flatMap((item) => item.content || [])
      ?.find((content) => content.type === "output_text" || content.type === "text")?.text;

  if (!outputText) throw new Error("OpenAI response did not include output_text.");
  return JSON.parse(outputText);
}

async function analyzeSentence(sentence, context = "") {
  try {
    return await analyzeWithOpenAI(sentence, context);
  } catch (error) {
    const fallback = fallbackAnalysis(sentence);
    fallback.translation = `${fallback.translation} 분석 오류: ${error.message}`;
    return fallback;
  }
}

function createEntry(sentence, body, analysis) {
  const now = new Date().toISOString();
  const tags = normalizeTags(body.tags);
  return {
    id: crypto.randomUUID(),
    text: sentence,
    context: String(body.context || "").trim(),
    sourceDate: body.sourceDate || todayIso(),
    createdAt: now,
    updatedAt: now,
    tags,
    favorite: false,
    status: "new",
    reviewCount: 0,
    lastReviewedAt: null,
    nextReviewAt: addDays(now, 1),
    analysis,
    notes: ""
  };
}

function publicEntry(entry) {
  return entry;
}

async function handleApi(req, res, pathname) {
  if (pathname === "/api/health" && req.method === "GET") {
    return sendJson(res, 200, { ok: true });
  }

  if (pathname === "/api/auth/status" && req.method === "GET") {
    return sendJson(res, 200, {
      authEnabled: Boolean(APP_PASSWORD),
      authenticated: isAuthenticated(req)
    });
  }

  if (pathname === "/api/auth/login" && req.method === "POST") {
    const body = await readBody(req);
    if (!APP_PASSWORD || body.password === APP_PASSWORD) {
      res.setHeader("Set-Cookie", authCookieHeader(60 * 60 * 24 * 30));
      return sendJson(res, 200, { ok: true });
    }
    return sendJson(res, 401, { error: "Password is incorrect.", authRequired: true });
  }

  if (pathname === "/api/auth/logout" && req.method === "POST") {
    res.setHeader("Set-Cookie", authCookieHeader(0));
    return sendJson(res, 200, { ok: true });
  }

  if (!isAuthenticated(req)) {
    return sendJson(res, 401, { error: "Authentication required.", authRequired: true });
  }

  if (pathname === "/api/status" && req.method === "GET") {
    return sendJson(res, 200, {
      ok: true,
      aiReady: Boolean(process.env.OPENAI_API_KEY),
      model: OPENAI_MODEL,
      storage: USE_DATABASE ? "postgres" : "file",
      dataFile: USE_DATABASE ? null : DATA_FILE,
      backupDir: USE_DATABASE ? null : BACKUP_DIR
    });
  }

  if (pathname === "/api/export" && req.method === "GET") {
    const store = await readStore();
    return sendJson(res, 200, {
      exportedAt: new Date().toISOString(),
      version: 1,
      entries: store.entries
    });
  }

  if (pathname === "/api/import" && req.method === "POST") {
    const body = await readBody(req);
    const incoming = Array.isArray(body.entries) ? body.entries : [];
    const mode = body.mode === "replace" ? "replace" : "merge";

    const imported = await updateStore((store) => {
      if (mode === "replace") {
        store.entries = incoming;
        return incoming.length;
      }

      const byId = new Map(store.entries.map((entry) => [entry.id, entry]));
      for (const entry of incoming) {
        if (!entry || typeof entry !== "object") continue;
        const id = entry.id || crypto.randomUUID();
        byId.set(id, { ...entry, id });
      }
      store.entries = [...byId.values()];
      return incoming.length;
    });

    return sendJson(res, 200, { ok: true, mode, imported });
  }

  if (pathname === "/api/entries" && req.method === "GET") {
    const store = await readStore();
    const entries = [...store.entries].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return sendJson(res, 200, { entries: entries.map(publicEntry) });
  }

  if (pathname === "/api/entries" && req.method === "POST") {
    const body = await readBody(req);
    const text = normalizeEntryText(body.text);
    if (!text) return sendJson(res, 400, { error: "No sentence text was provided." });

    const analysis = await analyzeSentence(text, body.context || "");
    const entry = createEntry(text, body, analysis);
    await updateStore((store) => {
      store.entries.push(entry);
      return entry;
    });
    return sendJson(res, 201, { entries: [entry] });
  }

  const entryMatch = pathname.match(/^\/api\/entries\/([^/]+)$/);
  if (entryMatch && req.method === "PATCH") {
    const id = decodeURIComponent(entryMatch[1]);
    const body = await readBody(req);
    const entry = await updateStore((store) => {
      const found = store.entries.find((item) => item.id === id);
      if (!found) return null;

      const allowed = ["text", "context", "sourceDate", "tags", "favorite", "status", "notes"];
      for (const key of allowed) {
        if (!(key in body)) continue;
        found[key] = key === "tags" ? normalizeTags(body[key]) : body[key];
      }
      found.updatedAt = new Date().toISOString();
      return found;
    });
    if (!entry) return sendJson(res, 404, { error: "Entry not found." });
    return sendJson(res, 200, { entry });
  }

  if (entryMatch && req.method === "DELETE") {
    const id = decodeURIComponent(entryMatch[1]);
    const deleted = await updateStore((store) => {
      const before = store.entries.length;
      store.entries = store.entries.filter((entry) => entry.id !== id);
      return store.entries.length !== before;
    });
    if (!deleted) return sendJson(res, 404, { error: "Entry not found." });
    return sendJson(res, 200, { ok: true });
  }

  const reanalyzeMatch = pathname.match(/^\/api\/entries\/([^/]+)\/reanalyze$/);
  if (reanalyzeMatch && req.method === "POST") {
    const id = decodeURIComponent(reanalyzeMatch[1]);
    const store = await readStore();
    const current = store.entries.find((item) => item.id === id);
    if (!current) return sendJson(res, 404, { error: "Entry not found." });
    const analysis = await analyzeSentence(current.text, current.context || "");
    const entry = await updateStore((latestStore) => {
      const found = latestStore.entries.find((item) => item.id === id);
      if (!found) return null;
      found.analysis = analysis;
      found.updatedAt = new Date().toISOString();
      return found;
    });
    if (!entry) return sendJson(res, 404, { error: "Entry not found." });
    return sendJson(res, 200, { entry });
  }

  const reviewMatch = pathname.match(/^\/api\/entries\/([^/]+)\/review$/);
  if (reviewMatch && req.method === "POST") {
    const id = decodeURIComponent(reviewMatch[1]);
    const body = await readBody(req);
    const quality = Math.max(0, Math.min(3, Number(body.quality ?? 2)));
    const entry = await updateStore((store) => {
      const found = store.entries.find((item) => item.id === id);
      if (!found) return null;

      const now = new Date().toISOString();
      const intervals = [1, 2, 4, 7];
      found.reviewCount = Number(found.reviewCount || 0) + 1;
      found.lastReviewedAt = now;
      found.nextReviewAt = addDays(now, intervals[quality]);
      found.status = quality >= 3 ? "mastered" : "reviewing";
      found.updatedAt = now;
      return found;
    });
    if (!entry) return sendJson(res, 404, { error: "Entry not found." });
    return sendJson(res, 200, { entry });
  }

  return sendJson(res, 404, { error: "Not found." });
}

async function serveStatic(req, res, pathname) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const resolved = path.normalize(path.join(PUBLIC_DIR, safePath));

  if (!resolved.startsWith(PUBLIC_DIR)) {
    return sendText(res, 403, "Forbidden");
  }

  try {
    const content = await readFile(resolved);
    const ext = path.extname(resolved).toLowerCase();
    res.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    res.end(content);
  } catch {
    sendText(res, 404, "Not found");
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url.pathname);
    } else {
      await serveStatic(req, res, url.pathname);
    }
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Internal server error." });
  }
});

function getLanUrls(port) {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((item) => item && item.family === "IPv4" && !item.internal)
    .map((item) => `http://${item.address}:${port}`)
    .sort();
}

await ensureActiveStore();
server.listen(PORT, HOST, () => {
  console.log(`Work English Note is running at http://localhost:${PORT}`);
  for (const url of getLanUrls(PORT)) {
    console.log(`LAN URL: ${url}`);
  }
  console.log(`Storage: ${USE_DATABASE ? "Postgres (DATABASE_URL)" : `file (${DATA_FILE})`}`);
  console.log(`AI analysis: ${process.env.OPENAI_API_KEY ? `on (${OPENAI_MODEL})` : "off (fallback mode)"}`);
});
