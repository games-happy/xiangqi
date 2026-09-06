/* ============================================================
 * ai.js — 中国象棋 AI（极小化极大 + α-β 剪枝）
 * 评估：子力价值 + 位置价值表（红方视角）。
 * ============================================================ */

const R = (typeof require !== 'undefined')
  ? require('./rules.js')
  : window.XQ; // 浏览器端由 rules.js 注入

const VALUE = R.PIECE_VALUE;

// 位置价值表（红方视角：row 0 = 黑方底线，row 9 = 红方底线）
// 黑方棋子取镜像行 (9 - row) 并取负。
const PST = {
  R: [ // 车
    [0,0,0,0,0,0,0,0,0],
    [20,20,20,30,30,30,20,20,20],
    [20,20,20,30,30,30,20,20,20],
    [10,10,10,20,20,20,10,10,10],
    [0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0],
    [10,10,10,20,20,20,10,10,10],
    [20,20,20,30,30,30,20,20,20],
    [20,20,20,30,30,30,20,20,20],
    [0,0,0,0,0,0,0,0,0],
  ],
  C: [ // 炮
    [0,0,0,0,0,0,0,0,0],
    [10,10,10,20,20,20,10,10,10],
    [10,10,10,20,20,20,10,10,10],
    [0,0,0,10,10,10,0,0,0],
    [0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0],
    [0,0,0,10,10,10,0,0,0],
    [10,10,10,20,20,20,10,10,10],
    [10,10,10,20,20,20,10,10,10],
    [0,0,0,0,0,0,0,0,0],
  ],
  H: [ // 马
    [0,0,0,0,0,0,0,0,0],
    [5,10,15,20,20,15,10,5,5],
    [5,15,20,25,25,20,15,5,5],
    [0,10,15,20,20,15,10,0,0],
    [0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0],
    [0,10,15,20,20,15,10,0,0],
    [5,15,20,25,25,20,15,5,5],
    [5,10,15,20,20,15,10,5,5],
    [0,0,0,0,0,0,0,0,0],
  ],
  S: [ // 兵/卒
    [0,0,0,0,0,0,0,0,0],
    [90,90,90,100,100,100,90,90,90],
    [70,70,70,80,80,80,70,70,70],
    [30,30,40,50,50,40,30,30,30],
    [10,10,15,20,20,15,10,10,10],
    [5,5,10,15,15,10,5,5,5],
    [0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0],
  ],
  E: [ // 象/相
    [0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0],
    [0,0,10,0,0,0,10,0,0],
    [0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0],
    [0,0,10,0,0,0,10,0,0],
    [0,0,0,0,0,0,0,0,0],
    [0,0,10,0,0,0,10,0,0],
    [0,0,0,0,0,0,0,0,0],
  ],
  A: [ // 士/仕
    [0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0],
    [0,0,10,0,15,0,10,0,0],
    [0,0,10,0,20,0,10,0,0],
  ],
  G: [ // 将/帅
    [0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0],
    [0,0,0,0,10,0,0,0,0],
    [0,0,0,0,15,0,0,0,0],
    [0,0,0,0,20,0,0,0,0],
  ],
};

function evaluate(board) {
  let score = 0;
  for (let r = 0; r < R.ROWS; r++) {
    for (let c = 0; c < R.COLS; c++) {
      const p = board[r][c];
      if (!p) continue;
      const base = VALUE[p.type];
      const pos = PST[p.type][p.color === 'r' ? r : 9 - r][c];
      score += p.color === 'r' ? (base + pos) : -(base + pos);
    }
  }
  return score;
}

const MATE = 1000000;

// 走法排序：吃子优先（MVV-LVA 粗略版），提升剪枝效率
function orderMoves(board, moves) {
  return moves.slice().sort((a, b) => {
    const va = board[a.to.r][a.to.c] ? VALUE[board[a.to.r][a.to.c].type] : 0;
    const vb = board[b.to.r][b.to.c] ? VALUE[board[b.to.r][b.to.c].type] : 0;
    return vb - va;
  });
}

function negamax(board, depth, alpha, beta, color, deadline) {
  if (deadline && Date.now() > deadline) return evaluate(board) * (color === 'r' ? 1 : -1);
  if (depth === 0) {
    const e = evaluate(board);
    return color === 'r' ? e : -e;
  }
  const moves = R.generateLegalMoves(board, color);
  if (moves.length === 0) {
    // 无合法走法：被将死或困毙，当前方败
    return -MATE + (10 - depth);
  }
  const ordered = orderMoves(board, moves);
  let best = -Infinity;
  for (const m of ordered) {
    const nb = R.applyMove(board, m.from, m.to);
    const val = -negamax(nb, depth - 1, -beta, -alpha, R.other(color), deadline);
    if (val > best) best = val;
    if (val > alpha) alpha = val;
    if (alpha >= beta) break;
  }
  return best;
}

/**
 * 选择走法。
 * @param {Array} board 当前棋盘
 * @param {string} color AI 方颜色 'r' | 'b'
 * @param {string} level 'easy' | 'medium' | 'hard'
 * @returns {{from,to}|null}
 */
function chooseMove(board, color, level) {
  const moves = R.generateLegalMoves(board, color);
  if (moves.length === 0) return null;

  let depth, jitter;
  if (level === 'easy') { depth = 1; jitter = 60; }
  else if (level === 'hard') { depth = 3; jitter = 0; }
  else { depth = 2; jitter = 15; } // medium

  // 简单难度：在合法走法中随机（偏向吃子），降低强度
  if (level === 'easy' && Math.random() < 0.7) {
    const caps = moves.filter((m) => board[m.to.r][m.to.c]);
    const pool = caps.length ? caps : moves;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  const deadline = level === 'hard' ? Date.now() + 2500 : 0;
  const ordered = orderMoves(board, moves);
  let best = -Infinity;
  let bestMove = ordered[0];
  let alpha = -Infinity;
  const beta = Infinity;

  for (const m of ordered) {
    const nb = R.applyMove(board, m.from, m.to);
    let val = -negamax(nb, depth - 1, -beta, -alpha, R.other(color), deadline);
    if (jitter) val += (Math.random() * 2 - 1) * jitter;
    if (val > best) {
      best = val;
      bestMove = m;
    }
    if (val > alpha) alpha = val;
  }
  return bestMove;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { chooseMove, evaluate };
}
if (typeof window !== 'undefined') {
  window.XQ_AI = { chooseMove, evaluate };
}
