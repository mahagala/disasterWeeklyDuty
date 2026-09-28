import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('feeds', Path(__file__).resolve().parents[1] / 'scripts/update_feeds.py')
feeds = importlib.util.module_from_spec(spec)
spec.loader.exec_module(feeds)
RSS = b'<?xml version="1.0"?><rss xmlns:ercc="https://example.org"><channel><item><title>Flood</title><ercc:pubDate>Mon, 28 Sep 2026 01:00:00 GMT</ercc:pubDate></item></channel></rss>'


class FeedTests(unittest.TestCase):
    def test_namespaced_date(self):
        self.assertEqual(feeds.validate(RSS, 'ercc'), 1)

    def test_reject_html_empty_and_invalid_dates(self):
        for body in (b'<html>error</html>', b'<rss><channel/></rss>', RSS.replace(b'Mon, 28 Sep 2026 01:00:00 GMT', b'invalid')):
            with self.assertRaises((ValueError, TypeError)):
                feeds.validate(body, 'gdacs')

    def test_last_good_data_survives_bad_response(self):
        with tempfile.TemporaryDirectory() as folder:
            directory = Path(folder)
            with patch.object(feeds, 'download', return_value=RSS):
                _, good = feeds.update_one('ercc', 'ercc', 'https://example.org', directory, {}, '2026-09-28T01:00:00Z')
            for failure in (ValueError('來源回傳 HTTP 503'), TimeoutError()):
                with patch.object(feeds, 'download', side_effect=failure):
                    _, bad = feeds.update_one('ercc', 'ercc', 'https://example.org', directory, {'ercc': good}, '2026-09-28T02:00:00Z')
                self.assertEqual(bad['status'], 'stale')
                self.assertEqual(bad['lastSuccessAt'], good['lastSuccessAt'])
                self.assertEqual((directory / 'ercc.xml').read_bytes(), RSS)
            with patch.object(feeds, 'download', return_value=b'<html>Challenge</html>'):
                _, bad = feeds.update_one('ercc', 'ercc', 'https://example.org', directory, {'ercc': good}, 'later')
            self.assertTrue(bad['available'])
            self.assertEqual((directory / 'ercc.xml').read_bytes(), RSS)

    def test_failure_without_cache(self):
        with tempfile.TemporaryDirectory() as folder, patch.object(feeds, 'download', side_effect=TimeoutError()):
            _, result = feeds.update_one('ercc', 'ercc', 'https://example.org', Path(folder), {}, 'now')
            self.assertEqual(result['status'], 'error')
            self.assertFalse(result['available'])

    def test_reliefweb_unconfigured_never_requests(self):
        with tempfile.TemporaryDirectory() as folder, patch.object(feeds, 'download') as download:
            _, result = feeds.update_one('reliefweb', 'reliefweb', 'https://example.org', Path(folder), {}, 'now')
            self.assertEqual(result['status'], 'unconfigured')
            download.assert_not_called()

    def test_reliefweb_v2_fields(self):
        body = json.dumps({'data': [{'id': 1, 'fields': {'title': 'Flood', 'url': 'https://reliefweb.int/report/example', 'date': {'created': '2026-09-28T01:00:00Z'}}}]}).encode()
        self.assertEqual(feeds.validate(body, 'reliefweb'), 1)
        with self.assertRaises(ValueError):
            feeds.validate(b'{"error":"denied"}', 'reliefweb')

    def test_reliefweb_snapshot_hides_appname(self):
        secret = 'approved-appname-123'
        link = 'https://api.reliefweb.int/v2/reports?appname=' + secret
        body = json.dumps({'href': link, 'links': {'self': {'href': link}, 'next': {'href': link + '&offset=1'}},
                           'totalCount': 1, 'count': 1,
                           'data': [{'id': 1, 'href': link, 'fields': {'title': 'Flood', 'url': 'https://reliefweb.int/report/example',
                                                                       'date': {'created': '2026-09-28T01:00:00Z'}}}]}).encode()
        with tempfile.TemporaryDirectory() as folder, patch.object(feeds, 'download', return_value=body):
            _, result = feeds.update_one('reliefweb', 'reliefweb', 'https://example.org', Path(folder), {}, 'now', secret)
            saved = (Path(folder) / 'reliefweb.json').read_bytes()
        self.assertEqual(result['status'], 'ok')
        self.assertNotIn(secret.encode(), saved)
        self.assertEqual(feeds.validate(saved, 'reliefweb'), 1)
        self.assertEqual(result['sha256'], hashlib.sha256(saved).hexdigest())


if __name__ == '__main__':
    unittest.main()
