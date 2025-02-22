/*
To do:
- how to improve performance / simplify calculations, so that more particles can be rendered / fps can be improved
- can we delete particle waves once they reach the end of the canvas to improve performance?
- Need to improve edge detection logic / control
- mobile testing
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
let baseScaleIndex = 1;

// Constants and configuration
const MAX_WAVES = 200;
const INTERACTION_RADIUS = 1;
const TWO_PI = Math.PI * 2;
const COOLDOWN_FRAMES = 150;

let animationID;
let isPlaying = false;

// Configuration
let gui = new dat.gui.GUI( { autoPlace: false } );
gui.close();
let guiOpenToggle = false;
const CONFIG = {
    animationSpeed: { value: 0.7, min: 0.4, max: 2.0, step: 0.1 },
    waveInterval: { value: 100, min: 30, max: 200, step: 1 },
    numParticles: { value: 250, min: 70, max: 400, step: 1 },
    trailStrength: { value: 15, min: 0, max: 30, step: 1 },
    frozenProbability: { value: 0.5, min: 0.0, max: 1.0, step: 0.01 },
    turbulence: { value: 1, min: 0, max: 4, step: 0.1 },
    particleSize: { value: 1, min: 0.8, max: 2.0, step: 0.1 },
    edgeThreshold: { value: 50, min: 1, max: 250, step: 1 },
    startPosition: 'Top',
    selectedPalette: 'galaxy',
    backgroundColor: '#000000',
    particleColor: '#eda2a2',
    edgeColor: '#8ce0de',
    IS_PLAYING: true,
};

function initGUI() {
    
  // Initialize controllers object
  window.guiControllers = {};

  window.guiControllers.startPosition = gui.add(CONFIG, 'startPosition', ['Left', 'Right', 'Top', 'Bottom'])
  .name('Start Position')
  .onChange(v => {
      updateConfig('startPosition', v);
      restartAnimation();
  });

  chooseRandomPalette();

  // Add palette selector
  window.guiControllers.selectedPalette = gui.add(CONFIG, 'selectedPalette', paletteNames)
      .name('Color Palette')
      .onChange(value => {
          const [particleColor, edgeColor, backgroundColor] = palettes[value];
          CONFIG.particleColor = particleColor;
          CONFIG.edgeColor = edgeColor;
          CONFIG.backgroundColor = backgroundColor;
          updateConfig('particleColor', particleColor);
          updateConfig('edgeColor', edgeColor);
          updateConfig('backgroundColor', backgroundColor);
      });

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

  /*
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
  */
  
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

// Particle class
class Particle {
  constructor(waveIndex, particleIndex, waveFrequency, waveAmplitude) {
      this.waveIndex = waveIndex;
      this.waveFrequency = waveFrequency;
      this.waveAmplitude = waveAmplitude;
      this.frozen = false;
      this.collisionHistory = false;
      this.onCooldown = false;
      this.cooldownFrames = 0;

      // Set initial position based on start position configuration
      switch (CONFIG.startPosition) {
          case 'Left':
              this.x = 0;
              this.y = (canvas.height / CONFIG['numParticles'].value) * particleIndex + Math.random()*3 - 1.5;
              break;
          case 'Right':
              this.x = canvas.width;
              this.y = (canvas.height / CONFIG['numParticles'].value) * particleIndex + Math.random()*3 - 1.5;
              break;
          case 'Top':
              this.x = (canvas.width / CONFIG['numParticles'].value) * particleIndex + Math.random()*3 - 1.5;
              this.y = 0;
              break;
          case 'Bottom':
              this.x = (canvas.width / CONFIG['numParticles'].value) * particleIndex + Math.random()*3 - 1.5;
              this.y = canvas.height;
              break;
      }
  }

