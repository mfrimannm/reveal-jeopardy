FROM python:3.12-slim

WORKDIR /app

ENV DATA_DIR=/app/data
ENV MAX_UPLOAD_MB=10

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN mkdir -p /app/seed-data/games /app/data/games /app/data/uploads \
    && cp -r /app/data/games/. /app/seed-data/games/

EXPOSE 8000

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
