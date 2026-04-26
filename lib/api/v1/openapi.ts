import { z } from "zod"
import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  extendZodWithOpenApi,
} from "@asteasolutions/zod-to-openapi"

extendZodWithOpenApi(z)

const idSchema = z.string().uuid().openapi({ example: "11111111-1111-1111-1111-111111111111" })

const loadSchema = z
  .object({
    id: idSchema,
    shipment_number: z.string(),
    origin: z.string(),
    destination: z.string(),
    status: z.string().nullable().optional(),
    driver_id: idSchema.nullable().optional(),
    truck_id: idSchema.nullable().optional(),
    load_date: z.string().nullable().optional(),
    estimated_delivery: z.string().nullable().optional(),
    value: z.number().nullable().optional(),
  })
  .openapi("Load")

const driverSchema = z
  .object({
    id: idSchema,
    name: z.string(),
    email: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
    truck_id: idSchema.nullable().optional(),
  })
  .openapi("Driver")

const truckSchema = z
  .object({
    id: idSchema,
    truck_number: z.string(),
    make: z.string().nullable().optional(),
    model: z.string().nullable().optional(),
    year: z.number().nullable().optional(),
    status: z.string().nullable().optional(),
    driver_id: idSchema.nullable().optional(),
  })
  .openapi("Truck")

const invoiceSchema = z
  .object({
    id: idSchema,
    invoice_number: z.string().nullable().optional(),
    load_id: idSchema.nullable().optional(),
    customer_id: idSchema.nullable().optional(),
    amount: z.number().nullable().optional(),
    status: z.string().nullable().optional(),
    due_date: z.string().nullable().optional(),
  })
  .openapi("Invoice")

const errorSchema = z
  .object({
    error: z.string(),
  })
  .openapi("ApiError")

const registry = new OpenAPIRegistry()

registry.registerComponent("securitySchemes", "ApiKeyAuth", {
  type: "apiKey",
  in: "header",
  name: "x-api-key",
})

registry.registerPath({
  method: "get",
  path: "/api/v1/loads",
  summary: "List loads",
  tags: ["loads"],
  security: [{ ApiKeyAuth: [] }],
  responses: {
    200: { description: "OK", content: { "application/json": { schema: z.object({ data: z.array(loadSchema) }) } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: errorSchema } } },
  },
})

registry.registerPath({
  method: "post",
  path: "/api/v1/loads",
  summary: "Create load",
  tags: ["loads"],
  security: [{ ApiKeyAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            shipment_number: z.string(),
            origin: z.string(),
            destination: z.string(),
          }),
        },
      },
    },
  },
  responses: { 201: { description: "Created", content: { "application/json": { schema: z.object({ data: loadSchema }) } } } },
})

registry.registerPath({
  method: "get",
  path: "/api/v1/loads/{id}",
  summary: "Get load by ID",
  tags: ["loads"],
  security: [{ ApiKeyAuth: [] }],
  request: { params: z.object({ id: idSchema }) },
  responses: { 200: { description: "OK", content: { "application/json": { schema: z.object({ data: loadSchema }) } } } },
})

registry.registerPath({
  method: "patch",
  path: "/api/v1/loads/{id}",
  summary: "Update load",
  tags: ["loads"],
  security: [{ ApiKeyAuth: [] }],
  request: {
    params: z.object({ id: idSchema }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            status: z.string().optional(),
            origin: z.string().optional(),
            destination: z.string().optional(),
            driver_id: idSchema.nullable().optional(),
            truck_id: idSchema.nullable().optional(),
          }),
        },
      },
    },
  },
  responses: { 200: { description: "OK", content: { "application/json": { schema: z.object({ data: loadSchema }) } } } },
})

registry.registerPath({
  method: "get",
  path: "/api/v1/drivers",
  summary: "List drivers",
  tags: ["drivers"],
  security: [{ ApiKeyAuth: [] }],
  responses: { 200: { description: "OK", content: { "application/json": { schema: z.object({ data: z.array(driverSchema) }) } } } },
})

registry.registerPath({
  method: "post",
  path: "/api/v1/drivers",
  summary: "Create driver",
  tags: ["drivers"],
  security: [{ ApiKeyAuth: [] }],
  request: { body: { content: { "application/json": { schema: z.object({ name: z.string() }) } } } },
  responses: { 201: { description: "Created", content: { "application/json": { schema: z.object({ data: driverSchema }) } } } },
})

registry.registerPath({
  method: "get",
  path: "/api/v1/drivers/{id}",
  summary: "Get driver by ID",
  tags: ["drivers"],
  security: [{ ApiKeyAuth: [] }],
  request: { params: z.object({ id: idSchema }) },
  responses: { 200: { description: "OK", content: { "application/json": { schema: z.object({ data: driverSchema }) } } } },
})

