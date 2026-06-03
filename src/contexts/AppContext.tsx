import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

import { SecurityService } from '../services/SecurityService';
import { StorageService } from '../services/StorageService';
import { SyncService } from '../services/SyncService';

// ── Types ────────────────────────────────────────────────────────────────────

interface AppServicesContextValue {
  storage: StorageService | null;
  sync: SyncService | null;
  security: typeof SecurityService;
  isReady: boolean;
  error: string | null;
  syncQueueCount: number;
  refreshSyncCount: () => Promise<void>;
}

// ── Context ──────────────────────────────────────────────────────────────────

const AppServicesContext = createContext<AppServicesContextValue | null>(null);

// ── Sync-count polling interval (ms) ─────────────────────────────────────────

const SYNC_POLL_INTERVAL_MS = 30_000; // 30 seconds

// ── Provider ─────────────────────────────────────────────────────────────────

interface AppServicesProviderProps {
  children: ReactNode;
}

export const AppServicesProvider: React.FC<AppServicesProviderProps> = ({ children }) => {
  const [storage, setStorage] = useState<StorageService | null>(null);
  const [sync, setSync] = useState<SyncService | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncQueueCount, setSyncQueueCount] = useState(0);

  // Refs to hold instances for cleanup without triggering re-renders
  const storageRef = useRef<StorageService | null>(null);
  const syncRef = useRef<SyncService | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  // ── Refresh sync queue count ───────────────────────────────────────────────

  const refreshSyncCount = useCallback(async () => {
    try {
      if (storageRef.current) {
        const count = await storageRef.current.getSyncQueueCount();
        if (mountedRef.current) {
          setSyncQueueCount(count);
        }
      }
    } catch (_err) {
      // Silently ignore – the count is non-critical UI sugar
    }
  }, []);

  // ── Bootstrap services ─────────────────────────────────────────────────────

  useEffect(() => {
    mountedRef.current = true;

    const bootstrap = async () => {
      try {
        // 1. Device-compromise check (temporarily disabled for hackathon / dev environments)
        // if (SecurityService.isDeviceCompromised()) {
        //   setError(
        //     'Security alert: this device appears to be rooted or jailbroken. ' +
        //       'The app cannot run on a compromised device.',
        //   );
        //   return;
        // }

        // 2. Obtain (or create) the encryption key
        const encryptionKey = await SecurityService.getOrCreateEncryptionKey();

        // 3. Initialise StorageService
        const storageInstance = new StorageService(encryptionKey);
        await storageInstance.initDB();

        if (!mountedRef.current) {
          // Component unmounted while we were awaiting – tear down immediately
          await storageInstance.closeDB();
          return;
        }

        storageRef.current = storageInstance;
        setStorage(storageInstance);

        // 4. Initialise SyncService with a stable device UUID
        const deviceId = uuidv4();
        const syncInstance = new SyncService(storageInstance, deviceId);
        syncInstance.startNetworkListener();

        if (!mountedRef.current) {
          syncInstance.stopNetworkListener();
          await storageInstance.closeDB();
          return;
        }

        syncRef.current = syncInstance;
        setSync(syncInstance);

        // 5. Initial sync-queue count
        const initialCount = await storageInstance.getSyncQueueCount();
        if (mountedRef.current) {
          setSyncQueueCount(initialCount);
        }

        // 6. Start periodic sync-count polling
        pollTimerRef.current = setInterval(async () => {
          if (!mountedRef.current || !storageRef.current) return;
          try {
            const count = await storageRef.current.getSyncQueueCount();
            if (mountedRef.current) {
              setSyncQueueCount(count);
            }
          } catch {
            // non-critical
          }
        }, SYNC_POLL_INTERVAL_MS);

        // 7. Mark ready
        setIsReady(true);
      } catch (err: unknown) {
        console.error("AppContext Bootstrap Error: ", err);
        if (mountedRef.current) {
          const message =
            err instanceof Error ? err.message : 'An unknown error occurred during initialisation.';
          setError(message);
        }
      }
    };

    bootstrap();

    // ── Cleanup ────────────────────────────────────────────────────────────

    return () => {
      mountedRef.current = false;

      // Stop polling
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }

      // Stop network listener
      if (syncRef.current) {
        syncRef.current.stopNetworkListener();
        syncRef.current = null;
      }

      // Close the database
      if (storageRef.current) {
        storageRef.current.closeDB().catch(() => {});
        storageRef.current = null;
      }
    };
  }, []); // runs once on mount

  // ── Render ─────────────────────────────────────────────────────────────────

  const value: AppServicesContextValue = {
    storage,
    sync,
    security: SecurityService,
    isReady,
    error,
    syncQueueCount,
    refreshSyncCount,
  };

  return (
    <AppServicesContext.Provider value={value}>
      {children}
    </AppServicesContext.Provider>
  );
};

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useAppServices(): AppServicesContextValue {
  const context = useContext(AppServicesContext);
  if (!context) {
    throw new Error(
      'useAppServices must be used within an <AppServicesProvider>. ' +
        'Wrap your root component with <AppServicesProvider>.',
    );
  }
  return context;
}
