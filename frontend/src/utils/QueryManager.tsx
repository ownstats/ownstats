import { subDays, subMonths, subYears, startOfMonth, startOfISOWeek, differenceInDays, format } from "date-fns"
import { AsyncDuckDB, arrowToJSON } from "duckdb-wasm-kit";
import { countryToCodeMapping } from "../utils/Helpers";
import { QueryFilter } from "./QueryFilterProvider";

export type DateRange = {
  key: string;
  name: string;
  startDate: Date;
  endDate: Date;
  comparisonStartDate: Date;
  comparisonEndDate: Date;
  granularity: "hourly" | "daily" | "monthly";
}

export type PageviewsAndVisitors = {
  dateGranularity: string;
  pageviewsCnt: number;
  visitorsCnt: number;
}

export type AggregationComparison = {
  currentPageviews: number;
  comparisonPageviews: number;
  currentVisitors: number;
  comparisonVisitors: number;
  currentVisitDurationAvg: number;
  comparisonVisitDurationAvg: number;
}

export type Country = {
  country: string;
  value: number;
}

export type DetailRecord = {
  name: string;
  value: number;
  percentage: number;
}

export type DetailMetadataMetric = "Pageviews" | "Visitors";

export type DetailMetadata = {
  header: string;
  metric: DetailMetadataMetric;
  columnName: string;
}

export type Details = {
  metadata: DetailMetadata;
  records: DetailRecord[]; 
}

export type DetailQueryConfiguration = {
  domain: string;
  dateRange: DateRange;
  header: string;
  metric: DetailMetadataMetric;
  fieldToAggregate: string;
}

export type ReportData = {
  aggregationComparison: AggregationComparison;
  pageviewsAndVisitors: PageviewsAndVisitors[];
  countries: Country[];
  pageviewsByPage: Details;
  pageviewsByReferrers: Details;
  visitorsByBrowsers: Details;
  visitorsByOS: Details;
  visitorsByDeviceType: Details;
  visitorsByCountry: Details;
}

type QueryManagerProperties = {
  db: AsyncDuckDB | undefined;
}

enum DateGranularity {
  HOURLY = "CASE WHEN event_hour < 12 THEN (event_hour)::varchar || 'AM' ELSE (event_hour-12)::varchar || 'PM' END AS dateGranularity",
  DAILY = "strftime(event_date, '%x') AS dateGranularity",
  MONTHLY = "monthname(event_date) AS dateGranularity",
}

export default class QueryManager {
  private dateRanges: DateRange[];
  private currentDate: Date;
  private db: AsyncDuckDB | undefined;
  private queryFilter: string;
  private tableName: string;

  constructor (props: QueryManagerProperties) {
    this.db = props.db;
    this.currentDate = new Date();
    this.queryFilter = "";
    this.tableName = "memory.stats";
    this.dateRanges =  [
      {
        key: "today",
        name: "Today",
        startDate: this.currentDate,
        endDate: this.currentDate,
        comparisonStartDate: subDays(this.currentDate, 1),
        comparisonEndDate: subDays(this.currentDate, 1),
        granularity: "hourly",
      },
      {
        key: "yesterday",
        name: "Yesterday",
        startDate: subDays(this.currentDate, 1),
        endDate: subDays(this.currentDate, 1),
        comparisonStartDate: subDays(this.currentDate, 2),
        comparisonEndDate: subDays(this.currentDate, 2),
        granularity: "hourly",
      },
      {
        key: "thisweek",
        name: "This week",
        startDate: startOfISOWeek(this.currentDate),
        endDate: this.currentDate,
        comparisonStartDate: startOfISOWeek(subDays(this.currentDate, 7)),
        comparisonEndDate: subDays(this.currentDate, 7),
        granularity: "daily",
      },
      {
        key: "last7days",
        name: "Last 7 days",
        startDate: subDays(this.currentDate, 7),
        endDate: this.currentDate,
        comparisonStartDate: subDays(this.currentDate, 14),
        comparisonEndDate: subDays(this.currentDate, 8),
        granularity: "daily",
      },
      {
        key: "thismonth",
        name: "This month",
        startDate: startOfMonth(this.currentDate),
        endDate: this.currentDate,
        comparisonStartDate: startOfMonth(subMonths(this.currentDate, 1)),
        comparisonEndDate: subMonths(this.currentDate, 1),
        granularity: "daily",
      },
      {
        key: "last30days",
        name: "Last 30 days",
        startDate: subDays(this.currentDate, 30),
        endDate: this.currentDate,
        comparisonStartDate: subDays(this.currentDate, 60),
        comparisonEndDate: subDays(this.currentDate, 31),
        granularity: "daily",
      },
      {
        key: "last90days",
        name: "Last 90 days",
        startDate: subDays(this.currentDate, 90),
        endDate: this.currentDate,
        comparisonStartDate: subDays(this.currentDate, 180),
        comparisonEndDate: subDays(this.currentDate, 91),
        granularity: "daily",
      },
      {
        key: "thisyear",
        name: "This year",
        startDate: new Date(this.currentDate.getFullYear(), 0, 1),
        endDate: this.currentDate,
        comparisonStartDate: new Date(this.currentDate.getFullYear() - 1, 0, 1),
        comparisonEndDate: subYears(this.currentDate, 1),
        granularity: "monthly",
      },
    ]
  }

