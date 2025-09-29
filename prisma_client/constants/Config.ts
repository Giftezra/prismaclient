import Constants from "expo-constants";

// Function to get config with fallbacks
const getConfig = () => {
  const config =
    Constants.expoConfig?.extra || (Constants.manifest as any)?.extra || {};
  return config;
};

const config = getConfig();

// Stripe Configuration
export const STRIPE_CONFIG = {
  publishableKey: config.stripe?.publishableKey,
};

// API Configuration with fallbacks for testing
export const API_CONFIG = {
  detailerAppUrl:
    config.detailer_app_url,
  customerAppUrl:
    config.customer_app_url,
  websocketUrl:
    config.websocket_url
};

// Debug logging removed
// App Configuration
export const APP_CONFIG = {
  name: Constants.expoConfig?.name || "Prisma Client",
  version: Constants.expoConfig?.version || "1.0.0",
  scheme: Constants.expoConfig?.scheme || "prismaclient",
  projectId:
    Constants.expoConfig?.extra?.eas?.projectId ||
    "12a19ebe-4dc8-457b-99e9-ccc269808a5c",
};

// Validation
if (!STRIPE_CONFIG.publishableKey) {
  console.warn("Missing Stripe publishable key in app configuration");
}

if (!API_CONFIG.detailerAppUrl) {
  console.warn("Missing detailer app URL in app configuration");
}
