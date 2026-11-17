package mocks

// --- Email service mock ---

// MockEmailService implements services.EmailSender for testing
type MockEmailService struct {
	SendPasswordResetEmailFunc func(toEmail, token string) error
	EnabledFunc                func() bool
}

func (m *MockEmailService) SendPasswordResetEmail(toEmail, token string) error {
	if m.SendPasswordResetEmailFunc != nil {
		return m.SendPasswordResetEmailFunc(toEmail, token)
	}
	return nil
}

func (m *MockEmailService) Enabled() bool {
	if m.EnabledFunc != nil {
		return m.EnabledFunc()
	}
	return true
}
