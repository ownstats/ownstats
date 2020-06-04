const util = require('./util');
const bunyan = require('bunyan');

const logger = bunyan.createLogger({
    name: 'ownstatsLogger',
    level: process.env.LOG_LEVEL || 'debug'
});

// AWS Glue Data Catalog database and tables
const sourceTable = process.env.SOURCE_TABLE;
const targetTable = process.env.TARGET_TABLE;
const database = process.env.DATABASE;

// get the partition of 2hours ago
exports.handler = async (event, context, callback) => {
  const requestLogger = logger.child({ requestId: context.awsRequestId });

  const partitionHour = new Date(Date.now() - 60 * 60 * 1000);
  const year = partitionHour.getUTCFullYear();
  const month = (partitionHour.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = partitionHour.getUTCDate().toString().padStart(2, '0');
  const hour = partitionHour.getUTCHours().toString().padStart(2, '0');

  const s3Bucket = process.env.S3_BUCKET;
  const prefix = `${process.env.S3_PREFIX}year=${year}/month=${month}/day=${day}/hour=${hour}/`;

  try {
    // Check if there are any key present in current partition
    const partitionExistsResult = await util.checkKeysExist(s3Bucket, prefix);

    // See https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#listObjectsV2-property
    if (partitionExistsResult.hasOwnProperty('Contents') && partitionExistsResult.Contents.length > 0) {

      requestLogger.debug(`Found keys in '${s3Bucket}/${prefix}', creating partition!`);
      requestLogger.debug(`Inserting new data in table '${database}.${targetTable}'`);

      const insertStatement = `
      INSERT INTO ${database}.${targetTable}
      SELECT 
        year as event_year,
        month as event_month,
        day as event_day,
        cast(concat(cast(date as VARCHAR(10)), ' ', time) as TIMESTAMP) as event_timestamp,
        location as edge_location,
        el.city as edge_city,
        el.state as edge_state,
        el.country as edge_country,
        cast(el.latitude as REAL) as edge_latitude,
        cast(el.longitude as REAL) as edge_longitude,
        url_decode(url_extract_parameter(qs, 'u')) as url,
        url_decode(url_extract_parameter(qs, 'pa')) as path,
        referrer,
        url_decode(url_extract_parameter(qs, 'ua')) as user_agent,
        url_decode(url_extract_parameter(qs, 'tz')) as timezone,
        concat(url_extract_parameter(qs, 'w'), 'x', url_extract_parameter(qs, 'h')) as device_outer_resolution,
        concat(url_extract_parameter(qs, 'iw'), 'x', url_extract_parameter(qs, 'ih')) as device_inner_resolution,
        cast(url_decode(url_extract_parameter(qs, 'd')) as integer) as device_color_depth,
        url_decode(url_extract_parameter(qs, 'p')) as device_platform,
        cast(url_decode(url_extract_parameter(qs, 'm')) as integer) as device_memory,
        cast(url_decode(url_extract_parameter(qs, 'c')) as integer) as device_cores,
        url_decode(url_extract_parameter(qs, 'l')) as browser_language,
        url_decode(url_extract_parameter(qs, 's')) as source,
        url_decode(url_extract_parameter(qs, 'uso')) as utm_source,
        url_decode(url_extract_parameter(qs, 'uca')) as utm_campaign,
        url_decode(url_extract_parameter(qs, 'ume')) as utm_medium,
        url_decode(url_extract_parameter(qs, 'uco')) as utm_content,
        url_decode(url_extract_parameter(qs, 'ute')) as utm_term,
        result_type as cloudfront_cache_type,
        cast(time_taken*1000 as integer) as cloudfront_time_taken_ms,
        http_version as cloudfront_http_version,
        cast(date as VARCHAR) as event_date,
        hour as event_hour,
        url_decode(url_extract_parameter(qs, 'hn')) as domain_name
      FROM (
        SELECT
          concat(uri, '?', querystring) as qs,
          *
        FROM 
          ${database}.${sourceTable}
        WHERE year = '${year}'
          AND month = '${month}'
          AND day = '${day}'
          AND hour = '${hour}'
          AND uri = '/hello.gif'
          AND querystring <> '-'
          AND position('t=pv' IN querystring) > 0
        ) l
      INNER JOIN
        ${database}.edge_locations el
      ON 
        el.edge_location_prefix=substr(l.location, 1, 3)
      `;
    
      requestLogger.debug(insertStatement);
    
      const repairTableStatement = `MSCK REPAIR TABLE ${database}.${targetTable}`;
    
      requestLogger.debug(repairTableStatement);
    
      await util.runQuery(insertStatement).then(
        () => Promise.all([
          util.runQuery(repairTableStatement)
        ])
      );

    } else {
      requestLogger.debug(`Found no key in '${s3Bucket}/${prefix}', skipping!`);
    }
  } catch (err) {
    requestLogger.error(err);
    throw Error(err);
  }
}
