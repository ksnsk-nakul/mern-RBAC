from fastapi import FastAPI

app = FastAPI(title="RBAC AI Service")

@app.get("/health")
def health():
    return {"status": "ok", "model": "stub"}
