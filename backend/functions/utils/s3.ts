import { S3 } from 'aws-sdk';
import { readFileSync, createWriteStream } from 'fs';

const {
  S3_OUTPUT_BUCKET_NAME,
} = process.env;

// Instantiate S3
const s3 = new S3();

// Define DuckDB database name
export const databaseName = `data`;

// Define temporary DuckDB database name
export const temporaryDatabaseName = `temporary`;

// Define DuckDB database file path
export const databaseFilePath = `/tmp/${databaseName}.duckdb`;

// Define temporary DuckDB database file path
export const temporaryDatabaseFilePath = `/tmp/${temporaryDatabaseName}.duckdb`;

// Define DuckDB database file S3 key
export const databaseFileS3Key = `duckdb/${databaseName}.duckdb`;

export const checkIfFileExists = async (key: string): Promise<boolean> => {
  return new Promise(async (resolve, reject) => {
    const params = {
      Bucket: S3_OUTPUT_BUCKET_NAME!,
      Key: key,
    };

    try {
      const result = await s3.headObject(params).promise();
      console.log({ result });
      resolve(true);
    } catch (err) {
      console.log({ err });
      resolve(false);
    }
  });
}

// Upload DuckDB database file to S3
export const uploadToS3 = async () => {
  const buffer = readFileSync(databaseFilePath);
  console.log(`File size: ${buffer.length}`);
  return s3.upload({
    Bucket: S3_OUTPUT_BUCKET_NAME!,
    Body: buffer,
    Key: databaseFileS3Key,
    Expires: new Date(),
  }).promise();
}

// Download pre-computed DuckDB database file from S3
export const downloadFromS3 = async (fileKey: string = databaseFileS3Key, filePath: string = databaseFilePath): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    // Check if the file exists
    const fileExists = await checkIfFileExists(fileKey);

    // If the file does not exist, reject
    if (!fileExists) {
      reject(`File does not exist: ${fileKey}`);
    }
    
    // Create a write stream to the local database file
    const writeStream = createWriteStream(filePath);

    // Resolve only if we are done writing
    writeStream.once('finish', () => {
      console.log('Download success!')
      resolve();
    });

    // Read from S3 and pipe the data to the writeStream
    s3.getObject({
      Bucket: S3_OUTPUT_BUCKET_NAME!,
      Key: databaseFileS3Key,
    })
    .createReadStream()
    .on('error', (error) => {
      return reject(error);
    })
    .pipe(writeStream);
  })
}
