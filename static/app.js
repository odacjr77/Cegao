// ── Estado ────────────────────────────────────────────────────────────────────
const st = {
  nome: '', tel: '', isAdmin: false,
  campNome: '', campQtd: 0, campBebidas: [], campRevelado: false,
  votos: [],        // string[], indexados por posição (0-based)
  enviado: false,
};

// ── Navegação ─────────────────────────────────────────────────────────────────
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0, 0);
}

function voltarP1() {
  Object.assign(st, {
    nome:'', tel:'', isAdmin:false,
    campNome:'', campQtd:0, campBebidas:[], campRevelado:false,
    votos:[], enviado:false,
  });
  showPage('p1');
}

function voltarP2() {
  showPage('p2');
}

// ── Toast ─────────────────────────────────────────────────────────────────────
let _tt;
function toast(msg, tipo = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast' + (tipo ? ' ' + tipo : '');
  clearTimeout(_tt);
  _tt = setTimeout(() => el.classList.add('hidden'), 3000);
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

// ── P1: Entrada ───────────────────────────────────────────────────────────────
async function entrar() {
  const nome = document.getElementById('ent-nome').value.trim();
  const tel  = document.getElementById('ent-tel').value.trim();
  if (!nome) { toast('Informe seu nome', 'err'); return; }

  const btn = document.querySelector('.p1-btn');
  btn.textContent = '...';
  btn.disabled = true;

  try {
    const r = await api('POST', '/entrar', { nome, telefone: tel });
    st.nome    = nome;
    st.tel     = tel;
    st.isAdmin = r.admin;

    document.getElementById('topbar-user').innerHTML =
      `Olá, <strong>${nome}</strong>${r.admin ? ' &nbsp;·&nbsp; 🎯 Admin' : ''}`;

    renderP2(r.campeonatos);
    showPage('p2');
  } catch(e) {
    toast(e.message, 'err');
  } finally {
    btn.innerHTML = '<span>Entrar</span><svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/></svg>';
    btn.disabled = false;
  }
}

// ── P2: Lista de campeonatos ───────────────────────────────────────────────────
function renderP2(camps) {
  const el = document.getElementById('p2-list');

  if (!camps || camps.length === 0) {
    el.innerHTML = `
      <div class="p2-empty">
        <div class="p2-empty-icon">🍶</div>
        Nenhum campeonato disponível no momento.<br>Aguarde o administrador criar um.
      </div>`;
    return;
  }

  el.innerHTML = camps.map(c => {
    const status = c.revelado ? 'Ver resultado 🏆' : `${c.qtd_bebidas} bebida${c.qtd_bebidas !== 1 ? 's' : ''}`;
    const icon   = c.revelado ? '🏆' : '🫙';
    return `<div class="camp-card ${c.revelado ? 'camp-card-done' : ''}"
                 onclick='abrirCamp(${JSON.stringify(c)})'>
      <div class="camp-icon">${icon}</div>
      <div class="camp-info">
        <div class="camp-nome">${c.nome}</div>
        <div class="camp-meta">${status}</div>
      </div>
      <div class="camp-arrow">
        <svg viewBox="0 0 24 24" width="16" height="16"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg>
      </div>
    </div>`;
  }).join('');
}

// ── P3: Votação ───────────────────────────────────────────────────────────────
async function abrirCamp(camp) {
  st.campNome     = camp.nome;
  st.campQtd      = camp.qtd_bebidas;
  st.campBebidas  = camp.bebidas || [];
  st.campRevelado = camp.revelado;
  st.votos        = new Array(camp.qtd_bebidas).fill('');
  st.enviado      = false;

  document.getElementById('topbar-camp').textContent = camp.nome;

  // Esconder estados alternativos
  document.getElementById('p3-inner').classList.remove('hidden');
  document.getElementById('p3-aguardo').classList.add('hidden');
  document.getElementById('p3-resultado').classList.add('hidden');

  // Carregar votos existentes
  try {
    const todos = await api('GET', `/votos/${encodeURIComponent(camp.nome)}`);
    const meu   = todos.find(v => (v['Nome']||'').toLowerCase() === st.nome.toLowerCase());
    if (meu) {
      for (let i = 0; i < camp.qtd_bebidas; i++) {
        st.votos[i] = meu['Voto ' + (i + 1)] || '';
      }
      if (st.votos.some(v => v)) st.enviado = true;
    }
  } catch(e) { /* segue sem pré-preencher */ }

  // Exibir estado correto
  if (camp.revelado) {
    await mostrarResultados();
  } else if (st.enviado) {
    mostrarAguardo();
  } else {
    renderCamposVoto();
  }

  showPage('p3');
}

function renderCamposVoto() {
  document.getElementById('p3-inner').classList.remove('hidden');
  document.getElementById('p3-aguardo').classList.add('hidden');
  document.getElementById('p3-resultado').classList.add('hidden');

  const el = document.getElementById('p3-campos');
  el.innerHTML = Array.from({ length: st.campQtd }, (_, i) => {
    const label = String.fromCharCode(65 + i); // A, B, C...
    return `<div class="p3-campo${st.votos[i] ? ' salvo' : ''}" id="campo-${i}">
      <div class="p3-num">${label}</div>
      <div class="p3-campo-inner">
        <div class="p3-campo-label">Bebida ${label} — o que você acha?</div>
        <input type="text" placeholder="Digite o nome..."
               value="${escHtml(st.votos[i])}"
               oninput="onVotoInput(${i}, this.value)"
               onblur="salvarVoto(${i})"
               autocomplete="off" />
      </div>
      <span class="p3-check">✓</span>
    </div>`;
  }).join('');
}

function escHtml(s) {
  return (s || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
}

function onVotoInput(i, val) {
  st.votos[i] = val;
  const campo = document.getElementById('campo-' + i);
  if (val.trim()) {
    campo.classList.add('salvo');
  } else {
    campo.classList.remove('salvo');
  }
}

let _saveTimers = {};
async function salvarVoto(i) {
  const bebida = (st.votos[i] || '').trim();
  clearTimeout(_saveTimers[i]);
  if (!bebida) return;

  try {
    await api('POST', '/votos', {
      campeonato: st.campNome,
      nome: st.nome,
      telefone: st.tel,
      indice: i + 1,
      bebida,
    });
  } catch(e) {
    toast('Erro ao salvar voto ' + (i+1), 'err');
  }
}

async function enviarTodos() {
  const preenchidos = st.votos.filter(v => v.trim()).length;
  if (preenchidos === 0) {
    toast('Preencha ao menos um palpite', 'err');
    return;
  }

  const btn = document.getElementById('btn-enviar');
  btn.textContent = 'Enviando...';
  btn.disabled = true;

  let ok = 0;
  for (let i = 0; i < st.campQtd; i++) {
    const bebida = (st.votos[i] || '').trim();
    if (!bebida) continue;
    try {
      await api('POST', '/votos', {
        campeonato: st.campNome,
        nome: st.nome,
        telefone: st.tel,
        indice: i + 1,
        bebida,
      });
      ok++;
    } catch(e) { /* tenta todos */ }
  }

  btn.textContent = 'Enviar votos';
  btn.disabled = false;

  if (ok > 0) {
    st.enviado = true;
    toast(`${ok} voto${ok !== 1 ? 's' : ''} registrado${ok !== 1 ? 's' : ''}!`, 'ok');
    mostrarAguardo();
  } else {
    toast('Erro ao registrar votos', 'err');
  }
}

function mostrarAguardo() {
  document.getElementById('p3-inner').classList.add('hidden');
  document.getElementById('p3-aguardo').classList.remove('hidden');
  document.getElementById('p3-resultado').classList.add('hidden');
}

async function checarResultados() {
  try {
    const data = await api('GET', `/resultados/${encodeURIComponent(st.campNome)}`);
    renderResultados(data);
  } catch(e) {
    toast('Resultado ainda não disponível', 'err');
  }
}

async function mostrarResultados() {
  try {
    const data = await api('GET', `/resultados/${encodeURIComponent(st.campNome)}`);
    renderResultados(data);
  } catch(e) {
    mostrarAguardo();
  }
}

function renderResultados(data) {
  document.getElementById('p3-inner').classList.add('hidden');
  document.getElementById('p3-aguardo').classList.add('hidden');
  document.getElementById('p3-resultado').classList.remove('hidden');

  // Gabarito
  const gabEl = document.getElementById('res-gab');
  gabEl.innerHTML = `
    <div class="res-gab-titulo">Gabarito</div>
    ${data.bebidas.map((b, i) => {
      const letra = String.fromCharCode(65 + i);
      return `<div class="res-gab-row">
        <span class="res-gab-num">${letra}</span>
        <span class="res-gab-nome">${b}</span>
      </div>`;
    }).join('')}
  `;

  // Ranking
  const total  = data.bebidas.length;
  const sorted = [...data.votos].sort((a, b) => (Number(b['Acertos'])||0) - (Number(a['Acertos'])||0));
  const medals = ['🥇','🥈','🥉'];

  const rankEl = document.getElementById('res-rank');
  rankEl.innerHTML = `
    <div class="res-rank-titulo">Ranking de acertos</div>
    ${sorted.map((v, i) => {
      const pts   = v['Acertos'] !== '' ? Number(v['Acertos']) : null;
      const label = pts !== null ? pts : '—';
      const pct   = pts !== null ? `<small>/${total}</small>` : '';
      const medal = medals[i] || `#${i+1}`;
      return `<div class="res-row ${i===0?'primeiro':''}">
        <span class="res-pos">${medal}</span>
        <span class="res-nome">${v['Nome']}</span>
        <span class="res-pts">${label}${pct}</span>
      </div>`;
    }).join('')}
  `;
}

// ── Enter para submeter P1 ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  ['ent-nome','ent-tel'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') entrar(); });
  });
});
