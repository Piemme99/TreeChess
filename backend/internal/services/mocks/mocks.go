package mocks

import "context"

// --- Email service mock ---

// MockEmailService implements services.EmailSender for testing
type MockEmailService struct {
	SendPasswordResetEmailFunc func(ctx context.Context, toEmail, token string) error
	EnabledFunc                func() bool
}

func (m *MockEmailService) SendPasswordResetEmail(ctx context.Context, toEmail, token string) error {
	if m.SendPasswordResetEmailFunc != nil {
		return m.SendPasswordResetEmailFunc(ctx, toEmail, token)
	}
	return nil
}

func (m *MockEmailService) Enabled() bool {
	if m.EnabledFunc != nil {
		return m.EnabledFunc()
	}
	return true
}
