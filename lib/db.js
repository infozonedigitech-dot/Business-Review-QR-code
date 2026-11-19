/**
 * Database Layer - Upstash Redis Storage with In-Memory Fallback
 * Provides CRUD operations for business data
 */

import { Redis } from '@upstash/redis';

let redis;
let useFallback = false;

// In-memory fallback storage (for testing/development when KV is not configured)
const memoryStore = {
  data: new Map(),
  sets: new Map()
};

function getRedis() {
  if (redis) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    console.warn('⚠️ Redis not configured. Using in-memory fallback storage.');
    console.warn('⚠️ Data will be lost on restart. Configure KV database for production.');
    useFallback = true;
    return createFallbackClient();
  }

  redis = new Redis({ url, token });
  return redis;
}

// Fallback client that mimics Redis API using in-memory storage
function createFallbackClient() {
  return {
    get: async (key) => {
      return memoryStore.data.get(key) || null;
    },
    set: async (key, value) => {
      memoryStore.data.set(key, value);
      return 'OK';
    },
    del: async (key) => {
      memoryStore.data.delete(key);
      return 1;
    },
    smembers: async (key) => {
      return Array.from(memoryStore.sets.get(key) || []);
    },
    sadd: async (key, value) => {
      if (!memoryStore.sets.has(key)) {
        memoryStore.sets.set(key, new Set());
      }
      memoryStore.sets.get(key).add(value);
      return 1;
    },
    srem: async (key, value) => {
      if (memoryStore.sets.has(key)) {
        memoryStore.sets.get(key).delete(value);
      }
      return 1;
    },
    incr: async (key) => {
      const current = memoryStore.data.get(key) || 0;
      const newValue = Number(current) + 1;
      memoryStore.data.set(key, newValue);
      return newValue;
    }
  };
}

const BUSINESS_PREFIX = 'business:';
const BUSINESSES_LIST = 'businesses:list';

/**
 * Get all businesses
 */
export async function getAllBusinesses() {
  const client = getRedis();
  try {
    const businessIds = await client.smembers(BUSINESSES_LIST) || [];
    if (businessIds.length === 0) return [];
    
    const businesses = await Promise.all(
      businessIds.map(id => client.get(`${BUSINESS_PREFIX}${id}`))
    );
    
    return businesses.filter(b => b !== null);
  } catch (error) {
    console.error('Database error:', error);
    throw new Error('Failed to fetch businesses');
  }
}

/**
 * Get business by ID
 */
export async function getBusinessById(id) {
  const client = getRedis();
  try {
    const business = await client.get(`${BUSINESS_PREFIX}${id}`);
    return business;
  } catch (error) {
    console.error('Database error:', error);
    return null;
  }
}

/**
 * Create new business
 */
export async function createBusiness(businessData) {
  const client = getRedis();
  try {
    const id = businessData.id || `biz_${Date.now()}`;
    const business = {
      ...businessData,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Store business
    await client.set(`${BUSINESS_PREFIX}${id}`, business);
    
    // Add to businesses list
    await client.sadd(BUSINESSES_LIST, id);
    
    return business;
  } catch (error) {
    console.error('Database error:', error);
    throw new Error('Failed to create business. Check the Redis write credentials and Vercel function logs.');
  }
}

/**
 * Update existing business
 */
export async function updateBusiness(id, updates) {
  const client = getRedis();
  try {
    const existing = await getBusinessById(id);
    if (!existing) {
      throw new Error('Business not found');
    }
    
    const updated = {
      ...existing,
      ...updates,
      id, // Ensure ID doesn't change
      createdAt: existing.createdAt, // Preserve creation date
      updatedAt: new Date().toISOString()
    };
    
    await client.set(`${BUSINESS_PREFIX}${id}`, updated);
    return updated;
  } catch (error) {
    console.error('Database error:', error);
    throw new Error('Failed to update business');
  }
}

/**
 * Delete business
 */
export async function deleteBusiness(id) {
  const client = getRedis();
  try {
    await client.del(`${BUSINESS_PREFIX}${id}`);
    await client.srem(BUSINESSES_LIST, id);
    
    // Clean up related stats
    const statKeys = [
      `stat:${id}:scans`,
      `stat:${id}:reviews`,
      `stat:${id}:shielded`
    ];
    await Promise.all(statKeys.map(key => client.del(key)));
    
    return true;
  } catch (error) {
    console.error('Database error:', error);
    throw new Error('Failed to delete business');
  }
}

/**
 * Increment stat counter
 */
export async function incrementStat(businessId, statName) {
  const client = getRedis();
  try {
    const key = `stat:${businessId}:${statName}`;
    const newValue = await client.incr(key);
    return newValue;
  } catch (error) {
    console.error('Stat increment error:', error);
    return 0;
  }
}

/**
 * Get business stats
 */
export async function getBusinessStats(businessId) {
  const client = getRedis();
  try {
    const [scans, reviews, shielded] = await Promise.all([
      client.get(`stat:${businessId}:scans`) || 0,
      client.get(`stat:${businessId}:reviews`) || 0,
      client.get(`stat:${businessId}:shielded`) || 0
    ]);
    
    return { scans, reviews, shielded };
  } catch (error) {
    console.error('Stats fetch error:', error);
    return { scans: 0, reviews: 0, shielded: 0 };
  }
}
