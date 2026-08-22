import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


@pytest.fixture
def app(tmp_path):
    return create_app(Settings(database_url=f"sqlite:///{tmp_path}/test.db", inference_mode="fake"))


@pytest.fixture
def client(app):
    return TestClient(app)
