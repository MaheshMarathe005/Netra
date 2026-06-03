import SQLite from 'react-native-sqlite-storage';
import CryptoJS from 'crypto-js';
import { schema } from '../database/schema';

SQLite.enablePromise(true);

export interface Personnel {
  id?: number;
  name: string;
  embedding: string;
}

export interface AttendanceRecord {
  id?: number;
  personId: number;
  livenessMethod: string;
  confidence: number;
  synced?: boolean;
}

export class StorageService {
  private db: SQLite.SQLiteDatabase | null = null;
  private key: string;

  constructor(encryptionKey: string) {
    this.key = encryptionKey;
  }

  async initDB(): Promise<void> {
    if (this.db) return; // Prevent double-init
    this.db = await SQLite.openDatabase({
      name: 'netra.db',
      location: 'default',
      // @ts-ignore - cipher support in fork
      key: this.key
    });
    // Execute schema statements one-by-one (multi-statement not supported in some drivers)
    const statements = schema.split(';').filter(s => s.trim().length > 0);
    for (const stmt of statements) {
      await this.db.executeSql(stmt + ';');
    }
  }

  private ensureDB(): SQLite.SQLiteDatabase {
    if (!this.db) throw new Error('DB not initialized. Call initDB() first.');
    return this.db;
  }

  // --- Personnel / Enrollment ---

  async enrollPerson(name: string, embedding: string): Promise<number> {
    const db = this.ensureDB();
    const checksum = CryptoJS.SHA256(embedding).toString();
    const [results] = await db.executeSql(
      'INSERT INTO Personnel (name, embedding_blob, embedding_checksum) VALUES (?, ?, ?)',
      [name, embedding, checksum]
    );
    return results.insertId;
  }

  async getEmbedding(personId: number): Promise<string> {
    const db = this.ensureDB();
    const [results] = await db.executeSql(
      'SELECT embedding_blob, embedding_checksum FROM Personnel WHERE id = ?',
      [personId]
    );
    if (results.rows.length === 0) {
      throw new Error(`Person with id ${personId} not found`);
    }
    const row = results.rows.item(0);
    // Validate integrity
    const actualChecksum = CryptoJS.SHA256(row.embedding_blob).toString();
    if (actualChecksum !== row.embedding_checksum) {
      throw new Error(`Embedding integrity check failed for person ${personId}. Data may be tampered.`);
    }
    return row.embedding_blob;
  }

  async getAllPersonnel(): Promise<Personnel[]> {
    const db = this.ensureDB();
    const [results] = await db.executeSql('SELECT id, name, embedding_blob as embedding FROM Personnel ORDER BY enrolled_at DESC');
    const people: Personnel[] = [];
    for (let i = 0; i < results.rows.length; i++) {
      people.push(results.rows.item(i));
    }
    return people;
  }

  // --- Attendance ---

  async saveAttendance(personId: number, livenessMethod: string, confidence: number): Promise<number> {
    const db = this.ensureDB();
    const [results] = await db.executeSql(
      'INSERT INTO AttendanceLog (personnel_id, liveness_method, confidence) VALUES (?, ?, ?)',
      [personId, livenessMethod, confidence]
    );
    const recordId = results.insertId;
    // Queue for sync
    await db.executeSql(
      'INSERT INTO SyncQueue (record_id, type) VALUES (?, ?)',
      [recordId, 'ATTENDANCE']
    );
    return recordId;
  }

  // --- Sync ---

  async getPendingSync(): Promise<any[]> {
    const db = this.ensureDB();
    const [results] = await db.executeSql(`
      SELECT sq.id as queueId, sq.record_id, sq.type, 
             al.personnel_id, al.timestamp, al.liveness_method, al.confidence 
      FROM SyncQueue sq
      JOIN AttendanceLog al ON sq.record_id = al.id
      ORDER BY sq.created_at ASC
    `);
    const pending: any[] = [];
    for (let i = 0; i < results.rows.length; i++) {
      pending.push(results.rows.item(i));
    }
    return pending;
  }

  async getSyncQueueCount(): Promise<number> {
    const db = this.ensureDB();
    const [results] = await db.executeSql('SELECT COUNT(*) as cnt FROM SyncQueue');
    return results.rows.item(0).cnt;
  }

  async markSynced(queueId: number, recordId: number): Promise<void> {
    const db = this.ensureDB();
    await db.executeSql('UPDATE AttendanceLog SET synced = 1 WHERE id = ?', [recordId]);
    await db.executeSql('DELETE FROM SyncQueue WHERE id = ?', [queueId]);
  }

  async incrementRetry(queueId: number): Promise<void> {
    const db = this.ensureDB();
    await db.executeSql('UPDATE SyncQueue SET retries = retries + 1 WHERE id = ?', [queueId]);
  }

  // --- Purge ---

  async purgeAttendanceLogs(): Promise<number> {
    const db = this.ensureDB();
    const [results] = await db.executeSql(`
      DELETE FROM AttendanceLog 
      WHERE synced = 1 AND timestamp < datetime('now', '-1 day')
    `);
    return results.rowsAffected;
  }

  // --- Cleanup ---

  async closeDB(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
    }
  }
}
