/* ============================================================
 * rules.js — 中国象棋（Xiangqi）规则引擎
 * 纯逻辑，无 DOM 依赖，可在浏览器与 Node 中运行。
 *
 * 棋盘坐标：col(列) 0..8，row(行) 0..9
 *   row 0 = 黑方底线（上方），row 9 = 红方底线（下方）
 * 棋子对象：{ type, color }
 *   color: 'r' 红（下），'b' 黑（上）
 *   type : 'R' 车, 'H' 马, 'C' 炮, 'E' 象/相, 'A' 士/仕,
 *          'G' 将/帅, 'S' 卒/兵
 * ============================================================ */

const COLS = 9;
const ROWS = 10;

const PIECE_DISPLAY = {
  r: { R: '车', H: '马', C: '炮', E: '相', A: '仕', G: '帅', S: '兵' },
  b: { R: '车', H: '马', C: '炮', E: '象', A: '士', G: '将', S: '卒' },
};

// 子力基础价值（用于 AI 评估）
const PIECE_VALUE = {
  R: 900, H: 400, C: 450, E: 200, A: 200, G: 100000, S: 100,
};

function other(color) {
  return color === 'r' ? 'b' : 'r';
}

function inBoard(c, r) {
  return c >= 0 && c < COLS && r >= 0 && r < ROWS;
}

// 是否在九宫内
function inPalace(c, r, color) {
  if (c < 3 || c > 5) return false;
  return color === 'b' ? (r >= 0 && r <= 2) : (r >= 7 && r <= 9);
}

// 是否已过河
function crossedRiver(r, color) {
  return color === 'r' ? r <= 4 : r >= 5;
}

function cloneBoard(board) {
  return board.map((row) => row.map((p) => (p ? { type: p.type, color: p.color } : null)));
}

function createInitialBoard() {
  const b = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  const place = (c, r, type, color) => { b[r][c] = { type, color }; };

  // 黑方（上）
  const backB = ['R', 'H', 'E', 'A', 'G', 'A', 'E', 'H', 'R'];
  backB.forEach((t, c) => place(c, 0, t, 'b'));
  place(1, 2, 'C', 'b'); place(7, 2, 'C', 'b');
  [0, 2, 4, 6, 8].forEach((c) => place(c, 3, 'S', 'b'));

  // 红方（下）
  const backR = ['R', 'H', 'E', 'A', 'G', 'A', 'E', 'H', 'R'];
  backR.forEach((t, c) => place(c, 9, t, 'r'));
  place(1, 7, 'C', 'r'); place(7, 7, 'C', 'r');
  [0, 2, 4, 6, 8].forEach((c) => place(c, 6, 'S', 'r'));

  return b;
}

function findGeneral(board, color) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = board[r][c];
      if (p && p.type === 'G' && p.color === color) return { c, r };
    }
  }
  return null;
}

// 判断 (c,r) 到 (tc,tr) 之间（不含两端）是否无子
function pathClear(board, c, r, tc, tr) {
  const dc = Math.sign(tc - c);
  const dr = Math.sign(tr - r);
  let cc = c + dc, rr = r + dr;
  while (cc !== tc || rr !== tr) {
    if (board[rr][cc]) return false;
    cc += dc; rr += dr;
  }
  return true;
}

// 两格之间（中点）是否为空（塞象眼 / 蹩马腿用）
function midClear(board, c, r, tc, tr) {
  return !board[(r + tr) / 2][(c + tc) / 2];
}

/**
 * 棋子 (c,r) 是否能走到 (tc,tr)（含吃子）。不含“走后是否被将”的校验。
 */
function pieceCanMove(board, c, r, tc, tr) {
  const p = board[r][c];
  if (!p) return false;
  if (!inBoard(tc, tr)) return false;
  const target = board[tr][tc];
  if (target && target.color === p.color) return false;

  const dc = tc - c, dr = tr - r;
  const adc = Math.abs(dc), adr = Math.abs(dr);

  switch (p.type) {
    case 'R': // 车：直线，路径无子
      if (adc !== 0 && adr !== 0) return false;
      return pathClear(board, c, r, tc, tr);

    case 'H': { // 马：日字，蹩马腿
      if (!((adc === 1 && adr === 2) || (adc === 2 && adr === 1))) return false;
      // 马腿 = 朝向落子方向的第一步正交格
      if (adc === 1 && adr === 2) {
        return !board[r + Math.sign(dr)][c]; // 先走一步直行
      }
      return !board[r][c + Math.sign(dc)];   // 先走一步横行
    }

    case 'C': { // 炮：直线，吃子需隔一子（炮架）
      if (adc !== 0 && adr !== 0) return false;
      let count = 0;
      const sc = Math.sign(dc), sr = Math.sign(dr);
      let cc = c + sc, rr = r + sr;
      while (cc !== tc || rr !== tr) {
        if (board[rr][cc]) count++;
        cc += sc; rr += sr;
      }
      if (target) return count === 1;     // 吃子：恰好一个炮架
      return count === 0;                  // 移动：路径全空
    }

    case 'E': { // 象/相：田字，不过河，塞象眼
      if (adc !== 2 || adr !== 2) return false;
      if (crossedRiver(tr, p.color)) return false;
      return midClear(board, c, r, tc, tr);
    }

    case 'A': // 士/仕：斜一步，在九宫
      if (adc !== 1 || adr !== 1) return false;
      return inPalace(tc, tr, p.color);

    case 'G': // 将/帅：直一步，在九宫
      if ((adc === 1 && adr === 0) || (adc === 0 && adr === 1)) {
        return inPalace(tc, tr, p.color);
      }
      return false;

    case 'S': { // 兵/卒：向前一步；过河后可横走；不可后退
      const fwd = p.color === 'r' ? -1 : 1;
      if (dc === 0 && dr === fwd) return true;
      if (crossedRiver(r, p.color) && adr === 0 && Math.abs(dc) === 1) return true;
      return false;
    }
  }
  return false;
}

