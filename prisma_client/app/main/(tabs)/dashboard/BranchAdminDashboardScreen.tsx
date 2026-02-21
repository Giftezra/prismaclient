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
import StyledText from "@/app/components/helpers/StyledText";
import useDashboard from "@/app/app-hooks/useDashboard";
import { useAppSelector, RootState } from "@/app/store/main_store";
import { useGetBranchSpendQuery } from "@/app/store/api/fleetApi";
import { formatCurrency } from "@/app/utils/methods";
import OngoingServiceCard from "@/app/components/dashboard/OngoingServiceCard";
import RecentServicesSection from "@/app/components/dashboard/RecentServicesSection";
import StatsSection from "@/app/components/dashboard/StatsSection";
import UpcomingAppointmentProps from "@/app/interfaces/DashboardInterfaces";

const BranchAdminDashboardScreen = () => {
  const backgroundColor = useThemeColor({}, "background");
  const buttonColor = useThemeColor({}, "button");
  const tintColor = useThemeColor({}, "tint");
  const primaryColor = useThemeColor({}, "primary");
  const borderColor = useThemeColor({}, "borders");
  const textColor = useThemeColor({}, "text");

  const user = useAppSelector((state: RootState) => state.auth.user);
  const branchName = user?.managed_branch?.name || "Branch";
  const cardColor = useThemeColor({}, "cards");

  const { data: branchSpend } = useGetBranchSpendQuery(undefined, {
    skip: !user?.is_branch_admin,
  });
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
              {(appointment.vehicle.licence || appointment.vehicle.registration_number || "")?.toUpperCase()}
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

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor }]}>
        <ActivityIndicator size="large" color={primaryColor} />
        <StyledText children="Loading dashboard..." variant="bodyMedium" />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
      }
    >
      {/* Branch Header */}
      <View style={styles.branchHeader}>
        <StyledText
          variant="titleLarge"
          style={[styles.branchTitle, { color: textColor }]}
        >
          {branchName}
        </StyledText>
        <StyledText
          variant="bodySmall"
          style={[styles.branchSubtitle, { color: textColor }]}
        >
          Branch Admin Dashboard
        </StyledText>
      </View>

      {/* Branch spending (fleet admins only) */}
      {user?.is_branch_admin && (
        <View style={[styles.spendingCard, { backgroundColor: cardColor, borderColor }]}>
          <StyledText variant="titleMedium" style={[styles.spendingCardTitle, { color: textColor }]}>
            Branch spending
          </StyledText>
          {!branchSpend ? (
            <StyledText variant="bodySmall" style={{ color: textColor, opacity: 0.8 }}>
              Loading…
            </StyledText>
          ) : branchSpend.spend_limit == null || branchSpend.spend_limit <= 0 ? (
            <StyledText variant="bodyMedium" style={{ color: textColor, opacity: 0.9 }}>
              No spending limit set for your branch.
            </StyledText>
          ) : (
            <>
              <StyledText variant="labelMedium" style={{ color: textColor, opacity: 0.85, marginBottom: 4 }}>
                {branchSpend.spend_limit_period === "weekly" ? "Weekly" : "Monthly"} limit
              </StyledText>
              <View style={styles.spendingRow}>
                <StyledText variant="bodyMedium" style={{ color: textColor, fontWeight: "600" }}>
                  Spent:
                </StyledText>
                <StyledText variant="bodyMedium" style={{ color: textColor }}>
                  {formatCurrency(branchSpend.spent)}
                </StyledText>
              </View>
              <View style={styles.spendingRow}>
                <StyledText variant="bodyMedium" style={{ color: textColor, fontWeight: "600" }}>
                  Remaining:
                </StyledText>
                <StyledText variant="bodyMedium" style={{ color: textColor }}>
                  {branchSpend.remaining != null ? formatCurrency(branchSpend.remaining) : "—"}
                </StyledText>
              </View>
              {branchSpend.spend_limit > 0 && (
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.min(100, (branchSpend.spent / branchSpend.spend_limit) * 100)}%`,
                        backgroundColor: primaryColor,
                      },
                    ]}
                  />
                </View>
              )}
            </>
          )}
        </View>
      )}

      {/* Ongoing Service Card */}
      {inProgressAppointment && (
        <OngoingServiceCard appointment={inProgressAppointment} />
      )}

      {/* Upcoming Appointments */}
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


      <RecentServicesSection bookings={recentService} />
      <StatsSection stats={stats} />
    </ScrollView>
  );
};

export default BranchAdminDashboardScreen;

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
  branchHeader: {
    padding: 16,
    paddingBottom: 8,
  },
  branchTitle: {
    fontSize: 24,
    fontWeight: "bold",
  },
  branchSubtitle: {
    marginTop: 4,
    opacity: 0.7,
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
  spendingCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  spendingCardTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  spendingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(128,128,128,0.2)",
    marginTop: 8,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
});
