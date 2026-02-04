import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  ScrollView,
  View,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { router } from "expo-router";
import { useThemeColor } from "@/hooks/useThemeColor";
import { Ionicons } from "@expo/vector-icons";

import UpcomingAppointmentProps, {
  RecentServicesProps,
} from "../../../interfaces/DashboardInterfaces";
import OngoingServiceCard from "@/app/components/dashboard/OngoingServiceCard";
import RecentServicesSection from "@/app/components/dashboard/RecentServicesSection";
import StatsSection from "@/app/components/dashboard/StatsSection";
import StyledText from "@/app/components/helpers/StyledText";
import useDashboard from "@/app/app-hooks/useDashboard";
import AllowNotificationModal from "@/app/components/notification/AllowNotificationModal";
import { usePermissions } from "@/app/app-hooks/usePermissions";
import ModalServices from "@/app/utils/ModalServices";
import ReviewComponent from "@/app/components/booking/ReviewComponent";
import { useAppSelector, RootState } from "@/app/store/main_store";
import ReferralSection from "@/app/components/dashboard/ReferralSection";
import FleetDashboardScreen from "./FleetDashboardScreen";
import BranchAdminDashboardScreen from "./BranchAdminDashboardScreen";
const image = require("@/assets/images/user_image.jpg");
const vehicleImage = require("@/assets/images/car.jpg");

