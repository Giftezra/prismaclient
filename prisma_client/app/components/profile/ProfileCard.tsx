import React from "react";
import { View, Text, StyleSheet, Image } from "react-native";
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

const ProfileCard: React.FC<ProfileCardProps> = ({ profile, address }) => {
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
        </View>
      </View>

      {/* Loyalty Tier Section */}
      {profile.loyalty_tier && (
        <View style={styles.loyaltySection}>
          <View style={styles.loyaltyHeader}>
            <Ionicons
              name={loyaltyInfo.icon as any}
              size={20}
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
            {(profile.address.address || address?.address) && (
              <StyledText
                children={profile.address.address || address?.address}
              />
            )}
            {(profile.address.city || address?.city) && (
              <StyledText children={profile.address.city || address?.city} />
            )}
            {(profile.address.post_code || address?.post_code) && (
              <StyledText
                children={profile.address.post_code || address?.post_code}
              />
            )}
            {(profile.address.country || address?.country) && (
              <StyledText
                children={profile.address.country || address?.country}
              />
            )}
          </View>
        </View>
      </View>
    </LinearGradientComponent>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 10,
    padding: 8,
    marginHorizontal: 1,
    marginVertical: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
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
    marginBottom: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  loyaltyHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  loyaltyTier: {
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 8,
  },
  benefitsContainer: {
    marginTop: 4,
  },
  benefitsLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
    opacity: 0.8,
  },
  benefitItem: {
    fontSize: 12,
    marginBottom: 2,
    opacity: 0.9,
  },
  detailsContainer: {
    gap: 12,
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
    marginTop: 8,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 6,
  },
  addressContainer: {
    gap: 2,
    paddingLeft: 8,
  },
});

export default ProfileCard;
