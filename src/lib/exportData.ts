import { 
  collection, 
  getDocs, 
  query, 
  limit, 
  startAfter, 
  QueryDocumentSnapshot,
  Timestamp 
} from 'firebase/firestore';
import { db } from './firebase';

export interface ExportCollectionStats {
  [collectionName: string]: number;
}

export interface ExportResult {
  counts: ExportCollectionStats;
  totalDocs: number;
  filename: string;
  timestamp: string;
  data: {
    collections: Record<string, Array<Record<string, unknown>>>;
  };
}

/**
 * Recursively converts Firestore Timestamps to ISO-8601 strings.
 * Keeps dates that are already strings unchanged.
 * Preserves all other primitive values, nulls, arrays, and objects verbatim.
 */
export function serializeFirestoreValue(val: unknown): unknown {
  if (val === null || val === undefined) {
    return val;
  }
  // Check for Firestore Timestamp instance
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  // Duck typing for Timestamp object (e.g. from cache or SDK)
  if (typeof val === 'object' && val !== null && 'toDate' in val && typeof (val as { toDate: () => Date }).toDate === 'function') {
    return (val as { toDate: () => Date }).toDate().toISOString();
  }
  // Duck typing for raw Firestore seconds + nanoseconds representation
  if (
    typeof val === 'object' &&
    val !== null &&
    'seconds' in val &&
    'nanoseconds' in val &&
    typeof (val as { seconds: unknown }).seconds === 'number' &&
    typeof (val as { nanoseconds: unknown }).nanoseconds === 'number'
  ) {
    const raw = val as { seconds: number; nanoseconds: number };
    const ms = raw.seconds * 1000 + Math.floor(raw.nanoseconds / 1000000);
    return new Date(ms).toISOString();
  }
  // Native Date object
  if (val instanceof Date) {
    return val.toISOString();
  }
  // Arrays: recursively process items
  if (Array.isArray(val)) {
    return val.map(serializeFirestoreValue);
  }
  // Plain objects: recursively process keys without dropping empty values
  if (typeof val === 'object') {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(val)) {
      result[key] = serializeFirestoreValue((val as Record<string, unknown>)[key]);
    }
    return result;
  }
  // Strings (including string dates like '2026-03-01' or '2026-03-01T00:00:00Z'), numbers, booleans
  return val;
}

/**
 * Paged retrieval of all documents in a collection.
 * Uses Firestore query with pagination (limit + startAfter cursor)
 * to guarantee no documents are missed even in large collections.
 */
async function fetchEntireCollection(
  collectionName: string, 
  onProgress?: (count: number) => void
): Promise<Array<Record<string, unknown>>> {
  const colRef = collection(db, collectionName);
  const PAGE_SIZE = 250;
  const docsList: Array<Record<string, unknown>> = [];
  let lastVisible: QueryDocumentSnapshot | null = null;
  let keepFetching = true;

  while (keepFetching) {
    const q = lastVisible 
      ? query(colRef, limit(PAGE_SIZE), startAfter(lastVisible))
      : query(colRef, limit(PAGE_SIZE));

    const snap = await getDocs(q);

    if (snap.empty) {
      break;
    }

    for (const docSnap of snap.docs) {
      const rawData = docSnap.data();
      const serializedData = serializeFirestoreValue(rawData) as Record<string, unknown>;
      docsList.push({
        id: docSnap.id,
        ...serializedData
      });
    }

    if (onProgress) {
      onProgress(docsList.length);
    }

    lastVisible = snap.docs[snap.docs.length - 1];

    if (snap.docs.length < PAGE_SIZE) {
      keepFetching = false;
    }
  }

  return docsList;
}

/**
 * Exports every Firestore collection used by the app into ONE single JSON file.
 * Structure: { "collections": { "<collectionName>": [ { "id": "<docId>", ...fields } ] } }
 * Downloads directly to user's computer via browser Blob (no network transfer).
 */
export async function exportAllData(
  onProgressUpdate?: (collectionName: string, currentCount: number) => void
): Promise<ExportResult> {
  const collectionNames = ['members', 'payments', 'settings'];
  const collectionsData: Record<string, Array<Record<string, unknown>>> = {};
  const stats: ExportCollectionStats = {};
  let totalDocs = 0;

  for (const colName of collectionNames) {
    if (onProgressUpdate) {
      onProgressUpdate(colName, 0);
    }
    const docs = await fetchEntireCollection(colName, (count) => {
      if (onProgressUpdate) {
        onProgressUpdate(colName, count);
      }
    });
    collectionsData[colName] = docs;
    stats[colName] = docs.length;
    totalDocs += docs.length;
  }

  const exportPayload = {
    collections: collectionsData
  };

  // Generate date filename: export-YYYY-MM-DD.json
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const filename = `export-${year}-${month}-${day}.json`;

  // Trigger browser download via Blob
  const jsonContent = JSON.stringify(exportPayload, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return {
    counts: stats,
    totalDocs,
    filename,
    timestamp: new Date().toISOString(),
    data: exportPayload
  };
}
