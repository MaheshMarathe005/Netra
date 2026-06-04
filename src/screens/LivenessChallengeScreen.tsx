import React, { useEffect, useState, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Animated, Easing, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute, useFocusEffect, useIsFocused } from '@react-navigation/native';
import { useCallback } from 'react';
import { Camera } from 'react-native-vision-camera';
import { useCameraInfo } from '../hooks/useCamera';

const LIVENESS_THRESHOLD = 50; // Minimum liveness score to pass
const CHALLENGE_DURATION_SEC = 5;

export default function LivenessChallengeScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const isFocused = useIsFocused();
  const { device, format, hasPermission, livenessScore, isFaceDetected, processPhoto, modelsLoaded } = useCameraInfo();
  const camera = useRef<Camera>(null);
  const [countdown, setCountdown] = useState(CHALLENGE_DURATION_SEC);
  const [scores, setScores] = useState<number[]>([]);
  const reticleAnim = useRef(new Animated.Value(1)).current;
  const meshOpacity = useRef(new Animated.Value(0.3)).current;
  const statusPulse = useRef(new Animated.Value(0)).current;
  // Face Landmarks simulation for UI coolness
  const points = useMemo(() => [
    { top: '30%', left: '42%' }, { top: '30%', left: '58%' }, // Eyes
    { top: '40%', left: '50%' }, // Nose bridge
    { top: '48%', left: '50%' }, // Nose tip
    { top: '55%', left: '40%' }, { top: '58%', left: '50%' }, { top: '55%', left: '60%' }, // Mouth
    { top: '23%', left: '50%' }, // Forehead
    { top: '68%', left: '50%' }, // Chin
    { top: '42%', left: '32%' }, { top: '42%', left: '68%' }, // Cheeks
  ], []);

  const hasNavigated = useRef(false);

  // Reset state on focus
  useFocusEffect(
    useCallback(() => {
      setCountdown(CHALLENGE_DURATION_SEC);
      setScores([]);
      hasNavigated.current = false;
    }, [])
  );

  // Collect liveness scores during the challenge
  useEffect(() => {
    let isActive = true;
    let isProcessing = false;

    const processLoop = async () => {
      if (!isActive || !isFocused) return;
      if (isProcessing) {
        setTimeout(processLoop, 200);
        return;
      }

      isProcessing = true;
      try {
        if (camera.current != null && device != null && isFocused && hasPermission) {
          const photo = await camera.current.takePhoto({ qualityPrioritization: 'speed' });
          if (photo && photo.path) {
            // Note: processPhoto sets the livenessScore in useCameraInfo state
            await processPhoto(photo.path);
          }
        }
      } catch (err: any) {
        if (err && err.message && (err.message.includes('Camera is closed') || err.message.includes('Failed to submit capture request'))) {
          // Normal during navigation, ignore
        } else {
          console.warn('Liveness camera error:', err);
        }
      }
      isProcessing = false;
      setTimeout(processLoop, 500); // Take a photo every 500ms for liveness
    };

    if (isFocused && modelsLoaded) {
      processLoop();
    }

    return () => {
      isActive = false;
    };
  }, [processPhoto, isFocused, modelsLoaded, device, hasPermission]);

  useEffect(() => {
    if (livenessScore > 0 && countdown > 0) {
      setScores(prev => [...prev, livenessScore]);
    }
  }, [livenessScore, countdown]);

  useEffect(() => {
    // Breathing reticle scale
    Animated.loop(
      Animated.sequence([
        Animated.timing(reticleAnim, { toValue: 1.05, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(reticleAnim, { toValue: 0.95, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: false })
      ])
    ).start();

    // Pulsing mesh points
    Animated.loop(
      Animated.sequence([
        Animated.timing(meshOpacity, { toValue: 0.9, duration: 800, useNativeDriver: false }),
        Animated.timing(meshOpacity, { toValue: 0.3, duration: 800, useNativeDriver: false })
      ])
    ).start();

    // Status bar pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(statusPulse, { toValue: 1, duration: 600, useNativeDriver: false }),
        Animated.timing(statusPulse, { toValue: 0, duration: 600, useNativeDriver: false })
      ])
    ).start();

    if (!isFocused) return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [reticleAnim, meshOpacity, statusPulse, isFocused]);

  // Handle side-effects (navigation) strictly outside the render/state-update phase
  useEffect(() => {
    if (countdown === 0 && !hasNavigated.current) {
      hasNavigated.current = true;
      // Evaluate liveness based on collected scores
      const avgScore = scores.length > 0
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : livenessScore; // fallback to last score if no collection
      
      const isLive = avgScore >= LIVENESS_THRESHOLD;
      const spoofProbability = Math.max(0, Math.min(1, 1 - (avgScore / 100)));
      
      // Stop the process loop
      setCountdown(-1);
      
      navigation.navigate('Result', { 
        success: isLive, 
        confidence: parseFloat(avgScore.toFixed(1)), 
        spoofScore: parseFloat(spoofProbability.toFixed(3)),
        livenessMethod: 'MiniFASNet + BlazeFace',
        personId: route.params?.personId,
        personName: route.params?.personName
      });
    }
  }, [countdown, navigation, scores, livenessScore, route.params]);

  const statusColor = statusPulse.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255, 153, 0, 0.3)', 'rgba(255, 153, 0, 0.8)'],
  });

  const currentChallenge = isFaceDetected ? '[ BLINK YOUR EYES ]' : '[ POSITION FACE IN FRAME ]';

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.8}>
        <Text style={styles.backButtonText}>{'<< ABORT'}</Text>
      </TouchableOpacity>

      <View style={styles.hudHeader}>
        <Animated.View style={[styles.pulseOrange, { backgroundColor: statusColor }]} />
        <Text style={styles.header}>ACTIVE LIVENESS PROBE</Text>
      </View>
      
      <View style={styles.scannerViewport}>
        {device && hasPermission && (
          <Camera
            ref={camera}
            style={StyleSheet.absoluteFill}
            device={device}
            format={format}
            isActive={isFocused}
            photo={true}
          />
        )}
        {/* Pulsing Target Overlay */}
        <Animated.View style={[styles.targetOverlay, { transform: [{ scale: reticleAnim }] }]}>
           <View style={styles.crosshairVertical} />
           <View style={styles.crosshairHorizontal} />
           <Text style={styles.challengePrompt}>{currentChallenge}</Text>
        </Animated.View>

        {/* 468-point FaceMesh Simulation Grid */}
        {points.map((p, idx) => (
          <Animated.View key={idx} style={[styles.landmarkPoint, { top: p.top as any, left: p.left as any, opacity: meshOpacity }]} />
        ))}

        {/* Live score indicator */}
        {isFaceDetected && (
          <View style={styles.liveScoreBadge}>
            <Text style={styles.liveScoreText}>LIVE: {livenessScore.toFixed(1)}%</Text>
          </View>
        )}
      </View>

      <Text style={styles.timer}>{countdown}s</Text>

      {/* Real-time status bar */}
      <View style={styles.statusBar}>
        <View style={[styles.statusIndicator, { backgroundColor: isFaceDetected ? '#00ffcc' : '#ff3333' }]} />
        <Text style={[styles.statusText, { color: isFaceDetected ? '#00ffcc' : '#ff3333' }]}>
          {isFaceDetected ? 'FACE LOCKED' : 'NO FACE DETECTED'}
        </Text>
        <Text style={styles.statusText}> | </Text>
        <Text style={styles.statusText}>Samples: {scores.length}</Text>
      </View>
      
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#05070a' },
  backButton: { position: 'absolute', top: 40, left: 20, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: 'rgba(255, 153, 0, 0.1)', borderWidth: 1, borderColor: '#ff9900', zIndex: 100 },
  backButtonText: { color: '#ff9900', fontFamily: 'monospace', fontSize: 12, fontWeight: 'bold', letterSpacing: 1 },
  hudHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 40, marginTop: 50, alignSelf: 'center' },
  pulseOrange: { width: 10, height: 10, borderRadius: 5, marginRight: 10, shadowColor: '#ff9900', shadowRadius: 10, shadowOpacity: 1, elevation: 5 },
  header: { fontSize: 16, fontWeight: 'bold', color: '#ff9900', letterSpacing: 2, fontFamily: 'monospace' },
  
  scannerViewport: { width: 280, height: 350, borderWidth: 1, borderColor: 'rgba(255, 153, 0, 0.4)', borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0d14', position: 'relative', overflow: 'hidden' },
  targetOverlay: { width: 220, height: 220, borderRadius: 110, borderWidth: 2, borderColor: '#ff9900', justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255, 153, 0, 0.05)', borderStyle: 'dashed' },
  crosshairVertical: { position: 'absolute', width: 1, height: '120%', backgroundColor: 'rgba(255, 153, 0, 0.4)' },
  crosshairHorizontal: { position: 'absolute', height: 1, width: '120%', backgroundColor: 'rgba(255, 153, 0, 0.4)' },
  
  challengePrompt: { fontSize: 18, color: '#ff9900', fontWeight: 'bold', fontFamily: 'monospace', backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 10, paddingVertical: 4 },
  
  landmarkPoint: { position: 'absolute', width: 4, height: 4, borderRadius: 2, backgroundColor: '#00ffcc', shadowColor: '#00ffcc', shadowRadius: 4, shadowOpacity: 1 },
  
  liveScoreBadge: { position: 'absolute', bottom: 10, right: 10, backgroundColor: 'rgba(0, 255, 204, 0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, borderWidth: 1, borderColor: '#00ffcc' },
  liveScoreText: { color: '#00ffcc', fontSize: 10, fontWeight: 'bold', fontFamily: 'monospace' },
  
  timer: { fontSize: 50, color: '#ff9900', fontWeight: 'bold', marginTop: 30, fontFamily: 'monospace', textShadowColor: '#ff9900', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10 },
  
  statusBar: { flexDirection: 'row', alignItems: 'center', marginTop: 15, backgroundColor: 'rgba(255, 153, 0, 0.08)', paddingHorizontal: 15, paddingVertical: 6, borderRadius: 4 },
  statusIndicator: { width: 6, height: 6, borderRadius: 3, marginRight: 8 },
  statusText: { color: '#ff9900', fontSize: 10, fontFamily: 'monospace', fontWeight: 'bold' },
  
  statsContainer: { marginTop: 25, alignItems: 'center', backgroundColor: 'rgba(255, 153, 0, 0.05)', padding: 15, borderRadius: 5, borderWidth: 1, borderLeftColor: '#ff9900', borderRightColor: '#ff9900', borderTopColor: 'transparent', borderBottomColor: 'transparent' },
  subtext: { color: 'rgba(255, 153, 0, 0.8)', fontSize: 12, fontStyle: 'italic', marginBottom: 12, fontFamily: 'monospace' },
  metricText: { color: '#00ffcc', fontSize: 10, fontFamily: 'monospace', marginVertical: 3, letterSpacing: 1 }
});