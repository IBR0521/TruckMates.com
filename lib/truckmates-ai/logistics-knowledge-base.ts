/**
 * Logistics Knowledge Base
 * Comprehensive database of logistics industry knowledge
 * This is the foundation of TruckMates AI expertise
 */

export interface FMCSARegulation {
  id: string
  title: string
  content: string
  category: string
  tags: string[]
}

export interface HOSRule {
  id: string
  title: string
  content: string
  category: string
  tags: string[]
}

export interface IFTARegulation {
  id: string
  title: string
  content: string
  category: string
  tags: string[]
}

export interface DOTRegulation {
  id: string
  title: string
  content: string
  category: string
  tags: string[]
}

export interface KPIBenchmark {
  id: string
  metric: string
  industry_average: number
  excellent: number
  good: number
  fair: number
  poor: number
  description: string
  calculation?: string
  unit?: string
}

export interface BestPractice {
  id: string
  title: string
  content: string
  category: string
  tags: string[]
}

export interface Terminology {
  term: string
  definition: string
  context: string
  example: string
}

export interface PricingStrategy {
  id: string
  title: string
  content: string
  category: string
}

export interface CostStructure {
  id: string
  title: string
  content: string
  category: string
}

export interface LogisticsKnowledge {
  regulations: {
    fmcsa: FMCSARegulation[]
    hos: HOSRule[]
    ifta: IFTARegulation[]
    dot: DOTRegulation[]
  }
  standards: {
    kpi_benchmarks: KPIBenchmark[]
    best_practices: BestPractice[]
    terminology: Terminology[]
  }
  business: {
    pricing_strategies: PricingStrategy[]
    cost_structures: CostStructure[]
  }
}

/**
 * Logistics Knowledge Base
 * Comprehensive knowledge repository for TruckMates AI
 */
export class LogisticsKnowledgeBase {
  private knowledge: LogisticsKnowledge

  constructor() {
    this.knowledge = this.initializeKnowledge()
  }

