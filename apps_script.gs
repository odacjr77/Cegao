// ═══════════════════════════════════════════════════════════════
//  CEGÃO — Google Apps Script Webhook  (v2)
//  Cole em: Extensões → Apps Script → Implantar → Nova implantação
//    Tipo: App da Web | Executar como: Eu | Acesso: Qualquer pessoa
// ═══════════════════════════════════════════════════════════════

var SS_ID     = '10lvKVXjp02_7jEr4oPraVQgx11E8-iRFaRjk2xh5qSw';
var ABA_ADM   = 'Administradores';
var ABA_CAMPS = 'Campeonatos';
var ABA_VOTOS = 'Votos';

var HDR_ADM   = ['Nome', 'Telefone'];
var HDR_CAMPS = ['Nome', 'Bebida 1','Bebida 2','Bebida 3','Bebida 4','Bebida 5',
                 'Bebida 6','Bebida 7','Bebida 8','Bebida 9','Bebida 10',
                 'Bebida 11','Bebida 12','Bebida 13','Bebida 14','Bebida 15',
                 'Status', 'Revelado', 'Liberadas'];
var HDR_VOTOS = ['Nome','Telefone','Campeonato',
                 'Voto 1','Voto 2','Voto 3','Voto 4','Voto 5',
                 'Voto 6','Voto 7','Voto 8','Voto 9','Voto 10',
                 'Voto 11','Voto 12','Voto 13','Voto 14','Voto 15','Foto','Acertos'];

var PASTA_FOTOS = 'Cegão - Fotos';

