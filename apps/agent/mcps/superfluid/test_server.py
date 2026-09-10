"""Unit tests for the Superfluid CFA MCP server."""

import unittest
from unittest.mock import patch, MagicMock


class TestSuperfluidMcp(unittest.TestCase):
    def test_imports(self):
        """Verify the MCP server module and tools can be imported."""
        from server import (
            create_yield_stream,
            update_flow_rate,
            delete_stream,
            get_active_streams,
            get_stream_balance,
            validate_receiver,
            validate_flow_rate,
            calculate_deterministic_flow_rate,
            SuperfluidError,
            mcp,
        )
        self.assertEqual(mcp.name, "superfluid")
        self.assertTrue(callable(create_yield_stream))
        self.assertTrue(callable(update_flow_rate))
        self.assertTrue(callable(delete_stream))
        self.assertTrue(callable(get_active_streams))
        self.assertTrue(callable(get_stream_balance))

    def test_deterministic_flow_calculation(self):
        """Verify deterministic flow rate formula (rent * share% / 2,592,000 * 1e18)."""
        from server import calculate_deterministic_flow_rate, SuperfluidError

        # $3800/mo * 10% share = $380/mo. $380 / 2592000 * 1e18 = 146604938271604 wei/sec
        flow = calculate_deterministic_flow_rate(3800, 10.0)
        self.assertEqual(flow, 146604938271604)

        # Invalid rent
        with self.assertRaises(SuperfluidError):
            calculate_deterministic_flow_rate(-100, 10.0)

        # Invalid share
        with self.assertRaises(SuperfluidError):
            calculate_deterministic_flow_rate(3800, 150.0)

    def test_receiver_validation(self):
        """Verify EVM receiver address validation rejects invalid inputs."""
        from server import validate_receiver, SuperfluidError

        valid = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
        self.assertEqual(validate_receiver(valid), valid)

        # Zero address
        with self.assertRaises(SuperfluidError):
            validate_receiver("0x0000000000000000000000000000000000000000")

        # Too short
        with self.assertRaises(SuperfluidError):
            validate_receiver("0x12345")

        # Non-hex
        with self.assertRaises(SuperfluidError):
            validate_receiver("0xZZ997970C51812dc3A010C7d01b50e0d17dc79C8")

    def test_flow_rate_validation(self):
        """Verify flow rate must be a strictly positive integer."""
        from server import validate_flow_rate, SuperfluidError

        self.assertEqual(validate_flow_rate(1000), 1000)
        self.assertEqual(validate_flow_rate("5000"), 5000)

        with self.assertRaises(SuperfluidError):
            validate_flow_rate(0, allow_zero=False)

        with self.assertRaises(SuperfluidError):
            validate_flow_rate(-500)

        with self.assertRaises(SuperfluidError):
            validate_flow_rate("abc")

    def test_create_yield_stream_simulated(self):
        """Verify opening a CFA yield stream in simulated mode returns explicit SIMULATED metadata."""
        from server import create_yield_stream

        result = create_yield_stream(
            token_address="0x42bb40bF79730451B11f6De1CbA222F17b87Afd7",
            receiver="0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
            flow_rate=1466049382716,
            property_id="prop_unit_test_sim",
            allow_update=True,
        )
        self.assertTrue(result.get("success"))
        self.assertEqual(result.get("status"), "STREAM_OPENED")
        self.assertEqual(result.get("receiver"), "0x70997970C51812dc3A010C7d01b50e0d17dc79C8")
        self.assertEqual(result.get("flowRate"), 1466049382716)
        self.assertEqual(result.get("mode"), "simulated")
        self.assertIsNone(result.get("basescanUrl"))

    def test_duplicate_stream_validation(self):
        """Verify create_yield_stream rejects duplicates when allow_update is False."""
        from server import create_yield_stream, SuperfluidError

        prop = "prop_unit_test_dup"
        recip = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"

        create_yield_stream(
            token_address="0x42bb40bF79730451B11f6De1CbA222F17b87Afd7",
            receiver=recip,
            flow_rate=1000,
            property_id=prop,
            allow_update=True,
        )

        # Re-creating without allow_update must raise SuperfluidError
        with self.assertRaises(SuperfluidError):
            create_yield_stream(
                token_address="0x42bb40bF79730451B11f6De1CbA222F17b87Afd7",
                receiver=recip,
                flow_rate=2000,
                property_id=prop,
                allow_update=False,
            )

    def test_stream_not_found_validation(self):
        """Verify update and delete reject non-existent stream keys."""
        from server import update_flow_rate, delete_stream, SuperfluidError

        with self.assertRaises(SuperfluidError):
            update_flow_rate(
                token_address="0x42bb40bF79730451B11f6De1CbA222F17b87Afd7",
                receiver="0x90F79bf6EB2c4f870365E785982E1f101E93b906",
                flow_rate=5000,
                property_id="prop_non_existent_xyz",
            )

        with self.assertRaises(SuperfluidError):
            delete_stream(
                token_address="0x42bb40bF79730451B11f6De1CbA222F17b87Afd7",
                receiver="0x90F79bf6EB2c4f870365E785982E1f101E93b906",
                property_id="prop_non_existent_xyz",
            )

    def test_get_stream_balance(self):
        """Verify querying real-time stream balance returns valid structure."""
        from server import get_stream_balance

        result = get_stream_balance(
            token_address="0x42bb40bF79730451B11f6De1CbA222F17b87Afd7",
            receiver="0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
        )
        self.assertTrue(result.get("success"))
        self.assertIn("currentBalance", result)
        self.assertIn("flowRate", result)


if __name__ == "__main__":
    unittest.main()
