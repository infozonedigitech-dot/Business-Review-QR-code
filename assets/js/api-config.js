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
   * Generic API call wrapper with error handling
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
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `API Error: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error(`API Request Failed [${endpoint}]:`, error);
      throw error;
    }
  },

  /**
   * Business Endpoints
   */
  businesses: {
    // Get all businesses
    async getAll() {
      return await API.request('/api/businesses');
    },

    // Get single business by ID
    async getById(id, includeStats = false) {
      const query = includeStats ? '?stats=true' : '';
      return await API.request(`/api/businesses/${id}${query}`);
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
