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
  error?: boolean;
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

// Individual test result
export interface TestResult {
  caseId: string;
  passed: boolean;
  actual: string | null;
  error: string | null;
}

// Library results output format
export interface LibraryResults {
  results: TestResult[];
}
