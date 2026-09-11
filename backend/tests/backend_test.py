"""CampusCrave backend integration tests.

Covers: Auth, Menu, Slots, Orders, Kitchen flow, Stock toggle,
Admin menu CRUD, slot capacity, analytics, role enforcement,
and concurrency (over-booking).
"""
import os
import uuid
import pytest
import requests
from concurrent.futures import ThreadPoolExecutor

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://kitchen-flow-78.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

STUDENT = {"email": "student@campus.edu", "password": "password123"}
KITCHEN = {"email": "kitchen@campus.edu", "password": "password123"}
ADMIN = {"email": "admin@campus.edu", "password": "password123"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    d = r.json()
    return d["access_token"], d["user"]


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="session")
def student_tok():
    tok, _ = _login(STUDENT)
    return tok


@pytest.fixture(scope="session")
def kitchen_tok():
    tok, _ = _login(KITCHEN)
    return tok


@pytest.fixture(scope="session")
def admin_tok():
    tok, _ = _login(ADMIN)
    return tok


# ---------------- Health ----------------
class TestHealth:
    def test_root(self):
        r = requests.get(f"{API}/", timeout=10)
        assert r.status_code == 200
        assert r.json().get("status") == "ok"


# ---------------- Auth ----------------
class TestAuth:
    def test_login_success(self):
        r = requests.post(f"{API}/auth/login", json=STUDENT, timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert "access_token" in d and d["user"]["role"] == "STUDENT"

    def test_login_bad_password(self):
        r = requests.post(f"{API}/auth/login", json={"email": STUDENT["email"], "password": "wrong"}, timeout=10)
        assert r.status_code == 401

    def test_me_requires_auth(self):
        assert requests.get(f"{API}/auth/me", timeout=10).status_code == 401

    def test_me_bad_token(self):
        r = requests.get(f"{API}/auth/me", headers={"Authorization": "Bearer garbage"}, timeout=10)
        assert r.status_code == 401

    def test_me_ok(self, student_tok):
        r = requests.get(f"{API}/auth/me", headers=_h(student_tok), timeout=10)
        assert r.status_code == 200
        assert r.json()["email"] == STUDENT["email"]

    def test_register_defaults_student_and_conflict(self):
        email = f"TEST_{uuid.uuid4().hex[:8]}@campus.edu"
        r = requests.post(f"{API}/auth/register",
                          json={"email": email, "password": "password123", "name": "TEST User"}, timeout=10)
        assert r.status_code == 201, r.text
        assert r.json()["user"]["role"] == "STUDENT"
        r2 = requests.post(f"{API}/auth/register",
                           json={"email": email, "password": "password123", "name": "TEST User"}, timeout=10)
        assert r2.status_code == 409

    def test_register_role_selectable(self):
        email = f"TEST_{uuid.uuid4().hex[:8]}@campus.edu"
        r = requests.post(f"{API}/auth/register",
                          json={"email": email, "password": "password123", "name": "TEST Admin", "role": "ADMIN"},
                          timeout=10)
        assert r.status_code == 201
        assert r.json()["user"]["role"] == "ADMIN"


# ---------------- Menu ----------------
class TestMenu:
    def test_menu_requires_auth(self):
        assert requests.get(f"{API}/menu", timeout=10).status_code == 401

    def test_menu_returns_available_flag(self, student_tok):
        r = requests.get(f"{API}/menu", headers=_h(student_tok), timeout=10)
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 10
        for it in items:
            assert "available" in it and "within_time_window" in it and "in_stock" in it
            assert it["available"] == (it["in_stock"] and it["within_time_window"])

    def test_categories(self):
        r = requests.get(f"{API}/categories", timeout=10)
        assert r.status_code == 200
        cats = r.json()
        assert {c["name"] for c in cats} >= {"Meals", "Snacks", "Beverages"}


# ---------------- Slots ----------------
class TestSlots:
    def test_slots_shape(self, student_tok):
        r = requests.get(f"{API}/slots", headers=_h(student_tok), timeout=10)
        assert r.status_code == 200
        slots = r.json()
        assert len(slots) == 16  # 11:00-15:00 in 15-min = 16 slots
        for s in slots:
            assert s["status"] in {"OPEN", "FILLING", "FULL"}
            assert s["remaining"] == max(s["capacity"] - s["booked"], 0)


# ---------------- Orders / Concurrency ----------------
def _first_available_slot(tok):
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


class TestOrders:
    def test_create_order_and_get(self, student_tok):
        item = _in_stock_item(student_tok)
        assert item, "No available item found"
        slot = _first_available_slot(student_tok)
        payload = {"items": [{"menu_item_id": item["id"], "qty": 2}],
                   "slot_id": slot["id"], "payment_method": "UPI"}
        r = requests.post(f"{API}/orders", headers=_h(student_tok), json=payload, timeout=10)
        assert r.status_code == 201, r.text
        order = r.json()
        assert order["status"] == "PLACED"
        assert order["token"].startswith("CC-")
        assert order["total"] == round(item["price"] * 2, 2)  # server-side pricing
        # GET verify persistence
        g = requests.get(f"{API}/orders/{order['id']}", headers=_h(student_tok), timeout=10)
        assert g.status_code == 200
        assert g.json()["id"] == order["id"]
        pytest.order_id = order["id"]
        # mine
        mine = requests.get(f"{API}/orders/mine", headers=_h(student_tok), timeout=10).json()
        assert any(o["id"] == order["id"] for o in mine)

    def test_other_students_cannot_see_order(self, student_tok):
        # register a fresh student and try to fetch previous order
        email = f"TEST_{uuid.uuid4().hex[:8]}@campus.edu"
        r = requests.post(f"{API}/auth/register",
                          json={"email": email, "password": "password123", "name": "TEST Stu"}, timeout=10)
        tok2 = r.json()["access_token"]
        oid = getattr(pytest, "order_id", None)
        assert oid
        r2 = requests.get(f"{API}/orders/{oid}", headers=_h(tok2), timeout=10)
        assert r2.status_code == 403

    def test_order_unavailable_item(self, student_tok, admin_tok):
        # Toggle an item out of stock, then attempt order
        item = _in_stock_item(student_tok)
        requests.patch(f"{API}/menu/{item['id']}/stock", headers=_h(admin_tok),
                       json={"in_stock": False}, timeout=10)
        try:
            slot = _first_available_slot(student_tok)
            r = requests.post(f"{API}/orders", headers=_h(student_tok),
                              json={"items": [{"menu_item_id": item["id"], "qty": 1}],
                                    "slot_id": slot["id"], "payment_method": "CASH"}, timeout=10)
            assert r.status_code == 409
        finally:
            requests.patch(f"{API}/menu/{item['id']}/stock", headers=_h(admin_tok),
                           json={"in_stock": True}, timeout=10)

    def test_full_slot_409_and_no_overbooking(self, student_tok, admin_tok):
        """Set capacity to a small number, hammer with parallel requests -> booked <= capacity."""
        item = _in_stock_item(student_tok)
        slots = requests.get(f"{API}/slots", headers=_h(student_tok), timeout=10).json()
        # pick a fresh slot with 0 booked
        target = next((s for s in slots if s["booked"] == 0), slots[-1])
        # Admin sets capacity to 3
        r = requests.patch(f"{API}/admin/slots/{target['id']}", headers=_h(admin_tok),
                           json={"capacity": 3}, timeout=10)
        assert r.status_code == 200
        payload = {"items": [{"menu_item_id": item["id"], "qty": 1}],
                   "slot_id": target["id"], "payment_method": "UPI"}

        def _post():
            return requests.post(f"{API}/orders", headers=_h(student_tok), json=payload, timeout=15)

        with ThreadPoolExecutor(max_workers=10) as ex:
            results = list(ex.map(lambda _: _post(), range(10)))

        codes = [x.status_code for x in results]
        successes = codes.count(201)
        conflicts = codes.count(409)
        # Should not overbook
        assert successes <= 3, f"Overbooked! successes={successes}, codes={codes}"
        assert conflicts >= 1
        # Verify final slot booked <= 3
        slots_now = requests.get(f"{API}/slots", headers=_h(student_tok), timeout=10).json()
        final = next(s for s in slots_now if s["id"] == target["id"])
        assert final["booked"] <= final["capacity"]

        # Attempt one more order -> should be 409 (FULL if fully booked)
        if final["booked"] >= final["capacity"]:
            r2 = requests.post(f"{API}/orders", headers=_h(student_tok), json=payload, timeout=10)
            assert r2.status_code == 409


# ---------------- Role enforcement ----------------
class TestRoleEnforcement:
    def test_kitchen_orders_student_forbidden(self, student_tok):
        r = requests.get(f"{API}/kitchen/orders", headers=_h(student_tok), timeout=10)
        assert r.status_code == 403

    def test_admin_menu_student_forbidden(self, student_tok):
        r = requests.post(f"{API}/admin/menu", headers=_h(student_tok),
                          json={"name": "x", "price": 10, "category": "Snacks", "dietary": "VEG"}, timeout=10)
        assert r.status_code == 403

    def test_stock_toggle_student_forbidden(self, student_tok):
        r = requests.patch(f"{API}/menu/some-id/stock", headers=_h(student_tok),
                           json={"in_stock": False}, timeout=10)
        assert r.status_code == 403

    def test_analytics_student_forbidden(self, student_tok):
        r = requests.get(f"{API}/admin/analytics", headers=_h(student_tok), timeout=10)
        assert r.status_code == 403


# ---------------- Kitchen ----------------
class TestKitchen:
    def test_kitchen_lists_and_advances(self, kitchen_tok, student_tok):
        # ensure at least one active order exists
        item = _in_stock_item(student_tok)
        slot = _first_available_slot(student_tok)
        r0 = requests.post(f"{API}/orders", headers=_h(student_tok),
                           json={"items": [{"menu_item_id": item["id"], "qty": 1}],
                                 "slot_id": slot["id"], "payment_method": "CASH"}, timeout=10)
        assert r0.status_code == 201
        oid = r0.json()["id"]

        r = requests.get(f"{API}/kitchen/orders", headers=_h(kitchen_tok), timeout=10)
        assert r.status_code == 200
        body = r.json()
        assert "orders" in body and "aggregate" in body
        # ordering by slot_start_min
        starts = [o.get("slot_start_min", 0) for o in body["orders"]]
        assert starts == sorted(starts)

        # Advance status
        r2 = requests.patch(f"{API}/orders/{oid}/status", headers=_h(kitchen_tok),
                            json={"status": "PREPARING"}, timeout=10)
        assert r2.status_code == 200
        assert r2.json()["status"] == "PREPARING"

    def test_stock_toggle_hides_item(self, kitchen_tok, student_tok):
        item = _in_stock_item(student_tok)
        r = requests.patch(f"{API}/menu/{item['id']}/stock", headers=_h(kitchen_tok),
                           json={"in_stock": False}, timeout=10)
        assert r.status_code == 200
        assert r.json()["available"] is False
        menu = requests.get(f"{API}/menu", headers=_h(student_tok), timeout=10).json()
        got = next(m for m in menu if m["id"] == item["id"])
        assert got["available"] is False
        # restore
        requests.patch(f"{API}/menu/{item['id']}/stock", headers=_h(kitchen_tok),
                       json={"in_stock": True}, timeout=10)


# ---------------- Admin Menu CRUD ----------------
class TestAdminMenu:
    def test_full_crud_flow(self, admin_tok, student_tok):
        payload = {"name": "TEST Item", "description": "test", "price": 25.5,
                   "category": "Snacks", "dietary": "VEG"}
        c = requests.post(f"{API}/admin/menu", headers=_h(admin_tok), json=payload, timeout=10)
        assert c.status_code == 201
        item = c.json()
        iid = item["id"]
        # verify via GET menu
        menu = requests.get(f"{API}/menu", headers=_h(student_tok), timeout=10).json()
        assert any(m["id"] == iid for m in menu)

        u = requests.patch(f"{API}/admin/menu/{iid}", headers=_h(admin_tok),
                          json={"price": 30}, timeout=10)
        assert u.status_code == 200 and u.json()["price"] == 30

        d = requests.delete(f"{API}/admin/menu/{iid}", headers=_h(admin_tok), timeout=10)
        assert d.status_code == 200
        # soft-deleted -> not in list
        menu2 = requests.get(f"{API}/menu", headers=_h(student_tok), timeout=10).json()
        assert all(m["id"] != iid for m in menu2)


# ---------------- Admin Analytics ----------------
class TestAnalytics:
    def test_analytics_shape(self, admin_tok):
        r = requests.get(f"{API}/admin/analytics", headers=_h(admin_tok), timeout=10)
        assert r.status_code == 200
        d = r.json()
        for k in ["total_revenue", "total_orders", "avg_order",
                  "peak_intervals", "top_sellers", "status_counts"]:
            assert k in d
        assert isinstance(d["peak_intervals"], list)
        assert isinstance(d["top_sellers"], list)
