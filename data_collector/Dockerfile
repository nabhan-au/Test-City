FROM python:3.9.22-alpine
RUN apk add --no-cache build-base gcc
RUN pip install pdm
COPY data_collector /app/data_collector
COPY pdm.lock /app/pdm.lock
COPY pyproject.toml /app/pyproject.toml
WORKDIR /app
RUN pdm install
WORKDIR /app/data_collector
CMD ["pdm", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]