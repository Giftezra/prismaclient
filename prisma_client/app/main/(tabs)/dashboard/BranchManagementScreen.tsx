import React, { useState, useMemo } from "react";
import {
  StyleSheet,
  ScrollView,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Alert,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useThemeColor } from "@/hooks/useThemeColor";
import { Ionicons } from "@expo/vector-icons";
import StyledText from "@/app/components/helpers/StyledText";
import {
  useGetBranchesQuery,
  useCreateBranchMutation,
  useUpdateBranchMutation,
  useDeleteBranchMutation,
  useGetBranchVehiclesQuery,
  useGetVehicleBookingsQuery,
  useGetBranchAdminsQuery,
  useGetBranchBulkOrdersQuery,
  useCancelBulkOrderMutation,
  useRescheduleBulkOrderMutation,
} from "@/app/store/api/fleetApi";
import StyledTextInput from "@/app/components/helpers/StyledTextInput";
import AddressSearchInput from "@/app/components/shared/AddressSearchInput";
import { useSubscriptionLimits } from "@/app/hooks/useSubscriptionLimits";
import StyledButton from "@/app/components/helpers/StyledButton";
import { useAlertContext } from "@/app/contexts/AlertContext";
import type { AlertState } from "@/app/contexts/AlertContext";
import { formatCurrency } from "@/app/utils/methods";
import { API_CONFIG } from "@/constants/Config";

const BULK_CUTOFF_HOURS = 12;

/** Compute job start datetime from bulk order order_data. Returns null if not parseable. */
function getBulkOrderJobStart(order: { order_data?: Record<string, unknown> | null }): Date | null {
  const d = order?.order_data ?? undefined;
  if (!d || typeof d !== "object") return null;
  const dateVal = typeof d.date === "string" ? d.date : (d.appointment_date as string);
  const startVal = typeof d.start_time === "string" ? d.start_time : (d.best_start_time as string) || "06:00";
  if (!dateVal || dateVal.length < 10) return null;
  const dateStr = String(dateVal).slice(0, 10);
  const timeStr = String(startVal).length === 5 ? `${startVal}:00` : String(startVal).slice(0, 8);
  try {
    const combined = `${dateStr}T${timeStr}`;
    const dt = new Date(combined);
    return isNaN(dt.getTime()) ? null : dt;
  } catch {
    return null;
  }
}

/** True if cancel/reschedule are allowed (>=12h before job start). */
function canCancelOrRescheduleBulkOrder(order: { order_data?: Record<string, unknown> | null; payment_status?: string }): boolean {
  if (order.payment_status === "cancelled") return false;
  const jobStart = getBulkOrderJobStart(order);
  if (!jobStart) return true;
  const now = new Date();
  const hoursLeft = (jobStart.getTime() - now.getTime()) / (1000 * 60 * 60);
  return hoursLeft >= BULK_CUTOFF_HOURS;
}

const dismissAlert = (setAlertConfig: (config: AlertState) => void) =>
  setAlertConfig({ isVisible: false, title: "", message: "", type: "error" });

// Component to render a vehicle card with booking indicator
const VehicleCard = ({
  vehicle,
  cardColor,
  textColor,
  borderColor,
  primaryColor,
}: {
  vehicle: {
    id: string;
    make: string;
    model: string;
    year: number;
    registration_number: string;
  };
  cardColor: string;
  textColor: string;
  borderColor: string;
  primaryColor: string;
}) => {
  const { data: bookingsData } = useGetVehicleBookingsQuery(
    { vehicle_id: vehicle.id },
    { skip: !vehicle.id },
  );

  // Check if vehicle has upcoming bookings within 7 days
  const hasUpcomingBooking = useMemo(() => {
    if (!bookingsData?.bookings) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(today.getDate() + 7);
    sevenDaysFromNow.setHours(23, 59, 59, 999);

    return bookingsData.bookings.some((booking) => {
      const appointmentDate = new Date(booking.appointment_date);
      appointmentDate.setHours(0, 0, 0, 0);
      const isUpcoming =
        appointmentDate >= today && appointmentDate <= sevenDaysFromNow;
      const isActiveStatus = [
        "confirmed",
        "scheduled",
        "in_progress",
        "pending",
      ].includes(booking.status.toLowerCase());
      return isUpcoming && isActiveStatus;
    });
  }, [bookingsData]);

  const borderColorToUse = hasUpcomingBooking ? "#FFD700" : borderColor;
  const borderWidth = hasUpcomingBooking ? 3 : 1;

  return (
    <TouchableOpacity
      style={[
        styles.vehicleCard,
        {
          backgroundColor: cardColor,
          borderColor: borderColorToUse,
          borderWidth: borderWidth,
        },
      ]}
      onPress={() => {
        router.push({
          pathname: "/main/(tabs)/dashboard/VehicleBookingsScreen",
          params: { vehicleId: vehicle.id },
        });
      }}
    >
      <View style={styles.vehicleCardContent}>
        <View style={styles.vehicleCardHeader}>
          <StyledText
            variant="bodyMedium"
            style={{ color: textColor, fontWeight: "600" }}
          >
            {vehicle.make} {vehicle.model} ({vehicle.year})
          </StyledText>
          {hasUpcomingBooking && (
            <View
              style={[styles.bookingIndicator, { backgroundColor: "#FFD700" }]}
            >
              <Ionicons name="calendar" size={12} color="#000" />
            </View>
          )}
        </View>
        <StyledText
          variant="bodySmall"
          style={{ color: textColor, opacity: 0.7 }}
        >
          {vehicle.registration_number}
        </StyledText>
      </View>
    </TouchableOpacity>
  );
};