  private initializeKnowledge(): LogisticsKnowledge {
    return {
      regulations: {
        fmcsa: [
          {
            id: "fmcsa-001",
            title: "Hours of Service (HOS) Rules",
            content: `FMCSA Hours of Service Regulations:

1. 11-Hour Driving Limit: A driver may drive a maximum of 11 hours after 10 consecutive hours off duty.

2. 14-Hour On-Duty Limit: A driver may not drive after being on duty for 14 hours, following 10 consecutive hours off duty. This includes all on-duty time, not just driving.

3. 30-Minute Break Requirement: A driver must take a 30-minute break after 8 cumulative hours of driving.

4. 10-Hour Off-Duty Requirement: A driver must have at least 10 consecutive hours off duty before starting a new shift.

5. 60/70-Hour Limit: A driver may not drive after accumulating 60 hours on duty in 7 consecutive days, or 70 hours in 8 consecutive days.

6. Sleeper Berth Provision: Allows drivers to split their 10-hour rest period into two periods (one at least 8 hours in sleeper berth, one at least 2 hours).

Violations can result in fines, out-of-service orders, and CSA score impacts.`,
            category: "compliance",
            tags: ["HOS", "FMCSA", "driving limits", "compliance"]
          },
          {
            id: "fmcsa-002",
            title: "ELD Mandate Requirements",
            content: `Electronic Logging Device (ELD) Mandate:

- All commercial motor vehicles (CMVs) must use ELDs to record HOS
- ELDs must be FMCSA-certified and registered
- Drivers must be trained on ELD use
- ELDs automatically record driving time when vehicle is in motion
- Data must be transferable to enforcement officers via USB or wireless transfer
- ELDs must be synchronized with vehicle engine to prevent tampering

Exceptions: Short-haul drivers (100 air-mile radius), drivers who use paper logs fewer than 8 days in 30-day period.`,
            category: "compliance",
            tags: ["ELD", "mandate", "FMCSA", "electronic logs"]
          },
          {
            id: "fmcsa-003",
            title: "CSA (Compliance, Safety, Accountability) Program",
            content: `CSA Program Overview:

- Measures carrier safety performance through Behavior Analysis and Safety Improvement Categories (BASICs)
- Seven BASICs: Unsafe Driving, Crash Indicator, HOS Compliance, Vehicle Maintenance, Controlled Substances, Hazardous Materials, Driver Fitness
- Scores range from 0-100 (lower is better)
- Scores above intervention threshold trigger enforcement action
- Public scores affect insurance rates and business opportunities

Best Practices:
- Maintain HOS compliance (avoid violations)
- Regular vehicle inspections and maintenance
- Driver training and qualification
- Proper documentation and record-keeping`,
            category: "compliance",
            tags: ["CSA", "safety", "compliance", "BASICs"]
          }
        ],
        
        hos: [
          {
            id: "hos-001",
            title: "Property-Carrying Driver HOS Rules",
            content: `Property-carrying drivers (most freight carriers):

- 11 hours driving within 14-hour window
- 10 hours off-duty required
- 30-minute break after 8 hours driving
- 60/70-hour weekly limit
- Sleeper berth exception available

Calculation example:
- Driver starts at 6:00 AM
- Can drive until 8:00 PM (14 hours on-duty limit)
- Must have 10 hours off before next shift
- If driver drives 11 hours, must take 10-hour break before driving again`,
            category: "HOS",
            tags: ["property", "11-hour", "14-hour"]
          },
          {
            id: "hos-002",
            title: "Sleeper Berth Provision",
            content: `Sleeper Berth Exception:

Allows drivers to split their 10-hour rest period:
- One period of at least 8 hours in sleeper berth
- One period of at least 2 hours (can be off-duty or sleeper berth)
- Total must equal at least 10 hours

Example:
- Driver takes 8 hours in sleeper berth (6 PM - 2 AM)
- Driver takes 2 hours off-duty (2 PM - 4 PM)
- Total rest: 10 hours (satisfies requirement)

This provides flexibility in scheduling while maintaining safety.`,
            category: "HOS",
            tags: ["sleeper berth", "split rest", "flexibility"]
          },
          {
            id: "hos-003",
            title: "30-Minute Break Requirement",
            content: `30-Minute Break Rule:

- Required after 8 cumulative hours of driving
- Break can be: off-duty, sleeper berth, or on-duty (not driving)
- Must be taken before continuing to drive
- Cannot be split into smaller periods

Example:
- Driver drives 8 hours (6 AM - 2 PM)
- Must take 30-minute break
- Can continue driving after break (if within 14-hour window)

Violation: Driving more than 8 hours without break results in HOS violation.`,
            category: "HOS",
            tags: ["break", "30-minute", "8-hour"]
          }
        ],
        
        ifta: [
          {
            id: "ifta-001",
            title: "IFTA Fuel Tax Reporting",
            content: `International Fuel Tax Agreement (IFTA):

- Quarterly reporting required (Q1, Q2, Q3, Q4)
- Report fuel purchases and miles traveled in each jurisdiction
- Calculate tax owed based on fuel consumed in each state/province
- File by last day of month following quarter end
- Must maintain detailed records of fuel purchases and mileage

Calculation:
Tax Owed = (Miles in State / Total Miles) × Total Fuel Purchased × State Tax Rate

Example:
- Total miles: 10,000
- Miles in California: 3,000
- Total fuel: 1,200 gallons
- CA tax rate: $0.47/gallon
- Tax owed: (3,000 / 10,000) × 1,200 × $0.47 = $169.20`,
            category: "IFTA",
            tags: ["fuel tax", "quarterly", "reporting"]
          },
          {
            id: "ifta-002",
            title: "IFTA Quarterly Filing Deadlines",
            content: `IFTA Filing Deadlines:

- Q1 (Jan-Mar): File by April 30
- Q2 (Apr-Jun): File by July 31
- Q3 (Jul-Sep): File by October 31
- Q4 (Oct-Dec): File by January 31

Late Filing Penalties:
- 10% of tax due or $50, whichever is greater
- Interest accrues on unpaid taxes

Best Practice: File early to avoid penalties and ensure accurate reporting.`,
            category: "IFTA",
            tags: ["deadlines", "filing", "penalties"]
          }
        ],
        
        dot: [
          {
            id: "dot-001",
            title: "DOT Number Requirements",
            content: `DOT Number Requirements:

- Required for vehicles over 10,000 lbs GVWR
- Required for vehicles transporting 9+ passengers
- Required for vehicles transporting hazardous materials
- Must display DOT number on both sides of vehicle
- Must update MCS-150 form every 24 months or when information changes

Penalties for non-compliance: Up to $10,000 per violation.`,
            category: "DOT",
            tags: ["DOT number", "registration", "compliance"]
          },
          {
            id: "dot-002",
            title: "DOT Inspection Requirements",
            content: `DOT Inspection Levels:

Level 1 - Full Inspection:
- Driver credentials
- Vehicle inspection (brakes, tires, lights, etc.)
- Cargo securement
- Hours of Service logs

Level 2 - Walk-Around Inspection:
- Driver credentials
- Vehicle walk-around inspection

Level 3 - Driver-Only Inspection:
- Driver credentials
- HOS logs
- Medical certificate

Level 4 - Special Inspection:
- Focused inspection on specific items

Level 5 - Vehicle-Only Inspection:
- Vehicle inspection without driver present

Best Practice: Maintain vehicles and documentation to pass inspections.`,
            category: "DOT",
            tags: ["inspection", "compliance", "safety"]
          }
        ]
      },
      
      standards: {
        kpi_benchmarks: [
          {
            id: "kpi-001",
            metric: "Fleet Utilization",
            industry_average: 85,
            excellent: 95,
            good: 85,
            fair: 75,
            poor: 65,
            description: "Percentage of time trucks are generating revenue",
            calculation: "(Revenue Miles / Total Available Miles) × 100"
          },
          {
            id: "kpi-002",
            metric: "On-Time Delivery Rate",
            industry_average: 95,
            excellent: 98,
            good: 95,
            fair: 90,
            poor: 85,
            description: "Percentage of loads delivered on time",
            calculation: "(On-Time Deliveries / Total Deliveries) × 100"
          },
          {
            id: "kpi-003",
            metric: "Fuel Efficiency",
            industry_average: 7.0,
            excellent: 8.5,
            good: 7.5,
            fair: 6.5,
            poor: 5.5,
            description: "Miles per gallon",
            unit: "MPG"
          },
          {
            id: "kpi-004",
            metric: "Cost Per Mile",
            industry_average: 1.85,
            excellent: 1.65,
            good: 1.85,
            fair: 2.05,
            poor: 2.25,
            description: "Total operating cost per mile",
            unit: "USD"
          },
          {
            id: "kpi-005",
            metric: "Driver Turnover Rate",
            industry_average: 90,
            excellent: 30,
            good: 50,
            fair: 75,
            poor: 100,
            description: "Annual driver turnover percentage",
            calculation: "(Drivers Left / Average Drivers) × 100"
          },
          {
            id: "kpi-006",
            metric: "Deadhead Percentage",
            industry_average: 20,
            excellent: 10,
            good: 15,
            fair: 25,
            poor: 35,
            description: "Percentage of miles driven without a load",
            calculation: "(Deadhead Miles / Total Miles) × 100"
          },
          {
            id: "kpi-007",
            metric: "Revenue Per Mile",
            industry_average: 2.20,
            excellent: 2.50,
            good: 2.30,
            fair: 2.10,
            poor: 1.90,
            description: "Average revenue generated per mile",
            unit: "USD"
          },
          {
            id: "kpi-008",
            metric: "Profit Margin",
            industry_average: 15,
            excellent: 25,
            good: 20,
            fair: 12,
            poor: 5,
            description: "Profit as percentage of revenue",
            calculation: "((Revenue - Costs) / Revenue) × 100"
          }
        ],
        
        best_practices: [
          {
            id: "bp-001",
            title: "Load Planning Best Practices",
            content: `1. Plan routes 24-48 hours in advance
2. Consider driver HOS availability when assigning loads
3. Factor in traffic patterns and weather
4. Optimize for backhaul opportunities
5. Verify equipment compatibility before dispatch
6. Confirm pickup/delivery windows with shippers/receivers
7. Build buffer time for unexpected delays (15-20% of estimated time)
8. Use historical data to predict loading/unloading times
9. Consider driver preferences and home time
10. Plan for fuel stops at optimal locations`,
            category: "operations",
            tags: ["planning", "dispatch", "routing"]
          },
          {
            id: "bp-002",
            title: "Driver Retention Strategies",
            content: `1. Competitive pay: Industry average is $0.50-$0.60 per mile
2. Consistent home time: Schedule regular time off
3. Modern equipment: Drivers prefer newer, well-maintained trucks
4. Clear communication: Regular check-ins, transparent policies
5. Performance bonuses: Reward safe driving, on-time delivery
6. Benefits package: Health insurance, retirement plans
7. Technology: User-friendly ELD and dispatch systems
8. Respect: Treat drivers as professionals, not just employees
9. Career development: Training opportunities, advancement paths
10. Equipment preferences: Allow drivers input on truck assignments`,
            category: "management",
            tags: ["retention", "drivers", "HR"]
          },
          {
            id: "bp-003",
            title: "Fuel Cost Optimization",
            content: `1. Monitor fuel prices along routes
2. Use fuel cards with discounts
3. Plan fuel stops at locations with lower prices
4. Maintain proper tire pressure (improves MPG by 3-5%)
5. Reduce idling time (use APU or shore power)
6. Optimize routes to reduce miles
7. Train drivers on fuel-efficient driving techniques
8. Regular vehicle maintenance (filters, engine tune-ups)
9. Use fuel additives for better efficiency
10. Track fuel consumption and identify outliers`,
            category: "costs",
            tags: ["fuel", "cost optimization", "efficiency"]
          },
          {
            id: "bp-004",
            title: "HOS Compliance Best Practices",
            content: `1. Plan routes with HOS limits in mind
2. Build buffer time (don't plan to use full 11 hours)
3. Monitor driver HOS in real-time
4. Alert drivers before they hit limits
5. Use sleeper berth provision for flexibility
6. Train dispatchers on HOS rules
7. Review HOS violations regularly
8. Address violations immediately
9. Use ELD data for accurate tracking
10. Plan rest stops in advance`,
            category: "compliance",
            tags: ["HOS", "compliance", "safety"]
          }
        ],
        
        terminology: [
          {
            term: "Deadhead",
            definition: "Miles driven without a load, generating no revenue",
            context: "High deadhead percentage reduces profitability",
            example: "Driver drove 200 miles deadhead to pickup, then 500 miles loaded"
          },
          {
            term: "Backhaul",
            definition: "A return load that uses the truck's return trip efficiently",
            context: "Finding backhauls improves fleet utilization and profitability",
            example: "After delivering in Dallas, driver picked up a backhaul to Chicago"
          },
          {
            term: "Layover",
            definition: "Time a driver waits at a location, often unpaid",
            context: "Excessive layovers reduce driver satisfaction and efficiency",
            example: "Driver had a 6-hour layover waiting for dock availability"
          },
          {
            term: "Detention",
            definition: "Time spent waiting at shipper/receiver beyond free time (usually 2 hours)",
            context: "Detention should be billed to customer at hourly rate",
            example: "Driver was detained 3 hours at receiver, billed $150 detention fee"
          },
          {
            term: "Lumper",
            definition: "Fee paid to warehouse workers to load/unload freight",
            context: "Lumper fees should be passed to customer or factored into rate",
            example: "Receiver charged $200 lumper fee for unloading"
          },
          {
            term: "Accessorial",
            definition: "Additional charges beyond base rate (detention, layover, tarping, etc.)",
            context: "Accessorials can significantly impact profitability",
            example: "Load included $300 in accessorial charges (detention + tarping)"
          },
          {
            term: "Fuel Surcharge",
            definition: "Additional charge added to base rate to offset fuel costs",
            context: "Fuel surcharge helps carriers maintain margins when fuel prices fluctuate",
            example: "Base rate $2,000 + $200 fuel surcharge = $2,200 total"
          },
          {
            term: "BOL (Bill of Lading)",
            definition: "Legal document that details the shipment and serves as receipt",
            context: "BOL is required for all shipments and must be accurate",
            example: "Driver obtained signed BOL at pickup, confirming cargo details"
          },
          {
            term: "POD (Proof of Delivery)",
            definition: "Document confirming delivery, usually signed by receiver",
            context: "POD is required for invoicing and payment",
            example: "POD was captured via mobile app at delivery location"
          },
          {
            term: "CSA Score",
            definition: "Compliance, Safety, Accountability score (0-100, lower is better)",
            context: "CSA scores affect insurance rates and business opportunities",
            example: "Carrier's CSA score of 45 is above intervention threshold"
          }
        ]
      },
      
      business: {
        pricing_strategies: [
          {
            id: "pricing-001",
            title: "Rate Calculation Methodology",
            content: `Standard Rate Calculation:

Base Rate = (Distance × Rate Per Mile) + Accessorials

Rate Per Mile Factors:
- Equipment type (dry van: $1.50-$2.50/mile, flatbed: $2.00-$3.00/mile)
- Lane popularity (high-demand lanes command premium)
- Fuel costs (current diesel price affects rate)
- Market conditions (supply/demand)
- Seasonality (peak seasons = higher rates)

Accessorial Charges:
- Detention: $50-$100/hour after 2 hours free time
- Layover: $150-$300/day
- Tarping: $50-$200
- Driver assist: $50-$150
- Re-delivery: $200-$500
- Fuel surcharge: Based on current fuel prices

Profit Margin Target: 15-25% after all costs`,
            category: "pricing"
          },
          {
            id: "pricing-002",
            title: "Market Rate Analysis",
            content: `How to Determine Competitive Rates:

1. Check load boards (DAT, Truckstop) for similar lanes
2. Analyze historical rates for the same lane
3. Consider current market conditions (supply/demand)
4. Factor in fuel costs and fuel surcharge
5. Account for equipment type and special requirements
6. Consider time of year (seasonal variations)
7. Evaluate customer relationship (preferred vs new)
8. Calculate minimum acceptable rate (cost + target margin)

Best Practice: Always know your cost per mile to determine minimum acceptable rate.`,
            category: "pricing"
          }
        ],
        
        cost_structures: [
          {
            id: "cost-001",
            title: "Operating Cost Breakdown",
            content: `Typical Operating Costs Per Mile:

- Driver Pay: $0.50-$0.60/mile (30-35% of revenue)
- Fuel: $0.40-$0.60/mile (25-30% of revenue)
- Maintenance: $0.10-$0.15/mile (5-8% of revenue)
- Insurance: $0.05-$0.10/mile (3-5% of revenue)
- Tires: $0.03-$0.05/mile (2-3% of revenue)
- Depreciation: $0.15-$0.25/mile (8-12% of revenue)
- Overhead: $0.10-$0.15/mile (5-8% of revenue)

Total Cost Per Mile: $1.50-$2.00
Target Revenue Per Mile: $1.85-$2.50
Target Profit Margin: $0.35-$0.50/mile (15-25%)`,
            category: "costs"
          },
          {
            id: "cost-002",
            title: "Cost Per Mile Calculation",
            content: `How to Calculate Your Cost Per Mile:

1. Track all expenses for a period (month or quarter)
2. Track total miles driven in same period
3. Divide total expenses by total miles

Example:
- Total expenses: $150,000
- Total miles: 75,000
- Cost per mile: $150,000 / 75,000 = $2.00/mile

Categories to Include:
- Driver compensation (wages, benefits, bonuses)
- Fuel and fuel-related costs
- Maintenance and repairs
- Insurance (liability, cargo, physical damage)
- Tires and tire maintenance
- Depreciation (vehicle purchase cost / expected miles)
- Overhead (office, dispatch, software, etc.)

Best Practice: Calculate cost per mile monthly to track trends.`,
            category: "costs"
          }
        ]
      }
    }
  }

