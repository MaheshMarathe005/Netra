import { useState, useCallback, useEffect } from 'react';
import { useCameraDevice, useCameraPermission, useFrameProcessor } from 'react-native-vision-camera';
import { useTensorflowModel } from 'react-native-fast-tflite';
import { useResizePlugin } from 'vision-camera-resize-plugin';
import { Worklets } from 'react-native-worklets-core';

export const useCameraInfo = () => {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('front');
  
  const [isFaceDetected, setIsFaceDetected] = useState(false);
  const [livenessScore, setLivenessScore] = useState<number>(0);
  const [activeModel, setActiveModel] = useState<'mobilefacenet_int8' | 'minifasnet_int8' | null>(null);

  // Load Models
  const blazeface = useTensorflowModel(require('../../assets/models/blazeface.tflite'));
  const mobilefacenet = useTensorflowModel(require('../../assets/models/mobilefacenet_real.tflite'));
  const minifasnet = useTensorflowModel(require('../../assets/models/minifasnet.tflite'));

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  const { resize } = useResizePlugin();

// Directly use Worklets.runOnJS to call JS functions from worklet context

  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';
    
    // 1. Detect faces using BlazeFace
    if (blazeface.state !== 'loaded' || blazeface.model == null) return;
    // Convert Vision Camera frame to Uint8Array buffer expected by TensorFlow Lite
    const frameBuffer = new Uint8Array(frame.toArrayBuffer ? frame.toArrayBuffer() : []);
    const faces = blazeface.model.runSync([frameBuffer]);

    if (faces && faces.length > 0) {
      Worklets.runOnJS(setIsFaceDetected)(true);

      // 2. Preprocess for Liveness
      const resized = resize(frame, {
        scale: { width: 80, height: 80 },
        pixelFormat: 'rgb',
        dataType: 'uint8',
      });

      // 3. Run Liveness/Recognition Models
      if (mobilefacenet.state === 'loaded' && mobilefacenet.model != null) {
        // Convert resized frame to Uint8Array buffer for model input
        const resizedBuffer = new Uint8Array(resized.toArrayBuffer ? resized.toArrayBuffer() : []);
        const livenessPrediction = mobilefacenet.model.runSync([resizedBuffer]);
        
        // Parse output tensor (assuming float32 probability score at index 0)
        if (livenessPrediction && livenessPrediction[0]) {
          const score = (livenessPrediction[0] as Float32Array)[0];
          Worklets.runOnJS(setLivenessScore)(score);
        }
      }
    } else {
      Worklets.runOnJS(setIsFaceDetected)(false);
    }
  }, [blazeface, mobilefacenet, minifasnet, resize]);

  const simulateDetection = useCallback(() => {
    setIsFaceDetected(true);
    setActiveModel('mobilefacenet_int8');
    setLivenessScore(98.7);
  }, []);

  return {
    hasPermission,
    device,
    isFaceDetected,
    livenessScore,
    activeModel,
    simulateDetection,
    frameProcessor,
    modelsLoaded: blazeface.state === 'loaded' && mobilefacenet.state === 'loaded' && minifasnet.state === 'loaded'
  };
};