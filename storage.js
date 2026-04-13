/**
 * Storage Module - Face Embeddings Storage
 * =========================================
 * Handles localStorage operations for face data
 */

/**
 * Store face embedding for a user
 */
export function storeFaceEmbedding(userId, descriptor) {
  try {
    console.log('💾 Storing face embedding for user:', userId);
    
    // Convert to array for storage
    const descriptorArray = Array.from(descriptor);
    
    const data = {
      descriptor: descriptorArray,
      timestamp: Date.now(),
      version: '1.0',
      userId: userId
    };
    
    const key = `face_${userId}`;
    localStorage.setItem(key, JSON.stringify(data));
    
    console.log('✅ Face embedding stored successfully!');
    console.log('   - Key:', key);
    console.log('   - Descriptor length:', descriptorArray.length);
    console.log('   - Timestamp:', new Date(data.timestamp).toLocaleString());
    
    // Verify it was saved
    const verification = localStorage.getItem(key);
    if (verification) {
      console.log('✅ Verified: Face data is in localStorage');
    } else {
      console.error('❌ Error: Face data NOT saved to localStorage!');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error storing face embedding:', error);
    return false;
  }
}

/**
 * Get stored face embedding for a user
 */
export function getFaceEmbedding(userId) {
  try {
    const key = `face_${userId}`;
    console.log('🔍 Looking for face embedding with key:', key);
    
    const data = localStorage.getItem(key);
    
    if (!data) {
      console.log('❌ No face embedding found for user:', userId);
      console.log('   Available keys in localStorage:', Object.keys(localStorage));
      return null;
    }
    
    const parsed = JSON.parse(data);
    const descriptor = new Float32Array(parsed.descriptor);
    
    console.log('✅ Face embedding retrieved successfully!');
    console.log('   - User ID:', userId);
    console.log('   - Descriptor length:', descriptor.length);
    console.log('   - Saved on:', new Date(parsed.timestamp).toLocaleString());
    
    return descriptor;
  } catch (error) {
    console.error('❌ Error retrieving face embedding:', error);
    return null;
  }
}

/**
 * Check if user has registered face
 */
export function isFaceRegistered(userId) {
  const key = `face_${userId}`;
  const exists = localStorage.getItem(key) !== null;
  
  console.log('🔍 Checking if face registered for:', userId);
  console.log('   Result:', exists ? '✅ YES' : '❌ NO');
  
  return exists;
}

/**
 * Delete face embedding for a user
 */
export function deleteFaceEmbedding(userId) {
  try {
    const key = `face_${userId}`;
    localStorage.removeItem(key);
    console.log('🗑️ Deleted face embedding for user:', userId);
    return true;
  } catch (error) {
    console.error('❌ Error deleting face embedding:', error);
    return false;
  }
}

/**
 * Store verification record
 */
export function updateVerificationRecord(userId, success) {
  try {
    const record = {
      userId: userId,
      success: success,
      timestamp: Date.now()
    };
    
    const key = `verify_${userId}_${Date.now()}`;
    localStorage.setItem(key, JSON.stringify(record));
    
    console.log('📝 Verification record saved:', success ? '✅ SUCCESS' : '❌ FAILED');
    return true;
  } catch (error) {
    console.error('❌ Error saving verification record:', error);
    return false;
  }
}

/**
 * Get all registered user IDs
 */
export function getAllRegisteredUsers() {
  const users = [];
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('face_')) {
      const userId = key.replace('face_', '');
      users.push(userId);
    }
  }
  
  console.log('📋 Total registered users:', users.length);
  return users;
}

/**
 * Clear all face data (for testing)
 */
export function clearAllFaceData() {
  const keysToRemove = [];
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('face_') || key.startsWith('verify_'))) {
      keysToRemove.push(key);
    }
  }
  
  keysToRemove.forEach(key => localStorage.removeItem(key));
  console.log('🗑️ Cleared', keysToRemove.length, 'face data entries');
}