/**
 * 将/帅的“飞将”吃子：同一列、中间无子，则可直取对方将帅。
 * 返回可吃的对方将帅坐标或 null。
 */
function flyingGeneralTarget(board, c, r) {
  const p = board[r][c];
  if (!p || p.type !== 'G') return null;
  // 向上
  let rr = r - 1;
  while (rr >= 0) {
    const q = board[rr][c];
    if (q) {
      if (q.type === 'G' && q.color !== p.color) return { c, r: rr };
      break;
    }
    rr--;
  }
  // 向下
  rr = r + 1;
  while (rr < ROWS) {
    const q = board[rr][c];
    if (q) {
      if (q.type === 'G' && q.color !== p.color) return { c, r: rr };
      break;
    }
    rr++;
  }
  return null;
}

// 某颜色的主帅是否处于被攻击（含飞将相对）状态
function isInCheck(board, color) {
  const g = findGeneral(board, color);
  if (!g) return true; // 无将即已输

  // 飞将：两将同列且中间无子
  const eg = findGeneral(board, other(color));
  if (eg && eg.c === g.c) {
    if (pathClear(board, g.c, g.r, eg.c, eg.r)) return true;
  }

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = board[r][c];
      if (p && p.color !== color) {
        if (pieceCanMove(board, c, r, g.c, g.r)) return true;
      }
    }
  }
  return false;
}

// 执行走子，返回新棋盘（不校验合法性，调用方需保证）
function applyMove(board, from, to) {
  const nb = cloneBoard(board);
  nb[to.r][to.c] = nb[from.r][from.c];
  nb[from.r][from.c] = null;
  return nb;
}

// 生成某颜色所有“伪合法”走法（未校验是否被将）
function generatePseudoMoves(board, color) {
  const moves = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = board[r][c];
      if (!p || p.color !== color) continue;
      // 飞将吃子（仅将）
      if (p.type === 'G') {
        const fg = flyingGeneralTarget(board, c, r);
        if (fg) moves.push({ from: { c, r }, to: fg });
      }
      for (let tr = 0; tr < ROWS; tr++) {
        for (let tc = 0; tc < COLS; tc++) {
          if (tc === c && tr === r) continue;
          if (pieceCanMove(board, c, r, tc, tr)) {
            moves.push({ from: { c, r }, to: { c: tc, r: tr } });
          }
        }
      }
    }
  }
  return moves;
}

// 生成某颜色所有“完全合法”走法（走后自己不被将）
function generateLegalMoves(board, color) {
  const pseudo = generatePseudoMoves(board, color);
  const legal = [];
  for (const m of pseudo) {
    const nb = applyMove(board, m.from, m.to);
    if (!isInCheck(nb, color)) legal.push(m);
  }
  return legal;
}

// 某颜色是否还有合法走法，以及是否被将
function getGameStatus(board, color) {
  const inCheck = isInCheck(board, color);
  const moves = generateLegalMoves(board, color);
  if (moves.length === 0) {
    return { over: true, checkmate: inCheck, winner: other(color) };
  }
  return { over: false, checkmate: false, winner: null };
}

// 判断某一步是否合法（用于 UI 交互）
function isMoveLegal(board, from, to, color) {
  const pseudo = generatePseudoMoves(board, color);
  const found = pseudo.find(
    (m) => m.from.c === from.c && m.from.r === from.r && m.to.c === to.c && m.to.r === to.r
  );
  if (!found) return false;
  const nb = applyMove(board, from, to);
  return !isInCheck(nb, color);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    COLS, ROWS, PIECE_DISPLAY, PIECE_VALUE,
    other, inBoard, inPalace, crossedRiver, cloneBoard, createInitialBoard,
    findGeneral, pieceCanMove, flyingGeneralTarget, isInCheck, applyMove,
    generatePseudoMoves, generateLegalMoves, getGameStatus, isMoveLegal,
  };
}

if (typeof window !== 'undefined') {
  window.XQ = {
    COLS, ROWS, PIECE_DISPLAY, PIECE_VALUE,
    other, inBoard, inPalace, crossedRiver, cloneBoard, createInitialBoard,
    findGeneral, pieceCanMove, flyingGeneralTarget, isInCheck, applyMove,
    generatePseudoMoves, generateLegalMoves, getGameStatus, isMoveLegal,
  };
}
