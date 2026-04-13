const faceapi = window.faceapi;


/* ------------------------------------------------------------------
   Internal State
-------------------------------------------------------------------*/
let modelsLoaded = false;
let loadingPromise = null;

// Models are served from /public/models
const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model';

/* ------------------------------------------------------------------
   Model Initialization
-------------------------------------------------------------------*/

/**
 * Loads all required face-api models exactly once.
 * Subsequent calls reuse the same promise (singleton pattern).
 */
export function initFaceRecognition(onProgress) {
  if (modelsLoaded) return Promise.resolve(true);
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      const models = [
        ['TinyFaceDetector', () => faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL)],
        ['FaceLandmark68Net', () => faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL)],
        ['FaceRecognitionNet', () => faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)],
        ['FaceExpressionNet', () => faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)]
      ];

      for (let i = 0; i < models.length; i++) {
        const [name, load] = models[i];
        await load();

        onProgress?.({
          step: i + 1,
          total: models.length,
          model: name,
          percentage: Math.round(((i + 1) / models.length) * 100)
        });
      }

      modelsLoaded = true;
      console.log('✅ Face-api models loaded');

      // Optional: expose for debugging only
      window.faceapi = faceapi;

      return true;
    } catch (err) {
      loadingPromise = null;
      console.error('❌ Model loading failed', err);
      throw new Error('Face-api models missing or path incorrect (/public/models)');
    }
  })();

  return loadingPromise;
}

/* ------------------------------------------------------------------
   Face Detection
-------------------------------------------------------------------*/

/**
 * Detects a single face and returns landmarks, descriptor & expressions
 */
export async function detectFace(videoEl) {
  if (!modelsLoaded) {
    throw new Error('Face models not initialized');
  }

  const options = new faceapi.TinyFaceDetectorOptions({
    inputSize: 416,
    scoreThreshold: 0.5
  });

  return faceapi
    .detectSingleFace(videoEl, options)
    .withFaceLandmarks()
    .withFaceDescriptor()
    .withFaceExpressions();
}

/* ------------------------------------------------------------------
       Face Comparison
-------------------------------------------------------------------*/
/**
 * PRODUCTION BIOMETRIC FACE COMPARISON
 * Based on face-api.js Euclidean distance
 * Industry-standard threshold enforcement
 */
