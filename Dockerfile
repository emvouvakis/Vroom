FROM python:3.12-slim

WORKDIR /app

COPY . /app

ENV PIP_ROOT_USER_ACTION=ignore

RUN pip install --upgrade pip

RUN pip install -r requirements.txt

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]