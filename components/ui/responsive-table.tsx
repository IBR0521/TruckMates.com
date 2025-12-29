'use client'

import * as React from 'react'
import { useIsMobile } from '@/hooks/use-mobile'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'

interface ResponsiveTableProps {
  headers: Array<{ key: string; label: string; className?: string }>
  data: Array<Record<string, any>>
  renderCell?: (key: string, value: any, row: Record<string, any>) => React.ReactNode
  renderMobileCard?: (row: Record<string, any>) => React.ReactNode
  className?: string
  emptyMessage?: string
}

export function ResponsiveTable({
  headers,
  data,
  renderCell,
  renderMobileCard,
  className,
  emptyMessage = "No data available",
}: ResponsiveTableProps) {
  const isMobile = useIsMobile()

  if (isMobile) {
    // Mobile: Show cards
    if (data.length === 0) {
      return (
        <Card className="border-border p-6">
          <div className="text-center py-8">
            <p className="text-muted-foreground">{emptyMessage}</p>
          </div>
        </Card>
      )
    }

    return (
      <div className="space-y-4">
        {data.map((row, index) => (
          <Card key={row.id || index} className="border-border p-4">
            {renderMobileCard ? (
              renderMobileCard(row)
            ) : (
              <div className="space-y-3">
                {headers.map((header) => {
                  const value = row[header.key]
                  return (
                    <div key={header.key} className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        {header.label}
                      </span>
                      <span className="text-sm text-foreground">
                        {renderCell ? renderCell(header.key, value, row) : (value || 'N/A')}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        ))}
      </div>
    )
  }

  // Desktop: Show table
  return (
    <Card className={cn("border-border overflow-hidden", className)}>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {headers.map((header) => (
                <TableHead key={header.key} className={header.className}>
                  {header.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={headers.length} className="text-center py-8">
                  <p className="text-muted-foreground">{emptyMessage}</p>
                </TableCell>
              </TableRow>
            ) : (
              data.map((row, index) => (
                <TableRow key={row.id || index}>
                  {headers.map((header) => {
                    const value = row[header.key]
                    return (
                      <TableCell key={header.key} className={header.className}>
                        {renderCell ? renderCell(header.key, value, row) : (value || 'N/A')}
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  )
}
