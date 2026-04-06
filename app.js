const appEl = document.getElementById('app');
const alertsEl = document.getElementById('alerts');
const titleEl = document.getElementById('page-title');
const connEl = document.getElementById('conn-status');

const state = {
  supabase: null,
  connected: false,
  realtimeChannel: null,
  data: {
    setores: [],
    empreendimentos: [],
    unidades: [],
    proprietarios: [],
    unidade_proprietarios: [],
    transacoes: []
  }
};

const tables = ['setores', 'empreendimentos', 'unidades', 'proprietarios', 'unidade_proprietarios', 'transacoes'];

const demo = {
  setores: [
    { id: 1, nome: 'Boa Vista', descricao: 'Setor principal' },
    { id: 2, nome: 'Contagem 1', descricao: 'Setor em expansão' }
  ],
  empreendimentos: [
    { id: 1, setor_id: 1, nome: 'Bianca', status_registro: 'Registrado', vgv_total: 6819857.6 },
    { id: 2, setor_id: 2, nome: 'Boa Sorte', status_registro: 'Em análise', vgv_total: 1371571.83 }
  ],
  unidades: [
    { id: 1, empreendimento_id: 1, endereco: 'B Lote 1', matricula: '', area_m2: 1008.85, uso: 'Residencial', tipo_lote: 'Padrão', valor_unidade: 302655, quitado: false },
    { id: 2, empreendimento_id: 1, endereco: 'B Lote 2', matricula: '', area_m2: 1086.45, uso: 'Residencial', tipo_lote: 'Esquina', valor_unidade: 326000, quitado: true }
  ],
  proprietarios: [
    { id: 1, nome: 'Bruna Vasconcelos' },
    { id: 2, nome: 'Viviane Souza Oliveira' }
  ],
  unidade_proprietarios: [
    { unidade_id: 1, proprietario_id: 1 },
    { unidade_id: 1, proprietario_id: 2 }
  ],
  transacoes: [
    { id: 1, unidade_id: 1, tipo: 'Proposta Vigente', valor: 300, status: 'Em análise', data_evento: '2026-03-05' }
  ]
};

function money(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
}

function showAlert(msg, type = 'ok') {
  alertsEl.innerHTML = `<div class="alert ${type === 'ok' ? 'ok' : 'err'}">${msg}</div>`;
  setTimeout(() => (alertsEl.innerHTML = ''), 4200);
}

function parseRoute() {
  const [path, query] = location.hash.replace('#', '').split('?');
  const params = new URLSearchParams(query || '');
  return { path: path || '/', params };
}

function setNav() {
  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.route === location.hash || (location.hash === '' && btn.dataset.route === '#/'));
    btn.onclick = () => (location.hash = btn.dataset.route);
  });
}

async function initData() {
  const cfg = window.APP_CONFIG;
  if (cfg?.SUPABASE_URL && cfg?.SUPABASE_ANON_KEY && window.supabase) {
    state.supabase = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    try {
      await loadFromSupabase();
      state.connected = true;
      connEl.textContent = 'Supabase conectado';
      connEl.classList.add('ok');
      bindRealtime();
      return;
    } catch (err) {
      console.error(err);
      showAlert('Falha ao conectar no Supabase, usando dados de demonstração.', 'err');
    }
  }

  state.data = structuredClone(demo);
  connEl.textContent = 'Modo demo';
}

async function loadFromSupabase() {
  for (const table of tables) {
    const { data, error } = await state.supabase.from(table).select('*');
    if (error) throw error;
    state.data[table] = data;
  }
}

function bindRealtime() {
  if (!state.connected || !state.supabase) return;

  if (state.realtimeChannel) {
    state.supabase.removeChannel(state.realtimeChannel);
  }

  state.realtimeChannel = state.supabase
    .channel('painel-habitacional-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: '*' }, async () => {
      await loadFromSupabase();
      render();
    })
    .subscribe();
}

async function save(table, row, idField = 'id') {
  if (!state.connected) {
    const idx = state.data[table].findIndex((i) => i[idField] === row[idField]);
    if (idx >= 0) state.data[table][idx] = row;
    else {
      row[idField] = row[idField] || Date.now();
      state.data[table].push(row);
    }
    return;
  }

  const upsert = { ...row };
  const { error } = await state.supabase.from(table).upsert(upsert);
  if (error) throw error;
  await loadFromSupabase();
}

