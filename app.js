const STORAGE_KEY = 'planilhao.supabase.config'
let schemaProfile = 'unknown'
let schemaDiagnostics = null

function isPlaceholder(value) {
  return !value || String(value).includes('PLACEHOLDER')
}

function cleanConfigValue(value) {
  if (typeof value !== 'string') return value || ''
  return value.trim().replace(/^['"]|['"]$/g, '')
}

function getStoredConfig() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
  } catch {
    return {}
  }
}

function saveConfig(config) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  } catch (e) {
    console.warn('Não foi possível salvar configuração local:', e)
  }
}

function loadSupabaseConfig() {
  const configured = window.APP_CONFIG || {}
  const stored = getStoredConfig()
  const urlParams = new URLSearchParams(window.location.search)
  const fromQuery = {
    SUPABASE_URL: urlParams.get('supabase_url') || '',
    SUPABASE_ANON_KEY: urlParams.get('supabase_anon_key') || ''
  }

  const resolved = {
    SUPABASE_URL: isPlaceholder(configured.SUPABASE_URL)
      ? cleanConfigValue(fromQuery.SUPABASE_URL || stored.SUPABASE_URL || '')
      : cleanConfigValue(configured.SUPABASE_URL),
    SUPABASE_ANON_KEY: isPlaceholder(configured.SUPABASE_ANON_KEY)
      ? cleanConfigValue(fromQuery.SUPABASE_ANON_KEY || stored.SUPABASE_ANON_KEY || '')
      : cleanConfigValue(configured.SUPABASE_ANON_KEY)
  }
  const source = {
    SUPABASE_URL: isPlaceholder(configured.SUPABASE_URL)
      ? (fromQuery.SUPABASE_URL ? 'query_string' : (stored.SUPABASE_URL ? 'local_storage' : 'missing'))
      : 'config.js',
    SUPABASE_ANON_KEY: isPlaceholder(configured.SUPABASE_ANON_KEY)
      ? (fromQuery.SUPABASE_ANON_KEY ? 'query_string' : (stored.SUPABASE_ANON_KEY ? 'local_storage' : 'missing'))
      : 'config.js'
  }

  if (resolved.SUPABASE_URL && resolved.SUPABASE_ANON_KEY) {
    saveConfig(resolved)
  }

  window.APP_CONFIG = resolved
  window.APP_CONFIG_SOURCE = source
  return resolved
}

const runtimeConfig = loadSupabaseConfig()
let db = null
try {
  const { createClient } = supabase
  if (!isPlaceholder(runtimeConfig.SUPABASE_URL) && !isPlaceholder(runtimeConfig.SUPABASE_ANON_KEY)) {
    const url = new URL(runtimeConfig.SUPABASE_URL)
    db = createClient(url.toString().replace(/\/$/, ''), runtimeConfig.SUPABASE_ANON_KEY)
  }
} catch(e) {
  console.error('Supabase init error:', e)
}

function renderFatalError(message, details = '') {
  const app = document.getElementById('app')
  app.innerHTML = `
    <div style="color:#ff6b6b;padding:40px;max-width:900px">
      <h2 style="margin-top:0">Erro de conexão com o Supabase</h2>
      <p>${message}</p>
      ${details ? `<pre style="background:#111;padding:12px;border-radius:8px;white-space:pre-wrap">${details}</pre>` : ''}
    </div>
  `
}

async function detectSchemaProfile() {
  if (!db) return { profile: 'unavailable', diagnostics: null }

  const legacyProbe = await db.from('v_setor_resumo').select('id').limit(1)
  if (!legacyProbe.error) return { profile: 'legacy', diagnostics: null }

  const minimalProbe = await db.from('setores').select('id').limit(1)
  if (!minimalProbe.error) {
    return {
      profile: 'minimal',
      diagnostics: `Views legadas não encontradas (${legacyProbe.error.code || 'sem-código'}). Operando em modo compatível.`
    }
  }

  return {
    profile: 'invalid',
    diagnostics: [
      `v_setor_resumo: ${legacyProbe.error?.message || 'erro desconhecido'}`,
      `setores: ${minimalProbe.error?.message || 'erro desconhecido'}`
    ].join('\n')
  }
}

