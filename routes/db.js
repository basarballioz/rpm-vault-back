import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const client = new MongoClient(process.env.MONGO_URI, {
    maxPoolSize: 50,
    connectTimeoutMS: 5000,
    socketTimeoutMS: 45000,
});

let dbConnection = null;

export async function getDb() {
    try {
        if (!dbConnection) {
            await client.connect();
            dbConnection = client.db("rpm-vault-db");
            console.log("Successfully connected to MongoDB.");
        }
        return dbConnection;
    } catch (error) {
        console.error("Error connecting to the database:", error);
        throw new Error("Database connection failed");
    }
}

export async function closeConnection() {
    try {
        if (dbConnection) {
            await client.close();
            dbConnection = null;
            console.log("Database connection closed.");
        }
    } catch (error) {
        console.error("Error closing database connection:", error);
        throw new Error("Failed to close database connection");
    }
}

// Graceful shutdown
process.on('SIGINT', async () => {
    await closeConnection();
    process.exit(0);
});
