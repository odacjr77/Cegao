import os, requests
from dotenv import load_dotenv

load_dotenv()
WEBHOOK = os.getenv("APPS_SCRIPT_URL", "")

def _get(params: dict):
    r = requests.get(WEBHOOK, params=params, timeout=15)
    r.raise_for_status()
    return r.json()

def _post(body: dict):
    r = requests.post(WEBHOOK, json=body, timeout=15)
    r.raise_for_status()
    return r.json()

def listar_campeonatos():
    return _get({"action": "campeonatos"})

def buscar_campeonato(codigo: str):
    return _get({"action": "campeonato", "codigo": codigo})

def criar_campeonato(nome: str, codigo: str, senha: str, bebidas: list[str]):
    return _post({"action": "criar_campeonato", "nome": nome, "codigo": codigo, "senha": senha, "bebidas": bebidas})

def registrar_voto(campeonato: str, nome: str, telefone: str, votos: list[str]):
    return _post({"action": "votar", "campeonato": campeonato, "nome": nome, "telefone": telefone, "votos": votos})

def listar_votos(campeonato: str):
    return _get({"action": "votos", "campeonato": campeonato})

def revelar(campeonato: str, senha: str):
    return _post({"action": "revelar", "campeonato": campeonato, "senha": senha})

def encerrar(campeonato: str, senha: str):
    return _post({"action": "encerrar", "campeonato": campeonato, "senha": senha})

def resultados(campeonato: str):
    return _get({"action": "resultados", "campeonato": campeonato})
