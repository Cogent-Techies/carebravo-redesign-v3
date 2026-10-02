// Netlify Function: netlify/functions/submit-caredrain-calculator.js
// Server-only code. ZERO external dependencies — only built-in fetch().
// Validates required environment variables BEFORE constructing any URL.
// Inserts the Drain Map record into Supabase via the REST API (Service Role Key),
// then emails a personalized HTML report to the visitor via Mailjet.
//
// Required env vars:
//   SUPABASE_URL               — your project's Supabase REST base URL
//   SUPABASE_SERVICE_ROLE_KEY  — service role key (never expose to browser)
//
// Optional env vars (email step is skipped if either is absent):
//   MJ_APIKEY_PUBLIC           — Mailjet API key (public)
//   MJ_APIKEY_PRIVATE          — Mailjet Secret key
//   MJ_FROM_EMAIL              — override sender; defaults to amy@mycarebravo.com
//   MJ_FROM_NAME               — override sender name; defaults to CareBravo

const SUPABASE_TABLE = 'carebravosite_caredrain_calculator_submissions';
const DEFAULT_FROM_EMAIL = 'amy@mycarebravo.com';
const DEFAULT_FROM_NAME  = 'CareBravo';
const MAILJET_SEND_URL   = 'https://api.mailjet.com/v3.1/send';

