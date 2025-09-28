import React from "react";
import {
  View,
  StyleSheet,
  Modal,
  Dimensions,
  TouchableOpacity,
  ScrollView,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
import StyledText from "./StyledText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useGetTermsAndConditionsQuery } from "@/app/store/api/authApi";
import { ActivityIndicator } from "react-native-paper";
import LinearGradientComponent from "./LinearGradientComponent";

const { height } = Dimensions.get("window");

interface TermsAcceptanceModalProps {
  visible: boolean;
  onAccept: () => void;
  onClose: () => void;
  onDecline?: () => void;
}

const TermsAcceptanceModal: React.FC<TermsAcceptanceModalProps> = ({
  visible,
  onAccept,
  onClose,
  onDecline,
}) => {
  const {
    data: termsAndConditions,
    isLoading,
    isError,
  } = useGetTermsAndConditionsQuery();

  const backgroundColor = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");
  const buttonColor = useThemeColor({}, "button");

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />

        {/* Gradient Header */}
        <LinearGradientComponent
          color1= {backgroundColor}
          color2={textColor}
          style={styles.header}
          start={{ x: 0, y: 0 }}
          end={{ x: 5, y: 1 }}
        >
          {/* Navigation */}
          <View style={styles.navigation}>
            <TouchableOpacity onPress={onClose} style={styles.backButton}>
              <Ionicons name="chevron-back" size={24} color="white" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.helpButton}>
              <Ionicons name="help-circle" size={24} color="white" />
            </TouchableOpacity>
          </View>

          {/* Greeting Section */}
          <View style={styles.greetingSection}>
            <StyledText style={styles.helloText}>Hello 👋</StyledText>
            <StyledText style={styles.introText}>
              Before you create an account, please read and accept our Terms &
              Conditions
            </StyledText>
          </View>
        </LinearGradientComponent>

        {/* Content Section */}
        <View style={styles.contentSection}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={buttonColor} />
              <StyledText style={[styles.loadingText, { color: textColor }]}>
                Loading terms and conditions...
              </StyledText>
            </View>
          ) : isError ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={48} color="#D32F2F" />
              <StyledText style={[styles.errorText, { color: textColor }]}>
                Failed to load terms and conditions. Please try again.
              </StyledText>
            </View>
          ) : (
            <ScrollView
              style={styles.scrollView}
              showsVerticalScrollIndicator={true}
            >
              <View style={styles.contentContainer}>
                {/* Title */}
                <StyledText style={styles.termsTitle}>
                  Terms & Conditions
                </StyledText>

                {/* Last Updated */}
                <View style={styles.lastUpdatedContainer}>
                  <Ionicons name="time-outline" size={16} color="#666" />
                  <StyledText style={styles.lastUpdatedText}>
                    Last updated:{" "}
                    {termsAndConditions?.last_updated
                      ? new Date(
                          termsAndConditions.last_updated
                        ).toLocaleDateString("en-US", {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "N/A"}
                  </StyledText>
                </View>

                {/* Terms Content from Database */}
                <View style={styles.termsWebViewContainer}>
                  <WebView
                    originWhitelist={["*"]}
                    source={{
                      html: termsAndConditions?.content || "No terms available",
                    }}
                    style={styles.termsWebView}
                    scrollEnabled={true}
                    showsVerticalScrollIndicator={true}
                    allowsInlineMediaPlayback={true}
                    mediaPlaybackRequiresUserAction={false}
                    nestedScrollEnabled={true}
                    automaticallyAdjustContentInsets={false}
                    contentInsetAdjustmentBehavior="automatic"
                  />
                </View>
              </View>
            </ScrollView>
          )}
        </View>

        {/* Footer Buttons */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.declineButton}
            onPress={onDecline || onClose}
          >
            <StyledText style={styles.declineButtonText}>Decline</StyledText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.acceptButton, { backgroundColor: buttonColor }]}
            onPress={onAccept}
          >
            <StyledText style={styles.acceptButtonText}>Accept</StyledText>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    paddingTop: 20,
    paddingBottom: 10,
    paddingHorizontal: 20,
  },
  navigation: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 30,
  },
  backButton: {
    padding: 8,
  },
  helpButton: {
    padding: 8,
  },
  greetingSection: {
    alignItems: "flex-start",
  },
  helloText: {
    fontSize: 32,
    fontWeight: "bold",
    color: "white",
    marginBottom: 10,
  },
  introText: {
    fontSize: 16,
    color: "white",
    lineHeight: 22,
    opacity: 0.9,
  },
  contentSection: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    marginTop: 10,
    padding: 10,
    paddingBottom: 100, // Space for footer buttons
  },
  termsTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#000000",
    marginBottom: 8,
  },
  lastUpdatedContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },
  lastUpdatedText: {
    fontSize: 12,
    color: "#666666",
    marginLeft: 6,
  },
  termsWebViewContainer: {
    flex: 1, // Allow WebView to expand to fill available space
    backgroundColor: "#FFFFFF",
    minHeight: 400, // Set minimum height to ensure content is visible
  },
  termsWebView: {
    backgroundColor: "transparent",
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 20,
    textAlign: "center",
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    marginTop: 20,
    textAlign: "center",
    fontSize: 16,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    padding: 20,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E5E5E5",
    gap: 12,
  },
  declineButton: {
    flex: 1,
    height: 35,
    backgroundColor: "#F5F5F5",
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  declineButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000000",
  },
  acceptButton: {
    flex: 1,
    height: 35,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  acceptButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
  },
});

export default TermsAcceptanceModal;
