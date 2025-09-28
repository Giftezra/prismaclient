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
  const [isJobChatModalVisible, setIsJobChatModalVisible] = useState(false);

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

  return (
    <ScrollView
      style={[styles.container, { backgroundColor }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Status Card */}
      <LinearGradientComponent
        style={[styles.statusCard]}
        color1={backgroundColor}
        color2={textColor}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 5 }}
      >
        <View style={styles.statusHeader}>
          <LinearGradientComponent
            style={[styles.statusBadge, { borderColor: borderColor }]}
            color1={primaryColor}
            color2={textColor}
            start={{ x: 0, y: 0 }}
            end={{ x: 2, y: 1 }}
          >
            <StyledText variant="labelMedium">{appointment?.status}</StyledText>
          </LinearGradientComponent>

          <StyledText
            variant="titleMedium"
            style={[styles.appointmentId, { color: textColor }]}
          >
            #{appointment.booking_reference}
          </StyledText>
        </View>

        <View style={styles.timingInfo}>
          <View style={styles.timeItem}>
            <Ionicons name="calendar" size={20} color={iconColor} />
            <View>
              <StyledText
                variant="bodySmall"
                style={[styles.timeLabel, { color: textColor }]}
              >
                Date
              </StyledText>
              <StyledText
                variant="bodyMedium"
                style={[styles.timeValue, { color: textColor }]}
              >
                {new Date(appointment.booking_date).toLocaleDateString()}
              </StyledText>
            </View>
          </View>

          <View style={styles.timeItem}>
            <Ionicons name="time" size={20} color={iconColor} />
            <View>
              <StyledText
                variant="bodySmall"
                style={[styles.timeLabel, { color: textColor }]}
              >
                Time
              </StyledText>
              <StyledText
                variant="bodyMedium"
                style={[styles.timeValue, { color: textColor }]}
              >
                {appointment.start_time} - {appointment.end_time}
              </StyledText>
            </View>
          </View>

          <View style={styles.timeItem}>
            <Ionicons name="hourglass" size={20} color={iconColor} />
            <View>
              <StyledText
                variant="bodySmall"
                style={[styles.timeLabel, { color: textColor }]}
              >
                Duration
              </StyledText>
              <StyledText
                variant="bodyMedium"
                style={[styles.timeValue, { color: textColor }]}
              >
                {appointment.estimated_duration}
              </StyledText>
            </View>
          </View>
        </View>
      </LinearGradientComponent>

      {/* Vehicle Information */}
      <LinearGradientComponent
        style={[styles.section]}
        color1={backgroundColor}
        color2={textColor}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 5 }}
      >
        <View style={styles.sectionHeader}>
          <Ionicons name="car" size={24} color={iconColor} />
          <StyledText
            variant="titleMedium"
            style={[styles.sectionTitle, { color: textColor }]}
          >
            Vehicle Details
          </StyledText>
        </View>
        <View style={styles.vehicleInfo}>
          <Image
            source={
              appointment.vehicle.image
                ? { uri: appointment.vehicle.image }
                : require("@/assets/images/car.jpg")
            }
            style={styles.vehicleImage}
          />
          <View style={styles.vehicleDetails}>
            <StyledText
              variant="titleMedium"
              style={[styles.vehicleName, { color: textColor }]}
            >
              {appointment.vehicle.make} {appointment.vehicle.model}
            </StyledText>
            <StyledText
              variant="bodyMedium"
              style={[styles.vehicleInfoText, { color: textColor }]}
            >
              {appointment.vehicle.year} • {appointment.vehicle.color}
            </StyledText>
            <StyledText
              variant="bodyMedium"
              style={[styles.vehicleInfoText, { color: textColor }]}
            >
              License: {appointment.vehicle.licence}
            </StyledText>
          </View>
        </View>
      </LinearGradientComponent>

      {/* Service Details */}
      <LinearGradientComponent
        style={[styles.section]}
        color1={backgroundColor}
        color2={textColor}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 5 }}
      >
        <View style={styles.sectionHeader}>
          <Ionicons name="construct" size={24} color={iconColor} />
          <StyledText
            variant="titleMedium"
            style={[styles.sectionTitle, { color: textColor }]}
          >
            Service Details
          </StyledText>
        </View>

        <View style={styles.serviceInfo}>
          <View style={styles.serviceItem}>
            <StyledText
              variant="bodySmall"
              style={[styles.serviceLabel, { color: textColor }]}
            >
              Service Type
            </StyledText>
            <StyledText
              variant="bodyMedium"
              style={[styles.serviceValue, { color: textColor }]}
            >
              {appointment.service_type.name}
            </StyledText>
          </View>

          <View style={styles.serviceItem}>
            <StyledText
              variant="bodySmall"
              style={[styles.serviceLabel, { color: textColor }]}
            >
              Valet Type
            </StyledText>
            <StyledText
              variant="bodyMedium"
              style={[styles.serviceValue, { color: textColor }]}
            >
              {appointment.valet_type.name}
            </StyledText>
          </View>

          <View style={styles.serviceItem}>
            <StyledText
              variant="bodySmall"
              style={[styles.serviceLabel, { color: textColor }]}
            >
              Total Amount
            </StyledText>
            <StyledText
              variant="titleMedium"
              style={[styles.priceValue, { color: textColor }]}
            >
              {formatCurrency(appointment.total_amount, user?.address?.country)}
            </StyledText>
          </View>
        </View>

        {/* Service Description */}
        <View style={styles.descriptionContainer}>
          <StyledText
            variant="bodySmall"
            style={[styles.descriptionTitle, { color: textColor }]}
          >
            What's included:
          </StyledText>
          {appointment.service_type.description.map((item, index) => (
            <View key={index} style={styles.descriptionItem}>
              <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
              <StyledText
                variant="bodyMedium"
                style={[styles.descriptionText, { color: textColor }]}
              >
                {item}
              </StyledText>
            </View>
          ))}
        </View>
        {appointment.add_ons && appointment.add_ons.length > 0 && (
          <View style={styles.descriptionContainer}>
            <StyledText
              variant="bodySmall"
              style={[styles.descriptionTitle, { color: textColor }]}
            >
              Add Ons:
            </StyledText>
            {appointment.add_ons.map((item, index) => (
              <View key={index} style={styles.descriptionItem}>
                <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                <View style={styles.addonDetails}>
                  <StyledText
                    variant="bodyMedium"
                    style={[styles.descriptionText, { color: textColor }]}
                  >
                    {item.name}
                  </StyledText>
                  <StyledText
                    variant="bodySmall"
                    style={[styles.addonPrice, { color: textColor }]}
                  >
                    {formatCurrency(item.price, user?.address?.country)}
                  </StyledText>
                </View>
              </View>
            ))}
          </View>
        )}
      </LinearGradientComponent>

      {/* Detailer Information */}
      <LinearGradientComponent
        style={[styles.section]}
        color1={backgroundColor}
        color2={textColor}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 5 }}
      >
        <View style={styles.sectionHeader}>
          <Ionicons name="person" size={24} color={iconColor} />
          <StyledText
            variant="titleMedium"
            style={[styles.sectionTitle, { color: textColor }]}
          >
            Your Detailer
          </StyledText>
        </View>

        <View style={styles.detailerInfo}>
          <Image
            source={require("@/assets/images/user_image.jpg")}
            style={styles.detailerImage}
          />
          <View style={styles.detailerDetails}>
            <StyledText
              variant="titleMedium"
              style={[styles.detailerName, { color: textColor }]}
            >
              {appointment.detailer.name}
            </StyledText>
            <View style={styles.ratingContainer}>
              <Ionicons name="star" size={16} color="#FFD700" />
              <StyledText
                variant="bodyMedium"
                style={[styles.ratingText, { color: textColor }]}
              >
                {appointment.detailer.rating} Rating
              </StyledText>
            </View>
          </View>
          {appointment.detailer.phone && (
            <TouchableOpacity
              style={[styles.contactButton, { backgroundColor: primaryColor }]}
              onPress={() => callDetailer(appointment.detailer.phone!)}
            >
              <Ionicons name="call" size={16} color="white" />
              <StyledText variant="bodyMedium" style={styles.contactButtonText}>
                Call
              </StyledText>
            </TouchableOpacity>
          )}
        </View>
      </LinearGradientComponent>

      {/* Location */}
      <LinearGradientComponent
        style={[styles.section]}
        color1={backgroundColor}
        color2={textColor}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 5 }}
      >
        <View style={styles.sectionHeader}>
          <Ionicons name="location" size={24} color={iconColor} />
          <StyledText
            variant="titleMedium"
            style={[styles.sectionTitle, { color: textColor }]}
          >
            Service Location
          </StyledText>
        </View>

        <View style={styles.locationInfo}>
          <Ionicons name="location-outline" size={20} color={iconColor} />
          <View style={styles.locationText}>
            <StyledText
              variant="bodyMedium"
              style={[styles.addressText, { color: textColor }]}
            >
              {appointment.address.address}
            </StyledText>
            <StyledText
              variant="bodyMedium"
              style={[styles.addressText, { color: textColor }]}
            >
              {appointment.address.city}, {appointment.address.post_code}
            </StyledText>
            <StyledText
              variant="bodyMedium"
              style={[styles.addressText, { color: textColor }]}
            >
              {appointment.address.country}
            </StyledText>
          </View>
        </View>
      </LinearGradientComponent>

      {/* Special Instructions */}
      {appointment.special_instructions && (
        <View style={[styles.section, { backgroundColor: cardColor }]}>
          <View style={styles.sectionHeader}>
            <Ionicons
              name="information-circle"
              size={24}
              color={primaryColor}
            />
            <StyledText
              variant="titleMedium"
              style={[styles.sectionTitle, { color: textColor }]}
            >
              Special Instructions
            </StyledText>
          </View>
          <StyledText
            variant="bodyMedium"
            style={[styles.instructionsText, { color: textColor }]}
          >
            {appointment.special_instructions}
          </StyledText>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[
            styles.actionButton,
            styles.cancelButton,
            (isAppointmentInProgress(appointment) || isLoadingCancelBooking) &&
              styles.disabledButton,
          ]}
          onPress={() =>
            handleCencellationConfirm(appointment.booking_reference)
          }
          disabled={
            isAppointmentInProgress(appointment) || isLoadingCancelBooking
          }
        >
          <Ionicons
            name="close-circle"
            size={20}
            color={isAppointmentInProgress(appointment) ? "#999" : "#F44336"}
          />
          <StyledText
            variant="bodyMedium"
            style={[
              styles.cancelButtonText,
              isAppointmentInProgress(appointment) && styles.disabledButtonText,
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
    paddingHorizontal: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
    paddingTop: 5,
  },
  statusCard: {
    borderRadius: 3,
    padding: 10,
    marginBottom: 10,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statusHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    gap: 10,
  },
  statusBadge: {
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 5,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  statusText: {
    color: "white",
    marginLeft: 4,
    fontWeight: "600",
  },
  appointmentId: {
    fontWeight: "600",
  },
  timingInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  timeItem: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  timeLabel: {
    marginLeft: 8,
    opacity: 0.7,
  },
  timeValue: {
    marginLeft: 8,
    fontWeight: "600",
  },
  section: {
    borderRadius: 3,
    padding: 10,
    marginBottom: 5,
    elevation: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    marginLeft: 12,
    fontWeight: "600",
  },
  vehicleInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  vehicleImage: {
    width: 80,
    height: 60,
    borderRadius: 8,
    marginRight: 16,
  },
  vehicleDetails: {
    flex: 1,
  },
  vehicleName: {
    fontWeight: "600",
    marginBottom: 4,
  },
  vehicleInfoText: {
    marginBottom: 2,
  },
  serviceInfo: {
    marginBottom: 16,
  },
  serviceItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5E5",
  },
  serviceLabel: {
    opacity: 0.7,
  },
  serviceValue: {
    fontWeight: "600",
  },
  priceValue: {
    fontWeight: "bold",
  },
  descriptionContainer: {
    marginTop: 8,
  },
  descriptionTitle: {
    fontWeight: "600",
    marginBottom: 8,
  },
  descriptionItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  descriptionText: {
    marginLeft: 8,
  },
  addonDetails: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  addonPrice: {
    fontWeight: "600",
  },
  detailerInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  detailerImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
  },
  detailerDetails: {
    flex: 1,
  },
  detailerName: {
    fontWeight: "600",
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  ratingText: {
    marginLeft: 4,
  },
  contactButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  contactButtonText: {
    color: "white",
    marginLeft: 4,
    fontWeight: "600",
  },
  locationInfo: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  locationText: {
    marginLeft: 12,
    flex: 1,
  },
  addressText: {
    marginBottom: 2,
  },
  instructionsText: {
    lineHeight: 20,
  },
  actionButtons: {
    flexDirection: "column",
    gap: 10,
    marginTop: 8,
    marginBottom: 32,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 4,
    gap: 20,
  },
  secondaryButton: {
    borderWidth: 1,
    backgroundColor: "transparent",
  },
  secondaryButtonText: {
    marginLeft: 4,
    fontWeight: "600",
  },
  cancelButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#F44336",
  },
  cancelButtonText: {
    color: "#F44336",
    marginLeft: 4,
    fontWeight: "600",
  },
  rescheduleButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "green",
  },
  rescheduleButtonText: {
    color: "green",
    marginLeft: 4,
    fontWeight: "600",
  },
  disabledButton: {
    opacity: 0.5,
    backgroundColor: "#f5f5f5",
  },
  disabledButtonText: {
    color: "#999",
  },
});