  /**
   * Search knowledge base by query
   */
  search(query: string, category?: string): any[] {
    const results: any[] = []
    const queryLower = query.toLowerCase()

    // Search regulations
    if (!category || category === "regulations") {
      this.knowledge.regulations.fmcsa.forEach(r => {
        if (r.title.toLowerCase().includes(queryLower) || 
            r.content.toLowerCase().includes(queryLower) ||
            r.tags.some(t => t.toLowerCase().includes(queryLower))) {
          results.push({ ...r, type: "fmcsa" })
        }
      })
      
      this.knowledge.regulations.hos.forEach(r => {
        if (r.title.toLowerCase().includes(queryLower) || 
            r.content.toLowerCase().includes(queryLower) ||
            r.tags.some(t => t.toLowerCase().includes(queryLower))) {
          results.push({ ...r, type: "hos" })
        }
      })
      
      this.knowledge.regulations.ifta.forEach(r => {
        if (r.title.toLowerCase().includes(queryLower) || 
            r.content.toLowerCase().includes(queryLower) ||
            r.tags.some(t => t.toLowerCase().includes(queryLower))) {
          results.push({ ...r, type: "ifta" })
        }
      })
      
      this.knowledge.regulations.dot.forEach(r => {
        if (r.title.toLowerCase().includes(queryLower) || 
            r.content.toLowerCase().includes(queryLower) ||
            r.tags.some(t => t.toLowerCase().includes(queryLower))) {
          results.push({ ...r, type: "dot" })
        }
      })
    }

    // Search standards
    if (!category || category === "standards") {
      this.knowledge.standards.kpi_benchmarks.forEach(k => {
        if (k.metric.toLowerCase().includes(queryLower) || 
            k.description.toLowerCase().includes(queryLower)) {
          results.push({ ...k, type: "kpi" })
        }
      })
      
      this.knowledge.standards.best_practices.forEach(bp => {
        if (bp.title.toLowerCase().includes(queryLower) || 
            bp.content.toLowerCase().includes(queryLower) ||
            bp.tags.some(t => t.toLowerCase().includes(queryLower))) {
          results.push({ ...bp, type: "best_practice" })
        }
      })
      
      this.knowledge.standards.terminology.forEach(t => {
        if (t.term.toLowerCase().includes(queryLower) || 
            t.definition.toLowerCase().includes(queryLower)) {
          results.push({ ...t, type: "terminology" })
        }
      })
    }

    // Search business
    if (!category || category === "business") {
      this.knowledge.business.pricing_strategies.forEach(p => {
        if (p.title.toLowerCase().includes(queryLower) || 
            p.content.toLowerCase().includes(queryLower)) {
          results.push({ ...p, type: "pricing" })
        }
      })
      
      this.knowledge.business.cost_structures.forEach(c => {
        if (c.title.toLowerCase().includes(queryLower) || 
            c.content.toLowerCase().includes(queryLower)) {
          results.push({ ...c, type: "cost" })
        }
      })
    }

    return results
  }

  /**
   * Get specific knowledge by ID
   */
  getKnowledge(id: string): any {
    // Search all categories
    const allKnowledge = [
      ...this.knowledge.regulations.fmcsa,
      ...this.knowledge.regulations.hos,
      ...this.knowledge.regulations.ifta,
      ...this.knowledge.regulations.dot,
      ...this.knowledge.standards.kpi_benchmarks,
      ...this.knowledge.standards.best_practices,
      ...this.knowledge.business.pricing_strategies,
      ...this.knowledge.business.cost_structures
    ]
    
    return allKnowledge.find(k => k.id === id) || null
  }

  /**
   * Get all knowledge for fine-tuning
   */
  getAllKnowledge(): LogisticsKnowledge {
    return this.knowledge
  }

  /**
   * Get KPI benchmark for a metric
   */
  getKPIBenchmark(metric: string): KPIBenchmark | null {
    return this.knowledge.standards.kpi_benchmarks.find(
      k => k.metric.toLowerCase() === metric.toLowerCase()
    ) || null
  }

  /**
   * Get terminology definition
   */
  getTerminology(term: string): Terminology | null {
    return this.knowledge.standards.terminology.find(
      t => t.term.toLowerCase() === term.toLowerCase()
    ) || null
  }
}


