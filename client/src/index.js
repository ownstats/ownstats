import Analytics from '@analytics/core'
import tabEventsPlugin from 'analytics-plugin-tab-events'
import ownstatsPlugin from './plugins/ownstats'
import disableStoragePlugin from './plugins/disableStorage/index'
// Import other getanalytics.io plugins here

function Loader(config = {}) {
  const analytics = Analytics({
    app: config.appName || 'ownstats',
    plugins: [
      disableStoragePlugin(),
      ownstatsPlugin({
        endpoint: config.endpoint,
        domainKey: config.domainKey,
        useAutomation: config.useAutomation,
        debug: !!config.debug
      }),
      tabEventsPlugin(),
      // Add other getanalytics.io plugins here
    ]
  })

  analytics.on('ready', () => {})

  analytics.on('tabHidden', () => {
    analytics.track('tabHidden')
  })

  analytics.on('tabVisible', () => {
    analytics.track('tabVisible')
  })

  return analytics
}

// Get necessary attributes
const domainKey = document.currentScript.getAttribute('data-domainkey');

if (!domainKey) {
  console.error("Please add a data-domainkey attribute the the <script> element!");
} else {
  // Automatically start instance.
  window.analytics = Loader({
    endpoint: new URL(document.currentScript.src).host,
    domainKey,
    useAutomation: true,
    debug: false,
  });
}
