import { StyleSheet, Text, View } from "react-native";
import React from "react";
import { Stack } from "expo-router";

const TabsLayout = () => {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="ProfileScreen" />
    </Stack>
  );
};

export default TabsLayout;

const styles = StyleSheet.create({});
