import Logger from '../utils/logger';
import { parse } from '../utils/rawDataParser';
import { listDomains, type DomainResult } from '../utils/domains';

// Instantiate logger
const logger = new Logger().getInstance();

// Get and store domain info
let domains: DomainResult[] = await listDomains();

// Store last loaded domains timestamp
let domainsLoadedTimestamp: number = new Date().getTime();

export const handler = async (event, context) => {
  const requestLogger = logger.child({ requestId: context.awsRequestId });
  requestLogger.debug({ event, context });

  // Check if domains were loaded more than 5min ago
  if (new Date().getTime() > (domainsLoadedTimestamp + 5*60*1000)) {
    // If yes, reload domain info
    domains = await listDomains();

    requestLogger.debug(`Reloaded domain info`);
  }

  requestLogger.debug({ domains });

  // Iterate over records
  const outputRecords = event.records.map((record)=>{
    // Decode from base64
    const decodedData = Buffer.from(record.data, 'base64').toString('utf-8');
    requestLogger.debug({ decodedData });

    try {
      // Parse decoded data as payload object
      const parseResult = parse(decodedData, domains);
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
