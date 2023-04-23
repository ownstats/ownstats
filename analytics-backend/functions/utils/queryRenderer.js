const clean = (input) => {
  return input.replace(/\n/g, ' ').replace(/\t/g, ' ');
}

export const getSessionAggregation = (inputBucketName, inputPrefix, eventDate) => {
  return clean(`create table session_aggregation_${eventDate.replace(/-/g, '_')} as 
  with base as (
    select
      domain_name,
      daily_visitor_id,
      event_date,
      event_timestamp,
      page_view_id,
      md5(daily_visitor_id || event_timestamp || uuid()) as unique_daily_visitor_id,
      LAG(event_timestamp, 1, event_timestamp) OVER (PARTITION BY daily_visitor_id ORDER BY event_timestamp asc) as last_page_view_timestamp,
      LEAD(event_timestamp, 1, event_timestamp) OVER (PARTITION BY daily_visitor_id ORDER BY event_timestamp asc) as next_page_view_timestamp
    from
      parquet_scan('s3://${inputBucketName}/${inputPrefix}/domain_name=*/event_type=pageview/event_date=${eventDate}/*.parquet', HIVE_PARTITIONING = 1)
  ), session_pre_aggregation as (
  select
    domain_name,
    daily_visitor_id,
    event_date,
    event_timestamp,
    page_view_id,
    CASE
      WHEN date_diff('second', event_timestamp, next_page_view_timestamp) > 1800 THEN LAG(unique_daily_visitor_id, 1, unique_daily_visitor_id) OVER (PARTITION BY daily_visitor_id ORDER BY event_timestamp asc)
      WHEN event_timestamp = next_page_view_timestamp THEN LAG(unique_daily_visitor_id, 1, unique_daily_visitor_id) OVER (PARTITION BY daily_visitor_id ORDER BY event_timestamp asc)
      ELSE unique_daily_visitor_id
    END AS unique_daily_visitor_id,
    CASE
      WHEN date_diff('second', last_page_view_timestamp, event_timestamp) > 1800 THEN true
      WHEN event_timestamp = last_page_view_timestamp THEN true
      ELSE false
    END AS is_session_start,
    CASE
      WHEN date_diff('second', event_timestamp, next_page_view_timestamp) > 1800 THEN true
      WHEN event_timestamp = next_page_view_timestamp THEN true
      ELSE false
    END AS is_session_end
  from
    base
  where
    (is_session_start = true OR is_session_end = true)
  ), session_aggregation as (
  select distinct
    domain_name,
    event_date,
    daily_visitor_id,
    unique_daily_visitor_id,
    FIRST_VALUE(page_view_id) OVER (PARTITION BY unique_daily_visitor_id ORDER BY event_timestamp) AS first_page_view_id,
    MIN(event_timestamp) OVER (PARTITION BY daily_visitor_id, unique_daily_visitor_id) as session_start_timestamp,
    MAX(event_timestamp) OVER (PARTITION BY daily_visitor_id, unique_daily_visitor_id) as session_end_timestamp,
  from
    session_pre_aggregation
  )
  select distinct
    domain_name,
    event_date,
    daily_visitor_id,
    unique_daily_visitor_id,
    first_page_view_id,
    session_start_timestamp,
    session_end_timestamp,
    date_diff('second', session_start_timestamp, session_end_timestamp) AS visit_duration_sec,
    CASE
      WHEN session_start_timestamp = session_end_timestamp THEN md5(unique_daily_visitor_id || session_start_timestamp)
      ELSE NULL
    END AS bounce_id
  from
    session_aggregation
  order by
    domain_name,
    event_date,
    daily_visitor_id,
    unique_daily_visitor_id,
    session_start_timestamp;
  `);
}

export const getStatsAggregation = (inputBucketName, outputBucketName, inputPrefix, outputPrefix, eventDate) => {
  return clean(`COPY (with base as (
    select
      pv.domain_name,
      pv.event_date,
      date_part('hour', pv.event_timestamp) as event_hour,
      pv.edge_city,
      pv.edge_country,
      pv.edge_id,
      pv.edge_latitude,
      pv.edge_longitude,
      pv.referrer_domain_name,
      pv.browser_name,
      pv.browser_os_name,
      pv.device_type,
      pv.device_vendor,
      pv.utm_source,
      pv.utm_campaign,
      pv.utm_medium,
      pv.utm_content,
      pv.utm_term,
      pv.request_path,
      pv.daily_visitor_id,
      pv.page_view_id,
      sa.unique_daily_visitor_id,
      sa.visit_duration_sec,
      sa.bounce_id
    from 
      parquet_scan('s3://${inputBucketName}/${inputPrefix}/domain_name=*/event_type=pageview/event_date=${eventDate}/*.parquet', HIVE_PARTITIONING = 1) pv
    left outer join
      session_aggregation_${eventDate.replace(/-/g, '_')} sa
    on
      (pv.daily_visitor_id = sa.daily_visitor_id and pv.page_view_id = sa.first_page_view_id)
    )
    select
      domain_name,
      event_date,
      event_hour,
      edge_city,
      edge_country,
      edge_latitude,
      edge_longitude,
      referrer_domain_name,
      browser_name,
      browser_os_name,
      device_type,
      device_vendor,
      utm_source,
      utm_campaign,
      utm_medium,
      utm_content,
      utm_term,
      request_path,
      cast(count(page_view_id) as int32) as page_views_cnt,
      cast(count(distinct unique_daily_visitor_id) as int32) as visitor_cnt,
      cast(count(distinct bounce_id) as int32) as bounce_cnt,
      cast(coalesce(round(avg(visit_duration_sec), 0), 0) as int32) as visit_duration_sec_avg
    from
      base
    group by
      domain_name,
      event_date,
      event_hour,
      edge_city,
      edge_country,
      edge_latitude,
      edge_longitude,
      referrer_domain_name,
      browser_name,
      browser_os_name,
      device_type,
      device_vendor,
      utm_source,
      utm_campaign,
      utm_medium,
      utm_content,
      utm_term,
      request_path
    order by
      domain_name,
      event_date,
      event_hour
    ) TO 's3://${outputBucketName}/${outputPrefix}' (FORMAT PARQUET, PARTITION_BY (domain_name, event_date), ALLOW_OVERWRITE TRUE);`);
}

export const getEventAggregation = (inputBucketName, outputBucketName, inputPrefix, outputPrefix, eventDate) => {
  return clean(`COPY (
    select
    domain_name,
    event_date,
    event_timestamp,
    edge_city,
    edge_country,
    edge_latitude,
    edge_longitude,
    request_path,
    page_view_id,
    daily_visitor_id,
    event_name,
    event_data
  from 
    parquet_scan('s3://${inputBucketName}/${inputPrefix}/domain_name=*/event_type=event/event_date=${eventDate}/*.parquet', HIVE_PARTITIONING = 1)
  ) TO 's3://${outputBucketName}/${outputPrefix}' (FORMAT PARQUET, PARTITION_BY (domain_name, event_date, event_name), ALLOW_OVERWRITE TRUE);`);
}
