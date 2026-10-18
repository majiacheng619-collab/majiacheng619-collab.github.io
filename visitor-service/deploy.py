#!/usr/bin/env python3
"""Deploy the private statistics API on Pages Functions with its existing D1 DB."""
import json
import os
import time
import uuid
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError

ROOT = Path(__file__).resolve().parent
account = os.environ['CLOUDFLARE_ACCOUNT_ID']
api_token = os.environ['CLOUDFLARE_API_TOKEN']
admin_token = os.environ['VISITOR_ADMIN_TOKEN']
if len(admin_token) < 24 or admin_token != admin_token.strip() or '\n' in admin_token or '\r' in admin_token:
    raise SystemExit('VISITOR_ADMIN_TOKEN must contain at least 24 characters without surrounding whitespace or line breaks')
base = 'https://api.cloudflare.com/client/v4/accounts/' + account
project_name = 'mjc-visitor-records-619'

def api(path, method='GET', body=None, content_type='application/json'):
    raw = body if isinstance(body, bytes) else json.dumps(body).encode() if body is not None else None
    request = Request(base + path, data=raw, method=method,
                      headers={'Authorization': 'Bearer ' + api_token, 'Content-Type': content_type})
    try:
        with urlopen(request, timeout=45) as response:
            result = json.load(response)
    except HTTPError as error:
        raise RuntimeError(f'Cloudflare request failed ({error.code}) at {path}; check deployment permissions') from None
    if not result.get('success'):
        raise RuntimeError('Cloudflare rejected deployment; check account permissions')
    return result['result']

# Exact project/database names keep redeployments on the same persistent database.
databases = api('/d1/database?name=mjc-visitors&per_page=100')
matching = [item for item in databases if item['name'] == 'mjc-visitors']
if len(matching) > 1:
    raise SystemExit('Ambiguous database name')
database = matching[0] if matching else api('/d1/database', 'POST', {'name': 'mjc-visitors'})
api('/d1/database/' + database['uuid'] + '/query', 'POST', {'sql': (ROOT/'migrations/0001_visitors.sql').read_text()})
config = {'production': {'compatibility_date': '2026-10-16', 'd1_databases': {'DB': {'id': database['uuid']}},
                         'env_vars': {'ADMIN_TOKEN': {'type': 'secret_text', 'value': admin_token}}}}
try:
    api('/pages/projects/' + project_name)
    project = api('/pages/projects/' + project_name, 'PATCH', {'deployment_configs': config})
except RuntimeError as error:
    if '(404)' not in str(error):
        raise
    project = api('/pages/projects', 'POST', {'name': project_name, 'production_branch': 'main', 'deployment_configs': config})

boundary = '----visitor-' + uuid.uuid4().hex
parts = []
for name, filename, mime, content in [
    ('manifest', None, 'text/plain', b'{}'), ('branch', None, 'text/plain', b'main'),
    ('_worker.js', '_worker.js', 'application/javascript', (ROOT/'worker.mjs').read_bytes())
]:
    header = f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"'
    if filename:
        header += f'; filename="{filename}"'
    header += f'\r\nContent-Type: {mime}\r\n\r\n'
    parts.append(header.encode() + content + b'\r\n')
body = b''.join(parts) + f'--{boundary}--\r\n'.encode()
deployment = api('/pages/projects/' + project_name + '/deployments', 'POST', body, 'multipart/form-data; boundary=' + boundary)
endpoint = 'https://' + project['subdomain']

# Never publish a new endpoint until the production deployment is ready and private reads work.
for attempt in range(20):
    current = api('/pages/projects/' + project_name + '/deployments/' + deployment['id'])
    stage = current.get('latest_stage', {})
    if stage.get('status') in ('failure', 'canceled'):
        raise RuntimeError('Pages deployment failed; collection was not activated')
    if stage.get('name') == 'deploy' and stage.get('status') == 'success':
        break
    time.sleep(5)
else:
    raise RuntimeError('Pages deployment timed out; collection was not activated')
request = Request(endpoint + '/stats?days=7', headers={'Authorization': 'Bearer ' + admin_token})
with urlopen(request, timeout=30) as response:
    stats = json.load(response)
if stats.get('timezone') != 'Asia/Shanghai' or len(stats.get('days', [])) != 7:
    raise RuntimeError('Private API health check failed; collection was not activated')
(ROOT.parent/'portfolio-source/analytics-config.json').write_text(json.dumps({'endpoint': endpoint}) + '\n')
print('Private statistics API verified and public endpoint configuration updated.')
