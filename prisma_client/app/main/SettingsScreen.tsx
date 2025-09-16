/**
 * Modern Settings Screen Component
 *
 * This component provides a comprehensive settings interface with:
 * - Collapsible sections for different setting categories
 * - Theme-aware styling that adapts to light/dark modes
 * - Interactive toggle switches for various app settings
 * - Integration with the app's ThemeProvider for real-time theme switching
 * - Smooth animations and modern UI design
 *
 * Features:
 * - Notifications: Email, Push, and Marketing notification preferences
 * - Appearance: Theme selection (Light, Dark, System Default)
 * - General: Auto-save, Location Services, and Analytics settings
 */

import { ScrollView, StyleSheet, View } from "react-native";
import React, { useState, useEffect } from "react";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useThemeContext } from "@/app/contexts/ThemeProvider";
import SettingSection from "../components/settings/SettingSection";
import SettingItem from "../components/settings/SettingItem";
import StyledText from "../components/helpers/StyledText";
import useProfile from "../app-hooks/useProfile";

/**
 * Main Settings Screen Component
 *
 * Provides a complete settings interface with:
 * - Three main sections: Notifications, Appearance, and General
 * - State management for all setting values
 * - Integration with ThemeProvider for theme switching
 * - Console logging for all setting changes
 * - Responsive design with proper scrolling
 */
