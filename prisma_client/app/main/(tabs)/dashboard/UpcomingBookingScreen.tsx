import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  ScrollView,
  View,
  TouchableOpacity,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColor } from "@/hooks/useThemeColor";
import { router, useLocalSearchParams } from "expo-router";
import UpcomingAppointmentProps from "../../../interfaces/DashboardInterfaces";
import StyledText from "@/app/components/helpers/StyledText";
import useDashboard from "@/app/app-hooks/useDashboard";
import StyledButton from "@/app/components/helpers/StyledButton";
import LinearGradientComponent from "@/app/components/helpers/LinearGradientComponent";
import { formatCurrency } from "@/app/utils/methods";
import { useAppSelector, RootState } from "@/app/store/main_store";
import useBooking from "@/app/app-hooks/useBooking";
import RescheduleComponent from "@/app/components/booking/RescheduleComponent";
import BookingCancellationModal from "@/app/components/booking/BookingCancellationModal";
import ModalServices from "@/app/utils/ModalServices";
import { useAlertContext } from "@/app/contexts/AlertContext";

const UpcomingBookingScreen = () => {
  const [isRescheduleModalVisible, setIsRescheduleModalVisible] =
    useState(false);
  const backgroundColor = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");
  const cardColor = useThemeColor({}, "cards");
  const borderColor = useThemeColor({}, "borders");
  const primaryColor = useThemeColor({}, "primary");
  const iconColor = useThemeColor({}, "icons");

  const params = useLocalSearchParams();
  const { appointments, callDetailer } = useDashboard();
  const { setAlertConfig, setIsVisible } = useAlertContext();

  const {
    handleCancelBooking,
    isLoadingCancelBooking,
    handleRescheduleBooking,
    isLoadingRescheduleBooking,
    // Cancellation modal state and handlers
    isCancellationModalVisible,
    cancellationData,
    cancellationBookingReference,
    showCancellationModal,
    handleCloseCancellationModal,
    handleConfirmCancellation,
  } = useBooking();

  // Get user data for currency formatting
  const user = useAppSelector((state: RootState) => state.auth.user);

  const [appointment, setAppointment] =
    useState<UpcomingAppointmentProps | null>(null);

  useEffect(() => {
    if (params.appointmentId) {
      const foundAppointment = appointments.find(
        (apt) => apt.booking_reference === params.appointmentId
      );
      if (foundAppointment) {
        setAppointment(foundAppointment);
      }
    }
  }, [params.appointmentId, appointments]);

  // Helper function to check if appointment is in progress
  const isAppointmentInProgress = useCallback(
    (appointment: UpcomingAppointmentProps) => {
      return appointment.status === "in_progress";
    },
    []
  );

  // Helper function to check if appointment is within 12 hours
  const isWithin12Hours = useCallback(
    (appointment: UpcomingAppointmentProps) => {
      if (!appointment.booking_date || !appointment.start_time) return false;

      const appointmentDateTime = new Date(
        `${appointment.booking_date}T${appointment.start_time}`
      );
      const now = new Date();
      const timeDifference = appointmentDateTime.getTime() - now.getTime();
      const hoursDifference = timeDifference / (1000 * 60 * 60);

      return hoursDifference <= 12 && hoursDifference > 0;
    },
    []
  );

  // Helper function to show cancellation restriction alert
  const showCancellationRestrictionAlert = useCallback(() => {
    setAlertConfig({
      isVisible: true,
      title: "Cannot Cancel",
      message:
        "We are sorry but this appointment can no longer be cancelled at this time. Sorry for the inconveniences.",
      type: "error",
      onClose: () =>
        setAlertConfig({
          isVisible: false,
          title: "",
          message: "",
          type: "error",
        }),
    });
  }, [setAlertConfig]);

  // Helper function to show late cancellation warning (within 12 hours)
  const showLateCancellationWarning = useCallback(() => {
    setAlertConfig({
      isVisible: true,
      title: "Late Cancellation Warning",
      message:
        "You are cancelling within 12 hours of your appointment. You will NOT receive a refund for this cancellation.\n\nAre you sure you want to proceed?",
      type: "warning",
      onConfirm: () => {
        setIsVisible(false);
        const appointmentDateTime =
          appointment?.booking_date && appointment?.start_time
            ? `${appointment.booking_date}T${appointment.start_time}`
            : undefined;
        showCancellationModal(
          appointment?.booking_reference || "",
          appointmentDateTime,
          appointment?.total_amount
        );
      },
      onClose: () =>
        setAlertConfig({
          isVisible: false,
          title: "",
          message: "",
          type: "warning",
        }),
    });
  }, [setAlertConfig, setIsVisible, showCancellationModal, appointment]);

  // Helper function to show reschedule restriction alert
  const showRescheduleRestrictionAlert = useCallback(() => {
    setAlertConfig({
      isVisible: true,
      title: "Cannot Reschedule",
      message:
        "We are sorry but this appointment can no longer be rescheduled at this time. Sorry for the inconveniences.",
      type: "error",
      onClose: () =>
        setAlertConfig({
          isVisible: false,
          title: "",
          message: "",
          type: "error",
        }),
    });
  }, [setAlertConfig]);

  // Handle reschedule button press
  const handleReschedulePress = useCallback(() => {
    if (!appointment) return;

    // Check if appointment is in progress
    if (isAppointmentInProgress(appointment)) {
      setAlertConfig({
        isVisible: true,
        title: "Cannot Reschedule",
        message:
          "This appointment is currently in progress and cannot be rescheduled.",
        type: "error",
        onClose: () =>
          setAlertConfig({
            isVisible: false,
            title: "",
            message: "",
            type: "error",
          }),
      });
      return;
    }

    // Check if appointment is within 12 hours
    if (isWithin12Hours(appointment)) {
      showRescheduleRestrictionAlert();
      return;
    }

    // If not within 12 hours, show the reschedule modal
    setIsRescheduleModalVisible(true);
  }, [
    appointment,
    isAppointmentInProgress,
    isWithin12Hours,
    showRescheduleRestrictionAlert,
    setAlertConfig,
  ]);

  // Handle reschedule confirmation
  const handleRescheduleConfirm = async (newDate: string, newTime: string) => {
    if (appointment) {
      await handleRescheduleBooking(
        appointment.booking_reference,
        newDate,
        newTime
      );
      setIsRescheduleModalVisible(false);
    }
  };

  const handleCencellationConfirm = useCallback(
    async (appointmentId: string) => {
      if (!appointment) return;

      // Check if appointment is in progress
      if (isAppointmentInProgress(appointment)) {
        setAlertConfig({
          isVisible: true,
          title: "Cannot Cancel",
          message:
            "This appointment is currently in progress and cannot be cancelled.",
          type: "error",
          onClose: () =>
            setAlertConfig({
              isVisible: false,
              title: "",
              message: "",
              type: "error",
            }),
        });
        return;
      }

      // Check if appointment is within 12 hours - show warning but allow cancellation
      if (isWithin12Hours(appointment)) {
        showLateCancellationWarning();
        return;
      } else {
        // Show cancellation modal with details
        const appointmentDateTime =
          appointment?.booking_date && appointment?.start_time
            ? `${appointment.booking_date}T${appointment.start_time}`
            : undefined;
        showCancellationModal(
          appointmentId,
          appointmentDateTime,
          appointment?.total_amount
        );
      }
    },
    [
      appointment,
      isAppointmentInProgress,
      isWithin12Hours,
      showLateCancellationWarning,
      showCancellationModal,
      setAlertConfig,
    ]
  );

  if (!appointment) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor, justifyContent: "center", alignItems: "center" },
        ]}
      >
        <StyledText variant="bodyLarge" style={{ color: textColor }}>
          Loading appointment details...
        </StyledText>
      </View>
    );
  }

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "confirmed":
      case "scheduled":
        return "#10B981"; // Green
      case "in_progress":
        return "#F59E0B"; // Amber
      case "pending":
        return "#6B7280"; // Gray
      default:
        return primaryColor;
    }
  };

  const statusColor = getStatusColor(appointment?.status || "");

  return (
    <ScrollView
      style={[styles.container, { backgroundColor }]}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      {/* Hero Status Card with Gradient */}
      <LinearGradientComponent
        color1={statusColor + "15"}
        color2={statusColor + "05"}
        style={styles.heroCard}
      >
        <View style={styles.heroHeader}>
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Ionicons name="checkmark-circle" size={16} color="white" />
            <StyledText variant="labelMedium" style={styles.statusBadgeText}>
              {appointment?.status?.replace("_", " ").toUpperCase()}
            </StyledText>
          </View>
          <StyledText
            variant="bodySmall"
            style={[styles.appointmentId, { color: textColor, opacity: 0.7 }]}
          >
            #{appointment.booking_reference}
          </StyledText>
        </View>

        <View style={styles.timingGrid}>
          <View style={[styles.timingCard, { backgroundColor: cardColor }]}>
            <View style={[styles.timingIconContainer, { backgroundColor: statusColor + "20" }]}>
              <Ionicons name="calendar-outline" size={24} color={statusColor} />
            </View>
            <View style={styles.timingContent}>
              <StyledText
                variant="bodySmall"
                style={[styles.timingLabel, { color: textColor, opacity: 0.6 }]}
              >
                Date
              </StyledText>
              <StyledText
                variant="titleSmall"
                style={[styles.timingValue, { color: textColor }]}
                numberOfLines={1}
              >
                {new Date(appointment.booking_date).toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </StyledText>
            </View>
          </View>

          <View style={[styles.timingCard, { backgroundColor: cardColor }]}>
            <View style={[styles.timingIconContainer, { backgroundColor: statusColor + "20" }]}>
              <Ionicons name="time-outline" size={24} color={statusColor} />
            </View>
            <View style={styles.timingContent}>
              <StyledText
                variant="bodySmall"
                style={[styles.timingLabel, { color: textColor, opacity: 0.6 }]}
              >
                Time
              </StyledText>
              <StyledText
                variant="titleSmall"
                style={[styles.timingValue, { color: textColor }]}
              >
                {appointment.start_time} - {appointment.end_time}
              </StyledText>
            </View>
          </View>

          <View style={[styles.timingCard, { backgroundColor: cardColor }]}>
            <View style={[styles.timingIconContainer, { backgroundColor: statusColor + "20" }]}>
              <Ionicons name="hourglass-outline" size={24} color={statusColor} />
            </View>
            <View style={styles.timingContent}>
              <StyledText
                variant="bodySmall"
                style={[styles.timingLabel, { color: textColor, opacity: 0.6 }]}
              >
                Duration
              </StyledText>
              <StyledText
                variant="titleSmall"
                style={[styles.timingValue, { color: textColor }]}
              >
                {appointment.estimated_duration}
              </StyledText>
            </View>
          </View>
        </View>
      </LinearGradientComponent>

      {/* Vehicle Information Card */}
      <View style={[styles.card, { backgroundColor: cardColor, borderColor: borderColor }]}>
        <View style={styles.sectionHeader}>
          <View style={[styles.iconWrapper, { backgroundColor: primaryColor + "15" }]}>
            <Ionicons name="car-sport" size={22} color={primaryColor} />
          </View>
          <StyledText
            variant="titleMedium"
            style={[styles.sectionTitle, { color: textColor }]}
          >
            Vehicle Details
          </StyledText>
        </View>
        <View style={styles.vehicleInfo}>
          <View style={styles.vehicleImageContainer}>
            <Image
              source={
                appointment.vehicle.image && typeof appointment.vehicle.image === "string"
                  ? { uri: appointment.vehicle.image }
                  : appointment.vehicle.image?.uri
                    ? { uri: appointment.vehicle.image.uri }
                    : require("@/assets/images/car.jpg")
              }
              style={styles.vehicleImage}
              resizeMode="cover"
            />
            <View style={[styles.vehicleImageOverlay, { backgroundColor: primaryColor + "10" }]} />
          </View>
          <View style={styles.vehicleDetails}>
            <StyledText
              variant="titleLarge"
              style={[styles.vehicleName, { color: textColor }]}
              numberOfLines={2}
            >
              {appointment.vehicle.make} {appointment.vehicle.model}
            </StyledText>
            <View style={styles.vehicleMeta}>
              <View style={styles.vehicleMetaItem}>
                <Ionicons name="calendar-outline" size={14} color={iconColor} />
                <StyledText
                  variant="bodySmall"
                  style={[styles.vehicleInfoText, { color: textColor, opacity: 0.8 }]}
                >
                  {appointment.vehicle.year}
                </StyledText>
              </View>
              <View style={styles.vehicleMetaItem}>
                <Ionicons name="color-palette-outline" size={14} color={iconColor} />
                <StyledText
                  variant="bodySmall"
                  style={[styles.vehicleInfoText, { color: textColor, opacity: 0.8 }]}
                >
                  {appointment.vehicle.color}
                </StyledText>
              </View>
            </View>
            <View style={[styles.licenseBadge, { backgroundColor: borderColor + "30" }]}>
              <Ionicons name="shield-checkmark-outline" size={16} color={primaryColor} />
              <StyledText
                variant="bodySmall"
                style={[styles.licenseText, { color: textColor }]}
              >
                {appointment.vehicle.licence?.toUpperCase() ?? ""}
              </StyledText>
            </View>
          </View>
        </View>
      </View>

      {/* Service Details Card */}
      <View style={[styles.card, { backgroundColor: cardColor, borderColor: borderColor }]}>
        <View style={styles.sectionHeader}>
          <View style={[styles.iconWrapper, { backgroundColor: primaryColor + "15" }]}>
            <Ionicons name="construct-outline" size={22} color={primaryColor} />
          </View>
          <StyledText
            variant="titleMedium"
            style={[styles.sectionTitle, { color: textColor }]}
          >
            Service Details
          </StyledText>
        </View>

        <View style={styles.serviceInfo}>
          <View style={[styles.serviceItem, { borderBottomColor: borderColor }]}>
            <View style={styles.serviceItemLeft}>
              <Ionicons name="sparkles-outline" size={18} color={primaryColor} />
              <View style={styles.serviceItemContent}>
                <StyledText
                  variant="bodySmall"
                  style={[styles.serviceLabel, { color: textColor, opacity: 0.6 }]}
                >
                  Service Type
                </StyledText>
                <StyledText
                  variant="bodyLarge"
                  style={[styles.serviceValue, { color: textColor }]}
                >
                  {appointment.service_type.name}
                </StyledText>
              </View>
            </View>
          </View>

          <View style={[styles.serviceItem, { borderBottomColor: borderColor }]}>
            <View style={styles.serviceItemLeft}>
              <Ionicons name="water-outline" size={18} color={primaryColor} />
              <View style={styles.serviceItemContent}>
                <StyledText
                  variant="bodySmall"
                  style={[styles.serviceLabel, { color: textColor, opacity: 0.6 }]}
                >
                  Valet Type
                </StyledText>
                <StyledText
                  variant="bodyLarge"
                  style={[styles.serviceValue, { color: textColor }]}
                >
                  {appointment.valet_type.name}
                </StyledText>
              </View>
            </View>
          </View>

          <View style={styles.serviceItem}>
            <View style={styles.serviceItemLeft}>
              <Ionicons name="cash-outline" size={18} color={primaryColor} />
              <View style={styles.serviceItemContent}>
                <StyledText
                  variant="bodySmall"
                  style={[styles.serviceLabel, { color: textColor, opacity: 0.6 }]}
                >
                  Total Amount
                </StyledText>
                <StyledText
                  variant="titleLarge"
                  style={[styles.priceValue, { color: primaryColor }]}
                >
                  {formatCurrency(appointment.total_amount, user?.address?.country)}
                </StyledText>
              </View>
            </View>
          </View>
        </View>

        {/* Service Description */}
        <View style={styles.descriptionContainer}>
          <StyledText
            variant="bodyMedium"
            style={[styles.descriptionTitle, { color: textColor }]}
          >
            What's included:
          </StyledText>
          <View style={styles.descriptionList}>
            {appointment.service_type.description.map((item, index) => (
              <View key={index} style={styles.descriptionItem}>
                <View style={[styles.checkIconContainer, { backgroundColor: "#10B981" + "20" }]}>
                  <Ionicons name="checkmark" size={14} color="#10B981" />
                </View>
                <StyledText
                  variant="bodyMedium"
                  style={[styles.descriptionText, { color: textColor }]}
                  numberOfLines={0}
                >
                  {item}
                </StyledText>
              </View>
            ))}
          </View>
        </View>
        {appointment.add_ons && appointment.add_ons.length > 0 && (
          <View style={styles.descriptionContainer}>
            <StyledText
              variant="bodyMedium"
              style={[styles.descriptionTitle, { color: textColor }]}
            >
              Add Ons:
            </StyledText>
            <View style={styles.descriptionList}>
              {appointment.add_ons.map((item, index) => (
                <View key={index} style={[styles.descriptionItem, styles.addonItem]}>
                  <View style={[styles.checkIconContainer, { backgroundColor: primaryColor + "20" }]}>
                    <Ionicons name="add-circle" size={14} color={primaryColor} />
                  </View>
                  <View style={styles.addonDetails}>
                    <StyledText
                      variant="bodyMedium"
                      style={[styles.descriptionText, { color: textColor }]}
                      numberOfLines={0}
                    >
                      {item.name}
                    </StyledText>
                    <StyledText
                      variant="bodySmall"
                      style={[styles.addonPrice, { color: primaryColor }]}
                    >
                      +{formatCurrency(item.price, user?.address?.country)}
                    </StyledText>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>

      {/* Detailer Information Card */}
      <View style={[styles.card, { backgroundColor: cardColor, borderColor: borderColor }]}>
        <View style={styles.sectionHeader}>
          <StyledText
            variant="titleMedium"
            style={[styles.sectionTitle, { color: textColor }]}
          >
            Your Detailer
          </StyledText>
        </View>

        <View style={styles.detailerInfo}>
          <View style={styles.detailerImageContainer}>
            <Image
              source={require("@/assets/images/user_image.jpg")}
              style={styles.detailerImage}
            />
            <View style={[styles.detailerImageBadge, { backgroundColor: statusColor }]}>
              <Ionicons name="checkmark" size={12} color="white" />
            </View>
          </View>
          <View style={styles.detailerDetails}>
            <StyledText
              variant="titleLarge"
              style={[styles.detailerName, { color: textColor }]}
              numberOfLines={2}
            >
              {appointment.detailers && appointment.detailers.length > 0
                ? appointment.detailers.map(d => d.name).join(" & ")
                : appointment.detailer?.name || "Assigning detailer..."}
            </StyledText>
            {((appointment.detailers && appointment.detailers.length > 0) || appointment.detailer) && (
              <View style={styles.ratingContainer}>
                <View style={styles.ratingStars}>
                  {[1, 2, 3, 4, 5].map((star) => {
                    const avgRating = appointment.detailers && appointment.detailers.length > 0
                      ? appointment.detailers.reduce((sum, d) => sum + (d.rating || 0), 0) / appointment.detailers.length
                      : appointment.detailer?.rating || 0;
                    return (
                      <Ionicons
                        key={star}
                        name={star <= Math.round(avgRating) ? "star" : "star-outline"}
                        size={14}
                        color="#FFD700"
                      />
                    );
                  })}
                </View>
                <StyledText
                  variant="bodyMedium"
                  style={[styles.ratingText, { color: textColor, opacity: 0.8 }]}
                >
                  {appointment.detailers && appointment.detailers.length > 0
                    ? `${(appointment.detailers.reduce((sum, d) => sum + (d.rating || 0), 0) / appointment.detailers.length).toFixed(1)} Rating`
                    : `${appointment.detailer?.rating?.toFixed(1) || "0.0"} Rating`}
                </StyledText>
              </View>
            )}
            {((appointment.detailers && appointment.detailers.length > 0 && appointment.detailers[0].phone) || appointment.detailer?.phone) && (
              <TouchableOpacity
                style={[styles.contactButton, { backgroundColor: primaryColor }]}
                onPress={() => callDetailer((appointment.detailers && appointment.detailers.length > 0 ? appointment.detailers[0].phone : appointment.detailer?.phone)!)}
                activeOpacity={0.8}
              >
                <Ionicons name="call" size={18} color="white" />
                <StyledText variant="bodyMedium" style={styles.contactButtonText}>
                  Call
                </StyledText>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* Location Card */}
      <View style={[styles.card, { backgroundColor: cardColor, borderColor: borderColor }]}>
        <View style={styles.sectionHeader}>
          <View style={[styles.iconWrapper, { backgroundColor: primaryColor + "15" }]}>
            <Ionicons name="location-outline" size={22} color={primaryColor} />
          </View>
          <StyledText
            variant="titleMedium"
            style={[styles.sectionTitle, { color: textColor }]}
          >
            Service Location
          </StyledText>
        </View>

        <View style={styles.locationInfo}>
          <View style={[styles.locationIconContainer, { backgroundColor: primaryColor + "15" }]}>
            <Ionicons name="location" size={20} color={primaryColor} />
          </View>
          <View style={styles.locationText}>
            <StyledText
              variant="bodyLarge"
              style={[styles.addressText, { color: textColor }]}
              numberOfLines={0}
            >
              {appointment.address.address}
            </StyledText>
            <StyledText
              variant="bodyMedium"
              style={[styles.addressText, { color: textColor, opacity: 0.8, marginTop: 4 }]}
              numberOfLines={0}
            >
              {appointment.address.city}, {appointment.address.post_code}
            </StyledText>
            <StyledText
              variant="bodySmall"
              style={[styles.addressText, { color: textColor, opacity: 0.6, marginTop: 2 }]}
              numberOfLines={0}
            >
              {appointment.address.country}
            </StyledText>
          </View>
        </View>
      </View>

      {/* Special Instructions Card */}
      {appointment.special_instructions && (
        <View style={[styles.card, { backgroundColor: cardColor, borderColor: borderColor }]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.iconWrapper, { backgroundColor: "#F59E0B" + "15" }]}>
              <Ionicons
                name="information-circle-outline"
                size={22}
                color="#F59E0B"
              />
            </View>
            <StyledText
              variant="titleMedium"
              style={[styles.sectionTitle, { color: textColor }]}
            >
              Special Instructions
            </StyledText>
          </View>
          <View style={[styles.instructionsContainer, { backgroundColor: backgroundColor }]}>
            <StyledText
              variant="bodyMedium"
              style={[styles.instructionsText, { color: textColor }]}
            >
              {appointment.special_instructions}
            </StyledText>
          </View>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[
            styles.actionButton,
            styles.cancelButton,
            { borderColor: borderColor },
            (isAppointmentInProgress(appointment) || isLoadingCancelBooking) &&
              styles.disabledButton,
          ]}
          onPress={() =>
            handleCencellationConfirm(appointment.booking_reference)
          }
          disabled={
            isAppointmentInProgress(appointment) || isLoadingCancelBooking
          }
          activeOpacity={0.7}
        >
          <Ionicons
            name="close-circle-outline"
            size={22}
            color={isAppointmentInProgress(appointment) ? "#999" : "#EF4444"}
          />
          <StyledText
            variant="bodyLarge"
            style={[
              styles.cancelButtonText,
              { color: isAppointmentInProgress(appointment) ? "#999" : "#EF4444" },
            ]}
          >
            {isLoadingCancelBooking
              ? "Please wait..."
              : isAppointmentInProgress(appointment)
              ? "Cannot Cancel (In Progress)"
              : "Cancel Appointment"}
          </StyledText>
        </TouchableOpacity>

        {/* <TouchableOpacity
          style={[
            styles.actionButton,
            styles.rescheduleButton,
            (isAppointmentInProgress(appointment) ||
              isWithin12Hours(appointment) ||
              isLoadingRescheduleBooking) &&
              styles.disabledButton,
          ]}
          onPress={handleReschedulePress}
          disabled={
            isAppointmentInProgress(appointment) ||
            isWithin12Hours(appointment) ||
            isLoadingRescheduleBooking
          }
        >
          <Ionicons
            name="time"
            size={20}
            color={
              isAppointmentInProgress(appointment) ||
              isWithin12Hours(appointment)
                ? "#999"
                : "green"
            }
          />
          <StyledText
            variant="bodyMedium"
            style={[
              styles.rescheduleButtonText,
              (isAppointmentInProgress(appointment) ||
                isWithin12Hours(appointment)) &&
                styles.disabledButtonText,
            ]}
          >
            {isLoadingRescheduleBooking
              ? "Please wait..."
              : isAppointmentInProgress(appointment)
              ? "Cannot Reschedule (In Progress)"
              : isWithin12Hours(appointment)
              ? "Cannot Reschedule (Within 12 Hours)"
              : "Reschedule Appointment"}
          </StyledText>
        </TouchableOpacity> */}
      </View>

      {/* Reschedule Modal */}
      {appointment && (
        <ModalServices
          visible={isRescheduleModalVisible}
          onClose={() => setIsRescheduleModalVisible(false)}
          component={
            <RescheduleComponent
              visible={isRescheduleModalVisible}
              onClose={() => setIsRescheduleModalVisible(false)}
              onConfirm={handleRescheduleConfirm}
              currentDate={appointment.booking_date || ""}
              currentTime={appointment.start_time || ""}
              appointmentId={appointment.booking_reference}
              userCountry={appointment.address.country}
              userCity={appointment.address.city}
              userLatitude={appointment.address.latitude}
              userLongitude={appointment.address.longitude}
              serviceDuration={appointment.service_type.duration}
              isLoading={isLoadingRescheduleBooking}
            />
          }
          showCloseButton={true}
          animationType="slide"
          title="Reschedule Appointment"
          modalType="fullscreen"
        />
      )}

      {/* Booking Cancellation Modal */}
      {cancellationData && (
        <ModalServices
          visible={isCancellationModalVisible}
          onClose={handleCloseCancellationModal}
          modalType="fullscreen"
          animationType="slide"
          showCloseButton={true}
          component={
            <BookingCancellationModal
              bookingReference={cancellationBookingReference}
              cancellationData={cancellationData}
              onCancel={handleCloseCancellationModal}
              onConfirm={handleConfirmCancellation}
            />
          }
        />
      )}
    </ScrollView>
  );
};

export default UpcomingBookingScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
  heroCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    overflow: "hidden",
  },
  heroHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  statusBadgeText: {
    color: "white",
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  appointmentId: {
    fontWeight: "500",
    letterSpacing: 0.3,
  },
  timingGrid: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
  },
  timingCard: {
    flex: 1,
    minWidth: 100,
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  timingIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  timingContent: {
    alignItems: "center",
    width: "100%",
  },
  timingLabel: {
    fontSize: 11,
    marginBottom: 4,
    textAlign: "center",
  },
  timingValue: {
    fontWeight: "700",
    textAlign: "center",
  },
  card: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeader: {
    marginBottom: 20,
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  sectionTitle: {
    fontWeight: "700",
    fontSize: 18,
  },
  vehicleInfo: {
    flexDirection: "row",
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  vehicleImageContainer: {
    position: "relative",
    marginRight: 16,
    marginBottom: 12,
    borderRadius: 12,
    overflow: "hidden",
  },
  vehicleImage: {
    width: 120,
    height: 90,
    borderRadius: 12,
  },
  vehicleImageOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  vehicleDetails: {
    flex: 1,
    minWidth: 150,
  },
  vehicleName: {
    fontWeight: "700",
    marginBottom: 8,
    fontSize: 20,
  },
  vehicleMeta: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 12,
  },
  vehicleMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  vehicleInfoText: {
    fontSize: 13,
  },
  licenseBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: "flex-start",
    gap: 6,
  },
  licenseText: {
    fontWeight: "600",
    fontSize: 13,
    letterSpacing: 0.5,
  },
  serviceInfo: {
    gap: 0,
  },
  serviceItem: {
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  serviceItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  serviceItemContent: {
    flex: 1,
  },
  serviceLabel: {
    marginBottom: 4,
    fontSize: 12,
  },
  serviceValue: {
    fontWeight: "600",
  },
  priceValue: {
    fontWeight: "700",
    fontSize: 22,
  },
  descriptionContainer: {
    marginTop: 8,
  },
  descriptionTitle: {
    fontWeight: "700",
    marginBottom: 16,
    fontSize: 16,
  },
  descriptionList: {
    gap: 12,
  },
  descriptionItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    flexShrink: 1,
  },
  addonItem: {
    paddingVertical: 8,
  },
  checkIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  descriptionText: {
    flex: 1,
    lineHeight: 22,
    flexWrap: "wrap",
  },
  addonDetails: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexShrink: 1,
  },
  addonPrice: {
    fontWeight: "700",
    fontSize: 14,
  },
  detailerInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    flexWrap: "wrap",
  },
  detailerImageContainer: {
    position: "relative",
  },
  detailerImage: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 3,
    borderColor: "transparent",
  },
  detailerImageBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: "white",
    alignItems: "center",
    justifyContent: "center",
  },
  detailerDetails: {
    flex: 1,
    minWidth: 120,
  },
  detailerName: {
    fontWeight: "700",
    marginBottom: 8,
    fontSize: 20,
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ratingStars: {
    flexDirection: "row",
    gap: 2,
  },
  ratingText: {
    fontSize: 14,
  },
  contactButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    alignSelf: "flex-start",
    marginTop: 8,
  },
  contactButtonText: {
    color: "white",
    fontWeight: "700",
    fontSize: 15,
  },
  locationInfo: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  locationIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  locationText: {
    flex: 1,
    flexShrink: 1,
  },
  addressText: {
    lineHeight: 22,
    flexWrap: "wrap",
  },
  instructionsContainer: {
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  instructionsText: {
    lineHeight: 24,
    fontSize: 15,
  },
  actionButtons: {
    marginTop: 8,
    marginBottom: 32,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 14,
    gap: 10,
    backgroundColor: "transparent",
    borderWidth: 2,
  },
  cancelButton: {
    borderWidth: 2,
  },
  cancelButtonText: {
    fontWeight: "700",
    fontSize: 16,
  },
  disabledButton: {
    opacity: 0.4,
    backgroundColor: "#f5f5f5",
  },
});
