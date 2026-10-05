"use client";

import { useEffect, useRef } from "react";

const BRANCH = 0;
const ROOT = 1;
type Kind = typeof BRANCH | typeof ROOT;

type Tip = {
  x: number;
  y: number;
  a: number; // angle in radians, -PI/2 = up
  home: number; // direction the tip tends to return to
  w: number; // width in world units
  len: number; // length between splits
  left: number; // length left until next split
  acc: number; // accumulated growth not yet turned into a segment
  kind: Kind;
  leader: boolean; // leaders never stop growing
  fan?: boolean; // on its first split, fans out into leaders in every direction
  wake?: number; // dormant leader: resumes once the reach of its kind gets here
};

type Palette = { branch: string; root: string; leaf: string; ground: string };

const STEP = 3; // world units per segment
const MAX_TIPS = 140;
const TARGET_TIPS = 70;
const MAX_SEGMENTS = 120_000;
const SEG_FIELDS = 6; // x1, y1, x2, y2, w, kind
const LEAF_FIELDS = 3; // x, y, r
// Leaders may only go as far as the crown (or root mass) behind them is dense.
// Reach is the radius of a half disc holding this much length per unit area.
const DENSITY = 0.08;
const MIN_REACH = 140;
// A leader that hits the reach rests until the crown fills this much further out.
const WAKE_MARGIN = 1.2;

const rand = (min: number, max: number) => min + Math.random() * (max - min);
// Leaders spread over a half circle so the tree widens as fast as it rises.
const FAN = [-1.3, -0.85, -0.4, 0, 0.4, 0.85, 1.3];

const angleDiff = (target: number, a: number) =>
  Math.atan2(Math.sin(target - a), Math.cos(target - a));

function readPalette(): Palette {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string) => css.getPropertyValue(name).trim();
  return {
    branch: v("--tree-branch"),
    root: v("--tree-root"),
    leaf: v("--tree-leaf"),
    ground: v("--tree-ground"),
  };
}

