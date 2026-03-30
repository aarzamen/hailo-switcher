#!/usr/bin/env bash
set -euo pipefail

# Network Camera Receiver — bridges a remote RPi camera to /dev/video10
# via v4l2loopback so Hailo pipelines can use it as a local device.
#
# Usage:
#   ./scripts/network-camera.sh start [--port 5000] [--device /dev/video10]
#   ./scripts/network-camera.sh stop
#   ./scripts/network-camera.sh status
#
# Sender (RPi4 with Camera Module):
#   rpicam-vid -t 0 --width 1280 --height 720 --framerate 30 \
#     --codec h264 --inline --bitrate 4000000 -o - | \
#     gst-launch-1.0 fdsrc ! h264parse ! rtph264pay config-interval=1 pt=96 ! \
#     udpsink host=<THIS_PI_IP> port=5000 sync=false

DEVICE="/dev/video10"
PORT=5000
MODULE_LABEL="Network Camera"
PID_FILE="/tmp/network-camera-receiver.pid"

usage() {
    echo "Usage: $0 {start|stop|status} [--port PORT] [--device /dev/videoN]"
    exit 1
}

load_v4l2loopback() {
    if [ ! -e "$DEVICE" ]; then
        local dev_nr="${DEVICE##/dev/video}"
        echo "Loading v4l2loopback (${DEVICE})..."
        sudo modprobe v4l2loopback video_nr="$dev_nr" card_label="$MODULE_LABEL" exclusive_caps=1
        # Wait for device to appear
        for i in $(seq 1 10); do
            [ -e "$DEVICE" ] && break
            sleep 0.5
        done
        if [ ! -e "$DEVICE" ]; then
            echo "ERROR: $DEVICE did not appear after loading v4l2loopback"
            exit 1
        fi
        echo "v4l2loopback loaded: $DEVICE"
    fi
}

do_start() {
    if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
        echo "Receiver already running (PID $(cat "$PID_FILE"))"
        exit 0
    fi

    load_v4l2loopback

    echo "Starting receiver: UDP port $PORT → $DEVICE"
    gst-launch-1.0 -q \
        udpsrc port="$PORT" \
        caps='application/x-rtp,media=video,encoding-name=H264,payload=96' ! \
        rtph264depay ! h264parse ! avdec_h264 ! \
        videoconvert ! video/x-raw,format=YUY2 ! \
        v4l2sink device="$DEVICE" sync=false &

    local pid=$!
    echo "$pid" > "$PID_FILE"
    echo "Receiver started (PID $pid)"
    echo ""
    echo "Waiting for stream on UDP port $PORT..."
    echo "Send from RPi4 with:"
    echo "  rpicam-vid -t 0 --width 1280 --height 720 --framerate 30 \\"
    echo "    --codec h264 --inline --bitrate 4000000 -o - | \\"
    echo "    gst-launch-1.0 fdsrc ! h264parse ! rtph264pay config-interval=1 pt=96 ! \\"
    echo "    udpsink host=$(hostname -I | awk '{print $1}') port=$PORT sync=false"
}

do_stop() {
    if [ -f "$PID_FILE" ]; then
        local pid
        pid=$(cat "$PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid"
            echo "Receiver stopped (PID $pid)"
        else
            echo "Receiver was not running"
        fi
        rm -f "$PID_FILE"
    else
        echo "No receiver running"
    fi
}

do_status() {
    if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
        echo "Receiver running (PID $(cat "$PID_FILE"))"
        echo "  Device: $DEVICE"
        echo "  Port:   $PORT"
        [ -e "$DEVICE" ] && echo "  v4l2:   OK" || echo "  v4l2:   MISSING"
    else
        echo "Receiver not running"
        [ -e "$DEVICE" ] && echo "  v4l2:   $DEVICE exists" || echo "  v4l2:   $DEVICE not loaded"
    fi
}

# Parse args
CMD="${1:-}"
shift || true

while [ $# -gt 0 ]; do
    case "$1" in
        --port) PORT="$2"; shift 2 ;;
        --device) DEVICE="$2"; shift 2 ;;
        *) usage ;;
    esac
done

case "$CMD" in
    start)  do_start ;;
    stop)   do_stop ;;
    status) do_status ;;
    *)      usage ;;
esac
