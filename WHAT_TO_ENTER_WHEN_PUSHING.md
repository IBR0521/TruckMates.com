# What to Enter When Pushing to GitHub

## Step-by-Step: What to Type

### Step 1: Run the Command
```bash
git push origin main
```

### Step 2: When It Asks for "Username"
**Type:** Your GitHub username
- Example: `IBR0521` (or whatever your GitHub username is)
- Press **Enter**

### Step 3: When It Asks for "Password"
**IMPORTANT:** Don't use your GitHub password!

**Instead, use a Personal Access Token:**

#### How to Get a Personal Access Token:

1. **Go to:** https://github.com/settings/tokens
2. **Click:** "Generate new token" → "Generate new token (classic)"
3. **Fill in:**
   - Note: `Git Push` (or any name you want)
   - Expiration: Choose how long (90 days, 1 year, etc.)
   - **Check the box:** `repo` (this gives full repository access)
4. **Click:** "Generate token" at the bottom
5. **Copy the token** (it looks like: `ghp_xxxxxxxxxxxxxxxxxxxx`)
   - ⚠️ **You won't see it again!** Copy it now!
6. **Paste this token** when asked for password

---

## Example Session:

```
$ git push origin main
Username for 'https://github.com': IBR0521
Password for 'https://IBR0521@github.com': ghp_xxxxxxxxxxxxxxxxxxxx
```

---

## Quick Summary:

1. Run: `git push origin main`
2. Username: `IBR0521` (your GitHub username)
3. Password: `ghp_xxxxxxxxxxxx` (your Personal Access Token)

---

**That's it! After entering these, it will push and Vercel will deploy automatically.** 🚀

