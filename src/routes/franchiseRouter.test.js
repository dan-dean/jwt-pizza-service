const request = require("supertest");
const app = require("../service");
const { Role, DB } = require("../database/database.js");

let adminUser,
	adminUserAuthToken,
	franchiseUser,
	existingFranchise,
	franchiseUserAuthToken;

describe("franchiseRouter", () => {
	beforeAll(async () => {
		adminUser = await createAdminUser();
		let adminLoginRes = await request(app).put("/api/auth").send({
			name: adminUser.name,
			email: adminUser.email,
			password: adminUser.password,
		});

		adminUserAuthToken = adminLoginRes.body.token;
		expectValidJwt(adminUserAuthToken);
		franchiseUser = await createUser();
		existingFranchise = await createFranchise(
			franchiseUser.email,
			franchiseUser.name
		);
		let userLoginRes = await request(app).put("/api/auth").send({
			name: franchiseUser.name,
			email: franchiseUser.email,
			password: franchiseUser.password,
		});
		franchiseUserAuthToken = userLoginRes.body.token;
	});

	test("getFranchises", async () => {
		const res = await request(app).get("/api/franchise");

		expect(res.status).toBe(200);
		const franchiseNames = res.body.map((franchise) => franchise.name);
		expect(franchiseNames).toContain(existingFranchise.name);
	});

	test("getUserFranchises", async () => {
		const res = await request(app)
			.get(`/api/franchise/${franchiseUser.id}`)
			.set("Authorization", `Bearer ${franchiseUserAuthToken}`);

		expect(res.status).toBe(200);
		const franchiseNames = res.body.map((franchise) => franchise.name);
		expect(franchiseNames).toContain(existingFranchise.name);
		expect(franchiseNames.length).toBe(1);
	});

	describe(createFranchise, () => {
		test("createFranchise success", async () => {
			const newFranchise = {
				name: franchiseUser.name + "-create",
				admins: [{ email: franchiseUser.email }],
			};
			const res = await request(app)
				.post("/api/franchise")
				.set("Authorization", `Bearer ${adminUserAuthToken}`)
				.send(newFranchise);

			expect(res.status).toBe(200);
			expect(res.body.name).toBe(newFranchise.name);
			expect(res.body.admins.email).toEqual(newFranchise.admins.email);
		});

		test("createFranchise fail", async () => {
			const newFranchise = {
				name: franchiseUser.name + "-create-fail",
				admins: [{ email: franchiseUser.email }],
			};
			const res = await request(app)
				.post("/api/franchise")
				.set("Authorization", `Bearer ${franchiseUserAuthToken}`)
				.send(newFranchise);

			expect(res.status).toBe(403);
		});
	});

	describe("deleteFranchise", () => {
		test("deleteFranchise success", async () => {
			const newFranchise = {
				name: franchiseUser.name + "-delete",
				admins: [{ email: franchiseUser.email }],
			};
			const createRes = await request(app)
				.post("/api/franchise")
				.set("Authorization", `Bearer ${adminUserAuthToken}`)
				.send(newFranchise);

			const res = await request(app)
				.delete(`/api/franchise/${createRes.body.id}`)
				.set("Authorization", `Bearer ${adminUserAuthToken}`);

			expect(res.status).toBe(200);
			expect(res.body.message).toBe("franchise deleted");
		});

		test("deleteFranchise fail", async () => {
			const newFranchise = {
				name: franchiseUser.name + "-delete-fail",
				admins: [{ email: franchiseUser.email }],
			};
			const createRes = await request(app)
				.post("/api/franchise")
				.set("Authorization", `Bearer ${adminUserAuthToken}`)
				.send(newFranchise);

			const res = await request(app)
				.delete(`/api/franchise/${createRes.body.id}`)
				.set("Authorization", `Bearer ${franchiseUserAuthToken}`);

			expect(res.status).toBe(403);
		});
	});

	describe("createStore", () => {
		test("createStore success general admin", async () => {
			const newStore = {
				name: "created-store-admin",
				franchiseId: existingFranchise.id,
			};
			const res = await request(app)
				.post(`/api/franchise/${existingFranchise.id}/store`)
				.set("Authorization", `Bearer ${adminUserAuthToken}`)
				.send(newStore);

			expect(res.status).toBe(200);
			expect(res.body.name).toBe(newStore.name);
			expect(res.body.franchiseId).toBe(newStore.franchiseId);
			expect(res.body.id).toBeDefined();
		});

		test("createStore success franchise admin", async () => {
			const newStore = {
				name: "created-store-franchise",
				franchiseId: existingFranchise.id,
			};

			const res = await request(app)
				.post(`/api/franchise/${existingFranchise.id}/store`)
				.set("Authorization", `Bearer ${franchiseUserAuthToken}`)
				.send(newStore);

			expect(res.status).toBe(200);
			expect(res.body.name).toBe(newStore.name);
			expect(res.body.franchiseId).toBe(newStore.franchiseId);
			expect(res.body.id).toBeDefined();
		});

		test("createStore fail", async () => {
			//non-franchise-admin user
			let user = await createUser();
			let userLoginRes = await request(app).put("/api/auth").send({
				name: user.name,
				email: user.email,
				password: user.password,
			});

			let userAuthToken = userLoginRes.body.token;

			const newStore = {
				name: "created-store-fail",
				franchiseId: existingFranchise.id,
			};
			const res = await request(app)
				.post(`/api/franchise/${existingFranchise.id}/store`)
				.set("Authorization", `Bearer ${userAuthToken}`)
				.send(newStore);

			expect(res.status).toBe(403);
		});
	});

	describe("deleteStore", () => {
		test("deleteStore success", async () => {
			const newStore = {
				name: "created-store",
				franchiseId: existingFranchise.id,
			};
			const createStoreRes = await request(app)
				.post(`/api/franchise/${existingFranchise.id}/store`)
				.set("Authorization", `Bearer ${adminUserAuthToken}`)
				.send(newStore);

			const res = await request(app)
				.delete(
					`/api/franchise/${existingFranchise.id}/store/${createStoreRes.body.id}`
				)
				.set("Authorization", `Bearer ${adminUserAuthToken}`);

			expect(res.status).toBe(200);
			expect(res.body.message).toBe("store deleted");
		});

		test("deleteStore fail", async () => {
			//non-franchise-admin user
			let user = await createUser();
			let userLoginRes = await request(app).put("/api/auth").send({
				name: user.name,
				email: user.email,
				password: user.password,
			});

			let userAuthToken = userLoginRes.body.token;

			const newStore = {
				name: "created-store-fail",
				franchiseId: existingFranchise.id,
			};
			const createStoreRes = await request(app)
				.post(`/api/franchise/${existingFranchise.id}/store`)
				.set("Authorization", `Bearer ${adminUserAuthToken}`)
				.send(newStore);

			const res = await request(app)
				.delete(
					`/api/franchise/${existingFranchise.id}/store/${createStoreRes.body.id}`
				)
				.set("Authorization", `Bearer ${userAuthToken}`);

			expect(res.status).toBe(403);
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
			password: "toomanyfranchises",
			roles: [{ role: Role.Diner }],
		};
		user.name = randomName();
		user.email = user.name + "@franchise.com";

		user = await DB.addUser(user);
		return { ...user, password: "toomanyfranchises" };
	}

	async function createFranchise(adminEmail, adminName) {
		let franchise = { name: adminName };
		franchise.admins = [{ email: adminEmail }];

		franchise = await DB.createFranchise(franchise);
		return franchise;
	}
});
