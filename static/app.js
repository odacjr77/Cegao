// ── Estado ────────────────────────────────────────────────────────────────────
const st = {
  nome: null, tel: null, isAdmin: false,
  campNome: null, campQtd: 0, campRevelado: false,
};

// ── Navegação ─────────────────────────────────────────────────────────────────
function ir(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0, 0);
}

function irHome() {
  Object.assign(st, { nome:null, tel:null, isAdmin:false, campNome:null, campQtd:0, campRevelado:false });
  document.getElementById('header-ctx').classList.add('hidden');
  ir('view-home');
}

function setCtx(html) {
  const el = document.getElementById('header-ctx');
  el.innerHTML = html;
  el.classList.remove('hidden');
}

// ── Toast ─────────────────────────────────────────────────────────────────────
let _tt;
function toast(msg, tipo = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast' + (tipo ? ' ' + tipo : '');
  clearTimeout(_tt);
  _tt = setTimeout(() => el.classList.add('hidden'), 3500);
}

// ── API ───────────────────────────────────────────────────────────────────────
async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch('/api' + path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Erro desconhecido');
  return data;
}

// ── Entrada ───────────────────────────────────────────────────────────────────
async function entrar() {
  const nome = document.getElementById('ent-nome').value.trim();
  const tel  = document.getElementById('ent-tel').value.trim();
  if (!nome) { toast('Informe seu nome', 'err'); return; }

  try {
    const r = await api('POST', '/entrar', { nome, telefone: tel });
    st.nome    = nome;
    st.tel     = tel;
    st.isAdmin = r.admin;
    setCtx(`${nome}${r.admin ? '<br><small>🎯 Admin</small>' : ''}`);

    if (r.admin) {
      renderAdminLista(r.campeonatos);
      ir('view-admin');
    } else {
      renderListaCamps(r.campeonatos);
      ir('view-lista');
    }
  } catch(e) { toast(e.message, 'err'); }
}

// ── Lista de campeonatos (participante) ───────────────────────────────────────
function renderListaCamps(camps) {
  document.getElementById('lista-titulo').textContent = `Olá, ${st.nome} 👋`;
  const el = document.getElementById('lista-camps');
  const ativos = camps.filter(c => !c.revelado);
  const revelados = camps.filter(c => c.revelado);

  if (camps.length === 0) {
    el.innerHTML = '<p class="dim" style="text-align:center;padding:32px 0">Nenhum campeonato ativo no momento.</p>';
    return;
  }

  let html = '';
  if (ativos.length) {
    html += '<p class="lista-label">Participar:</p>';
    html += ativos.map(c => `
      <div class="camp-card" onclick="abrirCamp(${JSON.stringify(c)})">
        <div class="camp-nome">${c.nome}</div>
        <div class="camp-meta">${c.qtd_bebidas} bebida(s) · Em andamento</div>
        <div class="camp-arrow">→</div>
      </div>`).join('');
  }
  if (revelados.length) {
    html += '<p class="lista-label" style="margin-top:20px">Resultados disponíveis:</p>';
    html += revelados.map(c => `
      <div class="camp-card camp-card-done" onclick="abrirResultados(${JSON.stringify(c)})">
        <div class="camp-nome">${c.nome}</div>
        <div class="camp-meta">Ver resultados 🏆</div>
        <div class="camp-arrow">→</div>
      </div>`).join('');
  }
  el.innerHTML = html;
}

async function abrirCamp(camp) {
  st.campNome     = camp.nome;
  st.campQtd      = camp.qtd_bebidas;
  st.campRevelado = camp.revelado;
  document.getElementById('vot-titulo').textContent = camp.nome;
  document.getElementById('vot-form').classList.remove('hidden');
  document.getElementById('vot-aguardando').classList.add('hidden');

  const campos = document.getElementById('vot-campos');
  campos.innerHTML = Array.from({ length: camp.qtd_bebidas }, (_, i) => `
    <div class="vot-campo">
      <label>Bebida ${i + 1}</label>
      <input type="text" id="voto-${i}" placeholder="Qual você acha que é?" autocomplete="off" />
    </div>`).join('');

  ir('view-votacao');
}

async function abrirResultados(camp) {
  st.campNome = camp.nome;
  try {
    const data = await api('GET', `/resultados/${encodeURIComponent(camp.nome)}`);
    document.getElementById('res-titulo').textContent = camp.nome;
    renderResultados('res-gabarito', 'res-ranking', data);
    ir('view-resultados');
  } catch(e) { toast('Resultados não disponíveis ainda', 'err'); }
}

// ── Votação ───────────────────────────────────────────────────────────────────
async function enviarVotos() {
  const votos = Array.from({ length: st.campQtd }, (_, i) =>
    (document.getElementById('voto-' + i)?.value || '').trim()
  );
  if (votos.every(v => !v)) { toast('Preencha ao menos um voto', 'err'); return; }

  try {
    await api('POST', '/votos', { campeonato: st.campNome, nome: st.nome, telefone: st.tel, votos });
    toast('Votos enviados! 🎉', 'ok');
    document.getElementById('vot-form').classList.add('hidden');
    document.getElementById('vot-aguardando').classList.remove('hidden');
  } catch(e) { toast(e.message, 'err'); }
}

async function tentarVerResultados() {
  try {
    const data = await api('GET', `/resultados/${encodeURIComponent(st.campNome)}`);
    document.getElementById('res-titulo').textContent = st.campNome;
    renderResultados('res-gabarito', 'res-ranking', data);
    ir('view-resultados');
  } catch(e) { toast('Resultados ainda não revelados. Aguarde o admin.', 'err'); }
}

