FROM alpine:3.18
WORKDIR /usr/src/code-is-beautiful/data_collector
RUN apk update
RUN apk add git
RUN apk add python3
RUN apk add py3-pip
COPY requirements.txt /usr/src/code-is-beautiful/data_collector/requirements.txt
RUN pip install -r requirements.txt
COPY . /usr/src/code-is-beautiful/data_collector
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]