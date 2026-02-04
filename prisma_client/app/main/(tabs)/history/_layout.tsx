import { StyleSheet } from 'react-native'
import React from 'react'
import { Stack } from 'expo-router'

const HistoryLayout = () => {
  return (
    <Stack screenOptions={{
        headerShown: false,
    }}>
        <Stack.Screen name="HistoryScreen" />
        <Stack.Screen name="ServiceHistoryDetailScreen" />
    </Stack>
  )
}

export default HistoryLayout

const styles = StyleSheet.create({})