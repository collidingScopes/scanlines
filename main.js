/*
To do:
- dat.gui control
- animation doesn't need to restart always?
- control for color
- improve color changes based on turbulence (lighten only?)
- how to improve performance / simplify calculations, so that more particles can be rendered / fps can be improved
- toggle for edge thresholds
- can the particle speed be variable (it speeds up as it approaches an edge, and then speeds up as it leaves an edge?)
- control for particle direction (left, right, up, down, angle??)
- improve default parameters
- use static edge threshold (controllable with GUI)
- fire a new wave based on pixel distance from previous wave (rather than time)
- Toggle to show edge thresholds upon startup or not
- default image
- readme / github / description
- about / footer divs
- video and image export
*/

// Canvas setup
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { 
    willReadFrequently: true,
    alpha: false,
});
const fileInput = document.getElementById('fileInput');
const statusElement = document.getElementById('status');
const playPauseBtn = document.getElementById('playPauseBtn');
const restartBtn = document.getElementById('restartBtn');

// State variables
const particleWaves = [];
let edgeData = null;
let isAnimating = false;
let lastWaveTime = 0;
let waveCount = 0;

// Constants and configuration
const MAX_WAVES = 200;
const INITIAL_THRESHOLD = 200;
const MIN_THRESHOLD = 50;
const INTERACTION_RADIUS = 1;
const TWO_PI = Math.PI * 2;

// Animation parameters
let WAVE_INTERVAL = 1500;
let NUM_PARTICLES = 150;
let ANIMATION_SPEED = 0.3;
let frozenProbability = 0.5;
let MAX_TURBULENCE = 1.0;
let BASE_PARTICLE_SIZE = 1.5;

// Offscreen canvas for grid
const gridCanvas = document.createElement('canvas');
gridCanvas.width = canvas.width;
gridCanvas.height = canvas.height;
const gridCtx = gridCanvas.getContext('2d', { alpha: false });

// Grid drawing function
function drawGrid() {
    gridCtx.fillStyle = '#000000';
    gridCtx.fillRect(0, 0, gridCanvas.width, gridCanvas.height);
    
    gridCtx.strokeStyle = 'rgba(111, 159, 255, 0.1)';
    gridCtx.lineWidth = 0.5;
    
    const gridSize = 20;
    
    for(let x = 0; x < gridCanvas.width; x += gridSize) {
        gridCtx.beginPath();
        gridCtx.moveTo(x, 0);
        gridCtx.lineTo(x, gridCanvas.height);
        gridCtx.stroke();
    }
    
    for(let y = 0; y < gridCanvas.height; y += gridSize) {
        gridCtx.beginPath();
        gridCtx.moveTo(0, y);
        gridCtx.lineTo(gridCanvas.width, y);
        gridCtx.stroke();
    }
}

// Initialize grid
drawGrid();

// Create default edge data
function createDefaultEdgeData() {
    const data = new Uint8ClampedArray(canvas.width * canvas.height * 4);
    // Fill with white (255) to allow particles to move freely
    for (let i = 0; i < data.length; i += 4) {
        data[i] = data[i + 1] = data[i + 2] = 255;
        data[i + 3] = 255;
    }
    return data;
}

// Initialize with default edge data
edgeData = createDefaultEdgeData();

// Particle class
class Particle {
  constructor(x, y, threshold, waveIndex, waveFrequency, waveAmplitude) {
      this.x = x;
      this.y = y;
      this.originalY = y;
      this.frozen = false;
      this.speed = ANIMATION_SPEED;
      this.size = BASE_PARTICLE_SIZE;
      this.glowIntensity = Math.random() * 0.5 + 0.5;
      this.threshold = threshold;
      this.waveIndex = waveIndex;
      this.turbulence = 0;
      this.verticalOffset = 0;
      this.phaseOffset = Math.random() * TWO_PI;
      this.lastInteractionTime = 0;

      this.waveFrequency = waveFrequency;
      this.waveAmplitude = waveAmplitude;
      
      this.onCooldown = false;
      this.cooldownDistance = 0;
      this.COOLDOWN_PIXELS = 50; // Distance in pixels before particle can stick again
  }

