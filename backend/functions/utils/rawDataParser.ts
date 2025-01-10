import UAParser from "ua-parser-js";
import isbot from "isbot";
import { createHash} from "crypto";
import AWSEdgeLocations, { EdgeLocation } from "aws-edge-locations";
import { lookupDateHash } from "./dateHashes";
import { type DomainResult } from '../utils/domains';

export type DeviceTypeMapping = {
  [deviceType: string]: string;
}

export type ParsedEventData = {
  event_year: number;
  event_month: number;
  event_day: number;
  event_timestamp: string;
  arrival_timestamp: string;
  arrival_delay_ms: number;
  edge_city: string;
  edge_state: string | null,
  edge_country: string;
  edge_country_code: string;
  edge_latitude: number;
  edge_longitude: number;
  edge_id: string;
  referrer: string;
  referrer_domain_name: string;
  browser_name: string | null;
  browser_version: string | null;
  browser_os_name: string | null;
  browser_os_version: string | null;
  browser_timezone: string | null;
  browser_language: string | null;
  device_type: string | null;
  device_vendor: string | null;
  device_outer_resolution: string | null;
  device_inner_resolution: string | null;
  device_color_depth: number | null;
  device_platform: string | null;
  device_memory: number | null;
  device_cores: number | null;
  utm_source: string | null;
  utm_campaign: string | null;
  utm_medium: string | null;
  utm_content: string | null;
  utm_term: string | null;
  request_url: string;
  request_path: string;
  request_query_string: string | null;
  request_bytes: number;
  request_status_code: number;
  request_cache_status: string;
  request_delivery_time_ms: number;
  request_asn: number;
  request_is_bot: 0 | 1;
  event_name: string | null;
  event_data: string | null;
  page_view_id: string;
  daily_page_view_id: string;
  daily_visitor_id: string;
  domain_name: string;
  event_date: string;
  event_type: string;
}

export type ParsedEventMetadata = {
  partitionKeys: ParsedEventPartitionKeys;
}

export type ParsedEventPartitionKeys = {
  domain_name: string;
  event_date: string;
  event_type: string;
}

export type ParsedEvent = {
  result: "Dropped" | "ProcessingFailed" | "Ok";
  error?: string;
  data?: ParsedEventData;
  metadata?: ParsedEventMetadata;
}

// Get AWS Edge Locations
const awsEdgeLocations = new AWSEdgeLocations();

// Set expected data parts / columns
const expectedDataPartsCount = 12;

// get CloudFront domain name
const {
  CDN_DOMAIN_NAME
} = process.env;

const generateHash = (stringToHash: string): string => {
  return createHash("sha256").update(stringToHash).digest("hex");
}

const translateDeviceType = (deviceType: string | undefined): string => {
  if (!deviceType) {
    return "Desktop";
  }

  const mapping: DeviceTypeMapping = {
    "console": "Console",
    "mobile": "Mobile",
    "tablet": "Tablet",
    "smarttv": "SmartTV",
    "wearable": "Wearable",
    "embedded": "Embedded",
  }

  if (!mapping.hasOwnProperty(deviceType)) {
    return "Desktop";
  } else {
    return mapping[deviceType];
  }
}

const verifyRequest = (domains: DomainResult[], domainName: string, domainKey: string): boolean => {
  let verified: boolean = false;
  for (let domain of domains) {
    if (domainName === domain.domainName && domainKey === domain.domainKey) {
      verified = true;
      break;
    }
  }
  return verified;
}

