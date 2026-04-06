use alloy::providers::ProviderBuilder;
use alloy_ens::ProviderEnsExt;
use serde::{Deserialize, Serialize};
use std::fs;
use std::time::Instant;

#[derive(Deserialize)]
struct TestCase {
    id: String,
    category: String,
    description: String,
    status: String,
    input: TestInput,
    expected: TestExpected,
    method: String,
    params: serde_json::Value,
}

#[derive(Deserialize)]
struct TestInput {
    name: Option<String>,
    address: Option<String>,
    #[serde(rename = "chainId")]
    chain_id: Option<u64>,
}

#[derive(Deserialize)]
struct TestExpected {
    address: Option<String>,
    name: Option<String>,
    value: Option<String>,
}

#[derive(Serialize)]
struct TestResult {
    #[serde(rename = "caseId")]
    case_id: String,
    passed: bool,
    actual: Option<String>,
    error: Option<String>,
    #[serde(rename = "durationMs")]
    duration_ms: u64,
}

#[derive(Serialize)]
struct LibraryResults {
    timestamp: String,
    results: Vec<TestResult>,
}

fn checksum_address(addr: &alloy::primitives::Address) -> String {
    format!("{addr}")
}

#[tokio::main]
async fn main() {
    let rpc_url = std::env::var("RPC_URL").expect("RPC_URL environment variable is required");

    let provider = ProviderBuilder::new()
        .connect_http(rpc_url.parse().expect("Invalid RPC_URL"));

    // Load test cases
    let test_cases_path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../test-cases.json");
    let test_cases_content = fs::read_to_string(&test_cases_path)
        .expect("Failed to read test-cases.json");
    let test_cases: Vec<TestCase> = serde_json::from_str(&test_cases_content)
        .expect("Failed to parse test-cases.json");

    let ready_cases: Vec<&TestCase> = test_cases
        .iter()
        .filter(|tc| tc.status == "ready")
        .collect();

    let mut results: Vec<TestResult> = Vec::new();

    // Unsupported methods/cases
    let unsupported_methods = ["contenthash"];
    let unsupported_cases = ["forward-base-onchain", "reverse-l2"];

    for test_case in &ready_cases {
        if unsupported_methods.contains(&test_case.method.as_str()) {
            continue;
        }
        if unsupported_cases.contains(&test_case.id.as_str()) {
            continue;
        }

        println!("Running: {} - {}", test_case.id, test_case.description);

        let start = Instant::now();

        let result = match test_case.category.as_str() {
            "forward" => run_forward_test(&provider, test_case).await,
            "reverse" => run_reverse_test(&provider, test_case).await,
            _ => Err(format!("Unknown category: {}", test_case.category)),
        };

        let duration_ms = start.elapsed().as_millis() as u64;

        match result {
            Ok(actual) => {
                let expected = test_case
                    .expected
                    .address
                    .as_deref()
                    .or(test_case.expected.value.as_deref())
                    .or(test_case.expected.name.as_deref());

                let passed = actual.as_deref() == expected;

                println!(
                    "  {} ({}ms)",
                    if passed { "PASS" } else { "FAIL" },
                    duration_ms
                );
                if !passed {
                    println!("  Expected: {:?}, Got: {:?}", expected, actual);
                }

                results.push(TestResult {
                    case_id: test_case.id.clone(),
                    passed,
                    actual: actual.clone(),
                    error: if passed {
                        None
                    } else {
                        Some(format!(
                            "Expected {:?}, got {:?}",
                            expected, actual
                        ))
                    },
                    duration_ms,
                });
            }
            Err(err) => {
                println!("  FAIL ({}ms): {}", duration_ms, err);
                results.push(TestResult {
                    case_id: test_case.id.clone(),
                    passed: false,
                    actual: None,
                    error: Some(err),
                    duration_ms,
                });
            }
        }
    }

    // Write results
    let output = LibraryResults {
        timestamp: chrono::Utc::now().to_rfc3339(),
        results,
    };

    let output_path = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("results.json");
    let json = serde_json::to_string_pretty(&output).unwrap();
    fs::write(&output_path, &json).unwrap();
    println!("\nResults written to {:?}", output_path);
}

async fn run_forward_test(
    provider: &impl alloy::providers::Provider<alloy::network::Ethereum>,
    test_case: &TestCase,
) -> Result<Option<String>, String> {
    let name = test_case
        .input
        .name
        .as_deref()
        .ok_or("Missing input name")?;

    match test_case.method.as_str() {
        "addr" => {
            let addr = provider
                .resolve_name(name)
                .await
                .map_err(|e| format!("{e}"))?;
            Ok(Some(checksum_address(&addr)))
        }
        "text" => {
            let key = test_case.params.get("key")
                .and_then(|v| v.as_str())
                .ok_or("Missing text key param")?;
            let value = provider
                .lookup_txt(name, key)
                .await
                .map_err(|e| format!("{e}"))?;
            if value.is_empty() {
                Ok(None)
            } else {
                Ok(Some(value))
            }
        }
        _ => Err(format!("Unsupported method: {}", test_case.method)),
    }
}

async fn run_reverse_test(
    provider: &impl alloy::providers::Provider<alloy::network::Ethereum>,
    test_case: &TestCase,
) -> Result<Option<String>, String> {
    let address_str = test_case
        .input
        .address
        .as_deref()
        .ok_or("Missing input address")?;

    let address: alloy::primitives::Address = address_str
        .parse()
        .map_err(|e| format!("Invalid address: {e}"))?;

    let name = provider
        .lookup_address(&address)
        .await
        .map_err(|e| format!("{e}"))?;

    if name.is_empty() {
        Ok(None)
    } else {
        Ok(Some(name))
    }
}
