import { readFile } from 'fs/promises';
import { lookup } from 'mime-types';
import path from 'path';
import zlib from 'zlib';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { CloudFrontClient, CreateInvalidationCommand, GetInvalidationCommand } from "@aws-sdk/client-cloudfront";
import { fromIni } from '@aws-sdk/credential-providers';
import LoadingScriptGenerator from './lib/loadingScriptGenerator.mjs';
import FileHasher from './lib/fileHasher.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const gzip = promisify(zlib.gzip);

async function getConfig() {
  const configFile = await readFile('../.ownstats.json', 'utf-8');
  return JSON.parse(configFile);
}

const ownstats = await getConfig();

// Initialize clients
const credentials = fromIni({ profile: ownstats.aws.profile });
const s3Client = new S3Client({ 
  region: ownstats.aws.region,
  credentials 
});
const cloudFrontClient = new CloudFrontClient({ 
  region: ownstats.aws.region,
  credentials 
});

// Define CDN URL
const cdnBaseUrl = `https://${ownstats.backend.cdnDomainName}`;

// File settings
const files = {
  'loader': {
    name: 'go.js',
    path: path.join(__dirname, '../dist/go.js'),
    keyPrefix: '',
    maxAge: 3600,
    gzip: true
  },
  'tracker': {
    name: null,
    path: path.join(__dirname, '../dist/ownstats-client.umd.js'),
    keyPrefix: 'versions/',
    maxAge: 31536000,
    gzip: true
  }
};

async function uploadFile(file) {
  const key = `${file.keyPrefix}${file.name}`;
  let fileContent = await readFile(file.path);

  if (file.gzip) {
    fileContent = await gzip(fileContent);
  }
  const contentType = lookup(file.path) || 'application/octet-stream';

  const command = new PutObjectCommand({
    Bucket: ownstats.backend.cdnBucketName,
    Key: key,
    Body: fileContent,
    ContentType: contentType,
    CacheControl: `public, max-age=${file.maxAge}`,
    ContentEncoding: file.gzip ? 'gzip' : undefined
  });

  try {
    await s3Client.send(command);
    console.log(`✅ Uploaded: ${key}`);
  } catch (error) {
    console.error(`❌ Failed to upload ${key}:`, error);
    throw error;
  }
}

async function waitForInvalidation(distributionId, invalidationId) {
  console.log('⏳ Waiting for CloudFront invalidation to complete...');
  
  while (true) {
    const command = new GetInvalidationCommand({
      DistributionId: distributionId,
      Id: invalidationId
    });

    try {
      const response = await cloudFrontClient.send(command);
      const status = response.Invalidation.Status;

      if (status === 'Completed') {
        console.log('✅ CloudFront invalidation completed');
        break;
      }

      console.log(`🔄 Invalidation status: ${status}`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error('❌ Failed to check invalidation status:', error);
      throw error;
    }
  }
}

async function invalidateCloudFront(distributionId, paths) {
  const command = new CreateInvalidationCommand({
    DistributionId: distributionId,
    InvalidationBatch: {
      CallerReference: Date.now().toString(),
      Paths: {
        Quantity: paths.length,
        Items: paths
      }
    }
  });

  try {
    const response = await cloudFrontClient.send(command);
    console.log(`🌩️  Created CloudFront invalidation: ${response.Invalidation.Id}`);
    await waitForInvalidation(distributionId, response.Invalidation.Id);
  } catch (error) {
    console.error('❌ Failed to create CloudFront invalidation:', error);
    throw error;
  }
}

async function run() {
  try {
    // Create file hash for tracker
    const fileHasher = new FileHasher(files['tracker'].path);
    const fileHash = await fileHasher.getHash();
    files['tracker'].name = `hello-${fileHash}.js`;

    // Generate loading script
    const loadingScriptGenerator = new LoadingScriptGenerator(
      files['loader'].name,
      files['tracker'].name,
      files['loader'].path,
      cdnBaseUrl
    );
    await loadingScriptGenerator.renderTemplate('ownstats-script');

    // Upload all files
    for (const name of Object.keys(files)) {
      const file = files[name];
      await uploadFile(file);
    }

    // Get distribution ID from config
    const distributionId = ownstats.backend.cdnDistributionId;
    console.log(`📡 Using CloudFront distribution: ${distributionId}`);

    // Create paths to invalidate from uploaded files
    const pathsToInvalidate = Object.values(files).map(f => `/${f.keyPrefix}${f.name}`);
    
    // Invalidate the uploaded files
    console.log('🌩️  Invalidating CloudFront cache...');
    await invalidateCloudFront(ownstats.backend.cdnDistributionId, pathsToInvalidate);

    // Log the CDN URLs for the uploaded files
    console.log('\n📋 Deployed files:');
    Object.values(files).forEach((f) => {
      console.log(`${cdnBaseUrl}/${f.keyPrefix}${f.name}`);
    });

    console.log('\n✨ Deploy completed successfully!');
  } catch (error) {
    console.error('Failed to deploy:', error?.message || error);
    process.exit(1);
  }
}

run();
