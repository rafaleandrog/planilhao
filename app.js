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

// PÁGINA 3 — TODOS OS EMPREENDIMENTOS
async function renderEmpreendimentos() {
  const app = document.getElementById('app')
  const [{ data: emps }, { data: relacoes }] = await Promise.all([
    db.from('v_empreendimento_resumo').select('*'),
    db.from('empreendimento_setor').select('empreendimento_id, setor_id, setor_habitacional(nome)')
  ])
  const setorMap = {}
  ;(relacoes||[]).forEach(r => { if (r.setor_habitacional) setorMap[r.empreendimento_id] = r.setor_habitacional.nome })
  let busca = '', filtroSetor = 'Todos', filtroStatus = 'Todos'
  const setores = ['Todos','Boa Vista','Contagem 1','Contagem 2','Contagem 3','Grande Colorado']
  const statusList = ['Todos','Irregular','Em Análise','Caucionado','Aprovado','Registrado']
  function renderCards() {
    let lista = emps || []
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
