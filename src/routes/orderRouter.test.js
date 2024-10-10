const request = require("supertest");
const { Role, DB } = require("../database/database.js");

jest.mock("../config", () => {
	const originalConfig = jest.requireActual("../config");
	return {
		...originalConfig,
	};
});

let app = require("../service");

let existingMenuItem, adminUser, adminUserAuthToken, userAuthToken;

describe("orderRouter", () => {
	beforeAll(async () => {
		existingMenuItem = {
			title: randomName(),
			description: randomName(),
			image: randomName() + ".png",
			price: 0.0001,
		};
		existingMenuItem = await DB.addMenuItem(existingMenuItem);
		expect(existingMenuItem.id).toBeDefined();

		adminUser = await createAdminUser();
		const adminLoginRes = await request(app)
			.put("/api/auth")
			.send({ email: adminUser.email, password: adminUser.password });
		adminUserAuthToken = adminLoginRes.body.token;
		expectValidJwt(adminUserAuthToken);

		let user = await createUser();
		const userLoginRes = await request(app)
			.put("/api/auth")
			.send({ email: user.email, password: user.password });
		userAuthToken = userLoginRes.body.token;
	});

	afterEach(() => {
		jest.resetModules();
		app = require("../service");
	});

	test("getMenu", async () => {
		const res = await request(app).get("/api/order/menu");
		expect(res.status).toBe(200);
		expect(res.body).toContainEqual(existingMenuItem);
	});

	describe("addMenuItem", () => {
		test("addMenuItem success", async () => {
			const newMenuItem = {
				title: randomName(),
				description: randomName(),
				image: randomName() + ".png",
				price: 0.0001,
			};
			const res = await request(app)
				.put("/api/order/menu")
				.send(newMenuItem)
				.set("Authorization", `Bearer ${adminUserAuthToken}`);
			expect(res.status).toBe(200);
			const menuItems = res.body.map((item) => item.title);
			expect(menuItems).toContain(newMenuItem.title);
		});

		test("addMenuItem fail", async () => {
			const newMenuItem = {
				title: randomName(),
				description: randomName(),
				image: randomName() + ".png",
				price: 0.0001,
			};
			const res = await request(app)
				.put("/api/order/menu")
				.send(newMenuItem)
				.set("Authorization", `Bearer ${userAuthToken}`);
			expect(res.status).toBe(403);
			expect(res.body.message).toBe("unable to add menu item");
		});
	});

	describe("getOrders", () => {
		test("getOrders success", async () => {
			const res = await request(app)
				.get("/api/order")
				.set("Authorization", `Bearer ${adminUserAuthToken}`);
			expect(res.status).toBe(200);
		});

		test("getOrders fail", async () => {
			const res = await request(app).get("/api/order");
			expect(res.status).toBe(401);
		});
	});

	describe("createOrder", () => {
		test("createOrder success", async () => {
			const res = await request(app)
				.post("/api/order")
				.send({
					franchiseId: 1,
					storeId: 1,
					items: [{ menuId: 1, description: "Veggie", price: 0.05 }],
				})
				.set("Authorization", `Bearer ${adminUserAuthToken}`);
			expect(res.status).toBe(200);
			expect(res.body.order).toMatchObject({
				franchiseId: 1,
				storeId: 1,
				items: [{ menuId: 1, description: "Veggie", price: 0.05 }],
			});
			expectValidJwt(res.body.jwt);
		});
		test("createOrder fail-authorization", async () => {
			const res = await request(app).post("/api/order");
			expect(res.status).toBe(401);
		});
		test("createOrder fail-factory", async () => {
			jest.resetModules();

			jest.mock("../config", () => {
				const originalConfig = jest.requireActual("../config");
				return {
					...originalConfig,
					factory: {
						url: originalConfig.factory.url,
						apiKey: "badkey",
					},
				};
			});

			app = require("../service");

			const res = await request(app)
				.post("/api/order")
				.send({
					franchiseId: 1,
					storeId: 1,
					items: [{ menuId: 1, description: "Veggie", price: 0.05 }],
				})
				.set("Authorization", `Bearer ${adminUserAuthToken}`);
			expect(res.status).toBe(500);
			expect(res.body.message).toBe("Failed to fulfill order at factory");
		});
	});

	function randomName() {
		return Math.random().toString(36).substring(2, 12);
	}

	function expectValidJwt(potentialJwt) {
		expect(potentialJwt).toMatch(
			/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/
		);
	}

	async function createAdminUser() {
		let user = { password: "toomanysecrets", roles: [{ role: Role.Admin }] };
		user.name = randomName();
		user.email = user.name + "@admin.com";

		user = await DB.addUser(user);
		return { ...user, password: "toomanysecrets" };
	}

	async function createUser() {
		let user = {
			password: "toomanyusers",
			roles: [{ role: Role.Diner }],
		};
		user.name = randomName();
		user.email = user.name + "@user.com";

		user = await DB.addUser(user);
		return { ...user, password: "toomanyusers" };
	}
});
