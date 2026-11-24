"""Patient Admission Management API (FastAPI + SQLAlchemy).

Runs on SQLite locally and on Postgres in production (set DATABASE_URL).
If ../frontend/dist exists, the built React app is served from "/" too,
so one service hosts both frontend and backend.
"""

import os
import re
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, field_validator, model_validator
from sqlalchemy import (Column, Date, Integer, MetaData, String, Table, create_engine,
                        delete, func, insert, inspect, or_, select, update)

# ---------- Reference lists (single source of truth for both UI and API) ----------

GENDERS = ["Male", "Female", "Other"]
WARDS = ["General Ward", "ICU", "Pediatric Ward", "Maternity Ward", "Surgical Ward", "Private Room"]
DOCTORS_BY_DEPARTMENT = {
    "Cardiology": ["Dr. Ananya Rao", "Dr. Vikram Mehta"],
    "Neurology": ["Dr. Priya Nair", "Dr. Arjun Shetty"],
    "Orthopedics": ["Dr. Rahul Verma", "Dr. Kavya Iyer"],
    "Pediatrics": ["Dr. Sneha Kulkarni", "Dr. Farhan Ali"],
    "General Medicine": ["Dr. Meera Joshi", "Dr. Sanjay Gupta"],
    "Obstetrics & Gynecology": ["Dr. Lakshmi Menon", "Dr. Divya Reddy"],
}
DEPARTMENTS = list(DOCTORS_BY_DEPARTMENT)
DOCTORS = [d for docs in DOCTORS_BY_DEPARTMENT.values() for d in docs]
STATUSES = ["Admitted", "Discharged"]

NAME_RE = re.compile(r"^[A-Za-z]+(?: [A-Za-z]+)*$")  # letters, single spaces between words
IST = timezone(timedelta(hours=5, minutes=30))  # hospital runs on India time


def today_ist() -> date:
    return datetime.now(IST).date()


# ---------- Database ----------

db_url = os.getenv("DATABASE_URL") or os.getenv("POSTGRES_URL")  # POSTGRES_URL: Vercel/Neon integration
if not db_url:
    if os.getenv("VERCEL"):  # serverless disk is wiped between requests, SQLite would lose data
        raise RuntimeError("Set DATABASE_URL to a Postgres database (e.g. Neon) in the Vercel project settings")
    db_url = f"sqlite:///{Path(__file__).resolve().parent / 'patients.db'}"
if db_url.startswith("postgres://"):  # Render/Heroku style URL
    db_url = db_url.replace("postgres://", "postgresql+psycopg://", 1)
elif db_url.startswith("postgresql://"):
    db_url = db_url.replace("postgresql://", "postgresql+psycopg://", 1)

engine = create_engine(db_url, pool_pre_ping=True)
metadata = MetaData()
patients = Table(
    "patients", metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("name", String(60), nullable=False),
    Column("age", Integer, nullable=False),
    Column("gender", String(20), nullable=False),
    Column("ward", String(40), nullable=False),
    Column("department", String(40), nullable=False),
    Column("doctor", String(60), nullable=False),
    Column("admission_date", Date, nullable=False),
    Column("status", String(20), nullable=False, default="Admitted"),
    Column("discharge_date", Date, nullable=True),
)

SEED = [
    ("Ravi Kumar", 54, "Male", "ICU", "Cardiology", "Dr. Ananya Rao", 3, "Admitted"),
    ("Aisha Khan", 29, "Female", "Maternity Ward", "Obstetrics & Gynecology", "Dr. Lakshmi Menon", 2, "Admitted"),
    ("Rohan Das", 8, "Male", "Pediatric Ward", "Pediatrics", "Dr. Sneha Kulkarni", 5, "Admitted"),
    ("Sunita Sharma", 67, "Female", "General Ward", "General Medicine", "Dr. Meera Joshi", 9, "Discharged"),
    ("Karthik Iyer", 41, "Male", "Surgical Ward", "Orthopedics", "Dr. Rahul Verma", 1, "Admitted"),
    ("Neha Patil", 35, "Female", "Private Room", "Neurology", "Dr. Priya Nair", 4, "Admitted"),
]


def init_db() -> None:
    fresh = not inspect(engine).has_table("patients")
    metadata.create_all(engine)
    if fresh:  # demo rows only on the very first start, never again
        t = today_ist()
        with engine.begin() as conn:
            conn.execute(insert(patients), [
                dict(name=n, age=a, gender=g, ward=w, department=d, doctor=doc,
                     admission_date=t - timedelta(days=ago), status=s,
                     discharge_date=t if s == "Discharged" else None)
                for n, a, g, w, d, doc, ago, s in SEED
            ])


# ---------- Validation ----------

