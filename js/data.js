// データ層: シス単CSVを読み込んで番号 → 単語ルックアップを提供
//
// CSV形式: "Numbers,Words,Meanings\n1,follow,続く・従う\n..."
// 1〜2000 の連番、欠番なしを前提

const CSV_PATH = "./data/sisutan_2000.csv";

// 番号 → エントリ のマップ。{ number, word, meaning }
let entries = null;

/**
 * CSV をパースする超シンプル実装。
 * このCSVは値内にカンマ・改行を含まないので素朴な split で問題なし。
 */
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  // 1行目はヘッダなのでスキップ
  const out = new Map();
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    // カンマで3分割（意味にカンマがある場合に備えて splitWith limit=3 ではなく自前で）
    const firstComma = line.indexOf(",");
    const secondComma = line.indexOf(",", firstComma + 1);
    if (firstComma < 0 || secondComma < 0) continue;
    const num = parseInt(line.slice(0, firstComma), 10);
    const word = line.slice(firstComma + 1, secondComma).trim();
    const meaning = line.slice(secondComma + 1).trim();
    if (!Number.isFinite(num)) continue;
    out.set(num, { number: num, word, meaning });
  }
  return out;
}

/**
 * 初回呼び出しでCSVをfetch & パース。
 * 以降はキャッシュを返す。
 */
export async function loadEntries() {
  if (entries) return entries;
  const res = await fetch(CSV_PATH);
  if (!res.ok) {
    throw new Error(`CSV読み込み失敗: ${res.status} ${res.statusText}`);
  }
  const text = await res.text();
  entries = parseCSV(text);
  return entries;
}

/**
 * 番号 n に対応するエントリを返す。範囲外なら null。
 */
export function getEntry(n) {
  if (!entries) return null;
  return entries.get(n) ?? null;
}

/**
 * 有効な番号範囲（このCSVは1〜2000）
 */
export const RANGE = { min: 1, max: 2000 };