  public setCustomDateRange (startDate?: Date, endDate?: Date): void {
    // Check dates, startDate is required minimum
    if (startDate) {
      const endDt = endDate || startDate; // Set to startDate if not set => Same day

      // Store index
      let foundIndex: number = -1;
      // Search for element
      const foundElement = this.dateRanges.filter((dr, index) => {
        if (dr.key === "custom") {
          foundIndex = index;
          return dr;
        }
      });

      // Get difference in days
      const dayDifference = differenceInDays(endDt, startDate);

      let granularity: "hourly" | "daily" | "monthly" = "hourly";

      // Set granularity
      if (dayDifference === 0) {
        granularity = "hourly";
      } else if (dayDifference > 0 && dayDifference <= 90) {
        granularity = "daily";
      } else {
        granularity = "monthly";
      }

      // Create custom date range
      const customDataRange: DateRange = {
        key: "custom",
        name: "Custom",
        startDate,
        endDate: endDt,
        comparisonStartDate: subDays(startDate, dayDifference),
        comparisonEndDate: subDays(startDate, 1),
        granularity,
      };

      // Check if custom range already exists, if yes, overwrite
      if (foundElement.length === 1 && foundIndex >= 0) {
        // Replace element
        this.dateRanges[foundIndex] = customDataRange;
      } else { // Create custom data range entry
        this.dateRanges.push(customDataRange);
      }
    } else {
      // noop
    }
  }

  public async runQuery(query: string) {
    // Connect to db
    const conn = await this.db!.connect();

    // Run create table query
    const arrowResult = await conn.query(query);

    // Close connection
    await conn.close();

    return arrowToJSON(arrowResult);
  }

  public getDateRanges() {
    return this.dateRanges;
  }

  public getDateRangeValueByKey(key: string) {
    return this.dateRanges.filter((dateRange) => dateRange.key === key).map((dateRange) => ({
      from: dateRange.startDate,
      to: dateRange.endDate,
    }))[0];
  }

  public getDateRangeByKey(key: string): DateRange {
    return this.dateRanges.filter((dateRange) => dateRange.key === key)[0];
  }

  public async getUniqueDomainNames(): Promise<string[]> {
    const query =  `SELECT DISTINCT domain_name FROM ${this.tableName} ORDER BY domain_name ASC`;

    const domains = await this.runQuery(query);
    const sDomains = domains.map((domains) => domains.domain_name) as unknown as string[];

    return sDomains;
  }

  public async getAggregation(domain: string, dateRange: DateRange): Promise<AggregationComparison> {
    const query = `SELECT sum(page_views_cnt::int) AS pageviewsCnt, sum(visitor_cnt) AS visitorsCnt, round(sum(visit_duration_sec_avg)/sum(visitor_cnt), 0) AS visitDurationAvg FROM ${this.tableName} WHERE domain_name = '${domain}' AND event_date BETWEEN CAST('${format(dateRange.startDate, "yyyy-MM-dd")}' as date) AND CAST('${format(dateRange.endDate, "yyyy-MM-dd")}' as date) ${this.queryFilter}`;
    const comparisonQuery = `SELECT sum(page_views_cnt::int) AS pageviewsCnt, sum(visitor_cnt) AS visitorsCnt, round(sum(visit_duration_sec_avg)/sum(visitor_cnt), 0) AS visitDurationAvg FROM ${this.tableName} WHERE domain_name = '${domain}' AND event_date BETWEEN CAST('${format(dateRange.comparisonStartDate, "yyyy-MM-dd")}' as date) AND CAST('${format(dateRange.comparisonEndDate, "yyyy-MM-dd")}' as date) ${this.queryFilter}`;

    const currentResult = await this.runQuery(query);
    const comparisonResult = await this.runQuery(comparisonQuery);

    return {
      currentPageviews: currentResult[0].pageviewsCnt as unknown as number,
      comparisonPageviews: comparisonResult[0].pageviewsCnt as unknown as number,
      currentVisitors: currentResult[0].visitorsCnt as unknown as number,
      comparisonVisitors: comparisonResult[0].visitorsCnt as unknown as number,
      currentVisitDurationAvg: currentResult[0].visitDurationAvg as unknown as number,
      comparisonVisitDurationAvg: comparisonResult[0].visitDurationAvg as unknown as number,
    }
  }

