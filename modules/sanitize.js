module.exports.sanitizeDomainName = (serverless) => {
    if (!serverless.providers.aws.options.hasOwnProperty('domain')) {
        serverless.cli.log('No domain flag found, exiting! Please specify --domain <domainName>');
        process.exit(1);
    } else {
        return `${serverless.providers.aws.options.domain.replace(/\./g, '-')}`;
    }
};

module.exports.sanitizeDatabaseName = (serverless) => {
    if (!serverless.providers.aws.options.hasOwnProperty('domain')) {
        serverless.cli.log('No domain flag found, exiting! Please specify --domain <domainName>');
        process.exit(1);
    } else if (!serverless.providers.aws.options.hasOwnProperty('stage')) {
        serverless.cli.log('No stage flag found, exiting! Please specify --stage <stageName>');
        process.exit(1);
    } else {
        return `ownstats_${serverless.providers.aws.options.domain.replace(/\./g, '_').replace(/-/g, '_')}_${serverless.providers.aws.options.stage}`
    }
};
