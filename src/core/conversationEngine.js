import { delay, normalizeText, safeSetTimeout } from "../utils/index.js"
import { STAGES } from "../constants/stages.js"
import {
  appendHistory,
  advanceStage,
  getUserState,
  persistUserState
} from "./stateStore.js"

// ===========================================================================
//  IMPORTANT — STAGES constant must now include two new values:
//
//    export const STAGES = {
//      INITIAL:    "initial",
//      INTERESTED: "interested",
//      QUALIFIED:  "qualified",
//      LINK_SENT:  "link_sent",
//      STALLED:    "stalled",      // ← NEW
//      WIN_BACK:   "win_back"      // ← NEW
//    }
//
//  Update your constants/stages.js file to match.
// ===========================================================================

// ===========================================================================
//  NEW STATE FIELDS — add these defaults to your stateStore.js:
//
//    stalledSent:      false,
//    winBackSent:      false,
//    optedOutAt:       0,
//    campaignCount:    0,
//    lastCampaignAt:   0,
//    lastCampaignStage: "",
//    followUpCount:    0,
//    lastInboundAt:    0
// ===========================================================================

// ===========================================================================
//  NEW CONFIG FIELDS — add to config.conversation:
//
//    stalledDelayMs:   259200000,    // 3 days
//    winBackDelayMs:   2592000000,   // 30 days
//
//  Add to config.twilio:
//
//    winBackTemplateSid: "HX..."     // Pre-approved WhatsApp template
// ===========================================================================

// ===========================================================================
//  PROMPT MANAGER CONTRACT — promptManager.buildMessages() now receives:
//
//    promptManager.buildMessages({
//      state,
//      history,
//      objectionPrompt,   // string | null — injected instruction for handling a detected objection
//      socialProof,       // string — a social proof statement to weave in naturally
//      productKnowledge   // string — full product fact sheet to include in system prompt
//    })
//
//  Your promptManager should:
//  1. Include productKnowledge in the system prompt so the LLM has accurate facts
//  2. Append objectionPrompt (if present) to the system prompt for that turn
//  3. Include socialProof in the system prompt as a fact David can reference
// ===========================================================================


// ---------------------------------------------------------------------------
// Product knowledge — single source of truth for all Tutorii facts.
// Passed to the LLM every turn so David never gets details wrong.
// ---------------------------------------------------------------------------

