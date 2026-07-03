// ── Estado global ─────────────────────────────────────────────────────────────
let estado = {
  campId:     null,
  campNome:   null,
  partNome:   null,
  adminSenha: null,
  meuVotos:   {},
  bebidas:    [],
  modalBebida: null,
  notaSelecionada: null,
};

// ── Navegação ─────────────────────────────────────────────────────────────────
function mostrarView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function irParaInicio() {
  estado = { campId: null, campNome: null, partNome: null, adminSenha: null, meuVotos: {}, bebidas: [], modalBebida: null, notaSelecionada: null };
  atualizarHeaderInfo();
  mostrarView('view-home');
}

function irParaParticipante() {
  mostrarView('view-participante-login');
}

function irParaAdmin() {
  mostrarView('view-admin-login');
}

function atualizarHeaderInfo() {
  const el = document.getElementById('header-info');
  if (estado.campNome && estado.partNome) {
    el.innerHTML = `${estado.campNome}<br><small>${estado.partNome}</small>`;
    el.classList.remove('hidden');
  } else if (estado.campNome && estado.adminSenha) {
    el.innerHTML = `${estado.campNome}<br><small>Admin</small>`;
    el.classList.remove('hidden');
  } else {
    el.classList.add('hidden');
  }
}

// ── Toast ─────────────────────────────────────────────────────────────────────
let _toastTimer;
function toast(msg, tipo = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast' + (tipo ? ' ' + tipo : '');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.add('hidden'), 3000);
}

// ── API fetch helper ──────────────────────────────────────────────────────────
async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch('/api' + path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Erro desconhecido');
  return data;
}

// ── Participante: entrar ──────────────────────────────────────────────────────
async function entrarCampeonato() {
  const codigo = document.getElementById('p-codigo').value.trim().toUpperCase();
  const nome   = document.getElementById('p-nome').value.trim();
  if (!codigo || !nome) { toast('Preencha todos os campos', 'err'); return; }
  try {
    const data = await api('POST', '/entrar', { codigo_acesso: codigo, nome });
    estado.campId   = data.camp_id;
    estado.campNome = data.camp_nome;
    estado.partNome = data.participante.nome;
    atualizarHeaderInfo();
    document.getElementById('vot-camp-nome').textContent = data.camp_nome;
    document.getElementById('vot-participante-nome').textContent = 'Olá, ' + data.participante.nome + ' 👋';
    if (data.revelado === 'TRUE') {
      await carregarResultadosPublicos();
    } else {
      await carregarVotacao();
    }
  } catch (e) { toast(e.message, 'err'); }
}

async function carregarVotacao() {
  try {
    const [bebidas, votos] = await Promise.all([
      api('GET', `/bebidas/${estado.campId}`),
      api('GET', `/votos/${estado.campId}/${encodeURIComponent(estado.partNome)}`),
    ]);
    estado.bebidas = bebidas;
    estado.meuVotos = {};
    for (const v of votos) {
      estado.meuVotos[v.Bebida_Codigo] = { nota: v.Nota, comentario: v.Comentario };
    }
    renderizarBebidas();
    mostrarView('view-votacao');
  } catch (e) { toast(e.message, 'err'); }
}

function renderizarBebidas() {
  const grid = document.getElementById('lista-bebidas');
  const agu  = document.getElementById('aguardando');
  const totalBebidas = estado.bebidas.length;
  const totalVotados = Object.keys(estado.meuVotos).length;

  if (totalBebidas > 0 && totalVotados >= totalBebidas) {
    grid.classList.add('hidden');
    agu.classList.remove('hidden');
    return;
  }

  agu.classList.add('hidden');
  grid.classList.remove('hidden');
  grid.innerHTML = estado.bebidas.map(b => {
    const voto = estado.meuVotos[b.codigo];
    const votada = !!voto;
    const badge  = votada ? `<span class="bebida-nota-badge">${voto.nota}/10</span>` : '';
    const hint   = votada ? '✓ Votado' : 'Toque para votar';
    const desc   = b.descricao ? `<div class="bebida-desc">${b.descricao}</div>` : '';
    return `<div class="bebida-card ${votada ? 'votada' : ''}" onclick="abrirModal('${b.codigo}')">
      ${badge}
      <div class="bebida-codigo">${b.codigo}</div>
      <div class="bebida-hint">${hint}</div>
      ${desc}
    </div>`;
  }).join('');
}

// ── Modal de voto ─────────────────────────────────────────────────────────────
function abrirModal(codigo) {
  estado.modalBebida = codigo;
  const voto = estado.meuVotos[codigo];
  estado.notaSelecionada = voto ? voto.nota : null;
  document.getElementById('modal-bebida-tag').textContent = 'Bebida ' + codigo;
  document.getElementById('modal-comentario').value = voto ? voto.comentario : '';
  renderizarStars();
  document.getElementById('modal-voto').classList.remove('hidden');
}

