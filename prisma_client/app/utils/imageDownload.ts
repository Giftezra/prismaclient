import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useSnackbar } from "@/app/contexts/SnackbarContext";

/**
 * Downloads an image from a URL and saves it to the device
 * Uses expo-file-system to download and expo-sharing to save/share
 * 
 * @param imageUrl - The URL of the image to download
 * @param bookingReference - Optional booking reference for filename
 * @param showSnackbarWithConfig - Optional snackbar function for showing success/error messages
 * @returns Promise<boolean> - True if download was successful
 */
export const downloadImage = async (
  imageUrl: string,
  bookingReference?: string,
  showSnackbarWithConfig?: (config: {
    message: string;
    type: "success" | "error" | "info";
    duration?: number;
  }) => void
): Promise<boolean> => {
  try {
    // Generate filename with timestamp and booking reference
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const ref = bookingReference ? `_${bookingReference}` : "";
    const filename = `service_image${ref}_${timestamp}.jpg`;
    
    // Get file extension from URL or default to jpg
    const fileExtension = imageUrl.split(".").pop()?.split("?")[0] || "jpg";
    const finalFilename = filename.replace(".jpg", `.${fileExtension}`);

    // Create file URI in cache directory
    const fileUri = `${FileSystem.cacheDirectory}${finalFilename}`;

    // Download the file
    const downloadResult = await FileSystem.downloadAsync(imageUrl, fileUri);

    if (downloadResult.status !== 200) {
      throw new Error(`Download failed with status ${downloadResult.status}`);
    }

    // Check if sharing is available
    const isAvailable = await Sharing.isAvailableAsync();

    if (isAvailable) {
      // Share/save the file (opens native share dialog)
      await Sharing.shareAsync(downloadResult.uri, {
        mimeType: `image/${fileExtension}`,
        dialogTitle: "Save Image",
      });

      if (showSnackbarWithConfig) {
        showSnackbarWithConfig({
          message: "Image saved successfully",
          type: "success",
          duration: 3000,
        });
      }
      return true;
    } else {
      // For platforms where sharing isn't available, just download to cache
      if (showSnackbarWithConfig) {
        showSnackbarWithConfig({
          message: "Image downloaded to cache",
          type: "info",
          duration: 3000,
        });
      }
      return true;
    }
  } catch (error: any) {
    console.error("Error downloading image:", error);
    if (showSnackbarWithConfig) {
      showSnackbarWithConfig({
        message: error?.message || "Failed to download image. Please try again.",
        type: "error",
        duration: 4000,
      });
    }
    return false;
  }
};

/**
 * Shares an image from a URL by downloading it first, then opening the native share dialog
 * 
 * @param imageUrl - The URL of the image to share
 * @param bookingReference - Optional booking reference for filename
 * @param showSnackbarWithConfig - Optional snackbar function for showing success/error messages
 * @returns Promise<boolean> - True if share was successful
 */
export const shareImage = async (
  imageUrl: string,
  bookingReference?: string,
  showSnackbarWithConfig?: (config: {
    message: string;
    type: "success" | "error" | "info";
    duration?: number;
  }) => void
): Promise<boolean> => {
  try {
    // Generate filename with timestamp and booking reference
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const ref = bookingReference ? `_${bookingReference}` : "";
    const filename = `vehicle_image${ref}_${timestamp}.jpg`;
    
    // Get file extension from URL or default to jpg
    const fileExtension = imageUrl.split(".").pop()?.split("?")[0] || "jpg";
    const finalFilename = filename.replace(".jpg", `.${fileExtension}`);

    // Create file URI in cache directory
    const fileUri = `${FileSystem.cacheDirectory}${finalFilename}`;

    // Download the file
    const downloadResult = await FileSystem.downloadAsync(imageUrl, fileUri);

    if (downloadResult.status !== 200) {
      throw new Error(`Download failed with status ${downloadResult.status}`);
    }

    // Check if sharing is available
    const isAvailable = await Sharing.isAvailableAsync();

    if (isAvailable) {
      // Share the file (opens native share dialog)
      await Sharing.shareAsync(downloadResult.uri, {
        mimeType: `image/${fileExtension}`,
        dialogTitle: "Share Image",
      });

      if (showSnackbarWithConfig) {
        showSnackbarWithConfig({
          message: "Image shared successfully",
          type: "success",
          duration: 3000,
        });
      }
      return true;
    } else {
      // For platforms where sharing isn't available
      if (showSnackbarWithConfig) {
        showSnackbarWithConfig({
          message: "Sharing is not available on this device",
          type: "error",
          duration: 3000,
        });
      }
      return false;
    }
  } catch (error: any) {
    console.error("Error sharing image:", error);
    if (showSnackbarWithConfig) {
      showSnackbarWithConfig({
        message: error?.message || "Failed to share image. Please try again.",
        type: "error",
        duration: 4000,
      });
    }
    return false;
  }
};

/**
 * Hook wrapper for downloadImage and shareImage that provides snackbar automatically
 */
export const useImageDownload = () => {
  const { showSnackbarWithConfig } = useSnackbar();

  const download = async (
    imageUrl: string,
    bookingReference?: string
  ): Promise<boolean> => {
    return downloadImage(imageUrl, bookingReference, showSnackbarWithConfig);
  };

  const share = async (
    imageUrl: string,
    bookingReference?: string
  ): Promise<boolean> => {
    return shareImage(imageUrl, bookingReference, showSnackbarWithConfig);
  };

  return { download, share };
};
