class HestonSimulationJS {
    constructor() {
        this.state = {
            S0: 100, v0: 0.04, r: 0.05, theta: 0.1, kappa: 1.0,
            xi: 0.2, rho: -0.5, T: 1.0, K: 100, N: 1000,
            simulationCount: 0,
            trackingPhase: true,
            allPaths: [],
            totalPayoffs: 0,
            currentOptionPrice: 0,
            blackScholesPrice: 0
        };
        this.hasSpare = false;
        this.spare = 0;
    }

    random() {
        return Math.random();
    }

    normalRandom() {
        if (this.hasSpare) {
            this.hasSpare = false;
            return this.spare;
        }
        this.hasSpare = true;
        const u = this.random();
        const v = this.random();
        const mag = Math.sqrt(-2.0 * Math.log(u));
        this.spare = mag * Math.cos(2.0 * Math.PI * v);
        return mag * Math.sin(2.0 * Math.PI * v);
    }

    normalCDF(x) {
        return 0.5 * (1.0 + this.erf(x / Math.sqrt(2.0)));
    }

    erf(x) {
        const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741,
              a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
        const sign = x < 0 ? -1 : 1;
        x = Math.abs(x);
        const t = 1.0 / (1.0 + p * x);
        const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
        return sign * y;
    }

    blackScholesCall(S0, K, r, T, sigma) {
        if (sigma === 0) return 0;
        const d1 = (Math.log(S0 / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
        const d2 = d1 - sigma * Math.sqrt(T);
        return S0 * this.normalCDF(d1) - K * Math.exp(-r * T) * this.normalCDF(d2);
    }

    simulateSinglePath(S0, v0, r, theta, kappa, xi, rho, T, N) {
        const dt = T / N;
        const S = new Array(N + 1);
        const v = new Array(N + 1);
        S[0] = S0; v[0] = v0;
        for (let i = 1; i <= N; i++) {
            const Z_S = this.normalRandom();
            const Z_v = rho * Z_S + Math.sqrt(1 - rho * rho) * this.normalRandom();
            v[i] = v[i-1] + kappa * (theta - Math.max(v[i-1], 0)) * dt + 
                   Z_v * xi * Math.sqrt(Math.max(v[i-1], 0) * dt) + 
                   (xi * xi / 4.0) * ((Z_v * Z_v - 1.0) * dt);
            S[i] = S[i-1] * Math.exp((r - v[i-1] / 2.0) * dt + Z_S * Math.sqrt(Math.max(v[i-1], 0) * dt));
        }
        return S;
    }

    simulateFinalPrice(S0, v0, r, theta, kappa, xi, rho, T, N) {
        const dt = T / N;
        let S = S0, v = v0;
        for (let i = 1; i <= N; i++) {
            const Z_S = this.normalRandom();
            const Z_v = rho * Z_S + Math.sqrt(1 - rho * rho) * this.normalRandom();
            const v_prev = v;
            v = v + kappa * (theta - Math.max(v, 0)) * dt + 
                Z_v * xi * Math.sqrt(Math.max(v, 0) * dt) + 
                (xi * xi / 4.0) * ((Z_v * Z_v - 1.0) * dt);
            S = S * Math.exp((r - v_prev / 2.0) * dt + Z_S * Math.sqrt(Math.max(v_prev, 0) * dt));
        }
        return S;
    }

    initializeSimulation(S0, v0, r, theta, kappa, xi, rho, T, K, N) {
        this.state = {
            S0, v0, r, theta, kappa, xi, rho, T, K, N,
            simulationCount: 0,
            trackingPhase: true,
            allPaths: [],
            totalPayoffs: 0,
            currentOptionPrice: 0,
            blackScholesPrice: this.blackScholesCall(S0, K, r, T, Math.sqrt(v0))
        };
        this.hasSpare = false;
        this.spare = 0;
    }

    runSimulationBatch(batchSize) {
        for (let i = 0; i < batchSize; i++) {
            if (this.state.trackingPhase && this.state.simulationCount < 1000) {
                const path = this.simulateSinglePath(
                    this.state.S0, this.state.v0, this.state.r, this.state.theta,
                    this.state.kappa, this.state.xi, this.state.rho, this.state.T, this.state.N
                );
                if (this.state.allPaths.length < 1000) {
                    this.state.allPaths.push({
                        path: path,
                        finalPrice: path[this.state.N]
                    });
                }
                const payoff = Math.max(path[this.state.N] - this.state.K, 0);
                this.state.totalPayoffs += payoff;
                if (this.state.simulationCount === 999) {
                    this.state.trackingPhase = false;
                    this.state.allPaths.sort((a, b) => a.finalPrice - b.finalPrice);
                }
            } else {
                const finalPrice = this.simulateFinalPrice(
                    this.state.S0, this.state.v0, this.state.r, this.state.theta,
                    this.state.kappa, this.state.xi, this.state.rho, this.state.T, this.state.N
                );
                const payoff = Math.max(finalPrice - this.state.K, 0);
                this.state.totalPayoffs += payoff;
            }
            this.state.simulationCount++;
        }
        this.state.currentOptionPrice = Math.exp(-this.state.r * this.state.T) * 
                                      (this.state.totalPayoffs / this.state.simulationCount);
    }

    getSimulationCount() { return this.state.simulationCount; }
    getOptionPrice() { return this.state.currentOptionPrice; }
    getBlackScholesPrice() { return this.state.blackScholesPrice; }

    getPercentilePath(percentile) {
        if (!this.state.trackingPhase && this.state.allPaths.length > 0) {
            const pathCount = this.state.allPaths.length;
            let idx;
            switch (percentile) {
                case 0: idx = 0; break;
                case 25: idx = Math.floor(pathCount * 0.25); break;
                case 50: idx = Math.floor(pathCount * 0.5); break;
                case 75: idx = Math.floor(pathCount * 0.75); break;
                case 100: idx = pathCount - 1; break;
                default: return null;
            }
            return this.state.allPaths[idx].path;
        }
        return null;
    }

    getTimeSteps() { return this.state.N; }
    isTrackingPhase() { return this.state.trackingPhase; }
}

window.HestonSimulationJS = HestonSimulationJS;