  public async getPageviewsAndVisitors(domain: string, dateRange: DateRange): Promise<PageviewsAndVisitors[]> {
    const query = `SELECT ${this.getDateGranularity(dateRange)}, sum(page_views_cnt::int) AS pageviewsCnt, sum(visitor_cnt) AS visitorsCnt FROM ${this.tableName} WHERE domain_name = '${domain}' AND event_date BETWEEN CAST('${format(dateRange.startDate, "yyyy-MM-dd")}' as date) AND CAST('${format(dateRange.endDate, "yyyy-MM-dd")}' as date) ${this.queryFilter} GROUP BY ${dateRange.granularity === "hourly" ? `event_hour` : `dateGranularity`} ORDER BY ${dateRange.granularity === "hourly" ? `event_hour` : `dateGranularity`} ASC`;

    const result = await this.runQuery(query);

    return result as unknown as PageviewsAndVisitors[];
  }

  public async getDetails(config: DetailQueryConfiguration): Promise<Details> {
    const metricMapping = {
      "Pageviews": "page_views_cnt::int",
      "Visitors": "visitor_cnt"
    }

    const query = `SELECT DISTINCT 
      CASE WHEN ${config.fieldToAggregate} IS NULL THEN 'Unknown' ELSE ${config.fieldToAggregate} END as name, 
      SUM(${metricMapping[config.metric]}) OVER (PARTITION BY ${config.fieldToAggregate}) AS value, 
      ROUND(SUM(${metricMapping[config.metric]}) OVER (PARTITION BY name)/SUM(${metricMapping[config.metric]}) OVER (), 2) * 100 AS percentage
    FROM
      ${this.tableName} 
    WHERE 
      domain_name = '${config.domain}' 
    AND 
      event_date BETWEEN CAST('${format(config.dateRange.startDate, "yyyy-MM-dd")}' as date) AND CAST('${format(config.dateRange.endDate, "yyyy-MM-dd")}' as date) 
    ${this.queryFilter}
    ORDER BY 
      value DESC`;

    const records = await this.runQuery(query);
    
    return {
      metadata: {
        header: config.header,
        metric: config.metric,
        columnName: config.fieldToAggregate,
      },
      records: records as unknown as DetailRecord[],
    } as Details;
  }

  public async getCountries(domain: string, dateRange: DateRange): Promise<Country[]> {
    const query = `SELECT edge_country, sum(visitor_cnt) AS page_views_cnt FROM ${this.tableName} WHERE domain_name = '${domain}' AND event_date BETWEEN CAST('${format(dateRange.startDate, "yyyy-MM-dd")}' as date) AND CAST('${format(dateRange.endDate, "yyyy-MM-dd")}' as date) ${this.queryFilter} GROUP BY edge_country ORDER BY page_views_cnt DESC`;
    const result = await this.runQuery(query);
    return result.map((item) => ({ country: countryToCodeMapping[item.edge_country as unknown as string], value: item.page_views_cnt as unknown as number } as Country));
  }

  private populateQueryFilter(filter: QueryFilter) {
    const filterGroups = Object.keys(filter);
    if (filterGroups.length > 0) {
      // Populate query filter
      const populatedQueryFilter = Object.keys(filter).map((groupId: string) => {
        return `${filter[groupId].columnName} = '${filter[groupId].value}'`;
      }).join(" AND ");
      // Set query filter
      this.queryFilter = ` AND ${populatedQueryFilter}`;
    }
  }

