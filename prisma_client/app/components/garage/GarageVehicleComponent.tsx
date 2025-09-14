import React from "react";
import { StyleSheet, View, Image, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { MyVehiclesProps } from "../../interfaces/GarageInterface";
import StyledText from "../helpers/StyledText";
import StyledButton from "../helpers/StyledButton";
import { useThemeColor } from "@/hooks/useThemeColor";
import LinearGradientComponent from "../helpers/LinearGradientComponent";

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

  return (
    <LinearGradientComponent
      style={[styles.cardContent]}
      color1={cardsColor}
      color2={textColor}
      start={{ x: 0, y: 0 }}
      end={{ x: 3, y: 1 }}
    >
      {/* Vehicle Image Section */}
      <View style={styles.imageSection}>
        <View style={styles.imageContainer}>
          <Image
            source={require("../../../assets/images/car.jpg")}
            style={styles.vehicleImage}
          />
        </View>

        <View style={styles.imageOverlay}>
          <TouchableOpacity
            style={[styles.actionButton]}
            onPress={() => onDeletePress?.(vehicle.id)}
          >
            <Ionicons name="trash" size={24} color={iconColor} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Vehicle Information Section */}
      <View style={styles.infoSection}>
        {/* Main Vehicle Details */}
        <View style={styles.mainDetails}>
          <StyledText variant="labelLarge">
            {vehicle.year} {vehicle.make} {vehicle.model}
          </StyledText>
          <View style={styles.vehicleMeta}>
            <View style={styles.metaItem}>
              <Ionicons name="color-palette" size={16} color={iconColor} />
              <StyledText variant="bodyMedium" style={styles.metaText}>
                {vehicle.color}
              </StyledText>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="card" size={16} color={iconColor} />
              <StyledText variant="bodyMedium" style={styles.metaText}>
                {vehicle.licence}
              </StyledText>
            </View>
          </View>
        </View>

        {/* Vehicle ID */}
        <View style={styles.idSection}>
          <StyledText variant="bodySmall" style={styles.idLabel}>
            Vehicle ID
          </StyledText>
          <StyledText variant="bodyMedium" style={styles.idValue}>
            {vehicle.id}
          </StyledText>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <StyledButton
            title="View Details"
            variant="tonal"
            onPress={() => onViewDetailsPress?.(vehicle.id)}
            style={styles.detailButton}
            isLoading={isLoadingVehicleStats}
          />
          <StyledButton
            title="Book Service"
            variant="tonal"
            onPress={() => onBookServicePress?.(vehicle.id)}
            style={styles.serviceButton}
          />
        </View>
      </View>
    </LinearGradientComponent>
  );
};

export default GarageVehicleComponent;

const styles = StyleSheet.create({
  cardContent: {
    margin: 5,
    borderRadius: 5,
    marginBottom: 10,
  },
  imageSection: {
    height: 200,
    borderRadius: 5,
    overflow: "hidden",
  },
  imageContainer: {
    width: "100%",
    height: "100%",
  },
  image: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  vehicleImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  imageOverlay: {
    position: "absolute",
    top: 5,
    right: 5,
    zIndex: 1,
  },
  actionButton: {
    width: 50,
    height: 50,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  infoSection: {
    padding: 5,
  },
  mainDetails: {
    marginBottom: 16,
  },
  vehicleMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaText: {
    fontWeight: "500",
  },
  idSection: {
    marginBottom: 5,
    padding: 5,
    borderRadius: 8,
  },
  idLabel: {
    opacity: 0.7,
    marginBottom: 4,
  },
  idValue: {
    fontWeight: "600",
    fontFamily: "monospace",
  },
  quickActions: {
    flexDirection: "row",
    gap: 12,
  },
  detailButton: {
    flex: 1,
  },
  serviceButton: {
    flex: 1,
  },
});
