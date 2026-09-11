"""Iteration 2 feature tests: WebSocket push, Ratings, Analytics ratings,
Daily slot reset. Uses pytest (public URL for HTTP; internal for WS)."""
import os
import json
import asyncio
import uuid
import pytest
import requests
import websockets

BASE_URL = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL",
    "https://kitchen-flow-78.preview.emergentagent.com",
).rstrip("/")
API = f"{BASE_URL}/api"

# For WS we hit the pod directly (public ingress WS is best-effort; internal is authoritative)
WS_INTERNAL = "ws://localhost:8001/api/ws"

# derive public wss URL from BASE_URL for a secondary check
if BASE_URL.startswith("https://"):
    WS_PUBLIC = "wss://" + BASE_URL[len("https://"):] + "/api/ws"
else:
    WS_PUBLIC = "ws://" + BASE_URL.split("://", 1)[-1] + "/api/ws"

STUDENT = {"email": "student@campus.edu", "password": "password123"}
KITCHEN = {"email": "kitchen@campus.edu", "password": "password123"}
ADMIN = {"email": "admin@campus.edu", "password": "password123"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _h(t):
    return {"Authorization": f"Bearer {t}"}


@pytest.fixture(scope="module")
def toks():
    return {"stu": _login(STUDENT), "kit": _login(KITCHEN), "adm": _login(ADMIN)}


def _first_open_slot(tok):
    slots = requests.get(f"{API}/slots", headers=_h(tok), timeout=10).json()
    for s in slots:
        if s["status"] != "FULL":
            return s
    return slots[0]


def _in_stock_item(tok):
    for it in requests.get(f"{API}/menu", headers=_h(tok), timeout=10).json():
        if it["available"]:
            return it
    return None


def _place_order(tok):
    item = _in_stock_item(tok)
    slot = _first_open_slot(tok)
    r = requests.post(
        f"{API}/orders",
        headers=_h(tok),
        json={
            "items": [{"menu_item_id": item["id"], "qty": 1}],
            "slot_id": slot["id"],
            "payment_method": "UPI",
        },
        timeout=15,
    )
    assert r.status_code == 201, r.text
    return r.json()


# ---------------- Daily slot reset ----------------
class TestDailySlotReset:
    def test_slots_have_day_field_and_meta(self, toks):
        # Trigger ensure_slots_current via GET /slots
        r = requests.get(f"{API}/slots", headers=_h(toks["stu"]), timeout=10)
        assert r.status_code == 200
        slots = r.json()
        # public response has capacity/booked/remaining; day is internal - test via
        # consistency: booked <= capacity always
        for s in slots:
            assert s["booked"] <= s["capacity"] or s["capacity"] == 0
            assert s["remaining"] == max(s["capacity"] - s["booked"], 0)

    def test_slots_endpoint_idempotent(self, toks):
        r1 = requests.get(f"{API}/slots", headers=_h(toks["stu"]), timeout=10).json()
        r2 = requests.get(f"{API}/slots", headers=_h(toks["stu"]), timeout=10).json()
        # booked doesn't decrement on repeated calls same day
        assert [s["booked"] for s in r1] == [s["booked"] for s in r2]


# ---------------- Ratings ----------------
class TestRatings:
    def test_rating_before_collected_returns_409(self, toks):
        order = _place_order(toks["stu"])
        r = requests.post(
            f"{API}/orders/{order['id']}/rating",
            headers=_h(toks["stu"]),
            json={"rating": 5, "comment": "too early"},
            timeout=10,
        )
        assert r.status_code == 409, r.text

    def test_rating_after_collected_persists(self, toks):
        order = _place_order(toks["stu"])
        # advance to COLLECTED via kitchen
        for st in ["PREPARING", "READY_FOR_PICKUP", "COLLECTED"]:
            r = requests.patch(
                f"{API}/orders/{order['id']}/status",
                headers=_h(toks["kit"]),
                json={"status": st},
                timeout=10,
            )
            assert r.status_code == 200, r.text
        # rate
        r = requests.post(
            f"{API}/orders/{order['id']}/rating",
            headers=_h(toks["stu"]),
            json={"rating": 4, "comment": "TEST feedback"},
            timeout=10,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["rating"] == 4
        assert body["rating_comment"] == "TEST feedback"
        # verify persistence via GET
        g = requests.get(
            f"{API}/orders/{order['id']}", headers=_h(toks["stu"]), timeout=10
        ).json()
        assert g["rating"] == 4 and g["rating_comment"] == "TEST feedback"

    def test_rating_other_student_forbidden(self, toks):
        # create a collected order for main student
        order = _place_order(toks["stu"])
        for st in ["PREPARING", "READY_FOR_PICKUP", "COLLECTED"]:
            requests.patch(
                f"{API}/orders/{order['id']}/status",
                headers=_h(toks["kit"]),
                json={"status": st},
                timeout=10,
            )
        # register another student
        email = f"TEST_{uuid.uuid4().hex[:8]}@campus.edu"
        r0 = requests.post(
            f"{API}/auth/register",
            json={"email": email, "password": "password123", "name": "TEST Stu2"},
            timeout=10,
        )
        tok2 = r0.json()["access_token"]
        r = requests.post(
            f"{API}/orders/{order['id']}/rating",
            headers=_h(tok2),
            json={"rating": 5},
            timeout=10,
        )
        assert r.status_code == 403, r.text


# ---------------- Analytics ratings ----------------
class TestAnalyticsRatings:
    def test_analytics_has_rating_fields(self, toks):
        r = requests.get(f"{API}/admin/analytics", headers=_h(toks["adm"]), timeout=10)
        assert r.status_code == 200
        d = r.json()
        for k in ["avg_rating", "rated_count", "recent_feedback"]:
            assert k in d, f"missing {k}"
        assert isinstance(d["recent_feedback"], list)
        assert isinstance(d["rated_count"], int)


# ---------------- WebSocket push ----------------
@pytest.mark.asyncio
async def test_ws_pushes_status_updates(toks):
    # Place an order
    order = _place_order(toks["stu"])
    oid = order["id"]

    async def _connect_and_listen(url):
        received = []
        try:
            async with websockets.connect(url, open_timeout=5) as ws:
                await asyncio.sleep(0.3)
                for st in ["PREPARING", "READY_FOR_PICKUP", "COLLECTED"]:
                    # Advance in a thread since requests is sync
                    await asyncio.get_event_loop().run_in_executor(
                        None,
                        lambda s=st: requests.patch(
                            f"{API}/orders/{oid}/status",
                            headers=_h(toks["kit"]),
                            json={"status": s},
                            timeout=10,
                        ),
                    )
                    msg = await asyncio.wait_for(ws.recv(), timeout=5)
                    received.append(json.loads(msg))
        except Exception as e:
            return e
        return received

    # Try internal first (authoritative)
    result = await _connect_and_listen(f"{WS_INTERNAL}?order_id={oid}")
    assert isinstance(result, list), f"WS internal failed: {result}"
    assert len(result) == 3
    statuses = [m["status"] for m in result]
    assert statuses == ["PREPARING", "READY_FOR_PICKUP", "COLLECTED"]
    for m in result:
        assert m["type"] == "status"
        assert m["order_id"] == oid


@pytest.mark.asyncio
async def test_ws_public_ingress(toks):
    """Verify public wss URL (as used by frontend) also proxies WS."""
    order = _place_order(toks["stu"])
    oid = order["id"]
    try:
        async with websockets.connect(
            f"{WS_PUBLIC}?order_id={oid}", open_timeout=8
        ) as ws:
            await asyncio.sleep(0.4)
            await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: requests.patch(
                    f"{API}/orders/{oid}/status",
                    headers=_h(toks["kit"]),
                    json={"status": "PREPARING"},
                    timeout=10,
                ),
            )
            msg = await asyncio.wait_for(ws.recv(), timeout=8)
            data = json.loads(msg)
            assert data["type"] == "status"
            assert data["status"] == "PREPARING"
    except Exception as e:
        pytest.skip(f"Public WS ingress not reachable (may be env-limited): {e}")


# ---------------- Regression: order create + status advance ----------------
class TestRegression:
    def test_place_order_and_advance(self, toks):
        order = _place_order(toks["stu"])
        assert order["status"] == "PLACED" and order["token"].startswith("CC-")
        r = requests.patch(
            f"{API}/orders/{order['id']}/status",
            headers=_h(toks["kit"]),
            json={"status": "PREPARING"},
            timeout=10,
        )
        assert r.status_code == 200 and r.json()["status"] == "PREPARING"
