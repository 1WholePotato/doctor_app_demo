import type { S3Client } from "@aws-sdk/client-s3";

/**
 * Cloudflare R2 / S3-compatible client configuration
 * Can be tested locally using wrangler dev (e.g., http://localhost:8787 or miniflare)
 * or connected to Cloudflare R2 in staging/production.
 */

const accountId = import.meta.env.VITE_R2_ACCOUNT_ID ?? "";
const accessKeyId = import.meta.env.VITE_R2_ACCESS_KEY_ID ?? "";
const secretAccessKey = import.meta.env.VITE_R2_SECRET_ACCESS_KEY ?? "";
export const R2_BUCKET = import.meta.env.VITE_R2_BUCKET_NAME ?? "doctor-app-certificates";
export const R2_PUBLIC_BASE_URL = import.meta.env.VITE_R2_PUBLIC_URL ?? "";

// If running locally against wrangler dev or custom local S3 mock:
const localEndpoint = import.meta.env.VITE_R2_ENDPOINT;
const endpoint = localEndpoint || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined);

let s3ClientInstance: S3Client | null = null;

async function getS3Client(): Promise<S3Client> {
  if (s3ClientInstance) return s3ClientInstance;
  const { S3Client: S3ClientClass } = await import("@aws-sdk/client-s3");
  s3ClientInstance = new S3ClientClass({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    forcePathStyle: true,
  });
  return s3ClientInstance;
}

/**
 * Uploads a course completion certificate PDF to Cloudflare R2
 * Dynamically imports AWS S3 client to keep bundle lean.
 */
export async function uploadCertificateToR2(
  key: string,
  pdfBytes: Uint8Array,
  contentType = "application/pdf"
): Promise<{ success: boolean; url: string; error?: string }> {
  try {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await getS3Client();

    const command = new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: pdfBytes,
      ContentType: contentType,
    });

    await client.send(command);

    const publicUrl = R2_PUBLIC_BASE_URL
      ? `${R2_PUBLIC_BASE_URL.replace(/\/$/, "")}/${key}`
      : `${endpoint}/${R2_BUCKET}/${key}`;

    return {
      success: true,
      url: publicUrl,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to upload certificate to R2";
    console.warn("R2 upload warning (falling back to direct download):", message);
    return {
      success: false,
      url: "",
      error: message,
    };
  }
}

/**
 * Builds public or storage URL for a certificate
 */
export function getCertificateUrl(key: string): string {
  if (R2_PUBLIC_BASE_URL) {
    return `${R2_PUBLIC_BASE_URL.replace(/\/$/, "")}/${key}`;
  }
  return `${endpoint}/${R2_BUCKET}/${key}`;
}
