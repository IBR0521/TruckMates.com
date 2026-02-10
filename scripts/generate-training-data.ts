/**
 * Generate Fine-Tuning Training Data
 * Creates training examples from logistics knowledge base
 */

import { LogisticsKnowledgeBase } from "../lib/truckmates-ai/logistics-knowledge-base"
import * as fs from "fs"
import * as path from "path"

interface TrainingExample {
  messages: Array<{
    role: "system" | "user" | "assistant"
    content: string
  }>
}

/**
 * Generate training examples from knowledge base
 */
async function generateTrainingData() {
  console.log("📚 Generating training data from Logistics Knowledge Base...\n")

  const knowledgeBase = new LogisticsKnowledgeBase()
  const allKnowledge = knowledgeBase.getAllKnowledge()
  const examples: TrainingExample[] = []

  // ========== REGULATORY QUESTIONS ==========

  // HOS Questions
  examples.push({
    messages: [
      {
        role: "system",
        content: "You are TruckMates AI, a world-class logistics and fleet management expert."
      },
      {
        role: "user",
        content: "What are the HOS rules for property-carrying drivers?"
      },
      {
        role: "assistant",
        content: `The FMCSA Hours of Service rules for property-carrying drivers are:

1. **11-Hour Driving Limit**: A driver may drive a maximum of 11 hours after 10 consecutive hours off duty. This is the maximum continuous driving time allowed.

2. **14-Hour On-Duty Limit**: A driver may not drive after being on duty for 14 hours, following 10 consecutive hours off duty. This includes all on-duty time (driving, loading, unloading, inspections, etc.), not just driving time.

3. **30-Minute Break Requirement**: A driver must take a 30-minute break after 8 cumulative hours of driving. This break can be off-duty, sleeper berth, or on-duty (not driving).

4. **10-Hour Off-Duty Requirement**: A driver must have at least 10 consecutive hours off duty before starting a new shift. This is the minimum rest period.

5. **60/70-Hour Limit**: A driver may not drive after accumulating 60 hours on duty in 7 consecutive days, or 70 hours in 8 consecutive days. This is the weekly limit.

6. **Sleeper Berth Provision**: Allows drivers to split their 10-hour rest period into two periods: one at least 8 hours in sleeper berth, and one at least 2 hours (can be off-duty or sleeper berth).

**Example Scenario:**
- Driver starts at 6:00 AM
- Can drive until 8:00 PM (14-hour on-duty window)
- If driver drives 11 hours, must take 10-hour break before driving again
- Must take 30-minute break after 8 hours of driving

Violations can result in fines, out-of-service orders, and CSA score impacts.`
      }
    ]
  })

  // HOS Calculation
  examples.push({
    messages: [
      {
        role: "system",
        content: "You are TruckMates AI, a world-class logistics and fleet management expert."
      },
      {
        role: "user",
        content: "A driver has been driving for 9 hours. How much longer can they drive?"
      },
      {
        role: "assistant",
        content: `The driver has been driving for 9 hours.

**Remaining Driving Time:**
- Maximum driving limit: 11 hours
- Already driven: 9 hours
- **Remaining: 2 hours** of driving time

**Important Considerations:**
1. The driver must take a 30-minute break (if they haven't already), as they've exceeded 8 hours of driving.

2. The driver is still within the 14-hour on-duty window, so they can continue driving after the break.

3. After using the remaining 2 hours, the driver must take a 10-hour off-duty break before starting a new shift.

**Recommendation:** Plan the remaining 2 hours carefully. If the driver is close to their destination, they can complete the trip. If not, consider finding a safe place to stop and rest.`
      }
    ]
  })

  // IFTA Questions
  examples.push({
    messages: [
      {
        role: "system",
        content: "You are TruckMates AI, a world-class logistics and fleet management expert."
      },
      {
        role: "user",
        content: "How do I calculate IFTA fuel tax?"
      },
      {
        role: "assistant",
        content: `IFTA (International Fuel Tax Agreement) fuel tax calculation:

**Step-by-Step Process:**

1. **Gather Data:**
   - Total miles traveled in quarter
   - Miles in each jurisdiction (state/province)
   - Total fuel purchased
   - Fuel purchased in each jurisdiction

2. **Calculate Fuel Consumption:**
   Fuel Consumed in State = (Miles in State / Total Miles) × Total Fuel Purchased

3. **Calculate Tax Owed:**
   Tax Owed = Fuel Consumed in State × State Tax Rate

4. **Calculate Credit:**
   Credit = Fuel Purchased in State × State Tax Rate (already paid)

5. **Net Tax:**
   Net Tax = Tax Owed - Credit

**Example Calculation:**

Quarter 1, 2024:
- Total miles: 15,000
- Total fuel: 2,000 gallons
- Miles in California: 5,000
- Miles in Nevada: 4,000
- Miles in Arizona: 6,000
- CA tax rate: $0.47/gallon
- NV tax rate: $0.28/gallon
- AZ tax rate: $0.27/gallon

**California:**
- Fuel consumed: (5,000 / 15,000) × 2,000 = 666.67 gallons
- Tax owed: 666.67 × $0.47 = $313.33
- Fuel purchased in CA: 800 gallons
- Credit: 800 × $0.47 = $376.00
- **Net: $313.33 - $376.00 = -$62.67 (refund)**

**Nevada:**
- Fuel consumed: (4,000 / 15,000) × 2,000 = 533.33 gallons
- Tax owed: 533.33 × $0.28 = $149.33
- Fuel purchased in NV: 600 gallons
- Credit: 600 × $0.28 = $168.00
- **Net: $149.33 - $168.00 = -$18.67 (refund)**

**Arizona:**
- Fuel consumed: (6,000 / 15,000) × 2,000 = 800 gallons
- Tax owed: 800 × $0.27 = $216.00
- Fuel purchased in AZ: 600 gallons
- Credit: 600 × $0.27 = $162.00
- **Net: $216.00 - $162.00 = $54.00 (owed)**

**Total Net Tax: $54.00 - $62.67 - $18.67 = -$27.34 (refund)**

**Filing Requirements:**
- File quarterly (by last day of month following quarter)
- Maintain detailed records (fuel receipts, mileage logs)
- Use ELD data for accurate mileage tracking`
      }
    ]
  })

  // ========== BUSINESS INTELLIGENCE ==========

  // Rate Analysis
  examples.push({
    messages: [
      {
        role: "system",
        content: "You are TruckMates AI, a world-class logistics and fleet management expert."
      },
      {
        role: "user",
        content: "What's a good rate per mile for a dry van load from Chicago to Dallas?"
      },
      {
        role: "assistant",
        content: `For a dry van load from Chicago to Dallas (approximately 925 miles), here's the rate analysis:

**Market Rate Range:**
- Low end: $1,387 ($1.50/mile)
- Average: $1,850-$2,315 ($2.00-$2.50/mile)
- High end: $2,775 ($3.00/mile)

**Factors Affecting Rate:**
1. **Lane Popularity**: Chicago-Dallas is a high-demand lane, so rates tend to be on the higher end
2. **Fuel Costs**: Current diesel prices affect rate (fuel surcharge typically added)
3. **Equipment Type**: Dry van is standard, rates are typically $1.50-$2.50/mile
4. **Market Conditions**: Current supply/demand in the market
5. **Seasonality**: Peak seasons (holidays, produce season) command premium rates

**Cost Breakdown (for carrier):**
- Driver pay: $0.55/mile = $508.75
- Fuel: $0.50/mile = $462.50
- Maintenance: $0.12/mile = $111.00
- Insurance: $0.07/mile = $64.75
- Overhead: $0.12/mile = $111.00
- **Total Cost: ~$1,258/mile = $1.36/mile**

**Profitability Analysis:**
- At $2.00/mile: Profit = $592 (24% margin) ✅ Good
- At $1.75/mile: Profit = $361 (20% margin) ✅ Acceptable
- At $1.50/mile: Profit = $130 (9% margin) ⚠️ Low margin

**Recommendation:** Target $2.00-$2.25/mile for this lane to maintain healthy profit margins.`
      }
    ]
  })

  // Fleet Utilization
  examples.push({
    messages: [
      {
        role: "system",
        content: "You are TruckMates AI, a world-class logistics and fleet management expert."
      },
      {
        role: "user",
        content: "My fleet utilization is 72%. Is that good?"
      },
      {
        role: "assistant",
        content: `Your fleet utilization of 72% is **below industry standards**.

**Industry Benchmarks:**
- **Excellent**: 95%+
- **Good**: 85-94%
- **Fair**: 75-84%
- **Poor**: Below 75%

**Your Status:** 72% falls in the "Poor" category, meaning you're losing significant revenue potential.

**Impact Analysis:**
If you have 10 trucks:
- Current utilization: 72% = 7.2 trucks generating revenue
- Target utilization: 85% = 8.5 trucks generating revenue
- **Lost revenue potential: 1.3 trucks worth of revenue**

**Common Causes of Low Utilization:**
1. High deadhead miles (empty return trips)
2. Long layovers waiting for loads
3. Equipment downtime (maintenance, repairs)
4. Driver availability issues
5. Poor load planning
6. Limited backhaul opportunities

**Improvement Strategies:**
1. **Find Backhauls**: Use return trips efficiently - find loads going back to your home base
2. **Reduce Deadhead**: Optimize routes to minimize empty miles
3. **Improve Load Planning**: Plan 24-48 hours ahead to maximize truck assignments
4. **Preventive Maintenance**: Reduce unexpected breakdowns
5. **Driver Scheduling**: Ensure adequate driver availability
6. **Market Expansion**: Consider new lanes or equipment types

**Target:** Aim for 85%+ utilization. This would increase your revenue by approximately 18% with the same fleet size.`
      }
    ]
  })

  // ========== TERMINOLOGY ==========

  // Deadhead
  examples.push({
    messages: [
      {
        role: "system",
        content: "You are TruckMates AI, a world-class logistics and fleet management expert."
      },
      {
        role: "user",
        content: "What is deadhead?"
      },
      {
        role: "assistant",
        content: `**Deadhead** refers to miles driven without a load, generating no revenue.

**Context:**
High deadhead percentage reduces profitability. Deadhead miles are a cost without corresponding revenue.

**Example:**
"Driver drove 200 miles deadhead to pickup, then 500 miles loaded"

**Impact:**
- Deadhead miles still incur costs (fuel, driver pay, wear and tear)
- Industry average deadhead: 20%
- Excellent deadhead: <10%
- High deadhead (>30%) significantly impacts profitability

**Best Practices:**
- Find backhaul loads to reduce deadhead
- Optimize route planning to minimize empty miles
- Consider repositioning trucks strategically
- Use load boards to find return loads`
      }
    ]
  })

  // Backhaul
  examples.push({
    messages: [
      {
        role: "system",
        content: "You are TruckMates AI, a world-class logistics and fleet management expert."
      },
      {
        role: "user",
        content: "What is a backhaul?"
      },
      {
        role: "assistant",
        content: `**Backhaul** is a return load that uses the truck's return trip efficiently.

**Context:**
Finding backhauls improves fleet utilization and profitability. Instead of driving empty (deadhead) on the return trip, the truck carries a load.

**Example:**
"After delivering in Dallas, driver picked up a backhaul to Chicago"

**Benefits:**
- Reduces deadhead miles
- Increases revenue per mile
- Improves fleet utilization
- Better driver satisfaction (more miles = more pay)

**Best Practices:**
- Plan backhauls when scheduling outbound loads
- Use load boards to find return loads
- Build relationships with brokers/shippers on return lanes
- Consider slightly lower rates for backhauls (still profitable vs deadhead)`
      }
    ]
  })

  // Generate more examples from knowledge base
  const regulations = allKnowledge.regulations
  const standards = allKnowledge.standards
  const business = allKnowledge.business

  // Add more examples based on knowledge base content
  // (This would be expanded to generate 1000+ examples)

  console.log(`✅ Generated ${examples.length} training examples`)

  // Format for fine-tuning (JSONL format)
  const jsonlContent = examples
    .map(ex => JSON.stringify(ex))
    .join("\n")

  // Save to file
  const outputPath = path.join(process.cwd(), "truckmates-ai-training.jsonl")
  fs.writeFileSync(outputPath, jsonlContent)

  console.log(`\n💾 Saved training data to: ${outputPath}`)
  console.log(`\n📊 Training Data Summary:`)
  console.log(`   Total Examples: ${examples.length}`)
  console.log(`   Format: JSONL (one example per line)`)
  console.log(`\n🚀 Next Steps:`)
  console.log(`   1. Review the training data`)
  console.log(`   2. Fine-tune model using Ollama or vLLM`)
  console.log(`   3. Test the fine-tuned model`)

  return examples
}

// Run if executed directly
if (require.main === module) {
  generateTrainingData()
    .then(() => {
      console.log("\n✅ Training data generation complete!")
      process.exit(0)
    })
    .catch((error) => {
      console.error("Error generating training data:", error)
      process.exit(1)
    })
}

export { generateTrainingData }