// HELPERS
function moeda(v) { return v != null && !isNaN(v) ? Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}) : 'R$ 0,00' }
function pct(v) { return v != null && !isNaN(v) ? (Number(v)*100).toFixed(2)+'%' : '0%' }
function dt(v) { return v ? new Date(v).toLocaleDateString('pt-BR') : '-' }
function num(v) { return v ?? '-' }
function img(url, alt) {
  if (!url) return `<div class="card-img" style="font-size:40px">🏘</div>`
  return `<div class="card-img"><img src="${url}" alt="${alt}" onerror="this.parentElement.innerHTML='🏘'"></div>`
}
function badgeStatus(s) {
  const map = { 'Registrado':'badge-green','Aprovado':'badge-blue','Caucionado':'badge-cyan','Em Análise':'badge-orange','Irregular':'badge-red' }
  return `<span class="badge ${map[s]||'badge-gray'}">${s||'-'}</span>`
}
function badgeLote(s) {
  const map = { 'Aderente Quitado':'badge-green','Aderente Escriturado':'badge-cyan','Aderente Não Escriturado':'badge-yellow','Não Aderente':'badge-red' }
  return `<span class="badge ${map[s]||'badge-gray'}">${s||'-'}</span>`
}
function badgeNeg(s) {
  const map = { 'Maioria aderente':'badge-green','Polarizado':'badge-yellow','Maioria contrária':'badge-red','Sem negociação':'badge-gray' }
  return `<span class="badge ${map[s]||'badge-gray'}">${s||'-'}</span>`
}
function setActive(page) {
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page || (page.startsWith('setor') && el.dataset.page==='setores') || (page.startsWith('empreendimento') && el.dataset.page==='empreendimentos') || (page.startsWith('unidade') && el.dataset.page==='empreendimentos'))
  })
}

// ROUTER
window.addEventListener('hashchange', route)
window.addEventListener('load', route)
async function route() {
  if (!window.APP_CONFIG?.SUPABASE_URL || !window.APP_CONFIG?.SUPABASE_ANON_KEY || isPlaceholder(window.APP_CONFIG.SUPABASE_URL) || isPlaceholder(window.APP_CONFIG.SUPABASE_ANON_KEY)) {
    const src = window.APP_CONFIG_SOURCE || {}
    document.getElementById('app').innerHTML = `
      <div style="color:#ff6b6b;padding:40px;max-width:760px">
        <h2 style="margin-top:0">Credenciais do Supabase não configuradas</h2>
        <p>Configure os secrets/variables <code>SUPABASE_URL</code> e <code>SUPABASE_ANON_KEY</code> no GitHub Actions.</p>
        <p>Se já configurou e ainda falha, verifique em <strong>Settings → Pages</strong> se o source está em <strong>gh-pages</strong> (ou GitHub Actions), não em <strong>main/root</strong>.</p>
        <p style="margin:8px 0 0">Origem detectada URL: <strong>${src.SUPABASE_URL || 'missing'}</strong> · KEY: <strong>${src.SUPABASE_ANON_KEY || 'missing'}</strong></p>
        <p style="margin-top:6px">Dica: no GitHub, os valores dos secrets <em>não ficam visíveis</em> após salvar (isso é normal por segurança).</p>
        <p>Para diagnóstico imediato, informe temporariamente pela URL:</p>
        <pre style="background:#111;padding:12px;border-radius:8px;white-space:pre-wrap">?supabase_url=https://SEU-PROJETO.supabase.co&supabase_anon_key=SUA_CHAVE_ANON</pre>
        <p style="margin-top:10px">As credenciais informadas por query string ficam salvas no navegador para os próximos acessos.</p>
      </div>`
    return
  }
  const hash = window.location.hash.slice(1) || 'setores'
  const app = document.getElementById('app')
  app.innerHTML = '<div class="loading">Carregando...</div>'
  if (!await ensureRuntimeReady()) return
  if (hash === 'setores' || hash === '') { setActive('setores'); renderSetores() }
  else if (hash === 'empreendimentos') { setActive('empreendimentos'); renderEmpreendimentos() }
  else if (hash === 'moradores') { setActive('moradores'); renderMoradores() }
  else if (hash === 'acoes') { setActive('acoes'); renderAcoes() }
  else if (hash.startsWith('setor/')) { setActive('setor'); renderSetor(hash.split('/')[1]) }
  else if (hash.startsWith('empreendimento/')) { setActive('empreendimento'); renderEmpreendimento(hash.split('/')[1]) }
  else if (hash.startsWith('unidade/')) { setActive('unidade'); renderUnidade(hash.split('/')[1]) }
}

async function ensureRuntimeReady() {
  if (!db) {
    renderFatalError('Cliente Supabase não foi inicializado.', 'Verifique SUPABASE_URL e SUPABASE_ANON_KEY (sem aspas extras e sem espaços).')
    return false
  }
  if (schemaProfile === 'unknown') {
    const probe = await detectSchemaProfile()
    schemaProfile = probe.profile
    schemaDiagnostics = probe.diagnostics
  }
  if (schemaProfile === 'invalid') {
    renderFatalError('As credenciais foram aceitas, mas o schema necessário não foi encontrado neste projeto.', schemaDiagnostics || '')
    return false
  }
  return true
}

