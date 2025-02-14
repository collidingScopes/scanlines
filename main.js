/*
To do:
- how to improve performance / simplify calculations, so that more particles can be rendered / fps can be improved
- can the particle speed be variable (it speeds up as it approaches an edge, and then speeds up as it leaves an edge?)
- control for particle direction (left, right, up, down, angle??)
- improve default parameters
- Toggle to show all image edge thresholds upon startup or not
- if collisionHistory is true, blend the particle color in between edge / frozen color
- if collisionHistory is true, particle should start to oscillate over time based on waves (rather than a static manipulation upon collision)
- default image
- readme / github / description
- about / footer divs
- video and image export
- canvas should be resized upon startup
- add color palette selections
- randomize inputs button
- add emoji buttons underneath canvas (similar to particular drift)
- can we delete particle waves once they reach the end of the canvas to improve performance?
- reorder functions more logically (main functions, helper functions, etc.)
*/

// Canvas setup
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { 
    willReadFrequently: true,
    alpha: false,
});
const fileInput = document.getElementById('fileInput');
const playPauseBtn = document.getElementById('playPauseBtn');
const restartBtn = document.getElementById('restartBtn');

// State variables
let particleWaves = [];
let edgeData = null;
let waveCount = 0;
let frameCounter = 0;

// Constants and configuration
const MAX_WAVES = 200;
const INTERACTION_RADIUS = 1;
const TWO_PI = Math.PI * 2;
const maxCanvasSize = 0.8;
const COOLDOWN_PIXELS = 50;
const COOLDOWN_FRAMES = 100;

let animationID;
let isPlaying = false;

// Configuration
let gui = new dat.gui.GUI( { autoPlace: false } );
//gui.close();
let guiOpenToggle = true;
const CONFIG = {
    animationSpeed: { value: 0.5, min: 0.1, max: 2.0, step: 0.1 },
    waveInterval: { value: 150, min: 50, max: 300, step: 1 },
    numParticles: { value: 150, min: 50, max: 400, step: 1 },
    frozenProbability: { value: 0.5, min: 0.0, max: 1.0, step: 0.01 },
    turbulence: { value: 1, min: 0, max: 4, step: 0.1 },
    particleSize: { value: 1, min: 0.5, max: 2.0, step: 0.1 },
    edgeThreshold: { value: 100, min: 50, max: 300, step: 1 },
    selectedPalette: 'galaxy',
    backgroundColor: '#0f0d2e',
    particleColor: '#ffffff',
    edgeColor: '#6f9fff',
    IS_PLAYING: true,
};

function initGUI() {
    
  // Initialize controllers object
  window.guiControllers = {};

  // Add individual color controls
  window.guiControllers.particleColor = gui.addColor(CONFIG, 'particleColor')
    .name('particleColor')
    .onChange(v => updateConfig('particleColor', v));

  window.guiControllers.edgeColor = gui.addColor(CONFIG, 'edgeColor')
    .name('edgeColor')
    .onChange(v => updateConfig('edgeColor', v));

  window.guiControllers.backgroundColor = gui.addColor(CONFIG, 'backgroundColor')
    .name('backgroundColor')
    .onChange(v => updateConfig('backgroundColor', v));
  
  // Add other controls
  Object.entries(CONFIG).forEach(([key, value]) => {
      if (typeof value === 'object' && !Array.isArray(value)) {
          window.guiControllers[key] = gui.add(CONFIG[key], 'value', value.min, value.max, value.step)
              .name(key.replace(/_/g, ' '))
              .onChange(v => updateConfig(key, v));
      }
  });

  gui.add({ togglePlayPause }, 'togglePlayPause').name('Pause/Play (space)');
  gui.add({ restartAnimation }, 'restartAnimation').name('Restart Animation (enter)');
  gui.add({ randomize: randomizeInputs }, 'randomize').name('Randomize Inputs (r)');

  CONFIG['uploadImage'] = function () {
    fileInput.click();
  };
  gui.add(CONFIG, 'uploadImage').name('Upload Image (u)');
  
  CONFIG['saveImage'] = function () {
    saveImage();
  };
  gui.add(CONFIG, 'saveImage').name("Save Image (s)");
  
  CONFIG['saveVideo'] = function () {
    toggleVideoRecord();
  };
  gui.add(CONFIG, 'saveVideo').name("Video Export (v)");
  
  customContainer = document.getElementById('gui');
  customContainer.appendChild(gui.domElement);
}

