# Ownstats
Host your own privacy-effective website analytics on AWS, serverlessly!

The current version of Ownstats is described (and further developed) in a series of blog posts at [www.tobilg.com](https://www.tobilg.com). This repository holds the code and IaC for the series, and is designed as a monorepo that will consist of different packages, which will be added with every new part of the blog series.

## Packages
* [analytics-backend](analytics-backend/README.md): The backend infrastructure to enable to sending of web analytics data, transformation and enrichtment, as well as persisting the data in S3
* [tracking-library](tracking-library/README.md): The client-side tracking library implementation

## Previous version 1.0
You can find the previous version 1.0 of Ownstats in the [versions/v1](https://github.com/ownstats/ownstats/tree/versions/v1) branch, or via the `1.0.0` tag.
