// Chạy file .sql vào DB leather_shop.db — dùng cho máy không cài sqlite3 CLI
// (vd: Windows PowerShell không hiểu dấu `<` và lệnh `sqlite3`).
// Cách dùng (đứng trong thư mục backend):
//   node run-sql.js fix-product-images.sql
// Chạy lại nhiều lần cũng an toàn với các file UPDATE/INSERT có điều kiện.
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const file = process.argv[2];
if (!file) {
  console.error('Cach dung: node run-sql.js <ten-file.sql>');
  process.exit(1);
}
const sqlPath = path.resolve(__dirname, file);
if (!fs.existsSync(sqlPath)) {
  console.error('Khong tim thay file: ' + sqlPath);
  process.exit(1);
}
const dbPath = path.join(__dirname, 'leather_shop.db');
const db = new Database(dbPath);
try {
  const sql = fs.readFileSync(sqlPath, 'utf8');
  db.transaction((s) => db.exec(s))(sql); // gói trong transaction: lỗi thì rollback hết
  console.log('Da chay xong ' + file);
} catch (e) {
  console.error('LOI: ' + e.message);
  process.exit(1);
} finally {
  db.close();
}
