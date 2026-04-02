import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const {
  AIRTABLE_TOKEN,
  AIRTABLE_BASE_ID,
  AIRTABLE_MAPPING_PATH = 'airtable/mapping.json',
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
} = process.env;

if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Faltam variáveis obrigatórias no .env (Airtable e Supabase).');
}

const mappingFile = path.resolve(rootDir, AIRTABLE_MAPPING_PATH);
const mapping = JSON.parse(await fs.readFile(mappingFile, 'utf-8'));

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

async function fetchAirtableTable(tableName) {
  const records = [];
  let offset = '';

  do {
    const query = new URLSearchParams();
    if (offset) query.set('offset', offset);
    query.set('pageSize', '100');

    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}?${query.toString()}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` }
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Erro Airtable (${tableName}): ${response.status} ${text}`);
    }

    const payload = await response.json();
    records.push(...payload.records);
    offset = payload.offset || '';
  } while (offset);

  return records;
}

function normalizeValue(value) {
  if (typeof value !== 'string') return value;

  const cleaned = value.trim();

  if (/^-?\d{1,3}(\.\d{3})*,\d+$/.test(cleaned)) {
    return Number(cleaned.replace(/\./g, '').replace(',', '.'));
  }

  if (/^-?\d+(\.\d+)?$/.test(cleaned)) {
    return Number(cleaned);
  }

  const lower = cleaned.toLowerCase();
  if (['sim', 'true', 'yes'].includes(lower)) return true;
  if (['não', 'nao', 'false', 'no'].includes(lower)) return false;

  return value;
}

function mapFields(record, fieldMap) {
  const row = {};
  for (const [dbColumn, airtableField] of Object.entries(fieldMap || {})) {
    row[dbColumn] = normalizeValue(record.fields?.[airtableField] ?? null);
  }
  return row;
}

async function fetchIdMap(table) {
  const { data, error } = await supabase.from(table).select('id,airtable_id');
  if (error) throw error;
  return new Map(data.map((row) => [row.airtable_id, row.id]));
}

async function upsertRows(table, rows) {
  if (!rows.length) return;
  const { error } = await supabase.from(table).upsert(rows, { onConflict: 'airtable_id' });
  if (error) throw error;
}

async function sync() {
  const cfg = mapping.tables;

  const setoresRaw = await fetchAirtableTable(cfg.setores.name);
  await upsertRows(
    'setores',
    setoresRaw.map((rec) => ({
      airtable_id: rec.id,
      ...mapFields(rec, cfg.setores.fields)
    }))
  );
  const setorMap = await fetchIdMap('setores');

  const empreendimentosRaw = await fetchAirtableTable(cfg.empreendimentos.name);
  await upsertRows(
    'empreendimentos',
    empreendimentosRaw.map((rec) => {
      const setorAirtableId = rec.fields?.[cfg.empreendimentos.relations?.setorLinkField]?.[0] ?? null;
      return {
        airtable_id: rec.id,
        setor_id: setorAirtableId ? setorMap.get(setorAirtableId) ?? null : null,
        ...mapFields(rec, cfg.empreendimentos.fields)
      };
    })
  );
  const empreendimentoMap = await fetchIdMap('empreendimentos');

  const proprietariosRaw = await fetchAirtableTable(cfg.proprietarios.name);
  await upsertRows(
    'proprietarios',
    proprietariosRaw.map((rec) => ({
      airtable_id: rec.id,
      ...mapFields(rec, cfg.proprietarios.fields)
    }))
  );
  const proprietarioMap = await fetchIdMap('proprietarios');

  const unidadesRaw = await fetchAirtableTable(cfg.unidades.name);
  await upsertRows(
    'unidades',
    unidadesRaw.map((rec) => {
      const empAirtableId = rec.fields?.[cfg.unidades.relations?.empreendimentoLinkField]?.[0] ?? null;
      return {
        airtable_id: rec.id,
        empreendimento_id: empAirtableId ? empreendimentoMap.get(empAirtableId) ?? null : null,
        ...mapFields(rec, cfg.unidades.fields)
      };
    })
  );
  const unidadeMap = await fetchIdMap('unidades');

  const joinRows = [];
  for (const rec of unidadesRaw) {
    const unidadeId = unidadeMap.get(rec.id);
    const linkedOwners = rec.fields?.[cfg.unidades.relations?.proprietariosLinkField] || [];
    for (const ownerAirtableId of linkedOwners) {
      const proprietarioId = proprietarioMap.get(ownerAirtableId);
      if (unidadeId && proprietarioId) {
        joinRows.push({ unidade_id: unidadeId, proprietario_id: proprietarioId });
      }
    }
  }
  if (joinRows.length) {
    const { error } = await supabase.from('unidade_proprietarios').upsert(joinRows, { onConflict: 'unidade_id,proprietario_id' });
    if (error) throw error;
  }

  const transacoesRaw = await fetchAirtableTable(cfg.transacoes.name);
  await upsertRows(
    'transacoes',
    transacoesRaw.map((rec) => {
      const unidadeAirtableId = rec.fields?.[cfg.transacoes.relations?.unidadeLinkField]?.[0] ?? null;
      return {
        airtable_id: rec.id,
        unidade_id: unidadeAirtableId ? unidadeMap.get(unidadeAirtableId) ?? null : null,
        ...mapFields(rec, cfg.transacoes.fields)
      };
    })
  );

  console.log('✅ Sincronização concluída com sucesso.');
}

sync().catch((err) => {
  console.error('❌ Falha na sincronização:', err.message);
  process.exit(1);
});
