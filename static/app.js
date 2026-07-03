// ── Configuração ──────────────────────────────────────────────────────────────
const AS_URL = 'https://script.google.com/macros/s/AKfycbxoTMAQZCsOhJb4pFPdkTT2Z1PcmbUro_Rc5iYWkjPbc7uKDVXYi7LjI-1xrISrJsIO/exec';

// GET → Apps Script (leitura)
async function asGet(params) {
  const url = AS_URL + '?' + new URLSearchParams(params).toString();
  const res  = await fetch(url, { redirect: 'follow' });
  const data = await res.json();
  if (data && data.erro) throw new Error(data.erro);
  return data;
}

// POST → Apps Script (escrita).
// Usa Content-Type: text/plain para evitar preflight CORS;
// o Apps Script lê via e.postData.contents e faz JSON.parse normalmente.
async function asPost(body) {
  const res  = await fetch(AS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(body),
    redirect: 'follow',
  });
  const data = await res.json();
  if (data && data.erro) throw new Error(data.erro);
  return data;
}

// ── Estado ────────────────────────────────────────────────────────────────────
const st = {
  nome: '', tel: '', isAdmin: false,
  camps: [],
  campNome: '', campQtd: 0, campBebidas: [], campRevelado: false,
  votos: [],
};

// ── Navegação ─────────────────────────────────────────────────────────────────
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0, 0);
}

function voltarP1() {
  Object.assign(st, {
    nome: '', tel: '', isAdmin: false, camps: [],
    campNome: '', campQtd: 0, campBebidas: [], campRevelado: false, votos: [],
  });
  showPage('p1');
}

function voltarP2() { showPage('p2'); }

// ── Toast ─────────────────────────────────────────────────────────────────────
let _tt;
function toast(msg, tipo = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast' + (tipo ? ' ' + tipo : '');
  clearTimeout(_tt);
  _tt = setTimeout(() => el.classList.add('hidden'), 3000);
}

