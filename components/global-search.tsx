"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Command } from "cmdk"
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import {
  Load,
  Route,
  Truck,
  User,
  Package,
  FileText,
  DollarSign,
  Search,
  Clock,
} from "lucide-react"
import { getLoads } from "@/app/actions/loads"
import { getRoutes } from "@/app/actions/routes"
import { getDrivers } from "@/app/actions/drivers"
import { getTrucks } from "@/app/actions/trucks"
import { formatDate } from "@/lib/format-utils"

interface SearchResult {
  id: string
  type: "load" | "route" | "driver" | "truck" | "invoice" | "document"
  title: string
  subtitle: string
  url: string
  icon: React.ReactNode
  metadata?: string
}

export function GlobalSearch() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [recentSearches, setRecentSearches] = useState<string[]>([])

  // Load recent searches from localStorage (client-side only)
  useEffect(() => {
    if (typeof window === "undefined") return
    
    const saved = localStorage.getItem("recentSearches")
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved))
      } catch {
        // Ignore parse errors
      }
    }
  }, [])

  // Save recent searches (client-side only)
  const saveRecentSearch = (searchTerm: string) => {
    if (!searchTerm.trim() || typeof window === "undefined") return
    const updated = [
      searchTerm,
      ...recentSearches.filter((s) => s !== searchTerm),
    ].slice(0, 5)
    setRecentSearches(updated)
    localStorage.setItem("recentSearches", JSON.stringify(updated))
  }

  // Perform search
  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults([])
      return
    }

    const searchTerm = query.toLowerCase().trim()
    setIsSearching(true)

    // Debounce search
    const timeoutId = setTimeout(async () => {
      try {
        const [loadsResult, routesResult, driversResult, trucksResult] =
          await Promise.all([
            getLoads(),
            getRoutes(),
            getDrivers(),
            getTrucks(),
          ])

        const allResults: SearchResult[] = []

        // Search loads
        if (loadsResult.data) {
          loadsResult.data
            .filter(
              (load: any) =>
                load.shipment_number?.toLowerCase().includes(searchTerm) ||
                load.origin?.toLowerCase().includes(searchTerm) ||
                load.destination?.toLowerCase().includes(searchTerm) ||
                load.status?.toLowerCase().includes(searchTerm)
            )
            .slice(0, 5)
            .forEach((load: any) => {
              allResults.push({
                id: load.id,
                type: "load",
                title: load.shipment_number || "Load",
                subtitle: `${load.origin || ""} → ${load.destination || ""}`,
                url: `/dashboard/loads/${load.id}`,
                icon: <Package className="w-4 h-4" />,
                metadata: load.status,
              })
            })
        }

        // Search routes
        if (routesResult.data) {
          routesResult.data
            .filter(
              (route: any) =>
                route.name?.toLowerCase().includes(searchTerm) ||
                route.origin?.toLowerCase().includes(searchTerm) ||
                route.destination?.toLowerCase().includes(searchTerm) ||
                route.status?.toLowerCase().includes(searchTerm)
            )
            .slice(0, 5)
            .forEach((route: any) => {
              allResults.push({
                id: route.id,
                type: "route",
                title: route.name || "Route",
                subtitle: `${route.origin || ""} → ${route.destination || ""}`,
                url: `/dashboard/routes/${route.id}`,
                icon: <Route className="w-4 h-4" />,
                metadata: route.status,
              })
            })
        }

        // Search drivers
        if (driversResult.data) {
          driversResult.data
            .filter(
              (driver: any) =>
                driver.name?.toLowerCase().includes(searchTerm) ||
                driver.email?.toLowerCase().includes(searchTerm) ||
                driver.phone?.includes(searchTerm) ||
                driver.license_number?.toLowerCase().includes(searchTerm)
            )
            .slice(0, 5)
            .forEach((driver: any) => {
              allResults.push({
                id: driver.id,
                type: "driver",
                title: driver.name || "Driver",
                subtitle: driver.email || driver.phone || "",
                url: `/dashboard/drivers/${driver.id}`,
                icon: <User className="w-4 h-4" />,
                metadata: driver.status,
              })
            })
        }

        // Search trucks
        if (trucksResult.data) {
          trucksResult.data
            .filter(
              (truck: any) =>
                truck.truck_number?.toLowerCase().includes(searchTerm) ||
                truck.make?.toLowerCase().includes(searchTerm) ||
                truck.model?.toLowerCase().includes(searchTerm) ||
                truck.license_plate?.toLowerCase().includes(searchTerm)
            )
            .slice(0, 5)
            .forEach((truck: any) => {
              allResults.push({
                id: truck.id,
                type: "truck",
                title: truck.truck_number || "Truck",
                subtitle: `${truck.make || ""} ${truck.model || ""}`.trim(),
                url: `/dashboard/trucks/${truck.id}`,
                icon: <Truck className="w-4 h-4" />,
                metadata: truck.status,
              })
            })
        }

        setResults(allResults.slice(0, 20)) // Limit to 20 results
      } catch (error) {
        console.error("Search error:", error)
      } finally {
        setIsSearching(false)
      }
    }, 300) // 300ms debounce

    return () => clearTimeout(timeoutId)
  }, [query])

  // Keyboard shortcut (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setOpen(true)
      }
      if (e.key === "Escape" && open) {
        setOpen(false)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open])

  const handleSelect = (result: SearchResult) => {
    saveRecentSearch(query)
    setOpen(false)
    router.push(result.url)
    setQuery("")
  }

  // Group results by type
  const groupedResults = useMemo(() => {
    const groups: Record<string, SearchResult[]> = {}
    results.forEach((result) => {
      if (!groups[result.type]) {
        groups[result.type] = []
      }
      groups[result.type].push(result)
    })
    return groups
  }, [results])

  const typeLabels: Record<string, string> = {
    load: "Loads",
    route: "Routes",
    driver: "Drivers",
    truck: "Trucks",
    invoice: "Invoices",
    document: "Documents",
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl p-0">
        <Command className="rounded-lg border-none">
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Command.Input
              placeholder="Search loads, routes, drivers, trucks..."
              value={query}
              onValueChange={setQuery}
              className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
            {query && (
              <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
                <span className="text-xs">ESC</span>
              </kbd>
            )}
          </div>
          <Command.List className="max-h-[400px] overflow-y-auto p-2">
            {isSearching && (
              <Command.Loading>Searching...</Command.Loading>
            )}

            {!isSearching && query.length < 2 && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                <p className="mb-2">Type to search across all entities</p>
                {recentSearches.length > 0 && (
                  <div className="mt-4">
                    <p className="mb-2 text-xs font-medium">Recent Searches</p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {recentSearches.map((search, i) => (
                        <Badge
                          key={i}
                          variant="outline"
                          className="cursor-pointer"
                          onClick={() => {
                            setQuery(search)
                          }}
                        >
                          {search}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!isSearching && query.length >= 2 && results.length === 0 && (
              <Command.Empty>No results found.</Command.Empty>
            )}

            {!isSearching &&
              Object.entries(groupedResults).map(([type, items]) => (
                <Command.Group key={type} heading={typeLabels[type] || type}>
                  {items.map((result) => (
                    <Command.Item
                      key={result.id}
                      value={`${result.type}-${result.id}`}
                      onSelect={() => handleSelect(result)}
                      className="flex items-center gap-3 px-3 py-2"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                        {result.icon}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{result.title}</span>
                          {result.metadata && (
                            <Badge variant="outline" className="text-xs">
                              {result.metadata}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {result.subtitle}
                        </p>
                      </div>
                    </Command.Item>
                  ))}
                </Command.Group>
              ))}
          </Command.List>
          {results.length > 0 && (
            <div className="border-t px-3 py-2 text-xs text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>
                  {results.length} result{results.length !== 1 ? "s" : ""} found
                </span>
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
                      ↑↓
                    </kbd>{" "}
                    navigate
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
                      ↵
                    </kbd>{" "}
                    select
                  </span>
                </div>
              </div>
            </div>
          )}
        </Command>
      </DialogContent>
    </Dialog>
  )
}

