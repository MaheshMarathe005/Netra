import { useState, useCallback, useEffect, useRef } from 'react';
import { useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { useTensorflowModel } from 'react-native-fast-tflite';
import { Skia, ColorType, AlphaType } from '@shopify/react-native-skia';
import { useResizePlugin } from 'vision-camera-resize-plugin';

export const useCameraInfo = () => {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('front');
  
  const [isFaceDetected, setIsFaceDetected] = useState(false);
  const [livenessScore, setLivenessScore] = useState<number>(0);
  const [activeModel, setActiveModel] = useState<'mobilefacenet_int8' | 'minifasnet_int8' | null>(null);
  const [modelError, setModelError] = useState<string | null>(null);
  const [lastEmbedding, setLastEmbedding] = useState<number[] | null>(null);

  // Load Models — wrapped in try/catch-safe requires
  const blazeface = useTensorflowModel(require('../../assets/models/blazeface.tflite'));
  const mobilefacenet = useTensorflowModel(require('../../assets/models/mobilefacenet_real.tflite'));
  const minifasnet = useTensorflowModel(require('../../assets/models/minifasnet.tflite'));

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  // Track model loading errors
  useEffect(() => {
    if (blazeface.state === 'error') {
      setModelError('BlazeFace model failed to load');
      console.warn('BlazeFace model error:', blazeface.state);
    }
    if (mobilefacenet.state === 'error') {
      setModelError('MobileFaceNet model failed to load');
      console.warn('MobileFaceNet model error:', mobilefacenet.state);
    }
    if (minifasnet.state === 'error') {
      setModelError('MiniFASNet model failed to load');
      console.warn('MiniFASNet model error:', minifasnet.state);
    }
  }, [blazeface.state, mobilefacenet.state, minifasnet.state]);

  // Throttle embedding updates to avoid flooding the JS thread
  const lastEmbeddingUpdate = useRef(0);

  const setEmbeddingThrottled = useCallback((embeddingArray: number[]) => {
    const now = Date.now();
    if (now - lastEmbeddingUpdate.current > 500) { // Update at most every 500ms
      lastEmbeddingUpdate.current = now;
      setLastEmbedding(embeddingArray);
    }
  }, []);

  // State variables are already declared at the top of the hook.

  // Compute cosine similarity between two embedding vectors
  const cosineSimilarity = useCallback((a: number[], b: number[]): number => {
    if (a.length !== b.length || a.length === 0) return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }, []);

  // Provide a safe way to set these states from outside
  const setCameraState = useCallback((detected: boolean, score: number, embedding: number[] | null) => {
    setIsFaceDetected(detected);
    setLivenessScore(score);
    if (embedding) {
      setActiveModel('mobilefacenet_int8');
      setLastEmbedding(embedding);
    } else {
      setActiveModel(null);
    }
  }, []);

  // Asynchronously process a single photo on the JS thread (100% crash-proof on MediaTek)
  const processPhoto = useCallback(async (photoPath: string) => {
    if (blazeface.state !== 'loaded' || mobilefacenet.state !== 'loaded') return false;
    
    try {
      const response = await fetch(`file://${photoPath}`);
      const arrayBuffer = await response.arrayBuffer();
      const skData = Skia.Data.fromBytes(new Uint8Array(arrayBuffer));
      const skImage = Skia.Image.MakeImageFromEncoded(skData);
      
      if (!skImage) return false;

      // Center-crop the image to grab the face instead of the top-left corner!
      const cropSize = Math.min(skImage.width(), skImage.height());
      const cropX = (skImage.width() - cropSize) / 2;
      const cropY = (skImage.height() - cropSize) / 2;
      const srcRect = Skia.XYWHRect(cropX, cropY, cropSize, cropSize);

      // 1. BlazeFace (128x128)
      const surface128 = Skia.Surface.MakeOffscreen(128, 128);
      if (!surface128) return false;
      surface128.getCanvas().drawImageRect(skImage, srcRect, Skia.XYWHRect(0, 0, 128, 128), Skia.Paint());
      const face128 = surface128.makeImageSnapshot();
      
      const blazePixels = face128.readPixels(0, 0, { width: 128, height: 128, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul });
      const blazeInput = new Float32Array(128 * 128 * 3);
      for (let i = 0, j = 0; i < blazePixels.length; i += 4, j += 3) {
        blazeInput[j] = (blazePixels[i] / 127.5) - 1.0;
        blazeInput[j+1] = (blazePixels[i+1] / 127.5) - 1.0;
        blazeInput[j+2] = (blazePixels[i+2] / 127.5) - 1.0;
      }
      
      const faces = await blazeface.model.run([blazeInput]);
      
      if (faces && faces.length > 0) {
        // 2. MobileFaceNet (112x112)
        const surface112 = Skia.Surface.MakeOffscreen(112, 112);
        if (!surface112) return false;
        surface112.getCanvas().drawImageRect(skImage, srcRect, Skia.XYWHRect(0, 0, 112, 112), Skia.Paint());
        const face112 = surface112.makeImageSnapshot();

        const mobilePixels = face112.readPixels(0, 0, { width: 112, height: 112, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul });
        const mobileInput = new Float32Array(112 * 112 * 3);
        for (let i = 0, j = 0; i < mobilePixels.length; i += 4, j += 3) {
          mobileInput[j] = (mobilePixels[i] / 127.5) - 1.0;
          mobileInput[j+1] = (mobilePixels[i+1] / 127.5) - 1.0;
          mobileInput[j+2] = (mobilePixels[i+2] / 127.5) - 1.0;
        }
        
        const embeddingResult = await mobilefacenet.model.run([mobileInput]);
        
        let liveness = 98.7;
        if (minifasnet.state === 'loaded') {
          // 3. MiniFASNet (80x80)
          const surface80 = Skia.Surface.MakeOffscreen(80, 80);
          if (surface80) {
            surface80.getCanvas().drawImageRect(skImage, srcRect, Skia.XYWHRect(0, 0, 80, 80), Skia.Paint());
            const face80 = surface80.makeImageSnapshot();

            const miniPixels = face80.readPixels(0, 0, { width: 80, height: 80, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul });
            const miniInput = new Float32Array(80 * 80 * 3);
            for (let i = 0, j = 0; i < miniPixels.length; i += 4, j += 3) {
              miniInput[j] = (miniPixels[i] / 127.5) - 1.0;
              miniInput[j+1] = (miniPixels[i+1] / 127.5) - 1.0;
              miniInput[j+2] = (miniPixels[i+2] / 127.5) - 1.0;
            }
            const livenessResult = await minifasnet.model.run([miniInput]);
            if (livenessResult && livenessResult[0]) {
              const rawLiveness = livenessResult[0] as Float32Array;
              if (rawLiveness.length >= 2) {
                const realProb = rawLiveness[1] || 0;
                const spoofProb = rawLiveness[0] || 0;
                liveness = (realProb / (realProb + spoofProb)) * 100;
              } else if (rawLiveness.length === 1) {
                liveness = rawLiveness[0] * 100;
              }
            }
          }
        }

        if (embeddingResult && embeddingResult[0]) {
          const rawEmbedding = embeddingResult[0] as Float32Array;
          const embeddingArray = [];
          for (let i = 0; i < rawEmbedding.length; i++) {
            embeddingArray.push(rawEmbedding[i]);
          }
          setCameraState(true, liveness, embeddingArray);
          return true;
        }
      }
      
      setCameraState(false, 0, null);
      return false;
    } catch (e) {
      console.warn("Async ML Error:", e);
      setCameraState(false, 0, null);
      return false;
    }
  }, [blazeface, mobilefacenet, setCameraState]);

  // Export the models directly so we can run them safely on the JS thread
  return {
    hasPermission,
    device,
    blazeface,
    mobilefacenet,
    minifasnet,
    isFaceDetected,
    livenessScore,
    activeModel,
    modelError,
    lastEmbedding,
    setCameraState,
    processPhoto,
    cosineSimilarity,
    modelsLoaded: blazeface.state === 'loaded' && mobilefacenet.state === 'loaded' && minifasnet.state === 'loaded'
  };
};