FROM golang:1.25-bookworm

WORKDIR /app

# Install system dependencies for video processing pipeline
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    ffmpeg \
    build-essential \
    cmake \
    pkg-config \
    python3-pip \
    unzip \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Build OpenCV 4.10.0 from source (required by GoCV v0.43.0)
ENV OPENCV_VERSION=4.10.0
RUN cd /tmp && \
    wget -q -O opencv.zip https://github.com/opencv/opencv/archive/${OPENCV_VERSION}.zip && \
    wget -q -O opencv_contrib.zip https://github.com/opencv/opencv_contrib/archive/${OPENCV_VERSION}.zip && \
    unzip -q opencv.zip && \
    unzip -q opencv_contrib.zip && \
    mkdir -p opencv-${OPENCV_VERSION}/build && \
    cd opencv-${OPENCV_VERSION}/build && \
    cmake -D CMAKE_BUILD_TYPE=RELEASE \
          -D CMAKE_INSTALL_PREFIX=/usr/local \
          -D OPENCV_EXTRA_MODULES_PATH=/tmp/opencv_contrib-${OPENCV_VERSION}/modules \
          -D BUILD_DOCS=OFF \
          -D BUILD_EXAMPLES=OFF \
          -D BUILD_TESTS=OFF \
          -D BUILD_PERF_TESTS=OFF \
          -D BUILD_opencv_java=NO \
          -D BUILD_opencv_python=NO \
          -D BUILD_opencv_python2=NO \
          -D BUILD_opencv_python3=NO \
          -D WITH_JASPER=OFF \
          -D OPENCV_GENERATE_PKGCONFIG=ON .. && \
    make -j$(nproc) && \
    make install && \
    ldconfig && \
    rm -rf /tmp/opencv* /tmp/opencv_contrib*

# Install yt-dlp
RUN pip3 install --no-cache-dir --break-system-packages yt-dlp

# Copy dependencies first (for better caching)
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Install air (hot reload for Go)
RUN go install github.com/cosmtrek/air@v1.49.0

EXPOSE 8080

# air is already in PATH at /go/bin/air
CMD ["air"]
