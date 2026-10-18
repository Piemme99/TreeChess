package models

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestClassifyTimeControl(t *testing.T) {
	cases := []struct {
		tc       string
		expected string
	}{
		{"-", "daily"},
		{"", "daily"},
		{"1/86400", "daily"}, // chess.com correspondence "moves/seconds" form
		{"3/172800", "daily"},
		{"60", "bullet"},
		{"60+1", "bullet"},
		{"180+2", "blitz"},
		{"300", "blitz"},
		{"600", "rapid"},
		{"900+10", "rapid"},
		{"1800", "daily"},
		{"86400", "daily"},
		{"garbage", ""},
	}

	for _, c := range cases {
		assert.Equal(t, c.expected, ClassifyTimeControl(c.tc), "TimeControl %q", c.tc)
	}
}
