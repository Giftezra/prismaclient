import React, { useState, useCallback } from "react";
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColor } from "@/hooks/useThemeColor";
import StyledText from "../helpers/StyledText";
import StyledTextInput from "../helpers/StyledTextInput";
import StyledButton from "../helpers/StyledButton";
import { MyAddressProps } from "@/app/interfaces/ProfileInterfaces";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Divider } from "react-native-paper";
import useProfile from "@/app/app-hooks/useProfile";
import { useLocationService } from "@/app/app-hooks/useLocationService";
import { usePermissions } from "@/app/app-hooks/usePermissions";

interface AddAddressModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSave: () => void;
  title: string;
}

const AddAddressModal: React.FC<AddAddressModalProps> = ({
  isVisible,
  onClose,
  onSave,
  title,
}) => {
  const { collectNewAddress, newAddress } = useProfile();
  const {
    getCurrentLocation,
    getLocationName,
    isLocationLoading,
    locationError,
  } = useLocationService();
  const { permissionStatus, requestLocationPermission } = usePermissions();

  const textColor = useThemeColor({}, "text");
  const backgroundColor = useThemeColor({}, "background");
  const primaryPurpleColor = useThemeColor({}, "primary");
  const borderColor = useThemeColor({}, "borders");

  const [isLoading, setIsLoading] = useState(false);
  const [isLocationRequesting, setIsLocationRequesting] = useState(false);

  /**
   * Handles the use current location functionality
   * Requests permission, gets location, and populates address form
   */
  const handleUseCurrentLocation = useCallback(async () => {
    try {
      setIsLocationRequesting(true);

      // Check if location permission is granted
      if (!permissionStatus.location.granted) {
        const permissionGranted = await requestLocationPermission();
        if (!permissionGranted) {
          Alert.alert(
            "Location Permission Required",
            "Location permission is needed to automatically detect your address.",
            [{ text: "OK" }]
          );
          return;
        }
      }

      // Get current location
      const location = await getCurrentLocation();
      if (!location) {
        Alert.alert(
          "Location Error",
          locationError ||
            "Unable to get your current location. Please try again or enter your address manually.",
          [{ text: "OK" }]
        );
        return;
      }

      // Get address from coordinates using reverse geocoding
      const addressName = await getLocationName(
        location.latitude,
        location.longitude
      );

      if (addressName) {
        // Parse the address components from the formatted string
        const addressParts = addressName.split(", ");

        // Populate the form fields with the retrieved address components
        // The getLocationName function returns: street, city, postalCode, region, country
        if (addressParts.length >= 1) {
          collectNewAddress("address", addressParts[0] || "");
        }
        if (addressParts.length >= 2) {
          collectNewAddress("city", addressParts[1] || "");
        }
        if (addressParts.length >= 3) {
          // Postal code is now in the third position
          collectNewAddress("post_code", addressParts[2] || "");
        }
        if (addressParts.length >= 5) {
          // Country is now in the fifth position (after postalCode and region)
          collectNewAddress("country", addressParts[4] || "");
        } else if (addressParts.length >= 4) {
          // Fallback if region is not present
          collectNewAddress("country", addressParts[3] || "");
        }

        Alert.alert(
          "Location Found",
          "Your current location has been detected and the address form has been filled automatically.",
          [{ text: "OK" }]
        );
      } else {
        Alert.alert(
          "Address Not Found",
          "We found your location but couldn't determine the address. Please enter your address manually.",
          [{ text: "OK" }]
        );
      }
    } catch (error) {
      console.error("Error getting current location:", error);
      Alert.alert(
        "Location Error",
        "An error occurred while getting your location. Please try again or enter your address manually.",
        [{ text: "OK" }]
      );
    } finally {
      setIsLocationRequesting(false);
    }
  }, [
    permissionStatus.location.granted,
    requestLocationPermission,
    getCurrentLocation,
    locationError,
    getLocationName,
    collectNewAddress,
  ]);

  /**
   * Handles closing the modal and resetting the form
   */
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  return (
    <View style={[styles.container]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        {/* Header */}
        <View style={styles.header}>
          <StyledText variant="titleSmall">{title}</StyledText>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <MaterialCommunityIcons name="close" size={20} color={textColor} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Use Current Location Section */}
          <View style={styles.section}>
            <TouchableOpacity
              style={[styles.locationCard, { borderColor: borderColor }]}
              onPress={handleUseCurrentLocation}
              activeOpacity={0.7}
              disabled={isLocationRequesting || isLocationLoading}
            >
              <View style={styles.locationIconContainer}>
                <MaterialCommunityIcons
                  name={
                    isLocationRequesting || isLocationLoading
                      ? "loading"
                      : "crosshairs-gps"
                  }
                  size={20}
                  color={primaryPurpleColor}
                />
              </View>
              <View style={styles.locationContent}>
                <StyledText variant="labelMedium">
                  {isLocationRequesting || isLocationLoading
                    ? "Getting Location..."
                    : "Use Current Location"}
                </StyledText>
                <StyledText variant="bodySmall">
                  {isLocationRequesting || isLocationLoading
                    ? "Please wait while we detect your location"
                    : "Automatically detect your location"}
                </StyledText>
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                size={20}
                color={textColor}
              />
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View style={styles.dividerContainer}>
            <Divider
              style={[styles.divider, { backgroundColor: borderColor }]}
            />
            <StyledText
              variant="bodySmall"
              style={[styles.dividerText, { color: textColor }]}
            >
              OR
            </StyledText>
            <Divider
              style={[styles.divider, { backgroundColor: borderColor }]}
            />
          </View>

          {/* Manual Address Form */}
          <View style={styles.section}>
            <StyledText
              variant="titleMedium"
              style={[styles.sectionTitle, { color: textColor }]}
            >
              Enter Address Manually
            </StyledText>

            <View style={styles.formContainer}>
              <StyledTextInput
                label="Street Address"
                placeholder="Enter your street address"
                value={newAddress?.address}
                onChangeText={(text) => collectNewAddress("address", text)}
                autoCapitalize="words"
                style={styles.input}
              />

              <View style={styles.inputRow}>
                <StyledTextInput
                  label="Post Code"
                  placeholder="Post code"
                  value={newAddress?.post_code}
                  onChangeText={(text) => collectNewAddress("post_code", text)}
                  autoCapitalize="characters"
                  style={styles.input}
                />
                <StyledTextInput
                  label="City"
                  placeholder="City"
                  value={newAddress?.city}
                  onChangeText={(text) => collectNewAddress("city", text)}
                  autoCapitalize="words"
                  style={styles.input}
                />
              </View>

              <StyledTextInput
                label="Country"
                placeholder="Enter country"
                value={newAddress?.country}
                onChangeText={(text) => collectNewAddress("country", text)}
                autoCapitalize="words"
                style={styles.input}
              />
            </View>
          </View>
        </ScrollView>

        {/* Action Buttons */}
        <View style={styles.footer}>
          <StyledButton
            title="Cancel"
            variant="tonal"
            onPress={handleClose}
            style={[styles.cancelButton, { borderColor: borderColor }]}
          />
          <StyledButton
            title={isLoading ? "Saving..." : "Save Address"}
            variant="medium"
            onPress={onSave}
            disabled={isLoading}
            style={styles.saveButton}
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

export default AddAddressModal;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 5,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 5,
  },
  closeButton: {
    padding: 8,
    borderRadius: 10,
  },
  content: {
    flex: 1,
    paddingVertical: 20,
  },
  section: {
    marginBottom: 24,
  },
  locationCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  locationIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(0,0,0,0.05)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  locationContent: {
    flex: 1,
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 24,
  },
  divider: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 16,
    opacity: 0.5,
    fontWeight: "500",
  },
  sectionTitle: {
    fontWeight: "600",
    marginBottom: 16,
  },
  formContainer: {
    gap: 16,
  },
  inputRow: {
    flexDirection: "row",
    gap: 12,
  },
  input: {
    marginBottom: 0,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  saveButton: {
    flex: 1,
  },
  cancelButton: {
    borderWidth: 1,
  },
});
