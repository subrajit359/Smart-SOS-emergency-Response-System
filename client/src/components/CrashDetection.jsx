import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

const CRASH_G_THRESHOLD = 20;
const CRASH_G_THRESHOLD_WITH_GRAVITY = 28;
const CONSECUTIVE_HITS_REQUIRED = 3;
const CRASH_ROTATION_THRESHOLD = 100;
const STILLNESS_DURATION_MS = 5000;
const COUNTDOWN_SECONDS = 18;
const STILLNESS_THRESHOLD = 1.5;
const MOVEMENT_CANCEL_THRESHOLD = 2.5;

export default function CrashDetection({ onSosTriggered }) {
  const { authFetch } = useAuth();
  const [showPopup, setShowPopup] = useState(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [crashStatus, setCrashStatus] = useState('monitoring');
  const [cancelledByMotion, setCancelledByMotion] = useState(false);

  const crashDetectedRef = useRef(false);
  const stillnessTimerRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const lastMotionRef = useRef(Date.now());
  const permissionGrantedRef = useRef(false);
  const showPopupRef = useRef(false);
  const consecutiveHitsRef = useRef(0);

  showPopupRef.current = showPopup;

  const cancelAll = useCallback((byMotion = false) => {
    setShowPopup(false);
    setCountdown(COUNTDOWN_SECONDS);
    crashDetectedRef.current = false;
    setCrashStatus('monitoring');
    clearTimeout(stillnessTimerRef.current);
    clearInterval(countdownIntervalRef.current);
    if (byMotion) {
      setCancelledByMotion(true);
      setTimeout(() => setCancelledByMotion(false), 3000);
    }
  }, []);

  const triggerAutoSOS = useCallback(async () => {
    cancelAll();
    setCrashStatus('triggered');
    if (onSosTriggered) onSosTriggered('auto');
    try {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const { latitude, longitude } = pos.coords;
        const res = await authFetch('/api/sos', {
          method: 'POST',
          body: JSON.stringify({ latitude, longitude }),
        });
        if (!res.ok) {
          const data = await res.json();
          console.error('Auto SOS error:', data.error);
        }
      }, (err) => {
        console.error('Geolocation error during auto SOS:', err);
      });
    } catch (err) {
      console.error('Auto SOS fetch error:', err);
    }
  }, [authFetch, cancelAll, onSosTriggered]);

  const cancelAllRef = useRef(cancelAll);
  cancelAllRef.current = cancelAll;

  const startStillnessMonitor = useCallback(() => {
    if (crashDetectedRef.current) return;
    crashDetectedRef.current = true;

    stillnessTimerRef.current = setTimeout(() => {
      if (!crashDetectedRef.current) return;
      setShowPopup(true);
      setCountdown(COUNTDOWN_SECONDS);

      let remaining = COUNTDOWN_SECONDS;
      countdownIntervalRef.current = setInterval(() => {
        remaining--;
        setCountdown(remaining);
        if (remaining <= 0) {
          clearInterval(countdownIntervalRef.current);
          triggerAutoSOS();
        }
      }, 1000);
    }, STILLNESS_DURATION_MS);
  }, [triggerAutoSOS]);

  const handleMotion = useCallback((event) => {
    const netAcc = event.acceleration;
    const hasNetAcc = netAcc && netAcc.x !== null;
    const acc = hasNetAcc ? netAcc : event.accelerationIncludingGravity;
    const rot = event.rotationRate;

    if (!acc) return;

    const gForce = Math.sqrt(
      (acc.x || 0) ** 2 + (acc.y || 0) ** 2 + (acc.z || 0) ** 2
    );

    const rotTotal = rot
      ? Math.abs(rot.alpha || 0) + Math.abs(rot.beta || 0) + Math.abs(rot.gamma || 0)
      : 0;

    const threshold = hasNetAcc ? CRASH_G_THRESHOLD : CRASH_G_THRESHOLD_WITH_GRAVITY;

    if (gForce > threshold || rotTotal > CRASH_ROTATION_THRESHOLD) {
      consecutiveHitsRef.current += 1;
      if (consecutiveHitsRef.current >= CONSECUTIVE_HITS_REQUIRED && !crashDetectedRef.current) {
        consecutiveHitsRef.current = 0;
        startStillnessMonitor();
      }
    } else {
      consecutiveHitsRef.current = 0;
    }

    const restBaseline = hasNetAcc ? 0 : 9.8;
    const movement = Math.abs(gForce - restBaseline);

    if (crashDetectedRef.current && !showPopupRef.current) {
      if (movement > STILLNESS_THRESHOLD) {
        clearTimeout(stillnessTimerRef.current);
        crashDetectedRef.current = false;
      }
    }

    if (showPopupRef.current) {
      if (movement > MOVEMENT_CANCEL_THRESHOLD) {
        cancelAllRef.current(true);
      }
    }

    lastMotionRef.current = Date.now();
  }, [startStillnessMonitor]);

  useEffect(() => {
    const requestPermission = async () => {
      if (typeof DeviceMotionEvent !== 'undefined' &&
          typeof DeviceMotionEvent.requestPermission === 'function') {
        try {
          const result = await DeviceMotionEvent.requestPermission();
          if (result === 'granted') {
            permissionGrantedRef.current = true;
            window.addEventListener('devicemotion', handleMotion);
          }
        } catch {
          console.log('DeviceMotion permission denied');
        }
      } else if (typeof DeviceMotionEvent !== 'undefined') {
        permissionGrantedRef.current = true;
        window.addEventListener('devicemotion', handleMotion);
      }
    };

    requestPermission();

    return () => {
      window.removeEventListener('devicemotion', handleMotion);
      clearTimeout(stillnessTimerRef.current);
      clearInterval(countdownIntervalRef.current);
    };
  }, [handleMotion]);

  if (cancelledByMotion) {
    return (
      <div style={{
        position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
        background: '#1b5e20', color: 'white', borderRadius: '12px',
        padding: '12px 24px', fontWeight: 600, fontSize: '0.95rem',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)', zIndex: 2000,
        display: 'flex', alignItems: 'center', gap: '8px'
      }}>
        <i className="bi bi-person-walking"></i> Movement detected — SOS alert cancelled
      </div>
    );
  }

  if (!showPopup) return null;

  return (
    <div className="crash-overlay" role="alertdialog" aria-modal="true" aria-labelledby="crash-title">
      <div style={{ maxWidth: '420px', width: '100%' }}>
        <div style={{ fontSize: '4rem', marginBottom: '16px', textAlign: 'center' }}>⚠️</div>
        <h1 id="crash-title" style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: '12px', textAlign: 'center' }}>
          Are You Okay?
        </h1>
        <p style={{ fontSize: '1rem', opacity: 0.9, marginBottom: '28px', textAlign: 'center', lineHeight: 1.6 }}>
          A possible crash was detected. SOS will be automatically sent if you don't respond.
        </p>

        <div className="crash-countdown mx-auto mb-4">
          {countdown}
        </div>

        <p style={{ fontSize: '0.85rem', opacity: 0.75, textAlign: 'center', marginBottom: '8px' }}>
          Sending SOS alert in {countdown} second{countdown !== 1 ? 's' : ''}...
        </p>
        <p style={{ fontSize: '0.8rem', opacity: 0.6, textAlign: 'center', marginBottom: '24px' }}>
          <i className="bi bi-phone-vibrate me-1"></i> Moving your phone will also cancel this alert
        </p>

        <div className="d-flex flex-column gap-3">
          <button
            className="btn btn-light fw-bold py-3"
            style={{ fontSize: '1.1rem', borderRadius: '12px', color: '#b71c1c' }}
            onClick={() => cancelAll(false)}
          >
            <i className="bi bi-check-circle me-2"></i> I'm Okay — Cancel Alert
          </button>
          <button
            className="btn fw-bold py-3"
            style={{ fontSize: '1rem', borderRadius: '12px', background: 'rgba(255,255,255,0.15)', color: 'white', border: '2px solid rgba(255,255,255,0.4)' }}
            onClick={triggerAutoSOS}
          >
            <i className="bi bi-send me-2"></i> Send SOS Now
          </button>
        </div>
      </div>
    </div>
  );
}
