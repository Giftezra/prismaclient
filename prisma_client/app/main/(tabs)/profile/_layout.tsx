import { StyleSheet, Text, View } from "react-native";
import React from "react";
import { Stack } from "expo-router";

const ProfileLayout = () => {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="ProfileScreen" />
      <Stack.Screen name="FleetOwnerProfileScreen" />
      <Stack.Screen name="BranchAdminProfileScreen" />
      <Stack.Screen name="SubscriptionPlanScreen" />
    </Stack>
  );
};

export default ProfileLayout;

const styles = StyleSheet.create({});
