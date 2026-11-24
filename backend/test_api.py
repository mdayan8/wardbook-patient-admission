import os
from datetime import timedelta

os.environ["DATABASE_URL"] = "sqlite:///./test_patients.db"
if os.path.exists("test_patients.db"):
    os.remove("test_patients.db")

from fastapi.testclient import TestClient  # noqa: E402
from main import app, today_ist  # noqa: E402

c = TestClient(app)
GOOD = dict(name="Asha Rao", age=30, gender="Female", ward="ICU", department="Cardiology",
            doctor="Dr. Ananya Rao", admission_date=today_ist().isoformat())


def bad(**override):
    r = c.post("/api/patients", json={**GOOD, **override})
    assert r.status_code == 422, r.text
    return r.json()["errors"]


def test_validation_rejects_bad_data():
    assert "letters" in bad(name="R2D2")["name"]
    assert "required" in bad(name="  ")["name"]
    assert "between 0 and 120" in bad(age=121)["age"]
    assert "between 0 and 120" in bad(age=-1)["age"]
    assert "required" in bad(age="")["age"]
    assert "one of" in bad(ward="Roof")["ward"]
    assert "required" in bad(gender="")["gender"]
    assert "future" in bad(admission_date=(today_ist() + timedelta(days=1)).isoformat())["admission_date"]
    assert "not in the" in bad(doctor="Dr. Priya Nair")["form"]


def test_crud_flow():
    p = c.post("/api/patients", json=GOOD).json()
    assert p["status"] == "Admitted" and p["name"] == "Asha Rao"
    assert any(x["id"] == p["id"] for x in c.get("/api/patients", params={"search": "asha"}).json())
    assert c.get("/api/patients", params={"ward": "Maternity Ward", "search": "asha"}).json() == []
    u = c.put(f"/api/patients/{p['id']}", json={**GOOD, "age": 31}).json()
    assert u["age"] == 31
    d = c.patch(f"/api/patients/{p['id']}/status", json={"status": "Discharged"}).json()
    assert d["status"] == "Discharged" and d["discharge_date"]
    assert c.delete(f"/api/patients/{p['id']}").status_code == 204
    assert c.delete(f"/api/patients/{p['id']}").status_code == 404