function remove(table, id) {
  if (!confirm('Tem certeza?')) return;
  if (!state.connected) {
    state.data[table] = state.data[table].filter((r) => r.id !== id);
    render();
    return;
  }

  state.supabase.from(table).delete().eq('id', id).then(({ error }) => {
    if (error) return showAlert(error.message, 'err');
    loadFromSupabase().then(() => {
      showAlert('Excluído com sucesso.');
      render();
    });
  });
}

function ownersForUnit(unitId) {
  const links = state.data.unidade_proprietarios.filter((u) => u.unidade_id === unitId).map((u) => u.proprietario_id);
  return state.data.proprietarios.filter((p) => links.includes(p.id));
}

function getSectorStats(setorId) {
  const emps = state.data.empreendimentos.filter((e) => e.setor_id === setorId);
  const units = state.data.unidades.filter((u) => emps.some((e) => e.id === u.empreendimento_id));
  const trans = state.data.transacoes.filter((t) => units.some((u) => u.id === t.unidade_id));

  return {
    empreendimentos: emps.length,
    unidades: units.length,
    vgv: emps.reduce((acc, e) => acc + Number(e.vgv_total || 0), 0),
    registradas: trans.filter((t) => (t.status || '').toLowerCase().includes('registr')).length,
    analise: trans.filter((t) => (t.status || '').toLowerCase().includes('an')).length
  };
}

function homeView() {
  const totalVgv = state.data.empreendimentos.reduce((a, e) => a + Number(e.vgv_total || 0), 0);
  return `
    <div class="grid">
      <div class="card">
        <h3>Setores</h3>
        <div class="kpi">${state.data.setores.length}</div>
      </div>
      <div class="card">
        <h3>Empreendimentos</h3>
        <div class="kpi">${state.data.empreendimentos.length}</div>
      </div>
      <div class="card">
        <h3>Unidades</h3>
        <div class="kpi">${state.data.unidades.length}</div>
      </div>
      <div class="card">
        <h3>VGV total</h3>
        <div class="kpi">${money(totalVgv)}</div>
      </div>
    </div>
  `;
}

function setoresView() {
  const cards = state.data.setores
    .map((s) => {
      const st = getSectorStats(s.id);
      return `
      <div class="card">
        <div class="row between">
          <h3>${s.nome}</h3>
          <button onclick="location.hash='#/empreendimentos?setor_id=${s.id}'">Abrir</button>
        </div>
        <p class="muted">${s.descricao || ''}</p>
        <p>Empreendimentos: <b>${st.empreendimentos}</b></p>
        <p>Unidades: <b>${st.unidades}</b></p>
        <p>VGV: <b>${money(st.vgv)}</b></p>
        <p>Registrados: <b>${st.registradas}</b> | Em análise: <b>${st.analise}</b></p>
      </div>`;
    })
    .join('');

  return `
    <div class="row" style="margin-bottom:12px">
      <button class="primary" onclick="openSetorForm()">Novo setor</button>
    </div>
    <div class="grid">${cards}</div>
  `;
}

