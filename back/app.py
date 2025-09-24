# back/app.py
import os, json, uuid
from typing import List, Optional, Dict, Any
from enum import Enum

from fastapi import (
    FastAPI, Depends, Header, HTTPException,
    WebSocket, WebSocketDisconnect, Request
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from starlette.responses import JSONResponse
from pydantic import BaseModel
from redis.asyncio import Redis

# --- Optional slowapi imports (fallback to no-op if missing) ---
HAVE_SLOWAPI = True
try:
    from slowapi import Limiter, _rate_limit_exceeded_handler
    from slowapi.util import get_remote_address
    from slowapi.errors import RateLimitExceeded
    from slowapi.middleware import SlowAPIMiddleware
except Exception:
    HAVE_SLOWAPI = False
    class _NoOpLimiter:
        def limit(self, *args, **kwargs):
            def _decorator(func):
                return func
            return _decorator
    Limiter = _NoOpLimiter  # type: ignore
    get_remote_address = lambda request: "0.0.0.0"  # type: ignore
    RateLimitExceeded = Exception  # type: ignore
    def _rate_limit_exceeded_handler(request, exc):  # type: ignore
        return JSONResponse(status_code=429, content={"detail": "Rate limit exceeded"})
    SlowAPIMiddleware = None  # type: ignore

# local modules
from llm_call import llm_call
from rag.document_handler import DocumentHandler
from keys import FRONTEND_ORIGIN

# =========================================================
# Helpers
# =========================================================
def add_bearer_auth_to_openapi(subapp: FastAPI, scheme_name: str = "BearerAuth", base_url: str = "/"):
    """
    Inject HTTP Bearer security so Swagger shows the 'Authorize' button,
    and set `servers` so Swagger hits /api/* or /rag/* correctly.
    """
    def custom_openapi():
        if subapp.openapi_schema:
            return subapp.openapi_schema
        openapi_schema = get_openapi(
            title=subapp.title or "API",
            version="1.0.0",
            routes=subapp.routes,
        )
        components = openapi_schema.setdefault("components", {})
        security_schemes = components.setdefault("securitySchemes", {})
        security_schemes[scheme_name] = {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
        }
        # Show Authorize button; routes can still override if needed
        openapi_schema["security"] = [{scheme_name: []}]
        # CRITICAL: ensure Swagger uses the mounted prefix
        openapi_schema["servers"] = [{"url": base_url}]
        subapp.openapi_schema = openapi_schema
        return subapp.openapi_schema
    subapp.openapi = custom_openapi


# =========================================================
# Shared
# =========================================================
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


# =========================================================
# Sub-App 1: API app (mounted under /api)
# =========================================================
api_app = FastAPI(title="Sello AI backend")

api_app.add_middleware(
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

@api_app.post("/v1/{user_id}/chat")
async def chat_endpoint(user_id: str, body: ChatRequest, token: str = Depends(sello_token)):
    session_id = str(uuid.uuid4())
    await redis.set(SESSION_KEY(session_id), json.dumps({"token": token, "user_id": user_id}), ex=300)
    history = [{"role": m.role, "query": m.query} for m in body.history]
    answer  = await llm_call(body.query, history, session_id=session_id)
    return {"answer": answer, "session_id": session_id}

@api_app.post("/v1/transactions/choose/{session_id}")
async def choose_item(session_id: str, body: ChooseBody, token: str = Depends(sello_token)):
    payload: Dict[str, str] = {}
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

@api_app.post("/v1/transactions/{payment_id}/confirm")
async def confirm_transaction(payment_id: str, body: ConfirmBody, token: str = Depends(sello_token)):
    code = (body.code or "").strip()
    if not code:
        raise HTTPException(400, "Missing code")
    await redis.publish(OTP_CHANNEL(payment_id), json.dumps({"code": code}))
    return {"ok": True, "payment_id": payment_id}

# WS path becomes /api/events after mount
@api_app.websocket("/events")
async def events_ws(websocket: WebSocket):
    token_qs = websocket.query_params.get("token", "")
    if not token_qs:
        await websocket.close(code=4401)
        return
    await websocket.accept()
    pubsub = redis.pubsub()
    await pubsub.subscribe(EVT_STREAM)
    try:
        async for msg in pubsub.listen():
            if msg.get("type") == "message":
                await websocket.send_text(msg.get("data"))
    except WebSocketDisconnect:
        pass
    finally:
        await pubsub.unsubscribe(EVT_STREAM)
        await pubsub.close()
        try:
            await websocket.close()
        except Exception:
            pass

@api_app.get("/health")
async def api_health():
    return {"ok": True, "service": "api"}

# Add Bearer auth + correct base for /api
add_bearer_auth_to_openapi(api_app, base_url="/api")


# =========================================================
# Sub-App 2: RAG app (mounted under /rag)
# =========================================================
rag_app = FastAPI(title="RAG Service")
handler = DocumentHandler()

limiter = Limiter(key_func=get_remote_address) if HAVE_SLOWAPI else Limiter()
if HAVE_SLOWAPI:
    rag_app.state.limiter = limiter
    rag_app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    rag_app.add_middleware(SlowAPIMiddleware)

BASE_TOKEN = "Bearer a1b2c3"
DOCS_PATHS = ("/docs", "/openapi.json", "/redoc")

def _is_docs_request(request: Request) -> bool:
    """
    When mounted, request.scope['path'] is relative ('/docs'),
    while request.url.path can be '/rag/docs'. Allow either.
    """
    rel = request.scope.get("path", "")
    full = request.url.path
    if rel in DOCS_PATHS:
        return True
    if full in DOCS_PATHS:
        return True
    if full.startswith("/rag") and any(full.endswith(p) for p in DOCS_PATHS):
        return True
    return False

@rag_app.middleware("http")
async def token_check_middleware(request: Request, call_next):
    # Allow Swagger UI & OpenAPI for the RAG sub-app
    if _is_docs_request(request):
        return await call_next(request)
    token = request.headers.get("authorization")
    if not token or token != BASE_TOKEN:
        return JSONResponse(status_code=401, content={"detail": "Invalid or missing token"})
    return await call_next(request)

class ProductCreateRequest(BaseModel):
    details: Dict
    project_id: str

class ProductGetRequest(BaseModel):
    project_id: str
    product_id: str

class ProductUpdateRequest(BaseModel):
    project_id: str
    product_id: str
    details: Dict

class ProductDeleteRequest(BaseModel):
    project_id: str
    product_id: str

class ServiceType(str, Enum):
    sales = 'sales'
    support = 'support'
    staff = 'staff'
    qa = 'q/a'

class AskQuestionRequest(BaseModel):
    project_id: str
    user_question: str

class DeleteProjectRequest(BaseModel):
    project_id: str

class DataUploadRequest(BaseModel):
    project_id: str
    row_data: str

@rag_app.post("/products")
async def create_product(request: ProductCreateRequest):
    try:
        handler.create_product(request.details, request.project_id)
        return {"status": "success", "message": f"Product created for project '{request.project_id}'."}
    except Exception as e:
        return JSONResponse(status_code=500, content={"detail": str(e)})

@rag_app.get("/products/{product_id}")
async def get_product(project_id: str, product_id: str):
    try:
        product = handler.get_product(project_id, product_id)
        if product == "Product not found.":
            return JSONResponse(status_code=404, content={"detail": product})
        return {"status": "success", "product": product}
    except Exception as e:
        return JSONResponse(status_code=500, content={"detail": str(e)})

@rag_app.get("/products")
async def get_all_products(project_id: str):
    try:
        products = handler.get_all_products(project_id)
        if products == "No products found.":
            return JSONResponse(status_code=404, content={"detail": products})
        return {"status": "success", "products": products}
    except Exception as e:
        return JSONResponse(status_code=500, content={"detail": str(e)})

@rag_app.put("/products/{product_id}")
async def update_product(product_id: str, request: ProductUpdateRequest):
    try:
        handler.update_product(request.project_id, product_id, request.details)
        return {"status": "success", "message": f"Product '{product_id}' updated."}
    except Exception as e:
        return JSONResponse(status_code=500, content={"detail": str(e)})

@rag_app.delete("/products/{product_id}")
async def delete_product(product_id: str, project_id: str):
    try:
        success = handler.delete_product(project_id, product_id)
        if success:
            return {"status": "success", "message": f"Product '{product_id}' deleted."}
        return JSONResponse(status_code=400, content={"detail": "Failed to delete product."})
    except Exception as e:
        return JSONResponse(status_code=500, content={"detail": str(e)})

@rag_app.post("/ask_question")
async def ask_question(request: AskQuestionRequest):
    try:
        answer = await handler.ask_question({
            "project_id": request.project_id,
            "user_question": request.user_question,
        })
        return {"status": "success", "answer": answer}
    except Exception as e:
        return JSONResponse(status_code=500, content={"detail": str(e)})

@rag_app.delete("/delete_project")
async def delete_project(request: DeleteProjectRequest):
    try:
        handler.delete_project(request.project_id)
        return {"status": "success", "message": f"Project '{request.project_id}' deleted successfully."}
    except Exception as e:
        return JSONResponse(status_code=500, content={"detail": str(e)})

@limiter.limit("10/minute")
@rag_app.post("/data_upload")
async def data_upload(request: DataUploadRequest):
    try:
        await handler.data_upload(request.project_id, request.row_data)
        return {"status": "success", "message": "Data uploaded successfully."}
    except Exception as e:
        return JSONResponse(status_code=500, content={"detail": str(e)})

@rag_app.delete("/delete_all")
async def delete_all():
    try:
        handler.delete_all()
        return {"status": "success", "message": "All data deleted successfully."}
    except Exception as e:
        return JSONResponse(status_code=500, content={"detail": str(e)})

@rag_app.get("/health")
async def rag_health():
    return {"ok": True, "service": "rag", "rate_limit": "enabled" if HAVE_SLOWAPI else "disabled"}

# Add Bearer auth + correct base for /rag
add_bearer_auth_to_openapi(rag_app, base_url="/rag")


# =========================================================
# Root app mounts
# =========================================================
app = FastAPI(title="Unified App")
app.mount("/api", api_app)
app.mount("/rag", rag_app)
