import pytest

from app.domain import Criticality, DataSensitivity, ModelClass, ProviderUnavailableError
from app.routing.policy import RoutingContext, RoutingPolicy


@pytest.mark.parametrize(("criticality", "sensitivity", "expected"), [
    (Criticality.LOW, DataSensitivity.PUBLIC, ModelClass.FAST),
    (Criticality.MEDIUM, DataSensitivity.INTERNAL, ModelClass.BALANCED),
    (Criticality.HIGH, DataSensitivity.PUBLIC, ModelClass.REASONING),
    (Criticality.LOW, DataSensitivity.PII, ModelClass.SOVEREIGN),
    (Criticality.HIGH, DataSensitivity.RESTRICTED, ModelClass.SOVEREIGN),
])
def test_policy_routes(criticality, sensitivity, expected):
    assert RoutingPolicy().select(RoutingContext(
        criticality=criticality, sensitivity=sensitivity)).model_class is expected


def test_sensitive_data_fails_closed():
    with pytest.raises(ProviderUnavailableError, match="cloud fallback denied"):
        RoutingPolicy().select(RoutingContext(criticality=Criticality.HIGH,
                                              sensitivity=DataSensitivity.RESTRICTED,
                                              sovereign_available=False))


def test_fast_provider_has_approved_balanced_fallback():
    decision = RoutingPolicy().select(RoutingContext(criticality=Criticality.LOW,
                                                      sensitivity=DataSensitivity.PUBLIC,
                                                      fast_available=False))
    assert decision.model_class is ModelClass.BALANCED
