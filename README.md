# Ownstats
Host your own privacy-effective website analytics on AWS, serverlessly!

The current version of Ownstats is described (and further developed) in a series of blog posts at [www.tobilg.com](https://www.tobilg.com). This repository holds the code and IaC for the series, and is designed as a monorepo that will consist of different packages, which will be added with every new part of the blog series.

## Packages
* [backend](backend/README.md): The backend infrastructure to enable to sending of web analytics data, transformation and enrichtment, as well as persisting the data in S3
* [frontend](frontend/README.md): The frontend application, which is a React application that makes use of DuckDB WASM
* [client](client/README.md): The JavaScript client library, which can be used to send analytics data to the backend

## Prerequisites
* A local installation of Node 18+
* An AWS account with the necessary permissions to create resources needed for the project, as well as locally configured AWS credentials for deploying to AWS
* A local installation of [Serverless Framework v3 (not v4!)](https://www.serverless.com/framework/docs/getting-started/)
* A local installation of [npm](https://docs.npmjs.com/cli/v11/commands/npm)

## Documentation
The documentation for the current version of Ownstats is available at [ownstats.com/docs](https://ownstats.com/docs).
