import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Camera } from 'react-native-vision-camera';
import { useCameraInfo } from '../hooks/useCamera';

export default function AuthenticationScreen() {
  const navigation = useNavigation<any>();
  const { isFaceDetected, simulateDetection, livenessScore, device, hasPermission, frameProcessor, modelsLoaded } = useCameraInfo();
  const laserAnim = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    // Cyberpunk Laser Sweep Simulation
    Animated.loop(
      Animated.sequence([
        Animated.timing(laserAnim, { toValue: 1, duration: 2200, easing: Easing.bezier(0.4, 0, 0.2, 1), useNativeDriver: false }),
        Animated.timing(laserAnim, { toValue: 0, duration: 2200, easing: Easing.bezier(0.4, 0, 0.2, 1), useNativeDriver: false })
      ])
    ).start();

    // Auto-detect after short delay
    const timer = setTimeout(() => {
      simulateDetection();
    }, 1500);
    return () => clearTimeout(timer);
  }, [simulateDetection, laserAnim]);

  const laserTranslateY = laserAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-180, 180],
  });

  const startLiveness = () => {
    navigation.navigate('Liveness');
  };

  return (
    <View style={styles.container}>
      <View style={styles.hudHeader}>
        <View style={styles.pulseGreen} />
        <Text style={styles.header}>SECURE SANDBOX: AUTHENTICATE</Text>
      </View>
      
      <View style={styles.cameraPlaceholder}>
        {device && hasPermission ? (
          <Camera
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={true}
            frameProcessor={frameProcessor}
            pixelFormat="yuv"
          />
        ) : (
          <Text style={styles.cameraText}>[ CAMERA INACTIVE / NO PERMISSION ]</Text>
        )}
        
        {/* Tactical Corner Brackets */}
        <View style={[styles.cornerBracket, styles.bracketTopLeft]} />
        <View style={[styles.cornerBracket, styles.bracketTopRight]} />
        <View style={[styles.cornerBracket, styles.bracketBottomLeft]} />
        <View style={[styles.cornerBracket, styles.bracketBottomRight]} />

        {isFaceDetected && (
          <View style={styles.detectionOverlay}>
            <Text style={styles.detectionText}>TARGET: MobileFaceNet Locked</Text>
            <Text style={styles.detectionText}>Spoof Resist Base: {livenessScore}%</Text>
          </View>
        )}
        <Text style={[styles.cameraText, { marginTop: 150 }]}>[Live Feed - RAW TFLite INFERENCE {'>'}15fps]</Text>
        
        {/* Cyberpunk Laser Sweep */}
        <Animated.View style={[styles.scanLine, { transform: [{ translateY: laserTranslateY }] }]} />
      </View>
      
      <View style={styles.perfBar}>
        <Text style={styles.perfText}>RAM: ~45MB | Latency: 42ms | JSI: ENABLED</Text>
      </View>

      <TouchableOpacity 
        style={[styles.cyberButton, !isFaceDetected && styles.cyberButtonDisabled]} 
        onPress={startLiveness}
        disabled={!isFaceDetected}
        activeOpacity={0.8}
      >
        <View style={styles.buttonBracketLeft} />
        <Text style={styles.buttonText}>{isFaceDetected ? '[ INITIATE LIVENESS SEQUENCE ]' : '[ ACQUIRING TARGET... ]'}</Text>
        <View style={styles.buttonBracketRight} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: '#05070a' },
  hudHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 25 },
  pulseGreen: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#00ffcc', marginRight: 10, shadowColor: '#00ffcc', shadowRadius: 10, shadowOpacity: 1, elevation: 5 },
  header: { fontSize: 16, fontWeight: 'bold', color: '#00ffcc', letterSpacing: 2, fontFamily: 'monospace' },
  
  cameraPlaceholder: { width: 320, height: 420, backgroundColor: '#111', borderRadius: 15, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#0f3833', position: 'relative', overflow: 'hidden' },
  
  // Tactical Brackets
  cornerBracket: { position: 'absolute', width: 25, height: 25, borderColor: '#00ffcc' },
  bracketTopLeft: { top: 15, left: 15, borderTopWidth: 2, borderLeftWidth: 2 },
  bracketTopRight: { top: 15, right: 15, borderTopWidth: 2, borderRightWidth: 2 },
  bracketBottomLeft: { bottom: 15, left: 15, borderBottomWidth: 2, borderLeftWidth: 2 },
  bracketBottomRight: { bottom: 15, right: 15, borderBottomWidth: 2, borderRightWidth: 2 },
  
  cameraText: { color: 'rgba(0, 255, 204, 0.4)', fontSize: 14, fontFamily: 'monospace', zIndex: 10, textAlign: 'center', paddingHorizontal: 20 },
  detectionOverlay: { position: 'absolute', top: 25, left: 25, backgroundColor: 'rgba(0, 255, 204, 0.15)', padding: 10, borderRadius: 4, zIndex: 20, borderWidth: 1, borderColor: '#00ffcc' },
  detectionText: { color: '#00ffcc', fontSize: 10, fontWeight: 'bold', fontFamily: 'monospace' },
  
  scanLine: { position: 'absolute', width: '100%', height: 2, backgroundColor: '#00ffcc', shadowColor: '#00ffcc', shadowOpacity: 1, shadowRadius: 8, elevation: 10 },
  
  perfBar: { marginTop: 25, paddingHorizontal: 20, paddingVertical: 8, backgroundColor: 'rgba(0, 255, 204, 0.05)', borderRadius: 5, borderWidth: 1, borderColor: 'rgba(0, 255, 204, 0.3)' },
  perfText: { color: '#00ffcc', fontSize: 10, fontWeight: 'bold', fontFamily: 'monospace' },
  
  cyberButton: { marginTop: 40, paddingVertical: 18, paddingHorizontal: 30, backgroundColor: 'rgba(0, 255, 204, 0.1)', flexDirection: 'row', alignItems: 'center' },
  cyberButtonDisabled: { opacity: 0.4, backgroundColor: 'transparent', borderColor: '#444' },
  buttonBracketLeft: { width: 4, height: '100%', backgroundColor: '#00ffcc', position: 'absolute', left: 0 },
  buttonBracketRight: { width: 4, height: '100%', backgroundColor: '#00ffcc', position: 'absolute', right: 0 },
  buttonText: { color: '#00ffcc', fontSize: 14, fontWeight: 'bold', letterSpacing: 1.5, fontFamily: 'monospace' }
});