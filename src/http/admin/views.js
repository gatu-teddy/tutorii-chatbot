function escapeHtml(raw = "") {
  return String(raw)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function formatTimestamp(value) {
  if (!value) {
    return "Never"
  }

  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  })
}

export function renderLoginPage({ error = "" }) {
  const errorBanner = error
    ? `<p style="margin: 0 0 12px; color: #b91c1c; font-size: 14px;">${escapeHtml(error)}</p>`
    : ""

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Tutorii Admin Login</title>
  </head>
  <body style="margin:0; font-family:-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; background:#f4f7fb; color:#1f2937;">
    <main style="min-height:100vh; display:flex; align-items:center; justify-content:center; padding:20px;">
      <section style="width:100%; max-width:360px; background:#fff; border:1px solid #e5e7eb; border-radius:12px; padding:24px; box-shadow:0 8px 24px rgba(0,0,0,0.06);">
        <h1 style="margin:0 0 8px; font-size:22px;">Admin Login</h1>
        <p style="margin:0 0 18px; color:#6b7280; font-size:14px;">Sign in to manage campaign sends.</p>
        ${errorBanner}
        <form method="post" action="/admin/login" style="display:grid; gap:12px;">
          <label style="display:grid; gap:6px; font-size:14px;">
            <span>Username</span>
            <input type="text" name="username" required autocomplete="username" style="border:1px solid #d1d5db; border-radius:8px; padding:10px 12px; font-size:14px;" />
          </label>
          <label style="display:grid; gap:6px; font-size:14px;">
            <span>Password</span>
            <input type="password" name="password" required autocomplete="current-password" style="border:1px solid #d1d5db; border-radius:8px; padding:10px 12px; font-size:14px;" />
          </label>
          <button type="submit" style="margin-top:4px; border:0; border-radius:8px; background:#0f766e; color:#fff; padding:10px 12px; font-size:14px; cursor:pointer;">
            Login
          </button>
        </form>
      </section>
    </main>
  </body>
</html>`
}

export function renderDashboardPage({ status, targetCount, notice = "", error = "" }) {
  const noticeBanner = notice
    ? `<p style="margin: 0 0 12px; color: #065f46; font-size: 14px;">${escapeHtml(notice)}</p>`
    : ""
  const errorBanner = error
    ? `<p style="margin: 0 0 12px; color: #b91c1c; font-size: 14px;">${escapeHtml(error)}</p>`
    : ""
  const isRunning = Boolean(status?.isRunning)
  const refreshScript = isRunning
    ? `<script>setTimeout(() => window.location.reload(), 4000)</script>`
    : ""

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Tutorii Campaign Admin</title>
  </head>
  <body style="margin:0; font-family:-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; background:#f4f7fb; color:#1f2937;">
    <main style="max-width:720px; margin:24px auto; padding:0 16px;">
      <section style="background:#fff; border:1px solid #e5e7eb; border-radius:12px; padding:24px; box-shadow:0 8px 24px rgba(0,0,0,0.06);">
        <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:16px; flex-wrap:wrap;">
          <div>
            <h1 style="margin:0; font-size:24px;">Campaign Dashboard</h1>
            <p style="margin:8px 0 0; color:#6b7280; font-size:14px;">Trigger and monitor WhatsApp template sends.</p>
          </div>
          <form method="post" action="/admin/logout">
            <button type="submit" style="border:1px solid #d1d5db; border-radius:8px; background:#fff; color:#111827; padding:8px 12px; font-size:13px; cursor:pointer;">
              Logout
            </button>
          </form>
        </div>

        <div style="margin-top:18px;">
          ${noticeBanner}
          ${errorBanner}
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:10px; margin-top:6px;">
          <article style="border:1px solid #e5e7eb; border-radius:10px; padding:12px;">
            <p style="margin:0; font-size:12px; color:#6b7280;">Status</p>
            <p style="margin:6px 0 0; font-size:16px; font-weight:600;">${isRunning ? "Running" : "Idle"}</p>
          </article>
          <article style="border:1px solid #e5e7eb; border-radius:10px; padding:12px;">
            <p style="margin:0; font-size:12px; color:#6b7280;">Targets</p>
            <p style="margin:6px 0 0; font-size:16px; font-weight:600;">${targetCount}</p>
          </article>
          <article style="border:1px solid #e5e7eb; border-radius:10px; padding:12px;">
            <p style="margin:0; font-size:12px; color:#6b7280;">Sent (current/last run)</p>
            <p style="margin:6px 0 0; font-size:16px; font-weight:600;">${status?.sentCount || 0}</p>
          </article>
          <article style="border:1px solid #e5e7eb; border-radius:10px; padding:12px;">
            <p style="margin:0; font-size:12px; color:#6b7280;">Failed (current/last run)</p>
            <p style="margin:6px 0 0; font-size:16px; font-weight:600;">${status?.failedCount || 0}</p>
          </article>
        </div>

        <div style="margin-top:14px; border:1px solid #e5e7eb; border-radius:10px; padding:12px;">
          <p style="margin:0 0 6px; font-size:13px;"><strong>Last Started:</strong> ${formatTimestamp(status?.startedAt)}</p>
          <p style="margin:0 0 6px; font-size:13px;"><strong>Last Finished:</strong> ${formatTimestamp(status?.finishedAt)}</p>
          <p style="margin:0; font-size:13px;"><strong>Last Error:</strong> ${escapeHtml(status?.lastError || "None")}</p>
        </div>

        <form method="post" action="/admin/campaign/trigger" style="margin-top:16px;">
          <button type="submit" ${isRunning ? "disabled" : ""} style="border:0; border-radius:8px; background:${isRunning ? "#9ca3af" : "#0f766e"}; color:#fff; padding:11px 14px; font-size:14px; cursor:${isRunning ? "not-allowed" : "pointer"};">
            ${isRunning ? "Campaign Running..." : "Trigger Campaign"}
          </button>
        </form>
      </section>
    </main>
    ${refreshScript}
  </body>
</html>`
}
