# ownstats
Host your own privacy-effective website statistics on AWS via CloudFront, S3, Glue and Athena.

## Architecture

![ownstats architecture](docs/images/architecture.png)[]()

### What is provisioned in your AWS account?
* A S3 bucket containing the assets for gathering website statistics (`hello.js` and `hello.gif`)
* A S3 bucket for the CloudFront CDN logs
* A CloudFront distribution for global hosting of the assets via CDN
* A Lambda function for automatic movement of the raw CloudFront logs into a folder structure which benefits Athena partitioning (see [functions/moveAccessLogs.js](functions/moveAccessLogs.js))
* A Lambda function which creates Athena partitions for the raw CloudFront logs (see [functions/createPartition.js](functions/createPartition.js))
* A Lambda function which transforms the raw CloudFront logs into a page view table, and also creates the relevant Athena partitions (see [functions/transformPartition.js](functions/transformPartition.js))
* A set of Glue tables  
  * `access_logs_raw`: Holds the raw CloudFront logs
  * `page_views`: Contains the page views derived from `access_logs_raw`
  * `edge_locations`: A list of CloudFront edge location, which can be used to get approximate location info for the `page_views` table (as IP information is dropped). See below for some usage information.

## Preconditions
This guide assumes that you have a pre-existing domain which you want to use for hosting your static website. Furthermore, you need to have access to the domain's DNS configuration.

Also, you need to have an install of [Serverless](https://www.serverless.com) on your machine.

## How-to 
To use `ownstats` on your websites, you can follow the steps below to get started.

### Set up a Serverless project for your static website
There are basically two ways to get started, either use [Serverless](https://www.serverless.com) to generate a basic project structure, or use the "traditional" fork and clone mechanisms.

#### Use Serverless templates
The following command will create a local project structure you can use to deploy your static website in the `ownstats-mywebsite` folder relative to your current working directory:

```bash
$ sls create --template-url https://github.com/ownstats/ownstats --path ownstats-mywebsite
Serverless: Generating boilerplate...
Serverless: Downloading and installing "ownstats"...
Serverless: Successfully installed "ownstats"
```

**Hint**  
When using this method, Serverless is replacing the `service.name` in the `serverless.yml` file automatically with `ownstats-mywebsite`. If you want to use a different stack name, you have to replace it manually. You also need to take care of that the stack name is using only allowed characters. When using the "Fork and clone" method below, the stack name is automatically derived from the domain name and sanitized regarding the allowed characters.

#### Fork and clone
Once you forked the repo on GitHub, you can clone it locally via

```bash
$ git clone git@github.com:youraccount/yourrepo.git
```

where `youraccount/yourrepo` needs to be replaced with the actual repository name of your forked repo.

### Install dependencies
To install the dependencies, do a 

```bash
$ npm i
```

After that, the project is usable.

### Deploy
You can deploy `ownstats` with the following command:

```bash
$ sls deploy --domain yourdomain.yourtld --stage dev
```

where `yourdomain.yourtld` needs to be replaced with your actual domain name. You can also specify a AWS region via the `--region` flag, otherwise `us-east-1` will be used. Furthermore, you can enable a debug mode for `hello.js` by specifying `--debug-mode true`.

## Usage

## Removal
You can remove the stack by running

```bash
$ sls remove --domain yourdomain.yourtld
```

**Hint**  
It's possible that you'll have to clean the S3 buckets manually before running the above command.
