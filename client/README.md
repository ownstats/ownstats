# OwnStats Client
The OwnStats Tracking Client is implemented as a custom plugin for [getanalytics.io](https://getanalytics.io/). This enables you to customize the `analytics` instance with other plugins, e.g. for sending tracking data in parallel to your OwnStats instance, but also to other analytics providers like [Google Analytics](https://getanalytics.io/plugins/google-analytics/), [Segment](https://getanalytics.io/plugins/segment/) or [Snowplow Analytics](https://getanalytics.io/plugins/snowplow/).

For an overview of all available plugins, have a look at the [getanalytics.io Plugins Page](https://getanalytics.io/plugins/).

You can add the desired plugins by editing the [src/index.js](src/index.js) file. There are hints in the source code how to do this and where. Please keep in mind that you have to trigger the `build` and `deploy` targets to apply your changes to your tracking script (see below).

## Building the client
Use the [OwnStats CLI](https://github.com/ownstats/cli) to build the client and create a distribution that can be uploaded to S3.

```bash
$ ownstats stack build client
```

## Deploying the client
Use the [OwnStats CLI](https://github.com/ownstats/cli) to sync the client to the S3 bucket. This will also invalidate the CloudFront cache.

```bash
$ ownstats stack sync client
```

