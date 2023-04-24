import Analytics from '@analytics/core'
import tabEventsPlugin from 'analytics-plugin-tab-events'
import ownstatsPlugin from './plugins/ownstats'

const parseBoolean = (inputString, defaultValue = true) => {
  if (inputString && inputString.toLowerCase().trim() === 'true') return true;
  if (inputString && inputString.toLowerCase().trim() === 'false') return false;
  return defaultValue;
}

function OwnStats(config = {}) {
  const analytics = Analytics({
    app: config.appName || 'ownstats',
    plugins: [
      ownstatsPlugin({
        endpoint: config.endpoint,
        useAutomation: config.useAutomation,
        debug: !!config.debug
      }),
      tabEventsPlugin(),
    ]
  })

  analytics.on('ready', () => {
    if (config.debug) console.log(`Ownstats tracking is ready!`);
  })

  analytics.on('tabHidden', () => {
    analytics.track('tabHidden')
  })

  analytics.on('tabVisible', () => {
    analytics.track('tabVisible')
  })

  return analytics
}

// Get script attributes or set default values
const endpoint = document.currentScript.getAttribute('data-ownstats-endpoint');
const useAutomation = parseBoolean(document.currentScript.getAttribute('data-ownstats-use-automation'), true);
const useDebug = parseBoolean(document.currentScript.getAttribute('data-ownstats-use-debug'), false);

// Fail if no endpoint is found
if (!endpoint) {
  console.log('Ownstats tracking could not be started due to missing endpoint URL. Please add the data-ownstats-endpoint attribute to the <script> tag loading this script!');
} else {
  // Automatically start instance.
  window.analytics = OwnStats({
    endpoint: endpoint,
    useAutomation: useAutomation,
    debug: useDebug,
  });
}
