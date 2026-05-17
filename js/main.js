// エントリポイント: データ層・セッション・UI を配線してアプリ全体を統括する
//
// v2 構成。フラッシュカードがメイン。語源ビューア（FAB）と設定（ドロワー）は
// それぞれ後続フェーズで配線する。

import { loadEntries, getEntry, RANGE } from "./data.js";
import {
  getSettings, setSettings, getLastRange, setLastRange,
  isFirstRun, getProgress, getHistory,
} from "./storage.js";
import { startSession, judge, getSession } from "./flashcard/session.js";
import { initEtymology, showWord } from "./etymology/viewer.js";
import { signInWithGoogle, signOutUser, watchAuthState } from "./auth.js";
import * as ui from "./flashcard/ui.js";

let settings = null;
let currentEntry = null;
let etymOpen = false; // 語源ビューア（全画面オーバーレイ）が開いているか

async function main() {
  try {
    await loadEntries();
  } catch (err) {
    console.error(err);
    document.body.innerHTML =
      `<p style="color:#c33;padding:2rem">データ読み込みに失敗しました: ${err.message}</p>`;
    return;
  }

  settings = await getSettings();

  // 開始ビューのレンジ入力に前回値を反映
  const lastRange = await getLastRange();
  document.getElementById("rangeMin").value = lastRange.min;
  document.getElementById("rangeMax").value = lastRange.max;

  // 設定ドロワーの表示を現在の設定値に合わせる
  renderSettings();

  wireEvents();

  // ログイン状態を監視してドロワーのアカウントセクションを切り替える
  watchAuthState(renderAccount);

  // 進捗データが空（＝まだ一度も学習していない）なら初回ビューを出す
  ui.showView((await isFirstRun()) ? "welcomeView" : "startView");
}

function wireEvents() {
  // 初回ビュー → 開始ビュー
  document.getElementById("welcomeStartBtn").addEventListener("click", () => ui.showView("startView"));

  document.getElementById("startBtn").addEventListener("click", onStart);

  const card = document.getElementById("flashcard");
  card.addEventListener("click", onFlip);
  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onFlip();
    }
  });

  document.getElementById("okBtn").addEventListener("click", () => onJudge("o"));
  document.getElementById("ngBtn").addEventListener("click", () => onJudge("x"));
  document.getElementById("cardEtymBtn").addEventListener("click", onCardEtym);
  document.getElementById("againBtn").addEventListener("click", onAgain);
  document.getElementById("endBtn").addEventListener("click", () => ui.showView("startView"));

  // 設定ドロワー（ハンバーガーメニュー）
  document.getElementById("menuBtn").addEventListener("click", openDrawer);
  document.getElementById("drawerBackdrop").addEventListener("click", closeDrawer);
  for (const btn of document.querySelectorAll("#directionControl .seg-option")) {
    btn.addEventListener("click", () => onDirectionChange(btn.dataset.dir));
  }
  document.getElementById("sessionSizeInput").addEventListener("change", onSessionSizeChange);
  document.getElementById("historyBtn").addEventListener("click", openHistory);
  document.getElementById("historyBackBtn").addEventListener("click", () => ui.showView("startView"));

  // 語源ビューア起動 / 終了 FAB
  document.getElementById("fab").addEventListener("click", onFabToggle);

  // アカウント（ログイン／ログアウト）
  document.getElementById("signInBtn").addEventListener("click", onSignIn);
  document.getElementById("signOutBtn").addEventListener("click", onSignOut);
}

// --- アカウント（認証） -----------------------------------------------------

async function onSignIn() {
  try {
    await signInWithGoogle();
  } catch (err) {
    // ユーザーがポップアップを閉じた場合などは正常系として扱う
    if (err.code === "auth/popup-closed-by-user" || err.code === "auth/cancelled-popup-request") {
      return;
    }
    console.error("ログインに失敗:", err);
    alert("ログインに失敗しました: " + err.message);
  }
}

async function onSignOut() {
  try {
    await signOutUser();
  } catch (err) {
    console.error("ログアウトに失敗:", err);
  }
}

/**
 * 認証状態に応じてドロワーのアカウントセクションを切り替える。
 * onAuthStateChanged から呼ばれる。user が null ならログアウト中。
 */
function renderAccount(user) {
  const loggedOut = document.getElementById("accountLoggedOut");
  const loggedIn = document.getElementById("accountLoggedIn");
  const email = document.getElementById("accountEmail");
  if (user) {
    loggedOut.classList.add("hidden");
    loggedIn.classList.remove("hidden");
    email.textContent = user.email || user.displayName || "ログイン中";
  } else {
    loggedOut.classList.remove("hidden");
    loggedIn.classList.add("hidden");
    email.textContent = "";
  }
}

// ---- 統計・履歴ビュー ----

