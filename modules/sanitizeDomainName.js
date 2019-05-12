module.exports.sanitize = (serverless) => {
    if (!serverless.providers.aws.options.hasOwnProperty('domain')) {
        serverless.cli.log('No domain flag found, exiting! Please specify --domain <domainName>');
        process.exit(1);
    } else {
        const sanitizedDomainName = `${serverless.providers.aws.options.domain.replace(/\./g, '-')}`;
        return sanitizedDomainName;
    }
};
