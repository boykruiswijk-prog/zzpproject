import { defineTool } from "@lovable.dev/mcp-js";

const SERVICES = [
  {
    key: "bav",
    name: "Beroepsaansprakelijkheidsverzekering (BAV)",
    url: "https://zzpproject.lovable.app/verzekeringen",
    description:
      "Beroepsaansprakelijkheid voor zzp'ers, met focus op IT, consultancy, HR, marketing en coaches.",
  },
  {
    key: "avb",
    name: "Bedrijfsaansprakelijkheidsverzekering (AVB)",
    url: "https://zzpproject.lovable.app/verzekeringen",
    description: "AVB voor zzp'ers, veelal gecombineerd met BAV.",
  },
  {
    key: "aov",
    name: "Arbeidsongeschiktheidsverzekering (AOV)",
    url: "https://zzpproject.lovable.app/aov",
    description: "Inkomensbescherming bij arbeidsongeschiktheid.",
  },
  {
    key: "wet-dba",
    name: "Wet DBA screening",
    url: "https://zzpproject.lovable.app/dba-verificatie",
    description: "DBA-check en certificering voor opdrachten van zzp'ers.",
  },
  {
    key: "credit-control",
    name: "Credit control & factoring",
    url: "https://zzpproject.lovable.app/credit-control",
    description: "Uitbetaling binnen 24 uur en dekking van insolventierisico.",
  },
];

export default defineTool({
  name: "list_services",
  title: "List ZP Zaken services",
  description:
    "Return the public list of ZP Zaken services (name, short description, URL). No authentication required.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => ({
    content: [{ type: "text", text: JSON.stringify(SERVICES, null, 2) }],
    structuredContent: { services: SERVICES },
  }),
});
