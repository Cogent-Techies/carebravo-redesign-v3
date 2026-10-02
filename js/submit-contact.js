/**
 * submit-contact.js
 * Netlify serverless function — /contact lead capture
 *
 * Receives a JSON POST from /contact and inserts one row into the Supabase
 * table `carebravosite_contact_submissions`.
 *
 * Zero external dependencies — native fetch() only.
 *
 * ── Required env vars (set in Netlify → Site → Environment variables) ──────
 *   SUPABASE_URL              e.g. https://xyzxyz.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY  from Project Settings → API → service_role key
 *
 * ── Supabase table (run once in SQL editor) ──────────────────────────────
 *   See the SQL block at the bottom of this file.
 */

'use strict';

const TABLE = 'carebravosite_contact_submissions';

const VALID_REASONS = ['existing-customer', 'press', 'general'];

exports.handler = async function (event) {
  /* ── Method guard ─────────────────────────────────────────────────── */
  if (event.httpMethod !== 'POST') {
    return respond(405, { error: 'Method not allowed' });
  }

  /* ── Config check ─────────────────────────────────────────────────── */
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('[submit-contact] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return respond(500, { error: 'Server configuration error — contact the site administrator.' });
  }

  /* ── Parse body ───────────────────────────────────────────────────── */
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return respond(400, { error: 'Request body must be valid JSON.' });
  }

  const {
    reason  = '',
    name    = '',
    email   = '',
    agency  = '',
    message = '',
  } = body;

  /* ── Validation ───────────────────────────────────────────────────── */
  const missing = [];
  if (!reason.trim())  missing.push('reason');
  if (!name.trim())    missing.push('name');
  if (!email.trim())   missing.push('email');
  if (!message.trim()) missing.push('message');

  if (missing.length) {
    return respond(400, { error: `Missing required fields: ${missing.join(', ')}` });
  }

  if (!VALID_REASONS.includes(reason.trim().toLowerCase())) {
    return respond(400, { error: `Unknown reason "${reason}". Valid: ${VALID_REASONS.join(', ')}` });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return respond(400, { error: 'Invalid email address.' });
  }

  /* ── Build record ─────────────────────────────────────────────────── */
  const record = {
    reason:  reason.trim().toLowerCase(),
    name:    name.trim(),
    email:   email.trim().toLowerCase(),
    agency:  agency ? agency.trim() : null,
    message: message.trim(),
  };

  /* ── Insert to Supabase ───────────────────────────────────────────── */
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'apikey':        SUPABASE_KEY,
        'Prefer':        'return=minimal',
      },
      body: JSON.stringify(record),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error(`[submit-contact] Supabase ${res.status}:`, detail);
      return respond(502, { error: 'Database write failed — please try again.' });
    }
  } catch (err) {
    console.error('[submit-contact] Fetch error:', err);
    return respond(500, { error: 'Submission failed — please try again.' });
  }

  return respond(200, { ok: true });
};

/* ── Helper ───────────────────────────────────────────────────────────── */
function respond(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type':                'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(body),
  };
}

/*
 * ════════════════════════════════════════════════════════════════════════
 * SUPABASE — run this once in the SQL Editor (supabase.com → project →
 * SQL Editor → New query → paste → Run)
 * ════════════════════════════════════════════════════════════════════════
 *
 * CREATE TABLE carebravosite_contact_submissions (
 *   id          bigint generated always as identity primary key,
 *   created_at  timestamptz not null default now(),
 *   reason      text        not null,
 *   name        text        not null,
 *   email       text        not null,
 *   agency      text,
 *   message     text        not null
 * );
 *
 * -- Prevent public read/write; only the service-role key (used by this
 * -- function) can insert. Anon key has no access.
 * ALTER TABLE carebravosite_contact_submissions ENABLE ROW LEVEL SECURITY;
 *
 * -- Optional: email Team CareBravo on each new message via a Supabase
 * -- Database Webhook (Project Settings → Webhooks → New webhook → table:
 * -- the one above, event: INSERT, URL: your notification endpoint).
 */
