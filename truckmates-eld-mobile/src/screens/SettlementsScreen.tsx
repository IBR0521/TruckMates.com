/**
 * Settlements Screen
 * View and approve driver settlements
 */

import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { Card, Button, Divider } from 'react-native-paper'
import { getSettlements, getSettlementDetails, approveSettlement } from '../services/api'
import { COLORS } from '../constants/colors'
import { format } from 'date-fns'

interface Settlement {
  id: string
  period_start: string
  period_end: string
  gross_pay: number
  total_deductions: number
  net_pay: number
  status: string
  driver_approved: boolean
  driver_approved_at: string | null
  pdf_url: string | null
  calculation_details: any
  created_at: string
}

export default function SettlementsScreen() {
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [approvingId, setApprovingId] = useState<string | null>(null)

  const loadSettlements = async () => {
    try {
      const result = await getSettlements()
      if (result.success && result.data) {
        setSettlements(result.data)
      } else {
        console.error('Failed to load settlements:', result.error)
      }
    } catch (error) {
      console.error('Error loading settlements:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadSettlements()
  }, [])

  const handleApprove = async (settlementId: string) => {
    Alert.alert(
      'Approve Settlement',
      'Are you sure you want to approve this settlement? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          style: 'default',
          onPress: async () => {
            setApprovingId(settlementId)
            try {
              const result = await approveSettlement(settlementId, 'mobile_app')
              if (result.success) {
                Alert.alert('Success', 'Settlement approved successfully')
                loadSettlements() // Refresh list
              } else {
                Alert.alert('Error', result.error || 'Failed to approve settlement')
              }
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to approve settlement')
            } finally {
              setApprovingId(null)
            }
          },
        },
      ]
    )
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM d, yyyy')
    } catch {
      return dateString
    }
  }

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading settlements...</Text>
      </View>
    )
  }

  const pendingSettlements = settlements.filter((s) => !s.driver_approved && s.status === 'pending')
  const approvedSettlements = settlements.filter((s) => s.driver_approved)
  const otherSettlements = settlements.filter(
    (s) => s.driver_approved === false && s.status !== 'pending'
  )

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadSettlements} />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Settlements</Text>
        <Text style={styles.subtitle}>Review and approve your pay statements</Text>
      </View>

      {pendingSettlements.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pending Approval ({pendingSettlements.length})</Text>
          {pendingSettlements.map((settlement) => (
            <Card key={settlement.id} style={styles.card}>
              <Card.Content>
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.periodText}>
                      {formatDate(settlement.period_start)} - {formatDate(settlement.period_end)}
                    </Text>
                    <Text style={styles.dateText}>
                      Created: {formatDate(settlement.created_at)}
                    </Text>
                  </View>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusText}>PENDING</Text>
                  </View>
                </View>

                <Divider style={styles.divider} />

                <View style={styles.amountRow}>
                  <Text style={styles.amountLabel}>Gross Pay:</Text>
                  <Text style={styles.amountValue}>{formatCurrency(settlement.gross_pay)}</Text>
                </View>

                <View style={styles.amountRow}>
                  <Text style={styles.amountLabel}>Deductions:</Text>
                  <Text style={[styles.amountValue, styles.deductionText]}>
                    -{formatCurrency(settlement.total_deductions)}
                  </Text>
                </View>

                <Divider style={styles.divider} />

                <View style={styles.amountRow}>
                  <Text style={styles.netPayLabel}>Net Pay:</Text>
                  <Text style={styles.netPayValue}>{formatCurrency(settlement.net_pay)}</Text>
                </View>

                {settlement.calculation_details && (
                  <View style={styles.detailsContainer}>
                    <Text style={styles.detailsTitle}>Calculation Details:</Text>
                    {settlement.calculation_details.base_pay !== undefined && (
                      <Text style={styles.detailsText}>
                        Base Pay: {formatCurrency(settlement.calculation_details.base_pay)}
                      </Text>
                    )}
                    {settlement.calculation_details.bonus_total > 0 && (
                      <Text style={styles.detailsText}>
                        Bonuses: +{formatCurrency(settlement.calculation_details.bonus_total)}
                      </Text>
                    )}
                    {settlement.calculation_details.miles_used && (
                      <Text style={styles.detailsText}>
                        Miles: {settlement.calculation_details.miles_used.toLocaleString()}
                      </Text>
                    )}
                  </View>
                )}

                <Button
                  mode="contained"
                  onPress={() => handleApprove(settlement.id)}
                  disabled={approvingId === settlement.id}
                  style={styles.approveButton}
                  buttonColor={COLORS.primary}
                >
                  {approvingId === settlement.id ? 'Approving...' : 'Approve Settlement'}
                </Button>

                {settlement.pdf_url && (
                  <Button
                    mode="outlined"
                    onPress={() => {
                      // Open PDF in browser or PDF viewer
                      Alert.alert('PDF', 'PDF download feature coming soon')
                    }}
                    style={styles.pdfButton}
                  >
                    View PDF
                  </Button>
                )}
              </Card.Content>
            </Card>
          ))}
        </View>
      )}

      {approvedSettlements.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Approved ({approvedSettlements.length})</Text>
          {approvedSettlements.map((settlement) => (
            <Card key={settlement.id} style={styles.card}>
              <Card.Content>
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.periodText}>
                      {formatDate(settlement.period_start)} - {formatDate(settlement.period_end)}
                    </Text>
                    <Text style={styles.dateText}>
                      Approved: {settlement.driver_approved_at ? formatDate(settlement.driver_approved_at) : 'N/A'}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, styles.approvedBadge]}>
                    <Text style={[styles.statusText, styles.approvedText]}>APPROVED</Text>
                  </View>
                </View>

                <Divider style={styles.divider} />

                <View style={styles.amountRow}>
                  <Text style={styles.amountLabel}>Net Pay:</Text>
                  <Text style={styles.netPayValue}>{formatCurrency(settlement.net_pay)}</Text>
                </View>

                {settlement.pdf_url && (
                  <Button
                    mode="outlined"
                    onPress={() => {
                      Alert.alert('PDF', 'PDF download feature coming soon')
                    }}
                    style={styles.pdfButton}
                  >
                    View PDF
                  </Button>
                )}
              </Card.Content>
            </Card>
          ))}
        </View>
      )}

      {settlements.length === 0 && !loading && (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No settlements found</Text>
          <Text style={styles.emptySubtext}>
            Your settlements will appear here when they are created
          </Text>
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: 16,
    color: COLORS.mutedForeground,
    fontSize: 16,
  },
  header: {
    padding: 20,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.foreground,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.mutedForeground,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.foreground,
    marginBottom: 12,
  },
  card: {
    marginBottom: 16,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  periodText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.foreground,
  },
  dateText: {
    fontSize: 12,
    color: COLORS.mutedForeground,
    marginTop: 4,
  },
  statusBadge: {
    backgroundColor: COLORS.destructive,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  approvedBadge: {
    backgroundColor: COLORS.primary,
  },
  statusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  approvedText: {
    color: '#fff',
  },
  divider: {
    marginVertical: 12,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
  },
  amountLabel: {
    fontSize: 14,
    color: COLORS.mutedForeground,
  },
  amountValue: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.foreground,
  },
  deductionText: {
    color: COLORS.destructive,
  },
  netPayLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.foreground,
  },
  netPayValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  detailsContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: COLORS.background,
    borderRadius: 8,
  },
  detailsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.foreground,
    marginBottom: 8,
  },
  detailsText: {
    fontSize: 12,
    color: COLORS.mutedForeground,
    marginBottom: 4,
  },
  approveButton: {
    marginTop: 16,
  },
  pdfButton: {
    marginTop: 8,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.foreground,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.mutedForeground,
    textAlign: 'center',
  },
})