// ── Validate required env vars before building any URL ───────────────────────
function getValidatedConfig() {
  const SUPABASE_URL              = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const MJ_APIKEY_PUBLIC          = process.env.MJ_APIKEY_PUBLIC;
  const MJ_APIKEY_PRIVATE         = process.env.MJ_APIKEY_PRIVATE;
  const MJ_FROM_EMAIL             = process.env.MJ_FROM_EMAIL  || DEFAULT_FROM_EMAIL;
  const MJ_FROM_NAME              = process.env.MJ_FROM_NAME   || DEFAULT_FROM_NAME;

  const missing = [];
  if (!SUPABASE_URL)              missing.push('SUPABASE_URL');
  if (!SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');

  if (missing.length > 0) {
    console.error('[submit-caredrain-calculator] Missing required env vars:', missing.join(', '));
    return { ok: false };
  }

  const emailEnabled = Boolean(MJ_APIKEY_PUBLIC && MJ_APIKEY_PRIVATE);
  if (!emailEnabled) {
    console.warn(
      '[submit-caredrain-calculator] MJ_APIKEY_PUBLIC / MJ_APIKEY_PRIVATE not set — ' +
      'submissions will save to Supabase but no report email will be sent.'
    );
  }

  return {
    ok: true,
    config: {
      SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
      MJ_APIKEY_PUBLIC, MJ_APIKEY_PRIVATE,
      MJ_FROM_EMAIL, MJ_FROM_NAME,
      emailEnabled
    }
  };
}

// ── Supabase REST insert ──────────────────────────────────────────────────────
async function insertSubmission(config, payload) {
  const restEndpoint = `${config.SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}`;
  let res;
  try {
    res = await fetch(restEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.SUPABASE_SERVICE_ROLE_KEY}`,
        'apikey':         config.SUPABASE_SERVICE_ROLE_KEY,
        'Content-Type':   'application/json',
        'Prefer':         'return=minimal'
      },
      body: JSON.stringify(payload)
    });
  } catch (networkErr) {
    return { error: { message: `Supabase insert network error: ${networkErr.message}` } };
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    return { error: { message: `${res.status} ${errText}` } };
  }
  return { error: null };
}

// ── Currency formatting helpers (mirror the calculator's fmt / fmtS) ─────────
function fmt(n) {
  return '$' + Math.round(Number(n) || 0).toLocaleString('en-US');
}
function fmtSigned(n) {
  const v = Math.round(Number(n) || 0);
  return (v < 0 ? '−$' : '$') + Math.abs(v).toLocaleString('en-US');
}
function pct(rate) {
  return (Number(rate) * 100).toFixed(2) + '%';
}
function escHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Build the personalized report email ─────────────────────────────────────
// Styling follows CareBravo email brand: white card, max-width 760px,
// border 1px #e4e4e4, border-radius 20px, logo centered, CTA color #667eea.
// "Your thirty days" section is intentionally excluded.
function buildReportEmailHtml(p) {
  const name   = escHtml(p.contact_name || 'there');
  const agency = escHtml(p.agency_name  || 'your agency');
  const state  = escHtml(p.state        || '');
  const dateStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });

  const screenTax  = fmt(p.screen_tax);
  const ttaxRange  = `${fmt(p.ttax_low)}&ndash;${fmt(p.ttax_high)}`;
  const ebitda     = fmtSigned(p.ebitda_today);
  const futA       = fmtSigned(p.future_a);
  const futB       = fmtSigned(p.future_b);
  const gapRange   = `${fmt(p.value_gap_low)}&ndash;${fmt(p.value_gap_high)}`;
  const modeName   = escHtml(p.recommended_mode_name || '');
  const modeRate   = pct(p.mode_rate);
  const topFn      = escHtml(p.top_outcome_name      || '');
  const secondFn   = escHtml(p.second_outcome_name   || '');
  const ownerHrs   = Number(p.owner_hours_week) || 0;

  // Preheader — one line shown in inbox preview, hidden in body
  const preheader = `Your CareDrain™ report for ${escHtml(p.agency_name || 'your agency')} is ready — see exactly what’s draining it.`;

  // CareBravo logo — same asset used across site emails
  const logoUrl = 'https://carebravo.com/images/CareBravo-Logo.jpg';

  // CTA styling
  const ctaBg     = '#667eea';
  const ctaStyle  = `display:inline-block;background-color:${ctaBg};color:#ffffff;font-family:Arial,'Helvetica Neue',sans-serif;font-size:16px;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:8px;letter-spacing:0.01em;`;

  // Row divider helper
  const divRow = `<tr><td colspan="2" style="padding:0;"><table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"><tr><td style="height:1px;background-color:#e8ecf0;font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Your CareDrain™ Report &mdash; ${escHtml(p.agency_name || 'CareBravo')}</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f2f5;-webkit-text-size-adjust:100%;mso-line-height-rule:exactly;">

<!-- Hidden email preview / preheader -->
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#f0f2f5;mso-hide:all;">${preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>

<!-- Outer wrapper -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"
  style="background-color:#f0f2f5;min-width:100%;">
  <tr>
    <td align="center" style="padding:32px 12px;">

      <!-- Card -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"
        style="max-width:760px;background-color:#ffffff;border:1px solid #e4e4e4;border-radius:20px;border-collapse:separate;overflow:hidden;">
        <tbody>

          <!-- ── LOGO ── -->
          <tr>
            <td colspan="2" align="center" style="padding:28px 30px 20px;background-color:#ffffff;">
              <img src="${logoUrl}" alt="CareBravo" width="200"
                style="display:block;margin:0 auto;max-width:200px;height:auto;border:0;outline:0;text-decoration:none;">
            </td>
          </tr>

          <!-- top rule -->
          <tr>
            <td colspan="2" style="padding:0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
                <tr><td style="height:1px;background-color:#e4e4e4;font-size:0;line-height:0;">&nbsp;</td></tr>
              </table>
            </td>
          </tr>

          <!-- ── GREETING ── -->
          <tr>
            <td colspan="2" style="padding:36px 40px 8px;font-family:Arial,'Helvetica Neue',sans-serif;">
              <p style="margin:0 0 10px;font-size:22px;font-weight:700;color:#1a2332;line-height:1.3;">
                Hi ${name},
              </p>
              <p style="margin:0;font-size:15px;color:#4a5568;line-height:1.65;">
                Your personalized <strong style="color:#1a2332;">CareDrain&trade; report</strong> for
                <strong style="color:#1a2332;">${agency}</strong>${state ? ` (${state})` : ''} is ready.
                Every figure below is computed from your own numbers &mdash; nothing here is an average.
              </p>
            </td>
          </tr>

          <!-- meta line -->
          <tr>
            <td colspan="2" style="padding:10px 40px 28px;">
              <p style="margin:0;font-size:12px;color:#7a8699;font-family:Arial,'Helvetica Neue',sans-serif;letter-spacing:0.04em;">
                Prepared ${dateStr} &nbsp;&middot;&nbsp; CareDrain&trade; Calculator
              </p>
            </td>
          </tr>

          <!-- divider -->
          <tr>
            <td colspan="2" style="padding:0 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
                <tr><td style="height:1px;background-color:#e8ecf0;font-size:0;line-height:0;">&nbsp;</td></tr>
              </table>
            </td>
          </tr>

          <!-- ── SECTION I · DRAIN HEADLINE ── -->
          <tr>
            <td colspan="2" style="padding:30px 40px 10px;font-family:Arial,'Helvetica Neue',sans-serif;">
              <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#7a8699;">
                Your Drain Map
              </p>
              <h2 style="margin:0 0 12px;font-size:19px;font-weight:700;color:#1a2332;line-height:1.25;">
                Where it&rsquo;s draining most
              </h2>
              <p style="margin:0;font-size:14px;color:#4a5568;line-height:1.6;">
                Your map is darkest at <strong style="color:#1a2332;">${topFn}</strong>,
                with <strong style="color:#1a2332;">${secondFn}</strong> close behind.
                You reported <strong style="color:#1a2332;">${ownerHrs} hours a week</strong>
                of the business still running through your own hands.
              </p>
            </td>
          </tr>

          <!-- divider -->
          <tr>
            <td colspan="2" style="padding:24px 40px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
                <tr><td style="height:1px;background-color:#e8ecf0;font-size:0;line-height:0;">&nbsp;</td></tr>
              </table>
            </td>
          </tr>

          <!-- ── SECTION II · WHAT IT COSTS ── -->
          <tr>
            <td colspan="2" style="padding:28px 40px 10px;font-family:Arial,'Helvetica Neue',sans-serif;">
              <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#7a8699;">
                Section II
              </p>
              <h2 style="margin:0 0 16px;font-size:19px;font-weight:700;color:#1a2332;line-height:1.25;">
                What it costs, in dollars
              </h2>
            </td>
          </tr>

          <!-- Screen Tax row -->
          <tr>
            <td colspan="2" style="padding:0 40px 10px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"
                style="border:1px solid #e8ecf0;border-radius:8px;background-color:#fafafa;">
                <tr>
                  <td style="padding:16px 18px;font-family:Arial,'Helvetica Neue',sans-serif;vertical-align:top;">
                    <p style="margin:0 0 4px;font-size:14px;font-weight:600;color:#1a2332;">
                      Screen Tax
                    </p>
                    <p style="margin:0;font-size:12px;color:#718096;line-height:1.5;">
                      Time your caregivers lose to screens &amp; paperwork &mdash; up to 8&nbsp;hrs/week each<br>
                      <em>Source: BMC Geriatrics, Ausserhofer et&nbsp;al., 2023</em>
                    </p>
                  </td>
                  <td style="padding:16px 18px;text-align:right;white-space:nowrap;vertical-align:middle;">
                    <span style="font-family:'Courier New',Courier,monospace;font-size:22px;font-weight:700;color:#A03421;">
                      ${screenTax}&nbsp;/&nbsp;yr
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Tangleware Tax row -->
          <tr>
            <td colspan="2" style="padding:0 40px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"
                style="border:1px solid #e8ecf0;border-radius:8px;background-color:#fafafa;">
                <tr>
                  <td style="padding:16px 18px;font-family:Arial,'Helvetica Neue',sans-serif;vertical-align:top;">
                    <p style="margin:0 0 4px;font-size:14px;font-weight:600;color:#1a2332;">
                      Full Tangleware&trade; Tax
                    </p>
                    <p style="margin:0;font-size:12px;color:#718096;line-height:1.5;">
                      The total yearly cost of running ${agency} on disconnected systems &mdash;
                      lost time, software bills, and the hours your office spends carrying data between tools by hand.
                    </p>
                  </td>
                  <td style="padding:16px 18px;text-align:right;white-space:nowrap;vertical-align:middle;">
                    <span style="font-family:'Courier New',Courier,monospace;font-size:22px;font-weight:700;color:#A03421;">
                      ${ttaxRange}&nbsp;/&nbsp;yr
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- divider -->
          <tr>
            <td colspan="2" style="padding:0 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
                <tr><td style="height:1px;background-color:#e8ecf0;font-size:0;line-height:0;">&nbsp;</td></tr>
              </table>
            </td>
          </tr>

          <!-- ── SECTION III · TWO FUTURES ── -->
          <tr>
            <td colspan="2" style="padding:28px 40px 10px;font-family:Arial,'Helvetica Neue',sans-serif;">
              <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#7a8699;">
                Section III
              </p>
              <h2 style="margin:0 0 6px;font-size:19px;font-weight:700;color:#1a2332;line-height:1.25;">
                The same agency, next year, two ways
              </h2>
              <p style="margin:0 0 16px;font-size:13px;color:#718096;line-height:1.5;">
                Both columns assume the same thing: your rate drops 10%. Only the cost structure changes.
                Estimated EBITDA today:
                <strong style="font-family:'Courier New',Courier,monospace;color:#1a2332;">${ebitda}</strong>
              </p>
            </td>
          </tr>

          <!-- Future A / Future B side by side -->
          <tr>
            <td style="padding:0 20px 0 40px;width:50%;vertical-align:top;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"
                style="border:1px solid #e8ecf0;border-radius:8px;background-color:#fff8f8;">
                <tr>
                  <td style="padding:20px;font-family:Arial,'Helvetica Neue',sans-serif;">
                    <p style="margin:0 0 6px;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#a0aec0;">
                      Future A &middot; nothing changes
                    </p>
                    <p style="margin:0 0 8px;font-family:'Courier New',Courier,monospace;font-size:26px;font-weight:700;color:#A03421;line-height:1.1;">
                      ${futA}
                    </p>
                    <p style="margin:0;font-size:12px;color:#718096;line-height:1.5;">
                      The cut lands on your current cost structure. The drain keeps its share.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
            <td style="padding:0 40px 0 20px;width:50%;vertical-align:top;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"
                style="border:1px solid #b7e0c9;border-radius:8px;background-color:#eaf7ef;">
                <tr>
                  <td style="padding:20px;font-family:Arial,'Helvetica Neue',sans-serif;">
                    <p style="margin:0 0 6px;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#2d7a50;">
                      Future B &middot; the nine run themselves
                    </p>
                    <p style="margin:0 0 8px;font-family:'Courier New',Courier,monospace;font-size:26px;font-weight:700;color:#1E6B45;line-height:1.1;">
                      ${futB}
                    </p>
                    <p style="margin:0;font-size:12px;color:#4a7c65;line-height:1.5;">
                      The same cut lands on a leaner cost structure &mdash; after paying for that delivery.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Value gap row -->
          <tr>
            <td colspan="2" style="padding:14px 40px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"
                style="border:1px solid #b7e0c9;border-radius:8px;background-color:#eaf7ef;">
                <tr>
                  <td style="padding:16px 18px;font-family:Arial,'Helvetica Neue',sans-serif;vertical-align:middle;">
                    <p style="margin:0 0 4px;font-size:14px;font-weight:600;color:#1a2332;">
                      What that yearly difference is worth if you ever choose to sell
                    </p>
                    <p style="margin:0;font-size:12px;color:#4a7c65;">
                      Agencies in this industry change hands at roughly 4&ndash;6&times; EBITDA.
                    </p>
                  </td>
                  <td style="padding:16px 18px;text-align:right;white-space:nowrap;vertical-align:middle;">
                    <span style="font-family:'Courier New',Courier,monospace;font-size:22px;font-weight:700;color:#1E6B45;">
                      ${gapRange}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- divider -->
          <tr>
            <td colspan="2" style="padding:0 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
                <tr><td style="height:1px;background-color:#e8ecf0;font-size:0;line-height:0;">&nbsp;</td></tr>
              </table>
            </td>
          </tr>

          <!-- ── SECTION IV · RECOMMENDED MODE ── -->
          <tr>
            <td colspan="2" style="padding:28px 40px 10px;font-family:Arial,'Helvetica Neue',sans-serif;">
              <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#7a8699;">
                Section IV
              </p>
              <h2 style="margin:0 0 12px;font-size:19px;font-weight:700;color:#1a2332;line-height:1.25;">
                Your map points to
              </h2>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"
                style="border:2px solid #1a2332;border-radius:8px;background-color:#f9fafb;">
                <tr>
                  <td style="padding:18px 20px;font-family:Arial,'Helvetica Neue',sans-serif;">
                    <p style="margin:0 0 4px;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#7a8699;">
                      Your map points here
                    </p>
                    <p style="margin:0 0 6px;font-size:17px;font-weight:700;color:#1a2332;">
                      ${modeName}
                    </p>
                    <p style="margin:0 0 8px;font-family:'Courier New',Courier,monospace;font-size:15px;font-weight:600;color:#1a2332;">
                      ${modeRate} <span style="font-size:12px;font-weight:400;color:#718096;">of billed revenue</span>
                    </p>
                    <p style="margin:0;font-size:13px;color:#4a5568;line-height:1.5;">
                      Darkest at <strong>${topFn}</strong>, with <strong>${secondFn}</strong> close behind.
                      This is where your nine functions are most out of balance &mdash; and where the most ground
                      can be recovered fastest.
                    </p>
                  </td>
                </tr>
              </table>
              <p style="margin:14px 0 0;font-size:12px;color:#7a8699;line-height:1.5;">
                The rate applies to billed revenue and is never added to another rate.
                <strong>7.97% is the most anyone ever pays.</strong>
                Before you are billing, there is no cost at all.
              </p>
            </td>
          </tr>

          <!-- divider -->
          <tr>
            <td colspan="2" style="padding:24px 40px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
                <tr><td style="height:1px;background-color:#e8ecf0;font-size:0;line-height:0;">&nbsp;</td></tr>
              </table>
            </td>
          </tr>

          <!-- ── MAIN CTA ── -->
          <tr>
            <td colspan="2" align="center" style="padding:36px 40px 32px;font-family:Arial,'Helvetica Neue',sans-serif;">
              <p style="margin:0 0 8px;font-size:15px;color:#4a5568;line-height:1.6;">
                Each of the nine functions has its own four-minute walkthrough &mdash; the work running, not a tour.
                Start with the one your map marked darkest: <strong style="color:#1a2332;">${topFn}</strong>.
              </p>
              <p style="margin:16px 0 0;">
                <a href="https://carebravo.com/results" style="${ctaStyle}" target="_blank" rel="noopener">
                  Watch the Outcome that matches your hardest week
                </a>
              </p>
            </td>
          </tr>

          <!-- divider -->
          <tr>
            <td colspan="2" style="padding:0 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
                <tr><td style="height:1px;background-color:#e8ecf0;font-size:0;line-height:0;">&nbsp;</td></tr>
              </table>
            </td>
          </tr>

          <!-- ── FOOTER ── -->
          <tr>
            <td colspan="2" style="padding:24px 40px 32px;font-family:Arial,'Helvetica Neue',sans-serif;">
              <p style="margin:0 0 6px;font-size:14px;color:#1a2332;line-height:1.6;">
                Best,<br>
                <strong>Team CareBravo</strong>
              </p>
              <p style="margin:14px 0 0;font-size:12px;color:#7a8699;line-height:1.6;">
                Questions about this report? Reply to this email or reach us at
                <a href="mailto:support@caryfy.ai" style="color:#667eea;text-decoration:none;">support@caryfy.ai</a>.<br>
                <a href="https://carebravo.com" style="color:#7a8699;text-decoration:none;">carebravo.com</a>
                &nbsp;&middot;&nbsp;
                <span style="color:#7a8699;">Powered by Caryfy&nbsp;Inc.</span>
              </p>
            </td>
          </tr>

        </tbody>
      </table>
      <!-- end card -->

    </td>
  </tr>
</table>
<!-- end outer wrapper -->

</body>
</html>`;
}

// ── Send report email via Mailjet REST API (Basic auth, zero extra deps) ────
// Docs: https://dev.mailjet.com/email/guides/send-api-v31/
async function sendReportEmail(config, toEmail, toName, payload) {
  // Mailjet Basic auth = base64(apikey_public:apikey_private)
  const credentials = Buffer.from(
    `${config.MJ_APIKEY_PUBLIC}:${config.MJ_APIKEY_PRIVATE}`
  ).toString('base64');

  const contactName = payload.contact_name || toName || 'there';
  const agencyName  = payload.agency_name  || 'your agency';

  let res;
  try {
    res = await fetch(MAILJET_SEND_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type':  'application/json'
      },
      body: JSON.stringify({
        Messages: [
          {
            From: {
              Email: config.MJ_FROM_EMAIL,
              Name:  config.MJ_FROM_NAME
            },
            To: [
              {
                Email: toEmail,
                Name:  contactName
              }
            ],
            Subject: `${contactName}, your CareDrain™ report is ready`,
            HTMLPart: buildReportEmailHtml(payload),
            TextPart: [
              `Hi ${contactName},`,
              ``,
              `Your CareDrain™ report for ${agencyName} is ready.`,
              ``,
              `Screen Tax: ${payload.screen_tax ? '$' + Math.round(payload.screen_tax).toLocaleString('en-US') + ' / yr' : 'see report'}`,
              `Tangleware™ Tax: $${Math.round(payload.ttax_low || 0).toLocaleString('en-US')}–$${Math.round(payload.ttax_high || 0).toLocaleString('en-US')} / yr`,
              ``,
              `EBITDA today: $${Math.round(payload.ebitda_today || 0).toLocaleString('en-US')}`,
              `Future A (nothing changes): $${Math.round(payload.future_a || 0).toLocaleString('en-US')} / yr`,
              `Future B (nine run themselves): $${Math.round(payload.future_b || 0).toLocaleString('en-US')} / yr`,
              `Value gap: $${Math.round(payload.value_gap_low || 0).toLocaleString('en-US')}–$${Math.round(payload.value_gap_high || 0).toLocaleString('en-US')}`,
              ``,
              `Your map points to: ${payload.recommended_mode_name || ''} (${((payload.mode_rate || 0) * 100).toFixed(2)}% of billed revenue)`,
              ``,
              `Watch the Outcome that matches your hardest week:`,
              `https://carebravo.com/results`,
              ``,
              `Best,`,
              `Team CareBravo`,
              `carebravo.com | support@caryfy.ai`
            ].join('\n')
          }
        ]
      })
    });
  } catch (networkErr) {
    return { error: { message: `Mailjet send network error: ${networkErr.message}` } };
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    return { error: { message: `Mailjet ${res.status}: ${errText}` } };
  }

  return { error: null };
}

