<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# Heston Model Monte Carlo Web Application

This is a high-performance web application for Monte Carlo simulation of the Heston stochastic volatility model for option pricing.

## Key Components

### Frontend (JavaScript/HTML/CSS)
- Vanilla JavaScript with modern ES6+ features
- Chart.js for real-time data visualization
- Responsive CSS Grid layout
- Progressive Web App capabilities

### Backend (C/WebAssembly)
- High-performance C implementation compiled to WebAssembly
- Milstein discretization scheme for improved accuracy
- Memory-efficient heap management for percentile tracking
- Optimized random number generation

### Mathematical Model
The application implements the Heston stochastic volatility model:
- Asset price SDE: dS_t = r S_t dt + √v_t S_t dW_t^S
- Volatility SDE: dv_t = κ(θ - v_t)dt + ξ√v_t dW_t^v
- Correlated Brownian motions with correlation ρ

## Code Style Guidelines

### JavaScript
- Use modern ES6+ syntax (const/let, arrow functions, async/await)
- Prefer functional programming patterns where appropriate
- Use descriptive variable names for financial parameters
- Implement error handling for WebAssembly loading
- Maintain separation between UI logic and simulation logic

### C Code
- Follow mathematical notation in variable naming (S0, v0, theta, kappa, xi, rho)
- Use double precision for all financial calculations
- Implement memory safety practices
- Optimize for performance in Monte Carlo loops
- Use Emscripten-specific macros for WebAssembly exports

### CSS
- Use CSS Grid and Flexbox for responsive layouts
- Implement CSS custom properties for theming
- Ensure accessibility with proper contrast ratios
- Use smooth transitions for user interactions
- Maintain mobile-first responsive design

## Performance Considerations
- Batch WebAssembly calls to minimize overhead
- Use requestAnimationFrame for smooth UI updates
- Implement progressive loading for large datasets
- Optimize memory usage in both JavaScript and C code
- Use Web Workers for heavy computations if needed

## Financial Accuracy
- Implement proper numerical schemes (Milstein for improved accuracy)
- Handle edge cases (negative variance, extreme parameter values)
- Validate input parameters for financial sensibility
- Compare results with analytical solutions where possible
- Use appropriate random number generation techniques
