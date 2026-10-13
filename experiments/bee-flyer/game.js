console.log("Bee Flyer Game Engine Loaded");

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const groundHeight = 60;

let isGameStarted = false; // New: Tracks if the player has made their first tap
let isGameOver = false;
let score = 0;
let frameCount = 0;

// Obstacle configuration for garden plants
const obstacles = [];
const spawnRate = 90; // Spawns flowers quicker (lower number = closer together)
const obstacleWidth = 40;
const obstacleGap = 200; 

// Bee Object Setup - This is where we adjust the bees' movements
const bee = {
  x: 80,
  y: canvas.height / 2,
  radius: 18,
  gravity: 0.35,  // Reduced from 0.55 so it falls much slower & smoother
  lift: -7.5,     // Adjusted lift to match the lighter gravity perfectly
  velocity: 0
};
// ==========================================
// INPUT LISTENER: Start/Flap on Click or Spacebar
// ==========================================
function triggerFly(e) {
  // Prevent default behavior if clicking buttons
  if (isGameOver) return;

  if (!isGameStarted) {
    isGameStarted = true; // Kick off physics and movement on first tap!
  }
  
  bee.velocity = bee.lift;
}

// Bind to the canvas specifically so clicks inside the game area always register
canvas.addEventListener('click', triggerFly);

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    if (isGameOver) {
      resetGame();
    } else {
      triggerFly();
    }
  }
});

// ==========================================
// UPDATE FUNCTION: Physics & Plant Spawning
// ==========================================
function update() {
  if (!isGameStarted || isGameOver) return; // Freeze physics until player taps!

  // 1. Apply gravity and update bee position
  bee.velocity += bee.gravity;
  bee.y += bee.velocity;

  // Flight Boundaries: Crash if hitting ground or flying off top screen
  const floorLevel = canvas.height - groundHeight;
  if (bee.y >= floorLevel || bee.y <= 0) {
    triggerGameOver();
  }

  // 2. Spawning Logic: Create garden plants quicker
  frameCount++;
  if (frameCount % spawnRate === 0) {
    const minHeight = 60;
    const maxHeight = canvas.height - obstacleGap - 120;
    const topHeight = Math.floor(Math.random() * (maxHeight - minHeight + 1)) + minHeight;

    obstacles.push({
      x: canvas.width,
      top: topHeight,
      bottom: canvas.height - (topHeight + obstacleGap),
      passed: false
    });
  }

  // 3. Movement, Scoring, and Collision Loop
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const obs = obstacles[i];
    obs.x -= 2.5; // Smooth scrolling speed

    // Check collision with plant stems
    const beeLeft = bee.x - 14;
    const beeRight = bee.x + 14;
    const beeTop = bee.y - 12;
    const beeBottom = bee.y + 10;

    if (
      beeRight > obs.x &&
      beeLeft < obs.x + obstacleWidth &&
      (beeTop < obs.top || beeBottom > canvas.height - obs.bottom)
    ) {
      triggerGameOver();
    }

    // Increase score if bee passes plant successfully
    if (!obs.passed && obs.x + obstacleWidth < bee.x) {
      score++;
      document.getElementById('scoreText').innerText = score;
      obs.passed = true;
    }

    // Clean up off-screen plants
    if (obs.x + obstacleWidth < 0) {
      obstacles.splice(i, 1);
    }
  }
}

