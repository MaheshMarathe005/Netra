# Netra Identity

**Netra Identity** is a highly secure, offline-first facial recognition and anti-spoofing attendance system built for mobile devices. Designed specifically for enterprise-grade deployment, it leverages localized machine learning models to instantly verify personnel identities and block spoofing attacks (such as printed photos or digital screens) entirely on the edge, without requiring a constant internet connection.

---

## 🚀 Key Features

* **Edge Facial Recognition**: Utilizes a highly optimized 128-dimensional `MobileFaceNet` vector embedding to accurately identify personnel in milliseconds.
* **Military-Grade Anti-Spoofing**: Integrates `MiniFASNet` (trained on CelebA-Spoof) to hunt for high-frequency artifacts like screen glare, pixel grids, and paper grain to detect and reject presentation attacks.
* **Offline-First Architecture**: Stores all attendance logs in an isolated local SQLite database when the device loses connection.
* **Automated Cloud Syncing**: A background `SyncService` listens to network state changes and automatically flushes the local queue directly to an AWS S3 data lake the moment connectivity is restored.
* **Infinite Scaling Backend**: Serverless AWS Lambda backend (`us-east-1`) that automatically timestamps and uniquely identifies every incoming payload to prevent data collisions and overwriting.

---

## 🧠 Machine Learning Pipeline

Our local C++ TFLite pipeline processes raw camera feeds in 3 stages:

1. **BlazeFace (Scout)**: Scans the live camera feed to detect bounding boxes and dynamically crops the specific face regions.
2. **MobileFaceNet (Identity)**: A specialized neural network trained to ignore textures and evaluate the underlying geometric distance between facial features, generating the Cosine Similarity threshold.
3. **MiniFASNet (Security)**: A separate classifier mathematically tuned via ImageNet Softmax Temperature Scaling (`T=0.5`) to isolate texture-based anomalies and output a Liveness Confidence Score.

---

## 🛠️ Tech Stack

* **Frontend:** React Native (Expo)
* **Native Processing:** React Native Skia, Vision Camera v3, Fast TFLite
* **Local Storage:** SQLite
* **Cloud Infrastructure:** AWS Lambda, Amazon API Gateway, Amazon S3
* **Deployment:** Serverless Framework

---

## 📦 Getting Started

### 1. Prerequisites
* Node.js 18+
* Android Studio (for Android Emulator)
* AWS CLI (Configured with Administrator permissions)
* Serverless Framework (`npm install -g serverless`)

### 2. Deploy the AWS Backend
Navigate to the AWS directory and deploy the serverless stack to spin up your secure S3 Bucket and Lambda functions:
```bash
cd aws
serverless deploy
```
*Note: Make sure to copy the newly generated API endpoints and update `src/services/SyncService.ts` if the region changes.*

### 3. Run the Mobile App
Install all dependencies and compile the local C++ bindings:
```bash
npm install
npx expo run:android
```

### 4. Build a Production APK
To compile a highly-optimized, lightweight Android application (with ProGuard Minification enabled):
```bash
cd android
./gradlew assembleRelease
```
You will find the optimized architecture-specific APK in:
`android/app/build/outputs/apk/release/app-arm64-v8a-release.apk`
