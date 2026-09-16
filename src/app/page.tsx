"use client";

import { useEffect, useRef } from "react";

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const C = "#cccccc";
    const CL = "#dddddd";
    let W: number, H: number;
    let rafId: number;

    function resize() {
      W = canvas!.width = window.innerWidth;
      H = canvas!.height = window.innerHeight;
    }
    resize();

    // ── Pixel font ──────────────────────────────────────────────────────────
    const PMAP: Record<string, number[]> = {
      "0": [0b111, 0b101, 0b101, 0b101, 0b111],
      "1": [0b010, 0b110, 0b010, 0b010, 0b111],
      "2": [0b111, 0b001, 0b111, 0b100, 0b111],
      "3": [0b111, 0b001, 0b111, 0b001, 0b111],
      "4": [0b101, 0b101, 0b111, 0b001, 0b001],
      "5": [0b111, 0b100, 0b111, 0b001, 0b111],
      "6": [0b111, 0b100, 0b111, 0b101, 0b111],
      "7": [0b111, 0b001, 0b001, 0b001, 0b001],
      "8": [0b111, 0b101, 0b111, 0b101, 0b111],
      "9": [0b111, 0b101, 0b111, 0b001, 0b111],
    };
    function drawChar(ch: string, x: number, y: number, size: number) {
      const rows = PMAP[ch];
      if (!rows) return;
      const px = Math.round(size / 3);
      rows.forEach((row, ri) => {
        for (let ci = 0; ci < 3; ci++)
          if (row & (1 << (2 - ci)))
            ctx!.fillRect(x + ci * (px + 1), y + ri * (px + 1), px, px);
      });
    }
    function drawScore(n: number, cx: number) {
      ctx!.fillStyle = C;
      const s = String(n),
        cw = 44;
      let dx = cx - (s.length * cw - 2) / 2;
      for (const ch of s) {
        drawChar(ch, dx, 50, 36);
        dx += cw;
      }
    }

    // ── PONG ─────────────────────────────────────────────────────────────────
    const pong = (() => {
      const PW = 24,
        PH = 140,
        BS = 24,
        PM = 48,
        SPD = 6.5,
        PS = 5.5;
      let sL: number, sR: number;
      let ball: { x: number; y: number; vx: number; vy: number };
      let pL: { x: number; y: number }, pR: { x: number; y: number };

      function rb(dir?: number) {
        const a = ((Math.random() * 40 - 20) * Math.PI) / 180;
        ball = {
          x: W / 2,
          y: H / 2,
          vx: Math.cos(a) * SPD * (dir || 1),
          vy: Math.sin(a) * SPD,
        };
      }
      function mv(p: { x: number; y: number }, tgt: number) {
        const c = p.y + PH / 2,
          d = tgt - c;
        p.y += Math.abs(d) < PS ? d : Math.sign(d) * PS;
        p.y = Math.max(0, Math.min(H - PH, p.y));
      }
      function hit(p: { x: number; y: number }, out: number) {
        const hp = (ball.y + BS / 2 - p.y) / PH,
          a = (hp - 0.5) * 1.1;
        const sp = Math.min(
          Math.sqrt(ball.vx ** 2 + ball.vy ** 2) * 1.03,
          12,
        );
        ball.vx = out * Math.abs(Math.cos(a) * sp);
        ball.vy = Math.sin(a) * sp;
      }
      return {
        init() {
          sL = 0;
          sR = 0;
          pL = { x: PM, y: H / 2 - PH / 2 };
          pR = { x: W - PM - PW, y: H / 2 - PH / 2 };
          rb(1);
        },
        update() {
          const t = Date.now();
          mv(pL, ball.y + Math.sin(t / 600) * 38 + Math.sin(t / 230) * 14);
          mv(pR, ball.y + Math.sin(t / 1100 + 2.3) * 52 + Math.cos(t / 370) * 20);
          ball.x += ball.vx;
          ball.y += ball.vy;
          if (ball.y <= 0) {
            ball.y = 0;
            ball.vy *= -1;
          }
          if (ball.y + BS >= H) {
            ball.y = H - BS;
            ball.vy *= -1;
          }
          if (
            ball.vx < 0 &&
            ball.x <= pL.x + PW &&
            ball.x >= pL.x &&
            ball.y + BS >= pL.y &&
            ball.y <= pL.y + PH
          ) {
            ball.x = pL.x + PW;
            hit(pL, 1);
          }
          if (
            ball.vx > 0 &&
            ball.x + BS >= pR.x &&
            ball.x + BS <= pR.x + PW &&
            ball.y + BS >= pR.y &&
            ball.y <= pR.y + PH
          ) {
            ball.x = pR.x - BS;
            hit(pR, -1);
          }
          if (ball.x + BS < 0) {
            sR++;
            rb(1);
          }
          if (ball.x > W) {
            sL++;
            rb(-1);
          }
        },
        draw() {
          ctx!.setLineDash([10, 14]);
          ctx!.strokeStyle = "#e8e8e8";
          ctx!.lineWidth = 2;
          ctx!.beginPath();
          ctx!.moveTo(W / 2, 0);
          ctx!.lineTo(W / 2, H);
          ctx!.stroke();
          ctx!.setLineDash([]);
          ctx!.fillStyle = C;
          ctx!.fillRect(pL.x, pL.y, PW, PH);
          ctx!.fillRect(pR.x, pR.y, PW, PH);
          ctx!.fillRect(ball.x, ball.y, BS, BS);
          drawScore(sL, W / 2 - 60);
          drawScore(sR, W / 2 + 60);
        },
      };
    })();

    // ── BREAKOUT ─────────────────────────────────────────────────────────────
    const breakout = (() => {
      const BS = 16,
        PW = 110,
        PH = 18,
        ROWS = 5,
        COLS = 12,
        BH = 20,
        BGAP = 6;
      let ball: { x: number; y: number; vx: number; vy: number };
      let pad: { x: number; y: number };
      let blocks: { x: number; y: number; w: number; h: number; alive: boolean }[];
      let score: number;

      function mkBlocks() {
        const bw = Math.floor((W - 120 - (COLS - 1) * BGAP) / COLS);
        const sx = (W - (bw * COLS + BGAP * (COLS - 1))) / 2;
        blocks = [];
        for (let r = 0; r < ROWS; r++)
          for (let c = 0; c < COLS; c++)
            blocks.push({
              x: sx + c * (bw + BGAP),
              y: 90 + r * (BH + BGAP),
              w: bw,
              h: BH,
              alive: true,
            });
      }
      function rb() {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 0.8,
          sp = 7.5;
        ball = { x: W / 2, y: H - 110, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp };
      }
      return {
        init() {
          score = 0;
          pad = { x: W / 2 - PW / 2, y: H - 60 };
          mkBlocks();
          rb();
        },
        update() {
          pad.x += (ball.x - PW / 2 + Math.sin(Date.now() / 700) * 28 - pad.x) * 0.08;
          pad.x = Math.max(0, Math.min(W - PW, pad.x));
          ball.x += ball.vx;
          ball.y += ball.vy;
          if (ball.x <= 0) {
            ball.x = 0;
            ball.vx *= -1;
          }
          if (ball.x + BS >= W) {
            ball.x = W - BS;
            ball.vx *= -1;
          }
          if (ball.y <= 0) {
            ball.y = 0;
            ball.vy *= -1;
          }
          if (
            ball.vy > 0 &&
            ball.y + BS >= pad.y &&
            ball.y + BS <= pad.y + PH + 4 &&
            ball.x + BS >= pad.x &&
            ball.x <= pad.x + PW
          ) {
            ball.y = pad.y - BS;
            const hp = (ball.x + BS / 2 - pad.x) / PW,
              a = (hp - 0.5) * 1.4,
              sp = Math.sqrt(ball.vx ** 2 + ball.vy ** 2);
            ball.vx = Math.sin(a) * sp;
            ball.vy = -Math.abs(Math.cos(a) * sp);
          }
          if (ball.y > H + 20) rb();
          for (const b of blocks) {
            if (!b.alive) continue;
            if (
              ball.x + BS > b.x &&
              ball.x < b.x + b.w &&
              ball.y + BS > b.y &&
              ball.y < b.y + b.h
            ) {
              b.alive = false;
              score++;
              const ox = Math.min(ball.x + BS - b.x, b.x + b.w - ball.x),
                oy = Math.min(ball.y + BS - b.y, b.y + b.h - ball.y);
              if (ox < oy) ball.vx *= -1;
              else ball.vy *= -1;
              break;
            }
          }
          if (blocks.every((b) => !b.alive)) mkBlocks();
        },
        draw() {
          ctx!.fillStyle = C;
          for (const b of blocks) if (b.alive) ctx!.fillRect(b.x, b.y, b.w, b.h);
          ctx!.fillRect(pad.x, pad.y, PW, PH);
          ctx!.fillRect(ball.x, ball.y, BS, BS);
          drawScore(score, W / 2);
        },
      };
    })();

    // ── SNAKE ────────────────────────────────────────────────────────────────
    const snake = (() => {
      const CELL = 24;
      const TR = 5;
      let seg: { x: number; y: number }[];
      let dir: { x: number; y: number };
      let food: { x: number; y: number };
      let score: number, dead: boolean, deadTimer: number, tick: number;

      function rc() {
        return {
          x: Math.floor(Math.random() * Math.floor(W / CELL)),
          y: Math.floor(Math.random() * Math.floor(H / CELL)),
        };
      }
      function reset() {
        const cx = Math.floor(W / CELL / 2),
          cy = Math.floor(H / CELL / 2);
        seg = [
          { x: cx, y: cy },
          { x: cx - 1, y: cy },
          { x: cx - 2, y: cy },
        ];
        dir = { x: 1, y: 0 };
        food = rc();
        score = 0;
        dead = false;
        deadTimer = 0;
        tick = 0;
      }
      return {
        init() {
          reset();
        },
        update() {
          if (dead) {
            if (++deadTimer > 70) reset();
            return;
          }
          if (++tick < TR) return;
          tick = 0;
          if (Math.random() < 0.22) {
            const opts = [
              { x: 1, y: 0 },
              { x: -1, y: 0 },
              { x: 0, y: 1 },
              { x: 0, y: -1 },
            ].filter((d) => !(d.x === -dir.x && d.y === -dir.y));
            opts.sort((a, b) => {
              const h = seg[0];
              return (
                Math.abs(h.x + a.x - food.x) +
                Math.abs(h.y + a.y - food.y) -
                (Math.abs(h.x + b.x - food.x) + Math.abs(h.y + b.y - food.y))
              );
            });
            dir = Math.random() < 0.72 ? opts[0] : opts[Math.min(1, opts.length - 1)];
          }
          const cols = Math.floor(W / CELL),
            rows = Math.floor(H / CELL);
          const head = {
            x: (seg[0].x + dir.x + cols) % cols,
            y: (seg[0].y + dir.y + rows) % rows,
          };
          if (seg.some((s) => s.x === head.x && s.y === head.y)) {
            dead = true;
            return;
          }
          seg.unshift(head);
          if (head.x === food.x && head.y === food.y) {
            score++;
            food = rc();
          } else seg.pop();
        },
        draw() {
          ctx!.fillStyle = C;
          for (const s of seg) ctx!.fillRect(s.x * CELL + 2, s.y * CELL + 2, CELL - 4, CELL - 4);
          ctx!.fillStyle = "#e0e0e0";
          ctx!.fillRect(food.x * CELL + 5, food.y * CELL + 5, CELL - 10, CELL - 10);
          drawScore(score, W / 2);
        },
      };
    })();

    // ── SPACE INVADERS ───────────────────────────────────────────────────────
    const spaceInvaders = (() => {
      const IC = 11,
        IR = 4,
        IW = 34,
        IH = 24,
        IGX = 14,
        IGY = 18;
      const BW = 6,
        BH = 14,
        PW = 50,
        PH = 22;
      let invs: { x: number; y: number; alive: boolean }[];
      let pbullets: { x: number; y: number }[], ibullets: { x: number; y: number }[];
      let player: { x: number; y: number };
      let score: number, invDir: number, invTick: number, pShoot: number;

      function mkInvs() {
        const tw = IC * IW + (IC - 1) * IGX,
          sx = (W - tw) / 2;
        invs = [];
        for (let r = 0; r < IR; r++)
          for (let c = 0; c < IC; c++)
            invs.push({ x: sx + c * (IW + IGX), y: 80 + r * (IH + IGY), alive: true });
        invDir = 1;
      }
      return {
        init() {
          score = 0;
          player = { x: W / 2 - PW / 2, y: H - 60 };
          pbullets = [];
          ibullets = [];
          mkInvs();
          invTick = 0;
          pShoot = 0;
        },
        update() {
          player.x += (W / 2 - PW / 2 + Math.sin(Date.now() / 900) * (W / 2 - 80) - player.x) * 0.04;
          player.x = Math.max(0, Math.min(W - PW, player.x));
          if (++pShoot > 22) {
            pShoot = 0;
            pbullets.push({ x: player.x + PW / 2 - BW / 2, y: player.y });
          }

          pbullets = pbullets.filter((b) => b.y > -20);
          pbullets.forEach((b) => (b.y -= 10));
          ibullets = ibullets.filter((b) => b.y < H + 20);
          ibullets.forEach((b) => (b.y += 5));

          if (++invTick > Math.max(3, 18 - Math.floor(score / 3))) {
            invTick = 0;
            const al = invs.filter((i) => i.alive);
            if (!al.length) {
              mkInvs();
              return;
            }
            const mx = Math.max(...al.map((i) => i.x + IW)),
              mn = Math.min(...al.map((i) => i.x));
            if ((invDir > 0 && mx >= W - 8) || (invDir < 0 && mn <= 8)) {
              invDir *= -1;
              invs.forEach((i) => {
                if (i.alive) i.y += 20;
              });
            } else
              invs.forEach((i) => {
                if (i.alive) i.x += invDir * 14;
              });
            if (al.length && Math.random() < 0.28) {
              const s = al[Math.floor(Math.random() * al.length)];
              ibullets.push({ x: s.x + IW / 2 - BW / 2, y: s.y + IH });
            }
          }

          for (const b of pbullets)
            for (const inv of invs) {
              if (!inv.alive) continue;
              if (b.x < inv.x + IW && b.x + BW > inv.x && b.y < inv.y + IH && b.y + BH > inv.y) {
                inv.alive = false;
                b.y = -100;
                score++;
              }
            }
          if (invs.every((i) => !i.alive)) mkInvs();
          if (invs.some((i) => i.alive && i.y + IH > H - 40)) mkInvs();
        },
        draw() {
          ctx!.fillStyle = C;
          for (const inv of invs) {
            if (!inv.alive) continue;
            ctx!.fillRect(inv.x + 4, inv.y, IW - 8, IH);
            ctx!.fillRect(inv.x, inv.y + 6, IW, IH - 12);
            ctx!.fillRect(inv.x + 6, inv.y - 5, 4, 7);
            ctx!.fillRect(inv.x + IW - 10, inv.y - 5, 4, 7);
          }
          ctx!.fillRect(player.x, player.y + 8, PW, PH - 8);
          ctx!.fillRect(player.x + PW / 2 - 6, player.y, 12, 10);
          for (const b of pbullets) ctx!.fillRect(b.x, b.y, BW, BH);
          ctx!.fillStyle = "#e0e0e0";
          for (const b of ibullets) ctx!.fillRect(b.x, b.y, BW, BH);
          drawScore(score, W / 2);
        },
      };
    })();

    // ── TETRIS ───────────────────────────────────────────────────────────────
    const tetris = (() => {
      const CELL = 28;
      const SHAPES = [
        [[1, 1, 1, 1]],
        [
          [1, 1],
          [1, 1],
        ],
        [
          [0, 1, 0],
          [1, 1, 1],
        ],
        [
          [1, 0],
          [1, 0],
          [1, 1],
        ],
        [
          [0, 1],
          [0, 1],
          [1, 1],
        ],
        [
          [0, 1, 1],
          [1, 1, 0],
        ],
        [
          [1, 1, 0],
          [0, 1, 1],
        ],
      ];
      let board: number[][];
      let cur: { shape: number[][]; x: number; y: number };
      let score: number, dt: number, COLS: number, ROWS: number;

      function rot(s: number[][]) {
        const R = s.length,
          C2 = s[0].length,
          ns = Array.from({ length: C2 }, () => Array(R).fill(0));
        for (let r = 0; r < R; r++) for (let c = 0; c < C2; c++) ns[c][R - 1 - r] = s[r][c];
        return ns;
      }

      function np() {
        let s = SHAPES[Math.floor(Math.random() * SHAPES.length)].map((r) => [...r]);
        const rots = Math.floor(Math.random() * 4);
        for (let i = 0; i < rots; i++) s = rot(s);
        return { shape: s, x: Math.floor(COLS / 2 - s[0].length / 2), y: -s.length };
      }
      function col(s: number[][], x: number, y: number) {
        for (let r = 0; r < s.length; r++)
          for (let c = 0; c < s[r].length; c++) {
            if (!s[r][c]) continue;
            const nx = x + c,
              ny = y + r;
            if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
            if (ny >= 0 && board[ny][nx]) return true;
          }
        return false;
      }
      function lock() {
        const { shape, x, y } = cur;
        for (let r = 0; r < shape.length; r++)
          for (let c = 0; c < shape[r].length; c++)
            if (shape[r][c] && y + r >= 0) board[y + r][x + c] = 1;
        for (let r = ROWS - 1; r >= 0; r--) {
          if (board[r].every((v) => v)) {
            board.splice(r, 1);
            board.unshift(Array(COLS).fill(0));
            score += 100;
            r++;
          }
        }
        cur = np();
        if (col(cur.shape, cur.x, cur.y)) {
          board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
          score = 0;
        }
      }
      return {
        init() {
          COLS = Math.floor(W / CELL);
          ROWS = Math.floor(H / CELL);
          board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
          score = 0;
          dt = 0;
          cur = np();
        },
        update() {
          if (++dt < 22) return;
          dt = 0;
          if (Math.random() < 0.3) {
            const d = Math.random() < 0.5 ? -1 : 1;
            if (!col(cur.shape, cur.x + d, cur.y)) cur.x += d;
          }
          if (!col(cur.shape, cur.x, cur.y + 1)) cur.y++;
          else lock();
        },
        draw() {
          ctx!.fillStyle = CL;
          for (let r = 0; r < ROWS; r++)
            for (let c = 0; c < COLS; c++)
              if (board[r][c]) ctx!.fillRect(c * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2);
          ctx!.fillStyle = C;
          if (cur)
            for (let r = 0; r < cur.shape.length; r++)
              for (let c = 0; c < cur.shape[r].length; c++)
                if (cur.shape[r][c])
                  ctx!.fillRect((cur.x + c) * CELL + 1, (cur.y + r) * CELL + 1, CELL - 2, CELL - 2);
          drawScore(score, W / 2);
        },
      };
    })();

    // ── Pick & run ───────────────────────────────────────────────────────────
    const all = [pong, breakout, snake, spaceInvaders, tetris];
    const game = all[Math.floor(Math.random() * all.length)];
    game.init();

    function handleResize() {
      resize();
      game.init();
    }
    window.addEventListener("resize", handleResize);

    function loop() {
      ctx!.clearRect(0, 0, W, H);
      game.update();
      game.draw();
      rafId = requestAnimationFrame(loop);
    }
    loop();

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-white">
      <canvas ref={canvasRef} className="fixed top-0 left-0 block h-full w-full" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="Atnoia" className="relative z-10 h-auto w-60" />
    </div>
  );
}