// ==========================================
// CUSTOM VECTOR BEE RENDERER
// ==========================================
function drawBee(x, y) {
  const wingOffset = (Math.floor(frameCount / 5) % 2 === 0) ? -6 : 2;
  
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;

  // 1. Wings
  ctx.beginPath();
  ctx.ellipse(x - 2, y - 22 + wingOffset, 7, 14, Math.PI / 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(x + 4, y - 26 + wingOffset, 8, 16, Math.PI / 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // 2. Main Body
  ctx.beginPath();
  ctx.ellipse(x, y - 10, 22, 15, Math.PI / 12, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF'; 
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#000000';
  ctx.stroke();

  // 3. Three Bold Black Stripes
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 4.5;
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.moveTo(x - 10, y - 19);
  ctx.lineTo(x - 6, y + 3);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x - 2, y - 21);
  ctx.lineTo(x + 2, y + 1);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x + 6, y - 23);
  ctx.lineTo(x + 10, y - 1);
  ctx.stroke();

  ctx.lineWidth = 2.5;

  // 4. Head
  ctx.beginPath();
  ctx.arc(x + 18, y - 12, 11, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.strokeStyle = '#000000';
  ctx.stroke();

  // 5. Antennae
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 14, y - 22);
  ctx.quadraticCurveTo(x + 12, y - 28, x + 9, y - 27);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x + 20, y - 22);
  ctx.quadraticCurveTo(x + 22, y - 29, x + 25, y - 28);
  ctx.stroke();

  // 6. Eye & Smile
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(x + 21, y - 16, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x + 22, y - 12, 4, 0.4 * Math.PI, 1.1 * Math.PI);
  ctx.stroke();
}

// ==========================================
// HELPER: Draw Vector Flower Blossom
// ==========================================
function drawFlowerHead(cx, cy, radius) {
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#718096';
  ctx.lineWidth = 2;

  const petals = 8;
  ctx.beginPath();
  for (let i = 0; i < petals; i++) {
    const angle = (i * 2 * Math.PI) / petals;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#718096';
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ==========================================
// DRAW FUNCTION: Bright Outdoor Garden
// ==========================================
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // 1. Bright Outdoor Sky Background (Lighter tone)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 2. Ground Grass Baseline
  const floorY = canvas.height - groundHeight;
  ctx.fillStyle = '#1a202c';
  ctx.fillRect(0, floorY, canvas.width, groundHeight);

  ctx.strokeStyle = '#718096';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, floorY);
  ctx.lineTo(canvas.width, floorY);
  ctx.stroke();

  // 3. Draw Garden Plant Stems & Blossoms
  for (let i = 0; i < obstacles.length; i++) {
    const obs = obstacles[i];
    const stemX = obs.x + obstacleWidth / 2;

    ctx.strokeStyle = '#cbd5e0';
    ctx.lineWidth = 2;

    // Bottom Plant Stem
    ctx.beginPath();
    ctx.moveTo(stemX, floorY);
    ctx.lineTo(stemX, floorY - obs.bottom);
    ctx.stroke();

    drawFlowerHead(stemX, floorY - obs.bottom, 12);

    // Top Plant Stem
    ctx.beginPath();
    ctx.moveTo(stemX, 0);
    ctx.lineTo(stemX, obs.top);
    ctx.stroke();

    drawFlowerHead(stemX, obs.top, 12);
  }

  // 4. Render Vector Bee
  drawBee(bee.x, bee.y);

  // 5. Score display
  ctx.fillStyle = '#f0f2f5';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(`Score: ${score}`, 20, 40);
}

// ==========================================
// GAME LOOP
// ==========================================
function loop() {
  update();
  draw();

  requestAnimationFrame(loop);
}

// ==========================================
// GAME OVER & RESET HELPERS
// ==========================================
function triggerGameOver() {
  isGameOver = true;
  document.getElementById('finalScore').innerText = score;
  document.getElementById('gameOverModal').classList.remove('hidden');
}

function resetGame() {
  isGameStarted = false; // Return to hover-at-start state
  isGameOver = false;
  score = 0;
  frameCount = 0;
  obstacles.length = 0;
  bee.y = canvas.height / 2;
  bee.velocity = 0;
  document.getElementById('scoreText').innerText = score;
  document.getElementById('gameOverModal').classList.add('hidden');
}
// Hook up the Try Again restart button
const restartBtn = document.getElementById('restartBtn');
if (restartBtn) {
  restartBtn.addEventListener('click', () => {
    resetGame();
  });
}

// ==========================================
// START GAME TRIGGER & CANVAS REVEAL
// ==========================================
const startButton = document.getElementById('start-btn');
const startScreen = document.getElementById('start-screen');
const canvasContainer = document.querySelector('.canvas-container');

startButton.addEventListener('click', () => {
  startScreen.style.display = 'none';
  canvasContainer.classList.add('game-active');
  loop(); // Starts the loop, but bee waits safely until first tap!
});
