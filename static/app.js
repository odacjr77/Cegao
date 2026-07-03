// ── Estado ────────────────────────────────────────────────────────────────────
const st = {
  campNome: null, campCodigo: null, partNome: null, partTel: null,
  admSenha: null, bebidas: [], revelado: false,
};

// ── Navegação ─────────────────────────────────────────────────────────────────
function ir(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(viewId).classList.add('active');
  window.scrollTo(0, 0);
}

function irHome() {
  Object.assign(st, { campNome: null, campCodigo: null, partNome: null, partTel: null, admSenha: null, bebidas: [], revelado: false });
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

// ── Tabs (admin login) ────────────────────────────────────────────────────────
function switchTab(btn) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
  btn.classList.add('active');
  const panel = document.getElementById(btn.dataset.panel);
  panel.classList.remove('hidden');
  panel.classList.add('active');
}

// ── Participante: Entrar ──────────────────────────────────────────────────────
async function entrar() {
  const codigo = document.getElementById('p-codigo').value.trim().toUpperCase();
  const nome   = document.getElementById('p-nome').value.trim();
  const tel    = document.getElementById('p-telefone').value.trim();
  if (!codigo || !nome) { toast('Preencha código e nome', 'err'); return; }

  try {
    const camp = await api('GET', `/campeonatos/${codigo}`);
    st.campNome   = camp.nome;
    st.campCodigo = codigo;
    st.partNome   = nome;
    st.partTel    = tel;
    st.revelado   = camp.revelado;
    st.bebidas    = Array.from({ length: camp.qtd_bebidas }, (_, i) => '');
    setCtx(`${camp.nome}<br><small>${nome}</small>`);

    if (camp.revelado) {
      await verResultados();
    } else {
      renderVotacao(camp);
      ir('view-votacao');
    }
  } catch (e) { toast(e.message, 'err'); }
}

function renderVotacao(camp) {
  document.getElementById('vot-titulo').textContent = camp.nome;
  document.getElementById('vot-nome').textContent = 'Olá, ' + st.partNome + ' 👋';
  document.getElementById('vot-form').classList.remove('hidden');
  document.getElementById('vot-aguardando').classList.add('hidden');

  const campos = document.getElementById('vot-campos');
  campos.innerHTML = Array.from({ length: camp.qtd_bebidas }, (_, i) =>
    `<div class="vot-campo">
      <label>Bebida ${i + 1}</label>
      <input type="text" id="voto-${i}" placeholder="Qual você acha que é?" autocomplete="off" />
    </div>`
  ).join('');
}

async function enviarVotos() {
  const votos = Array.from({ length: st.bebidas.length }, (_, i) =>
    (document.getElementById('voto-' + i)?.value || '').trim()
  );
  if (votos.every(v => !v)) { toast('Preencha ao menos um voto', 'err'); return; }

  try {
    await api('POST', '/votos', { campeonato: st.campNome, nome: st.partNome, telefone: st.partTel, votos });
    toast('Votos enviados! 🎉', 'ok');
    document.getElementById('vot-form').classList.add('hidden');
    document.getElementById('vot-aguardando').classList.remove('hidden');
  } catch (e) { toast(e.message, 'err'); }
}

async function verResultados() {
  try {
    const data = await api('GET', `/resultados/${encodeURIComponent(st.campNome)}`);
    document.getElementById('res-titulo').textContent = st.campNome || 'Resultados';
    document.getElementById('res-back-btn').onclick = () => irHome();
    renderResultados('res-gabarito', 'res-ranking', data);
    ir('view-resultados');
  } catch (e) { toast('Resultados ainda não disponíveis', 'err'); }
}

// ── Admin: Login ──────────────────────────────────────────────────────────────
async function loginAdmin() {
  const nome  = document.getElementById('adm-camp-nome').value.trim();
  const senha = document.getElementById('adm-senha').value.trim();
  if (!nome || !senha) { toast('Preencha todos os campos', 'err'); return; }
  st.admSenha = senha;
  st.campNome = nome;
  await carregarPainel();
}

