// Main application logic
class HestonApp {
    constructor() {
        this.simulation = null;
        this.isRunning = false;
        this.animationId = null;
        this.chart = null;
        this.wasmLoaded = false;
        
        this.initializeElements();
        this.setupEventListeners();
        this.initializeChart();
        this.loadSimulation();
    }

    initializeElements() {
        // Form elements
        this.form = document.getElementById('parametersForm');
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.resetBtn = document.getElementById('resetBtn');
        
        // Input elements
        this.inputs = {
            S0: document.getElementById('S0'),
            v0: document.getElementById('v0'),
            r: document.getElementById('r'),
            theta: document.getElementById('theta'),
            kappa: document.getElementById('kappa'),
            xi: document.getElementById('xi'),
            rho: document.getElementById('rho'),
            T: document.getElementById('T'),
            K: document.getElementById('K'),
            N: document.getElementById('N')
        };
        
        // Result elements
        this.results = {
            simulationCount: document.getElementById('simulationCount'),
            hestonPrice: document.getElementById('hestonPrice'),
            blackScholesPrice: document.getElementById('blackScholesPrice'),
            priceDifference: document.getElementById('priceDifference')
        };
        
        // Progress elements
        this.progressFill = document.getElementById('progressFill');
        this.progressText = document.getElementById('progressText');
    }

    setupEventListeners() {
        this.startBtn.addEventListener('click', () => this.startSimulation());
        this.stopBtn.addEventListener('click', () => this.stopSimulation());
        this.resetBtn.addEventListener('click', () => this.resetSimulation());
        
        this.form.addEventListener('submit', (e) => e.preventDefault());
    }

    async loadSimulation() {
        try {
            if (typeof HestonModule !== 'undefined') {
                const Module = await HestonModule();
                this.simulation = new WasmSimulation(Module);
                this.wasmLoaded = true;
                this.progressText.textContent = "Ready for simulation with WebAssembly.";
            } else {
                throw new Error("WebAssembly module not available");
            }
        } catch (error) {
            console.warn("WebAssembly not available, falling back to JavaScript:", error);
            await this.loadFallback();
            this.simulation = new HestonSimulationJS();
            this.wasmLoaded = false;
            this.progressText.textContent = "WebAssembly not ready. Ready for reduced-speed simulation.";
        }
    }

