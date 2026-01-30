#!/usr/bin/env bash
set -euo pipefail

AM_URL="${AM_URL:-http://localhost:9093}"
ALERT_NAME_PREFIX="${ALERT_NAME_PREFIX:-SmokeTest}"

times=()
while IFS= read -r line; do
  times+=("$line")
done < <(node -e 'const now=new Date();const end=new Date(Date.now()+2*60*1000);console.log(now.toISOString());console.log(end.toISOString());')

starts_at="${times[0]}"
ends_at="${times[1]}"

echo "Alertmanager: ${AM_URL}"
echo "startsAt: ${starts_at}"
echo "endsAt:   ${ends_at}"

curl -fsS "${AM_URL}/api/v2/status" >/dev/null

payload="$(cat <<EOF
[
  {
    "labels": {
      "alertname": "${ALERT_NAME_PREFIX}_Http404Detected",
      "severity": "warning",
      "service": "gateway",
      "method": "POST",
      "path": "/jira/webhook"
    },
    "annotations": {
      "summary": "Smoke test: 404 on /jira/webhook",
      "description": "Synthetic alert to verify notifier delivery"
    },
    "startsAt": "${starts_at}",
    "endsAt": "${ends_at}"
  },
  {
    "labels": {
      "alertname": "${ALERT_NAME_PREFIX}_GatewayQueueHigh",
      "severity": "warning",
      "service": "gateway"
    },
    "annotations": {
      "summary": "Smoke test: gateway queue high",
      "description": "Synthetic alert to verify notifier delivery"
    },
    "startsAt": "${starts_at}",
    "endsAt": "${ends_at}"
  },
  {
    "labels": {
      "alertname": "${ALERT_NAME_PREFIX}_BreakerOpen",
      "severity": "warning",
      "service": "notifier",
      "target": "pachka"
    },
    "annotations": {
      "summary": "Smoke test: breaker open",
      "description": "Synthetic alert to verify notifier delivery"
    },
    "startsAt": "${starts_at}",
    "endsAt": "${ends_at}"
  },
  {
    "labels": {
      "alertname": "${ALERT_NAME_PREFIX}_PachkaApiLatencyP95",
      "severity": "warning",
      "service": "notifier",
      "target": "pachka"
    },
    "annotations": {
      "summary": "Smoke test: Pachka API latency",
      "description": "Synthetic alert to verify notifier delivery"
    },
    "startsAt": "${starts_at}",
    "endsAt": "${ends_at}"
  }
]
EOF
)"

curl -fsS -X POST "${AM_URL}/api/v2/alerts" \
  -H "Content-Type: application/json" \
  -d "${payload}" >/dev/null

echo "Sent 4 test alerts."
echo "You should receive 4 FIRING alerts now and 4 RESOLVED in ~2 minutes."
echo "If needed, check notifier logs:"
echo "  docker logs --since 5m jira-pachka-notifier | tail -n 200"
