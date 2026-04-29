// POST /api/import/parse — analyse un upload (CSV/XLSX/PDF/texte) et renvoie
// une proposition de transactions normalisées + un import_job_id.
// Aucune écriture dans la table transactions à ce stade : c'est un dry-run.
//
// Inputs acceptés :
// - multipart/form-data : file (Blob) + account_id (string)
// - application/json    : { account_id, text } pour le texte collé

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { rateLimit, clientKey } from '@/lib/rate-limit';
import { runImportPipeline, buildIdempotencyKey } from '@/lib/import/orchestrator';
import type { ImportSourceType } from '@/lib/import/types';
import { hasUserFeature } from '@/lib/subscription';

const MAX_FILE_BYTES = 10 * 1024 * 1024;       // 10 MB hard cap
const MAX_TEXT_CHARS = 200_000;

function detectSourceType(filename: string, contentType: string | null): ImportSourceType | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.csv') || contentType?.includes('csv')) return 'csv';
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls') || contentType?.includes('sheet')) return 'xlsx';
  if (lower.endsWith('.pdf') || contentType?.includes('pdf')) return 'pdf';
  return null;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  if (!(await hasUserFeature(user.id, 'import_transactions'))) {
    return NextResponse.json(
      {
        error: 'pro_required',
        message: 'L\'import de transactions est reserve aux utilisateurs Pro.',
      },
      { status: 402 }
    );
  }

  // Rate limit : 10 imports / heure / user (l'import déclenche potentiellement un appel LLM).
  const rl = rateLimit(`import-parse:${clientKey(request, user.id)}`, 10, 60 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'rate_limited', retryAfterMs: rl.resetMs },
      { status: 429 }
    );
  }

  const contentType = request.headers.get('content-type') ?? '';
  let accountId: string;
  let sourceType: ImportSourceType;
  let buffer: Buffer | undefined;
  let text: string | undefined;
  let filename: string | undefined;

  try {
    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      accountId = String(form.get('account_id') ?? '');
      const file = form.get('file');
      if (!(file instanceof Blob)) {
        return NextResponse.json({ error: 'file_missing' }, { status: 400 });
      }
      if (file.size > MAX_FILE_BYTES) {
        return NextResponse.json({ error: 'file_too_large', maxBytes: MAX_FILE_BYTES }, { status: 413 });
      }
      filename = (file as File).name ?? 'upload';
      const detected = detectSourceType(filename, file.type);
      if (!detected) {
        return NextResponse.json({ error: 'unsupported_format', filename }, { status: 415 });
      }
      sourceType = detected;
      buffer = Buffer.from(await file.arrayBuffer());
    } else {
      const body = await request.json().catch(() => null);
      if (!body || typeof body !== 'object') {
        return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
      }
      accountId = String((body as { account_id?: unknown }).account_id ?? '');
      text = String((body as { text?: unknown }).text ?? '');
      if (!text || text.length === 0) {
        return NextResponse.json({ error: 'text_missing' }, { status: 400 });
      }
      if (text.length > MAX_TEXT_CHARS) {
        return NextResponse.json({ error: 'text_too_long', maxChars: MAX_TEXT_CHARS }, { status: 413 });
      }
      sourceType = 'text';
    }
  } catch (err) {
    console.error('[api/import/parse] body parse failed', err);
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }

  if (!accountId) {
    return NextResponse.json({ error: 'account_id_missing' }, { status: 400 });
  }

  // Vérifie l'appartenance du compte avant de déclencher un appel LLM coûteux.
  const { data: account } = await supabase
    .from('accounts')
    .select('id, name')
    .eq('id', accountId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!account) {
    return NextResponse.json({ error: 'invalid_account' }, { status: 403 });
  }

  // Idempotency : (user, idempotency_key) est unique. On bloque uniquement les
  // re-imports d'un fichier déjà committed — c'est le seul cas qui crée des
  // doublons en base. Les jobs en previewing/failed/cancelled sont éphémères
  // (transactions non persistées) : on les re-parse et on remplace le job.
  const idempotencyKey = buildIdempotencyKey(accountId, sourceType, buffer ?? text ?? '');
  const { data: existing } = await supabase
    .from('import_jobs')
    .select('id, status')
    .eq('user_id', user.id)
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();

  if (existing && existing.status === 'committed') {
    return NextResponse.json(
      { error: 'already_committed', message: 'Ce fichier a déjà été importé.' },
      { status: 409 }
    );
  }

  let pipelineResult;
  try {
    pipelineResult = await runImportPipeline({
      sourceType,
      buffer,
      text,
      filename,
    });
  } catch (err) {
    console.error('[api/import/parse] pipeline failed', err);
    const message = err instanceof Error ? err.message : 'pipeline_failed';
    return NextResponse.json(
      { error: 'extraction_failed', message },
      { status: 502 }
    );
  }

  const jobPayload = {
    user_id: user.id,
    account_id: accountId,
    source_type: sourceType,
    source_filename: filename ?? null,
    status: 'previewing' as const,
    rows_total: pipelineResult.transactions.length,
    rows_imported: 0,
    idempotency_key: idempotencyKey,
    raw_excerpt: pipelineResult.rawExcerpt,
    detected_format: pipelineResult.detectedFormat,
    notes: pipelineResult.notes,
  };

  const { data: job, error: upsertError } = existing
    ? await supabase
        .from('import_jobs')
        .update(jobPayload)
        .eq('id', existing.id)
        .eq('user_id', user.id)
        .select('id')
        .single()
    : await supabase
        .from('import_jobs')
        .insert(jobPayload)
        .select('id')
        .single();

  if (upsertError || !job) {
    console.error('[api/import/parse] persist job failed', upsertError);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }

  return NextResponse.json({
    import_job_id: job.id,
    transactions: pipelineResult.transactions,
    notes: pipelineResult.notes,
    detected_format: pipelineResult.detectedFormat,
    raw_excerpt: pipelineResult.rawExcerpt,
    reused: Boolean(existing),
  });
}