export const parse = (rawData: string, domains: DomainResult[]): ParsedEvent => {
  // Split the raw data by tabs
  const dataParts: string[] = rawData.split(/\t/g);

  // Store potential error
  let error: string | undefined;

  if (dataParts.length !== expectedDataPartsCount) {
    error = `Parts count doesn"t match: Got ${dataParts.length}, but expected ${expectedDataPartsCount}!`;
    // Return early when irrelevant record arrived
    return {
      result: "Dropped",
    }
  } else if (dataParts[3].startsWith("/noscript.gif") === false && dataParts[3].startsWith("/hello.gif") === false) {
    // Return early when irrelevant record arrived
    return {
      result: "Dropped",
    }
  } else {
    // Check if noscript
    const isNoScript: boolean = dataParts[3].includes("/noscript.gif");

    // Extract query string details
    const queryStringData: URLSearchParams | null = dataParts[9] === "-" ? null : new URLSearchParams(dataParts[9]);

    // Shortcut querystring extraction function
    const extractQS = (part: string, qs?: URLSearchParams): string | null => {
      let qsData: URLSearchParams | null = qs ? qs : queryStringData;
      if (qsData) {
        const value = qsData.get(part);
        return value ? decodeURIComponent(value) : null;
      } else {
        return null;
      }
    }

    // Extract arrival timestamp
    const arrivalTimestamp: Date = new Date(parseInt(dataParts[0])*1000);

    // Extract event timestamp
    const eventTimestamp: Date = new Date(parseInt(extractQS("ts")!));

    // Extract IP address (for later hashing)
    const request_ip_address: string = dataParts[1];

    // Extract HTTP status code
    const request_status_code: number = parseInt(dataParts[2]);

    // Extract path
    const rawPath: string = dataParts[3];
    const pathFromQS: string | null = extractQS("pa");
    const request_path: string | null = !isNoScript ? pathFromQS : (rawPath.includes("?") ? rawPath.substring(0, rawPath.indexOf("?")) : rawPath);
    
    // Extract byte size
    const request_bytes: number = parseInt(dataParts[4]);

    // Extract request approximate location data from edge pop
    const approximateLocationData: EdgeLocation | boolean = awsEdgeLocations.lookup(dataParts[5].substr(0,3));

    // Extract delivery time
    const request_delivery_time_ms: number = parseInt((parseFloat(dataParts[6]) * 1000).toFixed(0));

    // Extract user agent details
    const userAgentFromRaw: string = decodeURIComponent(dataParts[7]);
    const userAgentFromQS: string | null = extractQS("ua");
    const userAgentDetails = !isNoScript ? new UAParser(userAgentFromRaw) : (userAgentFromQS !== null ? new UAParser(userAgentFromQS) : new UAParser(userAgentFromRaw));

    // Extract referrer
    const referrerFromRaw: string | null = dataParts[8] === "-" ? null : dataParts[8];
    const referrerFromQS: string | null = extractQS("r");
    const referrerHostnameFromQS: string | null = referrerFromQS ? new URL(referrerFromQS)?.hostname : null;
    const referrer: string | null = (referrerHostnameFromQS && referrerHostnameFromQS === CDN_DOMAIN_NAME || referrerHostnameFromQS && extractQS("hn") && referrerHostnameFromQS === extractQS("hn")) ? null : referrerFromQS;

    // Extract referrer hostname
    const referrerHostname = referrer ? new URL(referrer).hostname : "Direct / None";

    // Extract referrer query string
    const referrerQueryStringData = referrer && referrer.includes("?") ? new URLSearchParams(referrer.substring(dataParts[6].indexOf("?"), referrer.length-1)) : null;

    // Extract url
    const rawUrl = decodeURIComponent(queryStringData!.get("u")!);
    const request_url = !isNoScript ? rawUrl : (referrerFromRaw && referrerFromRaw.includes("?") ? referrerFromRaw.substring(referrerFromRaw.indexOf("?"), referrerFromRaw.length-1) : referrerFromRaw);

    // Extract cache status
    const request_cache_status = dataParts[10];

    // Extract ASN
    const request_asn: number = parseInt(dataParts[11].replace(/\n/g, ""));

    // Extract domain name
    const domain_name = !isNoScript ? extractQS("hn") : (referrerHostname ? referrerHostname.replace("www.", "") : null);
    
    // Extract domain key
    const domain_key = extractQS("dk");

    // Extract UTM data
    const utm_source = !isNoScript && extractQS("uso") ? extractQS("uso") : (referrerQueryStringData ? extractQS("utm_source", referrerQueryStringData) : null);
    const utm_campaign = !isNoScript && extractQS("uca") ? extractQS("uca") : (referrerQueryStringData ? extractQS("utm_campaign", referrerQueryStringData) : null);
    const utm_medium = !isNoScript && extractQS("ume") ? extractQS("ume") : (referrerQueryStringData ? extractQS("utm_medium", referrerQueryStringData) : null);
    const utm_content = !isNoScript && extractQS("uco") ? extractQS("uco") : (referrerQueryStringData ? extractQS("utm_content", referrerQueryStringData) : null);
    const utm_term = !isNoScript && extractQS("ute") ? extractQS("ute") : (referrerQueryStringData ? extractQS("utm_term", referrerQueryStringData) : null);
    
    // Extract browser data
    const browser_timezone = extractQS("tz");
    const browser_language = extractQS("l");
    const device_outer_resolution = extractQS("w") && extractQS("h") ? `${extractQS("w")}x${extractQS("h")}` : null;
    const device_inner_resolution = extractQS("iw") && extractQS("ih") ? `${extractQS("iw")}x${extractQS("ih")}` : null;
    const device_color_depth = extractQS("d") ? parseInt(extractQS("d")!) : null;
    const device_platform = extractQS("p");
    const device_memory = extractQS("m") && parseInt(extractQS("m")!);
    const device_cores = extractQS("c") ? parseInt(extractQS("c")!) : null;

    // Derive envent_date string
    const event_date: string = eventTimestamp.toISOString().split("T")[0];

    // Derive event type
    let event_type: string = "na";

    // Verify domain & domain key
    if (!verifyRequest(domains, domain_name!, domain_key!)) {
      return {
        result: "Dropped",
        error: `Couldn't verify '${domain_name}' with domain key '${domain_key}'!`,
      }
    }

    switch (extractQS("t")) {
      case "pv":
        event_type = "pageview";
        break;
      case "tr":
        event_type = "event";
        break;
      default:
        break;
    }

    // Derive result
    const result: string = error ? "ProcessingFailed" : "Ok";

    // Today"s date hash
    const todaysDateHash: string = lookupDateHash(event_date);

    return {
      result,
      error,
      data: {
        event_year: eventTimestamp.getFullYear(),
        event_month: eventTimestamp.getMonth() + 1,
        event_day: eventTimestamp.getDate(),
        event_timestamp: eventTimestamp.toISOString(),
        arrival_timestamp: arrivalTimestamp.toISOString(),
        arrival_delay_ms: eventTimestamp.getTime()-arrivalTimestamp.getTime(),
        edge_city: approximateLocationData && approximateLocationData.city,
        edge_state: approximateLocationData && approximateLocationData?.state,
        edge_country: approximateLocationData && approximateLocationData.country,
        edge_country_code: approximateLocationData && approximateLocationData.countryCode,
        edge_latitude: approximateLocationData && approximateLocationData.latitude,
        edge_longitude: approximateLocationData && approximateLocationData.longitude,
        edge_id: dataParts[5].substr(0,3),
        referrer,
        referrer_domain_name: referrerHostname,
        browser_name: userAgentDetails ? userAgentDetails.getBrowser()?.name : "Unknown",
        browser_version: userAgentDetails ? userAgentDetails.getBrowser()?.version : "Unknown",
        browser_os_name: userAgentDetails ? userAgentDetails.getOS()?.name : "Unknown",
        browser_os_version: userAgentDetails ? userAgentDetails.getOS()?.version : "Unknown",
        browser_timezone,
        browser_language,
        device_type: (userAgentDetails.getDevice() && translateDeviceType(userAgentDetails.getDevice()?.type)) || "Unknown",
        device_vendor: userAgentDetails.getDevice() ? userAgentDetails.getDevice()?.vendor || null : "Unknown",
        device_outer_resolution,
        device_inner_resolution,
        device_color_depth,
        device_platform,
        device_memory,
        device_cores,
        utm_source,
        utm_campaign,
        utm_medium,
        utm_content,
        utm_term,
        request_url,
        request_path,
        request_query_string: dataParts[9] === "-" ? null : dataParts[9],
        request_bytes,
        request_status_code,
        request_cache_status,
        request_delivery_time_ms,
        request_asn,
        request_is_bot: isbot(isNoScript ? userAgentFromRaw : (userAgentFromQS === null ? userAgentFromQS : userAgentFromRaw)) ? 1 : 0,
        event_name: (event_type === "event" || event_type === "track") ? extractQS("en") : null,
        event_data: event_type === "event" ? extractQS("pr") : null,
        page_view_id: generateHash(`${todaysDateHash}${request_ip_address}${userAgentFromRaw}${event_date}${domain_name}${request_path}${eventTimestamp}`),
        daily_page_view_id: generateHash(`${todaysDateHash}${request_ip_address}${userAgentFromRaw}${event_date}${domain_name}${request_path}`),
        daily_visitor_id: generateHash(`${todaysDateHash}${request_ip_address}${userAgentFromRaw}${event_date}${domain_name}`),
        domain_name,
        event_date,
        event_type,
      },
      // Need to add the metadata with the partition keys,
      // See "Creating partitioning keys with an AWS Lambda function" at https://docs.aws.amazon.com/firehose/latest/dev/dynamic-partitioning.html#dynamic-partitioning-partitioning-keys
      metadata: {
        partitionKeys: {
          domain_name,
          event_date,
          event_type,
        }
      }
    } as ParsedEvent
  }
}
