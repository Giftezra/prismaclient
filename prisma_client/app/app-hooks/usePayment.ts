import { useCallback } from "react";
import { useStripe } from "@stripe/stripe-react-native";
import { useFetchPaymentSheetDetailsMutation } from "@/app/store/api/bookingApi";
import { useAlertContext } from "@/app/contexts/AlertContext";
import { PaymentSheetResponse } from "@/app/interfaces/BookingInterfaces";
import { RootState, useAppSelector } from "../store/main_store";
import { useAddresses } from "./useAddresses";

/**
 * Custom hook for managing payment functionality using Stripe
 *
 * This hook provides a comprehensive interface for handling payment operations,
 * including payment sheet initialization, payment processing, and error handling.
 * It can be used across the application for various payment scenarios like
 * booking payments, tips, subscriptions, etc.
 *
 * Features:
 * - Payment sheet initialization with Stripe
 * - Payment processing with error handling
 * - Support for different currencies and countries
 * - Comprehensive error handling for various payment scenarios
 *
 * @returns Object containing payment methods and utilities
 */
const usePayment = () => {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [fetchPaymentSheetDetails] = useFetchPaymentSheetDetailsMutation();
  const { setAlertConfig, setIsVisible } = useAlertContext();
  const { addresses } = useAddresses();

  /**
   * Fetches payment sheet details from the server
   *
   * @param finalPrice - The total price in euros
   * @returns Promise that resolves to payment sheet details
   */
  const fetchPaymentSheetDetailsFromServer = useCallback(
    async (
      finalPrice: number,
      bookingReference: string
    ): Promise<PaymentSheetResponse> => {
      try {
        const amountInCents = Math.round(finalPrice * 100);
        const response = await fetchPaymentSheetDetails({
          amount: amountInCents,
          booking_reference: bookingReference,
        }).unwrap();
        return response;
      } catch (error) {
        console.error("Error fetching payment sheet details:", error);
        throw error;
      }
    },
    [fetchPaymentSheetDetails]
  );

  /**
   * Initializes the payment sheet when the checkout page is opened.
   * Calls the fetchPaymentSheetDetails method to fetch the payment sheet details from the server.
   * Then calls the initPaymentSheet method to initialize the payment sheet.
   *
   * @param finalPrice - The total price to charge
   * @param userAddress - Optional user address for country/currency detection
   * @param merchantDisplayName - Optional custom merchant display name (defaults to "Prisma Valet")
   */
  const initializePaymentSheet = useCallback(
    async (
      finalPrice: number,
      bookingReference: string,
      merchantDisplayName: string = "Prisma Valet"
    ) => {
      const address = addresses[0];
      let countryCode = "";
      let currencyCode = "";

      if (address?.country === "Ireland") {
        countryCode = "IE";
        currencyCode = "EUR";
      } else {
        countryCode = "GB";
        currencyCode = "GBP";
      }

      

      try {
        const { paymentIntent, ephemeralKey, customer } =
          await fetchPaymentSheetDetailsFromServer(
            finalPrice,
            bookingReference
          );

        const { error } = await initPaymentSheet({
          paymentIntentClientSecret: paymentIntent,
          merchantDisplayName: merchantDisplayName,
          customerEphemeralKeySecret: ephemeralKey,
          customerId: customer,
          returnURL: "prismaclient://payment-success",
          applePay: {
            merchantCountryCode: countryCode,
          },
          googlePay: {
            merchantCountryCode: countryCode,
            testEnv: __DEV__,
            currencyCode: currencyCode,
          },
          // Enable saving payment methods for future use
          allowsDelayedPaymentMethods: true,
        });

        if (error) {
          console.error("Payment sheet initialization error:", error);
          throw error;
        }

        
      } catch (error: any) {
        console.error("Error initializing payment sheet:", error);
        throw error;
      }
    },
    [fetchPaymentSheetDetailsFromServer, initPaymentSheet]
  );

  /**
   * Opens the payment sheet when clicked on the checkout page.
   * Calls the initializePaymentSheet method to initialize the payment sheet first on the server.
   * Then calls the presentPaymentSheet method to present the payment sheet to the user.
   *
   * @param finalPrice - The total price to charge
   * @param userAddress - Optional user address for country/currency detection
   * @param merchantDisplayName - Optional custom merchant display name
   * @returns Promise that resolves to true if payment successful, false if cancelled, throws error if failed
   */
  const openPaymentSheet = useCallback(
    async (
      finalPrice: number,
      merchantDisplayName: string = "Prisma Valet",
      bookingReference: string
    ): Promise<boolean> => {
      try {
        // Initialize payment sheet first
        await initializePaymentSheet(
          finalPrice,
          bookingReference,
          merchantDisplayName
        );

        // Present payment sheet
        const { error } = await presentPaymentSheet();

        if (error) {
          // Handle specific error cases
          if (error.code === "Canceled") {
            return false;
          }

          // Handle other errors
          let errorMessage = "Payment failed. Please try again.";
          let errorTitle = "Payment Error";

          if (error.message?.includes("card_declined")) {
            errorMessage =
              "Your card was declined. Please try a different payment method.";
            errorTitle = "Card Declined";
          } else if (error.message?.includes("insufficient_funds")) {
            errorMessage =
              "Insufficient funds. Please try a different payment method.";
            errorTitle = "Insufficient Funds";
          } else if (error.message?.includes("expired_card")) {
            errorMessage =
              "Your card has expired. Please use a different payment method.";
            errorTitle = "Expired Card";
          }

          setAlertConfig({
            title: errorTitle,
            message: errorMessage,
            type: "error",
            isVisible: true,
            onConfirm() {
              setIsVisible(false);
            },
          });

          throw error;
        }

        return true;
      } catch (error: any) {
        console.error("Error in payment process:", error);

        // Handle network or initialization errors
        let errorMessage = "An error occurred during payment";
        let errorTitle = "Payment Error";

        if (error.message?.includes("network")) {
          errorMessage =
            "Network error. Please check your connection and try again.";
          errorTitle = "Connection Error";
        } else if (error.message?.includes("timeout")) {
          errorMessage = "Request timed out. Please try again.";
          errorTitle = "Timeout Error";
        }

        setAlertConfig({
          title: errorTitle,
          message: errorMessage,
          type: "error",
          isVisible: true,
          onConfirm() {
            setIsVisible(false);
          },
        });
        throw error;
      }
    },
    [initializePaymentSheet, presentPaymentSheet, setAlertConfig, setIsVisible]
  );

  /**
   * Processes a tip payment
   *
   * @param tipAmount - The tip amount to charge
   * @param userAddress - Optional user address for country/currency detection
   * @returns Promise that resolves to true if payment successful, false if cancelled, throws error if failed
   */
  const processTipPayment = useCallback(
    async (tipAmount: number, bookingReference: string): Promise<boolean> => {
      return openPaymentSheet(
        tipAmount,
        "Prisma Valet - Tip",
        bookingReference
      );
    },
    [openPaymentSheet]
  );

  return {
    // Core payment methods
    fetchPaymentSheetDetailsFromServer,
    initializePaymentSheet,
    openPaymentSheet,

    // Specialized payment methods
    processTipPayment,
  };
};

export default usePayment;
