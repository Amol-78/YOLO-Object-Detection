FROM python:3.9-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    curl \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p uploads temp output

# Download YOLO model files if they don't exist
RUN if [ ! -f yolov3-tiny.cfg ]; then \
        wget https://raw.githubusercontent.com/pjreddie/darknet/master/cfg/yolov3-tiny.cfg -O yolov3-tiny.cfg; \
    fi

RUN if [ ! -f yolov3-tiny.weights ]; then \
        wget https://pjreddie.com/media/files/yolov3-tiny.weights -O yolov3-tiny.weights; \
    fi

RUN if [ ! -f coco.names ]; then \
        wget https://raw.githubusercontent.com/pjreddie/darknet/master/data/coco.names -O coco.names; \
    fi

EXPOSE 5000

CMD ["python", "app.py"]