// ── Admin: lista ──────────────────────────────────────────────────────────────
function renderAdminLista(camps) {
  const el = document.getElementById('adm-lista-camps');
  if (!camps || camps.length === 0) {
    el.innerHTML = '<p class="dim">Nenhum campeonato. Crie um novo acima.</p>';
    return;
  }
  el.innerHTML = camps.map(c => `
    <div class="camp-card ${c.revelado ? 'camp-card-done' : ''}" onclick="abrirAdminCamp(${JSON.stringify(c)})">
      <div class="camp-nome">${c.nome}</div>
      <div class="camp-meta">${c.qtd_bebidas} bebida(s) · ${c.revelado ? 'Revelado ✓' : 'Em andamento'}</div>
      <div class="camp-arrow">→</div>
    </div>`).join('');
}

function toggleCriar() {
  document.getElementById('form-criar').classList.toggle('hidden');
}

async function criarCampeonato() {
  const nome   = document.getElementById('c-nome').value.trim();
  const braw   = document.getElementById('c-bebidas').value.trim();
  if (!nome || !braw) { toast('Preencha todos os campos', 'err'); return; }
  const bebidas = braw.split('\n').map(b => b.trim()).filter(Boolean);
  if (!bebidas.length) { toast('Adicione ao menos uma bebida', 'err'); return; }

  try {
    await api('POST', '/campeonatos', { telefone: st.tel, nome, bebidas });
    toast('Campeonato criado!', 'ok');
    document.getElementById('c-nome').value = '';
    document.getElementById('c-bebidas').value = '';
    document.getElementById('form-criar').classList.add('hidden');
    const camps = await api('GET', '/campeonatos');
    renderAdminLista(camps);
  } catch(e) { toast(e.message, 'err'); }
}

// ── Admin: gerenciar campeonato ───────────────────────────────────────────────
async function abrirAdminCamp(camp) {
  st.campNome     = camp.nome;
  st.campQtd      = camp.qtd_bebidas;
  st.campRevelado = camp.revelado;
  document.getElementById('adm-camp-titulo').textContent = camp.nome;
  document.getElementById('adm-res-wrap').classList.add('hidden');
  await recarregarCamp();
  ir('view-admin-camp');
}

async function recarregarCamp() {
  try {
    const votos = await api('GET', `/votos/${encodeURIComponent(st.campNome)}`);
    const resultados = st.campRevelado
      ? await api('GET', `/resultados/${encodeURIComponent(st.campNome)}`)
      : null;

    // progresso
    const prog = document.getElementById('adm-prog');
    if (!votos.length) {
      prog.innerHTML = '<p class="dim">Nenhum participante ainda.</p>';
    } else {
      prog.innerHTML = votos.map(v => {
        const ac = v['Acertos'] !== '' ? ` · ${v['Acertos']} acerto(s)` : '';
        return `<div class="prog-row"><strong>${v['Nome']}</strong>${v['Telefone'] ? ' <span class="dim">' + v['Telefone'] + '</span>' : ''}${ac}</div>`;
      }).join('');
    }

    // gabarito (só admin)
    if (resultados) {
      renderResultados('adm-gab', 'adm-ranking', resultados);
      document.getElementById('adm-res-wrap').classList.remove('hidden');
    } else {
      const gab = document.getElementById('adm-gab');
      gab.innerHTML = '<p class="dim">Clique "Revelar" para exibir o gabarito e calcular os acertos.</p>';
    }

    toast('Atualizado', 'ok');
  } catch(e) { toast(e.message, 'err'); }
}

async function revelar() {
  if (!confirm('Revelar resultados agora? Os acertos serão calculados e todos poderão ver.')) return;
  try {
    await api('POST', '/revelar', { telefone: st.tel, campeonato: st.campNome });
    st.campRevelado = true;
    toast('Revelado! 🎭', 'ok');
    await recarregarCamp();
  } catch(e) { toast(e.message, 'err'); }
}

async function encerrar() {
  if (!confirm('Encerrar campeonato? Nenhum novo voto poderá ser registrado.')) return;
  try {
    await api('POST', '/encerrar', { telefone: st.tel, campeonato: st.campNome });
    toast('Encerrado.', 'ok');
    ir('view-admin');
    const camps = await api('GET', '/campeonatos');
    renderAdminLista(camps);
  } catch(e) { toast(e.message, 'err'); }
}

// ── Renderizar resultados ─────────────────────────────────────────────────────
function renderResultados(gabId, rankId, data) {
  document.getElementById(gabId).innerHTML =
    '<div class="gab-titulo">Gabarito:</div>' +
    data.bebidas.map((b, i) =>
      `<div class="gab-row"><span class="gab-num">${i + 1}</span>${b}</div>`
    ).join('');

  const total  = data.bebidas.length;
  const sorted = [...data.votos].sort((a, b) => (Number(b['Acertos']) || 0) - (Number(a['Acertos']) || 0));
  document.getElementById(rankId).innerHTML =
    '<div class="rank-titulo">🏆 Ranking de acertos</div>' +
    sorted.map((v, i) => {
      const pts   = v['Acertos'] !== '' ? Number(v['Acertos']) : '—';
      const pct   = typeof pts === 'number' ? ` <small>(${Math.round(pts / total * 100)}%)</small>` : '';
      const medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':`#${i+1}`;
      return `<div class="rank-row ${i===0?'rank-primeiro':''}">
        <span class="rank-pos">${medal}</span>
        <span class="rank-nome">${v['Nome']}</span>
        <span class="rank-pts">${pts}${pct}</span>
      </div>`;
    }).join('');
}
