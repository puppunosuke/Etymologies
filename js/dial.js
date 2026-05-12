// ダイヤルUI: SVG同心円タップ式の番号入力
//
// 構造:
//   中央 (r 0-52):       Decide ボタン
//   一の位 (r 52-82):     0-9 全周 10セグメント
//   十の位 (r 82-112):    0-9 全周 10セグメント
//   百の位 (r 112-142):   0-9 全周 10セグメント
//   千の位 (r 142-172):   0/1/2 上アーチのみ 3セグメント
//
// 状態モデル: state = [千, 百, 十, 一]、各要素は null or 0〜9

import { RANGE } from "./data.js";

const SVG_NS = "http://www.w3.org/2000/svg";

// 外側から内側へ並べる。配列の先頭が千の位、末尾が一の位
// 全リング 1セグメント = 36°(=360/10)。digits は実際に選択可能な数字
// fillerDigits は「選択不可だが視覚的にセグメントを埋める」ための数字（千の位のみ使用）
const RINGS = [
  { name: "thousand", innerR: 142, outerR: 172, digits: [0, 1, 2], fillerDigits: [3, 4, 5, 6, 7, 8, 9] },
  { name: "hundred",  innerR: 112, outerR: 142, digits: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] },
  { name: "ten",      innerR: 82,  outerR: 112, digits: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] },
  { name: "one",      innerR: 52,  outerR: 82,  digits: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] },
];

const CENTER_R = 52;

// state[i] は RINGS[i] の位の選択値（null = 未選択）
const state = [null, null, null, null];
let onDecide = null;
let svgRoot = null;

// 角度: 0° を真上にして時計回り正
function polar(r, deg) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: r * Math.cos(rad), y: r * Math.sin(rad) };
}

function arcPath(innerR, outerR, startAngle, endAngle) {
  const p1 = polar(outerR, startAngle);
  const p2 = polar(outerR, endAngle);
  const p3 = polar(innerR, endAngle);
  const p4 = polar(innerR, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return [
    `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`,
    `L ${p3.x.toFixed(2)} ${p3.y.toFixed(2)}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${p4.x.toFixed(2)} ${p4.y.toFixed(2)}`,
    "Z",
  ].join(" ");
}

// 全桁共通で1セグメント = 36° (= 360°/10)。0° = 真上を「0」とし、時計回りに 1, 2, ...
// 千の位は digits=[0,1,2] のため 3セグメントだけ描画され、残り 7セグメント分は空白になる
function getSegmentAngles(digit) {
  const segWidth = 36;
  const center = digit * segWidth;
  return { start: center - segWidth / 2, end: center + segWidth / 2 };
}

function createSVGElement(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, v);
  }
  return el;
}

function render(svg) {
  // 子要素を全消去
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  // 各リングを描画
  RINGS.forEach((ring, ringIdx) => {
    // フィラーセグメント（選択不可・ラベルなし）を先に描画して背景化
    (ring.fillerDigits || []).forEach((digit) => {
      const { start, end } = getSegmentAngles(digit);
      const path = createSVGElement("path", {
        d: arcPath(ring.innerR, ring.outerR, start, end),
        class: "seg-filler",
      });
      svg.appendChild(path);
    });

    // 選択可能なセグメント
    ring.digits.forEach((digit) => {
      const { start, end } = getSegmentAngles(digit);

      // セグメント本体
      const path = createSVGElement("path", {
        d: arcPath(ring.innerR, ring.outerR, start, end),
        class: "seg",
        "data-ring": ringIdx,
        "data-digit": digit,
      });
      // タッチ・クリック両対応（モバイルでの遅延回避は touch-action: manipulation で吸収）
      path.addEventListener("click", () => handleTap(ringIdx, digit));
      svg.appendChild(path);

      // 数字ラベル
      const midR = (ring.innerR + ring.outerR) / 2;
      const midAngle = (start + end) / 2;
      const pos = polar(midR, midAngle);
      const label = createSVGElement("text", {
        x: pos.x.toFixed(2),
        y: pos.y.toFixed(2),
        class: "seg-label",
        "data-ring": ringIdx,
        "data-digit": digit,
      });
      label.textContent = String(digit);
      svg.appendChild(label);
    });
  });

  // 中央 Decide ボタン
  const decideBg = createSVGElement("circle", {
    cx: 0,
    cy: 0,
    r: CENTER_R,
    class: "decide-bg",
    id: "decideBtn",
  });
  decideBg.addEventListener("click", handleDecide);
  svg.appendChild(decideBg);

  const decideNum = createSVGElement("text", {
    x: 0,
    y: -6,
    class: "decide-num",
    id: "decideNum",
  });
  decideNum.textContent = "____";
  svg.appendChild(decideNum);

  const decideLabel = createSVGElement("text", {
    x: 0,
    y: 18,
    class: "decide-label",
    id: "decideLabel",
  });
  decideLabel.textContent = "DECIDE";
  svg.appendChild(decideLabel);

  updateVisuals();
}

function handleTap(ringIdx, digit) {
  // 同じ数字を再タップしたら解除、違う数字なら上書き
  if (state[ringIdx] === digit) {
    state[ringIdx] = null;
  } else {
    state[ringIdx] = digit;
  }
  updateVisuals();
}

function getNumber() {
  if (state.some((s) => s === null)) return null;
  return state[0] * 1000 + state[1] * 100 + state[2] * 10 + state[3];
}

function isReady() {
  const n = getNumber();
  return n !== null && n >= RANGE.min && n <= RANGE.max;
}

function updateVisuals() {
  if (!svgRoot) return;

  // セグメントの選択状態
  svgRoot.querySelectorAll(".seg").forEach((seg) => {
    const ringIdx = Number(seg.dataset.ring);
    const d = Number(seg.dataset.digit);
    seg.classList.toggle("is-selected", state[ringIdx] === d);
  });
  svgRoot.querySelectorAll(".seg-label").forEach((t) => {
    const ringIdx = Number(t.dataset.ring);
    const d = Number(t.dataset.digit);
    t.classList.toggle("is-selected", state[ringIdx] === d);
  });

  // 中央 Decide の状態反映
  const decideBg = svgRoot.querySelector("#decideBtn");
  const decideNum = svgRoot.querySelector("#decideNum");
  const decideLabel = svgRoot.querySelector("#decideLabel");
  const ready = isReady();
  decideBg.classList.toggle("is-ready", ready);
  decideBg.classList.toggle("is-disabled", !ready);
  decideNum.classList.toggle("is-ready", ready);
  decideLabel.classList.toggle("is-ready", ready);

  // 現在の選択番号の表示（未選択は _ で埋める）
  const display = state.map((s) => (s === null ? "_" : String(s))).join("");
  decideNum.textContent = display;
}

function handleDecide() {
  if (!isReady()) return;
  const n = getNumber();
  if (onDecide) onDecide(n);
}

/**
 * ダイヤルを初期化。decideCallback には選ばれた番号(1-2000)が渡される。
 */
export function initDial(svgEl, decideCallback) {
  svgRoot = svgEl;
  onDecide = decideCallback;
  render(svgEl);
}

/**
 * 選択状態をリセット（将来「クリアボタン」を付ける場合に備えてエクスポート）
 */
export function resetDial() {
  for (let i = 0; i < state.length; i++) state[i] = null;
  updateVisuals();
}
