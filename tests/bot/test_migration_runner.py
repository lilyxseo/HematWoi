import importlib.util
import io
import json
from pathlib import Path
import unittest
from unittest.mock import patch
import urllib.error

spec = importlib.util.spec_from_file_location("migration", Path(__file__).resolve().parents[2] / "scripts/apply-bot-migration.py")
migration = importlib.util.module_from_spec(spec)
spec.loader.exec_module(migration)


class MigrationRunnerTests(unittest.TestCase):
    @patch.dict("os.environ", {"SUPABASE_ACCESS_TOKEN": "test-only-token", "PROJECT_ID": "testproject"}, clear=True)
    def test_atomic_migration_is_sent_to_the_configured_project(self):
        class Response:
            status = 200
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def read(self): return b"[]"
        for status in (200, 201):
            with self.subTest(status=status):
                response = Response()
                response.status = status
                with patch.object(migration.urllib.request, "urlopen", return_value=response) as send:
                    migration.apply_migration()
                request = send.call_args.args[0]
                self.assertEqual(request.full_url, "https://api.supabase.com/v1/projects/testproject/database/query")
                sql = json.loads(request.data)["query"]
                self.assertTrue(sql.startswith("BEGIN;"))
                self.assertTrue(sql.endswith("COMMIT;"))
                self.assertIn("claim_whatsapp_request", sql)
                self.assertIn("notify pgrst, 'reload schema'", sql)

    @patch.dict("os.environ", {"SUPABASE_ACCESS_TOKEN": "test-only-token", "PROJECT_ID": "testproject"}, clear=True)
    def test_failed_migration_blocks_the_next_step_without_exposing_token(self):
        error = urllib.error.HTTPError("https://api.supabase.com", 403, "Forbidden", {}, io.BytesIO(b"denied test-only-token"))
        with patch.object(migration.urllib.request, "urlopen", side_effect=error):
            with self.assertRaises(RuntimeError) as raised:
                migration.apply_migration()
        self.assertNotIn("test-only-token", str(raised.exception))
        self.assertIn("403", str(raised.exception))

    @patch.dict("os.environ", {}, clear=True)
    def test_missing_configuration_never_makes_a_request(self):
        with patch.object(migration.urllib.request, "urlopen") as send:
            with self.assertRaises(RuntimeError):
                migration.apply_migration()
            send.assert_not_called()


if __name__ == "__main__":
    unittest.main()
