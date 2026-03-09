import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/analyze-dba`;

const CHECK_ID = "f8e7d865-af48-431b-b17e-b390e472d90b";

// Helper: get a valid auth token
async function getAuthToken(): Promise<string> {
  // Use service role for testing since we can't login as a real user easily
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (serviceKey) return serviceKey;
  throw new Error("No SUPABASE_SERVICE_ROLE_KEY available for testing");
}

// Helper: call the edge function
async function callFunction(body: Record<string, unknown>, token?: string): Promise<Response> {
  const authToken = token ?? await getAuthToken();
  return fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${authToken}`,
      "apikey": SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  });
}

// Helper: get supabase admin client
function getAdminClient() {
  return createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

// ─── TEST 1: Unauthorized access ───
Deno.test("returns 401 for invalid auth", async () => {
  const res = await callFunction({ check_id: CHECK_ID, action: "analyze" }, "invalid-token");
  assertEquals(res.status, 401);
  const body = await res.json();
  assertExists(body.error);
});

// ─── TEST 2: Missing check_id ───
Deno.test("returns 404 for non-existent check", async () => {
  const res = await callFunction({ check_id: "00000000-0000-0000-0000-000000000000", action: "analyze" });
  assertEquals(res.status, 404);
  const body = await res.json();
  assertEquals(body.error, "Check niet gevonden");
});

// ─── TEST 3: Analyze action ───
Deno.test("analyze action returns valid analysis", async () => {
  const res = await callFunction({ check_id: CHECK_ID, action: "analyze" });
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.success, true);
  assertExists(body.analysis);
  assertExists(body.analysis.form_fields);
  assertExists(body.analysis.checklist_items);
  assertExists(body.analysis.aandachtspunten);
  assert(typeof body.analysis.overall_score === "number");
});

// ─── TEST 4: After analyze, checklist is flat in DB ───
Deno.test("after analyze, document_checklist is correctly normalized in DB", async () => {
  const supabase = getAdminClient();
  const { data } = await supabase.from("dba_checks").select("document_checklist").eq("id", CHECK_ID).single();
  assertExists(data);
  const checklist = data.document_checklist as any[];
  assert(Array.isArray(checklist), "checklist should be array");
  assert(checklist.length > 0, "checklist should not be empty");

  // Every item should be flat: {document_name: string, status: string}
  for (const item of checklist) {
    assert(typeof item.document_name === "string", `document_name should be string, got: ${JSON.stringify(item.document_name)}`);
    assert(typeof item.status === "string", `status should be string, got: ${JSON.stringify(item.status)}`);
    // Ensure document_name is not a numeric index
    assert(isNaN(Number(item.document_name)), `document_name should not be numeric: "${item.document_name}"`);
  }
});

// ─── TEST 5: Simulate deeply nested checklist and re-analyze ───
Deno.test("handles deeply nested checklist data correctly", async () => {
  const supabase = getAdminClient();

  // Save a deeply nested checklist (simulating the bug that happened)
  const nestedChecklist = [
    { document_name: "0", status: { document_name: "0", status: { document_name: "VOG verklaring", status: "niet_aanwezig" } } },
    { document_name: "1", status: { document_name: "1", status: { document_name: "Curriculum Vitae", status: "aanwezig" } } },
    { document_name: "2", status: { document_name: "VCA certificering", status: "aanwezig" } },
  ];

  await supabase.from("dba_checks").update({ document_checklist: nestedChecklist }).eq("id", CHECK_ID);

  // Re-analyze
  const res = await callFunction({ check_id: CHECK_ID, action: "analyze" });
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.success, true);
  await consumeIfNeeded(res);

  // Verify DB is now flat
  const { data } = await supabase.from("dba_checks").select("document_checklist").eq("id", CHECK_ID).single();
  const checklist = data!.document_checklist as any[];
  for (const item of checklist) {
    assert(typeof item.document_name === "string", `Expected string document_name, got: ${JSON.stringify(item)}`);
    assert(typeof item.status === "string", `Expected string status, got: ${JSON.stringify(item)}`);
    assert(isNaN(Number(item.document_name)), `document_name should not be numeric: "${item.document_name}"`);
  }

  // Check specific names survived
  const names = checklist.map((i: any) => i.document_name);
  assert(names.some((n: string) => n.includes("VOG")), "Should contain VOG verklaring");
  assert(names.some((n: string) => n.includes("Curriculum")), "Should contain Curriculum Vitae");
});

// ─── TEST 6: Rewrite action ───
Deno.test("rewrite action returns rewritten description", async () => {
  const res = await callFunction({ check_id: CHECK_ID, action: "rewrite" });
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.success, true);
  assertExists(body.rewritten_description);
  assert(body.rewritten_description.length > 50, "Rewritten description should be substantial");
});