const DashboardScreen = () => {
  /* Get the user from Redux store */
  const user = useAppSelector((state: RootState) => state.auth.user);

  // ALL hooks must be called before any conditional returns
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [hasAskedForPermissions, setHasAskedForPermissions] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  
  const backgroundColor = useThemeColor({}, "background");
  const buttonColor = useThemeColor({}, "button");
  const tintColor = useThemeColor({}, "tint");
  const primaryColor = useThemeColor({}, "primary");
  const borderColor = useThemeColor({}, "borders");
  const cardColor = useThemeColor({}, "cards");
  const textColor = useThemeColor({}, "text");

  /* Fetch the neccessary hooks */
  const {
    appointments,
    inProgressAppointment,
    isLoading,
    error,
    refetchAppointments,
    recentService,
    stats,
    handleRefresh,
    isRefreshing,
    isUnratedServices,
  } = useDashboard();

  const { permissionStatus, isLoading: permissionsLoading } = usePermissions();

  // Show notification modal when dashboard loads, but only if notifications are not already granted
  // and we haven't asked for permissions yet in this session
  // Also check if the user hasn't disabled notifications in settings
  useEffect(() => {
    if (
      !permissionsLoading &&
      !permissionStatus.notifications.granted &&
      !hasAskedForPermissions &&
      user?.push_notification_token !== false // Don't show if user has explicitly disabled in settings
    ) {
      const timer = setTimeout(() => {
        setShowNotificationModal(true);
        setHasAskedForPermissions(true);
      }, 1000); // Show after 1 second

      return () => clearTimeout(timer);
    }
  }, [
    permissionsLoading,
    permissionStatus.notifications.granted,
    hasAskedForPermissions,
    user?.push_notification_token,
  ]);

  /**
   * Handle unrated service press - opens review modal
   */
  const handleUnratedPress = () => {
    if (recentService) {
      setShowReviewModal(true);
    }
  };

  /**
   * Handle review submission - closes modal and refreshes data
   */
  const handleReviewSubmitted = () => {
    setShowReviewModal(false);
    handleRefresh();
  };

  // Route to appropriate dashboard based on user type (AFTER all hooks)
  if (user?.is_fleet_owner) {
    return <FleetDashboardScreen />;
  } else if (user?.is_branch_admin) {
    return <BranchAdminDashboardScreen />;
  }

  // Regular user dashboard (existing code below)
  /* Get the currency symbol by getting the user's country */
  let currencySymbol = "$";
  if (user?.address?.country === "United Kingdom") {
    currencySymbol = "£";
  } else if (user?.address?.country === "Ireland") {
    currencySymbol = "€";
  }

  /**
   * Render the upcoming appointment card
   * @param appointment - The appointment object of interface {OngoingAppointmentProps}
   * @returns A Pressable component that navigates to the upcoming booking screen
   */
  const renderUpcomingAppointmentDate = (
    appointment: UpcomingAppointmentProps
  ) => {
    const formatDate = (dateString: string) => {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    };

    return (
      <Pressable
        style={[
          styles.upcomingAppointmentCard,
          { borderColor, backgroundColor: cardColor },
        ]}
        onPress={() => {
          router.push({
            pathname: "/main/(tabs)/dashboard/UpcomingBookingScreen",
            params: { appointmentId: appointment.booking_reference },
          });
        }}
      >
        <View style={styles.appointmentCardContent}>
          <View style={styles.appointmentCardHeader}>
            <StyledText
              variant="bodyMedium"
              style={[styles.appointmentReg, { color: textColor }]}
            >
              {appointment.vehicle.licence}
            </StyledText>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor:
                    appointment.status === "in_progress"
                      ? "#FF9800"
                      : appointment.status === "confirmed" || appointment.status === "scheduled"
                      ? "#2196F3"
                      : "#6B7280",
                },
              ]}
            >
              <StyledText variant="bodySmall" style={styles.statusText}>
                {appointment.status?.replace("_", " ").toUpperCase() || "PENDING"}
              </StyledText>
            </View>
          </View>
          <StyledText
            variant="bodySmall"
            style={[styles.appointmentServiceType, { color: textColor }]}
          >
            {appointment.service_type.name}
          </StyledText>
          <View style={styles.appointmentDateRow}>
            <Ionicons name="calendar-outline" size={14} color={textColor} />
            <StyledText
              variant="bodySmall"
              style={[styles.appointmentDate, { color: textColor }]}
            >
              {formatDate(appointment.booking_date)}
            </StyledText>
          </View>
        </View>
      </Pressable>
    );
  };

  // Show loading state
  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor }]}>
        <ActivityIndicator size="large" color={primaryColor} />
        <StyledText children="Loading appointments..." variant="bodyMedium" />
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={[styles.container, { backgroundColor: backgroundColor }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Ongoing Service Card */}
        {inProgressAppointment && (
          <OngoingServiceCard appointment={inProgressAppointment} />
        )}

        {/* Display the component that would show how many upcoming appointments a user has */}
        {appointments.length > 0 && (
          <View style={styles.upcomingAppointmentDateContainer}>
            <StyledText
              children="Upcoming Appointments"
              variant="labelMedium"
            />
            <View style={{ paddingHorizontal: 10, gap: 5 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {appointments.map((appointment) => (
                  <View key={appointment.booking_reference}>
                    {renderUpcomingAppointmentDate(appointment)}
                  </View>
                ))}
              </ScrollView>
            </View>
          </View>
        )}

        <RecentServicesSection
          bookings={recentService}
          onUnratedPress={handleUnratedPress}
        />

        <StatsSection stats={stats} />
        <ReferralSection referral={user?.referral_code || ""} />
      </ScrollView>

      {/* Notification Permission Modal */}
      <ModalServices
        visible={showNotificationModal}
        onClose={() => setShowNotificationModal(false)}
        component={
          <AllowNotificationModal
            onClose={() => setShowNotificationModal(false)}
            onPermissionGranted={() => {
              setShowNotificationModal(false);
              setHasAskedForPermissions(true);
            }}
          />
        }
        showCloseButton={false}
        animationType="fade"
        modalType="fullscreen"
      />

      {/* Review Modal */}
      <ModalServices
        visible={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        component={
          <ReviewComponent
            currencySymbol={currencySymbol}
            bookingData={recentService || undefined}
            onReviewSubmitted={handleReviewSubmitted}
          />
        }
        showCloseButton={true}
        animationType="slide"
        title="Review"
        modalType="fullscreen"
      />
    </>
  );
};

export default DashboardScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 10,
  },
  upcomingAppointmentDateContainer: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 5,
  },
  upcomingAppointmentCard: {
    padding: 12,
    borderRadius: 12,
    marginRight: 10,
    minWidth: 200,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
  },
  appointmentCardContent: {
    gap: 8,
  },
  appointmentCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  appointmentReg: {
    fontWeight: "600",
    fontSize: 14,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: "white",
    fontSize: 9,
    fontWeight: "600",
  },
  appointmentServiceType: {
    fontWeight: "500",
    opacity: 0.8,
  },
  appointmentDateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  appointmentDate: {
    opacity: 0.7,
  },
});
