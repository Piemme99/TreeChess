package services

import (
	"bufio"
	"context"
	"net"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newTestEmailService(t *testing.T, addr string, sendTimeout time.Duration) *EmailService {
	t.Helper()
	host, portStr, err := net.SplitHostPort(addr)
	require.NoError(t, err)
	port, err := strconv.Atoi(portStr)
	require.NoError(t, err)
	return &EmailService{
		host:        host,
		port:        port,
		fromAddress: "noreply@kumquat.test",
		frontendURL: "https://kumquat.test",
		enabled:     true,
		dialTimeout: time.Second,
		sendTimeout: sendTimeout,
	}
}

// stallingSMTPServer accepts connections and never says a word.
func stallingSMTPServer(t *testing.T) string {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	done := make(chan struct{})
	t.Cleanup(func() {
		close(done)
		_ = ln.Close()
	})
	go func() {
		for {
			conn, err := ln.Accept()
			if err != nil {
				return
			}
			go func() {
				<-done
				_ = conn.Close()
			}()
		}
	}()
	return ln.Addr().String()
}

func TestEmailService_SendPasswordResetEmail_StalledServerFailsWithinDeadline(t *testing.T) {
	svc := newTestEmailService(t, stallingSMTPServer(t), 200*time.Millisecond)

	start := time.Now()
	err := svc.SendPasswordResetEmail(context.Background(), "user@kumquat.test", "tok")

	require.Error(t, err)
	assert.Less(t, time.Since(start), 2*time.Second)
}

func TestEmailService_SendPasswordResetEmail_CancelledRequestAbortsSend(t *testing.T) {
	svc := newTestEmailService(t, stallingSMTPServer(t), time.Minute)
	ctx, cancel := context.WithCancel(context.Background())
	time.AfterFunc(100*time.Millisecond, cancel)

	start := time.Now()
	err := svc.SendPasswordResetEmail(ctx, "user@kumquat.test", "tok")

	require.Error(t, err)
	assert.Less(t, time.Since(start), 2*time.Second)
}

func TestEmailService_SendPasswordResetEmail_DeliversToRelay(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	t.Cleanup(func() { _ = ln.Close() })

	transcript := make(chan string, 1)
	go func() {
		conn, err := ln.Accept()
		if err != nil {
			return
		}
		defer func() { _ = conn.Close() }()
		r := bufio.NewReader(conn)
		var got strings.Builder
		reply := func(s string) { _, _ = conn.Write([]byte(s + "\r\n")) }
		reply("220 test ESMTP")
		inData := false
		for {
			line, err := r.ReadString('\n')
			if err != nil {
				transcript <- got.String()
				return
			}
			got.WriteString(line)
			switch {
			case inData:
				if line == ".\r\n" {
					inData = false
					reply("250 queued")
				}
			case strings.HasPrefix(line, "EHLO"):
				reply("250 test")
			case strings.HasPrefix(line, "DATA"):
				inData = true
				reply("354 go ahead")
			case strings.HasPrefix(line, "QUIT"):
				reply("221 bye")
				transcript <- got.String()
				return
			default:
				reply("250 ok")
			}
		}
	}()

	svc := newTestEmailService(t, ln.Addr().String(), 5*time.Second)
	err = svc.SendPasswordResetEmail(context.Background(), "user@kumquat.test", "tok123")
	require.NoError(t, err)

	got := <-transcript
	assert.Contains(t, got, "MAIL FROM:<noreply@kumquat.test>")
	assert.Contains(t, got, "RCPT TO:<user@kumquat.test>")
	assert.Contains(t, got, "https://kumquat.test/reset-password?token=tok123")
}