async function criarCampeonato() {
  const nome   = document.getElementById('c-nome').value.trim();
  const codigo = document.getElementById('c-codigo').value.trim().toUpperCase();
  const senha  = document.getElementById('c-senha').value.trim();
  const braw   = document.getElementById('c-bebidas').value.trim();
  if (!nome || !codigo || !senha || !braw) { toast('Preencha todos os campos', 'err'); return; }
  const bebidas = braw.split('\n').map(b => b.trim()).filter(Boolean);
  if (bebidas.length === 0) { toast('Adicione ao menos uma bebida', 'err'); return; }

  try {
    const r = await api('POST', '/campeonatos', { nome, codigo, senha, bebidas });
    toast('Campeonato criado! Código: ' + r.codigo, 'ok');
    st.campNome = nome;
    st.admSenha = senha;
    await carregarPainel();
  } catch (e) { toast(e.message, 'err'); }
}

// ── Admin: Painel ─────────────────────────────────────────────────────────────
async function carregarPainel() {
  try {
    const [votos] = await Promise.all([
      api('GET', `/votos/${encodeURIComponent(st.campNome)}`),
    ]);

    document.getElementById('adm-titulo').textContent = st.campNome;
    setCtx(`${st.campNome}<br><small>Admin</small>`);

    // info
    document.getElementById('adm-info').innerHTML =
      `<strong>${st.campNome}</strong><br>
       <span class="dim">${votos.length} participante(s)</span>`;

    // progresso
    const prog = document.getElementById('adm-prog');
    if (votos.length === 0) {
      prog.innerHTML = '<p class="dim">Nenhum participante ainda.</p>';
    } else {
      prog.innerHTML = votos.map(v => {
        const acertos = v['Acertos'] !== '' ? ` — ${v['Acertos']} acerto(s)` : '';
        return `<div class="prog-row"><strong>${v['Nome']}</strong>${acertos}</div>`;
      }).join('');
    }

    // gabarito (só admin vê)
    const gab = document.getElementById('adm-gabarito');
    gab.innerHTML = votos.length > 0
      ? `<p class="dim">Dados na planilha. Clique "Revelar" para calcular acertos.</p>`
      : `<p class="dim">Aguardando participantes.</p>`;

    ir('view-admin-painel');
  } catch (e) { toast(e.message, 'err'); }
}

async function recarregar() {
  await carregarPainel();
  toast('Atualizado', 'ok');
}

async function revelar() {
  if (!confirm('Revelar resultados agora? Os acertos serão calculados na planilha.')) return;
  try {
    const r = await api('POST', '/revelar', { campeonato: st.campNome, senha: st.admSenha });
    toast('Revelado! 🎭', 'ok');

    // mostrar ranking
    const res = await api('GET', `/resultados/${encodeURIComponent(st.campNome)}`);
    renderResultados('adm-gabarito', 'adm-ranking', res);
    document.getElementById('adm-resultados').classList.remove('hidden');
  } catch (e) { toast(e.message, 'err'); }
}

async function encerrar() {
  if (!confirm('Encerrar campeonato? Nenhum novo voto poderá ser registrado.')) return;
  try {
    await api('POST', '/encerrar', { campeonato: st.campNome, senha: st.admSenha });
    toast('Encerrado.', 'ok');
  } catch (e) { toast(e.message, 'err'); }
}

// ── Renderizar resultados ─────────────────────────────────────────────────────
function renderResultados(gabId, rankId, data) {
  // gabarito
  const gabEl = document.getElementById(gabId);
  gabEl.innerHTML = '<div class="gab-titulo">Gabarito:</div>' +
    data.bebidas.map((b, i) =>
      `<div class="gab-row"><span class="gab-num">${i + 1}</span>${b}</div>`
    ).join('');

  // ranking por acertos
  const votos = data.votos;
  const sorted = [...votos].sort((a, b) => (Number(b['Acertos']) || 0) - (Number(a['Acertos']) || 0));
  const total = data.bebidas.length;

  const rankEl = document.getElementById(rankId);
  rankEl.innerHTML = '<div class="rank-titulo">🏆 Ranking de acertos</div>' +
    sorted.map((v, i) => {
      const pts = v['Acertos'] !== '' ? Number(v['Acertos']) : '—';
      const pct = typeof pts === 'number' ? Math.round(pts / total * 100) : null;
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
      return `<div class="rank-row ${i === 0 ? 'rank-primeiro' : ''}">
        <span class="rank-pos">${medal}</span>
        <span class="rank-nome">${v['Nome']}</span>
        <span class="rank-pts">${pts}${pct !== null ? ` <small>(${pct}%)</small>` : ''}</span>
      </div>`;
    }).join('');
}