function fecharModal() {
  document.getElementById('modal-voto').classList.add('hidden');
  estado.modalBebida = null;
}

function renderizarStars() {
  const row = document.getElementById('star-row');
  const nota = estado.notaSelecionada;
  row.innerHTML = Array.from({ length: 10 }, (_, i) => {
    const n = i + 1;
    const on = nota && n <= nota ? 'on' : '';
    return `<button class="star-btn ${on}" onclick="selecionarNota(${n})">⭐</button>`;
  }).join('');
  document.getElementById('nota-num').textContent = nota || '—';
}

function selecionarNota(n) {
  estado.notaSelecionada = n;
  renderizarStars();
}

async function enviarVoto() {
  if (!estado.notaSelecionada) { toast('Selecione uma nota', 'err'); return; }
  const comentario = document.getElementById('modal-comentario').value.trim();
  try {
    await api('POST', '/votos', {
      camp_id: estado.campId,
      participante_nome: estado.partNome,
      bebida_codigo: estado.modalBebida,
      nota: estado.notaSelecionada,
      comentario,
    });
    estado.meuVotos[estado.modalBebida] = { nota: estado.notaSelecionada, comentario };
    toast('Voto registrado!', 'ok');
    fecharModal();
    renderizarBebidas();
  } catch (e) { toast(e.message, 'err'); }
}

// ── Resultados públicos ───────────────────────────────────────────────────────
async function carregarResultadosPublicos() {
  try {
    const resultados = await api('GET', `/resultados/${estado.campId}`);
    renderizarResultados('resultados-lista', resultados);
    mostrarView('view-resultados');
  } catch (e) { toast(e.message, 'err'); }
}

function renderizarResultados(containerId, resultados) {
  const el = document.getElementById(containerId);
  el.innerHTML = resultados.map((r, i) => {
    const classe = i === 0 ? 'primeiro' : i === resultados.length - 1 ? 'ultimo' : '';
    const emoji  = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
    const coms = r.comentarios.length
      ? `<div class="res-comentarios">${r.comentarios.map(c => `<div class="res-comentario">"${c}"</div>`).join('')}</div>`
      : '';
    return `<div class="resultado-card ${classe}">
      <div class="res-rank">${emoji}</div>
      <div class="res-body">
        <div class="res-nome">${r.nome_real}</div>
        ${r.descricao ? `<div class="res-desc">${r.descricao}</div>` : ''}
        <div class="res-score">${r.media}</div>
        <div class="res-votos">${r.total_votos} voto(s)</div>
        ${coms}
      </div>
    </div>`;
  }).join('');
}

// ── Admin: tabs ───────────────────────────────────────────────────────────────
function switchAdminTab(btn) {
  document.querySelectorAll('.tab-s').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-panel-s').forEach(p => { p.classList.remove('active'); p.style.display = 'none'; });
  btn.classList.add('active');
  const panel = document.getElementById('tab-' + btn.dataset.tab);
  panel.classList.add('active');
  panel.style.display = 'flex';
}

// ── Admin: login ──────────────────────────────────────────────────────────────
async function loginAdmin() {
  const campId = document.getElementById('a-camp-id').value.trim();
  const senha  = document.getElementById('a-senha').value.trim();
  if (!campId || !senha) { toast('Preencha todos os campos', 'err'); return; }
  try {
    await carregarPainelAdmin(campId, senha);
  } catch (e) { toast(e.message, 'err'); }
}

async function criarCampeonato() {
  const nome   = document.getElementById('c-nome').value.trim();
  const codigo = document.getElementById('c-codigo').value.trim().toUpperCase();
  const senha  = document.getElementById('c-senha').value.trim();
  if (!nome || !codigo || !senha) { toast('Preencha todos os campos', 'err'); return; }
  try {
    const data = await api('POST', '/campeonatos', { nome, codigo_acesso: codigo, admin_senha: senha });
    toast('Campeonato criado! ID: ' + data.id, 'ok');
    await carregarPainelAdmin(data.id, senha);
  } catch (e) { toast(e.message, 'err'); }
}

async function carregarPainelAdmin(campId, senha) {
  const data = await api('POST', '/campeonatos/admin', { camp_id: campId, admin_senha: senha });
  estado.campId   = campId;
  estado.campNome = data.campeonato.nome;
  estado.adminSenha = senha;
  atualizarHeaderInfo();
  renderizarPainelAdmin(data);
  mostrarView('view-admin-painel');
}

async function recarregarAdmin() {
  try {
    const data = await api('POST', '/campeonatos/admin', { camp_id: estado.campId, admin_senha: estado.adminSenha });
    renderizarPainelAdmin(data);
    toast('Atualizado', 'ok');
  } catch (e) { toast(e.message, 'err'); }
}

