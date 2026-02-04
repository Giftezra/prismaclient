import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Platform,
  Dimensions,
  Pressable,
  Modal,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import StyledButton from "../components/helpers/StyledButton";
import StyledText from "../components/helpers/StyledText";
import StyledTextInput from "../components/helpers/StyledTextInput";
import TermsAcceptanceModal from "../components/helpers/TermsAcceptanceModal";
import { useThemeColor } from "@/hooks/useThemeColor";
import useOnboarding from "../app-hooks/useOnboarding";
import { useAlertContext } from "../contexts/AlertContext";

const { width, height } = Dimensions.get("window");

const OnboardingScreen = () => {
  const {
    signUpData,
    collectSignupData: handleSignUpData,
    registerUser,
    isRegisterLoading,
    termsAccepted,
    showTermsModal,
    handleAcceptTerms,
    handleShowTerms,
    setShowTermsModal,
  } = useOnboarding();

  const { setAlertConfig, setIsVisible } = useAlertContext();
  const textColor = useThemeColor({}, "text");
  const backgroundColor = useThemeColor({}, "background");
  const borderColor = useThemeColor({}, "borders");
  const buttonColor = useThemeColor({}, "button");
  const errorColor = useThemeColor({}, "error");
  const cardColor = useThemeColor({}, "cards");
  const iconColor = useThemeColor({}, "icons");

  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] =
    useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const handleSubmit = async () => {
    if (!signUpData) return;
    try {
      if (
        !signUpData.name ||
        !signUpData.email ||
        !signUpData.phone ||
        !signUpData.password
      ) {
        setAlertConfig({
          title: "Missing Fields",
          message: "Please fill in all required fields",
          type: "error",
          isVisible: true,
          onConfirm: () => {
            setIsVisible(false);
          },
        });
        return;
      }
      if (signUpData.password !== confirmPassword) {
        setPasswordError("Passwords do not match");
        return;
      }
      setPasswordError("");
      await registerUser();
    } catch (error) {
      console.error("Registration failed:", error);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Back Button */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={textColor} />
          </TouchableOpacity>

          {/* Main Content */}
          <View style={styles.content}>
            {/* Title Section */}
            <View style={styles.titleSection}>
              <StyledText style={[styles.title, { color: textColor }]}>
                Create Account
              </StyledText>
              <StyledText style={[styles.subtitle, { color: textColor }]}>
                Join our community and Experience a seamless service
              </StyledText>
            </View>

            {/* Form Section */}
            <View style={styles.formSection}>
              {/* Full Name Input */}
              <View style={styles.inputContainer}>
                <StyledTextInput
                  label="Full Name"
                  placeholder="Enter your full name"
                  value={signUpData?.name || ""}
                  onChangeText={(text) => handleSignUpData("name", text)}
                  keyboardType="default"
                  autoCapitalize="words"
                  style={styles.textInput}
                  placeholderTextColor={
                    textColor === "#FFFFFF" ? "#B0B0B0" : "#999999"
                  }
                />
              </View>

              {/* Email Input */}
              <View style={styles.inputContainer}>
                <StyledTextInput
                  label="Email"
                  placeholder="Enter your email"
                  value={signUpData?.email || ""}
                  onChangeText={(text) => handleSignUpData("email", text)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={styles.textInput}
                  placeholderTextColor={
                    textColor === "#FFFFFF" ? "#B0B0B0" : "#999999"
                  }
                />
              </View>

              {/* Phone Input */}
              <View style={styles.inputContainer}>
                <StyledTextInput
                  label="Phone Number"
                  placeholder="Enter your phone number"
                  value={signUpData?.phone || ""}
                  onChangeText={(text) => handleSignUpData("phone", text)}
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                  maxLength={12}
                  style={styles.textInput}
                  placeholderTextColor={
                    textColor === "#FFFFFF" ? "#B0B0B0" : "#999999"
                  }
                />
              </View>

              {/* Password Input */}
              <View style={styles.inputContainer}>
                <View style={styles.passwordInputWrapper}>
                  <StyledTextInput
                    label="Password"
                    placeholder="Enter your password"
                    value={signUpData?.password || ""}
                    onChangeText={(text) => handleSignUpData("password", text)}
                    secureTextEntry={!isPasswordVisible}
                    autoCapitalize="none"
                    style={styles.textInput}
                    placeholderTextColor={
                      textColor === "#FFFFFF" ? "#B0B0B0" : "#999999"
                    }
                  />
                  <TouchableOpacity
                    style={styles.eyeIcon}
                    onPress={() => setIsPasswordVisible(!isPasswordVisible)}
                  >
                    <Ionicons
                      name={isPasswordVisible ? "eye-off" : "eye"}
                      size={20}
                      color={textColor === "#FFFFFF" ? "#B0B0B0" : "#999999"}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Confirm Password Input */}
              <View style={styles.inputContainer}>
                <View style={styles.passwordInputWrapper}>
                  <StyledTextInput
                    label="Confirm Password"
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChangeText={(text) => setConfirmPassword(text)}
                    secureTextEntry={!isConfirmPasswordVisible}
                    autoCapitalize="none"
                    style={styles.textInput}
                    placeholderTextColor={
                      textColor === "#FFFFFF" ? "#B0B0B0" : "#999999"
                    }
                  />
                  <TouchableOpacity
                    style={styles.eyeIcon}
                    onPress={() =>
                      setIsConfirmPasswordVisible(!isConfirmPasswordVisible)
                    }
                  >
                    <Ionicons
                      name={isConfirmPasswordVisible ? "eye-off" : "eye"}
                      size={20}
                      color={textColor === "#FFFFFF" ? "#B0B0B0" : "#999999"}
                    />
                  </TouchableOpacity>
                </View>
                {passwordError && (
                  <StyledText style={[styles.errorText, { color: errorColor }]}>
                    {passwordError}
                  </StyledText>
                )}
              </View>

              {/* Referral Code Input */}
              <View style={styles.inputContainer}>
                <StyledTextInput
                  label="Referral Code (Optional)"
                  placeholder="Enter referral code if you have one"
                  value={signUpData?.referred_code || ""}
                  onChangeText={(text) =>
                    handleSignUpData("referred_code", text)
                  }
                  keyboardType="default"
                  autoCapitalize="characters"
                  style={styles.textInput}
                  placeholderTextColor={
                    textColor === "#FFFFFF" ? "#B0B0B0" : "#999999"
                  }
                />
                <StyledText style={[styles.helpText, { color: textColor }]}>
                  Get 10% off your first service with a valid referral code!
                </StyledText>
              </View>

              {/* Fleet Owner Checkbox */}
              <View style={styles.fleetOwnerContainer}>
                <TouchableOpacity
                  style={styles.checkboxContainer}
                  onPress={() =>
                    handleSignUpData("isFleetOwner", !signUpData?.isFleetOwner)
                  }
                >
                  <View
                    style={[
                      styles.checkbox,
                      {
                        borderColor: borderColor,
                        backgroundColor: signUpData?.isFleetOwner
                          ? buttonColor
                          : "transparent",
                      },
                    ]}
                  >
                    {signUpData?.isFleetOwner && (
                      <Ionicons name="checkmark" size={16} color="white" />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <StyledText
                      style={[styles.fleetOwnerText, { color: textColor }]}
                    >
                      I am a fleet owner
                    </StyledText>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Terms and Conditions Checkbox */}
              <View style={styles.termsContainer}>
                <TouchableOpacity
                  style={styles.checkboxContainer}
                  onPress={() => {
                    if (!termsAccepted) {
                      handleShowTerms();
                    }
                  }}
                >
                  <View
                    style={[
                      styles.checkbox,
                      {
                        borderColor: borderColor,
                        backgroundColor: termsAccepted
                          ? buttonColor
                          : "transparent",
                      },
                    ]}
                  >
                    {termsAccepted && (
                      <Ionicons name="checkmark" size={16} color="white" />
                    )}
                  </View>
                  <StyledText style={[styles.termsText, { color: textColor }]}>
                    By agreeing to the terms and conditions, you are entering
                    into a legally binding contract with the service provider.
                  </StyledText>
                </TouchableOpacity>
              </View>

              {/* Continue Button */}
              <TouchableOpacity
                style={[
                  styles.continueButton,
                  {
                    backgroundColor: termsAccepted ? buttonColor : borderColor,
                    opacity: termsAccepted ? 1 : 0.6,
                  },
                ]}
                onPress={termsAccepted ? handleSubmit : handleShowTerms}
                disabled={isRegisterLoading}
              >
                <StyledText
                  style={[
                    styles.continueButtonText,
                    { color: termsAccepted ? "white" : textColor },
                  ]}
                >
                  {isRegisterLoading ? "Creating Account..." : "Continue"}
                </StyledText>
              </TouchableOpacity>

              {/* Sign In Link */}
              <View style={styles.signInContainer}>
                <StyledText style={[styles.signInText, { color: textColor }]}>
                  Already have an account?{" "}
                  <StyledText
                    style={[styles.signInLink, { color: buttonColor }]}
                    onPress={() => router.push("/onboarding/SigninScreen")}
                  >
                    Login
                  </StyledText>
                </StyledText>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Terms and Conditions Modal */}
      <TermsAcceptanceModal
        visible={showTermsModal}
        onAccept={handleAcceptTerms}
        onClose={() => setShowTermsModal(false)}
        onDecline={() => setShowTermsModal(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  backButton: {
    position: "absolute",
    top: Platform.OS === "ios" ? 50 : 30,
    left: 20,
    zIndex: 1,
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === "ios" ? 100 : 80,
  },
  titleSection: {
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "left",
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    opacity: 0.7,
    textAlign: "left",
  },
  formSection: {
    flex: 1,
  },
  inputContainer: {
    marginBottom: 20,
    borderRadius: 20,
  },
  textInput: {
    borderRadius: 20,
    fontSize: 16,
  },
  passwordInputWrapper: {
    position: "relative",
  },
  eyeIcon: {
    position: "absolute",
    right: 12,
    top: 30,
    zIndex: 1,
    padding: 5,
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  helpText: {
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
    opacity: 0.7,
  },
  fleetOwnerContainer: {
    marginBottom: 20,
  },
  fleetOwnerText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  },
  termsContainer: {
    marginBottom: 24,
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    marginTop: 2,
  },
  termsText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.7,
  },
  continueButton: {
    height: 50,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  signInContainer: {
    alignItems: "center",
    paddingBottom: 20,
  },
  signInText: {
    fontSize: 16,
    textAlign: "center",
  },
  signInLink: {
    fontWeight: "600",
    fontSize: 16,
  },
});

export default OnboardingScreen;
