import { 
  initFaceRecognition, 
  detectFace, 
  detectAllFaces,
  compareFaces, 
  stopVideo,
  getCameraStream,
  averageDescriptors,
  validateFaceQuality
} from './faceRecognition.js';

import {
  LivenessSession,
  CHALLENGES,
  CHALLENGE_INSTRUCTIONS,
  generateRandomChallenges
} from './livenessDetection.js';

import {
  storeFaceEmbedding,
  getFaceEmbedding,
  isFaceRegistered,
  updateVerificationRecord,
  getAllRegisteredUsers
} from './storage.js';

// ==================== GLOBAL STATE ====================
let currentBeneficiary = null;
let verificationStartTime = null;
let livenessSession = null;
let detectionInterval = null;
let currentMode = null;
let collectedDescriptors = [];

// Demo beneficiary data - NEW FORMAT: 5 UPPERCASE LETTERS + 5 NUMBERS
const demoBeneficiaries = {
  'RAMAI12345': {
    id: 'RAMAI12345',
    name: 'Ramaiah Naidu',
    age: 68,
    gender: 'Male',
    district: 'Anantapur',
    mandal: 'Gooty',
    village: 'Kurnool Road',
    amount: 2016,
    type: 'Old Age Pension',
    paymentPending: true
  },
  'LAKSH98765': {
    id: 'LAKSH98765',
    name: 'Lakshmi Devi',
    age: 72,
    gender: 'Female',
    district: 'Kadapa',
    mandal: 'Mydukur',
    village: 'Yerraguntla',
    amount: 2016,
    type: 'Widow Pension',
    paymentPending: true
  },
  'SURES55555': {
    id: 'SURES55555',
    name: 'Suresh Kumar',
    age: 45,
    gender: 'Male',
    district: 'Kurnool',
    mandal: 'Nandyal',
    village: 'Allagadda',
    amount: 3016,
    type: 'Disability Pension',
    paymentPending: true
  }
};

// ==================== NAVIGATION ====================
function navigateTo(pageId) {
  const pages = document.querySelectorAll('.page');
  pages.forEach(page => page.classList.remove('active'));
  
  const targetPage = document.getElementById(pageId);
  if (targetPage) {
    setTimeout(() => {
      targetPage.classList.add('active');
      if (pageId === 'camera-page') {
        initCamera();
      }
    }, 50);
  }
}

