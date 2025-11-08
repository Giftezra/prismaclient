import { StyleSheet, View, Image, TouchableOpacity } from "react-native";
import React from "react";
import {
  MyVehiclesProps,
  MyVehicleStatsProps,
} from "../../interfaces/GarageInterface";
import StyledText from "../helpers/StyledText";
import StyledButton from "../helpers/StyledButton";
import { formatCurrency, formatDate } from "@/app/utils/methods";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColor } from "@/hooks/useThemeColor";

interface MyVehicleStatsComponentProps {
  vehicleStats: MyVehicleStatsProps;
  onBookWash: () => void;
}

const MyVehicleStatsComponent = ({
  vehicleStats,
  onBookWash,
}: MyVehicleStatsComponentProps) => {
  const backgroundColor = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");

  // Add safety checks for vehicleStats
  if (!vehicleStats || !vehicleStats.vehicle) {
    return (
      <View style={styles.container}>
        <StyledText
          variant="bodyMedium"
          style={{ textAlign: "center", padding: 20 }}
        >
          Loading vehicle details...
        </StyledText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Vehicle Header */}
      <View style={styles.vehicleHeader}>
        <View style={styles.vehicleInfo}>
          <StyledText
            variant="labelLarge"
            style={styles.vehicleTitle}
            color={textColor}
          >
            {vehicleStats.vehicle?.year || "N/A"}{" "}
            {vehicleStats.vehicle?.make || "N/A"}{" "}
            {vehicleStats.vehicle?.model || "N/A"}
          </StyledText>
          <View style={styles.vehicleDetails}>
            <View style={styles.detailItem}>
              <Ionicons
                name="color-palette-outline"
                size={16}
                color={vehicleStats.vehicle?.color?.toLowerCase() || "#6c757d"}
              />
              <StyledText variant="labelMedium" style={styles.detailText}>
                {vehicleStats.vehicle?.color || "N/A"}
              </StyledText>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="card-outline" size={16} color="#6c757d" />
              <StyledText variant="labelMedium" style={styles.detailText}>
                {vehicleStats.vehicle?.licence || "N/A"}
              </StyledText>
            </View>
          </View>
        </View>
        {vehicleStats.vehicle?.image?.uri ||
        (vehicleStats.vehicle?.image &&
          typeof vehicleStats.vehicle.image === "string") ? (
          <View style={styles.imageContainer}>
            <Image
              source={{
                uri:
                  vehicleStats.vehicle.image?.uri || vehicleStats.vehicle.image,
              }}
              style={styles.vehicleImage}
            />
          </View>
        ) : null}
      </View>

      {/* Stats Grid */}
      <View style={styles.statsContainer}>
        <View style={styles.statRow}>
          <View style={styles.statItem}>
            <View style={styles.statIconContainer}>
              <Ionicons name="calendar-outline" size={20} color="#007bff" />
            </View>
            <StyledText
              variant="labelLarge"
              style={styles.statValue}
              color={textColor}
            >
              {vehicleStats?.total_bookings || 0}
            </StyledText>
            <StyledText variant="bodySmall" style={styles.statLabel}>
              Total Bookings
            </StyledText>
          </View>

          <View style={styles.statItem}>
            <View style={styles.statIconContainer}>
              <Ionicons name="cash-outline" size={20} color="#28a745" />
            </View>
            <StyledText
              variant="labelLarge"
              style={styles.statValue}
              color={textColor}
            >
              {formatCurrency(vehicleStats?.total_amount || 0)}
            </StyledText>
            <StyledText variant="bodySmall" style={styles.statLabel}>
              Total Spent
            </StyledText>
          </View>
        </View>

        <View style={styles.statRow}>
          <View style={styles.statItem}>
            <View style={styles.statIconContainer}>
              <Ionicons name="time-outline" size={20} color="#ffc107" />
            </View>
            <StyledText
              variant="labelMedium"
              style={styles.statValue}
              color={textColor}
            >
              {formatDate(vehicleStats?.last_cleaned)}
            </StyledText>
            <StyledText variant="bodySmall" style={styles.statLabel}>
              Last Cleaned
            </StyledText>
          </View>

          <View style={styles.statItem}>
            <View style={styles.statIconContainer}>
              <Ionicons
                name="notifications-outline"
                size={20}
                color="#dc3545"
              />
            </View>
            <StyledText
              variant="labelMedium"
              style={styles.statValue}
              color={textColor}
            >
              {formatDate(vehicleStats?.next_recommended_service)}
            </StyledText>
            <StyledText variant="bodySmall" style={styles.statLabel}>
              Next Service
            </StyledText>
          </View>
        </View>
      </View>

      {/* Action Button */}
      <View style={styles.actionContainer}>
        <StyledButton
          title="Book Wash"
          variant="tonal"
          onPress={onBookWash}
          style={styles.button}
        />
      </View>
    </View>
  );
};

export default MyVehicleStatsComponent;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  card: {
    borderRadius: 3,
    elevation: 8,
  },
  vehicleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 20,
    paddingBottom: 16,
  },
  vehicleInfo: {
    flex: 1,
    marginRight: 12,
  },
  vehicleTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  vehicleDetails: {
    gap: 6,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  detailText: {
    color: "#6c757d",
    fontSize: 14,
  },
  imageContainer: {
    width: 80,
    height: 80,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#e9ecef",
  },
  vehicleImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  statsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    padding: 10,
    borderRadius: 5,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f8f9fa",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  statValue: {
    fontWeight: "600",
    color: "#212529",
    marginBottom: 4,
  },
  statLabel: {
    textAlign: "center",
    color: "#6c757d",
    fontSize: 12,
  },
  actionContainer: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  buttonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  buttonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 16,
  },
  button: {
    shadowColor: "transparent",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
});
