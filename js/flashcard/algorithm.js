// 出題アルゴリズム: エビングハウスの忘却曲線ベースの間隔反復
//
// 各単語の状態（カード）: { stage, nextDue }
//   stage   : 0..7。0 = 初出（まだ一度も出題していない）。◯ で +1、7 で頭打ち
//   nextDue : 次回出題予定時刻（ISO文字列）。null = 初出（一度も出題されていない）
//
// stage が 1 以上になると nextDue で復習スケジュールが管理される。
// stage と間隔の対応: stage 1 → INTERVALS[0]、… stage 7 → INTERVALS[6]
//
// 出題ロジック:
//   1. レンジ内で nextDue ≤ now のもの（期限到来）→ その中からランダムに1つ出す
//      （期限が来た単語はどれも等しく復習対象として扱う。超過時間の長短では順位を付けない）
//   2. 期限到来が無ければ、初出（nextDue == null）からランダムに1つ出す
//   3. それも無ければ null（今出せる単語が無い）
//
// 評価:
//   ◯ → stage++（最大7）、nextDue = now + INTERVALS[stage-1]
//   × → stage 維持、nextDue = now + 5分（同セッション中に再挑戦させる）
//
// 卒業（出題プールから外す）は無し。永続的に復習ループに残る。

export const MAX_STAGE = 7;

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

// stage 1..7 に対応する復習間隔。INTERVALS[stage-1] が次回までの待ち時間
const INTERVALS = [
  20 * MIN, // stage 1: 20分後
  1 * HOUR, // stage 2: 1時間後
  9 * HOUR, // stage 3: 9時間後
  1 * DAY, // stage 4: 1日後
  2 * DAY, // stage 5: 2日後
  6 * DAY, // stage 6: 6日後
  31 * DAY, // stage 7: 31日後（以降ここで頭打ち）
];

// × のとき次に出すまでの待ち時間
const WRONG_DELAY = 5 * MIN;

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * 新規カードの初期状態。
 */
export function newCard() {
  return { stage: 0, nextDue: null };
}

/**
 * 進捗データ・レンジ・現在時刻から「次に出題する番号」を1つ選ぶ。
 *
 * 期限到来済みの単語があればそこから、無ければ初出から、いずれもランダムに選ぶ。
 * 期限の超過時間で順位は付けない（付けると nextDue がミリ秒単位でばらつくため
 * 実質的に決定的な順送りになり、ランダム性が失われる）。
 *
 * @param {Object} progress - { "番号": { stage, nextDue } } 形式の進捗データ
 * @param {{min:number, max:number}} range - 出題レンジ
 * @param {Date} now - 現在時刻
 * @returns {number|null} 出題する番号。出せるものが無ければ null
 */
export function pickNext(progress, range, now) {
  const nowMs = now.getTime();
  const duePool = []; // 期限到来した番号
  const freshPool = []; // 初出の番号

  for (let n = range.min; n <= range.max; n++) {
    const card = progress[n];
    if (!card || card.nextDue == null) {
      // 初出（一度も出題していない）
      freshPool.push(n);
    } else {
      const dueMs = new Date(card.nextDue).getTime();
      if (dueMs <= nowMs) {
        duePool.push(n);
      }
      // nextDue が未来のものは今は出さない（スキップ）
    }
  }

  if (duePool.length > 0) {
    // 期限が来た単語はすべて同列。その中からランダムに1つ
    return pickRandom(duePool);
  }

  if (freshPool.length > 0) {
    // 初出もすべて同列。レンジ内からランダムに1つ
    return pickRandom(freshPool);
  }

  return null;
}

/**
 * カードに評価結果を適用し、更新後の新しいカード状態を返す。
 * 元のカードは変更しない（呼び出し側で progress に代入する）。
 *
 * @param {{stage:number, nextDue:string|null}|undefined} card - 現在のカード（初出なら undefined 可）
 * @param {"o"|"x"} result - ◯ なら "o"、× なら "x"
 * @param {Date} now - 現在時刻
 * @returns {{stage:number, nextDue:string}} 更新後のカード
 */
export function applyResult(card, result, now) {
  const c = card ? { ...card } : newCard();
  const nowMs = now.getTime();

  if (result === "o") {
    c.stage = Math.min(c.stage + 1, MAX_STAGE);
    c.nextDue = new Date(nowMs + INTERVALS[c.stage - 1]).toISOString();
  } else {
    // × : stage はそのまま。5分後にもう一度出題する
    c.nextDue = new Date(nowMs + WRONG_DELAY).toISOString();
  }

  return c;
}
