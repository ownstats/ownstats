# Frontend for OwnStats

## Building the frontend
Use the [OwnStats CLI](https://github.com/ownstats/cli) to build the frontend and create a distribution that can be uploaded to S3.

```bash
$ ownstats stack build frontend
```

## Deploying the frontend
Use the [OwnStats CLI](https://github.com/ownstats/cli) to sync the frontend to the S3 bucket.

```bash
$ ownstats stack sync frontend
```
