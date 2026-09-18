FROM python:3.11-slim

WORKDIR /app

# Dependencias primero (mejor cache)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Código de la app
COPY app ./app

# Koyeb/Render/Fly inyectan $PORT; por defecto 8000
ENV PORT=8000
EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
