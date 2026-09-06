/* ============================================================
 * main.js — 界面交互、AI 调度、按钮与记谱渲染
 * ============================================================ */

(function () {
  const canvas = document.getElementById('board');
  const board = new window.XiangqiBoard(canvas);
  const game = new window.XiangqiGame();

  const statusEl = document.getElementById('status');
  const historyEl = document.getElementById('history');
  const thinkingEl = document.getElementById('thinking');

  const modeSel = document.getElementById('modeSel');
  const diffSel = document.getElementById('diffSel');
  const sideSel = document.getElementById('sideSel');

  let aiTimer = null;

  function render() {
    board.render(game.getState());
    statusEl.textContent = game.statusText();
    renderHistory();
    thinkingEl.style.display = game.getState().aiThinking ? 'block' : 'none';
  }

  function renderHistory() {
    const list = game.moveList;
    let html = '';
    for (let i = 0; i < list.length; i += 2) {
      const n = i / 2 + 1;
      const red = list[i] || '';
      const black = list[i + 1] || '';
      html += `<div class="mv"><span class="num">${n}.</span>`
        + `<span class="r">${red}</span>`
        + `<span class="b">${black}</span></div>`;
    }
    historyEl.innerHTML = html;
    historyEl.scrollTop = historyEl.scrollHeight;
  }

  function maybeAiMove() {
    if (!game.isAiTurn()) return;
    if (aiTimer) return;
    game.getState().aiThinking = true;
    thinkingEl.style.display = 'block';
    aiTimer = setTimeout(() => {
      aiTimer = null;
      const mv = window.XQ_AI.chooseMove(game.board, game.aiColor, game.difficulty);
      if (mv) game.move(mv.from, mv.to);
      game.getState().aiThinking = false;
      thinkingEl.style.display = 'none';
      render();
      maybeAiMove();
    }, 80);
  }

  // 指针/触摸处理
  function handlePoint(e) {
    if (game.over || game.isAiTurn()) return;
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const g = board.pixelToGrid(px, py);
    if (!g) return;

    if (!game.selected) {
      if (game.selectAt(g.c, g.r)) render();
      return;
    }

    if (game.selected.c === g.c && game.selected.r === g.r) {
      game.clearSelection();
      render();
      return;
    }

    if (game.isTarget(g.c, g.r)) {
      const from = { ...game.selected };
      game.move(from, g);
      render();
      maybeAiMove();
      return;
    }

    const p = game.board[g.r][g.c];
    if (p && p.color === game.turn) {
      game.selectAt(g.c, g.r);
      render();
    } else {
      game.clearSelection();
      render();
    }
  }

  canvas.addEventListener('pointerdown', handlePoint);

  // 按钮
  document.getElementById('btnNew').addEventListener('click', () => {
    if (aiTimer) { clearTimeout(aiTimer); aiTimer = null; }
    game.reset();
    render();
    maybeAiMove();
  });

  document.getElementById('btnUndo').addEventListener('click', () => {
    if (aiTimer) { clearTimeout(aiTimer); aiTimer = null; }
    game.undo();
    render();
  });

  modeSel.addEventListener('change', () => {
    game.setMode(modeSel.value);
    sideSel.disabled = modeSel.value !== 'ai';
    diffSel.disabled = modeSel.value !== 'ai';
    render();
    maybeAiMove();
  });

  diffSel.addEventListener('change', () => game.setDifficulty(diffSel.value));

  sideSel.addEventListener('change', () => {
    game.setHumanColor(sideSel.value);
    render();
    maybeAiMove();
  });

  window.addEventListener('resize', () => {
    board.resize();
    render();
    board.render(game.getState()); // 字号变化后首帧字体度量可能不准，补画一遍
  });

  // 初始化 — 首帧连画两遍：Chromium 首次测量 CJK 系统字体时
  // actualBoundingBox 偏差较大（首个绘制的字形会错位），
  // 第二遍在度量缓存生效后绘制即为精确居中
  board.resize();
  render();
  board.render(game.getState());

  // 字体异步解析完成后（如 Windows 上的 KaiTi fallback）再补一帧
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => render()).catch(() => {});
  }

  maybeAiMove();
})();
