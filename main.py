from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from api.routes import router

app = FastAPI(title="Cegão — Degustação Às Cegas")
app.mount("/static", StaticFiles(directory="static"), name="static")
app.include_router(router, prefix="/api")

@app.get("/")
def index():
    return FileResponse("index.html")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