export default function GrowingTree() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const off = document.createElement("canvas");
    const octx = off.getContext("2d")!;

    let segs = new Float32Array(SEG_FIELDS * 4096);
    let segCount = 0;
    let leaves = new Float32Array(LEAF_FIELDS * 1024);
    let leafCount = 0;
    const tips: Tip[] = [];

    // Pending items to paint onto the offscreen cache this frame.
    let paintedSegs = 0;
    let paintedLeaves = 0;

    let palette = readPalette();
    let dpr = 1;
    let W = 0;
    let H = 0;
    let scale = 1;
    let cacheScale = 1;
    const extent = { up: 1, down: 1, side: 1 };
    const length = [0, 0]; // total grown length per kind
    let sproutTimer = 0;

    const originX = () => W / 2;
    const originY = () => H * 0.5;

    // Each visit gets a slightly different tree.
    const trunkW = rand(7, 10);
    const up = -Math.PI / 2 + rand(-0.08, 0.08);
    const down = Math.PI / 2 + rand(-0.1, 0.1);
    tips.push(
      { x: 0, y: 0, a: up, home: up, w: trunkW, len: rand(45, 65), left: rand(50, 80), acc: 0, kind: BRANCH, leader: true, fan: true },
      { x: 0, y: 0, a: down, home: down, w: trunkW * 0.8, len: rand(40, 55), left: rand(12, 24), acc: 0, kind: ROOT, leader: true, fan: true },
    );

    function pushSeg(x1: number, y1: number, x2: number, y2: number, w: number, kind: Kind) {
      if ((segCount + 1) * SEG_FIELDS > segs.length) {
        const next = new Float32Array(segs.length * 2);
        next.set(segs);
        segs = next;
      }
      const o = segCount * SEG_FIELDS;
      segs[o] = x1; segs[o + 1] = y1; segs[o + 2] = x2; segs[o + 3] = y2; segs[o + 4] = w; segs[o + 5] = kind;
      segCount++;
      length[kind] += STEP;
      if (kind === BRANCH) {
        extent.up = Math.max(extent.up, -y2);
      } else {
        extent.down = Math.max(extent.down, y2);
      }
      extent.side = Math.max(extent.side, Math.abs(x2));
    }

    function pushLeaf(x: number, y: number, r: number) {
      if ((leafCount + 1) * LEAF_FIELDS > leaves.length) {
        const next = new Float32Array(leaves.length * 2);
        next.set(leaves);
        leaves = next;
      }
      const o = leafCount * LEAF_FIELDS;
      leaves[o] = x; leaves[o + 1] = y; leaves[o + 2] = r;
      leafCount++;
    }

    function split(t: Tip, out: Tip[]) {
      if (t.fan) {
        for (const offset of FAN) {
          const home = t.home + offset + rand(-0.1, 0.1);
          out.push({
            ...t,
            fan: false,
            a: t.a + offset * 0.6,
            home,
            w: t.w * (offset === 0 ? 0.75 : rand(0.55, 0.65)),
            left: t.len * rand(0.6, 1),
            acc: 0,
          });
        }
        return;
      }
      if (t.leader) {
        // The leader never stops: it keeps going and throws a lateral.
        const lateralSide = Math.random() < 0.5 ? -1 : 1;
        out.push({ ...t, a: t.a + rand(-0.15, 0.15), w: Math.max(1.2, t.w * 0.94), left: t.len, acc: 0 });
        if (tips.length + out.length < MAX_TIPS) {
          const a = t.a + lateralSide * rand(0.4, t.kind === ROOT ? 1.3 : 0.9);
          out.push({
            ...t,
            leader: false,
            a,
            home: a,
            w: t.w * rand(0.5, 0.7),
            len: t.len * rand(0.7, 0.9),
            left: t.len * rand(0.5, 0.9),
            acc: 0,
          });
        }
        return;
      }
      if (t.w < 0.7) {
        if (t.kind === BRANCH) {
          const n = 3 + Math.floor(Math.random() * 4);
          for (let i = 0; i < n; i++) pushLeaf(t.x + rand(-5, 5), t.y + rand(-5, 3), rand(1.2, 2.8));
        }
        return; // tip dies
      }
      const crowded = tips.length + out.length >= MAX_TIPS;
      const children = crowded ? 1 : Math.random() < 0.25 ? 3 : 2;
      const spread = t.kind === ROOT ? rand(0.35, 0.8) : rand(0.3, 0.6);
      for (let i = 0; i < children; i++) {
        const offset = children === 1 ? rand(-0.2, 0.2) : (i / (children - 1) - 0.5) * 2 * spread + rand(-0.1, 0.1);
        const len = t.len * rand(0.72, 0.9);
        const a = t.a + offset;
        out.push({ ...t, a, home: a, w: t.w * rand(0.62, 0.8), len, left: len * rand(0.8, 1.1), acc: 0 });
      }
    }

    function sprout() {
      if (segCount < 20 || segCount >= MAX_SEGMENTS) return;
      // Pick a reasonably thick existing segment and grow a new limb from it.
      for (let attempt = 0; attempt < 12; attempt++) {
        const i = Math.floor(Math.random() * segCount);
        const o = i * SEG_FIELDS;
        const w = segs[o + 4];
        if (w < 1.6) continue;
        const kind = segs[o + 5] as Kind;
        const baseA = Math.atan2(segs[o + 3] - segs[o + 1], segs[o + 2] - segs[o]);
        const side = Math.random() < 0.5 ? -1 : 1;
        const len = 25 + w * rand(5, 9);
        const a = baseA + side * rand(0.5, 1.2);
        tips.push({
          x: segs[o + 2], y: segs[o + 3],
          a, home: a,
          w: w * rand(0.45, 0.65),
          len, left: len, acc: 0, kind, leader: false,
        });
        return;
      }
    }

    const reach = (kind: Kind) =>
      Math.max(MIN_REACH, Math.sqrt((2 * length[kind]) / (Math.PI * DENSITY)));

    function grow(dt: number) {
      const born: Tip[] = [];
      for (let i = tips.length - 1; i >= 0; i--) {
        const t = tips[i];
        if (t.leader && !t.fan) {
          const limit = reach(t.kind);
          if (t.wake !== undefined) {
            if (limit < t.wake) continue;
            t.wake = undefined;
          } else if (Math.hypot(t.x, t.y) > limit) {
            t.wake = limit * WAKE_MARGIN;
            continue;
          }
        }
        const speed = (t.leader ? 11 : 7) * (0.6 + Math.min(1, t.w / 4) * 0.4);
        t.acc += speed * dt;
        let alive = true;
        while (t.acc >= STEP && alive) {
          t.acc -= STEP;
          const up = t.kind === BRANCH;
          const target = t.home;
          const tropism = t.leader ? 0.05 : 0.01;
          t.a += rand(-0.12, 0.12) + angleDiff(target, t.a) * tropism;
          const nx = t.x + Math.cos(t.a) * STEP;
          let ny = t.y + Math.sin(t.a) * STEP;
          // Branches stay above ground, roots below it.
          if (up && ny > -1) { ny = -1; t.a += angleDiff(-Math.PI / 2, t.a) * 0.3; }
          if (!up && ny < 1) { ny = 1; t.a += angleDiff(Math.PI / 2, t.a) * 0.3; }
          pushSeg(t.x, t.y, nx, ny, t.w, t.kind);
          t.x = nx; t.y = ny;
          t.w *= t.leader ? 0.9985 : 0.996;
          t.left -= STEP;
          if (t.left <= 0) {
            split(t, born);
            tips.splice(i, 1);
            alive = false;
          }
        }
      }
      tips.push(...born);

      sproutTimer -= dt;
      if (sproutTimer <= 0) {
        sproutTimer = rand(0.6, 1.6);
        if (tips.length < TARGET_TIPS) sprout();
      }
    }

    function strokeSeg(c: CanvasRenderingContext2D, o: number, s: number) {
      const kind = segs[o + 5];
      c.strokeStyle = kind === BRANCH ? palette.branch : palette.root;
      c.lineWidth = Math.max(0.4 * dpr, segs[o + 4] * s * dpr);
      c.beginPath();
      c.moveTo((originX() + segs[o] * s) * dpr, (originY() + segs[o + 1] * s) * dpr);
      c.lineTo((originX() + segs[o + 2] * s) * dpr, (originY() + segs[o + 3] * s) * dpr);
      c.stroke();
    }

    function fillLeaf(c: CanvasRenderingContext2D, o: number, s: number) {
      c.beginPath();
      c.arc(
        (originX() + leaves[o] * s) * dpr,
        (originY() + leaves[o + 1] * s) * dpr,
        Math.max(0.6 * dpr, leaves[o + 2] * s * dpr),
        0, Math.PI * 2,
      );
      c.fill();
    }

    function paintPending() {
      octx.lineCap = "round";
      for (; paintedSegs < segCount; paintedSegs++) strokeSeg(octx, paintedSegs * SEG_FIELDS, cacheScale);
      octx.fillStyle = palette.leaf;
      octx.globalAlpha = 0.75;
      for (; paintedLeaves < leafCount; paintedLeaves++) fillLeaf(octx, paintedLeaves * LEAF_FIELDS, cacheScale);
      octx.globalAlpha = 1;
    }

    function repaintCache() {
      cacheScale = scale;
      octx.clearRect(0, 0, off.width, off.height);
      paintedSegs = 0;
      paintedLeaves = 0;
      paintPending();
    }

    function targetScale() {
      const margin = 0.82;
      return Math.min(
        1,
        (originY() * margin) / extent.up,
        ((H - originY()) * margin) / extent.down,
        ((W / 2) * margin) / extent.side,
      );
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      for (const c of [canvas, off]) {
        c.width = Math.round(W * dpr);
        c.height = Math.round(H * dpr);
      }
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      scale = targetScale();
      repaintCache();
    }

    function render() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Ground line
      ctx.strokeStyle = palette.ground;
      ctx.lineWidth = dpr;
      ctx.beginPath();
      ctx.moveTo(0, originY() * dpr);
      ctx.lineTo(canvas.width, originY() * dpr);
      ctx.stroke();

      // Cached tree, zoomed around the origin to match the current scale.
      const r = scale / cacheScale;
      const ox = originX() * dpr;
      const oy = originY() * dpr;
      ctx.drawImage(off, ox - ox * r, oy - oy * r, off.width * r, off.height * r);

      // Glowing buds on growing tips.
      ctx.fillStyle = palette.leaf;
      for (const t of tips) {
        if (t.kind !== BRANCH) continue;
        ctx.beginPath();
        ctx.arc(ox + t.x * scale * dpr, oy + t.y * scale * dpr, Math.max(1, t.w * 0.6 * scale) * dpr, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    let last = performance.now();
    let raf = 0;
    function frame(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      grow(dt);
      scale += (targetScale() - scale) * Math.min(1, dt * 0.6);
      if (Math.abs(scale / cacheScale - 1) > 0.03) repaintCache();
      else paintPending();
      render();
      raf = requestAnimationFrame(frame);
    }

    const scheme = window.matchMedia("(prefers-color-scheme: dark)");
    const onScheme = () => {
      palette = readPalette();
      repaintCache();
    };

    resize();
    window.addEventListener("resize", resize);
    scheme.addEventListener("change", onScheme);
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      scheme.removeEventListener("change", onScheme);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden className="fixed inset-0 block" />;
}
