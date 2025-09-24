import {
  StyleSheet,
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  ActivityIndicator,
} from "react-native";
import React, { useState, useEffect } from "react";
import StyledTextInput from "@/app/components/helpers/StyledTextInput";
import StyledText from "@/app/components/helpers/StyledText";
import useGarage from "@/app/app-hooks/useGarage";
import StyledButton from "@/app/components/helpers/StyledButton";
import { useThemeColor } from "@/hooks/useThemeColor";

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
  const { newVehicle, collectNewVehicleData, handleSubmit, isLoadingVehicles } =
    useGarage();

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
    </KeyboardAvoidingView>
  );
};

export default AddNewVehicleScreen;

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1
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
});
