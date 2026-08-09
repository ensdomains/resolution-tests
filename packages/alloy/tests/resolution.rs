//! ENS resolution tests for alloy (`ProviderEnsExt`).

use std::{
    env, fs,
    path::PathBuf,
    sync::Mutex,
    time::Instant,
};

use alloy::{
    ens::ProviderEnsExt,
    primitives::Address,
    providers::ProviderBuilder,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::json;

/// Public alloy ENS helpers do not cover these methods today.
const UNSUPPORTED_METHODS: &[&str] = &["contenthash", "reverse-l2"];

static RESULTS: Mutex<Vec<TestResult>> = Mutex::new(Vec::new());

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TestResult {
    case_id: String,
    passed: bool,
    actual: Option<String>,
    error: Option<String>,
    duration_ms: u64,
}

#[derive(Debug, Clone, Deserialize)]
struct TestCase {
    id: String,
    category: String,
    status: String,
    method: String,
    input: Input,
    expected: Expected,
    params: serde_json::Value,
}

#[derive(Debug, Clone, Deserialize)]
struct Input {
    name: Option<String>,
    address: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
struct Expected {
    address: Option<String>,
    value: Option<String>,
    name: Option<String>,
}

fn package_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
}

fn root_dir() -> PathBuf {
    package_dir().join("../..").canonicalize().expect("repo root")
}

fn load_rpc_url() -> String {
    if let Ok(url) = env::var("RPC_URL") {
        if !url.is_empty() {
            return url;
        }
    }

    let env_path = root_dir().join(".env");
    if env_path.exists() {
        for line in fs::read_to_string(env_path).unwrap().lines() {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') || !line.contains('=') {
                continue;
            }
            let (key, value) = line.split_once('=').unwrap();
            if key.trim() == "RPC_URL" {
                let value = value.trim().trim_matches('"').trim_matches('\'');
                if !value.is_empty() {
                    return value.to_string();
                }
            }
        }
    }

    panic!("RPC_URL environment variable is required");
}

fn load_ready_cases(category: &str) -> Vec<TestCase> {
    let path = root_dir().join("test-cases.json");
    let cases: Vec<TestCase> = serde_json::from_str(&fs::read_to_string(path).unwrap()).unwrap();
    cases
        .into_iter()
        .filter(|c| {
            c.status == "ready"
                && c.category == category
                && !UNSUPPORTED_METHODS.contains(&c.method.as_str())
                // alloy resolve_name only resolves ETH (coin type 60)
                && !(c.method == "addr"
                    && c.params
                        .get("coinType")
                        .and_then(|v| v.as_u64())
                        .is_some_and(|ct| ct != 60))
        })
        .collect()
}

fn record_result(
    case_id: &str,
    passed: bool,
    actual: Option<String>,
    error: Option<String>,
    duration_ms: u64,
) {
    let mut results = RESULTS.lock().unwrap();
    results.retain(|r| r.case_id != case_id);
    results.push(TestResult {
        case_id: case_id.to_string(),
        passed,
        actual,
        error,
        duration_ms,
    });
    // Stable lexicographic order by case id
    results.sort_by(|a, b| a.case_id.cmp(&b.case_id));

    let output = json!({
        "timestamp": Utc::now().to_rfc3339(),
        "results": &*results,
    });
    let path = package_dir().join("results.json");
    fs::write(path, serde_json::to_string_pretty(&output).unwrap() + "\n").unwrap();
}

fn format_address(addr: Address) -> String {
    format!("{addr}")
}

fn expected_value(case: &TestCase) -> Option<String> {
    case.expected
        .address
        .clone()
        .or_else(|| case.expected.value.clone())
        .or_else(|| case.expected.name.clone())
}

async fn run_forward(case: &TestCase) -> Result<Option<String>, String> {
    let rpc_url = load_rpc_url()
        .parse()
        .map_err(|e| format!("invalid RPC_URL: {e}"))?;
    let provider = ProviderBuilder::new().connect_http(rpc_url);

    match case.method.as_str() {
        "addr" => {
            let name = case.input.name.as_deref().ok_or("missing name")?;
            let addr = provider.resolve_name(name).await.map_err(|e| e.to_string())?;
            Ok(Some(format_address(addr)))
        }
        "text" => {
            let name = case.input.name.as_deref().ok_or("missing name")?;
            let key = case
                .params
                .get("key")
                .and_then(|v| v.as_str())
                .ok_or("missing text key")?;
            let value = provider
                .lookup_txt(name, key)
                .await
                .map_err(|e| e.to_string())?;
            Ok(Some(value))
        }
        other => Err(format!("unexpected method: {other}")),
    }
}

async fn run_reverse(case: &TestCase) -> Result<Option<String>, String> {
    let rpc_url = load_rpc_url()
        .parse()
        .map_err(|e| format!("invalid RPC_URL: {e}"))?;
    let provider = ProviderBuilder::new().connect_http(rpc_url);

    match case.method.as_str() {
        "reverse" => {
            let addr_str = case.input.address.as_deref().ok_or("missing address")?;
            let address: Address = addr_str
                .parse()
                .map_err(|e| format!("invalid address: {e}"))?;
            let name = provider
                .lookup_address(&address)
                .await
                .map_err(|e| e.to_string())?;
            Ok(Some(name))
        }
        other => Err(format!("unexpected method: {other}")),
    }
}

async fn run_category<F, Fut>(category: &str, runner: F)
where
    F: Fn(TestCase) -> Fut,
    Fut: std::future::Future<Output = Result<Option<String>, String>>,
{
    let mut failures = Vec::new();

    for case in load_ready_cases(category) {
        let start = Instant::now();
        let case_id = case.id.clone();
        let expected = expected_value(&case);

        match runner(case).await {
            Ok(actual) => {
                let duration_ms = start.elapsed().as_millis() as u64;
                let passed = actual == expected;
                let error = if passed {
                    None
                } else {
                    Some(format!(
                        "Expected {}, got {}",
                        expected.as_deref().unwrap_or("null"),
                        actual.as_deref().unwrap_or("null")
                    ))
                };
                record_result(&case_id, passed, actual.clone(), error.clone(), duration_ms);
                if !passed {
                    failures.push(format!("{case_id}: {}", error.unwrap()));
                }
            }
            Err(err) => {
                let duration_ms = start.elapsed().as_millis() as u64;
                // Truncate huge OffchainLookup revert payloads for results.json
                // (char-based so we never slice mid–UTF-8 codepoint)
                let short_err = {
                    let truncated: String = err.chars().take(500).collect();
                    if truncated.len() < err.len() {
                        format!("{truncated}…")
                    } else {
                        truncated
                    }
                };
                record_result(&case_id, false, None, Some(short_err.clone()), duration_ms);
                failures.push(format!("{case_id}: {short_err}"));
            }
        }
    }

    assert!(
        failures.is_empty(),
        "{} failure(s):\n{}",
        failures.len(),
        failures.join("\n")
    );
}

#[tokio::test]
async fn forward_resolution() {
    run_category("forward", |case| async move { run_forward(&case).await }).await;
}

#[tokio::test]
async fn reverse_resolution() {
    run_category("reverse", |case| async move { run_reverse(&case).await }).await;
}
