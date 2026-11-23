"""HTTP interface for the web app. When the built app (dist/) is present, it is served from the same address."""
from pathlib import Path

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import pipeline
from .store import connect

app = FastAPI(title='Tarazban', docs_url=None, redoc_url=None)


def db():
    conn = connect()
    try:
        yield conn
    finally:
        conn.close()


def _run(fn, *args):
    try:
        return fn(*args)
    except pipeline.BadFile as e:
        raise HTTPException(400, str(e)) from e


class MappingIn(BaseModel):
    kind: str
    mapping: dict[str, str | None]


class DecisionIn(BaseModel):
    status: str
    assignee: str = ''
    note: str = ''


@app.get('/api/state')
def get_state(conn=Depends(db)):
    return pipeline.state(conn)


@app.post('/api/uploads')
def upload(file: UploadFile = File(...), conn=Depends(db)):
    return _run(pipeline.receive, conn, file.filename or 'file.csv', file.file.read())


@app.post('/api/uploads/{upload_id}/mapping')
def confirm_mapping(upload_id: int, body: MappingIn, conn=Depends(db)):
    return _run(pipeline.ingest, conn, upload_id, body.kind, body.mapping, True)


@app.post('/api/alerts/{alert_id}/decisions')
def add_decision(alert_id: str, body: DecisionIn, conn=Depends(db)):
    return {'log': _run(pipeline.decide, conn, alert_id, body.status, body.assignee, body.note)}


DIST = Path(__file__).resolve().parents[2] / 'dist'
if DIST.is_dir():
    app.mount('/', StaticFiles(directory=DIST, html=True), name='app')
