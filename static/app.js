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
  campNome: '', campQtd: 0, campTotal: 0, campBebidas: [], campRevelado: false,
  votos: [],
  adminCamps: [],
  editCampNome: '', editBebidas: [], editLiberadas: 0,
};

let _pollLiberadas = null;

// ── Navegação ─────────────────────────────────────────────────────────────────
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => {
    p.classList.remove('active');
    p.style.display = 'none';
  });
  const el = document.getElementById(id);
  if (el) {
    el.classList.add('active');
    el.style.display = 'block';
  }
  window.scrollTo(0, 0);
  salvarNavegacao(id);
}

// Guarda em qual tela o usuário está (e em qual campeonato), pra sobreviver
// a um refresh (F5) do navegador. Fica em sessionStorage — some ao fechar a aba.
function salvarNavegacao(pagina) {
  try {
    sessionStorage.setItem('cegao_nav', JSON.stringify({
      pagina,
      campNome:     st.campNome     || '',
      editCampNome: st.editCampNome || '',
    }));
  } catch(_) {}
}

function voltarP1() {
  clearInterval(_pollLiberadas);
  Object.assign(st, {
    nome: '', tel: '', isAdmin: false, camps: [],
    campNome: '', campQtd: 0, campTotal: 0, campBebidas: [], campRevelado: false, votos: [],
    adminCamps: [], editCampNome: '', editBebidas: [], editLiberadas: 0,
  });
  showPage('p1');
}

