import React from "react";
import { View, Text, StyleSheet, Image, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColor } from "@/hooks/useThemeColor";
import {
  MyAddressProps,
  UserProfileProps,
} from "@/app/interfaces/ProfileInterfaces";
import StyledText from "../helpers/StyledText";
import LinearGradientComponent from "../helpers/LinearGradientComponent";

interface FleetOwnerProfileCardProps {
  profile: UserProfileProps;
  address?: MyAddressProps;
  onPaymentMethodsPress?: () => void;
  onLogoutPress?: () => void;
}

const FleetOwnerProfileCard: React.FC<FleetOwnerProfileCardProps> = ({
  profile,
  address,
  onPaymentMethodsPress,
  onLogoutPress,
}) => {
  const backgroundColor = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");
  const cardBackground = useThemeColor({}, "cards");

  return (
    <LinearGradientComponent
      color1={backgroundColor}
      color2={textColor}
      style={[styles.container]}
      start={{ x: 0, y: 1 }}
      end={{ x: 2, y: 4 }}
    >
      <View style={styles.header}>
        <View
          style={[
            styles.avatar,
            { backgroundColor: useThemeColor({}, "tint") },
          ]}
        >
          <StyledText
            style={{ color: backgroundColor }}
            children={profile.name.charAt(0).toUpperCase()}
          />
        </View>
        <View style={styles.userInfo}>
          <StyledText children={profile.name} />
          <StyledText children={profile.email} />
          <StyledText children={profile.phone} />
        </View>

        {/* Logout overlay icon */}
        <Pressable style={styles.logoutOverlay} onPress={onLogoutPress}>
          <Ionicons name="log-out-outline" size={20} color={textColor} />
          <StyledText children="Logout" variant="bodySmall" />
        </Pressable>
      </View>

      {/* Payment Methods Section */}
      {onPaymentMethodsPress && (
        <View style={styles.paymentSection}>
          <View style={styles.paymentHeader}>
            <Ionicons name="card" size={18} color={textColor} />
            <StyledText
              style={[styles.paymentLabel, { color: textColor }]}
              children="Payment Methods"
            />
          </View>
          <Pressable
            style={[styles.paymentButton, { borderColor: textColor }]}
            onPress={onPaymentMethodsPress}
          >
            <StyledText
              style={[styles.paymentButtonText, { color: textColor }]}
              children="Manage Cards"
            />
            <Ionicons name="chevron-down" size={16} color={textColor} />
          </Pressable>
        </View>
      )}
    </LinearGradientComponent>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: "bold",
  },
  userInfo: {
    flex: 1,
  },
  name: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
  },
  detailsContainer: {
    gap: 8,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    width: 80,
    marginRight: 8,
  },
  value: {
    fontSize: 14,
    flex: 1,
  },
  addressSection: {
    marginTop: 4,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 3,
  },
  addressContainer: {
    gap: 1,
    paddingLeft: 6,
  },
  paymentSection: {
    marginTop: 10,
    borderTopWidth: 1,
    gap: 5,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
  },
  paymentHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  paymentLabel: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: "600",
  },
  paymentButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderRadius: 5,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  paymentButtonText: {
    fontSize: 13,
    fontWeight: "500",
  },
  logoutOverlay: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 1000,
  },
});

export default FleetOwnerProfileCard;
