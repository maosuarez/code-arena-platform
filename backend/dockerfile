FROM python:3.11-slim

# Evitar buffering en logs
ENV PYTHONUNBUFFERED=1

# Crear directorio de trabajo
WORKDIR /app

# Instalar dependencias del sistema (compiladores, etc.)
RUN apt-get update && apt-get install -y \
    build-essential \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copiar requirements primero (mejor caching en Docker)
COPY requirements.txt .

# Instalar dependencias de Python
RUN pip install --no-cache-dir -r requirements.txt

# Copiar el código fuente
COPY ./app ./app

# Crear un usuario no-root
RUN adduser --disabled-password fastapiuser
USER fastapiuser

# Exponer puerto
EXPOSE 8000

# Comando de arranque
CMD ["gunicorn", "-k", "uvicorn.workers.UvicornWorker", "-w", "4", "-b", "0.0.0.0:8000", "app.main:app"]