// ==================== PENSION ID VALIDATION ====================
async function validatePensionId() {
  const pensionIdInput = document.getElementById('pension-id');
  const errorDiv = document.getElementById('login-error');
  const btn = document.querySelector('#login-page .primary-btn');
  const btnText = btn.querySelector('span');
  const loader = btn.querySelector('.btn-loader');
  
  const pensionId = pensionIdInput.value.trim().toUpperCase();
  
  // Validate format: 5 uppercase letters + 5 numbers
  const validFormat = /^[A-Z]{5}[0-9]{5}$/;
  
  if (!pensionId) {
    errorDiv.textContent = 'Please enter a Pension ID';
    errorDiv.classList.remove('hidden');
    return;
  }
  
  if (!validFormat.test(pensionId)) {
    errorDiv.textContent = 'Invalid format! Use 5 LETTERS + 5 NUMBERS (e.g., RAMAI12345)';
    errorDiv.classList.remove('hidden');
    return;
  }
  
  btnText.textContent = 'Verifying...';
  loader.classList.remove('hidden');
  btn.disabled = true;
  errorDiv.classList.add('hidden');
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const beneficiary = demoBeneficiaries[pensionId];
  
  if (beneficiary) {
    currentBeneficiary = beneficiary;
    
    const isRegistered = isFaceRegistered(pensionId);
    
    document.getElementById('beneficiary-name').textContent = beneficiary.name;
    document.getElementById('beneficiary-id').textContent = `ID: ${beneficiary.id}`;
    document.getElementById('beneficiary-age').textContent = `${beneficiary.age} years`;
    document.getElementById('beneficiary-gender').textContent = beneficiary.gender;
    document.getElementById('beneficiary-district').textContent = beneficiary.district;
    document.getElementById('beneficiary-mandal').textContent = beneficiary.mandal;
    document.getElementById('beneficiary-village').textContent = beneficiary.village;
    document.getElementById('beneficiary-amount').textContent = `₹ ${beneficiary.amount.toLocaleString()}`;
    document.getElementById('beneficiary-type').textContent = beneficiary.type;
    
    const actionBtn = document.getElementById('action-btn');
    const actionText = document.querySelector('.action-text');
    
    if (isRegistered) {
      currentMode = 'verify';
      actionText.textContent = 'Proceed with face verification to approve payment';
      actionBtn.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 12l2 2 4-4"/>
          <circle cx="12" cy="12" r="10"/>
        </svg>
        <span>Verify Identity</span>
      `;
    } else {
      currentMode = 'register';
      actionText.textContent = 'First-time user: Register your face for future verifications';
      actionBtn.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
        </svg>
        <span>Register Face</span>
      `;
    }
    
    const statusBadge = document.getElementById('payment-status');
    if (isRegistered) {
      statusBadge.innerHTML = `
        <span class="status-dot verified"></span>
        <span class="status-text">Registered</span>
      `;
    } else {
      statusBadge.innerHTML = `
        <span class="status-dot"></span>
        <span class="status-text">Not Registered</span>
      `;
    }
    
    navigateTo('details-page');
  } else {
    errorDiv.textContent = 'No beneficiary found with this Pension ID.';
    errorDiv.classList.remove('hidden');
  }
  
  btnText.textContent = 'Verify ID';
  loader.classList.add('hidden');
  btn.disabled = false;
}

// ==================== CAMERA INITIALIZATION ====================
async function initCamera() {
  const video = document.getElementById('video');
  const overlay = document.getElementById('overlay');
  const cameraStatus = document.getElementById('camera-status');
  const captureBtn = document.getElementById('capture-btn');
  const instructionText = document.getElementById('instruction-text');
  const pageTitle = document.querySelector('#camera-page .page-header h2');
  
  pageTitle.textContent = currentMode === 'register' ? 'Face Registration' : 'Face Verification';
  
  cameraStatus.innerHTML = `
    <div class="loading-spinner"></div>
    <span>Loading face recognition models...</span>
  `;
  cameraStatus.classList.remove('hidden');
  captureBtn.disabled = true;
  
  try {
    await initFaceRecognition((progress) => {
      cameraStatus.innerHTML = `
        <div class="loading-spinner"></div>
        <span>Loading ${progress.model}... (${progress.step}/${progress.total})</span>
      `;
    });
    
    cameraStatus.innerHTML = `
      <div class="loading-spinner"></div>
      <span>Initializing camera...</span>
    `;
    
    const stream = await Promise.race([
      getCameraStream('user'),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Camera timeout. Check permissions.')), 10000)
      )
    ]);
    
    video.srcObject = stream;
    
    video.onloadedmetadata = () => {
      overlay.width = video.videoWidth;
      overlay.height = video.videoHeight;
      
      cameraStatus.classList.add('hidden');
      captureBtn.disabled = false;
      
      instructionText.textContent = 'Position your face within the oval and press the button';
      startFaceDetection();
    };
    
  } catch (error) {
    console.error('Camera initialization error:', error);
    cameraStatus.innerHTML = `
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <path d="M15 9l-6 6M9 9l6 6"/>
      </svg>
      <span style="color: #ef4444; font-weight: 500;">${error.message}</span>
      <button onclick="location.reload()" style="margin-top: 15px; padding: 10px 20px; background: #0d9488; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px;">
        Try Again
      </button>
    `;
  }
}

