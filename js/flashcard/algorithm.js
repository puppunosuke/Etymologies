// 出題アルゴリズム: エビングハウスの忘却曲線ベースの間隔反復
//
// 各単語の状態（カード）: { stage, nextDue }
//   stage   : 0..7。0 = 未正答（◯ を取ったことが一度もない）。◯ で +1、7 で頭打ち
//   nextDue : 次回出題予定時刻（ISO文字列）。null = 一度も出題されていない or 未正答
//
// stage は「一度でも◯したら次のステージへ」のシンプル設計。
// 同じ単語で何回 × しても stage は上がらず、◯ を取って初めて上がる。
//
// 出題ロジック:
//   レンジ内の「期限到来（nextDue ≤ now）」と「未正答（nextDue == null）」を
//   同列のプールに統合し、その中からランダムに1つ出す。
//   未正答 と nextDue 期間が経過した単語は基本的に同じ扱い。
//
// 評価:
//   ◯ → stage++（最大7）、nextDue = now + INTERVALS[stage-1]
//   × → stage 維持、nextDue = now（即時、出題プールに即戻る）
//        間違え続ける限り出題プールに居続ける挙動を狙ったもの。
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
 * 期限到来済み（nextDue ≤ now）と未正答（nextDue == null）を1つのプールに統合し、
 * その中からランダムに1つ選ぶ。期限の超過時間で順位は付けない（付けると nextDue が
 * ミリ秒単位でばらつくため実質的に決定的な順送りになり、ランダム性が失われる）。
 *
 * @param {Object} progress - { "番号": { stage, nextDue } } 形式の進捗データ
 * @param {{min:number, max:number}} range - 出題レンジ
 * @param {Date} now - 現在時刻
 * @returns {number|null} 出題する番号。出せるものが無ければ null
 */
export function pickNext(progress, range, now) {
  const nowMs = now.getTime();
  const pool = []; // 期限到来 + 未正答 を同列に積む

  for (let n = range.min; n <= range.max; n++) {
    const card = progress[n];
    if (!card || card.nextDue == null) {
      // 未正答（一度も◯を取っていない）
      pool.push(n);
    } else {
      const dueMs = new Date(card.nextDue).getTime();
      if (dueMs <= nowMs) {
        pool.push(n);
      }
      // nextDue が未来（=◯後の待機期間中）のものは今は出さない
    }
  }

  if (pool.length === 0) return null;
  return pickRandom(pool);
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
    // × : stage はそのまま。即時に出題プールに戻す（nextDue = now）
    // pickNext 側の `dueMs <= nowMs` 判定で同時刻も「期限到来」扱いになる。
    c.nextDue = new Date(nowMs).toISOString();
  }

  return c;
}
