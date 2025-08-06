#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <string.h>
#include <time.h>
#include <emscripten/emscripten.h> // For compiling to WebAssembly

// Constants
#define MAX_PERCENTILE_PATHS 1000
#define PERCENTILE_TRACKING_LIMIT 1000

// Structure to hold a price path
typedef struct {
    double *path;
    double final_price;
} PricePath;

// Structure to hold simulation state
typedef struct {
    // Parameters
    double S0, v0, r, theta, kappa, xi, rho, T, K;
    int N;
    
    // Simulation state
    int simulation_count;
    int tracking_phase;  // 1 if still tracking percentiles, 0 if only accumulating payoffs
    
    // Price tracking for percentiles
    PricePath *all_paths;
    int paths_stored;
    
    // Percentile paths (indices into all_paths after sorting)
    int min_idx, p25_idx, p50_idx, p75_idx, max_idx;
    
    // Option pricing
    double total_payoffs;
    double current_option_price;
    double black_scholes_price;
} SimulationState;

// Global simulation state
static SimulationState sim_state = {0};

// Random number generation (simple LCG)
static unsigned long rand_seed;

double simple_random() {
    rand_seed = (rand_seed * 1103515245 + 12345) & 0x7fffffff;
    return (double)rand_seed / 0x7fffffff;
}

double normal_random() {
    static int has_spare = 0;
    static double spare;
    
    if (has_spare) {
        has_spare = 0;
        return spare;
    }
    
    has_spare = 1;
    double u = simple_random();
    double v = simple_random();
    double mag = sqrt(-2.0 * log(u));
    spare = mag * cos(2.0 * M_PI * v);
    return mag * sin(2.0 * M_PI * v);
}

// Normal CDF for Black-Scholes
double norm_cdf(double x) {
    return 0.5 * (1.0 + erf(x / sqrt(2.0)));
}