function updateConfig(key, value) {

  // Update the configuration
  if (key.includes('Color')) {
      CONFIG[key] = value;
  } else if (typeof CONFIG[key] === 'object' && CONFIG[key].hasOwnProperty('value')) {
      CONFIG[key] = {
          ...CONFIG[key],
          value: typeof value === 'object' ? value.value : value
      };
  } else {
      CONFIG[key] = value;
  }

}

function togglePlayPause(){
  console.log("isPlaying: "+isPlaying);
  if(isPlaying){
    cancelAnimationFrame(animationID);
  } else {
    animationID = requestAnimationFrame(animate);
  }
  isPlaying = !isPlaying;
}

function randomizeInputs(){

}

function setupEventListeners() {
  // imageInput.addEventListener('change', handleImageUpload);
  // document.getElementById('restartBtn').addEventListener('click', () => safeRestartAnimation());
  // document.getElementById('randomizeColorBtn').addEventListener('click', () => chooseRandomPalette());
  // document.getElementById('randomizeBtn').addEventListener('click', () => randomizeInputs());
  // document.getElementById('exportVideoBtn').addEventListener('click', () => toggleVideoRecord());

  //shortcut hotkey presses
  document.addEventListener('keydown', function(event) {
    
    if (event.key === 's') {
      saveImage();
    } else if (event.key === 'v') {
      toggleVideoRecord();
    } else if (event.code === 'Space') {
      event.preventDefault();
      togglePlayPause();
    } else if(event.key === 'Enter'){
      restartAnimation();
    } else if(event.key === 'r'){
      randomizeInputs();
    } else if(event.key === 'u'){
      fileInput.click();
    }
    
  });

}

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
  constructor(x, y, waveIndex, waveFrequency, waveAmplitude) {
      this.x = x;
      this.y = y;
      this.frozen = false;
      this.glowIntensity = Math.random() * 0.5 + 0.5;
      this.turbulence = 0;
      this.collisionHistory = false;

      this.waveIndex = waveIndex;
      this.waveFrequency = waveFrequency;
      this.waveAmplitude = waveAmplitude;
      
      this.onCooldown = false;
      this.cooldownDistance = 0;
      this.cooldownFrames = 0;
  }

  update() {
      if (this.frozen || this.x >= canvas.width) {
        return;
      }

      let hasCollision = false;

      // Update position and check for edges
      if (this.x < canvas.width - 1 && this.y < canvas.height - 1) {
          const index = (Math.floor(this.y) * canvas.width + Math.floor(this.x)) * 4;
          const edgeIntensity = edgeData[index + (4*this.waveIndex)]; //each wave looks ahead by one more pixel (creates "build-up" at edges)
          
          // Check if we're on an edge
          if (edgeIntensity < CONFIG['edgeThreshold'].value && this.x > 20) {
              if (!this.onCooldown && Math.random() < CONFIG['frozenProbability'].value) {
                // Attempt to stick
                  this.frozen = true;
                  return;
              } else if (!this.onCooldown) {
                  // Start cooldown if we pass over an edge but don't stick
                  this.onCooldown = true;
                  this.cooldownDistance = 0;
                  this.cooldownFrames = 0;
                  hasCollision = true;
                  this.collisionHistory = true;
              }
          }
      }

      // Move the particle
      if (!this.frozen && this.x < canvas.width) {
          let moveAmount = 1 * CONFIG['animationSpeed'].value * 0.5;

          /*
          if(hasCollision){
            moveAmount += (this.waveAmplitude*CONFIG['turbulence'].value) * (Math.sin(this.y/this.waveFrequency)) + 2;
          }
          */
          if(this.collisionHistory){
            moveAmount += (this.waveAmplitude*CONFIG['turbulence'].value) * (Math.sin((frameCounter/4+this.y)/this.waveFrequency));
          } else {
            //this.x += moveAmount;
          }

          this.x += moveAmount;
          
          // Update cooldown distance if active
          if (this.onCooldown) {
              //this.cooldownDistance += moveAmount;
              this.cooldownFrames++;
              if (this.cooldownFrames >= COOLDOWN_FRAMES) {
                  this.onCooldown = false;
              }
          }
      }
  }

  draw() {

    if (this.x >= canvas.width) {
      return;
    }

    //const size = CONFIG['particleSize'].value * (1 + this.turbulence * 1.2);
    const intensity = Math.max(0,(0.9 - this.turbulence * 0.9));
    //const gray = Math.floor(255 - this.turbulence * 100);
    let rgbArray = hexToRGBArray(CONFIG['particleColor']);

    ctx.beginPath();
    ctx.arc(this.x, this.y, CONFIG['particleSize'].value, 0, TWO_PI);

    if (this.frozen) {
      //ctx.fillStyle = `rgba(111, 159, 255, ${intensity * this.glowIntensity})`;
      ctx.fillStyle = CONFIG['edgeColor'];
    } else if(this.collisionHistory){
      ctx.fillStyle = "red";
    } else {
      //ctx.fillStyle = `rgba(${gray}, ${gray}, ${gray}, ${intensity * this.glowIntensity})`;
      ctx.fillStyle = `rgba(${rgbArray[0]}, ${rgbArray[1]}, ${rgbArray[2]}, ${intensity * this.glowIntensity})`;
    }
    
    ctx.fill();
  }
}