  update() {
      if (this.frozen || this.isOutOfBounds()) {
          return;
      }

      let hasCollision = false;
      let maxAccumulation = 5;

      // Check for edges based on direction
      // look "ahead" by one pixel to create a particle build-up effect
      if (this.isInBounds()) {
          const index = (Math.floor(this.y) * canvas.width + Math.floor(this.x)) * 4;
          let edgeIntensity;
          switch (CONFIG.startPosition) {
            case 'Left':
              edgeIntensity = edgeData[index + (4*Math.min(this.waveIndex,maxAccumulation))];
              break;
            case 'Right':
              edgeIntensity = edgeData[index - (4*Math.min(this.waveIndex,maxAccumulation))];
              break;
            case 'Top':
              edgeIntensity = edgeData[index + (4*(Math.min(this.waveIndex,maxAccumulation)*canvas.width))];
              break;
            case 'Bottom':
              edgeIntensity = edgeData[index - (4*(Math.min(this.waveIndex,maxAccumulation)*canvas.width))];
              break;
          }
          //edgeIntensity = edgeData[index];
          
          const minDistance = 20; // Minimum distance from start before freezing
          const isPassedMinDistance = (
              (CONFIG.startPosition === 'Left' && this.x > minDistance) ||
              (CONFIG.startPosition === 'Right' && this.x < canvas.width - minDistance) ||
              (CONFIG.startPosition === 'Top' && this.y > minDistance) ||
              (CONFIG.startPosition === 'Bottom' && this.y < canvas.height - minDistance)
          );
          
          if (edgeIntensity > 0 && isPassedMinDistance) {
          //if (edgeIntensity > 0 && isPassedMinDistance) {
          //if (edgeIntensity < (255 - CONFIG['edgeThreshold'].value) && isPassedMinDistance) {
              if (!this.onCooldown && Math.random() < CONFIG['frozenProbability'].value) {
                  this.frozen = true;
                  return;
              } else if (!this.onCooldown) {
                  this.onCooldown = true;
                  this.cooldownFrames = 0;
                  hasCollision = true;
                  this.collisionHistory = true;
              }
          }
      }

      // Move the particle
      if (!this.frozen) {
        let moveAmount = 1 * CONFIG['animationSpeed'].value * (canvas.width*0.001);
        let collisionShiftAmount = 0;

        // Slight oscillation for particles that previously had a collision
        let waveStrength = 0.35;
        if(this.collisionHistory){
            moveAmount += (this.waveAmplitude*CONFIG['turbulence'].value) * 
                (Math.sin((frameCounter/2+this.getPositionForWave())/this.waveFrequency))
                * waveStrength * baseScaleIndex;
        }

        // One-time movement upon collision -- keep the same shape as the edge
        let maxShift = 650;
        if(CONFIG.startPosition == "Top" || CONFIG.startPosition == "Bottom"){
          maxShift = canvas.height;
        } else {
          maxShift = canvas.width;
        }
        let shiftOffset = maxShift*0.35;
        if(hasCollision){
            switch (CONFIG.startPosition) {
              case 'Left':
                collisionShiftAmount = Math.max(0, maxShift * (this.x/canvas.width) - shiftOffset);
                break;
              case 'Right':
                collisionShiftAmount = Math.max(0, maxShift * ((canvas.width-this.x)/canvas.width) - shiftOffset);
                break;
              case 'Top':
                collisionShiftAmount = Math.max(0, maxShift * (this.y/canvas.height) - shiftOffset);
                break;
              case 'Bottom':
                collisionShiftAmount = Math.max(0, maxShift * ((canvas.height-this.y)/canvas.height) - shiftOffset);
                break;
          }
          
        }

          // Apply movement based on direction
          switch (CONFIG.startPosition) {
              case 'Left':
                  this.x += moveAmount + collisionShiftAmount;
                  break;
              case 'Right':
                  this.x -= moveAmount + collisionShiftAmount;
                  break;
              case 'Top':
                  this.y += moveAmount + collisionShiftAmount;
                  break;
              case 'Bottom':
                  this.y -= moveAmount + collisionShiftAmount;
                  break;
          }
          
          if (this.onCooldown) {
              this.cooldownFrames++;
              if (this.cooldownFrames >= COOLDOWN_FRAMES) {
                  this.onCooldown = false;
              }
          }
      }
  }

  isOutOfBounds() {
      switch (CONFIG.startPosition) {
          case 'Left':
              return this.x >= canvas.width;
          case 'Right':
              return this.x <= 0;
          case 'Top':
              return this.y >= canvas.height;
          case 'Bottom':
              return this.y <= 0;
      }
  }

