import { Platform } from "react-native";
import { StripeProvider } from "@stripe/stripe-react-native";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import React from "react";
import * as Linking from "expo-linking";
import { STRIPE_CONFIG } from "@/constants/Config";

// Get the publishable key from the config
const publishableKey = STRIPE_CONFIG.publishableKey;

// Add error handling for missing publishable key
if (!publishableKey) {
  console.warn("Missing Stripe publishable key");
}

// Initialize Stripe for web
const stripePromise = loadStripe(publishableKey);

export default function ExpoStripeProvider(
  props: Omit<
    React.ComponentProps<typeof StripeProvider>,
    "publishableKey" | "merchantIdentifier"
  >
) {
  // For mobile payments, redirect to dashboard after payment completion
  const returnurl = Platform.select({
    web: "https://prismavalet.com/payment/return",
    default: Linking.createURL("/main/(tabs)/dashboard/DashboardScreen"),
  });

  // For native platforms
  return (
    <StripeProvider
      publishableKey={publishableKey}
      merchantIdentifier="merchant.com.time-tracker"
      urlScheme={returnurl?.split("://")?.[0]}
      {...props}
    />
  );
}