  public getCurrentData(domain: string, dateRange: DateRange, filter: QueryFilter, tempFileName: string) {
    // Populate query filter
    this.populateQueryFilter(filter);

    return {
      fileName: `ownstats_${domain.replace(/\./g, '_')}_${format(dateRange.startDate, "yyyy-MM-dd")}_${format(dateRange.endDate, "yyyy-MM-dd")}.csv`,
      query: `COPY (SELECT * from ${this.tableName} WHERE domain_name = '${domain}' AND event_date BETWEEN CAST('${format(dateRange.startDate, "yyyy-MM-dd")}' as date) AND CAST('${format(dateRange.endDate, "yyyy-MM-dd")}' as date) ${this.queryFilter} ORDER BY domain_name, event_date, event_hour) TO '${tempFileName}' WITH (HEADER 1, DELIMITER ';')`,
    };
  }

  public async getData(domain: string, dateRange: DateRange, filter: QueryFilter): Promise<ReportData> {
    // Populate query filter
    this.populateQueryFilter(filter);
    // Run queries
    const aggregationComparison = await this.getAggregation(domain, dateRange);
    const countries = await this.getCountries(domain, dateRange);
    const pageviewsAndVisitors = await this.getPageviewsAndVisitors(domain, dateRange);
    const pageviewsByPage = await this.getDetails({
      domain,
      dateRange,
      header: "Pages",
      metric: "Pageviews",
      fieldToAggregate: "request_path",
    });
    const pageviewsByReferrers = await this.getDetails({
      domain,
      dateRange,
      header: "Referrers",
      metric: "Pageviews",
      fieldToAggregate: "referrer_domain_name",
    });
    const visitorsByBrowsers = await this.getDetails({
      domain,
      dateRange,
      header: "Browsers",
      metric: "Visitors",
      fieldToAggregate: "browser_name",
    });
    const visitorsByOS = await this.getDetails({
      domain,
      dateRange,
      header: "Operating Systems",
      metric: "Visitors",
      fieldToAggregate: "browser_os_name",
    });
    const visitorsByDeviceType = await this.getDetails({
      domain,
      dateRange,
      header: "Device Type",
      metric: "Visitors",
      fieldToAggregate: "device_type",
    });
    const visitorsByCountry = await this.getDetails({
      domain,
      dateRange,
      header: "Countries",
      metric: "Visitors",
      fieldToAggregate: "edge_country",
    });

    return {
      aggregationComparison,
      countries,
      pageviewsAndVisitors,
      pageviewsByPage,
      pageviewsByReferrers,
      visitorsByBrowsers,
      visitorsByOS,
      visitorsByDeviceType,
      visitorsByCountry,
    } as ReportData
  }

  private getDateGranularity (dateRange: DateRange): string {
    let dateGranularity = "";

    // Check if query filter contains event_date, if yes, return hourly granularity
    if (this.queryFilter.includes("event_date")) {
      return DateGranularity.HOURLY;
    }

    // Otherwise, return granularity based on date range
    switch (dateRange.granularity) {
      case "hourly":
        dateGranularity = DateGranularity.HOURLY;
        break;
      case "daily":
        dateGranularity = DateGranularity.DAILY;
        break;
      case "monthly":
        dateGranularity = DateGranularity.MONTHLY;
        break;
      default:
        break;
    }

    return dateGranularity;
  }

  public async createTable(tableName: string = this.tableName) {
    const query = `CREATE TABLE IF NOT EXISTS ${tableName} (
      domain_name VARCHAR,
      event_date DATE,
      event_hour INTEGER,
      edge_city VARCHAR,
      edge_country VARCHAR,
      edge_latitude FLOAT,
      edge_longitude FLOAT,
      referrer_domain_name VARCHAR,
      browser_name VARCHAR,
      browser_os_name VARCHAR,
      device_type VARCHAR,
      device_vendor VARCHAR,
      utm_source VARCHAR,
      utm_campaign VARCHAR,
      utm_medium VARCHAR,
      utm_content VARCHAR,
      utm_term VARCHAR,
      request_path VARCHAR,
      page_views_cnt VARCHAR,
      visitor_cnt INTEGER,
      bounce_cnt INTEGER,
      visit_duration_sec_avg INTEGER
    )`;

    await this.runQuery(query);
  }

  public async truncateTable() {
    const query = `DELETE FROM ${this.tableName}`;

    await this.runQuery(query);
  }

  public async dropTable() {
    const query = `DROP TABLE ${this.tableName}`;

    await this.runQuery(query);
  }

  public async checkIfTableExists(tableName: string = this.tableName): Promise<boolean> {
    try {
      await this.runQuery(`SELECT * FROM ${tableName} LIMIT 1`);
      return true;
    } catch (err) {
      return false;
    }
  }
}
