import { BigQuery } from '@google-cloud/bigquery';
import fs from 'fs';
import path from 'path';

let bqClient: BigQuery | null = null;

function getClient(): BigQuery {
  if (!bqClient) {
    const projectId = process.env.BQ_PROJECT || 'high-nature-319701';
    const credsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    
    if (credsJson) {
      try {
        const credentials = JSON.parse(credsJson);
        bqClient = new BigQuery({ projectId, credentials });
      } catch {
        bqClient = new BigQuery({ projectId });
      }
    } else {
      const keyFilePath = path.resolve(process.cwd(), 'service-account.json');
      if (fs.existsSync(keyFilePath)) {
        bqClient = new BigQuery({ projectId, keyFilename: keyFilePath });
      } else {
        bqClient = new BigQuery({ projectId });
      }
    }
  }
  return bqClient;
}

interface CacheEntry {
  data: unknown;
  expiresAt: number;
}
const cache = new Map<string, CacheEntry>();

const CACHE_TTL_MS = (parseInt(process.env.CACHE_TTL_MINUTES || '60') || 60) * 60 * 1000;

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

// Função helper para obter PROJECT e DS
export function getBQConfig() {
  return {
    PROJECT: process.env.BQ_PROJECT || 'high-nature-319701',
    DATASET: process.env.BQ_DATASET || 'vtntprod_vitta_core',
  };
}