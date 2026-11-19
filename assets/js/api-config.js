/**
 * API Configuration and Helper Functions
 * Centralized API communication layer
 */

const API = {
  // Base URL - auto-detects environment
  baseUrl: typeof window !== 'undefined' 
    ? window.location.origin 
    : '',

  /**
   * Generic API call wrapper with error handling and timeout
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      // Add 8-second timeout for all API calls
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      const response = await fetch(url, {
        ...config,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      // Handle empty responses
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Invalid response format');
      }
      
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `API Error: ${response.status}`);
      }

      return data;
    } catch (error) {
      if (error.name === 'AbortError') {
        console.error(`API Request Timeout [${endpoint}]`);
        throw new Error('Request timeout - please check your connection');
      }
      console.error(`API Request Failed [${endpoint}]:`, error);
      throw error;
    }
  },

  /**
   * Business Endpoints
   */
  businesses: {
    cache: new Map(), // Simple cache for business data
    cacheTimeout: 5 * 60 * 1000, // 5 minutes
    
    // Get all businesses
    async getAll() {
      return await API.request('/api/businesses');
    },

    // Get single business by ID (with caching)
    async getById(id, includeStats = false) {
      // Check cache first
      const cacheKey = `${id}_${includeStats}`;
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        console.log('Using cached business data');
        return cached.data;
      }
      
      // Fetch from API
      const query = includeStats ? '?stats=true' : '';
      const result = await API.request(`/api/businesses/${id}${query}`);
      
      // Cache the result
      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });
      
      return result;
    },

    // Create new business
    async create(businessData) {
      return await API.request('/api/businesses', {
        method: 'POST',
        body: JSON.stringify(businessData),
      });
    },

    // Update existing business
    async update(id, updates) {
      return await API.request(`/api/businesses/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
    },

    // Delete business
    async delete(id) {
      return await API.request(`/api/businesses/${id}`, {
        method: 'DELETE',
      });
    },
  },

  /**
   * Feedback Endpoints
   */
  feedback: {
    // Submit customer feedback
    async submit(feedbackData) {
      return await API.request('/api/feedback', {
        method: 'POST',
        body: JSON.stringify(feedbackData),
      });
    },
  },

  /**
   * Statistics Endpoints
   */
  stats: {
    // Get business statistics
    async get(businessId) {
      return await API.request(`/api/stats/${businessId}`);
    },

    // Increment stat counter
    async increment(businessId, stat) {
      return await API.request(`/api/stats/${businessId}`, {
        method: 'POST',
        body: JSON.stringify({ stat }),
      });
    },
  },
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = API;
}
