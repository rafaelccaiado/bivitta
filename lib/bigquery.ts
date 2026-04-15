import { BigQuery } from '@google-cloud/bigquery';
import path from 'path';

const PROJECT = 'high-nature-319701';
const DATASET = 'vtntprod_vitta_core';

// Singleton BigQuery client
let bqClient: BigQuery | null = null;

function getClient(): BigQuery {
  if (!bqClient) {
    const keyFilePath = path.resolve(process.cwd(), 'service-account.json');
    bqClient = new BigQuery({
      projectId: PROJECT,
      keyFilename: keyFilePath,
    });
  }
  return bqClient;
}

// In-memory cache
interface CacheEntry {
  data: unknown;
  expiresAt: number;
}
const cache = new Map<string, CacheEntry>();

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function runQuery<T = Record<string, unknown>>(
  sql: string,
  ttlMs: number = CACHE_TTL_MS
): Promise<T[]> {
  const cacheKey = sql.trim();
  const now = Date.now();

  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.data as T[];
  }

  const bq = getClient();
  const [rows] = await bq.query({ query: sql, location: 'US' });

  // Convert BigQuery special types (dates, etc)
  const normalized = rows.map((row: Record<string, unknown>) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      if (v && typeof v === 'object' && 'value' in (v as object)) {
        out[k] = (v as { value: string }).value;
      } else {
        out[k] = v;
      }
    }
    return out;
  });

  cache.set(cacheKey, { data: normalized, expiresAt: now + ttlMs });
  return normalized as T[];
}

export const BQ = { PROJECT, DATASET };