// ==================== REAL-TIME FACE DETECTION ====================
function startFaceDetection() {
  const video = document.getElementById('video');
  const overlay = document.getElementById('overlay');
  const ctx = overlay.getContext('2d');
  const captureBtn = document.getElementById('capture-btn');
  
  async function detectLoop() {
    if (!video.srcObject) return;
    
    try {
      ctx.clearRect(0, 0, overlay.width, overlay.height);
      
      const detection = await detectFace(video);
      
      if (detection) {
        const box = detection.detection.box;
        
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 3;
        ctx.strokeRect(box.x, box.y, box.width, box.height);
        
        ctx.fillStyle = '#00ff00';
        ctx.font = 'bold 16px Arial';
        ctx.fillText(`${Math.round(detection.detection.score * 100)}%`, box.x, box.y - 10);
        
        if (captureBtn.disabled) {
          captureBtn.disabled = false;
        }
      } else {
        ctx.fillStyle = '#ff6b6b';
        ctx.font = '18px Arial';
        ctx.fillText('No face detected', 20, 30);
      }
      
    } catch (error) {
      console.error('Face detection error:', error);
    }
    
    setTimeout(() => requestAnimationFrame(detectLoop), 100);
  }
  
  detectLoop();
}

// ==================== CAPTURE AND VERIFY ====================
async function captureAndVerify() {
  const video = document.getElementById('video');
  const captureBtn = document.getElementById('capture-btn');
  const progressFill = document.getElementById('progress-fill');
  const progressText = document.getElementById('progress-text');
  const instructionText = document.getElementById('instruction-text');
  
  captureBtn.disabled = true;
  verificationStartTime = Date.now();
  
  try {
    progressText.textContent = 'Checking for faces...';
    progressFill.style.width = '10%';
    
    const allFaces = await detectAllFaces(video);
    
    if (allFaces.length === 0) {
      showToast('No face detected. Please position your face in the frame.');
      captureBtn.disabled = false;
      return;
    }
    
    if (allFaces.length > 1) {
      showToast('Multiple faces detected. Please ensure only one person is in frame.');
      captureBtn.disabled = false;
      return;
    }
    
    progressText.textContent = 'Analyzing face...';
    progressFill.style.width = '20%';
    
    const detection = await detectFace(video);
    
    if (!detection) {
      showToast('Face detection failed. Please try again with better lighting.');
      captureBtn.disabled = false;
      return;
    }
    
    const quality = validateFaceQuality(detection);
    if (!quality.valid) {
      showToast(quality.reason);
      captureBtn.disabled = false;
      return;
    }
    
    instructionText.textContent = 'Starting liveness detection...';
    progressText.textContent = 'Preparing liveness challenges...';
    progressFill.style.width = '30%';
    
    await new Promise(r => setTimeout(r, 500));
    
    const livenessResult = await performLivenessCheck(video, instructionText);
    
    if (!livenessResult.passed) {
      showResult(false, 0.3, currentMode === 'register' ? 'registration' : 'verification');
      return;
    }
    
    progressFill.style.width = '80%';
    progressText.textContent = 'Processing...';
    
    if (currentMode === 'register') {
      // ═══════════════════════════════════════════════════════════
      // REGISTRATION MODE
      // ═══════════════════════════════════════════════════════════
      
      const avgDescriptor = averageDescriptors(livenessResult.descriptors);
      
      if (!avgDescriptor) {
        showToast('Failed to create face template. Please try again.');
        captureBtn.disabled = false;
        return;
      }
      
      storeFaceEmbedding(currentBeneficiary.id, avgDescriptor);
      progressFill.style.width = '100%';
      
      showResult(true, 0.95, 'registration');
      
    } else {
      // ═══════════════════════════════════════════════════════════
      // VERIFICATION MODE - BIOMETRIC SECURITY
      // ═══════════════════════════════════════════════════════════
      
      console.log('🔐 [SECURITY] Initiating biometric verification');
      console.log(`   User ID: ${currentBeneficiary.id}`);
      console.log(`   Claimed identity: ${currentBeneficiary.name}`);
      
      progressFill.style.width = '80%';
      progressText.textContent = 'Verifying biometric identity...';
      
      // STEP 1: Retrieve registered biometric template
      const storedEmbedding = getFaceEmbedding(currentBeneficiary.id);
      
      if (!storedEmbedding) {
        console.error('❌ [SECURITY] No biometric template on file - REJECT');
        progressFill.style.width = '100%';
        showToast('No registered face found. Please register first.');
        captureBtn.disabled = false;
        return;
      }
      
      console.log('✓ Biometric template retrieved from secure storage');
      
      // STEP 2: Generate current biometric sample
      const currentEmbedding = averageDescriptors(livenessResult.descriptors);
      
      if (!currentEmbedding) {
        console.error('❌ [SECURITY] Failed to generate biometric sample - REJECT');
        showToast('Failed to process biometric data. Please try again.');
        captureBtn.disabled = false;
        return;
      }
      
      console.log('✓ Current biometric sample generated');
      
      // STEP 3: CRITICAL SECURITY CHECK - Biometric Comparison
      console.log('🔍 [SECURITY] Running biometric comparison algorithm...');
      
      let comparisonResult;
      const SECURE_THRESHOLD = 0.55; // ⚠️ TUNED FOR SECURITY
      
      try {
        comparisonResult = compareFaces(storedEmbedding, currentEmbedding, SECURE_THRESHOLD);
        
        if (!comparisonResult || comparisonResult.distance === undefined) {
          throw new Error('Invalid comparison result structure');
        }
        
      } catch (error) {
        console.error('❌ [SECURITY] Biometric comparison failed:', error);
        progressFill.style.width = '100%';
        
        // FAIL-SAFE: Reject on any comparison error
        updateVerificationRecord(currentBeneficiary.id, false);
        showResult(false, 0, 'verification');
        return;
      }
      
      // STEP 4: SECURITY DECISION - No auto-success allowed
      progressFill.style.width = '100%';
      progressText.textContent = 'Biometric analysis complete';
      
      // EXPLICIT BOOLEAN CHECK
      if (comparisonResult.match === true) {
        
        console.log('═══════════════════════════════════════════════════');
        console.log('✅ [SECURITY] BIOMETRIC VERIFICATION SUCCESSFUL');
        console.log('═══════════════════════════════════════════════════');
        console.log(`   Identity confirmed: ${currentBeneficiary.name}`);
        console.log(`   Biometric confidence: ${comparisonResult.confidence.toFixed(2)}%`);
        console.log(`   Distance: ${comparisonResult.distance.toFixed(4)} (threshold: ${SECURE_THRESHOLD})`);
        console.log('═══════════════════════════════════════════════════');
        
        updateVerificationRecord(currentBeneficiary.id, true);
        showResult(true, comparisonResult.similarity, 'verification');
        
      } else {
        
        console.log('═══════════════════════════════════════════════════');
        console.log('❌ [SECURITY] BIOMETRIC VERIFICATION FAILED');
        console.log('═══════════════════════════════════════════════════');
        console.log('   ⚠️  IDENTITY MISMATCH DETECTED');
        console.log(`   Claimed identity: ${currentBeneficiary.name}`);
        console.log(`   Biometric distance: ${comparisonResult.distance.toFixed(4)}`);
        console.log(`   Security threshold: ${SECURE_THRESHOLD}`);
        console.log(`   Similarity: ${comparisonResult.confidence.toFixed(2)}%`);
        
        if (comparisonResult.checks && !comparisonResult.checks.distancePass) {
          console.log('   Reason: Face embedding distance exceeds threshold');
        }
        if (comparisonResult.checks && !comparisonResult.checks.confidencePass) {
          console.log('   Reason: Similarity confidence too low');
        }
        
        console.log('   🚨 This person is NOT the registered beneficiary');
        console.log('═══════════════════════════════════════════════════');
        
        updateVerificationRecord(currentBeneficiary.id, false);
        showResult(false, comparisonResult.similarity, 'verification');
      }
    }
    
  } catch (error) {
    console.error('Verification error:', error);
    showToast('Verification failed: ' + error.message);
    captureBtn.disabled = false;
  }
}