const PRODUCT_KNOWLEDGE = `
=== TUTORII — PRODUCT FACT SHEET ===

WHAT IT IS:
Tutorii is a subscription platform that lets you earn recurring passive income through a 40% referral commission — backed by a real education product built for expats in the UAE and GCC. Subscribers get a referral dashboard, access to structured courses, and a built-in AI chat tutor available 24/7.

THE EARNING OPPORTUNITY:
- Level 1 (direct referrals): 40% = AED 38 per referral per month, for as long as they stay subscribed.
- Level 2 (their referrals): 5% = AED 4.75 per referral per month.
- Only 2 levels. No infinite depth. Commissions come from subscription revenue, not sign-up fees.
- No cap on earnings. No limit on number of referrals.
- Referral link provided in your dashboard. Share via WhatsApp, SMS, email, social media — anywhere.
- Referral assignment is permanent and irrevocable at the moment of signup.

INCOME BENCHMARKS:
- 3 referrals = AED 114/month gross (covers subscription + profit from day one)
- 10 referrals = AED 380/month gross (meaningful side income)
- 25 referrals + ~20 L2 = exceeds most part-time jobs
- 50 referrals + ~50 L2 = real income stream

PAYOUTS — HOW THE MONEY REACHES YOU:
- Step 1: You sign up and enter your IBAN in the dashboard under Account Settings. That's it — no extra bank setup, no payment app, no verification calls.
- Step 2: Every time someone subscribes through your referral link, Tutorii automatically calculates your 40% commission (AED 38 per L1 referral, AED 4.75 per L2 referral).
- Step 3: Commissions accumulate in your dashboard in real-time. You can see exactly what you've earned, what's pending, and what's been paid.
- Step 4: Every Tuesday at 9AM Dubai time, Tutorii triggers an automatic payout via MamoPay. If your pending balance is AED 50 or above, the full amount is transferred to your IBAN.
- Step 5: The bank transfer typically arrives within 1–3 business days depending on your bank.
- MamoPay is the payment processor — they are CBUAE-licensed (Central Bank of UAE regulated) and handle all the money movement.
- You can change your IBAN at any time in Settings. Only one IBAN can be active.
- Accepts IBANs from any country — UAE, India, Philippines, Pakistan, anywhere. Not limited to UAE banks.
- Pending earnings below AED 50 are forfeited if account is cancelled.
- Tutorii does not charge any payout fees. Your bank may charge incoming transfer fees depending on your account type.
- Payout statuses: "Processing" = submitted to MamoPay and in transit. "Completed" = funds transferred. "Failed" = bank rejected (usually wrong IBAN — fix it in Settings and it retries next Tuesday).
- You are responsible for reporting and paying taxes on your earnings per your country's laws. Tutorii does not withhold taxes.

PRICING:
- AED 95/month. No contracts, no hidden fees, cancel anytime.
- All sales are final — no refunds on payments already made.
- Cancel from the dashboard Settings page. Access continues until end of billing period.
- If you re-subscribe later, all your course progress is saved — you pick up where you left off.

PAYMENT:
- Visa, Mastercard, Apple Pay, Google Pay — all via MamoPay (CBUAE-licensed, PCI DSS compliant).
- Tutorii never sees or stores card details.

WHAT'S INCLUDED (the product behind the earning):
Courses — 5 modules, 20 lessons:
1. Life in the UAE — Culture, government, healthcare, housing
2. Workers Rights & Legal — Employment rights, disputes, visa rules, legal resources
3. Job Search & Career — CV building, interviews, job portals, networking
4. Financial Literacy — Budgeting, remittance, debt avoidance, saving & investing
5. Entrepreneurship — Mindset, side hustles, freelancing, online income

- Each lesson is 8–25 minutes with video content and/or downloadable PDF guides.
- New modules added regularly. Upcoming: Digital Marketing, Mental Health & Wellbeing, Advanced Career Skills.
- All new content included at no extra cost.
- Courses currently in English. Arabic, Hindi, Urdu, and Tagalog on the roadmap.

AI CHAT TUTOR:
- Built-in AI assistant available 24/7 inside the dashboard.
- Knows the subscriber's account details, earnings, referrals, and course progress.
- Can answer questions about billing, payouts, courses, UAE life, and platform policies.

PLATFORM ACCESS:
- Works on any device with a browser — phone, tablet, laptop, desktop.
- No app download needed. Progress syncs across all devices.
- Available worldwide — anyone can subscribe, not just people in the UAE.

SUPPORT:
- AI assistant: 24/7 inside the dashboard.
- Human support: support@tutorii.com — Sun–Thu, 9AM–6PM GST, responds within 24 hours.
- Complaints: complaints@tutorii.com

SECURITY & TRUST:
- Payments via MamoPay (CBUAE-licensed, PCI DSS compliant).
- Tutorii never sees card numbers.
- Encrypted connections, no data selling, no ad trackers.
- One account per person — fraud detection systems in place.
`.trim()

// ---------------------------------------------------------------------------
// 2. Social proof statements
// ---------------------------------------------------------------------------

