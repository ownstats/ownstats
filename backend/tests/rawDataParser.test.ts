import { join } from 'path';
import { readFileSync } from 'fs';
import { parse } from '../functions/utils/rawDataParser'; 

const rawPageViewData = readFileSync(join(__dirname, './data', 'rawPageViewData.txt'), { encoding: 'utf-8' });
const rawTabEventData = readFileSync(join(__dirname, './data', 'rawTabEventData.txt'), { encoding: 'utf-8' });
const rawHelloScriptData = readFileSync(join(__dirname, './data', 'rawHelloScriptData.txt'), { encoding: 'utf-8' });
const rawGoScriptData = readFileSync(join(__dirname, './data', 'rawGoScriptData.txt'), { encoding: 'utf-8' });
const rawRefererData = readFileSync(join(__dirname, './data', 'rawRefererData.txt'), { encoding: 'utf-8' });

test('parse referrer correctly', () => {
  const parseResult = parse(rawRefererData);

  expect(parseResult.data?.referrer).toEqual("https://cloudsecdocs.com/");
  expect(parseResult.data?.referrer_domain_name).toEqual("cloudsecdocs.com");
});

test('parse page view data correctly', () => {
  const parseResult = parse(rawPageViewData);
  const expectedResult = {
    "event_year": 2022,
    "event_month": 11,
    "event_day": 20,
    "event_timestamp": "2022-11-20T18:22:06.289Z",
    "arrival_timestamp": "2022-11-20T18:22:06.000Z",
    "arrival_delay_ms": 289,
    "edge_city": "Hamburg",
    "edge_state": "Hamburg",
    "edge_country": "Germany",
    "edge_country_code": "DE",
    "edge_latitude": 53.630401611328,
    "edge_longitude": 9.9882297515869,
    "edge_id": "HAM",
    "referrer": null,
    "referrer_domain_name": "Direct / None",
    "browser_name": "Chrome",
    "browser_version": "107.0.0.0",
    "browser_os_name": "Mac OS",
    "browser_os_version": "10.15.7",
    "browser_timezone": "Europe/Berlin",
    "browser_language": "de-DE",
    "device_type": "Desktop",
    "device_vendor": "Apple",
    "device_outer_resolution": "3440x1440",
    "device_inner_resolution": "1356x902",
    "device_color_depth": 24,
    "device_platform": "MacIntel",
    "device_memory": 8,
    "device_cores": 8,
    "utm_source": null,
    "utm_campaign": null,
    "utm_medium": null,
    "utm_content": null,
    "utm_term": null,
    "request_url": "http://localhost:3000/azure",
    "request_path": "/azure",
    "request_query_string": "t=pv&ts=1668968526289&u=http%253A%252F%252Flocalhost%253A3000%252Fazure&hn=localhost&pa=%252Fazure&ua=Mozilla%252F5.0%2520(Macintosh%253B%2520Intel%2520Mac%2520OS%2520X%252010_15_7)%2520AppleWebKit%252F537.36%2520(KHTML%252C%2520like%2520Gecko)%2520Chrome%252F107.0.0.0%2520Safari%252F537.36&iw=1356&ih=902&ti=Map%2520the%2520Cloud%2520-%2520Azure%2520Services%2520%2526%2520Regions&w=3440&h=1440&d=24&l=de-DE&p=MacIntel&m=8&c=8&tz=Europe%252FBerlin",
    "request_bytes": 319,
    "request_status_code": 200,
    "request_cache_status": "Hit",
    "request_delivery_time_ms": 0,
    "request_asn": 3320,
    "request_is_bot": 0,
    "event_name": null,
    "event_data": null,
    "page_view_id": "b62e7038fd22d1e39a618e7c758e423a65c9448544e9027bcd3c5026cbc7f705",
    "daily_page_view_id": "81e7a875af519fc2beeb2544b336a2b5d1b4f3f4218843b221deea83b0e3e812",
    "daily_visitor_id": "f2fddd08aeb4ab0ba7e39a806a502f4686bbbbbcf52542ad7b327169304ea7b0",
    "domain_name": "localhost",
    "event_date": "2022-11-20",
    "event_type": "pageview"
  }

  const expectedMetadata = {
    "partitionKeys": {
      "domain_name": "localhost",
      "event_date": "2022-11-20",
      "event_type": "pageview"
    }
  }

  expect(Object.getOwnPropertyNames(parseResult.data).length).toBe(51);
  expect(parseResult.result).toEqual("Ok");
  expect(parseResult.data).toEqual(expectedResult);
  expect(parseResult.metadata).toEqual(expectedMetadata);
});

