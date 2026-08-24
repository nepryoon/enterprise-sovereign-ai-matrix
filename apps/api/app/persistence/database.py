from __future__ import annotations

from datetime import datetime
from threading import RLock
from uuid import UUID

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    create_engine,
    func,
    inspect,
    select,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column

from app.domain import AuditEvent, Execution, TelemetryEvent


class Base(DeclarativeBase):
    """SQLAlchemy declarative metadata root."""


class ExecutionRow(Base):
    __tablename__ = "executions"
    execution_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    payload: Mapped[str] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class EventRow(Base):
    __tablename__ = "telemetry_events"
    event_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    execution_id: Mapped[str] = mapped_column(ForeignKey("executions.execution_id"), index=True)
    sequence: Mapped[int] = mapped_column(Integer, default=0, index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    payload: Mapped[str] = mapped_column(Text)


class AuditRow(Base):
    __tablename__ = "audit_events"
    event_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    execution_id: Mapped[str] = mapped_column(ForeignKey("executions.execution_id"), index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    payload: Mapped[str] = mapped_column(Text)


class Repository:
    def __init__(self, database_url: str) -> None:
        args = {"check_same_thread": False} if database_url.startswith("sqlite") else {}
        self.engine = create_engine(database_url, connect_args=args, pool_pre_ping=True)
        Base.metadata.create_all(self.engine)
        self._migrate_event_sequence()
        self._lock = RLock()

    def _migrate_event_sequence(self) -> None:
        """Small backward-compatible migration for the versioned event contract.

        A full migration runner remains the production recommendation; this additive,
        non-destructive column migration keeps existing PoC databases readable.
        """
        columns = {
            column["name"] for column in inspect(self.engine).get_columns("telemetry_events")
        }
        if "sequence" not in columns:
            with self.engine.begin() as connection:
                connection.exec_driver_sql(
                    "ALTER TABLE telemetry_events ADD COLUMN sequence INTEGER NOT NULL DEFAULT 0"
                )
        with Session(self.engine) as session:
            execution_ids = session.scalars(select(EventRow.execution_id).distinct()).all()
            for execution_id in execution_ids:
                rows = session.scalars(
                    select(EventRow)
                    .where(EventRow.execution_id == execution_id)
                    .order_by(EventRow.timestamp, EventRow.event_id)
                ).all()
                for sequence, row in enumerate(rows, 1):
                    if not row.sequence:
                        row.sequence = sequence
                        event = TelemetryEvent.model_validate_json(row.payload)
                        event.sequence = sequence
                        row.payload = event.model_dump_json()
            session.commit()

    def save_execution(self, execution: Execution) -> None:
        with self._lock, Session(self.engine) as session:
            row = session.get(ExecutionRow, str(execution.execution_id))
            payload = execution.model_dump_json()
            if row:
                row.payload, row.updated_at = payload, execution.updated_at
            else:
                session.add(
                    ExecutionRow(
                        execution_id=str(execution.execution_id),
                        payload=payload,
                        updated_at=execution.updated_at,
                    )
                )
            session.commit()

    def get_execution(self, execution_id: UUID) -> Execution | None:
        with Session(self.engine) as session:
            row = session.get(ExecutionRow, str(execution_id))
            return Execution.model_validate_json(row.payload) if row else None

    def add_event(self, event: TelemetryEvent) -> None:
        with self._lock, Session(self.engine) as session:
            previous_sequence = session.scalar(
                select(func.coalesce(func.max(EventRow.sequence), 0)).where(
                    EventRow.execution_id == str(event.execution_id)
                )
            )
            sequence = (previous_sequence or 0) + 1
            event.sequence = sequence
            session.add(
                EventRow(
                    event_id=str(event.event_id),
                    execution_id=str(event.execution_id),
                    sequence=sequence,
                    timestamp=event.timestamp,
                    payload=event.model_dump_json(),
                )
            )
            session.commit()

    def events(self, execution_id: UUID, after_id: str | None = None) -> list[TelemetryEvent]:
        with Session(self.engine) as session:
            rows = session.scalars(
                select(EventRow)
                .where(EventRow.execution_id == str(execution_id))
                .order_by(EventRow.sequence)
            ).all()
        events = [TelemetryEvent.model_validate_json(row.payload) for row in rows]
        if after_id:
            ids = [str(event.event_id) for event in events]
            if after_id in ids:
                events = events[ids.index(after_id) + 1 :]
        return events

    def list_executions(
        self,
        *,
        status: str | None = None,
        scenario: str | None = None,
        offset: int = 0,
        limit: int = 50,
    ) -> tuple[list[Execution], int]:
        with Session(self.engine) as session:
            rows = session.scalars(
                select(ExecutionRow).order_by(ExecutionRow.updated_at.desc())
            ).all()
        executions = [Execution.model_validate_json(row.payload) for row in rows]
        if status:
            executions = [item for item in executions if item.status.value == status]
        if scenario:
            executions = [item for item in executions if item.scenario == scenario]
        return executions[offset : offset + limit], len(executions)

    def add_audit(self, event: AuditEvent) -> None:
        with self._lock, Session(self.engine) as session:
            session.add(
                AuditRow(
                    event_id=str(event.event_id),
                    execution_id=str(event.execution_id),
                    timestamp=event.timestamp,
                    payload=event.model_dump_json(),
                )
            )
            session.commit()

    def audits(self, execution_id: UUID) -> list[AuditEvent]:
        with Session(self.engine) as session:
            rows = session.scalars(
                select(AuditRow)
                .where(AuditRow.execution_id == str(execution_id))
                .order_by(AuditRow.timestamp)
            ).all()
        return [AuditEvent.model_validate_json(row.payload) for row in rows]

    def health(self) -> bool:
        try:
            with Session(self.engine) as session:
                session.execute(select(1))
            return True
        except Exception:
            return False
