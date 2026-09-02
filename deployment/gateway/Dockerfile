FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEALER_AGENT_PROJECT_ROOT=/app \
    DEALER_AGENT_DEMO_MODE=1 \
    PORT=8080

WORKDIR /app

COPY reference/python /app/reference/python
RUN pip install --no-cache-dir /app/reference/python

COPY spec /app/spec
COPY conformance/claims /app/conformance/claims

USER 65532:65532
EXPOSE 8080

CMD ["dealer-agent-protocol-http"]
