// ============================================================
// Tầng dữ liệu SQL Server (thay better-sqlite3) — nhánh migrate/sqlserver
// API giữ hình dạng cũ nhưng BẤT ĐỒNG BỘ:
//   await db.prepare(sql).get(...params)  -> 1 dòng | undefined
//   await db.prepare(sql).all(...params)  -> mảng dòng
//   await db.prepare(sql).run(...params)  -> { lastInsertRowid, changes }
//   await db.transaction(fn)(...args)     -> chạy fn trong 1 transaction
// Câu SQL viết kiểu SQLite được dịch sang T-SQL bởi translateSql() bên dưới.
// Cột DATETIME2 được chuẩn hoá về chuỗi 'YYYY-MM-DD HH:MM:SS' giờ địa phương
// để giữ đúng hành vi cũ (app coi thời gian là text naive).
// ============================================================
require('dotenv').config();
const { AsyncLocalStorage } = require('async_hooks');

let sqlLib = null;
let poolPromise = null;
const txContext = new AsyncLocalStorage(); // giữ transaction của ngữ cảnh đang chạy

function loadSql() {
  if (!sqlLib) sqlLib = require('mssql');
  return sqlLib;
}

function getPool() {
  if (process.env.DB_MOCK === '1') return Promise.resolve(null);
  if (!poolPromise) {
    const sql = loadSql();
    const cfg = {
      server: process.env.DB_SERVER || 'localhost',
      database: process.env.DB_NAME || 'LeatherShop',
      user: process.env.DB_USER || 'sa',
      password: process.env.DB_PASSWORD || '',
      options: {
        encrypt: process.env.DB_ENCRYPT === 'true',
        trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE !== 'false',
        instanceName: process.env.DB_INSTANCE || undefined,
        useUTC: true, // cố định: DATETIME2 trả về dạng Date UTC, fmtLocal đọc getter UTC
      },
      pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
      requestTimeout: 30000,
      connectionTimeout: 15000,
    };
    if (process.env.DB_PORT) cfg.port = parseInt(process.env.DB_PORT, 10);
    poolPromise = new sql.ConnectionPool(cfg).connect().catch((e) => {
      poolPromise = null;
      throw new Error('Không kết nối được SQL Server: ' + e.message);
    });
  }
  return poolPromise;
}

// ---------- Chuẩn hoá giá trị ----------

