# Netra Identity — Security Threat Model

## Overview
This document outlines identified security threats and their mitigations in the Netra Identity facial recognition system for NHAI field personnel authentication.

---

## 1. Local Data Protection

| Threat | Mitigation | Status |
|--------|-----------|--------|
| Unauthorized access to face embeddings stored on device | SQLite database encrypted using SQLCipher with AES-256, key derived via PBKDF2 (100,000 iterations) | ✅ Implemented |
| Key extraction from device memory | Encryption key stored in platform Keychain (Android Keystore / iOS Keychain), inaccessible to other apps | ✅ Implemented |
| Data tampering | SHA-256 checksums stored alongside each embedding; integrity verified on every read via `StorageService.getEmbedding()` | ✅ Implemented |

## 2. Compromised Device Detection

| Threat | Mitigation | Status |
|--------|-----------|--------|
| Rooted/jailbroken device allowing memory inspection | `jail-monkey` library checks for root/jailbreak status on every app launch; blocks all operations if detected | ✅ Implemented |
| Mock GPS location injection | `JailMonkey.canMockLocation()` detection integrated into `SecurityService.isDeviceCompromised()` | ✅ Implemented |
| Runtime on compromised device | `AppServicesProvider` checks device compromise status during bootstrap; displays security error and blocks service initialization | ✅ Implemented |

## 3. Data Integrity

| Threat | Mitigation | Status |
|--------|-----------|--------|
| Database record manipulation | SHA-256 embedding checksums validated on retrieval; mismatch throws `Error("Data may be tampered")` | ✅ Implemented |
| Attendance record falsification | Foreign key constraints between `AttendanceLog → Personnel` and `SyncQueue → AttendanceLog` tables | ✅ Implemented |
| Database query performance degradation | Indexes on `synced`, `personnel_id`, `retries`, and `name` columns | ✅ Implemented |

## 4. Network Security (Man-in-the-Middle)

| Threat | Mitigation | Status |
|--------|-----------|--------|
| Interception of sync payloads | HTTPS enforced for all API Gateway communication (TLS 1.2+) | ✅ Implemented |
| Replay attacks on sync endpoint | Each attendance record has a unique auto-increment ID and timestamp | ✅ Implemented |
| SSL Certificate Pinning | Pin API Gateway certificate in Axios configuration to prevent proxy interception | ⚠️ Planned |
| API authentication | Add API key or JWT token to API Gateway requests | ⚠️ Planned |

## 5. Cloud Storage Security

| Threat | Mitigation | Status |
|--------|-----------|--------|
| Unauthorized S3 bucket access | AES-256 Server-Side Encryption (SSE-S3) configured in `serverless.yml` | ✅ Implemented |
| Over-permissioned IAM roles | Lambda function has only `s3:PutObject` permission (least privilege) | ✅ Implemented |
| Data retention overflow | Synced records older than 24 hours are automatically purged from local storage via `StorageService.purgeAttendanceLogs()` | ✅ Implemented |

## 6. Anti-Spoofing (Presentation Attack Detection)

| Threat | Mitigation | Status |
|--------|-----------|--------|
| Photo/video replay attack | MiniFASNet passive anti-spoofing model runs on every frame in real-time | ✅ Implemented |
| Printed mask attack | Active liveness challenge (blink detection) during 5-second probe | ✅ Implemented |
| Single-frame spoofing | Liveness score averaged across multiple samples during challenge period; must exceed threshold (50%) | ✅ Implemented |
| Deepfake injection | On-device TFLite inference via JSI bridge; no network-based image transfer that could be intercepted | ✅ Implemented |

---

## Architecture Security Stack

```
┌─────────────────────────────────────────────┐
│              NETRA IDENTITY APP              │
├─────────────────────────────────────────────┤
│  SecurityService                             │
│  ├── Device Compromise Check (jail-monkey)   │
│  ├── PBKDF2 Key Derivation (100k iter)       │
│  ├── Keychain Storage (react-native-keychain)│
│  └── SHA-256 Checksums                       │
├─────────────────────────────────────────────┤
│  StorageService (SQLCipher AES-256)          │
│  ├── Personnel + Embeddings (with checksum)  │
│  ├── AttendanceLog (FK → Personnel)          │
│  └── SyncQueue (FK → AttendanceLog)          │
├─────────────────────────────────────────────┤
│  SyncService (Offline-First)                 │
│  ├── Exponential Backoff (1s → 2s → 4s)     │
│  ├── Batch Upload (20 records/batch)         │
│  ├── Network State Monitoring (NetInfo)      │
│  └── Auto-sync on connectivity restore       │
├─────────────────────────────────────────────┤
│  ML Pipeline (On-Device TFLite via JSI)      │
│  ├── BlazeFace: Face Detection (128x128)     │
│  ├── MobileFaceNet: Embedding (112x112)      │
│  ├── MiniFASNet: Anti-Spoof (80x80)          │
│  └── Cosine Similarity Matching              │
├─────────────────────────────────────────────┤
│  AWS Backend (Serverless)                    │
│  ├── API Gateway + CORS                      │
│  ├── Lambda (Node.js 18)                     │
│  └── S3 (SSE-S3 AES-256)                     │
└─────────────────────────────────────────────┘
```
