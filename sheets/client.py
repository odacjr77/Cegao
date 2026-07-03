import os, requests
from dotenv import load_dotenv

load_dotenv()
WEBHOOK = os.getenv("APPS_SCRIPT_URL", "")

def _get(params):
    r = requests.get(WEBHOOK, params=params, timeout=15)
    r.raise_for_status()
    return r.json()

def _post(body, timeout=15):
    r = requests.post(WEBHOOK, json=body, timeout=timeout)
    r.raise_for_status()
    return r.json()

def verificar_admin(telefone: str):
    return _get({"action": "verificar", "telefone": telefone})

def listar_campeonatos():
    return _get({"action": "campeonatos"})

def criar_campeonato(telefone: str, nome: str, bebidas: list[str]):
    return _post({"action": "criar_campeonato", "telefone": telefone, "nome": nome, "bebidas": bebidas})

def registrar_voto(campeonato: str, nome: str, telefone: str, indice: int, bebida: str):
    return _post({"action": "votar", "campeonato": campeonato, "nome": nome, "telefone": telefone, "indice": indice, "bebida": bebida})

def enviar_foto(campeonato: str, nome: str, telefone: str, foto_base64: str, mime: str):
    return _post({"action": "foto", "campeonato": campeonato, "nome": nome, "telefone": telefone, "foto": foto_base64, "mime": mime}, timeout=30)

def listar_votos(campeonato: str):
    return _get({"action": "votos", "campeonato": campeonato})

def revelar(telefone: str, campeonato: str):
    return _post({"action": "revelar", "telefone": telefone, "campeonato": campeonato})

def encerrar(telefone: str, campeonato: str):
    return _post({"action": "encerrar", "telefone": telefone, "campeonato": campeonato})

def resultados(campeonato: str):
    return _get({"action": "resultados", "campeonato": campeonato})
