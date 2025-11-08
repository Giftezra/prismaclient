import React from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  Image,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColor } from "@/hooks/useThemeColor";
import StyledText from "../helpers/StyledText";
import { useFetchBookingImagesQuery } from "@/app/store/api/bookingApi";

interface ServiceImagesModalProps {
  bookingId: string;
  onClose?: () => void;
}

const ServiceImagesModal: React.FC<ServiceImagesModalProps> = ({
  bookingId,
  onClose,
}) => {
  const backgroundColor = useThemeColor({}, "background");
  const cardColor = useThemeColor({}, "cards");
  const textColor = useThemeColor({}, "text");
  const borderColor = useThemeColor({}, "borders");
  const iconColor = useThemeColor({}, "icons");

  const {
    data: imagesData,
    isLoading,
    isError,
    error,
  } = useFetchBookingImagesQuery({ booking_id: bookingId });

  /**
   * Empty state component when no images are available
   */
  const EmptyState = () => (
    <View style={[styles.emptyStateContainer, { backgroundColor: cardColor }]}>
      <Ionicons name="images-outline" size={64} color={iconColor} />
      <StyledText
        variant="titleMedium"
        style={[styles.emptyStateTitle, { color: textColor }]}
      >
        No Images Available
      </StyledText>
      <StyledText
        variant="bodyMedium"
        style={[styles.emptyStateDescription, { color: textColor }]}
      >
        There are currently no images uploaded for this service.
      </StyledText>
    </View>
  );

  /**
   * Loading state component
   */
  const LoadingState = () => (
    <View style={[styles.loadingContainer, { backgroundColor: cardColor }]}>
      <ActivityIndicator size="large" color={iconColor} />
      <StyledText
        variant="bodyMedium"
        style={[styles.loadingText, { color: textColor }]}
      >
        Loading images...
      </StyledText>
    </View>
  );

  /**
   * Error state component
   */
  const ErrorState = () => (
    <View style={[styles.errorContainer, { backgroundColor: cardColor }]}>
      <Ionicons name="alert-circle-outline" size={48} color="#FF6B6B" />
      <StyledText
        variant="bodyMedium"
        style={[styles.errorText, { color: textColor }]}
      >
        Failed to load images. Please try again.
      </StyledText>
    </View>
  );

  /**
   * Image gallery section component
   */
  const ImageGallery = ({
    images,
    title,
  }: {
    images: Array<{ id: number; image_url: string; created_at: string }>;
    title: string;
  }) => {
    if (images.length === 0) return null;

    return (
      <View style={styles.section}>
        <StyledText
          variant="titleMedium"
          style={[styles.sectionTitle, { color: textColor }]}
        >
          {title}
        </StyledText>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.imageGallery}
        >
          {images.map((image) => (
            <View
              key={image.id}
              style={[
                styles.imageContainer,
                { backgroundColor: cardColor, borderColor },
              ]}
            >
              <Image
                source={{ uri: image.image_url }}
                style={styles.image}
                resizeMode="cover"
              />
            </View>
          ))}
        </ScrollView>
      </View>
    );
  };

  if (isLoading) {
    return <LoadingState />;
  }

  if (isError) {
    return <ErrorState />;
  }

  if (!imagesData) {
    return <EmptyState />;
  }

  const { before_images, after_images } = imagesData;
  const hasBeforeImages = before_images && before_images.length > 0;
  const hasAfterImages = after_images && after_images.length > 0;

  // Show empty state if no images at all
  if (!hasBeforeImages && !hasAfterImages) {
    return <EmptyState />;
  }

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {hasBeforeImages && (
          <ImageGallery images={before_images} title="Before Images" />
        )}
        {hasAfterImages && (
          <ImageGallery images={after_images} title="After Images" />
        )}
      </ScrollView>
    </View>
  );
};

export default ServiceImagesModal;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 16,
  },
  imageGallery: {
    gap: 12,
    paddingRight: 20,
  },
  imageContainer: {
    width: 280,
    height: 280,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
    borderRadius: 20,
    margin: 20,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginTop: 20,
    marginBottom: 12,
    textAlign: "center",
  },
  emptyStateDescription: {
    fontSize: 14,
    textAlign: "center",
    opacity: 0.7,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
    borderRadius: 20,
    margin: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
    borderRadius: 20,
    margin: 20,
  },
  errorText: {
    marginTop: 16,
    fontSize: 14,
    textAlign: "center",
  },
});
