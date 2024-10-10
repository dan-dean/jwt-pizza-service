const request = require("supertest");
const app = require("./service.js");

describe("JWT Pizza Service API", () => {
	test("should return welcome message and version on GET /", async () => {
		const response = await request(app).get("/");
		expect(response.status).toBe(200);
		expect(response.body).toHaveProperty("message", "welcome to JWT Pizza");
		expect(response.body).toHaveProperty("version");
	});

	test("should return 404 for unknown endpoints", async () => {
		const response = await request(app).get("/unknown-endpoint");
		expect(response.status).toBe(404);
		expect(response.body).toHaveProperty("message", "unknown endpoint");
	});

	test("should return API documentation on GET /api/docs", async () => {
		const response = await request(app).get("/api/docs");
		expect(response.status).toBe(200);
		expect(response.body).toHaveProperty("version");
		expect(response.body).toHaveProperty("endpoints");
		expect(response.body).toHaveProperty("config");
	});
});
