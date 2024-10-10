const request = require("supertest");
const app = require("../service");
const { Role, DB } = require("../database/database.js");

const testUser = { name: "pizza diner", email: "reg@test.com", password: "a" };
let testUserAuthToken;

describe("authRouter", () => {
	beforeAll(async () => {
		testUser.email = Math.random().toString(36).substring(2, 12) + "@test.com";
		const registerRes = await request(app).post("/api/auth").send(testUser);
		testUserAuthToken = registerRes.body.token;
		expectValidJwt(testUserAuthToken);
	});

	describe("register", () => {
		test("register success", async () => {
			testUser.email =
				Math.random().toString(36).substring(2, 12) + "@test.com";
			const registerRes = await request(app).post("/api/auth").send(testUser);
			expect(registerRes.status).toBe(200);
			expectValidJwt(registerRes.body.token);

			const expectedUser = { ...testUser, roles: [{ role: "diner" }] };
			delete expectedUser.password;
			expect(registerRes.body.user).toMatchObject(expectedUser);
		});

		test("register fail: incomplete fields", async () => {
			const registerRes = await request(app)
				.post("/api/auth")
				.send({ name: "a" });
			expect(registerRes.status).toBe(400);
			expect(registerRes.body.message).toBe(
				"name, email, and password are required"
			);
		});
	});

	test("login", async () => {
		const loginRes = await request(app).put("/api/auth").send(testUser);
		expect(loginRes.status).toBe(200);
		expectValidJwt(loginRes.body.token);

		const expectedUser = { ...testUser, roles: [{ role: "diner" }] };
		delete expectedUser.password;
		expect(loginRes.body.user).toMatchObject(expectedUser);
	});

	describe("updateUser", () => {
		test("updateUser fail", async () => {
			testUser.email =
				Math.random().toString(36).substring(2, 12) + "@test.com";
			const createdUser = await request(app).post("/api/auth").send(testUser);

			const userId = createdUser.body.user.id;
			const updatedUserData = {
				email: "brandnewemail@test.com",
				password: "brandnewpassword",
			};

			const updateUserRes = await request(app)
				.put(`/api/auth/${userId}`)
				.set("Authorization", `Bearer ${testUserAuthToken}`)
				.send(updatedUserData);

			expect(updateUserRes.status).toBe(403);
		});

		test("updateUser success", async () => {
			testUser.email =
				Math.random().toString(36).substring(2, 12) + "@test.com";
			const createdUser = await request(app).post("/api/auth").send(testUser);

			let adminUser = await createAdminUser();

			const loginRes = await request(app).put("/api/auth").send({
				name: adminUser.name,
				email: adminUser.email,
				password: adminUser.password,
			});

			let adminUserAuthToken = loginRes.body.token;
			expectValidJwt(adminUserAuthToken);

			const userId = createdUser.body.user.id;
			const updatedUserData = {
				email: "brandnewemail@test.com",
				password: "brandnewpassword",
			};

			const updateUserRes = await request(app)
				.put(`/api/auth/${userId}`)
				.set("Authorization", `Bearer ${adminUserAuthToken}`)
				.send(updatedUserData);

			expect(updateUserRes.status).toBe(200);
			expect(updateUserRes.body.email).toBe(updatedUserData.email);
		});
	});

	test("logout", async () => {
		const logoutRes = await request(app)
			.delete("/api/auth")
			.set("Authorization", `Bearer ${testUserAuthToken}`);
		expect(logoutRes.status).toBe(200);
		expect(logoutRes.body.message).toBe("logout successful");
	});

	function expectValidJwt(potentialJwt) {
		expect(potentialJwt).toMatch(
			/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/
		);
	}

	function randomName() {
		return Math.random().toString(36).substring(2, 12);
	}

	async function createAdminUser() {
		let user = { password: "toomanysecrets", roles: [{ role: Role.Admin }] };
		user.name = randomName();
		user.email = user.name + "@admin.com";

		user = await DB.addUser(user);
		return { ...user, password: "toomanysecrets" };
	}
});
