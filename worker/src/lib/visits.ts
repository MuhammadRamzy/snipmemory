import type { PhotoRow, VisitRow } from '../types';
import { all } from './db';
import { serializeVisit } from './serialize';

type VisitWithNames = VisitRow & { stylist_name: string | null; salon_name: string | null };

/** Loads visits (with stylist/salon names and photos). `where` is applied to alias `v`. */
export async function loadVisits(db: D1Database, where: string, params: unknown[], limit = 200) {
  const visits = await all<VisitWithNames>(
    db,
    `SELECT v.*, m.display_name AS stylist_name, s.name AS salon_name
     FROM visits v LEFT JOIN members m ON m.id = v.member_id JOIN salons s ON s.id = v.salon_id
     WHERE v.deleted_at IS NULL AND (${where}) ORDER BY v.created_at DESC LIMIT ${Number(limit)}`,
    ...params,
  );
  const photos: PhotoRow[] = [];
  const ids = visits.map((v) => v.id);
  for (let i = 0; i < ids.length; i += 90) {
    const chunk = ids.slice(i, i + 90);
    photos.push(
      ...(await all<PhotoRow>(db, `SELECT * FROM photos WHERE visit_id IN (${chunk.map(() => '?').join(',')}) ORDER BY created_at`, ...chunk)),
    );
  }
  return visits.map((v) => serializeVisit(v, photos));
}

/** Deletes photo objects from R2 and their rows. */
export async function purgePhotos(db: D1Database, bucket: R2Bucket, photos: Pick<PhotoRow, 'id' | 'r2_key'>[]) {
  for (let i = 0; i < photos.length; i += 90) {
    const chunk = photos.slice(i, i + 90);
    await bucket.delete(chunk.map((p) => p.r2_key));
    await db.prepare(`DELETE FROM photos WHERE id IN (${chunk.map(() => '?').join(',')})`).bind(...chunk.map((p) => p.id)).run();
  }
}