    async loadFallback() {
        return new Promise((resolve) => {
            if (window.HestonSimulationJS) {
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = 'simulation-fallback.js';
            script.onload = resolve;
            document.head.appendChild(script);
        });
    }

    getParameters() {
        return {
            S0: parseFloat(this.inputs.S0.value),
            v0: parseFloat(this.inputs.v0.value),
            r: parseFloat(this.inputs.r.value),
            theta: parseFloat(this.inputs.theta.value),
            kappa: parseFloat(this.inputs.kappa.value),
            xi: parseFloat(this.inputs.xi.value),
            rho: parseFloat(this.inputs.rho.value),
            T: parseFloat(this.inputs.T.value),
            K: parseFloat(this.inputs.K.value),
            N: parseInt(this.inputs.N.value)
        };
    }

    validateParameters() {
        const params = this.getParameters();
        
        if (params.S0 <= 0 || params.K <= 0 || params.T <= 0 || params.v0 <= 0 || 
            params.theta <= 0 || params.kappa <= 0 || params.xi <= 0 || params.N < 100) {
            alert("Please ensure all parameters are positive and N >= 100");
            return false;
        }
        
        if (params.rho < -1 || params.rho > 1) {
            alert("Correlation (ρ) must be between -1 and 1");
            return false;
        }
        
        return true;
    }

    startSimulation() {
        if (!this.validateParameters()) return;
        
        this.clearChart();
        const params = this.getParameters();
        
        this.simulation.initializeSimulation(
            params.S0, params.v0, params.r, params.theta, params.kappa,
            params.xi, params.rho, params.T, params.K, params.N
        );
        
        this.isRunning = true;
        this.startBtn.disabled = true;
        this.stopBtn.disabled = false;
        this.resetBtn.disabled = true;
        
        Object.values(this.inputs).forEach(input => input.disabled = true);
        
        this.updateResults();
        
        this.runSimulationLoop();
    }

    stopSimulation() {
        this.isRunning = false;
        this.startBtn.disabled = false;
        this.stopBtn.disabled = true;
        this.resetBtn.disabled = false;
        
        Object.values(this.inputs).forEach(input => input.disabled = false);
        
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        this.progressText.textContent = `Simulation stopped at ${this.simulation.getSimulationCount()} runs`;
    }

    resetSimulation() {
        this.isRunning = false;
        this.startBtn.disabled = false;
        this.stopBtn.disabled = true;
        this.resetBtn.disabled = false;
        
        Object.values(this.inputs).forEach(input => input.disabled = false);
        
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        this.results.simulationCount.textContent = '0';
        this.results.hestonPrice.textContent = '-';
        this.results.blackScholesPrice.textContent = '-';
        this.results.priceDifference.textContent = '-';
        this.progressFill.style.width = '0%';
        this.progressText.textContent = this.wasmLoaded ? 
            "WebAssembly ready - Ready for high-performance simulation" : 
            "JavaScript fallback ready - Ready to start simulation";
        
        this.clearChart();
    }
    clearChart() {
        if (this.chart) {
            this.chart.data.labels = [];
            this.chart.data.datasets = [];
            if (this.chart.options && this.chart.options.scales && this.chart.options.scales.y) {
                this.chart.options.scales.y.min = undefined;
                this.chart.options.scales.y.max = undefined;
            }
            this.chart.update('none');
        }
    }

    runSimulationLoop() {
        if (!this.isRunning) return;
        
        const batchSize = this.wasmLoaded ? 20 : 5;
        this.simulation.runSimulationBatch(batchSize);
        
        const count = this.simulation.getSimulationCount();
        if (count % 1000 === 0 || this.simulation.isTrackingPhase()) {
            this.updateResults();
            this.updateProgress();
            this.updateChart();
        }
        
        this.animationId = requestAnimationFrame(() => this.runSimulationLoop());
    }

    updateResults() {
        const count = this.simulation.getSimulationCount();
        const hestonPrice = this.simulation.getOptionPrice();
        const bsPrice = this.simulation.getBlackScholesPrice();
        const difference = hestonPrice - bsPrice;
        
        this.results.simulationCount.textContent = count.toLocaleString();
        this.results.hestonPrice.textContent = hestonPrice.toFixed(4);
        this.results.blackScholesPrice.textContent = bsPrice.toFixed(4);
        this.results.priceDifference.textContent = difference.toFixed(4);
        
        if (count > 0) {
            this.results.hestonPrice.classList.add('price-update');
            setTimeout(() => this.results.hestonPrice.classList.remove('price-update'), 500);
        }
    }

    updateProgress() {
        const count = this.simulation.getSimulationCount();
        const isTracking = this.simulation.isTrackingPhase();
        
        if (isTracking) {
            const progress = (count / 1000) * 100;
            this.progressFill.style.width = `${Math.min(progress, 100)}%`;
            this.progressText.textContent = `Building percentile paths: ${count}/1000`;
        } else {
            this.progressFill.style.width = '100%';
            this.progressText.textContent = `Running high-precision simulation: ${count.toLocaleString()} runs`;
        }
    }

    updateChart() {
        if (this.simulation.isTrackingPhase()) {
            return;
        }

        const N = this.simulation.getTimeSteps();
        const T = parseFloat(this.inputs.T.value);
        const timeGrid = Array.from({length: N + 1}, (_, i) => (i * T / N).toFixed(3));

        const datasets = [];
        const percentiles = [
            {value: 0, label: '0.1st Percentile', color: 'rgb(220, 53, 69)'},
            {value: 25, label: '25th Percentile', color: 'rgb(255, 193, 7)'},
            {value: 50, label: 'Median', color: 'rgb(13, 110, 253)'},
            {value: 75, label: '75th Percentile', color: 'rgb(102, 16, 242)'},
            {value: 100, label: '99.9th Percentile', color: 'rgb(25, 135, 84)'}
        ];

        let allY = [];
        percentiles.forEach(p => {
            const path = this.simulation.getPercentilePath(p.value);
            if (path) {
                datasets.push({
                    label: p.label,
                    data: Array.from(path),
                    borderColor: p.color,
                    backgroundColor: p.color + '20',
                    borderWidth: 2,
                    fill: false,
                    pointRadius: 0,
                    pointHoverRadius: 4
                });
                allY = allY.concat(path);
            }
        });

        let yMin = Math.min(...allY);
        let yMax = Math.max(...allY);
        const margin = (yMax - yMin) * 0.05;
        yMin -= margin;
        yMax += margin;

        this.chart.data.labels = timeGrid;
        this.chart.data.datasets = datasets;
        this.chart.options.scales.y.min = yMin;
        this.chart.options.scales.y.max = yMax;
        this.chart.update('none');
    }

    initializeChart() {
        const canvas = document.getElementById('priceChart');
        canvas.width = window.innerWidth * 0.8;
        canvas.height = window.innerHeight * 0.8;
        const ctx = canvas.getContext('2d');
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: []
            },
            options: {
                responsive: false,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: true,
                        text: 'Stock Price Evolution (Percentile Paths)',
                        font: { size: 30, family: "serif" }
                    }
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Time (years)',
                            font: { size: 20, family: "serif" }
                        },
                        ticks: {
                            font: { size: 16, family: "serif" }
                        }
                    },
                    y: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Stock Price',
                            font: { size: 20, family: "serif" }
                        },
                        ticks: {
                            font: { size: 16, family: "serif" }
                        }
                    }
                },
                elements: {
                    line: {
                        tension: 0.1
                    }
                }
            }
        });
    }
}

