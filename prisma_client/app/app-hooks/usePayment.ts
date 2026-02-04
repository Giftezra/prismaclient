import { useCallback } from "react";
import { useStripe } from "@stripe/stripe-react-native";
import {
  useFetchPaymentSheetDetailsMutation,
  useConfirmPaymentIntentMutation,
} from "@/app/store/api/eventApi";
import { useAlertContext } from "@/app/contexts/AlertContext";
import { PaymentSheetResponse } from "@/app/interfaces/BookingInterfaces";
import { RootState, useAppSelector } from "../store/main_store";
import { useAddresses } from "./useAddresses";
import { useSnackbar } from "../contexts/SnackbarContext";

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
  const [confirmPaymentIntentMutation] = useConfirmPaymentIntentMutation();
  const { setAlertConfig, setIsVisible } = useAlertContext();
  const { showSnackbarWithConfig } = useSnackbar();
  const { addresses } = useAddresses();

  /**
   * Fetches payment sheet details from the server
   *
   * @param finalPrice - The total price in euros
   * @param bookingReference - The booking reference
   * @param bookingData - Full booking data for client app
   * @param detailerBookingData - Optional formatted data for detailer app
   * @returns Promise that resolves to payment sheet details
   */
  const fetchPaymentSheetDetailsFromServer = useCallback(
    async (
      finalPrice: number,
      bookingReference: string,
      bookingData?: any,
      detailerBookingData?: any
    ): Promise<
      PaymentSheetResponse & {
        paymentIntentId: string;
        booking_reference: string;
      }
    > => {
      try {
        const amountInCents = Math.round(finalPrice * 100);
        const response = await fetchPaymentSheetDetails({
          amount: amountInCents,
          booking_reference: bookingReference,
          booking_data: bookingData,
          detailer_booking_data: detailerBookingData,
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
   * @param bookingReference - The booking reference
   * @param merchantDisplayName - Optional custom merchant display name (defaults to "Prisma Valet")
   * @param bookingData - Optional full booking data for client app
   * @param detailerBookingData - Optional formatted data for detailer app
   */
  const initializePaymentSheet = useCallback(
    async (
      finalPrice: number,
      bookingReference: string,
      merchantDisplayName: string = "Prisma Valet",
      bookingData?: any,
      detailerBookingData?: any
    ): Promise<{ paymentIntentId: string }> => {
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

      console.log("Google Pay Config:", {
        countryCode,
        currencyCode,
        testEnv: __DEV__,
        merchantDisplayName,
      });

      try {
        const { paymentIntent, paymentIntentId, ephemeralKey, customer } =
          await fetchPaymentSheetDetailsFromServer(
            finalPrice,
            bookingReference,
            bookingData,
            detailerBookingData
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

        console.log("Payment sheet initialized successfully");
        return { paymentIntentId };
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
   * @param merchantDisplayName - Optional custom merchant display name
   * @param bookingReference - The booking reference
   * @param bookingData - Optional full booking data for client app
   * @param detailerBookingData - Optional formatted data for detailer app
   * @returns Promise that resolves to true if payment successful, false if cancelled, throws error if failed
   */
  const openPaymentSheet = useCallback(
    async (
      finalPrice: number,
      merchantDisplayName: string = "Prisma Valet",
      bookingReference: string,
      bookingData?: any,
      detailerBookingData?: any
    ): Promise<{ success: boolean; paymentIntentId?: string }> => {
      try {
        // Initialize payment sheet first
        const { paymentIntentId } = await initializePaymentSheet(
          finalPrice,
          bookingReference,
          merchantDisplayName,
          bookingData,
          detailerBookingData
        );

        // Present payment sheet
        const { error } = await presentPaymentSheet();

        if (error) {
          // Handle specific error cases
          if (error.code === "Canceled") {
            console.log("Payment was canceled by user");
            return { success: false };
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
          showSnackbarWithConfig({
            message: errorMessage,
            type: "error",
            duration: 3000,
          });
          return { success: false };
        }

        return { success: true, paymentIntentId };
      } catch (error: any) {
        console.error("Error in payment process:", error);

        // Branch spend limit exceeded (fleet admin only)
        const status = error?.status ?? error?.originalStatus;
        const code = error?.data?.code;
        if (status === 403 && code === "BRANCH_SPEND_LIMIT_EXCEEDED") {
          setAlertConfig({
            isVisible: true,
            title: "Spending limit exceeded",
            message:
              "Your branch's spending limit for this period has been reached. Payment was not taken. Contact your fleet owner if you need the limit increased.",
            type: "warning",
            onClose: () => {
              setAlertConfig({
                isVisible: false,
                title: "",
                message: "",
                type: "error",
              });
            },
          });
          return { success: false };
        }

        // Handle network or initialization errors
        let errorMessage = "An error occurred during payment";

        if (error?.message?.includes("network")) {
          errorMessage =
            "Network error. Please check your connection and try again.";
        } else if (error?.message?.includes("timeout")) {
          errorMessage = "Request timed out. Please try again.";
        }

        showSnackbarWithConfig({
          message: errorMessage,
          type: "error",
          duration: 3000,
        });
        return { success: false };
      }
    },
    [initializePaymentSheet, presentPaymentSheet, showSnackbarWithConfig, setAlertConfig]
  );

  /**
   * Confirms if a payment intent has been processed via webhook
   *
   * @param paymentIntentId - The Stripe payment intent ID
   * @returns Promise that resolves to confirmation status
   */
  const confirmPaymentIntent = useCallback(
    async (
      paymentIntentId: string
    ): Promise<{
      confirmed: boolean;
      payment_intent_id: string;
      transaction_id?: string;
      booking_reference?: string;
    }> => {
      try {
        const response = await confirmPaymentIntentMutation({
          payment_intent_id: paymentIntentId,
        }).unwrap();
        return response;
      } catch (error) {
        console.error("Error confirming payment intent:", error);
        throw error;
      }
    },
    [confirmPaymentIntentMutation]
  );

  /**
   * Waits for payment confirmation via webhook by polling
   *
   * @param paymentIntentId - The Stripe payment intent ID
   * @param maxWaitTime - Maximum time to wait in milliseconds (default: 60000ms = 60 seconds)
   * @param pollInterval - Interval between polls in milliseconds (default: 2500ms = 2.5 seconds)
   * @returns Promise that resolves when payment is confirmed or rejects on timeout
   */
  const waitForPaymentConfirmation = useCallback(
    async (
      paymentIntentId: string,
      maxWaitTime: number = 60000,
      pollInterval: number = 2500
    ): Promise<{
      confirmed: boolean;
      payment_intent_id: string;
      transaction_id?: string;
      booking_reference?: string;
    }> => {
      const startTime = Date.now();

      return new Promise((resolve, reject) => {
        const poll = async () => {
          try {
            const result = await confirmPaymentIntent(paymentIntentId);

            if (result.confirmed) {
              resolve(result);
              return;
            }

            // Check if we've exceeded max wait time
            if (Date.now() - startTime >= maxWaitTime) {
              reject(
                new Error(
                  "Payment confirmation timeout - webhook did not confirm payment within the expected time"
                )
              );
              return;
            }

            // Schedule next poll
            setTimeout(poll, pollInterval);
          } catch (error) {
            reject(error);
          }
        };

        // Start polling
        poll();
      });
    },
    [confirmPaymentIntent]
  );

  /**
   * Processes a tip payment
   *
   * @param tipAmount - The tip amount to charge
   * @param bookingReference - The booking reference for the tip
   * @returns Promise that resolves to true if payment successful, false if cancelled, throws error if failed
   */
  const processTipPayment = useCallback(
    async (
      tipAmount: number,
      bookingReference: string
    ): Promise<{ success: boolean; paymentIntentId?: string }> => {
      // Create minimal booking_data for tip payment (required by backend)
      const minimalBookingData = {
        total_amount: tipAmount,
        booking_reference: bookingReference,
        is_tip: true, // Flag to indicate this is a tip payment
      };
      
      // Open payment sheet and get payment intent ID
      const paymentResult = await openPaymentSheet(
        tipAmount,
        "Prisma Valet - Tip",
        bookingReference,
        minimalBookingData,
        undefined // No detailer booking data needed for tips
      );
      
      // If payment sheet failed or was cancelled, return failure
      if (!paymentResult.success || !paymentResult.paymentIntentId) {
        return { success: false };
      }
      
      // Wait for webhook confirmation that payment was processed
      try {
        console.log(`Waiting for webhook confirmation for tip payment: ${paymentResult.paymentIntentId}`);
        const confirmation = await waitForPaymentConfirmation(
          paymentResult.paymentIntentId,
          60000, // 60 second timeout
          2500   // Poll every 2.5 seconds
        );
        
        if (confirmation.confirmed) {
          console.log(`Tip payment confirmed via webhook: ${paymentResult.paymentIntentId}`);
          return { 
            success: true, 
            paymentIntentId: paymentResult.paymentIntentId 
          };
        } else {
          console.error(`Tip payment not confirmed within timeout: ${paymentResult.paymentIntentId}`);
          return { success: false };
        }
      } catch (error) {
        console.error("Error waiting for payment confirmation:", error);
        return { success: false };
      }
    },
    [openPaymentSheet, waitForPaymentConfirmation]
  );

  return {
    // Core payment methods
    fetchPaymentSheetDetailsFromServer,
    initializePaymentSheet,
    openPaymentSheet,

    // Payment confirmation methods
    confirmPaymentIntent,
    waitForPaymentConfirmation,

    // Specialized payment methods
    processTipPayment,
  };
};

export default usePayment;
