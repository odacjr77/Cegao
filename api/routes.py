from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import sheets.client as db

router = APIRouter()

class EntrarBody(BaseModel):
    nome: str
    telefone: str = ""

class CriarCampeonato(BaseModel):
    telefone: str
    nome: str
    bebidas: list[str]

class VotoBody(BaseModel):
    campeonato: str
    nome: str
    telefone: str = ""
    indice: int
    bebida: str

class AdminAction(BaseModel):
    telefone: str
    campeonato: str

@router.post("/entrar")
def entrar(body: EntrarBody):
    admin = False
    if body.telefone:
        r = db.verificar_admin(body.telefone)
        admin = r.get("admin", False)
    camps = db.listar_campeonatos()
    return {"admin": admin, "campeonatos": camps}

@router.get("/campeonatos")
def listar():
    return db.listar_campeonatos()

@router.post("/campeonatos")
def criar(body: CriarCampeonato):
    bebidas = [b.strip() for b in body.bebidas if b.strip()]
    if not bebidas:
        raise HTTPException(400, "Adicione ao menos uma bebida")
    r = db.criar_campeonato(body.telefone, body.nome, bebidas)
    if "erro" in r:
        raise HTTPException(403, r["erro"])
    return r

@router.post("/votos")
def votar(body: VotoBody):
    r = db.registrar_voto(body.campeonato, body.nome, body.telefone, body.votos)
    if "erro" in r:
        raise HTTPException(400, r["erro"])
    return r

@router.get("/votos/{campeonato}")
def votos(campeonato: str):
    return db.listar_votos(campeonato)

@router.post("/revelar")
def revelar(body: AdminAction):
    r = db.revelar(body.telefone, body.campeonato)
    if "erro" in r:
        raise HTTPException(403, r["erro"])
    return r

@router.post("/encerrar")
def encerrar(body: AdminAction):
    r = db.encerrar(body.telefone, body.campeonato)
    if "erro" in r:
        raise HTTPException(403, r["erro"])
    return r

@router.get("/resultados/{campeonato}")
def resultados(campeonato: str):
    r = db.resultados(campeonato)
    if "erro" in r:
        raise HTTPException(403, r["erro"])
    return r
