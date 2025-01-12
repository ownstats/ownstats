"use client";

import { useDuckDb, AsyncDuckDB } from "duckdb-wasm-kit";
import { useEffect, useState } from "react"
import { AwsClient } from "aws4fetch";
import saveAs from "file-saver";
import { toast } from "sonner"

import QueryManager, { DateRange, ReportData } from "@/utils/QueryManager";
import DomainPicker from "@/components/DomainPicker";
import KPIsAndGraph from "@/components/KPIsAndGraph";
import DatePicker from "@/components/DatePicker";
import { useQueryFilter } from "@/utils/QueryFilterProvider";
import { useDataManager } from "@/utils/DataManagerProvider";
import { useAuth } from "@/hooks/useAuth";
import ownstatsConfig from "@/ownstats.config.json";
import { Button } from "@/components/ui/button"
import {
  ArrowDownToLine,
  RefreshCcw,
} from "lucide-react"

export default function Dashboard() {
  // Use DuckDB-WASM
  const { db, error } = useDuckDb();
  // Use auth
  const { isAuthenticated, getCredentials } = useAuth();
  // Use filter
  const { filter, setFilter } = useQueryFilter();
  // Use Data Manager
  const { isLoaded, setIsLoaded, isDatabaseAttached, setIsDatabaseAttached, isStreamLoaded, setIsStreamLoaded } = useDataManager();

  // Create query manager
  const queryManager = new QueryManager({ db });
  // Set default placeholder for current domain
  const defaultDomain = "Loading...";

  // Store query start timestamp
  const [_queryStartTimestamp, setQueryStartTimestamp] = useState<number>();
  // Store query duration
  const [_queryDuration, setQueryDuration] = useState<number>();
  // Store query running status
  const [_isQueryRunning, setIsQueryRunning] = useState<boolean>(false);
  // Instantiate initial date range
  const [currentDateRange, setCurrentDateRange] = useState<DateRange>(queryManager.getDateRangeByKey("thisweek"));
  // Store domains
  const [domains, setDomains] = useState<string[]>([]);
  // Store current domain
  const [currentDomain, setCurrentDomain] = useState<string>(defaultDomain);
  // Store report data
  const [data, setData] = useState<ReportData>();

  const attachDatabase = async (enableTiming: boolean = false): Promise<void> => {
    // Get credentials from Cognito session
    const credentials = await getCredentials();

    // Store timer
    let startTimestamp = new Date().getTime();

    toast.info("Preparing DuckDB...");

    await queryManager.runQuery(`LOAD httpfs`);
    await queryManager.runQuery(`SET s3_access_key_id = '${credentials?.accessKeyId!}'`);
    await queryManager.runQuery(`SET s3_secret_access_key = '${credentials?.secretAccessKey!}'`);
    await queryManager.runQuery(`SET s3_session_token = '${credentials?.sessionToken!}'`);
    await queryManager.runQuery(`SET s3_region = '${ownstatsConfig.region}'`);

    toast.success("Preparing DuckDB... Done!", { description: `Took ${new Date().getTime() - startTimestamp}ms` });

    // Set query start timestamp
    setQueryStartTimestamp(startTimestamp)

    // Set query running status
    setIsQueryRunning(true);

    toast.info("Attaching historical data...");

    const attachQuery = `ATTACH 's3://${ownstatsConfig.s3.bucketName}/duckdb/data.duckdb' AS data;`;

    try {
      // Attach database
      await queryManager.runQuery(attachQuery);
      // Set database attached flag
      setIsDatabaseAttached(true);
    } catch (e: any) {
      console.log(e);
      toast.error(`Loading historical data... Error!`, { description: e.message });

      // Set database attached flag
      setIsDatabaseAttached(false);

      // Create empty table to avoid error message when the view is queried
      await queryManager.createTable("today_stats");
    }

    // Stop timer
    if (enableTiming && startTimestamp) setQueryDuration((new Date().getTime() - startTimestamp));

    // Set query running status
    setIsQueryRunning(false);

    toast.success(`Loading historical data... Done!`, { description: `Took ${new Date().getTime() - startTimestamp}ms` });
  }

  const detachDatabase = async (): Promise<void> => {
    await queryManager.runQuery(`DETACH data`);
    // Set database attached flag
    setIsDatabaseAttached(false);
  }

  // See https://arrow.apache.org/docs/12.0/js/modules/Arrow_dom.html
  // See https://github.com/apache/arrow/blob/6af660f48/js/src/table.ts
  const getStreamData = async (db: AsyncDuckDB, enableTiming: boolean = false): Promise<void> => {
    // Connect to db
    const cid = await db.connectInternal();

    await queryManager.runQuery(`USE data;`);

    // Store timer
    let startTimestamp = new Date().getTime();

    toast.info("Start loading current data...");

    // Set query start timestamp
    setQueryStartTimestamp(startTimestamp)
  
    try {
      const aborter = new AbortController();

      // Set fetch options
      const fetchOptions = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: aborter.signal
      }

      // Get credentials from Cognito session
      const credentials = await getCredentials();

      // Instantiate AWS Client that will automatically sign the request with Sigv4
      // See https://github.com/mhart/aws4fetch
      // See https://github.com/mhart/aws4fetch/issues/45#issue-1533678703
      const aws = new AwsClient({
        accessKeyId: credentials?.accessKeyId!,
        secretAccessKey: credentials?.secretAccessKey!,
        sessionToken: credentials?.sessionToken!, // IMPORTANT!
        region: ownstatsConfig.region,
        service: "lambda",
        retries: 0, // Don't retry, fail fast if something goes wrong 
      });

      // See: https://developer.mozilla.org/en-US/docs/Web/API/Streams_API/Using_readable_streams
      // From a raw Arrow IPC stream
      const streamResponse = await aws.fetch(ownstatsConfig.backend.streamingQueryUrl, fetchOptions);

      // Store data promises
      const ipcPromises = [];

      // Check if response is ok before proceeding
      if (!streamResponse.ok) {
        // Create empty table to avoid error message when the view is queried
        await queryManager.createTable("today_stats");
        // Set stream loaded flag
        setIsStreamLoaded(false);
        // Throw error
        throw new Error(`Failed to load current data!`);
      } else {
        // Get stream reader for reading the response
        const streamReader = streamResponse.body!.getReader();

        // Read stream until it's consumed
        while (true) {
          const { value, done } = await streamReader.read();

          if (value?.length) {
            toast.info(`Receiving current data...`, { description: `Received chunk of ${value?.length} bytes!` });
          }

          // Check if done, if so break the loop
          if (done) break;

          // Add to array
          ipcPromises.push(db.insertArrowFromIPCStream(cid, new Uint8Array(value), { name: "today_stats", create: true }));
        }

        // IMPORTANT: Add EOS (End-Of-Stream) message!
        ipcPromises.push(db.insertArrowFromIPCStream(cid, new Uint8Array([255, 255, 255, 255, 0, 0, 0, 0]), { name: "today_stats", create: true }))
        
        // Await all promises
        await Promise.all(ipcPromises);

        // Set stream loaded flag
        setIsStreamLoaded(true);

        toast.success(`Loading current data... Done!`, { description: `Took ${new Date().getTime() - startTimestamp}ms` });
      }
    } catch (e: any) {
      console.log(e);
      toast.error(`Loading current data... Error!`, { description: e.message });
    }

    // Stop timer
    if (enableTiming && startTimestamp) setQueryDuration((new Date().getTime() - startTimestamp));

    // Disconnect
    db.disconnect(cid);
  };

  const downloadAsCSV = async () => {
    if (db) {
      // Create temporary file name
      const tempFileName = `temp_${new Date().getTime()}`;
      // Get query and temporary file name
      const { query, fileName } = queryManager.getCurrentData(currentDomain, currentDateRange, filter, tempFileName);
      // Run query and create temporary file
      await queryManager.runQuery(query);
      // Read temporary as buffer
      const buffer = await db.copyFileToBuffer(tempFileName);
      // Drop temporary file
      await db.dropFile(tempFileName);
      // Create File instance from buffer
      const file = new File([buffer], fileName, { type: "text/csv" });
      // Trigger download
      saveAs(file, file.name);
    }
  }

  const runQueries = async () => {
    const data = await queryManager.getData(currentDomain, currentDateRange, filter);
    setData(data);
  }

  const loadFromTable = async () => {
    // Check if table exists
    const tableExists = await queryManager.checkIfTableExists();

    if (tableExists) {
      // Get unique domains
      const uniqueDomains = await queryManager.getUniqueDomainNames();
      // Set unique domains
      setDomains(uniqueDomains);
      // Set current domain
      setCurrentDomain(uniqueDomains[0]);
      // Run queries
      await runQueries();
    } else {
      // Set loaded state
      setIsLoaded(false);
    }
  }

  const init = async (db: AsyncDuckDB) => {
    if (!isLoaded()) {
      // Attach database with historical data
      await attachDatabase(true);

      // Only execute if database is attached
      if (isDatabaseAttached()) {
        // Create view only with historical data until today's data is loaded
        await queryManager.runQuery(`CREATE VIEW IF NOT EXISTS memory.stats AS SELECT * FROM data.aggregated_stats;`);

        // Load from table so that we can display historical data
        await loadFromTable();
      }

      // Load today's data from Lambda function stream
      await getStreamData(db, true);

      // Drop view again
      await queryManager.runQuery(`DROP VIEW IF EXISTS memory.stats`);

      // Check if stream is loaded and database is attached
      if (isStreamLoaded() && isDatabaseAttached()) {
        // Create view with today's data and historical data
        await queryManager.runQuery(`CREATE VIEW IF NOT EXISTS memory.stats AS SELECT * FROM memory.today_stats UNION ALL SELECT * FROM data.aggregated_stats;`);
      } else {
        // Create view with today's data only (an empty memory.today_stats table is created if the stream is not loaded, so no additional checking here)
        await queryManager.runQuery(`CREATE VIEW IF NOT EXISTS memory.stats AS SELECT * FROM memory.today_stats`);
      }

      // Get unique domains
      const uniqueDomains = await queryManager.getUniqueDomainNames();

      // Set unique domains
      setDomains(uniqueDomains);
      // Set current domain
      setCurrentDomain(uniqueDomains[0]);
      // Reset query filter
      setFilter({});
      // Set remote data as loaded
      setIsLoaded(true);
    }
  }

  const reload = async () => {
    // Drop existing table
    await queryManager.runQuery(`DROP TABLE IF EXISTS memory.today_stats`);

    // Detach database
    await detachDatabase();

    // Reset state values
    setQueryDuration(undefined);
    setQueryStartTimestamp(undefined);
    setIsStreamLoaded(false);
    setIsLoaded(false);

    // Trigger reload
    await init(db!);
  }

  useEffect(() => {
    if (error) console.log(error);
  }, [error]);

  useEffect(() => {
    if (currentDomain !== defaultDomain && currentDateRange && isAuthenticated) {
      runQueries();
    }
  }, [currentDomain, currentDateRange, filter, isAuthenticated]);

  useEffect(() => {
    if (db) {
      console.log("DuckDB-WASM is ready!");
      if (isAuthenticated) {
        if (!isLoaded()) {
          init(db);
        } else {
          loadFromTable();
        }
      }
    }

    // Cleanup (also for reload, otherwise state is not reset)
    return () => {
      setIsDatabaseAttached(false);
      setIsStreamLoaded(false);
      setIsLoaded(false);
    };
  }, [db, isAuthenticated, isLoaded]);
  
  return (
    <>
      <div className="flex items-center justify-start lg:justify-end mb-1">
        <div className="flex flex-wrap flex-row gap-y-2 lg:gap-y-0">
          <div className="sm:hidden lg:grow">{ }</div>
            <Button onClick={(_e) => reload()} className="w-10 h-10 mr-1 border focus:ring-0 focus:ring-offset-0" variant="outline">
              <RefreshCcw className="w-4 h-4" />
            </Button>
            <Button onClick={downloadAsCSV} className="w-10 h-10 mr-1 border focus:ring-0 focus:ring-offset-0" variant="outline">
              <ArrowDownToLine className="w-4 h-4" />
            </Button>
          <div className="">
            <DomainPicker domains={domains} currentDomain={currentDomain} setCurrentDomain={setCurrentDomain}/>
          </div>
          <div className="">
            <DatePicker queryManager={queryManager} currentDateRange={currentDateRange} setCurrentDateRange={setCurrentDateRange}/>
          </div>
        </div>
      </div>
      <KPIsAndGraph data={data}/>
    </>
  );
}
