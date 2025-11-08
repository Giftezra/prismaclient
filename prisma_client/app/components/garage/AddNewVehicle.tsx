import {
  StyleSheet,
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  ActivityIndicator,
  Image,
  TouchableOpacity,
} from "react-native";
import React, { useState, useEffect } from "react";
import StyledTextInput from "@/app/components/helpers/StyledTextInput";
import StyledText from "@/app/components/helpers/StyledText";
import useGarage from "@/app/app-hooks/useGarage";
import StyledButton from "@/app/components/helpers/StyledButton";
import { useThemeColor } from "@/hooks/useThemeColor";
import { Ionicons } from "@expo/vector-icons";
import ModalServices from "@/app/utils/ModalServices";

/**
 * AddNewVehicleScreen Component
 *
 * A clean, presentation-only component for collecting vehicle information.
 * All business logic and state management is handled by the useGarage hook.
 * This component focuses purely on rendering the UI and delegating user interactions to the hook.
 */
const AddNewVehicleScreen = ({
  setIsAddVehicleModalVisible,
}: {
  setIsAddVehicleModalVisible: (visible: boolean) => void;
}) => {
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // Theme colors
  const backgroundColor = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");
  const primaryColor = useThemeColor({}, "primary");
  const borderColor = useThemeColor({}, "borders");

  // Extract all needed methods and state from the useGarage hook
  const {
    newVehicle,
    collectNewVehicleData,
    handleSubmit,
    isLoadingVehicles,
    isImageModalVisible,
    showImageSelectionModal,
    hideImageSelectionModal,
    handleCameraSelection,
    handleFileSelection,
  } = useGarage();

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      "keyboardDidShow",
      () => {
        setKeyboardVisible(true);
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      "keyboardDidHide",
      () => {
        setKeyboardVisible(false);
      }
    );

    return () => {
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
    };
  }, []);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      <ScrollView
        style={[styles.mainContainer]}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          keyboardVisible &&
            Platform.OS === "android" &&
            styles.scrollContentKeyboard,
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.card]}>
          {/* Vehicle Information Form */}
          <View style={styles.formSection}>
            <StyledText variant="labelMedium">Vehicle Information</StyledText>

            <StyledTextInput
              label="Make"
              placeholder="e.g., Toyota, Honda, Ford"
              value={newVehicle?.make || ""}
              onChangeText={(text) => collectNewVehicleData("make", text)}
            />

            <StyledTextInput
              label="Model"
              value={newVehicle?.model || ""}
              onChangeText={(text) => collectNewVehicleData("model", text)}
            />

            <StyledTextInput
              label="Year"
              placeholder="e.g., 2020"
              value={newVehicle?.year?.toString() || ""}
              onChangeText={(text) => collectNewVehicleData("year", text)}
              keyboardType="numeric"
              maxLength={4}
            />

            <StyledTextInput
              label="Color"
              placeholder="e.g., Red, Blue, Silver"
              value={newVehicle?.color || ""}
              onChangeText={(text) => collectNewVehicleData("color", text)}
            />

            <StyledTextInput
              label="License Plate"
              placeholder="e.g., ABC123"
              value={newVehicle?.licence || ""}
              onChangeText={(text) => collectNewVehicleData("licence", text)}
              maxLength={12}
            />

            {/* Vehicle Image Section */}
            <View style={styles.imageSection}>
              <StyledText variant="labelMedium">Vehicle Image</StyledText>
              <TouchableOpacity
                style={[styles.imagePickerButton, { borderColor }]}
                onPress={showImageSelectionModal}
              >
                {newVehicle?.image?.uri ? (
                  <Image
                    source={{ uri: newVehicle.image.uri }}
                    style={styles.imagePreview}
                  />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Ionicons
                      name="camera-outline"
                      size={32}
                      color={textColor}
                    />
                    <StyledText
                      variant="bodySmall"
                      style={[
                        styles.imagePlaceholderText,
                        { color: textColor },
                      ]}
                    >
                      Tap to add image
                    </StyledText>
                  </View>
                )}
              </TouchableOpacity>
              {newVehicle?.image?.uri && (
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={() => collectNewVehicleData("image", null)}
                >
                  <Ionicons name="trash-outline" size={18} color={textColor} />
                  <StyledText
                    variant="bodySmall"
                    style={[styles.removeImageText, { color: textColor }]}
                  >
                    Remove Image
                  </StyledText>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* Submit Button */}
        <View style={styles.submitContainer}>
          {isLoadingVehicles ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <StyledButton
              title={"Add New Vehicle"}
              onPress={() => {
                handleSubmit();
                setIsAddVehicleModalVisible(false);
              }}
              variant="medium"
              style={styles.submitButton}
              disabled={isLoadingVehicles}
            />
          )}
        </View>
      </ScrollView>

      {/* Image Selection Modal */}
      <ModalServices
        visible={isImageModalVisible}
        onClose={hideImageSelectionModal}
        modalType="center"
        animationType="fade"
        showCloseButton={true}
        title="Select Image Source"
        component={
          <View style={styles.imageModalContent}>
            <TouchableOpacity
              style={[styles.imageOptionButton, { borderColor }]}
              onPress={handleCameraSelection}
            >
              <Ionicons name="camera" size={32} color={primaryColor} />
              <StyledText
                variant="bodyMedium"
                style={[styles.imageOptionText, { color: textColor }]}
              >
                Take Photo
              </StyledText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.imageOptionButton, { borderColor }]}
              onPress={handleFileSelection}
            >
              <Ionicons name="images-outline" size={32} color={primaryColor} />
              <StyledText
                variant="bodyMedium"
                style={[styles.imageOptionText, { color: textColor }]}
              >
                Choose from Gallery
              </StyledText>
            </TouchableOpacity>
          </View>
        }
      />
    </KeyboardAvoidingView>
  );
};

export default AddNewVehicleScreen;

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  scrollContentKeyboard: {
    paddingBottom: 100,
  },
  header: {
    padding: 5,
    paddingBottom: 10,
  },

  card: {
    margin: 5,
  },
  formSection: {
    gap: 5,
    marginVertical: 5,
  },

  submitContainer: {
    padding: 20,
    paddingTop: 10,
  },
  submitButton: {
    borderRadius: 12,
    backgroundColor: "#007AFF",
  },
  submitButtonContent: {
    paddingVertical: 8,
  },
  submitButtonText: {
    color: "white",
    fontWeight: "600",
  },
  imageSection: {
    marginTop: 10,
    gap: 8,
  },
  imagePickerButton: {
    width: "100%",
    height: 150,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  imagePreview: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  imagePlaceholder: {
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  imagePlaceholderText: {
    opacity: 0.7,
  },
  removeImageButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
  },
  removeImageText: {
    fontSize: 12,
  },
  imageModalContent: {
    padding: 20,
    gap: 16,
  },
  imageOptionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  imageOptionText: {
    fontWeight: "500",
  },
});
