import Logger from './utils/logger';
import { parse } from './utils/rawDataParser';

// Instantiate logger
const logger = new Logger();

exports.handler = async (event, context) => {
  const requestLogger = logger.child({ requestId: context.awsRequestId });
  requestLogger.debug({ event, context });

  // Iterate over records
  const outputRecords = event.records.map((record)=>{
    // Decode from base64
    const decodedData = Buffer.from(record.data, 'base64').toString('utf-8');
    requestLogger.debug({ decodedData });

    try {
      // Parse decoded data as payload object
      const parseResult = parse(decodedData);
      requestLogger.debug({ parseResult });

      // Store data to return
      let data;

      if (parseResult.result === 'Ok') {
        // Payload is encoded back to base64 before returning the result
        data = Buffer.from(`${JSON.stringify(parseResult.data)}`, 'utf-8').toString('base64');
      } else if (parseResult.result === "Dropped" || parseResult.result === "ProcessingFailed") {
        // Log error
        if (parseResult.error) {
          requestLogger.error(parseResult.error);
        }
        // Return original payload
        data = record.data;
      }

      return {
        recordId: record.recordId,
        result: parseResult.result,
        data,
        // Add metadata for dynamic partitioning
        metadata: parseResult.metadata,
      }
    } catch (err) {
      requestLogger.error({ err });
      return {
        recordId: record.recordId,
        result: 'Dropped',
        data: record.data,
      }
    }
  });
  requestLogger.debug({ originalLength: event.records.length, length: outputRecords.length, outputRecords })

  return {
    ...event,
    records: outputRecords,
  };
};