// tedious trả DATETIME2 dưới dạng Date theo giờ UTC (useUTC: true — xem options
// của pool bên dưới). Muốn chuỗi đúng bằng giờ ghi trong DB thì phải đọc bằng
// getter UTC; dùng getter địa phương sẽ cộng thêm 7h (lệch giờ hiển thị).
function fmtLocal(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

function normalizeRow(row) {
  if (!row || typeof row !== 'object') return row;
  for (const k of Object.keys(row)) if (row[k] instanceof Date) row[k] = fmtLocal(row[k]);
  return row;
}

// ---------- Dịch cú pháp SQLite -> T-SQL ----------

const STRFTIME_MAP = {
  '%Y-%m': 'yyyy-MM',
  '%Y-%m-%d': 'yyyy-MM-dd',
  '%d/%m/%Y': 'dd/MM/yyyy',
  '%Y/%m': 'yyyy/MM',
  '%Y': 'yyyy',
  '%m': 'MM',
  '%d': 'dd',
  '%H:%M': 'HH:mm',
  '%Y-%m-%d %H:%M:%S': 'yyyy-MM-dd HH:mm:ss',
};

function dateAdd(modifier, base) {
  const m = /^\s*([+-]?\d+)\s+(day|days|hour|hours|minute|minutes|month|months|year|years)\s*$/i.exec(modifier || '');
  if (!m) return null;
  const unit = m[2].toLowerCase().replace(/s$/, '');
  return `DATEADD(${unit}, ${parseInt(m[1], 10)}, ${base})`;
}

function translateFunctions(s) {
  // datetime('now' [, 'localtime'] [, '-N days']) -> SYSDATETIME() / DATEADD(...)
  s = s.replace(/datetime\(\s*'now'\s*((?:\s*,\s*'[^']*')*)\s*\)/gi, (full, args) => {
    const mods = [...args.matchAll(/'([^']*)'/g)].map((x) => x[1]).filter((x) => x !== 'localtime');
    let base = 'SYSDATETIME()';
    for (const mod of mods) {
      const da = dateAdd(mod, base);
      if (da) base = da;
    }
    return base;
  });
  // datetime(col) -> chuỗi 'YYYY-MM-DD HH:MM:SS'
  s = s.replace(/datetime\(([^'()][^()]*)\)/gi, (full, col) => `CONVERT(NVARCHAR(19), ${col.trim()}, 120)`);
  // date('now' ...) -> ngày hiện tại; date(col [,'localtime']) / date(?) -> CONVERT(date, ...)
  s = s.replace(/date\(\s*'now'\s*(?:\s*,\s*'[^']*')*\s*\)/gi, 'CONVERT(date, SYSDATETIME())');
  s = s.replace(/date\(\s*(\?|[A-Za-z_][\w.]*)\s*(?:\s*,\s*'[^']*')*\s*\)/gi, (full, col) => `CONVERT(date, ${col})`);
  // strftime('FMT', col [,'localtime']) — dạng format là biến ? xử lý ở translateSql
  s = s.replace(/strftime\(\s*'([^']+)'\s*,\s*([^()]+?)\s*(?:,\s*'[^']*')?\s*\)/gi, (full, fmt, col) => {
    const f = STRFTIME_MAP[fmt];
    if (!f) throw new Error('strftime format chưa hỗ trợ: ' + fmt);
    return `FORMAT(${col.trim()}, '${f}')`;
  });
  return s;
}

// Tách SQL thành đoạn code / đoạn literal để không đụng vào '?' nằm trong chuỗi
function splitSegments(s) {
  const segs = [];
  let cur = '';
  let inStr = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      cur += ch;
      if (ch === "'") {
        if (s[i + 1] === "'") { cur += s[++i]; } else { segs.push({ str: true, text: cur }); cur = ''; inStr = false; }
      }
    } else if (ch === "'") {
      if (cur) segs.push({ str: false, text: cur });
      cur = ch; inStr = true;
    } else cur += ch;
  }
  if (cur) segs.push({ str: inStr, text: cur });
  return segs;
}

function translateSql(rawSql, params) {
  let s = String(rawSql);
  let ignoreDup = false;
  if (/^\s*INSERT\s+OR\s+IGNORE\s+INTO/i.test(s)) {
    s = s.replace(/INSERT\s+OR\s+IGNORE\s+INTO/i, 'INSERT INTO');
    ignoreDup = true;
  }
  s = translateFunctions(s);

  // Rút LIMIT thành token, GIỮ NGUYÊN thứ tự xuất hiện của '?' trong token:
  //   LIMIT n OFFSET m -> __OFL__(n, m)   (vai: limit, offset)
  //   LIMIT m, n       -> __OFC__(m, n)   (vai: offset, limit)
  const segs = splitSegments(s);
  let joined = '';
  for (const seg of segs) {
    if (seg.str) { joined += seg.text; continue; }
    let t = seg.text;
    t = t.replace(/\bLIMIT\s+(\?|\d+)\s+OFFSET\s+(\?|\d+)/i, '__OFL__($1, $2)');
    t = t.replace(/\bLIMIT\s+(\?|\d+)\s*,\s*(\?|\d+)/i, '__OFC__($1, $2)');
    t = t.replace(/\bLIMIT\s+(\?|\d+)/i, '__TOP__($1)');
    joined += t;
  }

  // Đánh số ? -> @pN theo thứ tự, CHỈ trong đoạn code (không đụng '?' trong chuỗi)
  let pIdx = 0;
  let full = '';
  for (const seg of splitSegments(joined)) {
    if (seg.str) { full += seg.text; continue; }
    full += seg.text.replace(/\?/g, () => `@p${pIdx++}`);
  }

  // strftime(@pN, col) -> FORMAT(col, '...') với format lấy từ params[N]; param đó không bind nữa
  const skippedParams = new Set();
  full = full.replace(/strftime\(\s*@p(\d+)\s*,\s*([^()]+?)\s*(?:,\s*'[^']*')?\s*\)/gi, (f, idx, col) => {
    const fmt = params && params[Number(idx)];
    const mapped = STRFTIME_MAP[fmt];
    if (!mapped) throw new Error('strftime(?) format chưa hỗ trợ: ' + fmt);
    skippedParams.add(Number(idx));
    return `FORMAT(${col.trim()}, '${mapped}')`;
  });

  // TOP: đưa lên ngay sau SELECT đầu tiên
  const topM = /__TOP__\((@p\d+|\d+)\)/.exec(full);
  if (topM) {
    full = full.replace(topM[0], '');
    const expr = topM[1].startsWith('@') ? `(${topM[1]})` : topM[1];
    full = full.replace(/^(\s*SELECT\s+(?:DISTINCT\s+)?)/i, `$1TOP ${expr} `);
  }
  // OFFSET/FETCH: để ở cuối câu, chèn ORDER BY (SELECT NULL) nếu chưa có
  const ofM = /__(OFL|OFC)__\((@p\d+|\d+),\s*(@p\d+|\d+)\)/.exec(full);
  if (ofM) {
    full = full.replace(ofM[0], '');
    const off = ofM[1] === 'OFL' ? ofM[3] : ofM[2];
    const cnt = ofM[1] === 'OFL' ? ofM[2] : ofM[3];
    const val = (x) => (x.startsWith('@') ? x : String(parseInt(x, 10)));
    if (!/\bORDER\s+BY\b/i.test(full)) full = full.replace(/\s*;?\s*$/, '') + ' ORDER BY (SELECT NULL)';
    full += ` OFFSET ${val(off)} ROWS FETCH NEXT ${val(cnt)} ROWS ONLY`;
  }
  const isInsert = /^\s*INSERT\s+INTO/i.test(full);
  return { sql: full, ignoreDup, isInsert, skippedParams };
}

// ---------- Thực thi ----------

const mockLog = []; // DB_MOCK=1: ghi lại SQL đã dịch thay vì chạy thật (phục vụ test)

async function newRequest() {
  const tx = txContext.getStore();
  if (tx) return tx.request();
  const pool = await getPool();
  return pool.request();
}

function bindParams(req, params, skippedParams) {
  if (!params) return;
  if (Array.isArray(params)) {
    params.forEach((v, i) => {
      if (skippedParams && skippedParams.has(i)) return;
      req.input('p' + i, v === undefined ? null : v);
    });
  } else if (typeof params === 'object') {
    // better-sqlite3 cho phép truyền object cho tham số đặt tên @ten
    for (const [k, v] of Object.entries(params)) req.input(k.replace(/^[@:$]/, ''), v === undefined ? null : v);
  }
}

async function execQuery(mode, rawSql, params) {
  const { sql: tsql, ignoreDup, isInsert, skippedParams } = translateSql(rawSql, params);
  if (process.env.DB_MOCK === '1') {
    mockLog.push({ mode, sql: tsql, params });
    if (mode === 'get') return undefined;
    if (mode === 'all') return [];
    return { lastInsertRowid: 1, changes: 1 };
  }
  const req = await newRequest();
  bindParams(req, params, skippedParams);
  let finalSql = tsql;
  if (mode === 'run' && isInsert) finalSql = tsql + '; SELECT CAST(SCOPE_IDENTITY() AS INT) AS __lid;';
  let result;
  try {
    result = await req.query(finalSql);
  } catch (e) {
    if (ignoreDup && (e.number === 2627 || e.number === 2601)) {
      return { lastInsertRowid: null, changes: 0 };
    }
    // SQL chỉ ghi ra log server, KHÔNG đưa vào message trả cho client
    // (trước đây message kèm cả câu SQL nên người dùng thấy toàn ký tự lạ).
    console.error('[SQL lỗi]', finalSql.slice(0, 300), '—', e.message);
    throw e;
  }
  const rows = (result.recordset || []).map(normalizeRow);
  if (mode === 'get') return rows[0];
  if (mode === 'all') return rows;
  // run — tìm dòng __lid trong BẤT KỲ recordset nào: lệnh INSERT không trả
  // recordset, nên batch "INSERT; SELECT __lid" thường chỉ có 1 recordset.
  // (Bản cũ đòi recordsets.length > 1 nên luôn trả null → đơn hàng bị NULL id.)
  let lid = null;
  for (const rs of (result.recordsets || [])) {
    if (rs && rs.length && rs[0] && rs[0].__lid != null) { lid = rs[0].__lid; break; }
  }
  return {
    lastInsertRowid: lid,
    changes: (result.rowsAffected && result.rowsAffected[0]) || 0,
  };
}

function flattenArgs(args) {
  // better-sqlite3: .get(a, b) hoặc .get([a, b]) hoặc .get({...})
  if (args.length === 0) return [];
  if (args.length === 1) return args[0];
  return args;
}

function prepare(rawSql) {
  return {
    get: (...args) => execQuery('get', rawSql, flattenArgs(args)),
    all: (...args) => execQuery('all', rawSql, flattenArgs(args)),
    run: (...args) => execQuery('run', rawSql, flattenArgs(args)),
  };
}

function transaction(fn) {
  return async (...args) => {
    if (txContext.getStore()) return fn(...args); // đang trong transaction: dùng chung
    if (process.env.DB_MOCK === '1') return fn(...args);
    const sql = loadSql();
    const pool = await getPool();
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      const out = await txContext.run(tx, () => fn(...args));
      await tx.commit();
      return out;
    } catch (e) {
      try { await tx.rollback(); } catch (_) { /* bỏ qua */ }
      throw e;
    }
  };
}

async function exec(rawSql) {
  // Thực thi SQL thô (DDL nhiều câu) — dùng cho seed/khởi tạo
  if (process.env.DB_MOCK === '1') { mockLog.push({ mode: 'exec', sql: rawSql }); return; }
  const req = await newRequest();
  await req.query(rawSql);
}

// ---------- Seed tối thiểu + helper dùng chung ----------

async function init() {
  if (process.env.DB_MOCK === '1') return;
  await getPool();
  const shipCount = await execQuery('get', 'SELECT COUNT(*) AS c FROM shipping_methods', []);
  if (!shipCount || shipCount.c === 0) {
    await execQuery('run', 'INSERT INTO shipping_methods (name, fee, eta, is_active) VALUES (?, ?, ?, 1)', ['Tiêu chuẩn', 30000, '2-4 ngày']);
    await execQuery('run', 'INSERT INTO shipping_methods (name, fee, eta, is_active) VALUES (?, ?, ?, 1)', ['Nhanh', 50000, '1-2 ngày']);
    await execQuery('run', 'INSERT INTO shipping_methods (name, fee, eta, is_active) VALUES (?, ?, ?, 1)', ['Hỏa tốc', 90000, 'Trong ngày']);
  }
  const welcome = await execQuery('get', 'SELECT id FROM vouchers WHERE code = ?', ['WELCOME10']);
  if (!welcome) {
    await execQuery('run',
      'INSERT INTO vouchers (code, type, value, min_order, expiry, usage_limit, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)',
      ['WELCOME10', 'percent', 10, 500000, '2027-12-31', 1000]);
  }
}

async function logStockMovement({ product_id = null, variant_id = null, type, qty, ref_type = '', ref_id = null, note = '' }) {
  return execQuery('run',
    'INSERT INTO stock_movements (product_id, variant_id, type, qty, ref_type, ref_id, note) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [product_id, variant_id, type, qty, ref_type, ref_id, note]);
}

const db = {
  prepare,
  transaction,
  exec,
  init,
  logStockMovement,
  get: (sqlText, ...args) => execQuery('get', sqlText, flattenArgs(args)),
  all: (sqlText, ...args) => execQuery('all', sqlText, flattenArgs(args)),
  run: (sqlText, ...args) => execQuery('run', sqlText, flattenArgs(args)),
  _translateSql: translateSql,
  _mockLog: mockLog,
};

module.exports = db;
