// ═══════════════════════════════════════════════════════════════
//  CEGÃO — Google Apps Script Webhook  (v3)
//  Cole em: Extensões → Apps Script → Implantar → Gerenciar implantações
//    Tipo: App da Web | Executar como: Eu | Acesso: Qualquer pessoa
// ═══════════════════════════════════════════════════════════════

var SS_ID      = '10lvKVXjp02_7jEr4oPraVQgx11E8-iRFaRjk2xh5qSw';
var ABA_ADM    = 'Administradores';
var ABA_CAMPS  = 'Campeonatos';
var ABA_VOTOS  = 'Votos';
var ABA_PARTIC = 'Participantes';

// Cabeçalhos esperados para novas abas
var HDR_CAMPS  = ['Campeonato','Bebida 1','Bebida 2','Bebida 3','Bebida 4','Bebida 5',
                  'Bebida 6','Bebida 7','Bebida 8','Bebida 9','Bebida 10',
                  'Bebida 11','Bebida 12','Bebida 13','Bebida 14','Bebida 15',
                  'Status','Revelado','Liberadas'];
var HDR_VOTOS  = ['Nome','Telefone','Campeonato',
                  'Voto 1','Voto 2','Voto 3','Voto 4','Voto 5',
                  'Voto 6','Voto 7','Voto 8','Voto 9','Voto 10',
                  'Voto 11','Voto 12','Voto 13','Voto 14','Voto 15','Acertos'];
var HDR_PARTIC = ['Nome','Telefone','Campeonato','Entrada'];

// ── Helpers base ──────────────────────────────────────────────────────────────
function ss_()    { return SpreadsheetApp.openById(SS_ID); }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function aba_(nomeAba, hdrs) {
  var ss = ss_();
  var ws = ss.getSheetByName(nomeAba);
  if (!ws) { ws = ss.insertSheet(nomeAba); ws.appendRow(hdrs); return ws; }
  garantirColunas_(ws, hdrs);
  return ws;
}

function garantirColunas_(ws, hdrs) {
  var lastCol = ws.getLastColumn();
  var atuais  = lastCol > 0 ? ws.getRange(1, 1, 1, lastCol).getValues()[0] : [];
  var faltando = hdrs.filter(function(h) { return h && atuais.indexOf(h) === -1; });
  if (faltando.length) ws.getRange(1, lastCol + 1, 1, faltando.length).setValues([faltando]);
}

function rows_(ws) {
  var data = ws.getDataRange().getValues();
  if (data.length < 2) return [];
  var h = data[0];
  return data.slice(1).map(function(r) {
    var o = {}; h.forEach(function(k, i) { o[k] = r[i]; }); return o;
  });
}

function tel_(t) { return String(t || '').replace(/\D/g, ''); }

// ── Helpers para campeonatos (suporta coluna "Campeonato" ou "Nome") ──────────
// Retorna o nome do campeonato de uma linha, aceitando ambos os formatos
function campNome_(c) { return c['Campeonato'] || c['Nome'] || ''; }

// Retorna o número de bebidas liberadas
function campLib_(c) {
  return parseInt(c['Liberadas'] || c['Quais bebidas estao abertas para voto'] || 0, 10) || 0;
}

// Retorna o índice da coluna de nome do campeonato nos headers
function colNomeCamp_(hdrs) {
  var i = hdrs.indexOf('Campeonato');
  if (i >= 0) return i;
  return hdrs.indexOf('Nome');
}

// Busca campeonato por nome (case-insensitive, aceita ambas as colunas)
function findCamp_(ws, campeonatoNome) {
  var target = (campeonatoNome || '').toLowerCase();
  return rows_(ws).find(function(c) {
    return campNome_(c).toLowerCase() === target;
  });
}

// ── Admin ─────────────────────────────────────────────────────────────────────
function isAdmin_(telefone) {
  if (!telefone) return false;
  var t = tel_(telefone);
  if (!t) return false;
  var ws = ss_().getSheetByName(ABA_ADM);
  if (!ws) return false;
  var data = ws.getDataRange().getValues();
  for (var r = 1; r < data.length; r++)
    for (var c = 0; c < data[r].length; c++)
      if (tel_(data[r][c]) === t) return true;
  return false;
}

