import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const uri = process.env.MONGO_URI as string;

if (!uri) {
    console.error("MONGO_URI is missing in .env");
    process.exit(1);
}

async function migrate() {
    // The original Mongoose URI didn't specify a database, which defaults to 'test'
    // We connect to the cluster level to access both 'test' and 'algoforge' databases.
    const client = new MongoClient(uri);

    try {
        await client.connect();
        
        const testDb = client.db('test');
        const algoforgeDb = client.db('algoforge');

        // 1. Migrate Users
        console.log("Fetching old users from 'test' database...");
        const oldUsers = await testDb.collection('users').find({}).toArray();
        console.log(`Found ${oldUsers.length} old users.`);

        if (oldUsers.length > 0) {
            console.log("Inserting into 'algoforge.User'...");
            for (const user of oldUsers) {
                // Check if user already exists in new DB to prevent duplicates
                const exists = await algoforgeDb.collection('User').findOne({ _id: user._id });
                if (!exists) {
                    await algoforgeDb.collection('User').insertOne(user);
                }
            }
            console.log("Users migrated successfully!");
        }

        // 2. Migrate UserProgress
        console.log("Fetching old UserProgress from 'test' database...");
        const oldProgress = await testDb.collection('userprogresses').find({}).toArray();
        // Mongoose might have also named it 'userprogress' depending on exact pluralize rules
        const fallbackProgress = await testDb.collection('userprogress').find({}).toArray();
        
        const allOldProgress = [...oldProgress, ...fallbackProgress];
        console.log(`Found ${allOldProgress.length} progress records.`);

        if (allOldProgress.length > 0) {
            console.log("Inserting into 'algoforge.UserProgress'...");
            for (const progress of allOldProgress) {
                const exists = await algoforgeDb.collection('UserProgress').findOne({ _id: progress._id });
                if (!exists) {
                    await algoforgeDb.collection('UserProgress').insertOne(progress);
                }
            }
            console.log("UserProgress migrated successfully!");
        }

        console.log("\nMigration completed! You can now run your Prisma app.");

    } catch (err) {
        console.error("Migration failed:", err);
    } finally {
        await client.close();
    }
}

migrate();
