import logging
import requests

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


EVT_STREAM  = "events:stream"
OTP_CHANNEL = lambda pid: f"otp:{pid}"
SEL_CHANNEL = lambda sid: f"select:{sid}"
SESSION_KEY = lambda sid: f"session:{sid}"


def get_recipient_sello(*, auth_token: str) -> list[dict] | dict:
    url = "https://pay.sello.uz/api/v1/transaction-service/p2p/recipient"
    headers = {"Accept": "application/json", "Authorization": f"Bearer {auth_token}"}
    try:
        resp = requests.get(url, headers=headers, timeout=30)
        resp.raise_for_status()
        logger.info("RECIPIENTS SELLO:", resp.json())
        return resp.json()
    except Exception as e:
        logger.error(f"Error calling Sello API (recipient list): {e}")
        return {"error": str(e)}

def get_card_sello(*, auth_token: str, user_id: str):
    url = f"https://pay.sello.uz/api/v1/dashboard/card-service/card/read-by-userId/{user_id}"
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {auth_token}"}
    logger.info("GET CARD SELLO:", url, headers)
    try:
        r = requests.get(url, headers=headers, timeout=30)
        r.raise_for_status()
        data = r.json()
        cards = []
        for item in data[1:]:
            cards.append({
                "id": item["id"],
                "holder": item["holder"],
                "masked": item["masked"],
                "balance": item["balance"],
                "processing": item["processing"],
                "main": item["main"],
                "currency": item["currency"]["code"],
                "bank": item["bank"]["title"],
            })
            print("CARD ITEM:", item)
        return cards
    except Exception as e:
        logger.error(f"Error calling Sello API (card list): {e}")
        return {"error": str(e)}


def ask_question(question: str) -> list | dict:
    auth_token = "a1b2c3"
    url = "http://api:8080/rag/ask_question"
    headers = {
        "accept": "application/json", 
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }
    body = {
        "project_id": "sello",
        "user_question": question,
    }
    try:
        r = requests.post(url, headers=headers, json=body, timeout=30)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        logger.error(f"Error calling Sello API (ask question): {e}")
        return {"error": str(e)}