  update(currentTime) {
      if (this.frozen) return;

      let hasCollision = false;

      // Update position and check for edges
      if (this.x < canvas.width - 1 && this.y < canvas.height - 1) {
          const index = (Math.floor(this.y) * canvas.width + Math.floor(this.x)) * 4;
          const edgeIntensity = edgeData[index + (4*this.waveIndex)]; //each wave looks ahead by one more pixel (creates "build-up" at edges)
          
          // Check if we're on an edge
          if (edgeIntensity < this.threshold && this.x > 20) {
              if (!this.onCooldown && Math.random() < frozenProbability) {
                // Attempt to stick
                  this.frozen = true;
                  return;
              } else if (!this.onCooldown) {
                  // Start cooldown if we pass over an edge but don't stick
                  this.onCooldown = true;
                  this.cooldownDistance = 0;
                  hasCollision = true;
              }
          }
      }

      // Move the particle
      if (!this.frozen && this.x < canvas.width) {
          let moveAmount = 1 * this.speed * 0.8;

          if(hasCollision){
            moveAmount += (this.waveAmplitude*MAX_TURBULENCE) * (Math.sin(this.y/this.waveFrequency)) + 2;
          }
          this.x += moveAmount;
          
          // Update cooldown distance if active
          if (this.onCooldown) {
              this.cooldownDistance += moveAmount;
              if (this.cooldownDistance >= this.COOLDOWN_PIXELS) {
                  this.onCooldown = false;
              }
          }
      }
  }

  draw() {

      const size = BASE_PARTICLE_SIZE * (1 + this.turbulence * 1.2);
      
      const intensity = Math.max(0,(0.9 - this.turbulence * 0.9));
      const gray = Math.floor(255 - this.turbulence * 100);

      ctx.beginPath();
      ctx.arc(this.x, this.y, size, 0, TWO_PI);

      if (this.frozen) {
        //ctx.fillStyle = `rgba(111, 159, 255, ${intensity * this.glowIntensity})`;
        ctx.fillStyle = `rgba(111, 159, 255, 1)`;
      } else {
        ctx.fillStyle = `rgba(${gray}, ${gray}, ${gray}, ${intensity * this.glowIntensity})`;
        //ctx.fillStyle = `rgb(${gray}, ${gray}, ${gray})`;
      }
      
      ctx.fill();

  }
}

// Wave creation
function createParticleWave() {
  //const currentThreshold = Math.max(MIN_THRESHOLD, INITIAL_THRESHOLD - (waveCount * 6));
  let currentThreshold = INITIAL_THRESHOLD - ((INITIAL_THRESHOLD-MIN_THRESHOLD)*(waveCount/MAX_WAVES))

  let waveFrequency = 20 - Math.random()*10;
  let waveAmplitude = 10 * Math.random();

  const particles = new Array(NUM_PARTICLES);
  
  for (let i = 0; i < NUM_PARTICLES; i++) {
      //const y = (canvas.height / NUM_PARTICLES) * i;
      let y = canvas.height * Math.random();
      particles[i] = new Particle(0, y, currentThreshold, waveCount, waveFrequency, waveAmplitude);
  }
  
  particleWaves.push({
      particles,
      threshold: currentThreshold,
      timestamp: Date.now()
  });
  
  waveCount++;
  statusElement.textContent = `Wave ${waveCount} Launched - Threshold: ${currentThreshold}`;
  
  if (particleWaves.length > MAX_WAVES) {
      particleWaves.shift();
  }
}