// ISO文字列を「M/D HH:MM」形式に整形する
function formatTime(iso) {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mi}`;
}

async function openHistory() {
  closeDrawer();

  const progress = await getProgress();
  // progress にキーがある = 一度でも解答した単語
  const studiedCount = Object.keys(progress).length;

  const history = await getHistory();
  // 新しい順に並べ、表示用に単語名・時刻を解決する
  const rows = history.slice().reverse().map((h) => {
    const entry = getEntry(h.n);
    return {
      number: h.n,
      word: entry ? entry.word : `#${h.n}`,
      result: h.result,
      time: formatTime(h.at),
    };
  });

  ui.renderHistory(rows, studiedCount);
  ui.showView("historyView");
}

// ---- 設定ドロワー ----

function openDrawer() {
  document.getElementById("drawer").classList.remove("hidden");
  document.getElementById("drawerBackdrop").classList.remove("hidden");
}

function closeDrawer() {
  document.getElementById("drawer").classList.add("hidden");
  document.getElementById("drawerBackdrop").classList.add("hidden");
}

// 設定値（settings）をドロワーの UI に反映する
function renderSettings() {
  for (const btn of document.querySelectorAll("#directionControl .seg-option")) {
    btn.classList.toggle("is-active", btn.dataset.dir === settings.direction);
  }
  document.getElementById("sessionSizeInput").value = settings.sessionSize;
}

async function onDirectionChange(dir) {
  settings.direction = dir;
  await setSettings(settings);
  renderSettings();
}

async function onSessionSizeChange(e) {
  const v = parseInt(e.target.value, 10);
  // 不正値は保存せず、入力欄を現在値に戻す
  if (!Number.isFinite(v) || v < 1 || v > 200) {
    e.target.value = settings.sessionSize;
    return;
  }
  settings.sessionSize = v;
  await setSettings(settings);
}

// ---- 語源ビューア ----

// 語源ビューア（全画面オーバーレイ）を開く。開いている間は FAB が「閉じる」になる。
async function openEtymology() {
  document.getElementById("etymologyView").classList.remove("hidden");
  const fab = document.getElementById("fab");
  fab.textContent = "✕";
  fab.setAttribute("aria-label", "語源ビューアを閉じる");
  etymOpen = true;
  // 初期化は初回だけ走る（viewer.js 側で多重呼び出しガード済み）
  await initEtymology();
}

function closeEtymology() {
  document.getElementById("etymologyView").classList.add("hidden");
  const fab = document.getElementById("fab");
  fab.textContent = "語";
  fab.setAttribute("aria-label", "語源ビューアを開く");
  etymOpen = false;
}

// FAB を押すたびに語源ビューアを開閉する（同じ位置でトグル）。
async function onFabToggle() {
  if (etymOpen) closeEtymology();
  else await openEtymology();
}

// カード裏の「この単語の語源を見る」ボタン。
// 語源ビューアを開いて、今表示中の単語を直接 iframe に出す。
async function onCardEtym() {
  if (!ui.isFlipped() || !currentEntry) return;
  await openEtymology();
  showWord(currentEntry.number);
}

async function onStart() {
  const min = parseInt(document.getElementById("rangeMin").value, 10);
  const max = parseInt(document.getElementById("rangeMax").value, 10);
  const errEl = document.getElementById("rangeError");

  if (
    !Number.isFinite(min) || !Number.isFinite(max) ||
    min < RANGE.min || max > RANGE.max || min > max
  ) {
    errEl.textContent = `${RANGE.min}〜${RANGE.max} の範囲で、開始 ≤ 終了 になるよう入力してね`;
    errEl.classList.remove("hidden");
    return;
  }
  errEl.classList.add("hidden");

  const range = { min, max };
  await setLastRange(range);
  await beginSession(range);
}

async function beginSession(range) {
  const first = await startSession(range, settings.sessionSize);
  if (first == null) {
    // レンジ内に今出題できる単語が無い（基本起きないが念のため）
    const errEl = document.getElementById("rangeError");
    errEl.textContent = "このレンジには今出題できる単語がないみたい";
    errEl.classList.remove("hidden");
    ui.showView("startView");
    return;
  }
  currentEntry = getEntry(first);
  const s = getSession();
  ui.renderCard(currentEntry, settings.direction, s.size, s.count + 1);
  ui.showView("cardView");
}

function onFlip() {
  if (ui.isFlipped()) return;
  ui.flipCard(currentEntry, settings.direction);
}

async function onJudge(result) {
  // めくる前は評価できない
  if (!ui.isFlipped()) return;

  const res = await judge(result);
  if (res.done) {
    const s = getSession();
    ui.renderResult(s.ok, s.ng);
    ui.showView("resultView");
    return;
  }

  currentEntry = getEntry(res.number);
  const s = getSession();
  ui.renderCard(currentEntry, settings.direction, s.size, s.count + 1);
}

async function onAgain() {
  const s = getSession();
  await beginSession(s.range);
}

main();
