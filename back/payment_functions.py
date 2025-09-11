import logging, requests
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_recipient_sello_by_id(recipient_id: str, *, auth_token: str) -> dict:
    url = f"https://pay.sello.uz/api/v1/transaction-service/p2p/recipient/{recipient_id}"
    headers = {"Accept": "application/json", "Authorization": f"Bearer {auth_token}"}
    try:
        r = requests.get(url, headers=headers, timeout=30)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        logger.error(f"Error calling Sello API (recipient by id): {e}")
        return {"error": str(e)}

def p2p_prepay(amount: float, recipient_id: str, card_pan: str, *, sender_card_id: str, auth_token: str) -> dict:
    url = "https://pay.sello.uz/api/v1/transaction-service/p2p/prepay"
    headers = {"Accept": "application/json", "Authorization": f"Bearer {auth_token}"}
    body = {
        "amount": int(round(amount * 100)),
        "currency": "UZS",
        "sender": { "id": sender_card_id },
        "recipient": { "id": recipient_id, "cardType": "CARD", "pan": card_pan }
    }
    try:
        r = requests.post(url, headers=headers, json=body, timeout=30)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        logger.error(f"Error calling Sello API (prepay): {e}")
        return {"error": str(e)}

def p2p_pay(payment_id: str, code: str, *, auth_token: str) -> dict:
    url = "https://pay.sello.uz/api/v1/transaction-service/p2p/pay"
    headers = {"Accept": "application/json", "Authorization": f"Bearer {auth_token}"}
    body = {"id": payment_id, "code": code, "comments": "Just for fun"}
    try:
        r = requests.post(url, headers=headers, json=body, timeout=30)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        logger.error(f"Error calling Sello API (pay): {e}")
        return {"error": str(e)}
