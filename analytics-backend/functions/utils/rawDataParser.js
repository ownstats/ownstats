import UAParser from "ua-parser-js";
import isbot from "isbot";
import { createHash} from "crypto";
import AWSEdgeLocations from "aws-edge-locations";
import { lookupDateHash } from "./dateHashes";

const awsEdgeLocations = new AWSEdgeLocations();

const expectedDataPartsCount = 12;

const { CDN_DOMAIN_NAME } = process.env;

const generateHash = (stringToHash) => {
  const hash = createHash('sha256');
  return hash.update(stringToHash).digest("hex");
}

const translateDeviceType = (deviceType) => {
  const mapping = {
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

export const parse = (rawData) => {
  // Split the raw data by tabs
  const dataParts = rawData.split(/\t/g);

  // Store potential error
  let error = null;

  if (dataParts.length !== expectedDataPartsCount) {
    error = (`Parts count doesn't match: Got ${dataParts.length}, but expected ${expectedDataPartsCount}!`);
  } else if (dataParts[3].startsWith("/noscript.gif") === false && dataParts[3].startsWith("/hello.gif") === false) {
    // Return early when irrelevant record arrived
    return {
      result: "Dropped",
    }
  } else {
    // Check if noscript
    const isNoScript = dataParts[3].includes("/noscript.gif");

    // Extract query string details
    const queryStringData = dataParts[9] === "-" ? null : new URLSearchParams(dataParts[9]);

    // Extract arrival timestamp
    const arrivalTimestamp = new Date(parseInt(dataParts[0])*1000);

    // Extract event timestamp
    const eventTimestamp = new Date(parseInt(decodeURIComponent(queryStringData.get("ts"))));

    // Extract IP address (for later hashing)
    const request_ip_address = dataParts[1];

    // Extract HTTP status code
    const request_status_code = parseInt(dataParts[2]);

    // Extract path
    const rawPath = dataParts[3];
    const pathFromQS = decodeURIComponent(queryStringData.get("pa"));
    const request_path = !isNoScript ? pathFromQS : (rawPath.includes("?") ? rawPath.substring(0, rawPath.indexOf("?")) : rawPath);
    
    // Extract byte size
    const request_bytes = parseInt(dataParts[4]);

    // Extract request approximate location data from edge pop
    const approximateLocationData = awsEdgeLocations.lookup(dataParts[5].substr(0,3));

    // Extract delivery time
    const request_delivery_time_ms = parseInt(parseFloat(dataParts[6]) * 1000);

    // Extract user agent details
    const userAgentFromRaw = decodeURIComponent(dataParts[7]);
    const userAgentFromQS = decodeURIComponent(queryStringData.get("ua"));
    const userAgentDetails = isNoScript ? new UAParser(userAgentFromRaw) : (userAgentFromQS === null ? new UAParser(userAgentFromQS) : new UAParser(userAgentFromRaw));

    // Extract referer
    const refererFromRaw = dataParts[8] === "-" ? null : dataParts[8];
    const refererFromQS = queryStringData.get("r") ? decodeURIComponent(queryStringData.get("r")) : null;
    const refererHostnameFromQS = refererFromQS ? new URL(refererFromQS)?.hostname : null;
    const referer = (refererHostnameFromQS && refererHostnameFromQS === CDN_DOMAIN_NAME || refererHostnameFromQS && refererHostnameFromQS === decodeURIComponent(queryStringData.get("hn"))) ? null : refererFromQS;

    // Extract referer hostname
    const refererHostname = referer ? new URL(referer).hostname : "Direct / None";

    // Extract referer query string
    const refererQueryStringData = referer && referer.includes("?") ? new URLSearchParams(referer.substring(dataParts[6].indexOf("?"), referer.length-1)) : null;

    // Extract url
    const rawUrl = decodeURIComponent(queryStringData.get("u"));
    const request_url = !isNoScript ? rawUrl : (refererFromRaw.includes("?") ? refererFromRaw.substring(refererFromRaw.indexOf("?"), refererFromRaw.length-1) : refererFromRaw);

    // Extract cache status
    const request_cache_status = dataParts[10];

    // Extract ASN
    const request_asn = parseInt(dataParts[11].replace(/\n/g, ""));

    // Extract domain name
    const domain_name = !isNoScript ? decodeURIComponent(queryStringData.get("hn")) : (refererHostname ? refererHostname.replace("www.", "") : null);

    // Extract UTM data
    const utm_source = !isNoScript && queryStringData.get("uso") ? decodeURIComponent(queryStringData.get("uso")) : (refererQueryStringData ? decodeURIComponent(refererQueryStringData.get("utm_source")) : null);
    const utm_campaign = !isNoScript && queryStringData.get("uca") ? decodeURIComponent(queryStringData.get("uca")) : (refererQueryStringData ? decodeURIComponent(refererQueryStringData.get("utm_campaign")) : null);
    const utm_medium = !isNoScript && queryStringData.get("ume") ? decodeURIComponent(queryStringData.get("ume")) : (refererQueryStringData ? decodeURIComponent(refererQueryStringData.get("utm_medium")) : null);
    const utm_content = !isNoScript && queryStringData.get("uco") ? decodeURIComponent(queryStringData.get("uco")) : (refererQueryStringData ? decodeURIComponent(refererQueryStringData.get("utm_content")) : null);
    const utm_term = !isNoScript && queryStringData.get("ute") ? decodeURIComponent(queryStringData.get("ute")) : (refererQueryStringData ? decodeURIComponent(refererQueryStringData.get("utm_term")) : null);
    
    // Extract browser data
    const browser_timezone = queryStringData.get("tz") ? decodeURIComponent(queryStringData.get("tz")) : null;
    const browser_language = queryStringData.get("l") ? decodeURIComponent(queryStringData.get("l")) : null;
    const device_outer_resolution = queryStringData.get("w") && queryStringData.get("h") ? `${decodeURIComponent(queryStringData.get("w"))}x${decodeURIComponent(queryStringData.get("h"))}` : null;
    const device_inner_resolution = queryStringData.get("iw") && queryStringData.get("ih") ? `${decodeURIComponent(queryStringData.get("iw"))}x${decodeURIComponent(queryStringData.get("ih"))}` : null;
    const device_color_depth = queryStringData.get("d") ? parseInt(decodeURIComponent(queryStringData.get("d"))) : null;
    const device_platform = queryStringData.get("p") ? decodeURIComponent(queryStringData.get("p")) : null;
    const device_memory = queryStringData.get("m") ? parseFloat(decodeURIComponent(queryStringData.get("m"))) : null;
    const device_cores = queryStringData.get("c") ? parseInt(decodeURIComponent(queryStringData.get("c"))) : null;

    // Derive envent_date string
    const event_date = eventTimestamp.toISOString().split('T')[0];

    // Derive event type
    let event_type = "na";

    switch (decodeURIComponent(queryStringData.get("t"))) {
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
    const result = error ? "ProcessingFailed" : "Ok";

    // Today's date hash
    const todaysDateHash = lookupDateHash(event_date);

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
        edge_city: approximateLocationData.city,
        edge_state: approximateLocationData?.state || null,
        edge_country: approximateLocationData.country,
        edge_country_code: approximateLocationData.countryCode,
        edge_latitude: approximateLocationData.latitude,
        edge_longitude: approximateLocationData.longitude,
        edge_id: dataParts[5].substr(0,3),
        referer,
        referer_domain_name: refererHostname,
        browser_name: userAgentDetails ? userAgentDetails.getBrowser()?.name : null,
        browser_version: userAgentDetails ? userAgentDetails.getBrowser()?.version : null,
        browser_os_name: userAgentDetails ? userAgentDetails.getOS()?.name : null,
        browser_os_version: userAgentDetails ? userAgentDetails.getOS()?.version : null,
        browser_timezone,
        browser_language,
        device_type: translateDeviceType(userAgentDetails.getDevice() ? userAgentDetails.getDevice()?.type || null : null),
        device_vendor: userAgentDetails.getDevice() ? userAgentDetails.getDevice()?.vendor || null : null,
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
        event_name: ((event_type === "event" || event_type === "track") && queryStringData.get("en")) ? decodeURIComponent(queryStringData.get("en")) : null,
        event_data: event_type === "event" ? decodeURIComponent(queryStringData.get("pr")) : null,
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
    }
  }
}
