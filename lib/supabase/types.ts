export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          full_name: string | null
          role: string
          company_id: string | null
          phone: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          role?: string
          company_id?: string | null
          phone?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          role?: string
          company_id?: string | null
          phone?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      companies: {
        Row: {
          id: string
          name: string
          address: string | null
          phone: string | null
          email: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          address?: string | null
          phone?: string | null
          email?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          address?: string | null
          phone?: string | null
          email?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      drivers: {
        Row: {
          id: string
          user_id: string | null
          company_id: string | null
          name: string
          email: string | null
          phone: string | null
          license_number: string | null
          license_expiry: string | null
          status: string
          truck_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          company_id?: string | null
          name: string
          email?: string | null
          phone?: string | null
          license_number?: string | null
          license_expiry?: string | null
          status?: string
          truck_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          company_id?: string | null
          name?: string
          email?: string | null
          phone?: string | null
          license_number?: string | null
          license_expiry?: string | null
          status?: string
          truck_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      trucks: {
        Row: {
          id: string
          company_id: string | null
          truck_number: string
          make: string | null
          model: string | null
          year: number | null
          vin: string | null
          license_plate: string | null
          status: string
          current_driver_id: string | null
          current_location: string | null
          fuel_level: number | null
          mileage: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id?: string | null
          truck_number: string
          make?: string | null
          model?: string | null
          year?: number | null
          vin?: string | null
          license_plate?: string | null
          status?: string
          current_driver_id?: string | null
          current_location?: string | null
          fuel_level?: number | null
          mileage?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string | null
          truck_number?: string
          make?: string | null
          model?: string | null
          year?: number | null
          vin?: string | null
          license_plate?: string | null
          status?: string
          current_driver_id?: string | null
          current_location?: string | null
          fuel_level?: number | null
          mileage?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      routes: {
        Row: {
          id: string
          company_id: string | null
          name: string
          origin: string
          destination: string
          distance: string | null
          estimated_time: string | null
          priority: string
          driver_id: string | null
          truck_id: string | null
          status: string
          waypoints: Json | null
          estimated_arrival: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id?: string | null
          name: string
          origin: string
          destination: string
          distance?: string | null
          estimated_time?: string | null
          priority?: string
          driver_id?: string | null
          truck_id?: string | null
          status?: string
          waypoints?: Json | null
          estimated_arrival?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string | null
          name?: string
          origin?: string
          destination?: string
          distance?: string | null
          estimated_time?: string | null
          priority?: string
          driver_id?: string | null
          truck_id?: string | null
          status?: string
          waypoints?: Json | null
          estimated_arrival?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      loads: {
        Row: {
          id: string
          company_id: string | null
          shipment_number: string
          origin: string
          destination: string
          weight: string | null
          weight_kg: number | null
          contents: string | null
          value: number | null
          carrier_type: string | null
          status: string
          driver_id: string | null
          truck_id: string | null
          route_id: string | null
          load_date: string | null
          estimated_delivery: string | null
          actual_delivery: string | null
          coordinates: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id?: string | null
          shipment_number: string
          origin: string
          destination: string
          weight?: string | null
          weight_kg?: number | null
          contents?: string | null
          value?: number | null
          carrier_type?: string | null
          status?: string
          driver_id?: string | null
          truck_id?: string | null
          route_id?: string | null
          load_date?: string | null
          estimated_delivery?: string | null
          actual_delivery?: string | null
          coordinates?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string | null
          shipment_number?: string
          origin?: string
          destination?: string
          weight?: string | null
          weight_kg?: number | null
          contents?: string | null
          value?: number | null
          carrier_type?: string | null
          status?: string
          driver_id?: string | null
          truck_id?: string | null
          route_id?: string | null
          load_date?: string | null
          estimated_delivery?: string | null
          actual_delivery?: string | null
          coordinates?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      invoices: {
        Row: {
          id: string
          company_id: string | null
          invoice_number: string
          customer_name: string
          load_id: string | null
          amount: number
          status: string
          issue_date: string
          due_date: string
          payment_terms: string | null
          description: string | null
          items: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id?: string | null
          invoice_number: string
          customer_name: string
          load_id?: string | null
          amount: number
          status?: string
          issue_date: string
          due_date: string
          payment_terms?: string | null
          description?: string | null
          items?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string | null
          invoice_number?: string
          customer_name?: string
          load_id?: string | null
          amount?: number
          status?: string
          issue_date?: string
          due_date?: string
          payment_terms?: string | null
          description?: string | null
          items?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      expenses: {
        Row: {
          id: string
          company_id: string | null
          category: string
          description: string
          amount: number
          date: string
          vendor: string | null
          driver_id: string | null
          truck_id: string | null
          mileage: number | null
          payment_method: string | null
          receipt_url: string | null
          has_receipt: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id?: string | null
          category: string
          description: string
          amount: number
          date: string
          vendor?: string | null
          driver_id?: string | null
          truck_id?: string | null
          mileage?: number | null
          payment_method?: string | null
          receipt_url?: string | null
          has_receipt?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string | null
          category?: string
          description?: string
          amount?: number
          date?: string
          vendor?: string | null
          driver_id?: string | null
          truck_id?: string | null
          mileage?: number | null
          payment_method?: string | null
          receipt_url?: string | null
          has_receipt?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      settlements: {
        Row: {
          id: string
          company_id: string | null
          driver_id: string
          period_start: string
          period_end: string
          gross_pay: number
          fuel_deduction: number
          advance_deduction: number
          other_deductions: number
          total_deductions: number
          net_pay: number
          status: string
          paid_date: string | null
          payment_method: string | null
          loads: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id?: string | null
          driver_id: string
          period_start: string
          period_end: string
          gross_pay: number
          fuel_deduction?: number
          advance_deduction?: number
          other_deductions?: number
          total_deductions: number
          net_pay: number
          status?: string
          paid_date?: string | null
          payment_method?: string | null
          loads?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string | null
          driver_id?: string
          period_start?: string
          period_end?: string
          gross_pay?: number
          fuel_deduction?: number
          advance_deduction?: number
          other_deductions?: number
          total_deductions?: number
          net_pay?: number
          status?: string
          paid_date?: string | null
          payment_method?: string | null
          loads?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      maintenance: {
        Row: {
          id: string
          company_id: string | null
          truck_id: string
          service_type: string
          scheduled_date: string
          completed_date: string | null
          mileage: number | null
          status: string
          priority: string
          estimated_cost: number | null
          actual_cost: number | null
          vendor: string | null
          technician: string | null
          notes: string | null
          next_service_due_mileage: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id?: string | null
          truck_id: string
          service_type: string
          scheduled_date: string
          completed_date?: string | null
          mileage?: number | null
          status?: string
          priority?: string
          estimated_cost?: number | null
          actual_cost?: number | null
          vendor?: string | null
          technician?: string | null
          notes?: string | null
          next_service_due_mileage?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string | null
          truck_id?: string
          service_type?: string
          scheduled_date?: string
          completed_date?: string | null
          mileage?: number | null
          status?: string
          priority?: string
          estimated_cost?: number | null
          actual_cost?: number | null
          vendor?: string | null
          technician?: string | null
          notes?: string | null
          next_service_due_mileage?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      ifta_reports: {
        Row: {
          id: string
          company_id: string | null
          quarter: string
          year: number
          period: string
          total_miles: string
          fuel_purchased: string
          tax_owed: number
          status: string
          filed_date: string | null
          state_breakdown: Json | null
          truck_ids: string[] | null
          include_eld: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id?: string | null
          quarter: string
          year: number
          period: string
          total_miles: string
          fuel_purchased: string
          tax_owed: number
          status?: string
          filed_date?: string | null
          state_breakdown?: Json | null
          truck_ids?: string[] | null
          include_eld?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string | null
          quarter?: string
          year?: number
          period?: string
          total_miles?: string
          fuel_purchased?: string
          tax_owed?: number
          status?: string
          filed_date?: string | null
          state_breakdown?: Json | null
          truck_ids?: string[] | null
          include_eld?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      documents: {
        Row: {
          id: string
          company_id: string | null
          name: string
          type: string
          file_url: string
          file_size: number | null
          upload_date: string
          expiry_date: string | null
          truck_id: string | null
          driver_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id?: string | null
          name: string
          type: string
          file_url: string
          file_size?: number | null
          upload_date: string
          expiry_date?: string | null
          truck_id?: string | null
          driver_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string | null
          name?: string
          type?: string
          file_url?: string
          file_size?: number | null
          upload_date?: string
          expiry_date?: string | null
          truck_id?: string | null
          driver_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}

