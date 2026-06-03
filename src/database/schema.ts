export const schema = `
  CREATE TABLE IF NOT EXISTS Personnel (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    embedding_blob TEXT NOT NULL,
    embedding_checksum TEXT NOT NULL,
    enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS AttendanceLog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    personnel_id INTEGER NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    liveness_method TEXT,
    confidence REAL,
    synced INTEGER DEFAULT 0,
    FOREIGN KEY (personnel_id) REFERENCES Personnel(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS SyncQueue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_id INTEGER NOT NULL,
    type TEXT NOT NULL DEFAULT 'ATTENDANCE',
    retries INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (record_id) REFERENCES AttendanceLog(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_attendance_synced ON AttendanceLog(synced);
  CREATE INDEX IF NOT EXISTS idx_attendance_personnel ON AttendanceLog(personnel_id);
  CREATE INDEX IF NOT EXISTS idx_syncqueue_retries ON SyncQueue(retries);
  CREATE INDEX IF NOT EXISTS idx_personnel_name ON Personnel(name);
`;
