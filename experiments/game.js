console.log("Bee Flyer Game Engine Loaded");

// Future game loop and jump physics will attach here!

const canvas = document.getElementById('beeCanvas');
const ctx = canvas.getContext('2d');

// Game state variables
let isGameOver = false;
let score = 0;

// Bee object properties
const bee = {
  x: 80,
  y: canvas.height / 2,
  radius: 18,
  gravity: 0.6,
  lift: -10,
  velocity: 0
};

// Handle user flight input (Click, Tap, or Spacebar)
function triggerFly() {
  if (isGameOver) {
    resetGame();
  } else {
    bee.velocity = bee.lift;
  }
}

window.addEventListener('click', triggerFly);
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault(); // Prevent page scrolling
    triggerFly();
  }
});

// Update game physics per frame
function update() {
  if (isGameOver) return;

  // Apply gravity and velocity to the bee
  bee.velocity += bee.gravity;
  bee.y += bee.velocity;

  // Floor and ceiling collision boundaries
  if (bee.y + bee.radius > canvas.height) {
    bee.y = canvas.height - bee.radius;
    gameOver();
  }
  if (bee.y - bee.radius < 0) {
    bee.y = bee.radius;
    bee.velocity = 0;
  }
}

// Render graphics to canvas
function draw() {
  // Clear canvas background
  ctx.fillStyle = '#F8FAFC'; // Clean light slate background
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw the Bee (placeholder circle / emoji or custom sprite)
  ctx.beginPath();
  ctx.arc(bee.x, bee.y, bee.radius, 0, Math.PI * 2);
  ctx.fillStyle = '#009dff';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#1E293B';
  ctx.stroke();
  ctx.closePath();

  // Draw Score text
  ctx.fillStyle = '#1E293B';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText(`Score: ${score}`, 20, 40);
}

// Main animation loop
function loop() {
  update(); // 1. Calculate new positions and physics
  draw(); // 2. Handles the visuals: it wipes the canvas clean, draws the bee at its new coordinates, and updates the score text.
  if (!isGameOver) { // 3. Is a built-in browser method that tells the code: "Run this loop again right before the screen refreshes" (usually 60 times a second).
    requestAnimationFrame(loop);
  }
}

// Trigger Game Over and show resume prompt
function gameOver() {
  isGameOver = true;
  document.getElementById('final-score').innerText = score;
  document.getElementById('game-over-screen').classList.remove('hidden');
}

// Reset game state
function resetGame() {
  isGameOver = false;
  score = 0;
  bee.y = canvas.height / 2;
  bee.velocity = 0;
  document.getElementById('game-over-screen').classList.add('hidden');
  loop();
}

// Kick off the loop
loop();