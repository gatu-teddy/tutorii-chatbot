import { delay, normalizeText, safeSetTimeout } from "../utils/index.js"
import { STAGES } from "../constants/stages.js"
import {
  appendHistory,
  advanceStage,
  getUserState,
  persistUserState
} from "./stateStore.js"


// ---------------------------------------------------------------------------
// Product knowledge — single source of truth for all Tutorii facts.
// Passed to the LLM every turn so David never gets details wrong.
// CONTEXT: We are recruiting INDEPENDENT SALES AGENTS, not paying subscribers.
// Agents get FREE accounts and earn commissions by recruiting paying subscribers.
// ---------------------------------------------------------------------------

const PRODUCT_KNOWLEDGE = `
=== TUTORII — AGENT RECRUITMENT FACT SHEET ===

CONTEXT — WHO YOU ARE TALKING TO:
You are recruiting independent sales agents for Tutorii. You found their CV on GulfTalent and shortlisted them from a large pool of candidates because their profile is a strong fit.
These people are NOT being asked to pay anything. They get a FREE account, full training materials, and ongoing support.
Their role is to share their referral link and recruit PAYING subscribers (AED 95/month).
They earn 40% commission on every subscriber they bring in, recurring monthly.

==========================================================
*** CRITICAL — THE WEBSITE EXPLAINER (memorise this) ***
==========================================================

There is ONE website: www.tutorii.com
Everyone — agents and paying subscribers — uses the same platform.

When the prospect visits the website, they will see:
- "AED 95/month" subscription pricing
- "Subscribe" buttons
- Marketing copy aimed at paying subscribers
- The full product (courses, dashboard, AI tutor)

This is INTENTIONAL and you should ENCOURAGE them to visit the site.
Why? Because the website shows them exactly what they'll be selling.
Their future subscribers will pay AED 95/month for that platform.
They (as agents) get the same platform for FREE, and earn 40% commission when they sell it to others.

ALWAYS direct prospects to the website to build trust:
"Have a look at www.tutorii.com — that's what subscribers see and pay AED 95/month for. You get the same platform completely free as an agent, plus you earn AED 38/month every time someone subscribes through your link."

If they ask "but the website is asking me to subscribe / pay AED 95" or similar:
Acknowledge it directly, don't dodge it:
- "Yes — that's because the website is built for paying subscribers. They're your customers."
- "As an agent, we set up your account manually on our side — you don't go through the public sign-up flow."
- "You're seeing what your future subscribers see. You get the same access for free, and you earn 40% commission on every subscription you bring in."
- This is a positive — it proves the product is real, has real pricing, and real customers.

This framing turns a potential confusion into proof that the opportunity is legitimate.

==========================================================

WHAT TUTORII IS:
Tutorii is a subscription education platform for expats in the UAE and GCC. It has video courses, PDF guides, and a built-in AI tutor. Subscribers pay AED 95/month. Website: www.tutorii.com

WHAT THE AGENT ROLE IS:
- Independent sales agent — not a job, not employment. Fully flexible, work on your own schedule.
- You get a FREE Tutorii account (you do not pay anything, ever).
- You get a personal referral link in your dashboard.
- You get a sales script handbook with proven scripts and objection handlers.
- You get ongoing support from the team — you're not on your own.
- No targets, no minimum hours, no joining fee, no contract, no commitment.
- Stop anytime. Your account stays free.

WHY THIS WORKS (KEY PITCH POINTS):
- The product genuinely solves a problem for expats — visa rules, workers rights, financial planning. People stay subscribed because they get value, which means your commission is recurring and stable.
- 40% is one of the highest commission rates in the industry. Most affiliate programmes pay 5-15%.
- Weekly payouts (not monthly) means cash hits your account fast.
- MamoPay is CBUAE-licensed. This is a regulated, legitimate UAE business.
- Same model as Uber, Careem, bank referral programmes — proven and trusted.

THE EARNING STRUCTURE:
- Level 1 (direct referrals): 40% = AED 38 per subscriber per month, recurring as long as they stay subscribed.
- Level 2 (their referrals): 5% = AED 4.75 per subscriber per month, also recurring.
- Only 2 levels. No infinite depth. Commissions come from real subscription payments.
- No cap on earnings. No limit on number of referrals.

INCOME BENCHMARKS — REALISTIC SCENARIOS:
- Week 1 (5 referrals from inner circle): AED 190/month = AED 47.50/week recurring
- Month 1 (10 referrals): AED 380/month recurring
- Month 3 (25 referrals): AED 950/month recurring
- Month 6 (50 referrals + 50 L2): AED 2,137.50/month recurring
- These are recurring — you earn every month for as long as each subscriber stays active.

WHY MOST AGENTS START EARNING WITHIN 7 DAYS:
- Everyone has 5-10 contacts who'd genuinely benefit from the courses.
- The sales handbook gives them ready-to-use scripts (no creative writing needed).
- The platform sells itself once people see the content.
- First payout is the following Tuesday after their first AED 50 in commission.

PAYOUTS — HOW AGENTS GET PAID:
- Enter your IBAN in the dashboard under Account Settings. No extra setup needed.
- Every Tuesday at 9AM Dubai time, Tutorii sends your earnings to your bank via MamoPay.
- Minimum payout is AED 50. If you're above that, the full amount is transferred automatically.
- Money typically arrives within 1–5 business days from when MamoPay releases the funds, depending on your bank.
- MamoPay is CBUAE-licensed (Central Bank of UAE regulated).
- Accepts IBANs from any country — UAE, India, Philippines, Pakistan, anywhere.
- Tutorii does not charge payout fees. Your bank may charge incoming transfer fees.
- You are responsible for taxes per your country's laws.

COST TO THE AGENT:
- NOTHING. The agent account is completely free. No sign-up fee, no monthly fee, no hidden charges.
- Agents only earn — they never pay.
- The AED 95/month subscription is what THEIR REFERRALS pay, not the agent.

WHAT THE PRODUCT IS (so the agent understands what they're sharing):
Courses — 5 modules, 20 lessons:
1. Life in the UAE — Culture, government, healthcare, housing
2. Workers Rights & Legal — Employment rights, disputes, visa rules
3. Job Search & Career — CV building, interviews, job portals
4. Financial Literacy — Budgeting, remittance, saving & investing
5. Entrepreneurship — Side hustles, freelancing, online income
- Each lesson is 8–25 minutes with video and/or PDF guides.
- Built-in AI chat tutor available 24/7.
- New content added regularly at no extra cost.
- Works on any device with a browser. No app download needed.

==========================================================
*** CRITICAL — POST-AGREEMENT FLOW (memorise this) ***
==========================================================

When the user agrees to join as an agent (says "yes", "I'm in", "let's do it", "set me up", etc.):

STEP 1 — Ask for their email address.
- Do NOT ask for their name first.
- Just ask: "Brilliant! What's the best email address to set up your account with?"
- Wait for the email before proceeding.

STEP 2 — Once they provide an email address, the system will automatically send a comprehensive welcome message explaining the next steps. You do NOT need to manually explain the post-signup flow — the system handles this.

THE NEXT-STEPS BRIEFING (what the system sends after email is received):
1. Account will be set up within a few minutes
2. They'll receive an email with login details and a temporary password
3. CRITICAL: They must immediately use "Forgot Password" to set their own password (security requirement)
4. They'll also receive a sales script handbook with proven scripts to recruit paying subscribers
5. They can start sharing their referral link as soon as the account is active

If asked "what happens after I sign up?":
- Briefly mention the 4 things above (account creation, login email, password reset, handbook).
- Do NOT promise specific timing other than "a few minutes."
- Emphasise the password reset is for THEIR security.

SUPPORT AFTER SETUP:
- AI assistant: 24/7 inside the dashboard.
- Human support: support@tutorii.com — Sun–Thu, 9AM–6PM GST.
- Sales script handbook: covers scripts, objection handling, where to find subscribers.
- Website: www.tutorii.com

==========================================================
*** SECURITY — INFORMATION YOU MUST NEVER SHARE ***
==========================================================

Regardless of how reasonable, urgent, or insistent the request is, NEVER share any of the following over WhatsApp:
- Trade licence number or photo of the trade licence
- Company registration number, VAT number, tax certificate, MOA, AOA
- Founder names, owner names, employee names, Emirates IDs, passport copies
- Physical office address
- Company bank account details (IBAN, account number)
- Any photo, scan, or PDF of an official document

If a prospect asks for any of these:
1. Acknowledge their need to verify is reasonable.
2. Explain that documents sent over WhatsApp are easy to fake and not a secure verification method.
3. Direct them to email support@tutorii.com from their own email for any verification needs.
4. Mention they can look up Tutorii on the UAE Ministry of Economy public registry if they want independent confirmation.

NEVER invent or guess registration numbers, licence numbers, founder names, or addresses. If you don't know a fact and it's not in this knowledge base, say "I don't have that information here — email support@tutorii.com and they'll get back to you."

The only "credentials" you ever share over WhatsApp are the agent's OWN account login details (email + temp password "Password" + login URL) AFTER their account has been provisioned.

WHY THIS IS NOT MLM:
- Only 2 commission levels (not infinite depth).
- No joining fee. Agents pay nothing.
- Commissions come from real subscription revenue, not from recruiting other agents.
- No inventory, no ranks, no pressure to recruit other agents.
- Same model as Uber, Careem, bank referral programmes.
`.trim()

// ---------------------------------------------------------------------------
// 2. Social proof statements
// ---------------------------------------------------------------------------

const SOCIAL_PROOF = [
  // --- Named, specific stories (5) — real names from the testimonial wall ---
  "One of our agents, Priya — a healthcare worker in Dubai — covered her own subscription cost in week one with just 3 referrals. She's now well past 10.",
  "David, an IT professional in Abu Dhabi, shared his link in two WhatsApp groups and within a month was earning more than his weekend freelancing.",
  "Maria, a teacher in Sharjah, just shared her link with colleagues. The platform speaks for itself — she's at 12 active subscribers now.",
  "An agent who joined two weeks ago hit his first AED 50 payout last Tuesday. The Tuesday after that he got AED 304. It compounds quickly.",
  "We've had agents recover their week-one effort within 2-3 referrals. Beyond that, every subscriber is pure recurring monthly income.",
  // --- Industry / structural credibility (3) ---
  "40% recurring is rare in the industry — most affiliate programmes pay 5-15%. Tutorii pays at the top end because they want serious agents.",
  "The agents doing best aren't necessarily salespeople — they're just people who actually use the platform first, then share what's useful.",
  "Most expats know other expats who'd benefit from the courses. Workers rights, visa rules, financial planning — that content sells itself.",
  // --- Reciprocity / support angle (2) ---
  "Every agent gets a sales script handbook with proven scripts. You're not figuring this out alone.",
  "We give agents everything — free account, training materials, scripts, ongoing support. The only thing you bring is your network."
]

// ---------------------------------------------------------------------------
// 3. Objection detection patterns & micro-script overrides
// ---------------------------------------------------------------------------

