# Vercel Logs and Environment Variables Guide

## Part 1: How to Check Vercel Function Logs

### Method 1: Via Vercel Dashboard (Easiest)

1. **Go to your Vercel Dashboard**
   - Visit https://vercel.com/dashboard
   - Sign in if needed

2. **Select Your Project**
   - Click on your project name (e.g., "vibe-watch-six")

3. **Navigate to Logs**
   - Click on the **"Logs"** tab in the top navigation
   - Or go to: **Deployments** → Click on a deployment → **"View Function Logs"**

4. **Filter Logs**
   - Use the search/filter box to find specific logs
   - Search for: `[VOTE]`, `[STATUS]`, `GROQ`, `Error`, etc.
   - Filter by time range (last hour, last 24 hours, etc.)

5. **View Real-time Logs**
   - Logs update in real-time
   - You can see console.log outputs, errors, and API responses

### Method 2: Via Vercel CLI (Advanced)

1. **Install Vercel CLI** (if not already installed)
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**
   ```bash
   vercel login
   ```

3. **View Logs**
   ```bash
   # View logs for your project
   vercel logs [your-project-name]
   
   # Follow logs in real-time
   vercel logs [your-project-name] --follow
   
   # Filter by function
   vercel logs [your-project-name] --function=api/votes/submit
   ```

### What to Look For in Logs

When debugging the Groq recommendation error, search for:

- `[VOTE] Error in solo mode Groq recommendation:` - Shows the error
- `Error getting solo recommendation:` - Shows Groq API errors
- `GROQ_API_KEY` - Check if API key is missing
- `Failed to parse Groq JSON response` - JSON parsing errors
- `Invalid Groq response` - Validation errors
- `No response content from Groq API` - Empty responses

---

## Part 2: How to Set/Verify GROQ_API_KEY in Vercel

### Step 1: Get Your Groq API Key

1. **Go to Groq Console**
   - Visit https://console.groq.com/
   - Sign in or create an account

2. **Create/Get API Key**
   - Go to **API Keys** section
   - Click **"Create API Key"** (if you don't have one)
   - Copy the API key (you'll only see it once!)

### Step 2: Add GROQ_API_KEY to Vercel

1. **Go to Vercel Dashboard**
   - Visit https://vercel.com/dashboard
   - Click on your project

2. **Navigate to Environment Variables**
   - Click **"Settings"** in the top navigation
   - Click **"Environment Variables"** in the left sidebar

3. **Add New Variable**
   - Click **"Add New"** button
   - **Key**: `GROQ_API_KEY` (exact name, case-sensitive)
   - **Value**: Paste your Groq API key
   - **Environment**: Select **Production** (and optionally Preview/Development)

4. **Save**
   - Click **"Save"**
   - The variable will be added to your project

### Step 3: Verify GROQ_API_KEY is Set

**Option A: Check in Vercel Dashboard**
1. Go to **Settings → Environment Variables**
2. Look for `GROQ_API_KEY` in the list
3. You should see it listed (value is hidden for security)

**Option B: Check in Build Logs**
1. Go to **Deployments** → Click on latest deployment
2. Check **Build Logs**
3. Look for any errors about missing `GROQ_API_KEY`
4. If set correctly, you won't see warnings

**Option C: Test in Function Logs**
1. After setting the variable, **redeploy** your project
2. Trigger a vote submission that requires Groq
3. Check **Function Logs**
4. Look for: `WARNING: GROQ_API_KEY environment variable is not set!`
   - If you see this, the key is NOT set
   - If you don't see this, the key is set correctly

### Step 4: Redeploy After Adding Variable

**Important**: After adding/updating environment variables, you must redeploy:

1. **Automatic Redeploy**
   - Vercel will show a banner: "Environment variables updated. Redeploy?"
   - Click **"Redeploy"**

2. **Manual Redeploy**
   - Go to **Deployments** tab
   - Click the **"..."** menu on latest deployment
   - Click **"Redeploy"**

3. **Via Git Push**
   - Make a small change and push to trigger a new deployment
   - Or create an empty commit: `git commit --allow-empty -m "Trigger redeploy" && git push`

---

## Quick Checklist

### For Checking Logs:
- [ ] Go to Vercel Dashboard → Your Project → Logs tab
- [ ] Search for `[VOTE]` or `GROQ` to find relevant logs
- [ ] Check for error messages and stack traces
- [ ] Note the timestamp of errors

### For Setting GROQ_API_KEY:
- [ ] Get API key from https://console.groq.com/
- [ ] Go to Vercel → Settings → Environment Variables
- [ ] Add `GROQ_API_KEY` with your key value
- [ ] Select "Production" environment
- [ ] Save the variable
- [ ] Redeploy your project
- [ ] Verify in logs that warning is gone

---

## Troubleshooting

### "GROQ_API_KEY is not set" Warning
- **Solution**: Add the variable in Vercel Settings → Environment Variables
- Make sure the name is exactly `GROQ_API_KEY` (case-sensitive)
- Redeploy after adding

### Variable Not Working After Adding
- **Solution**: Redeploy your project (variables only load on new deployments)
- Check that you selected the correct environment (Production)
- Verify the variable name is exactly `GROQ_API_KEY`

### Can't See Variable Value
- **This is normal**: Vercel hides environment variable values for security
- You can only see if the variable exists, not its value
- To verify it's set, check the build/function logs

---

## Additional Resources

- **Vercel Environment Variables Docs**: https://vercel.com/docs/concepts/projects/environment-variables
- **Vercel Logs Docs**: https://vercel.com/docs/concepts/observability/logs
- **Groq API Docs**: https://console.groq.com/docs
