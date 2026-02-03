package services

import (
	"fmt"
	"log"
	"net/smtp"

	"github.com/treechess/backend/config"
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
}

// EmailSender is the interface for email sending
type EmailSender interface {
	SendPasswordResetEmail(toEmail, token string) error
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
	}
}

// Enabled returns true if email sending is configured
func (s *EmailService) Enabled() bool {
	return s.enabled
}

// SendPasswordResetEmail sends a password reset email with the given token
func (s *EmailService) SendPasswordResetEmail(toEmail, token string) error {
	if !s.enabled {
		log.Printf("[EMAIL] SMTP not configured. Password reset token for %s: %s", toEmail, token)
		log.Printf("[EMAIL] Reset URL: %s/reset-password?token=%s", s.frontendURL, token)
		return nil
	}

	resetURL := fmt.Sprintf("%s/reset-password?token=%s", s.frontendURL, token)

	subject := "Reset your TreeChess password"
	body := fmt.Sprintf(`Hello,

You requested to reset your password for TreeChess.

Click the link below to reset your password:
%s

This link will expire in 1 hour.

If you did not request this password reset, you can safely ignore this email.

- The TreeChess Team`, resetURL)

	msg := fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\n\r\n%s",
		s.fromAddress, toEmail, subject, body)

	addr := fmt.Sprintf("%s:%d", s.host, s.port)

	var auth smtp.Auth
	if s.user != "" && s.password != "" {
		auth = smtp.PlainAuth("", s.user, s.password, s.host)
	}

	err := smtp.SendMail(addr, auth, s.fromAddress, []string{toEmail}, []byte(msg))
	if err != nil {
		return fmt.Errorf("failed to send email: %w", err)
	}

	log.Printf("[EMAIL] Password reset email sent to %s", toEmail)
	return nil
}
