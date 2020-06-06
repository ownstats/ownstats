const util = require('util');
const zlib = require('zlib');
const fs = require('fs');
const UglifyJS = require('uglify-js');
const gzip = util.promisify(zlib.gzip);
const writeFile = util.promisify(fs.writeFile);

class TrackingScriptGenerator {
  constructor (targetPath, cfDistributionDomainName, scriptName, pixelName, cli, debugMode) {
    this.targetPath = targetPath;
    this.cfDistributionDomainName = cfDistributionDomainName;
    this.scriptName = scriptName;
    this.pixelName = pixelName;
    this.cli = cli;
    this.debugMode = debugMode;
    this.pixelUrl = `https://${cfDistributionDomainName}/${pixelName}`;	
    this.scriptUrl = `https://${cfDistributionDomainName}/${scriptName}`;
  }

  renderTemplate () {
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
      var utmMatches = loc.search.match(/[?&](utm_source|utm_campaign|utm_medium|utm_content|utm_term)=([^?&]+)/gi);
      var utms = utmMatches ? utmMatches : [];

      // Populate
      var data = { t: 'pv', ts: new Date().getTime(), u: url, hn: loc.hostname };
      if (userAgent) data.ua = userAgent;
      if (refs && refs[0]) data.s = refs[0];
      if (doc.referrer && !isPushState) data.r = doc.referrer;
      if (doc.title) data.ti = doc.title;
      if (window.innerWidth) data.iw = window.innerWidth;
      if (window.innerWidth) data.ih = window.innerHeight;
      if (sc.width) data.w = sc.width;
      if (sc.height) data.h = sc.height;
      if (sc.pixelDepth) data.d = sc.pixelDepth;
      if (nav.language) data.l = nav.language;
      if (nav.platform) data.p = nav.platform;
      if (nav.deviceMemory) data.m = nav.deviceMemory;
      if (nav.hardwareConcurrency) data.c = nav.hardwareConcurrency;

      if (utms.length > 0) {
        utms.forEach(function (m) {
          var temp = m.replace('?', '').replace('&', '').split('=');
          var name = temp[0].split('_')[1];
          data['u'+name.substring(0,2)] = temp[1];
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

})(window, '${this.cfDistributionDomainName}', '/${this.imageName}', ${this.debugMode});
`;

    // Minify script template
    const minifiedScriptTemplate = UglifyJS.minify(scriptTemplate);
    this.cli.log(`Minified ${this.scriptName}`);

    return gzip(minifiedScriptTemplate.code).then(compressedScriptTemplate => {
      this.cli.log(`Compressed ${this.scriptName}`);
      // Write file
      return writeFile(this.targetPath, compressedScriptTemplate).then(() => {
        this.cli.log(`Written ${this.scriptName} template: ${this.targetPath}`);
        this.cli.log(`Tracking pixel URL: ${this.pixelUrl}`);
        this.cli.log(`Tracking script URL: ${this.scriptUrl}`);
        this.cli.log(`You can now add '<script src="${this.scriptUrl}"></script>' to your website's sources to enable the gathering of statistics`);
        return;
      })
    });
  }
}

module.exports = TrackingScriptGenerator;