// Black-Scholes calculation
double black_scholes_call(double S0, double K, double r, double T, double sigma) {
    double d1 = (log(S0 / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrt(T));
    double d2 = d1 - sigma * sqrt(T);
    return S0 * norm_cdf(d1) - K * exp(-r * T) * norm_cdf(d2);
}

// Simulate a single price path using Milstein scheme
double* simulate_single_path(double S0, double v0, double r, double theta, double kappa, 
                            double xi, double rho, double T, int N) {
    double dt = T / N;
    double *S = (double*)malloc((N + 1) * sizeof(double));
    double *v = (double*)malloc((N + 1) * sizeof(double));
    
    S[0] = S0;
    v[0] = v0;
    
    for (int i = 1; i <= N; i++) {
        // Generate correlated Brownian increments
        double Z_S = normal_random();
        double Z_v = rho * Z_S + sqrt(1 - rho * rho) * normal_random();
        
        // Update volatility using Milstein scheme
        double v_prev = fmax(v[i-1], 0.0);
        v[i] = v[i-1] + kappa * (theta - v_prev) * dt + 
               Z_v * xi * sqrt(v_prev * dt) + 
               (xi * xi / 4.0) * ((Z_v * Z_v - 1.0) * dt);
        
        // Update stock price using v[i-1] (NOT the updated v[i])
        S[i] = S[i-1] * exp((r - v[i-1] / 2.0) * dt + Z_S * sqrt(fmax(v[i-1], 0.0) * dt));
    }
    
    free(v);
    return S;
}

// Simulate only final price (for efficiency after tracking phase)
double simulate_final_price(double S0, double v0, double r, double theta, double kappa, 
                           double xi, double rho, double T, int N) {
    double dt = T / N;
    double S = S0;
    double v = v0;
    
    for (int i = 1; i <= N; i++) {
        // Generate correlated Brownian increments
        double Z_S = normal_random();
        double Z_v = rho * Z_S + sqrt(1 - rho * rho) * normal_random();
        
        // Store previous variance for stock price update
        double v_prev = v;
        
        // Update volatility using Milstein scheme
        double v_clamped = fmax(v, 0.0);
        v = v + kappa * (theta - v_clamped) * dt + 
            Z_v * xi * sqrt(v_clamped * dt) + 
            (xi * xi / 4.0) * ((Z_v * Z_v - 1.0) * dt);
        
        // Update stock price using previous variance
        S = S * exp((r - v_prev / 2.0) * dt + Z_S * sqrt(fmax(v_prev, 0.0) * dt));
    }
    
    return S;
}

// Comparison function for sorting paths by final price
int compare_paths(const void *a, const void *b) {
    PricePath *path_a = (PricePath*)a;
    PricePath *path_b = (PricePath*)b;
    
    if (path_a->final_price < path_b->final_price) return -1;
    if (path_a->final_price > path_b->final_price) return 1;
    return 0;
}

// Initialize simulation
EMSCRIPTEN_KEEPALIVE
void initialize_simulation(double S0, double v0, double r, double theta, double kappa, 
                          double xi, double rho, double T, double K, int N) {
    // Clean up previous simulation
    if (sim_state.all_paths) {
        for (int i = 0; i < sim_state.paths_stored; i++) {
            if (sim_state.all_paths[i].path) {
                free(sim_state.all_paths[i].path);
            }
        }
        free(sim_state.all_paths);
    }
    
    // Set parameters
    sim_state.S0 = S0;
    sim_state.v0 = v0;
    sim_state.r = r;
    sim_state.theta = theta;
    sim_state.kappa = kappa;
    sim_state.xi = xi;
    sim_state.rho = rho;
    sim_state.T = T;
    sim_state.K = K;
    sim_state.N = N;
    
    // Reset simulation state
    sim_state.simulation_count = 0;
    sim_state.tracking_phase = 1;
    sim_state.paths_stored = 0;
    sim_state.total_payoffs = 0.0;
    sim_state.current_option_price = 0.0;
    
    // Allocate memory for path tracking
    sim_state.all_paths = (PricePath*)malloc(MAX_PERCENTILE_PATHS * sizeof(PricePath));
    memset(sim_state.all_paths, 0, MAX_PERCENTILE_PATHS * sizeof(PricePath));
    
    // Calculate Black-Scholes price
    sim_state.black_scholes_price = black_scholes_call(S0, K, r, T, sqrt(v0));
    
    // Set random seed based on system time for non-deterministic runs
    rand_seed = (unsigned long)time(NULL);
}

// Run a batch of simulations
EMSCRIPTEN_KEEPALIVE
void run_simulation_batch(int batch_size) {
    for (int i = 0; i < batch_size; i++) {
        if (sim_state.tracking_phase && sim_state.simulation_count < PERCENTILE_TRACKING_LIMIT) {
            // Full path simulation for percentile tracking
            double *path = simulate_single_path(sim_state.S0, sim_state.v0, sim_state.r, 
                                              sim_state.theta, sim_state.kappa, sim_state.xi, 
                                              sim_state.rho, sim_state.T, sim_state.N);
            
            if (sim_state.paths_stored < MAX_PERCENTILE_PATHS) {
                sim_state.all_paths[sim_state.paths_stored].path = path;
                sim_state.all_paths[sim_state.paths_stored].final_price = path[sim_state.N];
                sim_state.paths_stored++;
            }
            
            // Calculate payoff
            double payoff = fmax(path[sim_state.N] - sim_state.K, 0.0);
            sim_state.total_payoffs += payoff;
            
            // Check if we should exit tracking phase
            if (sim_state.simulation_count >= PERCENTILE_TRACKING_LIMIT - 1) {
                sim_state.tracking_phase = 0;
                
                // Sort paths for percentile calculation
                qsort(sim_state.all_paths, sim_state.paths_stored, sizeof(PricePath), compare_paths);
                
                // Calculate percentile indices
                sim_state.min_idx = 0;
                sim_state.p25_idx = sim_state.paths_stored / 4;
                sim_state.p50_idx = sim_state.paths_stored / 2;
                sim_state.p75_idx = (3 * sim_state.paths_stored) / 4;
                sim_state.max_idx = sim_state.paths_stored - 1;
            }
        } else {
            // Fast simulation - only final price needed
            double final_price = simulate_final_price(sim_state.S0, sim_state.v0, sim_state.r, 
                                                    sim_state.theta, sim_state.kappa, sim_state.xi, 
                                                    sim_state.rho, sim_state.T, sim_state.N);
            
            double payoff = fmax(final_price - sim_state.K, 0.0);
            sim_state.total_payoffs += payoff;
        }
        
        sim_state.simulation_count++;
    }
    
    // Update option price
    sim_state.current_option_price = exp(-sim_state.r * sim_state.T) * 
                                   (sim_state.total_payoffs / sim_state.simulation_count);
}

// Get current simulation count
EMSCRIPTEN_KEEPALIVE
int get_simulation_count() {
    return sim_state.simulation_count;
}

// Get current option price
EMSCRIPTEN_KEEPALIVE
double get_option_price() {
    return sim_state.current_option_price;
}

// Get Black-Scholes price
EMSCRIPTEN_KEEPALIVE
double get_black_scholes_price() {
    return sim_state.black_scholes_price;
}

// Get percentile path data
EMSCRIPTEN_KEEPALIVE
double* get_percentile_path(int percentile) {
    if (!sim_state.tracking_phase && sim_state.paths_stored > 0) {
        int idx;
        switch (percentile) {
            case 0: idx = sim_state.min_idx; break;
            case 25: idx = sim_state.p25_idx; break;
            case 50: idx = sim_state.p50_idx; break;
            case 75: idx = sim_state.p75_idx; break;
            case 100: idx = sim_state.max_idx; break;
            default: return NULL;
        }
        return sim_state.all_paths[idx].path;
    }
    return NULL;
}

// Get number of time steps
EMSCRIPTEN_KEEPALIVE
int get_time_steps() {
    return sim_state.N;
}

// Check if still in tracking phase
EMSCRIPTEN_KEEPALIVE
int is_tracking_phase() {
    return sim_state.tracking_phase;
}
