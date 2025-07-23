FROM debian:bookworm-slim

# Install Python 3.11 and build dependencies
RUN apt-get update && \
    apt-get install -y \
    python3.11 \
    python3.11-dev \
    python3-pip \
    build-essential \
    gcc \
    g++ \
    curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Create symlinks for python and pip
RUN ln -sf /usr/bin/python3.11 /usr/bin/python && \
    ln -sf /usr/bin/python3.11 /usr/bin/python3

# Install AWS Lambda Runtime Interface Client
RUN pip install --break-system-packages awslambdaric

# Set working directory
WORKDIR /var/task

# Copy project configuration and install dependencies
COPY pyproject.toml README.md ./
RUN pip install --no-cache-dir --break-system-packages .

# Copy the application code
COPY ml_anomaly/ ./ml_anomaly/

# Set the CMD to your handler with the runtime interface client
ENTRYPOINT [ "/usr/bin/python", "-m", "awslambdaric" ]
CMD ["ml_anomaly.handler.lambda_handler"]