export function compareFaces(storedDescriptor, currentDescriptor, threshold = 0.55) {
  console.log('🔐 [SECURITY] Face comparison initiated');
  
  // ═══════════════════════════════════════════════════════════
  // VALIDATION LAYER - Fail fast on bad inputs
  // ═══════════════════════════════════════════════════════════
  
  if (!storedDescriptor || !currentDescriptor) {
    console.error('❌ [SECURITY] NULL descriptor detected - REJECT');
    return createRejection('NULL_DESCRIPTOR', 999);
  }
  
  // Convert to Float32Array (face-api.js native format)
  const desc1 = toFloat32Array(storedDescriptor);
  const desc2 = toFloat32Array(currentDescriptor);
  
  // Validate descriptor dimensions (face-api.js uses 128 or 512)
  if (desc1.length !== desc2.length) {
    console.error(`❌ [SECURITY] Dimension mismatch: ${desc1.length} vs ${desc2.length} - REJECT`);
    return createRejection('DIMENSION_MISMATCH', 999);
  }
  
  if (desc1.length !== 128 && desc1.length !== 512) {
    console.error(`❌ [SECURITY] Invalid descriptor size: ${desc1.length} - REJECT`);
    return createRejection('INVALID_SIZE', 999);
  }
  
  console.log(`✓ Descriptors validated: ${desc1.length}D embeddings`);
  
  // ═══════════════════════════════════════════════════════════
  // BIOMETRIC COMPARISON - Euclidean Distance
  // ═══════════════════════════════════════════════════════════
  
  try {
    // Standard Euclidean distance formula
    let sumSquaredDifferences = 0;
    for (let i = 0; i < desc1.length; i++) {
      const diff = desc1[i] - desc2[i];
      sumSquaredDifferences += diff * diff;
    }
    const euclideanDistance = Math.sqrt(sumSquaredDifferences);
    
    // Calculate similarity score (inverse of distance)
    // face-api.js distances typically range 0.0 - 1.5
    const similarity = Math.max(0, 1 - euclideanDistance);
    const confidencePercent = similarity * 100;
    
    // ═══════════════════════════════════════════════════════════
    // DUAL VALIDATION - Both conditions must pass
    // ═══════════════════════════════════════════════════════════
    
    const distancePass = euclideanDistance < threshold;
    const confidencePass = confidencePercent >= 50; // Minimum 50% similarity
    
    const finalMatch = distancePass && confidencePass;
    
    // ═══════════════════════════════════════════════════════════
    // SECURITY LOGGING - Audit trail
    // ═══════════════════════════════════════════════════════════
    
    console.log('┌─────────────────────────────────────────┐');
    console.log('│     BIOMETRIC COMPARISON RESULTS        │');
    console.log('├─────────────────────────────────────────┤');
    console.log(`│ Euclidean Distance: ${euclideanDistance.toFixed(6).padEnd(18)}│`);
    console.log(`│ Similarity Score:   ${confidencePercent.toFixed(2)}%`.padEnd(43) + '│');
    console.log(`│ Threshold:          ${threshold.toFixed(2)}`.padEnd(43) + '│');
    console.log('├─────────────────────────────────────────┤');
    console.log(`│ Distance Check:     ${distancePass ? '✅ PASS' : '❌ FAIL'}`.padEnd(43) + '│');
    console.log(`│ Confidence Check:   ${confidencePass ? '✅ PASS' : '❌ FAIL'}`.padEnd(43) + '│');
    console.log('├─────────────────────────────────────────┤');
    console.log(`│ FINAL DECISION:     ${finalMatch ? '✅ MATCH' : '❌ REJECT'}`.padEnd(43) + '│');
    console.log('└─────────────────────────────────────────┘');
    
    // Interpretation guide
    if (euclideanDistance < 0.4) {
      console.log('📊 Analysis: Excellent match - same person (high confidence)');
    } else if (euclideanDistance < 0.55) {
      console.log('📊 Analysis: Good match - same person (medium confidence)');
    } else if (euclideanDistance < 0.7) {
      console.log('📊 Analysis: Weak match - likely different person');
    } else {
      console.log('📊 Analysis: No match - definitely different person');
    }
    
    return {
      match: finalMatch,
      distance: euclideanDistance,
      similarity: similarity,
      confidence: confidencePercent,
      threshold: threshold,
      checks: {
        distancePass,
        confidencePass
      }
    };
    
  } catch (error) {
    console.error('❌ [SECURITY] Comparison exception:', error);
    return createRejection('COMPARISON_ERROR', 999);
  }
}

// ═══════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════

function toFloat32Array(descriptor) {
  if (descriptor instanceof Float32Array) return descriptor;
  if (Array.isArray(descriptor)) return new Float32Array(descriptor);
  if (descriptor.length) return new Float32Array(Array.from(descriptor));
  throw new Error('Invalid descriptor format');
}

function createRejection(reason, distance) {
  return {
    match: false,
    distance: distance,
    similarity: 0,
    confidence: 0,
    threshold: 0,
    error: reason,
    checks: {
      distancePass: false,
      confidencePass: false
    }
  };
}

/* ------------------------------------------------------------------
   Camera Utilities
-------------------------------------------------------------------*/

/**
 * Safely stops camera stream and releases memory
 */
export function stopVideo(videoEl) {
  const stream = videoEl?.srcObject;
  if (!stream) return;

  stream.getTracks().forEach(track => track.stop());
  videoEl.srcObject = null;
  console.log('📷 Camera stopped');
}

/**
 * Requests user camera stream
 */
export async function getCameraStream(facingMode = 'user') {
  return navigator.mediaDevices.getUserMedia({
    video: {
      facingMode,
      width: { ideal: 640 },
      height: { ideal: 480 }
    },
    audio: false
  });
}

