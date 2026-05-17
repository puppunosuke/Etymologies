// ストレージ層: ログイン中は Firestore、未ログインは localStorage を使う
//
// 呼び出し側（main.js, session.js 等）からは「ログインしてるかどうか」を
// 意識せずに使える。各 getter/setter は v2 時代と同じシグネチャ。
//
// 構造:
//   ログイン中  →  Firestore の /users/{uid}/data/main ドキュメントに全部詰める
//   未ログイン →  localStorage に v2 と同じ形式で保存
//
// メモリキャッシュを持つことで、操作のたびに通信しない。
// 認証状態が変わったらキャッシュを破棄して次回ロード時に取り直す。

import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import { auth, db } from "./firebase-init.js";

const PREFIX = "etym:";
const HISTORY_LIMIT = 1000;

const DEFAULTS = {
  settings: { direction: "en-ja", sessionSize: 20 },
  progress: {},
  lastRange: { min: 1, max: 100 },
  history: [],
};

// --- 認証状態の追跡 --------------------------------------------------------

let currentUser = null;
let cache = null; // 全データのメモリキャッシュ。null なら未ロード

// 初回の認証状態が確定するまで loadCache を待たせる Promise。
// これがないと、ページロード直後（onAuthStateChanged の初回コールバック前）に
// getSettings() などが呼ばれて localStorage 経路を誤って通ってしまう。
let resolveAuthReady;
const authReady = new Promise((r) => { resolveAuthReady = r; });

onAuthStateChanged(auth, (user) => {
  const userChanged = (currentUser?.uid ?? null) !== (user?.uid ?? null);
  currentUser = user;
  if (userChanged) {
    cache = null; // ユーザーが切り替わったら次回ロード時に取り直す
  }
  resolveAuthReady(); // 2回目以降は no-op
});

// --- キャッシュのロード／保存 ----------------------------------------------

async function loadCache() {
  if (cache !== null) return cache;
  await authReady;

  if (currentUser) {
    const ref = doc(db, "users", currentUser.uid, "data", "main");
    const snap = await getDoc(ref);
    if (snap.exists()) {
      cache = snap.data();
    } else {
      // 初回ログイン: そのデバイスの localStorage の進捗をクラウドへ吸い上げる
      // 注意: 2台目以降から初回ログインした場合はそのデバイスのローカル進捗が
      // 使われる。クラウド側に既にデータがあるなら snap.exists() が true になる
      // ので、ここには到達しない（クラウド優先）。
      cache = loadFromLocalStorage();
      await setDoc(ref, cache);
    }
  } else {
    cache = loadFromLocalStorage();
  }
  return cache;
}

async function saveCache() {
  if (currentUser) {
    const ref = doc(db, "users", currentUser.uid, "data", "main");
    await setDoc(ref, cache);
  } else {
    saveToLocalStorage(cache);
  }
}

function loadFromLocalStorage() {
  const out = {};
  for (const key of Object.keys(DEFAULTS)) {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw === null) {
      out[key] = structuredClone(DEFAULTS[key]);
      continue;
    }
    try {
      out[key] = JSON.parse(raw);
    } catch {
      out[key] = structuredClone(DEFAULTS[key]);
    }
  }
  return out;
}

function saveToLocalStorage(data) {
  for (const key of Object.keys(DEFAULTS)) {
    localStorage.setItem(PREFIX + key, JSON.stringify(data[key]));
  }
}

// --- 共通 get / set --------------------------------------------------------

async function get(key) {
  const c = await loadCache();
  return structuredClone(c[key] ?? DEFAULTS[key]);
}

async function set(key, value) {
  const c = await loadCache();
  c[key] = value;
  await saveCache();
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
  const c = await loadCache();
  c.history.push(entry);
  if (c.history.length > HISTORY_LIMIT) {
    c.history.splice(0, c.history.length - HISTORY_LIMIT);
  }
  await saveCache();
}

/**
 * 進捗データが空かどうか。初回起動（チュートリアル表示）判定に使う。
 */
export async function isFirstRun() {
  const progress = await getProgress();
  return Object.keys(progress).length === 0;
}
