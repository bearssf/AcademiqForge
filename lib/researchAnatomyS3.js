const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { trimBedrockEnv } = require('./bedrockReview');

function getBucket() {
  return trimBedrockEnv(process.env.RESEARCH_ANATOMY_S3_BUCKET) || 'academiqforgedocs';
}

function getRegion() {
  return trimBedrockEnv(process.env.AWS_REGION) || 'us-east-1';
}

function isS3Configured() {
  return Boolean(trimBedrockEnv(process.env.AWS_REGION) && getBucket());
}

function s3Client() {
  return new S3Client({ region: getRegion() });
}

/**
 * @param {{ userId: number, projectId: number, runId: number|string }} ctx
 */
function expectedKeyPrefix(ctx) {
  return `users/${ctx.userId}/projects/${ctx.projectId}/ra/`;
}

function buildObjectKey(ctx, uniqueSuffix) {
  return `${expectedKeyPrefix(ctx)}${uniqueSuffix}`;
}

async function presignPutResearchDocument(ctx, uniqueSuffix, contentType) {
  const Bucket = getBucket();
  const Key = buildObjectKey(ctx, uniqueSuffix);
  const client = s3Client();
  const ct =
    contentType && String(contentType).trim()
      ? String(contentType).trim()
      : 'text/plain; charset=utf-8';
  const cmd = new PutObjectCommand({
    Bucket,
    Key,
    ContentType: ct,
  });
  const uploadUrl = await getSignedUrl(client, cmd, { expiresIn: 3600 });
  return { uploadUrl, bucket: Bucket, key: Key, contentType: ct };
}

async function getObjectText(Key) {
  const client = s3Client();
  const res = await client.send(
    new GetObjectCommand({
      Bucket: getBucket(),
      Key,
    })
  );
  const chunks = [];
  for await (const c of res.Body) {
    chunks.push(c);
  }
  return Buffer.concat(chunks).toString('utf8');
}

module.exports = {
  getBucket,
  isS3Configured,
  presignPutResearchDocument,
  getObjectText,
  expectedKeyPrefix,
  buildObjectKey,
};
