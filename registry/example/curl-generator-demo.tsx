import { CurlGenerator } from "@/registry/pivot/curl-generator";

export default function CurlGeneratorDemo() {
  const params = {
    endpoint: "https://api.example.com/users",
    method: "POST" as const,
    parameters: [
      {
        name: "page",
        in: "query" as const,
        required: false,
        schema: { type: "integer" as const }
      },
      {
        name: "Authorization",
        in: "header" as const,
        required: true,
        schema: { type: "string" as const }
      }
    ],
    requestBody: {
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            properties: {
              name: { type: "string" as const },
              email: { type: "string" as const }
            }
          }
        }
      },
      required: true
    },
    requestBodyExample: {
      name: "张三",
      email: "zhangsan@example.com"
    }
  };

  return (
    <div className="space-y-4 min-w-md">
      <CurlGenerator params={params} />
    </div>
  );
}