// ── GET ───────────────────────────────────────────────────────────────────────
function doGet(e) {
  var p = e.parameter || {};

  // Verificar se é admin
  if (p.action === 'verificar') {
    return json_({ admin: isAdmin_(p.telefone) });
  }

  // Listar campeonatos ativos (participante)
  if (p.action === 'campeonatos') {
    var ws    = aba_(ABA_CAMPS, HDR_CAMPS);
    var camps = rows_(ws).filter(function(c) { return c['Status'] !== 'encerrado'; });
    return json_(camps.map(function(c) {
      var bebidas = [];
      for (var i = 1; i <= 15; i++) if (c['Bebida ' + i]) bebidas.push(c['Bebida ' + i]);
      var lib = campLib_(c);
      if (lib > bebidas.length) lib = bebidas.length;
      return {
        nome:       campNome_(c),
        qtd_bebidas: bebidas.length,
        liberadas:  lib,
        bebidas:    bebidas,
        revelado:   c['Revelado'] === 'SIM'
      };
    }));
  }

  // Listar TODOS os campeonatos (admin)
  if (p.action === 'admin_campeonatos') {
    if (!isAdmin_(p.telefone)) return json_({ erro: 'Não autorizado' });
    var ws = aba_(ABA_CAMPS, HDR_CAMPS);
    return json_(rows_(ws).map(function(c) {
      var bebidas = [];
      for (var i = 1; i <= 15; i++) if (c['Bebida ' + i]) bebidas.push(c['Bebida ' + i]);
      return {
        nome:       campNome_(c),
        qtd_bebidas: bebidas.length,
        liberadas:  campLib_(c),
        revelado:   c['Revelado'] === 'SIM',
        status:     c['Status']
      };
    }));
  }

  // Detalhe de um campeonato (admin)
  if (p.action === 'admin_campeonato') {
    if (!isAdmin_(p.telefone)) return json_({ erro: 'Não autorizado' });
    var ws   = aba_(ABA_CAMPS, HDR_CAMPS);
    var camp = findCamp_(ws, p.campeonato);
    if (!camp) return json_({ erro: 'Campeonato não encontrado' });
    var bebidas = [];
    for (var i = 1; i <= 15; i++) bebidas.push(camp['Bebida ' + i] || '');
    return json_({
      nome:      campNome_(camp),
      bebidas:   bebidas,
      liberadas: campLib_(camp),
      revelado:  camp['Revelado'] === 'SIM',
      status:    camp['Status']
    });
  }

  // Votos de um campeonato
  if (p.action === 'votos') {
    var ws  = aba_(ABA_VOTOS, HDR_VOTOS);
    var low = (p.campeonato || '').toLowerCase();
    return json_(rows_(ws).filter(function(r) { return (r['Campeonato'] || '').toLowerCase() === low; }));
  }

  // Participantes de um campeonato
  if (p.action === 'participantes') {
    var ws  = aba_(ABA_PARTIC, HDR_PARTIC);
    var low = (p.campeonato || '').toLowerCase();
    return json_(rows_(ws).filter(function(r) { return (r['Campeonato'] || '').toLowerCase() === low; }));
  }

  // Resultados (só após revelação)
  if (p.action === 'resultados') {
    var wsCamps = aba_(ABA_CAMPS, HDR_CAMPS);
    var wsVotos = aba_(ABA_VOTOS, HDR_VOTOS);
    var low     = (p.campeonato || '').toLowerCase();
    var camp    = findCamp_(wsCamps, p.campeonato);
    if (!camp)                   return json_({ erro: 'Campeonato não encontrado' });
    if (camp['Revelado'] !== 'SIM') return json_({ erro: 'Ainda não revelado' });
    var bebidas = [];
    for (var i = 1; i <= 15; i++) if (camp['Bebida ' + i]) bebidas.push(camp['Bebida ' + i]);
    var votos = rows_(wsVotos).filter(function(r) { return (r['Campeonato'] || '').toLowerCase() === low; });
    return json_({ bebidas: bebidas, votos: votos });
  }

  // Debug
  if (p.action === 'debug') {
    var ss      = ss_();
    var abas    = ss.getSheets().map(function(ws) { return ws.getName(); });
    var admWs   = ss.getSheetByName(ABA_ADM);
    var admData = admWs ? admWs.getDataRange().getValues() : 'aba não encontrada';
    var campWs  = ss.getSheetByName(ABA_CAMPS);
    var campData = campWs
      ? campWs.getRange(1, 1, Math.min(3, campWs.getLastRow()), campWs.getLastColumn()).getValues()
      : 'aba não encontrada';
    return json_({ abas: abas, administradores: admData, campeonatos_amostra: campData });
  }

  return json_({ ok: true });
}

