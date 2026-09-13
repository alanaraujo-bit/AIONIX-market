import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/client";
import { env } from "../env";

const s3 =
  env.S3_ENDPOINT && env.S3_BUCKET && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY
    ? new S3Client({
        endpoint: env.S3_ENDPOINT,
        region: env.S3_REGION,
        forcePathStyle: false,
        credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
      })
    : null;

export const storageDriver = s3 ? "s3" : "postgres";

export async function putObject(key: string, body: Buffer, mime: string) {
  if (s3) {
    await s3.send(
      new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: key,
        Body: body,
        ContentType: mime,
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
    return;
  }
  await db
    .insert(schema.mediaBlobs)
    .values({ key, data: body.toString("base64"), mime })
    .onConflictDoNothing();
}

export async function getObject(key: string): Promise<{ body: Buffer; mime: string } | null> {
  if (s3) {
    try {
      const res = await s3.send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
      if (!res.Body) return null;
      const bytes = await res.Body.transformToByteArray();
      return { body: Buffer.from(bytes), mime: res.ContentType ?? "application/octet-stream" };
    } catch {
      // fall through to the Postgres fallback (e.g. objects created before the bucket existed)
    }
  }
  const [row] = await db.select().from(schema.mediaBlobs).where(eq(schema.mediaBlobs.key, key)).limit(1);
  return row ? { body: Buffer.from(row.data, "base64"), mime: row.mime } : null;
}
