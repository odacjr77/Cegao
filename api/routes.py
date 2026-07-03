from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import sheets.client as db

router = APIRouter()

class CriarCampeonato(BaseModel):
    nome: str
    codigo: str
    senha: str
    bebidas: list[str]

class EntrarCampeonato(BaseModel):
    codigo: str

class RegistrarVoto(BaseModel):
    campeonato: str
    nome: str
    telefone: str = ""
    votos: list[str]

class AdminAction(BaseModel):
    campeonato: str
    senha: str

@router.get("/campeonatos")
def listar_campeonatos():
    return db.listar_campeonatos()

@router.get("/campeonatos/{codigo}")
def buscar_campeonato(codigo: str):
    r = db.buscar_campeonato(codigo)
    if "erro" in r:
        raise HTTPException(404, r["erro"])
    return r

@router.post("/campeonatos")
def criar_campeonato(body: CriarCampeonato):
    bebidas = [b.strip() for b in body.bebidas if b.strip()]
    if not bebidas:
        raise HTTPException(400, "Adicione ao menos uma bebida")
    r = db.criar_campeonato(body.nome, body.codigo, body.senha, bebidas)
    if "erro" in r:
        raise HTTPException(409, r["erro"])
    return r

@router.post("/votos")
def registrar_voto(body: RegistrarVoto):
    r = db.registrar_voto(body.campeonato, body.nome, body.telefone, body.votos)
    if "erro" in r:
        raise HTTPException(400, r["erro"])
    return r

@router.get("/votos/{campeonato}")
def listar_votos(campeonato: str):
    return db.listar_votos(campeonato)

@router.post("/revelar")
def revelar(body: AdminAction):
    r = db.revelar(body.campeonato, body.senha)
    if "erro" in r:
        raise HTTPException(403, r["erro"])
    return r

@router.post("/encerrar")
def encerrar(body: AdminAction):
    r = db.encerrar(body.campeonato, body.senha)
    if "erro" in r:
        raise HTTPException(403, r["erro"])
    return r

@router.get("/resultados/{campeonato}")
def resultados(campeonato: str):
    r = db.resultados(campeonato)
    if "erro" in r:
        raise HTTPException(403, r["erro"])
    return r
