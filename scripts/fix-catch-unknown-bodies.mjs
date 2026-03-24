/**
 * After replacing `catch (x: any)` with `catch (x: unknown)`, fix bodies that use
 * `x.message` / `x?.message` by calling `errorMessage(x, ...)` from lib/error-message.ts.
 * Only mutates code inside each `catch (IDENT: unknown) { ... }` block.
 */
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = fileURLToPath(new URL(".", import.meta.url))
const root = path.join(__dirname, "..")

const IMPORT_LINE = `import { errorMessage } from "@/lib/error-message"`

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue
    const p = path.join(dir, name)
    const st = fs.statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(name)) out.push(p)
  }
  return out
}

function fixCatchBodies(content, ident) {
  const esc = ident.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  let s = content
  // x?.message || "text"  -> errorMessage(x, "text")
  s = s.replace(
    new RegExp(`${esc}\\?\\.message\\s*\\|\\|\\s*"([^"]*)"`, "g"),
    `errorMessage(${ident}, "$1")`
  )
  // x?.message || 'text'
  s = s.replace(
    new RegExp(`${esc}\\?\\.message\\s*\\|\\|\\s*'([^']*)'`, "g"),
    `errorMessage(${ident}, '$1')`
  )
  // x.message || "text"
  s = s.replace(
    new RegExp(`${esc}\\.message\\s*\\|\\|\\s*"([^"]*)"`, "g"),
    `errorMessage(${ident}, "$1")`
  )
  s = s.replace(
    new RegExp(`${esc}\\.message\\s*\\|\\|\\s*'([^']*)'`, "g"),
    `errorMessage(${ident}, '$1')`
  )
  // x?.message (standalone)
  s = s.replace(new RegExp(`${esc}\\?\\.message`, "g"), `errorMessage(${ident})`)
  // x.message (standalone — last so we don't break errorMessage's .message)
  s = s.replace(new RegExp(`\\b${esc}\\.message\\b`, "g"), `errorMessage(${ident})`)
  return s
}

function processFile(filePath) {
  let content = fs.readFileSync(filePath, "utf8")
  const original = content

  const catchRe = /catch\s*\(\s*(\w+)\s*:\s*unknown\s*\)\s*\{/g
  let m
  const replacements = []
  while ((m = catchRe.exec(content)) !== null) {
    const ident = m[1]
    const openBrace = m.index + m[0].length - 1
    let depth = 0
    let i = openBrace
    for (; i < content.length; i++) {
      const c = content[i]
      if (c === "{") depth++
      else if (c === "}") {
        depth--
        if (depth === 0) {
          const blockStart = openBrace + 1
          const blockEnd = i
          const block = content.slice(blockStart, blockEnd)
          const fixedBlock = fixCatchBodies(block, ident)
          if (fixedBlock !== block) {
            replacements.push({ start: blockStart, end: blockEnd, text: fixedBlock })
          }
          break
        }
      }
    }
  }

  if (replacements.length === 0) return false

  // Apply from end to start so indices stay valid
  replacements.sort((a, b) => b.start - a.start)
  for (const r of replacements) {
    content = content.slice(0, r.start) + r.text + content.slice(r.end)
  }

  if (content.includes("errorMessage(") && !content.includes(IMPORT_LINE)) {
    const firstImport = content.match(/^import\s/m)
    if (firstImport) {
      const idx = content.indexOf(firstImport[0])
      const lineEnd = content.indexOf("\n", idx)
      content = content.slice(0, lineEnd + 1) + IMPORT_LINE + "\n" + content.slice(lineEnd + 1)
    } else {
      content = IMPORT_LINE + "\n\n" + content
    }
  }

  if (content !== original) {
    fs.writeFileSync(filePath, content)
    return true
  }
  return false
}

const dirs = [
  path.join(root, "app"),
  path.join(root, "components"),
  path.join(root, "lib"),
  path.join(root, "scripts"),
  path.join(root, "truckmates-eld-mobile", "src"),
  path.join(root, "supabase", "functions"),
]

let changed = 0
for (const dir of dirs) {
  if (!fs.existsSync(dir)) continue
  for (const f of walk(dir)) {
    if (processFile(f)) {
      changed++
      console.log("updated", path.relative(root, f))
    }
  }
}
console.log("files changed:", changed)
