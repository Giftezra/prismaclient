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

import UpcomingAppointmentProps, {
  RecentServicesProps,
} from "../../../interfaces/DashboardInterfaces";
import { MyVehiclesProps } from "@/app/interfaces/GarageInterface";
import OngoingServiceCard from "@/app/components/dashboard/OngoingServiceCard";
import RecentServicesSection from "@/app/components/dashboard/RecentServicesSection";
import StatsSection from "@/app/components/dashboard/StatsSection";
import { FlatList } from "react-native-gesture-handler";
import VehicleCard from "@/app/components/dashboard/VehicleCard";
import StyledText from "@/app/components/helpers/StyledText";
import useDashboard from "@/app/app-hooks/useDashboard";
import AllowNotificationModal from "@/app/components/notification/AllowNotificationModal";
import { usePermissions } from "@/app/app-hooks/usePermissions";
import useVehicles from "@/app/app-hooks/useVehicles";
import ModalServices from "@/app/utils/ModalServices";
import { StatCard } from "@/app/interfaces/DashboardInterfaces";

const image = require("@/assets/images/user_image.jpg");
const vehicleImage = require("@/assets/images/car.jpg");

const DashboardScreen = () => {
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [hasAskedForPermissions, setHasAskedForPermissions] = useState(false);
  const backgroundColor = useThemeColor({}, "background");
  const buttonColor = useThemeColor({}, "button");
  const tintColor = useThemeColor({}, "tint");
  const primaryColor = useThemeColor({}, "primary");
  const borderColor = useThemeColor({}, "borders");

  /* Fetch the neccessary hooks */
  const { vehicles } = useVehicles();
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
  } = useDashboard();

  const { permissionStatus, isLoading: permissionsLoading } = usePermissions();

  // Show notification modal when dashboard loads, but only if notifications are not already granted
  // and we haven't asked for permissions yet in this session
  useEffect(() => {
    if (
      !permissionsLoading &&
      !permissionStatus.notifications.granted &&
      !hasAskedForPermissions
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
  ]);

  /**
   * Render the upcoming appointment date
   * @param appointment - The appointment object of interface {OngoingAppointmentProps}
   * @returns A Pressable component that navigates to the upcoming booking screen
   */
  const renderUpcomingAppointmentDate = (
    appointment: UpcomingAppointmentProps
  ) => {
    return (
      <Pressable
        style={[
          styles.upcomingAppointmentDate,
          { borderColor, backgroundColor },
        ]}
        onPress={() => {
          router.push({
            pathname: "/main/(tabs)/dashboard/UpcomingBookingScreen",
            params: { appointmentId: appointment.appointment_id },
          });
        }}
      >
        <StyledText children={appointment.booking_date} variant="labelSmall" />
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
        <OngoingServiceCard appointment={inProgressAppointment} />

        {/* Display the component that would show how many upcoming appointments a user has */}
        <View style={styles.upcomingAppointmentDateContainer}>
          <StyledText children="Upcoming Appointments" variant="labelLarge" />
          <View style={{ paddingHorizontal: 10, gap: 5 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {appointments.map((appointment) => (
                <View key={appointment.appointment_id}>
                  {renderUpcomingAppointmentDate(appointment)}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>

        {/* Vehicle section */}
        <View style={styles.vehicleSection}>
          <StyledText children="My Vehicles" variant="labelLarge" />
          <FlatList
            data={vehicles}
            renderItem={({ item }) => (
              <VehicleCard
                vehicle={item}
                onPress={() => {
                  router.push({
                    pathname: "/main/(tabs)/garage/GarageScreen",
                    params: { vehicleId: item.id },
                  });
                }}
              />
            )}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            contentContainerStyle={styles.vehicleListContainer}
            ItemSeparatorComponent={() => <View style={{ width: 10 }} />}
          />
        </View>

        <RecentServicesSection bookings={recentService} />

        <StatsSection stats={stats} />
      </ScrollView>

      {/* Notification Permission Modal */}
      <ModalServices
        visible={showNotificationModal}
        onClose={() => setShowNotificationModal(false)}
        component={
          <AllowNotificationModal
            visible={showNotificationModal}
            onClose={() => setShowNotificationModal(false)}
            onPermissionGranted={() => {
              setShowNotificationModal(false);
              setHasAskedForPermissions(true);
            }}
          />
        }
        showCloseButton={true}
        animationType="slide"
        title="Allow Notifications"
        modalType='fullscreen'
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
  upcomingAppointmentDate: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 10,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
  },
  vehicleSection: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 10,
  },
  vehicleListContainer: {
    paddingHorizontal: 10,
  },
});
