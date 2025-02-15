/*
To do:
- how to improve performance / simplify calculations, so that more particles can be rendered / fps can be improved
- Need to improve consistency of frame rate, and edge detection logic / control
- When particles pass through an edge, they should take on the shape of the edge they passed through (freeze for a few frames?)
- improve default parameters
- Toggle to show all image edge thresholds upon startup or not
- readme / github / description
- about / footer divs
- add color palette selections
- randomize inputs button
- add emoji buttons underneath canvas (similar to particular drift)
- can we delete particle waves once they reach the end of the canvas to improve performance?
- reorder functions more logically (main functions, helper functions, etc.)
- can images be pre-processed to increase contrast / remove noise / sharpen / highlight edges
- Underneath the canvas, show original input image, and then pre-processed image, and then show edge detection result
- Use that to try to find optimal parameters for the blurring / contrast / edge threshold
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
    waveInterval: { value: 100, min: 40, max: 300, step: 1 },
    numParticles: { value: 250, min: 50, max: 400, step: 1 },
    frozenProbability: { value: 0.5, min: 0.0, max: 1.0, step: 0.01 },
    turbulence: { value: 1, min: 0, max: 4, step: 0.1 },
    particleSize: { value: 1, min: 0.5, max: 2.0, step: 0.1 },
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

          if (edgeIntensity < (255 - CONFIG['edgeThreshold'].value) && isPassedMinDistance) {
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
  
  // Threshold for considering a difference significant
  const edgeDiffThreshold = 20;

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
          
          // Map the difference to a 0-255 range where 0 represents strong edges
          // and 255 represents no edge
          const edgeStrength = maxDiff > edgeDiffThreshold ? 
              Math.max(0, 255 - (maxDiff * 2)) : 255;
          
          output[idx] = output[idx + 1] = output[idx + 2] = edgeStrength;
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
  
  const newDimensions = calculateNewDimensions(
    currentImage.width,
    currentImage.height,
    maxWidth,
    maxHeight
  );
  
  canvas.width = newDimensions.width;
  canvas.height = newDimensions.height;
  
  ctx.drawImage(currentImage, 0, 0, canvas.width, canvas.height);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  edgeData = detectEdges(imageData);
  
  console.log("Canvas size: " + canvas.width + ", " + canvas.height);
  console.log("Dimensions divisible by 4:", canvas.width % 4 === 0, canvas.height % 4 === 0);

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

// Update the file input event listener
fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  currentImage = new Image();
  currentImage.onload = () => {
    const maxWidth = window.innerWidth * maxCanvasSize;
    const maxHeight = window.innerHeight * maxCanvasSize;
    
    const newDimensions = calculateNewDimensions(
      currentImage.width,
      currentImage.height,
      maxWidth,
      maxHeight
    );
    
    canvas.width = newDimensions.width;
    canvas.height = newDimensions.height;

    ctx.drawImage(currentImage, 0, 0, canvas.width, canvas.height);
    let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    console.log("Canvas size: " + canvas.width + ", " + canvas.height);
    console.log("Dimensions divisible by 4:", canvas.width % 4 === 0, canvas.height % 4 === 0);
    
    // Process the image to enhance edges
    imageData = processImage(imageData);
    
    // Apply the processed image back to the canvas
    ctx.putImageData(imageData, 0, 0);

    edgeData = detectEdges(imageData);
    
    restartAnimation();
  };
  currentImage.src = URL.createObjectURL(file);
});

// Update the loadDefaultImage function
function loadDefaultImage() {
  currentImage = new Image();
  currentImage.onload = () => {
    const maxWidth = window.innerWidth * maxCanvasSize;
    const maxHeight = window.innerHeight * maxCanvasSize;
    
    const newDimensions = calculateNewDimensions(
      currentImage.width,
      currentImage.height,
      maxWidth,
      maxHeight
    );
    
    canvas.width = newDimensions.width;
    canvas.height = newDimensions.height;

    console.log("Canvas size: " + canvas.width + ", " + canvas.height);
    console.log("Dimensions divisible by 4:", canvas.width % 4 === 0, canvas.height % 4 === 0);

    ctx.drawImage(currentImage, 0, 0, canvas.width, canvas.height);
    let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // Process the image to enhance edges
    imageData = processImage(imageData);

    // Apply the processed image back to the canvas
    ctx.putImageData(imageData, 0, 0);

    edgeData = detectEdges(imageData);
    
    isPlaying = true;
    animationID = requestAnimationFrame(animate);
  };
  currentImage.src = 'assets/sun.jpg';
}

function roundToDivisibleByFour(num) {
  return Math.floor(num / 4) * 4;
}

// Function to calculate new dimensions that maintain aspect ratio and are divisible by 4
function calculateNewDimensions(originalWidth, originalHeight, maxWidth, maxHeight) {
  let widthRatio = maxWidth / originalWidth;
  let heightRatio = maxHeight / originalHeight;
  let scale = Math.min(widthRatio, heightRatio);
  
  // Initial scaled dimensions
  let scaledWidth = originalWidth * scale;
  let scaledHeight = originalHeight * scale;
  
  // Round to nearest multiple of 4
  let finalWidth = roundToDivisibleByFour(scaledWidth);
  let finalHeight = roundToDivisibleByFour(scaledHeight);
  
  // Ensure we don't exceed max dimensions
  while (finalWidth > maxWidth || finalHeight > maxHeight) {
    finalWidth = roundToDivisibleByFour(finalWidth - 4);
    finalHeight = roundToDivisibleByFour(finalHeight - 4);
  }
  
  return { width: finalWidth, height: finalHeight };
}

function processImage(imageData) {
  const width = imageData.width;
  const height = imageData.height;
  const data = new Uint8ClampedArray(imageData.data);
  
  // Step 1: Convert to grayscale and increase contrast
  for (let i = 0; i < data.length; i += 4) {
      // Convert to grayscale using luminance weights
      const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      
      // Increase contrast using a sigmoid function
      const contrast = 255 / (1 + Math.exp(-0.01 * (gray - 200)));
      
      data[i] = data[i + 1] = data[i + 2] = contrast;
      data[i + 3] = 255; // Alpha channel
  }
  
  // Step 2: Apply Gaussian blur to reduce noise
  const blurredData = applyGaussianBlur(data, width, height);
  
  // Step 3: Apply unsharp masking for edge enhancement
  const sharpenedData = applyUnsharpMask(data, blurredData);
  
  return new ImageData(sharpenedData, width, height);
}

function applyGaussianBlur(data, width, height) {
  const output = new Uint8ClampedArray(data.length);
  const kernel = [
      [1,  4,  6,  4, 1],
      [4, 16, 24, 16, 4],
      [6, 24, 36, 24, 6],
      [4, 16, 24, 16, 4],
      [1,  4,  6,  4, 1]
  ];
  const kernelSum = 256; // Sum of all kernel values
  
  for (let y = 2; y < height - 2; y++) {
      for (let x = 2; x < width - 2; x++) {
          let r = 0, g = 0, b = 0;
          
          // Apply convolution kernel
          for (let ky = -2; ky <= 2; ky++) {
              for (let kx = -2; kx <= 2; kx++) {
                  const kernelY = ky + 2;
                  const kernelX = kx + 2;
                  
                  if (kernelY >= 0 && kernelY < 5 && kernelX >= 0 && kernelX < 5) {
                      const idx = ((y + ky) * width + (x + kx)) * 4;
                      const weight = kernel[kernelY][kernelX];
                      
                      r += data[idx] * weight;
                      g += data[idx + 1] * weight;
                      b += data[idx + 2] * weight;
                  }
              }
          }
          
          const idx = (y * width + x) * 4;
          output[idx] = r / kernelSum;
          output[idx + 1] = g / kernelSum;
          output[idx + 2] = b / kernelSum;
          output[idx + 3] = 255;
      }
  }
  
  return output;
}


function applyUnsharpMask(originalData, blurredData) {
  const output = new Uint8ClampedArray(originalData.length);
  const amount = 2; // Sharpening intensity
  
  for (let i = 0; i < originalData.length; i += 4) {
      // Calculate the difference between original and blurred
      for (let j = 0; j < 3; j++) {
          const idx = i + j;
          const diff = originalData[idx] - blurredData[idx];
          // Apply sharpening and ensure values stay within 0-255
          output[idx] = Math.min(255, Math.max(0, originalData[idx] + amount * diff));
      }
      output[i + 3] = 255; // Alpha channel
  }
  
  return output;
}

// Start animation immediately
initGUI();
setupEventListeners();
loadDefaultImage();