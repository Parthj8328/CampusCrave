import asyncio, json, urllib.request, websockets

BASE = "http://localhost:8001/api"

def post(path, body, token=None):
    data = json.dumps(body).encode()
    req = urllib.request.Request(BASE + path, data=data, method="POST")
    req.add_header("Content-Type", "application/json")
    if token: req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

def patch(path, body, token):
    data = json.dumps(body).encode()
    req = urllib.request.Request(BASE + path, data=data, method="PATCH")
    req.add_header("Content-Type", "application/json")
    req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

def get(path, token):
    req = urllib.request.Request(BASE + path)
    req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

async def main():
    stu = post("/auth/login", {"email":"student@campus.edu","password":"password123"})["access_token"]
    kit = post("/auth/login", {"email":"kitchen@campus.edu","password":"password123"})["access_token"]
    adm = post("/auth/login", {"email":"admin@campus.edu","password":"password123"})["access_token"]

    slots = get("/slots", stu)
    slot = next(s for s in slots if s["status"] != "FULL")
    order = post("/orders", {"items":[{"menu_item_id":"m-veg-burger","qty":1}],"slot_id":slot["id"],"payment_method":"UPI"}, stu)
    oid = order["id"]
    print("order created", order["token"], "rating field:", order.get("rating"))

    # Connect WS and listen
    received = []
    async with websockets.connect(f"ws://localhost:8001/api/ws?order_id={oid}") as ws:
        await asyncio.sleep(0.3)
        # advance through statuses from kitchen
        for st in ["PREPARING","READY_FOR_PICKUP","COLLECTED"]:
            patch(f"/orders/{oid}/status", {"status":st}, kit)
            msg = await asyncio.wait_for(ws.recv(), timeout=5)
            received.append(json.loads(msg))
    print("WS messages received:", [m["status"] for m in received])

    # rate after collected
    rated = post(f"/orders/{oid}/rating", {"rating":5,"comment":"Loved it!"}, stu)
    print("rated ->", rated.get("rating"), rated.get("rating_comment"))

    # analytics has rating fields
    a = get("/admin/analytics", adm)
    print("analytics avg_rating:", a.get("avg_rating"), "rated_count:", a.get("rated_count"), "feedback:", len(a.get("recent_feedback",[])))

    # rating before collected should 409
    slot2 = next(s for s in get("/slots", stu) if s["status"]!="FULL")
    o2 = post("/orders", {"items":[{"menu_item_id":"s-fries","qty":1}],"slot_id":slot2["id"],"payment_method":"CASH"}, stu)
    try:
        post(f"/orders/{o2['id']}/rating", {"rating":4}, stu)
        print("ERROR: rating allowed before collected")
    except urllib.error.HTTPError as e:
        print("rating-before-collected correctly rejected:", e.code)

asyncio.run(main())