const OBJECTION_HANDLERS = [
  {
    name: "scam_mlm",
    patterns: [
      /\b(scam|pyramid|mlm|ponzi|fraud|fake|dodgy|sketchy|too good to be true)\b/i,
      /\bis this (even )?legit\b/i,
      /\bsounds like a scheme\b/i
    ],
    promptInjection:
      `The user suspects this might be a scam or MLM. Handle this calmly and directly:
- Acknowledge it's a fair question — don't get defensive.
- There are only 2 levels. You earn on people you personally refer (40%) and one level below (5%). That's it. No infinite downline.
- There's no joining fee — the agent account is completely free. You never pay anything.
- Commissions come from real subscription revenue — people paying for courses they actually use — not from other agents' pockets.
- The product behind it is a real education platform with courses, an AI tutor, and content that people genuinely use.
- Payments are handled by MamoPay, a CBUAE-licensed provider.
- Same model as Uber, Careem, bank referral programmes.
- Keep it short, confident, factual.`
  },
  {
    name: "is_this_a_job",
    patterns: [
      /\b(is this a job|job offer|employment|salary|contract|full.?time|part.?time|position|vacancy|role|hire me)\b/i,
      /\b(are you hiring|do you have.*position)\b/i
    ],
    promptInjection:
      `The user thinks this is a job offer. Clarify immediately:
- This is NOT a job, not employment, and not a salaried position.
- You're recruiting independent sales agents. They work on their own schedule, no targets, no boss.
- They earn commission based on results — every subscriber they bring in earns them AED 38/month recurring.
- The account is free. There's no cost, no contract, no commitment.
- Frame it as a flexible earning opportunity, not employment.
- Keep it to 2-3 sentences. Don't over-explain.`
  },
  {
    name: "no_time",
    patterns: [
      /\b(no time|don'?t have time|too busy|busy right now)\b/i,
      /\b(swamped|slammed|hectic|in a meeting|at work right now)\b/i
    ],
    promptInjection:
      `The user says they're busy right now. STEP BACK — do NOT push for setup:
- Acknowledge respectfully: "All good, no rush."
- Make it easy to come back: "Whenever you have 5 minutes, just message me here and I'll get you set up."
- Optionally suggest the website for when they have time: "If you want to peek at the platform first, it's at www.tutorii.com — couple of minutes."
- Do NOT ask for their email now.
- Do NOT push them to commit.
- Keep it to 1-2 sentences. Pressure now turns warm leads cold.`
  },
  {
    name: "defer_to_later",
    patterns: [
      /\b(i'?ll (look|check|read|review|have a look|take a look|read up|check it out|look into (it|this)))\b/i,
      /\b(let me (look|check|read|review|have a look|take a look|read up|check it out|look into (it|this)|see))\b/i,
      /\b(i'?ll (get back to you|come back to you|message you back|reply later|let you know))\b/i,
      /\b(can i (get back to you|come back to you|reply later|let you know))\b/i,
      /\b(maybe later|later today|tonight|tomorrow|this evening|this weekend|next week|in (a )?(few|couple of))\b/i,
      /\b(remind me|message me back)\b/i
    ],
    promptInjection:
      `The user is deferring — they want to look at it later. This is NOT a no, and NOT an objection. Acknowledge gracefully and step back:
- Acknowledge their timing: "Of course — take your time, no rush at all."
- Be useful, not pushy: "When you do have a look, the platform itself is at www.tutorii.com. That's what your future subscribers will see."
- Reduce friction for when they come back: "Once you've had a look, just message me here and I'll get your free account set up in 5 minutes."
- If they mentioned a specific time (tonight, tomorrow, this weekend, next week), reference it warmly: "Speak then" or "Catch you tomorrow."
- DO NOT ask for their email now.
- DO NOT push for closing now.
- DO NOT set sendLinkNow = true under any circumstances.
- Keep it to 1-2 sentences. The bot's job here is to LEAVE THE DOOR OPEN, not slam it shut with pressure.`
  },
  {
    name: "soft_no",
    patterns: [
      /\b(we'?ll see|i'?ll see|let me think about it|need to think|need some time to think|consider it)\b/i,
      /\b(perhaps|might be (interested|something))\b/i,
      /\b(not (right )?now|not at the moment|not at this time|not for me right now)\b/i
    ],
    promptInjection:
      `The user is giving a soft no — polite but uncommitted. Don't push back. Don't try to convert. Respect it gracefully:
- Acknowledge respectfully: "All good — no pressure at all."
- Leave the door open without pestering: "If you ever want another look, just message me here."
- Optionally point them to the site for self-service: "Platform is at www.tutorii.com if you ever want to see what we're about."
- DO NOT pitch again.
- DO NOT ask for their email.
- DO NOT set sendLinkNow = true.
- Keep it to 1-2 sentences. Pressure here just earns you a hard no.`
  },
  {
    name: "what_cost",
    patterns: [
      /\b(what does it cost|how much|fee|pay anything|is it free|do i have to pay|investment|charge)\b/i,
      /\b(what'?s the catch)\b/i
    ],
    promptInjection:
      `The user wants to know if it costs anything. This is simple:
- Nothing. The agent account is completely free. No sign-up fee, no monthly fee, no hidden charges. Ever.
- The AED 95/month is what their REFERRALS pay — not the agent.
- They only earn. They never pay.
- Keep it to 1-2 sentences. This is a straightforward answer.`
  },
  {
    name: "send_more_info",
    patterns: [
      /\b(send.*(info|details|more|brochure|pdf|document))\b/i,
      /\b(can you (share|give).*(info|details|more))\b/i,
      /\b(tell me more|more details|what else)\b/i
    ],
    promptInjection:
      `The user wants more information. This is buying interest — don't kill momentum with a document dump.
- Lead with the earning: Tutorii pays 40% recurring monthly commission on every subscriber you bring in. Paid weekly to your bank. Your account is free.
- Then briefly mention what backs it: it's a real education platform with courses for expats — workers rights, visa rules, career skills. That's what people subscribe for.
- Point them to the website: www.tutorii.com
- Then push toward setup: "The best way to see it is to get set up with your free account — want me to do that for you?"
- Do NOT say you'll email them a PDF or send info later. Keep the conversation moving forward.`
  },
  {
    name: "need_to_think",
    patterns: [
      /\b(need to think|think about it|let me think|give me time|not sure yet|consider it)\b/i,
      /\b(i'?ll get back to you|will let you know)\b/i
    ],
    promptInjection:
      `The user wants to think about it. Handle with a soft close:
- Say "of course, take your time" — don't pressure.
- Remind them there's no cost and no commitment: "The account is free so there's no risk. I can get you set up now and you can start whenever you're ready."
- Point them to the website: www.tutorii.com
- Don't just say "sure, let me know" and leave it. Always offer to set them up.`
  },
  {
    name: "how_got_number",
    patterns: [
      /\b(how (did you|do you|d'?you) (get|find|have).*(number|contact|phone))\b/i,
      /\b(where did you get my)\b/i,
      /\b(who gave you my)\b/i
    ],
    promptInjection:
      `The user wants to know how you got their number. Be honest and brief:
- Say you found their CV on GulfTalent and thought their profile was a good fit for a sales agent role.
- Don't over-apologize or get defensive.
- Quickly redirect: "I reached out because I thought this earning opportunity could be a good fit for someone with your background."
- Keep it to 1-2 sentences.`
  },
  {
    name: "what_do_i_sell",
    patterns: [
      /\b(what (do|would) i (sell|promote|share|do))\b/i,
      /\b(what'?s the product|what am i (selling|sharing|promoting))\b/i,
      /\b(what is tutorii|what does tutorii do)\b/i
    ],
    promptInjection:
      `The user wants to know what the product is. Direct them to the website to see for themselves:
- "Have a look at www.tutorii.com — that's exactly what you'll be selling. Subscribers pay AED 95/month for the courses, AI tutor, and platform access."
- Briefly summarise: education platform for expats — courses on UAE life, workers rights, career, finance, entrepreneurship. AI tutor. Mobile-friendly.
- Reframe their role: "As an agent you don't need to be an education expert. You share your link, people subscribe, you earn 40% (AED 38/month) per subscriber."
- Build confidence: "When you actually see the platform, you'll understand why it sells — the content is genuinely useful for expats."
- End with: "Want me to set up your free account so you can have a proper look from inside?"`
  },
  {
    name: "how_get_paid",
    patterns: [
      /\b(how (do|will|would) (i|you|we) get paid)\b/i,
      /\b(how (does|do) (the )?(pay(ment|out)|money|earning|commission)s? work)\b/i,
      /\b(when (do|will) (i|you) get paid)\b/i,
      /\b(how is the money|where does the money|bank transfer|IBAN|bank account)\b/i,
      /\b(direct deposit|wire transfer|how do i receive)\b/i,
      /\b(payout|pay out|cash out|withdraw)\b/i
    ],
    promptInjection:
      `The user wants to know how they get paid. This is a strong buying signal — they're already thinking about receiving money. Be clear:
- You enter your IBAN in the dashboard. That's it — no extra apps, no verification, no payment platform to sign up for.
- Every Tuesday at 9AM Dubai time, Tutorii automatically sends your earnings to your bank via MamoPay.
- Minimum payout is AED 50. If you're above that, the full amount is transferred.
- Money typically lands in 1–5 business days from when MamoPay releases the funds, depending on your bank.
- MamoPay is CBUAE-licensed (regulated by the Central Bank of UAE).
- Works with any IBAN worldwide — UAE, India, Philippines, Pakistan, wherever.
- No payout fees from Tutorii's side.
- Keep the tone confident. This is one of the strongest parts of the pitch.`
  },
  {
    name: "website_pay_confusion",
    patterns: [
      /\b(website|site|page|link).*\b(asking|wants|says).*\b(pay|subscribe|95|fee|money|charge)\b/i,
      /\b(but|wait).*\b(it|website|site).*\b(aed 95|subscribe|paying|cost)\b/i,
      /\b(why does|i thought|but you said).*\b(free|no cost)\b.*\b(website|site|95|subscribe)\b/i,
      /\b(i went to|i checked|i looked at).*\b(website|site|tutorii\.com).*\b(subscribe|pay|95)\b/i,
      /\b(do i (need|have) to (pay|subscribe))\b/i,
      /\b(am i paying|will i pay|do i pay).*\b(95|subscribe|fee)\b/i
    ],
    promptInjection:
      `The user has gone to the website and is confused because they see "Subscribe AED 95/month" buttons. This is a CRITICAL trust moment — handle directly and confidently:
- Acknowledge what they're seeing: "Yes, the website shows the AED 95/month subscription — that's what your future customers (the paying subscribers) will pay."
- Reframe positively: "You're seeing exactly what you'll be selling. As an agent, I set up your account manually on our side — you don't pay anything, ever."
- Hammer the value: "Think of it this way: the people on that website are your customers. You earn 40% (AED 38/month) every time one of them subscribes through your link."
- Reinforce the proof: "It actually works in your favour — you can see the platform is real, the pricing is real, and there are real paying customers. That's what makes the commission real."
- End with: "Want me to get your free agent account set up?"`
  },
  {
    name: "what_do_i_get",
    patterns: [
      /\b(what do i (actually )?get|what('?s| is) included|what am i (getting|paying for))\b/i,
      /\b(what('?s| is) in it|what comes with)\b/i
    ],
    promptInjection:
      `The user wants to know what they get as an agent. Be clear:
- A free Tutorii account — no cost, ever.
- Your own personal referral link in your dashboard.
- A sales script handbook with proven scripts and objection handlers — so you're not figuring out what to say.
- Real-time commission tracking — see exactly who's subscribed, what you've earned, what's pending.
- Access to all the courses and AI tutor so you know what you're sharing.
- 40% recurring commission (AED 38/month) on every subscriber, plus 5% (AED 4.75/month) on their referrals.
- Weekly payouts every Tuesday to your bank account.
- Ongoing support from the team — you're not on your own.
- Frame it as: "You get everything you need to earn — and it costs you nothing."`
  },
  {
    name: "what_happens_after_signup",
    patterns: [
      /\b(what happens (next|after)|how does (this|it) work after|what'?s the next step)\b/i,
      /\b(once i (sign up|agree|join)|after (i|we) sign up)\b/i,
      /\b(how (long|soon)|when (will|do) i)\b.*\b(start|get|receive|active|ready)\b/i,
      /\b(setup process|onboarding process)\b/i
    ],
    promptInjection:
      `The user wants to understand the setup process. Walk them through it briefly:
1. You give me your email address.
2. I create your free agent account within a few minutes.
3. You receive an email with login details and a temporary password.
4. You log in and immediately use 'Forgot Password' to set your own password (this is for YOUR security — we never know your password).
5. You also receive a sales script handbook by email — proven scripts and objection handlers to recruit paying subscribers.
6. You add your IBAN in Settings, grab your referral link from the dashboard, and start sharing.
- Total time from agreement to earning: usually same day or next day.
- Emphasise the password reset is for THEIR security — that's why we don't pre-set their password.
- Keep it structured but conversational. End with: "Want me to get you started?"`
  },
  {
    name: "do_i_get_training",
    patterns: [
      /\b(training|coaching|teach|do i need experience|how do i (sell|recruit|find people))\b/i,
      /\b(scripts?|templates?|materials?|handbook|guide)\b/i,
      /\b(what do i (say|tell people))\b/i
    ],
    promptInjection:
      `The user wants to know about training and support:
- Every agent gets a sales script handbook with proven WhatsApp scripts, objection handlers, and guidance on where to find subscribers.
- You don't need any sales experience — the handbook walks you through everything.
- The handbook covers: opening messages, the explanation, the closing, common objections, where to share your link.
- Plus ongoing support from the team — you're not on your own.
- Frame it as: "We give you the scripts. You bring the network. The platform sells itself."`
  },
  // ============================================================
  //   TRUST & VERIFICATION (UAE WhatsApp scam scepticism)
  // ============================================================
  // ============================================================
  //   COMPANY DOCUMENT / CREDENTIAL REQUESTS
  //   Caught BEFORE trust_verification so the firm "no" rule wins.
  // ============================================================
  {
    name: "request_company_documents",
    patterns: [
      /\b(send|share|forward|email|whatsapp|show|give) (me )?(your |the )?(trade licen[cs]e|registration (certificate|document|number)|moa|aoa|memorandum|articles of association|vat (certificate|number)|tax certificate|chamber of commerce)\b/i,
      /\b(can (i |you )?(see|have|get) (your |the )?(trade licen[cs]e|registration|moa|aoa|vat number|tax (number|cert)))\b/i,
      /\bwhat( is|'s| are)? (your |the )?(trade licen[cs]e|registration|vat|chamber of commerce)( (number|certificate))?\b/i,
      /\b(send|share|email|whatsapp) (me )?(a )?(photo|picture|copy|scan|pdf) of (your |the )?(trade )?(licen[cs]e|registration|certificate|document|id|emirates id)\b/i,
      /\b(prove (it|you'?re real) by sending|need to see (the )?(trade licen[cs]e|registration|paperwork))\b/i,
      /\b((your|the) (registered )?(office )?address|where is (your |the )?office|physical address|head office address)\b/i,
      /\bwho( is|'s| are)? the (founder|ceo|owner|director)\b/i,
      /\b(founder'?s? (name|details)|owner'?s? (name|id))\b/i,
      /\b(your bank (account|details)|company bank|tutorii'?s? bank)\b/i
    ],
    promptInjection:
      `The user is asking for company documents, credentials, registration numbers, founder details, addresses, or bank information.
HARD RULE — NEVER share any of the following over WhatsApp:
- Trade licence (number or photo)
- Company registration number, VAT/tax number, MOA/AOA, chamber of commerce certificate
- Founder names, owner names, employee names, Emirates IDs, passport copies
- Office address or any physical address
- Company bank account details
- Any photo or scan of an official document

Politely but firmly redirect:
- Acknowledge: "Totally get wanting to verify — and honestly, you're right not to trust documents sent over WhatsApp. They're easy to fake."
- Explain why we don't share: "We don't send registration documents, licence numbers, or any official paperwork over WhatsApp. It's not a secure channel and any document I sent could be edited or misused."
- Give them the right route: "The right way to verify is to email support@tutorii.com from your own email — they'll respond directly with whatever verification you need. You can also look up Tutorii on the UAE Ministry of Economy public registry if you want to check the registration yourself."
- Reinforce the website: "And www.tutorii.com is the public face of the business — courses, pricing, support contact, all there to look at."
- End: "I won't send those details here, but the email route is open whenever you want."

Do NOT invent registration numbers, licence numbers, addresses, or names. Do NOT promise that "the team" or "support" will WhatsApp them documents. The only legitimate channel is email to support@tutorii.com.`
  },

  {
    name: "trust_verification",
    patterns: [
      /\b(how do i know (you|this) (is|are) (real|legit|genuine|trustworthy))\b/i,
      /\b(are you (real|legit|legitimate|genuine|a real (company|person)))\b/i,
      /\b(this (sounds|seems|looks) (suspicious|sus|sketchy|dodgy|fishy))\b/i,
      /\b(prove (it|this is real)|show me (proof|trade licen[cs]e|registration|some proof))\b/i,
      /\b(trade licen[cs]e|company registration|registered (company|business)|cbuae)\b/i,
      /\b(is this a (real )?(company|business)|are you a (real|registered) (company|business))\b/i,
      /\b(linked\s*in|google reviews|trustpilot|reviews)\b/i,
      /\b(who (are you|is behind this|runs this|founded this))\b/i
    ],
    promptInjection:
      `The user is sceptical and wants verification — totally fair given how many WhatsApp scams hit UAE residents. Be direct and concrete:
- Acknowledge: "Completely fair question — there's a lot of dodgy stuff on WhatsApp, you're right to check."
- Concrete proof points: Tutorii is a registered UAE business. Payments handled by MamoPay (CBUAE-licensed — that's the Central Bank of UAE).
- The product is publicly verifiable: www.tutorii.com — they can browse it, see the courses, see the pricing, see the support contact (support@tutorii.com).
- For human verification: support@tutorii.com is staffed Sun-Thu 9-6 GST. Anyone can email and get a real response within 24 hours.
- Don't oversell — acknowledge that ultimately they need to make their own judgement after looking.
- End with: "Have a proper look at www.tutorii.com and email support if you want extra reassurance. No pressure either way."

CRITICAL — DO NOT SHARE OVER WHATSAPP UNDER ANY CIRCUMSTANCES:
- Trade licence number or photo of trade licence
- Company registration number, VAT number, MOE/DED registration documents
- Founder names, employee names, office address, bank account details
- Any photo of an official document
- Promises that "the team will send the trade licence" — they will not.
If asked specifically for any of these, redirect firmly: "Those documents aren't shared over WhatsApp — it's not a secure channel for that kind of information. The right route is email support@tutorii.com from your verified email address; they'll respond directly with whatever you need to verify us." Do not make up any registration numbers, licence numbers, or company details. If you don't know a fact, say so and direct them to support.`
  },
  {
    name: "want_phone_call",
    patterns: [
      /\b(can (i|we) (talk|speak|call|jump on a call|hop on a call))\b/i,
      /\b(phone (call|number)|call you|call me|speak (to|with) (someone|a (person|human|manager)))\b/i,
      /\b(zoom|google meet|teams|video call)\b/i,
      /\b(in person|meet up|meet in person|face to face)\b/i
    ],
    promptInjection:
      `The user wants to speak to a human. Be honest and offer the right channels:
- Acknowledge: "Totally understand wanting to speak to someone real."
- Be transparent: I (David) work over WhatsApp, but human support is at support@tutorii.com, Sun-Thu 9-6 GST. They respond within 24 hours.
- Offer the website as a self-service trust check: www.tutorii.com has the support contact, the FAQ, everything.
- Don't promise a phone call you can't deliver — keep it honest.
- End with: "Email support if you want to chat with someone, or just have a look at the platform first — whatever feels right."`
  },
  {
    name: "recruiter_motive",
    patterns: [
      /\b(what'?s in it for you|why are you (recruiting|messaging|reaching out to|contacting) me)\b/i,
      /\b(do you (get paid|earn) (for|from|on) this|are you on commission)\b/i,
      /\b(why me( specifically)?|why did you pick me)\b/i,
      /\b(are you (also )?an agent|are you (selling|pitching) me)\b/i
    ],
    promptInjection:
      `The user wants to understand your motive. Be transparent:
- Be honest: "I'm part of the Tutorii team, building out our agent network. Recruiting agents is my role."
- Reassure on conflict of interest: "There's no upline/downline — I don't earn off your performance. My job is just to find good agents."
- Address "why me": "I shortlisted your CV from GulfTalent because your background fits. We're being selective rather than spamming everyone."
- Keep it short and matter-of-fact. Honesty here builds more trust than spin.`
  },
  {
    name: "why_high_commission",
    patterns: [
      /\b(why (is|are) (the )?commission(s)? so high|why 40%|why such (a )?high commission)\b/i,
      /\b(too good to be true|sounds too good|that'?s (a lot|too much))\b/i,
      /\b(what'?s the catch|where'?s the catch|there must be a catch)\b/i,
      /\b(how (can|do) (you|they) (afford|pay) (40%|that much))\b/i
    ],
    promptInjection:
      `The user thinks the commission sounds suspiciously high. Give them the genuine business reason:
- Acknowledge: "Fair scepticism."
- The real answer: traditional customer acquisition (Google ads, Meta ads, influencer marketing) costs roughly the same or more per subscriber. Tutorii pays the budget directly to agents instead. It's performance-based marketing — you only get paid when subscribers actually pay.
- Compare: "Most affiliate programmes pay 5-15% one-off. Tutorii pays 40% recurring because they want serious agents who'll bring quality subscribers, not one-shot referrals."
- End: "It's a smart marketing model, not too good to be true."`
  },
  // ============================================================
  //   VISA & EMPLOYMENT (UAE-specific concerns)
  // ============================================================
  {
    name: "visa_concern",
    patterns: [
      /\b(visa|residency|residence|sponsor(ed|ship)?|emirates id|labour card)\b/i,
      /\b(work permit|work visa|tourist visa|visit visa|free zone)\b/i,
      /\b(am i allowed|is this allowed|legal for me)\b/i
    ],
    promptInjection:
      `The user is worried about visa implications — a major concern for every UAE expat. Be confidently reassuring:
- The agent role is INDEPENDENT income, not employment. You're not being hired, no work visa needed, no labour card change.
- Reassure clearly: "It's just a referral commission — same as if a bank paid you for referring a friend. No visa implications at all."
- Normalise it: "Plenty of expats earn referral income — banks, gyms, real estate agents. It's standard."
- End with: "You're absolutely good to do this."`
  },
  {
    name: "employer_concern",
    patterns: [
      /\b(my (employer|boss|company|work) (find out|know|allow))\b/i,
      /\b(will (anyone|tutorii|you) (tell|inform|notify) my (employer|boss|company))\b/i,
      /\b(can i do this (alongside|while|with) my (job|work))\b/i,
      /\b(am i allowed to (do this|earn|have side income))\b/i
    ],
    promptInjection:
      `The user is worried about their employer finding out. Be confident and reassuring — this is fine:
- Tutorii doesn't disclose your involvement to anyone — your participation is completely private.
- Reassure clearly: "Yes, this is absolutely fine. It's a personal referral activity in your own time, on your personal phone — completely separate from your day job."
- Normalise it: "Most expats do similar things — referring banks, gyms, real estate agents, etc. — it's standard."
- No work needed during work hours: "You can share your link whenever suits you — evenings, weekends, lunch breaks, however you want."
- End confidently: "You're good to go."`
  },
  {
    name: "trade_license",
    patterns: [
      /\b(trade licen[cs]e|do i need a licen[cs]e|business licen[cs]e|freelance permit)\b/i,
      /\b(register (a |my )?(business|company)|self.?employed|sole proprietor)\b/i
    ],
    promptInjection:
      `The user is asking about trade licenses or business registration. Be clear:
- "No trade licence needed. You're an independent referrer, not running a business."
- Reassure: "You're not selling products, holding inventory, or invoicing customers. Tutorii handles all of that. You just share a link."
- Compare: "Same as referring a friend to your bank or your gym for a bonus — no business setup required."
- For tax: "Tax reporting depends on your country of residence. Tutorii doesn't withhold — you handle that side per local rules. Worth checking with an accountant if your earnings get significant."
- Keep it simple. Most agents won't earn at a level that triggers any of this in year one.`
  },
  // ============================================================
  //   SELF-DOUBT (the silent killer of conversion)
  // ============================================================
  {
    name: "not_a_salesperson",
    patterns: [
      /\b(i'?m not (a )?(sales(person)?|good at (sales|selling))|not my (thing|strength))\b/i,
      /\b(i'?m (shy|introvert(ed)?|quiet|awkward|not outgoing|bad at talking))\b/i,
      /\b(i hate (selling|sales|cold (calling|messaging)))\b/i,
      /\b(i don'?t want to (sell|pitch|push|convince))\b/i
    ],
    promptInjection:
      `The user thinks they're not cut out for sales. This is the #1 silent killer — handle it gently:
- Reframe: "You don't have to sell. You share a link, and the platform sells itself."
- Validate: "Honestly, our best agents aren't pushy salespeople — they're regular people who use the platform and share what they find useful."
- Practical example: "Some agents just post once on their Instagram or share in a parent group. No 'pitching' required."
- The handbook covers everything: "You'll get a sales script handbook so you don't have to figure out what to say. Just copy, paste, send."
- End: "If you can send a WhatsApp message, you can do this."`
  },
  {
    name: "no_network",
    patterns: [
      /\b(i don'?t (have|know) (many|a lot of|enough) (people|contacts|friends))\b/i,
      /\b(i don'?t know (who|anyone) (to (refer|share|tell)))\b/i,
      /\b(small network|small (circle|group) of friends|don'?t have (a network|connections))\b/i,
      /\b(i'?m (new|fairly new|just (moved|arrived)) (here|to the uae|in dubai))\b/i
    ],
    promptInjection:
      `The user doesn't think they have enough contacts. Reframe and reduce the bar:
- Reframe the bar: "You don't need hundreds. Even 5 referrals = AED 190/month recurring. Most people can find 5."
- Reframe contacts: "You probably know more people than you think — colleagues, neighbours, building groups, parent groups, nationality WhatsApp groups, social media followers."
- Beyond personal contacts: "You can also share on social media, Facebook groups for expats, or just post your link on your status. Many agents grow that way."
- Quality over quantity: "5 active subscribers paying you monthly is better than 100 contacts who never convert."
- End: "Worth giving it a try — the account is free either way."`
  },
  {
    name: "spam_friends_fear",
    patterns: [
      /\b(i don'?t want to (spam|annoy|bother) (my )?(friends|family|contacts|people))\b/i,
      /\b(my friends will (think|hate|be annoyed))\b/i,
      /\b(spam(ming)?|come across as desperate|look pushy|feel weird)\b/i,
      /\b(don'?t want to (be|look like|sound like) (a salesperson|pushy|that person))\b/i
    ],
    promptInjection:
      `The user doesn't want to spam their friends. Validate and reframe:
- Validate: "Completely fair — nobody likes that 'hi how are you long time no speak by the way buy this' message."
- Reframe sharing: "You're not selling them a product, you're sharing useful courses about life in the UAE — workers rights, visa info, financial planning. That's genuinely helpful content."
- Suggest a soft approach: "Most agents just share their link once on social media or in a group, no DMs. People who want it click. People who don't ignore it. No spam, no awkwardness."
- Quality framing: "The good agents aren't the ones who blast everyone — they're the ones who share thoughtfully with people who'd actually benefit."
- End: "You stay in control of how you share. The handbook gives you scripts that don't feel salesy."`
  },
  // ============================================================
  //   COMPARISON / PAST FAILURES
  // ============================================================
  {
    name: "tried_similar_before",
    patterns: [
      /\b(i (tried|did) (something|stuff) (like this|similar) before)\b/i,
      /\b(i'?m (already|currently) (doing|in) (a|an|another)? ?(affiliate|referral|mlm))\b/i,
      /\b(amway|herbalife|forever living|tupperware|nu skin|young living|isagenix|monat)\b/i,
      /\b(it didn'?t work|didn'?t make any money|burned (out|me) before)\b/i
    ],
    promptInjection:
      `The user has been burned before or is comparing to MLM. Acknowledge and differentiate:
- Validate: "Totally understand — most affiliate or MLM stuff out there is rubbish."
- Differentiate honestly:
  • Only 2 commission levels (not infinite downline)
  • No joining fee, no monthly cost, no inventory to buy
  • The product is real and genuinely useful (courses for expats)
  • Subscribers stay because the content has value (not because they're pressured)
- Compare: "If you've done MLM, you know the issue — recruiting your friends to recruit their friends. We're not that. Subscribers are paying for a real service. You just earn a slice for bringing them in."
- Coexistence: "Plenty of agents do this alongside other side hustles. It's flexible — give it a month and see if it fits."
- End with low pressure: "Account is free either way."`
  },
  // ============================================================
  //   LOGISTICS
  // ============================================================
  {
    name: "leaving_uae",
    patterns: [
      /\b(i'?m (leaving|moving|going back|relocating) (the )?(uae|dubai|abu dhabi|sharjah|gulf))\b/i,
      /\b(going back (home|to) ?\w*|moving back|repatriating)\b/i,
      /\b(only (here|in (the )?uae) (for|until|temporarily))\b/i,
      /\b(my visa (expires|ends|is (expiring|ending))|visa (cancelled|cancellation|coming to an end))\b/i
    ],
    promptInjection:
      `The user is leaving or has limited time in the UAE. Reassure — this isn't a blocker:
- "Not a problem at all. The agent role works worldwide — you don't need to be in the UAE."
- Payouts: "Payouts go to any IBAN globally — UAE, India, Philippines, Pakistan, UK, anywhere."
- Subscribers: "Your referrals don't have to be in the UAE either, though most expat-focused content appeals more to people in the Gulf."
- Reassure on continuity: "Your account stays active wherever you are. Commission keeps coming as long as your referrals stay subscribed."
- End: "Wherever you end up, the income follows."`
  },
  {
    name: "international_banking",
    patterns: [
      /\b(can i (use|have) (an? )?(indian|filipino|pakistani|bangladeshi|nepali|sri lankan|egyptian|jordanian|british|uk|us|american|european) (bank|account|iban))\b/i,
      /\b(my bank is in|i bank with|account in (india|philippines|pakistan|bangladesh|nepal|sri lanka|egypt|jordan|uk|england|usa|us|europe))\b/i,
      /\b(international (bank|transfer|iban)|foreign (bank|iban|account))\b/i,
      /\b(non.?uae (bank|iban|account))\b/i
    ],
    promptInjection:
      `The user is asking about international banking. Reassure clearly:
- "Yes — payouts work to any IBAN globally. UAE, India, Philippines, Pakistan, anywhere."
- Honest caveat: "Your bank may charge a small incoming transfer fee depending on your account — check that with them. Tutorii doesn't charge anything."
- Speed: "Transfers usually arrive within 1-5 business days from when MamoPay releases the funds, depending on your bank."
- Practical tip: "If you have a UAE account too, that's usually the cheapest. But not required."
- End: "Just enter whichever IBAN you want when you set up your account."`
  },
  // ============================================================
  //   POST-SETUP SUPPORT
  // ============================================================
  {
    name: "didnt_receive_email",
    patterns: [
      /\b(i (haven'?t|did(n'?t)? ?) (got|gotten|received|seen) (the |an |any )?(email|welcome (email|message)|login))\b/i,
      /\b(no email yet|email hasn'?t (arrived|come))\b/i,
      /\b(where('?s| is) (the |my )?email|nothing in my inbox)\b/i
    ],
    promptInjection:
      `The user hasn't received their welcome email. Practical troubleshooting:
- First step: "Check your spam/junk folder — sometimes the welcome email lands there."
- Second step: "Double-check the email address you gave me — was it spelled correctly?"
- If they confirm spelling: "Let me flag this with the team — usually accounts go live within a few minutes but occasionally there's a delay. If nothing's there in 15-20 minutes, email support@tutorii.com directly and they'll sort it."
- Be apologetic but not over the top: "Sorry for the wait — should be sorted quickly."
- Keep tone calm and practical, not panicked.`
  },
  // ============================================================
  //   INCOME STABILITY (the #1 unaddressed concern)
  // ============================================================
  {
    name: "commission_continuity",
    patterns: [
      /\b(if (my )?(referrals?|subscribers?|they) cancel|what (if|happens) (if )?(my )?(referrals?|subscribers?) (cancel|stop|leave|quit))\b/i,
      /\b(do i (still |keep )?(get|earn|receive) (paid|commission|money)|will (the )?commission (still )?(come|continue|keep coming))\b/i,
      /\b(if i (stop|quit|don'?t (refer|do) anything|am inactive|stop being active))\b/i,
      /\b(do i lose (my )?(commission|earnings|income)|are commissions guaranteed)\b/i
    ],
    promptInjection:
      `The user is asking about income stability — what happens if referrals cancel or they go inactive. Be honest and reassuring:
- If a subscriber cancels: "You earn commission for as long as they stay subscribed. If they cancel, that monthly commission stops — but commissions you've already earned and been paid are yours."
- If the agent goes inactive: "Your existing referrals keep paying you as long as THEY stay subscribed. You don't have to be active to keep earning from people you've already brought in."
- Stickiness reality: "Most subscribers stay because the platform is genuinely useful — workers rights, visa info, financial planning is content people come back to."
- Honest framing: "It's like a subscription business — recurring while it lasts. Some referrals stick for years, some for months. Mix is normal."
- End: "The good news is once you've referred someone, you don't have to do anything else to keep earning from them."`
  },
  {
    name: "realistic_earnings",
    patterns: [
      /\b(what do (most|average|typical|real) agents (actually )?(earn|make))\b/i,
      /\b(realistic(ally)?|honestly|genuinely).*\b(earn|make|income|money)\b/i,
      /\b(average (income|earnings|commission)|median agent)\b/i,
      /\b(is (this|that) realistic|are those numbers real)\b/i
    ],
    promptInjection:
      `The user wants honest, realistic earning numbers — not the best-case scenario. Be straight with them:
- Honest range: "Most active agents land between AED 100-500/month within their first 3 months. Top agents do AED 1,500-3,000+/month after 6 months."
- Be transparent: "Some agents try for a couple of weeks, get 0-2 referrals, and stop. Others share thoughtfully and steadily build to 20-30 active subscribers."
- Anchor to effort: "Like anything, output depends on input. Sharing your link with 5-10 thoughtful people in week one usually gets 1-3 subscribers."
- The compounding angle: "What makes it interesting is the recurring — even AED 200/month is AED 2,400/year doing nothing extra after the initial sharing."
- Don't oversell: "I won't promise you'll earn AED 5,000/month. But AED 200-500/month from 5-15 referrals is genuinely achievable for most people."`
  },
  // ============================================================
  //   PROFESSIONAL REPUTATION (GulfTalent users skew senior)
  // ============================================================
  {
    name: "professional_reputation",
    patterns: [
      /\b(my (professional )?(reputation|image|brand|standing))\b/i,
      /\b(look(s)? (bad|unprofessional|cheap|tacky|desperate))\b/i,
      /\b(linked\s*in (presence|profile|connections|network))\b/i,
      /\b(senior (role|position|manager|executive)|i'?m a (manager|director|executive|senior))\b/i,
      /\b(my colleagues will (think|judge))\b/i
    ],
    promptInjection:
      `The user is worried about professional reputation. Address it head-on:
- Validate: "Fair concern — especially if you're in a senior role. How you present this matters."
- Reframe: "Plenty of agents are senior professionals. They share quietly with their personal network — friends, family, neighbours — not on LinkedIn or with colleagues."
- Discretion is the default: "You decide where and how you share. Many agents never post publicly — they just message a few people directly."
- The product helps: "If you do share, you're sharing useful courses about UAE life, workers rights, financial planning. That's positioning yourself as someone who shares value, not someone hawking a product."
- End: "Your reputation stays in your control. There's no requirement to broadcast anything."`
  },
  // ============================================================
  //   POST-SETUP SUPPORT (where agents quietly drop off)
  // ============================================================
  {
    name: "find_referral_link",
    patterns: [
      /\b(where('?s| is) (my |the )?(referral )?link)\b/i,
      /\b(can'?t find (my )?(referral )?link)\b/i,
      /\b(how (do i|to) (get|find|copy|share) (my )?(referral )?link)\b/i,
      /\b(what'?s my (referral )?link)\b/i
    ],
    promptInjection:
      `The user has logged in and can't find their referral link. Be a clear concierge:
- Walk them through: "Once logged in, look at the left sidebar for 'Referrals' or 'Earnings'. Your unique link is right at the top."
- Copy it: "There's a 'Copy Link' button next to it — tap that and the link goes to your clipboard."
- How to share: "From there, paste it into WhatsApp, Instagram bio, social posts — wherever you want to share."
- If they're stuck: "If you can't find it, screenshot what you see and I can help. Or email support@tutorii.com — they can walk you through screen-by-screen."
- Encourage first action: "Once you have the link, the easiest first step is to share it once on your status or in one group you're already in."`
  },
  {
    name: "first_payout_timing",
    patterns: [
      /\b(when (will i|do i|am i going to) (get (paid|my|first)|see (my )?(first |any )?(payout|money|commission)))\b/i,
      /\b(how long (until|before|till) (i (get|earn|see)|first payout))\b/i,
      /\b(first payout|first payment|first commission)\b/i,
      /\b(minimum (payout|payment)|payout threshold)\b/i
    ],
    promptInjection:
      `The user wants to understand payout timing. Be specific:
- The threshold: "Minimum payout is AED 50 — that's about 2 active subscribers."
- The schedule: "Payouts happen every Tuesday at 9AM Dubai time. Once you cross AED 50, the full amount transfers to your bank that Tuesday."
- Realistic timeline: "If you sign up 2-3 subscribers in your first week, you'll typically hit your first payout within 2-3 weeks."
- Transfer time: "Money usually arrives within 1-5 business days from when MamoPay releases the funds, depending on your bank."
- Below threshold: "If you're below AED 50, your earnings roll over to the next week until you hit the threshold."
- End: "Most agents see their first payout within 3-4 weeks of signing up."`
  },
  {
    name: "inactive_account",
    patterns: [
      /\b(if i (don'?t|do not) (refer|share|recruit|do anything|use it))\b/i,
      /\b(will (you|tutorii) (close|delete|deactivate|cancel) my account)\b/i,
      /\b(activity requirement|minimum activity|do i have to be active)\b/i,
      /\b(can i take (a |some )?(break|time off))\b/i
    ],
    promptInjection:
      `The user wants to know what happens if they're inactive. Reassure:
- "No activity requirement. Your account stays free and active whether you refer one person or zero."
- Existing income continues: "If you've already brought in subscribers, those commissions keep coming as long as those people stay subscribed — even if you do nothing."
- Take breaks freely: "Plenty of agents go quiet for months and then come back to share again. The link doesn't expire."
- Honest framing: "The only thing that stops is new commissions. Existing recurring commissions from past referrals keep flowing."
- End: "There's literally no downside to having the account. Set it up, share when you have time, take breaks whenever you want."`
  },
  // ============================================================
  //   SCOPE / ELIGIBILITY
  // ============================================================
  {
    name: "referring_family",
    patterns: [
      /\b(can i refer (my )?(family|spouse|wife|husband|partner|kids|children|parents|brother|sister|cousin))\b/i,
      /\b(does (family|spouse|wife|husband) count)\b/i,
      /\b(refer myself|self.?refer)\b/i
    ],
    promptInjection:
      `The user wants to know if family / self-referrals count. Be clear:
- Family is fine: "Yes — you can refer family members, friends, anyone. Tutorii doesn't restrict who counts as a referral."
- Self-referral isn't allowed: "You can't refer yourself though (creating a second account just to claim commission). That kind of thing gets flagged and the account suspended."
- Practical scenario: "Many agents start by signing up their spouse, parents, siblings — people who'd genuinely use the courses. Totally fine."
- Honest reminder: "Just make sure they actually want the platform — not just signing up for your sake. Subscribers who don't engage tend to cancel quickly."`
  },
  // ============================================================
  //   PRODUCT CREDIBILITY
  // ============================================================
  {
    name: "content_quality",
    patterns: [
      /\b(is (the )?content (any )?good|are the courses (any )?good)\b/i,
      /\b(quality of (the )?(content|courses?|lessons|videos?))\b/i,
      /\b(who (made|created|teaches|wrote) (the )?(content|courses?))\b/i,
      /\b(worth (paying |the )?(aed )?95)\b/i,
      /\b(can i (preview|see (a )?sample)|sample (course|lesson))\b/i
    ],
    promptInjection:
      `The user wants to assess if the content is actually worth paying for. Be substantive:
- Content scope: "5 modules, 20 lessons covering UAE life, workers rights, job search, financial literacy, entrepreneurship. Each lesson 8-25 minutes with video and PDFs."
- Why it sticks: "The workers rights and visa rules content is what subscribers find most useful — it's information that's hard to find clearly anywhere else for expats."
- Built-in AI tutor: "There's also a 24/7 AI tutor inside the platform — subscribers ask questions and get answers tailored to their situation."
- Direct verification: "Best way to judge: have a look at www.tutorii.com — the curriculum page has every module and lesson listed."
- For agents specifically: "Once your free account is live, you'll have access to all of it. You'll see exactly what subscribers are getting."
- Honest framing: "Content quality is what makes subscribers stay — and that's what makes your commission recurring rather than one-off."`
  }
]

// ---------------------------------------------------------------------------
// Rotating fallback replies per stage (including STALLED & WIN_BACK)
// ---------------------------------------------------------------------------

const FALLBACK_REPLIES = {
  // --- INITIAL: Strong hooks, exclusivity, curiosity ---
  [STAGES.INITIAL]: [
    "Good to hear from you! I came across your CV on GulfTalent — your profile stood out. We're shortlisting people for a free agent role with 40% recurring commission. Open to hearing more?",
    "Thanks for replying! Quick context: I shortlisted your CV from GulfTalent for a sales agent role with Tutorii. Free to join, 40% commission, paid weekly. Worth 2 minutes to explain?",
    "Appreciate the reply! I think you'd be a strong fit based on your background. We give you a free agent account and you earn 40% on every subscriber you bring in. Interested?",
    "Good to hear from you! Your GulfTalent profile caught my eye. I'm building out our agent team — free account, weekly payouts, no cost to you. Want me to walk you through it?",
    "Thanks for getting back to me. I'm offering a free sales agent role — you earn 40% recurring commission on every subscriber. Realistic agents make AED 200–950/month. Want the quick breakdown?",
    "Appreciate the response. To be clear: this isn't a job, it's a flexible earning role. Free account, 40% commission, work on your own schedule. Worth hearing about?",
    "Good to hear from you! I'll keep this short — free agent account, 40% commission, weekly bank payouts, full sales training included. Can I send you the details?"
  ],
  // --- INTERESTED: Detailed pitch with concrete numbers + use website as trust-builder ---
  [STAGES.INTERESTED]: [
    "Here's how it works: Tutorii is an education platform for expats. Subscribers pay AED 95/month — have a look: www.tutorii.com. As an agent, you get the same platform free, plus AED 38/month for every subscriber you bring in. Want to see the numbers?",
    "Quick version: have a look at www.tutorii.com — that's what your future subscribers will see and pay AED 95/month for. You get it free as an agent and earn 40% on every subscription. Practical example — 10 subscribers = AED 380/month recurring. Sound good?",
    "It's straightforward — Tutorii sells subscriptions at AED 95/month (check the site: www.tutorii.com). You get free access as an agent and earn AED 38/month for every subscriber you bring in. Plus AED 4.75/month on their referrals. Want me to set you up?",
    "The model: subscribers pay AED 95/month for the courses, AI tutor, and support (see www.tutorii.com). As an agent you get all that free, plus 40% commission on every subscription you bring in. The product is genuinely useful so subscribers stay — that's recurring income for you. Ready to start?",
    "Here's the maths — subscribers pay AED 95/month, you earn AED 38 of that. 5 subscribers = AED 190/month. 10 = AED 380. 25 = AED 950. Have a look at www.tutorii.com so you know what you'll be selling. Want me to get you set up?",
    "Free account, free training materials, free sales handbook — no cost to you, ever. The platform itself is at www.tutorii.com (that's what subscribers pay for). Most agents start by sharing their link with 5–10 people they know. Want me to get you set up?",
    "Here's the deal — go to www.tutorii.com and have a look. That's the product your subscribers will pay AED 95/month for. You get the same access as an agent (free), plus you earn 40% commission on every subscription. Ready?",
    "The setup is simple: you get a free agent account on www.tutorii.com — same platform paying subscribers use. You share your referral link, people subscribe, you earn AED 38/month per person. Paid every Tuesday to your bank. Want to get started?",
    "Tutorii pays one of the highest commission rates in the industry — 40% recurring. Most affiliate programmes pay 5–15%. Have a look at the platform itself (www.tutorii.com) — when you see the product you'll understand why it sells.",
    "Think of it this way — your future subscribers are the people who go to www.tutorii.com and click 'Subscribe.' You earn AED 38/month every time. Top agents are at AED 2,000+/month. Want me to set up your free account?"
  ],
  // --- QUALIFIED: Ask for EMAIL specifically (this is the conversion gate) ---
  [STAGES.QUALIFIED]: [
    "Brilliant! What's the best email address to set up your free agent account with?",
    "Great choice — let's get you set up. What email address should I use to create your account?",
    "Perfect. I just need your email address and I'll get your free account created within a few minutes. What's the best one to use?",
    "Let's do this. Send me the email address you want me to register your account with — I'll have it set up shortly.",
    "Excellent. What email should I set your account up under? Once I have that, you'll be ready to go within a few minutes.",
    "Right, let's get you started. What's the best email address to use for your account? I'll send your login details there.",
    "Welcome aboard! Just need your email address to set up the account. What's the best one to reach you on?",
    "Brilliant — let's get you in. What email should I use to create your free agent account?",
    "Great. Drop me your email address and I'll have your account ready within a few minutes. You'll get login details and your sales script handbook there.",
    "Perfect. What email address should I register your account with? Everything will be sent there — login details, handbook, the lot."
  ],
  // --- LINK_SENT (account being set up): Confirm receipt, support onboarding ---
  [STAGES.LINK_SENT]: [
    "Have you received the welcome email yet? It should have your login details and the sales handbook. Let me know once you've reset your password.",
    "Quick check — did you get the email with your login details and the sales handbook? Don't forget to use 'Forgot Password' to set your own password as soon as you log in.",
    "Hey, have you had a chance to log in yet? Once you reset your password, you can grab your referral link from the dashboard and start sharing.",
    "Just checking in — make sure you go to 'Forgot Password' to set your own password (it's important for your security). Then explore the platform a bit so you know what you're sharing.",
    "Once you're in, the sales handbook walks you through everything — scripts, where to find subscribers, objection handling. I'm here if you have questions.",
    "Have you read through the handbook yet? It has ready-to-use scripts so you don't have to figure out what to say. Start with people you know — friends, family, colleagues.",
    "Take your time getting set up. Reset your password first, then have a look at the platform and the handbook. Once you're comfortable, share your link with 5 people to start.",
    "Just checking in — any luck logging in? Once you've reset your password and grabbed your referral link, even sharing with 5 people gets you started.",
    "Hey, the handbook covers everything — scripts, objection handlers, where to share your link. Best to read it before you start so you're set up properly.",
    "Once you log in, change your password (use 'Forgot Password'), set up your IBAN in Settings, and grab your referral link. Then start sharing with people you know. Let me know if you hit any snags."
  ],
  // --- STALLED: Re-engage with stronger hooks ---
  [STAGES.STALLED]: [
    "Hey, just checking in. The agent role is still open and a few people who joined recently are already getting their first payouts. Want to take another look?",
    "Hey — quick one. The free agent role with 40% commission is still available. We're filling spots though. Worth another look?",
    "Hi — wanted to circle back. Agents who joined when I first messaged you are now earning AED 200–500/month. The opportunity is still there if you want it.",
    "Hey, no pressure — just wanted to mention the agent spots are still open. Free account, 40% commission, weekly payouts. Let me know if you want to hear more.",
    "Hi — agents I onboarded a few weeks ago are at their second or third payout already. Just wanted to let you know the door's still open.",
    "Hey, following up on the agent role. Free account, full training, 40% commission. The platform keeps growing which means more subscribers to earn from.",
    "Hey, still around if you want to pick this up. Setup takes a couple of minutes and the account is free — no risk in just trying it.",
    "Hi again — wanted to check in. The earning side is strong and we keep adding new agents who are doing well. Want to give it another look?",
    "Hey, circling back one more time. The timing is actually better now — more people subscribing, which means more commission potential for new agents.",
    "Hi — quick reminder, free agent account, 40% recurring commission, weekly bank payouts. No cost to you whatsoever. Just say the word and I'll set you up."
  ],
  // --- WIN_BACK: Fresh start, what's changed ---
  [STAGES.WIN_BACK]: [
    "Hey! Good to hear from you. The agent programme has grown a lot — more subscribers means bigger commission potential. Want a quick update?",
    "Hey! Good timing — we just added new courses and the subscriber base keeps growing. Big opportunity for new agents. Want to hear more?",
    "Great to hear from you! Tutorii keeps growing — new content, more subscribers, agents earning more than ever. Want me to catch you up?",
    "Welcome back! The earning opportunity is bigger than when we last spoke. Happy to fill you in whenever you're ready.",
    "Great to hear from you! The agent commissions have been growing week over week. Let me know if you want the 2-minute update.",
    "Hey! The platform has expanded a lot — new courses, more subscribers, stronger commissions for agents. Want to hear what's changed?",
    "Welcome back! A lot of agents have joined recently and the numbers are encouraging. Let me catch you up on where we are now.",
    "Great to hear from you! There's new content live and the subscriber base keeps climbing. More earning potential for new agents.",
    "Welcome back! The agent programme is stronger than ever. Free account, 40% commission, weekly payouts. Want me to set you up?",
    "Hey! The earning potential is bigger than when we last spoke — more subscribers means more commission for agents. Worth another look?"
  ]
}

// Stage-specific no-reply follow-ups for agent recruitment.
// Differentiated by ANGLE per stage:
//   INITIAL: Curiosity hook (they haven't engaged yet — give them a reason to)
//   INTERESTED: Specific number / social proof (move them off the fence)
//   QUALIFIED: Direct close — assume the sale (they've shown interest, just need a nudge)
//   LINK_SENT: Helpful concierge (account is set up — get them activated)
const NO_REPLY_FOLLOWUPS = {
  // --- INITIAL: Curiosity-driven, low-friction. No hard pitch. ---
  [STAGES.INITIAL]: [
    "Hey, just circling back on my message about the Tutorii agent role. Thought you'd find the numbers interesting — 40% recurring commission, no cost to join. Worth a quick chat?",
    "Hi again — I'll keep this brief. The opportunity I mentioned is still open. Free agent account, weekly bank payouts. Curious to hear more?",
    "Hey, just making sure you saw my earlier message. I shortlisted your CV from GulfTalent for an agent role — free account, 40% commission. Worth 2 minutes?",
    "Hey, just following up. I think your background fits well with what we're looking for. Free agent role, weekly payouts. Happy to explain if you're curious.",
    "Hey, quick follow-up — the agent role is still available. Costs nothing to join, pays AED 38/month per subscriber. Worth hearing about?",
    "Hi — circling back. Free agent account, 40% commission, weekly bank payouts. If now's not a good time, no worries. Just let me know either way.",
    "Hey, just checking — did my earlier message land? Free agent role, no cost to you, 40% recurring commission. Want me to walk you through it?",
    "Hi again — agent spots still open if you're interested. The numbers tend to surprise people once they see them. Want a quick breakdown?"
  ],
  // --- INTERESTED: Move-them-off-the-fence with social proof + specifics ---
  [STAGES.INTERESTED]: [
    "Hey, did you get a chance to think it over? Quick example: an agent who joined when I first messaged you is now at 8 subscribers. AED 304/month recurring.",
    "Just following up — Priya, an agent in Dubai, recovered her time investment in week one. Want me to get you set up?",
    "Hey, the agent role is still open. To put numbers to it: 5 subscribers = AED 190/month, 10 subscribers = AED 380/month. All recurring. Want to get started?",
    "Just checking in — agents who joined a couple of weeks ago are getting their second or third payout already. Want me to set up your account?",
    "Hey, wanted to mention — every agent gets a sales script handbook so you're not figuring out what to say. Want me to get you set up?",
    "Hi, the 40% commission really does add up — even 3 referrals/week = AED 114/month within your first month. Want to lock in your account?",
    "Hey — quick reminder, the account is completely free and the setup takes a few minutes. Want me to get you started?",
    "Just following up. The agents doing best didn't have any sales experience — they just shared their link with their network. Want me to get you in?"
  ],
  // --- QUALIFIED: Direct, assumptive. They've shown interest. Ask for email. ---
  [STAGES.QUALIFIED]: [
    "Hey, ready to get started? Just send me your email and I'll have your account ready within a few minutes.",
    "Quick follow-up — what's the best email to set your account up under? I can get it sorted today.",
    "Hey, still keen? Drop me your email and I'll get the ball rolling.",
    "Just checking — want me to go ahead and set up your account? Just need your email.",
    "Hey, ready when you are. Send me your email and I'll have your free account ready by end of day.",
    "Hi, just need an email address to get you set up. What's the best one to use?",
    "Hey, the spots are filling up. Want me to lock yours in? Just need your email.",
    "Quick one — what email should I use for your account? I'll get it created today."
  ],
  // --- LINK_SENT: Helpful concierge. Account exists — help them activate. ---
  [STAGES.LINK_SENT]: [
    "Hey, did you get the welcome email with your login details? Make sure you reset your password using 'Forgot Password' — important for your security.",
    "Hey, just checking — were you able to log in OK? The handbook should be in your inbox too. Let me know if anything's missing.",
    "Hi, hope the setup went smoothly. Quick reminder: reset your password, add your IBAN in Settings, then grab your referral link. Need any help?",
    "Just checking in — have you read the handbook yet? It walks you through exactly who to message and what to say. Worth 15 minutes before you start.",
    "Hey, your link is live and waiting. Even sharing with 5 people you know gets you AED 190/month. Want any tips on where to start?",
    "Hi, did you see the email with your login? Once you're in, the dashboard makes everything clear. Let me know if you hit any snags.",
    "Hey — once you're set up, the easiest first move is to share your link in 1-2 WhatsApp groups you're already in. Most agents start there.",
    "Just checking — any luck logging in? If you didn't get the email, check spam, or let me know and I'll resend."
  ]
}

// ---------------------------------------------------------------------------
// 4. Time-of-day awareness (Gulf Standard Time UTC+4)
// ---------------------------------------------------------------------------

const GULF_OFFSET_HOURS = 4

function getGulfHour() {
  const now = new Date()
  return (now.getUTCHours() + GULF_OFFSET_HOURS) % 24
}

function getGulfDayOfWeek() {
  // Returns 0 (Sunday) to 6 (Saturday) in Gulf time
  const now = new Date()
  // UTC day, then add Gulf offset hours adjustment
  const gulfMs = now.getTime() + (GULF_OFFSET_HOURS * 60 * 60 * 1000)
  return new Date(gulfMs).getUTCDay()
}

function isWeekend() {
  // UAE weekend is Saturday (6) and Sunday (0).
  // Note: UAE moved to Sat-Sun weekend in 2022.
  const day = getGulfDayOfWeek()
  return day === 0 || day === 6
}

function isGoodSendWindow() {
  // Skip weekends entirely for outbound recruitment messages.
  if (isWeekend()) return false
  const hour = getGulfHour()
  // Good windows: 10am-1pm and 5pm-8pm Gulf time on weekdays
  // (Avoid early morning and late evening which feel intrusive)
  return (hour >= 10 && hour < 13) || (hour >= 17 && hour < 20)
}

function msUntilNextGoodWindow() {
  const now = new Date()
  const gulfHour = getGulfHour()
  const gulfMinute = now.getUTCMinutes()
  const currentMinutes = (gulfHour * 60) + gulfMinute
  const day = getGulfDayOfWeek()

  // Good windows in minutes from midnight: 600-780 (10am-1pm), 1020-1200 (5pm-8pm)
  const windows = [
    { start: 600, end: 780 },
    { start: 1020, end: 1200 }
  ]

  // If it's a weekday and we have a window left today, return ms to that window
  if (day !== 0 && day !== 6) {
    for (const w of windows) {
      if (currentMinutes < w.start) {
        return (w.start - currentMinutes) * 60 * 1000
      }
    }
  }

  // Otherwise, walk forward day-by-day until we hit a weekday at 10am
  let daysToAdd = 1
  let nextDay = (day + 1) % 7
  while (nextDay === 0 || nextDay === 6) {
    daysToAdd++
    nextDay = (nextDay + 1) % 7
  }
  const minutesToTomorrow10am = (daysToAdd * 24 * 60) - currentMinutes + 600
  return minutesToTomorrow10am * 60 * 1000
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Verbose per-message detection logs flood production. Off by default;
// flip DEBUG_DETECTION=1 in env for local debugging.
const DEBUG_DETECTION = process.env.DEBUG_DETECTION === "1"
function debugLog(...args) {
  if (DEBUG_DETECTION) console.log(...args)
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

// Detects an email address in a free-text message.
// Used to gate account creation: we only fire the welcome/onboarding
// message after the user has actually given us an email to set up their account with.
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/

function extractEmail(message) {
  const match = String(message || "").match(EMAIL_REGEX)
  return match ? match[0].toLowerCase() : null
}

// Detects clear agreement signals — used to advance the stage to QUALIFIED
// without depending on the LLM to recognise commitment.
const AGREEMENT_PATTERNS = [
  /\b(yes|yeah|yep|yup|sure|okay|ok|alright|sounds good)\s*[!.,]?\s*(i'?m in|let'?s do it|set me up|sign me up|count me in|let'?s go|go for it|i'?ll do it|do it)\b/i,
  /\b(i'?m|im) (in|interested|down|keen|game)\b/i,
  /\b(let'?s do (it|this)|let'?s go|sign me up|set me up|count me in|where do i sign|how do i (sign up|join|start))\b/i,
  /\b(yes please|yes definitely|absolutely|definitely interested)\b/i
]

function detectClearAgreement(message) {
  const text = String(message || "").trim()
  if (!text) return false
  return AGREEMENT_PATTERNS.some((pattern) => pattern.test(text))
}

// Detects clear disinterest / opt-out / wrong number signals.
// Triggers immediate opt-out without LLM call — saves cost and prevents
// burning goodwill by trying to recruit someone who's clearly not interested.
const HARD_OPT_OUT_PATTERNS = [
  /\b(stop|unsubscribe|don'?t (message|contact|text) me|leave me alone|remove me)\b/i,
  /\b(wrong number|wrong person|not me|never heard of|who (is this|are you))\b/i,
  /\b(not interested|no thanks?|no thank you|not for me)\b/i,
  /\b(do not (call|message|contact)|stop messaging)\b/i,
  /\bf+\s*\*?\s*c?\s*k\b.*\b(off|you)\b/i  // catches abusive opt-outs
]

function detectHardOptOut(message) {
  const text = String(message || "").trim()
  if (!text) return false
  return HARD_OPT_OUT_PATTERNS.some((pattern) => pattern.test(text))
}

// ---------------------------------------------------------------------------
// CRITICAL SAFETY KILLSWITCH — legal / regulatory threat detection.
// ---------------------------------------------------------------------------
// If a prospect threatens legal action, regulatory complaint, or law
// enforcement involvement, the bot goes COMPLETELY SILENT forever:
//   - No reply, not even a polite acknowledgement
//   - No follow-up, no stalled re-engagement, no win-back
//   - No future campaigns will re-target this number
//   - Any future inbound from them is ignored
//
// Total silence is the legally safest posture. Any reply confirms receipt
// and could be construed as continued contact / harassment if the matter
// escalates. The threatening message is stored verbatim for audit purposes.
// ---------------------------------------------------------------------------

const LEGAL_THREAT_PATTERNS = [
  // Direct reporting threats
  /\b(report(ing)? (you|this|your|the (number|company|bot|message|account)) (to|with))\b/i,
  /\b(file (a |an )?(complaint|report|case|police report|legal complaint))\b/i,
  /\b(filing (a |an )?(complaint|report|lawsuit|case))\b/i,
  /\b(make (a |an )?(complaint|police report) (about|against))\b/i,

  // Specific UAE regulatory & government bodies
  /\b(tdra|cbuae|moi)\b/i,
  /\b(public prosecution|ministry of (interior|human resources|economy))\b/i,
  /\b(cybercrime|cyber crime|consumer protection|telecom regulatory|consumer rights)\b/i,
  /\b(etisalat|du)\b.*\b(report|complaint|spam)\b/i,
  /\b(report|complaint|spam|fraud)\b.*\b(etisalat|du)\b/i,  // reverse order

  // Police / law enforcement
  /\b(call(ing)? (the )?(police|authorities|cops))\b/i,
  /\b(going to (the )?(police|authorities))\b/i,
  /\b(police (report|complaint|case|involved)|file with (the )?police)\b/i,

  // Legal action threats — require action context to avoid catching "my lawyer friend"
  /\b(my (lawyer|attorney|solicitor))\b.*\b(will|is|going to|advised|told)\b/i,
  /\b(legal team|legal action|legal proceedings)\b/i,
  /\b(tak(e|ing) (you|this|tutorii|your company) to court|see you in court)\b/i,
  /\b(sue (you|tutorii|your company)|suing (you|tutorii|your company))\b/i,
  /\b(lawsuit|attorney|solicitor)\b.*\b(contact(ing)?|hire(d|ing)?|involved|action|on (this|it|the case))\b/i,
  /\b(on (this|it|the case))\b.*\b(my (lawyer|attorney|solicitor))\b/i,

  // Platform-level reporting
  /\b(report(ing)? (you|this|your number) to whatsapp)\b/i,
  /\b(blocked and reported|blocking (and |then )?reporting)\b/i,

  // Direct accusations of criminality
  /\b(this is (illegal|harassment|spam under (uae )?law|a criminal offence))\b/i,
  /\b(criminal (charges|offence|complaint)|fraud charges)\b/i
]

function detectLegalThreat(message) {
  const text = String(message || "").trim()
  if (!text) return false
  return LEGAL_THREAT_PATTERNS.some((pattern) => pattern.test(text))
}

// ---------------------------------------------------------------------------
// Timing-signal extraction for deferrals.
// Returns { delayMs, label } if a specific time hint is detected, else null.
// Used to override the default 24-hour follow-up so we respect the user's
// stated timing instead of nagging them.
// ---------------------------------------------------------------------------

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

const TIMING_SIGNALS = [
  // ~4-6 hours
  {
    patterns: [
      /\b(in (a |an )?(few |couple of )?hours?|later today|in (an? )?hour|after work|when i (get home|get back|finish (work|today)))\b/i
    ],
    delayMs: 5 * HOUR_MS,
    label: "later today"
  },
  // Tonight / this evening
  {
    patterns: [
      /\b(tonight|this evening|later tonight|later this evening)\b/i
    ],
    delayMs: 6 * HOUR_MS,
    label: "tonight"
  },
  // Tomorrow
  {
    patterns: [
      /\b(tomorrow|tomorrow morning|tomorrow afternoon|tomorrow evening|in the morning|first thing tomorrow)\b/i
    ],
    delayMs: 22 * HOUR_MS,
    label: "tomorrow"
  },
  // This weekend
  {
    patterns: [
      /\b(this weekend|over the weekend|on the weekend|on saturday|on sunday)\b/i
    ],
    delayMs: 3 * DAY_MS,  // approx — the send-window logic will defer past weekend if needed
    label: "this weekend"
  },
  // In a few days / later this week
  {
    patterns: [
      /\b(in (a )?few days|in (a )?couple of days|later this week|in (a )?day or two)\b/i
    ],
    delayMs: 3 * DAY_MS,
    label: "in a few days"
  },
  // Next week
  {
    patterns: [
      /\b(next week|early next week|sometime next week|in (a )?week|in 7 days)\b/i
    ],
    delayMs: 7 * DAY_MS,
    label: "next week"
  },
  // Next month / later (vague long horizon — treat as soft no)
  {
    patterns: [
      /\b(next month|in (a )?few weeks|in (a )?couple of weeks|much later)\b/i
    ],
    delayMs: 14 * DAY_MS,
    label: "later this month"
  }
]

function extractTimingSignal(message) {
  const text = String(message || "").trim()
  if (!text) return null
  for (const signal of TIMING_SIGNALS) {
    if (signal.patterns.some((p) => p.test(text))) {
      return { delayMs: signal.delayMs, label: signal.label }
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Soft-no detection — phrases that usually mean "no" but the user is being
// polite. Different from genuine deferrals (which have specific timing).
// We treat soft-no with a longer, gentler follow-up cadence.
// ---------------------------------------------------------------------------

const SOFT_NO_PATTERNS = [
  /\b(we'?ll see|we will see|i'?ll see|let me think about it|i'?ll think about it|need to think|need some time to think|thinking about it)\b/i,
  /\b(perhaps|might be (interested|something)|i'?ll (let you know|get back to you|come back to you))\b/i,
  /\b(maybe (later|another time|next time|some other time))\b/i,
  /\b(not (right )?now|not at the moment|not at this time)\b/i
]

function detectSoftNo(message) {
  const text = String(message || "").trim()
  if (!text) return false
  return SOFT_NO_PATTERNS.some((pattern) => pattern.test(text))
}

// ---------------------------------------------------------------------------
// Genuine deferral detection — "I'll look at it later" without committing
// either way. These deserve respectful acknowledgement, not a re-pitch.
// ---------------------------------------------------------------------------

const DEFERRAL_PATTERNS = [
  /\b(i'?ll (look|check|read|review|have a look|take a look|read up|check it out|look into (it|this)))\b/i,
  /\b(let me (look|check|read|review|have a look|take a look|read up|check it out|look into (it|this)|see))\b/i,
  /\b(i'?ll (get back to you|come back to you|message you back|reply later))\b/i,
  /\b(can i (get back to you|come back to you|reply later|let you know))\b/i,
  /\b(remind me|message me|text me)\b.*\b(later|tomorrow|tonight|next week|this evening)\b/i
]

function detectDeferral(message) {
  const text = String(message || "").trim()
  if (!text) return false
  return DEFERRAL_PATTERNS.some((pattern) => pattern.test(text))
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export function createConversationEngine({
  twilioClient,
  openAIClient,
  promptManager,
  config,
  stateRepository
}) {
  const userQueues = new Map()
  const processedInbound = new Map()
  const pendingInbound = new Map()
  const followUpTimers = new Map()
  const stalledTimers = new Map()
  const winBackTimers = new Map()

  const followUpDelayMs = config.conversation.followUpDelayMs || 86400000     // 24 hours
  const maxFollowUps = config.conversation.maxFollowUps ?? 1
  const stalledDelayMs = config.conversation.stalledDelayMs || 259200000      // 3 days
  const winBackDelayMs = config.conversation.winBackDelayMs || 2592000000     // 30 days

  const campaignStatus = {
    isRunning: false,
    cancelRequested: false,
    startedAt: 0,
    finishedAt: 0,
    sentCount: 0,
    failedCount: 0,
    totalTargets: config.targets.size,
    lastError: ""
  }

  // -------------------------------------------------------------------------
  // Inbound deduplication
  // -------------------------------------------------------------------------

  function getInboundFingerprint({ messageSid, from, body }) {
    const normalizedBody = normalizeText(body).slice(0, 200)

    if (messageSid) {
      return `sid:${messageSid}`
    }

    const timeBucket = Math.floor(Date.now() / 30000)
    return `fallback:${from}:${normalizedBody}:${timeBucket}`
  }

  // Purge expired dedupe entries on a fixed interval instead of on every inbound call.
  const dedupeCleanupInterval = setInterval(() => {
    const now = Date.now()
    for (const [key, createdAt] of processedInbound.entries()) {
      if (now - createdAt > config.conversation.inboundDedupeTtlMs) {
        processedInbound.delete(key)
      }
    }
  }, 60000)

  function isDuplicateInbound(fingerprint) {
    if (processedInbound.has(fingerprint)) {
      return true
    }

    processedInbound.set(fingerprint, Date.now())
    return false
  }

  // -------------------------------------------------------------------------
  // Per-user sequential task queue
  // -------------------------------------------------------------------------

  function withTaskTimeout(taskFn, ms, label) {
    return Promise.race([
      taskFn(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Task timed out after ${ms}ms: ${label}`)), ms)
      )
    ])
  }

  function enqueueUserTask(userNumber, task) {
    const previous = userQueues.get(userNumber) || Promise.resolve()
    const next = previous
      .then(() => withTaskTimeout(task, 60000, userNumber))
      .catch((error) => {
        console.error(`❌ User task failed for ${userNumber}:`, error.message)
      })

    userQueues.set(
      userNumber,
      next.finally(() => {
        if (userQueues.get(userNumber) === next) {
          userQueues.delete(userNumber)
        }
      })
    )
  }

  // -------------------------------------------------------------------------
  // Outbound throttling & deduplication
  // -------------------------------------------------------------------------

  function estimateResponseDelayMs(body) {
    const words = body.trim().split(/\s+/).filter(Boolean).length
    const estimated = (words * 140) + Math.min(body.length * 12, 1800)
    const minDelay = config.conversation.minResponseDelayMs
    const maxDelay = Math.max(minDelay, config.conversation.maxResponseDelayMs)

    return Math.max(minDelay, Math.min(maxDelay, estimated))
  }

  function isDuplicateOutbound(state, body, dedupeContextKey) {
    const normalized = normalizeText(body)
    const now = Date.now()

    return (
      normalized &&
      dedupeContextKey &&
      dedupeContextKey === state.lastOutboundContextKey &&
      normalized === state.lastOutboundFingerprint &&
      now - state.lastOutboundAt < config.conversation.outboundDuplicateWindowMs
    )
  }

  // -------------------------------------------------------------------------
  // Reply quality gate
  // -------------------------------------------------------------------------

  function isLowQualityAssistantReply(reply) {
    const normalized = normalizeText(reply)
    if (!normalized) return true

    if (["ok", "okay", "k", "alright", "noted", "fine"].includes(normalized)) {
      return true
    }

    const genericRoboticPatterns = [
      /\bhow can i assist you today\b/i,
      /\bhow may i assist you today\b/i,
      /\bhow can i help you today\b/i,
      /\bis there anything else\b/i,
      /\blet me know if you have any questions\b/i,
      /\bi('|')m here to help\b/i,
      /\bhappy to help\b/i
    ]
    if (genericRoboticPatterns.some((pattern) => pattern.test(normalized))) {
      return true
    }

    const words = normalized.split(/\s+/).filter(Boolean)
    return words.length === 1 && words[0].length <= 3
  }

  // -------------------------------------------------------------------------
  // 3. Objection detection
  // -------------------------------------------------------------------------

  function detectObjection(message) {
    const text = normalizeText(message)
    for (const handler of OBJECTION_HANDLERS) {
      if (handler.patterns.some((p) => p.test(text))) {
        return handler
      }
    }
    return null
  }

  // -------------------------------------------------------------------------
  // 2. Social proof picker
  // -------------------------------------------------------------------------

  function getRandomSocialProof() {
    return pickRandom(SOCIAL_PROOF)
  }

  // -------------------------------------------------------------------------
  // Fallback replies (rotating per stage)
  // -------------------------------------------------------------------------

  function buildFallbackReply(stage) {
    const options = FALLBACK_REPLIES[stage]
    if (options && options.length) {
      return pickRandom(options)
    }
    return "Got you. What would you like to know first?"
  }

  // -------------------------------------------------------------------------
  // Sending messages
  // -------------------------------------------------------------------------

  async function sendThrottledMessage({ to, body, state, dedupeContextKey = "" }) {
    if (!body || !body.trim()) return

    if (isDuplicateOutbound(state, body, dedupeContextKey)) {
      console.log(`♻️ Skipping duplicate outbound to ${to}`)
      return
    }

    const now = Date.now()
    const byTypingSpeed = estimateResponseDelayMs(body)
    const byCooldown = Math.max(
      0,
      (state.lastOutboundAt + config.conversation.outboundCooldownMs) - now
    )
    const waitMs = Math.max(byTypingSpeed, byCooldown)

    if (waitMs > 0) {
      await delay(waitMs)
    }

    await twilioClient.messages.create({
      from: config.twilio.from,
      to: `whatsapp:${to}`,
      body
    })

    state.lastOutboundAt = Date.now()
    state.lastOutboundFingerprint = normalizeText(body)
    state.lastOutboundContextKey = dedupeContextKey
  }

  async function withTwilioRetry(fn) {
    const MAX_RETRIES = 3
    let lastError

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await fn()
      } catch (err) {
        lastError = err
        // Twilio rate limit is status 429 or Twilio error code 20429
        // Transient server errors are 500/503
        const httpStatus = err.status
        const twilioCode = err.code
        const isRetryable = httpStatus === 429 || httpStatus === 500 || httpStatus === 503 || twilioCode === 20429
        if (!isRetryable || attempt === MAX_RETRIES) throw err
        const backoffMs = Math.min(1000 * 2 ** attempt, 16000)
        await delay(backoffMs)
      }
    }

    throw lastError
  }

  async function sendTemplate(toNumber) {
    return withTwilioRetry(() => twilioClient.messages.create({
      from: config.twilio.from,
      to: `whatsapp:${toNumber}`,
      contentSid: config.twilio.templateSid,
      contentVariables: JSON.stringify({ 1: "there" })
    }))
  }

  // -------------------------------------------------------------------------
  // 7. Win-back template sender
  //    Uses a pre-approved WhatsApp template (NOT freeform) to stay
  //    compliant with the 24-hour session window rule.
  // -------------------------------------------------------------------------

  async function sendWinBackTemplate(toNumber) {
    return withTwilioRetry(() => twilioClient.messages.create({
      from: config.twilio.from,
      to: `whatsapp:${toNumber}`,
      contentSid: config.twilio.winBackTemplateSid,
      contentVariables: JSON.stringify({ 1: "there" })
    }))
  }

  // -------------------------------------------------------------------------
  // Timer management
  // -------------------------------------------------------------------------

  function cancelAllTimers(userNumber) {
    for (const timerMap of [followUpTimers, stalledTimers, winBackTimers]) {
      const existing = timerMap.get(userNumber)
      if (existing) {
        clearTimeout(existing)
        timerMap.delete(userNumber)
      }
    }
    stateRepository?.setTimerSchedule(userNumber, "followUpScheduledAt", 0).catch(() => {})
    stateRepository?.setTimerSchedule(userNumber, "stalledScheduledAt", 0).catch(() => {})
    stateRepository?.setTimerSchedule(userNumber, "winBackScheduledAt", 0).catch(() => {})
  }

  function cancelFollowUp(userNumber) {
    const existing = followUpTimers.get(userNumber)
    if (existing) {
      clearTimeout(existing)
      followUpTimers.delete(userNumber)
    }
    stateRepository?.setTimerSchedule(userNumber, "followUpScheduledAt", 0).catch(() => {})
  }

  // 4. Time-aware scheduling — delays until next good Gulf send window
  function computeTimeAwareDelay(baseDelayMs) {
    if (isGoodSendWindow()) {
      return baseDelayMs
    }
    const windowWait = msUntilNextGoodWindow()
    return Math.max(baseDelayMs, windowWait)
  }

  function scheduleFollowUp(userNumber, customDelayMs = null) {
    cancelFollowUp(userNumber)

    // Use custom delay if provided (e.g. user said "tomorrow" → ~22h); else default 24h.
    // Smaller jitter for short delays (<6h) to avoid overshooting the user's stated window.
    const baseDelay = customDelayMs !== null ? customDelayMs : followUpDelayMs
    const jitterRange = baseDelay < (6 * 60 * 60 * 1000)
      ? 30 * 60 * 1000      // ±30 min for short windows ("in a few hours")
      : 2 * 60 * 60 * 1000  // ±2 hours for longer windows
    const jitter = Math.floor(Math.random() * jitterRange * 2) - jitterRange
    const delayMs = computeTimeAwareDelay(Math.max(0, baseDelay + jitter))
    const scheduledAt = Date.now() + delayMs

    const timer = safeSetTimeout(() => {
      followUpTimers.delete(userNumber)
      stateRepository?.setTimerSchedule(userNumber, "followUpScheduledAt", 0).catch(() => {})
      enqueueUserTask(userNumber, () => sendFollowUp(userNumber))
    }, delayMs)

    followUpTimers.set(userNumber, timer)
    stateRepository?.setTimerSchedule(userNumber, "followUpScheduledAt", scheduledAt).catch(() => {})
  }

  // 1. Schedule STALLED re-engagement (3 days of silence)
  function scheduleStalled(userNumber) {
    const existing = stalledTimers.get(userNumber)
    if (existing) {
      clearTimeout(existing)
    }

    const delayMs = computeTimeAwareDelay(stalledDelayMs)
    const scheduledAt = Date.now() + delayMs

    const timer = safeSetTimeout(() => {
      stalledTimers.delete(userNumber)
      stateRepository?.setTimerSchedule(userNumber, "stalledScheduledAt", 0).catch(() => {})
      enqueueUserTask(userNumber, () => sendStalledMessage(userNumber))
    }, delayMs)

    stalledTimers.set(userNumber, timer)
    stateRepository?.setTimerSchedule(userNumber, "stalledScheduledAt", scheduledAt).catch(() => {})
  }

  // 7. Schedule win-back (21 days after opt-out)
  function scheduleWinBack(userNumber) {
    const existing = winBackTimers.get(userNumber)
    if (existing) {
      clearTimeout(existing)
    }

    const delayMs = computeTimeAwareDelay(winBackDelayMs)
    const scheduledAt = Date.now() + delayMs

    const timer = safeSetTimeout(() => {
      winBackTimers.delete(userNumber)
      stateRepository?.setTimerSchedule(userNumber, "winBackScheduledAt", 0).catch(() => {})
      enqueueUserTask(userNumber, () => sendWinBack(userNumber))
    }, delayMs)

    winBackTimers.set(userNumber, timer)
    stateRepository?.setTimerSchedule(userNumber, "winBackScheduledAt", scheduledAt).catch(() => {})
  }

  // -------------------------------------------------------------------------
  // Follow-up sender (24hr no-reply)
  // -------------------------------------------------------------------------

  async function sendFollowUp(userNumber) {
    const state = await getUserState(userNumber, config.conversation.maxHistoryMessages)

    if (state.optedOut) return
    if ((state.followUpCount || 0) >= maxFollowUps) {
      // Follow-ups exhausted → escalate to STALLED timer
      scheduleStalled(userNumber)
      return
    }

    // Don't follow up if user replied since we scheduled this
    const timeSinceLastInbound = Date.now() - (state.lastInboundAt || 0)
    if (state.lastInboundAt && timeSinceLastInbound < followUpDelayMs) return

    // Pick a stage-appropriate follow-up
    const stageFollowUps = NO_REPLY_FOLLOWUPS[state.stage] || NO_REPLY_FOLLOWUPS[STAGES.INITIAL]
    const followUpBody = pickRandom(stageFollowUps)

    await appendHistory(
      userNumber,
      state,
      "assistant",
      followUpBody,
      config.conversation.maxHistoryMessages
    )

    await sendThrottledMessage({
      to: userNumber,
      body: followUpBody,
      state,
      dedupeContextKey: "follow-up"
    })

    state.followUpCount = (state.followUpCount || 0) + 1
    await persistUserState(userNumber, state)

    // If this was the last allowed follow-up, queue the stalled timer
    if (state.followUpCount >= maxFollowUps) {
      scheduleStalled(userNumber)
    }
  }

  // -------------------------------------------------------------------------
  // 1. STALLED re-engagement sender (3 days of total silence)
  // -------------------------------------------------------------------------

  async function sendStalledMessage(userNumber) {
    const state = await getUserState(userNumber, config.conversation.maxHistoryMessages)

    if (state.optedOut) return
    if (state.stalledSent) return

    // Safety: don't send if user replied recently
    const timeSinceLastInbound = Date.now() - (state.lastInboundAt || 0)
    if (state.lastInboundAt && timeSinceLastInbound < stalledDelayMs) return

    advanceStage(state, STAGES.STALLED)

    const stalledBody = pickRandom(FALLBACK_REPLIES[STAGES.STALLED])

    await appendHistory(
      userNumber,
      state,
      "assistant",
      stalledBody,
      config.conversation.maxHistoryMessages
    )

    await sendThrottledMessage({
      to: userNumber,
      body: stalledBody,
      state,
      dedupeContextKey: "stalled"
    })

    state.stalledSent = true
    await persistUserState(userNumber, state)
  }

  // -------------------------------------------------------------------------
  // 7. Win-back sender (30 days after opt-out)
  // -------------------------------------------------------------------------

  async function sendWinBack(userNumber) {
    if (!config.twilio.winBackTemplateSid) {
      console.warn(`⚠️ WIN_BACK skipped for ${userNumber} — TWILIO_WIN_BACK_TEMPLATE_SID not configured`)
      return
    }

    const state = await getUserState(userNumber, config.conversation.maxHistoryMessages)

    if (!state.optedOut) return
    if (state.winBackSent) return

    try {
      await sendWinBackTemplate(userNumber)

      state.winBackSent = true
      state.stage = STAGES.WIN_BACK

      await appendHistory(
        userNumber,
        state,
        "assistant",
        "[WIN_BACK_TEMPLATE_SENT]",
        config.conversation.maxHistoryMessages
      )
      await persistUserState(userNumber, state)

      console.log(`🔄 Win-back template sent to ${userNumber}`)
    } catch (error) {
      console.error(`❌ Win-back failed for ${userNumber}:`, error.message)
    }
  }

  // -------------------------------------------------------------------------
  // Core message handler
  // -------------------------------------------------------------------------

  async function handleUserMessage(from, message) {
    const state = await getUserState(from, config.conversation.maxHistoryMessages)
    const outboundContextKey = normalizeText(message).slice(0, 200)

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // CRITICAL SAFETY KILLSWITCH (must run first)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 1. If killswitch was previously triggered, ignore this message entirely.
    if (state.killswitchTriggered) {
      console.error(`🚨 Killswitch active for ${from} — inbound ignored (silenced ${new Date(state.killswitchTriggeredAt).toISOString()})`)
      return
    }

    // 2. If this message contains a legal/regulatory threat, trigger the killswitch.
    if (detectLegalThreat(message)) {
      state.killswitchTriggered = true
      state.killswitchTriggeredAt = Date.now()
      state.killswitchMessage = String(message || "").slice(0, 500)
      // Also mark opted out as a belt-and-braces safeguard against any other code path.
      state.optedOut = true
      state.optedOutAt = Date.now()

      // Cancel ALL pending timers — no follow-ups, stalled, or win-back will fire.
      cancelAllTimers(from)

      // Persist immediately so even a crash now leaves the user permanently silenced.
      await persistUserState(from, state)

      // Loud, structured log for ops awareness — head of sales should review.
      console.error(`🚨🚨 KILLSWITCH TRIGGERED for ${from}`)
      console.error(`   Time:    ${new Date(state.killswitchTriggeredAt).toISOString()}`)
      console.error(`   Message: "${state.killswitchMessage}"`)
      console.error(`   Action:  All future communication suspended permanently.`)

      // Total silence — no reply, no acknowledgement, nothing.
      return
    }

    // --- 7. Win-back reply handling ---
    if (state.optedOut && state.winBackSent) {
      state.optedOut = false
      state.stage = STAGES.INTERESTED
      state.followUpCount = 0
      state.stalledSent = false
      console.log(`✅ Win-back reply from ${from}, re-activating`)
    }

    if (state.optedOut) {
      return
    }

    // --- 1. Re-activate stalled users who reply ---
    if (state.stage === STAGES.STALLED) {
      state.stalledSent = false
      state.followUpCount = 0
      if (state.linkSent) {
        advanceStage(state, STAGES.LINK_SENT)
      } else {
        advanceStage(state, STAGES.INTERESTED)
      }
      console.log(`✅ Stalled user ${from} re-engaged → ${state.stage}`)
    }

    // Track when user last messaged us & cancel all pending timers
    state.lastInboundAt = Date.now()
    cancelAllTimers(from)

    await appendHistory(
      from,
      state,
      "user",
      message,
      config.conversation.maxHistoryMessages
    )

    // --- HARD OPT-OUT DETECTION (runs before LLM) ---
    // Catches "stop", "wrong number", "not interested" etc. without burning
    // an LLM call or risking the bot trying to "convince" them otherwise.
    if (detectHardOptOut(message)) {
      state.optedOut = true
      state.optedOutAt = Date.now()
      const closeMessage =
        "Understood — I won't message again. All the best."
      await appendHistory(
        from,
        state,
        "assistant",
        closeMessage,
        config.conversation.maxHistoryMessages
      )
      await sendThrottledMessage({
        to: from,
        body: closeMessage,
        state,
        dedupeContextKey: outboundContextKey
      })
      await persistUserState(from, state)
      scheduleWinBack(from)
      debugLog(`🛑 Hard opt-out detected for ${from}, marked opted out`)
      return
    }

    // --- CLEAR AGREEMENT DETECTION (runs before LLM) ---
    // If user clearly agrees, force-advance to QUALIFIED so the LLM
    // is primed to ask for email rather than re-pitching.
    if (detectClearAgreement(message) && !state.linkSent) {
      advanceStage(state, STAGES.QUALIFIED)
      debugLog(`✅ Clear agreement detected for ${from}, advanced to QUALIFIED`)
    }

    // --- DEFERRAL & TIMING DETECTION ---
    // If the user is deferring (and hasn't hit hard opt-out or clear agreement),
    // we adjust the follow-up timing instead of nagging in 24h.
    // - Specific timing: respect their stated window ("tomorrow" → ~22h)
    // - Soft no: longer, gentler follow-up (5 days)
    // - Generic deferral, no timing: 2 days
    let customFollowUpDelayMs = null
    const timingSignal = extractTimingSignal(message)
    const isSoftNo = detectSoftNo(message)
    const isDeferral = detectDeferral(message)

    if (timingSignal) {
      customFollowUpDelayMs = timingSignal.delayMs
      debugLog(`⏰ Timing signal "${timingSignal.label}" detected for ${from} — follow-up scheduled accordingly`)
    } else if (isSoftNo) {
      customFollowUpDelayMs = 5 * 24 * 60 * 60 * 1000  // 5 days
      debugLog(`🪶 Soft no detected for ${from} — gentle 5-day follow-up scheduled`)
    } else if (isDeferral) {
      customFollowUpDelayMs = 2 * 24 * 60 * 60 * 1000  // 2 days
      debugLog(`📨 Deferral detected for ${from} — 2-day follow-up scheduled`)
    }

    // --- 3. Objection detection ---
    const objection = detectObjection(message)

    // --- 2. Social proof for this turn ---
    const socialProof = getRandomSocialProof()

    const messages = promptManager.buildMessages({
      state,
      history: state.history,
      objectionPrompt: objection ? objection.promptInjection : null,
      socialProof,
      productKnowledge: PRODUCT_KNOWLEDGE
    })

    const turn = await openAIClient.generateTurn(messages)

    // --- Opt-out handling ---
    if (turn.markOptedOut) {
      state.optedOut = true
      state.optedOutAt = Date.now()
      const closeMessage =
        "No problem at all. I won't message again. If you ever want to check out the agent role, just reply here anytime 👋"

      await appendHistory(
        from,
        state,
        "assistant",
        closeMessage,
        config.conversation.maxHistoryMessages
      )
      await sendThrottledMessage({
        to: from,
        body: closeMessage,
        state,
        dedupeContextKey: outboundContextKey
      })
      await persistUserState(from, state)

      // 7. Schedule win-back 30 days from now
      scheduleWinBack(from)
      return
    }

    // --- Stage advancement ---
    advanceStage(state, turn.nextStage)

    // --- Account setup delivery ---
    // We trigger the comprehensive welcome message ONLY when the user has provided
    // an email address. This prevents premature firing if the LLM sets sendLinkNow=true
    // before the user has actually committed their email.
    const userEmail = extractEmail(message)

    const canSendLinkNow =
      !state.linkSent &&
      (turn.sendLinkNow || userEmail !== null) &&
      userEmail !== null &&
      (state.stage === STAGES.QUALIFIED || state.stage === STAGES.LINK_SENT || state.stage === STAGES.INTERESTED)

    if (canSendLinkNow) {
      // Capture the email on state. The Tutorii platform reads this directly from
      // the chat_users collection — no separate queue collection needed.
      // Platform query: {linkSent: true, agentEmail: {$ne: ""}, accountProvisioned: {$ne: true}}
      state.agentEmail = userEmail
      state.agentEmailCapturedAt = Date.now()

      const linkMessage =
`Brilliant — welcome aboard.

I'll set up your free agent account using ${userEmail}. Here's exactly what happens next:

1. Your account will be ready within the next few minutes.

2. You'll receive an email at ${userEmail} with your login details and a temporary password.

3. *Important*: As soon as you log in, go straight to "Forgot Password" and set your own password. We never see or store your password — this step is for your security.

4. You'll also receive your sales script handbook by email — proven WhatsApp scripts and objection handlers to help you start recruiting paying subscribers from day one.

5. Add your IBAN in Settings, grab your referral link from the dashboard, and you're earning.

While you wait, have a proper look at ${config.links.signup} — that's the platform your future subscribers will pay AED 95/month for. Knowing the product inside-out makes selling it much easier.

I'll check back in once your account is live. Anything else in the meantime, just message me here.`

      await sendThrottledMessage({
        to: from,
        body: linkMessage,
        state,
        dedupeContextKey: outboundContextKey
      })

      state.linkSent = true
      advanceStage(state, STAGES.LINK_SENT)
      await appendHistory(
        from,
        state,
        "assistant",
        linkMessage,
        config.conversation.maxHistoryMessages
      )
      await persistUserState(from, state)

      console.log(`✅ Agent email captured for ${from}: ${userEmail}`)
      scheduleFollowUp(from)
      return
    }

    // --- Normal reply ---
    let reply = turn.reply
    if (isLowQualityAssistantReply(reply)) {
      reply = buildFallbackReply(state.stage)
    }

    await appendHistory(
      from,
      state,
      "assistant",
      reply,
      config.conversation.maxHistoryMessages
    )

    await sendThrottledMessage({
      to: from,
      body: reply,
      state,
      dedupeContextKey: outboundContextKey
    })
    await persistUserState(from, state)

    // Schedule follow-up in case they go silent.
    // Uses customFollowUpDelayMs if a timing signal / soft no / deferral was detected,
    // otherwise falls back to default 24h.
    scheduleFollowUp(from, customFollowUpDelayMs)
  }

  // -------------------------------------------------------------------------
  // Inbound message buffering (multi-message merge)
  // -------------------------------------------------------------------------

  async function flushBufferedMessages(from) {
    const pending = pendingInbound.get(from)
    if (!pending) return

    if (pending.timer) {
      clearTimeout(pending.timer)
    }

    pendingInbound.delete(from)
    const mergedMessage = pending.messages
      .map((item) => item.trim())
      .filter(Boolean)
      .join("\n")

    if (!mergedMessage) return

    enqueueUserTask(from, () => handleUserMessage(from, mergedMessage))
  }

  function bufferInboundMessage(from, body) {
    const existing = pendingInbound.get(from) || { messages: [], timer: null }
    existing.messages.push(body)

    if (existing.timer) {
      clearTimeout(existing.timer)
    }

    existing.timer = setTimeout(() => {
      flushBufferedMessages(from).catch((error) => {
        console.error(`❌ Failed to flush buffered messages for ${from}:`, error.message)
      })
    }, config.conversation.inboundDebounceMs)

    pendingInbound.set(from, existing)
  }

  function processInbound({ from, body, messageSid }) {
    if (!body || !body.trim()) {
      return
    }

    const inboundFingerprint = getInboundFingerprint({ messageSid, from, body })
    if (isDuplicateInbound(inboundFingerprint)) {
      console.log(`♻️ Duplicate inbound skipped for ${from}`)
      return
    }

    bufferInboundMessage(from, body)
  }

  // -------------------------------------------------------------------------
  // 5. Template campaign with history tracking & segmentation
  // -------------------------------------------------------------------------

  async function runTemplateCampaign({ skipDuplicates = false } = {}) {
    const campaignTargets = [...config.targets]
    campaignStatus.totalTargets = campaignTargets.length

    const BATCH_SIZE = config.campaign.batchSize || 10

    for (let i = 0; i < campaignTargets.length; i += BATCH_SIZE) {
      if (campaignStatus.cancelRequested) {
        console.log("🛑 Campaign cancelled by admin")
        break
      }

      const batch = campaignTargets.slice(i, i + BATCH_SIZE)

      await Promise.all(batch.map(async (number) => {
        try {
          const state = await getUserState(number, config.conversation.maxHistoryMessages)

          // CRITICAL: Skip users where the killswitch was triggered (legal threat).
          // These must NEVER be contacted again, even by future campaigns.
          if (state.killswitchTriggered) {
            console.error(`🚨 Skipping killswitched user ${number} (silenced ${new Date(state.killswitchTriggeredAt).toISOString()})`)
            return
          }

          // Skip opted-out users (win-back is handled by its own timer)
          if (state.optedOut) {
            console.log(`⏭️ Skipping opted-out user ${number}`)
            return
          }

          // Skip already-contacted users when skipDuplicates is on
          if (skipDuplicates && (state.campaignCount || 0) > 0) {
            console.log(`⏭️ Skipping duplicate ${number} (already contacted ${state.campaignCount} time(s))`)
            return
          }

          // Track campaign touches
          const campaignCount = (state.campaignCount || 0) + 1
          const previousStage = state.stage || STAGES.INITIAL

          if (campaignCount > 1 && previousStage !== STAGES.INITIAL) {
            console.log(`🔁 Re-contacting ${number} (touch #${campaignCount}, prev stage: ${previousStage})`)
          }

          await sendTemplate(number)

          state.campaignCount = campaignCount
          state.lastCampaignAt = Date.now()
          state.lastCampaignStage = previousStage
          await persistUserState(number, state)

          campaignStatus.sentCount += 1

          // Time-aware follow-up
          scheduleFollowUp(number)
        } catch (error) {
          campaignStatus.failedCount += 1
          campaignStatus.lastError = error.message

          const httpStatus = error.status || error.response?.status
          const twilioCode = error.code

          // Auth failures mean all subsequent sends will also fail — abort the campaign.
          if (httpStatus === 401 || httpStatus === 403 || twilioCode === 20003 || twilioCode === 20005) {
            console.error(`🚨 Auth failure sending to ${number} (${httpStatus ?? twilioCode}). Aborting campaign:`, error.message)
            campaignStatus.cancelRequested = true
            return
          }

          // Invalid number or destination — log clearly but keep going.
          const isPermanent = httpStatus === 400 || twilioCode === 21211 || twilioCode === 21408 || twilioCode === 21610
          if (isPermanent) {
            console.error(`⚠️ Permanent failure for ${number} (${httpStatus ?? twilioCode}), skipping:`, error.message)
          } else {
            console.error(`❌ Failed to send template to ${number}:`, error.message)
          }
        }
      }))

      if (i + BATCH_SIZE < campaignTargets.length && !campaignStatus.cancelRequested) {
        await delay(config.campaign.staggerMs)
      }
    }
  }

  function beginCampaignRun() {
    if (campaignStatus.isRunning) {
      return false
    }

    campaignStatus.isRunning = true
    campaignStatus.cancelRequested = false
    campaignStatus.startedAt = Date.now()
    campaignStatus.finishedAt = 0
    campaignStatus.sentCount = 0
    campaignStatus.failedCount = 0
    campaignStatus.lastError = ""

    return true
  }

  function endCampaignRun() {
    campaignStatus.isRunning = false
    campaignStatus.finishedAt = Date.now()
  }

  function handleCampaignRunFailure(error) {
    campaignStatus.lastError = error.message
    console.error("❌ Campaign run failed:", error.message)
  }

  async function triggerTemplateCampaign({ skipDuplicates = false } = {}) {
    if (!beginCampaignRun()) {
      return {
        started: false,
        reason: "already_running",
        status: getCampaignStatus()
      }
    }

    try {
      await runTemplateCampaign({ skipDuplicates })
    } catch (error) {
      handleCampaignRunFailure(error)
    } finally {
      endCampaignRun()
    }

    return {
      started: true,
      status: getCampaignStatus()
    }
  }

  function startTemplateCampaign({ skipDuplicates = false } = {}) {
    if (!beginCampaignRun()) {
      return {
        started: false,
        reason: "already_running",
        status: getCampaignStatus()
      }
    }

    runTemplateCampaign({ skipDuplicates })
      .catch(handleCampaignRunFailure)
      .finally(() => endCampaignRun())

    return {
      started: true,
      status: getCampaignStatus()
    }
  }

  function cancelCampaign() {
    if (!campaignStatus.isRunning) {
      return { cancelled: false, reason: "not_running" }
    }
    campaignStatus.cancelRequested = true
    console.log("🛑 Campaign cancel requested by admin")
    return { cancelled: true }
  }

  function getCampaignStatus() {
    return {
      ...campaignStatus,
      totalTargets: config.targets.size
    }
  }

  async function init() {
    if (!stateRepository?.findUsersWithPendingTimers) return

    let pending
    try {
      pending = await stateRepository.findUsersWithPendingTimers()
    } catch (err) {
      console.error("❌ Failed to restore timers from DB:", err.message)
      return
    }

    const now = Date.now()
    const MIN_DELAY = 5000 // fire after at least 5s so the server finishes booting

    for (const doc of pending) {
      const userNumber = doc._id

      if (doc.followUpScheduledAt > now) {
        const delay = Math.max(MIN_DELAY, doc.followUpScheduledAt - now)
        const timer = setTimeout(() => {
          followUpTimers.delete(userNumber)
          stateRepository.setTimerSchedule(userNumber, "followUpScheduledAt", 0).catch(() => {})
          enqueueUserTask(userNumber, () => sendFollowUp(userNumber))
        }, delay)
        followUpTimers.set(userNumber, timer)
      }

      if (doc.stalledScheduledAt > now) {
        const delay = Math.max(MIN_DELAY, doc.stalledScheduledAt - now)
        const timer = setTimeout(() => {
          stalledTimers.delete(userNumber)
          stateRepository.setTimerSchedule(userNumber, "stalledScheduledAt", 0).catch(() => {})
          enqueueUserTask(userNumber, () => sendStalledMessage(userNumber))
        }, delay)
        stalledTimers.set(userNumber, timer)
      }

      if (doc.winBackScheduledAt > now) {
        const delay = Math.max(MIN_DELAY, doc.winBackScheduledAt - now)
        const timer = setTimeout(() => {
          winBackTimers.delete(userNumber)
          stateRepository.setTimerSchedule(userNumber, "winBackScheduledAt", 0).catch(() => {})
          enqueueUserTask(userNumber, () => sendWinBack(userNumber))
        }, delay)
        winBackTimers.set(userNumber, timer)
      }
    }

    if (pending.length > 0) {
      console.log(`⏰ Restored ${pending.length} pending timer(s) from DB`)
    }
  }

  function destroy() {
    clearInterval(dedupeCleanupInterval)
  }

  return {
    init,
    processInbound,
    triggerTemplateCampaign,
    startTemplateCampaign,
    cancelCampaign,
    getCampaignStatus,
    destroy
  }
}