// WebAssembly wrapper class
class WasmSimulation {
    constructor(module) {
        this.module = module;
        this.initializeSimulation = module.cwrap('initialize_simulation', null, 
            ['number', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'number']);
        this.runSimulationBatch = module.cwrap('run_simulation_batch', null, ['number']);
        this.getSimulationCount = module.cwrap('get_simulation_count', 'number', []);
        this.getOptionPrice = module.cwrap('get_option_price', 'number', []);
        this.getBlackScholesPrice = module.cwrap('get_black_scholes_price', 'number', []);
        this.getPercentilePathPtr = module.cwrap('get_percentile_path', 'number', ['number']);
        this.getTimeSteps = module.cwrap('get_time_steps', 'number', []);
        this.isTrackingPhase = module.cwrap('is_tracking_phase', 'number', []);
    }
    
    getPercentilePath(percentile) {
        const ptr = this.getPercentilePathPtr(percentile);
        if (ptr === 0) return null;
        const N = this.getTimeSteps();
        
        try {
            if (this.module.getValue) {
                const result = [];
                for (let i = 0; i <= N; i++) {
                    result.push(this.module.getValue(ptr + (i * 8), 'double'));
                }
                return result;
            }
            
            if (this.module.HEAPF64) {
                const result = [];
                for (let i = 0; i <= N; i++) {
                    result.push(this.module.HEAPF64[(ptr >> 3) + i]);
                }
                return result;
            }
            
            let memoryBuffer = null;
            if (this.module.wasmMemory && this.module.wasmMemory.buffer) {
                memoryBuffer = this.module.wasmMemory.buffer;
            } else if (this.module.memory && this.module.memory.buffer) {
                memoryBuffer = this.module.memory.buffer;
            } else if (this.module.exports && this.module.exports.memory && this.module.exports.memory.buffer) {
                memoryBuffer = this.module.exports.memory.buffer;
            }
            
            if (memoryBuffer) {
                const view = new Float64Array(memoryBuffer, ptr, N + 1);
                return Array.from(view);
            }
            
            return null;
            
        } catch (e) {
            console.error("Error accessing WASM memory:", e);
            return null;
        }
    }
}

document.addEventListener('DOMContentLoaded', function() {
    new HestonApp();
});
