from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import sheets.client as db

router = APIRouter()

# ── Models ─────────────────────────────────────────────────────────────────────

class CriarCampeonato(BaseModel):
    nome: str
    admin_senha: str
    codigo_acesso: str

class AdminAuth(BaseModel):
    camp_id: str
    admin_senha: str

class AdicionarBebida(BaseModel):
    camp_id: str
    admin_senha: str
    nome_real: str
    descricao: str = ""

class RemoverBebida(BaseModel):
    camp_id: str
    admin_senha: str
    codigo: str

class EntrarCampeonato(BaseModel):
    codigo_acesso: str
    nome: str

class RegistrarVoto(BaseModel):
    camp_id: str
    participante_nome: str
    bebida_codigo: str
    nota: int
    comentario: str = ""

# ── Helpers ────────────────────────────────────────────────────────────────────

def _verificar_admin(camp_id: str, senha: str):
    camp = db.buscar_campeonato_por_id(camp_id)
    if not camp:
        raise HTTPException(404, "Campeonato não encontrado")
    if camp["Admin_Senha"] != senha:
        raise HTTPException(403, "Senha de admin incorreta")
    return camp

# ── Campeonatos ────────────────────────────────────────────────────────────────

@router.post("/campeonatos")
def criar_campeonato(body: CriarCampeonato):
    existente = db.buscar_campeonato_por_codigo(body.codigo_acesso)
    if existente:
        raise HTTPException(409, "Código de acesso já em uso")
    return db.criar_campeonato(body.nome, body.admin_senha, body.codigo_acesso)

@router.get("/campeonatos")
def listar_campeonatos():
    todos = db.listar_campeonatos()
    return [{"id": c["ID"], "nome": c["Nome"], "status": c["Status"]} for c in todos]

@router.post("/campeonatos/admin")
def painel_admin(body: AdminAuth):
    camp = _verificar_admin(body.camp_id, body.admin_senha)
    bebidas      = db.listar_bebidas(body.camp_id)
    participantes = db.listar_participantes(body.camp_id)
    votos        = db.listar_votos(body.camp_id)
    codigos_bebidas = {b["Codigo"] for b in bebidas}
    progresso = {}
    for p in participantes:
        votos_p = [v for v in votos if v["Participante_Nome"].strip().lower() == p["Nome"].strip().lower()]
        codigos_votados = {v["Bebida_Codigo"] for v in votos_p}
        progresso[p["Nome"]] = {
            "votou": sorted(codigos_votados),
            "faltam": sorted(codigos_bebidas - codigos_votados),
            "completo": codigos_bebidas == codigos_votados,
        }
    return {
        "campeonato":  {"id": camp["ID"], "nome": camp["Nome"], "status": camp["Status"], "revelado": camp["Revelado"]},
        "bebidas":     bebidas,
        "participantes": progresso,
    }

@router.post("/campeonatos/revelar")
def revelar(body: AdminAuth):
    _verificar_admin(body.camp_id, body.admin_senha)
    db.revelar_campeonato(body.camp_id)
    return db.calcular_resultados(body.camp_id)

@router.post("/campeonatos/encerrar")
def encerrar(body: AdminAuth):
    _verificar_admin(body.camp_id, body.admin_senha)
    db.encerrar_campeonato(body.camp_id)
    return {"ok": True}

# ── Bebidas ────────────────────────────────────────────────────────────────────

@router.post("/bebidas")
def adicionar_bebida(body: AdicionarBebida):
    _verificar_admin(body.camp_id, body.admin_senha)
    return db.adicionar_bebida(body.camp_id, body.nome_real, body.descricao)

@router.delete("/bebidas")
def remover_bebida(body: RemoverBebida):
    _verificar_admin(body.camp_id, body.admin_senha)
    ok = db.remover_bebida(body.camp_id, body.codigo)
    if not ok:
        raise HTTPException(404, "Bebida não encontrada")
    return {"ok": True}

@router.get("/bebidas/{camp_id}")
def listar_bebidas_participante(camp_id: str):
    camp = db.buscar_campeonato_por_id(camp_id)
    if not camp:
        raise HTTPException(404, "Campeonato não encontrado")
    bebidas = db.listar_bebidas(camp_id)
    return [{"codigo": b["Codigo"], "descricao": b["Descricao"]} for b in bebidas]

# ── Participantes ──────────────────────────────────────────────────────────────

@router.post("/entrar")
def entrar(body: EntrarCampeonato):
    camp = db.buscar_campeonato_por_codigo(body.codigo_acesso)
    if not camp:
        raise HTTPException(404, "Código de acesso inválido")
    if camp["Status"] == "encerrado":
        raise HTTPException(400, "Este campeonato já foi encerrado")
    participante = db.entrar_campeonato(camp["ID"], body.nome)
    return {
        "camp_id":   camp["ID"],
        "camp_nome": camp["Nome"],
        "revelado":  camp["Revelado"],
        "participante": participante,
    }

# ── Votos ──────────────────────────────────────────────────────────────────────

@router.post("/votos")
def votar(body: RegistrarVoto):
    camp = db.buscar_campeonato_por_id(body.camp_id)
    if not camp:
        raise HTTPException(404, "Campeonato não encontrado")
    if camp["Status"] == "encerrado":
        raise HTTPException(400, "Campeonato encerrado")
    if not (1 <= body.nota <= 10):
        raise HTTPException(400, "Nota deve ser entre 1 e 10")
    bebidas = db.listar_bebidas(body.camp_id)
    codigos = {b["Codigo"] for b in bebidas}
    if body.bebida_codigo.upper() not in codigos:
        raise HTTPException(404, "Bebida não encontrada")
    return db.registrar_voto(body.camp_id, body.participante_nome, body.bebida_codigo, body.nota, body.comentario)

@router.get("/votos/{camp_id}/{participante_nome}")
def meus_votos(camp_id: str, participante_nome: str):
    return db.votos_do_participante(camp_id, participante_nome)

# ── Resultados ─────────────────────────────────────────────────────────────────

@router.get("/resultados/{camp_id}")
def resultados_publicos(camp_id: str):
    camp = db.buscar_campeonato_por_id(camp_id)
    if not camp:
        raise HTTPException(404, "Campeonato não encontrado")
    if camp["Revelado"] != "TRUE":
        raise HTTPException(403, "Resultados ainda não revelados")
    return db.calcular_resultados(camp_id)
