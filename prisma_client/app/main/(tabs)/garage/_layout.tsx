import { StyleSheet, Text, View } from 'react-native'
import React from 'react'
import { Stack } from 'expo-router'

const GarageLayout = () => {
  return (
    <Stack screenOptions={{
      headerShown: false,
    }}>
      <Stack.Screen name="GarageScreen"/>
    </Stack>
  )
}

export default GarageLayout

const styles = StyleSheet.create({})