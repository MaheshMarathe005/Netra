import axios from 'axios';
import NetInfo, { NetInfoSubscription } from '@react-native-community/netinfo';
import { StorageService } from './StorageService';

const API_ENDPOINT = 'https://01athtsk9d.execute-api.us-east-1.amazonaws.com/dev/sync';
const MAX_RETRIES = 3;
const BATCH_SIZE = 20;

export class SyncService {
  private storage: StorageService;
  private deviceId: string;
  private isSyncing: boolean = false;
  private unsubscribe: NetInfoSubscription | null = null;

  constructor(storage: StorageService, deviceId: string) {
    this.storage = storage;
    this.deviceId = deviceId;
  }

  startNetworkListener() {
    this.unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected && state.isInternetReachable) {
        // Automatically push local changes to S3
        this.syncPendingRecords();
        // Automatically pull remote changes from S3 in the background
        this.fetchCloudPersonnel();
      }
    });
  }

  stopNetworkListener() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async syncPendingRecords() {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      const pendingRecords = await this.storage.getPendingSync();
      if (pendingRecords.length === 0) return;

      // Batch records for efficient upload
      for (let i = 0; i < pendingRecords.length; i += BATCH_SIZE) {
        const batch = pendingRecords.slice(i, i + BATCH_SIZE);
        await this.syncBatchWithRetry(batch);
      }

      // Purge old synced records after successful sync
      await this.storage.purgeAttendanceLogs();
    } catch (error) {
      console.error('Sync pipeline error:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  private async syncBatchWithRetry(batch: any[]) {
    const payload = {
      deviceId: this.deviceId,
      records: batch,
    };

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const response = await axios.post(API_ENDPOINT, payload, {
          timeout: 15000,
          headers: { 'Content-Type': 'application/json' },
        });

        if (response.status === 200) {
          for (const record of batch) {
            await this.storage.markSynced(record.queueId, record.record_id || record.id, record.type);
          }
          return; // Success — exit retry loop
        }
      } catch (error) {
        console.warn(`Sync attempt ${attempt + 1}/${MAX_RETRIES} failed:`, error);
        if (attempt < MAX_RETRIES - 1) {
          // Exponential backoff: 1s, 2s, 4s
          const backoffMs = Math.pow(2, attempt) * 1000;
          await this.delay(backoffMs);
        } else {
          // Final attempt failed — increment retries in DB
          for (const record of batch) {
            await this.storage.incrementRetry(record.queueId);
          }
        }
      }
    }
  }

  async fetchCloudPersonnel(): Promise<number> {
    try {
      const getUrl = API_ENDPOINT.replace('/sync', '/personnel');
      const response = await axios.get(getUrl, { timeout: 15000 });
      if (response.status === 200 && response.data && response.data.personnel) {
        let addedCount = 0;
        const localPersonnel = await this.storage.getAllPersonnel();
        const localNames = new Set(localPersonnel.map(p => p.name));
        
        for (const cloudPerson of response.data.personnel) {
          if (!localNames.has(cloudPerson.name) && cloudPerson.embedding_blob) {
            // Save cloud user locally, bypassing the sync queue (so it doesn't upload again)
            const db = (this.storage as any).ensureDB();
            await db.executeSql(
              'INSERT INTO Personnel (name, embedding_blob, embedding_checksum) VALUES (?, ?, ?)',
              [cloudPerson.name, cloudPerson.embedding_blob, cloudPerson.embedding_checksum]
            );
            addedCount++;
          }
        }
        return addedCount;
      }
    } catch (error) {
      console.warn('Failed to fetch cloud personnel:', error);
    }
    return 0;
  }
}
