import React from "react";
import { StyleSheet, View, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { MyVehiclesProps } from "../../interfaces/GarageInterface";
import StyledText from "../helpers/StyledText";
import StyledButton from "../helpers/StyledButton";
import { useThemeColor } from "@/hooks/useThemeColor";

interface GarageVehicleComponentProps {
  vehicle: MyVehiclesProps;
  onDeletePress?: (id: string) => void;
  onBookServicePress?: (id: string) => void;
  onViewDetailsPress?: (id: string) => void;
  isLoadingVehicleStats?: boolean;
}

const GarageVehicleComponent: React.FC<GarageVehicleComponentProps> = ({
  vehicle,
  onDeletePress,
  onBookServicePress,
  onViewDetailsPress,
  isLoadingVehicleStats,
}) => {
  const cardsColor = useThemeColor({}, "cards");
  const textColor = useThemeColor({}, "text");
  const iconColor = useThemeColor({}, "icons");
  const borderColor = useThemeColor({}, "borders");

  return (
    <View
      style={[
        styles.cardContainer,
        { backgroundColor: cardsColor, borderColor },
      ]}
    >
      {/* Header with delete button */}
      <View style={styles.header}>
        <View style={styles.vehicleIcon}>
          <Ionicons name="car" size={24} color={iconColor} />
        </View>
        <TouchableOpacity
          style={[styles.deleteButton, { backgroundColor: borderColor }]}
          onPress={() => onDeletePress?.(vehicle.id)}
        >
          <Ionicons name="trash-outline" size={16} color={textColor} />
        </TouchableOpacity>
      </View>

      {/* Vehicle Information */}
      <View style={styles.content}>
        <StyledText
          variant="labelLarge"
          style={[styles.vehicleTitle, { color: textColor }]}
        >
          {vehicle.year} {vehicle.make} {vehicle.model}
        </StyledText>

        <View style={styles.details}>
          <View style={styles.detailRow}>
            <Ionicons
              name="color-palette-outline"
              size={14}
              color={vehicle.color.toLowerCase()}
            />
            <StyledText
              variant="bodySmall"
              style={[styles.detailText, { color: textColor }]}
            >
              {vehicle.color}
            </StyledText>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="car-sport-outline" size={14} color={iconColor} />
            <StyledText
              variant="bodySmall"
              style={[styles.detailText, { color: textColor }]}
            >
              {vehicle.licence.toUpperCase()}
            </StyledText>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <StyledButton
            title="Details"
            variant="tonal"
            onPress={() => onViewDetailsPress?.(vehicle.id)}
            style={styles.actionButton}
            isLoading={isLoadingVehicleStats}
          />
          <StyledButton
            title="Book"
            variant="tonal"
            onPress={() => onBookServicePress?.(vehicle.id)}
            style={styles.actionButton}
          />
        </View>
      </View>
    </View>
  );
};

export default GarageVehicleComponent;

const styles = StyleSheet.create({
  cardContainer: {
    width: "48%",
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    paddingBottom: 8,
  },
  vehicleIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    opacity: 0.8,
  },
  deleteButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    padding: 12,
    paddingTop: 0,
  },
  vehicleTitle: {
    fontWeight: "600",
    marginBottom: 8,
    lineHeight: 20,
  },
  details: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  detailText: {
    marginLeft: 6,
    opacity: 0.8,
  },
  actions: {
    flexDirection: "row",
    gap: 6,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
});