function voltarP2() {
  clearInterval(_pollLiberadas);
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

function escHtml(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

// ── P1: Entrada ───────────────────────────────────────────────────────────────
async function entrar() {
  const nome = document.getElementById('ent-nome').value.trim();
  const tel  = document.getElementById('ent-tel').value.trim();
  if (!nome) { toast('Informe seu nome', 'err'); return; }

  st.nome = nome;
  st.tel  = tel;

  document.getElementById('topbar-user').innerHTML = `Olá, <strong>${escHtml(nome)}</strong>`;
  document.getElementById('p2-list').innerHTML = `
    <div class="p2-empty">
      <div class="p2-empty-icon">⏳</div>
      Carregando campeonatos...
    </div>`;
  showPage('p2');

  // Carrega dados em segundo plano
  try {
    const [adminR, camps] = await Promise.all([
      tel ? asGet({ action: 'verificar', telefone: tel }) : Promise.resolve({ admin: false }),
      asGet({ action: 'campeonatos' }),
    ]);

    st.isAdmin = adminR.admin || false;

    try { localStorage.setItem('cegao_nome', nome); localStorage.setItem('cegao_tel', tel); } catch(_) {}

    if (st.isAdmin) {
      document.getElementById('pa-menu-user').innerHTML = `Olá, <strong>${escHtml(nome)}</strong>`;
      showPage('pa-menu');
    } else {
      renderP2(camps);
    }
  } catch(e) {
    document.getElementById('p2-list').innerHTML = `
      <div class="p2-empty">
        <div class="p2-empty-icon">⚠️</div>
        Erro ao carregar: ${escHtml(e.message || 'Verifique sua conexão')}<br><br>
        <button class="agu-btn" onclick="voltarP1()">Tentar de novo</button>
      </div>`;
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
    const status = c.revelado ? 'Ver resultado 🏆' : `${c.liberadas || 0}/${c.qtd_bebidas} liberada${c.qtd_bebidas !== 1 ? 's' : ''}`;
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
  clearInterval(_pollLiberadas);

  const camp = st.camps[i];
  if (!camp) return;

  st.campNome     = camp.nome;
  st.campQtd      = camp.liberadas || 0;   // slots visíveis agora
  st.campTotal    = camp.qtd_bebidas;      // total configurado pelo admin
  st.campBebidas  = camp.bebidas || [];
  st.campRevelado = camp.revelado;
  st.votos        = new Array(camp.qtd_bebidas).fill('');

  document.getElementById('topbar-camp').textContent = camp.nome;

  // Registra participante (ou atualiza timestamp se já entrou antes)
  asPost({ action: 'registrar_participante', nome: st.nome, telefone: st.tel, campeonato: camp.nome })
    .catch(() => {});

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
    _pollLiberadas = setInterval(verificarNovasBebidas, 7000);
  }

  showPage('p3');
}

// Verifica periodicamente se o admin liberou mais bebidas ou revelou o
// resultado, e avisa o participante sem precisar recarregar a página.
async function verificarNovasBebidas() {
  await checarAtualizacaoVotacao(false);
}

// Botão "↻ Atualizar" na tela de votação — mesma checagem, mas manual,
// então sempre dá algum feedback (mesmo quando não há novidade).
async function atualizarVotacao() {
  const btn = document.getElementById('btn-atualizar');
  if (btn) { btn.disabled = true; btn.classList.add('girando'); }
  await checarAtualizacaoVotacao(true);
  if (btn) { btn.disabled = false; btn.classList.remove('girando'); }
}

async function checarAtualizacaoVotacao(manual) {
  try {
    const camps = await asGet({ action: 'campeonatos' });
    const atual = camps.find(c => c.nome === st.campNome);
    if (!atual) { if (manual) toast('Campeonato não encontrado', 'err'); return; }

    if (atual.revelado) {
      clearInterval(_pollLiberadas);
      st.campRevelado = true;
      await mostrarResultados();
      return;
    }

    const liberadas = atual.liberadas || 0;
    if (liberadas > st.campQtd) {
      st.campQtd     = liberadas;
      st.campBebidas = atual.bebidas || [];
      renderCamposVoto();
      toast(`🍾 Nova bebida liberada! Já dá pra votar na Bebida ${liberadas}.`, 'ok');
    } else if (manual) {
      toast('Nenhuma bebida nova por enquanto', '');
    }
  } catch(e) {
    if (manual) toast('Erro ao verificar atualizações', 'err');
  }
}

function renderCamposVoto() {
  document.getElementById('p3-inner').classList.remove('hidden');
  document.getElementById('p3-resultado').classList.add('hidden');

  const el = document.getElementById('p3-campos');
  if (st.campQtd === 0) {
    el.innerHTML = `<div class="p2-empty">
      <div class="p2-empty-icon">⏳</div>
      Aguardando o administrador liberar a primeira bebida...
    </div>`;
    return;
  }

  const opcoes = [...st.campBebidas].sort((a, b) => a.localeCompare(b, 'pt-BR'));

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
    clearInterval(_pollLiberadas);
    renderResultados(data);
  } catch(e) {
    toast('Resultado ainda não disponível', 'err');
  }
}

async function mostrarResultados() {
  try {
    const data = await asGet({ action: 'resultados', campeonato: st.campNome });
    clearInterval(_pollLiberadas);
    renderResultados(data);
  } catch(e) {
    renderCamposVoto();
  }
}

let _resAnimId = 0;

function renderResultados(data) {
  document.getElementById('p3-inner').classList.add('hidden');
  document.getElementById('p3-resultado').classList.remove('hidden');
  document.getElementById('res-titulo').textContent = st.campNome;

  const bebidas       = data.bebidas || [];
  const participantes = data.votos   || [];
  const total         = bebidas.length;

  // Gabarito completo e imediato — todos votos já visíveis
  const meu = participantes.find(v => (v['Nome']||'').toLowerCase() === st.nome.toLowerCase()) || {};
  document.getElementById('res-gab').innerHTML = `
    <div class="res-gab-titulo">Gabarito</div>
    <div class="res-gab-header">
      <span></span>
      <span class="res-gab-col">Bebida real</span>
      <span class="res-gab-col">Seu palpite</span>
    </div>
    ${bebidas.map((b, i) => {
      const letra   = String.fromCharCode(65 + i);
      const voto    = meu['Voto ' + (i + 1)] || '';
      const acertou = voto && voto.toLowerCase().trim() === b.toLowerCase().trim();
      return `<div class="res-gab-row">
        <span class="res-gab-num">${letra}</span>
        <span class="res-gab-nome">${escHtml(b)}</span>
        <span class="res-gab-voto ${voto ? (acertou ? 'acerto' : 'erro') : ''}">${escHtml(voto || '—')}${voto ? (acertou ? ' ✓' : ' ✗') : ''}</span>
      </div>`;
    }).join('')}`;

  // Ranking começa zerado em ordem alfabética — vai se reordenando bebida a bebida
  const ordemInicial = participantes
    .map((_, idx) => idx)
    .sort((a, b) => (participantes[a]['Nome']||'').localeCompare(participantes[b]['Nome']||'', 'pt-BR'));

  document.getElementById('res-rank').innerHTML =
    '<div class="res-rank-titulo" id="res-rank-label">Preparando...</div>' +
    '<div class="res-rank-rows" id="res-rank-rows">' +
    participantes.map((v, idx) => {
      const souEu = (v['Nome']||'').toLowerCase() === st.nome.toLowerCase();
      const pos   = ordemInicial.indexOf(idx) + 1;
      return `<div class="res-row${souEu ? ' eu' : ''}" id="res-row-${idx}" style="order:${pos}">
        <span class="res-pos" id="res-pos-${idx}">#${pos}</span>
        <span class="res-nome">${escHtml(v['Nome'])}</span>
        <span class="res-pts" id="res-pts-${idx}">0<small>/${total}</small></span>
      </div>`;
    }).join('') +
    '</div>';

  animarRevelacao(bebidas, participantes, total);
}

// Vai bebida a bebida atualizando o ranking (sobe/desce) com animação FLIP real.
async function animarRevelacao(bebidas, participantes, total) {
  const meuId  = ++_resAnimId;
  const scores = participantes.map(() => 0);
  const medals = ['🥇', '🥈', '🥉'];

  await new Promise(r => setTimeout(r, 700));

  for (let step = 0; step < total; step++) {
    const labelEl = document.getElementById('res-rank-label');
    const rowsEl  = document.getElementById('res-rank-rows');
    if (meuId !== _resAnimId || !rowsEl) return;

    const letra    = String.fromCharCode(65 + step);
    const resposta = (bebidas[step] || '').toLowerCase().trim();
    if (labelEl) labelEl.textContent = `Bebida ${letra}...`;

    // Calcula quem acertou esta bebida
    const acertaram = [];
    participantes.forEach((v, idx) => {
      const voto = (v['Voto ' + (step + 1)] || '').toLowerCase().trim();
      if (voto && voto === resposta) { scores[idx]++; acertaram.push(idx); }
    });

    // Flash verde nos acertadores
    acertaram.forEach(idx => {
      const el = document.getElementById('res-row-' + idx);
      if (!el) return;
      el.classList.remove('flash');
      void el.offsetHeight; // força repintura para re-triggar a animação CSS
      el.classList.add('flash');
    });

    await new Promise(r => setTimeout(r, 550));
    if (meuId !== _resAnimId || !document.getElementById('res-rank-rows')) return;

    // Nova ordenação por pontuação
    const novaOrdem = participantes
      .map((_, idx) => idx)
      .sort((a, b) => scores[b] - scores[a] ||
        (participantes[a]['Nome']||'').localeCompare(participantes[b]['Nome']||'', 'pt-BR'));

    const linhas = participantes.map((_, idx) => document.getElementById('res-row-' + idx));

    // FLIP: mede posições ANTES de mudar a ordem
    const antes = linhas.map(el => el ? el.getBoundingClientRect() : null);

    // Aplica nova ordem e atualiza medalhas/pontos
    novaOrdem.forEach((idx, pos) => {
      const el = linhas[idx]; if (!el) return;
      el.style.order = pos + 1;
      el.classList.toggle('primeiro', pos === 0);
      const posEl = document.getElementById('res-pos-' + idx);
      const ptsEl = document.getElementById('res-pts-' + idx);
      if (posEl) posEl.textContent = medals[pos] || ('#' + (pos + 1));
      if (ptsEl) ptsEl.innerHTML   = `${scores[idx]}<small>/${total}</small>`;
    });

    // Força reflow para o browser calcular as novas posições
    void rowsEl.offsetHeight;

    // FLIP: translada cada linha de volta ao ponto de origem e anima até a posição nova
    linhas.forEach((el, idx) => {
      if (!el || !antes[idx]) return;
      const deltaY = antes[idx].top - el.getBoundingClientRect().top;
      if (!deltaY) return;
      el.style.transition = 'none';
      el.style.transform  = `translateY(${deltaY}px)`;
      // Duplo RAF: garante que o estado inicial foi pintado antes de iniciar a transição
      requestAnimationFrame(() => requestAnimationFrame(() => {
        el.style.transition = 'transform .45s ease';
        el.style.transform  = '';
      }));
    });

    if (step === total - 1 && labelEl) {
      setTimeout(() => { if (labelEl) labelEl.textContent = 'Resultado final 🏆'; }, 500);
    }

    await new Promise(r => setTimeout(r, 1300));
  }
}

// ── Admin: chamadas ao Apps Script ────────────────────────────────────────────
async function criarCampeonato(nome, bebidas) {
  return asPost({ action: 'criar_campeonato', telefone: st.tel, nome, bebidas });
}

async function revelarResultados(campeonato) {
  return asPost({ action: 'revelar', telefone: st.tel, campeonato });
}

async function encerrarCampeonato(campeonato) {
  return asPost({ action: 'encerrar', telefone: st.tel, campeonato });
}

async function salvarBebidasApi(campeonato, bebidas) {
  return asPost({ action: 'salvar_bebidas', telefone: st.tel, campeonato, bebidas });
}

async function atualizarLiberadasApi(campeonato, liberadas) {
  return asPost({ action: 'atualizar_liberadas', telefone: st.tel, campeonato, liberadas });
}

// ── Admin: menu ───────────────────────────────────────────────────────────────
async function abrirGerenciarCampeonatos() {
  showPage('pa-camps');
  document.getElementById('pa-camps-list').innerHTML = `
    <div class="p2-empty"><div class="p2-empty-icon">⏳</div>Carregando...</div>`;
  try {
    const camps = await asGet({ action: 'admin_campeonatos', telefone: st.tel });
    st.adminCamps = camps;
    renderAdminCampsList(camps);
  } catch(e) {
    document.getElementById('pa-camps-list').innerHTML = `
      <div class="p2-empty"><div class="p2-empty-icon">⚠️</div>${escHtml(e.message)}</div>`;
  }
}

function renderAdminCampsList(camps) {
  const el = document.getElementById('pa-camps-list');
  if (!camps || camps.length === 0) {
    el.innerHTML = `
      <div class="p2-empty">
        <div class="p2-empty-icon">🗂️</div>
        Nenhum campeonato ainda.<br>Crie o primeiro acima.
      </div>`;
    return;
  }

  el.innerHTML = camps.map((c, i) => {
    const encerrado = c.status === 'encerrado';
    const statusTxt = encerrado ? 'Encerrado' : (c.revelado ? 'Revelado 🏆' : `${c.liberadas}/${c.qtd_bebidas} liberadas`);
    const icon      = encerrado ? '🔒' : (c.revelado ? '🏆' : '🍾');
    return `<div class="camp-card" onclick="abrirEditarCampeonato(${i})">
      <div class="camp-icon">${icon}</div>
      <div class="camp-info">
        <div class="camp-nome">${escHtml(c.nome)}</div>
        <div class="camp-meta">${statusTxt}</div>
      </div>
      <div class="camp-arrow">
        <svg viewBox="0 0 24 24" width="16" height="16"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg>
      </div>
    </div>`;
  }).join('');
}

function voltarGerenciarCampeonatos() {
  abrirGerenciarCampeonatos();
}

// ── Admin: criar campeonato ───────────────────────────────────────────────────
function abrirNovoCampeonato() {
  document.getElementById('pa-novo-nome').value = '';
  showPage('pa-novo');
}

async function criarCampeonatoAdmin() {
  const nome = document.getElementById('pa-novo-nome').value.trim();
  if (!nome) { toast('Informe o nome do campeonato', 'err'); return; }
  try {
    await criarCampeonato(nome, []);
    toast('Campeonato criado!', 'ok');
    await abrirGerenciarCampeonatos();
  } catch(e) { toast(e.message, 'err'); }
}

// ── Admin: editar / executar campeonato ───────────────────────────────────────
async function abrirEditarCampeonato(i) {
  const camp = st.adminCamps[i];
  if (!camp) return;

  st.editCampNome = camp.nome;
  document.getElementById('pa-editar-titulo').textContent = camp.nome;
  showPage('pa-editar');

  try {
    const d = await asGet({ action: 'admin_campeonato', telefone: st.tel, campeonato: camp.nome });
    st.editBebidas   = d.bebidas || [];
    st.editLiberadas = d.liberadas || 0;
    renderBebidasEdit();
    atualizarLiberadasUI();
  } catch(e) { toast(e.message, 'err'); }
}

// Mostra os slots já preenchidos + sempre um campo vazio a mais (até o máx. de 15)
function renderBebidasEdit() {
  const bebidas = st.editBebidas.slice(0, 15);
  while (bebidas.length < 15 && (bebidas.length === 0 || bebidas[bebidas.length - 1])) {
    bebidas.push('');
  }
  st.editBebidas = bebidas;

  const el = document.getElementById('pa-bebidas-campos');
  el.innerHTML = bebidas.map((b, i) => `
    <div class="pa-bebida-campo">
      <span class="pa-bebida-num">${i + 1}</span>
      <input type="text" placeholder="Nome da bebida" value="${escHtml(b)}"
             oninput="st.editBebidas[${i}] = this.value" />
    </div>`).join('');
}

async function salvarBebidas() {
  const bebidas = st.editBebidas.map(b => (b || '').trim()).filter(Boolean).slice(0, 15);
  try {
    await salvarBebidasApi(st.editCampNome, bebidas);
    toast('Bebidas salvas ✓', 'ok');
    const d = await asGet({ action: 'admin_campeonato', telefone: st.tel, campeonato: st.editCampNome });
    st.editBebidas   = d.bebidas || [];
    st.editLiberadas = d.liberadas || 0;
    renderBebidasEdit();
    atualizarLiberadasUI();
  } catch(e) { toast(e.message, 'err'); }
}

// ── Admin: executar campeonato (liberar bebidas) ──────────────────────────────
function atualizarLiberadasUI() {
  const total = st.editBebidas.filter(b => b && b.trim()).length;
  document.getElementById('pa-liberadas-total').textContent = total;
  document.getElementById('pa-liberadas-atual').textContent = st.editLiberadas;
}

function mudarLiberadas(delta) {
  const total = st.editBebidas.filter(b => b && b.trim()).length;
  st.editLiberadas = Math.max(0, Math.min(total, st.editLiberadas + delta));
  document.getElementById('pa-liberadas-atual').textContent = st.editLiberadas;
}

async function salvarLiberadas() {
  try {
    const r = await atualizarLiberadasApi(st.editCampNome, st.editLiberadas);
    st.editLiberadas = r.liberadas;
    atualizarLiberadasUI();
    toast(`Liberado até a bebida ${r.liberadas} — participantes já podem votar!`, 'ok');
  } catch(e) { toast(e.message, 'err'); }
}

// ── Admin: revelar / encerrar ──────────────────────────────────────────────────
async function revelarAdmin() {
  if (!confirm('Revelar resultados agora? Os acertos serão calculados e todos poderão ver.')) return;
  try {
    await revelarResultados(st.editCampNome);
    toast('Revelado! 🎭', 'ok');
  } catch(e) { toast(e.message, 'err'); }
}

async function encerrarAdmin() {
  if (!confirm('Encerrar campeonato? Nenhum novo voto poderá ser registrado.')) return;
  try {
    await encerrarCampeonato(st.editCampNome);
    toast('Encerrado.', 'ok');
    await abrirGerenciarCampeonatos();
  } catch(e) { toast(e.message, 'err'); }
}

// ── Restaura a tela em que o usuário estava antes do refresh ──────────────────
async function restaurarNavegacao(nomeSalvo, telSalvo) {
  let nav = null;
  try { nav = JSON.parse(sessionStorage.getItem('cegao_nav') || 'null'); } catch(_) {}
  if (!nav || !nav.pagina || nav.pagina === 'p1' || !nomeSalvo) return;

  st.nome = nomeSalvo;
  st.tel  = telSalvo || '';

  const paginasAdmin = ['pa-menu', 'pa-camps', 'pa-novo', 'pa-editar'];

  try {
    if (paginasAdmin.includes(nav.pagina)) {
      const adminR = st.tel ? await asGet({ action: 'verificar', telefone: st.tel }) : { admin: false };
      if (!adminR.admin) return; // não é mais admin — fica na tela inicial
      st.isAdmin = true;
      document.getElementById('pa-menu-user').innerHTML = `Olá, <strong>${escHtml(nomeSalvo)}</strong>`;

      if (nav.pagina === 'pa-editar' && nav.editCampNome) {
        const camps = await asGet({ action: 'admin_campeonatos', telefone: st.tel });
        st.adminCamps = camps;
        const idx = camps.findIndex(c => c.nome === nav.editCampNome);
        if (idx >= 0) { await abrirEditarCampeonato(idx); return; }
        await abrirGerenciarCampeonatos();
      } else if (nav.pagina === 'pa-camps' || nav.pagina === 'pa-novo') {
        await abrirGerenciarCampeonatos();
      } else {
        showPage('pa-menu');
      }
      return;
    }

    // Fluxo participante (p2 / p3)
    document.getElementById('topbar-user').innerHTML = `Olá, <strong>${escHtml(nomeSalvo)}</strong>`;
    const camps = await asGet({ action: 'campeonatos' });
    st.camps = camps;

    if (nav.pagina === 'p3' && nav.campNome) {
      const idx = camps.findIndex(c => c.nome === nav.campNome);
      if (idx >= 0) { await abrirCamp(idx); return; }
    }
    renderP2(camps);
    showPage('p2');
  } catch(e) {
    // Se der erro ao restaurar, fica na tela inicial mesmo — não trava o app.
  }
}

// ── Enter para submeter no P1 ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const nomeEl = document.getElementById('ent-nome');
  const telEl  = document.getElementById('ent-tel');

  let nomeSalvo = '', telSalvo = '';
  try {
    nomeSalvo = localStorage.getItem('cegao_nome') || '';
    telSalvo  = localStorage.getItem('cegao_tel')  || '';
    if (nomeSalvo) nomeEl.value = nomeSalvo;
    if (telSalvo)  telEl.value  = telSalvo;
  } catch(_) {}

  [nomeEl, telEl].forEach(el => {
    if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') entrar(); });
  });

  restaurarNavegacao(nomeSalvo, telSalvo);
});
