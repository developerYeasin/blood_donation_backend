const mysql = require('mysql2');
require('dotenv').config();

// Create a Connection Pool (More efficient than single connection)
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Convert to Promise-based pool (allows using 'await' in your code)
const db = pool.promise();

// Test the connection
pool.getConnection((err, connection) => {
    if (err) {
        console.error('❌ Database Connection Failed:', err.message);
    } else {
        console.log('✅ Connected to MySQL Database');
        connection.release();
    }
});

module.exports = db;