// ── Helpers ───────────────────────────────────────────────────────────────────
function ss_()   { return SpreadsheetApp.openById(SS_ID); }
function json_(o){ return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function aba_(nome, hdrs) {
  var ss = ss_();
  var ws = ss.getSheetByName(nome);
  if (!ws) { ws = ss.insertSheet(nome); ws.appendRow(hdrs); return ws; }
  garantirColunas_(ws, hdrs);
  return ws;
}

// Acrescenta ao final quaisquer colunas do cabeçalho esperado que ainda não
// existam na aba — permite evoluir HDR_* sem perder abas já criadas.
function garantirColunas_(ws, hdrs) {
  var lastCol = ws.getLastColumn();
  var atuais = lastCol > 0 ? ws.getRange(1, 1, 1, lastCol).getValues()[0] : [];
  var faltando = hdrs.filter(function(h) { return atuais.indexOf(h) === -1; });
  if (faltando.length) {
    ws.getRange(1, lastCol + 1, 1, faltando.length).setValues([faltando]);
  }
}

function pastaFotos_() {
  var it = DriveApp.getFoldersByName(PASTA_FOTOS);
  return it.hasNext() ? it.next() : DriveApp.createFolder(PASTA_FOTOS);
}

function rows_(ws) {
  var data = ws.getDataRange().getValues();
  if (data.length < 2) return [];
  var h = data[0];
  return data.slice(1).map(function(r) {
    var o = {}; h.forEach(function(k,i){ o[k] = r[i]; }); return o;
  });
}

function tel_(t) { return String(t || '').replace(/\D/g,''); }

function isAdmin_(telefone) {
  if (!telefone) return false;
  var t = tel_(telefone);
  if (!t) return false;
  var ws = ss_().getSheetByName(ABA_ADM);
  if (!ws) return false;
  // Procura o número em qualquer célula (ignora linha de cabeçalho)
  var data = ws.getDataRange().getValues();
  for (var r = 1; r < data.length; r++) {
    for (var c = 0; c < data[r].length; c++) {
      if (tel_(data[r][c]) === t) return true;
    }
  }
  return false;
}

// ── GET ───────────────────────────────────────────────────────────────────────
function doGet(e) {
  var p = e.parameter || {};

  // Verificar se é admin
  if (p.action === 'verificar') {
    return json_({ admin: isAdmin_(p.telefone) });
  }

  // Listar campeonatos ativos
  if (p.action === 'campeonatos') {
    var ws = aba_(ABA_CAMPS, HDR_CAMPS);
    var camps = rows_(ws).filter(function(c){ return c['Status'] !== 'encerrado'; });
    return json_(camps.map(function(c){
      var bebidas = [];
      for (var i=1;i<=15;i++) if(c['Bebida '+i]) bebidas.push(c['Bebida '+i]);
      var liberadas = parseInt(c['Liberadas'], 10) || 0;
      if (liberadas > bebidas.length) liberadas = bebidas.length;
      return { nome: c['Nome'], qtd_bebidas: bebidas.length, liberadas: liberadas, bebidas: bebidas, revelado: c['Revelado']==='SIM' };
    }));
  }

  // Listar TODOS os campeonatos p/ o admin gerenciar (inclui encerrados)
  if (p.action === 'admin_campeonatos') {
    if (!isAdmin_(p.telefone)) return json_({ erro: 'Não autorizado' });
    var ws = aba_(ABA_CAMPS, HDR_CAMPS);
    return json_(rows_(ws).map(function(c){
      var bebidas = [];
      for (var i=1;i<=15;i++) if(c['Bebida '+i]) bebidas.push(c['Bebida '+i]);
      return {
        nome: c['Nome'], qtd_bebidas: bebidas.length,
        liberadas: parseInt(c['Liberadas'], 10) || 0,
        revelado: c['Revelado']==='SIM', status: c['Status']
      };
    }));
  }

  // Detalhe de um campeonato p/ a tela de edição do admin
  if (p.action === 'admin_campeonato') {
    if (!isAdmin_(p.telefone)) return json_({ erro: 'Não autorizado' });
    var ws = aba_(ABA_CAMPS, HDR_CAMPS);
    var camp = rows_(ws).find(function(c){ return (c['Nome']||'').toLowerCase()===(p.campeonato||'').toLowerCase(); });
    if (!camp) return json_({ erro: 'Campeonato não encontrado' });
    var bebidas = [];
    for (var i=1;i<=15;i++) bebidas.push(camp['Bebida '+i] || '');
    return json_({
      nome: camp['Nome'], bebidas: bebidas,
      liberadas: parseInt(camp['Liberadas'], 10) || 0,
      revelado: camp['Revelado']==='SIM', status: camp['Status']
    });
  }

  // Votos de um campeonato
  if (p.action === 'votos') {
    var ws = aba_(ABA_VOTOS, HDR_VOTOS);
    var nome = (p.campeonato||'').toLowerCase();
    return json_(rows_(ws).filter(function(r){ return (r['Campeonato']||'').toLowerCase()===nome; }));
  }

  // Resultados (só após revelação)
  if (p.action === 'resultados') {
    var wsCamps = aba_(ABA_CAMPS, HDR_CAMPS);
    var wsVotos = aba_(ABA_VOTOS, HDR_VOTOS);
    var nome = (p.campeonato||'').toLowerCase();
    var camp = rows_(wsCamps).find(function(c){ return (c['Nome']||'').toLowerCase()===nome; });
    if (!camp) return json_({ erro: 'Campeonato não encontrado' });
    if (camp['Revelado']!=='SIM') return json_({ erro: 'Ainda não revelado' });
    var bebidas = [];
    for (var i=1;i<=15;i++) if(camp['Bebida '+i]) bebidas.push(camp['Bebida '+i]);
    var votos = rows_(wsVotos).filter(function(r){ return (r['Campeonato']||'').toLowerCase()===nome; });
    return json_({ bebidas: bebidas, votos: votos });
  }

  // Debug: ver conteúdo das abas
  if (p.action === 'debug') {
    var ss = ss_();
    var abas = ss.getSheets().map(function(ws){ return ws.getName(); });
    var admWs = ss.getSheetByName(ABA_ADM);
    var admData = admWs ? admWs.getDataRange().getValues() : 'aba não encontrada';
    var campWs = ss.getSheetByName(ABA_CAMPS);
    var campData = campWs ? campWs.getRange(1,1,Math.min(3,campWs.getLastRow()),campWs.getLastColumn()).getValues() : 'aba não encontrada';
    return json_({ abas: abas, administradores: admData, campeonatos_amostra: campData });
  }

  return json_({ ok: true });
}

// ── POST ──────────────────────────────────────────────────────────────────────
function doPost(e) {
  var d = JSON.parse(e.postData.contents);

  // Criar campeonato (admin)
  if (d.action === 'criar_campeonato') {
    if (!isAdmin_(d.telefone)) return json_({ erro: 'Não autorizado' });
    var ws = aba_(ABA_CAMPS, HDR_CAMPS);
    var jaExiste = rows_(ws).some(function(c){ return (c['Nome']||'').toLowerCase()===(d.nome||'').toLowerCase(); });
    if (jaExiste) return json_({ erro: 'Já existe um campeonato com este nome' });
    var hdrs = ws.getRange(1, 1, 1, ws.getLastColumn()).getValues()[0];
    var row = hdrs.map(function(h) {
      if (h === 'Nome') return d.nome;
      var m = /^Bebida (\d+)$/.exec(h);
      if (m) { var idx = parseInt(m[1], 10); return (d.bebidas && d.bebidas[idx - 1]) ? d.bebidas[idx - 1] : ''; }
      if (h === 'Status') return 'ativo';
      if (h === 'Revelado') return 'NAO';
      if (h === 'Liberadas') return 0;
      return '';
    });
    ws.appendRow(row);
    return json_({ ok: true, nome: d.nome });
  }

  // Editar a lista de bebidas de um campeonato existente (admin) — até 15
  if (d.action === 'salvar_bebidas') {
    if (!isAdmin_(d.telefone)) return json_({ erro: 'Não autorizado' });
    var ws = aba_(ABA_CAMPS, HDR_CAMPS);
    var all  = ws.getDataRange().getValues();
    var hdrs = all[0];
    var colNome = hdrs.indexOf('Nome');
    var nomeLow = (d.campeonato||'').toLowerCase();

    for (var r=1; r<all.length; r++) {
      if ((all[r][colNome]||'').toLowerCase() !== nomeLow) continue;
      var bebidas = (d.bebidas || []).slice(0, 15);
      for (var i=1; i<=15; i++) {
        ws.getRange(r+1, hdrs.indexOf('Bebida ' + i) + 1).setValue(bebidas[i-1] || '');
      }
      // Se o admin removeu bebidas, não deixa "liberadas" além do que existe
      var colLib = hdrs.indexOf('Liberadas');
      var liberadasAtual = parseInt(all[r][colLib], 10) || 0;
      if (liberadasAtual > bebidas.length) {
        ws.getRange(r+1, colLib+1).setValue(bebidas.length);
      }
      return json_({ ok: true });
    }
    return json_({ erro: 'Campeonato não encontrado' });
  }

  // Executar campeonato: avisa quantas bebidas já foram servidas/liberadas (admin)
  if (d.action === 'atualizar_liberadas') {
    if (!isAdmin_(d.telefone)) return json_({ erro: 'Não autorizado' });
    var ws = aba_(ABA_CAMPS, HDR_CAMPS);
    var all  = ws.getDataRange().getValues();
    var hdrs = all[0];
    var colNome = hdrs.indexOf('Nome');
    var nomeLow = (d.campeonato||'').toLowerCase();

    for (var r=1; r<all.length; r++) {
      if ((all[r][colNome]||'').toLowerCase() !== nomeLow) continue;
      var total = 0;
      for (var i=1;i<=15;i++) if (all[r][hdrs.indexOf('Bebida '+i)]) total++;
      var liberadas = Math.max(0, Math.min(total, parseInt(d.liberadas, 10) || 0));
      ws.getRange(r+1, hdrs.indexOf('Liberadas')+1).setValue(liberadas);
      return json_({ ok: true, liberadas: liberadas });
    }
    return json_({ erro: 'Campeonato não encontrado' });
  }

  // Registrar voto (participante) — atualiza uma única bebida por vez,
  // permitindo trocar o voto de qualquer índice a qualquer momento
  if (d.action === 'votar') {
    var wsCamps = aba_(ABA_CAMPS, HDR_CAMPS);
    var wsVotos = aba_(ABA_VOTOS, HDR_VOTOS);
    var camp = rows_(wsCamps).find(function(c){ return (c['Nome']||'').toLowerCase()===(d.campeonato||'').toLowerCase(); });
    if (!camp) return json_({ erro: 'Campeonato não encontrado' });
    if (camp['Status']==='encerrado') return json_({ erro: 'Campeonato encerrado' });

    var indice = parseInt(d.indice, 10);
    if (!indice || indice < 1 || indice > 15) return json_({ erro: 'Voto inválido' });

    var nomeLow = (d.nome||'').toLowerCase();
    var all  = wsVotos.getDataRange().getValues();
    var hdrs = all[0];
    var colNome = hdrs.indexOf('Nome');
    var colCamp = hdrs.indexOf('Campeonato');
    var colVoto = hdrs.indexOf('Voto ' + indice);
    var colTel  = hdrs.indexOf('Telefone');

    for (var r=1; r<all.length; r++) {
      if ((all[r][colNome]||'').toLowerCase()===nomeLow
       && (all[r][colCamp]||'').toLowerCase()===(d.campeonato||'').toLowerCase()) {
        wsVotos.getRange(r+1, colVoto+1).setValue(d.bebida || '');
        if (d.telefone) wsVotos.getRange(r+1, colTel+1).setValue(d.telefone);
        return json_({ ok:true });
      }
    }

    var row = hdrs.map(function(h) {
      if (h === 'Nome') return d.nome;
      if (h === 'Telefone') return d.telefone || '';
      if (h === 'Campeonato') return d.campeonato;
      if (h === 'Voto ' + indice) return d.bebida || '';
      return '';
    });
    wsVotos.appendRow(row);
    return json_({ ok:true });
  }

  // Enviar/atualizar foto do participante (opcional)
  if (d.action === 'foto') {
    var wsCamps = aba_(ABA_CAMPS, HDR_CAMPS);
    var wsVotos = aba_(ABA_VOTOS, HDR_VOTOS);
    var camp = rows_(wsCamps).find(function(c){ return (c['Nome']||'').toLowerCase()===(d.campeonato||'').toLowerCase(); });
    if (!camp) return json_({ erro: 'Campeonato não encontrado' });

    var mime  = d.mime || 'image/jpeg';
    var bytes = Utilities.base64Decode(d.foto);
    var blob  = Utilities.newBlob(bytes, mime, (d.nome||'foto') + '_' + new Date().getTime() + '.jpg');
    var file  = pastaFotos_().createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    var url = 'https://drive.google.com/uc?export=view&id=' + file.getId();

    var nomeLow = (d.nome||'').toLowerCase();
    var all  = wsVotos.getDataRange().getValues();
    var hdrs = all[0];
    var colNome = hdrs.indexOf('Nome');
    var colCamp = hdrs.indexOf('Campeonato');
    var colFoto = hdrs.indexOf('Foto');
    var colTel  = hdrs.indexOf('Telefone');

    for (var r=1; r<all.length; r++) {
      if ((all[r][colNome]||'').toLowerCase()===nomeLow
       && (all[r][colCamp]||'').toLowerCase()===(d.campeonato||'').toLowerCase()) {
        wsVotos.getRange(r+1, colFoto+1).setValue(url);
        if (d.telefone) wsVotos.getRange(r+1, colTel+1).setValue(d.telefone);
        return json_({ ok:true, url: url });
      }
    }

    var row = hdrs.map(function(h) {
      if (h === 'Nome') return d.nome;
      if (h === 'Telefone') return d.telefone || '';
      if (h === 'Campeonato') return d.campeonato;
      if (h === 'Foto') return url;
      return '';
    });
    wsVotos.appendRow(row);
    return json_({ ok:true, url: url });
  }

  // Revelar resultados (admin)
  if (d.action === 'revelar') {
    if (!isAdmin_(d.telefone)) return json_({ erro: 'Não autorizado' });
    var wsCamps = aba_(ABA_CAMPS, HDR_CAMPS);
    var wsVotos = aba_(ABA_VOTOS, HDR_VOTOS);
    var allC = wsCamps.getDataRange().getValues();
    var hC   = allC[0];
    var nome = (d.campeonato||'').toLowerCase();
    var camp=null, campRow=-1;
    for (var r=1;r<allC.length;r++) {
      if ((allC[r][hC.indexOf('Nome')]||'').toLowerCase()===nome) {
        camp={}; hC.forEach(function(k,i){camp[k]=allC[r][i];}); campRow=r+1; break;
      }
    }
    if (!camp) return json_({ erro: 'Campeonato não encontrado' });

    var respostas=[];
    for (var i=1;i<=15;i++) if(camp['Bebida '+i]) respostas.push((camp['Bebida '+i]||'').toLowerCase().trim());

    // Calcular acertos
    var allV = wsVotos.getDataRange().getValues();
    var hV   = allV[0];
    for (var r=1;r<allV.length;r++) {
      if ((allV[r][hV.indexOf('Campeonato')]||'').toLowerCase()!==nome) continue;
      var acertos=0;
      for (var i=0;i<respostas.length;i++) {
        var voto = (allV[r][hV.indexOf('Voto '+(i+1))]||'').toLowerCase().trim();
        if (voto && voto===respostas[i]) acertos++;
      }
      wsVotos.getRange(r+1, hV.indexOf('Acertos')+1).setValue(acertos);
    }
    wsCamps.getRange(campRow, hC.indexOf('Revelado')+1).setValue('SIM');
    return json_({ ok:true });
  }

  // Encerrar campeonato (admin)
  if (d.action === 'encerrar') {
    if (!isAdmin_(d.telefone)) return json_({ erro: 'Não autorizado' });
    var ws   = aba_(ABA_CAMPS, HDR_CAMPS);
    var allC = ws.getDataRange().getValues();
    var hC   = allC[0];
    var nome = (d.campeonato||'').toLowerCase();
    for (var r=1;r<allC.length;r++) {
      if ((allC[r][hC.indexOf('Nome')]||'').toLowerCase()===nome) {
        ws.getRange(r+1, hC.indexOf('Status')+1).setValue('encerrado');
        return json_({ ok:true });
      }
    }
    return json_({ erro: 'Não encontrado' });
  }

  return json_({ erro: 'Ação desconhecida' });
}
