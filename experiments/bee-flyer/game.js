// ==========================================
// BEE FLYER - game engine
// ==========================================

// ----- CONFIG: tune the feel here -----
const CONFIG = {
  RESUME_URL: 'https://framerusercontent.com/assets/1LJu2AyCiR7ZIugwcFPzFXUevKU.pdf',
  gravity: 0.3,      // lower = floatier, more time to react
  lift: -6.6,        // flap strength: higher magnitude = snappier jump
  maxFall: 8,        // terminal velocity so the bee never drops too fast
  startSpeed: 2.4,   // scroll speed at score 0
  speedStep: 0.2,    // speed added every `speedEvery` points
  speedEvery: 5,
  maxSpeed: 4.4,
  spawnEvery: 95,    // frames between flower pairs
  gap: 190,          // vertical opening between flowers
  plantWidth: 28,    // collision width of the flower stems
  groundHeight: 60
};

// ----- DOM references -----
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startScreen = document.getElementById('start-screen');
const startButton = document.getElementById('start-btn');
const canvasContainer = document.querySelector('.canvas-container');
const gameOverModal = document.getElementById('gameOverModal');
const restartBtn = document.getElementById('restartBtn');
const scoreText = document.getElementById('scoreText');
const finalScoreText = document.getElementById('finalScore');
const crashQuipText = document.getElementById('crashQuip');
const bestScoreText = document.getElementById('bestScore');
const resumeLink = document.getElementById('resumeLink');

const W = canvas.width;
const H = canvas.height;
const GROUND_Y = H - CONFIG.groundHeight;
const PETAL_COLORS = ['#ff8fab', '#ffd166', '#c77dff', '#ff9f1c', '#8ecae6'];

// ----- State -----
let overlayVisible = true;   // start screen is showing
let isGameStarted = false;   // bee has been tapped at least once
let isGameOver = false;
let score = 0;
let frameCount = 0;          // only counts while flying (drives spawning)
let time = 0;                // always counts (idle bob + wing flap)
let speed = CONFIG.startSpeed;
let groundScroll = 0;
let shake = 0;
let crashTimer = null;
let obstacles = [];
let particles = [];

let bestScore = 0;
try {
  bestScore = Number(localStorage.getItem('beeFlyerBest')) || 0;
} catch (e) { /* storage blocked: fine, just no saved best */ }

const bee = { x: 90, y: H / 2, velocity: 0 };

// Two parallax layers of clouds: far ones are slower and softer
const clouds = Array.from({ length: 6 }, (_, i) => {
  const far = i % 2 === 0;
  return {
    x: Math.random() * W,
    y: 40 + Math.random() * 200,
    r: far ? 14 + Math.random() * 8 : 20 + Math.random() * 12,
    speed: far ? 0.25 : 0.6,
    color: far ? '#eaf6ff' : '#ffffff'
  };
});

// ==========================================
// HELPERS
// ==========================================
function burst(x, y, color, count, power = 3, life = 30) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const v = Math.random() * power;
    particles.push({
      x, y,
      vx: Math.cos(angle) * v,
      vy: Math.sin(angle) * v,
      life, max: life,
      color,
      size: 2 + Math.random() * 3
    });
  }
}

function updateScoreUI() {
  scoreText.innerText = score;
}

function crashQuip(s) {
  if (s === 0) return 'Gravity said hello before the first flower did. It happens to the best pollinators.';
  if (s < 5) return 'Beginner’s luck ran out. The flowers were not impressed.';
  if (s < 10) return 'Solid flying! Then the ground decided it wanted a hug.';
  if (s < 20) return 'Serious nectar navigation. Shame about the landing.';
  return 'Legend of the garden. The bee retires with honor and a sore wing.';
}

function saveBest() {
  if (score > bestScore) {
    bestScore = score;
    try { localStorage.setItem('beeFlyerBest', bestScore); } catch (e) { /* ignore */ }
  }
}

// ==========================================
// INPUT
// ==========================================
function flap() {
  if (isGameOver) return;
  if (!isGameStarted) isGameStarted = true;
  bee.velocity = CONFIG.lift;
  burst(bee.x - 12, bee.y + 6, 'rgba(255,255,255,0.9)', 3, 1.2, 18);
}

function hideStartScreen() {
  if (!overlayVisible) return;
  overlayVisible = false;
  startScreen.classList.add('fade-out');
  canvasContainer.classList.add('game-active'); // removes the blur
  setTimeout(() => startScreen.classList.add('hidden'), 400);
}

// Tap/click the canvas to flap (pointer events cover mouse + touch)
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  flap();
});

startButton.addEventListener('click', hideStartScreen);

window.addEventListener('keydown', (e) => {
  if (e.code !== 'Space') return;
  e.preventDefault();
  if (e.repeat) return; // holding space should not spam flaps
  if (overlayVisible) return hideStartScreen();
  if (isGameOver) return resetGame();
  flap();
});

