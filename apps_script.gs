// ═══════════════════════════════════════════════════════════════
//  CEGÃO — Google Apps Script Webhook
//  Cole este código em: Extensões → Apps Script
//  Depois: Implantar → Nova implantação → App da Web
//    - Executar como: Eu
//    - Quem tem acesso: Qualquer pessoa
//  Copie a URL gerada e cole no arquivo .env do projeto.
// ═══════════════════════════════════════════════════════════════

const SS_ID       = '10lvKVXjp02_7jEr4oPraVQgx11E8-iRFaRjk2xh5qSw';
const ABA_VOTOS   = 'Votos';
const ABA_CAMPS   = 'Campeonatos';

// Cabeçalhos esperados
const HDR_VOTOS = ['Nome','Telefone','Campeonato','Voto 1','Voto 2','Voto 3','Voto 4','Voto 5','Voto 6','Voto 7','Voto 8','Voto 9','Voto 10','Voto 11','Voto 12','Voto 13','Voto 14','Voto 15','Acertos'];
const HDR_CAMPS = ['Nome','Codigo','Senha','Bebida 1','Bebida 2','Bebida 3','Bebida 4','Bebida 5','Bebida 6','Bebida 7','Bebida 8','Bebida 9','Bebida 10','Bebida 11','Bebida 12','Bebida 13','Bebida 14','Bebida 15','Status','Revelado'];