registry.registerPath({
  method: "patch",
  path: "/api/v1/drivers/{id}",
  summary: "Update driver",
  tags: ["drivers"],
  security: [{ ApiKeyAuth: [] }],
  request: {
    params: z.object({ id: idSchema }),
    body: { content: { "application/json": { schema: z.object({ name: z.string().optional(), status: z.string().optional() }) } } },
  },
  responses: { 200: { description: "OK", content: { "application/json": { schema: z.object({ data: driverSchema }) } } } },
})

registry.registerPath({
  method: "get",
  path: "/api/v1/trucks",
  summary: "List trucks",
  tags: ["trucks"],
  security: [{ ApiKeyAuth: [] }],
  responses: { 200: { description: "OK", content: { "application/json": { schema: z.object({ data: z.array(truckSchema) }) } } } },
})

registry.registerPath({
  method: "post",
  path: "/api/v1/trucks",
  summary: "Create truck",
  tags: ["trucks"],
  security: [{ ApiKeyAuth: [] }],
  request: { body: { content: { "application/json": { schema: z.object({ truck_number: z.string() }) } } } },
  responses: { 201: { description: "Created", content: { "application/json": { schema: z.object({ data: truckSchema }) } } } },
})

registry.registerPath({
  method: "get",
  path: "/api/v1/trucks/{id}",
  summary: "Get truck by ID",
  tags: ["trucks"],
  security: [{ ApiKeyAuth: [] }],
  request: { params: z.object({ id: idSchema }) },
  responses: { 200: { description: "OK", content: { "application/json": { schema: z.object({ data: truckSchema }) } } } },
})

registry.registerPath({
  method: "patch",
  path: "/api/v1/trucks/{id}",
  summary: "Update truck",
  tags: ["trucks"],
  security: [{ ApiKeyAuth: [] }],
  request: {
    params: z.object({ id: idSchema }),
    body: { content: { "application/json": { schema: z.object({ status: z.string().optional(), driver_id: idSchema.nullable().optional() }) } } },
  },
  responses: { 200: { description: "OK", content: { "application/json": { schema: z.object({ data: truckSchema }) } } } },
})

registry.registerPath({
  method: "get",
  path: "/api/v1/invoices",
  summary: "List invoices",
  tags: ["invoices"],
  security: [{ ApiKeyAuth: [] }],
  responses: { 200: { description: "OK", content: { "application/json": { schema: z.object({ data: z.array(invoiceSchema) }) } } } },
})

registry.registerPath({
  method: "post",
  path: "/api/v1/invoices",
  summary: "Create invoice",
  tags: ["invoices"],
  security: [{ ApiKeyAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            invoice_number: z.string(),
            customer_name: z.string(),
            amount: z.number(),
            issue_date: z.string(),
            due_date: z.string(),
          }),
        },
      },
    },
  },
  responses: { 201: { description: "Created", content: { "application/json": { schema: z.object({ data: invoiceSchema }) } } } },
})

registry.registerPath({
  method: "get",
  path: "/api/v1/invoices/{id}",
  summary: "Get invoice by ID",
  tags: ["invoices"],
  security: [{ ApiKeyAuth: [] }],
  request: { params: z.object({ id: idSchema }) },
  responses: { 200: { description: "OK", content: { "application/json": { schema: z.object({ data: invoiceSchema }) } } } },
})

registry.registerPath({
  method: "patch",
  path: "/api/v1/invoices/{id}",
  summary: "Update invoice",
  tags: ["invoices"],
  security: [{ ApiKeyAuth: [] }],
  request: {
    params: z.object({ id: idSchema }),
    body: { content: { "application/json": { schema: z.object({ status: z.string().optional(), amount: z.number().optional() }) } } },
  },
  responses: { 200: { description: "OK", content: { "application/json": { schema: z.object({ data: invoiceSchema }) } } } },
})

export function buildOpenApiDocument() {
  const generator = new OpenApiGeneratorV3(registry.definitions)
  return generator.generateDocument({
    openapi: "3.0.0",
    info: {
      title: "TruckMates Public API",
      version: "1.0.0",
      description: "Versioned REST API for enterprise integrations.",
    },
    servers: [{ url: "/" }],
    tags: [
      { name: "loads", description: "Load operations" },
      { name: "drivers", description: "Driver operations" },
      { name: "trucks", description: "Truck operations" },
      { name: "invoices", description: "Invoice operations" },
    ],
  })
}
