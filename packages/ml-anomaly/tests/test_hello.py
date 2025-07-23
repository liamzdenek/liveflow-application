"""Hello unit test module."""

from ml_anomaly.hello import hello


def test_hello():
    """Test the hello function."""
    assert hello() == "Hello ml-anomaly"
