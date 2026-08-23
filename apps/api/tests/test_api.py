def create(client, scenario="SAFE", text="Assess a routine public documentation change"):
    return client.post("/api/v1/executions?wait=true", json={"request": text, "scenario": scenario})


def test_async_creation_returns_queued_before_workflow_completion(tmp_path):
    from fastapi.testclient import TestClient

    from app.config import Settings
    from app.main import create_app

    settings = Settings(
        database_url=f"sqlite:///{tmp_path}/async.db",
        inference_mode="fake",
        demo_step_delay_ms=40,
    )
    with TestClient(create_app(settings)) as async_client:
        response = async_client.post(
            "/api/v1/executions",
            json={"request": "Assess a routine public documentation change", "scenario": "SAFE"},
        )
        assert response.status_code == 201
        assert response.json()["status"] == "QUEUED"


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
    approved = client.post(
        f"/api/v1/executions/{body['execution_id']}/approve",
        json={"actor": "operator", "reason": "Canary controls verified"},
    )
    assert approved.status_code == 200
    assert approved.json()["status"] == "COMPLETED"
    assert approved.json()["result"] == "APPROVED"


def test_rejection_takes_explicit_cancel_path(client):
    body = create(client, "HIGH_RISK", "Assess production deletion change").json()
    rejected = client.post(
        f"/api/v1/executions/{body['execution_id']}/reject",
        json={"actor": "operator", "reason": "Risk is unacceptable"},
    )
    assert rejected.json()["status"] == "CANCELLED"
    assert rejected.json()["result"] == "REJECTED"
    reloaded = client.get(f"/api/v1/executions/{body['execution_id']}").json()
    assert reloaded["status"] == "CANCELLED"


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
        "execution.started",
        "agent.started",
        "routing.selected",
        "execution.completed",
    }
    with client.stream("GET", f"/api/v1/executions/{body['execution_id']}/stream") as response:
        content = "".join(response.iter_text())
    assert "event: execution.completed" in content
    assert '"schema_version":"1.0"' in content


def test_validation_and_not_found(client):
    assert client.post("/api/v1/executions", json={"request": "tiny"}).status_code == 422
    assert client.get("/api/v1/executions/00000000-0000-0000-0000-000000000000").status_code == 404


def test_history_filters_pagination_and_authoritative_routing(client):
    safe = create(client).json()
    create(client, "HIGH_RISK", "Assess whether a production deployment should proceed")
    page = client.get("/api/v1/executions", params={"scenario": "SAFE", "page_size": 1}).json()
    assert page["total"] == 1
    assert page["items"][0]["execution_id"] == safe["execution_id"]
    route = client.get(f"/api/v1/executions/{safe['execution_id']}/routing").json()["items"][0]
    assert route["model"] == "fast"
    assert route["route_reason"]
    assert route["placement"] == "eu-api"


def test_only_invoking_agent_has_model_and_cost_telemetry(client):
    body = create(client).json()
    events = client.get(f"/api/v1/executions/{body['execution_id']}/events").json()
    metered = [event for event in events if event["prompt_tokens"] is not None]
    assert len(metered) == 1
    assert metered[0]["agent_id"] == "risk-analysis"
    assert metered[0]["estimated_cost_eur"] is not None
    sequences = [event["sequence"] for event in events]
    assert sequences == list(range(1, len(events) + 1))
    metrics = client.get("/api/v1/observability/metrics").json()
    assert metrics["invocation_count"] == 1
    assert metrics["prompt_tokens"] == metered[0]["prompt_tokens"]
    assert metrics["estimated_cost_eur"] == metered[0]["estimated_cost_eur"]


def test_checkpoint_resume_after_application_restart(tmp_path):
    from fastapi.testclient import TestClient

    from app.config import Settings
    from app.main import create_app

    settings = Settings(database_url=f"sqlite:///{tmp_path}/restart.db", inference_mode="fake")
    first = TestClient(create_app(settings))
    body = create(first, "HIGH_RISK", "Assess production firewall replacement").json()
    assert body["status"] == "WAITING_APPROVAL"
    before = first.get(f"/api/v1/executions/{body['execution_id']}/events").json()
    second = TestClient(create_app(settings))
    resumed = second.post(
        f"/api/v1/executions/{body['execution_id']}/approve",
        json={"actor": "operator", "reason": "Recovery checkpoint validated"},
    )
    assert resumed.status_code == 200
    assert resumed.json()["status"] == "COMPLETED"
    after = second.get(f"/api/v1/executions/{body['execution_id']}/events").json()
    assert sum(event["event_type"] == "routing.selected" for event in after) == 1
    assert len(after) > len(before)
