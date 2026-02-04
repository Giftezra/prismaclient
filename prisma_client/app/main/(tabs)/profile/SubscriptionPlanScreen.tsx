import React, { useState, useCallback } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Modal,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColor } from "@/hooks/useThemeColor";
import StyledText from "@/app/components/helpers/StyledText";
import SubscriptionTierCard from "@/app/components/profile/SubscriptionTierCard";
import {
  useGetSubscriptionPlansQuery,
  useGetCurrentSubscriptionQuery,
  useCreateSubscriptionMutation,
  useCancelSubscriptionMutation,
  useUpdatePaymentMethodMutation,
  useGetSetupIntentMutation,
} from "@/app/store/api/subscriptionApi";
import { SubscriptionTierProps } from "@/app/interfaces/SubscriptionInterfaces";
import { useStripe } from "@stripe/stripe-react-native";
import { useSnackbar } from "@/app/contexts/SnackbarContext";
import { useAddresses } from "@/app/app-hooks/useAddresses";
import usePayment from "@/app/app-hooks/usePayment";

const SubscriptionPlanScreen = () => {
  const backgroundColor = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");
  const borderColor = useThemeColor({}, "borders");
  const tintColor = useThemeColor({}, "tint");
  const errorColor = useThemeColor({}, "error");

  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const { showSnackbarWithConfig } = useSnackbar();
  const { addresses } = useAddresses();
  const { waitForPaymentConfirmation } = usePayment();

  const [selectedTierId, setSelectedTierId] = useState<string | null>(null);
  const [selectedBillingCycle, setSelectedBillingCycle] = useState<
    "monthly" | "yearly"
  >("monthly");
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [isUpdatingPayment, setIsUpdatingPayment] = useState(false);

  const {
    data: plans,
    isLoading: isLoadingPlans,
    error: plansError,
  } = useGetSubscriptionPlansQuery();

  const {
    data: currentSubscription,
    isLoading: isLoadingSubscription,
    refetch: refetchSubscription,
  } = useGetCurrentSubscriptionQuery();

  const [createSubscription, { isLoading: isCreatingSubscription }] =
    useCreateSubscriptionMutation();
  const [cancelSubscription] = useCancelSubscriptionMutation();
  const [updatePaymentMethod] = useUpdatePaymentMethodMutation();
  const [getSetupIntent] = useGetSetupIntentMutation();

  const handleTierSelect = useCallback((tierId: string) => {
    setSelectedTierId(tierId);
  }, []);

  const handleBillingCycleChange = useCallback(
    (tierId: string, cycle: "monthly" | "yearly") => {
      if (selectedTierId === tierId) {
        setSelectedBillingCycle(cycle);
      }
    },
    [selectedTierId]
  );

  const initializeSubscriptionPaymentSheet = useCallback(
    async (
      paymentIntentOrSetupIntent: string,
      ephemeralKey: string,
      customer: string,
      isTrial: boolean = false
    ): Promise<boolean> => {
      try {
        const address = addresses?.[0];
        let countryCode = "";
        let currencyCode = "";

        if (address?.country === "Ireland") {
          countryCode = "IE";
          currencyCode = "EUR";
        } else {
          countryCode = "GB";
          currencyCode = "GBP";
        }

        const paymentSheetParams: any = {
          merchantDisplayName: "Prisma Valet",
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
          allowsDelayedPaymentMethods: true,
        };

        // Use setupIntentClientSecret for trials, paymentIntentClientSecret otherwise
        if (isTrial) {
          paymentSheetParams.setupIntentClientSecret = paymentIntentOrSetupIntent;
        } else {
          paymentSheetParams.paymentIntentClientSecret = paymentIntentOrSetupIntent;
        }

        const { error } = await initPaymentSheet(paymentSheetParams);

        if (error) {
          console.error("Payment sheet initialization error:", error);
          showSnackbarWithConfig({
            message: `Payment initialization failed: ${error.message}`,
            type: "error",
            duration: 5000,
          });
          return false;
        }

        return true;
      } catch (error: any) {
        console.error("Error initializing payment sheet:", error);
        showSnackbarWithConfig({
          message: error.message || "Failed to initialize payment. Please try again.",
          type: "error",
          duration: 5000,
        });
        return false;
      }
    },
    [initPaymentSheet, addresses, showSnackbarWithConfig]
  );

  const handleSubscribe = useCallback(async () => {
    if (!selectedTierId) {
      showSnackbarWithConfig({
        message: "Please select a subscription plan",
        type: "warning",
        duration: 3000,
      });
      return;
    }

    setIsProcessingPayment(true);

    try {
      // Create subscription
      const response = await createSubscription({
        tierId: selectedTierId,
        billingCycle: selectedBillingCycle,
      }).unwrap();

      // Check if payment is required
      if (response.paymentSheet) {
        const isTrial = response.isTrial || false;
        const paymentSecret = isTrial 
          ? response.paymentSheet.setupIntent 
          : response.paymentSheet.paymentIntent;

        if (!paymentSecret) {
          showSnackbarWithConfig({
            message: "Payment details not available",
            type: "error",
            duration: 5000,
          });
          setIsProcessingPayment(false);
          return;
        }

        // Initialize payment sheet
        const initialized = await initializeSubscriptionPaymentSheet(
          paymentSecret,
          response.paymentSheet.ephemeralKey,
          response.paymentSheet.customer,
          isTrial
        );

        if (!initialized) {
          setIsProcessingPayment(false);
          return;
        }

        // Present payment sheet
        const { error } = await presentPaymentSheet();

        if (error) {
          if (error.code === "Canceled") {
            showSnackbarWithConfig({
              message: isTrial ? "Payment method setup was canceled" : "Payment was canceled",
              type: "info",
              duration: 3000,
            });
          } else {
            showSnackbarWithConfig({
              message: isTrial ? `Payment method setup failed: ${error.message}` : `Payment failed: ${error.message}`,
              type: "error",
              duration: 5000,
            });
          }
          setIsProcessingPayment(false);
          return;
        }

        if (isTrial) {
          // For trial subscriptions, no payment confirmation needed
          // Just refetch subscription to get updated status
          await refetchSubscription();
          showSnackbarWithConfig({
            message: "Trial started successfully! Your subscription will begin after the trial period.",
            type: "success",
            duration: 5000,
          });
          router.back();
        } else {
          // For non-trial subscriptions, wait for payment confirmation
          const paymentIntentId = response.billing?.transaction_id || 
            paymentSecret.split("_secret_")[0];

          showSnackbarWithConfig({
            message: "Payment successful! Activating subscription...",
            type: "success",
            duration: 3000,
          });

          try {
            const confirmation = await waitForPaymentConfirmation(
              paymentIntentId,
              60000, // maxWaitTime: 60 seconds
              2500   // pollInterval: 2.5 seconds
            );

            if (confirmation.confirmed) {
              await refetchSubscription();
              showSnackbarWithConfig({
                message: "Subscription activated successfully!",
                type: "success",
                duration: 3000,
              });
              router.back();
            }
          } catch (error: any) {
            console.error("Payment confirmation error:", error);
            showSnackbarWithConfig({
              message: error.message || "Payment received. Subscription is being activated. Please check back in a moment.",
              type: "info",
              duration: 5000,
            });
            await refetchSubscription();
            router.back();
          }
        }
      } else {
        // Free plan - no payment required
        showSnackbarWithConfig({
          message: response.message || "Subscription activated successfully!",
          type: "success",
          duration: 3000,
        });
        await refetchSubscription();
        setTimeout(() => {
          router.back();
        }, 1500);
      }
    } catch (error: any) {
      console.error("Error creating subscription:", error);
      showSnackbarWithConfig({
        message:
          error?.data?.error ||
          error?.message ||
          "Failed to create subscription. Please try again.",
        type: "error",
        duration: 5000,
      });
    } finally {
      setIsProcessingPayment(false);
    }
  }, [
    selectedTierId,
    selectedBillingCycle,
    createSubscription,
    initializeSubscriptionPaymentSheet,
    presentPaymentSheet,
    refetchSubscription,
    showSnackbarWithConfig,
  ]);

  const handleCancelSubscription = useCallback(async (cancelAtPeriodEnd: boolean = true) => {
    setIsCanceling(true);
    try {
      await cancelSubscription({ cancel_at_period_end: cancelAtPeriodEnd }).unwrap();
      await refetchSubscription();
      setShowCancelModal(false);
      showSnackbarWithConfig({
        message: cancelAtPeriodEnd 
          ? "Subscription will be cancelled at the end of the billing period."
          : "Subscription cancelled successfully.",
        type: "success",
        duration: 5000,
      });
    } catch (error: any) {
      showSnackbarWithConfig({
        message: error?.data?.error || error?.message || "Failed to cancel subscription.",
        type: "error",
        duration: 5000,
      });
    } finally {
      setIsCanceling(false);
    }
  }, [cancelSubscription, refetchSubscription, showSnackbarWithConfig]);

  const handleUpdatePaymentMethod = useCallback(async () => {
    setIsUpdatingPayment(true);
    try {
      // Get SetupIntent from backend
      const { setupIntent, ephemeralKey, customer } = await getSetupIntent().unwrap();

      // Initialize payment sheet with SetupIntent
      const address = addresses?.[0];
      let countryCode = "";
      let currencyCode = "";

      if (address?.country === "Ireland") {
        countryCode = "IE";
        currencyCode = "EUR";
      } else {
        countryCode = "GB";
        currencyCode = "GBP";
      }

      const { error: initError } = await initPaymentSheet({
        setupIntentClientSecret: setupIntent,
        merchantDisplayName: "Prisma Valet",
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
        allowsDelayedPaymentMethods: true,
      });

      if (initError) {
        throw new Error(initError.message);
      }

      // Present payment sheet
      const { error: presentError, setupIntent: resultSetupIntent } = await presentPaymentSheet();

      if (presentError) {
        if (presentError.code === "Canceled") {
          showSnackbarWithConfig({
            message: "Payment method setup was canceled",
            type: "info",
            duration: 3000,
          });
          return;
        }
        throw new Error(presentError.message);
      }

      // Get payment method ID from the result
      if (resultSetupIntent?.paymentMethodId) {
        // Update payment method on backend
        await updatePaymentMethod({ payment_method_id: resultSetupIntent.paymentMethodId }).unwrap();
        await refetchSubscription();
        showSnackbarWithConfig({
          message: "Payment method updated successfully!",
          type: "success",
          duration: 5000,
        });
      } else {
        throw new Error("Payment method ID not found");
      }
    } catch (error: any) {
      console.error("Error updating payment method:", error);
      showSnackbarWithConfig({
        message: error?.data?.error || error?.message || "Failed to update payment method.",
        type: "error",
        duration: 5000,
      });
    } finally {
      setIsUpdatingPayment(false);
    }
  }, [addresses, showSnackbarWithConfig, initPaymentSheet, presentPaymentSheet, updatePaymentMethod, refetchSubscription, getSetupIntent]);

  const selectedTier = plans?.find((tier) => tier.id === selectedTierId);

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Trial Status Banner */}
        {currentSubscription && currentSubscription.isTrialing && (
          <View
            style={[
              styles.trialStatusBanner,
              { backgroundColor: tintColor + "20", borderColor: tintColor },
            ]}
          >
            <Ionicons name="time-outline" size={20} color={tintColor} />
            <View style={styles.trialStatusContent}>
              <StyledText
                style={[styles.trialStatusTitle, { color: tintColor }]}
                variant="bodyMedium"
                children={`Trial Period: ${currentSubscription.trialDaysRemaining || 0} days remaining`}
              />
              {currentSubscription.trialEndDate && (
                <StyledText
                  style={[styles.trialStatusSubtext, { color: textColor }]}
                  variant="bodySmall"
                  children={`Trial ends: ${new Date(currentSubscription.trialEndDate).toLocaleDateString()}`}
                />
              )}
            </View>
          </View>
        )}

        {/* Payment Failure Warning Banner */}
        {currentSubscription && currentSubscription.paymentFailureStatus?.hasFailure && (
          <View
            style={[
              styles.paymentFailureBanner,
              { backgroundColor: errorColor + "20", borderColor: errorColor },
            ]}
          >
            <Ionicons name="alert-circle" size={20} color={errorColor} />
            <View style={styles.paymentFailureContent}>
              <StyledText
                style={[styles.paymentFailureTitle, { color: errorColor }]}
                variant="bodyMedium"
                children="Payment Failed"
              />
              <StyledText
                style={[styles.paymentFailureSubtext, { color: textColor }]}
                variant="bodySmall"
                children={
                  currentSubscription.paymentFailureStatus.gracePeriodUntil
                    ? `Please update your payment method before ${new Date(currentSubscription.paymentFailureStatus.gracePeriodUntil).toLocaleDateString()} to avoid service interruption.`
                    : "Please update your payment method to continue service."
                }
              />
            </View>
          </View>
        )}

        {/* Active Subscription Banner */}
        {currentSubscription && currentSubscription.status === "active" && !currentSubscription.isTrialing && (
          <View
            style={[
              styles.currentSubscriptionBanner,
              { backgroundColor: tintColor + "20", borderColor: tintColor },
            ]}
          >
            <Ionicons name="information-circle" size={20} color={tintColor} />
            <StyledText
              style={[styles.currentSubscriptionText, { color: tintColor }]}
              variant="bodyMedium"
              children={`You currently have an active ${currentSubscription.currentPlan} subscription. Selecting a new plan will replace your current subscription.`}
            />
          </View>
        )}

        {/* Subscription Management Section */}
        {currentSubscription && (currentSubscription.status === "active" || currentSubscription.isTrialing || currentSubscription.status === "past_due") && (
          <View style={[styles.managementSection, { borderColor: borderColor }]}>
            <StyledText
              style={[styles.managementTitle, { color: textColor }]}
              variant="titleMedium"
              children="Manage Subscription"
            />
            
            <View style={styles.managementDetails}>
              <View style={styles.managementRow}>
                <StyledText
                  style={[styles.managementLabel, { color: textColor }]}
                  variant="bodyMedium"
                  children="Current Plan:"
                />
                <StyledText
                  style={[styles.managementValue, { color: textColor }]}
                  variant="bodyMedium"
                  children={currentSubscription.currentPlan || "N/A"}
                />
              </View>
              
              <View style={styles.managementRow}>
                <StyledText
                  style={[styles.managementLabel, { color: textColor }]}
                  variant="bodyMedium"
                  children="Status:"
                />
                <StyledText
                  style={[
                    styles.managementValue,
                    {
                      color: currentSubscription.isTrialing
                        ? tintColor
                        : currentSubscription.status === "past_due"
                        ? errorColor
                        : textColor,
                    },
                  ]}
                  variant="bodyMedium"
                  children={
                    currentSubscription.isTrialing
                      ? "Trial"
                      : currentSubscription.status === "past_due"
                      ? "Payment Failed"
                      : currentSubscription.status.charAt(0).toUpperCase() +
                        currentSubscription.status.slice(1)
                  }
                />
              </View>

              {currentSubscription.renewsOn && (
                <View style={styles.managementRow}>
                  <StyledText
                    style={[styles.managementLabel, { color: textColor }]}
                    variant="bodyMedium"
                    children={currentSubscription.isTrialing ? "Trial Ends:" : "Renews On:"}
                  />
                  <StyledText
                    style={[styles.managementValue, { color: textColor }]}
                    variant="bodyMedium"
                    children={new Date(currentSubscription.renewsOn).toLocaleDateString()}
                  />
                </View>
              )}

              <View style={styles.managementRow}>
                <StyledText
                  style={[styles.managementLabel, { color: textColor }]}
                  variant="bodyMedium"
                  children="Billing Cycle:"
                />
                <StyledText
                  style={[styles.managementValue, { color: textColor }]}
                  variant="bodyMedium"
                  children={
                    currentSubscription.billingCycle
                      ? currentSubscription.billingCycle.charAt(0).toUpperCase() +
                        currentSubscription.billingCycle.slice(1)
                      : "N/A"
                  }
                />
              </View>
            </View>

            <View style={styles.managementActions}>
              <Pressable
                onPress={handleUpdatePaymentMethod}
                disabled={isUpdatingPayment}
                style={[
                  styles.managementButton,
                  styles.updatePaymentButton,
                  {
                    borderColor: borderColor,
                    opacity: isUpdatingPayment ? 0.6 : 1,
                  },
                ]}
              >
                {isUpdatingPayment ? (
                  <ActivityIndicator size="small" color={tintColor} />
                ) : (
                  <>
                    <Ionicons name="card-outline" size={18} color={tintColor} />
                    <StyledText
                      style={[styles.managementButtonText, { color: tintColor }]}
                      variant="bodyMedium"
                      children="Update Payment Method"
                    />
                  </>
                )}
              </Pressable>

              <Pressable
                onPress={() => setShowCancelModal(true)}
                disabled={isCanceling}
                style={[
                  styles.managementButton,
                  styles.cancelButton,
                  {
                    borderColor: errorColor,
                    opacity: isCanceling ? 0.6 : 1,
                  },
                ]}
              >
                <Ionicons name="close-circle-outline" size={18} color={errorColor} />
                <StyledText
                  style={[styles.managementButtonText, { color: errorColor }]}
                  variant="bodyMedium"
                  children="Cancel Subscription"
                />
              </Pressable>
            </View>
          </View>
        )}

        {isLoadingPlans ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={tintColor} />
            <StyledText
              style={[styles.loadingText, { color: textColor }]}
              variant="bodyMedium"
              children="Loading subscription plans..."
            />
          </View>
        ) : plansError ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={48} color={errorColor} />
            <StyledText
              style={[styles.errorText, { color: errorColor }]}
              variant="bodyLarge"
              children="Failed to load subscription plans"
            />
            <StyledText
              style={[styles.errorSubtext, { color: textColor }]}
              variant="bodySmall"
              children="Please try again later"
            />
          </View>
        ) : plans && plans.length > 0 ? (
          <>
            {plans.map((tier: SubscriptionTierProps) => {
              // Determine if this tier would be an early adopter
              // This is a simplified check - in production you'd check against actual count
              const isEarlyAdopter = false; // Will be determined server-side
              const canStartTrial = currentSubscription?.canStartTrial ?? true;
              
              return (
                <SubscriptionTierCard
                  key={tier.id}
                  tier={tier}
                  isSelected={selectedTierId === tier.id}
                  onSelect={() => handleTierSelect(tier.id)}
                  selectedBillingCycle={
                    selectedTierId === tier.id
                      ? selectedBillingCycle
                      : "monthly"
                  }
                  onBillingCycleChange={(cycle) =>
                    handleBillingCycleChange(tier.id, cycle)
                  }
                  canStartTrial={canStartTrial && selectedTierId === tier.id}
                  isEarlyAdopter={isEarlyAdopter}
                />
              );
            })}

            {selectedTier && (
              <View style={styles.summaryContainer}>
                <StyledText
                  style={[styles.summaryTitle, { color: textColor }]}
                  variant="titleMedium"
                  children="Selected Plan"
                />
                <View style={styles.summaryRow}>
                  <StyledText
                    style={[styles.summaryLabel, { color: textColor }]}
                    variant="bodyMedium"
                    children="Plan:"
                  />
                  <StyledText
                    style={[styles.summaryValue, { color: textColor }]}
                    variant="bodyMedium"
                    children={selectedTier.name}
                  />
                </View>
                <View style={styles.summaryRow}>
                  <StyledText
                    style={[styles.summaryLabel, { color: textColor }]}
                    variant="bodyMedium"
                    children="Billing:"
                  />
                  <StyledText
                    style={[styles.summaryValue, { color: textColor }]}
                    variant="bodyMedium"
                    children={selectedBillingCycle.charAt(0).toUpperCase() + selectedBillingCycle.slice(1)}
                  />
                </View>
                <View style={styles.summaryRow}>
                  <StyledText
                    style={[styles.summaryLabel, { color: textColor }]}
                    variant="bodyMedium"
                    children="Price:"
                  />
                  <StyledText
                    style={[styles.summaryValue, { color: tintColor }]}
                    variant="titleMedium"
                    children={`€${(
                      selectedBillingCycle === "monthly"
                        ? selectedTier.monthlyPrice
                        : selectedTier.yearlyPrice
                    ).toFixed(2)}`}
                  />
                </View>
              </View>
            )}
          </>
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={48} color={textColor} />
            <StyledText
              style={[styles.emptyText, { color: textColor }]}
              variant="bodyLarge"
              children="No subscription plans available"
            />
          </View>
        )}
      </ScrollView>

      {selectedTierId && (
        <View style={[styles.footer, { borderTopColor: borderColor }]}>
          <Pressable
            onPress={handleSubscribe}
            disabled={isProcessingPayment || isCreatingSubscription}
            style={[
              styles.subscribeButton,
              {
                backgroundColor: tintColor,
                opacity:
                  isProcessingPayment || isCreatingSubscription ? 0.6 : 1,
              },
            ]}
          >
            {isProcessingPayment || isCreatingSubscription ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <StyledText
                style={styles.subscribeButtonText}
                variant="labelLarge"
                children={
                  currentSubscription?.canStartTrial
                    ? "Start Trial"
                    : "Subscribe Now"
                }
              />
            )}
          </Pressable>
        </View>
      )}

      {/* Cancel Subscription Confirmation Modal */}
      <Modal
        visible={showCancelModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCancelModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: backgroundColor, borderColor: borderColor }]}>
            <StyledText
              style={[styles.modalTitle, { color: textColor }]}
              variant="titleLarge"
              children="Cancel Subscription"
            />
            <StyledText
              style={[styles.modalText, { color: textColor }]}
              variant="bodyMedium"
              children={
                currentSubscription?.isTrialing
                  ? "Are you sure you want to cancel your trial? You'll lose access immediately."
                  : "Are you sure you want to cancel your subscription? You can cancel now or at the end of your billing period."
              }
            />
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setShowCancelModal(false)}
                style={[styles.modalButton, styles.modalCancelButton, { borderColor: borderColor }]}
              >
                <StyledText
                  style={[styles.modalButtonText, { color: textColor }]}
                  variant="bodyMedium"
                  children="Keep Subscription"
                />
              </Pressable>
              {!currentSubscription?.isTrialing && (
                <Pressable
                  onPress={() => handleCancelSubscription(true)}
                  disabled={isCanceling}
                  style={[
                    styles.modalButton,
                    styles.modalConfirmButton,
                    { backgroundColor: tintColor, opacity: isCanceling ? 0.6 : 1 },
                  ]}
                >
                  {isCanceling ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <StyledText
                      style={styles.modalButtonTextWhite}
                      variant="bodyMedium"
                      children="Cancel at Period End"
                    />
                  )}
                </Pressable>
              )}
              <Pressable
                onPress={() => handleCancelSubscription(false)}
                disabled={isCanceling}
                style={[
                  styles.modalButton,
                  styles.modalConfirmButton,
                  { backgroundColor: errorColor, opacity: isCanceling ? 0.6 : 1 },
                ]}
              >
                {isCanceling ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <StyledText
                    style={styles.modalButtonTextWhite}
                    variant="bodyMedium"
                    children={currentSubscription?.isTrialing ? "Cancel Trial" : "Cancel Now"}
                  />
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "bold",
  },
  headerSpacer: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  currentSubscriptionBanner: {
    flexDirection: "row",
    alignItems: "center",
    margin: 16,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  currentSubscriptionText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  trialStatusBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    margin: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  trialStatusContent: {
    flex: 1,
  },
  trialStatusTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  trialStatusSubtext: {
    fontSize: 12,
    opacity: 0.7,
  },
  paymentFailureBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    margin: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  paymentFailureContent: {
    flex: 1,
  },
  paymentFailureTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  paymentFailureSubtext: {
    fontSize: 12,
    opacity: 0.7,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    opacity: 0.7,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
    gap: 12,
  },
  errorText: {
    fontSize: 18,
    fontWeight: "600",
  },
  errorSubtext: {
    fontSize: 14,
    opacity: 0.7,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    opacity: 0.7,
  },
  summaryContainer: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
    gap: 12,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 4,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryLabel: {
    fontSize: 14,
    opacity: 0.7,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    backgroundColor: "rgba(0,0,0,0.02)",
  },
  subscribeButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  subscribeButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  managementSection: {
    margin: 16,
    marginTop: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 16,
  },
  managementTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  managementDetails: {
    gap: 12,
  },
  managementRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  managementLabel: {
    fontSize: 14,
    opacity: 0.7,
  },
  managementValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  managementActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  managementButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  updatePaymentButton: {
    // Styled via borderColor prop
  },
  cancelButton: {
    // Styled via borderColor prop
  },
  managementButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    gap: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 4,
  },
  modalText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancelButton: {
    borderWidth: 1,
  },
  modalConfirmButton: {
    // Styled via backgroundColor prop
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  modalButtonTextWhite: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
});

export default SubscriptionPlanScreen;