function empreendimentosView(params) {
  const setorId = Number(params.get('setor_id')) || null;
  let emps = state.data.empreendimentos;
  if (setorId) emps = emps.filter((e) => e.setor_id === setorId);

  return `
    <div class="row" style="margin-bottom:12px">
      <button class="primary" onclick="openEmpForm(${setorId || ''})">Novo empreendimento</button>
      ${setorId ? `<span class='tag'>Filtrado por setor #${setorId}</span>` : ''}
    </div>
    <div class="grid">
      ${emps
        .map((e) => {
          const units = state.data.unidades.filter((u) => u.empreendimento_id === e.id).length;
          return `
          <div class="card">
            <h3>${e.nome}</h3>
            <p><span class="tag">${e.status_registro || 'Sem status'}</span></p>
            <p>VGV: <b>${money(e.vgv_total)}</b></p>
            <p>Unidades: <b>${units}</b></p>
            <div class="row">
              <button onclick="location.hash='#/empreendimento?id=${e.id}'">Detalhes</button>
              <button onclick="openEmpForm(null, ${e.id})">Editar</button>
              <button class="danger" onclick="remove('empreendimentos', ${e.id})">Excluir</button>
            </div>
          </div>`;
        })
        .join('')}
    </div>
  `;
}

function empreendimentoView(params) {
  const id = Number(params.get('id'));
  const e = state.data.empreendimentos.find((x) => x.id === id);
  if (!e) return '<p>Empreendimento não encontrado.</p>';

  const units = state.data.unidades.filter((u) => u.empreendimento_id === e.id);

  return `
    <div class="card">
      <h2>${e.nome}</h2>
      <p>Status: <span class="tag">${e.status_registro || '-'}</span></p>
      <p>VGV: <b>${money(e.vgv_total)}</b></p>
      <div class="row">
        <button class="primary" onclick="openUnitForm(${e.id})">Nova unidade</button>
      </div>
    </div>

    <h2>Unidades</h2>
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>Endereço</th><th>Área (m²)</th><th>Uso</th><th>Pessoas</th><th>Ações</th></tr>
        </thead>
        <tbody>
          ${units
            .map((u) => {
              const owners = ownersForUnit(u.id)
                .map((o) => o.nome)
                .join(', ');
              return `<tr>
                <td>${u.endereco}</td>
                <td>${Number(u.area_m2 || 0).toLocaleString('pt-BR')}</td>
                <td>${u.uso || '-'}</td>
                <td>${owners || '-'}</td>
                <td>
                  <button onclick="location.hash='#/unidade?id=${u.id}'">Ir para unidade</button>
                </td>
              </tr>`;
            })
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

function unidadeView(params) {
  const id = Number(params.get('id'));
  const u = state.data.unidades.find((x) => x.id === id);
  if (!u) return '<p>Unidade não encontrada.</p>';

  const emp = state.data.empreendimentos.find((e) => e.id === u.empreendimento_id);
  const owners = ownersForUnit(u.id);
  const trans = state.data.transacoes.filter((t) => t.unidade_id === u.id);

  return `
    <div class="card">
      <h2>${u.endereco}</h2>
      <p><span class="tag">${emp?.nome || '-'}</span></p>
      <p>Proprietários: <b>${owners.map((o) => o.nome).join(', ') || '-'}</b></p>
      <p>Valor da unidade: <b>${money(u.valor_unidade)}</b></p>
      <div class="row">
        <button onclick="openUnitForm(${u.empreendimento_id}, ${u.id})">Editar unidade</button>
        <button class="success" onclick="toggleQuitado(${u.id})">${u.quitado ? 'Marcar como NÃO quitado' : 'Marcar como quitado'}</button>
      </div>
    </div>

    <h2>Transações</h2>
    <div class="row" style="margin-bottom:8px">
      <button class="primary" onclick="openTransForm(${u.id})">Nova transação</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Tipo</th><th>Valor</th><th>Status</th><th>Data</th><th>Ações</th></tr></thead>
        <tbody>
          ${trans
            .map(
              (t) => `<tr>
                <td>${t.tipo}</td>
                <td>${money(t.valor)}</td>
                <td>${t.status || '-'}</td>
                <td>${t.data_evento || '-'}</td>
                <td>
                  <button onclick="openTransForm(${u.id}, ${t.id})">Editar</button>
                  <button class="danger" onclick="remove('transacoes', ${t.id})">Excluir</button>
                </td>
              </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

function unidadesView() {
  return `
    <div class="card">
      <p>Abra um empreendimento para listar as unidades segmentadas e entrar na unidade.</p>
      <button onclick="location.hash='#/empreendimentos'">Ir para empreendimentos</button>
    </div>
  `;
}

function formDialog(title, bodyHtml, onSubmit) {
  const d = document.createElement('dialog');
  d.innerHTML = `
    <form method="dialog" id="xform">
      <h3>${title}</h3>
      ${bodyHtml}
      <div class="row">
        <button value="cancel">Cancelar</button>
        <button class="primary" value="default">Salvar</button>
      </div>
    </form>
  `;
  document.body.appendChild(d);
  d.showModal();
  d.querySelector('#xform').onsubmit = async (e) => {
    e.preventDefault();
    try {
      await onSubmit(new FormData(e.target));
      d.close();
      d.remove();
      showAlert('Salvo com sucesso.');
      render();
    } catch (err) {
      showAlert(err.message, 'err');
    }
  };
}

window.openSetorForm = function openSetorForm(id) {
  const setor = state.data.setores.find((s) => s.id === id) || {};
  formDialog(
    setor.id ? 'Editar setor' : 'Novo setor',
    `<input name="nome" placeholder="Nome" value="${setor.nome || ''}" required />
     <textarea name="descricao" placeholder="Descrição">${setor.descricao || ''}</textarea>`,
    async (fd) => save('setores', { id: setor.id, nome: fd.get('nome'), descricao: fd.get('descricao') })
  );
};

window.openEmpForm = function openEmpForm(setorId, id) {
  const e = state.data.empreendimentos.find((x) => x.id === id) || {};
  const options = state.data.setores
    .map((s) => `<option value="${s.id}" ${Number(e.setor_id || setorId) === s.id ? 'selected' : ''}>${s.nome}</option>`)
    .join('');
  formDialog(
    e.id ? 'Editar empreendimento' : 'Novo empreendimento',
    `<input name="nome" placeholder="Nome" value="${e.nome || ''}" required />
     <select name="setor_id" required>${options}</select>
     <input name="status_registro" placeholder="Status" value="${e.status_registro || ''}" />
     <input name="vgv_total" type="number" step="0.01" placeholder="VGV" value="${e.vgv_total || ''}" />`,
    async (fd) =>
      save('empreendimentos', {
        id: e.id,
        nome: fd.get('nome'),
        setor_id: Number(fd.get('setor_id')),
        status_registro: fd.get('status_registro'),
        vgv_total: Number(fd.get('vgv_total'))
      })
  );
};

window.openUnitForm = function openUnitForm(empreendimentoId, id) {
  const u = state.data.unidades.find((x) => x.id === id) || {};
  formDialog(
    u.id ? 'Editar unidade' : 'Nova unidade',
    `<input name="endereco" placeholder="Endereço" value="${u.endereco || ''}" required />
     <input name="matricula" placeholder="Matrícula" value="${u.matricula || ''}" />
     <input name="area_m2" type="number" step="0.01" placeholder="Área m²" value="${u.area_m2 || ''}" />
     <input name="uso" placeholder="Uso" value="${u.uso || ''}" />
     <input name="tipo_lote" placeholder="Tipo lote" value="${u.tipo_lote || ''}" />
     <input name="valor_unidade" type="number" step="0.01" placeholder="Valor da unidade" value="${u.valor_unidade || ''}" />`,
    async (fd) =>
      save('unidades', {
        id: u.id,
        empreendimento_id: Number(u.empreendimento_id || empreendimentoId),
        endereco: fd.get('endereco'),
        matricula: fd.get('matricula'),
        area_m2: Number(fd.get('area_m2')),
        uso: fd.get('uso'),
        tipo_lote: fd.get('tipo_lote'),
        valor_unidade: Number(fd.get('valor_unidade')),
        quitado: !!u.quitado
      })
  );
};

window.openTransForm = function openTransForm(unidadeId, id) {
  const t = state.data.transacoes.find((x) => x.id === id) || {};
  formDialog(
    t.id ? 'Editar transação' : 'Nova transação',
    `<input name="tipo" placeholder="Tipo" value="${t.tipo || ''}" required />
     <input name="valor" type="number" step="0.01" placeholder="Valor" value="${t.valor || ''}" required />
     <input name="status" placeholder="Status" value="${t.status || ''}" />
     <input name="data_evento" type="date" value="${t.data_evento || ''}" />`,
    async (fd) =>
      save('transacoes', {
        id: t.id,
        unidade_id: Number(t.unidade_id || unidadeId),
        tipo: fd.get('tipo'),
        valor: Number(fd.get('valor')),
        status: fd.get('status'),
        data_evento: fd.get('data_evento')
      })
  );
};

window.toggleQuitado = async function toggleQuitado(id) {
  const u = state.data.unidades.find((x) => x.id === id);
  if (!u) return;
  await save('unidades', { ...u, quitado: !u.quitado });
  render();
};

window.remove = remove;

function render() {
  setNav();
  const { path, params } = parseRoute();
  let html = '';

  switch (path) {
    case '/':
      titleEl.textContent = 'Home';
      html = homeView();
      break;
    case '/setores':
      titleEl.textContent = 'Setores Habitacionais';
      html = setoresView();
      break;
    case '/empreendimentos':
      titleEl.textContent = 'Empreendimentos';
      html = empreendimentosView(params);
      break;
    case '/empreendimento':
      titleEl.textContent = 'Detalhe do Empreendimento';
      html = empreendimentoView(params);
      break;
    case '/unidades':
      titleEl.textContent = 'Unidades';
      html = unidadesView();
      break;
    case '/unidade':
      titleEl.textContent = 'Detalhe da Unidade';
      html = unidadeView(params);
      break;
    default:
      titleEl.textContent = 'Página não encontrada';
      html = '<p>Rota inválida.</p>';
  }

  appEl.innerHTML = html;
}

window.addEventListener('hashchange', render);

(async function bootstrap() {
  await initData();
  if (!location.hash) location.hash = '#/';
  render();
})();

window.addEventListener('beforeunload', () => {
  if (state.realtimeChannel && state.supabase) {
    state.supabase.removeChannel(state.realtimeChannel);
  }
});
