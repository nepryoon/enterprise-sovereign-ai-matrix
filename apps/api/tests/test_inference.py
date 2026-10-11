import pytest

from app.agents.inference import DeterministicFakeInference
from app.domain import ModelClass, ProviderUnavailableError, RoutingDecision


@pytest.fixture
def route():
    return RoutingDecision(
        model_class=ModelClass.FAST,
        provider="fake",
        model="fast",
        reason="test",
        fallback_allowed=False,
    )


def test_fake_is_deterministic(route):
    client = DeterministicFakeInference()
    assert client.invoke("hello", route, "SAFE") == client.invoke("hello", route, "SAFE")


def test_fake_provider_failure(route):
    with pytest.raises(ProviderUnavailableError):
        DeterministicFakeInference().invoke("hello", route, "PROVIDER_FAILURE")


def test_fake_timeout(route):
    with pytest.raises(TimeoutError):
        DeterministicFakeInference().invoke("hello", route, "TIMEOUT")


def test_fake_invocation_is_marked_simulated(route):
    assert DeterministicFakeInference().invoke("hello", route, "SAFE").simulated is True


def test_live_invocation_is_not_marked_simulated(route, monkeypatch):
    import httpx

    from app.agents.inference import LiteLLMInference

    def stub_post(url, **_kwargs):
        return httpx.Response(
            200,
            json={
                "choices": [{"message": {"content": "Risk LOW."}}],
                "usage": {"prompt_tokens": 3, "completion_tokens": 2},
            },
            request=httpx.Request("POST", url),
        )

    monkeypatch.setattr(httpx, "post", stub_post)
    invocation = LiteLLMInference("http://gateway.test", "key").invoke("hello", route, "SAFE")
    assert invocation.simulated is False
    assert invocation.prompt_tokens == 3
