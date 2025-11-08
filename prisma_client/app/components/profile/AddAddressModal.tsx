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