// PÁGINA 1 — SETORES
async function renderSetores() {
  const app = document.getElementById('app')
  let data = []
  let error = null
  if (schemaProfile === 'legacy') {
    const res = await db.from('v_setor_resumo').select('*')
    data = res.data || []
    error = res.error
  } else {
    const res = await db.from('setores').select('id,nome,descricao')
    data = (res.data || []).map((s) => ({
      ...s,
      foto_url: null,
      qntd_unidades: '-',
      vgv_total: 0,
      vgv_aderentes: 0,
      vgv_nao_aderentes: 0,
      qntd_condominios_registrados: '-',
      qntd_condominios_aprovados: '-',
      qntd_condominios_em_analise: '-'
    }))
    error = res.error
  }
  if (error) { app.innerHTML = `<div class="error">Erro: ${error.message}</div>`; return }
  app.innerHTML = `
    <h1 class="page-title">Setores Habitacionais</h1>
    <div class="grid-3">
      ${data.map(s => `
        <div class="card" onclick="location.hash='setor/${s.id}'">
          ${img(s.foto_url, s.nome)}
          <div class="card-body">
            <div class="card-title">${s.nome}</div>
            <hr class="divider">
            <div class="stat-row">🏠 Unidades: <strong>${num(s.qntd_unidades)}</strong></div>
            <hr class="divider">
            <div class="stat-row accent">VGV: ${moeda(s.vgv_total)}</div>
            <div class="stat-row muted">VGV Aderentes: ${moeda(s.vgv_aderentes)}</div>
            <div class="stat-row muted">VGV Não Aderentes: ${moeda(s.vgv_nao_aderentes)}</div>
            <div class="stat-row green">Registrados: ${num(s.qntd_condominios_registrados)}</div>
            <div class="stat-row blue">Aprovados: ${num(s.qntd_condominios_aprovados)}</div>
            <div class="stat-row orange">Em análise: ${num(s.qntd_condominios_em_analise)}</div>
          </div>
        </div>
      `).join('')}
    </div>`
}