const BranchManagementScreen = () => {
  const params = useLocalSearchParams();
  const selectedBranchId = params.branchId as string | undefined;

  const backgroundColor = useThemeColor({}, "background");
  const cardColor = useThemeColor({}, "cards");
  const textColor = useThemeColor({}, "text");
  const borderColor = useThemeColor({}, "borders");
  const primaryColor = useThemeColor({}, "primary");
  const buttonColor = useThemeColor({}, "button");

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingBranch, setEditingBranch] = useState<string | null>(null);
  const [newBranchName, setNewBranchName] = useState("");
  const [newBranchAddress, setNewBranchAddress] = useState("");
  const [newBranchPostcode, setNewBranchPostcode] = useState("");
  const [newBranchCity, setNewBranchCity] = useState("");
  const [newBranchCountry, setNewBranchCountry] = useState("");
  const [newBranchLatitude, setNewBranchLatitude] = useState<
    number | undefined
  >();
  const [newBranchLongitude, setNewBranchLongitude] = useState<
    number | undefined
  >();
  const [capPeriod, setCapPeriod] = useState<"weekly" | "monthly">("monthly");
  const [capAmount, setCapAmount] = useState("");
  const [isSavingCap, setIsSavingCap] = useState(false);
  const [bulkOrdersExpanded, setBulkOrdersExpanded] = useState(false);
  const [expandedBulkOrderId, setExpandedBulkOrderId] = useState<string | null>(
    null,
  );
  const [rescheduleOrder, setRescheduleOrder] = useState<{
    id: string;
    booking_reference: string;
    order_data: Record<string, unknown>;
    number_of_vehicles: number;
  } | null>(null);
  const [rescheduleNewDate, setRescheduleNewDate] = useState<string>("");
  const [rescheduleOptions, setRescheduleOptions] = useState<
    Array<{ window: string; best_start_time: string; estimated_finish_time: string; suggested_team_size: number }> | null
  >(null);
  const [rescheduleSelectedOption, setRescheduleSelectedOption] = useState<{
    window: string;
    best_start_time: string;
    estimated_finish_time: string;
    suggested_team_size: number;
  } | null>(null);
  const [rescheduleSelectedIndex, setRescheduleSelectedIndex] = useState(0);
  const [rescheduleLoading, setRescheduleLoading] = useState(false);

  const [cancelBulkOrder, { isLoading: isCancelling }] = useCancelBulkOrderMutation();
  const [rescheduleBulkOrder, { isLoading: isRescheduling }] = useRescheduleBulkOrderMutation();

  const { setAlertConfig } = useAlertContext();
  const { data: branchesData, refetch: refetchBranches } =
    useGetBranchesQuery();
  const [createBranch, { isLoading: isCreating }] = useCreateBranchMutation();
  const [updateBranch, { isLoading: isUpdating }] = useUpdateBranchMutation();
  const [deleteBranch, { isLoading: isDeleting }] = useDeleteBranchMutation();
  const { limitsReached } = useSubscriptionLimits();

  const branches = branchesData?.branches || [];

  const selectedBranch = branches.find((b) => b.id === selectedBranchId);
  const { data: branchVehiclesData } = useGetBranchVehiclesQuery(
    { branch_id: selectedBranchId || "" },
    { skip: !selectedBranchId },
  );
  const { data: branchBulkOrdersData } = useGetBranchBulkOrdersQuery(
    { branch_id: selectedBranchId || "" },
    { skip: !selectedBranchId },
  );
  const refetchBulkOrders = useGetBranchBulkOrdersQuery(
    { branch_id: selectedBranchId || "" },
    { skip: !selectedBranchId },
  ).refetch;
  const { data: branchAdminsData } = useGetBranchAdminsQuery(
    { branch_id: selectedBranchId || "" },
    { skip: !selectedBranchId },
  );

  const handleBranchAddressSelect = (result: {
    address: string;
    post_code: string;
    city: string;
    country: string;
    latitude: number;
    longitude: number;
  }) => {
    setNewBranchAddress(result.address);
    setNewBranchPostcode(result.post_code);
    setNewBranchCity(result.city);
    setNewBranchCountry(result.country);
    setNewBranchLatitude(result.latitude);
    setNewBranchLongitude(result.longitude);
  };

  const clearBranchForm = () => {
    setNewBranchName("");
    setNewBranchAddress("");
    setNewBranchPostcode("");
    setNewBranchCity("");
    setNewBranchCountry("");
    setNewBranchLatitude(undefined);
    setNewBranchLongitude(undefined);
  };

  const handleCreateBranch = async () => {
    if (!newBranchName.trim()) {
      setAlertConfig({
        isVisible: true,
        title: "Error",
        message: "Branch name is required",
        type: "error",
        onConfirm: () => dismissAlert(setAlertConfig),
      });
      return;
    }

    try {
      await createBranch({
        name: newBranchName.trim(),
        address: newBranchAddress.trim() || undefined,
        postcode: newBranchPostcode.trim() || undefined,
        city: newBranchCity.trim() || undefined,
        country: newBranchCountry.trim() || undefined,
        latitude: newBranchLatitude,
        longitude: newBranchLongitude,
      }).unwrap();

      setShowCreateForm(false);
      clearBranchForm();
      refetchBranches();
      setAlertConfig({
        isVisible: true,
        title: "Success",
        message: "Branch created successfully",
        type: "success",
        onConfirm: () => dismissAlert(setAlertConfig),
      });
    } catch (error: unknown) {
      const err = error as { data?: { error?: string } };
      setAlertConfig({
        isVisible: true,
        title: "Error",
        message: err?.data?.error || "Failed to create branch",
        type: "error",
        onConfirm: () => dismissAlert(setAlertConfig),
      });
    }
  };

  const handleUpdateBranch = async (branchId: string) => {
    const branch = branches.find((b) => b.id === branchId);
    if (!branch) return;

    try {
      await updateBranch({
        branch_id: branchId,
        name: newBranchName.trim() || branch.name,
        address: newBranchAddress.trim() || branch.address,
        postcode: newBranchPostcode.trim() || branch.postcode,
        city: newBranchCity.trim() || branch.city,
        country: newBranchCountry.trim() || branch.country,
        latitude: newBranchLatitude,
        longitude: newBranchLongitude,
      }).unwrap();

      setEditingBranch(null);
      clearBranchForm();
      refetchBranches();
      setAlertConfig({
        isVisible: true,
        title: "Success",
        message: "Branch updated successfully",
        type: "success",
        onConfirm: () => dismissAlert(setAlertConfig),
      });
    } catch (error: unknown) {
      const err = error as { data?: { error?: string } };
      setAlertConfig({
        isVisible: true,
        title: "Error",
        message: err?.data?.error || "Failed to update branch",
        type: "error",
        onConfirm: () => dismissAlert(setAlertConfig),
      });
    }
  };

  const handleDeleteBranch = (branchId: string, branchName: string) => {
    setAlertConfig({
      isVisible: true,
      title: "Delete Branch",
      message: `Are you sure you want to delete ${branchName}? This action cannot be undone.`,
      type: "warning",
      onClose: () => dismissAlert(setAlertConfig),
      onConfirm: async () => {
        try {
          await deleteBranch({ branch_id: branchId }).unwrap();
          refetchBranches();
          dismissAlert(setAlertConfig);
          setAlertConfig({
            isVisible: true,
            title: "Success",
            message: "Branch deleted successfully",
            type: "success",
            onConfirm: () => dismissAlert(setAlertConfig),
          });
        } catch (error: unknown) {
          const err = error as { data?: { error?: string } };
          dismissAlert(setAlertConfig);
          setAlertConfig({
            isVisible: true,
            title: "Error",
            message: err?.data?.error || "Failed to delete branch",
            type: "error",
            onConfirm: () => dismissAlert(setAlertConfig),
          });
        }
      },
    });
  };

  const startEditing = (branch: (typeof branches)[0]) => {
    setEditingBranch(branch.id);
    setNewBranchName(branch.name || "");
    setNewBranchAddress(branch.address || "");
    setNewBranchPostcode(branch.postcode || "");
    setNewBranchCity(branch.city || "");
    setNewBranchCountry(branch.country || "");
    setNewBranchLatitude(branch.latitude ?? undefined);
    setNewBranchLongitude(branch.longitude ?? undefined);
  };

  const cancelEditing = () => {
    setEditingBranch(null);
    clearBranchForm();
  };

  const handleSaveCap = async (branchId: string) => {
    const parsed = parseFloat(capAmount);
    if (isNaN(parsed) || parsed < 0) {
      setAlertConfig({
        isVisible: true,
        title: "Error",
        message: "Enter a valid spend limit (0 or greater).",
        type: "error",
        onConfirm: () => dismissAlert(setAlertConfig),
      });
      return;
    }
    setIsSavingCap(true);
    try {
      await updateBranch({
        branch_id: branchId,
        spend_limit: parsed,
        spend_limit_period: capPeriod,
      }).unwrap();
      setCapAmount("");
      refetchBranches();
      setAlertConfig({
        isVisible: true,
        title: "Success",
        message: "Spending cap updated.",
        type: "success",
        onConfirm: () => dismissAlert(setAlertConfig),
      });
    } catch (error: unknown) {
      const err = error as { data?: { error?: string } };
      setAlertConfig({
        isVisible: true,
        title: "Error",
        message: err?.data?.error || "Failed to update cap",
        type: "error",
        onConfirm: () => dismissAlert(setAlertConfig),
      });
    } finally {
      setIsSavingCap(false);
    }
  };

  const handleRevertCap = async (branchId: string) => {
    setIsSavingCap(true);
    try {
      await updateBranch({
        branch_id: branchId,
        spend_limit: 0,
      }).unwrap();
      setCapAmount("");
      refetchBranches();
      setAlertConfig({
        isVisible: true,
        title: "Success",
        message: "Spending limit removed.",
        type: "success",
        onConfirm: () => dismissAlert(setAlertConfig),
      });
    } catch (error: unknown) {
      const err = error as { data?: { error?: string } };
      setAlertConfig({
        isVisible: true,
        title: "Error",
        message: err?.data?.error || "Failed to remove limit",
        type: "error",
        onConfirm: () => dismissAlert(setAlertConfig),
      });
    } finally {
      setIsSavingCap(false);
    }
  };

  const handleCancelBulkOrder = (order: {
    id: string;
    booking_reference?: string;
    order_data?: Record<string, unknown> | null;
    payment_status?: string;
  }) => {
    if (!canCancelOrRescheduleBulkOrder(order)) return;
    Alert.alert(
      "Cancel bulk order",
      "Cancel this bulk order? You will receive a full refund.",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, cancel",
          style: "destructive",
          onPress: async () => {
            try {
              const res = await cancelBulkOrder({
                bulk_order_id: order.id,
                booking_reference: order.booking_reference,
              }).unwrap();
              refetchBulkOrders();
              setAlertConfig({
                isVisible: true,
                title: "Order cancelled",
                message: res.message || "Full refund will be processed.",
                type: "success",
                onConfirm: () => dismissAlert(setAlertConfig),
              });
            } catch (err: unknown) {
              const e = err as { data?: { error?: string } };
              setAlertConfig({
                isVisible: true,
                title: "Error",
                message: e?.data?.error || "Failed to cancel order",
                type: "error",
                onConfirm: () => dismissAlert(setAlertConfig),
              });
            }
          },
        },
      ],
    );
  };

  const openRescheduleModal = (order: {
    id: string;
    booking_reference?: string;
    order_data?: Record<string, unknown> | null;
    number_of_vehicles?: number;
  }) => {
    setRescheduleOrder({
      id: order.id,
      booking_reference: order.booking_reference || "",
      order_data: (order.order_data as Record<string, unknown>) || {},
      number_of_vehicles: order.number_of_vehicles || 0,
    });
    setRescheduleNewDate("");
    setRescheduleOptions(null);
    setRescheduleSelectedOption(null);
    setRescheduleSelectedIndex(0);
  };

  const checkRescheduleCapacity = async () => {
    if (!rescheduleOrder || !rescheduleNewDate.trim()) {
      setAlertConfig({
        isVisible: true,
        title: "Error",
        message: "Please enter a new date.",
        type: "error",
        onConfirm: () => dismissAlert(setAlertConfig),
      });
      return;
    }
    const d = rescheduleOrder.order_data;
    const address = d?.address as { city?: string; country?: string; latitude?: number; longitude?: number } | undefined;
    const service = d?.service_type as { duration?: number } | undefined;
    const duration = service?.duration ?? 60;
    const workloadMinutes = rescheduleOrder.number_of_vehicles * duration;
    const city = address?.city ?? "";
    const country = address?.country ?? "Ireland";
    setRescheduleLoading(true);
    setRescheduleOptions(null);
    try {
      const url = new URL(
        `${API_CONFIG.detailerAppUrl}/api/v1/availability/check_bulk_capacity/`,
      );
      url.searchParams.append("date", rescheduleNewDate.trim().slice(0, 10));
      url.searchParams.append("workload_minutes", String(workloadMinutes));
      url.searchParams.append("service_duration", String(duration));
      url.searchParams.append("country", country);
      url.searchParams.append("city", city);
      if (address?.latitude != null && address?.longitude != null) {
        url.searchParams.append("latitude", String(address.latitude));
        url.searchParams.append("longitude", String(address.longitude));
      }
      const response = await fetch(url.toString(), { method: "GET", headers: { "Content-Type": "application/json" } });
      const data = await response.json();
      if (data.error || !data.available) {
        setAlertConfig({
          isVisible: true,
          title: "No capacity",
          message: data.error || "No availability for this date. Try another.",
          type: "error",
          onConfirm: () => dismissAlert(setAlertConfig),
        });
        return;
      }
      if (data.options && data.options.length > 0) {
        setRescheduleOptions(data.options);
        setRescheduleSelectedOption(data.options[0]);
        setRescheduleSelectedIndex(0);
      } else {
        setAlertConfig({
          isVisible: true,
          title: "No capacity",
          message: "No time options for this date.",
          type: "error",
          onConfirm: () => dismissAlert(setAlertConfig),
        });
      }
    } catch (e) {
      setAlertConfig({
        isVisible: true,
        title: "Error",
        message: "Unable to check availability.",
        type: "error",
        onConfirm: () => dismissAlert(setAlertConfig),
      });
    } finally {
      setRescheduleLoading(false);
    }
  };

  const confirmReschedule = async () => {
    const selected = rescheduleOptions?.[rescheduleSelectedIndex] ?? rescheduleSelectedOption;
    if (!rescheduleOrder || !rescheduleNewDate.trim() || !selected) return;
    try {
      await rescheduleBulkOrder({
        bulk_order_id: rescheduleOrder.id,
        booking_reference: rescheduleOrder.booking_reference || undefined,
        new_date: rescheduleNewDate.trim().slice(0, 10),
        start_time: selected.best_start_time,
        end_time: selected.estimated_finish_time,
        number_of_vehicles: rescheduleOrder.number_of_vehicles,
        suggested_team_size: selected.suggested_team_size,
      }).unwrap();
      setRescheduleOrder(null);
      refetchBulkOrders();
      setAlertConfig({
        isVisible: true,
        title: "Rescheduled",
        message: "Bulk order rescheduled successfully.",
        type: "success",
        onConfirm: () => dismissAlert(setAlertConfig),
      });
    } catch (err: unknown) {
      const e = err as { data?: { error?: string } };
      setAlertConfig({
        isVisible: true,
        title: "Error",
        message: e?.data?.error || "Failed to reschedule",
        type: "error",
        onConfirm: () => dismissAlert(setAlertConfig),
      });
    }
  };

  if (selectedBranchId && selectedBranch) {
    // Show branch detail view
    return (
      <ScrollView
        style={[styles.container, { backgroundColor }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={textColor} />
          </TouchableOpacity>
          <StyledText
            variant="titleLarge"
            style={[styles.title, { color: textColor }]}
          >
            {selectedBranch.name}
          </StyledText>
        </View>

        {/* Branch Managers Section */}
        {branchAdminsData &&
          branchAdminsData.admins &&
          branchAdminsData.admins.length > 0 && (
            <View
              style={[
                styles.branchDetailCard,
                { backgroundColor: cardColor, borderColor },
              ]}
            >
              <StyledText
                variant="titleMedium"
                style={[
                  styles.sectionTitle,
                  { color: textColor, marginBottom: 12 },
                ]}
              >
                Branch Managers
              </StyledText>
              {branchAdminsData.admins.map((admin) => (
                <View
                  key={admin.id}
                  style={[styles.adminCard, { borderColor }]}
                >
                  <View style={styles.adminInfo}>
                    <StyledText
                      variant="bodyLarge"
                      style={{ color: textColor, fontWeight: "600" }}
                    >
                      {admin.name}
                    </StyledText>
                    <StyledText
                      variant="bodySmall"
                      style={{ color: textColor, opacity: 0.7 }}
                    >
                      {admin.email}
                    </StyledText>
                    {admin.phone && (
                      <StyledText
                        variant="bodySmall"
                        style={{ color: textColor, opacity: 0.7 }}
                      >
                        {admin.phone}
                      </StyledText>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}

        <View
          style={[
            styles.branchDetailCard,
            { backgroundColor: cardColor, borderColor },
          ]}
        >
          <View style={styles.detailRow}>
            <StyledText
              variant="bodyMedium"
              style={{ color: textColor, fontWeight: "600" }}
            >
              Address:
            </StyledText>
            <StyledText variant="bodyMedium" style={{ color: textColor }}>
              {selectedBranch.address || "N/A"}
            </StyledText>
          </View>
          <View style={styles.detailRow}>
            <StyledText
              variant="bodyMedium"
              style={{ color: textColor, fontWeight: "600" }}
            >
              City:
            </StyledText>
            <StyledText variant="bodyMedium" style={{ color: textColor }}>
              {selectedBranch.city || "N/A"}
            </StyledText>
          </View>
          <View style={styles.detailRow}>
            <StyledText
              variant="bodyMedium"
              style={{ color: textColor, fontWeight: "600" }}
            >
              Postcode:
            </StyledText>
            <StyledText variant="bodyMedium" style={{ color: textColor }}>
              {selectedBranch.postcode || "N/A"}
            </StyledText>
          </View>
          <View style={styles.detailRow}>
            <StyledText
              variant="bodyMedium"
              style={{ color: textColor, fontWeight: "600" }}
            >
              Vehicles:
            </StyledText>
            <StyledText variant="bodyMedium" style={{ color: textColor }}>
              {selectedBranch.vehicle_count || 0}
            </StyledText>
          </View>
          <View style={styles.detailRow}>
            <StyledText
              variant="bodyMedium"
              style={{ color: textColor, fontWeight: "600" }}
            >
              Admins:
            </StyledText>
            <StyledText variant="bodyMedium" style={{ color: textColor }}>
              {selectedBranch.admin_count || 0}
            </StyledText>
          </View>
        </View>

        <View
          style={[
            styles.branchDetailCard,
            { backgroundColor: cardColor, borderColor },
          ]}
        >
          <StyledText
            variant="titleMedium"
            style={[styles.sectionTitle, { color: textColor }]}
          >
            Spending cap
          </StyledText>
          {selectedBranch.spend_limit != null &&
          selectedBranch.spend_limit > 0 ? (
            <>
              <View style={styles.detailRow}>
                <StyledText
                  variant="bodyMedium"
                  style={{ color: textColor, fontWeight: "600" }}
                >
                  Spent (
                  {selectedBranch.spend_limit_period === "weekly"
                    ? "this week"
                    : "this month"}
                  ):
                </StyledText>
                <StyledText variant="bodyMedium" style={{ color: textColor }}>
                  {formatCurrency(selectedBranch.spent ?? 0)}
                </StyledText>
              </View>
              <View style={styles.detailRow}>
                <StyledText
                  variant="bodyMedium"
                  style={{ color: textColor, fontWeight: "600" }}
                >
                  Remaining:
                </StyledText>
                <StyledText variant="bodyMedium" style={{ color: textColor }}>
                  {selectedBranch.remaining != null
                    ? formatCurrency(selectedBranch.remaining)
                    : "—"}
                </StyledText>
              </View>
              <TouchableOpacity
                style={[styles.revertCapButton, { borderColor }]}
                onPress={() => handleRevertCap(selectedBranch.id)}
                disabled={isSavingCap}
              >
                <Ionicons
                  name="remove-circle-outline"
                  size={18}
                  color={textColor}
                />
                <StyledText variant="bodySmall" style={{ color: textColor }}>
                  Remove limit
                </StyledText>
              </TouchableOpacity>
            </>
          ) : (
            <StyledText
              variant="bodyMedium"
              style={{ color: textColor, marginBottom: 12 }}
            >
              No spending limit set.
            </StyledText>
          )}
          <View style={styles.capForm}>
            <StyledText
              variant="labelMedium"
              style={{ color: textColor, marginBottom: 8 }}
            >
              Set cap
            </StyledText>
            <View style={[styles.capPeriodRow, { borderColor }]}>
              <TouchableOpacity
                style={[
                  styles.capPeriodOption,
                  capPeriod === "weekly" && { backgroundColor: primaryColor },
                  { borderColor },
                ]}
                onPress={() => setCapPeriod("weekly")}
              >
                <StyledText
                  variant="bodySmall"
                  style={{ color: capPeriod === "weekly" ? "#fff" : textColor }}
                >
                  Weekly
                </StyledText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.capPeriodOption,
                  capPeriod === "monthly" && { backgroundColor: primaryColor },
                  { borderColor },
                ]}
                onPress={() => setCapPeriod("monthly")}
              >
                <StyledText
                  variant="bodySmall"
                  style={{
                    color: capPeriod === "monthly" ? "#fff" : textColor,
                  }}
                >
                  Monthly
                </StyledText>
              </TouchableOpacity>
            </View>
            <StyledTextInput
              label="Spend limit"
              value={capAmount}
              onChangeText={setCapAmount}
              placeholder="0"
              keyboardType="decimal-pad"
              placeholderTextColor="#999999"
            />
            <View style={styles.capFormButtons}>
              <StyledButton
                title="Save cap"
                variant="small"
                onPress={() => handleSaveCap(selectedBranch.id)}
                disabled={isSavingCap || !capAmount.trim()}
                isLoading={isSavingCap}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>

        {/* Bulk orders – pressable dropdown */}
        <View
          style={[
            styles.branchDetailCard,
            { backgroundColor: cardColor, borderColor },
          ]}
        >
          <TouchableOpacity
            style={styles.bulkOrdersHeader}
            onPress={() => setBulkOrdersExpanded(!bulkOrdersExpanded)}
            activeOpacity={0.7}
          >
            <StyledText
              variant="titleMedium"
              style={{ color: textColor, fontWeight: "600" }}
            >
              Bulk orders
            </StyledText>
            <Ionicons
              name={bulkOrdersExpanded ? "chevron-up" : "chevron-down"}
              size={22}
              color={textColor}
            />
          </TouchableOpacity>

          {/* Expanded bulk orders list – scrollable with max height */}
          {bulkOrdersExpanded && (
            <View style={styles.bulkOrdersListContainer}>
              {!branchBulkOrdersData?.bulk_orders?.length ? (
                <StyledText
                  variant="bodyMedium"
                  style={{ color: textColor, opacity: 0.8 }}
                >
                  No bulk orders for this branch.
                </StyledText>
              ) : (
                <ScrollView
                  style={styles.bulkOrdersScrollView}
                  contentContainerStyle={styles.bulkOrdersScrollContent}
                  nestedScrollEnabled
                >
                  {branchBulkOrdersData.bulk_orders.map((order) => (
                    <View
                      key={order.id}
                      style={[styles.bulkOrderItem, { borderColor }]}
                    >
                      <TouchableOpacity
                        style={styles.bulkOrderRefRow}
                        onPress={() =>
                          setExpandedBulkOrderId((id) =>
                            id === order.id ? null : order.id,
                          )
                        }
                        activeOpacity={0.7}
                      >
                        <StyledText
                          variant="bodyMedium"
                          style={{ color: primaryColor, fontWeight: "600" }}
                        >
                          {order.booking_reference || order.id}
                        </StyledText>
                        <Ionicons
                          name={
                            expandedBulkOrderId === order.id
                              ? "chevron-up"
                              : "chevron-down"
                          }
                          size={18}
                          color={textColor}
                        />
                      </TouchableOpacity>
                      {expandedBulkOrderId === order.id && (
                        <View style={[styles.bulkOrderDetail, { borderColor }]}>
                          <View style={styles.detailRow}>
                            <StyledText
                              variant="bodySmall"
                              style={{ color: textColor, fontWeight: "600" }}
                            >
                              Vehicles:
                            </StyledText>
                            <StyledText
                              variant="bodySmall"
                              style={{ color: textColor }}
                            >
                              {order.number_of_vehicles}
                            </StyledText>
                          </View>
                          {order.total_amount != null && (
                            <View style={styles.detailRow}>
                              <StyledText
                                variant="bodySmall"
                                style={{ color: textColor, fontWeight: "600" }}
                              >
                                Total:
                              </StyledText>
                              <StyledText
                                variant="bodySmall"
                                style={{ color: textColor }}
                              >
                                {formatCurrency(order.total_amount)}
                              </StyledText>
                            </View>
                          )}
                          {order.created_at && (
                            <View style={styles.detailRow}>
                              <StyledText
                                variant="bodySmall"
                                style={{ color: textColor, fontWeight: "600" }}
                              >
                                Date:
                              </StyledText>
                              <StyledText
                                variant="bodySmall"
                                style={{ color: textColor }}
                              >
                                {new Date(
                                  order.created_at,
                                ).toLocaleDateString()}
                              </StyledText>
                            </View>
                          )}
                          {order.payment_status ? (
                            <View style={styles.detailRow}>
                              <StyledText
                                variant="bodySmall"
                                style={{ color: textColor, fontWeight: "600" }}
                              >
                                Payment:
                              </StyledText>
                              <StyledText
                                variant="bodySmall"
                                style={{ color: textColor }}
                              >
                                {order.payment_status}
                              </StyledText>
                            </View>
                          ) : null}
                          {order.order_data &&
                            typeof order.order_data === "object" &&
                            Object.keys(order.order_data).length > 0 &&
                            (() => {
                              const d = order.order_data as Record<
                                string,
                                unknown
                              >;
                              const service = d.service_type as
                                | {
                                    name?: string;
                                    duration?: number;
                                    fleet_price?: number;
                                    price?: number;
                                  }
                                | undefined;
                              const address = d.address as
                                | {
                                    address?: string;
                                    post_code?: string;
                                    city?: string;
                                    country?: string;
                                  }
                                | undefined;
                              const addressLine = address
                                ? [
                                    address.address,
                                    address.post_code,
                                    address.city,
                                    address.country,
                                  ]
                                    .filter(Boolean)
                                    .join(", ") || undefined
                                : undefined;
                              const dateVal =
                                typeof d.date === "string" ? d.date : undefined;
                              const startTime =
                                typeof d.start_time === "string"
                                  ? d.start_time
                                  : undefined;
                              const endTime =
                                typeof d.end_time === "string"
                                  ? d.end_time
                                  : typeof d.estimated_finish_time === "string"
                                    ? d.estimated_finish_time
                                    : undefined;
                              const timeRange =
                                [startTime, endTime]
                                  .filter(Boolean)
                                  .join(" – ") || undefined;
                              const windowVal =
                                typeof d.window === "string"
                                  ? d.window
                                  : undefined;
                              const teamSize =
                                typeof d.suggested_team_size === "number"
                                  ? d.suggested_team_size
                                  : undefined;
                              const subtotal =
                                typeof d.subtotal_amount === "number"
                                  ? d.subtotal_amount
                                  : undefined;
                              const discount =
                                typeof d.discount_applied === "number"
                                  ? d.discount_applied
                                  : undefined;
                              const total =
                                typeof d.total_amount === "number"
                                  ? d.total_amount
                                  : undefined;
                              const instructions =
                                typeof d.special_instructions === "string" &&
                                d.special_instructions.trim()
                                  ? d.special_instructions.trim()
                                  : undefined;
                              return (
                                <View
                                  style={[
                                    styles.bulkOrderData,
                                    { borderColor },
                                  ]}
                                >
                                  <StyledText
                                    variant="labelMedium"
                                    style={{
                                      color: textColor,
                                      marginBottom: 8,
                                    }}
                                  >
                                    Details
                                  </StyledText>
                                  {service?.name != null && (
                                    <View style={styles.detailRow}>
                                      <StyledText
                                        variant="bodySmall"
                                        style={{
                                          color: textColor,
                                          fontWeight: "600",
                                        }}
                                      >
                                        Service:
                                      </StyledText>
                                      <StyledText
                                        variant="bodySmall"
                                        style={{ color: textColor }}
                                      >
                                        {String(service.name)}
                                      </StyledText>
                                    </View>
                                  )}
                                  {service?.duration != null && (
                                    <View style={styles.detailRow}>
                                      <StyledText
                                        variant="bodySmall"
                                        style={{
                                          color: textColor,
                                          fontWeight: "600",
                                        }}
                                      >
                                        Duration:
                                      </StyledText>
                                      <StyledText
                                        variant="bodySmall"
                                        style={{ color: textColor }}
                                      >
                                        {service.duration} min
                                      </StyledText>
                                    </View>
                                  )}
                                  {addressLine && (
                                    <View style={styles.detailRow}>
                                      <StyledText
                                        variant="bodySmall"
                                        style={{
                                          color: textColor,
                                          fontWeight: "600",
                                        }}
                                      >
                                        Address:
                                      </StyledText>
                                      <StyledText
                                        variant="bodySmall"
                                        style={{ color: textColor }}
                                        numberOfLines={2}
                                      >
                                        {addressLine}
                                      </StyledText>
                                    </View>
                                  )}
                                  {dateVal && (
                                    <View style={styles.detailRow}>
                                      <StyledText
                                        variant="bodySmall"
                                        style={{
                                          color: textColor,
                                          fontWeight: "600",
                                        }}
                                      >
                                        Date:
                                      </StyledText>
                                      <StyledText
                                        variant="bodySmall"
                                        style={{ color: textColor }}
                                      >
                                        {new Date(dateVal).toLocaleDateString()}
                                      </StyledText>
                                    </View>
                                  )}
                                  {timeRange && (
                                    <View style={styles.detailRow}>
                                      <StyledText
                                        variant="bodySmall"
                                        style={{
                                          color: textColor,
                                          fontWeight: "600",
                                        }}
                                      >
                                        Time:
                                      </StyledText>
                                      <StyledText
                                        variant="bodySmall"
                                        style={{ color: textColor }}
                                      >
                                        {timeRange}
                                      </StyledText>
                                    </View>
                                  )}
                                  {windowVal && (
                                    <View style={styles.detailRow}>
                                      <StyledText
                                        variant="bodySmall"
                                        style={{
                                          color: textColor,
                                          fontWeight: "600",
                                        }}
                                      >
                                        Window:
                                      </StyledText>
                                      <StyledText
                                        variant="bodySmall"
                                        style={{ color: textColor }}
                                      >
                                        {windowVal}
                                      </StyledText>
                                    </View>
                                  )}
                                  {teamSize != null && (
                                    <View style={styles.detailRow}>
                                      <StyledText
                                        variant="bodySmall"
                                        style={{
                                          color: textColor,
                                          fontWeight: "600",
                                        }}
                                      >
                                        Team size:
                                      </StyledText>
                                      <StyledText
                                        variant="bodySmall"
                                        style={{ color: textColor }}
                                      >
                                        {teamSize}
                                      </StyledText>
                                    </View>
                                  )}
                                  {subtotal != null && (
                                    <View style={styles.detailRow}>
                                      <StyledText
                                        variant="bodySmall"
                                        style={{
                                          color: textColor,
                                          fontWeight: "600",
                                        }}
                                      >
                                        Subtotal:
                                      </StyledText>
                                      <StyledText
                                        variant="bodySmall"
                                        style={{ color: textColor }}
                                      >
                                        {formatCurrency(subtotal)}
                                      </StyledText>
                                    </View>
                                  )}
                                  {discount != null && discount > 0 && (
                                    <View style={styles.detailRow}>
                                      <StyledText
                                        variant="bodySmall"
                                        style={{
                                          color: textColor,
                                          fontWeight: "600",
                                        }}
                                      >
                                        Discount:
                                      </StyledText>
                                      <StyledText
                                        variant="bodySmall"
                                        style={{ color: textColor }}
                                      >
                                        {formatCurrency(discount)}
                                      </StyledText>
                                    </View>
                                  )}
                                  {total != null && (
                                    <View style={styles.detailRow}>
                                      <StyledText
                                        variant="bodySmall"
                                        style={{
                                          color: textColor,
                                          fontWeight: "600",
                                        }}
                                      >
                                        Total:
                                      </StyledText>
                                      <StyledText
                                        variant="bodySmall"
                                        style={{ color: textColor }}
                                      >
                                        {formatCurrency(total)}
                                      </StyledText>
                                    </View>
                                  )}
                                  {instructions != null && (
                                    <View style={styles.detailRow}>
                                      <StyledText
                                        variant="bodySmall"
                                        style={{
                                          color: textColor,
                                          fontWeight: "600",
                                        }}
                                      >
                                        Instructions:
                                      </StyledText>
                                      <StyledText
                                        variant="bodySmall"
                                        style={{ color: textColor }}
                                        numberOfLines={3}
                                      >
                                        {instructions}
                                      </StyledText>
                                    </View>
                                  )}
                                </View>
                              );
                            })()}
                          {order.payment_status !== "cancelled" && (
                            <View style={[styles.bulkOrderActions, { borderColor }]}>
                              {!canCancelOrRescheduleBulkOrder(order) ? (
                                <StyledText
                                  variant="bodySmall"
                                  style={{ color: textColor, opacity: 0.9, marginBottom: 8 }}
                                >
                                  Reschedule and cancel are not available within 12 hours of the appointment.
                                </StyledText>
                              ) : (
                                <View style={styles.bulkOrderActionRow}>
                                  <TouchableOpacity
                                    style={[styles.bulkActionButton, { borderColor }]}
                                    onPress={() => handleCancelBulkOrder(order)}
                                    disabled={isCancelling}
                                  >
                                    {isCancelling ? (
                                      <ActivityIndicator size="small" color={textColor} />
                                    ) : (
                                      <>
                                        <Ionicons name="close-circle-outline" size={18} color="#FF3B30" />
                                        <StyledText variant="bodySmall" style={{ color: "#FF3B30" }}>Cancel</StyledText>
                                      </>
                                    )}
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    style={[styles.bulkActionButton, { borderColor }]}
                                    onPress={() => openRescheduleModal(order)}
                                  >
                                    <Ionicons name="calendar-outline" size={18} color={primaryColor} />
                                    <StyledText variant="bodySmall" style={{ color: primaryColor }}>Reschedule</StyledText>
                                  </TouchableOpacity>
                                </View>
                              )}
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          )}
        </View>

        {/* Reschedule bulk order modal */}
        <Modal
          visible={rescheduleOrder != null}
          transparent
          animationType="fade"
          onRequestClose={() => setRescheduleOrder(null)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setRescheduleOrder(null)}
          >
            <TouchableOpacity
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
              style={[styles.modalContent, { backgroundColor: cardColor, borderColor }]}
            >
              <StyledText variant="titleMedium" style={{ color: textColor, marginBottom: 12 }}>
                Reschedule bulk order
              </StyledText>
              <StyledText variant="bodySmall" style={{ color: textColor, marginBottom: 8 }}>
                New date (YYYY-MM-DD)
              </StyledText>
              <StyledTextInput
                value={rescheduleNewDate}
                onChangeText={setRescheduleNewDate}
                placeholder="2025-03-01"
                placeholderTextColor="#999"
              />
              <View style={styles.modalButtons}>
                <StyledButton
                  title={rescheduleLoading ? "Checking…" : "Check availability"}
                  variant="small"
                  onPress={checkRescheduleCapacity}
                  disabled={rescheduleLoading || !rescheduleNewDate.trim()}
                  isLoading={rescheduleLoading}
                />
              </View>
              {rescheduleOptions && rescheduleOptions.length > 0 && (
                <>
                  <StyledText variant="bodySmall" style={{ color: textColor, marginTop: 12, marginBottom: 6 }}>
                    Select time window
                  </StyledText>
                  {rescheduleOptions.map((opt, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={[
                        styles.rescheduleOption,
                        { borderColor },
                        rescheduleSelectedIndex === idx && { backgroundColor: primaryColor + "20" },
                      ]}
                      onPress={() => {
                        setRescheduleSelectedIndex(idx);
                        setRescheduleSelectedOption(opt);
                      }}
                    >
                      <StyledText variant="bodySmall" style={{ color: textColor }}>
                        {opt.window}: {opt.best_start_time} – {opt.estimated_finish_time}
                      </StyledText>
                    </TouchableOpacity>
                  ))}
                  <View style={styles.modalButtons}>
                    <StyledButton
                      title="Confirm reschedule"
                      variant="small"
                      onPress={confirmReschedule}
                      disabled={isRescheduling}
                      isLoading={isRescheduling}
                    />
                  </View>
                </>
              )}
              <TouchableOpacity
                style={{ marginTop: 12 }}
                onPress={() => setRescheduleOrder(null)}
              >
                <StyledText variant="bodySmall" style={{ color: primaryColor }}>Close</StyledText>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        {branchVehiclesData && branchVehiclesData.vehicles.length > 0 && (
          <View style={styles.vehiclesSection}>
            <StyledText
              variant="labelMedium"
              style={[styles.sectionTitle, { color: textColor }]}
            >
              Vehicles in Branch
            </StyledText>
            {branchVehiclesData.vehicles.map((vehicle) => (
              <VehicleCard
                key={vehicle.id}
                vehicle={vehicle}
                cardColor={cardColor}
                textColor={textColor}
                borderColor={borderColor}
                primaryColor={primaryColor}
              />
            ))}
          </View>
        )}
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Create Branch Form */}
      {showCreateForm && (
        <View
          style={[
            styles.createForm,
            { backgroundColor: cardColor, borderColor },
          ]}
        >
          <StyledText
            variant="titleMedium"
            style={[styles.formTitle, { color: textColor }]}
          >
            Create New Branch
          </StyledText>
          <StyledTextInput
            label="Branch name *"
            value={newBranchName}
            onChangeText={setNewBranchName}
            placeholder="Enter branch name"
            placeholderTextColor={"black"}
          />
          <AddressSearchInput
            label="Branch address"
            placeholder="Search for branch address..."
            onSelect={handleBranchAddressSelect}
          />
          <View style={styles.formButtons}>
            <StyledButton
              style={{ flex: 1 }}
              title="Cancel"
              variant="tonal"
              onPress={() => {
                setShowCreateForm(false);
                clearBranchForm();
              }}
            />

            {limitsReached.branches && (
              <View style={styles.limitWarning}>
                <Ionicons name="warning-outline" size={20} color={textColor} />
                <StyledText
                  variant="bodySmall"
                  style={{ color: textColor, flex: 1 }}
                >
                  Branch limit reached. Please upgrade your subscription to add
                  more branches.
                </StyledText>
              </View>
            )}
            <StyledButton
              style={{ flex: 1 }}
              title="Create"
              variant="tonal"
              onPress={handleCreateBranch}
              disabled={isCreating || limitsReached.branches}
              isLoading={isCreating}
            />
          </View>
        </View>
      )}

      {/* Branches List */}
      <View style={styles.branchesList}>
        {branches.map((branch) => (
          <View key={branch.id}>
            {editingBranch === branch.id ? (
              <View
                style={[
                  styles.branchCard,
                  { backgroundColor: cardColor, borderColor },
                ]}
              >
                <StyledTextInput
                  label="Branch name"
                  value={newBranchName}
                  onChangeText={setNewBranchName}
                  placeholder="Branch name"
                  placeholderTextColor={textColor + "80"}
                />
                <AddressSearchInput
                  label="Branch address"
                  placeholder="Search for branch address..."
                  onSelect={handleBranchAddressSelect}
                  initialSelectedAddress={
                    branch.address
                      ? {
                          address: branch.address || "",
                          post_code: branch.postcode || "",
                          city: branch.city || "",
                          country: branch.country || "",
                          latitude: branch.latitude ?? 0,
                          longitude: branch.longitude ?? 0,
                        }
                      : null
                  }
                />
                <View style={styles.branchActions}>
                  <StyledButton
                    style={{ flex: 1 }}
                    title="Cancel"
                    variant="tonal"
                    onPress={cancelEditing}
                    disabled={isUpdating}
                    isLoading={isUpdating}
                  />

                  <StyledButton
                    style={{ flex: 1 }}
                    title="Save"
                    variant="small"
                    onPress={() => handleUpdateBranch(branch.id)}
                    disabled={isUpdating}
                    isLoading={isUpdating}
                  />
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={[
                  styles.branchCard,
                  { backgroundColor: cardColor, borderColor },
                ]}
                onPress={() => {
                  router.push({
                    pathname: "/main/(tabs)/dashboard/BranchManagementScreen",
                    params: { branchId: branch.id },
                  });
                }}
              >
                <View style={styles.branchHeader}>
                  <Ionicons name="business" size={24} color={primaryColor} />
                  <View style={styles.branchInfo}>
                    <StyledText
                      variant="titleMedium"
                      style={[styles.branchName, { color: textColor }]}
                    >
                      {branch.name}
                    </StyledText>
                    {branch.city && (
                      <StyledText
                        variant="bodySmall"
                        style={[styles.branchLocation, { color: textColor }]}
                      >
                        {branch.city}
                        {branch.address && `, ${branch.address}`}
                      </StyledText>
                    )}
                  </View>
                </View>
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
                    <Ionicons name="person" size={16} color={textColor} />
                    <StyledText
                      variant="bodySmall"
                      style={[styles.branchStatText, { color: textColor }]}
                    >
                      {branch.admin_count || 0} admins
                    </StyledText>
                  </View>
                </View>
                {branch.spend_limit != null && branch.spend_limit > 0 ? (
                  <View style={styles.branchStats}>
                    <StyledText
                      variant="bodySmall"
                      style={{ color: textColor, opacity: 0.85 }}
                    >
                      Spent: {formatCurrency(branch.spent ?? 0)} · Left:{" "}
                      {branch.remaining != null
                        ? formatCurrency(branch.remaining)
                        : "—"}
                    </StyledText>
                  </View>
                ) : (
                  <View style={styles.branchStats}>
                    <StyledText
                      variant="bodySmall"
                      style={{ color: textColor, opacity: 0.7 }}
                    >
                      No limit
                    </StyledText>
                  </View>
                )}
                <View style={styles.branchActions}>
                  <TouchableOpacity
                    style={[styles.actionButton, { borderColor }]}
                    onPress={() => startEditing(branch)}
                  >
                    <Ionicons name="create" size={16} color={textColor} />
                    <StyledText
                      variant="bodySmall"
                      style={{ color: textColor }}
                    >
                      Edit
                    </StyledText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, { borderColor }]}
                    onPress={() => handleDeleteBranch(branch.id, branch.name)}
                    disabled={isDeleting}
                  >
                    <Ionicons name="trash" size={16} color="#FF3B30" />
                    <StyledText
                      variant="bodySmall"
                      style={{ color: "#FF3B30" }}
                    >
                      Delete
                    </StyledText>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </View>

      {/* Add Branch Button */}
      {!showCreateForm && (
        <>
          {limitsReached.branches && (
            <View style={[styles.limitWarning, { margin: 16 }]}>
              <Ionicons name="warning-outline" size={20} color={textColor} />
              <StyledText
                variant="bodySmall"
                style={{ color: textColor, flex: 1 }}
              >
                Branch limit reached. Please upgrade your subscription to add
                more branches.
              </StyledText>
            </View>
          )}
          <TouchableOpacity
            style={[
              styles.addButton,
              { backgroundColor: buttonColor },
              limitsReached.branches && styles.addButtonDisabled,
            ]}
            onPress={() => setShowCreateForm(true)}
            disabled={limitsReached.branches}
          >
            <Ionicons name="add" size={24} color="white" />
            <StyledText variant="bodyLarge" style={styles.addButtonText}>
              Add New Branch
            </StyledText>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
};

export default BranchManagementScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
  },
  createForm: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  formTitle: {
    marginBottom: 8,
    fontWeight: "600",
  },
  input: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
  },
  formButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
  },
  submitButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  submitButtonText: {
    color: "white",
    fontWeight: "600",
  },
  branchesList: {
    padding: 16,
    gap: 12,
  },
  branchCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  branchHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  branchInfo: {
    flex: 1,
  },
  branchName: {
    fontWeight: "600",
  },
  branchLocation: {
    marginTop: 4,
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
  branchActions: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  actionButtonText: {
    color: "white",
    fontWeight: "600",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    margin: 14,
    borderRadius: 20,
    gap: 8,
  },
  addButtonText: {
    color: "white",
    fontWeight: "600",
  },
  addButtonDisabled: {
    opacity: 0.6,
  },
  limitWarning: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "rgba(255, 193, 7, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(255, 193, 7, 0.3)",
  },
  branchDetailCard: {
    margin: 10,
    padding: 10,
    borderRadius: 10,
  },
  adminCard: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  adminInfo: {
    gap: 4,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 2,
  },
  revertCapButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  capForm: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(128,128,128,0.25)",
    gap: 8,
  },
  capPeriodRow: {
    flexDirection: "row",
    gap: 8,
    borderWidth: 0,
  },
  capPeriodOption: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  capFormButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
  bulkOrdersHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bulkOrdersListContainer: {
    marginTop: 12,
    maxHeight: 300,
  },
  bulkOrdersScrollView: {
    flexGrow: 0,
  },
  bulkOrdersScrollContent: {
    gap: 8,
    paddingBottom: 8,
  },
  bulkOrdersList: {
    marginTop: 12,
    gap: 8,
  },
  bulkOrderItem: {
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
  },
  bulkOrderRefRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  bulkOrderDetail: {
    padding: 5,
    borderTopWidth: 1,
    gap: 6,
  },
  bulkOrderData: {
    marginTop: 8,
    paddingTop: 5,
    borderTopWidth: 1,
    gap: 10,
  },
  bulkOrderActions: {
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  bulkOrderActionRow: {
    flexDirection: "row",
    gap: 8,
  },
  bulkActionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: {
    width: "100%",
    maxWidth: 400,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  modalButtons: {
    marginTop: 8,
  },
  rescheduleOption: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 6,
  },
  vehiclesSection: {
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  vehicleCard: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  vehicleCardContent: {
    gap: 4,
  },
  vehicleCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bookingIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
});
