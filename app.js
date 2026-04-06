(function () {
  var app = document.getElementById('app');
  var nav = document.getElementById('main-nav');
  var state = { setorTab: 'empreendimentos', empTab: 'unidades', unidadeTab: 'transacoes' };

  var createClient = supabase.createClient;
  var db = createClient(window.APP_CONFIG.SUPABASE_URL, window.APP_CONFIG.SUPABASE_ANON_KEY);

  function moeda(v) { return (typeof v === 'number' && !isNaN(v) ? v : Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  function pct(v) {
    var n = Number(v);
    return n != null && !isNaN(n) ? (n * 100).toFixed(2).replace('.', ',') + '%' : '0%';
  }
  function data(v) { return v ? new Date(v).toLocaleDateString('pt-BR') : '-'; }
  function num(v) { return v == null || v === '' || isNaN(Number(v)) ? '-' : Number(v).toLocaleString('pt-BR'); }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"]/g, function (m) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[m]; }); }
  function loading() { app.innerHTML = '<div class="loading">Carregando...</div>'; }
  function erro(e) { app.innerHTML = '<div class="error">Erro ao carregar dados: ' + esc((e && e.message) || e) + '</div>'; }
  function photo(url, cls) { return url ? '<img class="' + (cls || 'photo') + '" src="' + esc(url) + '" alt="foto" />' : '<div class="' + (cls || 'photo') + '"></div>'; }

  function routeInfo() {
    var hash = (window.location.hash || '#setores').replace(/^#/, '');
    var parts = hash.split('/');
    return { route: parts[0], id: parts[1] };
  }

  function setActiveNav(route) {
    if (!nav) return;
    Array.from(nav.querySelectorAll('.nav-link')).forEach(function (el) {
      var r = el.getAttribute('data-route');
      el.classList.toggle('active', r === route || (route === 'setor' && r === 'setores') || (route === 'empreendimento' && r === 'empreendimentos') || (route === 'unidade' && r === 'empreendimentos'));
    });
  }

  function classKey(v) { return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-'); }

  function statusBadge(status) {
    return '<span class="badge badge-status-' + classKey(status) + '">' + esc(status || '-') + '</span>';
  }

  function statusNegBadge(v) {
    var map = { 'Maioria aderente': 'text-green', Polarizado: 'text-yellow', 'Maioria contrária': 'text-red', 'Sem negociação': 'text-muted' };
    return '<span class="badge ' + (map[v] || 'text-muted') + '">' + esc(v || 'Sem negociação') + '</span>';
  }

  function statusLoteBadge(v) { return '<span class="badge status-lote-' + classKey(v) + '">' + esc(v || '-') + '</span>'; }

  function bind(selector, eventName, fn) {
    Array.from(document.querySelectorAll(selector)).forEach(function (el) { el.addEventListener(eventName, fn); });
  }

  async function renderSetores() {
    loading();
    try {
      var rs = await db.from('v_setor_resumo').select('*');
      if (rs.error) throw rs.error;
      var rows = rs.data || [];
      app.innerHTML = '<div class="page-header"><h1 class="page-title">Setores Habitacionais</h1></div>' +
        '<div class="grid-3">' + rows.map(function (s) {
          return '<div class="card clickable setor-card" data-id="' + s.id + '">' +
            photo(s.foto_url) +
            '<h3 class="card-title-center">' + esc(s.nome) + '</h3>' +
            '<div class="sep"></div><p style="text-align:center; font-weight:700;">🏠 Unidades: ' + num(s.qntd_unidades) + '</p><div class="sep"></div>' +
            '<div class="metric-list">' +
            '<p class="text-accent">VGV: ' + moeda(s.vgv_total) + '</p>' +
            '<p class="text-muted">VGV Aderentes: ' + moeda(s.vgv_aderentes) + '</p>' +
            '<p class="text-muted">VGV Não Aderentes: ' + moeda(s.vgv_nao_aderentes) + '</p>' +
            '<p class="text-green">Registrados: ' + num(s.qntd_condominios_registrados) + '</p>' +
            '<p class="text-blue">Aprovados: ' + num(s.qntd_condominios_aprovados) + '</p>' +
            '<p class="text-orange">Em análise: ' + num(s.qntd_condominios_em_analise) + '</p>' +
            '</div></div>';
        }).join('') + '</div>';
      bind('.setor-card', 'click', function (e) { window.location.hash = '#setor/' + e.currentTarget.getAttribute('data-id'); });
    } catch (e) { erro(e); }
  }

  async function renderSetorDetalhe(id) {
    loading();
    try {
      var setorQ = await db.from('v_setor_resumo').select('*').eq('id', id).single();
      if (setorQ.error) throw setorQ.error;
      var rel = await db.from('empreendimento_setor').select('empreendimento_id').eq('setor_id', id);
      if (rel.error) throw rel.error;
      var ids = (rel.data || []).map(function (r) { return r.empreendimento_id; });
      var emps = { data: [] };
      if (ids.length) {
        emps = await db.from('v_empreendimento_resumo').select('*').in('id', ids);
        if (emps.error) throw emps.error;
      }
      var propostas = await db.from('proposta_setor').select('proposta_id, proposta(titulo, data_proposta, data_fim_vigencia, preco_proposta_r_m2, tipo, aprovada_pela_diretoria)').eq('setor_id', id);
      if (propostas.error) throw propostas.error;
      var setor = setorQ.data;
      var allEmp = emps.data || [];
      var html = '<div class="hero">' + photo(setor.foto_url, 'photo-small') + '<div><h1 style="margin:0 0 6px">' + esc(setor.nome) + '</h1></div></div>' +
        '<div class="badges-row">' + allEmp.map(function (e) { return '<span class="badge clickable emp-jump" data-id="' + e.id + '">' + esc(e.nome) + '</span>'; }).join('') + '</div>' +
        '<div class="metrics"><div class="metric-item"><h4>Adesômetro</h4><p>' + pct(setor.adesometro_pct) + '</p></div>' +
        '<div class="metric-item"><h4>Área</h4><p>' + num(setor.area_lotes_privativos_m2) + ' m²</p></div>' +
        '<div class="metric-item"><h4>VGV</h4><p>' + moeda(setor.vgv_total) + '</p></div></div>' +
        '<div class="tabs"><button class="tab-btn ' + (state.setorTab === 'empreendimentos' ? 'active' : '') + '" data-tab="empreendimentos">Empreendimentos</button><button class="tab-btn ' + (state.setorTab === 'propostas' ? 'active' : '') + '" data-tab="propostas">Propostas Vigentes</button></div><div id="setor-tab"></div>';
      app.innerHTML = html;

      function drawSetorTab() {
        var c = document.getElementById('setor-tab');
        if (state.setorTab === 'propostas') {
          c.innerHTML = '<div class="card">' + (propostas.data || []).map(function (x) {
            var p = x.proposta || {};
            return '<div style="padding:8px 0"><strong>' + esc(p.titulo) + '</strong><div class="text-muted">Período: ' + data(p.data_proposta) + ' até ' + data(p.data_fim_vigencia) + ' | Preço: ' + moeda(p.preco_proposta_r_m2) + ' /m² | Tipo: ' + esc(p.tipo || '-') + '</div></div>';
          }).join('<div class="sep"></div>') + '</div>';
          return;
        }
        var currentFilter = 'Todos';
        var filtros = ['Todos', 'Irregular', 'Em Análise', 'Caucionado', 'Aprovado', 'Registrado'];
        c.innerHTML = '<div class="filters">' + filtros.map(function (f) { return '<button class="btn setor-filter ' + (f === 'Todos' ? 'active' : '') + '" data-f="' + f + '">' + f + '</button>'; }).join('') + '</div><div class="table-wrap"><table><thead><tr><th>Condomínio</th><th>Área Poligonal (m²)</th><th>Área Total Lotes (m²)</th><th>Status Negociação</th><th></th></tr></thead><tbody id="setor-tb"></tbody></table></div>';
        function drawRows() {
          var rows = allEmp.filter(function (r) { return currentFilter === 'Todos' ? true : r.status === currentFilter; });
          document.getElementById('setor-tb').innerHTML = rows.map(function (r) { return '<tr><td>' + esc(r.nome) + '</td><td>' + num(r.area_poligonal_m2) + '</td><td>' + num(r.area_total_lotes_m2) + '</td><td>' + statusNegBadge(r.status_negociacao) + '</td><td><button class="btn ir-emp" data-id="' + r.id + '">Ir para condomínio</button></td></tr>'; }).join('') || '<tr><td colspan="5">Sem resultados.</td></tr>';
          bind('.ir-emp', 'click', function (e) { window.location.hash = '#empreendimento/' + e.currentTarget.getAttribute('data-id'); });
        }
        drawRows();
        bind('.setor-filter', 'click', function (e) { currentFilter = e.currentTarget.getAttribute('data-f'); document.querySelectorAll('.setor-filter').forEach(function (b) { b.classList.toggle('active', b === e.currentTarget); }); drawRows(); });
      }
      drawSetorTab();
      bind('.tab-btn', 'click', function (e) { state.setorTab = e.currentTarget.getAttribute('data-tab'); document.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.toggle('active', b === e.currentTarget); }); drawSetorTab(); });
      bind('.emp-jump', 'click', function (e) { window.location.hash = '#empreendimento/' + e.currentTarget.getAttribute('data-id'); });
    } catch (e) { erro(e); }
  }

  async function renderEmpreendimentos() {
    loading();
    try {
      var q = await db.from('v_empreendimento_resumo').select('*');
      if (q.error) throw q.error;
      var emps = q.data || [];
      var rel = await db.from('empreendimento_setor').select('empreendimento_id, setor_id, setor_habitacional(nome)').in('empreendimento_id', emps.map(function (e) { return e.id; }));
      if (rel.error) throw rel.error;
      var setorByEmp = {};
      (rel.data || []).forEach(function (r) { setorByEmp[r.empreendimento_id] = (r.setor_habitacional && r.setor_habitacional.nome) || 'Sem Setor'; });
      var setoresFixos = ['Todos', 'Boa Vista', 'Contagem 1', 'Contagem 2', 'Contagem 3', 'Grande Colorado'];
      var filtroSetor = 'Todos', filtroStatus = 'Todos', busca = '';
      app.innerHTML = '<div class="page-header"><h1 class="page-title">Todos os empreendimentos</h1></div>' +
        '<div class="toolbar"><input id="emp-search" class="input" placeholder="🔍 Buscar por nome ou sigla" /></div>' +
        '<div class="filters" id="f-setor">Setor: ' + setoresFixos.map(function (s) { return '<button class="btn fset ' + (s === 'Todos' ? 'active' : '') + '" data-v="' + esc(s) + '">' + s + '</button>'; }).join('') + '</div>' +
        '<div class="filters" id="f-status">Status: ' + ['Todos', 'Irregular', 'Em Análise', 'Caucionado', 'Aprovado', 'Registrado'].map(function (s) { return '<button class="btn fsta ' + (s === 'Todos' ? 'active' : '') + '" data-v="' + esc(s) + '">' + s + '</button>'; }).join('') + '</div>' +
        '<div class="grid-4" id="emp-grid"></div>';
      function draw() {
        var rows = emps.filter(function (r) {
          var setorNome = setorByEmp[r.id] || 'Sem Setor';
          var okBusca = !busca || (String(r.nome || '').toLowerCase().includes(busca) || String(r.sigla || '').toLowerCase().includes(busca));
          var okSetor = filtroSetor === 'Todos' || setorNome === filtroSetor;
          var okStatus = filtroStatus === 'Todos' || r.status === filtroStatus;
          return okBusca && okSetor && okStatus;
        });
        document.getElementById('emp-grid').innerHTML = rows.map(function (r) {
          return '<div class="card clickable emp-card" data-id="' + r.id + '">' +
            '<div style="display:flex; justify-content:space-between; margin-bottom:6px;"><span class="badge badge-white">' + esc(setorByEmp[r.id] || 'Sem Setor') + '</span></div>' +
            photo(r.foto_url) +
            '<h3 style="margin:12px 0 6px">' + esc(r.nome) + '</h3>' + statusBadge(r.status) +
            '<p class="text-accent" style="font-size:24px; margin:10px 0;">' + moeda(r.vgv_total) + '</p>' +
            '<p>Unidades: ' + num(r.qntd_unidades) + '</p><p>📈 Adesômetro: ' + pct(r.adesometro_pct) + '</p>' +
            '</div>';
        }).join('') || '<div class="card">Sem resultados.</div>';
        bind('.emp-card', 'click', function (e) { window.location.hash = '#empreendimento/' + e.currentTarget.getAttribute('data-id'); });
      }
      draw();
      document.getElementById('emp-search').addEventListener('input', function (e) { busca = e.target.value.trim().toLowerCase(); draw(); });
      bind('.fset', 'click', function (e) { filtroSetor = e.currentTarget.getAttribute('data-v'); document.querySelectorAll('.fset').forEach(function (b) { b.classList.toggle('active', b === e.currentTarget); }); draw(); });
      bind('.fsta', 'click', function (e) { filtroStatus = e.currentTarget.getAttribute('data-v'); document.querySelectorAll('.fsta').forEach(function (b) { b.classList.toggle('active', b === e.currentTarget); }); draw(); });
    } catch (e) { erro(e); }
  }

  async function renderEmpDetalhe(id) {
    loading();
    try {
      var empQ = await db.from('v_empreendimento_resumo').select('*').eq('id', id).single();
      if (empQ.error) throw empQ.error;
      var uniQ = await db.from('v_unidade_completa').select('*').eq('empreendimento_id', id);
      if (uniQ.error) throw uniQ.error;
      var propQ = await db.from('proposta_empreendimento').select('proposta_id, proposta(titulo, data_proposta, data_fim_vigencia, preco_proposta_r_m2, tipo)').eq('empreendimento_id', id);
      if (propQ.error) throw propQ.error;
      var acaoQ = await db.from('acao_empreendimento').select('acao_id, v_acao_completa(*)').eq('empreendimento_id', id);
      if (acaoQ.error) throw acaoQ.error;
      var emp = empQ.data;
      var unidades = uniQ.data || [];
      app.innerHTML = '<div class="page-header"><div><h1 style="margin:0">' + esc(emp.nome) + '</h1>' + statusBadge(emp.status) + '</div></div>' +
        '<div class="metrics"><div class="metric-item"><h4>Adesômetro</h4><p>' + pct(emp.adesometro_pct) + '</p></div><div class="metric-item"><h4>Área Total Lotes</h4><p>' + num(emp.area_total_lotes_m2) + ' m²</p></div><div class="metric-item"><h4>VGV</h4><p>' + moeda(emp.vgv_total) + '</p></div></div>' +
        '<div class="tabs"><button class="tab-btn ' + (state.empTab === 'unidades' ? 'active' : '') + '" data-tab="unidades">Unidades</button><button class="tab-btn ' + (state.empTab === 'propostas' ? 'active' : '') + '" data-tab="propostas">Propostas Vigentes</button><button class="tab-btn ' + (state.empTab === 'acoes' ? 'active' : '') + '" data-tab="acoes">Ações</button></div><div id="emp-tab"></div>';

      function draw() {
        var c = document.getElementById('emp-tab');
        if (state.empTab === 'propostas') {
          c.innerHTML = '<div class="card">' + (propQ.data || []).map(function (x) { var p = x.proposta || {}; return '<div><strong>' + esc(p.titulo) + '</strong><div class="text-muted">' + data(p.data_proposta) + ' até ' + data(p.data_fim_vigencia) + ' • ' + moeda(p.preco_proposta_r_m2) + '/m² • ' + esc(p.tipo || '-') + '</div></div>'; }).join('<div class="sep"></div>') + '</div>';
          return;
        }
        if (state.empTab === 'acoes') {
          c.innerHTML = '<div class="table-wrap"><table><thead><tr><th>Descrição</th><th>Processo</th><th>Tipo</th><th>Valor</th><th>Data</th><th>Dias Restantes</th><th>Aviso</th></tr></thead><tbody>' + (acaoQ.data || []).map(function (x) {
            var a = x.v_acao_completa || {};
            return '<tr class="' + (a.mensagem_aviso_1_mes ? 'row-alert-1m' : '') + '"><td>' + esc(a.descricao) + '</td><td>' + esc(a.no_processo || '-') + '</td><td>' + esc(a.tipo || '-') + '</td><td>' + moeda(a.valor) + '</td><td>' + data(a.data) + '</td><td>' + num(a.dias_restantes) + '</td><td class="text-red">' + esc(a.mensagem_aviso_1_mes || a.mensagem_aviso_2_meses || '-') + '</td></tr>';
          }).join('') + '</tbody></table></div>';
          return;
        }
        var filtro = 'Todos';
        c.innerHTML = '<div class="filters">' + ['Todos', 'Aderente Quitado', 'Aderente Escriturado', 'Aderente Não Escriturado', 'Não Aderente'].map(function (f) { return '<button class="btn ufil ' + (f === 'Todos' ? 'active' : '') + '" data-v="' + esc(f) + '">' + f + '</button>'; }).join('') + '</div><div class="table-wrap"><table><thead><tr><th>Endereço</th><th>Status</th><th>Proprietário</th><th>Valor (area × preco)</th><th></th></tr></thead><tbody id="tb-un"></tbody></table></div>';
        function drawUnits() {
          var rows = unidades.filter(function (u) { return filtro === 'Todos' || u.status_lote === filtro; });
          document.getElementById('tb-un').innerHTML = rows.map(function (u) {
            return '<tr><td>' + esc(u.endereco) + '</td><td>' + statusLoteBadge(u.status_lote) + '</td><td>' + esc(u.ultima_vez_modificado_por || '-') + '</td><td>' + moeda((Number(u.area_m2) || 0) * (Number(u.preco_proposta_r_m2) || 0)) + '</td><td><button class="btn ver-uni" data-id="' + u.id + '">Ver unidade</button></td></tr>';
          }).join('') || '<tr><td colspan="5">Sem unidades.</td></tr>';
          bind('.ver-uni', 'click', function (e) { window.location.hash = '#unidade/' + e.currentTarget.getAttribute('data-id'); });
        }
        drawUnits();
        bind('.ufil', 'click', function (e) { filtro = e.currentTarget.getAttribute('data-v'); document.querySelectorAll('.ufil').forEach(function (b) { b.classList.toggle('active', b === e.currentTarget); }); drawUnits(); });
      }
      draw();
      bind('.tab-btn', 'click', function (e) { state.empTab = e.currentTarget.getAttribute('data-tab'); document.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.toggle('active', b === e.currentTarget); }); draw(); });
    } catch (e) { erro(e); }
  }

  function descontoForma(forma) {
    var map = { 'Á Vista': 0.9, '6x': 0.95, '12x': 1, 'Outras Parcelas': 1.05 };
    return map[forma] || 1;
  }

  async function renderUnidade(id) {
    loading();
    try {
      var unidadeQ = await db.from('v_unidade_completa').select('*').eq('id', id).single();
      if (unidadeQ.error) throw unidadeQ.error;
      var propQ = await db.from('unidade_pessoa').select('pessoa(nome_completo, cpf, telefone, email)').eq('unidade_id', id);
      if (propQ.error) throw propQ.error;
      var trQ = await db.from('transacao').select('*, transacao_signatario(pessoa(nome_completo))').eq('unidade_id', id).order('data_assinatura', { ascending: false });
      if (trQ.error) throw trQ.error;
      var acaoQ = await db.from('acao_empreendimento').select('acao_id, v_acao_completa(*)').eq('empreendimento_id', unidadeQ.data.empreendimento_id);
      if (acaoQ.error) throw acaoQ.error;
      var propostasQ = await db.rpc('get_proposta_vigente_unidade', { p_unidade_id: Number(id) });
      if (propostasQ.error) throw propostasQ.error;

      var u = unidadeQ.data;
      var donos = (propQ.data || []).map(function (p) { return p.pessoa; }).filter(Boolean);
      var trans = trQ.data || [];
      var latest = trans[0] || {};
      var precoFinal = (Number(latest.preco_base_r_m2) || Number(u.preco_proposta_r_m2) || 0) * descontoForma(latest.forma_pagamento);

      app.innerHTML = '<h1 style="margin:0 0 8px">' + esc(u.endereco) + '</h1>' +
        '<div class="badge badge-white">' + esc(u.empreendimento_nome) + '</div>' +
        '<p><strong>' + esc((donos[0] && donos[0].nome_completo) || '-') + '</strong></p>' + statusLoteBadge(u.status_lote) +
        (!u.quitado ? '<p style="font-size:26px; font-weight:800;">Valor da unidade: ' + moeda((Number(u.area_m2) || 0) * (Number(u.preco_proposta_r_m2) || 0)) + '</p>' : '') +
        '<div class="metrics metrics-4"><div class="metric-item"><h4>Área (m²)</h4><p>' + num(u.area_m2) + '</p></div><div class="metric-item"><h4>Matrícula</h4><p>' + esc(u.matricula || '-') + '</p></div><div class="metric-item"><h4>Uso</h4><p><span class="badge">' + esc(u.uso || '-') + '</span></p></div><div class="metric-item"><h4>Tipo Lote</h4><p>' + esc(u.tipo_lote || '-') + '</p></div></div>' +
        (!u.quitado ? '<button class="btn btn-success" id="btn-quitado">✓ Marcar como quitado</button>' : '') +
        '<div class="pricing-grid"><div><strong>Preço Proposta Vigente</strong><div>' + moeda(u.preco_proposta_r_m2) + '</div></div><div><strong>Preço Estático</strong><div>' + moeda(u.preco_total_proposta_vigente) + '</div></div><div><strong>Preço Final</strong><div>' + moeda(precoFinal) + '</div></div></div>' +
        '<div class="vertical-list"><div>Assinatura Pré-Contrato: ' + data(u.data_assinatura_pre_contrato) + '</div><div>Assinatura CP: ' + data(u.data_assinatura_cp) + '</div><div>Assinatura Escritura: ' + data(u.data_assinatura_escritura) + '</div></div>' +
        '<div class="tabs"><button class="tab-btn ' + (state.unidadeTab === 'transacoes' ? 'active' : '') + '" data-tab="transacoes">Transações</button><button class="tab-btn ' + (state.unidadeTab === 'propostas' ? 'active' : '') + '" data-tab="propostas">Propostas Vigentes</button><button class="tab-btn ' + (state.unidadeTab === 'acoes' ? 'active' : '') + '" data-tab="acoes">Ações</button></div><div id="uni-tab"></div>';

      function draw() {
        var c = document.getElementById('uni-tab');
        if (state.unidadeTab === 'propostas') {
          var arr = Array.isArray(propostasQ.data) ? propostasQ.data : [propostasQ.data].filter(Boolean);
          c.innerHTML = '<div class="card">' + arr.map(function (p) { return '<div><strong>' + esc(p.titulo || p.origem_proposta || 'Proposta vigente') + '</strong><div class="text-muted">' + data(p.data_inicio_proposta_vigente) + ' até ' + data(p.data_fim_proposta_vigente) + ' • ' + moeda(p.preco_proposta_r_m2) + '/m²</div></div>'; }).join('<div class="sep"></div>') + '</div>';
          return;
        }
        if (state.unidadeTab === 'acoes') {
          c.innerHTML = '<div class="table-wrap"><table><thead><tr><th>Descrição</th><th>Processo</th><th>Tipo</th><th>Valor</th><th>Data</th><th>Aviso</th></tr></thead><tbody>' + (acaoQ.data || []).map(function (x) { var a = x.v_acao_completa || {}; return '<tr class="' + (a.mensagem_aviso_1_mes ? 'row-alert-1m' : a.mensagem_aviso_2_meses ? 'row-alert-2m' : '') + '"><td>' + esc(a.descricao) + '</td><td>' + esc(a.no_processo || '-') + '</td><td>' + esc(a.tipo || '-') + '</td><td>' + moeda(a.valor) + '</td><td>' + data(a.data) + '</td><td>' + esc(a.mensagem_aviso_1_mes || a.mensagem_aviso_2_meses || '-') + '</td></tr>'; }).join('') + '</tbody></table></div>';
          return;
        }
        c.innerHTML = '<div class="toolbar"><button class="btn btn-primary" id="btn-nova-transacao">＋ Criar nova transação</button></div><div id="lista-tr"></div>';
        document.getElementById('lista-tr').innerHTML = trans.map(function (t) {
          var sign = (t.transacao_signatario || []).map(function (s) { return s.pessoa && s.pessoa.nome_completo; }).filter(Boolean)[0] || '-';
          var exp = t.data_assinatura && t.vigencia_meses ? new Date(new Date(t.data_assinatura).setMonth(new Date(t.data_assinatura).getMonth() + Number(t.vigencia_meses))).toLocaleDateString('pt-BR') : '-';
          return '<div class="card" style="margin-bottom:10px"><div style="display:flex; justify-content:space-between; gap:10px;"><h3 style="margin:0">' + esc((t.tipo || '-') + ' entre ' + (u.empreendimento_sigla || '') + ' e ' + sign) + '</h3><strong class="text-accent">' + moeda(t.preco_base_r_m2 || 0) + ' /m²</strong></div><div class="sep"></div><div class="metrics metrics-4"><div class="metric-item"><h4>Assinatura</h4><p>' + data(t.data_assinatura) + '</p></div><div class="metric-item"><h4>Expiração</h4><p>' + exp + '</p></div><div class="metric-item"><h4>Rescisão</h4><p>' + data(t.data_rescisao) + '</p></div><div class="metric-item"><h4>Código Minuta</h4><p>' + esc(t.codigo_minuta || '-') + '</p></div></div></div>';
        }).join('') || '<div class="card">Sem transações.</div>';
        var btn = document.getElementById('btn-nova-transacao');
        if (btn) btn.addEventListener('click', function () { openNovaTransacao(u); });
      }

      async function openNovaTransacao(unidade) {
        var overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = '<div class="modal"><h3>Nova transação</h3><div class="modal-grid">' +
          '<label>Tipo<select id="m-tipo"><option>Pré-Contrato Regularização</option><option>CP</option><option>Escritura</option><option>Cessão</option><option>Simulação</option></select></label>' +
          '<label>Forma de Pagamento<select id="m-forma"><option>Á Vista</option><option>6x</option><option>12x</option><option>Outras Parcelas</option></select></label>' +
          '<label>Data de Assinatura<input id="m-data" type="date" /></label>' +
          '<label>Vigência (meses)<input id="m-vig" type="number" min="1" value="12" /></label>' +
          '<label>Sinal<input id="m-sinal" type="number" min="0" step="0.01" value="0" /></label>' +
          '<label>Parcelas digitado<input id="m-parc" type="number" min="0" value="0" /></label>' +
          '<label>Índice Correção<select id="m-ind"><option>IPCA</option><option>IGPM</option><option>INCC</option><option>Sem Índice</option></select></label>' +
          '</div><div class="modal-actions"><button class="btn" id="m-cancel">Cancelar</button><button class="btn btn-primary" id="m-save">Salvar</button></div></div>';
        document.body.appendChild(overlay);
        document.getElementById('m-cancel').onclick = function () { overlay.remove(); };
        document.getElementById('m-save').onclick = async function () {
          try {
            var pr = await db.rpc('get_proposta_vigente_unidade', { p_unidade_id: unidade.id });
            if (pr.error) throw pr.error;
            var propostaId = Array.isArray(pr.data) ? (pr.data[0] && pr.data[0].id) : (pr.data && pr.data.id);
            var payload = {
              unidade_id: unidade.id,
              proposta_id: propostaId || null,
              tipo: document.getElementById('m-tipo').value,
              forma_pagamento: document.getElementById('m-forma').value,
              data_assinatura: document.getElementById('m-data').value || null,
              vigencia_meses: Number(document.getElementById('m-vig').value) || 0,
              sinal: Number(document.getElementById('m-sinal').value) || 0,
              parcelas_digitado_meses: Number(document.getElementById('m-parc').value) || 0,
              indice_correcao: document.getElementById('m-ind').value
            };
            var ins = await db.from('transacao').insert(payload);
            if (ins.error) throw ins.error;
            overlay.remove();
            renderUnidade(unidade.id);
          } catch (e) { alert('Erro ao salvar transação: ' + ((e && e.message) || e)); }
        };
      }

      draw();
      bind('.tab-btn', 'click', function (e) { state.unidadeTab = e.currentTarget.getAttribute('data-tab'); document.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.toggle('active', b === e.currentTarget); }); draw(); });
      var quitBtn = document.getElementById('btn-quitado');
      if (quitBtn) quitBtn.addEventListener('click', async function () {
        var up = await db.from('unidade').update({ quitado: true }).eq('id', u.id);
        if (up.error) return alert('Erro ao atualizar: ' + up.error.message);
        renderUnidade(u.id);
      });
    } catch (e) { erro(e); }
  }

  async function renderMoradores() {
    loading();
    try {
      var q = await db.from('pessoa').select('id, nome_completo, cpf, telefone, email, unidade_pessoa(unidade(id, v_unidade_completa(endereco, empreendimento_nome)))');
      if (q.error) throw q.error;
      var rows = q.data || [];
      app.innerHTML = '<div class="page-header"><h1 class="page-title">Moradores</h1></div><div class="toolbar"><input id="m-search" class="input" placeholder="Buscar por nome ou CPF" /></div><div class="table-wrap"><table><thead><tr><th>Nome</th><th>CPF</th><th>Telefone</th><th>Email</th><th>Unidade(s)</th></tr></thead><tbody id="m-tb"></tbody></table></div>';
      function draw(f) {
        f = (f || '').toLowerCase();
        var fl = rows.filter(function (r) { return !f || String(r.nome_completo || '').toLowerCase().includes(f) || String(r.cpf || '').toLowerCase().includes(f); });
        document.getElementById('m-tb').innerHTML = fl.map(function (r) {
          var unidades = (r.unidade_pessoa || []).map(function (u) {
            var uobj = u.unidade || {}; var v = uobj.v_unidade_completa || {};
            return '<a href="#unidade/' + uobj.id + '">' + esc((v.endereco || 'Unidade') + ' - ' + (v.empreendimento_nome || '')) + '</a>';
          }).join('<br>');
          return '<tr><td>' + esc(r.nome_completo) + '</td><td>' + esc(r.cpf || '-') + '</td><td>' + esc(r.telefone || '-') + '</td><td>' + esc(r.email || '-') + '</td><td>' + (unidades || '-') + '</td></tr>';
        }).join('') || '<tr><td colspan="5">Sem moradores.</td></tr>';
      }
      draw('');
      document.getElementById('m-search').addEventListener('input', function (e) { draw(e.target.value); });
    } catch (e) { erro(e); }
  }

  async function renderAcoes() {
    loading();
    try {
      var q = await db.from('v_acao_completa').select('*').order('dias_restantes', { ascending: true });
      if (q.error) throw q.error;
      var rows = q.data || [];
      app.innerHTML = '<div class="page-header"><h1 class="page-title">Ações</h1></div><div class="table-wrap"><table><thead><tr><th>Descrição</th><th>Nº Processo</th><th>Tipo</th><th>Valor</th><th>Data</th><th>Dias Restantes</th><th>Aviso</th></tr></thead><tbody>' + rows.map(function (r) {
        return '<tr class="' + (r.mensagem_aviso_1_mes ? 'row-alert-1m' : r.mensagem_aviso_2_meses ? 'row-alert-2m' : '') + '"><td>' + esc(r.descricao) + '</td><td>' + esc(r.no_processo || '-') + '</td><td>' + esc(r.tipo || '-') + '</td><td>' + moeda(r.valor) + '</td><td>' + data(r.data) + '</td><td>' + num(r.dias_restantes) + '</td><td>' + esc(r.mensagem_aviso_1_mes || r.mensagem_aviso_2_meses || '-') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    } catch (e) { erro(e); }
  }

  async function router() {
    var r = routeInfo();
    setActiveNav(r.route);
    if (r.route === 'setor' && r.id) return renderSetorDetalhe(r.id);
    if (r.route === 'empreendimento' && r.id) return renderEmpDetalhe(r.id);
    if (r.route === 'unidade' && r.id) return renderUnidade(r.id);
    if (r.route === 'empreendimentos') return renderEmpreendimentos();
    if (r.route === 'moradores') return renderMoradores();
    if (r.route === 'acoes') return renderAcoes();
    return renderSetores();
  }

  window.addEventListener('hashchange', router);
  if (!window.location.hash) window.location.hash = '#setores';
  router();
})();
