import React, { useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  Image,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColor } from "@/hooks/useThemeColor";
import StyledText from "../helpers/StyledText";
import { useFetchBookingImagesQuery } from "@/app/store/api/serviceHistoryApi";
import { useSnackbar } from "@/app/contexts/SnackbarContext";
import { useModalService } from "@/app/contexts/ModalServiceProvider";

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
  const { showSnackbarWithConfig } = useSnackbar();
  const { closeModal } = useModalService();
  const hasNotifiedRef = useRef(false);

  const beforeImagesInterior = imagesData?.before_images_interior ?? [];
  const beforeImagesExterior = imagesData?.before_images_exterior ?? [];
  const afterImagesInterior = imagesData?.after_images_interior ?? [];
  const afterImagesExterior = imagesData?.after_images_exterior ?? [];
  
  const hasBeforeImagesInterior = beforeImagesInterior.length > 0;
  const hasBeforeImagesExterior = beforeImagesExterior.length > 0;
  const hasAfterImagesInterior = afterImagesInterior.length > 0;
  const hasAfterImagesExterior = afterImagesExterior.length > 0;
  
  const hasBeforeImages = hasBeforeImagesInterior || hasBeforeImagesExterior;
  const hasAfterImages = hasAfterImagesInterior || hasAfterImagesExterior;
  const hasAnyImages = hasBeforeImages || hasAfterImages;

  useEffect(() => {
    if (!isLoading && !isError && !hasAnyImages && !hasNotifiedRef.current) {
      hasNotifiedRef.current = true;
      showSnackbarWithConfig({
        message:
          "No images are available yet. Your appointment has not started.",
        type: "info",
        duration: 3500,
      });
      closeModal();
    }
  }, [closeModal, hasAnyImages, isError, isLoading, showSnackbarWithConfig]);

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
   * Access denied state component
   */
  const AccessDeniedState = () => (
    <View style={[styles.emptyStateContainer, { backgroundColor: cardColor }]}>
      <Ionicons name="lock-closed-outline" size={64} color={iconColor} />
      <StyledText
        variant="titleMedium"
        style={[styles.emptyStateTitle, { color: textColor }]}
      >
        Access Restricted
      </StyledText>
      <StyledText
        variant="bodyMedium"
        style={[styles.emptyStateDescription, { color: textColor }]}
      >
        {imagesData?.message || "Detailed vehicle information is only available with an active fleet subscription."}
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

  // Check for access denied (subscription restriction for fleet users)
  if (imagesData?.access_denied) {
    return <AccessDeniedState />;
  }

  if (!imagesData || !hasAnyImages) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {hasBeforeImagesInterior && (
          <ImageGallery images={beforeImagesInterior} title="Before Images - Interior" />
        )}
        {hasBeforeImagesExterior && (
          <ImageGallery images={beforeImagesExterior} title="Before Images - Exterior" />
        )}
        {hasAfterImagesInterior && (
          <ImageGallery images={afterImagesInterior} title="After Images - Interior" />
        )}
        {hasAfterImagesExterior && (
          <ImageGallery images={afterImagesExterior} title="After Images - Exterior" />
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
