import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Animated,
  Easing,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Camera } from 'react-native-vision-camera';
import { useCameraInfo } from '../hooks/useCamera';
import { useAppServices } from '../contexts/AppContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ANGLES = ['FRONT', 'LEFT', 'RIGHT', 'UP', 'DOWN'] as const;
type Angle = (typeof ANGLES)[number];

const ANGLE_INSTRUCTIONS: Record<Angle, string> = {
  FRONT: 'Look straight at the camera',
  LEFT: 'Turn your head slightly left',
  RIGHT: 'Turn your head slightly right',
  UP: 'Tilt your chin up slightly',
  DOWN: 'Tilt your chin down slightly',
};

type Phase = 'NAME_INPUT' | 'CAPTURING' | 'PROCESSING' | 'COMPLETE';

export default function EnrollmentScreen() {
  const navigation = useNavigation<any>();
  const { storage, isReady: servicesReady, error: appServicesError } = useAppServices();
  const camera = useRef<Camera>(null);
  const {
    device,
    hasPermission,
    isFaceDetected,
    livenessScore,
    modelsLoaded,
    lastEmbedding,
    processPhoto,
  } = useCameraInfo();

  // ── State ──────────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>('NAME_INPUT');
  const [name, setName] = useState('');
  const [currentStep, setCurrentStep] = useState(0);
  const [capturedEmbeddings, setCapturedEmbeddings] = useState<string[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);

  // Async ML Processing Loop (Safe from Native Crashes)
  useEffect(() => {
    if (phase !== 'CAPTURING' || !modelsLoaded) return;

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
  }, [phase, modelsLoaded, processPhoto]);

  // ── Animations ─────────────────────────────────────────────────────────────
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0.6)).current;
  const captureFlashAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const headerGlowAnim = useRef(new Animated.Value(0.4)).current;
  const inputBorderAnim = useRef(new Animated.Value(0)).current;

  // Laser sweep animation
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, {
          toValue: 1,
          duration: 2400,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
          useNativeDriver: false,
        }),
        Animated.timing(scanLineAnim, {
          toValue: 0,
          duration: 2400,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
          useNativeDriver: false,
        }),
      ]),
    ).start();
  }, [scanLineAnim]);

  // Pulse animation for status indicator
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.6,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ]),
    ).start();
  }, [pulseAnim]);

  // Header glow
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(headerGlowAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: false,
        }),
        Animated.timing(headerGlowAnim, {
          toValue: 0.4,
          duration: 2000,
          useNativeDriver: false,
        }),
      ]),
    ).start();
  }, [headerGlowAnim]);

  // Input border cycling
  useEffect(() => {
    if (phase === 'NAME_INPUT') {
      Animated.loop(
        Animated.timing(inputBorderAnim, {
          toValue: 1,
          duration: 3000,
          easing: Easing.linear,
          useNativeDriver: false,
        }),
      ).start();
    }
  }, [phase, inputBorderAnim]);

  // Update progress bar when step changes
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: currentStep / ANGLES.length,
      duration: 400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [currentStep, progressAnim]);

  // ── Derived values ─────────────────────────────────────────────────────────
  const scanTranslateY = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-200, 200],
  });

  const inputBorderColor = inputBorderAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['rgba(0,255,204,0.3)', 'rgba(0,255,204,0.8)', 'rgba(0,255,204,0.3)'],
  });

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleBeginEnrollment = useCallback(() => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert(
        '[ INPUT REQUIRED ]',
        'Personnel identifier cannot be empty. Enter a valid name to proceed.',
        [{ text: 'ACKNOWLEDGE', style: 'default' }],
      );
      return;
    }
    if (trimmedName.length < 2) {
      Alert.alert(
        '[ VALIDATION FAILURE ]',
        'Name must be at least 2 characters for positive ID.',
        [{ text: 'ACKNOWLEDGE', style: 'default' }],
      );
      return;
    }
    if (!device || !hasPermission) {
      Alert.alert(
        '[ SENSOR OFFLINE ]',
        'Camera device unavailable or permission denied. Grant camera access in system settings.',
        [{ text: 'ACKNOWLEDGE', style: 'default' }],
      );
      return;
    }
    if (!servicesReady || !storage) {
      Alert.alert(
        '[ SYSTEM NOT READY ]',
        'Backend services are still initialising. Please wait and retry.',
        [{ text: 'ACKNOWLEDGE', style: 'default' }],
      );
      return;
    }
    setPhase('CAPTURING');
  }, [name, device, hasPermission, servicesReady, storage]);

  const handleCapture = useCallback(() => {
    if (isCapturing || !isFaceDetected || !lastEmbedding) return;

    setIsCapturing(true);

    // Flash effect
    Animated.sequence([
      Animated.timing(captureFlashAnim, {
        toValue: 0.8,
        duration: 80,
        useNativeDriver: false,
      }),
      Animated.timing(captureFlashAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }),
    ]).start();

    // Use the REAL embedding generated by MobileFaceNet in the Worklet thread!
    const realEmbeddingArray = [...lastEmbedding];

    setTimeout(() => {
      const newEmbeddings = [...capturedEmbeddings, JSON.stringify(realEmbeddingArray)];
      setCapturedEmbeddings(newEmbeddings);

      if (currentStep < ANGLES.length - 1) {
        setCurrentStep((prev) => prev + 1);
        setIsCapturing(false);
      } else {
        handleFinalizeEnrollment(newEmbeddings);
      }
    }, 600);
  }, [isCapturing, isFaceDetected, lastEmbedding, capturedEmbeddings, currentStep, captureFlashAnim, handleFinalizeEnrollment]);

  const handleFinalizeEnrollment = useCallback(
    async (embeddings: string[]) => {
      setPhase('PROCESSING');
      setEnrollError(null);

      try {
        if (!storage) {
          throw new Error('Storage service not available');
        }

        // Average / concatenate all captured embeddings and persist
        const enrollmentData = JSON.stringify({
          angles: ANGLES,
          embeddings,
          capturedAt: new Date().toISOString(),
          livenessScore,
        });

        const personId = await storage.enrollPerson(name.trim(), enrollmentData);

        setPhase('COMPLETE');

        // Brief success display, then navigate
        setTimeout(() => {
          Alert.alert(
            '[ ENROLLMENT COMPLETE ]',
            `Personnel "${name.trim()}" enrolled successfully.\nID: ${personId}\nProceeding to authentication.`,
            [
              {
                text: 'PROCEED',
                onPress: () => navigation.navigate('Authentication'),
              },
            ],
          );
        }, 1200);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown enrollment failure';
        setEnrollError(message);
        setPhase('CAPTURING');
        setIsCapturing(false);
        Alert.alert('[ ENROLLMENT FAILED ]', message, [
          { text: 'RETRY', style: 'default' },
        ]);
      }
    },
    [storage, name, livenessScore, navigation],
  );

  // ── Render: Name Input Phase ───────────────────────────────────────────────
  const renderNameInput = () => (
    <View style={styles.nameInputContainer}>
      <View style={styles.inputLabelRow}>
        <View style={styles.dotCyan} />
        <Text style={styles.inputLabel}>PERSONNEL IDENTIFIER</Text>
      </View>

      <Animated.View style={[styles.inputWrapper, { borderColor: inputBorderColor }]}>
        <View style={[styles.inputCorner, styles.inputCornerTL]} />
        <View style={[styles.inputCorner, styles.inputCornerTR]} />
        <View style={[styles.inputCorner, styles.inputCornerBL]} />
        <View style={[styles.inputCorner, styles.inputCornerBR]} />
        <TextInput
          style={styles.textInput}
          value={name}
          onChangeText={setName}
          placeholder="Enter full name..."
          placeholderTextColor="rgba(0,255,204,0.25)"
          autoCapitalize="words"
          autoCorrect={false}
          maxLength={64}
          selectionColor="#00ffcc"
        />
      </Animated.View>

      <Text style={styles.inputHint}>
        {name.trim().length > 0
          ? `>> ${name.trim().length} CHARS LOADED`
          : '>> AWAITING INPUT...'}
      </Text>

      <TouchableOpacity
        style={[
          styles.cyberButton,
          (!name.trim() || !servicesReady) && styles.cyberButtonDisabled,
        ]}
        onPress={handleBeginEnrollment}
        disabled={!name.trim() || !servicesReady}
        activeOpacity={0.8}
      >
        <View style={styles.buttonBracketLeft} />
        <Text style={styles.buttonText}>
          {!servicesReady
            ? '[ INITIALIZING SERVICES... ]'
            : '[ BEGIN BIOMETRIC CAPTURE ]'}
        </Text>
        <View style={styles.buttonBracketRight} />
      </TouchableOpacity>

      {!servicesReady && (
        <View style={styles.statusRow}>
          <ActivityIndicator size="small" color="#00ffcc" />
          <Text style={styles.statusText}>Bootstrapping secure services...</Text>
        </View>
      )}
    </View>
  );

  // ── Render: Camera Capture Phase ───────────────────────────────────────────
  const renderCameraCapture = () => (
    <View style={styles.captureContainer}>
      {/* Step indicator */}
      <View style={styles.stepIndicator}>
        {ANGLES.map((angle, idx) => (
          <View key={angle} style={styles.stepDotRow}>
            <View
              style={[
                styles.stepDot,
                idx < currentStep && styles.stepDotComplete,
                idx === currentStep && styles.stepDotActive,
              ]}
            >
              {idx < currentStep && <Text style={styles.stepCheck}>✓</Text>}
              {idx === currentStep && <View style={styles.stepDotInner} />}
            </View>
            {idx < ANGLES.length - 1 && (
              <View
                style={[
                  styles.stepLine,
                  idx < currentStep && styles.stepLineComplete,
                ]}
              />
            )}
          </View>
        ))}
      </View>

      <Text style={styles.angleLabel}>
        ANGLE {currentStep + 1}/{ANGLES.length}: {ANGLES[currentStep]}
      </Text>
      <Text style={styles.instructionText}>
        {ANGLE_INSTRUCTIONS[ANGLES[currentStep]]}
      </Text>

      {/* Camera viewport */}
      <View style={styles.cameraViewport}>
        {device && hasPermission ? (
          <Camera
            ref={camera}
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={phase === 'CAPTURING'}
            photo={true}
          />
        ) : (
          <Text style={styles.cameraFallbackText}>
            [ SENSOR OFFLINE / NO PERMISSION ]
          </Text>
        )}

        {/* Tactical Corner Brackets */}
        <View style={[styles.cornerBracket, styles.bracketTopLeft]} />
        <View style={[styles.cornerBracket, styles.bracketTopRight]} />
        <View style={[styles.cornerBracket, styles.bracketBottomLeft]} />
        <View style={[styles.cornerBracket, styles.bracketBottomRight]} />

        {/* Face detection overlay */}
        {isFaceDetected && (
          <View style={styles.detectionOverlay}>
            <Text style={styles.detectionText}>TARGET LOCKED</Text>
            <Text style={styles.detectionText}>
              LIVENESS: {livenessScore.toFixed(1)}%
            </Text>
          </View>
        )}

        {/* Scan line */}
        <Animated.View
          style={[styles.scanLine, { transform: [{ translateY: scanTranslateY }] }]}
        />

        {/* Capture flash overlay */}
        <Animated.View
          style={[styles.captureFlash, { opacity: captureFlashAnim }]}
          pointerEvents="none"
        />

        {/* Model status badge */}
        <View style={styles.modelBadge}>
          <View
            style={[
              styles.modelDot,
              { backgroundColor: modelsLoaded ? '#00ffcc' : '#ff3333' },
            ]}
          />
          <Text style={styles.modelBadgeText}>
            {modelsLoaded ? 'ML PIPELINE READY' : 'LOADING MODELS...'}
          </Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressBarContainer}>
        <View style={styles.progressBarBg}>
          <Animated.View
            style={[styles.progressBarFill, { width: progressWidth as any }]}
          />
        </View>
        <Text style={styles.progressText}>
          {Math.round((currentStep / ANGLES.length) * 100)}% CAPTURED
        </Text>
      </View>

      {/* Capture button */}
      <TouchableOpacity
        style={[
          styles.captureButton,
          (!isFaceDetected || isCapturing) && styles.captureButtonDisabled,
        ]}
        onPress={handleCapture}
        disabled={!isFaceDetected || isCapturing}
        activeOpacity={0.7}
      >
        <View style={styles.captureButtonInner}>
          {isCapturing ? (
            <ActivityIndicator size="small" color="#05070a" />
          ) : (
            <Text style={styles.captureButtonText}>
              {isFaceDetected
                ? `CAPTURE ${ANGLES[currentStep]}`
                : 'ACQUIRING TARGET...'}
            </Text>
          )}
        </View>
      </TouchableOpacity>

      {/* Tech stats */}
      <View style={styles.perfBar}>
        <Text style={styles.perfText}>
          MobileFaceNet 112×112 | INT8 1.4MB |{' '}
          {isFaceDetected ? 'FACE: YES' : 'FACE: NO'}
        </Text>
      </View>
    </View>
  );

  // ── Render: Processing Phase ───────────────────────────────────────────────
  const renderProcessing = () => (
    <View style={styles.processingContainer}>
      <Animated.View style={[styles.processingRing, { opacity: pulseAnim }]}>
        <ActivityIndicator size="large" color="#00ffcc" />
      </Animated.View>
      <Text style={styles.processingTitle}>PROCESSING ENROLLMENT</Text>
      <Text style={styles.processingSubtext}>
        Averaging embeddings across {ANGLES.length} angles...
      </Text>
      <Text style={styles.processingSubtext}>
        Encrypting biometric data with AES-256...
      </Text>
      <Text style={styles.processingSubtext}>
        Writing to secure SQLCipher database...
      </Text>
    </View>
  );

  // ── Render: Complete Phase ─────────────────────────────────────────────────
  const renderComplete = () => (
    <View style={styles.completeContainer}>
      <Text style={styles.completeIcon}>✓</Text>
      <Text style={styles.completeTitle}>ENROLLMENT SUCCESSFUL</Text>
      <Text style={styles.completeSubtext}>
        Personnel "{name.trim()}" registered in secure vault.
      </Text>
      <Text style={styles.completeSubtext}>
        {ANGLES.length} biometric vectors captured and encrypted.
      </Text>
    </View>
  );

  // ── Main Render ────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.hudHeader}>
        <Animated.View style={[styles.pulseGreen, { opacity: pulseAnim }]} />
        <Animated.Text style={[styles.header, { opacity: headerGlowAnim }]}>
          NETRA IDENTITY: ENROLLMENT
        </Animated.Text>
      </View>

      {/* Subheader with phase info */}
      <View style={styles.phaseBar}>
        <Text style={styles.phaseText}>
          PHASE: {phase.replace('_', ' ')} | MODE: BIOMETRIC CAPTURE
        </Text>
      </View>

      {/* Phase content */}
      {phase === 'NAME_INPUT' && renderNameInput()}
      {phase === 'CAPTURING' && renderCameraCapture()}
      {phase === 'PROCESSING' && renderProcessing()}
      {phase === 'COMPLETE' && renderComplete()}

      {/* Error display */}
      {enrollError && (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>⚠ {enrollError}</Text>
        </View>
      )}
      {appServicesError && (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>⚠ SERVICES ERROR: {appServicesError}</Text>
        </View>
      )}
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#05070a',
    paddingTop: 50,
    paddingHorizontal: 20,
    alignItems: 'center',
  },

  // ── Header ──
  hudHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  pulseGreen: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#00ffcc',
    marginRight: 10,
    shadowColor: '#00ffcc',
    shadowRadius: 10,
    shadowOpacity: 1,
    elevation: 5,
  },
  header: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#00ffcc',
    letterSpacing: 2,
    fontFamily: 'monospace',
  },
  phaseBar: {
    paddingHorizontal: 16,
    paddingVertical: 5,
    backgroundColor: 'rgba(0,255,204,0.05)',
    borderRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(0,255,204,0.15)',
    marginBottom: 24,
  },
  phaseText: {
    color: 'rgba(0,255,204,0.5)',
    fontSize: 9,
    fontFamily: 'monospace',
    letterSpacing: 1.5,
  },

  // ── Name Input ──
  nameInputContainer: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 30,
  },
  inputLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  dotCyan: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00ffcc',
    marginRight: 8,
  },
  inputLabel: {
    color: '#00ffcc',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    letterSpacing: 2,
  },
  inputWrapper: {
    width: '90%',
    borderWidth: 1,
    borderRadius: 4,
    backgroundColor: 'rgba(0,255,204,0.03)',
    position: 'relative',
    padding: 4,
  },
  inputCorner: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderColor: '#00ffcc',
  },
  inputCornerTL: { top: -1, left: -1, borderTopWidth: 2, borderLeftWidth: 2 },
  inputCornerTR: { top: -1, right: -1, borderTopWidth: 2, borderRightWidth: 2 },
  inputCornerBL: { bottom: -1, left: -1, borderBottomWidth: 2, borderLeftWidth: 2 },
  inputCornerBR: { bottom: -1, right: -1, borderBottomWidth: 2, borderRightWidth: 2 },
  textInput: {
    color: '#00ffcc',
    fontSize: 18,
    fontFamily: 'monospace',
    paddingVertical: 14,
    paddingHorizontal: 16,
    letterSpacing: 1,
  },
  inputHint: {
    color: 'rgba(0,255,204,0.3)',
    fontSize: 10,
    fontFamily: 'monospace',
    marginTop: 10,
    letterSpacing: 1,
  },

  // ── Buttons ──
  cyberButton: {
    marginTop: 40,
    paddingVertical: 18,
    paddingHorizontal: 30,
    backgroundColor: 'rgba(0,255,204,0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  cyberButtonDisabled: {
    opacity: 0.35,
    backgroundColor: 'transparent',
  },
  buttonBracketLeft: {
    width: 4,
    height: '100%',
    backgroundColor: '#00ffcc',
    position: 'absolute',
    left: 0,
  },
  buttonBracketRight: {
    width: 4,
    height: '100%',
    backgroundColor: '#00ffcc',
    position: 'absolute',
    right: 0,
  },
  buttonText: {
    color: '#00ffcc',
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 1.5,
    fontFamily: 'monospace',
  },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    gap: 8,
  },
  statusText: {
    color: 'rgba(0,255,204,0.5)',
    fontSize: 11,
    fontFamily: 'monospace',
  },

  // ── Capture ──
  captureContainer: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
  },

  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  stepDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: 'rgba(0,255,204,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  stepDotComplete: {
    borderColor: '#00ffcc',
    backgroundColor: 'rgba(0,255,204,0.2)',
  },
  stepDotActive: {
    borderColor: '#00ffcc',
    borderWidth: 2,
    shadowColor: '#00ffcc',
    shadowRadius: 6,
    shadowOpacity: 0.8,
    elevation: 4,
  },
  stepDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00ffcc',
  },
  stepCheck: {
    color: '#00ffcc',
    fontSize: 11,
    fontWeight: 'bold',
  },
  stepLine: {
    width: 20,
    height: 2,
    backgroundColor: 'rgba(0,255,204,0.2)',
  },
  stepLineComplete: {
    backgroundColor: '#00ffcc',
  },

  angleLabel: {
    color: '#00ffcc',
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    letterSpacing: 2,
    marginBottom: 4,
  },
  instructionText: {
    color: 'rgba(0,255,204,0.6)',
    fontSize: 11,
    fontFamily: 'monospace',
    marginBottom: 14,
    fontStyle: 'italic',
  },

  // ── Camera ──
  cameraViewport: {
    width: Math.min(SCREEN_WIDTH - 40, 320),
    height: 380,
    backgroundColor: '#111',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#0f3833',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraFallbackText: {
    color: 'rgba(0,255,204,0.4)',
    fontSize: 13,
    fontFamily: 'monospace',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  cornerBracket: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: '#00ffcc',
  },
  bracketTopLeft: { top: 12, left: 12, borderTopWidth: 2, borderLeftWidth: 2 },
  bracketTopRight: { top: 12, right: 12, borderTopWidth: 2, borderRightWidth: 2 },
  bracketBottomLeft: { bottom: 12, left: 12, borderBottomWidth: 2, borderLeftWidth: 2 },
  bracketBottomRight: { bottom: 12, right: 12, borderBottomWidth: 2, borderRightWidth: 2 },

  detectionOverlay: {
    position: 'absolute',
    top: 20,
    left: 20,
    backgroundColor: 'rgba(0,255,204,0.12)',
    padding: 8,
    borderRadius: 4,
    zIndex: 20,
    borderWidth: 1,
    borderColor: '#00ffcc',
  },
  detectionText: {
    color: '#00ffcc',
    fontSize: 9,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    letterSpacing: 0.5,
  },

  scanLine: {
    position: 'absolute',
    width: '100%',
    height: 2,
    backgroundColor: '#00ffcc',
    shadowColor: '#00ffcc',
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 10,
  },
  captureFlash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#00ffcc',
    zIndex: 50,
  },

  modelBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 3,
    gap: 5,
  },
  modelDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  modelBadgeText: {
    color: 'rgba(0,255,204,0.7)',
    fontSize: 8,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },

  // ── Progress bar ──
  progressBarContainer: {
    width: '90%',
    marginTop: 14,
    alignItems: 'center',
  },
  progressBarBg: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(0,255,204,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#00ffcc',
    borderRadius: 2,
    shadowColor: '#00ffcc',
    shadowRadius: 4,
    shadowOpacity: 0.8,
  },
  progressText: {
    color: 'rgba(0,255,204,0.5)',
    fontSize: 9,
    fontFamily: 'monospace',
    marginTop: 6,
    letterSpacing: 1,
  },

  // ── Capture button ──
  captureButton: {
    marginTop: 18,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: '#00ffcc',
    overflow: 'hidden',
    shadowColor: '#00ffcc',
    shadowRadius: 12,
    shadowOpacity: 0.6,
    elevation: 6,
  },
  captureButtonDisabled: {
    opacity: 0.35,
    borderColor: 'rgba(0,255,204,0.3)',
    shadowOpacity: 0,
  },
  captureButtonInner: {
    paddingVertical: 14,
    paddingHorizontal: 36,
    backgroundColor: 'rgba(0,255,204,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonText: {
    color: '#00ffcc',
    fontSize: 13,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    letterSpacing: 2,
  },

  // ── Performance bar ──
  perfBar: {
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: 'rgba(0,255,204,0.05)',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,255,204,0.15)',
  },
  perfText: {
    color: 'rgba(0,255,204,0.6)',
    fontSize: 9,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    letterSpacing: 0.5,
  },

  // ── Processing ──
  processingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 60,
  },
  processingRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: 'rgba(0,255,204,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  processingTitle: {
    color: '#00ffcc',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    letterSpacing: 2,
    marginBottom: 20,
  },
  processingSubtext: {
    color: 'rgba(0,255,204,0.5)',
    fontSize: 11,
    fontFamily: 'monospace',
    marginVertical: 3,
    letterSpacing: 0.5,
  },

  // ── Complete ──
  completeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 60,
  },
  completeIcon: {
    fontSize: 60,
    color: '#00ffcc',
    marginBottom: 20,
    textShadowColor: '#00ffcc',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  completeTitle: {
    color: '#00ffcc',
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    letterSpacing: 2,
    marginBottom: 16,
  },
  completeSubtext: {
    color: 'rgba(0,255,204,0.6)',
    fontSize: 12,
    fontFamily: 'monospace',
    marginVertical: 3,
    textAlign: 'center',
    paddingHorizontal: 20,
  },

  // ── Error ──
  errorBar: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,50,50,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,50,50,0.5)',
    borderRadius: 4,
  },
  errorText: {
    color: '#ff3333',
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    textAlign: 'center',
  },
});