/*
To do:
- how to improve performance / simplify calculations, so that more particles can be rendered / fps can be improved
- can the particle speed be variable (it speeds up as it approaches an edge, and then speeds up as it leaves an edge?)
- Need to improve consistency of frame rate, and edge detection logic / control
- improve default parameters
- Toggle to show all image edge thresholds upon startup or not
- if collisionHistory is true, blend the particle color in between edge / frozen color
- readme / github / description
- about / footer divs
- improve resizing function to round the input image / canvas to multiple of 4 upon new image upload
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
    animationSpeed: { value: 0.7, min: 0.1, max: 2.0, step: 0.1 },
    waveInterval: { value: 150, min: 50, max: 300, step: 1 },
    numParticles: { value: 250, min: 50, max: 400, step: 1 },
    frozenProbability: { value: 0.5, min: 0.0, max: 1.0, step: 0.01 },
    turbulence: { value: 1, min: 0, max: 4, step: 0.1 },
    particleSize: { value: 1, min: 0.5, max: 2.0, step: 0.1 },
    edgeThreshold: { value: 100, min: 50, max: 300, step: 1 },
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
      let maxAccumulation = 10;

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

          if (edgeIntensity < CONFIG['edgeThreshold'].value && isPassedMinDistance) {
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

          if(this.collisionHistory){
              moveAmount += (this.waveAmplitude*CONFIG['turbulence'].value) * 
                  (Math.sin((frameCounter/4+this.getPositionForWave())/this.waveFrequency));
          }

          // Apply movement based on direction
          switch (CONFIG.startPosition) {
              case 'Left':
                  this.x += moveAmount;
                  break;
              case 'Right':
                  this.x -= moveAmount;
                  break;
              case 'Top':
                  this.y += moveAmount;
                  break;
              case 'Bottom':
                  this.y -= moveAmount;
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
      ctx.arc(this.x, this.y, CONFIG['particleSize'].value, 0, TWO_PI);

      if (this.frozen || this.collisionHistory) {
          ctx.fillStyle = CONFIG['edgeColor'];
      } else {
          ctx.fillStyle = `rgb(${rgbArray[0]}, ${rgbArray[1]}, ${rgbArray[2]})`;
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
  
  cancelAnimationFrame(animationID);

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

// Load default image and start animation
function loadDefaultImage() {
  currentImage = new Image();
  currentImage.onload = () => {
    const maxWidth = window.innerWidth * maxCanvasSize;
    const maxHeight = window.innerHeight * maxCanvasSize;
    
    const widthRatio = maxWidth / currentImage.width;
    const heightRatio = maxHeight / currentImage.height;
    const scale = Math.min(widthRatio, heightRatio);
    
    canvas.width = currentImage.width * scale;
    canvas.height = currentImage.height * scale;

    console.log("Canvas size: "+canvas.width+", "+canvas.height);

    ctx.drawImage(currentImage, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    edgeData = detectEdges(imageData);
    
    isPlaying = true;
    animationID = requestAnimationFrame(animate);
  };
  currentImage.src = 'assets/sun.jpg';
}

// Start animation immediately
initGUI();
setupEventListeners();
loadDefaultImage();