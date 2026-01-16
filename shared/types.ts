// Test case input types
export interface TestCaseInput {
  name?: string;
  address?: string;
  chainId?: number;
}

// Test case expected output types
export interface TestCaseExpected {
  address?: string;
  name?: string;
  value?: string;
}

// Individual test case definition
export interface TestCase {
  id: string;
  category: string;
  description: string;
  status: string;
  input: TestCaseInput;
  expected: TestCaseExpected;
  method: string;
  params: Record<string, unknown>;
}

// Root test cases file structure
export interface TestCasesFile {
  version: string;
  description: string;
  metadata: {
    maintainer: string;
    safe: string;
    recoverer: string;
  };
  cases: TestCase[];
}

// Individual test result
export interface TestResult {
  caseId: string;
  passed: boolean;
  actual: string | null;
  error: string | null;
  durationMs: number;
}

// Library results output format
export interface LibraryResults {
  library: string;
  version: string;
  language: string;
  timestamp: string;
  results: TestResult[];
}
