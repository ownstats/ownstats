import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { CloudFrontClient, CreateInvalidationCommand, GetInvalidationCommand } from "@aws-sdk/client-cloudfront";
import { fromIni } from '@aws-sdk/credential-providers'
import { readFile } from 'fs/promises';
import { glob } from 'glob';
import { lookup } from 'mime-types';
import path from 'path';
import crypto from 'crypto';

async function getConfig() {
  const configFile = await readFile('../.ownstats.json', 'utf-8');
  return JSON.parse(configFile);
}

async function calculateMD5(filePath) {
  const content = await readFile(filePath);
  return crypto.createHash('md5').update(content).digest('base64');
}

async function uploadFile(client, bucketName, filePath, existingObjects) {
  const key = path.relative('dist', filePath);
  const localMD5 = await calculateMD5(filePath);
  
  // Check if file needs to be uploaded
  const existingObject = existingObjects[key];
  if (existingObject && existingObject.ETag === `"${localMD5}"`) {
    console.log(`⏭️  Skipping (unchanged): ${key}`);
    return;
  }

  const fileContent = await readFile(filePath);
  const contentType = lookup(filePath) || 'application/octet-stream';

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: fileContent,
    ContentType: contentType,
  });

  try {
    await client.send(command);
    console.log(`✅ Uploaded: ${key}`);
  } catch (error) {
    console.error(`❌ Failed to upload ${key}:`, error);
  }
}

async function listS3Objects(client, bucketName) {
  const objects = {};
  let continuationToken = undefined;

  do {
    const command = new ListObjectsV2Command({
      Bucket: bucketName,
      ContinuationToken: continuationToken,
      MaxKeys: 1000,
    });

    const response = await client.send(command);
    response.Contents?.forEach(item => {
      objects[item.Key] = item;
    });

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return objects;
}

async function deleteStaleObjects(client, bucketName, localFiles, s3Objects) {
  const localKeys = localFiles.map(file => path.relative('dist', file));
  const objectsToDelete = Object.keys(s3Objects)
    .filter(s3Key => !localKeys.includes(s3Key));

  if (objectsToDelete.length === 0) {
    return;
  }

  const command = new DeleteObjectsCommand({
    Bucket: bucketName,
    Delete: {
      Objects: objectsToDelete.map(Key => ({ Key })),
      Quiet: false,
    },
  });

  try {
    const response = await client.send(command);
    response.Deleted?.forEach(item => {
      console.log(`🗑️  Deleted: ${item.Key}`);
    });
  } catch (error) {
    console.error('❌ Failed to delete objects:', error);
  }
}

async function waitForInvalidation(client, distributionId, invalidationId) {
  console.log('⏳ Waiting for CloudFront invalidation to complete...');
  
  while (true) {
    const command = new GetInvalidationCommand({
      DistributionId: distributionId,
      Id: invalidationId
    });

    try {
      const response = await client.send(command);
      const status = response.Invalidation.Status;

      if (status === 'Completed') {
        console.log('✅ CloudFront invalidation completed');
        break;
      }

      console.log(`🔄 Invalidation status: ${status}`);
      // Wait 2 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error('❌ Failed to check invalidation status:', error);
      throw error;
    }
  }
}

async function invalidateCloudFront(client, distributionId) {
  const command = new CreateInvalidationCommand({
    DistributionId: distributionId,
    InvalidationBatch: {
      CallerReference: Date.now().toString(),
      Paths: {
        Quantity: 1,
        Items: ['/*']  // Invalidate everything
      }
    }
  });

  try {
    const response = await client.send(command);
    console.log(`🌩️  Created CloudFront invalidation: ${response.Invalidation.Id}`);
    await waitForInvalidation(client, distributionId, response.Invalidation.Id);
  } catch (error) {
    console.error('❌ Failed to create CloudFront invalidation:', error);
    throw error;
  }
}

async function syncToS3() {
  try {
    // Get config and initialize clients
    const config = await getConfig();
    const bucketName = config.frontend.cdnBucketName;
    const distributionId = config.frontend.cdnDistributionId;

    const credentials = fromIni({ profile: config.aws.profile })

    const s3Client = new S3Client({ region: config.aws.region, credentials });
    const cloudFrontClient = new CloudFrontClient({ region: config.aws.region, credentials });

    // Find all files in dist directory
    const localFiles = await glob('dist/**/*', { nodir: true });
    
    console.log(`📤 Starting sync to ${bucketName}...`);
    
    // Get existing S3 objects
    console.log('📋 Listing existing S3 objects...');
    const s3Objects = await listS3Objects(s3Client, bucketName);

    // Upload new and modified files
    console.log('📤 Uploading new and modified files...');
    await Promise.all(localFiles.map(file => uploadFile(s3Client, bucketName, file, s3Objects)));

    // Delete stale files
    console.log('🧹 Cleaning up stale files...');
    await deleteStaleObjects(s3Client, bucketName, localFiles, s3Objects);
    
    // After successful sync, invalidate CloudFront and wait for completion
    console.log('🌩️  Invalidating CloudFront distribution...');
    await invalidateCloudFront(cloudFrontClient, distributionId);
    
    console.log('✨ Sync and invalidation completed successfully!');
  } catch (error) {
    console.error('Failed to sync to S3 or invalidate CloudFront:', error?.message || error);
    process.exit(1);
  }
}

syncToS3();
