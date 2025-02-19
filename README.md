# 〰️SCAN-LINES〰️

Turn images into synthwave / cyberpunk animations! An open source tool that creates animations from static images using particle waves and edge detection. Runs in real-time in the browser.

<img src="/assets/FaceID-compressed.gif">

## Live Demo

Live demo: <a href="https://collidingScopes.github.io/scanlines" rel="noopener" target="_blank">https://collidingScopes.github.io/scanlines</a>

## Features

- Upload any image and transform it into a dynamic synthwave/cyberpunk animation
- Customize various parameters:
  - Animation speed and wave intervals
  - Number and size of particles
  - Turbulence and frozen particle probability
  - Edge detection sensitivity
  - Wave starting position
  - Color schemes (particle, edge, and background colors)
- Export your creations as images or videos
- Built-in color palettes with cyberpunk/synthwave themes
- Mobile-friendly design
- No paywalls or premium features - completely free and open source

## How It Works

The animation is created through a multi-step process:
1. Particle waves are generated at one edge of the canvas
2. These waves "scan" across the canvas while searching for edges in the input image
3. When an edge is detected, particles interact through physics simulation to:
   - Freeze in position
   - Change color
   - Move in an oscillating wave pattern

## Controls

### GUI Controls
- Start Position: Choose where particle waves begin (Left/Right/Top/Bottom)
- Color Palette: Select from pre-defined cyberpunk/synthwave color schemes
- Animation Parameters: Adjust speed, wave intervals, particle count, etc.

### Keyboard Shortcuts
- `r`: Randomize all inputs
- `c`: Choose random color palette
- `space`: Pause/play animation
- `enter`: Restart animation
- `v`: Start/stop video export
- `s`: Save screenshot
- `u`: Upload new image

## Technical Details

- Built with vanilla JavaScript and HTML5 Canvas
- Uses dat.gui for the control interface
- Video export implemented using mp4-muxer
- Client-side processing - no server uploads required
- Edge detection using a variation of Sobel edge detection

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/collidingScopes/scanlines.git
   ```

2. Navigate to the project directory:
   ```bash
   cd scanlines
   ```

3. Since this is a static web application, you can run it using any web server. For example, using Python:
   ```bash
   # Python 3
   python -m http.server 8000
   # Python 2
   python -m SimpleHTTPServer 8000
   ```

   Or using Node.js's `http-server`:
   ```bash
   # Install http-server globally
   npm install -g http-server
   # Run the server
   http-server
   ```

4. Open your browser and navigate to `http://localhost:8000`

## Privacy

All image processing is done client-side. No images or videos are uploaded to any server - they stay on your computer only.

## Video Export

The tool includes built-in video export functionality, leveraging the mp4-muxer library. If you experience issues with the video export feature, you can use other free screen-recording tools like OBS Studio.

## Performance Notes

The animation uses intensive calculations for particle physics and edge detection. Performance may vary based on:
- Computer processing power
- Available memory
- Battery level (on laptops)
- Number of open browser tabs
- Image size and complexity

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Connect

Created by [@stereo.drift](https://www.instagram.com/stereo.drift/). Feel free to reach out:
- Instagram: [@stereo.drift](https://www.instagram.com/stereo.drift/)
- Twitter: [@measure_plan](https://x.com/measure_plan)
- Email: stereodriftvisuals@gmail.com

## Related Projects

If you enjoyed this, you may be interested in my other free / open source projects:
- [Particular Drift](https://collidingScopes.github.io/particular-drift) - Flowing particle animations
- [Video-to-ASCII](https://collidingScopes.github.io/ascii) - ASCII pixel art converter
- [Shape Shimmer](https://collidingScopes.github.io/shimmer) - Funky wave animations
- [Colliding Scopes](https://collidingScopes.github.io) - Kaleidoscope animations
- [Force-Field Animation](https://collidingScopes.github.io/forcefield) - Particle-based animations
- [Manual Brick Breaker](https://manual-brick-breaker.netlify.app) - Play brick breaker by waving around your hand

## Donations
If you found this tool useful, feel free to buy me a coffee. This would be much appreciated during late-night coding sessions!

<a href="https://www.buymeacoffee.com/stereoDrift" target="_blank"><img src="https://www.buymeacoffee.com/assets/img/custom_images/yellow_img.png" alt="Buy Me A Coffee"></a>