// ==================== LIVENESS DETECTION ====================
async function performLivenessCheck(video, instructionText) {
  const progressFill = document.getElementById('progress-fill');
  const progressText = document.getElementById('progress-text');
  const instructionIcon = document.getElementById('instruction-icon');
  
  collectedDescriptors = [];
  
  const challenges = generateRandomChallenges(2);
  livenessSession = new LivenessSession(challenges);
  
  return new Promise(async (resolve) => {
    let isRunning = true;
    let lastChallengeIndex = -1;
    let challengeStartTime = Date.now();
    const challengeTimeout = 20000; // 20 seconds per challenge
    
    const processFrame = async () => {
      if (!isRunning) return;
      
      try {
        const detection = await detectFace(video);
        
        if (!detection) {
          instructionText.textContent = 'Face not detected - please stay in frame';
          setTimeout(() => requestAnimationFrame(processFrame), 100);
          return;
        }
        
        collectedDescriptors.push(detection.descriptor);
        if (collectedDescriptors.length > 15) {
          collectedDescriptors.shift();
        }
        
        const result = livenessSession.update(detection);
        
        const currentProgress = livenessSession.getProgress();
        if (currentProgress.completed > lastChallengeIndex) {
          lastChallengeIndex = currentProgress.completed;
          challengeStartTime = Date.now();
          
          instructionText.textContent = '✓ Challenge passed!';
          instructionIcon.style.color = '#22c55e';
          await new Promise(r => setTimeout(r, 800));
          instructionIcon.style.color = '';
        }
        
        if (Date.now() - challengeStartTime > challengeTimeout) {
          isRunning = false;
          livenessSession.fail('Challenge timeout');
          instructionText.textContent = 'Timeout! Try again.';
          await new Promise(r => setTimeout(r, 1500));
          resolve({ passed: false, reason: 'timeout' });
          return;
        }
        
        if (result.complete) {
          isRunning = false;
          if (result.passed) {
            progressFill.style.width = '70%';
            progressText.textContent = 'Liveness confirmed!';
            instructionText.textContent = '✓ All challenges completed!';
            instructionIcon.style.color = '#22c55e';
            
            await new Promise(r => setTimeout(r, 1000));
            resolve({ passed: true, descriptors: collectedDescriptors });
          } else {
            instructionText.textContent = '✗ Liveness check failed';
            await new Promise(r => setTimeout(r, 1500));
            resolve({ passed: false, reason: 'failed' });
          }
          return;
        }
        
        const currentChallenge = livenessSession.getCurrentChallenge();
        if (currentChallenge) {
          updateChallengeUI(currentChallenge, instructionText, instructionIcon);
          
          const progress = livenessSession.getProgress();
          const progressPercent = 30 + (progress.percentage * 0.4);
          progressFill.style.width = `${progressPercent}%`;
          progressText.textContent = `Challenge ${progress.completed + 1} of ${progress.total}`;
        }
        
        setTimeout(() => requestAnimationFrame(processFrame), 80);
        
      } catch (error) {
        console.error('Liveness frame error:', error);
        setTimeout(() => requestAnimationFrame(processFrame), 150);
      }
    };
    
    processFrame();
  });
}

