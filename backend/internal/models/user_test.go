package models

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestUser_MarshalJSON_LichessLinked_True(t *testing.T) {
	tok := "user-token-abc"
	u := User{ID: "u-1", Username: "alice", LichessAccessToken: &tok}

	body, err := json.Marshal(u)
	require.NoError(t, err)

	var out map[string]any
	require.NoError(t, json.Unmarshal(body, &out))
	assert.Equal(t, true, out["lichessLinked"])
	_, hasToken := out["lichessAccessToken"]
	assert.False(t, hasToken, "raw access token must never be serialized")
}

func TestUser_MarshalJSON_LichessLinked_FalseWhenTokenNil(t *testing.T) {
	u := User{ID: "u-1", Username: "alice"}

	body, err := json.Marshal(u)
	require.NoError(t, err)

	var out map[string]any
	require.NoError(t, json.Unmarshal(body, &out))
	assert.Equal(t, false, out["lichessLinked"])
}

func TestUser_MarshalJSON_LichessLinked_FalseWhenTokenEmptyString(t *testing.T) {
	empty := ""
	u := User{ID: "u-1", Username: "alice", LichessAccessToken: &empty}

	body, err := json.Marshal(u)
	require.NoError(t, err)

	var out map[string]any
	require.NoError(t, json.Unmarshal(body, &out))
	assert.Equal(t, false, out["lichessLinked"], "empty-string token must not count as linked")
}
