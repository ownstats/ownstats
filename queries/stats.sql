select
  year,
  month,
  day,
  hour,
  date,
  time,
  location,
  bytes,
  requestip as request_ip,
  status,
  referrer,
  url_decode(url_extract_parameter(qs, 'ua')) as user_agent,
  resulttype as result_type,
  responseresulttype as response_result_type,
  requestbytes as request_bytes,
  timetaken as time_taken,
  case when xforwardedfor = '-' then NULL else xforwardedfor end as x_forwarded_for,
  httpversion as http_version,
  url_decode(url_extract_parameter(qs, 'tz')) as timezone,
  concat(url_extract_parameter(qs, 'w'), 'x', url_extract_parameter(qs, 'h')) as device_outer_resolution,
  concat(url_extract_parameter(qs, 'iw'), 'x', url_extract_parameter(qs, 'ih')) as device_inner_resolution,
  url_decode(url_extract_parameter(qs, 'd')) as device_color_depth,
  url_decode(url_extract_parameter(qs, 'p')) as device_platform,
  url_decode(url_extract_parameter(qs, 'm')) as device_memory,
  url_decode(url_extract_parameter(qs, 'c')) as device_cores,
  url_decode(url_extract_parameter(qs, 'l')) as browser_language,
  url_decode(url_extract_parameter(qs, 's')) as source,
  url_decode(url_extract_parameter(qs, 'uso')) as utm_source,
  url_decode(url_extract_parameter(qs, 'uca')) as utm_campaign,
  url_decode(url_extract_parameter(qs, 'ume')) as utm_medium,
  url_decode(url_extract_parameter(qs, 'uco')) as utm_content,
  url_decode(url_extract_parameter(qs, 'ute')) as utm_term
from (
  select
    concat(uri, '?', querystring) as qs,
    *
  from 
    ownstats_yourdomain_yourtld_dev.access_logs
  where
    uri = '/p.gif'
  and
    querystring <> '-'
)