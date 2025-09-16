import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import React, { useState } from "react";
import StyledText from "../components/helpers/StyledText";
import { useThemeColor } from "@/hooks/useThemeColor";
import StyledTextInput from "../components/helpers/StyledTextInput";
import StyledButton from "../components/helpers/StyledButton";
import { Ionicons } from "@expo/vector-icons";
import { TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { useAuthContext } from "../contexts/AuthContextProvider";
import { LinearGradient } from "expo-linear-gradient";

const SigninScreen = () => {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { handleLogin, isLoading, isError, error } = useAuthContext();

  /* import the colors */
  const backgroundColor = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");
  const primaryPurple = useThemeColor({}, "primary");
  const iconColor = useThemeColor({}, "icons");

  const handleSignIn = () => {
    if (!email || !password) return;
    handleLogin(email, password, rememberMe);
  };

  const handleForgotPassword = () => {
    // Handle forgot password logic here
    console.log("Forgot password pressed");
  };

  return (
    <LinearGradient
      colors={[backgroundColor, textColor]}
      style={[styles.container]}
      start={{ x: 0, y: 0 }}
      end={{ x: 4, y: 1 }}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            {/* Header Section */}
            <View style={styles.headerSection}>
              <StyledText variant="titleLarge">Welcome back</StyledText>
              <StyledText variant="bodyMedium">
                Sign in to your account to continue
              </StyledText>
            </View>

            {/* Form Card */}
            <LinearGradient
              colors={[backgroundColor, textColor]}
              style={[styles.formCard]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 4 }}
            >
              {/* Email Input */}
              <View style={styles.inputContainer}>
                <StyledTextInput
                  label="Email address"
                  placeholder="Enter your email"
                  value={email}
                  onChangeText={(text) => setEmail(text)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.input}
                  returnKeyType="next"
                />
              </View>

              {/* Password Input */}
              <View style={styles.inputContainer}>
                <StyledTextInput
                  label="Password"
                  placeholder="Enter your password"
                  value={password}
                  onChangeText={(text) => setPassword(text)}
                  secureTextEntry={!isPasswordVisible}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.input}
                  returnKeyType="done"
                  onSubmitEditing={handleSignIn}
                />
                <View style={styles.passwordIconContainer}>
                  <Ionicons
                    name={isPasswordVisible ? "eye-off" : "eye"}
                    size={20}
                    color={"black"}
                    onPress={() => setIsPasswordVisible(!isPasswordVisible)}
                  />
                </View>
              </View>

              {/* Remember Me & Forgot Password */}
              <View style={styles.optionsContainer}>
                <TouchableOpacity
                  style={styles.rememberMeContainer}
                  onPress={() => setRememberMe(!rememberMe)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.customCheckbox,
                      {
                        borderColor: textColor,
                        backgroundColor: rememberMe
                          ? primaryPurple
                          : "transparent",
                      },
                    ]}
                  >
                    {rememberMe && (
                      <Ionicons name="checkmark" size={16} color="white" />
                    )}
                  </View>
                  <StyledText
                    variant="bodyMedium"
                    style={[styles.rememberText, { color: textColor }]}
                  >
                    Remember me
                  </StyledText>
                </TouchableOpacity>
                <StyledText
                  variant="bodySmall"
                  style={[styles.forgotPasswordText, { color: textColor }]}
                  onPress={handleForgotPassword}
                >
                  Forgot password?
                </StyledText>
              </View>

              {/* Sign In Button */}
              <View style={styles.buttonContainer}>
                <StyledButton
                  title="Sign In"
                  variant="medium"
                  onPress={handleSignIn}
                  style={styles.signInButton}
                />
              </View>
            </LinearGradient>

            {/* Sign Up Link */}
            <View style={styles.signUpContainer}>
              <StyledText
                variant="bodyMedium"
                style={[styles.signUpText, { color: textColor }]}
              >
                Don't have an account?{" "}
              </StyledText>
              <StyledText
                variant="bodySmall"
                style={[
                  styles.signUpLink,
                  { color: iconColor, fontWeight: "700" },
                ]}
                onPress={() => router.push("/onboarding/OnboardingScreen")}
              >
                Sign up
              </StyledText>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

export default SigninScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingVertical: 32,
  },
  content: {
    paddingHorizontal: 24,
    flex: 1,
    justifyContent: "center",
  },
  headerSection: {
    alignItems: "center",
    marginBottom: 32,
  },
  subtitleText: {
    textAlign: "center",
    opacity: 0.7,
  },
  formCard: {
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  inputContainer: {
    marginBottom: 20,
    position: "relative",
  },
  input: {
    marginBottom: 0,
  },
  passwordIconContainer: {
    position: "absolute",
    right: 12,
    top: 35,
    zIndex: 1,
  },
  optionsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 32,
  },
  rememberMeContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  customCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  rememberText: {
    marginLeft: 8,
  },
  forgotPasswordText: {
    fontWeight: "700",
  },
  buttonContainer: {
    marginBottom: 24,
  },
  signInButton: {
    width: "100%",
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },
  divider: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 16,
    opacity: 0.6,
  },
  socialButtonsContainer: {
    flexDirection: "row",
    gap: 12,
  },
  socialButton: {
    flex: 1,
  },
  signUpContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  signUpText: {
    opacity: 0.7,
  },
  signUpLink: {
    fontWeight: "600",
  },
});
