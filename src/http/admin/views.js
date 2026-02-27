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

export function renderDashboardPage({
  status,
  targets = [],
  targetCount,
  notice = "",
  error = ""
}) {
  const noticeBanner = notice
    ? `<p style="margin: 0 0 12px; color: #065f46; font-size: 14px;">${escapeHtml(notice)}</p>`
    : ""
  const errorBanner = error
    ? `<p style="margin: 0 0 12px; color: #b91c1c; font-size: 14px;">${escapeHtml(error)}</p>`
    : ""
  const isRunning = Boolean(status?.isRunning)
  const targetsList = targets.length
    ? targets
      .map((target) => {
        const safeTarget = escapeHtml(target)
        return `<li style="display:flex; justify-content:space-between; align-items:center; gap:10px; border:1px solid #e5e7eb; border-radius:8px; padding:8px 10px;">
                  <span style="font-size:13px; color:#111827;">${safeTarget}</span>
                  <form method="post" action="/admin/targets/delete" style="margin:0;">
                    <input type="hidden" name="target" value="${safeTarget}" />
                    <button type="submit" style="border:1px solid #ef4444; color:#b91c1c; background:#fff; border-radius:6px; padding:5px 8px; font-size:12px; cursor:pointer;">
                      Delete
                    </button>
                  </form>
                </li>`
      })
      .join("")
    : `<li style="list-style:none; border:1px dashed #d1d5db; border-radius:8px; padding:10px; font-size:13px; color:#6b7280;">
         No targets yet.
       </li>`
  const dashboardScript = `<script>
      (function () {
        const fileInput = document.getElementById("targetsJsonFile");
        const textarea = document.getElementById("targetsJson");
        if (!fileInput || !textarea) return;

        fileInput.addEventListener("change", function () {
          const file = fileInput.files && fileInput.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = function (event) {
            textarea.value = String(event.target && event.target.result || "");
          };
          reader.readAsText(file);
        });
      })();
    </script>`
  const autoRefreshScript = isRunning ? `<script>setTimeout(() => window.location.reload(), 4000)</script>` : ""

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Tutorii Campaign Admin</title>
  </head>
  <body style="margin:0; font-family:-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; background:#f4f7fb; color:#1f2937;">
    <main style="max-width:980px; margin:24px auto; padding:0 16px;">
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

        <hr style="margin:24px 0; border:0; border-top:1px solid #e5e7eb;" />

        <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:16px;">
          <section style="border:1px solid #e5e7eb; border-radius:10px; padding:12px;">
            <h2 style="margin:0 0 10px; font-size:16px;">Current Targets</h2>
            <ul style="padding:0; margin:0; display:grid; gap:8px; max-height:280px; overflow:auto;">
              ${targetsList}
            </ul>
          </section>

          <section style="border:1px solid #e5e7eb; border-radius:10px; padding:12px;">
            <h2 style="margin:0 0 10px; font-size:16px;">Add Target</h2>
            <form method="post" action="/admin/targets/add" style="display:grid; gap:8px;">
              <input type="text" name="target" placeholder="+14155550123 or whatsapp:+14155550123" required style="border:1px solid #d1d5db; border-radius:8px; padding:10px 12px; font-size:13px;" />
              <button type="submit" style="border:0; border-radius:8px; background:#0f766e; color:#fff; padding:9px 12px; font-size:13px; cursor:pointer;">
                Add Target
              </button>
            </form>
          </section>
        </div>

        <section style="margin-top:16px; border:1px solid #e5e7eb; border-radius:10px; padding:12px;">
          <h2 style="margin:0 0 8px; font-size:16px;">Bulk Add From JSON</h2>
          <p style="margin:0 0 10px; color:#6b7280; font-size:13px;">
            Paste a JSON array like <code>["whatsapp:+14155550123","+447700900123"]</code>
          </p>
          <form method="post" action="/admin/targets/import-json" style="display:grid; gap:8px;">
            <input id="targetsJsonFile" type="file" accept=".json,application/json" style="font-size:13px;" />
            <textarea id="targetsJson" name="targetsJson" rows="7" required style="border:1px solid #d1d5db; border-radius:8px; padding:10px 12px; font-size:13px; font-family:ui-monospace, SFMono-Regular, Menlo, monospace;"></textarea>
            <button type="submit" style="border:0; border-radius:8px; background:#0f766e; color:#fff; padding:9px 12px; font-size:13px; cursor:pointer;">
              Import JSON Targets
            </button>
          </form>
        </section>
      </section>
    </main>
    ${dashboardScript}
    ${autoRefreshScript}
  </body>
</html>`
}
