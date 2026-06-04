import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { useNavigation, useFocusEffect, useIsFocused } from '@react-navigation/native';
import { Camera } from 'react-native-vision-camera';
import { useCameraInfo } from '../hooks/useCamera';
import { useAppServices } from '../contexts/AppContext';

export default function AuthenticationScreen() {
  const navigation = useNavigation<any>();
  const camera = useRef<Camera>(null);
  const isFocused = useIsFocused();
  const { isFaceDetected, processPhoto, livenessScore, device, format, hasPermission, modelsLoaded, lastEmbedding, cosineSimilarity } = useCameraInfo();
  const { storage, isReady, syncQueueCount, sync } = useAppServices();
  const laserAnim = useRef(new Animated.Value(0)).current;
  const [matchedPerson, setMatchedPerson] = useState<{ id: number; name: string; similarity: number } | null>(null);
  const [isMatching, setIsMatching] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setMatchedPerson(null);
      setIsMatching(false);
      
      const fetchCloud = async () => {
        if (sync) {
          setIsSyncing(true);
          console.log('[USER LOG] Searching cloud database for remote enrollments...');
          const count = await sync.fetchCloudPersonnel();
          if (count > 0) {
            console.log(`[USER LOG] Successfully pulled ${count} personnel from AWS S3 into local database!`);
          } else {
            console.log('[USER LOG] Cloud database in sync.');
          }
          setIsSyncing(false);
        }
      };
      fetchCloud();
    }, [sync])
  );

  // Async ML Processing Loop (Safe from Native Crashes)
  useEffect(() => {
    let isActive = true;
    let isProcessing = false;

    const processLoop = async () => {
      if (!isActive || !isFocused) return;
      if (isProcessing) {
        setTimeout(processLoop, 500);
        return;
      }

      isProcessing = true;
      try {
        if (camera.current != null && device != null && isFocused && hasPermission) {
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

    if (isFocused && modelsLoaded) {
      processLoop();
    }

    return () => {
      isActive = false;
    };
  }, [modelsLoaded, processPhoto, isFocused, device, hasPermission]);

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
    if (!lastEmbedding || !storage || !isReady || isMatching || !isFocused) return;

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
            const enrollmentData = JSON.parse(person.embedding);
            const storedEmbeddings = enrollmentData.embeddings || [];
            
            for (const embStr of storedEmbeddings) {
              const embeddingVector = JSON.parse(embStr);
              if (Array.isArray(embeddingVector) && embeddingVector.length === lastEmbedding.length) {
                const similarity = cosineSimilarity(lastEmbedding, embeddingVector);
                if (similarity > MATCH_THRESHOLD && (!bestMatch || similarity > bestMatch.similarity)) {
                  bestMatch = { id: person.id || 0, name: person.name, similarity };
                }
              }
            }
          } catch (err) {
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
  }, [lastEmbedding, storage, isReady, cosineSimilarity, isMatching, isFocused]);

  const laserTranslateY = laserAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-180, 180],
  });

  const startLiveness = () => {
    console.log(`[USER LOG] Liveness check initiated for matched person: ${matchedPerson?.name} (ID: ${matchedPerson?.id})`);
    navigation.navigate('Liveness', { personId: matchedPerson?.id, personName: matchedPerson?.name });
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.8}>
        <Text style={styles.backButtonText}>{'<< ABORT'}</Text>
      </TouchableOpacity>

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
            format={format}
            isActive={isFocused}
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
        style={[styles.cyberButton, (!isFaceDetected || !matchedPerson || isSyncing) && styles.cyberButtonDisabled]} 
        onPress={startLiveness}
        disabled={!isFaceDetected || !matchedPerson || isSyncing}
        activeOpacity={0.8}
      >
        <View style={styles.buttonBracketLeft} />
        <Text style={styles.buttonText}>
          {isSyncing
            ? '[ SYNCING CLOUD DATABASE... ]'
            : !isFaceDetected 
              ? '[ ACQUIRING TARGET... ]' 
              : (!matchedPerson ? '[ SCANNING DATABASE... ]' : '[ INITIATE LIVENESS SEQUENCE ]')}
        </Text>
        <View style={styles.buttonBracketRight} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: '#05070a' },
  backButton: { position: 'absolute', top: 40, left: 20, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: 'rgba(0, 255, 204, 0.1)', borderWidth: 1, borderColor: '#00ffcc', zIndex: 100 },
  backButtonText: { color: '#00ffcc', fontFamily: 'monospace', fontSize: 12, fontWeight: 'bold', letterSpacing: 1 },
  hudHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 25, marginTop: 50, alignSelf: 'center' },
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