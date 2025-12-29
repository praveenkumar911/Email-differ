import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const MINIO_ENDPOINT = "https://pl-minio.iiit.ac.in";
const REGION = "us-east-1";
const ACCESS_KEY = "minioadmin";
const SECRET_KEY = "minioadmin";
const BUCKET_NAME = "org-c4gt";

const s3 = new S3Client({
  region: REGION,
  endpoint: MINIO_ENDPOINT,
  credentials: {
    accessKeyId: ACCESS_KEY,
    secretAccessKey: SECRET_KEY,
  },
  forcePathStyle: true,

  requestChecksumCalculation: "WHEN_REQUIRED",
});

export async function uploadImageToMinio(file, customName = "") {
  if (!file) {
    console.log(" No file provided");
    return null;
  }

  try {
    const extension = file.name.split(".").pop();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `${customName}_${timestamp}.${extension}`;

    const arrayBuffer = await file.arrayBuffer();
    const fileBytes = new Uint8Array(arrayBuffer);

    const uploadParams = {
      Bucket: BUCKET_NAME,
      Key: fileName,
      Body: fileBytes,
      ContentType: file.type,
      ContentLength: fileBytes.length,
    };

    const command = new PutObjectCommand(uploadParams);
    await s3.send(command);

    const imageUrl = `${MINIO_ENDPOINT}/${BUCKET_NAME}/${fileName}`;
    console.log("Uploaded successfully:", imageUrl);

    return imageUrl;
  } catch (err) {
    console.error(" Upload failed:", err);
    throw err;
  }
}
