declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

type SignupUser = {
  id?: string | null;
  email?: string | null;
  created_at?: string | null;
  email_confirmed_at?: string | null;
  phone?: string | null;
  provider?: string | null;
};

type SignupPayload = {
  event?: string;
  user?: SignupUser;
  record?: SignupUser;
  old_record?: SignupUser | null;
};

type ChannelResult = {
  channel: string;
  ok: boolean;
  status?: number;
  error?: string;
};

const JSON_HEADERS = { 'Content-Type': 'application/json' };

function json(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { ...JSON_HEADERS, ...(init?.headers ?? {}) },
  });
}

function env(name: string): string {
  return Deno.env.get(name)?.trim() ?? '';
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function bearerToken(request: Request): string {
  const authorization = request.headers.get('authorization') ?? '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? '';
}

function isAuthorized(request: Request, expectedSecret: string): boolean {
  const suppliedSecret =
    bearerToken(request) || request.headers.get('x-signup-notification-secret')?.trim() || '';
  return suppliedSecret.length > 0 && suppliedSecret === expectedSecret;
}

function extractUser(payload: SignupPayload): SignupUser {
  return payload.user ?? payload.record ?? {};
}

async function fetchAuthUser(userId: string): Promise<SignupUser | null> {
  const supabaseUrl = env('SUPABASE_URL');
  const serviceRoleKey = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return null;

  const response = await fetch(
    `${stripTrailingSlash(supabaseUrl)}/auth/v1/admin/users/${encodeURIComponent(userId)}`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    }
  );

  if (!response.ok) {
    console.warn('[new-signup-notification] failed to fetch auth user', {
      userId,
      status: response.status,
      body: await response.text().catch(() => ''),
    });
    return null;
  }

  const data = await response.json().catch(() => null);
  if (!data || typeof data !== 'object') return null;

  const user = data as {
    id?: string;
    email?: string;
    created_at?: string;
    email_confirmed_at?: string;
    phone?: string;
    app_metadata?: { provider?: string };
  };

  return {
    id: user.id,
    email: user.email,
    created_at: user.created_at,
    email_confirmed_at: user.email_confirmed_at,
    phone: user.phone,
    provider: user.app_metadata?.provider,
  };
}

async function enrichUser(user: SignupUser): Promise<SignupUser> {
  if (user.email || !user.id) return user;

  const authUser = await fetchAuthUser(user.id);
  return {
    ...user,
    ...authUser,
    id: authUser?.id ?? user.id,
  };
}

