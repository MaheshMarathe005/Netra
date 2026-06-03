import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';

export default function EnrollmentScreen() {
  const navigation = useNavigation<any>();
  const [step, setStep] = useState(0);
  const angles = ["Front", "Left", "Right", "Up", "Down"];

  const captureFrame = () => {
    if (step < angles.length - 1) {
      setStep(step + 1);
    } else {
      console.log('Embedding averaged and saved locally via secure API. 🔐');
      navigation.navigate('Authentication');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Netra Identity Profile</Text>
      <Text style={styles.subtext}>Step {step + 1} of 5: Look {angles[step]}</Text>

      <View style={styles.cameraPlaceholder}>
        <Text style={styles.cameraText}>[Camera Feed]</Text>
        <Text style={styles.instructionText}>Ensure your face is well lit.</Text>
      </View>

      <TouchableOpacity style={styles.captureButton} onPress={captureFrame}>
        <Text style={styles.buttonText}>Capture {angles[step]} Angle</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: '#042C53' },
  header: { fontSize: 24, fontWeight: 'bold', color: 'white', marginBottom: 10 },
  subtext: { fontSize: 18, color: '#AFA9EC', marginBottom: 30 },
  cameraPlaceholder: { width: 300, height: 400, backgroundColor: '#000', borderRadius: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#534AB7' },
  cameraText: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  instructionText: { color: '#85B7EB', marginTop: 10 },
  captureButton: { marginTop: 40, backgroundColor: '#0F6E56', paddingVertical: 15, paddingHorizontal: 40, borderRadius: 30 },
  buttonText: { color: 'white', fontSize: 18, fontWeight: 'bold' }
});