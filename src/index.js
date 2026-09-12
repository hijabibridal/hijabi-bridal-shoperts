// Hijabi Bridal referral/click tracker
// Routes:
//   GET /go?ref=partnerA&dest=whatsapp
//   GET /go?ref=partnerA&dest=website&url=https://partner-site.com/landing
//   GET /convert?order=ORDER_ID&amount=49.99   (call this from your checkout success step)

const REF_COOKIE = 'ref_id';
const ATTRIBUTION_DAYS = 120;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/go') {
      return handleGo(request, env, ctx, url);
    }
    if (url.pathname === '/convert') {
      return handleConvert(request, env, ctx, url);
    }
    return new Response('Not found', { status: 404 });
  },
};

async function isBlocked(env, ref) {
  const row = await env.DB.prepare(`SELECT 1 FROM blocked_refs WHERE ref = ?`).bind(ref).first();
  return !!row;
}

async function handleGo(request, env, ctx, url) {
  const ref = url.searchParams.get('ref') || 'direct';
  const dest = url.searchParams.get('dest'); // 'whatsapp' | 'website'
  const target = url.searchParams.get('url'); // required when dest=website

  const clickId = crypto.randomUUID();
  const cf = request.cf || {};
  const postal = cf.postalCode || '';
  const city = cf.city || '';
  const country = cf.country || '';
  const now = new Date().toISOString();
  const blocked = await isBlocked(env, ref);

  // Log the click — D1 (structured, queryable) + Google Sheet (human-readable)
  // Skipped entirely if this ref has been added to blocked_refs.
  if (!blocked) {
    ctx.waitUntil(
      env.DB.prepare(
        `INSERT INTO clicks (id, ref, dest, timestamp, postal, city, country, converted)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)`
      ).bind(clickId, ref, dest || '', now, postal, city, country).run()
    );
    ctx.waitUntil(
      postToSheet(env, {
        event: 'click',
        clickId,
        ref,
        dest,
        timestamp: now,
        postal,
        city,
        country,
      })
    );
  }

  let redirectUrl;
  if (dest === 'whatsapp') {
    const number = env.WHATSAPP_NUMBER;
    const text = encodeURIComponent(`ref:${ref}`);
    redirectUrl = `https://wa.me/${number}?text=${text}`;
  } else {
    if (!target) {
      return new Response('Missing url param for dest=website', { status: 400 });
    }
    const u = new URL(target);
    u.searchParams.set('ref', ref);
    u.searchParams.set('cid', clickId);
    redirectUrl = u.toString();
  }

  const headers = new Headers({ Location: redirectUrl });
  headers.append(
    'Set-Cookie',
    `${REF_COOKIE}=${clickId}:${ref}; Max-Age=${ATTRIBUTION_DAYS * 86400}; Path=/; Secure; HttpOnly; SameSite=Lax`
  );
  return new Response(null, { status: 302, headers });
}

async function handleConvert(request, env, ctx, url) {
  const cookie = getCookie(request, REF_COOKIE);
  if (!cookie) {
    // No tracked click for this visitor — nothing to attribute
    return json({ tracked: false });
  }

  const [clickId, ref] = cookie.split(':');
  if (await isBlocked(env, ref)) {
    return json({ tracked: false, blocked: true });
  }

  const order = url.searchParams.get('order') || '';
  const amount = url.searchParams.get('amount') || '';
  const now = new Date().toISOString();

  ctx.waitUntil(
    env.DB.prepare(`UPDATE clicks SET converted = converted + 1 WHERE id = ?`).bind(clickId).run()
  );
  ctx.waitUntil(
    postToSheet(env, {
      event: 'conversion',
      clickId,
      ref,
      order,
      amount,
      timestamp: now,
    })
  );

  return json({ tracked: true, ref, clickId });
}

function getCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  const match = header.match(new RegExp(`${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

async function postToSheet(env, payload) {
  try {
    await fetch(env.SHEET_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error('Sheet webhook failed', err);
  }
}

function json(obj) {
  return new Response(JSON.stringify(obj), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
