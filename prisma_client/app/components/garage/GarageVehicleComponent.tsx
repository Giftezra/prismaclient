import React from "react";
import {
  StyleSheet,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from "react-native";
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
      {/* Vehicle Image Section - Prominent at top */}
      <View style={styles.imageContainer}>
        {vehicle.image && typeof vehicle.image === "string" ? (
          <Image source={{ uri: vehicle.image }} style={styles.vehicleImage} />
        ) : (
          <Image
            source={require("../../../assets/images/car.jpg")}
            style={styles.vehicleImage}
          />
        )}
        {/* Delete button positioned over image */}
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => onDeletePress?.(vehicle.id)}
        >
          <Ionicons name="trash-outline" size={16} color="white" />
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
          {isLoadingVehicleStats ? (
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <ActivityIndicator size="small" color={textColor} />
              <StyledText variant="bodySmall" style={styles.detailText}>
                Wait..
              </StyledText>
            </View>
          ) : (
            <StyledButton
              title={"Details"}
              variant="tonal"
              onPress={() => onViewDetailsPress?.(vehicle.id)}
              style={styles.actionButton}
              isLoading={isLoadingVehicleStats}
              disabled={isLoadingVehicleStats}
            />
          )}

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
    flex:1,
    marginBottom: 5,
    borderRadius: 10,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  imageContainer: {
    width: "100%",
    height: 120, // Approximately 60% of card height (card is ~200px tall)
    position: "relative",
    overflow: "hidden",
  },
  vehicleImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  deleteButton: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  content: {
    padding: 12,
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
