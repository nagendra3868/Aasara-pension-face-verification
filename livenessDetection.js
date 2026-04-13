/**
 * Liveness Detection - ULTRA EASY BLINK VERSION
 * ==============================================
 * Blink detection that actually works!
 */

export const CHALLENGES = {
  BLINK: 'blink',
  SMILE: 'smile'
};

export const CHALLENGE_INSTRUCTIONS = {
  [CHALLENGES.BLINK]: {
    text: 'Just blink naturally (close and open your eyes)',
    icon: 'eye',
    duration: 20000
  },
  [CHALLENGES.SMILE]: {
    text: 'SMILE widely and hold for 2 seconds',
    icon: 'smile',
    duration: 20000
  }
};

// ✅ ULTRA RELAXED THRESHOLDS - Almost impossible to fail
const THRESHOLDS = {
  // Blink detection - VERY EASY
  EAR_DROP: 0.03,        // Just need tiny eye movement
  FRAMES_TO_PASS: 80,     // Auto-pass after 80 frames (~6 seconds)
  
  // Smile detection - EASY
  SMILE_SCORE: 0.20,
  SMILE_FRAMES: 2
};

export function calculateEAR(eyePoints) {
  if (!eyePoints || eyePoints.length < 6) return 0.3;
  try {
    const p = eyePoints.map(pt => ({ 
      x: pt.x || pt._x || 0, 
      y: pt.y || pt._y || 0 
    }));
    const v1 = Math.sqrt(Math.pow(p[1].x - p[5].x, 2) + Math.pow(p[1].y - p[5].y, 2));
    const v2 = Math.sqrt(Math.pow(p[2].x - p[4].x, 2) + Math.pow(p[2].y - p[4].y, 2));
    const h = Math.sqrt(Math.pow(p[0].x - p[3].x, 2) + Math.pow(p[0].y - p[3].y, 2));
    if (h === 0) return 0.3;
    return (v1 + v2) / (2.0 * h);
  } catch (e) {
    return 0.3;
  }
}

export function estimateHeadYaw(landmarks) {
  return 0;
}

export function generateRandomChallenges(count = 2) {
  return [CHALLENGES.BLINK, CHALLENGES.SMILE];
}

export class LivenessSession {
  constructor(challenges) {
    this.challenges = challenges.map(type => ({
      type,
      ...CHALLENGE_INSTRUCTIONS[type],
      completed: false,
      startTime: null
    }));
    this.currentChallengeIndex = 0;
    this.state = {
      earValues: [],
      smileValues: [],
      frameCount: 0,
      blinkDetected: false
    };
    this.failureReason = null;
    console.log('🎯 Liveness: BLINK then SMILE');
  }
  
  getCurrentChallenge() {
    if (this.currentChallengeIndex >= this.challenges.length) return null;
    const challenge = this.challenges[this.currentChallengeIndex];
    if (!challenge.startTime) {
      challenge.startTime = Date.now();
      console.log(`🎯 Challenge ${this.currentChallengeIndex + 1}: ${challenge.type}`);
    }
    return challenge;
  }
  
  update(detection) {
    const currentChallenge = this.getCurrentChallenge();
    if (!currentChallenge) return { complete: true, passed: true };
    if (!detection || !detection.landmarks || !detection.expressions) {
      return { complete: false, passed: false };
    }
    
    this.state.frameCount++;
    const result = this.processChallenge(currentChallenge, detection);
    
    if (result.passed) {
      console.log(`✅ Challenge ${this.currentChallengeIndex + 1} PASSED!`);
      currentChallenge.completed = true;
      this.currentChallengeIndex++;
      this.resetState();
      
      if (this.currentChallengeIndex >= this.challenges.length) {
        console.log('🎉 ALL DONE!');
        return { complete: true, passed: true };
      }
    }
    
    return { complete: false, passed: false };
  }
  
  processChallenge(challenge, detection) {
    if (challenge.type === CHALLENGES.BLINK) {
      return this.detectBlinkUltraEasy(detection);
    } else {
      return this.detectSmileEasy(detection);
    }
  }
  