restartBtn.addEventListener('click', resetGame);

// ==========================================
// UPDATE: physics, spawning, scoring
// ==========================================
function update() {
  time++;

  // Crash: the bee tumbles down to the ground
  if (isGameOver) {
    bee.velocity = Math.min(bee.velocity + CONFIG.gravity, CONFIG.maxFall);
    bee.y += bee.velocity;
    if (bee.y + 10 >= GROUND_Y) {
      bee.y = GROUND_Y - 10;
      bee.velocity = 0;
    }
    return;
  }

  // Before the first tap: the bee hovers and bobs gently
  if (!isGameStarted) {
    bee.y = H / 2 + Math.sin(time * 0.05) * 8;
    return;
  }

  frameCount++;
  speed = Math.min(
    CONFIG.maxSpeed,
    CONFIG.startSpeed + Math.floor(score / CONFIG.speedEvery) * CONFIG.speedStep
  );
  groundScroll = (groundScroll + speed) % 24;

  // Physics
  bee.velocity = Math.min(bee.velocity + CONFIG.gravity, CONFIG.maxFall);
  bee.y += bee.velocity;

  // Floor and ceiling are both deadly
  if (bee.y - 14 <= 0 || bee.y + 10 >= GROUND_Y) {
    triggerGameOver();
    return;
  }

  // Spawn a new pair of flowers
  if (frameCount % CONFIG.spawnEvery === 0) spawnPlant();

  // Move flowers, check collisions, score
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const obs = obstacles[i];
    obs.x -= speed;

    if (hitsPlant(obs)) {
      triggerGameOver();
      return;
    }

    if (!obs.passed && obs.x + CONFIG.plantWidth < bee.x) {
      obs.passed = true;
      score++;
      updateScoreUI();
      burst(bee.x, bee.y, '#ffd166', 8, 3, 25);
    }

    if (obs.x + CONFIG.plantWidth + 30 < 0) obstacles.splice(i, 1);
  }
}

function spawnPlant() {
  const margin = 70;
  const minTop = margin;
  const maxTop = GROUND_Y - CONFIG.gap - margin;
  obstacles.push({
    x: W,
    top: minTop + Math.random() * (maxTop - minTop), // top flower bottom edge
    color: PETAL_COLORS[Math.floor(Math.random() * PETAL_COLORS.length)],
    passed: false
  });
}

function hitsPlant(obs) {
  const bl = bee.x - 12;
  const br = bee.x + 12;
  const bt = bee.y - 12;
  const bb = bee.y + 10;

  const overlapX = br > obs.x && bl < obs.x + CONFIG.plantWidth;
  if (!overlapX) return false;

  // Gap runs from obs.top down to obs.top + gap
  return bt < obs.top || bb > obs.top + CONFIG.gap;
}

function updateClouds() {
  for (const c of clouds) {
    c.x -= c.speed;
    if (c.x + c.r * 2 < 0) {
      c.x = W + c.r * 2;
      c.y = 40 + Math.random() * 200;
    }
  }
}

function updateParticles() {
  for (const p of particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.08;
    p.vx *= 0.98;
    p.life--;
  }
  particles = particles.filter(p => p.life > 0);
}

// ==========================================
// DRAW
// ==========================================
function drawSky() {
  const grad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  grad.addColorStop(0, '#7ccfff');
  grad.addColorStop(1, '#d9f3ff');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}

