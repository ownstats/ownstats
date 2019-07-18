const fs = require('fs');
const path = require('path');

module.exports.handler = (data, serverless, options) => {
    // CloudFront distribution name can be found under 'data.CloudFrontDistributionDomainName'
    // Domain option can be found under serverless.providers.aws.options.domain'

    const scriptTemplate = `
(function(window, hostname, path, debugMode) {
    // Cancel if not run in browser
    if (!window) return;

    var reqUrl = 'https://' + hostname + path;
    var con = window.console;
    var e = encodeURIComponent;
    var dontSend = 'Not sending request';

    var warn = function(message) {
        if (con && con.warn) con.warn('ownstats: ' + message);
    }

    try {
        var nav = window.navigator;
        var loc = window.location;
        var doc = window.document;
        var dis = window.dispatchEvent;
        var his = window.history;
        var sc = window.screen;
        var userAgent = nav.userAgent;

        var send = function (isPushState) {

            // Cancel sending in special cases
            if (userAgent.search(/(bot|spider|crawl)/ig) > -1) return warn(dontSend + ' because user agent is a robot');
            if ('visibilityState' in doc && doc.visibilityState === 'prerender') return warn(dontSend + ' when in prerender mode');
            if (loc.hostname === 'localhost' || loc.protocol === 'file:') return warn(dontSend + ' from localhost');
    
            var url = loc.protocol + '//' + loc.hostname + loc.pathname;
    
            // Add hash to url when script is put in to hash mode
            if (loc.hash) url += loc.hash.split('?')[0];
    
            // Get references
            var refMatches = loc.search.match(/[?&](utm_source|source|ref)=([^?&]+)/gi);
            var refs = refMatches ? refMatches.map(function(m) { return m.split('=')[1] }) : [];

            // UTM
            var utmMatches = loc.search.match(/[?&](utm_campaign|utm_medium|utm_content|utm_term)=([^?&]+)/gi);
    
            // Populate
            var data = { u: url };
            if (userAgent) data.ua = userAgent;
            if (refs && refs[0]) data.ur = refs[0];
            if (doc.referrer && !isPushState) data.r = doc.referrer;
            if (window.innerWidth) data.iw = window.innerWidth;
            if (window.innerWidth) data.ih = window.innerHeight;
            if (sc.width) data.w = sc.width;
            if (sc.height) data.h = sc.height;
            if (sc.pixelDepth) data.d = sc.pixelDepth;
            if (nav.language) data.l = nav.language;
            if (nav.platform) data.p = nav.platform;
            if (nav.deviceMemory) data.m = nav.deviceMemory;
            if (nav.hardwareConcurrency) data.c = nav.hardwareConcurrency;

            if (utmMatches.length > 0) {
                utmMatches.forEach(function (m) {
                    var temp = m.split('=');
                    var name = temp[0].split('_');
                    data['u'+name.substring(0,1)] = temp[1];
                });
            }
    
            try {
                data.tz = Intl.DateTimeFormat().resolvedOptions().timeZone
            } catch (error) {
                // noop
            }

            // Build querystring
            var qs = [];
            for (var property in data) {
                if (data.hasOwnProperty(property)) {
                    qs.push(property+'='+e(data[property].toString()));
                }
            }

            // Trigger request
            var p = new Image(1,1);
            p.id = 'ownsp';
            p.src = reqUrl + '?' + qs.join('&');
            if (debugMode) con.log('ownstats: ' + p.src);
            document.body.appendChild(p);
            p.onload = function() {
                // Remove image from DOM
                var ownsp = document.getElementById('ownsp');
                ownsp.parentNode.removeChild(ownsp);
            };

        }

        // Normal navigation
        var hisPushState = his ? his.pushState : null;
        if (hisPushState && Event && dis) {
            var stateListener = function(type) {
            var orig = his[type];
            return function() {
                var rv = orig.apply(this, arguments);
                var event = new Event(type);
                event.arguments = arguments;
                dis(event);
                return rv;
            };
            };
            his.pushState = stateListener('pushState');
            window.addEventListener('pushState', function() {
                send(true);
            });
        }

        // SPA navigation
        if ('onhashchange' in window) {
            window.onhashchange = function() {
                send(true);
            }
        }

        send();

    } catch (e) {
        if (con && con.error) con.error('ownstats: ' + e);
    }

})(window, ${data.CloudFrontDistributionDomainName}, '/p.gif', debugMode);
`;

    const scriptPath = path.join(__dirname, '../', 'src/script.js');
    fs.writeFileSync(scriptPath, scriptTemplate);

    serverless.cli.log(`Written script.js template: ${scriptPath}`);
    serverless.cli.log(`Tracking pixel URL: ${pixelUrl}`);
    serverless.cli.log(`Tracking script URL: ${scriptUrl}`);
};
