import os, json, asyncio, time, uuid
import logging
from fastmcp import FastMCP
from redis.asyncio import Redis

from info_collect import get_card_sello, get_recipient_sello, ask_question
from payment_functions import get_recipient_sello_by_id, p2p_prepay, p2p_pay
from name_matcher import filter_objects_by_holder




REDIS_HOST = os.getenv("REDIS_HOST", "redis")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
redis = Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
redis = Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)

EVT_STREAM  = "events:stream"
OTP_CHANNEL = lambda pid: f"otp:{pid}"
SEL_CHANNEL = lambda sid: f"select:{sid}"
SESSION_KEY = lambda sid: f"session:{sid}"

mcp = FastMCP(name="Sello PAY")

async def _get_creds(session_id: str):
    raw = await redis.get(SESSION_KEY(session_id))
    if not raw:
        return None, None
    try:
        obj = json.loads(raw)
        return (obj.get("token"), obj.get("user_id"))
    except Exception:
        return None, None

async def _wait_code(payment_id: str, timeout_sec: int = 180) -> str | None:
    channel = OTP_CHANNEL(payment_id)
    pubsub = redis.pubsub()
    await pubsub.subscribe(channel)
    start = time.monotonic()
    try:
        while True:
            msg = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
            if msg and msg.get("type") == "message":
                try:
                    payload = json.loads(msg.get("data") or "{}")
                except json.JSONDecodeError:
                    payload = {}
                code = (payload.get("code") or "").strip()
                if code:
                    return code
            if time.monotonic() - start > timeout_sec:
                return None
    finally:
        await pubsub.unsubscribe(channel)
        await pubsub.close()

async def _wait_selected(session_id: str, timeout_sec: int = 180) -> str | None:
    channel = SEL_CHANNEL(session_id)
    pubsub = redis.pubsub()
    await pubsub.subscribe(channel)
    start = time.monotonic()
    try:
        while True:
            msg = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
            if msg and msg.get("type") == "message":
                try:
                    payload = json.loads(msg.get("data") or "{}")
                except json.JSONDecodeError:
                    payload = {}
                sel = (payload.get("recipient_id") or payload.get("card_id") or "").strip()
                if sel:
                    return sel
            if time.monotonic() - start > timeout_sec:
                return None
    finally:
        await pubsub.unsubscribe(channel)
        await pubsub.close()

@mcp.tool
async def get_recipient(session_id: str):
    "Get list of recipients for the user"

    token, user_id = await _get_creds(session_id)
    logger.info(f"get_recipient: token={token}, user_id={user_id}")
    if not token or not user_id:
        return {"error": "Missing credentials for session"}
    return get_recipient_sello(auth_token=token)

@mcp.tool
async def get_card(session_id: str):
    "Get list of cards for the user"

    token, user_id = await _get_creds(session_id)
    if not token or not user_id:
        return {"error": "Missing credentials for session"}
    return get_card_sello(auth_token=token, user_id=user_id)

@mcp.tool
async def make_transaction(recipient_name: str, amount: float, session_id: str):
    """
    Make a transaction on behalf of a user.
     - recipient_name: The name of the user making the transaction.
     - amount: The amount to be transacted.
     - session_id: The session ID for the transaction.
    """
    token, user_id = await _get_creds(session_id)
    if not token or not user_id:
        return {"status": "ERROR", "stage": "creds", "error": "Missing credentials for session"}
    recs = get_recipient_sello(auth_token=token)

    recs = filter_objects_by_holder(recipient_name, recs)

    if recs is None or (isinstance(recs, list) and len(recs) == 0):
        return {"status": "NO_RECIPIENTS", "stage": "recipient_list", "message": "No recipients found matching the name."}

    if isinstance(recs, dict) and "error" in recs:
        return {"status": "ERROR", "stage": "recipient_list", "error": recs["error"]}
    

    def map_rec(r):
        return {
            "id": r.get("id"),
            "name": r.get("name") or r.get("holder") or "Unknown",
            "masked": r.get("masked") or r.get("panMasked") or "****",
            "pan_last4": (r.get("pan") or "")[-4:] if r.get("pan") else None,
        }
    rec_list = [map_rec(r) for r in (recs or []) if isinstance(r, dict) and r.get("id")]
    rsid = str(uuid.uuid4())
    await redis.publish(EVT_STREAM, json.dumps({
        "type": "RECIPIENT_CHOICES",
        "session_id": rsid,
        "list": rec_list,
        "amount": amount
    }))
    chosen = await _wait_selected(rsid, 180)
    if not chosen:
        return {"status": "TIMEOUT", "stage": "select_recipient", "message": "Recipient not selected in time."}
    recipient_id = chosen

    # 2) Card selection (always ask)
    cards = get_card_sello(auth_token=token, user_id=user_id)
    if isinstance(cards, dict) and "error" in cards:
        return {"status": "ERROR", "stage": "card_list", "error": cards["error"]}

    def map_card(c):
        return {
            "id": c.get("id"),
            "holder": c.get("holder") or "Card",
            "masked": c.get("masked") or "****",
            "bank": c.get("bank"),
            "main": c.get("main"),
            "balance": c.get("balance"),
            "currency": c.get("currency"),
        }
    card_list = [map_card(c) for c in (cards or []) if isinstance(c, dict) and c.get("id")]
    csid = str(uuid.uuid4())
    await redis.publish(EVT_STREAM, json.dumps({
        "type": "CARD_CHOICES",
        "session_id": csid,
        "list": card_list,
        "amount": amount
    }))
    sender_card_id = await _wait_selected(csid, 180)
    if not sender_card_id:
        return {"status": "TIMEOUT", "stage": "select_card", "message": "Card not selected in time."}

    # 3) PREPAY
    rec = get_recipient_sello_by_id(recipient_id, auth_token=token)
    if isinstance(rec, dict) and "error" in rec:
        return {"status": "ERROR", "stage": "lookup", "error": rec["error"]}

    card_num = rec.get("pan")
    pre = p2p_prepay(amount, recipient_id, card_num, sender_card_id=sender_card_id, auth_token=token)
    if isinstance(pre, dict) and "error" in pre:
        return {"status": "ERROR", "stage": "prepay", "error": pre["error"]}

    payment_id = pre.get("id")
    if not payment_id:
        return {"status": "ERROR", "stage": "prepay", "error": "No payment_id from prepay"}

    # 4) OTP push
    await redis.publish(EVT_STREAM, json.dumps({"type": "CODE_REQUIRED", "payment_id": payment_id, "expires_in": 180}))

    # 5) WAIT OTP
    code = await _wait_code(payment_id, 180)
    if not code:
        return {"status": "TIMEOUT", "stage": "await_code", "payment_id": payment_id, "message": "No code within 3 minutes. Try again."}

    # 6) PAY
    pay = p2p_pay(payment_id, code, auth_token=token)
    if isinstance(pay, dict) and "error" in pay:
        return {"status": "ERROR", "stage": "pay", "payment_id": payment_id, "error": pay["error"]}


    return {"status": "CONFIRMED", "payment_id": payment_id, "result": pay, "receiver": chosen}

@mcp.tool
async def faq_question(question: str):
    """
    Answer the question about Sello Pay and its usage and services.
    question: The question to be answered in Uzbek.
    """
    resp = ask_question(question)
    return resp


if __name__ == "__main__":
    mcp.run()
