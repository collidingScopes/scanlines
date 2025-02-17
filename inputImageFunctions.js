// Image handling
const maxCanvasSize = 0.85;
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

    // Update debug views with the new image
    updateDebugViews(currentImage);
    
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

    // Update debug views with the new image
    updateDebugViews(currentImage);
    
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
      const contrast = 255 / (1 + Math.exp(-0.004 * (gray - 200)));
      
      data[i] = data[i + 1] = data[i + 2] = contrast;
      data[i + 3] = 255; // Alpha channel
  }
  
  // Step 2: Apply Gaussian blur to reduce noise
  const blurredData = applyGaussianBlur(data, width, height);
  
  // Step 3: Apply unsharp masking for edge enhancement
  const sharpenedData = applyUnsharpMask(data, blurredData);

  return new ImageData(sharpenedData, width, height);
  //return new ImageData(sharpenedData, width, height);
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
  const amount = 15; // Sharpening intensity
  
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