function hexToRGBArray(hexColor){
    // Remove the # if present
    hexColor = hexColor.replace(/^#/, '');
    
    // Parse the hex values
    const r = parseInt(hexColor.substring(0, 2), 16);
    const g = parseInt(hexColor.substring(2, 4), 16);
    const b = parseInt(hexColor.substring(4, 6), 16);
    
    return [r, g, b];
}

// Wave creation
function createParticleWave() {

  let waveFrequency = 10 - Math.random()*8;
  let waveAmplitude = 0.3 * Math.random();

  const particles = new Array(CONFIG['numParticles'].value);
  
  for (let i = 0; i < CONFIG['numParticles'].value; i++) {
      //const y = (canvas.height / NUM_PARTICLES) * i;
      let y = canvas.height * Math.random();
      particles[i] = new Particle(0, y, waveCount, waveFrequency, waveAmplitude);
  }
  
  particleWaves.push({
      particles,
      timestamp: Date.now(),
  });
  
  waveCount++;
  
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

function animate() {
  if (!isPlaying) return;

  ctx.fillStyle = CONFIG['backgroundColor'];
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if(frameCounter % CONFIG['waveInterval'].value == 0){
    createParticleWave();
  }

  // Update and draw particles in a single loop
  for (const wave of particleWaves) {
      for (const particle of wave.particles) {
          particle.update();
          particle.draw();
      }
  }

  frameCounter++;
  animationID = requestAnimationFrame(animate);
}

function restartAnimation() {
  
  particleWaves = [];
  particleWaves.length = 0;
  waveCount = 0;
  frameCounter = 0;

  ctx.fillStyle = CONFIG['backgroundColor'];
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  isPlaying = true;
  animationID = requestAnimationFrame(animate);
}

// Image handling
let currentImage = null;

const handleResize = _.debounce(() => {
  if (!currentImage) return;
  
  const maxWidth = window.innerWidth * maxCanvasSize;
  const maxHeight = window.innerHeight * maxCanvasSize;
  
  const widthRatio = maxWidth / currentImage.width;
  const heightRatio = maxHeight / currentImage.height;
  const scale = Math.min(widthRatio, heightRatio);
  
  canvas.width = currentImage.width * scale;
  canvas.height = currentImage.height * scale;
  
  ctx.drawImage(currentImage, 0, 0, canvas.width, canvas.height);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  edgeData = detectEdges(imageData);
  
  console.log("Canvas size: "+canvas.width+", "+canvas.height);

  restartAnimation();
}, 250);

// Debounced restart function for slider changes
const debouncedRestart = _.debounce(() => {
  if (isPlaying) {
      restartAnimation();
  }
}, 250);

// Event Listeners
window.addEventListener('resize', handleResize);

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  currentImage = new Image();
  currentImage.onload = () => {
      const maxWidth = window.innerWidth * maxCanvasSize;
      const maxHeight = window.innerHeight * maxCanvasSize;
      
      const widthRatio = maxWidth / currentImage.width;
      const heightRatio = maxHeight / currentImage.height;
      const scale = Math.min(widthRatio, heightRatio);
      
      canvas.width = currentImage.width * scale;
      canvas.height = currentImage.height * scale;

      ctx.drawImage(currentImage, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      console.log("Canvas size: "+canvas.width+", "+canvas.height);
      
      edgeData = detectEdges(imageData);
      
      restartAnimation();
  };
  currentImage.src = URL.createObjectURL(file);
});

// Start animation immediately
initGUI();
setupEventListeners();
isPlaying = true;
animationID = requestAnimationFrame(animate);