// ─── TEST 7: Certify action ───
Deno.test("certify action generates certificate PDF", async () => {
  // First make sure status is 'analyzed'
  const supabase = getAdminClient();
  await supabase.from("dba_checks").update({ status: "analyzed" }).eq("id", CHECK_ID);

  const res = await callFunction({ check_id: CHECK_ID, action: "certify" });
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.success, true);
  assertExists(body.certificate_number);
  assertExists(body.pdf_path);
  assertExists(body.verification_token);

  // Verify DB was updated
  const { data } = await supabase.from("dba_checks").select("status, certificate_number, certificate_pdf_url, certified_at").eq("id", CHECK_ID).single();
  assertEquals(data!.status, "certified");
  assertExists(data!.certificate_number);
  assertExists(data!.certificate_pdf_url);
  assertExists(data!.certified_at);
});

// ─── TEST 8: Certify with normalized checklist produces correct PDF ───
Deno.test("certify after nested checklist fix produces valid certificate", async () => {
  const supabase = getAdminClient();

  // Inject triple-nested checklist
  const tripleNested = [
    { document_name: "0", status: { document_name: "0", status: { document_name: "Test Doc Alpha", status: "aanwezig" } } },
    { document_name: "1", status: { document_name: "Test Doc Beta", status: "niet_aanwezig" } },
    { document_name: "Test Doc Gamma", status: "aanwezig" },
  ];
  await supabase.from("dba_checks").update({ document_checklist: tripleNested, status: "analyzed" }).eq("id", CHECK_ID);

  // Certify
  const res = await callFunction({ check_id: CHECK_ID, action: "certify" });
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.success, true);

  // Verify checklist in DB is still stored as-is (certify reads but doesn't re-save checklist)
  // But the PDF should have rendered correctly with flattened names
  assertExists(body.pdf_path);
});

// ─── TEST 9: Check KVK action ───
Deno.test("check_kvk action works", async () => {
  const supabase = getAdminClient();
  // Ensure there's KVK data
  const { data: check } = await supabase.from("dba_checks").select("kvk_text").eq("id", CHECK_ID).single();
  if (!check?.kvk_text) {
    // Skip if no KVK text available
    console.log("Skipping check_kvk test - no KVK text available");
    return;
  }

  const res = await callFunction({ check_id: CHECK_ID, action: "check_kvk" });
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.success, true);
  assertExists(body.kvk_check_result);
  assert(typeof body.kvk_check_result.match === "boolean");
  assertExists(body.kvk_check_result.explanation);
});

// ─── TEST 10: Check polis action ───
Deno.test("check_polis action works", async () => {
  const supabase = getAdminClient();
  const { data: check } = await supabase.from("dba_checks").select("polis_text").eq("id", CHECK_ID).single();
  if (!check?.polis_text) {
    console.log("Skipping check_polis test - no polis text available");
    return;
  }

  const res = await callFunction({ check_id: CHECK_ID, action: "check_polis" });
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.success, true);
});

// ─── TEST 11: Full round-trip: analyze → certify → verify checklist stays flat ───
Deno.test("full round-trip: analyze → certify keeps checklist flat", async () => {
  const supabase = getAdminClient();

  // Reset to analyzed state
  await supabase.from("dba_checks").update({
    status: "uploaded",
    certificate_number: null,
    certificate_pdf_url: null,
    certified_at: null,
    verification_token: null,
  }).eq("id", CHECK_ID);

  // Step 1: Analyze
  const analyzeRes = await callFunction({ check_id: CHECK_ID, action: "analyze" });
  assertEquals(analyzeRes.status, 200);
  const analyzeBody = await analyzeRes.json();
  assertEquals(analyzeBody.success, true);

  // Verify checklist is flat after analyze
  const { data: afterAnalyze } = await supabase.from("dba_checks").select("document_checklist, status").eq("id", CHECK_ID).single();
  assertEquals(afterAnalyze!.status, "analyzed");
  const checklistAfterAnalyze = afterAnalyze!.document_checklist as any[];
  for (const item of checklistAfterAnalyze) {
    assert(typeof item.document_name === "string" && typeof item.status === "string",
      `After analyze, item should be flat: ${JSON.stringify(item)}`);
  }

  // Step 2: Certify
  const certifyRes = await callFunction({ check_id: CHECK_ID, action: "certify" });
  assertEquals(certifyRes.status, 200);
  const certifyBody = await certifyRes.json();
  assertEquals(certifyBody.success, true);

  // Step 3: Re-analyze (should still produce flat checklist)
  const reAnalyzeRes = await callFunction({ check_id: CHECK_ID, action: "analyze" });
  assertEquals(reAnalyzeRes.status, 200);
  await reAnalyzeRes.json();

  const { data: afterReAnalyze } = await supabase.from("dba_checks").select("document_checklist").eq("id", CHECK_ID).single();
  const checklistAfterReAnalyze = afterReAnalyze!.document_checklist as any[];
  for (const item of checklistAfterReAnalyze) {
    assert(typeof item.document_name === "string" && typeof item.status === "string",
      `After re-analyze, item should be flat: ${JSON.stringify(item)}`);
    assert(isNaN(Number(item.document_name)),
      `After re-analyze, document_name should not be numeric: "${item.document_name}"`);
  }
});

// Helper to consume response body if not yet consumed
async function consumeIfNeeded(res: Response) {
  try {
    if (!res.bodyUsed) await res.text();
  } catch { /* already consumed */ }
}
