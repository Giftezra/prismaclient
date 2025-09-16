import { useCallback, useEffect, useState } from "react";
import UpcomingAppointmentProps from "../interfaces/DashboardInterfaces";
import {
  useFetchOngoingAppointmentsQuery,
  useCancelAppointmentMutation,
  useFetchRecentServicesQuery,
  useFetchUserStatsQuery,
} from "../store/api/dashboardApi";
import { useAlertContext } from "../contexts/AlertContext";
import * as Linking from "expo-linking";
import { StatCard } from "../interfaces/DashboardInterfaces";
import { useThemeColor } from "@/hooks/useThemeColor";
import useWebSocket from "./useWebsocket";
import { router } from "expo-router";

const useDashboard = () => {
  const buttonColor = useThemeColor({}, "button");
  const primaryColor = useThemeColor({}, "primary");

  const {
    data: appointments = [],
    isLoading,
    error,
    refetch: refetchAppointments,
  } = useFetchOngoingAppointmentsQuery();

  const [cancelAppointment, { isLoading: isCancelling }] =
    useCancelAppointmentMutation();

  const {
    data: recentService = null,
    isLoading: isLoadingRecentServices,
    error: recentServicesError,
    refetch: refetchRecentServices,
  } = useFetchRecentServicesQuery();

  const {
    data: userStats = null,
    isLoading: isLoadingUserStats,
    error: userStatsError,
    refetch: refetchUserStats,
  } = useFetchUserStatsQuery();

  const { setAlertConfig, setIsVisible } = useAlertContext();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Find the appointment with "In Progress" status for upcoming appointment
  const inProgressAppointment = appointments.find(
    (appointment) => appointment.status === "in_progress"
  );
  const [upcomingAppointment, setUpcomingAppointment] =
    useState<UpcomingAppointmentProps | null>(inProgressAppointment || null);

  useEffect(() => {
    if (appointments.length > 0) {
      const inProgress = appointments.find(
        (appointment) => appointment.status === "in_progress"
      );
      setUpcomingAppointment(inProgress || appointments[0]); // Fallback to first appointment if no in-progress
    }
  }, [appointments]);

  /* Check for unrated services then set the unratedServices state */
  const [isUnratedServices, setIsUnratedServices] = useState<boolean>(false);
  useEffect(() => {
    if (recentService) {
      setIsUnratedServices(!recentService.is_reviewed);
    }
  }, [recentService]);


  /* Configure the stats */
  const stats: StatCard[] = [
    {
      icon: "calendar",
      value: userStats?.services_this_year?.toString() || "0",
      label: "This Year",
      color: buttonColor,
    },
    {
      icon: "calendar",
      value: userStats?.services_this_month?.toString() || "0",
      label: "This Month",
      color: primaryColor,
    },
  ];

  /**
   * Call the detailer using the phone number. this method will take the user out of the app
   * and into their dialer
   * @param phoneNumber - The phone number to call
   */
  const callDetailer = (phoneNumber: string) => {
    if (!phoneNumber) {
      return;
    }

    setAlertConfig({
      isVisible: true,
      title: "Make a call",
      message: `Are you sure you want to call ${phoneNumber}?`,
      type: "success",
      onConfirm() {
        Linking.openURL(`tel:${phoneNumber}`);
        setIsVisible(false);
      },
      onClose() {
        setIsVisible(false);
      },
    });
  };

  /**
   * Handle the refresh of the screen.
   * When called, simply refetch the appointments
   */
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refetchAppointments();
    await refetchRecentServices();
    await refetchUserStats();
    setIsRefreshing(false);
  }, [refetchAppointments, refetchRecentServices, refetchUserStats]);

  const handleBookingUpdate = useCallback(
    (data: any) => {
      console.log("Booking update received:", data);
      // Trigger dashboard refresh
      handleRefresh();
    },
    [handleRefresh]
  );

  /**
   * Cancel the appointment
   * @param {appointmentId} - The id of the appointment to cancel
   */
  const handleCancelAppointment = useCallback(
    async (appointmentId: string) => {
      if (!appointmentId) {
        return;
      }
      try {
        setAlertConfig({
          isVisible: true,
          title: "Cancelling Appointment",
          message:
            "You are about to cancel your appointment.\nIs there there something you would like to change?",
          type: "warning",
          onConfirm: async () => {
            setIsVisible(false);
            const response = await cancelAppointment({
              appointmentId,
            }).unwrap();
            if (response && response.message) {
              setAlertConfig({
                isVisible: true,
                title: "Appointment Cancelled",
                message: response.message,
                type: "success",
                onConfirm() {
                  refetchAppointments();
                  router.push("/main/(tabs)/dashboard/DashboardScreen");
                  setIsVisible(false);
                },
              });
            }
          },
          onClose() {
            setIsVisible(false);
          },
        });
      } catch (error: any) {
        let message = "Failed to cancel appointment";
        if (error.data && error.data.message) {
          message = error.data.message;
        }
        setAlertConfig({
          isVisible: true,
          title: "Error",
          message: message,
          type: "error",
          onConfirm() {
            setIsVisible(false);
          },
        });
      }
    },
    [cancelAppointment, refetchAppointments, setAlertConfig, setIsVisible]
  );

  useWebSocket(handleBookingUpdate);

  return {
    inProgressAppointment,
    appointments,
    upcomingAppointment,
    isLoading,
    error,
    refetchAppointments,
    callDetailer,
    handleCancelAppointment,
    isCancelling,
    recentService,
    isLoadingRecentServices,
    recentServicesError,
    refetchRecentServices,
    userStats,
    isLoadingUserStats,
    userStatsError,
    refetchUserStats,
    stats,
    handleRefresh,
    isRefreshing,
    isUnratedServices,
  };
};

export default useDashboard;
