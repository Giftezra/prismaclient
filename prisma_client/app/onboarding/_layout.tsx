import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
  Keyboard,
} from "react-native";
import React, { useEffect, useState } from "react";
import { Stack } from "expo-router";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useThemeColor } from "@/hooks/useThemeColor";

const OnboardingLayout = () => {
  const [keyboardVisible, setKeyboardVisible] = useState(false);

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

  const backgroundColor = useThemeColor({}, "background");
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor,
        }}
      >
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="OnboardingScreen" />
          <Stack.Screen name="SigninScreen" />
        </Stack>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
};

export default OnboardingLayout;

const styles = StyleSheet.create({});
