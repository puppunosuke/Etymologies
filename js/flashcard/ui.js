// フラッシュカードの DOM 描画レイヤー
//
// 状態は持たず、与えられたデータを画面に反映するだけ。
// 出題ロジックは session.js、配線は main.js が担当する。

const VIEW_IDS = ["welcomeView", "startView", "cardView", "resultView", "historyView", "etymologyView"];

/**
 * 指定したビューだけ表示し、他を隠す。
 * etymologyView は全画面オーバーレイなので、他ビューと独立して重ねたい場合は
 * showView を使わず直接 classList を操作する（main.js 側で扱う）。
 */
export function showView(id) {
  for (const v of VIEW_IDS) {
    document.getElementById(v).classList.toggle("hidden", v !== id);
  }
}

/**
 * カードの表面（出題面）を描画する。
 * direction "en-ja" なら表 = 英単語、"ja-en" なら表 = 日本語の意味。
 */
export function renderCard(entry, direction, total, count) {
  const front = direction === "en-ja" ? entry.word : entry.meaning;
  document.getElementById("cardText").textContent = front;
  document.getElementById("cardNumber").textContent = `#${entry.number}`;

  const hint = document.getElementById("cardHint");
  hint.textContent = "タップでめくる";
  hint.classList.remove("hidden");

  document.getElementById("cardCount").textContent = count;
  document.getElementById("cardTotal").textContent = total;

  // めくるまで ◯／× と「語源を見る」は押せない
  document.getElementById("okBtn").disabled = true;
  document.getElementById("ngBtn").disabled = true;
  document.getElementById("cardEtymBtn").disabled = true;

  document.getElementById("flashcard").dataset.flipped = "false";
}

/**
 * カードをめくって裏面（解答面）を表示し、◯／× ボタンを有効化する。
 */
export function flipCard(entry, direction) {
  const back = direction === "en-ja" ? entry.meaning : entry.word;
  document.getElementById("cardText").textContent = back;
  document.getElementById("cardHint").classList.add("hidden");
  document.getElementById("flashcard").dataset.flipped = "true";

  document.getElementById("okBtn").disabled = false;
  document.getElementById("ngBtn").disabled = false;
  document.getElementById("cardEtymBtn").disabled = false;
}

/**
 * 今カードがめくられているか（裏面表示中か）。
 */
export function isFlipped() {
  return document.getElementById("flashcard").dataset.flipped === "true";
}

/**
 * セッション結果（◯／× の数）を描画する。
 */
export function renderResult(ok, ng) {
  document.getElementById("scoreOk").textContent = ok;
  document.getElementById("scoreNg").textContent = ng;
}

function makeSpan(cls, text) {
  const span = document.createElement("span");
  span.className = cls;
  span.textContent = text;
  return span;
}

/**
 * 統計・履歴ビューを描画する。
 * @param {Array<{number:number, word:string, result:"o"|"x", time:string}>} rows
 *   解答履歴。新しい順に並んだ状態で渡す
 * @param {number} studiedCount - 学習済み単語数
 */
export function renderHistory(rows, studiedCount) {
  document.getElementById("statStudied").textContent = studiedCount;

  const list = document.getElementById("historyList");
  const empty = document.getElementById("historyEmpty");
  list.replaceChildren();

  if (rows.length === 0) {
    empty.classList.remove("hidden");
    list.classList.add("hidden");
    return;
  }
  empty.classList.add("hidden");
  list.classList.remove("hidden");

  for (const row of rows) {
    const li = document.createElement("li");
    li.className = "history-item";
    li.appendChild(makeSpan("hist-num", `#${row.number}`));
    li.appendChild(makeSpan("hist-word", row.word));
    li.appendChild(makeSpan("hist-time", row.time));
    const mark = row.result === "o" ? "◯" : "×";
    li.appendChild(makeSpan(`hist-mark ${row.result === "o" ? "hist-ok" : "hist-ng"}`, mark));
    list.appendChild(li);
  }
}
