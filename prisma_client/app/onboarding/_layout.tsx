import { KeyboardAvoidingView, Platform, StyleSheet } from "react-native";
import React from "react";
import { Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useThemeColor } from "@/hooks/useThemeColor";

const OnboardingLayout = () => {
  const backgroundColor = useThemeColor({}, "background");

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor,
      }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="OnboardingScreen" />
          <Stack.Screen name="SigninScreen" />
        </Stack>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default OnboardingLayout;

const styles = StyleSheet.create({});
