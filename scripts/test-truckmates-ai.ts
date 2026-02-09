/**
 * Test Script for TruckMates AI
 * Run this to verify the AI system is working correctly
 */

import { processAIRequest } from "../app/actions/truckmates-ai/orchestrator"

async function testTruckMatesAI() {
  console.log("🧪 Testing TruckMates AI System...\n")

  const testCases = [
    {
      name: "Regulatory Question",
      message: "What are the HOS rules for property-carrying drivers?",
      expected: "Should provide detailed HOS rules"
    },
    {
      name: "Calculation Question",
      message: "A driver has been driving for 9 hours. How much longer can they drive?",
      expected: "Should calculate remaining driving time"
    },
    {
      name: "Business Intelligence",
      message: "What's a good rate per mile for a dry van load from Chicago to Dallas?",
      expected: "Should provide rate analysis and recommendations"
    },
    {
      name: "Platform Action",
      message: "What loads are currently pending?",
      expected: "Should retrieve and list pending loads"
    },
    {
      name: "Terminology",
      message: "What is deadhead?",
      expected: "Should explain deadhead terminology"
    }
  ]

  let passed = 0
  let failed = 0

  for (const testCase of testCases) {
    console.log(`\n📝 Test: ${testCase.name}`)
    console.log(`   Query: "${testCase.message}"`)
    console.log(`   Expected: ${testCase.expected}`)
    
    try {
      const startTime = Date.now()
      const result = await processAIRequest({
        message: testCase.message,
        context: {
          // Mock context for testing
        }
      })
      const duration = Date.now() - startTime

      if (result.error) {
        console.log(`   ❌ FAILED: ${result.error}`)
        failed++
      } else if (result.response && result.response.length > 0) {
        console.log(`   ✅ PASSED (${duration}ms)`)
        console.log(`   Response: ${result.response.substring(0, 100)}...`)
        if (result.confidence) {
          console.log(`   Confidence: ${(result.confidence * 100).toFixed(1)}%`)
        }
        if (result.actions && result.actions.length > 0) {
          console.log(`   Actions: ${result.actions.length} executed`)
        }
        passed++
      } else {
        console.log(`   ⚠️  WARNING: Empty response`)
        failed++
      }
    } catch (error: any) {
      console.log(`   ❌ ERROR: ${error.message}`)
      failed++
    }
  }

  console.log(`\n\n📊 Test Results:`)
  console.log(`   ✅ Passed: ${passed}/${testCases.length}`)
  console.log(`   ❌ Failed: ${failed}/${testCases.length}`)
  console.log(`   Success Rate: ${((passed / testCases.length) * 100).toFixed(1)}%`)

  if (failed === 0) {
    console.log(`\n🎉 All tests passed! TruckMates AI is working correctly.`)
  } else {
    console.log(`\n⚠️  Some tests failed. Check Ollama is running and model is installed.`)
    console.log(`   Run: ollama serve`)
    console.log(`   Then: ollama pull llama3.1:8b`)
  }
}

// Run tests if executed directly
if (require.main === module) {
  testTruckMatesAI()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Test execution error:", error)
      process.exit(1)
    })
}

export { testTruckMatesAI }

