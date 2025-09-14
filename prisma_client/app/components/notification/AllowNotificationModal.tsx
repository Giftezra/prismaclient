import { StyleSheet, Text, View, Dimensions } from "react-native";
import React from "react";
import { Modal } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";
import StyledButton from "../helpers/StyledButton";
import { usePermissions } from "@/app/app-hooks/usePermissions";
import { useNotification } from "@/app/app-hooks/useNotification";
import StyledText from "../helpers/StyledText";

const { width } = Dimensions.get("window");

const AllowNotificationModal = ({
  visible,
  onClose,
  onPermissionGranted,
}: {
  visible: boolean;
  onClose: () => void;
  onPermissionGranted?: () => void;
}) => {
  const backgroundColor = useThemeColor({}, "background");
  const cardColor = useThemeColor({}, "cards");
  const textColor = useThemeColor({}, "text");
  const borderColor = useThemeColor({}, "borders");
  const primaryColor = useThemeColor({}, "primary");
  const { requestNotificationPermission } = usePermissions();
  const { saveNotificationToken, expoPushToken, isSavingToken } =
    useNotification();

  /**
   * Handle the notification permission requests and call the onPermissionGranted callback if the permission is granted.
   * Also saves the push token to the server when permission is granted.
   */
  const handleEnableNotifications = async () => {
    console.log("Enable notifications pressed");
    try {
      const granted = await requestNotificationPermission();
      if (granted) {
        // Save the push token to the server
        if (expoPushToken) {
          const tokenSaved = await saveNotificationToken(expoPushToken);
          if (tokenSaved) {
            console.log(
              "Push token saved successfully after permission granted"
            );
          } else {
            console.log("Failed to save push token");
          }
        } else {
          console.log("No push token available to save");
        }

        onPermissionGranted?.();
      } else {
        console.log("Notification permission denied");
      }
    } catch (error) {
      console.error("Error requesting notification permission:", error);
    }
    onClose();
  };

  const handleNotNow = () => {
    console.log("Not now pressed");
    onClose();
  };

  return (
    <Modal visible={visible} transparent={true} animationType="fade">
      <View style={[styles.container, { backgroundColor: "transparent" }]}>
        <View style={[styles.content, { backgroundColor }]}>
          {/* Icon */}
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: primaryColor + "20" },
            ]}
          >
            <Text style={[styles.icon, { color: primaryColor }]}>🔔</Text>
          </View>

          {/* Title */}
          <StyledText style={[styles.title]} variant="titleLarge">
            Stay in the Loop!
          </StyledText>

          {/* Description */}
          <StyledText style={[styles.description]} variant="bodyMedium">
            Never miss important updates about your car services! Get notified
            about booking confirmations, service updates, and exclusive offers.
          </StyledText>

          {/* Benefits */}
          <View style={styles.benefitsContainer}>
            <View style={styles.benefitItem}>
              <StyledText style={[styles.benefitIcon, { color: primaryColor }]}>
                ✓
              </StyledText>
              <StyledText style={[styles.benefitText, { color: textColor }]}>
                Booking confirmations
              </StyledText>
            </View>
            <View style={styles.benefitItem}>
              <StyledText style={[styles.benefitIcon, { color: primaryColor }]}>
                ✓
              </StyledText>
              <StyledText style={[styles.benefitText, { color: textColor }]}>
                Service updates
              </StyledText>
            </View>
            <View style={styles.benefitItem}>
              <StyledText style={[styles.benefitIcon, { color: primaryColor }]}>
                ✓
              </StyledText>
              <StyledText style={[styles.benefitText, { color: textColor }]}>
                Exclusive offers
              </StyledText>
            </View>
          </View>

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            <StyledButton
              title={isSavingToken ? "Setting up..." : "Enable Notifications"}
              variant="large"
              onPress={handleEnableNotifications}
              style={styles.enableButton}
              disabled={isSavingToken}
            />
            <StyledButton
              title="Not Now"
              variant="medium"
              onPress={handleNotNow}
              style={[styles.notNowButton, { borderColor }]}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default AllowNotificationModal;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  content: {
    width: width - 40,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  icon: {
    fontSize: 40,
  },
  title: {
    textAlign: "center",
    marginBottom: 12,
  },
  description: {
    textAlign: "center",
    marginBottom: 24,
  },
  benefitsContainer: {
    width: "100%",
    marginBottom: 32,
  },
  benefitItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  benefitIcon: {
    fontSize: 18,
    fontWeight: "bold",
    marginRight: 12,
    width: 20,
    textAlign: "center",
  },
  benefitText: {
    fontSize: 15,
    flex: 1,
  },
  buttonContainer: {
    width: "100%",
    gap: 12,
  },
  enableButton: {
    width: "100%",
  },
  notNowButton: {
    width: "100%",
  },
});
