package goensv3_test

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"
	cid "github.com/ipfs/go-cid"
	ens "github.com/wealdtech/go-ens/v3"
)

// Public go-ens helpers do not cover L2 primary names.
var unsupportedMethods = map[string]bool{
	"reverse-l2": true,
}

type testResult struct {
	CaseID     string  `json:"caseId"`
	Passed     bool    `json:"passed"`
	Actual     *string `json:"actual"`
	Error      *string `json:"error"`
	DurationMs int64   `json:"durationMs"`
}

type libraryResults struct {
	Timestamp string       `json:"timestamp"`
	Results   []testResult `json:"results"`
}

type testCase struct {
	ID       string          `json:"id"`
	Category string          `json:"category"`
	Status   string          `json:"status"`
	Method   string          `json:"method"`
	Input    input           `json:"input"`
	Expected expected        `json:"expected"`
	Params   json.RawMessage `json:"params"`
}

type input struct {
	Name    *string `json:"name"`
	Address *string `json:"address"`
}

type expected struct {
	Address *string `json:"address"`
	Value   *string `json:"value"`
	Name    *string `json:"name"`
}

var (
	resultsMu sync.Mutex
	results   []testResult
)

func packageDir() string {
	wd, err := os.Getwd()
	if err != nil {
		panic(err)
	}
	return wd
}

func rootDir() string {
	return filepath.Clean(filepath.Join(packageDir(), "../.."))
}

func loadRPCURL() string {
	if url := os.Getenv("RPC_URL"); url != "" {
		return url
	}

	envPath := filepath.Join(rootDir(), ".env")
	data, err := os.ReadFile(envPath)
	if err != nil {
		panic("RPC_URL environment variable is required")
	}
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") || !strings.Contains(line, "=") {
			continue
		}
		key, value, _ := strings.Cut(line, "=")
		if strings.TrimSpace(key) == "RPC_URL" {
			value = strings.TrimSpace(value)
			value = strings.Trim(value, `"'`)
			if value != "" {
				return value
			}
		}
	}
	panic("RPC_URL environment variable is required")
}

func loadReadyCases(category string) []testCase {
	path := filepath.Join(rootDir(), "test-cases.json")
	data, err := os.ReadFile(path)
	if err != nil {
		panic(err)
	}
	var cases []testCase
	if err := json.Unmarshal(data, &cases); err != nil {
		panic(err)
	}

	out := make([]testCase, 0)
	for _, c := range cases {
		if c.Status != "ready" || c.Category != category || unsupportedMethods[c.Method] {
			continue
		}
		out = append(out, c)
	}
	return out
}

func recordResult(caseID string, passed bool, actual *string, errMsg *string, durationMs int64) {
	resultsMu.Lock()
	defer resultsMu.Unlock()

	filtered := results[:0]
	for _, r := range results {
		if r.CaseID != caseID {
			filtered = append(filtered, r)
		}
	}
	results = append(filtered, testResult{
		CaseID:     caseID,
		Passed:     passed,
		Actual:     actual,
		Error:      errMsg,
		DurationMs: durationMs,
	})
}

func writeResults() {
	resultsMu.Lock()
	defer resultsMu.Unlock()

	output := libraryResults{
		Timestamp: time.Now().UTC().Format(time.RFC3339Nano),
		Results:   append([]testResult(nil), results...),
	}
	data, err := json.MarshalIndent(output, "", "  ")
	if err != nil {
		panic(err)
	}
	path := filepath.Join(packageDir(), "results.json")
	if err := os.WriteFile(path, append(data, '\n'), 0o644); err != nil {
		panic(err)
	}
	fmt.Printf("\nResults written to %s\n", path)
}

func strPtr(s string) *string { return &s }

func expectedValue(c testCase) *string {
	if c.Expected.Address != nil {
		return c.Expected.Address
	}
	if c.Expected.Value != nil {
		return c.Expected.Value
	}
	return c.Expected.Name
}

func truncateErr(err error) string {
	msg := err.Error()
	runes := []rune(msg)
	if len(runes) > 500 {
		return string(runes[:500]) + "…"
	}
	return msg
}

func paramUint64(raw json.RawMessage, key string) (uint64, bool) {
	var m map[string]any
	if err := json.Unmarshal(raw, &m); err != nil {
		return 0, false
	}
	v, ok := m[key]
	if !ok {
		return 0, false
	}
	switch n := v.(type) {
	case float64:
		return uint64(n), true
	default:
		return 0, false
	}
}

func paramString(raw json.RawMessage, key string) (string, bool) {
	var m map[string]any
	if err := json.Unmarshal(raw, &m); err != nil {
		return "", false
	}
	v, ok := m[key]
	if !ok {
		return "", false
	}
	s, ok := v.(string)
	return s, ok
}

