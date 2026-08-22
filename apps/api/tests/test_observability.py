from app.observability.langfuse import TraceAdapter


def test_trace_id_deterministic_and_adapter_degrades():
    adapter = TraceAdapter(enabled=True)
    assert adapter.trace_id("execution") == adapter.trace_id("execution")
    adapter.record("node", "execution", {"prompt": "restricted", "latency_ms": 10})
