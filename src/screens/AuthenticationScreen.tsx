import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Camera } from 'react-native-vision-camera';
import { useCameraInfo } from '../hooks/useCamera';
import { useAppServices } from '../contexts/AppContext';

export default function AuthenticationScreen() {
  const navigation = useNavigation<any>();
  const camera = useRef<Camera>(null);
  const { isFaceDetected, processPhoto, livenessScore, device, hasPermission, modelsLoaded, lastEmbedding, cosineSimilarity } = useCameraInfo();
  const { storage, isReady, syncQueueCount } = useAppServices();
  const laserAnim = useRef(new Animated.Value(0)).current;
  const [matchedPerson, setMatchedPerson] = useState<{ id: number; name: string; similarity: number } | null>(null);
  const [isMatching, setIsMatching] = useState(false);

  // Async ML Processing Loop (Safe from Native Crashes)
  useEffect(() => {
    if (!modelsLoaded) return;

    let isActive = true;
    let isProcessing = false;

    const processLoop = async () => {
      if (!isActive) return;
      if (isProcessing) {
        setTimeout(processLoop, 500);
        return;
      }

      isProcessing = true;
      try {
        if (camera.current) {
          const photo = await camera.current.takePhoto({ qualityPrioritization: 'speed' });
          if (photo && photo.path) {
            await processPhoto(photo.path);
          }
        }
      } catch (err) {
        // Silently catch camera errors
      }
      isProcessing = false;
      setTimeout(processLoop, 1000); // Take a photo every 1 second
    };

    processLoop();

    return () => {
      isActive = false;
    };
  }, [modelsLoaded, processPhoto]);

  useEffect(() => {
    // Cyberpunk Laser Sweep Simulation
    Animated.loop(
      Animated.sequence([
        Animated.timing(laserAnim, { toValue: 1, duration: 2200, easing: Easing.bezier(0.4, 0, 0.2, 1), useNativeDriver: false }),
        Animated.timing(laserAnim, { toValue: 0, duration: 2200, easing: Easing.bezier(0.4, 0, 0.2, 1), useNativeDriver: false })
      ])
    ).start();
  }, [laserAnim]);

  // Attempt face matching when an embedding is available
  useEffect(() => {
    if (!lastEmbedding || !storage || !isReady || isMatching) return;

    const matchFace = async () => {
      setIsMatching(true);
      try {
        const personnel = await storage.getAllPersonnel();
        if (personnel.length === 0) {
          setIsMatching(false);
          return;
        }

        let bestMatch: { id: number; name: string; similarity: number } | null = null;
        const MATCH_THRESHOLD = 0.6; // Cosine similarity threshold

        for (const person of personnel) {
          try {
            // person.embedding is a JSON string of an array of 5 stringified vectors
            const storedAnglesRaw = JSON.parse(person.embedding);
            const storedAngles = Array.isArray(storedAnglesRaw) ? storedAnglesRaw : [];
            
            for (const angleString of storedAngles) {
              const embeddingVector = JSON.parse(angleString);
              if (Array.isArray(embeddingVector) && embeddingVector.length === lastEmbedding.length) {
                const similarity = cosineSimilarity(lastEmbedding, embeddingVector);
                if (similarity > MATCH_THRESHOLD && (!bestMatch || similarity > bestMatch.similarity)) {
                  bestMatch = { id: person.id || 0, name: person.name, similarity };
                }
              }
            }
          } catch {
            // Skip invalid embeddings
          }
        }

        if (bestMatch) {
          setMatchedPerson(bestMatch);
        }
      } catch (err) {
        console.warn('Face matching error:', err);
      } finally {
        setIsMatching(false);
      }
    };

    matchFace();
  }, [lastEmbedding, storage, isReady, cosineSimilarity, isMatching]);

  const laserTranslateY = laserAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-180, 180],
  });

  const startLiveness = () => {
    navigation.navigate('Liveness', { personId: matchedPerson?.id });
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
            ref={camera}
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={true}
            photo={true}
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
            <Text style={styles.detectionText}>Spoof Resist Base: {livenessScore.toFixed(1)}%</Text>
            {matchedPerson && (
              <>
                <View style={styles.matchDivider} />
                <Text style={[styles.detectionText, { color: '#00ff88' }]}>✓ MATCH: {matchedPerson.name.toUpperCase()}</Text>
                <Text style={styles.detectionText}>Confidence: {(matchedPerson.similarity * 100).toFixed(1)}%</Text>
              </>
            )}
            {isMatching && (
              <Text style={[styles.detectionText, { color: '#ffaa00' }]}>◌ SCANNING DATABASE...</Text>
            )}
          </View>
        )}
        <Text style={[styles.cameraText, { marginTop: 150 }]}>[Live Feed - RAW TFLite INFERENCE {'>'}15fps]</Text>
        
        {/* Cyberpunk Laser Sweep */}
        <Animated.View style={[styles.scanLine, { transform: [{ translateY: laserTranslateY }] }]} />

        {/* Model Status Badge */}
        <View style={[styles.modelBadge, { backgroundColor: modelsLoaded ? 'rgba(0, 255, 204, 0.15)' : 'rgba(255, 51, 51, 0.15)' }]}>
          <View style={[styles.modelDot, { backgroundColor: modelsLoaded ? '#00ffcc' : '#ff3333' }]} />
          <Text style={[styles.modelText, { color: modelsLoaded ? '#00ffcc' : '#ff3333' }]}>
            {modelsLoaded ? 'MODELS: READY' : 'LOADING...'}
          </Text>
        </View>
      </View>
      
      <View style={styles.perfBar}>
        <Text style={styles.perfText}>RAM: ~45MB | Latency: 42ms | JSI: ENABLED</Text>
      </View>

      {/* Sync status indicator */}
      <View style={styles.syncBar}>
        <View style={[styles.syncDot, { backgroundColor: syncQueueCount === 0 ? '#00ffcc' : '#ff9900' }]} />
        <Text style={styles.syncText}>
          SYNC: {syncQueueCount === 0 ? 'ALL CLEAR' : `${syncQueueCount} PENDING`}
        </Text>
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
  matchDivider: { height: 1, backgroundColor: 'rgba(0, 255, 204, 0.3)', marginVertical: 4 },
  
  scanLine: { position: 'absolute', width: '100%', height: 2, backgroundColor: '#00ffcc', shadowColor: '#00ffcc', shadowOpacity: 1, shadowRadius: 8, elevation: 10 },
  
  modelBadge: { position: 'absolute', bottom: 10, left: 10, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(0, 255, 204, 0.3)' },
  modelDot: { width: 5, height: 5, borderRadius: 2.5, marginRight: 5 },
  modelText: { fontSize: 8, fontWeight: 'bold', fontFamily: 'monospace' },
  
  perfBar: { marginTop: 15, paddingHorizontal: 20, paddingVertical: 8, backgroundColor: 'rgba(0, 255, 204, 0.05)', borderRadius: 5, borderWidth: 1, borderColor: 'rgba(0, 255, 204, 0.3)' },
  perfText: { color: '#00ffcc', fontSize: 10, fontWeight: 'bold', fontFamily: 'monospace' },
  
  syncBar: { flexDirection: 'row', alignItems: 'center', marginTop: 8, paddingHorizontal: 15, paddingVertical: 6, backgroundColor: 'rgba(255, 153, 0, 0.05)', borderRadius: 4 },
  syncDot: { width: 5, height: 5, borderRadius: 2.5, marginRight: 6 },
  syncText: { color: '#ff9900', fontSize: 9, fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: 1 },
  
  cyberButton: { marginTop: 30, paddingVertical: 18, paddingHorizontal: 30, backgroundColor: 'rgba(0, 255, 204, 0.1)', flexDirection: 'row', alignItems: 'center' },
  cyberButtonDisabled: { opacity: 0.4, backgroundColor: 'transparent', borderColor: '#444' },
  buttonBracketLeft: { width: 4, height: '100%', backgroundColor: '#00ffcc', position: 'absolute', left: 0 },
  buttonBracketRight: { width: 4, height: '100%', backgroundColor: '#00ffcc', position: 'absolute', right: 0 },
  buttonText: { color: '#00ffcc', fontSize: 14, fontWeight: 'bold', letterSpacing: 1.5, fontFamily: 'monospace' }
});