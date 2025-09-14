import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import React, { useState, useEffect } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { useThemeColor } from "@/hooks/useThemeColor";
import { router, Slot, Stack } from "expo-router";
import StyledText from "@/app/components/helpers/StyledText";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { Divider } from "react-native-paper";
import { RootState, useAppSelector } from "../store/main_store";
import ExpoStripeProvider from "../contexts/ExpoStripeProvider";
import { useAlertContext } from "../contexts/AlertContext";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { BackHandler } from "react-native";
import { Image } from "expo-image";


const CustomHeader = ({ name }: { name: string }) => {
  const backgroundColor = useThemeColor({}, "background");
  const iconColor = useThemeColor({}, "icons");
  const secondaryButtonColor = useThemeColor({}, "secondaryButton");
  const textColor = useThemeColor({}, "text");
  const [isArrowBackVisible, setIsArrowBackVisible] = useState(false);
  const { setAlertConfig } = useAlertContext();
  const navigation = useNavigation();

  // Update arrow visibility based on navigation state
  useFocusEffect(
    React.useCallback(() => {
      setIsArrowBackVisible(router.canGoBack());
    }, [])
  );

  // Listen to navigation state changes
  useEffect(() => {
    const unsubscribe = navigation.addListener("state", () => {
      setIsArrowBackVisible(router.canGoBack());
    });

    return unsubscribe;
  }, [navigation]);

  // Also update when component mounts
  useEffect(() => {
    setIsArrowBackVisible(router.canGoBack());
  }, []);

  const handleBackPress = () => {
    if (router.canGoBack()) {
      router.back();
      // Navigation listener will automatically update the arrow visibility
    } else {
      // Show exit app confirmation
      setAlertConfig({
        isVisible: true,
        title: "Exit App",
        message: "Are you sure you want to close the app?",
        type: "warning",
        onConfirm: () => {
          if (Platform.OS === "android") {
            BackHandler.exitApp();
          }
          // iOS doesn't allow programmatic app closure
        },
        onClose: () => {
          // Do nothing, just close the alert
        },
      });
    }
  };

  return (
    <View style={[styles.header, { backgroundColor }]}>
      <View style={styles.headerButtons}>
        {Platform.OS === "ios" && isArrowBackVisible && (
          <Pressable onPress={handleBackPress} style={styles.profileButton}>
            <Ionicons name="arrow-back" size={24} color={iconColor} />
          </Pressable>
        )}
        <StyledText variant="titleMedium" style={{ color: textColor }}>
          {"Hi There, " + name}
        </StyledText>
      </View>
      <View style={styles.headerButtons}>
        <Pressable
          style={[
            styles.profileButton,
            { backgroundColor, shadowColor: textColor },
          ]}
          onPress={() => router.push("/main/NotificationScreen")}
        >
          <Ionicons name="notifications-outline" size={24} color={iconColor} />
        </Pressable>
        <Pressable
          style={[
            styles.profileButton,
            { backgroundColor, shadowColor: textColor },
          ]}
          onPress={() => router.push("/main/SettingsScreen")}
        >
          <Ionicons name="settings-outline" size={24} color={iconColor} />
        </Pressable>
      </View>
    </View>
  );
};



export default function MainLayout() {
  const backgroundColor = useThemeColor({}, "background");
  const user = useAppSelector((state: RootState) => state.auth.user);
  return (
    <ExpoStripeProvider>
      <KeyboardAvoidingView style={{ flex: 1 }}>
        <SafeAreaView style={[styles.mainContainer, { backgroundColor }]}>
          <CustomHeader name={user?.name || ""} />
          <Divider style={{ marginTop: 5, marginBottom: 5 }} />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="SettingsScreen" />
            <Stack.Screen name="NotificationScreen" />
          </Stack>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </ExpoStripeProvider>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 5,
  },
  headerButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  profileButton: {
    padding: 8,
    borderRadius: 30,
    borderWidth: 1,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 3,
  },
});