test('parse tab event data correctly', () => {
  const parseResult = parse(rawTabEventData);
  const expectedResult =  {
    "event_year": 2022,
    "event_month": 11,
    "event_day": 20,
    "event_timestamp": "2022-11-20T20:07:55.096Z",
    "arrival_timestamp": "2022-11-20T20:07:55.000Z",
    "arrival_delay_ms": 96,
    "edge_city": "Hamburg",
    "edge_state": "Hamburg",
    "edge_country": "Germany",
    "edge_country_code": "DE",
    "edge_latitude": 53.630401611328,
    "edge_longitude": 9.9882297515869,
    "edge_id": "HAM",
    "referrer": null,
    "referrer_domain_name": "Direct / None",
    "browser_name": "Chrome",
    "browser_version": "107.0.0.0",
    "browser_os_name": "Mac OS",
    "browser_os_version": "10.15.7",
    "browser_timezone": null,
    "browser_language": null,
    "device_type": "Desktop",
    "device_vendor": "Apple",
    "device_outer_resolution": null,
    "device_inner_resolution": null,
    "device_color_depth": null,
    "device_platform": null,
    "device_memory": null,
    "device_cores": null,
    "utm_source": null,
    "utm_campaign": null,
    "utm_medium": null,
    "utm_content": null,
    "utm_term": null,
    "request_url": "http://localhost:3000/googlecloud",
    "request_path": "/googlecloud",
    "request_query_string": "t=tr&ts=1668974875096&u=http%253A%252F%252Flocalhost%253A3000%252Fgooglecloud&hn=localhost&pa=%252Fgooglecloud&en=tabHidden&pr=%257B%257D",
    "request_bytes": 124,
    "request_status_code": 200,
    "request_cache_status": "Hit",
    "request_delivery_time_ms": 1,
    "request_asn": 3320,
    "request_is_bot": 0,
    "event_name": "tabHidden",
    "event_data": "{}",
    "page_view_id": "9857501b43de2ba28def6e5c3597158cb7c700ea61d9b88a6b432c4784180e90",
    "daily_page_view_id": "95b053d31bb37582244457b224817c871c0ffb72bd0af38224b459510b96c7b4",
    "daily_visitor_id": "f2fddd08aeb4ab0ba7e39a806a502f4686bbbbbcf52542ad7b327169304ea7b0",
    "domain_name": "localhost",
    "event_date": "2022-11-20",
    "event_type": "event"
  }

  const expectedMetadata = {
    "partitionKeys": {
      "domain_name": "localhost",
      "event_date": "2022-11-20",
      "event_type": "event"
    }
  }

  expect(Object.getOwnPropertyNames(parseResult.data).length).toBe(51);
  expect(parseResult.result).toEqual("Ok");
  expect(parseResult.data).toEqual(expectedResult);
  expect(parseResult.metadata).toEqual(expectedMetadata);
});

test('parse go script data correctly', () => {
  const parseResult = parse(rawGoScriptData);
  
  expect(parseResult.result).toEqual("Dropped");
});

test('parse hello script data correctly', () => {
  const parseResult = parse(rawHelloScriptData);
  
  expect(parseResult.result).toEqual("Dropped");
});