function escHtml(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

// ── P1: Entrada ───────────────────────────────────────────────────────────────
async function entrar() {
  const nome = document.getElementById('ent-nome').value.trim();
  const tel  = document.getElementById('ent-tel').value.trim();
  if (!nome) { toast('Informe seu nome', 'err'); return; }

  const btn = document.querySelector('.p1-btn');
  btn.innerHTML = '<span>Entrando...</span>';
  btn.disabled  = true;

  try {
    const [adminR, camps] = await Promise.all([
      tel ? asGet({ action: 'verificar', telefone: tel }) : Promise.resolve({ admin: false }),
      asGet({ action: 'campeonatos' }),
    ]);

    st.nome    = nome;
    st.tel     = tel;
    st.isAdmin = adminR.admin || false;

    document.getElementById('topbar-user').innerHTML =
      `Olá, <strong>${escHtml(nome)}</strong>${st.isAdmin ? ' &nbsp;·&nbsp; 🎯 Admin' : ''}`;

    renderP2(camps);
    showPage('p2');
  } catch(e) {
    toast(e.message || 'Erro de conexão', 'err');
  } finally {
    btn.innerHTML = '<span>Entrar</span><svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/></svg>';
    btn.disabled = false;
  }
}

// ── P2: Lista de campeonatos ──────────────────────────────────────────────────
function renderP2(camps) {
  st.camps = camps || [];
  const el  = document.getElementById('p2-list');

  if (st.camps.length === 0) {
    el.innerHTML = `
      <div class="p2-empty">
        <div class="p2-empty-icon">🍶</div>
        Nenhum campeonato disponível no momento.<br>Aguarde o administrador criar um.
      </div>`;
    return;
  }

  el.innerHTML = st.camps.map((c, i) => {
    const status = c.revelado ? 'Ver resultado 🏆' : `${c.qtd_bebidas} bebida${c.qtd_bebidas !== 1 ? 's' : ''}`;
    const icon   = c.revelado ? '🏆' : '🫙';
    return `<div class="camp-card ${c.revelado ? 'camp-card-done' : ''}" onclick="abrirCamp(${i})">
      <div class="camp-icon">${icon}</div>
      <div class="camp-info">
        <div class="camp-nome">${escHtml(c.nome)}</div>
        <div class="camp-meta">${status}</div>
      </div>
      <div class="camp-arrow">
        <svg viewBox="0 0 24 24" width="16" height="16"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg>
      </div>
    </div>`;
  }).join('');
}

// ── P3: Votação ───────────────────────────────────────────────────────────────
async function abrirCamp(i) {
  const camp = st.camps[i];
  if (!camp) return;

  st.campNome     = camp.nome;
  st.campQtd      = camp.qtd_bebidas;
  st.campBebidas  = camp.bebidas || [];
  st.campRevelado = camp.revelado;
  st.votos        = new Array(camp.qtd_bebidas).fill('');

  document.getElementById('topbar-camp').textContent = camp.nome;

  try {
    const todos = await asGet({ action: 'votos', campeonato: camp.nome });
    const meu   = todos.find(v => (v['Nome']||'').toLowerCase() === st.nome.toLowerCase());
    if (meu) {
      for (let idx = 0; idx < camp.qtd_bebidas; idx++) {
        st.votos[idx] = meu['Voto ' + (idx + 1)] || '';
      }
    }
  } catch(e) { /* segue sem pré-preencher */ }

  if (camp.revelado) {
    await mostrarResultados();
  } else {
    renderCamposVoto();
  }

  showPage('p3');
}

function renderCamposVoto() {
  document.getElementById('p3-inner').classList.remove('hidden');
  document.getElementById('p3-resultado').classList.add('hidden');

  const opcoes = [...st.campBebidas].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const el     = document.getElementById('p3-campos');

  el.innerHTML = Array.from({ length: st.campQtd }, (_, i) => {
    const letra  = String.fromCharCode(65 + i); // A, B, C...
    const atual  = st.votos[i] || '';
    const opts   = ['<option value="">— escolha —</option>']
      .concat(opcoes.map(b => `<option value="${escHtml(b)}"${b === atual ? ' selected' : ''}>${escHtml(b)}</option>`));
    return `<div class="p3-campo${atual ? ' salvo' : ''}" id="campo-${i}">
      <div class="p3-num">${letra}</div>
      <div class="p3-campo-inner">
        <div class="p3-campo-label">Bebida ${letra} — qual você acha que é?</div>
        <select onchange="salvarVoto(${i}, this.value)">${opts.join('')}</select>
      </div>
      <span class="p3-check">✓</span>
    </div>`;
  }).join('');
}

async function salvarVoto(i, bebida) {
  st.votos[i] = bebida;
  document.getElementById('campo-' + i).classList.toggle('salvo', !!bebida);

  try {
    await asPost({
      action:     'votar',
      campeonato: st.campNome,
      nome:       st.nome,
      telefone:   st.tel,
      indice:     i + 1,
      bebida,
    });
    toast('Voto salvo ✓', 'ok');
  } catch(e) {
    toast('Erro ao salvar voto ' + String.fromCharCode(65 + i), 'err');
  }
}

// Botão "Ver resultados"
async function checarResultados() {
  try {
    const data = await asGet({ action: 'resultados', campeonato: st.campNome });
    renderResultados(data);
  } catch(e) {
    toast('Resultado ainda não disponível', 'err');
  }
}

async function mostrarResultados() {
  try {
    const data = await asGet({ action: 'resultados', campeonato: st.campNome });
    renderResultados(data);
  } catch(e) {
    renderCamposVoto();
  }
}

function renderResultados(data) {
  document.getElementById('p3-inner').classList.add('hidden');
  document.getElementById('p3-resultado').classList.remove('hidden');
  document.getElementById('res-titulo').textContent = st.campNome;

  const gabEl = document.getElementById('res-gab');
  gabEl.innerHTML = `
    <div class="res-gab-titulo">Gabarito</div>
    ${data.bebidas.map((b, i) => `
      <div class="res-gab-row">
        <span class="res-gab-num">${String.fromCharCode(65 + i)}</span>
        <span class="res-gab-nome">${escHtml(b)}</span>
      </div>`).join('')}`;

  const total  = data.bebidas.length;
  const sorted = [...data.votos].sort((a, b) => (Number(b['Acertos'])||0) - (Number(a['Acertos'])||0));
  const medals = ['🥇','🥈','🥉'];

  document.getElementById('res-rank').innerHTML = `
    <div class="res-rank-titulo">Ranking de acertos</div>
    ${sorted.map((v, i) => {
      const pts   = v['Acertos'] !== '' ? Number(v['Acertos']) : null;
      const label = pts !== null ? pts : '—';
      const pct   = pts !== null ? `<small>/${total}</small>` : '';
      const medal = medals[i] || `#${i + 1}`;
      return `<div class="res-row ${i === 0 ? 'primeiro' : ''}">
        <span class="res-pos">${medal}</span>
        <span class="res-nome">${escHtml(v['Nome'])}</span>
        <span class="res-pts">${label}${pct}</span>
      </div>`;
    }).join('')}`;
}

// ── Admin: criar campeonato ───────────────────────────────────────────────────
// (chamado via fluxo admin — a ser definido)
async function criarCampeonato(nome, bebidas) {
  return asPost({ action: 'criar_campeonato', telefone: st.tel, nome, bebidas });
}

async function revelarResultados(campeonato) {
  return asPost({ action: 'revelar', telefone: st.tel, campeonato });
}

async function encerrarCampeonato(campeonato) {
  return asPost({ action: 'encerrar', telefone: st.tel, campeonato });
}

// ── Enter para submeter no P1 ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  ['ent-nome', 'ent-tel'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') entrar(); });
  });
});
