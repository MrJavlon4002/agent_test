import os, json, uuid
from typing import List, Optional
from fastapi import FastAPI, Depends, Header, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from redis.asyncio import Redis
from llm_call import llm_call
from keys import FRONTEND_ORIGIN

REDIS_HOST = os.getenv("REDIS_HOST", "redis")
try:
    REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
except (TypeError, ValueError):
    REDIS_PORT = 6379
redis = Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)

EVT_STREAM  = "events:stream"
SEL_CHANNEL = lambda sid: f"select:{sid}"
OTP_CHANNEL = lambda pid: f"otp:{pid}"
SESSION_KEY = lambda sid: f"session:{sid}"

app = FastAPI(title="Sello AI backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN] if FRONTEND_ORIGIN != "*" else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatMessage(BaseModel):
    role: str
    query: str

class ChatRequest(BaseModel):
    query: str
    history: List[ChatMessage] = []

class ConfirmBody(BaseModel):
    code: str

class ChooseBody(BaseModel):
    recipient_id: Optional[str] = None
    card_id: Optional[str] = None

def sello_token(authorization: str = Header(...)) -> str:
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing Bearer token")
    return authorization[7:]

@app.post("/api/v1/{user_id}/chat")
async def chat_endpoint(user_id: str, body: ChatRequest, token: str = Depends(sello_token)):
    session_id = str(uuid.uuid4())
    await redis.set(SESSION_KEY(session_id), json.dumps({"token": token, "user_id": user_id}), ex=300)

    history = [{"role": m.role, "query": m.query} for m in body.history]
    answer  = await llm_call(body.query, history, session_id=session_id)
    return {"answer": answer, "session_id": session_id}

@app.post("/api/v1/transactions/choose/{session_id}")
async def choose_item(session_id: str, body: ChooseBody, token: str = Depends(sello_token)):
    payload = {}
    if body.recipient_id is not None:
        rid = body.recipient_id.strip()
        if not rid:
            raise HTTPException(400, "recipient_id cannot be empty")
        payload["recipient_id"] = rid

    if body.card_id is not None:
        cid = body.card_id.strip()
        if not cid:
            raise HTTPException(400, "card_id cannot be empty")
        payload["card_id"] = cid

    if not payload:
        raise HTTPException(400, "Either recipient_id or card_id is required")

    await redis.publish(SEL_CHANNEL(session_id), json.dumps(payload))
    return {"ok": True, "session_id": session_id, **payload}

@app.post("/api/v1/transactions/{payment_id}/confirm")
async def confirm_transaction(payment_id: str, body: ConfirmBody, token: str = Depends(sello_token)):
    code = (body.code or "").strip()
    if not code:
        raise HTTPException(400, "Missing code")
    await redis.publish(OTP_CHANNEL(payment_id), json.dumps({"code": code}))
    return {"ok": True, "payment_id": payment_id}

@app.websocket("/events")
async def events_ws(websocket: WebSocket):
    token_qs = websocket.query_params.get("token", "")
    if not token_qs:
        await websocket.close(code=4401)
        return

    await websocket.accept()
    pubsub = redis.pubsub()
    await pubsub.subscribe(EVT_STREAM)
    print("[WS events] subscribed to events:stream")

    try:
        async for msg in pubsub.listen():
            if msg.get("type") == "message":
                data = msg.get("data")
                await websocket.send_text(data)
    except WebSocketDisconnect:
        print("[WS events] disconnect")
    finally:
        await pubsub.unsubscribe(EVT_STREAM)
        await pubsub.close()
        try:
            await websocket.close()
        except Exception:
            pass