// ✅ Average multiple face descriptors into one
/**
 * Average multiple face descriptors to create a robust template
 */
/**
 * Average face descriptors with quality filtering
 * Prevents descriptor dilution that causes false matches
 */
export function averageDescriptors(descriptors) {
  if (!descriptors || descriptors.length === 0) {
    console.error('❌ No descriptors to average');
    return null;
  }
  
  console.log(`📊 Averaging ${descriptors.length} descriptors...`);
  
  // Single descriptor - return as-is
  if (descriptors.length === 1) {
    return new Float32Array(descriptors[0]);
  }
  
  // Validate all descriptors
  const firstLength = descriptors[0].length;
  const validDescriptors = descriptors.filter(d => {
    if (!d || d.length !== firstLength) {
      console.warn('⚠️  Skipping invalid descriptor');
      return false;
    }
    return true;
  });
  
  if (validDescriptors.length === 0) {
    console.error('❌ No valid descriptors found');
    return null;
  }
  
  // ═══════════════════════════════════════════════════════════
  // QUALITY FILTERING - Remove outliers
  // ═══════════════════════════════════════════════════════════
  
  // Calculate pairwise distances to find outliers
  if (validDescriptors.length >= 5) {
    const distances = validDescriptors.map((desc1, i) => {
      let totalDist = 0;
      validDescriptors.forEach((desc2, j) => {
        if (i !== j) {
          let sum = 0;
          for (let k = 0; k < desc1.length; k++) {
            const diff = desc1[k] - desc2[k];
            sum += diff * diff;
          }
          totalDist += Math.sqrt(sum);
        }
      });
      return { desc: desc1, avgDist: totalDist / (validDescriptors.length - 1) };
    });
    
    // Sort by consistency (lower distance = more consistent)
    distances.sort((a, b) => a.avgDist - b.avgDist);
    
    // Keep only most consistent 60%
    const keepCount = Math.ceil(distances.length * 0.6);
    const filteredDescriptors = distances.slice(0, keepCount).map(item => item.desc);
    
    console.log(`✓ Quality filtering: ${filteredDescriptors.length}/${validDescriptors.length} descriptors retained`);
    
    validDescriptors.length = 0;
    validDescriptors.push(...filteredDescriptors);
  }
  
  // ═══════════════════════════════════════════════════════════
  // COMPUTE AVERAGE
  // ═══════════════════════════════════════════════════════════
  
  const avgDescriptor = new Float32Array(firstLength);
  
  // Sum all descriptors
  for (const descriptor of validDescriptors) {
    for (let i = 0; i < firstLength; i++) {
      avgDescriptor[i] += descriptor[i];
    }
  }
  
  // Divide by count to get average
  for (let i = 0; i < firstLength; i++) {
    avgDescriptor[i] /= validDescriptors.length;
  }
  
  console.log(`✓ Average descriptor computed from ${validDescriptors.length} samples`);
  
  return avgDescriptor;
}
/**
 * Detect ALL faces in a frame (used during registration)
 */
export async function detectAllFaces(videoElement) {
  if (!modelsLoaded) {
    throw new Error('Models are not loaded yet');
  }

  const options = new faceapi.TinyFaceDetectorOptions({
    inputSize: 416,
    scoreThreshold: 0.5
  });

  return await faceapi
    .detectAllFaces(videoElement, options)
    .withFaceLandmarks()
    .withFaceDescriptors()
    .withFaceExpressions();
}
/**
 * Validate face quality before registration or verification
 * Ensures clear, usable face data
 */
export function validateFaceQuality(detection) {
  if (!detection) {
    return { valid: false, reason: 'No face detected' };
  }

  // Confidence check
  if (detection.detection.score < 0.5) {
    return { valid: false, reason: 'Face confidence too low' };
  }

  // Face size check (avoid tiny / far faces)
  const box = detection.detection.box;
  if (box.width < 100 || box.height < 100) {
    return { valid: false, reason: 'Face too far from camera' };
  }

  return { valid: true };
}


/* ------------------------------------------------------------------
   Optional Export
-------------------------------------------------------------------*/
export { faceapi };



