import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

export default function ResultScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const isSuccess = route.params?.success ?? false;
  const confidence = route.params?.confidence ?? 0;
  const spoofScore = route.params?.spoofScore ?? 0.05;

  return (
    <View style={[styles.container, { backgroundColor: isSuccess ? '#0F6E56' : '#854F0B' }]}>
      <Text style={styles.header}>{isSuccess ? 'ACCESS GRANTED' : 'ACCESS DENIED'}</Text>
      
      <View style={styles.card}>
        <Text style={styles.statLabel}>FaceNet Confidence Score:</Text>
        <Text style={styles.statValue}>{confidence}%</Text>
        
        <Text style={styles.statLabel}>FAS Spoof Probability (HTER):</Text>
        <Text style={[styles.statValue, { color: '#854F0B', fontSize: 18 }]}>{(spoofScore * 100).toFixed(1)}%</Text>
        
        <View style={styles.divider} />
        
        <Text style={styles.techLabel}>Model: MobileFaceNet + ArcFace</Text>
        <Text style={styles.techLabel}>Inference: ~42ms (INT8 1.4MB)</Text>
        <Text style={styles.techLabel}>Resolution: 112x112 px Crop</Text>
        
        <View style={styles.divider} />

        <Text style={styles.statLabel}>Sync Queue Status:</Text>
        <Text style={styles.badge}>1 Pending Offline</Text>
      </View>

      <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('Authentication')}>
        <Text style={styles.buttonText}>Authenticate Another</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center', alignItems: 'center' },
  header: { fontSize: 32, fontWeight: 'bold', color: 'white', marginBottom: 30 },
  card: { backgroundColor: 'white', padding: 30, borderRadius: 15, width: '90%', alignItems: 'center', marginBottom: 40 },
  statLabel: { fontSize: 13, color: '#666', marginTop: 10, textTransform: 'uppercase', fontWeight: 'bold' },
  statValue: { fontSize: 24, fontWeight: 'bold', color: '#333', marginBottom: 5 },
  divider: { height: 1, width: '100%', backgroundColor: '#EEE', marginVertical: 15 },
  techLabel: { fontSize: 12, color: '#0F6E56', fontFamily: 'monospace', marginVertical: 2 },
  badge: { backgroundColor: '#EF9F27', color: 'white', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginTop: 5, fontSize: 12, fontWeight: 'bold' },
  button: { backgroundColor: 'rgba(255,255,255,0.2)', paddingVertical: 15, paddingHorizontal: 30, borderRadius: 30, borderWidth: 1, borderColor: 'white' },
  buttonText: { color: 'white', fontSize: 16, fontWeight: 'bold' }
});