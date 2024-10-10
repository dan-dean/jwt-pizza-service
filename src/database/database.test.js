jest.mock("mysql2/promise", () => {
	const mockConnection = {
		query: jest.fn(),
		end: jest.fn(),
	};

	return {
		createConnection: jest.fn().mockResolvedValue(mockConnection),
	};
});

const config = require("../config");
const mysql = require("mysql2/promise");
const { DB, Role } = require("./database");
const bcrypt = require("bcrypt");

describe("Database Tests", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	test("getConnection should return a connection", async () => {
		const mockConnection = {
			query: jest.fn(),
			end: jest.fn(),
		};

		mysql.createConnection.mockResolvedValue(mockConnection);

		const connection = await DB.getConnection();

		expect(mysql.createConnection).toHaveBeenCalledWith({
			host: config.db.connection.host,
			user: config.db.connection.user,
			password: config.db.connection.password,
			connectTimeout: config.db.connection.connectTimeout,
			decimalNumbers: true,
		});
		expect(connection).toBe(mockConnection);
	});

	test("initializeDatabase should log error if initialization fails", async () => {
		const consoleSpy = jest
			.spyOn(console, "error")
			.mockImplementation(() => {});

		const mockConnection = {
			query: jest.fn(),
			end: jest.fn(),
		};
		mysql.createConnection.mockResolvedValue(mockConnection);
		mockConnection.query.mockRejectedValue(new Error("Initialization error"));

		await DB.initializeDatabase();

		expect(consoleSpy).toHaveBeenCalledWith(
			JSON.stringify({
				message: "Error initializing database",
				exception: "connection.execute is not a function",
				connection: config.db.connection,
			})
		);

		consoleSpy.mockRestore();
	});

	test("initializeDatabase should add default admin when database does not exist", async () => {
		const consoleLogSpy = jest
			.spyOn(console, "log")
			.mockImplementation(() => {});

		const mockConnection = {
			query: jest.fn(),
			end: jest.fn(),
		};

		mysql.createConnection.mockResolvedValue(mockConnection);

		const checkDatabaseExistsSpy = jest
			.spyOn(DB, "checkDatabaseExists")
			.mockResolvedValue(false);

		const addUserSpy = jest.spyOn(DB, "addUser").mockResolvedValue();

		await DB.initializeDatabase();

		expect(checkDatabaseExistsSpy).toHaveBeenCalled();

		expect(mockConnection.query).toHaveBeenCalledWith(
			`CREATE DATABASE IF NOT EXISTS ${config.db.connection.database}`
		);

		consoleLogSpy.mockRestore();
		checkDatabaseExistsSpy.mockRestore();
		addUserSpy.mockRestore();
	});

	test("getOrders should retrieve orders and items for a user", async () => {
		const mockUser = { id: 1 };

		const mockConnection = {
			execute: jest.fn(),
			end: jest.fn(),
		};

		jest.spyOn(DB, "getConnection").mockResolvedValue(mockConnection);

		const mockOrders = [
			{ id: 1, franchiseId: 100, storeId: 200, date: "2024-10-01" },
			{ id: 2, franchiseId: 101, storeId: 201, date: "2024-10-02" },
		];
		mockConnection.execute
			.mockResolvedValueOnce([mockOrders])
			.mockResolvedValueOnce([
				[
					{ id: 10, menuId: 1, description: "Item 1", price: 9.99 },
					{ id: 11, menuId: 2, description: "Item 2", price: 12.99 },
				],
			])
			.mockResolvedValueOnce([
				[
					{ id: 12, menuId: 3, description: "Item 3", price: 7.99 },
					{ id: 13, menuId: 4, description: "Item 4", price: 8.99 },
				],
			]);

		const page = 1;
		const result = await DB.getOrders(mockUser, page);

		expect(result).toEqual({
			dinerId: mockUser.id,
			orders: [
				{
					id: 1,
					franchiseId: 100,
					storeId: 200,
					date: "2024-10-01",
					items: [
						{ id: 10, menuId: 1, description: "Item 1", price: 9.99 },
						{ id: 11, menuId: 2, description: "Item 2", price: 12.99 },
					],
				},
				{
					id: 2,
					franchiseId: 101,
					storeId: 201,
					date: "2024-10-02",
					items: [
						{ id: 12, menuId: 3, description: "Item 3", price: 7.99 },
						{ id: 13, menuId: 4, description: "Item 4", price: 8.99 },
					],
				},
			],
			page: 1,
		});

		expect(mockConnection.execute).toHaveBeenCalledTimes(3);

		expect(mockConnection.execute).toHaveBeenNthCalledWith(
			1,
			`SELECT id, franchiseId, storeId, date FROM dinerOrder WHERE dinerId=? LIMIT 0,${config.db.listPerPage}`,
			[mockUser.id]
		);

		expect(mockConnection.execute).toHaveBeenNthCalledWith(
			2,
			`SELECT id, menuId, description, price FROM orderItem WHERE orderId=?`,
			[1]
		);

		expect(mockConnection.execute).toHaveBeenNthCalledWith(
			3,
			`SELECT id, menuId, description, price FROM orderItem WHERE orderId=?`,
			[2]
		);
	});

	test("logoutUser should delete token and handle errors", async () => {
		const mockConnection = {
			execute: jest.fn(),
			end: jest.fn(),
		};

		jest.spyOn(DB, "getConnection").mockResolvedValue(mockConnection);

		jest.spyOn(DB, "getTokenSignature").mockReturnValue("mockedToken");

		mockConnection.execute.mockRejectedValueOnce(new Error("Delete failed"));

		try {
			await DB.logoutUser("mockedToken");
		} catch (error) {
			expect(error.message).toBe("Delete failed");
		}

		expect(DB.getTokenSignature).toHaveBeenCalledWith("mockedToken");
		expect(mockConnection.execute).toHaveBeenCalledWith(
			`DELETE FROM auth WHERE token=?`,
			["mockedToken"]
		);
		expect(mockConnection.end).toHaveBeenCalled();
	});

	test("addUser should handle Franchisee role correctly", async () => {
		const mockConnection = {
			query: jest.fn(),
			end: jest.fn(),
		};

		jest.spyOn(DB, "getConnection").mockResolvedValue(mockConnection);

		const queryMock = jest.spyOn(DB, "query");
		queryMock.mockResolvedValueOnce({ insertId: 123 });
		queryMock.mockResolvedValueOnce({});

		const mockFranchiseId = 456;
		jest.spyOn(DB, "getID").mockResolvedValue(mockFranchiseId);

		jest.spyOn(bcrypt, "hash").mockResolvedValue("hashedPassword");

		const mockUser = {
			name: "Test User",
			email: "test@example.com",
			password: "plaintextPassword",
			roles: [
				{
					role: Role.Franchisee,
					object: "FranchiseName",
				},
			],
		};

		const result = await DB.addUser(mockUser);

		expect(bcrypt.hash).toHaveBeenCalledWith("plaintextPassword", 10);

		expect(DB.query).toHaveBeenNthCalledWith(
			1,
			mockConnection,
			`INSERT INTO user (name, email, password) VALUES (?, ?, ?)`,
			[mockUser.name, mockUser.email, "hashedPassword"]
		);

		expect(DB.getID).toHaveBeenCalledWith(
			mockConnection,
			"name",
			mockUser.roles[0].object,
			"franchise"
		);

		expect(DB.query).toHaveBeenNthCalledWith(
			2,
			mockConnection,
			`INSERT INTO userRole (userId, role, objectId) VALUES (?, ?, ?)`,
			[123, Role.Franchisee, mockFranchiseId]
		);

		expect(mockConnection.end).toHaveBeenCalled();

		expect(result).toEqual({
			name: "Test User",
			email: "test@example.com",
			password: undefined,
			roles: [
				{
					role: Role.Franchisee,
					object: "FranchiseName",
				},
			],
			id: 123,
		});
	});
});