  isInBounds() {
      return this.x >= 0 && this.x < canvas.width && 
             this.y >= 0 && this.y < canvas.height;
  }

  getPositionForWave() {
      // Use the appropriate coordinate for wave calculation based on direction
      return CONFIG.startPosition === 'Left' || CONFIG.startPosition === 'Right' 
          ? this.y 
          : this.x;
  }

  draw() {
      if (this.isOutOfBounds()) {
          return;
      }

      let rgbArray = hexToRGBArray(CONFIG['particleColor']);

      ctx.beginPath();
      ctx.arc(this.x, this.y, baseScaleIndex * CONFIG['particleSize'].value, 0, TWO_PI);

      if (this.frozen || this.collisionHistory) {
          ctx.fillStyle = CONFIG['edgeColor'];
      } else {
          ctx.fillStyle = `rgb(${rgbArray[0]}, ${rgbArray[1]}, ${rgbArray[2]})`;
      }
      
      ctx.fill();
  }
}

function createParticleWave() {
  let waveFrequency = 12 - Math.random()*10;
  let waveAmplitude = 0.3 * Math.random() + 0.05;

  const particles = new Array(CONFIG['numParticles'].value);
  
  for (let i = 0; i < CONFIG['numParticles'].value; i++) {
      particles[i] = new Particle(waveCount, i, waveFrequency, waveAmplitude);
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
  
  // Threshold for considering a difference significant
  const edgeDiffThreshold = CONFIG['edgeThreshold'].value;

  // Single-pass edge detection
  for (let y = 1; y < height - 1; y++) {
      const rowOffset = y * stride;
      for (let x = 1; x < width - 1; x++) {
          const idx = rowOffset + x * 4;
          
          // Calculate grayscale using luminance weights
          const gray = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
          const right = data[idx + 4] * 0.299 + data[idx + 5] * 0.587 + data[idx + 6] * 0.114;
          const bottom = data[idx + stride] * 0.299 + data[idx + stride + 1] * 0.587 + data[idx + stride + 2] * 0.114;
          
          // Calculate edge intensity - larger differences mean stronger edges
          const diffX = Math.abs(gray - right);
          const diffY = Math.abs(gray - bottom);
          const maxDiff = Math.max(diffX, diffY);

          // Strong binary threshold - either edge or no edge
          const edgeStrength = maxDiff >= edgeDiffThreshold ? 255 : 0;

          output[idx] = output[idx + 1] = output[idx + 2] = edgeStrength;
          output[idx + 3] = 255;
      }
  }

  return output;
}

// Animation loop
function animate() {
  if (!isPlaying) return;

  ctx.fillStyle = CONFIG['backgroundColor'];
  ctx.globalAlpha = (100 - (CONFIG['trailStrength'].value))/100 - 0.7;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalAlpha = 1;

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
  
  cancelAnimationFrame(animationID);

  particleWaves = [];
  particleWaves.length = 0;
  waveCount = 0;
  frameCounter = 0;

  ctx.fillStyle = CONFIG['backgroundColor'];
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  baseScaleIndex = canvas.width/600;
  console.log("baseScaleIndex: "+baseScaleIndex);

  isPlaying = true;
  animationID = requestAnimationFrame(animate);
}

//HELPER FUNCTIONS

function togglePlayPause(){
  if(isPlaying){
    cancelAnimationFrame(animationID);
    console.log("Pause");
  } else {
    animationID = requestAnimationFrame(animate);
    console.log("Play");
  }
  isPlaying = !isPlaying;
}

function randomizeInputs(){
    // Helper function to get random number between min and max
    const getRandomValue = (min, max, step) => {
      const steps = Math.floor((max - min) / step);
      return min + (Math.floor(Math.random() * steps) * step);
  };

  // Randomize numeric parameters
  const numericParams = {
      'animationSpeed': CONFIG.animationSpeed,
      'waveInterval': CONFIG.waveInterval,
      'numParticles': CONFIG.numParticles,
      'trailStrength': CONFIG.trailStrength,
      'frozenProbability': CONFIG.frozenProbability,
      'turbulence': CONFIG.turbulence,
      'particleSize': CONFIG.particleSize
  };

  // Update each numeric parameter
  for (const [param, config] of Object.entries(numericParams)) {
      const newValue = getRandomValue(config.min, config.max, config.step);
      CONFIG[param].value = newValue;
      if (window.guiControllers[param]) {
          window.guiControllers[param].setValue(newValue);
      }
  }

  // Randomize start position
  const positions = ['Left', 'Right', 'Top', 'Bottom'];
  const randomPosition = positions[Math.floor(Math.random() * positions.length)];
  CONFIG.startPosition = randomPosition;
  if (window.guiControllers.startPosition) {
      window.guiControllers.startPosition.setValue(randomPosition);
  }

  chooseRandomPalette();

  // Restart the animation to apply changes
  restartAnimation();
}

function setupEventListeners() {
  document.getElementById('restartBtn').addEventListener('click', () => restartAnimation());
  document.getElementById('randomizeColorBtn').addEventListener('click', () => chooseRandomPalette());
  document.getElementById('randomizeBtn').addEventListener('click', () => randomizeInputs());
  document.getElementById('exportVideoBtn').addEventListener('click', () => toggleVideoRecord());
  document.getElementById('toggleDebugBtn').addEventListener('click', () => toggleDebugView());
  
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
    } else if(event.key === 'c'){
      chooseRandomPalette();
    }
    
  });

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

