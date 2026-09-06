/* ============================================================
 * board.js — Canvas 棋盘绘制与坐标换算
 * ============================================================ */

class XiangqiBoard {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cs = 40;       // 格子尺寸
    this.ox = 0;        // 第0列交点的像素 x
    this.oy = 0;        // 第0行交点的像素 y
    this.dpr = Math.max(1, window.devicePixelRatio || 1);
  }

  // 根据容器尺寸计算几何
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const W = rect.width;
    const H = rect.height || rect.width * (10 / 9);
    this.dpr = Math.max(1, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(W * this.dpr);
    this.canvas.height = Math.round(H * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // 棋盘比例：宽 9*cs（含边距），高 10*cs
    const margin = 0.5; // 边距占 cs 比例
    const csW = W / (8 + margin * 2);
    const csH = H / (9 + margin * 2);
    this.cs = Math.floor(Math.min(csW, csH));
    this.ox = (W - 8 * this.cs) / 2;
    this.oy = (H - 9 * this.cs) / 2;
  }

  gridToPixel(c, r) {
    return { x: this.ox + c * this.cs, y: this.oy + r * this.cs };
  }

  pixelToGrid(px, py) {
    const c = Math.round((px - this.ox) / this.cs);
    const r = Math.round((py - this.oy) / this.cs);
    if (c < 0 || c > 8 || r < 0 || r > 9) return null;
    return { c, r };
  }

  render(state) {
    const { ctx, cs } = this;
    const board = state.board;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 背景
    ctx.fillStyle = '#f3d9a4';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.drawGrid();
    this.drawHighlights(state);
    this.drawPieces(board);
  }

  drawGrid() {
    const { ctx, cs, ox, oy } = this;
    ctx.strokeStyle = '#5b3a1a';
    ctx.lineWidth = 1;
    ctx.lineCap = 'round';

    // 横线 10 条
    for (let r = 0; r < 10; r++) {
      ctx.beginPath();
      ctx.moveTo(ox, oy + r * cs);
      ctx.lineTo(ox + 8 * cs, oy + r * cs);
      ctx.stroke();
    }
    // 竖线：边框两条贯通；内部 7 条在河界处断开
    for (let c = 0; c < 9; c++) {
      const x = ox + c * cs;
      if (c === 0 || c === 8) {
        ctx.beginPath();
        ctx.moveTo(x, oy);
        ctx.lineTo(x, oy + 9 * cs);
        ctx.stroke();
      } else {
        // 上半
        ctx.beginPath();
        ctx.moveTo(x, oy);
        ctx.lineTo(x, oy + 4 * cs);
        ctx.stroke();
        // 下半
        ctx.beginPath();
        ctx.moveTo(x, oy + 5 * cs);
        ctx.lineTo(x, oy + 9 * cs);
        ctx.stroke();
      }
    }

    // 外框加粗
    ctx.lineWidth = 2.5;
    ctx.strokeRect(ox - cs * 0.35, oy - cs * 0.35, 8 * cs + cs * 0.7, 9 * cs + cs * 0.7);

    // 九宫斜线
    ctx.lineWidth = 1;
    this.diagonal(3, 0, 5, 2);
    this.diagonal(5, 0, 3, 2);
    this.diagonal(3, 7, 5, 9);
    this.diagonal(5, 7, 3, 9);

    // 河界文字
    ctx.fillStyle = 'rgba(91,58,26,0.55)';
    ctx.font = `${Math.floor(cs * 0.55)}px "KaiTi","STKaiti",serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('楚 河', ox + 1.8 * cs, oy + 4.5 * cs);
    ctx.fillText('漢 界', ox + 6.2 * cs, oy + 4.5 * cs);

    // 星位（炮、兵位置）标记
    const marks = [
      [1, 2], [7, 2], [1, 7], [7, 7],
      [0, 3], [2, 3], [4, 3], [6, 3], [8, 3],
      [0, 6], [2, 6], [4, 6], [6, 6], [8, 6],
    ];
    marks.forEach(([c, r]) => this.starMark(c, r));
  }

  diagonal(c1, r1, c2, r2) {
    const a = this.gridToPixel(c1, r1);
    const b = this.gridToPixel(c2, r2);
    this.ctx.beginPath();
    this.ctx.moveTo(a.x, a.y);
    this.ctx.lineTo(b.x, b.y);
    this.ctx.stroke();
  }

  // 兵/炮位的小角标记
  starMark(c, r) {
    const { ctx, cs } = this;
    const { x, y } = this.gridToPixel(c, r);
    const d = cs * 0.12;
    const len = cs * 0.22;
    ctx.strokeStyle = '#5b3a1a';
    ctx.lineWidth = 1;
    const corners = [
      [-1, -1], [1, -1], [-1, 1], [1, 1],
    ];
    corners.forEach(([sx, sy]) => {
      // 仅在该方向有棋盘内才画（简化处理：四角都画短线）
      ctx.beginPath();
      ctx.moveTo(x + sx * d, y + sy * d);
      ctx.lineTo(x + sx * (d + len), y + sy * d);
      ctx.moveTo(x + sx * d, y + sy * d);
      ctx.lineTo(x + sx * d, y + sy * (d + len));
      ctx.stroke();
    });
  }

  drawHighlights(state) {
    const { ctx, cs } = this;

    // 上一步
    if (state.lastMove) {
      [state.lastMove.from, state.lastMove.to].forEach((p) => {
        const { x, y } = this.gridToPixel(p.c, p.r);
        ctx.strokeStyle = 'rgba(33,150,243,0.7)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x - cs * 0.42, y - cs * 0.42, cs * 0.84, cs * 0.84);
      });
    }

    // 选中
    if (state.selected) {
      const { x, y } = this.gridToPixel(state.selected.c, state.selected.r);
      ctx.strokeStyle = '#e6a23c';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, cs * 0.46, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 合法落点
    (state.targets || []).forEach((t) => {
      const { x, y } = this.gridToPixel(t.c, t.r);
      if (t.capture) {
        ctx.strokeStyle = 'rgba(230,57,70,0.9)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, cs * 0.47, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(230,162,60,0.7)';
        ctx.beginPath();
        ctx.arc(x, y, cs * 0.16, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // 将军提示
    if (state.check) {
      const { x, y } = this.gridToPixel(state.check.c, state.check.r);
      ctx.fillStyle = 'rgba(230,57,70,0.35)';
      ctx.beginPath();
      ctx.arc(x, y, cs * 0.43, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawPieces(board) {
    const { ctx, cs } = this;
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 9; c++) {
        const p = board[r][c];
        if (!p) continue;
        const { x, y } = this.gridToPixel(c, r);
        const radius = cs * 0.42;

        // 棋子底盘阴影
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.arc(x + 1.5, y + 2, radius, 0, Math.PI * 2);
        ctx.fill();

        // 棋子圆盘
        ctx.fillStyle = '#f7e9c8';
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();

        // 外圈
        ctx.strokeStyle = p.color === 'r' ? '#b71c1c' : '#222';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, radius * 0.82, 0, Math.PI * 2);
        ctx.stroke();

        // 文字
        ctx.fillStyle = p.color === 'r' ? '#b71c1c' : '#1a1a1a';
        ctx.font = `bold ${Math.floor(cs * 0.5)}px "KaiTi","STKaiti","SimSun",serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(XQ.PIECE_DISPLAY[p.color][p.type], x, y + cs * 0.02);
      }
    }
  }
}

if (typeof window !== 'undefined') window.XiangqiBoard = XiangqiBoard;
