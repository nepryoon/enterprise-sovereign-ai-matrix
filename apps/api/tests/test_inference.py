import pytest

from app.agents.inference import DeterministicFakeInference
from app.domain import ModelClass, ProviderUnavailableError, RoutingDecision


@pytest.fixture
def route():
    return RoutingDecision(model_class=ModelClass.FAST, provider="fake", model="fast",
                           reason="test", fallback_allowed=False)


def test_fake_is_deterministic(route):
    client = DeterministicFakeInference()
    assert client.invoke("hello", route, "SAFE") == client.invoke("hello", route, "SAFE")


def test_fake_provider_failure(route):
    with pytest.raises(ProviderUnavailableError):
        DeterministicFakeInference().invoke("hello", route, "PROVIDER_FAILURE")


def test_fake_timeout(route):
    with pytest.raises(TimeoutError):
        DeterministicFakeInference().invoke("hello", route, "TIMEOUT")
