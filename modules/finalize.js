const path = require('path');
const TrackingScriptGenerator = require('./lib/TrackingScriptGenerator');

module.exports.handler = (data, serverless, options) => {
  // CloudFront distribution name can be found under 'data.CloudFrontDistributionDomainName'
  // Domain option can be found under serverless.providers.aws.options.domain'

  const scriptName = 'hello.js';
  const pixelName = 'hello.gif';
  const debugMode = serverless.providers.aws.options['debug-mode'] ? new Boolean(serverless.providers.aws.options['debug-mode']) : false;

  const scriptPath = path.join(__dirname, '../', 'src/', scriptName);
  
  const trackingScriptGenerator = new TrackingScriptGenerator(scriptPath, data.CloudFrontDistributionDomainName, scriptName, pixelName, serverless.cli, debugMode);

  // Run
  // 1. Generate event date hashes
  // 2. Generate tracking script
  trackingScriptGenerator.renderTemplate()
    .catch(err => {
      serverless.cli.log(`Error during finalization: ${error}`);
    });
};
