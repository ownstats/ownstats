const fs = require('fs');
const path = require('path');

module.exports.handler = (data, serverless, options) => {
    const pixelUrl = `https://${data.CloudFrontDistributionDomainName}/p.gif`;
    const scriptUrl = `https://${data.CloudFrontDistributionDomainName}/script.js`;
    const domain = serverless.providers.aws.options.domain;

    const scriptTemplate = `
if (window.location.hostname == '${domain}') {
    var p = new Image(1,1);
    var e = encodeURIComponent;
    p.src = "${pixelUrl}?u=" +
        e(window.location.pathname) + (document.referrer ? "&r=" + e(document.referrer) : "");
}
`;

    const scriptPath = path.join(__dirname, '../', 'src/script.js');
    fs.writeFileSync(scriptPath, scriptTemplate);

    serverless.cli.log(`Written script.js template: ${scriptPath}`);
    serverless.cli.log(`Tracking pixel URL: ${pixelUrl}`);
    serverless.cli.log(`Tracking script URL: ${scriptUrl}`);
};