function _ss()   { return SpreadsheetApp.openById(SS_ID); }
function _json(o){ return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function _aba(nome, headers) {
  var ss = _ss();
  var ws = ss.getSheetByName(nome);
  if (!ws) {
    ws = ss.insertSheet(nome);
    ws.appendRow(headers);
  }
  return ws;
}

function _registros(ws) {
  var data = ws.getDataRange().getValues();
  if (data.length < 2) return [];
  var hdrs = data[0];
  return data.slice(1).map(function(row) {
    var obj = {};
    hdrs.forEach(function(h, i) { obj[h] = row[i]; });
    return obj;
  });
}

// ── GET ─────────────────────────────────────────────────────────
function doGet(e) {
  var p = e.parameter || {};
  var action = p.action;

  if (action === 'campeonatos') {
    var ws = _aba(ABA_CAMPS, HDR_CAMPS);
    var camps = _registros(ws).filter(function(c) { return c['Status'] !== 'encerrado'; });
    return _json(camps.map(function(c) {
      return { nome: c['Nome'], codigo: c['Codigo'], revelado: c['Revelado'] === 'SIM' };
    }));
  }

  if (action === 'campeonato') {
    var ws = _aba(ABA_CAMPS, HDR_CAMPS);
    var regs = _registros(ws);
    var camp = regs.find(function(c) { return c['Codigo'].toUpperCase() === (p.codigo||'').toUpperCase(); });
    if (!camp) return _json({ erro: 'Campeonato não encontrado' });
    var qtd = 0;
    for (var i = 1; i <= 15; i++) { if (camp['Bebida '+i]) qtd++; }
    return _json({ nome: camp['Nome'], codigo: camp['Codigo'], qtd_bebidas: qtd, revelado: camp['Revelado'] === 'SIM' });
  }

  if (action === 'votos') {
    var ws = _aba(ABA_VOTOS, HDR_VOTOS);
    var regs = _registros(ws);
    var camp = (p.campeonato||'').toLowerCase();
    return _json(regs.filter(function(r) { return (r['Campeonato']||'').toLowerCase() === camp; }));
  }

  if (action === 'resultados') {
    var wsCamps = _aba(ABA_CAMPS, HDR_CAMPS);
    var wsVotos = _aba(ABA_VOTOS, HDR_VOTOS);
    var campNome = (p.campeonato||'').toLowerCase();
    var camp = _registros(wsCamps).find(function(c) { return (c['Nome']||'').toLowerCase() === campNome; });
    if (!camp) return _json({ erro: 'Campeonato não encontrado' });
    if (camp['Revelado'] !== 'SIM') return _json({ erro: 'Ainda não revelado' });
    var votos = _registros(wsVotos).filter(function(r) { return (r['Campeonato']||'').toLowerCase() === campNome; });
    var bebidas = [];
    for (var i = 1; i <= 15; i++) { if (camp['Bebida '+i]) bebidas.push(camp['Bebida '+i]); }
    return _json({ bebidas: bebidas, votos: votos });
  }

  return _json({ ok: true, msg: 'Cegão API online' });
}

// ── POST ─────────────────────────────────────────────────────────
function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var action = data.action;

  // Criar campeonato
  if (action === 'criar_campeonato') {
    var ws = _aba(ABA_CAMPS, HDR_CAMPS);
    var regs = _registros(ws);
    var jaExiste = regs.find(function(c) { return c['Codigo'].toUpperCase() === (data.codigo||'').toUpperCase(); });
    if (jaExiste) return _json({ erro: 'Código já em uso' });
    var row = [data.nome, (data.codigo||'').toUpperCase(), data.senha];
    for (var i = 1; i <= 15; i++) { row.push((data.bebidas && data.bebidas[i-1]) ? data.bebidas[i-1] : ''); }
    row.push('ativo', 'NAO');
    ws.appendRow(row);
    return _json({ ok: true, nome: data.nome, codigo: (data.codigo||'').toUpperCase() });
  }

  // Registrar voto
  if (action === 'votar') {
    var wsCamps = _aba(ABA_CAMPS, HDR_CAMPS);
    var wsVotos = _aba(ABA_VOTOS, HDR_VOTOS);
    var camp = _registros(wsCamps).find(function(c) { return (c['Nome']||'').toLowerCase() === (data.campeonato||'').toLowerCase(); });
    if (!camp) return _json({ erro: 'Campeonato não encontrado' });
    if (camp['Status'] === 'encerrado') return _json({ erro: 'Campeonato encerrado' });

    // Verificar se já votou
    var todosVotos = _registros(wsVotos);
    var jaVotou = todosVotos.find(function(v) {
      return (v['Campeonato']||'').toLowerCase() === (data.campeonato||'').toLowerCase()
          && (v['Nome']||'').toLowerCase() === (data.nome||'').toLowerCase();
    });

    var row = [data.nome, data.telefone || '', data.campeonato];
    for (var i = 1; i <= 15; i++) { row.push((data.votos && data.votos[i-1]) ? data.votos[i-1] : ''); }
    row.push(''); // Acertos calculado depois

    if (jaVotou) {
      // Atualizar linha existente
      var allData = wsVotos.getDataRange().getValues();
      for (var r = 1; r < allData.length; r++) {
        if ((allData[r][0]||'').toLowerCase() === (data.nome||'').toLowerCase()
            && (allData[r][2]||'').toLowerCase() === (data.campeonato||'').toLowerCase()) {
          wsVotos.getRange(r+1, 1, 1, row.length).setValues([row]);
          break;
        }
      }
      return _json({ ok: true, atualizado: true });
    } else {
      wsVotos.appendRow(row);
      return _json({ ok: true, atualizado: false });
    }
  }

  // Revelar resultados
  if (action === 'revelar') {
    var wsCamps = _aba(ABA_CAMPS, HDR_CAMPS);
    var wsVotos = _aba(ABA_VOTOS, HDR_VOTOS);
    var hdrs = wsCamps.getRange(1, 1, 1, wsCamps.getLastColumn()).getValues()[0];
    var allCamps = wsCamps.getDataRange().getValues();
    var campRow = -1;
    var camp = null;
    for (var r = 1; r < allCamps.length; r++) {
      if ((allCamps[r][hdrs.indexOf('Nome')]||'').toLowerCase() === (data.campeonato||'').toLowerCase()) {
        camp = {};
        hdrs.forEach(function(h,i) { camp[h] = allCamps[r][i]; });
        if (camp['Senha'] !== data.senha) return _json({ erro: 'Senha incorreta' });
        campRow = r + 1;
        break;
      }
    }
    if (!camp) return _json({ erro: 'Campeonato não encontrado' });

    // Resposta correta
    var respostas = [];
    for (var i = 1; i <= 15; i++) { if (camp['Bebida '+i]) respostas.push((camp['Bebida '+i]||'').toLowerCase()); }

    // Calcular acertos para cada participante
    var allVotos = wsVotos.getDataRange().getValues();
    var votosHdrs = allVotos[0];
    for (var r = 1; r < allVotos.length; r++) {
      var campNomeVoto = (allVotos[r][votosHdrs.indexOf('Campeonato')]||'').toLowerCase();
      if (campNomeVoto !== (data.campeonato||'').toLowerCase()) continue;
      var acertos = 0;
      for (var i = 1; i <= respostas.length; i++) {
        var voto = (allVotos[r][votosHdrs.indexOf('Voto '+i)]||'').toLowerCase().trim();
        if (voto && voto === respostas[i-1].trim()) acertos++;
      }
      wsVotos.getRange(r+1, votosHdrs.indexOf('Acertos')+1).setValue(acertos);
    }

    // Marcar como revelado
    wsCamps.getRange(campRow, hdrs.indexOf('Revelado')+1).setValue('SIM');

    return _json({ ok: true, respostas: respostas });
  }

  // Encerrar campeonato
  if (action === 'encerrar') {
    var wsCamps = _aba(ABA_CAMPS, HDR_CAMPS);
    var hdrs = wsCamps.getRange(1, 1, 1, wsCamps.getLastColumn()).getValues()[0];
    var allCamps = wsCamps.getDataRange().getValues();
    for (var r = 1; r < allCamps.length; r++) {
      var c = {};
      hdrs.forEach(function(h,i) { c[h] = allCamps[r][i]; });
      if ((c['Nome']||'').toLowerCase() === (data.campeonato||'').toLowerCase()) {
        if (c['Senha'] !== data.senha) return _json({ erro: 'Senha incorreta' });
        wsCamps.getRange(r+1, hdrs.indexOf('Status')+1).setValue('encerrado');
        return _json({ ok: true });
      }
    }
    return _json({ erro: 'Campeonato não encontrado' });
  }

  return _json({ erro: 'Ação desconhecida: ' + action });
}