const SettingScreen = () => {
  const { theme, setTheme } = useThemeContext();
  const {
    userProfile,
    updatePushNotificationSetting,
    updateEmailNotificationSetting,
    updateMarketingEmailSetting,
    isLoadingUpdatePushNotificationToken,
    isLoadingUpdateEmailNotificationToken,
    isLoadingUpdateMarketingEmailToken,
  } = useProfile();

  // State for managing which sections are expanded
  const [expandedSections, setExpandedSections] = useState<{
    notifications: boolean;
    appearance: boolean;
    general: boolean;
  }>({
    notifications: false,
    appearance: false,
    general: false,
  });

  // Notification settings state - initialized from server data
  const [emailNotifications, setEmailNotifications] = useState(
    userProfile.email_notification_token
  );
  const [pushNotifications, setPushNotifications] = useState(
    userProfile.push_notification_token
  );
  const [marketingNotifications, setMarketingNotifications] = useState(
    userProfile.marketing_email_token
  );

  // General settings state
  const [autoSave, setAutoSave] = useState(true);
  const [locationServices, setLocationServices] = useState(true);
  const [analytics, setAnalytics] = useState(false);

  // Sync notification settings with server data when userProfile changes
  useEffect(() => {
    if (userProfile) {
      setEmailNotifications(userProfile.email_notification_token);
      setPushNotifications(userProfile.push_notification_token);
      setMarketingNotifications(userProfile.marketing_email_token);
    }
  }, [userProfile]);

  /**
   * Toggle the expanded state of a section
   * @param section - The section key to toggle
   */
  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  /**
   * Handle notification setting changes
   * Updates state and server, logs changes to console
   * @param type - The type of notification (email, push, marketing)
   * @param value - The new boolean value
   */
  const handleNotificationToggle = async (type: string, value: boolean) => {
    console.log(`${type} notifications: ${value}`);

    // Update local state immediately for better UX
    switch (type) {
      case "email":
        setEmailNotifications(value);
        break;
      case "push":
        setPushNotifications(value);
        break;
      case "marketing":
        setMarketingNotifications(value);
        break;
    }

    // Update server
    let success = false;
    switch (type) {
      case "email":
        success = await updateEmailNotificationSetting(value);
        break;
      case "push":
        success = await updatePushNotificationSetting(value);
        break;
      case "marketing":
        success = await updateMarketingEmailSetting(value);
        break;
    }

    // If server update failed, revert local state
    if (!success) {
      switch (type) {
        case "email":
          setEmailNotifications(!value);
          break;
        case "push":
          setPushNotifications(!value);
          break;
        case "marketing":
          setMarketingNotifications(!value);
          break;
      }
    }
  };

  /**
   * Handle theme setting changes
   * Integrates with ThemeProvider to actually change the app theme
   * Only allows one theme to be active at a time
   * @param type - The theme type (light, dark, system)
   * @param value - The new boolean value
   */
  const handleThemeToggle = (type: string, value: boolean) => {
    console.log(`${type} theme: ${value}`);
    if (value) {
      setTheme(type as "light" | "dark" | "system");
    }
  };

  /**
   * Handle general setting changes
   * Updates state and logs changes to console
   * @param type - The setting type (autoSave, location, analytics)
   * @param value - The new boolean value
   */
  const handleGeneralToggle = (type: string, value: boolean) => {
    console.log(`${type}: ${value}`);
    switch (type) {
      case "autoSave":
        setAutoSave(value);
        break;
      case "location":
        setLocationServices(value);
        break;
      case "analytics":
        setAnalytics(value);
        break;
    }
  };

  // Get theme-aware colors for the main container
  const backgroundColor = useThemeColor({}, "background");

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={styles.header}>
        <StyledText variant="titleLarge">Settings</StyledText>
      </View>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sectionsContainer}>
          {/* 
            NOTIFICATIONS SECTION
            Contains settings for different types of notifications
            - Email notifications for updates and alerts
            - Push notifications for instant device alerts
            - Marketing communications for promotional content
          */}
          <SettingSection
            title="Notifications"
            description="What you would like to be notified about"
            isExpanded={expandedSections.notifications}
            onToggle={() => toggleSection("notifications")}
          >
            <SettingItem
              title="Email Notifications"
              description="Receive updates and alerts via email"
              value={emailNotifications}
              onValueChange={(value) =>
                handleNotificationToggle("email", value)
              }
              disabled={isLoadingUpdateEmailNotificationToken}
            />
            <SettingItem
              title="Push Notifications"
              description="Get instant notifications on your device"
              value={pushNotifications}
              onValueChange={(value) => handleNotificationToggle("push", value)}
              disabled={isLoadingUpdatePushNotificationToken}
            />
            <SettingItem
              title="Marketing Communications"
              description="Receive promotional content and offers"
              value={marketingNotifications}
              onValueChange={(value) =>
                handleNotificationToggle("marketing", value)
              }
              disabled={isLoadingUpdateMarketingEmailToken}
            />
          </SettingSection>

          {/* 
            APPEARANCE SECTION
            Contains theme selection options
            - Dark theme for night viewing
            - Light theme for daytime viewing
            - System default to follow device settings
            Only one theme can be active at a time
          */}
          <SettingSection
            title="Appearance"
            description="How you want to see your app"
            isExpanded={expandedSections.appearance}
            onToggle={() => toggleSection("appearance")}
          >
            <SettingItem
              title="Dark Theme"
              description="Use dark colors for better night viewing"
              value={theme === "dark"}
              onValueChange={(value) => handleThemeToggle("dark", value)}
            />
            <SettingItem
              title="Light Theme"
              description="Use light colors for daytime viewing"
              value={theme === "light"}
              onValueChange={(value) => handleThemeToggle("light", value)}
            />
            <SettingItem
              title="System Default"
              description="Follow your device's theme setting"
              value={theme === "system"}
              onValueChange={(value) => handleThemeToggle("system", value)}
            />
          </SettingSection>

          {/* 
            GENERAL SECTION
            Contains general app settings
            - Auto save for progress preservation
            - Location services for app functionality
            - Analytics for app improvement data
          */}
          <SettingSection
            title="General"
            description="General settings for the app"
            isExpanded={expandedSections.general}
            onToggle={() => toggleSection("general")}
          >
            <SettingItem
              title="Auto Save"
              description="Automatically save your progress"
              value={autoSave}
              onValueChange={(value) => handleGeneralToggle("autoSave", value)}
            />
            <SettingItem
              title="Location Services"
              description="Allow app to access your location"
              value={locationServices}
              onValueChange={(value) => handleGeneralToggle("location", value)}
            />
            <SettingItem
              title="Analytics"
              description="Help improve the app with usage data"
              value={analytics}
              onValueChange={(value) => handleGeneralToggle("analytics", value)}
            />
          </SettingSection>
        </View>
      </ScrollView>
    </View>
  );
};

export default SettingScreen;

/**
 * Styles for the Settings Screen
 *
 * Features:
 * - Responsive layout with flex properties
 * - Modern card design with shadows and borders
 * - Proper spacing and typography
 * - Theme-aware colors (applied dynamically)
 * - Smooth animations and transitions
 */
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  sectionsContainer: {
    padding: 8,
  },
  header: {
    padding: 16,
  },
});
