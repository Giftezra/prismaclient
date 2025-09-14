import {
  StyleSheet,
  View,
  Image,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import React from "react";
import { PromotionsProps } from "../../interfaces/GarageInterface";
import StyledText from "../helpers/StyledText";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { formatDate } from "@/app/utils/methods";
import { useThemeColor } from "@/hooks/useThemeColor";

interface PromotionsCardComponentProps {
  promotions: PromotionsProps[];
}

const PromotionsCardComponent = ({
  promotions,
}: PromotionsCardComponentProps) => {
  const borderColor = useThemeColor({}, "borders");
  const cardColor = useThemeColor({}, "cards");

  if (!promotions || promotions.length === 0) {
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
            No Promotions Available
          </StyledText>
          <StyledText variant="bodyMedium" style={styles.emptyText}>
            Check back later for exciting offers and discounts!
          </StyledText>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <StyledText variant="labelLarge" style={styles.sectionTitle}>
          Special Offers
        </StyledText>
        <Ionicons name="flash-outline" size={24} color="#007bff" />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContainer}
      >
        {promotions.map((promotion) => (
          <View key={promotion.id} style={styles.promotionCard}>
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
                  <View style={styles.activeBadge}>
                    <Ionicons name="checkmark-circle" size={16} color="white" />
                    <StyledText variant="bodySmall" style={styles.activeText}>
                      Active
                    </StyledText>
                  </View>
                )}
              </View>

              {/* Promotion Content */}
              <View style={styles.promotionContent}>
                <StyledText variant="labelLarge" style={styles.promotionTitle}>
                  {promotion.title}
                </StyledText>
                <StyledText
                  variant="bodyMedium"
                  style={styles.promotionDescription}
                >
                  {promotion.description}
                </StyledText>

                {/* Promotion Image */}
                {promotion.image && (
                  <View style={styles.imageContainer}>
                    <Image
                      source={{ uri: promotion.image }}
                      style={styles.promotionImage}
                    />
                  </View>
                )}

                {/* Validity */}
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
        ))}
      </ScrollView>
    </View>
  );
};

export default PromotionsCardComponent;

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#212529",
  },
  scrollContainer: {
    paddingHorizontal: 16,
  },
  promotionCard: {
    width: 280,
    marginRight: 10,
    borderRadius: 5,
  },
  cardGradient: {
    borderRadius: 5,
    padding: 10,
    minHeight: 200,
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
  activeBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(40, 167, 69, 0.8)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  activeText: {
    color: "white",
    fontSize: 10,
    fontWeight: "600",
  },
  promotionContent: {
    flex: 1,
  },
  promotionTitle: {
    color: "white",
    fontWeight: "700",
    fontSize: 18,
    marginBottom: 8,
  },
  promotionDescription: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  imageContainer: {
    width: "100%",
    height: 80,
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 12,
  },
  promotionImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
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
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    gap: 8,
  },
  actionButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 14,
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
