import { StyleSheet, View, Pressable } from "react-native";
import React from "react";
import { PromotionsProps } from "../../interfaces/GarageInterface";
import StyledText from "../helpers/StyledText";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { formatDate } from "@/app/utils/methods";
import { useThemeColor } from "@/hooks/useThemeColor";

const PromotionsCard = (promotion: PromotionsProps) => {
  const borderColor = useThemeColor({}, "borders");
  const cardColor = useThemeColor({}, "cards");

  if (!promotion) {
    return (
      <View style={styles.emptyContainer}>
        <LinearGradient
          colors={["#f8f9fa", "#e9ecef"]}
          style={styles.emptyCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Ionicons name="gift-outline" size={48} color="#6c757d" />
          <StyledText variant="labelLarge" style={styles.emptyTitle}>
            No Promotion Available
          </StyledText>
          <StyledText variant="bodyMedium" style={styles.emptyText}>
            Check back later for exciting offers and discounts!
          </StyledText>
        </LinearGradient>
      </View>
    );
  }

  return (
    <Pressable style={styles.container}>
      <View style={styles.promotionCard}>
        <LinearGradient
          colors={
            promotion.is_active
              ? [cardColor, "#ee5a52"]
              : ["#6c757d", cardColor]
          }
          style={styles.cardGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 4, y: 3 }}
        >
          {/* Promotion Header */}
          <View style={styles.promotionHeader}>
            <View style={[styles.discountBadge, { borderColor }]}>
              <StyledText variant="labelMedium" style={styles.discountText}>
                {promotion.discount_percentage}% OFF
              </StyledText>
            </View>
            {promotion.is_active && (
              <View style={styles.activeBadgeContainer}>
                <View style={styles.activeBadge}>
                  <Ionicons name="checkmark-circle" size={16} color="white" />
                  <StyledText variant="bodySmall" style={styles.activeText}>
                    Active
                  </StyledText>
                </View>
              </View>
            )}
          </View>

          {/* Promotion Content */}
          <View style={styles.promotionContent}>
            {/* Title */}
            <StyledText variant="titleMedium" style={styles.promotionTitle}>
              {promotion.title}
            </StyledText>

            {/* Validity */}
            <View
              style={[
                styles.validityContainer,
                { justifyContent: "space-between" },
              ]}
            >
              <View style={styles.validityContainer}>
                <Ionicons
                  name="time-outline"
                  size={16}
                  color="rgba(255,255,255,0.8)"
                />
                <StyledText variant="bodySmall" style={styles.validityText}>
                  Valid until {formatDate(promotion.valid_until)}
                </StyledText>
              </View>

              <StyledText variant="bodySmall" style={styles.clickToApplyText}>
                Click to apply
              </StyledText>
            </View>

            {/* Terms & Conditions */}
            {promotion.terms_conditions && (
              <View style={styles.termsContainer}>
                <Ionicons
                  name="information-circle-outline"
                  size={16}
                  color="rgba(255,255,255,0.8)"
                />
                <StyledText variant="bodySmall" style={styles.termsText}>
                  Terms apply
                </StyledText>
              </View>
            )}
          </View>
        </LinearGradient>
      </View>
    </Pressable>
  );
};

export default PromotionsCard;

const styles = StyleSheet.create({
  container: {
    marginVertical: 5,
    paddingHorizontal: 5,
  },
  promotionCard: {
    width: "100%",
    borderRadius: 12,
  },
  cardGradient: {
    borderRadius: 12,
    padding: 5,
    height: 110,
  },
  promotionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  discountBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  discountText: {
    color: "white",
    fontWeight: "700",
    fontSize: 14,
  },
  activeBadgeContainer: {
    alignItems: "flex-end",
  },
  activeBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(40, 167, 69, 0.8)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    marginBottom: 4,
  },
  activeText: {
    color: "white",
    fontSize: 10,
    fontWeight: "600",
  },
  clickToApplyText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 10,
    fontWeight: "500",
  },
  promotionContent: {
    flex: 1,
  },
  promotionTitle: {
    color: "white",
    fontWeight: "600",
    marginBottom: 8,
    fontSize: 18,
  },
  validityContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 6,
  },
  validityText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
  },
  termsContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  termsText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
  },
  emptyContainer: {
    margin: 16,
  },
  emptyCard: {
    padding: 32,
    borderRadius: 16,
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  emptyTitle: {
    color: "#6c757d",
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    color: "#6c757d",
    textAlign: "center",
    lineHeight: 20,
  },
});
