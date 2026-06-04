# Netra Identity

**Netra Identity** is a highly secure, offline-first facial recognition and anti-spoofing attendance system built for mobile devices. Designed specifically for enterprise-grade deployment, it leverages localized machine learning models to instantly verify personnel identities and block spoofing attacks (such as printed photos or digital screens) entirely on the edge, without requiring a constant internet connection.

---

## 🚀 Key Features

* **Edge Facial Recognition**: Utilizes a highly optimized 128-dimensional `MobileFaceNet` vector embedding to accurately identify personnel in milliseconds.
* **Military-Grade Anti-Spoofing**: Integrates `MiniFASNet` (trained on CelebA-Spoof) to hunt for high-frequency artifacts like screen glare, pixel grids, and paper grain. 
* **Dynamic Peak-Score Tracking**: Evaluates liveness over a continuous 150-frame, 5-second window, locking onto the Maximum Peak Score to ensure lightning-fast approvals for real users while strictly blocking static 2D photos at the 75% security gate.
* **Heuristic Confidence Scaling**: Safely boosts raw ML confidence scores using standard machine learning Softmax Temperature Scaling and targeted mathematical multipliers (>61% gate) to provide definitive results.
* **Offline-First Architecture**: Stores all attendance logs in an isolated local SQLite database when the device loses connection.
* **Automated Cloud Syncing**: A background `SyncService` listens to network state changes and automatically flushes the local queue directly to an AWS S3 data lake the moment connectivity is restored.
* **Infinite Scaling Backend**: Serverless AWS Lambda backend (`us-east-1` N. Virginia) that alphabetizes your S3 Bucket files by automatically injecting the Employee's Name and an ISO Timestamp into the file key (e.g., `Mahesh_ATTENDANCE_2026-06-04T12-30.json`) to completely eliminate data overwriting.
* **Ultra-Lightweight Distribution**: Android build is rigorously optimized via ProGuard Minification and Split-Architecture Compilation to output incredibly tiny APKs (specific to `arm64-v8a`) by stripping out all dead code and emulator binaries.

---

## 🧠 Machine Learning Pipeline

Our local C++ TFLite pipeline processes raw camera feeds in 3 stages:

1. **BlazeFace (Scout)**: Scans the live camera feed to detect bounding boxes and dynamically crops the specific face regions.
2. **MobileFaceNet (Identity)**: A specialized neural network trained to ignore textures and evaluate the underlying geometric distance between facial features, generating the Cosine Similarity threshold.
3. **MiniFASNet (Security)**: A separate classifier mathematically tuned via strict **RGB ImageNet Normalization** to isolate texture-based anomalies and output a Liveness Confidence Score.

---

## 🛠️ Tech Stack

* **Frontend:** React Native (Expo)
* **Native Processing:** React Native Skia, Vision Camera v3, Fast TFLite
* **Local Storage:** SQLite
* **Cloud Infrastructure:** AWS Lambda, Amazon API Gateway, Amazon S3 (N. Virginia)
* **Deployment:** Serverless Framework

---

## 📦 Getting Started

### 1. Deploy the AWS Backend
Navigate to the AWS directory and deploy the serverless stack to spin up your secure S3 Bucket and Lambda functions:
```bash
cd aws
serverless deploy
```

### 2. Run the Mobile App
Install all dependencies and compile the local C++ bindings:
```bash
npm install
npx expo run:android
```

### 3. Build a Production APK
To compile the highly-optimized, lightweight Android application (with ProGuard Minification and Split Architecture enabled):
```bash
cd android
./gradlew assembleRelease
```
You will find the optimized lightweight APK in:
`android/app/build/outputs/apk/release/app-arm64-v8a-release.apk`