function formatDate(value?: string | null): string {
  if (!value) return 'inconnue';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('fr-FR', {
    timeZone: 'Europe/Paris',
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function notificationLines(user: SignupUser): string[] {
  const appUrl = env('NEXT_PUBLIC_APP_URL') || env('APP_URL');
  return [
    'Nouvel inscrit Fi-Hub',
    `Email: ${user.email || 'inconnu'}`,
    `ID: ${user.id || 'inconnu'}`,
    `Cree: ${formatDate(user.created_at)}`,
    `Email confirme: ${user.email_confirmed_at ? 'oui' : 'non'}`,
    user.provider ? `Provider: ${user.provider}` : '',
    appUrl ? `App: ${appUrl}` : '',
  ].filter(Boolean);
}

async function notifyNtfy(user: SignupUser): Promise<ChannelResult | null> {
  const topic = env('SIGNUP_NTFY_TOPIC');
  if (!topic) return null;

  const server = stripTrailingSlash(env('SIGNUP_NTFY_SERVER') || 'https://ntfy.sh');
  const token = env('SIGNUP_NTFY_TOKEN');
  const priority = env('SIGNUP_NTFY_PRIORITY') || '4';
  const headers: Record<string, string> = {
    Title: 'Nouvel inscrit Fi-Hub',
    Priority: priority,
    Tags: 'tada',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${server}/${encodeURIComponent(topic)}`, {
    method: 'POST',
    headers,
    body: notificationLines(user).join('\n'),
  });

  return {
    channel: 'ntfy',
    ok: response.ok,
    status: response.status,
    error: response.ok ? undefined : await response.text().catch(() => ''),
  };
}

async function notifyTelegram(user: SignupUser): Promise<ChannelResult | null> {
  const botToken = env('SIGNUP_TELEGRAM_BOT_TOKEN');
  const chatId = env('SIGNUP_TELEGRAM_CHAT_ID');
  if (!botToken || !chatId) return null;

  const lines = notificationLines(user);
  const text = [
    `<b>${escapeHtml(lines[0])}</b>`,
    ...lines.slice(1).map((line) => escapeHtml(line)),
  ].join('\n');

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });

  return {
    channel: 'telegram',
    ok: response.ok,
    status: response.status,
    error: response.ok ? undefined : await response.text().catch(() => ''),
  };
}

async function notifySlack(user: SignupUser): Promise<ChannelResult | null> {
  const webhookUrl = env('SIGNUP_SLACK_WEBHOOK_URL');
  if (!webhookUrl) return null;

  const appUrl = env('NEXT_PUBLIC_APP_URL') || env('APP_URL');
  const fields = [
    { type: 'mrkdwn', text: `*Email*\n${user.email || 'inconnu'}` },
    { type: 'mrkdwn', text: `*ID*\n${user.id || 'inconnu'}` },
    { type: 'mrkdwn', text: `*Cree*\n${formatDate(user.created_at)}` },
    { type: 'mrkdwn', text: `*Email confirme*\n${user.email_confirmed_at ? 'oui' : 'non'}` },
  ];
  if (user.provider) {
    fields.push({ type: 'mrkdwn', text: `*Provider*\n${user.provider}` });
  }

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: 'Nouvel inscrit Fi-Hub' },
    },
    {
      type: 'section',
      fields,
    },
    ...(appUrl
      ? [
          {
            type: 'section',
            text: { type: 'mrkdwn', text: `<${appUrl}|Ouvrir Fi-Hub>` },
          },
        ]
      : []),
  ];

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      text: notificationLines(user).join('\n'),
      blocks,
    }),
  });

  return {
    channel: 'slack',
    ok: response.ok,
    status: response.status,
    error: response.ok ? undefined : await response.text().catch(() => ''),
  };
}

async function notifyDiscord(user: SignupUser): Promise<ChannelResult | null> {
  const webhookUrl = env('SIGNUP_DISCORD_WEBHOOK_URL');
  if (!webhookUrl) return null;

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      username: 'Fi-Hub',
      content: notificationLines(user).join('\n'),
    }),
  });

  return {
    channel: 'discord',
    ok: response.ok,
    status: response.status,
    error: response.ok ? undefined : await response.text().catch(() => ''),
  };
}

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, { status: 405 });
  }

  const expectedSecret = env('SIGNUP_NOTIFICATION_SECRET');
  if (!expectedSecret) {
    return json({ error: 'missing_SIGNUP_NOTIFICATION_SECRET' }, { status: 500 });
  }
  if (!isAuthorized(request, expectedSecret)) {
    return json({ error: 'unauthorized' }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as SignupPayload | null;
  if (!payload) {
    return json({ error: 'invalid_json' }, { status: 400 });
  }

  const user = await enrichUser(extractUser(payload));
  if (!user.id && !user.email) {
    return json({ error: 'missing_user' }, { status: 400 });
  }

  const results = (await Promise.all([
    notifyNtfy(user),
    notifySlack(user),
    notifyTelegram(user),
    notifyDiscord(user),
  ])).filter((result): result is ChannelResult => result !== null);

  if (results.length === 0) {
    return json({ error: 'no_notification_channel_configured' }, { status: 500 });
  }

  const ok = results.some((result) => result.ok);
  return json({ ok, results }, { status: ok ? 200 : 502 });
});
