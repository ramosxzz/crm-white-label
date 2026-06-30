import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const R2_PREFIX = "r2://";

function config() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.R2_BUCKET_NAME?.trim();
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;
  return {
    bucket,
    client: new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    }),
  };
}

export function isR2Enabled() {
  return Boolean(config());
}

export function isR2Url(value?: string | null) {
  return Boolean(value?.startsWith(R2_PREFIX));
}

export function r2KeyFromUrl(value: string) {
  return value.replace(R2_PREFIX, "");
}

export async function putR2Object(input: {
  key: string;
  body: Buffer;
  contentType: string;
}) {
  const cfg = config();
  if (!cfg) return null;
  await cfg.client.send(
    new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
      CacheControl: "private, max-age=31536000, immutable",
    }),
  );
  return `${R2_PREFIX}${input.key}`;
}

export async function getR2Object(input: { key: string; range?: string | null }) {
  const cfg = config();
  if (!cfg) return null;
  return cfg.client.send(
    new GetObjectCommand({
      Bucket: cfg.bucket,
      Key: input.key,
      Range: input.range ?? undefined,
    }),
  );
}
