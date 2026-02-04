import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Animated,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import StyledText from "../helpers/StyledText";
import StyledButton from "../helpers/StyledButton";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useSubmitReviewMutation } from "@/app/store/api/dashboardApi";
import useDashboard from "@/app/app-hooks/useDashboard";
import usePayment from "@/app/app-hooks/usePayment"; // Add this import
import { RecentServicesProps } from "@/app/interfaces/DashboardInterfaces";
import { formatCurrency } from "@/app/utils/methods";
import { useAppSelector, RootState } from "@/app/store/main_store";
import { MaterialIcons } from "@expo/vector-icons";

interface ReviewComponentProps {
  currencySymbol: string;
  bookingData?: RecentServicesProps;
  onReviewSubmitted?: () => void;
}

const ReviewComponent: React.FC<ReviewComponentProps> = ({
  currencySymbol,
  bookingData,
  onReviewSubmitted,
}) => {
  const [rating, setRating] = useState(0);
  const [tipAmount, setTipAmount] = useState("0.00");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false); // Add this state
  const [currentStep, setCurrentStep] = useState(0); // 0: rating, 1: tip, 2: confirmation

  // Animation values
  const fadeAnim = useState(new Animated.Value(0))[0];
  const scaleAnim = useState(new Animated.Value(0.9))[0];

  const backgroundColor = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");
  const primaryColor = useThemeColor({}, "primary");
  const cardColor = useThemeColor({}, "cards");
  const borderColor = useThemeColor({}, "borders");

  const { recentService, refetchRecentServices } = useDashboard();
  const [submitReview] = useSubmitReviewMutation();
  const { processTipPayment } = usePayment(); // Add this hook
  const user = useAppSelector((state: RootState) => state.auth.user);

  // Use bookingData if provided, otherwise fall back to recentService
  const currentBooking = bookingData || recentService;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleRatingPress = (selectedRating: number) => {
    setRating(selectedRating);
    // Auto-advance to tip step after rating selection
    setTimeout(() => {
      setCurrentStep(1);
    }, 500);
  };

  const handleTipAmountChange = (value: string) => {
    const cleanValue = value.replace(/[^0-9.]/g, "");
    const parts = cleanValue.split(".");

    if (parts.length > 2) return;
    if (parts[1] && parts[1].length > 2) return;

    setTipAmount(cleanValue);
  };

  const handleCustomTipPress = () => {
    // Clear the tip amount to allow custom input
    setTipAmount("");
  };

  const handleSubmitReview = async () => {
    if (!currentBooking) return;

    setIsSubmitting(true);
    try {
      // First, process tip payment if tip amount is greater than
      if (parseFloat(tipAmount) > 0) {
        setIsProcessingPayment(true);
        const paymentSuccess = await processTipPayment(
          parseFloat(tipAmount),
          currentBooking.booking_reference
        );

        if (!paymentSuccess || !paymentSuccess.success) {
          // Payment was cancelled or failed
          setIsSubmitting(false);
          setIsProcessingPayment(false);
          return;
        }
        setIsProcessingPayment(false);
      }

      // After successful payment (or no tip), submit the review
      await submitReview({
        booking_reference: currentBooking.booking_reference,
        rating: rating,
        tip_amount: parseFloat(tipAmount) || 0.0,
      }).unwrap();

      setCurrentStep(2);
      
      // Only refetch if we're using recentService (not bookingData)
      if (!bookingData) {
        refetchRecentServices();
      }
      
      // Call onReviewSubmitted callback if provided
      if (onReviewSubmitted) {
        setTimeout(() => {
          onReviewSubmitted();
        }, 2000);
      }

      setTimeout(() => {
        setRating(0);
        setTipAmount("0.00");
        setCurrentStep(0);
      }, 2000);
    } catch (error: any) {
      console.error("Review submission failed:", error);
    } finally {
      setIsSubmitting(false);
      setIsProcessingPayment(false);
    }
  };

  const renderStars = () => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => handleRatingPress(star)}
            style={styles.starButton}
            activeOpacity={0.7}
          >
            <Ionicons
              name={star <= rating ? "star" : "star-outline"}
              size={48}
              color={star <= rating ? "#FFD700" : "#E0E0E0"}
              style={[styles.star, star <= rating && styles.starSelected]}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const getRatingText = () => {
    const ratingTexts = {
      1: "Poor",
      2: "Fair",
      3: "Good",
      4: "Great",
      5: "Excellent",
    };
    return ratingTexts[rating as keyof typeof ratingTexts] || "";
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const renderRatingStep = () => (
    <Animated.View
      style={[
        styles.stepContainer,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <View style={styles.header}>
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: primaryColor + "15" },
          ]}
        >
          <Ionicons name="star" size={32} color={primaryColor} />
        </View>
        <StyledText
          variant="titleLarge"
          style={[styles.title, { color: textColor }]}
        >
          How was your service?
        </StyledText>
        <StyledText
          variant="bodyMedium"
          style={[styles.subtitle, { color: textColor }]}
        >
          Help us improve by rating your experience
        </StyledText>
      </View>

      {currentBooking && (
        <View
          style={[
            styles.serviceCard,
            { backgroundColor: cardColor, borderColor },
          ]}
        >
          <View style={styles.serviceInfo}>
            <View style={styles.serviceHeaderRow}>
              <Ionicons name="car-outline" size={20} color={primaryColor} />
              <StyledText
                variant="titleMedium"
                style={[styles.vehicleName, { color: textColor }]}
              >
                {currentBooking.vehicle_name}
              </StyledText>
            </View>
            <View style={styles.serviceDetailsRow}>
              <Ionicons name="construct-outline" size={16} color={textColor} style={{ opacity: 0.7 }} />
              <StyledText
                variant="bodySmall"
                style={[styles.serviceDetail, { color: textColor }]}
              >
                {currentBooking.service_type}
              </StyledText>
            </View>
            <View style={styles.serviceDetailsRow}>
              <Ionicons name="calendar-outline" size={16} color={textColor} style={{ opacity: 0.7 }} />
              <StyledText
                variant="bodySmall"
                style={[styles.serviceDetail, { color: textColor }]}
              >
                {currentBooking.date}
              </StyledText>
            </View>
            {((currentBooking.detailers && currentBooking.detailers.length > 0) || currentBooking.detailer) && (
              <View style={styles.serviceDetailsRow}>
                <Ionicons name="person-outline" size={16} color={textColor} style={{ opacity: 0.7 }} />
                <StyledText
                  variant="bodySmall"
                  style={[styles.detailerName, { color: textColor }]}
                >
                  {currentBooking.detailers && currentBooking.detailers.length > 0
                    ? currentBooking.detailers.map(d => d.name).join(" & ")
                    : currentBooking.detailer?.name || "Unknown"}
                </StyledText>
              </View>
            )}
          </View>
        </View>
      )}

      <View style={styles.ratingSection}>
        {renderStars()}
        {rating > 0 && (
          <Animated.View
            style={[
              styles.ratingTextContainer,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            <StyledText
              variant="titleMedium"
              style={[styles.ratingText, { color: primaryColor }]}
            >
              {getRatingText()}
            </StyledText>
          </Animated.View>
        )}
      </View>
    </Animated.View>
  );

  const renderTipStep = () => (
    <Animated.View
      style={[
        styles.stepContainer,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <View style={styles.header}>
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: primaryColor + "15" },
          ]}
        >
          <Ionicons name="heart" size={32} color={primaryColor} />
        </View>
        <StyledText
          variant="titleLarge"
          style={[styles.title, { color: textColor }]}
        >
          Tip your detailer
        </StyledText>
        <StyledText
          variant="bodyMedium"
          style={[styles.subtitle, { color: textColor }]}
        >
          Would you like to tip your detailer?
        </StyledText>
      </View>

      <View
        style={[
          styles.tipContainer,
          { backgroundColor: cardColor, borderColor },
        ]}
      >
        <View style={styles.tipInputRow}>
          <View style={[styles.currencyContainer, { borderColor, backgroundColor: cardColor }]}>
            <StyledText variant="bodyMedium" style={[styles.currencySymbol, { color: textColor }]}>
              {formatCurrency(parseFloat(tipAmount), user?.address?.country)}
            </StyledText>
          </View>
        </View>

        <View style={styles.quickTipButtons}>
          {[ "2", "5", "10", "15", "20"].map((amount) => (
            <TouchableOpacity
              key={amount}
              style={[
                styles.quickTipButton,
                { borderColor },
                tipAmount === amount && {
                  backgroundColor: primaryColor + "20",
                  borderColor: primaryColor,
                },
              ]}
              onPress={() => setTipAmount(amount)}
            >
              <StyledText
                variant="bodyMedium"
                style={[
                  styles.quickTipText,
                  { color: tipAmount === amount ? primaryColor : textColor },
                ]}
              >
                {formatCurrency(parseFloat(amount), user?.address?.country)}
              </StyledText>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <StyledButton
        title={isProcessingPayment ? "Processing Payment..." : "Submit Review"}
        onPress={handleSubmitReview}
        variant="tonal"
        isLoading={isSubmitting || isProcessingPayment}
        style={styles.submitButton}
      />
    </Animated.View>
  );

  const renderConfirmationStep = () => (
    <Animated.View
      style={[
        styles.stepContainer,
        styles.confirmationContainer,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <View style={styles.confirmationContent}>
        <View style={[styles.successIcon, { backgroundColor: "#4CAF50" }]}>
          <Ionicons name="checkmark" size={32} color="white" />
        </View>
        <StyledText
          variant="titleLarge"
          style={[styles.confirmationTitle, { color: textColor }]}
        >
          Thank you!
        </StyledText>
        <StyledText
          variant="bodyMedium"
          style={[styles.confirmationSubtitle, { color: textColor }]}
        >
          Your review has been sent
          {currentBooking?.detailer?.name
            ? ` to ${currentBooking.detailer.name}`
            : ""}
        </StyledText>
      </View>
    </Animated.View>
  );

  return (
    <View style={[styles.container, { backgroundColor }]}>
      {currentStep === 0 && renderRatingStep()}
      {currentStep === 1 && renderTipStep()}
      {currentStep === 2 && renderConfirmationStep()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  stepContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    textAlign: "center",
    opacity: 0.7,
  },
  serviceCard: {
    width: "100%",
    padding: 20,
    borderRadius: 20,
    borderWidth: 1.5,
    marginBottom: 32,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  serviceInfo: {
    width: "100%",
  },
  serviceHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  serviceDetailsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  vehicleName: {
    fontWeight: "700",
    fontSize: 18,
  },
  serviceDetail: {
    opacity: 0.8,
    fontSize: 14,
  },
  detailerName: {
    opacity: 0.8,
    fontSize: 14,
  },
  ratingSection: {
    alignItems: "center",
    width: "100%",
  },
  starsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 16,
  },
  starButton: {
    padding: 8,
  },
  star: {
    marginHorizontal: 4,
  },
  starSelected: {
    transform: [{ scale: 1.1 }],
  },
  ratingTextContainer: {
    marginTop: 8,
  },
  ratingText: {
    fontWeight: "600",
  },
  tipContainer: {
    width: "100%",
    padding: 15,
    borderRadius: 20,
    borderWidth: 1.5,
    marginBottom: 32,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tipInputRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    gap: 12,
  },
  currencyContainer: {
    borderWidth: 2,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  currencySymbol: {
    fontSize: 20,
    fontWeight: "700",
  },
  tipInput: {
    borderWidth: 2,
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 16,
    minWidth: 150,
    alignItems: "center",
  },
  tipAmount: {
    fontWeight: "700",
  },
  tipAmountInput: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    minWidth: 100,
  },
  quickTipButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  quickTipButton: {
    flex: 1,
    padding:3,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: "center",
    marginHorizontal: 4,
  },
  quickTipText: {
    fontWeight: "600",
  },
  submitButton: {
    width: "100%",
  },
  confirmationContainer: {
    paddingVertical: 20,
  },
  confirmationContent: {
    alignItems: "center",
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  confirmationTitle: {
    fontWeight: "700",
    marginBottom: 8,
  },
  confirmationSubtitle: {
    textAlign: "center",
    opacity: 0.7,
  },
});

export default ReviewComponent;
