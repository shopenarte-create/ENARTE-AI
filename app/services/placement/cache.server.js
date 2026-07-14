import crypto from "crypto";

/**
 * Lightweight in-memory caches for the placement pipeline.
 * Survives across requests in the same Node process.
 */

const MAX_ENTRIES = 48;

function createLru(limit = MAX_ENTRIES) {
  const map = new Map();
  return {
    get(key) {
      if (!map.has(key)) {
        return undefined;
      }
      const value = map.get(key);
      map.delete(key);
      map.set(key, value);
      return value;
    },
    set(key, value) {
      if (map.has(key)) {
        map.delete(key);
      }
      map.set(key, value);
      while (map.size > limit) {
        const oldest = map.keys().next().value;
        map.delete(oldest);
      }
    },
    has(key) {
      return map.has(key);
    },
  };
}

const productImageCache = createLru(64);
const ceilingPlaneCache = createLru(24);
const roomPrepCache = createLru(12);

export function hashBuffer(buffer) {
  return crypto.createHash("sha1").update(buffer).digest("hex");
}

export function getCachedProductImage(url) {
  return productImageCache.get(url);
}

export function setCachedProductImage(url, buffer) {
  productImageCache.set(url, buffer);
}

export function getCachedCeilingPlane(roomHash) {
  return ceilingPlaneCache.get(roomHash);
}

export function setCachedCeilingPlane(roomHash, plane) {
  ceilingPlaneCache.set(roomHash, plane);
}

export function getCachedRoomPrep(roomHash) {
  return roomPrepCache.get(roomHash);
}

export function setCachedRoomPrep(roomHash, value) {
  roomPrepCache.set(roomHash, value);
}