// Edge detection
function detectEdges(imageData) {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  const output = new Uint8ClampedArray(data.length);
  const stride = width * 4;

  // Single-pass edge detection
  for (let y = 1; y < height - 1; y++) {
      const rowOffset = y * stride;
      for (let x = 1; x < width - 1; x++) {
          const idx = rowOffset + x * 4;
          
          // Calculate grayscale using luminance weights
          const gray = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
          const right = data[idx + 4] * 0.299 + data[idx + 5] * 0.587 + data[idx + 6] * 0.114;
          const bottom = data[idx + stride] * 0.299 + data[idx + stride + 1] * 0.587 + data[idx + stride + 2] * 0.114;
          
          const value = Math.abs(gray - right) > 20 || Math.abs(gray - bottom) > 20 ? 0 : 255;
          output[idx] = output[idx + 1] = output[idx + 2] = value;
          output[idx + 3] = 255;
      }
  }

  return output;
}

// Animation
let lastFrameTime = 0;
function animate(currentTime) {
  if (!isAnimating) return;

  // Calculate delta time for smooth animation
  const deltaTime = (currentTime - lastFrameTime) * ANIMATION_SPEED;
  lastFrameTime = currentTime;

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Draw pre-rendered grid
  ctx.drawImage(gridCanvas, 0, 0);

  if (currentTime - lastWaveTime >= WAVE_INTERVAL) {
      createParticleWave();
      lastWaveTime = currentTime;
  }

  // Update and draw particles in a single loop
  for (const wave of particleWaves) {
      for (const particle of wave.particles) {
          particle.update(currentTime);
          particle.draw();
      }
  }

  requestAnimationFrame(animate);
}

function restartAnimation() {
  particleWaves.length = 0;
  waveCount = 0;
  const currentTime = performance.now();
  lastWaveTime = currentTime - WAVE_INTERVAL; // This ensures a new wave will be created soon
  lastFrameTime = currentTime;
  
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(gridCanvas, 0, 0);
  
  createParticleWave();
  
  if (!isAnimating) {
      isAnimating = true;
      animate(currentTime);
      playPauseBtn.textContent = 'Pause';
  }
}

// Image handling
let currentImage = null;

const handleResize = _.debounce(() => {
  if (!currentImage) return;
  
  const maxWidth = window.innerWidth * 0.8;
  const maxHeight = window.innerHeight * 0.8;
  
  const widthRatio = maxWidth / currentImage.width;
  const heightRatio = maxHeight / currentImage.height;
  const scale = Math.min(widthRatio, heightRatio);
  
  canvas.width = currentImage.width * scale;
  canvas.height = currentImage.height * scale;
  
  // Update grid canvas size
  gridCanvas.width = canvas.width;
  gridCanvas.height = canvas.height;
  drawGrid();
  
  ctx.drawImage(currentImage, 0, 0, canvas.width, canvas.height);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  edgeData = detectEdges(imageData);
  
  console.log("Canvas size: "+canvas.width+", "+canvas.height);

  restartAnimation();
}, 250);

// Slider elements
const speedSlider = document.getElementById('speedSlider');
const waveFreqSlider = document.getElementById('waveFreqSlider');
const particleCountSlider = document.getElementById('particleCountSlider');
const frozenProbSlider = document.getElementById('frozenProbSlider');
const turbulenceSlider = document.getElementById('turbulenceSlider');
const particleSizeSlider = document.getElementById('particleSizeSlider');

const speedValue = document.getElementById('speedValue');
const waveFreqValue = document.getElementById('waveFreqValue');
const particleCountValue = document.getElementById('particleCountValue');
const frozenProbValue = document.getElementById('frozenProbValue');
const turbulenceValue = document.getElementById('turbulenceValue');
const particleSizeValue = document.getElementById('particleSizeValue');

// Update functions
function updateSpeed(value) {
  ANIMATION_SPEED = parseFloat(value);
  speedValue.textContent = `${value}x`;
}

