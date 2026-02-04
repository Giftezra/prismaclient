import {
  FleetDashboardStats,
  BranchPerformanceData,
  SpendTrendsData,
  VehicleHealthScoresData,
  BookingActivityData,
  CommonIssueData,
} from "@/app/interfaces/FleetInterfaces";

export const processBranchPerformanceData = (
  analytics: FleetDashboardStats["analytics"]
): Array<{ label: string; value: number; color?: string }> => {
  if (!analytics?.branch_performance) return [];
  
  const data = analytics.branch_performance
    .filter((item) => item.total_spend > 0 || item.booking_count > 0)
    .map((item) => ({
      label: item.branch_name,
      value: item.total_spend,
    }));
  
  // Only return if there's at least one non-zero value
  return data.some((item) => item.value > 0) ? data : [];
};

export const processSpendTrendsData = (
  analytics: FleetDashboardStats["analytics"]
): Array<{ label: string; data: Array<{ label: string; value: number }>; color?: string }> => {
  if (!analytics?.spend_trends) return [];
  
  const trends = analytics.spend_trends;
  const branchIds = Object.keys(trends);
  
  if (branchIds.length === 0) return [];
  
  // Get all unique dates
  const allDates = new Set<string>();
  branchIds.forEach((branchId) => {
    trends[branchId].data.forEach((point) => {
      allDates.add(point.date);
    });
  });
  
  const sortedDates = Array.from(allDates).sort();
  
  // Create series for each branch
  const colors = ["#8B5CF6", "#10B981", "#F59E0B", "#EF4444", "#3B82F6"];
  
  const series = branchIds.map((branchId, index) => {
    const branchData = trends[branchId];
    const dataMap = new Map(
      branchData.data.map((point) => [point.date, point.value])
    );
    
    const data = sortedDates.map((date) => ({
      label: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value: dataMap.get(date) || 0,
    }));
    
    return {
      label: branchData.branch_name,
      data,
      color: colors[index % colors.length],
    };
  });
  
  // Filter out series with no data (all values are 0)
  const filteredSeries = series.filter((s) => s.data.some((d) => d.value > 0));
  
  // Only return if there's at least one series with data
  return filteredSeries.length > 0 ? filteredSeries : [];
};

export const processHealthScoresData = (
  analytics: FleetDashboardStats["analytics"]
): Array<{ label: string; value: number; color?: string }> => {
  if (!analytics?.vehicle_health_scores?.by_branch) return [];
  
  const byBranch = analytics.vehicle_health_scores.by_branch;
  const branchIds = Object.keys(byBranch);
  
  const data = branchIds
    .map((branchId) => {
      const branchData = byBranch[branchId];
      if (branchData.avg_score === null || branchData.inspection_count === 0) return null;
      
      return {
        label: branchData.branch_name,
        value: branchData.avg_score,
      };
    })
    .filter((item): item is { label: string; value: number } => item !== null);
  
  // Only return if there's at least one valid score
  return data.length > 0 ? data : [];
};

export const processBookingActivityData = (
  analytics: FleetDashboardStats["analytics"]
): Array<{ label: string; value: number; color: string }> => {
  if (!analytics?.booking_activity) return [];
  
  const activity = analytics.booking_activity;
  const statusCounts: { [key: string]: number } = {};
  
  Object.values(activity).forEach((branchData) => {
    Object.entries(branchData.by_status).forEach(([status, count]) => {
      statusCounts[status] = (statusCounts[status] || 0) + count;
    });
  });
  
  const colors: { [key: string]: string } = {
    completed: "#10B981",
    in_progress: "#F59E0B",
    scheduled: "#3B82F6",
    confirmed: "#8B5CF6",
    pending: "#6B7280",
    cancelled: "#EF4444",
  };
  
  const data = Object.entries(statusCounts)
    .filter(([_, count]) => count > 0)
    .map(([status, count]) => ({
      label: status.charAt(0).toUpperCase() + status.slice(1).replace("_", " "),
      value: count,
      color: colors[status] || "#6B7280",
    }));
  
  // Only return if there's at least one booking with a status
  return data.length > 0 ? data : [];
};

export const processCommonIssuesData = (
  analytics: FleetDashboardStats["analytics"]
): Array<{ label: string; value: number; color?: string }> => {
  if (!analytics?.common_issues) return [];
  
  const colors = ["#EF4444", "#F59E0B", "#3B82F6", "#8B5CF6", "#10B981"];
  
  const data = analytics.common_issues
    .filter((issue) => issue.count > 0)
    .map((issue, index) => ({
      label: issue.type,
      value: issue.count,
      color: colors[index % colors.length],
    }));
  
  // Only return if there's at least one issue
  return data.length > 0 ? data : [];
};