function renderizarPainelAdmin(data) {
  const camp = data.campeonato;
  document.getElementById('adm-camp-nome').textContent = camp.nome;
  document.getElementById('adm-meta').innerHTML =
    `ID: <strong>${estado.campId}</strong> &nbsp;·&nbsp; Código de acesso: <strong>${camp.codigo_acesso || '—'}</strong><br>` +
    `Status: <strong>${camp.status}</strong> &nbsp;·&nbsp; Revelado: <strong>${camp.revelado === 'TRUE' ? 'Sim' : 'Não'}</strong>`;

  // bebidas
  const bebidasEl = document.getElementById('adm-bebidas-lista');
  const bebidas = data.bebidas || [];
  bebidasEl.innerHTML = bebidas.length === 0
    ? '<p style="color:var(--muted);font-size:0.82rem">Nenhuma bebida adicionada.</p>'
    : bebidas.map(b => `<div class="adm-bebida-row">
        <div class="adm-bebida-codigo">${b.Codigo}</div>
        <div class="adm-bebida-info">
          <div class="adm-bebida-nome">${b.Nome_Real}</div>
          ${b.Descricao ? `<div class="adm-bebida-desc-text">${b.Descricao}</div>` : ''}
        </div>
        <button class="btn-rm" title="Remover" onclick="removerBebida('${b.Codigo}')">✕</button>
      </div>`).join('');

  // participantes
  const partEl = document.getElementById('adm-participantes');
  const prog   = data.participantes || {};
  const nomes  = Object.keys(prog);
  partEl.innerHTML = nomes.length === 0
    ? '<p style="color:var(--muted);font-size:0.82rem">Nenhum participante ainda.</p>'
    : nomes.map(nome => {
        const p = prog[nome];
        const chips = p.completo
          ? '<span class="chip chip-all">✓ Todos votados</span>'
          : [
              ...p.votou.map(c => `<span class="chip chip-ok">${c} ✓</span>`),
              ...p.faltam.map(c => `<span class="chip chip-pend">${c} …</span>`),
            ].join('');
        return `<div class="adm-part-row">
          <div class="adm-part-nome">${nome}</div>
          <div class="adm-part-chips">${chips}</div>
        </div>`;
      }).join('');
}

// ── Admin: bebidas ────────────────────────────────────────────────────────────
function toggleFormBebida() {
  const f = document.getElementById('form-bebida');
  f.classList.toggle('hidden');
}

async function adicionarBebida() {
  const nome = document.getElementById('adm-bebida-nome').value.trim();
  const desc = document.getElementById('adm-bebida-desc').value.trim();
  if (!nome) { toast('Informe o nome da bebida', 'err'); return; }
  try {
    const b = await api('POST', '/bebidas', { camp_id: estado.campId, admin_senha: estado.adminSenha, nome_real: nome, descricao: desc });
    toast(`Bebida ${b.codigo} adicionada`, 'ok');
    document.getElementById('adm-bebida-nome').value = '';
    document.getElementById('adm-bebida-desc').value = '';
    recarregarAdmin();
  } catch (e) { toast(e.message, 'err'); }
}

async function removerBebida(codigo) {
  if (!confirm(`Remover bebida ${codigo}?`)) return;
  try {
    await api('DELETE', '/bebidas', { camp_id: estado.campId, admin_senha: estado.adminSenha, codigo });
    toast('Bebida removida', 'ok');
    recarregarAdmin();
  } catch (e) { toast(e.message, 'err'); }
}

// ── Admin: revelar / encerrar ─────────────────────────────────────────────────
async function revelarResultados() {
  if (!confirm('Revelar os resultados agora? Todos os participantes poderão ver os nomes reais.')) return;
  try {
    const resultados = await api('POST', '/campeonatos/revelar', { camp_id: estado.campId, admin_senha: estado.adminSenha });
    document.getElementById('adm-resultados').classList.remove('hidden');
    renderizarResultados('adm-resultados-lista', resultados);
    toast('Resultados revelados!', 'ok');
    recarregarAdmin();
  } catch (e) { toast(e.message, 'err'); }
}

async function encerrarCampeonato() {
  if (!confirm('Encerrar o campeonato? Nenhum novo voto poderá ser registrado.')) return;
  try {
    await api('POST', '/campeonatos/encerrar', { camp_id: estado.campId, admin_senha: estado.adminSenha });
    toast('Campeonato encerrado', 'ok');
    recarregarAdmin();
  } catch (e) { toast(e.message, 'err'); }
}

// ── Fechar modal ao clicar fora ───────────────────────────────────────────────
document.getElementById('modal-voto').addEventListener('click', function(e) {
  if (e.target === this) fecharModal();
});
