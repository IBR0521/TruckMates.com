/**
 * Status Screen
 * Display current driver status and HOS information
 */

import React from 'react'
import { View, Text, StyleSheet, ScrollView } from 'react-native'

export default function StatusScreen() {
  // TODO: Implement status display with real data
  // This is a placeholder screen structure

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Current Status</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>Current Status</Text>
          <Text style={styles.statusValue}>Driving</Text>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Hours of Service</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Remaining Drive Time:</Text>
            <Text style={styles.infoValue}>8h 30m</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Remaining On-Duty Time:</Text>
            <Text style={styles.infoValue}>4h 15m</Text>
          </View>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Location</Text>
          <Text style={styles.infoText}>Tracking active</Text>
          <Text style={styles.infoText}>Last update: Just now</Text>
        </View>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  content: {
    padding: 16,
  },
  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    marginBottom: 16,
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  statusValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  infoSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 16,
    color: '#666',
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
})

