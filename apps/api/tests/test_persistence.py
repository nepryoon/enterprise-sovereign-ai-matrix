from app.domain import AuditEvent, Execution, TelemetryEvent
from app.persistence.database import Repository


def test_persistence_survives_repository_restart(tmp_path):
    url = f"sqlite:///{tmp_path}/durable.db"
    first = Repository(url)
    execution = Execution(request="A sufficiently detailed decision request")
    first.save_execution(execution)
    first.add_event(TelemetryEvent(execution_id=execution.execution_id,
                                   correlation_id=execution.correlation_id,
                                   event_type="execution.started"))
    first.add_audit(AuditEvent(execution_id=execution.execution_id,
                               event_type="execution.created"))
    second = Repository(url)
    assert second.get_execution(execution.execution_id) == execution
    assert second.events(execution.execution_id)[0].event_type == "execution.started"
    assert second.audits(execution.execution_id)[0].event_type == "execution.created"
