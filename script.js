// Skeleton Lizard Cursor (HTML/CSS/JS)
// - hidden native cursor; lizard skeleton follows
// - spine/tail as verlet chain with constraints
// - head aims toward cursor with easing, click "chomp"
// - optional trails & glow

const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d", { alpha: true });

const DPR = Math.min(2, window.devicePixelRatio || 1);
let W = innerWidth,
  H = innerHeight;

function resize() {
  W = innerWidth;
  H = innerHeight;
  canvas.width = Math.floor(W * DPR);
  canvas.height = Math.floor(H * DPR);
  canvas.style.width = W + "px";
  canvas.style.height = H + "px";
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
addEventListener("resize", resize);
resize();

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
const angTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);

// --- input
const mouse = { x: W / 2, y: H / 2, tx: W / 2, ty: H / 2, active: false };
addEventListener("mousemove", (e) => {
  mouse.tx = e.clientX;
  mouse.ty = e.clientY;
  mouse.active = true;
});
addEventListener("mouseleave", () => {
  mouse.active = false;
});

let chomp = 0; // 0..1
addEventListener("mousedown", () => {
  chomp = 1;
});

// toggles
let trails = true;
let glow = true;
addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if (k === "t") trails = !trails;
  if (k === "g") glow = !glow;
});

// --- background dust (subtle)
const dust = Array.from({ length: 90 }, () => ({
  x: Math.random() * W,
  y: Math.random() * H,
  r: Math.random() * 1.2 + 0.2,
  a: Math.random() * 0.18 + 0.05,
  vx: (Math.random() - 0.5) * 0.1,
  vy: (Math.random() - 0.5) * 0.08,
}));

// --- verlet chain for spine+tail
// points[0] = head base, points increase toward tail tip
const SEGMENTS = 22;
const REST = 10; // px between joints
const points = [];
const prev = [];
const pin = { x: W / 2, y: H / 2 }; // head base target

function initChain() {
  points.length = 0;
  prev.length = 0;
  const x0 = W / 2,
    y0 = H / 2;
  for (let i = 0; i < SEGMENTS; i++) {
    const x = x0 - i * REST;
    const y = y0 + Math.sin(i * 0.4) * 2;
    points.push({ x, y });
    prev.push({ x, y });
  }
}
initChain();

// lizard params
const liz = {
  headLen: 26,
  jaw: 0,
  turn: 0,
  wob: 0,
  speed: 15,
  stiffness: 0.88,
  damping: 0.985,
  wiggle: 0.55,
};

// trails buffer
const trail = [];

function verlet(dt) {
  // move "pin" toward mouse target with smoothing
  const ease = 1 - Math.pow(0.001, dt); // framerate-independent smoothing
  mouse.x = lerp(mouse.x, mouse.tx, ease);
  mouse.y = lerp(mouse.y, mouse.ty, ease);

  // head base target slightly behind actual mouse for organic feel
  const targetX = mouse.x;
  const targetY = mouse.y;

  pin.x = lerp(pin.x, targetX, 0.55 * ease);
  pin.y = lerp(pin.y, targetY, 0.55 * ease);

  // add mild wandering when mouse inactive
  liz.wob += dt * 2.2;
  const idle = mouse.active ? 0 : 1;
  const idleX = Math.cos(liz.wob * 0.9) * 12 * idle;
  const idleY = Math.sin(liz.wob * 1.2) * 10 * idle;

  // head base (point 0) is pinned
  points[0].x = pin.x + idleX;
  points[0].y = pin.y + idleY;

  // verlet integration for other points
  for (let i = 1; i < SEGMENTS; i++) {
    const p = points[i],
      q = prev[i];

    const vx = (p.x - q.x) * liz.damping;
    const vy = (p.y - q.y) * liz.damping;

    q.x = p.x;
    q.y = p.y;

    // slight sinusoidal muscle motion
    const wig = Math.sin(liz.wob * 3 + i * 0.55) * liz.wiggle;

    p.x += vx;
    p.y += vy + wig;
  }

  // constraints (distance)
  for (let iter = 0; iter < 5; iter++) {
    // keep head pinned
    points[0].x = pin.x + idleX;
    points[0].y = pin.y + idleY;

    for (let i = 0; i < SEGMENTS - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 1;

      const diff = (d - REST) / d;
      // stronger correction near head
      const w = 1 - i / (SEGMENTS - 1);
      const k = lerp(0.38, 0.22, i / (SEGMENTS - 1)) * liz.stiffness;

      // move b away/toward a, a is pinned more near head
      const ax = dx * diff * k * (1 - w * 0.65);
      const ay = dy * diff * k * (1 - w * 0.65);

      b.x -= ax;
      b.y -= ay;

      if (i !== 0) {
        a.x += ax * 0.45;
        a.y += ay * 0.45;
      }
    }
  }

  // head facing angle from first segment direction
  const hx = points[0].x,
    hy = points[0].y;
  const nx = points[1].x,
    ny = points[1].y;
  const dir = angTo(nx, ny, hx, hy); // from neck->head
  liz.turn = lerpAngle(liz.turn, dir, 0.18);

  // chomp decay
  chomp = Math.max(0, chomp - dt * 3.2);
  liz.jaw = lerp(liz.jaw, chomp, 0.35);

  // trail
  if (trails) {
    trail.push({ x: hx, y: hy, t: 0 });
    if (trail.length > 34) trail.shift();
    for (const p of trail) p.t += dt;
  } else {
    trail.length = 0;
  }

  // dust drift
  for (const p of dust) {
    p.x += p.vx;
    p.y += p.vy;
    if (p.x < -20) p.x = W + 20;
    if (p.x > W + 20) p.x = -20;
    if (p.y < -20) p.y = H + 20;
    if (p.y > H + 20) p.y = -20;
  }
}