func runForward(client *ethclient.Client, c testCase) (*string, error) {
	switch c.Method {
	case "addr":
		if c.Input.Name == nil {
			return nil, fmt.Errorf("missing name")
		}
		coinType, ok := paramUint64(c.Params, "coinType")
		if !ok {
			return nil, fmt.Errorf("missing coinType")
		}
		if coinType == 60 {
			addr, err := ens.Resolve(client, *c.Input.Name)
			if err != nil {
				return nil, err
			}
			s := addr.Hex()
			return &s, nil
		}
		resolver, err := ens.NewResolver(client, *c.Input.Name)
		if err != nil {
			return nil, err
		}
		raw, err := resolver.MultiAddress(coinType)
		if err != nil {
			return nil, err
		}
		if len(raw) == 0 {
			return nil, nil
		}
		s := common.BytesToAddress(raw).Hex()
		return &s, nil
	case "text":
		if c.Input.Name == nil {
			return nil, fmt.Errorf("missing name")
		}
		key, ok := paramString(c.Params, "key")
		if !ok {
			return nil, fmt.Errorf("missing text key")
		}
		resolver, err := ens.NewResolver(client, *c.Input.Name)
		if err != nil {
			return nil, err
		}
		value, err := resolver.Text(key)
		if err != nil {
			return nil, err
		}
		if value == "" {
			return nil, nil
		}
		return &value, nil
	case "contenthash":
		if c.Input.Name == nil {
			return nil, fmt.Errorf("missing name")
		}
		resolver, err := ens.NewResolver(client, *c.Input.Name)
		if err != nil {
			return nil, err
		}
		raw, err := resolver.Contenthash()
		if err != nil {
			return nil, err
		}
		if len(raw) == 0 {
			return nil, nil
		}
		value, err := ens.ContenthashToString(raw)
		if err != nil {
			return nil, err
		}
		return &value, nil
	default:
		return nil, fmt.Errorf("unexpected method: %s", c.Method)
	}
}

func runReverse(client *ethclient.Client, c testCase) (*string, error) {
	switch c.Method {
	case "reverse":
		if c.Input.Address == nil {
			return nil, fmt.Errorf("missing address")
		}
		addr := common.HexToAddress(*c.Input.Address)
		name, err := ens.ReverseResolve(client, addr)
		if err != nil {
			return nil, err
		}
		if name == "" {
			return nil, nil
		}
		return &name, nil
	default:
		return nil, fmt.Errorf("unexpected method: %s", c.Method)
	}
}

func normalizeContenthash(value string) (string, error) {
	trimmed := strings.TrimPrefix(value, "ipfs://")
	trimmed = strings.TrimPrefix(trimmed, "/ipfs/")
	parsed, err := cid.Decode(trimmed)
	if err != nil {
		return "", err
	}
	return parsed.String(), nil
}

func valuesMatch(method string, actual, expected *string) bool {
	if equalPtr(actual, expected) {
		return true
	}
	if method != "contenthash" || actual == nil || expected == nil {
		return false
	}
	a, errA := normalizeContenthash(*actual)
	b, errB := normalizeContenthash(*expected)
	if errA != nil || errB != nil {
		return false
	}
	return a == b
}

func equalPtr(a, b *string) bool {
	if a == nil && b == nil {
		return true
	}
	if a == nil || b == nil {
		return false
	}
	return *a == *b
}

func ptrOrNull(s *string) string {
	if s == nil {
		return "null"
	}
	return *s
}

func TestMain(m *testing.M) {
	code := m.Run()
	writeResults()
	os.Exit(code)
}

func TestForwardResolution(t *testing.T) {
	client, err := ethclient.Dial(loadRPCURL())
	if err != nil {
		t.Fatalf("dial rpc: %v", err)
	}
	defer client.Close()

	var failures []string
	for _, c := range loadReadyCases("forward") {
		start := time.Now()
		actual, err := runForward(client, c)
		duration := time.Since(start).Milliseconds()
		expected := expectedValue(c)

		if err != nil {
			msg := truncateErr(err)
			recordResult(c.ID, false, nil, &msg, duration)
			failures = append(failures, fmt.Sprintf("%s: %s", c.ID, msg))
			continue
		}

		passed := valuesMatch(c.Method, actual, expected)
		var errMsg *string
		if !passed {
			msg := fmt.Sprintf("Expected %s, got %s", ptrOrNull(expected), ptrOrNull(actual))
			errMsg = &msg
			failures = append(failures, fmt.Sprintf("%s: %s", c.ID, msg))
		}
		recordResult(c.ID, passed, actual, errMsg, duration)
	}

	if len(failures) > 0 {
		t.Fatalf("%d failure(s):\n%s", len(failures), strings.Join(failures, "\n"))
	}
}

func TestReverseResolution(t *testing.T) {
	client, err := ethclient.Dial(loadRPCURL())
	if err != nil {
		t.Fatalf("dial rpc: %v", err)
	}
	defer client.Close()

	var failures []string
	for _, c := range loadReadyCases("reverse") {
		start := time.Now()
		actual, err := runReverse(client, c)
		duration := time.Since(start).Milliseconds()
		expected := expectedValue(c)

		if err != nil {
			msg := truncateErr(err)
			recordResult(c.ID, false, nil, &msg, duration)
			failures = append(failures, fmt.Sprintf("%s: %s", c.ID, msg))
			continue
		}

		passed := equalPtr(actual, expected)
		var errMsg *string
		if !passed {
			msg := fmt.Sprintf("Expected %s, got %s", ptrOrNull(expected), ptrOrNull(actual))
			errMsg = &msg
			failures = append(failures, fmt.Sprintf("%s: %s", c.ID, msg))
		}
		recordResult(c.ID, passed, actual, errMsg, duration)
	}

	if len(failures) > 0 {
		t.Fatalf("%d failure(s):\n%s", len(failures), strings.Join(failures, "\n"))
	}
}
