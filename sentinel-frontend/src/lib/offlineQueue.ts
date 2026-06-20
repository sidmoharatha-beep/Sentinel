// Offline scan queue — uses IndexedDB (built into every browser, zero cost,
// zero external dependencies) to store patrol scans made while offline,
// then syncs them automatically once network returns.

const DB_NAME = 'sentinel_offline';
const DB_VERSION = 1;
const STORE = 'pending_scans';

export interface QueuedScan {
  id?: number;
  patrolId: number;
  checkpointId: number;
  checkpointName: string;
  notes: string | null;
  latitude: number | null;
  longitude: number | null;
  mockGpsFlag: boolean;
  checklist_responses: { checklist_item_id: number; response: string; notes: null }[];
  photoBlob: Blob;
  incidentPhotoBlob: Blob | null;
  queuedAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function queueOfflineScan(scan: QueuedScan): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).add(scan);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getQueuedScans(): Promise<QueuedScan[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as QueuedScan[]);
    req.onerror = () => reject(req.error);
  });
}

export async function getQueuedScanCount(): Promise<number> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteQueuedScan(id: number): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Attempts to sync all queued scans to the server. Call this on 'online'
// event or periodically. Returns { synced, failed } counts.
export async function syncQueuedScans(
  uploadPhoto: (patrolId: number, checkpointId: number, blob: Blob) => Promise<{ photo_url: string }>,
  postScan: (patrolId: number, body: any) => Promise<any>
): Promise<{ synced: number; failed: number }> {
  const scans = await getQueuedScans();
  let synced = 0, failed = 0;

  for (const scan of scans) {
    try {
      const photoResult = await uploadPhoto(scan.patrolId, scan.checkpointId, scan.photoBlob);
      let incidentPhotoUrl: string | null = null;
      if (scan.incidentPhotoBlob) {
        const incidentUpload = await uploadPhoto(scan.patrolId, scan.checkpointId, scan.incidentPhotoBlob);
        incidentPhotoUrl = incidentUpload.photo_url;
      }
      await postScan(scan.patrolId, {
        checkpoint_id: scan.checkpointId,
        notes: scan.notes,
        latitude: scan.latitude,
        longitude: scan.longitude,
        photo_url: photoResult.photo_url,
        incident_photo_url: incidentPhotoUrl,
        mock_gps_flag: scan.mockGpsFlag ? 1 : 0,
        checklist_responses: scan.checklist_responses,
        offline_queued_at: scan.queuedAt,
      });
      if (scan.id != null) await deleteQueuedScan(scan.id);
      synced++;
    } catch {
      failed++;
      // leave in queue, will retry next sync attempt
    }
  }
  return { synced, failed };
}
