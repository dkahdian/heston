# Heston Model Monte Carlo Option Pricing

A high-performance web application for pricing European call options using the Heston stochastic volatility model with Monte Carlo simulation.

## Features

- **Real-time Monte Carlo simulation** with WebAssembly acceleration
- **Interactive parameter adjustment** for all Heston model parameters
- **Live price path visualization** showing percentile paths (min, 25th, median, 75th, max)
- **Comparison with Black-Scholes pricing**
- **Progressive simulation algorithm** for optimal performance
- **Responsive web design** suitable for desktop and mobile

## Technical Implementation

### Algorithm
- Uses the **Milstein scheme** for improved accuracy in volatility discretization
- **Two-phase simulation approach**:
  1. **Phase 1 (first 1000 simulations)**: Store full price paths for percentile calculation and visualization
  2. **Phase 2 (subsequent simulations)**: Only calculate final prices for high-precision option pricing

### Performance
- **WebAssembly backend** (C compiled to WASM) for computational heavy lifting
- **JavaScript fallback** for broader browser compatibility
- **Batch processing** to maintain UI responsiveness
- **Progressive updates** every 1000 simulations

### Mathematical Model
The Heston model is governed by these stochastic differential equations:

```
dS_t = r S_t dt + √v_t S_t dW_t^S
dv_t = κ(θ - v_t)dt + ξ√v_t dW_t^v
```

Where:
- S_t: asset price
- v_t: instantaneous variance
- r: risk-free rate
- κ: mean reversion speed
- θ: long-term variance
- ξ: volatility of volatility
- ρ: correlation between price and volatility Brownian motions

## Getting Started

### Prerequisites
For building from source:
- [Emscripten SDK](https://emscripten.org/docs/getting_started/downloads.html) for compiling C to WebAssembly

### Quick Start (Pre-built)
1. Clone or download this repository
2. Open `index.html` in a modern web browser
3. Adjust parameters and click "Start Simulation"

### Building from Source

#### On Windows:
```bash
# Install Emscripten SDK first, then:
build.bat
```

#### On Linux/macOS:
```bash
# Install Emscripten SDK first, then:
chmod +x build.sh
./build.sh
```

This will generate `simulation.js` and `simulation.wasm` files.

### Deployment
This is a fully static application suitable for hosting on:
- GitHub Pages
- Netlify
- Vercel
- Any static web server

## Usage

1. **Set Parameters**: Adjust the Heston model parameters in the form
   - S₀: Initial stock price
   - K: Strike price
   - r: Risk-free rate
   - T: Time to maturity
   - v₀: Initial variance
   - θ: Long-term variance
   - κ: Mean reversion speed
   - ξ: Volatility of volatility
   - ρ: Correlation
   - N: Number of time steps

2. **Start Simulation**: Click "Start Simulation" to begin
3. **Monitor Progress**: Watch real-time updates of option prices and path visualization
4. **Stop/Reset**: Use controls to stop or reset the simulation

## Browser Compatibility

- **Modern browsers** with WebAssembly support (Chrome 57+, Firefox 52+, Safari 11+, Edge 16+)
- **Fallback support** for older browsers using JavaScript implementation
- **Mobile responsive** design

## Performance Notes

- WebAssembly provides ~10-50x performance improvement over pure JavaScript
- Recommended to use at least 1000 time steps for accurate results
- The application automatically switches to efficient mode after 1000 simulations
- Progress updates occur every 1000 simulations to maintain smooth UI

## File Structure

```
├── index.html              # Main HTML page
├── styles.css              # Responsive CSS styling
├── app.js                  # Main application logic
├── heston.c                # C implementation of Heston model
├── simulation-fallback.js  # JavaScript fallback implementation
├── build.sh               # Unix build script
├── build.bat              # Windows build script
├── simulation.js          # Generated WebAssembly module (after build)
├── simulation.wasm        # Generated WebAssembly binary (after build)
└── README.md              # This file
```

## Mathematical Background

The implementation uses the Milstein discretization scheme for the volatility process:

```
v_{t+Δt} = v_t + κ(θ - max(v_t,0))Δt + ξ√(max(v_t,0)Δt)Z_v + (ξ²/4)[(Z_v²-1)Δt]
```

The asset price follows:
```
S_{t+Δt} = S_t exp((r - v_t/2)Δt + √(v_t Δt)Z_S)
```

Where Z_S and Z_v are correlated standard normal random variables with correlation ρ.

## License

This project is open source and available under the [MIT License](LICENSE).

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Acknowledgments

- Based on the Heston (1993) stochastic volatility model
- Uses Milstein scheme for improved numerical accuracy
- WebAssembly compilation via Emscripten
- Chart visualization powered by Chart.js
