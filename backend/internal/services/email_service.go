package services

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/smtp"
	"strconv"
	"time"

	"github.com/kumquat/backend/config"
)

// EmailService handles sending emails
type EmailService struct {
	host        string
	port        int
	user        string
	password    string
	fromAddress string
	frontendURL string
	enabled     bool
	devMode     bool
	dialTimeout time.Duration
	sendTimeout time.Duration
}

// EmailSender is the interface for email sending
type EmailSender interface {
	SendPasswordResetEmail(ctx context.Context, toEmail, token string) error
	Enabled() bool
}

// NewEmailService creates a new email service
func NewEmailService(cfg config.Config) *EmailService {
	enabled := cfg.SMTPHost != "" && cfg.SMTPFromAddress != ""
	return &EmailService{
		host:        cfg.SMTPHost,
		port:        cfg.SMTPPort,
		user:        cfg.SMTPUser,
		password:    cfg.SMTPPassword,
		fromAddress: cfg.SMTPFromAddress,
		frontendURL: cfg.FrontendURL,
		enabled:     enabled,
		devMode:     cfg.Environment != "production",
		dialTimeout: config.SMTPDialTimeout,
		sendTimeout: config.SMTPSendTimeout,
	}
}

// Enabled returns true if email sending is configured
func (s *EmailService) Enabled() bool {
	return s.enabled
}

// SendPasswordResetEmail sends a password reset email with the given token.
// The whole SMTP conversation is bounded by sendTimeout and aborted when ctx
// is cancelled.
func (s *EmailService) SendPasswordResetEmail(ctx context.Context, toEmail, token string) error {
	if !s.enabled {
		if s.devMode {
			slog.Warn("SMTP not configured, logging reset URL for development only",
				"email", toEmail,
				"reset_url", fmt.Sprintf("%s/reset-password?token=%s", s.frontendURL, token))
		} else {
			slog.Error("SMTP not configured, cannot send password reset email", "email", toEmail)
		}
		return nil
	}

	resetURL := fmt.Sprintf("%s/reset-password?token=%s", s.frontendURL, token)

	subject := "Reset your Kumquat password"
	body := fmt.Sprintf(`Hello,

You requested to reset your password for Kumquat.

Click the link below to reset your password:
%s

This link will expire in 1 hour.

If you did not request this password reset, you can safely ignore this email.

- The Kumquat Team`, resetURL)

	msg := fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\n\r\n%s",
		s.fromAddress, toEmail, subject, body)

	if err := s.send(ctx, toEmail, []byte(msg)); err != nil {
		return fmt.Errorf("failed to send email: %w", err)
	}

	slog.Info("password reset email sent", "email", toEmail)
	return nil
}

// send does what smtp.SendMail does (STARTTLS when offered, PLAIN auth when
// configured), with a bounded dial and one deadline over the whole conversation.
func (s *EmailService) send(ctx context.Context, to string, msg []byte) error {
	ctx, cancel := context.WithTimeout(ctx, s.sendTimeout)
	defer cancel()

	dialer := net.Dialer{Timeout: s.dialTimeout}
	conn, err := dialer.DialContext(ctx, "tcp", net.JoinHostPort(s.host, strconv.Itoa(s.port)))
	if err != nil {
		return err
	}
	defer func() { _ = conn.Close() }()

	deadline, _ := ctx.Deadline()
	if err := conn.SetDeadline(deadline); err != nil {
		return err
	}
	// L'échéance ne réagit pas à l'annulation du contexte (client parti) :
	// fermer la connexion débloque l'échange en cours.
	stop := context.AfterFunc(ctx, func() { _ = conn.Close() })
	defer stop()

	c, err := smtp.NewClient(conn, s.host)
	if err != nil {
		return err
	}
	defer func() { _ = c.Close() }()

	if ok, _ := c.Extension("STARTTLS"); ok {
		if err := c.StartTLS(&tls.Config{ServerName: s.host}); err != nil {
			return err
		}
	}
	if s.user != "" && s.password != "" {
		if ok, _ := c.Extension("AUTH"); !ok {
			return errors.New("smtp: server doesn't support AUTH")
		}
		if err := c.Auth(smtp.PlainAuth("", s.user, s.password, s.host)); err != nil {
			return err
		}
	}
	if err := c.Mail(s.fromAddress); err != nil {
		return err
	}
	if err := c.Rcpt(to); err != nil {
		return err
	}
	w, err := c.Data()
	if err != nil {
		return err
	}
	if _, err := w.Write(msg); err != nil {
		return err
	}
	if err := w.Close(); err != nil {
		return err
	}
	return c.Quit()
}
