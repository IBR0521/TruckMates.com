import * as XLSX from 'xlsx'

export const exportToExcel = (data: any[], fileName: string, allFields?: boolean) => {
  try {
    // Handle empty data
    if (!data || data.length === 0) {
      throw new Error("No data to export")
    }

    // Convert data to worksheet format
    // Clean up the data - format dates, handle null/undefined values
    const cleanedData = data.map((row) => {
      const cleanedRow: any = {}
      Object.keys(row).forEach((key) => {
        let value = row[key]
        
        // Handle dates
        if (value instanceof Date) {
          value = value.toLocaleDateString()
        } else if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) {
          // ISO date string
          value = new Date(value).toLocaleDateString()
        }
        
        // Handle null/undefined
        if (value === null || value === undefined) {
          value = ''
        }
        
        // Handle objects/arrays (convert to JSON string)
        if (typeof value === 'object' && value !== null) {
          value = JSON.stringify(value)
        }
        
        cleanedRow[key] = value
      })
      return cleanedRow
    })

    // Create a new workbook
    const workbook = XLSX.utils.book_new()
    
    // Convert data to worksheet
    const worksheet = XLSX.utils.json_to_sheet(cleanedData)
    
    // Auto-size columns
    const maxWidth = 50 // Maximum column width
    const colWidths = Object.keys(cleanedData[0] || {}).map((key) => {
      const maxLength = Math.max(
        key.length,
        ...cleanedData.map((row) => {
          const cellValue = String(row[key] || '')
          return cellValue.length
        })
      )
      return { wch: Math.min(maxLength + 2, maxWidth) }
    })
    worksheet['!cols'] = colWidths
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1')
    
    // Generate Excel file buffer
    const excelBuffer = XLSX.write(workbook, { 
      bookType: 'xlsx', 
      type: 'array',
      cellStyles: true 
    })
    
    // Create blob and download
    const blob = new Blob([excelBuffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${fileName}-${new Date().toISOString().split('T')[0]}.xlsx`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Export error:', error)
    throw error
  }
}

export const exportToPDF = (content: string, fileName: string) => {
  // In real app, use a library like jsPDF
  // For now, create a printable HTML version
  const printWindow = window.open("", "_blank")
  if (printWindow) {
    printWindow.document.write(`
      <html>
        <head>
          <title>${fileName}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #1e3a8a; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f3f4f6; }
          </style>
        </head>
        <body>
          ${content}
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `)
    printWindow.document.close()
  }
}