function updateWaveFrequency(value) {
  WAVE_INTERVAL = parseInt(value);
  waveFreqValue.textContent = `${value}ms`;
}

function updateParticleCount(value) {
  NUM_PARTICLES = parseInt(value);
  particleCountValue.textContent = value;
}

function updateFrozenProbability(value) {
  frozenProbability = parseFloat(value);
  frozenProbValue.textContent = frozenProbability.toFixed(2);
}

function updateTurbulence(value) {
  MAX_TURBULENCE = parseFloat(value);
  turbulenceValue.textContent = MAX_TURBULENCE.toFixed(1);
}

function updateParticleSize(value) {
  BASE_PARTICLE_SIZE = parseFloat(value);
  particleSizeValue.textContent = BASE_PARTICLE_SIZE.toFixed(1);
}

// Slider event listeners
speedSlider.addEventListener('input', (e) => {
  updateSpeed(e.target.value);
});

waveFreqSlider.addEventListener('input', (e) => {
  updateWaveFrequency(e.target.value);
});

particleCountSlider.addEventListener('input', (e) => {
  updateParticleCount(e.target.value);
});

frozenProbSlider.addEventListener('input', (e) => {
  updateFrozenProbability(e.target.value);
});

turbulenceSlider.addEventListener('input', (e) => {
  updateTurbulence(e.target.value);
});

particleSizeSlider.addEventListener('input', (e) => {
  updateParticleSize(e.target.value);
});

// Debounced restart function for slider changes
const debouncedRestart = _.debounce(() => {
  if (isAnimating) {
      restartAnimation();
  }
}, 250);

// Add restart trigger to all sliders
[speedSlider, waveFreqSlider, particleCountSlider, frozenProbSlider, turbulenceSlider, particleSizeSlider].forEach(slider => {
  slider.addEventListener('change', debouncedRestart);
});

// Event Listeners
window.addEventListener('resize', handleResize);

playPauseBtn.addEventListener('click', () => {
  isAnimating = !isAnimating;
  playPauseBtn.textContent = isAnimating ? 'Pause' : 'Play';
  if (isAnimating) {
      lastFrameTime = performance.now();
      animate(lastFrameTime);
  }
});

restartBtn.addEventListener('click', restartAnimation);

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  statusElement.textContent = "Processing Image...";
  
  currentImage = new Image();
  currentImage.onload = () => {
      const maxWidth = window.innerWidth * 0.8;
      const maxHeight = window.innerHeight * 0.8;
      
      const widthRatio = maxWidth / currentImage.width;
      const heightRatio = maxHeight / currentImage.height;
      const scale = Math.min(widthRatio, heightRatio);
      
      canvas.width = currentImage.width * scale;
      canvas.height = currentImage.height * scale;
      
      // Update grid canvas size
      gridCanvas.width = canvas.width;
      gridCanvas.height = canvas.height;
      drawGrid();

      ctx.drawImage(currentImage, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      console.log("Canvas size: "+canvas.width+", "+canvas.height);
      
      statusElement.textContent = "Detecting Edges...";
      edgeData = detectEdges(imageData);

      statusElement.textContent = "Initializing Particle System...";
      
      // Enable controls
      playPauseBtn.disabled = false;
      restartBtn.disabled = false;
      
      // Reset all animation state
      particleWaves.length = 0;
      waveCount = 0;
      lastWaveTime = performance.now();
      
      // Ensure animation is running
      isAnimating = true;
      lastFrameTime = performance.now();
      playPauseBtn.textContent = 'Pause';
      
      // Start fresh wave
      createParticleWave();
      animate(lastFrameTime);
      
      statusElement.textContent = "Animation Running";
  };
  currentImage.src = URL.createObjectURL(file);
});

// Start animation immediately
isAnimating = true;
lastFrameTime = performance.now();
lastWaveTime = lastFrameTime;
createParticleWave();
animate(lastFrameTime);