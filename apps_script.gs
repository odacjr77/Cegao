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
                 'Status', 'Revelado'];
var HDR_VOTOS = ['Nome','Telefone','Campeonato',
                 'Voto 1','Voto 2','Voto 3','Voto 4','Voto 5',
                 'Voto 6','Voto 7','Voto 8','Voto 9','Voto 10',
                 'Voto 11','Voto 12','Voto 13','Voto 14','Voto 15','Acertos'];

// ── Helpers ───────────────────────────────────────────────────────────────────
function ss_()   { return SpreadsheetApp.openById(SS_ID); }
function json_(o){ return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function aba_(nome, hdrs) {
  var ss = ss_();
  var ws = ss.getSheetByName(nome);
  if (!ws) { ws = ss.insertSheet(nome); ws.appendRow(hdrs); }
  return ws;
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
  return rows_(ws).some(function(r){ return tel_(r['Telefone']) === t; });
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
      return { nome: c['Nome'], qtd_bebidas: bebidas.length, bebidas: bebidas, revelado: c['Revelado']==='SIM' };
    }));
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
    var row = [d.nome];
    for (var i=1;i<=15;i++) row.push((d.bebidas && d.bebidas[i-1]) ? d.bebidas[i-1] : '');
    row.push('ativo','NAO');
    ws.appendRow(row);
    return json_({ ok: true, nome: d.nome });
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
    var colVoto = hdrs.indexOf('Voto ' + indice);
    var colTel  = hdrs.indexOf('Telefone');

    for (var r=1; r<all.length; r++) {
      if ((all[r][0]||'').toLowerCase()===nomeLow
       && (all[r][2]||'').toLowerCase()===(d.campeonato||'').toLowerCase()) {
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