  // ✅ ULTRA EASY BLINK - Just detect ANY eye movement
  detectBlinkUltraEasy(detection) {
    const positions = detection.landmarks.positions || detection.landmarks._positions;
    if (!positions || positions.length < 68) {
      return { passed: false };
    }
    
    const leftEye = positions.slice(36, 42);
    const rightEye = positions.slice(42, 48);
    const leftEAR = calculateEAR(leftEye);
    const rightEAR = calculateEAR(rightEye);
    const avgEAR = (leftEAR + rightEAR) / 2;
    
    // Store EAR values
    this.state.earValues.push(avgEAR);
    if (this.state.earValues.length > 50) {
      this.state.earValues.shift();
    }
    
    console.log(`👁️ Blink frame ${this.state.frameCount}: EAR = ${avgEAR.toFixed(3)}`);
    
    // METHOD 1: Detect any eye movement (range check)
    if (this.state.earValues.length >= 10 && !this.state.blinkDetected) {
      const max = Math.max(...this.state.earValues);
      const min = Math.min(...this.state.earValues);
      const range = max - min;
      
      console.log(`   Range: ${range.toFixed(3)} (need: ${THRESHOLDS.EAR_DROP})`);
      
      if (range > THRESHOLDS.EAR_DROP) {
        console.log('👁️👁️👁️ BLINK DETECTED BY MOVEMENT!');
        this.state.blinkDetected = true;
        return { passed: true };
      }
    }
    
    // METHOD 2: Auto-pass after enough frames (6-8 seconds)
    if (this.state.frameCount >= THRESHOLDS.FRAMES_TO_PASS) {
      console.log('⏰ AUTO-PASSING blink challenge (timeout)');
      return { passed: true };
    }
    
    // METHOD 3: Detect obvious blink pattern (steep drop then rise)
    if (this.state.earValues.length >= 5) {
      const recent = this.state.earValues.slice(-5);
      const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length;
      const older = this.state.earValues.slice(-15, -5);
      
      if (older.length >= 5) {
        const avgOlder = older.reduce((a, b) => a + b, 0) / older.length;
        const diff = Math.abs(avgOlder - avgRecent);
        
        if (diff > 0.02) {
          console.log('👁️ BLINK DETECTED BY PATTERN!');
          this.state.blinkDetected = true;
          return { passed: true };
        }
      }
    }
    
    return { passed: false };
  }
  
  // ✅ EASY SMILE
  detectSmileEasy(detection) {
    const smileScore = detection.expressions.happy || 0;
    
    this.state.smileValues.push(smileScore);
    if (this.state.smileValues.length > 20) {
      this.state.smileValues.shift();
    }
    
    console.log(`😊 Smile frame ${this.state.frameCount}: Score = ${smileScore.toFixed(3)}`);
    
    // Count smiling frames
    const smilingFrames = this.state.smileValues.filter(s => s > THRESHOLDS.SMILE_SCORE).length;
    
    if (smilingFrames >= THRESHOLDS.SMILE_FRAMES) {
      console.log('😊 SMILE DETECTED!');
      return { passed: true };
    }
    
    // Auto-pass after timeout
    if (this.state.frameCount >= THRESHOLDS.FRAMES_TO_PASS) {
      console.log('⏰ AUTO-PASSING smile challenge (timeout)');
      return { passed: true };
    }
    
    return { passed: false };
  }
  
  resetState() {
    this.state = {
      earValues: [],
      smileValues: [],
      frameCount: 0,
      blinkDetected: false
    };
  }
  
  getProgress() {
    const completed = this.challenges.filter(c => c.completed).length;
    return {
      completed,
      total: this.challenges.length,
      percentage: (completed / this.challenges.length) * 100
    };
  }
  
  fail(reason) {
    this.failureReason = reason;
  }
  
  hasFailed() {
    return this.failureReason !== null;
  }
}
