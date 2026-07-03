# Cegão — Degustação Às Cegas

## O que é
Aplicativo web para brincadeira de degustação às cegas. Participantes provam bebidas rotuladas com letras (A, B, C...) sem saber o que são, votam com nota de 1 a 10, e o admin revela os resultados no final.

## Papéis
- **Administrador**: cria campeonatos, adiciona bebidas (com nome real), acompanha votos e revela resultados
- **Participante**: entra com código de acesso + nome, vota em cada bebida

## Fluxo
1. Admin cria campeonato → recebe um ID e define código de acesso
2. Admin adiciona bebidas (nomes ficam ocultos para participantes)
3. Participantes entram com o código + nome → veem bebidas A, B, C...
4. Cada participante vota em cada bebida (nota 1–10 + comentário)
5. Admin clica "Revelar" → todos veem ranking com nomes reais

## Tech stack
- **Python 3.11+**
- **FastAPI + Uvicorn** — servidor local
- **gspread + google-auth** — integração com Google Sheets
- **HTML/CSS/Vanilla JS** — frontend mobile-first (sem framework)

## Google Sheets
Planilha: `https://docs.google.com/spreadsheets/d/10lvKVXjp02_7jEr4oPraVQgx11E8-iRFaRjk2xh5qSw`

Abas criadas automaticamente:
| Aba | Colunas |
|-----|---------|
| Campeonatos | ID, Nome, Codigo_Acesso, Admin_Senha, Data_Criacao, Status, Revelado |
| Bebidas | ID, Campeonato_ID, Codigo, Nome_Real, Descricao |
| Participantes | ID, Campeonato_ID, Nome, Timestamp |
| Votos | ID, Campeonato_ID, Participante_Nome, Bebida_Codigo, Nota, Comentario, Timestamp |

## Configurar credenciais Google

1. Acesse [console.cloud.google.com](https://console.cloud.google.com)
2. Crie um projeto → ative a **Google Sheets API**
3. Crie uma **Service Account** → baixe o JSON de credenciais
4. Salve como `credentials/service_account.json`
5. Compartilhe a planilha com o e-mail da service account (permissão de Editor)

## Rodar

```bash
pip install -r requirements.txt
python main.py
# Abra http://localhost:8000
```

## Estrutura
```
Cegao/
├── main.py
├── api/
│   └── routes.py       # endpoints REST
├── sheets/
│   └── client.py       # integração Google Sheets
├── static/
│   ├── style.css
│   └── app.js
├── credentials/
│   └── service_account.json  ← não commitado
├── index.html
└── requirements.txt
```

## Working directory
`/home/odacjr/Desktop/ClaudeProjects/Cegao`
