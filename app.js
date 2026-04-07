const { createClient } = supabase
const db = createClient(window.APP_CONFIG.SUPABASE_URL, window.APP_CONFIG.SUPABASE_ANON_KEY)

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
function route() {
  const hash = window.location.hash.slice(1) || 'setores'
  const app = document.getElementById('app')
  app.innerHTML = '<div class="loading">Carregando...</div>'
  if (hash === 'setores' || hash === '') { setActive('setores'); renderSetores() }
  else if (hash === 'empreendimentos') { setActive('empreendimentos'); renderEmpreendimentos() }
  else if (hash === 'moradores') { setActive('moradores'); renderMoradores() }
  else if (hash === 'acoes') { setActive('acoes'); renderAcoes() }
  else if (hash.startsWith('setor/')) { setActive('setor'); renderSetor(hash.split('/')[1]) }
  else if (hash.startsWith('empreendimento/')) { setActive('empreendimento'); renderEmpreendimento(hash.split('/')[1]) }
  else if (hash.startsWith('unidade/')) { setActive('unidade'); renderUnidade(hash.split('/')[1]) }
}

// PÁGINA 1 — SETORES
async function renderSetores() {
  const app = document.getElementById('app')
  const { data, error } = await db.from('v_setor_resumo').select('*')
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
