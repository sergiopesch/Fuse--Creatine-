/**
 * FUSE Circuit Breaker Pattern
 * Provides resilience for external API calls with automatic fallback
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Circuit tripped, requests are rejected immediately
 * - HALF_OPEN: Testing if service has recovered
 *
 * @version 1.0.0
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
    // Failure threshold to trip the circuit
    FAILURE_THRESHOLD: 5,

    // Success threshold to close the circuit from half-open
    SUCCESS_THRESHOLD: 2,

    // Time in ms before attempting recovery (30 seconds)
    RESET_TIMEOUT_MS: 30 * 1000,

    // Request timeout in ms (10 seconds)
    REQUEST_TIMEOUT_MS: 10 * 1000,

    // Maximum retry attempts
    MAX_RETRIES: 3,

    // Exponential backoff base (ms)
    BACKOFF_BASE_MS: 1000,

    // Maximum backoff time (ms)
    MAX_BACKOFF_MS: 10000,
};

// ============================================================================
// CIRCUIT STATE
// ============================================================================

const CircuitState = {
    CLOSED: 'CLOSED',
    OPEN: 'OPEN',
    HALF_OPEN: 'HALF_OPEN',
};

// Store circuits per service
const circuits = new Map();

// ============================================================================
// CIRCUIT BREAKER CLASS
// ============================================================================

class CircuitBreaker {
    constructor(name, options = {}) {
        this.name = name;
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
        this.lastFailureTime = null;
        this.lastSuccessTime = null;
        this.openedAt = null;

        // Merge options with defaults
        this.failureThreshold = options.failureThreshold || CONFIG.FAILURE_THRESHOLD;
        this.successThreshold = options.successThreshold || CONFIG.SUCCESS_THRESHOLD;
        this.resetTimeout = options.resetTimeoutMs || CONFIG.RESET_TIMEOUT_MS;
        this.requestTimeout = options.requestTimeoutMs || CONFIG.REQUEST_TIMEOUT_MS;
        this.maxRetries = options.maxRetries || CONFIG.MAX_RETRIES;

        // Callbacks
        this.onStateChange = options.onStateChange || (() => {});
        this.onFallback = options.onFallback || null;

        // Statistics
        this.stats = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            fallbackExecutions: 0,
            circuitTrips: 0,
            lastError: null,
        };
    }

    /**
     * Check if circuit allows request
     */
    canExecute() {
        if (this.state === CircuitState.CLOSED) {
            return true;
        }

        if (this.state === CircuitState.OPEN) {
            // Check if reset timeout has passed
            if (Date.now() - this.openedAt >= this.resetTimeout) {
                this.transitionTo(CircuitState.HALF_OPEN);
                return true;
            }
            return false;
        }

        if (this.state === CircuitState.HALF_OPEN) {
            // Allow limited requests in half-open state
            return true;
        }

        return false;
    }

    /**
     * Transition to a new state
     */
    transitionTo(newState) {
        const oldState = this.state;
        this.state = newState;

        if (newState === CircuitState.OPEN) {
            this.openedAt = Date.now();
            this.stats.circuitTrips++;
        }

        if (newState === CircuitState.CLOSED) {
            this.failureCount = 0;
            this.successCount = 0;
            this.openedAt = null;
        }

        if (newState === CircuitState.HALF_OPEN) {
            this.successCount = 0;
        }

        console.log(`[CircuitBreaker:${this.name}] State transition: ${oldState} -> ${newState}`);
        this.onStateChange(this.name, oldState, newState);
    }

    /**
     * Record a successful request
     */
    recordSuccess() {
        this.successCount++;
        this.lastSuccessTime = Date.now();
        this.stats.successfulRequests++;

        if (this.state === CircuitState.HALF_OPEN) {
            if (this.successCount >= this.successThreshold) {
                this.transitionTo(CircuitState.CLOSED);
            }
        }

        // Reset failure count on success in closed state
        if (this.state === CircuitState.CLOSED) {
            this.failureCount = 0;
        }
    }

    /**
     * Record a failed request
     */
    recordFailure(error) {
        this.failureCount++;
        this.lastFailureTime = Date.now();
        this.stats.failedRequests++;
        this.stats.lastError = error?.message || 'Unknown error';

        if (this.state === CircuitState.HALF_OPEN) {
            // Any failure in half-open trips the circuit again
            this.transitionTo(CircuitState.OPEN);
        } else if (this.state === CircuitState.CLOSED) {
            if (this.failureCount >= this.failureThreshold) {
                this.transitionTo(CircuitState.OPEN);
            }
        }
    }

    /**
     * Execute a function with circuit breaker protection
     * @param {function} fn - Async function to execute
     * @param {function} fallback - Optional fallback function
     * @returns {Promise<any>} Result of fn or fallback
     */
    async execute(fn, fallback = null) {
        this.stats.totalRequests++;

        if (!this.canExecute()) {
            // Circuit is open
            if (fallback || this.onFallback) {
                this.stats.fallbackExecutions++;
                const fallbackFn = fallback || this.onFallback;
                return fallbackFn(new Error(`Circuit ${this.name} is OPEN`));
            }
            throw new Error(`Circuit ${this.name} is OPEN - request rejected`);
        }

        try {
            // Execute with timeout
            const result = await this.executeWithTimeout(fn);
            this.recordSuccess();
            return result;
        } catch (error) {
            this.recordFailure(error);

            // Execute fallback if available
            if (fallback || this.onFallback) {
                this.stats.fallbackExecutions++;
                const fallbackFn = fallback || this.onFallback;
                return fallbackFn(error);
            }

            throw error;
        }
    }

    /**
     * Execute function with timeout
     */
    async executeWithTimeout(fn) {
        return Promise.race([
            fn(),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Request timeout')), this.requestTimeout)
            ),
        ]);
    }

    /**
     * Get circuit status
     */
    getStatus() {
        return {
            name: this.name,
            state: this.state,
            failureCount: this.failureCount,
            successCount: this.successCount,
            failureThreshold: this.failureThreshold,
            successThreshold: this.successThreshold,
            resetTimeoutMs: this.resetTimeout,
            lastFailureTime: this.lastFailureTime,
            lastSuccessTime: this.lastSuccessTime,
            openedAt: this.openedAt,
            stats: { ...this.stats },
        };
    }

    /**
     * Manually reset the circuit
     */
    reset() {
        this.transitionTo(CircuitState.CLOSED);
        this.stats.lastError = null;
    }

    /**
     * Force open the circuit (for testing or manual intervention)
     */
    forceOpen() {
        this.transitionTo(CircuitState.OPEN);
    }
}

