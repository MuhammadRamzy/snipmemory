export const now = () => Date.now();
export const DAY = 86_400_000;
export const HOUR = 3_600_000;
export const MINUTE = 60_000;

export async function first<T>(db: D1Database, sql: string, ...params: unknown[]): Promise<T | null> {
  return db.prepare(sql).bind(...params).first<T>();
}

export async function all<T>(db: D1Database, sql: string, ...params: unknown[]): Promise<T[]> {
  const { results } = await db.prepare(sql).bind(...params).all<T>();
  return results;
}

export async function run(db: D1Database, sql: string, ...params: unknown[]): Promise<D1Result> {
  return db.prepare(sql).bind(...params).run();
}

/** Counts rows; `sql` must select a single column named `n`. */
export async function count(db: D1Database, sql: string, ...params: unknown[]): Promise<number> {
  const row = await first<{ n: number | null }>(db, sql, ...params);
  return row?.n ?? 0;
}