// ==================== UI UPDATES ====================
function updateChallengeUI(challenge, instructionText, instructionIcon) {
  instructionText.textContent = challenge.text;
  
  const iconSVGs = {
    'eye': `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>`,
    'smile': `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"/>
      <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
      <line x1="9" y1="9" x2="9.01" y2="9"/>
      <line x1="15" y1="9" x2="15.01" y2="9"/>
    </svg>`
  };
  
  instructionIcon.innerHTML = iconSVGs[challenge.icon] || iconSVGs['eye'];
}

function showResult(success, confidence, mode) {
  const verificationTime = ((Date.now() - verificationStartTime) / 1000).toFixed(1);
  const transactionId = `TXN-${Date.now().toString().slice(-8)}`;
  
  const resultIcon = document.getElementById('result-icon');
  const resultTitle = document.getElementById('result-title');
  const resultMessage = document.getElementById('result-message');
  const confidenceScore = document.getElementById('confidence-score');
  const verificationTimeEl = document.getElementById('verification-time');
  const transactionIdEl = document.getElementById('transaction-id');
  const resultNote = document.getElementById('result-note');
  
  if (success) {
    resultIcon.className = 'result-icon success';
    resultIcon.innerHTML = `
      <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3">
        <path d="M20 6L9 17l-5-5"/>
      </svg>
    `;
    
    if (mode === 'registration') {
      resultTitle.textContent = 'Registration Successful';
      resultMessage.textContent = 'Your face has been securely registered for future verifications.';
      resultNote.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
        <p>Only face embeddings stored - no images saved</p>
      `;
    } else {
      resultTitle.textContent = 'Verification Successful';
      resultMessage.textContent = 'Your identity has been verified successfully.';
      resultNote.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 16v-4M12 8h.01"/>
        </svg>
        <p>Approval forwarded to payment processing</p>
      `;
      
      if (currentBeneficiary) {
        currentBeneficiary.paymentPending = false;
      }
    }
    
    resultNote.className = 'result-note';
  } else {
    resultIcon.className = 'result-icon error';
    resultIcon.innerHTML = `
      <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3">
        <path d="M18 6L6 18M6 6l12 12"/>
      </svg>
    `;
    resultTitle.textContent = mode === 'registration' ? 'Registration Failed' : 'Verification Failed';
    resultMessage.textContent = 'Face did not match or liveness check failed. Please try again.';
    resultNote.className = 'result-note error';
    resultNote.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 16v-4M12 8h.01"/>
      </svg>
      <p>Please visit the nearest office for manual verification</p>
    `;
  }
  
  confidenceScore.textContent = `${Math.round(confidence * 100)}%`;
  verificationTimeEl.textContent = `${verificationTime}s`;
  transactionIdEl.textContent = transactionId;
  
  navigateTo('result-page');
}

// ==================== UTILITY FUNCTIONS ====================
function stopCamera() {
  const video = document.getElementById('video');
  
  if (detectionInterval) {
    clearInterval(detectionInterval);
    detectionInterval = null;
  }
  
  if (video.srcObject) {
    const tracks = video.srcObject.getTracks();
    tracks.forEach(track => {
      track.stop();
      console.log('Camera track stopped:', track.kind);
    });
    video.srcObject = null;
  }
  
  stopVideo(video);
}

function resetApp() {
  currentBeneficiary = null;
  currentMode = null;
  livenessSession = null;
  collectedDescriptors = [];
  
  document.getElementById('pension-id').value = '';
  document.getElementById('login-error').classList.add('hidden');
  document.getElementById('progress-fill').style.width = '0%';
  document.getElementById('progress-text').textContent = 'Ready';
  
  navigateTo('landing-page');
}

function showHelp() {
  document.getElementById('help-modal').classList.remove('hidden');
}

function hideHelp() {
  document.getElementById('help-modal').classList.add('hidden');
}

function showToast(message) {
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toast-message');
  
  toastMessage.textContent = message;
  toast.classList.remove('hidden');
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.classList.add('hidden'), 300);
  }, 4000);
}

// ==================== EXPOSE FUNCTIONS TO WINDOW ====================
window.navigateTo = navigateTo;
window.validatePensionId = validatePensionId;
window.captureAndVerify = captureAndVerify;
window.stopCamera = stopCamera;
window.resetApp = resetApp;
window.showHelp = showHelp;
window.hideHelp = hideHelp;

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('pension-id').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') validatePensionId();
  });
  
  document.getElementById('landing-page').addEventListener('click', (e) => {
    if (e.target.closest('.start-btn') || e.target.closest('.landing-footer')) return;
    navigateTo('login-page');
  });
});

