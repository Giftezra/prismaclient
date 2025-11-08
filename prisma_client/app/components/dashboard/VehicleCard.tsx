import React from "react";
import {
  StyleSheet,
  View,
  TouchableOpacity,
  ScrollView,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColor } from "@/hooks/useThemeColor";
import { MyVehiclesProps } from "../../interfaces/GarageInterface";
import StyledText from "../helpers/StyledText";

const VehicleCard: React.FC<{
  vehicle: MyVehiclesProps;
  onPress?: () => void;
}> = ({ vehicle, onPress }) => {
  const primaryColor = useThemeColor({}, "primary");

  return (
    <TouchableOpacity style={styles.vehicleCard} onPress={onPress}>
      {/* Display the vehicle image */}
      <View style={styles.vehicleimagewrapper}>
        {vehicle.image && typeof vehicle.image === "string" ? (
          <Image source={{ uri: vehicle.image }} style={styles.vehicleImage} />
        ) : (
          <Image
            source={require("../../../assets/images/car.jpg")}
            style={styles.vehicleImage}
          />
        )}
      </View>

      <View style={[styles.vehicleDetails, { backgroundColor: primaryColor }]}>
        <View style={styles.vehicleDetailsSection}>
          <StyledText children="Model" variant="labelMedium" />
          <StyledText children={vehicle.model} variant="labelMedium" />
        </View>
        <View style={styles.vehicleDetailsSection}>
          <StyledText children="Licence" variant="labelMedium" />
          <StyledText children={vehicle.licence} variant="labelMedium" />
        </View>
        <View style={styles.vehicleDetailsSection}>
          <StyledText children="Make" variant="labelMedium" />
          <StyledText children={vehicle.make} variant="labelMedium" />
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default VehicleCard;

const styles = StyleSheet.create({
  vehicleCard: {
    width: 200, // Add explicit width
    height: 150, // Add explicit height
    overflow: "hidden",
    borderRadius: 5,
  },
  vehicleimagewrapper: {
    width: "100%",
    height: "70%", // Use percentage of card height instead of 100%
  },
  vehicleImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  vehicleDetails: {
    position: "absolute",
    bottom: 0, // Position at bottom
    left: 0,
    right: 0,
    paddingHorizontal: 5,
    paddingVertical: 5,
    borderBottomEndRadius: 10,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 4,
  },
  vehicleDetailsSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 20,
  },
});
