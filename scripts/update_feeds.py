#!/usr/bin/env python3
"""Download validated public feeds; retain the last good copy on each failure."""
import concurrent.futures
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
import hashlib
import json
import os
from pathlib import Path
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
FEEDS = {
    'gdacs7d': ('gdacs', 'https://www.gdacs.org/xml/rss_7d.xml'),
    'gdacsEq3m': ('gdacs', 'https://www.gdacs.org/xml/rss_eq_3m.xml'),
    'gdacsTc3m': ('gdacs', 'https://www.gdacs.org/xml/rss_tc_3m.xml'),
    'gdacsFl3m': ('gdacs', 'https://www.gdacs.org/xml/rss_fl_3m.xml'),
    'ercc': ('ercc', 'https://erccportal.jrc.ec.europa.eu/API/ERCC/Maps/GetLatestDailyMapRss'),
    'usgs': ('usgs', 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_month.atom'),
    'reliefweb': ('reliefweb', 'https://api.reliefweb.int/v2/reports'),
}
MAX_BYTES = 20 * 1024 * 1024


def valid_date(value):
    try:
        datetime.fromisoformat(value.replace('Z', '+00:00'))
    except (ValueError, TypeError):
        parsedate_to_datetime(value)


def sanitize(body, source):
    """Drop ReliefWeb links that echo the request URL, so the appname never reaches the public snapshot."""
    if source != 'reliefweb':
        return body
    document = json.loads(body)
    public = {key: document[key] for key in ('totalCount', 'count') if key in document}
    public['data'] = [{key: record[key] for key in ('id', 'score', 'fields') if key in record}
                      for record in document['data']]
    return json.dumps(public, ensure_ascii=False, separators=(',', ':')).encode()


def validate(body, source):
    if source == 'reliefweb':
        document = json.loads(body)
        records = document.get('data')
        if not isinstance(records, list) or not records:
            raise ValueError('ReliefWeb 未回傳有效報告清單')
        for record in records:
            fields = record['fields']
            if not record.get('id') or not fields.get('title') or not fields.get('url'):
                raise ValueError('ReliefWeb 缺少必要欄位')
            valid_date(fields['date']['created'])
        return len(records)
    root = ET.fromstring(body)
    local = lambda tag: tag.split('}')[-1]
    expected = 'feed' if source == 'usgs' else 'rss'
    if local(root.tag) != expected:
        raise ValueError('回應不是預期的 RSS / Atom')
    records = [el for el in root.iter() if local(el.tag) == ('entry' if source == 'usgs' else 'item')]
    if not records:
        raise ValueError('來源未提供任何災情，保留上次有效資料')
    for record in records:
        fields = {local(el.tag): (el.text or '').strip() for el in record}
        if not fields.get('title'):
            raise ValueError('災情缺少標題')
        valid_date(fields.get('updated') if source == 'usgs' else fields.get('pubDate'))
    return len(records)


def download(url):
    for attempt in range(3):
        try:
            request = urllib.request.Request(url, headers={
                'User-Agent': 'disasterWeeklyDuty/1.0 (+https://github.com/mahagala/disasterWeeklyDuty)',
                'Accept': 'application/xml, application/atom+xml, application/json',
            })
            with urllib.request.urlopen(request, timeout=25) as response:
                if response.headers.get('x-amzn-waf-action') == 'challenge':
                    raise ValueError('來源網站要求瀏覽器驗證，排程無法取得資料')
                if response.status != 200:
                    raise ValueError(f'來源回傳 HTTP {response.status}')
                body = response.read(MAX_BYTES + 1)
                if len(body) > MAX_BYTES:
                    raise ValueError('資料超過大小限制')
                return body
        except urllib.error.HTTPError as error:
            if error.code not in (408, 429, 500, 502, 503, 504) or attempt == 2:
                raise ValueError(f'來源回傳 HTTP {error.code}') from None
        except (urllib.error.URLError, TimeoutError):
            if attempt == 2:
                raise ValueError('連線失敗或逾時，已嘗試三次') from None
        time.sleep(2 ** attempt)


def update_one(key, source, url, directory, previous, now, appname=''):
    old = previous.get(key, {})
    filename = key + ('.json' if source == 'reliefweb' else '.xml')
    path = directory / filename
    result = dict(source=source, file=filename, checkedAt=now,
                  lastSuccessAt=old.get('lastSuccessAt'), count=old.get('count', 0),
                  sha256=old.get('sha256'), available=False)
    if source == 'reliefweb' and not appname:
        result.update(status='unconfigured', error='尚未設定官方核准的 ReliefWeb appname', count=0)
        return key, result
    if source == 'reliefweb':
        params = [('appname', appname), ('limit', '150'), ('preset', 'latest')]
        params += [('fields[include][]', field) for field in
                   ('title', 'url', 'date.created', 'primary_country', 'disaster_type')]
        url += '?' + urllib.parse.urlencode(params)
    try:
        body = download(url)
        count = validate(body, source)
        body = sanitize(body, source)
        temporary = path.with_suffix(path.suffix + '.tmp')
        temporary.write_bytes(body)
        temporary.replace(path)
        result.update(status='ok', error=None, lastSuccessAt=now, count=count,
                      sha256=hashlib.sha256(body).hexdigest(), available=True)
    except Exception as error:
        # Never put the request URL (which may contain appname) into public diagnostics.
        reason = str(error) if isinstance(error, ValueError) and not isinstance(error, json.JSONDecodeError) else '資料下載或格式驗證失敗'
        if 'http' in reason.lower() and not reason.startswith('來源回傳 HTTP'):
            reason = '資料下載或格式驗證失敗'
        available = False
        if path.exists() and old.get('lastSuccessAt'):
            try:
                cached = path.read_bytes()
                validate(cached, source)
                available = hashlib.sha256(cached).hexdigest() == old.get('sha256')
            except Exception:
                pass
        result.update(status='stale' if available else 'error', available=available, error=reason)
    return key, result


def main():
    directory = ROOT / 'data'
    directory.mkdir(exist_ok=True)
    manifest_path = directory / 'manifest.json'
    previous = json.loads(manifest_path.read_text())['feeds'] if manifest_path.exists() else {}
    now = datetime.now(timezone.utc).isoformat()
    with concurrent.futures.ThreadPoolExecutor(max_workers=7) as pool:
        futures = [pool.submit(update_one, key, source, url, directory, previous, now,
                               os.environ.get('RELIEFWEB_APPNAME', '').strip())
                   for key, (source, url) in FEEDS.items()]
        feeds = dict(future.result() for future in futures)
    manifest = dict(schemaVersion=1, generatedAt=now, feeds=feeds)
    temporary = manifest_path.with_suffix('.tmp')
    temporary.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    temporary.replace(manifest_path)
    failures = []
    for key, item in feeds.items():
        print(f"{key}: {item['status']} ({item['count']} records)")
        if item['status'] in ('stale', 'error'):
            failures.append(key)
            print(f"::warning title={key} 更新失敗::{item['error']}")
    summary = os.environ.get('GITHUB_STEP_SUMMARY')
    if summary:
        with open(summary, 'a') as handle:
            handle.write('## 災情來源更新\n\n|來源|狀態|筆數|\n|---|---|---|\n')
            for key, item in feeds.items():
                handle.write(f"|{key}|{item['status']}|{item['count']}|\n")
    output = os.environ.get('GITHUB_OUTPUT')
    if output:
        with open(output, 'a') as handle:
            handle.write(f"degraded={'true' if failures else 'false'}\n")


if __name__ == '__main__':
    main()