// PÁGINA 2 — DETALHE DO SETOR
async function renderSetor(id) {
  const app = document.getElementById('app')
  if (schemaProfile === 'minimal') {
    app.innerHTML = '<div class="error">Detalhe de setor requer o schema legado (views e tabelas relacionais específicas).</div>'
    return
  }
  const [{ data: s, error: e1 }, { data: relacoes, error: e2 }] = await Promise.all([
    db.from('v_setor_resumo').select('*').eq('id', id).single(),
    db.from('empreendimento_setor').select('empreendimento_id').eq('setor_id', id)
  ])
  if (e1) { app.innerHTML = `<div class="error">Erro: ${e1.message}</div>`; return }
  const empIds = (relacoes||[]).map(r => r.empreendimento_id)
  let emps = []
  if (empIds.length) {
    const { data } = await db.from('v_empreendimento_resumo').select('*').in('id', empIds)
    emps = data || []
  }
  let filtro = 'Todos'
  function renderTabela() {
    const filtrados = filtro === 'Todos' ? emps : emps.filter(e => e.status === filtro)
    return `
      <div class="filter-bar">
        ${['Todos','Irregular','Em Análise','Caucionado','Aprovado','Registrado'].map(f =>
          `<button class="filter-btn ${filtro===f?'active':''}" onclick="window._setFiltroSetor('${f}')">${f}</button>`
        ).join('')}
      </div>
      <table>
        <thead><tr><th>Condomínio</th><th>Área Poligonal (m²)</th><th>Área Total Lotes (m²)</th><th>Status Negociação</th><th></th></tr></thead>
        <tbody>
          ${filtrados.map(e => `
            <tr>
              <td>${e.nome}</td>
              <td>${num(e.area_poligonal_m2)}</td>
              <td>${num(e.area_total_lotes_m2)}</td>
              <td>${badgeNeg(e.status_negociacao)}</td>
              <td><button class="btn btn-blue btn-sm" onclick="location.hash='empreendimento/${e.id}'">Ir para condomínio</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>`
  }
  window._setFiltroSetor = (f) => { filtro = f; document.getElementById('tab-emps').innerHTML = renderTabela() }
  app.innerHTML = `
    <div class="detail-header">
      <div class="detail-header-top">
        <div class="detail-photo">${s.foto_url ? `<img src="${s.foto_url}" style="width:100%;height:100%;object-fit:cover;border-radius:10px">` : '🏘'}</div>
        <div>
          <h1 style="font-size:22px;font-weight:700">${s.nome}</h1>
          <div class="badges-row" style="margin-top:8px">
            ${emps.map(e => `<span class="badge badge-white" style="cursor:pointer" onclick="location.hash='empreendimento/${e.id}'">${e.nome}</span>`).join('')}
          </div>
        </div>
      </div>
      <div class="metrics-grid">
        <div class="metric-card"><div class="metric-label">Adesômetro</div><div class="metric-value">${pct(s.adesometro_pct/100)}</div></div>
        <div class="metric-card"><div class="metric-label">Área Lotes Privativos (m²)</div><div class="metric-value">${num(s.area_lotes_privativos_m2)}</div></div>
        <div class="metric-card"><div class="metric-label">VGV</div><div class="metric-value">${moeda(s.vgv_total)}</div></div>
      </div>
    </div>
    <div class="tabs">
      <div class="tab active" onclick="showTab('emps','props',this)">Empreendimentos</div>
      <div class="tab" onclick="showTab('props','emps',this)">Propostas Vigentes</div>
    </div>
    <div id="tab-emps">${renderTabela()}</div>
    <div id="tab-props" style="display:none"><div class="loading">Carregando propostas...</div></div>`
  loadPropostasSetor(id)
}

async function loadPropostasSetor(id) {
  const { data } = await db.from('proposta_setor').select('proposta_id, proposta(titulo, data_proposta, data_fim_vigencia, preco_proposta_r_m2, tipo, aprovada_pela_diretoria)').eq('setor_id', id)
  const el = document.getElementById('tab-props')
  if (!el) return
  if (!data || !data.length) { el.innerHTML = '<p class="loading">Nenhuma proposta encontrada.</p>'; return }
  el.innerHTML = data.map(r => r.proposta).filter(Boolean).map(p => `
    <div class="transacao-item">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <strong>${p.titulo}</strong>
        <span class="badge badge-green">${p.tipo||''}</span>
      </div>
      <div style="margin-top:8px;color:var(--text-muted);font-size:13px">
        ${dt(p.data_proposta)} → ${dt(p.data_fim_vigencia)} · ${moeda(p.preco_proposta_r_m2)}/m²
      </div>
    </div>`).join('')
}

function showTab(show, hide, btn) {
  document.getElementById('tab-'+show).style.display = ''
  document.getElementById('tab-'+hide).style.display = 'none'
  btn.parentElement.querySelectorAll('.tab').forEach(t => t.classList.remove('active'))
  btn.classList.add('active')
}

// PÁGINA 3 — TODOS OS EMPREENDIMENTOS
async function renderEmpreendimentos() {
  const app = document.getElementById('app')
  const [{ data: emps }, { data: relacoes }] = schemaProfile === 'legacy'
    ? await Promise.all([
      db.from('v_empreendimento_resumo').select('*'),
      db.from('empreendimento_setor').select('empreendimento_id, setor_id, setor_habitacional(nome)')
    ])
    : await Promise.all([
      db.from('empreendimentos').select('id,nome,status_registro,vgv_total,setor_id'),
      db.from('setores').select('id,nome')
    ])
  const setorMap = {}
  if (schemaProfile === 'legacy') {
    ;(relacoes||[]).forEach(r => { if (r.setor_habitacional) setorMap[r.empreendimento_id] = r.setor_habitacional.nome })
  } else {
    const nomesSetor = Object.fromEntries((relacoes || []).map((s) => [s.id, s.nome]))
    ;(emps || []).forEach((e) => { setorMap[e.id] = nomesSetor[e.setor_id] || '-' })
  }
  const normalizedEmps = (emps || []).map((e) => schemaProfile === 'legacy'
    ? e
    : ({ ...e, status: e.status_registro, foto_url: null, qntd_unidades: '-', adesometro_pct: null }))
  let busca = '', filtroSetor = 'Todos', filtroStatus = 'Todos'
  const setores = ['Todos','Boa Vista','Contagem 1','Contagem 2','Contagem 3','Grande Colorado']
  const statusList = ['Todos','Irregular','Em Análise','Caucionado','Aprovado','Registrado']
  function renderCards() {
    let lista = normalizedEmps || []
    if (busca) lista = lista.filter(e => e.nome?.toLowerCase().includes(busca.toLowerCase()) || e.sigla?.toLowerCase().includes(busca.toLowerCase()))
    if (filtroSetor !== 'Todos') lista = lista.filter(e => setorMap[e.id] === filtroSetor)
    if (filtroStatus !== 'Todos') lista = lista.filter(e => e.status === filtroStatus)
    document.getElementById('emp-grid').innerHTML = lista.map(e => `
      <div class="card" onclick="location.hash='empreendimento/${e.id}'">
        <div style="position:relative">
          ${img(e.foto_url, e.nome)}
          ${setorMap[e.id] ? `<span class="badge badge-white" style="position:absolute;top:8px;left:8px">${setorMap[e.id]}</span>` : ''}
        </div>
        <div class="card-body">
          <div class="card-title">${e.nome}</div>
          <div style="text-align:center;margin-bottom:8px">${badgeStatus(e.status)}</div>
          <div class="stat-row accent" style="justify-content:center">${moeda(e.vgv_total)}</div>
          <div class="stat-row muted" style="justify-content:center">Unidades: ${num(e.qntd_unidades)}</div>
          <div class="stat-row muted" style="justify-content:center">📈 Adesômetro: ${pct(e.adesometro_pct != null ? e.adesometro_pct/100 : null)}</div>
        </div>
      </div>`).join('') || '<p style="color:var(--text-muted)">Nenhum empreendimento encontrado.</p>'
  }
  app.innerHTML = `
    <h1 class="page-title">Todos os empreendimentos</h1>
    <div class="search-wrap"><span class="search-icon">🔍</span><input class="search-box" placeholder="Buscar (Nome ou Sigla)" oninput="window._buscaEmp(this.value)"></div>
    <div class="filter-bar">${setores.map(s => `<button class="filter-btn ${filtroSetor===s?'active':''}" onclick="window._filtroSetorEmp('${s}')">${s}</button>`).join('')}</div>
    <div class="filter-bar">${statusList.map(s => `<button class="filter-btn ${filtroStatus===s?'active':''}" onclick="window._filtroStatusEmp('${s}')">${s}</button>`).join('')}</div>
    <div id="emp-grid" class="grid-4"></div>`
  window._buscaEmp = (v) => { busca = v; renderCards() }
  window._filtroSetorEmp = (v) => {
    filtroSetor = v
    document.querySelectorAll('.filter-bar')[0].querySelectorAll('.filter-btn').forEach((b,i) => b.classList.toggle('active', setores[i]===v))
    renderCards()
  }
  window._filtroStatusEmp = (v) => {
    filtroStatus = v
    document.querySelectorAll('.filter-bar')[1].querySelectorAll('.filter-btn').forEach((b,i) => b.classList.toggle('active', statusList[i]===v))
    renderCards()
  }
  renderCards()
}

// PÁGINA 4 — DETALHE DO EMPREENDIMENTO
async function renderEmpreendimento(id) {
  const app = document.getElementById('app')
  if (schemaProfile === 'minimal') {
    app.innerHTML = '<div class="error">Detalhe de empreendimento requer o schema legado (v_unidade_completa e tabelas auxiliares).</div>'
    return
  }
  const [{ data: e }, { data: unidades }] = await Promise.all([
    db.from('v_empreendimento_resumo').select('*').eq('id', id).single(),
    db.from('v_unidade_completa').select('*').eq('empreendimento_id', id)
  ])
  if (!e) { app.innerHTML = '<div class="error">Empreendimento não encontrado.</div>'; return }
  let filtroLote = 'Todos'
  const loteStatus = ['Todos','Aderente Quitado','Aderente Escriturado','Aderente Não Escriturado','Não Aderente']
  function renderUnidades() {
    const lista = filtroLote === 'Todos' ? (unidades||[]) : (unidades||[]).filter(u => u.status_lote === filtroLote)
    document.getElementById('tab-unidades').innerHTML = `
      <div class="filter-bar">${loteStatus.map(s => `<button class="filter-btn ${filtroLote===s?'active':''}" onclick="window._filtroLote('${s}')">${s}</button>`).join('')}</div>
      <table>
        <thead><tr><th>Endereço</th><th>Status</th><th>Valor</th><th></th></tr></thead>
        <tbody>${lista.map(u => `
          <tr>
            <td>${u.endereco||'-'}</td>
            <td>${badgeLote(u.status_lote)}</td>
            <td>${moeda(u.preco_total_proposta_vigente)}</td>
            <td><button class="btn btn-blue btn-sm" onclick="location.hash='unidade/${u.id}'">Ver unidade</button></td>
          </tr>`).join('')}
        </tbody>
      </table>`
  }
  window._filtroLote = (v) => { filtroLote = v; renderUnidades() }
  app.innerHTML = `
    <div class="detail-header">
      <div class="detail-header-top">
        <div class="detail-photo">${e.foto_url ? `<img src="${e.foto_url}" style="width:100%;height:100%;object-fit:cover;border-radius:10px">` : '🏘'}</div>
        <div>
          <h1 style="font-size:22px;font-weight:700">${e.nome}</h1>
          <div style="margin-top:8px">${badgeStatus(e.status)}</div>
        </div>
      </div>
      <div class="metrics-grid">
        <div class="metric-card"><div class="metric-label">Adesômetro</div><div class="metric-value">${pct(e.adesometro_pct != null ? e.adesometro_pct/100 : null)}</div></div>
        <div class="metric-card"><div class="metric-label">Área Total Lotes (m²)</div><div class="metric-value">${num(e.area_total_lotes_m2)}</div></div>
        <div class="metric-card"><div class="metric-label">VGV</div><div class="metric-value">${moeda(e.vgv_total)}</div></div>
      </div>
    </div>
    <div class="tabs">
      <div class="tab active" onclick="showTab2('unidades','props2','acoes2',this)">Unidades</div>
      <div class="tab" onclick="showTab2('props2','unidades','acoes2',this)">Propostas Vigentes</div>
      <div class="tab" onclick="showTab2('acoes2','unidades','props2',this)">Ções</div>
    </div>
    <div id="tab-unidades"></div>
    <div id="tab-props2" style="display:none"><div class="loading">Carregando...</div></div>
    <div id="tab-acoes2" style="display:none"><div class="loading">Carregando...</div></div>`
  renderUnidades()
  loadPropostasEmp(id)
  loadAcoesEmp(id)
}
function showTab2(show, h1, h2, btn) {
  ['tab-'+show,'tab-'+h1,'tab-'+h2].forEach((id,i) => {
    const el = document.getElementById(id); if(el) el.style.display = i===0?'':'none'
  })
  btn.parentElement.querySelectorAll('.tab').forEach(t => t.classList.remove('active'))
  btn.classList.add('active')
}
async function loadPropostasEmp(id) {
  const { data } = await db.from('proposta_empreendimento').select('proposta(titulo, data_proposta, data_fim_vigencia, preco_proposta_r_m2, tipo)').eq('empreendimento_id', id)
  const el = document.getElementById('tab-props2'); if (!el) return
  if (!data?.length) { el.innerHTML = '<p class="loading">Nenhuma proposta específica. Herda do Setor.</p>'; return }
  el.innerHTML = data.map(r => r.proposta).filter(Boolean).map(p => `
    <div class="transacao-item"><strong>${p.titulo}</strong>
    <div style="color:var(--text-muted);font-size:13px;margin-top:6px">${dt(p.data_proposta)} → ${dt(p.data_fim_vigencia)} · ${moeda(p.preco_proposta_r_m2)}/m²</div></div>`).join('')
}
async function loadAcoesEmp(id) {
  const { data } = await db.from('acao_empreendimento').select('acao_id').eq('empreendimento_id', id)
  const el = document.getElementById('tab-acoes2'); if (!el) return
  if (!data?.length) { el.innerHTML = '<p class="loading">Nenhuma ação registrada.</p>'; return }
  const ids = data.map(r => r.acao_id)
  const { data: acoes } = await db.from('v_acao_completa').select('*').in('id', ids)
  el.innerHTML = `<table><thead><tr><th>Descrição</th><th>Tipo</th><th>Valor</th><th>Data</th><th>Dias Restantes</th></tr></thead><tbody>
    ${(acoes||[]).map(a => `<tr class="${a.mensagem_aviso_1_mes?'urgente':a.mensagem_aviso_2_meses?'atencao':''}">
      <td>${a.descricao||'-'}</td><td>${a.tipo||'-'}</td><td>${moeda(a.valor)}</td><td>${dt(a.data)}</td>
      <td>${num(a.dias_restantes)} ${a.mensagem_aviso_1_mes?'⚠️':''}</td></tr>`).join('')}
  </tbody></table>`
}

// PÁGINA 5 — DETALHE DA UNIDADE
async function renderUnidade(id) {
  const app = document.getElementById('app')
  if (schemaProfile === 'minimal') {
    app.innerHTML = '<div class="error">Detalhe de unidade requer o schema legado (transação/proposta/pessoa).</div>'
    return
  }
  const [{ data: u }, { data: props }, { data: trans }] = await Promise.all([
    db.from('v_unidade_completa').select('*').eq('id', id).single(),
    db.from('unidade_pessoa').select('pessoa(nome_completo, cpf, telefone, email)').eq('unidade_id', id),
    db.from('transacao').select('*, transacao_signatario(pessoa(nome_completo))').eq('unidade_id', id).order('data_assinatura', {ascending: false})
  ])
  if (!u) { app.innerHTML = '<div class="error">Unidade não encontrada.</div>'; return }
  const proprietario = props?.[0]?.pessoa?.nome_completo || '-'
  function calcExpiracao(t) {
    if (!t.data_assinatura || !t.vigencia_meses) return '-'
    const d = new Date(t.data_assinatura); d.setMonth(d.getMonth() + t.vigencia_meses)
    return d.toLocaleDateString('pt-BR')
  }
  function signatario(t) {
    const s = t.transacao_signatario?.[0]?.pessoa?.nome_completo
    return s || '-'
  }
  app.innerHTML = `
    <div class="detail-header">
      <h1 style="font-size:22px;font-weight:700;margin-bottom:8px">${u.endereco||'-'}</h1>
      <div class="badges-row">
        <span class="badge badge-white">${u.empreendimento_nome||'-'}</span>
        ${badgeLote(u.status_lote)}
      </div>
      <div style="margin:8px 0;font-size:15px;font-weight:600">${proprietario}</div>
      ${!u.quitado && u.preco_total_proposta_vigente ? `<div style="margin-bottom:12px">Valor da unidade: <strong>${moeda(u.preco_total_proposta_vigente)}</strong></div>` : ''}
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:12px 0">
        <div class="metric-card"><div class="metric-label">Área (m²)</div><div class="metric-value">${num(u.area_m2)}</div></div>
        <div class="metric-card"><div class="metric-label">Matrícula</div><div class="metric-value">${num(u.matricula)}</div></div>
        <div class="metric-card"><div class="metric-label">Uso</div><div class="metric-value"><span class="badge badge-blue">${u.uso||'-'}</span></div></div>
        <div class="metric-card"><div class="metric-label">Tipo Lote</div><div class="metric-value">${u.tipo_lote||'-'}</div></div>
      </div>
      ${!u.quitado ? `<button class="btn btn-green" onclick="window._marcarQuitado('${id}')">&#10003; Marcar como quitado</button>` : ''}
    </div>
    <div class="price-table">
      <div class="price-col"><label>Preço Proposta Vigente (R\$/m²)</label><span>${moeda(u.preco_proposta_r_m2)}</span></div>
      <div class="price-col"><label>Preço Estático (R\$/m²)</label><span>${trans?.[0]?.preco_estatico_r_m2 ? moeda(trans[0].preco_estatico_r_m2) : '-'}</span></div>
      <div class="price-col"><label>Preço Final (R\$/m²)</label><span>${trans?.[0]?.preco_base_input_r_m2 ? moeda(trans[0].preco_base_input_r_m2) : '-'}</span></div>
    </div>
    <div style="margin:12px 0 20px">
      <div style="margin-bottom:6px"><span style="color:var(--text-muted)">Assinatura Pré-Contrato:</span> ${dt(u.data_assinatura_pre_contrato)}</div>
      <div style="margin-bottom:6px"><span style="color:var(--text-muted)">Assinatura CP:</span> ${dt(u.data_assinatura_cp)}</div>
      <div><span style="color:var(--text-muted)">Assinatura Escritura:</span> ${dt(u.data_assinatura_escritura)}</div>
    </div>
    <div class="tabs">
      <div class="tab active" onclick="showTab3('trans','pvigs','uacoes',this)">Transações</div>
      <div class="tab" onclick="showTab3('pvigs','trans','uacoes',this)">Propostas Vigentes</div>
      <div class="tab" onclick="showTab3('uacoes','trans','pvigs',this)">Ções</div>
    </div>
    <div id="tab-trans">
      <div style="display:flex;justify-content:flex-end;margin-bottom:16px">
        <button class="btn btn-blue" onclick="window._abrirModal('${id}')">&#65291; Criar nova transação</button>
      </div>
      ${(trans||[]).map(t => `
        <div class="transacao-item">
          <div class="transacao-header">
            <div class="transacao-title">${t.tipo||''} entre ${u.empreendimento_sigla||''} ${u.numero||''} e ${signatario(t)}</div>
            <div class="transacao-price">${moeda(t.preco_base_input_r_m2)}/m²</div>
          </div>
          <div class="transacao-meta">
            <div class="transacao-meta-item"><label>Data Assinatura</label><span>${dt(t.data_assinatura)}</span></div>
            <div class="transacao-meta-item"><label>Data Expiração</label><span>${calcExpiracao(t)}</span></div>
            <div class="transacao-meta-item"><label>Data Rescisão</label><span>${dt(t.data_rescisao)}</span></div>
            <div class="transacao-meta-item"><label>Código Minuta</label><span>${t.codigo_minuta_contrato||'-'}</span></div>
          </div>
        </div>`).join('') || '<p style="color:var(--text-muted)">Nenhuma transação registrada.</p>'}
    </div>
    <div id="tab-pvigs" style="display:none"><div class="loading">Carregando...</div></div>
    <div id="tab-uacoes" style="display:none"><p style="color:var(--text-muted)">Ções da unidade.</p></div>
    <div id="modal-trans" style="display:none">
      <div class="modal-overlay">
        <div class="modal">
          <h3>Nova Transação</h3>
          <div class="form-group"><label>Tipo</label><select id="t-tipo"><option>Pré-Contrato Regularização</option><option>CP</option><option>Escritura</option><option>Cessão</option><option>Simulação</option></select></div>
          <div class="form-group"><label>Forma de Pagamento</label><select id="t-forma"><option>Á Vista</option><option>6x</option><option>12x</option><option>Outras Parcelas</option></select></div>
          <div class="form-group"><label>Data de Assinatura</label><input type="date" id="t-data"></div>
          <div class="form-group"><label>Vigência (meses)</label><input type="number" id="t-vig" placeholder="0"></div>
          <div class="form-group"><label>Sinal (R\$)</label><input type="number" id="t-sinal" placeholder="0.00"></div>
          <div class="form-group"><label>Parcelas digitado</label><input type="number" id="t-parc" placeholder="0"></div>
          <div class="form-group"><label>Índice Correção</label><select id="t-indice"><option>IPCA</option><option>IGPM</option><option>INCC</option><option>Sem Índice</option></select></div>
          <div class="modal-footer">
            <button class="btn-cancel" onclick="document.getElementById('modal-trans').style.display='none'">Cancelar</button>
            <button class="btn btn-blue" onclick="window._salvarTransacao('${id}')">Salvar</button>
          </div>
        </div>
      </div>
    </div>`
  window._marcarQuitado = async (uid) => {
    if (!confirm('Marcar esta unidade como quitada?')) return
    const table = schemaProfile === 'legacy' ? 'unidade' : 'unidades'
    await db.from(table).update({ quitado: true }).eq('id', uid)
    renderUnidade(uid)
  }
  window._abrirModal = () => { document.getElementById('modal-trans').style.display = '' }
  window._salvarTransacao = async (uid) => {
    const { data: pid } = await db.rpc('get_proposta_vigente_unidade', { p_unidade_id: uid })
    const { error } = await db.from('transacao').insert({
      unidade_id: uid, proposta_id: pid,
      tipo: document.getElementById('t-tipo').value,
      forma_pagamento: document.getElementById('t-forma').value,
      data_assinatura: document.getElementById('t-data').value || null,
      vigencia_meses: parseInt(document.getElementById('t-vig').value) || null,
      sinal: parseFloat(document.getElementById('t-sinal').value) || null,
      parcelas_digitado_meses: parseInt(document.getElementById('t-parc').value) || null,
      indice_correcao: document.getElementById('t-indice').value
    })
    if (error) { alert('Erro: ' + error.message); return }
    document.getElementById('modal-trans').style.display = 'none'
    renderUnidade(uid)
  }
  loadPropostasUnidade(id)
}
function showTab3(show, h1, h2, btn) {
  ['tab-'+show,'tab-'+h1,'tab-'+h2].forEach((id,i) => {
    const el = document.getElementById(id); if(el) el.style.display = i===0?'':'none'
  })
  btn.parentElement.querySelectorAll('.tab').forEach(t => t.classList.remove('active'))
  btn.classList.add('active')
}
async function loadPropostasUnidade(id) {
  const { data } = await db.from('proposta_unidade').select('proposta(titulo, data_proposta, data_fim_vigencia, preco_proposta_r_m2, tipo)').eq('unidade_id', id)
  const el = document.getElementById('tab-pvigs'); if (!el) return
  if (!data?.length) { el.innerHTML = '<p class="loading">Herda proposta do Empreendimento ou Setor.</p>'; return }
  el.innerHTML = data.map(r => r.proposta).filter(Boolean).map(p => `
    <div class="transacao-item"><strong>${p.titulo}</strong>
    <div style="color:var(--text-muted);font-size:13px;margin-top:6px">${dt(p.data_proposta)} → ${dt(p.data_fim_vigencia)} · ${moeda(p.preco_proposta_r_m2)}/m²</div></div>`).join('')
}

// PÁGINA 6 — MORADORES
async function renderMoradores() {
  const app = document.getElementById('app')
  app.innerHTML = '<h1 class="page-title">Moradores</h1><div class="search-wrap"><span class="search-icon">🔍</span><input class="search-box" placeholder="Buscar por nome ou CPF" oninput="window._buscaMorador(this.value)"></div><div id="morador-lista"><div class="loading">Carregando...</div></div>'
  const { data, error } = schemaProfile === 'legacy'
    ? await db.from('pessoa').select('id, nome_completo, cpf, telefone, email, unidade_pessoa(unidade_id, unidade(id))')
    : await db.from('proprietarios').select('id,nome,cpf,telefone,email,unidade_proprietarios(unidade_id)')
  if (error) { document.getElementById('morador-lista').innerHTML = `<div class="error">${error.message}</div>`; return }
  let todos = (data || []).map((p) => schemaProfile === 'legacy'
    ? p
    : ({
      id: p.id,
      nome_completo: p.nome,
      cpf: p.cpf,
      telefone: p.telefone,
      email: p.email,
      unidade_pessoa: (p.unidade_proprietarios || []).map((u) => ({ unidade_id: u.unidade_id }))
    }))
  function render(lista) {
    document.getElementById('morador-lista').innerHTML = `<table>
      <thead><tr><th>Nome</th><th>CPF</th><th>Telefone</th><th>Email</th><th>Unidade(s)</th></tr></thead>
      <tbody>${lista.map(p => `<tr>
        <td>${p.nome_completo||'-'}</td><td>${p.cpf||'-'}</td>
        <td>${p.telefone||'-'}</td><td>${p.email||'-'}</td>
        <td>${(p.unidade_pessoa||[]).map(u => `<a href="#unidade/${u.unidade_id}" style="color:var(--blue);margin-right:6px">Ver unidade</a>`).join('') || '-'}</td>
      </tr>`).join('')}</tbody></table>`
  }
  window._buscaMorador = (v) => {
    const q = v.toLowerCase()
    render(todos.filter(p => p.nome_completo?.toLowerCase().includes(q) || p.cpf?.includes(q)))
  }
  render(todos)
}

// PÁGINA 7 — AÇÕES
async function renderAcoes() {
  const app = document.getElementById('app')
  const { data, error } = schemaProfile === 'legacy'
    ? await db.from('v_acao_completa').select('*').order('dias_restantes', {ascending: true})
    : { data: [], error: null }
  if (error) { app.innerHTML = `<div class="error">${error.message}</div>`; return }
  if (schemaProfile === 'minimal') {
    app.innerHTML = `
      <h1 class="page-title">Ações</h1>
      <p style="color:var(--text-muted)">Sem módulo de ações no schema mínimo do Supabase.</p>
      ${schemaDiagnostics ? `<p style="color:var(--text-muted)">${schemaDiagnostics}</p>` : ''}
    `
    return
  }
  app.innerHTML = `
    <h1 class="page-title">Ações</h1>
    <table>
      <thead><tr><th>Descrição</th><th>Nº Processo</th><th>Tipo</th><th>Valor</th><th>Data</th><th>Dias Restantes</th><th>Aviso</th></tr></thead>
      <tbody>${(data||[]).map(a => `
        <tr class="${a.mensagem_aviso_1_mes?'urgente':a.mensagem_aviso_2_meses?'atencao':''}">
          <td>${a.descricao||'-'}</td><td>${a.no_processo||'-'}</td><td>${a.tipo||'-'}</td>
          <td>${moeda(a.valor)}</td><td>${dt(a.data)}</td><td>${num(a.dias_restantes)}</td>
          <td style="color:var(--red)">${a.mensagem_aviso_1_mes||a.mensagem_aviso_2_meses||''}</td>
        </tr>`).join('')}
      </tbody>
    </table>`
}
