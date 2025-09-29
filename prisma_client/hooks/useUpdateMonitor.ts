import { useEffect } from "react";
import * as Updates from "expo-updates";

export const useUpdateMonitor = () => {
  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        const update = await Updates.checkForUpdateAsync();
      } catch (error) {
        console.error("Update check failed:", error);
      }
    };

    // Check for updates on app start
    checkForUpdates();

    // Set up periodic checks (optional)
    const interval = setInterval(checkForUpdates, 60000); // Check every minute

    return () => clearInterval(interval);
  }, []);
};
