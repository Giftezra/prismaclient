import { useEffect, useState } from "react";
import * as Updates from "expo-updates";
import { Alert } from "react-native";
import Constants from "expo-constants";

export const useUpdateMonitor = () => {
  const [isCheckingForUpdate, setIsCheckingForUpdate] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    const checkForUpdates = async () => {
      // Skip update checks in development
      if (__DEV__) {
        console.log("Skipping update check in development mode");
        return;
      }

      // Check if updates are enabled
      if (!Updates.isEnabled) {
        console.log("Updates are not enabled");
        return;
      }

      try {
        setIsCheckingForUpdate(true);
        console.log("Checking for updates...");
        const update = await Updates.checkForUpdateAsync();

        if (update.isAvailable) {
          console.log("Update available:", update);
          setUpdateAvailable(true);

          // Show alert to user
          Alert.alert(
            "Update Available",
            "A new version of the app is available. Would you like to download and install it now?",
            [
              {
                text: "Later",
                style: "cancel",
              },
              {
                text: "Update Now",
                onPress: async () => {
                  try {
                    console.log("Fetching update...");
                    await Updates.fetchUpdateAsync();
                    console.log("Update fetched, reloading...");
                    await Updates.reloadAsync();
                  } catch (error) {
                    console.error("Update installation failed:", error);
                    Alert.alert(
                      "Update Failed",
                      "Failed to install update. Please try again later."
                    );
                  }
                },
              },
            ]
          );
        } else {
          console.log("No updates available");
        }
      } catch (error:any) {
        console.error("Update check failed:", error);
        // Don't show error alerts in production to avoid annoying users
        if (__DEV__) {
          Alert.alert("Update Check Failed", error.message);
        }
      } finally {
        setIsCheckingForUpdate(false);
      }
    };

    // Check for updates on app start
    checkForUpdates();

    // Set up periodic checks (every 5 minutes) - only in production
    if (!__DEV__) {
      const interval = setInterval(checkForUpdates, 300000);
      return () => clearInterval(interval);
    }
  }, []);

  return {
    isCheckingForUpdate,
    updateAvailable,
  };
};