// ============================================================================
// CIRCUIT MANAGER
// ============================================================================

/**
 * Get or create a circuit breaker for a service
 * @param {string} name - Service identifier
 * @param {object} options - Circuit breaker options
 * @returns {CircuitBreaker} Circuit breaker instance
 */
function getCircuit(name, options = {}) {
    if (!circuits.has(name)) {
        circuits.set(name, new CircuitBreaker(name, options));
    }
    return circuits.get(name);
}

/**
 * Get status of all circuits
 */
function getAllCircuitsStatus() {
    const status = {};
    for (const [name, circuit] of circuits) {
        status[name] = circuit.getStatus();
    }
    return status;
}

/**
 * Reset all circuits
 */
function resetAllCircuits() {
    for (const circuit of circuits.values()) {
        circuit.reset();
    }
}

// ============================================================================
// RETRY WITH BACKOFF
// ============================================================================

/**
 * Calculate exponential backoff delay
 * @param {number} attempt - Current attempt number (0-indexed)
 * @returns {number} Delay in milliseconds
 */
function calculateBackoff(attempt) {
    const delay = Math.min(CONFIG.BACKOFF_BASE_MS * Math.pow(2, attempt), CONFIG.MAX_BACKOFF_MS);
    // Add jitter (0-25% of delay)
    const jitter = Math.random() * 0.25 * delay;
    return Math.floor(delay + jitter);
}

/**
 * Execute function with retry and exponential backoff
 * @param {function} fn - Async function to execute
 * @param {object} options - Retry options
 * @returns {Promise<any>} Result of fn
 */
async function executeWithRetry(fn, options = {}) {
    const maxRetries = options.maxRetries || CONFIG.MAX_RETRIES;
    const shouldRetry =
        options.shouldRetry ||
        (error => {
            // Default: retry on network errors and 5xx status codes
            if (error.message?.includes('timeout')) return true;
            if (error.message?.includes('network')) return true;
            if (error.status >= 500) return true;
            return false;
        });

    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            if (attempt < maxRetries && shouldRetry(error)) {
                const delay = calculateBackoff(attempt);
                console.log(
                    `[Retry] Attempt ${attempt + 1} failed, retrying in ${delay}ms:`,
                    error.message
                );
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                throw error;
            }
        }
    }

    throw lastError;
}

// ============================================================================
// RESILIENT FETCH
// ============================================================================

/**
 * Make a resilient HTTP request with circuit breaker and retry
 * @param {string} url - Request URL
 * @param {object} options - Fetch options
 * @param {object} resilience - Resilience options
 * @returns {Promise<Response>} Fetch response
 */
async function resilientFetch(url, options = {}, resilience = {}) {
    const {
        circuitName = new URL(url).hostname,
        circuitOptions = {},
        retryOptions = {},
        fallbackResponse = null,
        timeoutMs = CONFIG.REQUEST_TIMEOUT_MS,
    } = resilience;

    // Get or create circuit breaker for this service
    const circuit = getCircuit(circuitName, circuitOptions);

    // Define fallback
    const fallback = fallbackResponse
        ? () =>
              new Response(JSON.stringify(fallbackResponse), {
                  status: 503,
                  headers: { 'Content-Type': 'application/json' },
              })
        : null;

    // Execute with circuit breaker
    return circuit.execute(async () => {
        // Execute with retry
        return executeWithRetry(async () => {
            // Create abort controller for timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

            try {
                const response = await fetch(url, {
                    ...options,
                    signal: controller.signal,
                });

                // Treat 5xx as failures for circuit breaker
                if (response.status >= 500) {
                    const error = new Error(`Server error: ${response.status}`);
                    error.status = response.status;
                    throw error;
                }

                return response;
            } finally {
                clearTimeout(timeoutId);
            }
        }, retryOptions);
    }, fallback);
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    // Configuration
    CONFIG,
    CircuitState,

    // Circuit Breaker
    CircuitBreaker,
    getCircuit,
    getAllCircuitsStatus,
    resetAllCircuits,

    // Retry
    calculateBackoff,
    executeWithRetry,

    // Resilient Fetch
    resilientFetch,

    // Direct access to circuits map for testing
    circuits,
};
