// セッション管理: 1回の学習セッション（デフォルト20問）の状態と進行を担う
//
// 出題の選定は algorithm.js、進捗の永続化は storage.js に委譲する。
// セッション状態はモジュール内に1つだけ保持する。

import { getProgress, setProgress, appendHistory } from "../storage.js";
import { pickNext, applyResult } from "./algorithm.js";

let session = null;

/**
 * 現在のセッション状態を返す（count / ok / ng / range / size など）。
 */
export function getSession() {
  return session;
}

/**
 * 次に出題する番号を引いて session.currentNumber に入れる。
 * 出せる単語が無ければ null。
 */
function advance() {
  const n = pickNext(session.progress, session.range, new Date());
  session.currentNumber = n;
  return n;
}

/**
 * 新しいセッションを開始する。
 * @returns {number|null} 最初に出題する番号。出せる単語が無ければ null
 */
export async function startSession(range, size) {
  const progress = await getProgress();
  session = {
    range,
    size,
    count: 0, // 出題（評価）し終えた数
    ok: 0,
    ng: 0,
    progress,
    currentNumber: null,
  };
  return advance();
}

/**
 * 現在のカードに評価を適用する。進捗を更新・保存し、次のカードへ進む。
 * @param {"o"|"x"} result
 * @returns {{done:boolean, number?:number, exhausted?:boolean}}
 *   done=true ならセッション終了。exhausted=true は「出せる単語が尽きた」終了。
 */
export async function judge(result) {
  if (!session || session.currentNumber == null) {
    return { done: true };
  }

  const n = session.currentNumber;
  const now = new Date();
  const updated = applyResult(session.progress[n], result, now);
  session.progress[n] = updated;
  await setProgress(session.progress);

  // 解答履歴に1件追加（統計・履歴ビューで使う）
  await appendHistory({ n, result, at: now.toISOString() });

  if (result === "o") session.ok++;
  else session.ng++;
  session.count++;

  // 規定問題数に到達したら終了
  if (session.count >= session.size) {
    session.currentNumber = null;
    return { done: true };
  }

  // 次のカードを引く
  const next = advance();
  if (next == null) {
    // レンジ内に今出せる単語が無くなった（初出も期限到来も尽きた）
    return { done: true, exhausted: true };
  }
  return { done: false, number: next };
}
