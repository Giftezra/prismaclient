import React, { useState, useMemo } from "react";
import {
  StyleSheet,
  ScrollView,
  View,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { router } from "expo-router";
import { useThemeColor } from "@/hooks/useThemeColor";
import { Ionicons } from "@expo/vector-icons";
import StyledText from "@/app/components/helpers/StyledText";
import { useAppSelector, RootState } from "@/app/store/main_store";
import StatsSection from "@/app/components/dashboard/StatsSection";
import DateRangePicker from "@/app/components/dashboard/DateRangePicker";
import ChartContainer from "@/app/components/dashboard/charts/ChartContainer";
import BarChart from "@/app/components/dashboard/charts/BarChart";
import LineChart from "@/app/components/dashboard/charts/LineChart";
import PieChart from "@/app/components/dashboard/charts/PieChart";
import HealthScoreGauge from "@/app/components/dashboard/charts/HealthScoreGauge";
import {
  useGetFleetDashboardQuery,
  useGetBranchesQuery,
} from "@/app/store/api/fleetApi";
import { StatCard } from "@/app/interfaces/DashboardInterfaces";
import { formatCurrency } from "@/app/utils/methods";
import {
  processBranchPerformanceData,
  processSpendTrendsData,
  processHealthScoresData,
  processBookingActivityData,
  processCommonIssuesData,
} from "@/app/utils/fleetDashboardUtils";

const FleetDashboardScreen = () => {
  const backgroundColor = useThemeColor({}, "background");
  const cardColor = useThemeColor({}, "cards");
  const textColor = useThemeColor({}, "text");
  const borderColor = useThemeColor({}, "borders");
  const primaryColor = useThemeColor({}, "primary");
  const buttonColor = useThemeColor({}, "button");

  // Date range state (default: last 30 days)
  const [endDate, setEndDate] = useState(new Date());
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date;
  });

  // Format dates for API
  const formatDateForAPI = (date: Date): string => {
    return date.toISOString().split("T")[0];
  };

  const user = useAppSelector((state: RootState) => state.auth.user);
  const {
    data: dashboardData,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useGetFleetDashboardQuery({
    start_date: formatDateForAPI(startDate),
    end_date: formatDateForAPI(endDate),
  });
  const { data: branchesData } = useGetBranchesQuery();

  const handleRefresh = () => {
    refetch();
  };

  // Process chart data
  const branchPerformanceData = useMemo(
    () => processBranchPerformanceData(dashboardData?.analytics),
    [dashboardData?.analytics]
  );

  const spendTrendsData = useMemo(
    () => processSpendTrendsData(dashboardData?.analytics),
    [dashboardData?.analytics]
  );

  const healthScoresData = useMemo(
    () => processHealthScoresData(dashboardData?.analytics),
    [dashboardData?.analytics]
  );

  const bookingActivityData = useMemo(
    () => processBookingActivityData(dashboardData?.analytics),
    [dashboardData?.analytics]
  );

  const commonIssuesData = useMemo(
    () => processCommonIssuesData(dashboardData?.analytics),
    [dashboardData?.analytics]
  );

  if (isLoading && !dashboardData) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor }]}>
        <ActivityIndicator size="large" color={primaryColor} />
        <StyledText children="Loading fleet dashboard..." variant="bodyMedium" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.errorContainer, { backgroundColor }]}>
        <StyledText children="Error loading dashboard" variant="bodyMedium" />
        <Pressable
          style={[styles.retryButton, { backgroundColor: buttonColor }]}
          onPress={handleRefresh}
        >
          <StyledText children="Retry" variant="bodyMedium" />
        </Pressable>
      </View>
    );
  }

  // Prepare stats for StatsSection
  const stats: StatCard[] = dashboardData
    ? [
        {
          icon: "car",
          value: dashboardData.stats.total_vehicles.toString(),
          label: "Total Vehicles",
          color: primaryColor,
        },
        {
          icon: "calendar",
          value: dashboardData.stats.total_bookings.toString(),
          label: "Total Bookings",
          color: primaryColor,
        },
        {
          icon: "business",
          value: dashboardData.stats.total_branches.toString(),
          label: "Branches",
          color: primaryColor,
        },
      ]
    : [];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={isFetching} onRefresh={handleRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <StyledText
          variant="titleLarge"
          style={[styles.headerTitle, { color: textColor }]}
        >
          Fleet Dashboard
        </StyledText>
        {dashboardData && (
          <StyledText
            variant="bodyMedium"
            style={[styles.fleetName, { color: textColor }]}
          >
            {dashboardData.fleet.name}
          </StyledText>
        )}
      </View>

      {/* Date Range Picker */}
      <DateRangePicker
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
      />

      {/* Stats Section */}
      {stats.length > 0 && <StatsSection stats={stats} />}

      {/* Quick Actions */}
      <View style={styles.quickActionsSection}>
        <StyledText
          variant="labelMedium"
          style={[styles.sectionTitle, { color: textColor }]}
        >
          Quick Actions
        </StyledText>
        <View style={styles.quickActionsGrid}>
          <TouchableOpacity
            style={[styles.quickActionButton, { backgroundColor: cardColor, borderColor }]}
            onPress={() => router.push("/main/(tabs)/dashboard/BranchManagementScreen")}
          >
            <Ionicons name="business" size={24} color={primaryColor} />
            <StyledText
              variant="bodyMedium"
              style={[styles.quickActionText, { color: textColor }]}
            >
              Manage Branches
            </StyledText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickActionButton, { backgroundColor: cardColor, borderColor }]}
            onPress={() => router.push("/main/(tabs)/dashboard/CreateBranchAdminScreen")}
          >
            <Ionicons name="person-add" size={24} color={primaryColor} />
            <StyledText
              variant="bodyMedium"
              style={[styles.quickActionText, { color: textColor }]}
            >
              Create Admin
            </StyledText>
          </TouchableOpacity>
        </View>
      </View>

      {/* Analytics Charts */}
      {dashboardData?.analytics && (
        <>
          {/* Branch Performance Chart */}
          {branchPerformanceData.length > 0 && (
            <ChartContainer
              title="Branch Performance (Spend)"
              onRefresh={handleRefresh}
              isLoading={isFetching}
            >
              <BarChart data={branchPerformanceData} height={250} showValues={true} />
            </ChartContainer>
          )}

          {/* Spend Trends Chart */}
          {spendTrendsData.length > 0 && (
            <ChartContainer
              title="Spend Trends Over Time"
              onRefresh={handleRefresh}
              isLoading={isFetching}
            >
              <LineChart data={spendTrendsData} height={250} showDots={true} showLegend={true} />
            </ChartContainer>
          )}

          {/* Vehicle Health Scores */}
          {healthScoresData.length > 0 && (
            <ChartContainer
              title="Vehicle Health Scores by Branch"
              onRefresh={handleRefresh}
              isLoading={isFetching}
            >
              <BarChart data={healthScoresData} height={250} showValues={true} />
            </ChartContainer>
          )}

          {/* Booking Activity */}
          {bookingActivityData.length > 0 && (
            <ChartContainer
              title="Booking Activity by Status"
              onRefresh={handleRefresh}
              isLoading={isFetching}
            >
              <PieChart data={bookingActivityData} size={200} showLegend={true} />
            </ChartContainer>
          )}

          {/* Common Issues */}
          {commonIssuesData.length > 0 && (
            <ChartContainer
              title="Common Vehicle Issues"
              onRefresh={handleRefresh}
              isLoading={isFetching}
            >
              <BarChart
                data={commonIssuesData}
                height={200}
                showValues={true}
                horizontal={true}
              />
            </ChartContainer>
          )}
        </>
      )}

      {/* Branches List */}
      {dashboardData && dashboardData.branches.length > 0 && (
        <View style={styles.branchesSection}>
          <StyledText
            variant="labelMedium"
            style={[styles.sectionTitle, { color: textColor }]}
          >
            Branches
          </StyledText>
          {dashboardData.branches.map((branch) => (
            <Pressable
              key={branch.id}
              style={[styles.branchCard, { backgroundColor: cardColor, borderColor }]}
              onPress={() => {
                router.push({
                  pathname: "/main/(tabs)/dashboard/BranchManagementScreen",
                  params: { branchId: branch.id },
                });
              }}
            >
              <View style={styles.branchHeader}>
                <Ionicons name="location" size={20} color={primaryColor} />
                <StyledText
                  variant="titleMedium"
                  style={[styles.branchName, { color: textColor }]}
                >
                  {branch.name}
                </StyledText>
              </View>
              {branch.city && (
                <StyledText
                  variant="bodySmall"
                  style={[styles.branchLocation, { color: textColor }]}
                >
                  {branch.city}
                  {branch.address && `, ${branch.address}`}
                </StyledText>
              )}
              <View style={styles.branchStats}>
                <View style={styles.branchStatItem}>
                  <Ionicons name="car" size={16} color={textColor} />
                  <StyledText
                    variant="bodySmall"
                    style={[styles.branchStatText, { color: textColor }]}
                  >
                    {branch.vehicle_count || 0} vehicles
                  </StyledText>
                </View>
                <View style={styles.branchStatItem}>
                  <Ionicons name="calendar" size={16} color={textColor} />
                  <StyledText
                    variant="bodySmall"
                    style={[styles.branchStatText, { color: textColor }]}
                  >
                    {branch.booking_count || 0} bookings
                  </StyledText>
                </View>
              </View>
              {branch.spend_limit != null && branch.spend_limit > 0 ? (
                <StyledText variant="bodySmall" style={{ color: textColor, opacity: 0.85, marginTop: 4 }}>
                  Spent: {formatCurrency(branch.spent ?? 0)} · Left:{" "}
                  {branch.remaining != null ? formatCurrency(branch.remaining) : "—"}
                </StyledText>
              ) : (
                <StyledText variant="bodySmall" style={{ color: textColor, opacity: 0.7, marginTop: 4 }}>
                  No limit
                </StyledText>
              )}
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
};

export default FleetDashboardScreen;

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
  header: {
    padding: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
  },
  fleetName: {
    marginTop: 4,
    opacity: 0.7,
  },
  quickActionsSection: {
    padding: 16,
    paddingTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  quickActionsGrid: {
    flexDirection: "row",
    gap: 12,
  },
  quickActionButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    gap: 8,
  },
  quickActionText: {
    textAlign: "center",
  },
  branchesSection: {
    padding: 16,
    paddingTop: 8,
  },
  branchCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  branchHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  branchName: {
    fontWeight: "600",
  },
  branchLocation: {
    marginBottom: 12,
    opacity: 0.7,
  },
  branchStats: {
    flexDirection: "row",
    gap: 16,
  },
  branchStatItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  branchStatText: {
    fontSize: 12,
  },
});