// ── POST ──────────────────────────────────────────────────────────────────────
function doPost(e) {
  var d = JSON.parse(e.postData.contents);

  // Registrar participante ao entrar num campeonato
  if (d.action === 'registrar_participante') {
    var ws      = aba_(ABA_PARTIC, HDR_PARTIC);
    var nomeLow = (d.nome || '').toLowerCase();
    var campLow = (d.campeonato || '').toLowerCase();
    var all     = ws.getDataRange().getValues();
    var hdrs    = all[0];
    var colN    = hdrs.indexOf('Nome');
    var colC    = hdrs.indexOf('Campeonato');
    var colE    = hdrs.indexOf('Entrada');

    for (var r = 1; r < all.length; r++) {
      if ((all[r][colN] || '').toLowerCase() === nomeLow &&
          (all[r][colC] || '').toLowerCase() === campLow) {
        ws.getRange(r + 1, colE + 1).setValue(new Date());
        return json_({ ok: true });
      }
    }
    var row = hdrs.map(function(h) {
      if (h === 'Nome')      return d.nome || '';
      if (h === 'Telefone')  return d.telefone || '';
      if (h === 'Campeonato') return d.campeonato || '';
      if (h === 'Entrada')   return new Date();
      return '';
    });
    ws.appendRow(row);
    return json_({ ok: true });
  }

  // Criar campeonato (admin)
  if (d.action === 'criar_campeonato') {
    if (!isAdmin_(d.telefone)) return json_({ erro: 'Não autorizado' });
    var ws = aba_(ABA_CAMPS, HDR_CAMPS);
    var jaExiste = !!findCamp_(ws, d.nome);
    if (jaExiste) return json_({ erro: 'Já existe um campeonato com este nome' });
    var hdrs = ws.getRange(1, 1, 1, ws.getLastColumn()).getValues()[0];
    var row  = hdrs.map(function(h) {
      if (h === 'Campeonato' || h === 'Nome') return d.nome;
      var m = /^Bebida (\d+)$/.exec(h);
      if (m) { var idx = parseInt(m[1], 10); return (d.bebidas && d.bebidas[idx - 1]) ? d.bebidas[idx - 1] : ''; }
      if (h === 'Status')    return 'ativo';
      if (h === 'Revelado')  return 'NAO';
      if (h === 'Liberadas') return 0;
      return '';
    });
    ws.appendRow(row);
    return json_({ ok: true, nome: d.nome });
  }

  // Editar bebidas (admin)
  if (d.action === 'salvar_bebidas') {
    if (!isAdmin_(d.telefone)) return json_({ erro: 'Não autorizado' });
    var ws      = aba_(ABA_CAMPS, HDR_CAMPS);
    var all     = ws.getDataRange().getValues();
    var hdrs    = all[0];
    var colNome = colNomeCamp_(hdrs);
    var target  = (d.campeonato || '').toLowerCase();

    for (var r = 1; r < all.length; r++) {
      if ((all[r][colNome] || '').toLowerCase() !== target) continue;
      var bebidas = (d.bebidas || []).slice(0, 15);
      for (var i = 1; i <= 15; i++)
        ws.getRange(r + 1, hdrs.indexOf('Bebida ' + i) + 1).setValue(bebidas[i - 1] || '');
      var colLib = hdrs.indexOf('Liberadas');
      if (colLib >= 0) {
        var libAtual = parseInt(all[r][colLib], 10) || 0;
        if (libAtual > bebidas.length) ws.getRange(r + 1, colLib + 1).setValue(bebidas.length);
      }
      return json_({ ok: true });
    }
    return json_({ erro: 'Campeonato não encontrado' });
  }

  // Atualizar bebidas liberadas (admin)
  if (d.action === 'atualizar_liberadas') {
    if (!isAdmin_(d.telefone)) return json_({ erro: 'Não autorizado' });
    var ws     = aba_(ABA_CAMPS, HDR_CAMPS);
    var all    = ws.getDataRange().getValues();
    var hdrs   = all[0];
    var colNome = colNomeCamp_(hdrs);
    var target  = (d.campeonato || '').toLowerCase();

    for (var r = 1; r < all.length; r++) {
      if ((all[r][colNome] || '').toLowerCase() !== target) continue;
      var total = 0;
      for (var i = 1; i <= 15; i++) if (all[r][hdrs.indexOf('Bebida ' + i)]) total++;
      var lib = Math.max(0, Math.min(total, parseInt(d.liberadas, 10) || 0));
      var colLib = hdrs.indexOf('Liberadas');
      if (colLib >= 0) ws.getRange(r + 1, colLib + 1).setValue(lib);
      return json_({ ok: true, liberadas: lib });
    }
    return json_({ erro: 'Campeonato não encontrado' });
  }

  // Registrar voto
  if (d.action === 'votar') {
    var wsCamps = aba_(ABA_CAMPS, HDR_CAMPS);
    var wsVotos = aba_(ABA_VOTOS, HDR_VOTOS);
    var camp    = findCamp_(wsCamps, d.campeonato);
    if (!camp)                      return json_({ erro: 'Campeonato não encontrado' });
    if (camp['Status'] === 'encerrado') return json_({ erro: 'Campeonato encerrado' });

    var indice  = parseInt(d.indice, 10);
    if (!indice || indice < 1 || indice > 15) return json_({ erro: 'Voto inválido' });

    var nomeLow = (d.nome || '').toLowerCase();
    var campLow = (d.campeonato || '').toLowerCase();
    var all     = wsVotos.getDataRange().getValues();
    var hdrs    = all[0];
    var colN    = hdrs.indexOf('Nome');
    var colC    = hdrs.indexOf('Campeonato');
    var colV    = hdrs.indexOf('Voto ' + indice);
    var colTel  = hdrs.indexOf('Telefone');

    for (var r = 1; r < all.length; r++) {
      if ((all[r][colN] || '').toLowerCase() === nomeLow &&
          (all[r][colC] || '').toLowerCase() === campLow) {
        wsVotos.getRange(r + 1, colV + 1).setValue(d.bebida || '');
        if (d.telefone) wsVotos.getRange(r + 1, colTel + 1).setValue(d.telefone);
        return json_({ ok: true });
      }
    }
    var row = hdrs.map(function(h) {
      if (h === 'Nome')         return d.nome || '';
      if (h === 'Telefone')     return d.telefone || '';
      if (h === 'Campeonato')   return d.campeonato || '';
      if (h === 'Voto ' + indice) return d.bebida || '';
      return '';
    });
    wsVotos.appendRow(row);
    return json_({ ok: true });
  }

  // Revelar resultados (admin)
  if (d.action === 'revelar') {
    if (!isAdmin_(d.telefone)) return json_({ erro: 'Não autorizado' });
    var wsCamps = aba_(ABA_CAMPS, HDR_CAMPS);
    var wsVotos = aba_(ABA_VOTOS, HDR_VOTOS);
    var allC    = wsCamps.getDataRange().getValues();
    var hC      = allC[0];
    var colNome = colNomeCamp_(hC);
    var target  = (d.campeonato || '').toLowerCase();
    var camp = null, campRow = -1;

    for (var r = 1; r < allC.length; r++) {
      if ((allC[r][colNome] || '').toLowerCase() === target) {
        camp = {}; hC.forEach(function(k, i) { camp[k] = allC[r][i]; }); campRow = r + 1; break;
      }
    }
    if (!camp) return json_({ erro: 'Campeonato não encontrado' });

    var respostas = [];
    for (var i = 1; i <= 15; i++) if (camp['Bebida ' + i]) respostas.push((camp['Bebida ' + i] || '').toLowerCase().trim());

    var allV = wsVotos.getDataRange().getValues();
    var hV   = allV[0];
    for (var r = 1; r < allV.length; r++) {
      if ((allV[r][hV.indexOf('Campeonato')] || '').toLowerCase() !== target) continue;
      var acertos = 0;
      for (var i = 0; i < respostas.length; i++) {
        var voto = (allV[r][hV.indexOf('Voto ' + (i + 1))] || '').toLowerCase().trim();
        if (voto && voto === respostas[i]) acertos++;
      }
      wsVotos.getRange(r + 1, hV.indexOf('Acertos') + 1).setValue(acertos);
    }
    wsCamps.getRange(campRow, hC.indexOf('Revelado') + 1).setValue('SIM');
    return json_({ ok: true });
  }

  // Encerrar campeonato (admin)
  if (d.action === 'encerrar') {
    if (!isAdmin_(d.telefone)) return json_({ erro: 'Não autorizado' });
    var ws      = aba_(ABA_CAMPS, HDR_CAMPS);
    var all     = ws.getDataRange().getValues();
    var hdrs    = all[0];
    var colNome = colNomeCamp_(hdrs);
    var target  = (d.campeonato || '').toLowerCase();

    for (var r = 1; r < all.length; r++) {
      if ((all[r][colNome] || '').toLowerCase() === target) {
        ws.getRange(r + 1, hdrs.indexOf('Status') + 1).setValue('encerrado');
        return json_({ ok: true });
      }
    }
    return json_({ erro: 'Não encontrado' });
  }

  return json_({ erro: 'Ação desconhecida' });
}
