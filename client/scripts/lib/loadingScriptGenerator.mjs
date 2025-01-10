import { writeFile } from 'fs/promises';

export default class LoadingScriptGenerator {
  constructor(loaderName, trackerName, loaderPath, cdnBaseUrl) {
    this.loaderName = loaderName;
    this.trackerName = trackerName;
    this.loaderPath = loaderPath;
    this.cdnBaseUrl = cdnBaseUrl;
  }

  async renderTemplate(name) {
    // Define the script template inline like the JS version
    const scriptTemplate = `
(function (w, d) {
  var script, newScript
  var name = '${name}'
  var domainKey = d.currentScript.getAttribute('data-domainkey')
  function ready(fn) {
    if (d.attachEvent ? d.readyState === 'complete' : d.readyState !== 'loading') {
      return fn()
    }
    d.addEventListener('DOMContentLoaded', fn)
  }
  if (!w[name]) {
  w[name] = true
  ready(function ____init() {
    w.setTimeout(function () {
      script = d.getElementsByTagName('SCRIPT')[0]
      newScript = d.createElement('SCRIPT')
      newScript.type = 'text/javascript'
      newScript.async = true
      newScript.src = '${this.cdnBaseUrl}/versions/${this.trackerName}'
      newScript.setAttribute('data-domainkey', domainKey)
      script.parentNode.insertBefore(newScript, script)
      }, 10)
    })
  }
}(window, document))
`;

    // Import UglifyJS (you'll need to add this to your imports)
    const UglifyJS = (await import('uglify-js')).default;
    
    // Minify script template
    const minifiedScriptTemplate = UglifyJS.minify(scriptTemplate);
    console.log(`Minified ${this.loaderName}`);

    // Write file
    await writeFile(this.loaderPath, minifiedScriptTemplate.code);
    console.log(`Written ${this.loaderName} template: ${this.loaderPath}`);
  }
} 