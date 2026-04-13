"use client"

import { createContext, useContext } from "react"

type LoadsInitialContextValue = {
  initialLoads: any[] | null
  initialError: string | null
}

type DriversInitialContextValue = {
  initialDrivers: any[] | null
  initialCount: number | null
  initialError: string | null
}

const LoadsInitialContext = createContext<LoadsInitialContextValue>({
  initialLoads: null,
  initialError: null,
})

const DriversInitialContext = createContext<DriversInitialContextValue>({
  initialDrivers: null,
  initialCount: null,
  initialError: null,
})

export function LoadsInitialDataProvider({
  value,
  children,
}: {
  value: LoadsInitialContextValue
  children: React.ReactNode
}) {
  return <LoadsInitialContext.Provider value={value}>{children}</LoadsInitialContext.Provider>
}

export function DriversInitialDataProvider({
  value,
  children,
}: {
  value: DriversInitialContextValue
  children: React.ReactNode
}) {
  return <DriversInitialContext.Provider value={value}>{children}</DriversInitialContext.Provider>
}

export function useLoadsInitialData() {
  return useContext(LoadsInitialContext)
}

export function useDriversInitialData() {
  return useContext(DriversInitialContext)
}
