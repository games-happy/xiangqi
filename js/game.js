/* ============================================================
 * game.js — 对局控制器（状态管理、走子、悔棋、记谱）
 * 依赖 window.XQ（rules.js）
 * ============================================================ */

const XQ = window.XQ;
const NUM_CN = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

// 棋盘局面签名（用于重复局面检测）
function boardSig(board) {
  let s = '';
  for (let r = 0; r < XQ.ROWS; r++) {
    for (let c = 0; c < XQ.COLS; c++) {
      const p = board[r][c];
      s += p ? p.color + p.type : '.';
    }
  }
  return s;
}

// 玩家视角的列编号（红方从右往左 1..9；黑方从左往右 1..9）
function fileOf(c, color) {
  return color === 'r' ? (9 - c) : (c + 1);
}

/**
 * 生成中文走法记谱，如 “炮二平五”、“马八进七”、“车一进一”。
 */
function moveNotation(board, from, to, color) {
  const piece = board[from.r][from.c];
  const name = XQ.PIECE_DISPLAY[color][piece.type];
  const startFile = fileOf(from.c, color);

  let dir;
  if (from.r === to.r) dir = '平';
  else if ((color === 'r' && to.r < from.r) || (color === 'b' && to.r > from.r)) dir = '进';
  else dir = '退';

  // 同列有同名棋子时，用 前/后 区分
  const sameFile = [];
  for (let r = 0; r < XQ.ROWS; r++) {
    const p = board[r][from.c];
    if (p && p.type === piece.type && p.color === color) sameFile.push(r);
  }

  let prefix;
  if (sameFile.length === 2) {
    const frontR = color === 'r' ? Math.min(...sameFile) : Math.max(...sameFile);
    prefix = (from.r === frontR) ? '前' : '后';
  } else {
    prefix = NUM_CN[startFile];
  }

  let suffix;
  if (dir === '平') {
    suffix = NUM_CN[fileOf(to.c, color)];
  } else if (piece.type === 'H' || piece.type === 'E') {
    suffix = NUM_CN[fileOf(to.c, color)]; // 马/象用落点列
  } else {
    suffix = NUM_CN[Math.abs(to.r - from.r)]; // 直线走子用步数
  }
  return prefix + name + dir + suffix;
}

class Game {
  constructor() {
    this.mode = 'ai';        // 'ai' | 'two'
    this.difficulty = 'medium';
    this.humanColor = 'r';
    this.aiColor = 'b';
    this.listeners = [];
    this.reset();
  }

  on(fn) { this.listeners.push(fn); }
  emit() { this.listeners.forEach((f) => f(this.getState())); }

  reset() {
    this.board = XQ.createInitialBoard();
    this.turn = 'r';
    this.history = [];           // {from,to,captured,notation}
    this.moveList = [];          // 记谱文本
    this.selected = null;
    this.targets = [];
    this.over = false;
    this.winner = null;
    this.check = null;           // {c,r}
    this.lastMove = null;
  }

  setMode(mode) { this.mode = mode; this.reset(); }
  setDifficulty(d) { this.difficulty = d; }
  setHumanColor(color) {
    this.humanColor = color;
    this.aiColor = XQ.other(color);
    this.reset();
  }

  isAiTurn() {
    return this.mode === 'ai' && this.turn === this.aiColor && !this.over;
  }

  getState() {
    return {
      board: this.board,
      turn: this.turn,
      mode: this.mode,
      difficulty: this.difficulty,
      humanColor: this.humanColor,
      aiColor: this.aiColor,
      selected: this.selected,
      targets: this.targets,
      lastMove: this.lastMove,
      check: this.check,
      over: this.over,
      winner: this.winner,
      moveList: this.moveList.slice(),
      statusText: this.statusText(),
      aiThinking: false,
    };
  }

  statusText() {
    if (this.over) {
      if (this.winner) {
        const w = this.winner === 'r' ? '红方' : '黑方';
        return `对局结束 — ${w}胜`;
      }
      return '对局结束 — 和棋（重复局面）';
    }
    const side = this.turn === 'r' ? '红方' : '黑方';
    let t = `轮到 ${side}`;
    if (this.check) t += '（将军！）';
    return t;
  }

  // 选择某格的棋子，返回是否成功选中
  selectAt(c, r) {
    if (this.over) return false;
    if (this.isAiTurn()) return false;
    const p = this.board[r][c];
    if (p && p.color === this.turn) {
      this.selected = { c, r };
      this.targets = this.legalTargets(c, r);
      return true;
    }
    return false;
  }

  clearSelection() {
    this.selected = null;
    this.targets = [];
  }

  legalTargets(c, r) {
    const moves = XQ.generateLegalMoves(this.board, this.turn);
    return moves
      .filter((m) => m.from.c === c && m.from.r === r)
      .map((m) => ({
        c: m.to.c,
        r: m.to.r,
        capture: !!this.board[m.to.r][m.to.c],
      }));
  }

  isTarget(c, r) {
    return this.targets.some((t) => t.c === c && t.r === r);
  }

  // 尝试走子；成功返回 true
  move(from, to) {
    if (this.over) return false;
    if (!XQ.isMoveLegal(this.board, from, to, this.turn)) return false;

    const captured = this.board[to.r][to.c];
    const notation = moveNotation(this.board, from, to, this.turn);
    this.board = XQ.applyMove(this.board, from, to);
    this.history.push({ from, to, captured, notation, sig: boardSig(this.board) });
    this.moveList.push(notation);
    this.lastMove = { from, to };
    this.turn = XQ.other(this.turn);
    this.clearSelection();

    // 计算将军与终局
    const status = XQ.getGameStatus(this.board, this.turn);
    this.over = status.over;
    this.winner = status.winner;
    if (!this.over && XQ.isInCheck(this.board, this.turn)) {
      this.check = XQ.findGeneral(this.board, this.turn);
    } else {
      this.check = null;
    }
    // 重复局面（三次相同）→ 和棋
    if (!this.over) {
      const sig = boardSig(this.board);
      const count = this.history.filter((h) => h.sig === sig).length;
      if (count >= 3) {
        this.over = true;
        this.winner = null;
      }
    }
    return true;
  }

  undo() {
    if (this.history.length === 0) return;
    // 人机模式：撤销 AI 一步 + 玩家一步
    const steps = this.mode === 'ai' ? 2 : 1;
    for (let i = 0; i < steps && this.history.length > 0; i++) {
      this.history.pop();
      this.moveList.pop();
    }
    this.board = XQ.createInitialBoard();
    // 重建棋盘
    for (const h of this.history) {
      this.board = XQ.applyMove(this.board, h.from, h.to);
    }
    this.turn = this.history.length % 2 === 0 ? 'r' : 'b';
    this.lastMove = this.history.length ? this.history[this.history.length - 1] : null;
    this.over = false;
    this.winner = null;
    this.check = null;
    this.clearSelection();
  }
}

if (typeof window !== 'undefined') window.XiangqiGame = Game;
if (typeof module !== 'undefined' && module.exports) module.exports = { Game, moveNotation };
