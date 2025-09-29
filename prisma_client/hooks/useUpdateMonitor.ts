import { useEffect, useState } from "react";
import * as Updates from "expo-updates";
import { Alert } from "react-native";

export const useUpdateMonitor = () => {
  const [isCheckingForUpdate, setIsCheckingForUpdate] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        setIsCheckingForUpdate(true);
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
                    await Updates.fetchUpdateAsync();
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
        }
      } catch (error) {
        console.error("Update check failed:", error);
      } finally {
        setIsCheckingForUpdate(false);
      }
    };

    // Check for updates on app start
    checkForUpdates();

    // Set up periodic checks (every 5 minutes instead of 1 minute)
    const interval = setInterval(checkForUpdates, 300000);

    return () => clearInterval(interval);
  }, []);

  return {
    isCheckingForUpdate,
    updateAvailable,
  };
};