function angleDelta(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
function lerpAngle(a, b, t) {
  return a + angleDelta(a, b) * t;
}

function draw(dt) {
  // background clear
  if (trails) {
    ctx.fillStyle = "rgba(7,9,17,0.18)";
    ctx.fillRect(0, 0, W, H);
  } else {
    ctx.clearRect(0, 0, W, H);
  }

  // dust
  ctx.fillStyle = "rgba(220,245,255,1)";
  for (const p of dust) {
    ctx.globalAlpha = p.a;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // cursor aura
  if (glow) {
    const hx = points[0].x,
      hy = points[0].y;
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 0.6;
    const g = ctx.createRadialGradient(hx, hy, 4, hx, hy, 58);
    g.addColorStop(0, "rgba(140,220,255,0.28)");
    g.addColorStop(0.5, "rgba(140,220,255,0.10)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(hx, hy, 58, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  // head trail
  if (trails && trail.length > 2) {
    ctx.strokeStyle = "rgba(140,220,255,0.20)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < trail.length; i++) {
      const p = trail[i];
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }

  // draw skeleton: spine + ribs + legs
  drawSkeleton();

  // draw head with jaw
  drawHead();
}

function drawSkeleton() {
  // spine line
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // soft outer
  ctx.strokeStyle = getCSS("--bone2");
  ctx.lineWidth = 7;
  ctx.beginPath();
  for (let i = 0; i < SEGMENTS; i++) {
    const p = points[i];
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();

  // inner bone
  ctx.strokeStyle = getCSS("--bone");
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  for (let i = 0; i < SEGMENTS; i++) {
    const p = points[i];
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();

  // joints (vertebrae)
  for (let i = 0; i < SEGMENTS; i++) {
    const p = points[i];
    const a = 0.55 - (i / (SEGMENTS - 1)) * 0.25;
    ctx.globalAlpha = a;
    ctx.fillStyle = getCSS("--bone");
    ctx.beginPath();
    ctx.arc(p.x, p.y, i === 0 ? 4.2 : 3.1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // ribs near head (first few segments)
  for (let i = 2; i < 8; i++) {
    const p = points[i];
    const p2 = points[i + 1];
    const ang = angTo(p.x, p.y, p2.x, p2.y) + Math.PI / 2;
    const len = 10 + (8 - i) * 1.8;
    const w = 1.8;

    const lx = Math.cos(ang) * len;
    const ly = Math.sin(ang) * len;

    ctx.strokeStyle = "rgba(235,245,255,0.65)";
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(p.x - lx, p.y - ly);
    ctx.quadraticCurveTo(p.x, p.y, p.x + lx, p.y + ly);
    ctx.stroke();
  }

  // tiny limbs (front & back) like skeletal lizard
  const limbPairs = [
    { i: 4, len: 16 },
    { i: 6, len: 14 },
    { i: 12, len: 16 },
    { i: 14, len: 14 },
  ];

  for (const L of limbPairs) {
    const a = points[L.i];
    const b = points[L.i + 1];
    const dir = angTo(a.x, a.y, b.x, b.y);
    const out = dir + Math.PI / 2;

    // left limb
    limb(a.x, a.y, out, L.len);
    // right limb
    limb(a.x, a.y, out + Math.PI, L.len);
  }
}

function limb(x, y, ang, len) {
  const elbowLen = len * 0.55;
  const wristLen = len * 0.55;

  const ex = x + Math.cos(ang) * elbowLen;
  const ey = y + Math.sin(ang) * elbowLen;
  const wx = ex + Math.cos(ang + Math.sin(liz.wob * 4) * 0.2) * wristLen;
  const wy = ey + Math.sin(ang + Math.sin(liz.wob * 4) * 0.2) * wristLen;

  // outer
  ctx.strokeStyle = "rgba(235,245,255,0.25)";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(ex, ey);
  ctx.lineTo(wx, wy);
  ctx.stroke();

  // inner
  ctx.strokeStyle = "rgba(235,245,255,0.82)";
  ctx.lineWidth = 2.1;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(ex, ey);
  ctx.lineTo(wx, wy);
  ctx.stroke();

  // joints
  ctx.fillStyle = "rgba(235,245,255,0.9)";
  ctx.beginPath();
  ctx.arc(ex, ey, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(wx, wy, 2.0, 0, Math.PI * 2);
  ctx.fill();
}

function drawHead() {
  const hx = points[0].x,
    hy = points[0].y;
  const neck = points[1];
  const a = liz.turn;

  const headLen = liz.headLen;
  const snout = {
    x: hx + Math.cos(a) * headLen,
    y: hy + Math.sin(a) * headLen,
  };

  // skull base
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(a);

  // skull glow
  if (glow) {
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 0.7;
    const gg = ctx.createRadialGradient(6, 0, 2, 6, 0, 36);
    gg.addColorStop(0, "rgba(140,220,255,0.35)");
    gg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gg;
    ctx.beginPath();
    ctx.arc(6, 0, 36, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  // cranium
  ctx.fillStyle = "rgba(235,245,255,0.10)";
  ctx.strokeStyle = "rgba(235,245,255,0.92)";
  ctx.lineWidth = 2.2;

  ctx.beginPath();
  ctx.ellipse(6, 0, 12, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // snout
  ctx.beginPath();
  ctx.moveTo(12, -5);
  ctx.lineTo(26, -2);
  ctx.lineTo(26, 2);
  ctx.lineTo(12, 5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // jaw (opens on chomp)
  const jawOpen = liz.jaw * 0.75;
  ctx.save();
  ctx.translate(14, 2);
  ctx.rotate(jawOpen);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(14, 4);
  ctx.lineTo(14, 8);
  ctx.lineTo(0, 6);
  ctx.closePath();
  ctx.fillStyle = "rgba(235,245,255,0.10)";
  ctx.strokeStyle = "rgba(235,245,255,0.88)";
  ctx.lineWidth = 2.0;
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // teeth hints
  ctx.strokeStyle = "rgba(235,245,255,0.55)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const tx = 14 + i * 2.2;
    ctx.beginPath();
    ctx.moveTo(tx, -1.5);
    ctx.lineTo(tx + 0.7, 1.0);
    ctx.stroke();
  }

  // eye
  ctx.fillStyle = getCSS("--eye");
  ctx.shadowBlur = glow ? 14 : 0;
  ctx.shadowColor = "rgba(255,120,120,0.6)";
  ctx.beginPath();
  ctx.arc(6, -2.2, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.restore();

  // subtle neck connector
  ctx.strokeStyle = "rgba(235,245,255,0.6)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(neck.x, neck.y);
  ctx.lineTo(hx, hy);
  ctx.stroke();
}

function getCSS(name) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

// ---- loop
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;

  if (trails) {
    // soften fill each frame for motion blur
  }
  verlet(dt);
  draw(dt);

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