function drawClouds() {
  for (const c of clouds) {
    ctx.fillStyle = c.color;
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
    ctx.arc(c.x + c.r * 0.9, c.y + c.r * 0.2, c.r * 0.8, 0, Math.PI * 2);
    ctx.arc(c.x - c.r * 0.9, c.y + c.r * 0.3, c.r * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawGround() {
  // Soil
  ctx.fillStyle = '#6b4423';
  ctx.fillRect(0, GROUND_Y, W, CONFIG.groundHeight);

  // Grass strip
  ctx.fillStyle = '#4caf50';
  ctx.fillRect(0, GROUND_Y, W, 12);

  // Grass tufts scroll with the game speed
  ctx.fillStyle = '#388e3c';
  for (let gx = -groundScroll; gx < W; gx += 24) {
    ctx.beginPath();
    ctx.moveTo(gx, GROUND_Y);
    ctx.lineTo(gx + 5, GROUND_Y - 8);
    ctx.lineTo(gx + 10, GROUND_Y);
    ctx.fill();
  }
}

function drawFlowerHead(cx, cy, color) {
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * 10, cy + Math.sin(a) * 10, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#fff3b0';
  ctx.beginPath();
  ctx.arc(cx, cy, 6, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlant(obs) {
  const cx = obs.x + CONFIG.plantWidth / 2;
  const headTop = obs.top - 12;                 // top flower sits at the gap edge
  const headBottom = obs.top + CONFIG.gap + 12; // bottom flower sits at the other edge

  // Stems
  ctx.strokeStyle = '#3d7a3a';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx, 0);
  ctx.lineTo(cx, headTop);
  ctx.moveTo(cx, GROUND_Y);
  ctx.lineTo(cx, headBottom);
  ctx.stroke();

  // Leaves
  ctx.fillStyle = '#4caf50';
  ctx.beginPath();
  ctx.ellipse(cx - 10, obs.top * 0.5, 9, 4, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + 10, GROUND_Y - 60, 9, 4, 0.5, 0, Math.PI * 2);
  ctx.fill();

  // Flower heads
  drawFlowerHead(cx, headTop, obs.color);
  drawFlowerHead(cx, headBottom, obs.color);
}

function drawBee(x, y) {
  const flapEvery = bee.velocity < 0 ? 3 : 6;   // flap faster while rising
  const wingOffset = Math.floor(time / flapEvery) % 2 === 0 ? -6 : 2;
  const tilt = Math.max(-0.45, Math.min(0.5, bee.velocity * 0.06)); // nose up when rising

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#000000';

  // Wings
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(-2, -22 + wingOffset, 7, 14, Math.PI / 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(4, -26 + wingOffset, 8, 16, Math.PI / 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Body (yellow, like the sprite SVG) with stripes clipped inside it
  ctx.beginPath();
  ctx.ellipse(0, -10, 22, 15, Math.PI / 12, 0, Math.PI * 2);
  ctx.fillStyle = '#FFE816';
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.moveTo(-10, -19); ctx.lineTo(-6, 3);
  ctx.moveTo(-2, -21);  ctx.lineTo(2, 1);
  ctx.moveTo(6, -23);   ctx.lineTo(10, -1);
  ctx.stroke();
  ctx.restore();
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(0, -10, 22, 15, Math.PI / 12, 0, Math.PI * 2);
  ctx.stroke();

  // Head
  ctx.beginPath();
  ctx.arc(18, -12, 11, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.stroke();

  // Antennae
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(14, -22);
  ctx.quadraticCurveTo(12, -28, 9, -27);
  ctx.moveTo(20, -22);
  ctx.quadraticCurveTo(22, -29, 25, -28);
  ctx.stroke();

  // Eye and smile
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(21, -16, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(22, -12, 4, 0.4 * Math.PI, 1.1 * Math.PI);
  ctx.stroke();

  ctx.restore();
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawScore() {
  ctx.font = 'bold 20px Inter, sans-serif';
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#ffffff';
  ctx.strokeText(`Score: ${score}`, 16, 36);
  ctx.fillStyle = '#1a202c';
  ctx.fillText(`Score: ${score}`, 16, 36);
}

function draw() {
  ctx.save();

  // Screen shake on crash
  if (shake > 0.5) {
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    shake *= 0.85;
  } else {
    shake = 0;
  }

  drawSky();
  drawClouds();
  for (const obs of obstacles) drawPlant(obs);
  drawGround();
  drawBee(bee.x, bee.y);
  drawParticles();
  drawScore();

  ctx.restore();
}

// ==========================================
// GAME LOOP
// ==========================================
function loop() {
  updateClouds();
  update();
  updateParticles();
  draw();
  requestAnimationFrame(loop);
}

// ==========================================
// GAME OVER & RESET
// ==========================================
function triggerGameOver() {
  if (isGameOver) return;
  isGameOver = true;
  shake = 14;

  burst(bee.x, bee.y, '#ff6b6b', 14, 5, 35);   // impact burst
  burst(bee.x, bee.y, '#ffffff', 10, 4, 45);   // feathers

  saveBest();
  finalScoreText.innerText = score;
  crashQuipText.innerText = crashQuip(score);
  bestScoreText.innerText = bestScore;
  resumeLink.href = CONFIG.RESUME_URL;

  // Let the crash play out before the modal appears
  crashTimer = setTimeout(() => gameOverModal.classList.remove('hidden'), 600);
}

function resetGame() {
  clearTimeout(crashTimer);
  gameOverModal.classList.add('hidden');

  isGameStarted = false;
  isGameOver = false;
  score = 0;
  frameCount = 0;
  speed = CONFIG.startSpeed;
  groundScroll = 0;
  shake = 0;
  obstacles = [];
  particles = [];
  bee.y = H / 2;
  bee.velocity = 0;
  updateScoreUI();
}

// ==========================================
// START
// ==========================================
resumeLink.href = CONFIG.RESUME_URL;
bestScoreText.innerText = bestScore;
loop(); // runs from the start so the blurred preview is alive behind the overlay
