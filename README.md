# Stripe Payment Dashboard for Martial Arts Schools

Track student tuition payments, catch failed payments early, and never miss a follow-up. Built to embed directly into Go High Level.

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/rdbba2012-cloud/stripe-payment-dashboard)

> **Replace `rdbba2012-cloud`** in the button URL above with your GitHub username after pushing this repo.

---

## What You Get

- **Payment tracking** — See every successful and failed payment with student names, amounts, and dates
- **Urgent alerts** — Failed payments with 3+ retry attempts are highlighted at the top so you can act fast
- **Retry tracking** — See how many Stripe retries have been used, how many are left, and when the next automatic retry is scheduled
- **Repeat offender detection** — Students with multiple failures are flagged with color-coded severity (amber → red → pulsing red)
- **Communication templates** — Pre-written escalating email templates (friendly → firm → urgent) that auto-fill with student details. One-click copy to clipboard.
- **Student-parent linking** — Connect Stripe customers to student names and parent contact details
- **Pattern analysis** — Charts showing failure trends by day of week, monthly revenue, and failure rate over time
- **Dark theme** — Red, white, and black design that looks sharp embedded in GHL

---

## Setup (5 minutes)

### Step 1: Deploy

Click the **Deploy to Netlify** button above. Netlify will ask for one thing:

| Variable | Where to find it |
|---|---|
| `STRIPE_SECRET_KEY` | [Stripe Dashboard → Developers → API Keys](https://dashboard.stripe.com/apikeys) |

Use `sk_test_...` to test first, switch to `sk_live_...` when ready.

### Step 2: Configure

1. Open your new dashboard URL (Netlify gives you one like `https://your-site.netlify.app`)
2. Click the **gear icon** in the top-right
3. Set your **school name**, currency, and retry settings
4. These settings are saved in your browser

### Step 3: Embed in Go High Level

In your GHL dashboard, add a **Custom Code** or **HTML** element and paste:

```html
<iframe
  src="https://YOUR-SITE.netlify.app"
  width="100%"
  height="900"
  frameborder="0"
  style="border: none; border-radius: 8px;"
></iframe>
```

Replace `YOUR-SITE.netlify.app` with your actual Netlify URL.

**Alternative:** Use GHL's **Custom Menu Links** to add the dashboard URL directly to your sidebar navigation.

---

## How It Works

```
Your GHL Dashboard
  └── iframe → Your Netlify Site
                  ├── index.html (frontend dashboard)
                  └── Netlify Functions (serverless API)
                        └── Stripe API (your account)
```

- Your **Stripe secret key** is stored securely in Netlify's environment variables — never exposed to the browser
- **Student-parent mappings** and **settings** are stored in your browser's localStorage (use Export/Import to back up)
- The dashboard **auto-refreshes** every 5 minutes

---

## Student-Parent Mapping

Stripe knows who pays, but not always which student they're paying for. The **Student Directory** tab lets you:

1. Link each Stripe customer to a student name
2. Add the parent's email and name (if different from Stripe)
3. Add notes (e.g. "siblings: Jake + Emma")
4. **Export** mappings as a JSON file for backup
5. **Import** to restore on a new device

Unmapped customers are flagged so you know who still needs linking.

---

## Communication Templates

When a payment fails, click the **envelope icon** to open the contact panel. It automatically:

- Detects which failure number this is (1st, 2nd, 3rd+)
- Selects the right template tone (friendly → firm → urgent)
- Fills in the student name, amount, date, and total owed
- Lets you copy to clipboard and paste into GHL or your email

Templates are fully editable from the dashboard.

---

## Local Development

```bash
# Clone the repo
git clone https://github.com/rdbba2012-cloud/stripe-payment-dashboard.git
cd stripe-payment-dashboard

# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Edit .env and add your STRIPE_SECRET_KEY

# Run locally
npx netlify dev
# Opens at http://localhost:8888
```

Without a Stripe key, the dashboard loads with **demo data** so you can preview the full UI.

---

## Tech Stack

- **Frontend:** Single HTML file, Tailwind CSS (CDN), Chart.js (CDN)
- **Backend:** Netlify Functions (serverless Node.js)
- **API:** Stripe SDK
- **Storage:** Browser localStorage (mappings, settings, templates)
- **Hosting:** Netlify (free tier works fine)
