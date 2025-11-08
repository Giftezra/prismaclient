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

interface ProfileCardProps {
  profile: UserProfileProps;
  address?: MyAddressProps;
  onPaymentMethodsPress?: () => void;
  onLogoutPress?: () => void;
}

// Helper function to get loyalty tier colors and icons
const getLoyaltyTierInfo = (tier: string) => {
  switch (tier?.toLowerCase()) {
    case "bronze":
      return { color: "#CD7F32", icon: "medal", name: "Bronze" };
    case "silver":
      return { color: "#C0C0C0", icon: "medal", name: "Silver" };
    case "gold":
      return { color: "#FFD700", icon: "medal", name: "Gold" };
    case "platinum":
      return { color: "#E5E4E2", icon: "diamond", name: "Platinum" };
    default:
      return { color: "#6B7280", icon: "person", name: "Member" };
  }
};

const ProfileCard: React.FC<ProfileCardProps> = ({
  profile,
  address,
  onPaymentMethodsPress,
  onLogoutPress,
}) => {
  const backgroundColor = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");
  const cardBackground = useThemeColor({}, "cards");

  const loyaltyInfo = getLoyaltyTierInfo(profile.loyalty_tier || "");

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

      {/* Loyalty Tier Section */}
      {profile.loyalty_tier && (
        <View style={styles.loyaltySection}>
          <View style={styles.loyaltyHeader}>
            <Ionicons
              name={loyaltyInfo.icon as any}
              size={18}
              color={loyaltyInfo.color}
            />
            <StyledText
              style={[styles.loyaltyTier, { color: loyaltyInfo.color }]}
              children={loyaltyInfo.name}
            />
          </View>
          {profile.loyalty_benefits && (
            <View style={styles.benefitsContainer}>
              <StyledText style={styles.benefitsLabel}>Benefits:</StyledText>
              {profile.loyalty_benefits.discount > 0 && (
                <StyledText style={styles.benefitItem}>
                  • {profile.loyalty_benefits.discount}% discount on services
                </StyledText>
              )}
              {profile.loyalty_benefits.free_service &&
                profile.loyalty_benefits.free_service.length > 0 && (
                  <StyledText style={styles.benefitItem}>
                    • Free: {profile.loyalty_benefits.free_service.join(", ")}
                  </StyledText>
                )}
            </View>
          )}
        </View>
      )}

      <View style={styles.detailsContainer}>
        <View style={styles.detailRow}>
          <StyledText children="Phone:" />
          <StyledText children={profile.phone} />
        </View>

        {/* Address Section */}
        <View style={styles.addressSection}>
          <StyledText style={styles.sectionLabel}>Address:</StyledText>
          <View style={styles.addressContainer}>
            {(profile.address?.address || address?.address) && (
              <StyledText
                children={profile.address?.address || address?.address}
              />
            )}
            {(profile.address?.city || address?.city) && (
              <StyledText children={profile.address?.city || address?.city} />
            )}
            {(profile.address?.post_code || address?.post_code) && (
              <StyledText
                children={profile.address?.post_code || address?.post_code}
              />
            )}
            {(profile.address?.country || address?.country) && (
              <StyledText
                children={profile.address?.country || address?.country}
              />
            )}
          </View>
        </View>
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
    padding: 5,
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
  loyaltySection: {
    marginBottom: 10,
    padding: 8,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  loyaltyHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  loyaltyTier: {
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 8,
  },
  benefitsContainer: {
    marginTop: 2,
  },
  benefitsLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 2,
    opacity: 0.8,
  },
  benefitItem: {
    fontSize: 11,
    marginBottom: 1,
    opacity: 0.9,
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
    gap:5,
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

export default ProfileCard;
