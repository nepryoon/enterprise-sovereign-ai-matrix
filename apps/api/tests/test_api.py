def create(client, scenario="SAFE", text="Assess a routine public documentation change"):
    return client.post("/api/v1/executions", json={"request": text, "scenario": scenario})


def test_health_and_security_headers(client):
    response = client.get("/api/v1/health/ready")
    assert response.status_code == 200
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"


def test_fastapi_to_langgraph_low_risk(client):
    response = create(client)
    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "COMPLETED"
    detail = client.get(f"/api/v1/executions/{body['execution_id']}").json()
    assert detail["result"] == "APPROVED"
    assert any(event["event_type"] == "workflow.completed" for event in detail["audit"])


def test_high_risk_interrupt_api_approval_resume(client):
    response = create(client, "HIGH_RISK", "Assess whether a production deployment should proceed")
    body = response.json()
    assert body["status"] == "WAITING_APPROVAL"
    approved = client.post(f"/api/v1/executions/{body['execution_id']}/approve",
                           json={"actor": "operator", "reason": "Canary controls verified"})
    assert approved.status_code == 200
    assert approved.json()["status"] == "COMPLETED"
    assert approved.json()["result"] == "APPROVED"


def test_rejection_takes_explicit_cancel_path(client):
    body = create(client, "HIGH_RISK", "Assess production deletion change").json()
    rejected = client.post(f"/api/v1/executions/{body['execution_id']}/reject",
                           json={"actor": "operator", "reason": "Risk is unacceptable"})
    assert rejected.json()["status"] == "CANCELLED"
    assert rejected.json()["result"] == "REJECTED"


def test_duplicate_approval_conflict(client):
    body = create(client, "HIGH_RISK", "Assess production network change").json()
    url = f"/api/v1/executions/{body['execution_id']}/approve"
    payload = {"actor": "operator", "reason": "Controls accepted"}
    assert client.post(url, json=payload).status_code == 200
    assert client.post(url, json=payload).status_code == 409


def test_provider_failure_recorded(client):
    body = create(client, "PROVIDER_FAILURE", "Assess restricted customer database change").json()
    assert body["status"] == "FAILED"
    assert "ProviderUnavailableError" in body["error"]


def test_malformed_response_recorded(client):
    body = create(client, "MALFORMED_RESPONSE").json()
    assert body["status"] == "FAILED"
    assert "Malformed inference response" in body["error"]


def test_events_persist_and_sse_replays(client):
    body = create(client).json()
    events = client.get(f"/api/v1/executions/{body['execution_id']}/events").json()
    assert {e["event_type"] for e in events} >= {
        "execution.started", "agent.started", "routing.selected", "execution.completed"
    }
    with client.stream("GET", f"/api/v1/executions/{body['execution_id']}/stream") as response:
        content = "".join(response.iter_text())
    assert "event: execution.completed" in content
    assert '"schema_version":"1.0"' in content


def test_validation_and_not_found(client):
    assert client.post("/api/v1/executions", json={"request": "tiny"}).status_code == 422
    assert client.get("/api/v1/executions/00000000-0000-0000-0000-000000000000").status_code == 404

def test_checkpoint_resume_after_application_restart(tmp_path):
    from fastapi.testclient import TestClient
    from app.config import Settings
    from app.main import create_app

    settings = Settings(database_url=f"sqlite:///{tmp_path}/restart.db", inference_mode="fake")
    first = TestClient(create_app(settings))
    body = create(first, "HIGH_RISK", "Assess production firewall replacement").json()
    assert body["status"] == "WAITING_APPROVAL"
    second = TestClient(create_app(settings))
    resumed = second.post(f"/api/v1/executions/{body['execution_id']}/approve",
                          json={"actor": "operator", "reason": "Recovery checkpoint validated"})
    assert resumed.status_code == 200
    assert resumed.json()["status"] == "COMPLETED"
