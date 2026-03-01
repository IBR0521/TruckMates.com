/**
 * Verify TruckMates AI Setup
 * Checks if everything is configured correctly
 */

async function verifySetup() {
  console.log("🔍 Verifying TruckMates AI Setup...\n")

  const checks = {
    ollama: false,
    model: false,
    env: false,
    database: false
  }

  // Check 1: Ollama Server
  console.log("1️⃣  Checking Ollama server...")
  try {
    const response = await fetch("http://localhost:11434/api/tags")
    if (response.ok) {
      checks.ollama = true
      console.log("   ✅ Ollama server is running")
    } else {
      console.log("   ❌ Ollama server is not responding")
    }
  } catch (error) {
    console.log("   ❌ Ollama server is not running")
    console.log("   💡 Run: ollama serve")
  }

  // Check 2: Model
  console.log("\n2️⃣  Checking AI model...")
  try {
    const response = await fetch("http://localhost:11434/api/tags")
    if (response.ok) {
      const data = await response.json()
      const models = data.models || []
      const hasModel = models.some((m: any) => 
        m.name.includes("llama3.1:8b") || m.name.includes("mistral:7b")
      )
      
      if (hasModel) {
        checks.model = true
        console.log("   ✅ AI model is downloaded")
        models.forEach((m: any) => {
          if (m.name.includes("llama3.1:8b") || m.name.includes("mistral:7b")) {
            console.log(`      Model: ${m.name}`)
          }
        })
      } else {
        console.log("   ❌ AI model not found")
        console.log("   💡 Run: ollama pull llama3.1:8b")
      }
    }
  } catch (error) {
    console.log("   ⚠️  Could not check model (Ollama not running)")
  }

  // Check 3: Environment Variables
  console.log("\n3️⃣  Checking environment variables...")
  const ollamaUrl = process.env.OLLAMA_BASE_URL
  const ollamaModel = process.env.OLLAMA_MODEL
  
  if (ollamaUrl && ollamaModel) {
    checks.env = true
    console.log("   ✅ Environment variables configured")
    console.log(`      OLLAMA_BASE_URL: ${ollamaUrl}`)
    console.log(`      OLLAMA_MODEL: ${ollamaModel}`)
  } else {
    console.log("   ❌ Environment variables missing")
    console.log("   💡 Add to .env.local:")
    console.log("      OLLAMA_BASE_URL=http://localhost:11434")
    console.log("      OLLAMA_MODEL=llama3.1:8b")
  }

  // Check 4: Database (simplified check)
  console.log("\n4️⃣  Checking database schema...")
  console.log("   ⚠️  Manual check required")
  console.log("   💡 Run supabase/truckmates_ai_schema.sql in Supabase SQL Editor")

  // Summary
  console.log("\n" + "=".repeat(50))
  console.log("📊 Setup Summary:")
  console.log("=".repeat(50))
  console.log(`   Ollama Server: ${checks.ollama ? "✅" : "❌"}`)
  console.log(`   AI Model: ${checks.model ? "✅" : "❌"}`)
  console.log(`   Environment: ${checks.env ? "✅" : "❌"}`)
  console.log(`   Database: ⚠️  Manual check needed`)
  
  const allGood = checks.ollama && checks.model && checks.env
  
  if (allGood) {
    console.log("\n🎉 Core setup is complete!")
    console.log("\n📝 Next steps:")
    console.log("   1. Run database migration in Supabase")
    console.log("   2. Test: npx tsx scripts/test-truckmates-ai.ts")
    console.log("   3. Access: http://localhost:3000/dashboard/ai")
  } else {
    console.log("\n⚠️  Some checks failed. Please fix the issues above.")
  }
}

verifySetup().catch(console.error)