// ── Main Netlify handler ─────────────────────────────────────────────────────
exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const configResult = getValidatedConfig();
  if (!configResult.ok) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server configuration error' })
    };
  }
  const config = configResult.config;

  let data;
  try {
    data = JSON.parse(event.body || '{}');
  } catch (err) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request.' }) };
  }

  // ── Basic server-side validation ─────────────────────────────────────────
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!data.contact_name || !String(data.contact_name).trim()) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Please enter your name.' }) };
  }
  if (!data.email || !emailPattern.test(String(data.email).trim())) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Please enter a valid email address.' }) };
  }

  const forwarded = event.headers['x-forwarded-for'];
  const ip =
    event.headers['x-nf-client-connection-ip'] ||
    (forwarded ? forwarded.split(',')[0].trim() : null) ||
    'unknown';

  try {
    // ── Payload mirrors exactly what the calculator computed on screen ──────
    const payload = {
      first_touch_source:    data.first_touch_source     || null,
      source_demo:           data.source_demo            || null,
      agency_name:           data.agency_name            || null,
      state:                 data.state                  || null,
      monthly_billed:        data.monthly_billed         ?? null,
      caregiver_count:       data.caregiver_count        ?? null,
      persona_tier:          data.persona_tier           || null,
      drain_economic:        data.drain_economic         ?? null,
      drain_talent:          data.drain_talent           ?? null,
      drain_time:            data.drain_time             ?? null,
      drain_stability:       data.drain_stability        ?? null,
      drain_energy:          data.drain_energy           ?? null,
      outcome_pain:          data.outcome_pain           || null,
      capability_o6:         data.capability_o6          || null,
      owner_hours_week:      data.owner_hours_week       ?? null,
      top_outcome:           data.top_outcome            ?? null,
      second_outcome:        data.second_outcome         ?? null,
      top_outcome_name:      data.top_outcome_name       || null,
      second_outcome_name:   data.second_outcome_name    || null,
      screen_tax:            data.screen_tax             ?? null,
      ttax_low:              data.ttax_low               ?? null,
      ttax_high:             data.ttax_high              ?? null,
      ebitda_today:          data.ebitda_today           ?? null,
      future_a:              data.future_a               ?? null,
      future_b:              data.future_b               ?? null,
      value_gap_low:         data.value_gap_low          ?? null,
      value_gap_high:        data.value_gap_high         ?? null,
      recommended_mode:      data.recommended_mode       || null,
      recommended_mode_name: data.recommended_mode_name  || null,
      mode_rate:             data.mode_rate              ?? null,
      mode_basis:            data.mode_basis             || null,
      plan_30day_id:         data.plan_30day_id          || null,
      methodology_version:   data.methodology_version    || null,
      contact_name:          String(data.contact_name).trim(),
      email:                 String(data.email).trim().toLowerCase(),
      calculator_completed_at: data.calculator_completed_at || new Date().toISOString(),
      source_ip:             ip
    };

    // ── Step 1: Insert the Drain Map record into Supabase ───────────────────
    const { error: insertError } = await insertSubmission(config, payload);
    if (insertError) {
      console.error('[submit-caredrain-calculator] Supabase insert error:', insertError.message);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Something went wrong. Please try again.' })
      };
    }

    // ── Step 2: Email the formatted report via Mailjet (optional) ───────────
    // Non-fatal: if Mailjet isn't configured, or the email send fails,
    // we log it but still return success so the visitor's report unlocks
    // on screen and the lead isn't lost.
    let emailError = null;
    if (config.emailEnabled) {
      const result = await sendReportEmail(
        config,
        payload.email,
        payload.contact_name,
        payload
      );
      emailError = result.error;
      if (emailError) {
        console.error('[submit-caredrain-calculator] Mailjet send error:', emailError.message);
      }
    } else {
      console.warn(
        '[submit-caredrain-calculator] Skipped report email — ' +
        'MJ_APIKEY_PUBLIC / MJ_APIKEY_PRIVATE not configured.'
      );
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, emailed: config.emailEnabled && !emailError })
    };

  } catch (err) {
    console.error('[submit-caredrain-calculator] Unexpected error:', err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Something went wrong. Please try again.' })
    };
  }
};