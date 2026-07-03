import gspread
from google.oauth2.service_account import Credentials
from datetime import datetime, timezone
import uuid
import string

SPREADSHEET_ID = "10lvKVXjp02_7jEr4oPraVQgx11E8-iRFaRjk2xh5qSw"
CREDS_FILE = "credentials/service_account.json"
SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]

HEADERS = {
    "Campeonatos":   ["ID", "Nome", "Codigo_Acesso", "Admin_Senha", "Data_Criacao", "Status", "Revelado"],
    "Bebidas":       ["ID", "Campeonato_ID", "Codigo", "Nome_Real", "Descricao"],
    "Participantes": ["ID", "Campeonato_ID", "Nome", "Timestamp"],
    "Votos":         ["ID", "Campeonato_ID", "Participante_Nome", "Bebida_Codigo", "Nota", "Comentario", "Timestamp"],
}

def _client():
    creds = Credentials.from_service_account_file(CREDS_FILE, scopes=SCOPES)
    return gspread.authorize(creds)

def _ws(tab: str):
    gc = _client()
    sh = gc.open_by_key(SPREADSHEET_ID)
    try:
        ws = sh.worksheet(tab)
    except gspread.WorksheetNotFound:
        ws = sh.add_worksheet(title=tab, rows=1000, cols=20)
        ws.append_row(HEADERS[tab])
    return ws

def _now():
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

def _uid():
    return str(uuid.uuid4())[:8]

# ── Campeonatos ────────────────────────────────────────────────────────────────

def criar_campeonato(nome: str, admin_senha: str, codigo_acesso: str) -> dict:
    ws = _ws("Campeonatos")
    row_id = _uid()
    ws.append_row([row_id, nome, codigo_acesso.upper(), admin_senha, _now(), "ativo", "FALSE"])
    return {"id": row_id, "nome": nome, "codigo_acesso": codigo_acesso.upper()}

def listar_campeonatos() -> list[dict]:
    ws = _ws("Campeonatos")
    return ws.get_all_records()

def buscar_campeonato_por_codigo(codigo: str) -> dict | None:
    registros = listar_campeonatos()
    codigo = codigo.upper()
    for r in registros:
        if r["Codigo_Acesso"] == codigo:
            return r
    return None

def buscar_campeonato_por_id(camp_id: str) -> dict | None:
    registros = listar_campeonatos()
    for r in registros:
        if r["ID"] == camp_id:
            return r
    return None

def revelar_campeonato(camp_id: str):
    ws = _ws("Campeonatos")
    registros = ws.get_all_records()
    for i, r in enumerate(registros, start=2):
        if r["ID"] == camp_id:
            ws.update_cell(i, 7, "TRUE")
            return True
    return False

def encerrar_campeonato(camp_id: str):
    ws = _ws("Campeonatos")
    registros = ws.get_all_records()
    for i, r in enumerate(registros, start=2):
        if r["ID"] == camp_id:
            ws.update_cell(i, 6, "encerrado")
            return True
    return False

# ── Bebidas ────────────────────────────────────────────────────────────────────

def _proximo_codigo(camp_id: str) -> str:
    bebidas = listar_bebidas(camp_id)
    letras = list(string.ascii_uppercase)
    usadas = {b["Codigo"] for b in bebidas}
    for letra in letras:
        if letra not in usadas:
            return letra
    return str(len(bebidas) + 1)

def adicionar_bebida(camp_id: str, nome_real: str, descricao: str = "") -> dict:
    ws = _ws("Bebidas")
    codigo = _proximo_codigo(camp_id)
    row_id = _uid()
    ws.append_row([row_id, camp_id, codigo, nome_real, descricao])
    return {"id": row_id, "codigo": codigo, "nome_real": nome_real}

def listar_bebidas(camp_id: str) -> list[dict]:
    ws = _ws("Bebidas")
    return [r for r in ws.get_all_records() if r["Campeonato_ID"] == camp_id]

def remover_bebida(camp_id: str, codigo: str):
    ws = _ws("Bebidas")
    registros = ws.get_all_records()
    for i, r in enumerate(registros, start=2):
        if r["Campeonato_ID"] == camp_id and r["Codigo"] == codigo.upper():
            ws.delete_rows(i)
            return True
    return False

# ── Participantes ──────────────────────────────────────────────────────────────

def entrar_campeonato(camp_id: str, nome: str) -> dict:
    ws = _ws("Participantes")
    registros = ws.get_all_records()
    nome_lower = nome.strip().lower()
    for r in registros:
        if r["Campeonato_ID"] == camp_id and r["Nome"].strip().lower() == nome_lower:
            return {"id": r["ID"], "nome": r["Nome"]}
    row_id = _uid()
    ws.append_row([row_id, camp_id, nome.strip(), _now()])
    return {"id": row_id, "nome": nome.strip()}

def listar_participantes(camp_id: str) -> list[dict]:
    ws = _ws("Participantes")
    return [r for r in ws.get_all_records() if r["Campeonato_ID"] == camp_id]

# ── Votos ──────────────────────────────────────────────────────────────────────

def registrar_voto(camp_id: str, participante_nome: str, bebida_codigo: str, nota: int, comentario: str = "") -> dict:
    ws = _ws("Votos")
    registros = ws.get_all_records()
    nome_lower = participante_nome.strip().lower()
    codigo_upper = bebida_codigo.upper()
    for i, r in enumerate(registros, start=2):
        if (r["Campeonato_ID"] == camp_id
                and r["Participante_Nome"].strip().lower() == nome_lower
                and r["Bebida_Codigo"] == codigo_upper):
            ws.update_cell(i, 5, nota)
            ws.update_cell(i, 6, comentario)
            ws.update_cell(i, 7, _now())
            return {"atualizado": True, "bebida": codigo_upper, "nota": nota}
    row_id = _uid()
    ws.append_row([row_id, camp_id, participante_nome.strip(), codigo_upper, nota, comentario, _now()])
    return {"atualizado": False, "bebida": codigo_upper, "nota": nota}

def listar_votos(camp_id: str) -> list[dict]:
    ws = _ws("Votos")
    return [r for r in ws.get_all_records() if r["Campeonato_ID"] == camp_id]

def votos_do_participante(camp_id: str, participante_nome: str) -> list[dict]:
    todos = listar_votos(camp_id)
    nome_lower = participante_nome.strip().lower()
    return [v for v in todos if v["Participante_Nome"].strip().lower() == nome_lower]

# ── Resultados ─────────────────────────────────────────────────────────────────

def calcular_resultados(camp_id: str) -> list[dict]:
    bebidas = listar_bebidas(camp_id)
    votos   = listar_votos(camp_id)
    resultados = []
    for b in bebidas:
        notas = [v["Nota"] for v in votos if v["Bebida_Codigo"] == b["Codigo"] and v["Nota"]]
        media = round(sum(notas) / len(notas), 2) if notas else 0
        comentarios = [v["Comentario"] for v in votos if v["Bebida_Codigo"] == b["Codigo"] and v["Comentario"]]
        resultados.append({
            "codigo":      b["Codigo"],
            "nome_real":   b["Nome_Real"],
            "descricao":   b["Descricao"],
            "media":       media,
            "total_votos": len(notas),
            "comentarios": comentarios,
        })
    resultados.sort(key=lambda x: x["media"], reverse=True)
    return resultados