const SOCIAL_PROOF = [
  // --- Earning-only (7) ---
  "We've got people here in Dubai who covered their subscription in the first week just by sharing with a few colleagues.",
  "One guy I spoke to last month started with 3 referrals and he's already earning more than his subscription every week.",
  "A lot of the people doing well on Tutorii are expats who just share the link in their work WhatsApp groups — it spreads on its own.",
  "Most people are surprised how fast it adds up. 40% recurring means every person you bring in keeps paying you monthly.",
  "Someone I onboarded two weeks ago hit 10 referrals already. That's AED 380/month in commission.",
  "I had someone sign up from outside the UAE — their friend referred them. The platform works worldwide, payouts go to any IBAN.",
  "The people who do best just share their link in a couple of group chats and let it grow. No hard selling, just sharing.",
  // --- Earning + education (3) ---
  "One of the most popular lessons is Know Your Employment Rights — people share it with colleagues and that alone brings in referrals.",
  "A teacher in Sharjah told me her colleagues all found the courses valuable. She just shared her link once and it spread on its own.",
  "What makes the commissions stick is that people actually use the platform — the courses and AI tutor keep them subscribed, so your 40% keeps coming."
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
- Be upfront: yes, there's a referral commission. That's the point. But here's why it's not MLM:
- There are only 2 levels (not infinite depth). You earn on people you personally refer and one level below. That's it.
- Commissions come from subscription revenue — real people paying for a real product — not from other people's sign-up fees.
- The product behind it is a real education platform for expats with courses, an AI tutor, and content that people actually use. That's what makes it sustainable and shareable.
- Payments are handled by MamoPay, a CBUAE-licensed provider.
- Keep it short, confident, factual. Don't over-explain.`
  },
  {
    name: "no_time",
    patterns: [
      /\b(no time|don'?t have time|too busy|not now|maybe later|busy right now)\b/i,
      /\b(swamped|slammed|hectic)\b/i
    ],
    promptInjection:
      `The user says they don't have time. Reframe it:
- The earning side is passive — share a link once, earn monthly. No daily work.
- The courses are 8-25 min lessons they can do on their phone whenever — no app download, just open in the browser.
- There's also an AI tutor inside the platform that answers questions instantly, so no waiting around.
- Suggest you send the link now so they have it when they're free. No pressure to start immediately.
- Keep it to 1-2 sentences. Don't lecture about time management.`
  },
  {
    name: "cant_afford",
    patterns: [
      /\b(can'?t afford|too expensive|no money|tight budget|not worth|waste of money)\b/i,
      /\b(AED 95 is a lot|that'?s expensive)\b/i
    ],
    promptInjection:
      `The user thinks it's too expensive. Use the break-even pitch:
- AED 95/month, but just 3 referrals and the platform pays for itself.
- Beyond 3 referrals you're in profit every single month.
- Frame it as an investment that pays back fast, not an expense.
- Don't be pushy about it — state the math simply and let them decide.`
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
- Lead with the earning: Tutorii pays 40% recurring monthly commission on every person you refer. Paid weekly to your bank. 3 referrals covers the subscription, anything beyond that is profit.
- Then briefly mention what backs it: it's a real education platform with courses on workers rights, visa rules, career skills, finance — stuff expats actually need. Plus a built-in AI tutor.
- Then push toward the signup link: "honestly the best way to see it is to open the platform itself — want me to send the link?"
- Do NOT say you'll email them a PDF or send more info later. Keep the conversation moving forward.`
  },
  {
    name: "need_to_think",
    patterns: [
      /\b(need to think|think about it|let me think|give me time|not sure yet|consider it)\b/i,
      /\b(i'?ll get back to you|will let you know)\b/i
    ],
    promptInjection:
      `The user wants to think about it. This is a soft stall — handle it with an assumptive move:
- Say "of course, take your time" — don't pressure.
- But immediately follow with: "let me send you the link now so you have it when you're ready."
- This gives them space while keeping the link in their chat. Set sendLinkNow = true if stage is QUALIFIED.
- Do NOT just say "sure, let me know" and leave it. Always leave them with the link.`
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
- Say you found their CV online and thought their profile was a good fit.
- Don't name a specific job site unless asked.
- Quickly redirect: "I reached out because I thought this could be useful for someone with your background."
- Keep it to 1-2 sentences. Don't over-apologize or get defensive.`
  },
  {
    name: "refund",
    patterns: [
      /\b(refund|money back|get my money|charged me|want my money)\b/i,
      /\b(can i get a refund)\b/i
    ],
    promptInjection:
      `The user is asking about refunds. Be honest and upfront:
- All sales are final as per the Terms of Service. No refunds on payments already made.
- They can cancel anytime from their dashboard Settings to stop future charges.
- Access continues until the end of the current billing period.
- If they re-subscribe later, all their course progress is saved.
- Don't be apologetic about the policy — state it clearly and move on.
- If they haven't signed up yet and are asking pre-sale, frame it as: "there are no refunds, but you can cancel anytime with no fees — and 3 referrals covers the cost anyway."`
  },
  {
    name: "app_download",
    patterns: [
      /\b(download|app store|google play|install|is there an app)\b/i,
      /\b(do i need to download)\b/i,
      /\b(what phone|which phone|does it work on)\b/i
    ],
    promptInjection:
      `The user is asking about downloading an app or device compatibility:
- No app download needed. Tutorii works in any browser — phone, tablet, laptop, desktop.
- Just open the link and sign up. Progress syncs across all devices automatically.
- Keep it to 1 sentence. This is a simple answer — don't over-explain.`
  },
  {
    name: "what_do_i_get",
    patterns: [
      /\b(what do i (actually )?get|what('?s| is) included|what am i paying for)\b/i,
      /\b(what('?s| is) in it|what comes with)\b/i,
      /\b(is it just courses|only courses)\b/i
    ],
    promptInjection:
      `The user wants to know what they get for AED 95/month. Lead with the earning side, then the product:
- A referral dashboard with your unique link, real-time tracking, and commission analytics.
- 40% recurring commission on every referral, paid weekly to your bank. No cap on earnings.
- 5 course modules with 20 lessons covering UAE life, legal rights, careers, finance, and entrepreneurship — this is what makes the product easy to share, because it's genuinely useful.
- A built-in AI chat tutor available 24/7 that knows their account and can answer any question.
- New courses added regularly at no extra cost.
- Works on any device, no download needed.
- Frame it as: "you get a way to earn AND a product that's actually worth sharing."
- Keep it punchy — don't list every lesson.`
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
      `The user wants to know how they get paid. This is a buying signal — they're already thinking about receiving money. Be clear and specific:
- It's simple: you enter your IBAN in the dashboard and that's it. No extra apps, no verification calls, no payment platform to sign up for.
- Every Tuesday at 9AM Dubai time, Tutorii automatically sends your earnings to your bank via MamoPay.
- Minimum payout is AED 50. If you're above that, the full amount is transferred.
- Money typically lands in your account within 1–3 business days depending on your bank.
- MamoPay is CBUAE-licensed (regulated by the Central Bank of UAE) so it's fully legit.
- Works with any IBAN worldwide — UAE, India, Philippines, Pakistan, wherever your bank is.
- No payout fees from Tutorii's side.
- You can track everything in real-time in your dashboard — what you've earned, what's pending, what's been paid.
- Keep the tone confident and matter-of-fact. This is one of the strongest parts of the pitch — weekly payouts to their bank, no hoops to jump through.`
  }
]

// ---------------------------------------------------------------------------
// Rotating fallback replies per stage (including STALLED & WIN_BACK)
// ---------------------------------------------------------------------------

const FALLBACK_REPLIES = {
  // --- INITIAL: 70/30 earning/education | endings: mixed ---
  [STAGES.INITIAL]: [
    // Questions (3)
    "Good to hear from you! Quick question — are you open to earning something on the side?",
    "Good to hear from you! I reached out because I think you'd be a great fit for something that pays well. Are you based in the UAE?",
    "Thanks for replying. Would an extra income stream interest you at all?",
    // Soft prompts (2)
    "Appreciate the reply! Let me know if you're open to hearing about a side income opportunity.",
    "Thanks for getting back to me. Happy to explain what I'm working with whenever you have a minute.",
    // Assumptive (1)
    "Good to hear from you! I'll give you the quick version — it'll take 2 minutes.",
    // Curiosity (1)
    "Appreciate the response! I'm working with something that pays 40% recurring commission. Not what most people expect."
  ],
  // --- INTERESTED: 70/30 earning/education | endings: mixed ---
  [STAGES.INTERESTED]: [
    // Questions (4)
    "So here's the short version — Tutorii pays you 40% monthly commission for every person you refer. Paid weekly to your bank. Want me to explain how?",
    "It's called Tutorii. You earn 40% commission on every referral — recurring, every month. 3 referrals and the whole thing pays for itself. Interested?",
    "Quick version: 40% monthly commission, paid every Tuesday to your bank. No cap on what you can earn. Want me to explain the setup?",
    "So the earning side is 40% monthly commission, paid weekly. And the product itself is an education platform for expats — courses, AI tutor, the works. Makes it easy to refer because people actually use it. Worth a look?",
    // Soft prompts (3)
    "Basically it's a way to earn recurring passive income. You share a link, and every time someone subscribes you get 40% every month. No selling, no inventory. Let me know if you want the full breakdown.",
    "Here's the deal — you share a link, people subscribe, you earn 40% of every payment they make. Monthly. Recurring. Happy to walk you through it.",
    "Tutorii pays 40% commission and it's backed by a real product — courses for expats on things like workers rights, visa rules, career skills. That's what makes it easy to share. I can explain the numbers if you're interested.",
    // Assumptive (2)
    "The model is simple — AED 95/month subscription, and you earn AED 38 for every person you bring in, every single month they stay. I'll show you how the math works.",
    "Think of it as a side income that builds over time. 40% commission on every referral, paid weekly to your bank. I'll break down the numbers for you.",
    // Curiosity (1)
    "It's a 40% recurring commission on a platform called Tutorii. The platform has actual courses people in the UAE find useful, so it basically sells itself. The math is pretty interesting once you see it."
  ],
  // --- QUALIFIED: 60/40 earning/education | endings: heavier on assumptive ---
  [STAGES.QUALIFIED]: [
    // Questions (2)
    "Ready to take a look? I'll send the link now — the earning breakdown is all inside.",
    "Want me to send the link? You'll see the earning setup plus the courses — workers rights, finance, career skills. The whole thing.",
    // Soft prompts (2)
    "Let me know when you're ready and I'll send the link. The referral dashboard makes the whole thing really clear.",
    "Let me send the link — you'll see the earning side and the courses. People stick around because the content is genuinely useful, which means your commissions keep coming. Just say the word.",
    // Assumptive (5)
    "Let me send you the link so you can see the earning dashboard for yourself.",
    "I'll drop you the link now. You'll see exactly how the referral side works once you open it.",
    "Let me send the link — you can check out the commission structure and see real numbers.",
    "I'll send it over now. The platform has the referral dashboard plus proper courses with an AI tutor built in — that's what makes people actually stay subscribed.",
    "Let me drop you the link. Once you open it you'll see both the commission setup and the courses — workers rights, visa rules, all useful stuff for expats.",
    // Curiosity (1)
    "Easiest thing is to just see it. The dashboard lays out the commission structure better than I can over text."
  ],
  // --- LINK_SENT: 60/40 earning/education | endings: heavier on soft prompts ---
  [STAGES.LINK_SENT]: [
    // Questions (2)
    "Did you get a chance to look? The commission tracking is all real-time inside the platform. Any questions?",
    "Hey, did you open it yet? You'll see the commission structure and the course library. Anything I can help with?",
    // Soft prompts (4)
    "Once you open it you'll see how the commissions work. Happy to walk you through anything.",
    "Take your time with it. The earning breakdown is all in your dashboard once you sign up. I'm here if anything comes up.",
    "Let me know once you've opened it. You'll see the referral side and the course library — knowing what the product is helps when you share your link.",
    "Take your time. Once you're in you'll see both the earning dashboard and the content. The courses are what make this sustainable — people stay subscribed because they get real value. Just let me know when you've had a look.",
    // Assumptive (3)
    "Once you're in I can show you how people are sharing their link and earning. The setup takes a couple of minutes.",
    "The dashboard makes it really clear — you'll see your link, your referrals, your earnings all in one place. I'll walk you through it once you're in.",
    "Have a look when you get a chance. The platform has proper courses and an AI tutor, so people actually stick around. That's good for you because your commission is recurring. I'll guide you through the rest.",
    // Curiosity (1)
    "Once you open it the referral dashboard kind of speaks for itself. Most people's first reaction is that the numbers are better than they expected."
  ],
  // --- STALLED: 70/30 earning/education | endings: mixed ---
  [STAGES.STALLED]: [
    // Questions (3)
    "Hey, just checking in. The earning opportunity I mentioned is still open. Worth another look?",
    "Hey, just a quick check-in. The 40% commission thing is still there if you're interested. Want me to resend the details?",
    "Hey — quick one. The commission is 40% recurring and the platform has real courses that people use, so churn is low. Good combo for earning. Still interested?",
    // Soft prompts (4)
    "Hi again — a few people I onboarded recently are already earning weekly payouts. Thought of you. The door's still open if you want to take a look.",
    "Hey, no pressure at all — just wanted to circle back. 40% monthly commission, paid to your bank every Tuesday. Let me know if you want to hear more.",
    "Hi — people I spoke to around the same time as you are already seeing their first payouts. Just wanted to let you know it's still there.",
    "Hey, just following up. The earning side is strong and the platform itself has useful content for expats, so referrals tend to stay. Let me know if you want another look.",
    // Assumptive (2)
    "Hey, still around if you want to pick this up. The earning side is simple and the setup takes a few minutes. I'll send the details.",
    "Hi again — wanted to check in. People are earning well from Tutorii and the courses keep people subscribed long-term. Means your commissions stick. I'll send the link again if you want.",
    // Curiosity (1)
    "Hey, circling back one more time. The platform keeps growing which means more people to earn from. The timing is actually better now than when we first spoke."
  ],
  // --- WIN_BACK: 60/40 earning/education | endings: mixed ---
  [STAGES.WIN_BACK]: [
    // Questions (3)
    "Hey! Good to hear from you again. People on Tutorii are earning more than ever — the referral side has really taken off. Want a quick update?",
    "Hey! Good timing — the referral payouts have been growing week over week. Want to hear what's changed?",
    "Great to hear from you! Tutorii keeps growing — new courses, more users, bigger commission pool. Want the update?",
    // Soft prompts (3)
    "Welcome back! The earning opportunity has grown a lot since we last chatted. Happy to fill you in whenever you're ready.",
    "Great to hear from you! The earning side is stronger than ever. Let me know if you want the 2-minute update.",
    "Hey! The platform has grown a lot — new lessons, AI tutor, and the subscriber base keeps climbing. Good news for earning. Just say the word and I'll catch you up.",
    // Assumptive (3)
    "Welcome back! More people earning, bigger weekly payouts. I'll give you the quick rundown.",
    "Great to hear from you! A lot of people have joined recently and the commissions are compounding. Let me catch you up.",
    "Welcome back! There's new content on careers and finance, and more subscribers means more referral opportunity. I'll fill you in.",
    // Curiosity (1)
    "Hey! The platform has added new courses and more people are joining, which means the earning potential is bigger than when we last spoke. The numbers might surprise you."
  ]
}

// Stage-specific no-reply follow-ups
// INITIAL & INTERESTED: 70/30 | QUALIFIED & LINK_SENT: 60/40
// Endings: ~40% questions, ~30% soft prompts, ~20% assumptive, ~10% curiosity
const NO_REPLY_FOLLOWUPS = {
  // --- INITIAL: 70/30 ---
  [STAGES.INITIAL]: [
    // Questions (4)
    "Hey, just circling back. I reached out because I think you could do well with a side income opportunity. 2 minutes to explain — interested?",
    "Hi again — know WhatsApp messages pile up 😅 Short version: there's a way to earn 40% recurring commission by sharing a link. No selling, no inventory. Want the quick breakdown?",
    "Hey, just making sure you saw my message. The opportunity is a 40% monthly commission — paid weekly. Worth 2 minutes?",
    "Hey, just checking in. It's 40% commission on a real education platform — workers rights, career stuff, visa info. Easy to share because people actually need it. Worth a look?",
    // Soft prompts (3)
    "Hey, just a quick follow-up. I think the earning side of this could be a great fit for someone with your profile. Let me know if you want to hear more.",
    "Hey, following up one more time. 40% recurring commission, paid to your bank every Tuesday. Happy to explain if you're interested.",
    "Hi — circling back. The reason this works well is the product behind it is genuinely useful for expats, so referrals stick. That means recurring income for you. Let me know if you'd like the details.",
    // Assumptive (2)
    "Hi — still keen to chat if you are. The earning model is really straightforward and people are doing well with it. I'll send you the quick breakdown.",
    "Hey, quick follow-up. I genuinely think this could work well for you. I'll keep it to 2 minutes if you're up for it.",
    // Curiosity (1)
    "Hi again — the opportunity is earning 40% commission on a platform called Tutorii that has courses for expats in the UAE. The numbers are better than most people expect."
  ],
  // --- INTERESTED: 70/30 ---
  [STAGES.INTERESTED]: [
    // Questions (4)
    "Hey, did you get a chance to think about the earning side? Want me to walk you through the numbers?",
    "Just following up — a few people I spoke to this week signed up and are already seeing commissions come in. Want me to send you the link?",
    "Hey, still interested? The earning setup takes a few minutes and the 40% commission starts immediately. Want me to explain?",
    "Hi, wanted to mention — the reason the earning works long-term is because the platform has real content people use. Means your referrals don't churn. Want me to explain?",
    // Soft prompts (3)
    "Hi, the 40% commission thing I mentioned — it really does add up fast. No rush, but let me know if you want the breakdown.",
    "Just checking in — the weekly payouts are real and the math is simple. Happy to walk you through it whenever you're ready.",
    "Hey, the reason it works well is the platform has courses on things like workers rights and visa rules — stuff every expat needs. So referrals stick and your commission keeps coming. Let me know if you want to hear more.",
    // Assumptive (2)
    "Hey, people I onboarded around the same time I messaged you are already earning. I'll send you the link so you can see for yourself.",
    "Just following up — the product behind it is solid (education for expats, AI tutor) which means people stay subscribed. That's what makes the 40% commission sustainable. I'll break down the numbers for you.",
    // Curiosity (1)
    "Hi — quick reminder, the commission is 40% recurring. Every referral pays you every month. The compounding effect is what catches most people off guard."
  ],
  // --- QUALIFIED: 60/40 ---
  [STAGES.QUALIFIED]: [
    // Questions (2)
    "Hey, want me to go ahead and send you that link?",
    "Ready? I'll send the link now. You'll see the earning side and the education side — courses on visa rules, employment rights, all the stuff expats need. Shall I send it?",
    // Soft prompts (2)
    "Still keen to take a look? I can drop the link right now — takes 2 mins to see how the commissions work. Just say the word.",
    "Hey, let me send it over — you'll see the commissions and the content. People stay because the courses are useful, which is good for your recurring income. Let me know when you're ready.",
    // Assumptive (5)
    "Just checking — I'll send the signup link over now so you have it.",
    "Hey, ready to see the numbers? I'll send the link now.",
    "Want me to send it? Once you're in you'll see exactly how the referral earnings work. Sending it over.",
    "Hey, I'll send the link now. The commission tracking is all real-time so you can see everything.",
    "Shall I drop the link? You'll see both the referral dashboard and the course library. Knowing the product helps when you share it. Sending now.",
    // Curiosity (1)
    "Hey, the dashboard lays everything out better than I can over text. Once you see the numbers it clicks pretty fast."
  ],
  // --- LINK_SENT: 60/40 ---
  [STAGES.LINK_SENT]: [
    // Questions (2)
    "Hey, did you get a chance to open the link I sent? Any questions about how the earning works?",
    "Hey, did you open it yet? You'll see the commission structure and the course library. Anything I can help with?",
    // Soft prompts (4)
    "Just checking in — the link I sent shows exactly how the commissions work. Let me know if you have any questions.",
    "Hi, any luck with the link? Once you open it the referral dashboard is right there. I'm here if anything comes up.",
    "Just checking in — the platform has the referral tracking plus real courses on things like employment rights and financial planning. Both sides are worth seeing. Let me know once you've had a look.",
    "Hi, give the link a look when you can. The courses and AI tutor are what keep people subscribed long-term — that's why the 40% commission is recurring, not one-off. Happy to answer any questions.",
    // Assumptive (3)
    "Hey, the link is still active. Takes 2 mins to see how the earning works. I'll walk you through the rest once you've opened it.",
    "Just following up on the link — once you sign up the commission tracking starts immediately. I'll guide you from there.",
    "Hey, wanted to check if you opened it. The earning setup is really straightforward once you see the dashboard. I'll be here to help with next steps.",
    // Curiosity (1)
    "Hi, the link I sent has everything — the earning dashboard plus the courses. Most people are surprised how clear the commission tracking is once they see it."
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

function isGoodSendWindow() {
  const hour = getGulfHour()
  // Good windows: 9am-1pm and 5pm-9pm Gulf time
  return (hour >= 9 && hour < 13) || (hour >= 17 && hour < 21)
}

function msUntilNextGoodWindow() {
  const now = new Date()
  const gulfHour = getGulfHour()
  const gulfMinute = now.getUTCMinutes()
  const currentMinutes = (gulfHour * 60) + gulfMinute

  // Good windows in minutes from midnight: 540-780 (9am-1pm), 1020-1260 (5pm-9pm)
  const windows = [
    { start: 540, end: 780 },
    { start: 1020, end: 1260 }
  ]

  for (const w of windows) {
    if (currentMinutes < w.start) {
      return (w.start - currentMinutes) * 60 * 1000
    }
  }

  // Past 9pm — next window is 9am tomorrow
  return ((24 * 60) - currentMinutes + 540) * 60 * 1000
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
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

  function scheduleFollowUp(userNumber) {
    cancelFollowUp(userNumber)

    // Spread follow-ups across a ±2 hour window to prevent all 1000 firing simultaneously
    const JITTER_MS = 2 * 60 * 60 * 1000
    const jitter = Math.floor(Math.random() * JITTER_MS * 2) - JITTER_MS
    const delayMs = computeTimeAwareDelay(Math.max(0, followUpDelayMs + jitter))
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
        "No problem at all. I won't message again. If you ever want to check it out, just reply here anytime 👋"

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

    // --- Link delivery ---
    const canSendLinkNow =
      !state.linkSent &&
      turn.sendLinkNow &&
      (state.stage === STAGES.QUALIFIED || state.stage === STAGES.LINK_SENT)

    if (canSendLinkNow) {
      const linkMessage =
        `Here you go 👇\n${config.links.signup}\n\nLet me know when you do, so I can help you get started.`

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

    // Schedule follow-up in case they go silent
    scheduleFollowUp(from)
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
