import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Platform,
  Dimensions,
  StatusBar,
  Pressable,
  Modal,
  TouchableOpacity,
  TextInput,
} from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { MaterialIcons } from "@expo/vector-icons";
import StyledButton from "../components/helpers/StyledButton";
import StyledText from "../components/helpers/StyledText";
import StyledTextInput from "../components/helpers/StyledTextInput";
import { useThemeColor } from "@/hooks/useThemeColor";
import useOnboarding from "../app-hooks/useOnboarding";
import { useAlertContext } from "../contexts/AlertContext";

const { width, height } = Dimensions.get("window");

const OnboardingScreen = () => {
  const {
    signUpData,
    collectSignupData: handleSignUpData,
    registerUser,
    isRegisterLoading
  } = useOnboarding();

  const { setAlertConfig, setIsVisible } = useAlertContext();
  const textColor = useThemeColor({}, "text");
  const backgroundColor = useThemeColor({}, "background");
  const borderColor = useThemeColor({}, "borders");
  const buttonColor = useThemeColor({}, "button");
  const errorColor = useThemeColor({}, "error");

  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] =
    useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [showDialCodeOverlay, setShowDialCodeOverlay] = useState(false);
  const [selectedDialCode, setSelectedDialCode] = useState("+353");

  const handleSubmit = async () => {
    if (!signUpData) return;
    try {
      if (!signUpData.email || !signUpData.password || !signUpData.phone) {
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
      await registerUser();
    } catch (error) {
      console.error("Registration failed:", error);
    }
  };

  const handleDialCodeSelect = (dialCode: string) => {
    setSelectedDialCode(dialCode);
    setShowDialCodeOverlay(false);
  };

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={true}
        bounces={false}
      >
        {/* Header Section */}
        <View style={styles.headerSection}>
          <LinearGradient
            colors={[backgroundColor, textColor]}
            style={styles.headerGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 4, y: 1 }}
          >
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.headerContent}>
              <StyledText variant="titleLarge">Join Prisma Car Wash</StyledText>

              <StyledText variant="bodyMedium" style={styles.headerSubtitle}>
                Create your account and start booking professional car wash
                services
              </StyledText>
            </View>
          </LinearGradient>
        </View>

        {/* Form Section */}
        <LinearGradient
          colors={[backgroundColor, textColor]}
          style={styles.formSection}
          start={{ x: 0, y: 0 }}
          end={{ x: 4, y: 1 }}
        >
          <View style={styles.formContainer}>
            {/* Personal Information */}
            <View style={styles.sectionHeader}>
              <StyledText variant="titleMedium">
                Personal Information
              </StyledText>
              <StyledText variant="bodySmall">
                Tell us about yourself to get started
              </StyledText>
            </View>

            <View style={styles.inputGroup}>
              <StyledTextInput
                label="Full Name"
                value={signUpData?.name}
                onChangeText={(text) => handleSignUpData("name", text)}
                keyboardType="default"
                autoCapitalize="words"
                placeholder="Enter your full name"
                info="You can enter your first name or full name"
              />
            </View>

            <View style={styles.inputGroup}>
              <StyledTextInput
                label="Email Address"
                value={signUpData?.email}
                onChangeText={(text) => handleSignUpData("email", text)}
                keyboardType="email-address"
                inputMode="email"
                autoCapitalize="none"
                placeholder="Enter your email address"
              />
            </View>

            {/* Security Section */}
            <View style={styles.sectionHeader}>
              <StyledText variant="titleMedium">Security Setup</StyledText>
              <StyledText variant="bodySmall">
                Create a secure password for your account
              </StyledText>
            </View>

            <View style={styles.inputGroup}>
              <StyledTextInput
                label="Password"
                value={signUpData?.password}
                onChangeText={(text) => handleSignUpData("password", text)}
                secureTextEntry={!isPasswordVisible}
                placeholder="Create a strong password"
              />
              <Pressable
                onPress={() => setIsPasswordVisible(!isPasswordVisible)}
                style={styles.visibilityIcon}
              >
                <MaterialIcons
                  name={isPasswordVisible ? "visibility" : "visibility-off"}
                  size={20}
                  color={"black"}
                />
              </Pressable>
            </View>

            <View style={styles.inputGroup}>
              <StyledTextInput
                label="Confirm Password"
                value={confirmPassword}
                onChangeText={(text) => setConfirmPassword(text)}
                secureTextEntry={!isConfirmPasswordVisible}
                placeholder="Confirm your password"
              />
              <Pressable
                onPress={() =>
                  setIsConfirmPasswordVisible(!isConfirmPasswordVisible)
                }
                style={styles.visibilityIcon}
              >
                <MaterialIcons
                  name={
                    isConfirmPasswordVisible ? "visibility" : "visibility-off"
                  }
                  size={20}
                  color={"black"}
                />
              </Pressable>
              {signUpData?.password !== confirmPassword && confirmPassword && (
                <StyledText style={styles.errorText} color={errorColor}>
                  Passwords do not match
                </StyledText>
              )}
            </View>

            <View style={styles.inputGroup}>
              <StyledText variant="bodyMedium">Phone Number</StyledText>
              <View
                style={[
                  styles.phoneInputContainer,
                  { borderColor: borderColor },
                  { backgroundColor: textColor },
                ]}
              >
                <TouchableOpacity
                  style={styles.countryCodeContainer}
                  onPress={() => setShowDialCodeOverlay(true)}
                >
                  <StyledText style={[styles.countryCode, { color: "black" }]}>
                    {selectedDialCode}
                  </StyledText>
                  <Ionicons name="chevron-down" size={16} color={"black"} />
                </TouchableOpacity>
                <View style={styles.phoneDivider} />
                <TextInput
                  style={[styles.phoneInput, { color: "black" }]}
                  placeholder="Enter your phone number"
                  placeholderTextColor="#999999"
                  value={signUpData?.phone}
                  onChangeText={(text) => handleSignUpData("phone", text)}
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            {/* Benefits Section */}
            <LinearGradient
              colors={[backgroundColor, textColor]}
              style={styles.benefitsSection}
              start={{ x: 0, y: 0 }}
              end={{ x: 4, y: 0 }}
            >
              <View style={styles.sectionHeader}>
                <StyledText variant="titleMedium" style={styles.benefitsTitle}>
                  Why Join Prisma Car Wash?
                </StyledText>
              </View>

              <View style={styles.benefitsList}>
                <View style={styles.benefitItem}>
                  <View style={styles.benefitIcon}>
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color="#4CAF50"
                    />
                  </View>
                  <StyledText variant="bodyMedium">
                    Professional mobile car wash service
                  </StyledText>
                </View>

                <View style={styles.benefitItem}>
                  <View style={styles.benefitIcon}>
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color="#4CAF50"
                    />
                  </View>
                  <StyledText variant="bodyMedium">
                    Easy booking and scheduling
                  </StyledText>
                </View>

                <View style={styles.benefitItem}>
                  <View style={styles.benefitIcon}>
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color="#4CAF50"
                    />
                  </View>
                  <StyledText variant="bodyMedium">
                    Quality guaranteed satisfaction
                  </StyledText>
                </View>
              </View>
            </LinearGradient>

            {/* Submit Button */}
            <StyledButton
              title={isRegisterLoading ? "Creating Account..." : "Create Account"}
              onPress={handleSubmit}
              variant="large"
              style={styles.submitButton}
            />

            {/* Sign In Link */}
            <View style={styles.signInContainer}>
              <StyledText style={[styles.signInText, { color: textColor }]}>
                Already have an account?{" "}
                <StyledText
                  style={[styles.signInLink, { color: buttonColor }]}
                  onPress={() => router.push("/onboarding/SigninScreen")}
                >
                  Sign In
                </StyledText>
              </StyledText>
            </View>
          </View>
        </LinearGradient>
      </ScrollView>

      {/* Dial Code Overlay */}
      <Modal
        visible={showDialCodeOverlay}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDialCodeOverlay(false)}
      >
        <View style={styles.overlayBackground}>
          <View style={[styles.overlayContainer, { backgroundColor }]}>
            <View style={styles.overlayContent}>
              <StyledText style={styles.overlayTitle}>
                Select Country Code
              </StyledText>
              <TouchableOpacity
                style={[styles.dialCodeOption, { borderColor: borderColor }]}
                onPress={() => handleDialCodeSelect("+44")}
              >
                <StyledText variant="bodyMedium">
                  🇬🇧 United Kingdom (+44)
                </StyledText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dialCodeOption, { borderColor: borderColor }]}
                onPress={() => handleDialCodeSelect("+353")}
              >
                <StyledText variant="bodyMedium">🇮🇪 Ireland (+353)</StyledText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  headerSection: {
    height: height * 0.2,
  },
  headerGradient: {
    flex: 1,
    paddingTop: 10,
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  backButton: {
    position: "absolute",
    top: 10,
    left: 15,
    zIndex: 1,
    padding: 8,
  },
  headerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 5,
    gap: 5,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 24,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  logoText: {
    fontSize: 32,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 12,
  },
  headerSubtitle: {
    textAlign: "center",
  },
  formSection: {
    flex: 1,
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    marginTop: -10,
    paddingTop: 10,
  },
  formContainer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  sectionHeader: {
    marginBottom: 20,
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 14,
    opacity: 0.7,
    lineHeight: 20,
  },
  inputGroup: {
    marginBottom: 10,
    position: "relative",
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  visibilityIcon: {
    position: "absolute",
    right: 12,
    top: 30,
    padding: 4,
  },
  errorText: {
    fontSize: 10,
    marginTop: 4,
    marginLeft: 4,
  },
  phoneInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    height: 40,
    marginTop: 5,
  },
  countryCodeContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  countryCode: {
    fontSize: 16,
    fontWeight: "600",
    marginRight: 8,
  },
  phoneDivider: {
    width: 1,
    height: 24,
    backgroundColor: "#E0E0E0",
    marginHorizontal: 8,
  },
  phoneInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  benefitsSection: {
    marginTop: 30,
    marginBottom: 10,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  benefitsTitle: {
    marginBottom: 10,
    textAlign: "center",
  },
  benefitsList: {
    gap: 12,
  },
  benefitItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  benefitIcon: {
    marginRight: 12,
  },
  benefitText: {
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  submitButton: {
    marginTop: 20,
    backgroundColor: "#1e3c72",
  },
  signInContainer: {
    alignItems: "center",
    marginTop: 24,
  },
  signInText: {
    fontSize: 14,
  },
  signInLink: {
    fontWeight: "bold",
    textDecorationLine: "underline",
  },
  overlayBackground: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  overlayContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 40,
    minWidth: 280,
  },
  overlayContent: {
    alignItems: "center",
  },
  overlayTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 20,
    color: "#1e3c72",
  },
  dialCodeOption: {
    width: "100%",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
  },
  dialCodeText: {
    fontSize: 16,
    textAlign: "center",
  },
});

export default OnboardingScreen;
