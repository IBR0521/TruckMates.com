"use client"

import { MarketplaceComingSoon } from "@/components/marketplace-coming-soon"

export default function MarketplacePage() {
  return <MarketplaceComingSoon />
  const router = useRouter()
  const supabase = createClient()
  const [loads, setLoads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [companyType, setCompanyType] = useState<string | null>(null)
  const [filters, setFilters] = useState({
    origin: "",
    destination: "",
    minRate: "",
    maxRate: "",
    equipmentType: "",
  })
  const [searchOrigin, setSearchOrigin] = useState("")
  const [searchDestination, setSearchDestination] = useState("")

  useEffect(() => {
    checkAuth()
    loadMarketplaceLoads()
  }, [])

  const checkAuth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setIsAuthenticated(true)
        // Get company type
        const response = await fetch("/api/get-company-type")
        const result = await response.json()
        if (result.data) {
          setCompanyType(result.data)
        }
      }
    } catch (error) {
      // User is not authenticated, continue with public view
      setIsAuthenticated(false)
    }
  }

  const loadMarketplaceLoads = async () => {
    setLoading(true)
    try {
      const result = await getMarketplaceLoads({
        origin: filters.origin || undefined,
        destination: filters.destination || undefined,
        minRate: filters.minRate ? parseFloat(filters.minRate) : undefined,
        maxRate: filters.maxRate ? parseFloat(filters.maxRate) : undefined,
        equipmentType: filters.equipmentType && filters.equipmentType !== "all" ? filters.equipmentType : undefined,
        limit: 50,
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        setLoads(result.data || [])
      }
    } catch (error) {
      toast.error("Failed to load marketplace loads")
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    setFilters({
      ...filters,
      origin: searchOrigin,
      destination: searchDestination,
    })
    loadMarketplaceLoads()
  }

  const handleFilterChange = (key: string, value: string) => {
    setFilters({ ...filters, [key]: value })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount)
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href={isAuthenticated && (companyType === "broker" || companyType === "carrier" || companyType === "both") ? "/marketplace/dashboard" : "/"}>
            <Logo size="sm" />
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/marketplace">
              <Button variant="ghost" className="hidden sm:flex">Marketplace</Button>
            </Link>
            {isAuthenticated ? (
              <>
                {(companyType === "broker" || companyType === "carrier" || companyType === "both") ? (
                  <Link href="/marketplace/dashboard">
                    <Button variant="outline" className="hidden sm:flex">
                      <LayoutDashboard className="w-4 h-4 mr-2" />
                      My Dashboard
                    </Button>
                  </Link>
                ) : (
                  <Link href="/dashboard">
                    <Button variant="outline" className="hidden sm:flex">
                      <LayoutDashboard className="w-4 h-4 mr-2" />
                      Dashboard
                    </Button>
                  </Link>
                )}
                <Button
                  variant="ghost"
                  onClick={async () => {
                    await supabase.auth.signOut()
                    router.push("/")
                    router.refresh()
                  }}
                >
                  <User className="w-4 h-4 mr-2" />
                  Sign Out
                </Button>
              </>
            ) : (
              <Link href="/login">
                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  <LogIn className="w-4 h-4 mr-2" />
                  Login
                </Button>
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-primary/10 to-background">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-4">
              Load Marketplace
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Find loads instantly. Accept them directly in TruckMates. No manual entry required.
            </p>
          </div>

          {/* Search Bar */}
          <Card className="p-6 mb-8">
            <div className="grid md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Origin</label>
                <Input
                  placeholder="City, State"
                  value={searchOrigin}
                  onChange={(e) => setSearchOrigin(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Destination</label>
                <Input
                  placeholder="City, State"
                  value={searchDestination}
                  onChange={(e) => setSearchDestination(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Equipment Type</label>
                <Select
                  value={filters.equipmentType || "all"}
                  onValueChange={(value) => handleFilterChange("equipmentType", value === "all" ? "" : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="dry_van">Dry Van</SelectItem>
                    <SelectItem value="reefer">Reefer</SelectItem>
                    <SelectItem value="flatbed">Flatbed</SelectItem>
                    <SelectItem value="step_deck">Step Deck</SelectItem>
                    <SelectItem value="box_truck">Box Truck</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button onClick={handleSearch} className="w-full">
                  <Search className="w-4 h-4 mr-2" />
                  Search Loads
                </Button>
              </div>
            </div>

            {/* Additional Filters */}
            <div className="grid md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Min Rate ($)</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={filters.minRate}
                  onChange={(e) => handleFilterChange("minRate", e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Max Rate ($)</label>
                <Input
                  type="number"
                  placeholder="No limit"
                  value={filters.maxRate}
                  onChange={(e) => handleFilterChange("maxRate", e.target.value)}
                />
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Loads List */}
      <section className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {loading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Loading loads...</p>
            </div>
          ) : loads.length === 0 ? (
            <Card className="p-12 text-center">
              <Truck className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-bold text-foreground mb-2">No loads found</h3>
              <p className="text-muted-foreground">
                Try adjusting your search filters or check back later.
              </p>
            </Card>
          ) : (
            <>
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-foreground">
                  {loads.length} Load{loads.length !== 1 ? "s" : ""} Available
                </h2>
                {isAuthenticated ? (
                  (companyType === "carrier" || companyType === "both") ? (
                    <Link href="/marketplace/dashboard">
                      <Button>
                        <LayoutDashboard className="w-4 h-4 mr-2" />
                        Go to Dashboard to Accept
                      </Button>
                    </Link>
                  ) : (
                    <Link href="/marketplace/dashboard">
                      <Button variant="outline">
                        <LayoutDashboard className="w-4 h-4 mr-2" />
                        My Dashboard
                      </Button>
                    </Link>
                  )
                ) : (
                  <Link href="/login">
                    <Button>Login to Accept Loads</Button>
                  </Link>
                )}
              </div>

              <div className="grid gap-6">
                {loads.map((load) => (
                  <Card key={load.id} className="p-6 hover:border-primary/50 transition-colors">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                      <div className="flex-1">
                        {load.id && typeof load.id === 'string' && load.id.trim() !== '' ? (
                          <Link href={`/marketplace/${load.id}`} className="block hover:opacity-80 transition-opacity">
                            <div className="flex items-start gap-4 mb-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <Badge variant="outline" className="text-sm">
                                    {load.equipment_type || "Any Equipment"}
                                  </Badge>
                                  <Badge variant="secondary" className="text-sm">
                                    {formatCurrency(load.rate)}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                  <MapPin className="w-4 h-4" />
                                  <span className="font-medium">{load.origin}</span>
                                  <span>→</span>
                                  <span className="font-medium">{load.destination}</span>
                                </div>
                                {load.weight && (
                                  <p className="text-sm text-muted-foreground mb-1">
                                    Weight: {load.weight}
                                  </p>
                                )}
                                {load.contents && (
                                  <p className="text-sm text-muted-foreground mb-1">
                                    Contents: {load.contents}
                                  </p>
                                )}
                                {load.pickup_date && (
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Calendar className="w-4 h-4" />
                                    <span>
                                      Pickup: {format(new Date(load.pickup_date), "MMM d, yyyy")}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                            {load.notes && (
                              <p className="text-sm text-muted-foreground mt-2">{load.notes}</p>
                            )}
                          </Link>
                        ) : (
                          <div className="flex items-start gap-4 mb-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <Badge variant="outline" className="text-sm">
                                  {load.equipment_type || "Any Equipment"}
                                </Badge>
                                <Badge variant="secondary" className="text-sm">
                                  {formatCurrency(load.rate)}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                <MapPin className="w-4 h-4" />
                                <span className="font-medium">{load.origin}</span>
                                <span>→</span>
                                <span className="font-medium">{load.destination}</span>
                              </div>
                              {load.weight && (
                                <p className="text-sm text-muted-foreground mb-1">
                                  Weight: {load.weight}
                                </p>
                              )}
                              {load.contents && (
                                <p className="text-sm text-muted-foreground mb-1">
                                  Contents: {load.contents}
                                </p>
                              )}
                              {load.pickup_date && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Calendar className="w-4 h-4" />
                                  <span>
                                    Pickup: {format(new Date(load.pickup_date), "MMM d, yyyy")}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 md:items-end">
                        <div className="text-right mb-2">
                          <div className="text-2xl font-bold text-primary">
                            {formatCurrency(load.rate)}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {load.rate_type === "per_mile" ? "per mile" : "flat rate"}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {load.id && typeof load.id === 'string' && load.id.trim() !== '' ? (
                            <Link href={`/marketplace/${load.id}`}>
                              <Button variant="outline" className="w-full md:w-auto">
                                View Details
                              </Button>
                            </Link>
                          ) : null}
                          {isAuthenticated && (companyType === "carrier" || companyType === "both") ? (
                            load.id && typeof load.id === 'string' && load.id.trim() !== '' ? (
                              <Link href={`/marketplace/${load.id}`}>
                                <Button className="w-full md:w-auto bg-primary hover:bg-primary/90">
                                  <Truck className="w-4 h-4 mr-2" />
                                  Accept Load
                                </Button>
                              </Link>
                            ) : (
                              <Button disabled className="w-full md:w-auto">
                                <Truck className="w-4 h-4 mr-2" />
                                Accept Load
                              </Button>
                            )
                          ) : isAuthenticated ? (
                            <Link href="/marketplace/dashboard">
                              <Button variant="outline" className="w-full md:w-auto">
                                Go to Dashboard
                              </Button>
                            </Link>
                          ) : (
                            <Link href="/login">
                              <Button className="w-full md:w-auto">
                                <Truck className="w-4 h-4 mr-2" />
                                Accept Load
                              </Button>
                            </Link>
                          )}
                        </div>
                        {!isAuthenticated && (
                          <p className="text-xs text-muted-foreground text-center md:text-right">
                            Login required to accept
                          </p>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 px-4 sm:px-6 lg:px-8 bg-secondary/30">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <Logo size="sm" />
              <p className="text-sm text-muted-foreground mt-4">
                Complete fleet management platform with integrated load marketplace.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Marketplace</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="/marketplace" className="hover:text-primary">
                    Browse Loads
                  </Link>
                </li>
                <li>
                  <Link href="/register" className="hover:text-primary">
                    Post Loads
                  </Link>
                </li>
                <li>
                  <Link href="/login" className="hover:text-primary">
                    Accept Loads
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="/demo" className="hover:text-primary">
                    Demo
                  </Link>
                </li>
                <li>
                  <Link href="/register" className="hover:text-primary">
                    Sign Up
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="/login" className="hover:text-primary">
                    Login
                  </Link>
                </li>
                <li>Support</li>
                <li>Documentation</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border pt-8 flex flex-col sm:flex-row items-center justify-between">
            <p className="text-sm text-muted-foreground">© 2025 TruckMates. All rights reserved.</p>
            <div className="flex gap-6 mt-4 sm:mt-0">
              <Link href="/privacy" className="text-sm text-muted-foreground hover:text-primary">
                Privacy
              </Link>
              <Link href="/terms" className="text-sm text-muted-foreground hover:text-primary">
                Terms
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

