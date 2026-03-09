import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

// ─── Unit test the flattenChecklistItem logic (same as in edge function) ───

function flattenChecklistItem(item: any): { document_name: string; status: string } {
  let current = item;
  while (current.status && typeof current.status === "object" && current.status.document_name !== undefined) {
    current = current.status;
  }
  return {
    document_name: current.document_name || "",
    status: typeof current.status === "string" ? current.status : "niet_aanwezig",
  };
}

// TEST 1: Already flat item
Deno.test("flat item stays flat", () => {
  const item = { document_name: "VOG verklaring", status: "aanwezig" };
  const result = flattenChecklistItem(item);
  assertEquals(result.document_name, "VOG verklaring");
  assertEquals(result.status, "aanwezig");
});

// TEST 2: Single-level nested
Deno.test("single-level nested unwraps correctly", () => {
  const item = { document_name: "0", status: { document_name: "VOG verklaring", status: "niet_aanwezig" } };
  const result = flattenChecklistItem(item);
  assertEquals(result.document_name, "VOG verklaring");
  assertEquals(result.status, "niet_aanwezig");
});

// TEST 3: Double-level nested
Deno.test("double-level nested unwraps correctly", () => {
  const item = {
    document_name: "0",
    status: { document_name: "0", status: { document_name: "Curriculum Vitae", status: "aanwezig" } },
  };
  const result = flattenChecklistItem(item);
  assertEquals(result.document_name, "Curriculum Vitae");
  assertEquals(result.status, "aanwezig");
});

// TEST 4: Triple-level nested (the actual bug that occurred)
Deno.test("triple-level nested unwraps correctly", () => {
  const item = {
    document_name: "0",
    status: {
      document_name: "0",
      status: {
        document_name: "0",
        status: { document_name: "VCA certificering", status: "aanwezig" },
      },
    },
  };
  const result = flattenChecklistItem(item);
  assertEquals(result.document_name, "VCA certificering");
  assertEquals(result.status, "aanwezig");
});

// TEST 5: Mixed array with different nesting levels
Deno.test("mixed nesting levels all normalize correctly", () => {
  const items = [
    { document_name: "VOG verklaring", status: "niet_aanwezig" },
    { document_name: "1", status: { document_name: "Curriculum Vitae", status: "aanwezig" } },
    { document_name: "2", status: { document_name: "2", status: { document_name: "VCA", status: "aanwezig" } } },
  ];
  const results = items.map(flattenChecklistItem);
  assertEquals(results[0].document_name, "VOG verklaring");
  assertEquals(results[1].document_name, "Curriculum Vitae");
  assertEquals(results[2].document_name, "VCA");
  assert(results.every((r) => typeof r.status === "string"));
  assert(results.every((r) => isNaN(Number(r.document_name))));
});

// TEST 6: Item with no document_name defaults to empty string
Deno.test("missing document_name defaults to empty string", () => {
  const item = { status: "aanwezig" };
  const result = flattenChecklistItem(item);
  assertEquals(result.document_name, "");
  assertEquals(result.status, "aanwezig");
});

// TEST 7: Item with non-string status defaults to niet_aanwezig
Deno.test("non-string leaf status defaults to niet_aanwezig", () => {
  const item = { document_name: "Test", status: 123 };
  const result = flattenChecklistItem(item);
  assertEquals(result.document_name, "Test");
  assertEquals(result.status, "niet_aanwezig");
});

// TEST 8: Verify the exact data structure that was in the DB before fix
Deno.test("exact production nested structure normalizes correctly", () => {
  const productionData = [
    { document_name: "0", status: { document_name: "0", status: { document_name: "VOG verklaring", status: "niet_aanwezig" } } },
    { document_name: "1", status: { document_name: "1", status: { document_name: "Curriculum Vitae", status: "aanwezig" } } },
    { document_name: "2", status: { document_name: "2", status: { document_name: "VCA certificering", status: "aanwezig" } } },
    { document_name: "3", status: { document_name: "3", status: { document_name: "Identiteits verklaring", status: "aanwezig" } } },
    { document_name: "4", status: { document_name: "4", status: { document_name: "Overeenkomst Eindopdrachtgever", status: "aanwezig" } } },
    { document_name: "5", status: { document_name: "5", status: { document_name: "Uittreksel Kamer van Koophandel", status: "aanwezig" } } },
    { document_name: "6", status: { document_name: "6", status: { document_name: "Polis beroeps en bedrijfsaansprakelijkheid", status: "aanwezig" } } },
  ];
  const results = productionData.map(flattenChecklistItem);

  const expectedNames = [
    "VOG verklaring",
    "Curriculum Vitae",
    "VCA certificering",
    "Identiteits verklaring",
    "Overeenkomst Eindopdrachtgever",
    "Uittreksel Kamer van Koophandel",
    "Polis beroeps en bedrijfsaansprakelijkheid",
  ];

  for (let i = 0; i < results.length; i++) {
    assertEquals(results[i].document_name, expectedNames[i], `Item ${i} document_name mismatch`);
    assert(typeof results[i].status === "string", `Item ${i} status should be string`);
  }

  assertEquals(results[0].status, "niet_aanwezig");
  assertEquals(results[1].status, "aanwezig");
});

// TEST 9: Object-format checklist (original upload format) handling
Deno.test("object-format checklist converts correctly", () => {
  const objectChecklist: Record<string, string> = {
    "VOG verklaring": "niet_aanwezig",
    "Curriculum Vitae": "aanwezig",
    "VCA certificering": "aanwezig",
  };

  // This simulates the Object.entries path in the edge function
  const items = Object.entries(objectChecklist).map(([name, status]) => ({
    document_name: name,
    status: typeof status === "string" ? status : "niet_aanwezig",
  }));

  assertEquals(items.length, 3);
  assertEquals(items[0].document_name, "VOG verklaring");
  assertEquals(items[0].status, "niet_aanwezig");
  assertEquals(items[1].document_name, "Curriculum Vitae");
  assertEquals(items[1].status, "aanwezig");
});

// TEST 10: Idempotency - running flatten twice produces same result
Deno.test("flatten is idempotent", () => {
  const nested = { document_name: "0", status: { document_name: "VOG", status: "aanwezig" } };
  const first = flattenChecklistItem(nested);
  const second = flattenChecklistItem(first);
  assertEquals(first.document_name, second.document_name);
  assertEquals(first.status, second.status);
});
