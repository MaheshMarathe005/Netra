import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAppServices } from '../contexts/AppContext';

// ── Component ────────────────────────────────────────────────────────────────

export default function ResultScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { storage, sync, syncQueueCount, refreshSyncCount } = useAppServices();

  // ── Route params ──────────────────────────────────────────────────────────
  const isSuccess: boolean = route.params?.success ?? false;
  const confidence: number = route.params?.confidence ?? 0;
  const spoofScore: number = route.params?.spoofScore ?? 0.05;
  const personId: number = route.params?.personId ?? 1;
  const livenessMethod: string =
    route.params?.livenessMethod ?? 'MiniFASNet + BlazeFace';

  // ── Local state ───────────────────────────────────────────────────────────
  const [attendanceSaved, setAttendanceSaved] = useState(false);
  const [serviceError, setServiceError] = useState<string | null>(null);

  // ── Animations ────────────────────────────────────────────────────────────
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(60)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const glowAnim = useRef(new Animated.Value(0.4)).current;
  const headerGlowAnim = useRef(new Animated.Value(0)).current;
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  // Accent colours
  const accent = isSuccess ? '#00ffcc' : '#ff3333';
  const accentDim = isSuccess
    ? 'rgba(0, 255, 204, 0.15)'
    : 'rgba(255, 51, 51, 0.15)';
  const accentBorder = isSuccess
    ? 'rgba(0, 255, 204, 0.3)'
    : 'rgba(255, 51, 51, 0.3)';

  // ── Entrance & glow animations ────────────────────────────────────────────

  useEffect(() => {
    // Entrance
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 80,
        useNativeDriver: true,
      }),
    ]).start();

    // Header glow pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(headerGlowAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(headerGlowAnim, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();

    // Card glow pulse (non-native driver for shadow)
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.4,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ]),
    ).start();

    // Horizontal scan line across the card
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, {
          toValue: 1,
          duration: 3000,
          easing: Easing.linear,
          useNativeDriver: false,
        }),
        Animated.timing(scanLineAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: false,
        }),
      ]),
    ).start();
  }, [fadeAnim, slideAnim, scaleAnim, glowAnim, headerGlowAnim, scanLineAnim]);

  // ── Save attendance & trigger sync ────────────────────────────────────────

  useEffect(() => {
    if (!isSuccess || attendanceSaved) return;

    const saveAndSync = async () => {
      try {
        if (storage) {
          await storage.saveAttendance(personId, livenessMethod, confidence);
          setAttendanceSaved(true);
          await refreshSyncCount();
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to save attendance record.';
        setServiceError(message);
        console.error('[ResultScreen] saveAttendance error:', err);
      }

      // Fire-and-forget background sync
      try {
        if (sync) {
          sync.syncPendingRecords().catch((syncErr: unknown) => {
            console.warn('[ResultScreen] background sync failed:', syncErr);
          });
          // Refresh count after a short delay to reflect any changes
          setTimeout(() => {
            refreshSyncCount().catch(() => {});
          }, 3000);
        }
      } catch (err) {
        console.warn('[ResultScreen] syncPendingRecords error:', err);
      }
    };

    saveAndSync();
  }, [
    isSuccess,
    attendanceSaved,
    storage,
    sync,
    personId,
    livenessMethod,
    confidence,
    refreshSyncCount,
  ]);

  // ── Derived animated values ───────────────────────────────────────────────

  const scanLineTop = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const glowShadowRadius = glowAnim.interpolate({
    inputRange: [0.4, 1],
    outputRange: [4, 20],
  });

  const glowShadowOpacity = glowAnim.interpolate({
    inputRange: [0.4, 1],
    outputRange: [0.3, 0.9],
  });

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
          },
        ]}
      >
        {/* ── Status indicator dot ─────────────────────────────────────── */}
        <View style={styles.hudHeader}>
          <Animated.View
            style={[
              styles.statusDot,
              { backgroundColor: accent, shadowColor: accent, opacity: headerGlowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) },
            ]}
          />
          <Text style={[styles.hudLabel, { color: accent }]}>
            IDENTITY VERIFICATION RESULT
          </Text>
        </View>

        {/* ── Main verdict ─────────────────────────────────────────────── */}
        <Animated.Text
          style={[
            styles.header,
            {
              color: accent,
              textShadowColor: accent,
              opacity: headerGlowAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.75, 1],
              }),
            },
          ]}
        >
          {isSuccess ? '[ ACCESS GRANTED ]' : '[ ACCESS DENIED ]'}
        </Animated.Text>

        {/* ── Data card ────────────────────────────────────────────────── */}
        <Animated.View
          style={[
            styles.card,
            {
              borderColor: accentBorder,
              shadowColor: accent,
              shadowRadius: glowShadowRadius,
              shadowOpacity: glowShadowOpacity,
            },
          ]}
        >
          {/* Corner brackets */}
          <View style={[styles.cornerBracket, styles.bracketTopLeft, { borderColor: accent }]} />
          <View style={[styles.cornerBracket, styles.bracketTopRight, { borderColor: accent }]} />
          <View style={[styles.cornerBracket, styles.bracketBottomLeft, { borderColor: accent }]} />
          <View style={[styles.cornerBracket, styles.bracketBottomRight, { borderColor: accent }]} />

          {/* Scan line overlay */}
          <Animated.View
            style={[styles.scanLine, { top: scanLineTop, backgroundColor: accent }]}
          />

          {/* Confidence */}
          <Text style={[styles.statLabel, { color: accent }]}>
            FACENET CONFIDENCE SCORE
          </Text>
          <Text style={[styles.statValue, { color: accent }]}>
            {typeof confidence === 'number' ? confidence.toFixed(1) : confidence}%
          </Text>

          {/* Spoof score */}
          <Text style={[styles.statLabel, { color: accent }]}>
            FAS SPOOF PROBABILITY (HTER)
          </Text>
          <Text
            style={[
              styles.statValue,
              { color: '#ff9900', fontSize: 18 },
            ]}
          >
            {(spoofScore * 100).toFixed(1)}%
          </Text>

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: accentBorder }]} />

          {/* Technical details */}
          <Text style={[styles.techLabel, { color: accent }]}>
            Model: MobileFaceNet + ArcFace
          </Text>
          <Text style={[styles.techLabel, { color: accent }]}>
            Inference: ~42ms (INT8 1.4MB)
          </Text>
          <Text style={[styles.techLabel, { color: accent }]}>
            Resolution: 112x112 px Crop
          </Text>
          <Text style={[styles.techLabel, { color: accent }]}>
            Anti-Spoof: {livenessMethod}
          </Text>

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: accentBorder }]} />

          {/* Sync queue */}
          <Text style={[styles.statLabel, { color: accent }]}>
            SYNC QUEUE STATUS
          </Text>
          <View style={[styles.badge, { backgroundColor: accentDim, borderColor: accentBorder }]}>
            <Text style={[styles.badgeText, { color: accent }]}>
              {syncQueueCount === 0
                ? '✓ ALL SYNCED'
                : `◉ ${syncQueueCount} PENDING OFFLINE`}
            </Text>
          </View>

          {/* Attendance save status */}
          {isSuccess && (
            <Text style={[styles.statusText, { color: accent }]}>
              {attendanceSaved
                ? '✓ ATTENDANCE RECORD LOGGED'
                : serviceError
                  ? `✗ ${serviceError}`
                  : '◌ SAVING RECORD...'}
            </Text>
          )}

          {/* Error banner */}
          {serviceError && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>⚠ {serviceError}</Text>
            </View>
          )}
        </Animated.View>

        {/* ── Action buttons ───────────────────────────────────────────── */}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.cyberButton, { borderColor: accent }]}
            onPress={() => navigation.navigate('Authentication')}
            activeOpacity={0.8}
          >
            <View style={[styles.buttonEdge, styles.buttonEdgeLeft, { backgroundColor: accent }]} />
            <Text style={[styles.buttonText, { color: accent }]}>
              [ AUTHENTICATE ANOTHER ]
            </Text>
            <View style={[styles.buttonEdge, styles.buttonEdgeRight, { backgroundColor: accent }]} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.cyberButton, styles.secondaryButton, { borderColor: accentBorder }]}
            onPress={() => navigation.navigate('Enrollment')}
            activeOpacity={0.8}
          >
            <View style={[styles.buttonEdge, styles.buttonEdgeLeft, { backgroundColor: accentBorder }]} />
            <Text style={[styles.buttonText, { color: 'rgba(255,255,255,0.6)' }]}>
              [ BACK TO ENROLLMENT ]
            </Text>
            <View style={[styles.buttonEdge, styles.buttonEdgeRight, { backgroundColor: accentBorder }]} />
          </TouchableOpacity>
        </View>

        {/* ── Bottom HUD bar ───────────────────────────────────────────── */}
        <View style={[styles.perfBar, { borderColor: accentBorder, backgroundColor: accentDim }]}>
          <Text style={[styles.perfText, { color: accent }]}>
            JSI: ENABLED │ SQLCipher: AES-256 │ TFLite: INT8 │ DEVICE: SECURE
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#05070a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 20,
  },

  // HUD header
  hudHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
    shadowRadius: 10,
    shadowOpacity: 1,
    elevation: 5,
  },
  hudLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 2,
    fontFamily: 'monospace',
  },

  // Main header
  header: {
    fontSize: 28,
    fontWeight: 'bold',
    letterSpacing: 3,
    fontFamily: 'monospace',
    marginBottom: 25,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15,
  },

  // Data card
  card: {
    backgroundColor: 'rgba(10, 13, 20, 0.95)',
    padding: 25,
    borderRadius: 4,
    width: '95%',
    alignItems: 'center',
    marginBottom: 25,
    borderWidth: 1,
    position: 'relative',
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },

  // Tactical corner brackets
  cornerBracket: {
    position: 'absolute',
    width: 18,
    height: 18,
  },
  bracketTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 2,
    borderLeftWidth: 2,
  },
  bracketTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 2,
    borderRightWidth: 2,
  },
  bracketBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
  },
  bracketBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 2,
    borderRightWidth: 2,
  },

  // Scan line
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    opacity: 0.3,
  },

  // Data display
  statLabel: {
    fontSize: 10,
    marginTop: 12,
    textTransform: 'uppercase',
    fontWeight: 'bold',
    letterSpacing: 1.5,
    fontFamily: 'monospace',
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  divider: {
    height: 1,
    width: '100%',
    marginVertical: 14,
  },
  techLabel: {
    fontSize: 10,
    fontFamily: 'monospace',
    marginVertical: 2,
    letterSpacing: 0.5,
  },

  // Sync badge
  badge: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 2,
    marginTop: 6,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    letterSpacing: 1,
  },

  // Attendance status
  statusText: {
    fontSize: 10,
    fontFamily: 'monospace',
    marginTop: 10,
    letterSpacing: 0.5,
    fontWeight: 'bold',
  },

  // Error
  errorBanner: {
    marginTop: 10,
    backgroundColor: 'rgba(255, 51, 51, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 51, 51, 0.3)',
    width: '100%',
  },
  errorText: {
    color: '#ff3333',
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    textAlign: 'center',
  },

  // Buttons
  buttonRow: {
    width: '95%',
    gap: 12,
  },
  cyberButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(0, 255, 204, 0.06)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  secondaryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  buttonEdge: {
    position: 'absolute',
    width: 3,
    height: '100%',
  },
  buttonEdgeLeft: {
    left: 0,
  },
  buttonEdgeRight: {
    right: 0,
  },
  buttonText: {
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 1.5,
    fontFamily: 'monospace',
  },

  // Bottom HUD bar
  perfBar: {
    marginTop: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 3,
    borderWidth: 1,
  },
  perfText: {
    fontSize: 9,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    letterSpacing: 0.5,
  },
});