function updateDebugViews(inputImage) {
  const scale = 0.6; // Scale debug views to 30% of original size
  const debugCanvases = {
      original: document.getElementById('originalCanvas'),
      processed: document.getElementById('processedCanvas'),
      edge: document.getElementById('edgeCanvas')
  };
  
  // Set canvas sizes
  Object.values(debugCanvases).forEach(canvas => {
      if (canvas) {
          canvas.width = Math.floor(inputImage.width * scale);
          canvas.height = Math.floor(inputImage.height * scale);
      }
  });

  // Draw original image
  const originalCtx = debugCanvases.original.getContext('2d', { 
    willReadFrequently: true,
    alpha: false,
  });
  originalCtx.drawImage(inputImage, 0, 0, debugCanvases.original.width, debugCanvases.original.height);

  // Draw processed image (after grayscale and contrast)
  const processedCtx = debugCanvases.processed.getContext('2d');
  const processedImageData = processImage(originalCtx.getImageData(0, 0, debugCanvases.original.width, debugCanvases.original.height));
  processedCtx.putImageData(processedImageData, 0, 0);

  // Draw edge detection result
  const edgeCtx = debugCanvases.edge.getContext('2d');
  const edgeImageData = detectEdges(processedImageData);
  edgeCtx.putImageData(new ImageData(edgeImageData, debugCanvases.edge.width, debugCanvases.edge.height), 0, 0);
}

function chooseRandomPalette(){
  // Randomly select an initial palette
  const randomPaletteName = paletteNames[Math.floor(Math.random() * paletteNames.length)];
  
  const [particleColor, edgeColor, backgroundColor] = palettes[randomPaletteName];
  CONFIG.selectedPalette = randomPaletteName;
  CONFIG.particleColor = particleColor;
  CONFIG.edgeColor = edgeColor;
  CONFIG.backgroundColor = backgroundColor;
  updateConfig('particleColor', particleColor);
  updateConfig('edgeColor', edgeColor);
  updateConfig('backgroundColor', backgroundColor);

  // Update GUI controllers
  if (window.guiControllers.selectedPalette) {
    window.guiControllers.selectedPalette.setValue(randomPaletteName);
  }
  if (window.guiControllers.particleColor) {
    window.guiControllers.particleColor.setValue(particleColor);
  }
  if (window.guiControllers.edgeColor) {
    window.guiControllers.edgeColor.setValue(edgeColor);
  }
  if (window.guiControllers.backgroundColor) {
    window.guiControllers.backgroundColor.setValue(backgroundColor);
  }

}

function toggleDebugView() {
  const debugContainer = document.getElementById('debugViews');
  debugContainer.classList.toggle('visible');
}

//MAIN METHOD
// Start animation immediately
initGUI();
setupEventListeners();
loadDefaultImage();
baseScaleIndex = canvas.width/600;