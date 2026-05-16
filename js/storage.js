// ストレージ層: localStorage の読み書きを抽象化する
//
// すべての API を async にしてあるのは、将来 chrome.storage.sync
// （非同期 API）へ差し替えても呼び出し側を変えずに済むようにするため。
// 今は中身が同期的な localStorage でも、呼び出し側は await して使う。

const PREFIX = "etym:";

// 解答履歴の保持上限。これを超えたら古いものから捨てる（localStorage 肥大化の防止）
const HISTORY_LIMIT = 1000;

// 各キーのデフォルト値。保存値が無い／壊れているときはこれを返す
const DEFAULTS = {
  // 出題形式 direction: "en-ja"（英→日）or "ja-en"（日→英）
  settings: { direction: "en-ja", sessionSize: 20 },
  // 進捗データ: { "番号": { stage, nextDue } }
  progress: {},
  // 最後に使った出題レンジ。次回セッションの初期値になる
  lastRange: { min: 1, max: 100 },
  // 解答履歴: [{ n: 番号, result: "o"|"x", at: ISO文字列 }] を古い順に積む
  history: [],
};

async function get(key) {
  const raw = localStorage.getItem(PREFIX + key);
  if (raw === null) return structuredClone(DEFAULTS[key]);
  try {
    return JSON.parse(raw);
  } catch {
    // 壊れたデータはデフォルトで上書き回復
    return structuredClone(DEFAULTS[key]);
  }
}

async function set(key, value) {
  localStorage.setItem(PREFIX + key, JSON.stringify(value));
}

// --- 設定 ---
export const getSettings = () => get("settings");
export const setSettings = (v) => set("settings", v);

// --- 進捗データ（エビングハウス用の単語ごとの状態）---
export const getProgress = () => get("progress");
export const setProgress = (v) => set("progress", v);

// --- 最後に使ったレンジ ---
export const getLastRange = () => get("lastRange");
export const setLastRange = (v) => set("lastRange", v);

// --- 解答履歴 ---
export const getHistory = () => get("history");

/**
 * 解答1件を履歴の末尾に追加する。上限を超えたら古い方から間引く。
 * @param {{n:number, result:"o"|"x", at:string}} entry
 */
export async function appendHistory(entry) {
  const history = await get("history");
  history.push(entry);
  if (history.length > HISTORY_LIMIT) {
    history.splice(0, history.length - HISTORY_LIMIT);
  }
  await set("history", history);
}

/**
 * 進捗データが空かどうか。初回起動（チュートリアル表示）判定に使う。
 */
export async function isFirstRun() {
  const progress = await getProgress();
  return Object.keys(progress).length === 0;
}