class PatientIn(BaseModel):
    name: str
    age: int
    gender: str
    ward: str
    department: str
    doctor: str
    admission_date: date

    @field_validator("name", mode="before")
    @classmethod
    def check_name(cls, v):
        v = " ".join(str(v or "").split())  # trim + collapse spaces
        if not v:
            raise ValueError("Name is required")
        if len(v) > 60:
            raise ValueError("Name must be 60 characters or fewer")
        if not NAME_RE.match(v):
            raise ValueError("Name can contain letters and spaces only")
        return v

    @field_validator("age", mode="before")
    @classmethod
    def check_age(cls, v):
        if v is None or str(v).strip() == "":
            raise ValueError("Age is required")
        try:
            f = float(v)
        except (TypeError, ValueError):
            raise ValueError("Age must be a number")
        if not f.is_integer():
            raise ValueError("Age must be a whole number")
        if not 0 <= f <= 120:
            raise ValueError("Age must be between 0 and 120")
        return int(f)

    @field_validator("gender", "ward", "department", "doctor", mode="before")
    @classmethod
    def check_select(cls, v, info):
        allowed = {"gender": GENDERS, "ward": WARDS, "department": DEPARTMENTS, "doctor": DOCTORS}[info.field_name]
        label = info.field_name.capitalize()
        if not v:
            raise ValueError(f"{label} is required")
        if v not in allowed:
            raise ValueError(f"{label} must be one of: {', '.join(allowed)}")
        return v

    @field_validator("admission_date", mode="before")
    @classmethod
    def check_date_present(cls, v):
        if not v:
            raise ValueError("Admission date is required")
        return v

    @field_validator("admission_date")
    @classmethod
    def check_date_not_future(cls, v: date):
        if v > today_ist():
            raise ValueError("Admission date cannot be in the future")
        return v

    @model_validator(mode="after")
    def doctor_in_department(self):
        if self.doctor not in DOCTORS_BY_DEPARTMENT[self.department]:
            raise ValueError(f"{self.doctor} is not in the {self.department} department")
        return self


class StatusIn(BaseModel):
    status: Literal["Admitted", "Discharged"]


# ---------- App ----------

app = FastAPI(title="Patient Admission API")
init_db()


@app.exception_handler(RequestValidationError)
async def validation_error(_: Request, exc: RequestValidationError):
    """Turn pydantic's verbose errors into {message, errors: {field: msg}}."""
    errors = {}
    for e in exc.errors():
        loc = [str(p) for p in e["loc"] if p != "body"]
        field = loc[0] if loc else "form"
        msg = e["msg"].removeprefix("Value error, ")
        if e["type"] == "missing":
            msg = f"{field.replace('_', ' ').capitalize()} is required"
        elif e["type"] in ("date_from_datetime_parsing", "date_parsing", "date_type"):
            msg = "Admission date must be a valid date (YYYY-MM-DD)"
        errors.setdefault(field, msg)
    first = next(iter(errors.values()), "Invalid data")
    return JSONResponse(status_code=422, content={"message": first, "errors": errors})


def row_to_dict(r) -> dict:
    d = dict(r._mapping)
    d["admission_date"] = d["admission_date"].isoformat()
    d["discharge_date"] = d["discharge_date"].isoformat() if d["discharge_date"] else None
    return d


def get_or_404(conn, pid: int):
    row = conn.execute(select(patients).where(patients.c.id == pid)).first()
    if not row:
        raise HTTPException(404, detail=f"Patient #{pid} not found")
    return row


@app.exception_handler(HTTPException)
async def http_error(_: Request, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code, content={"message": exc.detail})


@app.get("/api/options")
def options():
    return {"genders": GENDERS, "wards": WARDS, "departments": DEPARTMENTS,
            "doctorsByDepartment": DOCTORS_BY_DEPARTMENT, "statuses": STATUSES,
            "today": today_ist().isoformat()}


@app.get("/api/patients")
def list_patients(search: str = "", ward: str = "", department: str = "", doctor: str = "", status: str = ""):
    q = select(patients).order_by(patients.c.admission_date.desc(), patients.c.id.desc())
    if search.strip():
        q = q.where(func.lower(patients.c.name).contains(search.strip().lower()))
    for col, val in (("ward", ward), ("department", department), ("doctor", doctor), ("status", status)):
        if val:
            q = q.where(patients.c[col] == val)
    with engine.connect() as conn:
        return [row_to_dict(r) for r in conn.execute(q)]


@app.post("/api/patients", status_code=201)
def create_patient(p: PatientIn):
    with engine.begin() as conn:
        pid = conn.execute(insert(patients).values(**p.model_dump(), status="Admitted")).inserted_primary_key[0]
        return row_to_dict(get_or_404(conn, pid))


@app.put("/api/patients/{pid}")
def update_patient(pid: int, p: PatientIn):
    with engine.begin() as conn:
        get_or_404(conn, pid)
        conn.execute(update(patients).where(patients.c.id == pid).values(**p.model_dump()))
        return row_to_dict(get_or_404(conn, pid))


@app.patch("/api/patients/{pid}/status")
def set_status(pid: int, body: StatusIn):
    with engine.begin() as conn:
        get_or_404(conn, pid)
        discharge = today_ist() if body.status == "Discharged" else None
        conn.execute(update(patients).where(patients.c.id == pid)
                     .values(status=body.status, discharge_date=discharge))
        return row_to_dict(get_or_404(conn, pid))


@app.delete("/api/patients/{pid}", status_code=204)
def delete_patient(pid: int):
    with engine.begin() as conn:
        get_or_404(conn, pid)
        conn.execute(delete(patients).where(patients.c.id == pid))


@app.get("/api/health")
def health():
    return {"ok": True}


dist = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if dist.is_dir():
    app.mount("/", StaticFiles(directory=dist, html=True), name="frontend")
