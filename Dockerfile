FROM node:22-alpine AS frontend-builder

WORKDIR /build

COPY package.json tsconfig.json ./
RUN npm install

COPY frontend/ts ./frontend/ts
RUN npm run build


FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/code

WORKDIR /code

COPY requirements.txt pytest.ini ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY frontend/index.html ./frontend/index.html
COPY frontend/css ./frontend/css
COPY --from=frontend-builder /build/frontend/dist ./frontend/dist
COPY db ./db
COPY tests ./tests

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
