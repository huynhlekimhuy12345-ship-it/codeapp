// Tab Báo cáo & thống kê: thẻ tổng quan, biểu đồ doanh thu (CSS thuần),
// bảng sản phẩm bán chạy và bảng tồn kho thấp.
// CÁC HÀM API CẦN CÓ trong api.js (coordinator thêm): getReportSummary, getRevenueReport,
// getTopProducts, getLowStock, getOrdersByStatus, getPaymentsByMethod (xem cuối file).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, fmtVND, ORDER_STATUS } from '../../api';
import './ReportsTab.css';

const todayStr = () => new Date().toISOString().slice(0, 10);

const METHOD_LABEL = { cod: 'COD', bank: 'Chuyển khoản', momo: 'MoMo' };

// Biểu đồ cột vẽ bằng div/CSS thuần: mỗi cột là 1 div với height %
function RevenueChart({ data }) {
  const max = useMemo(
    () => Math.max(0, ...data.map((d) => d.revenue)),
    [data]
  );
  if (!data.length) return <div className="report-empty">Chưa có dữ liệu trong khoảng này</div>;
  return (
    <div className="report-chart">
      {data.map((d) => (
        <div className="report-bar" key={d.label} title={`${d.label}: ${fmtVND(d.revenue)} · ${d.orders} đơn`}>
          <div
            className="col"
            style={{ height: max > 0 ? `${Math.max(3, (d.revenue / max) * 100)}%` : '3px' }}
          />
          <div className="cap">{d.label.slice(5).replace('-', '/')}</div>
        </div>
      ))}
    </div>
  );
}

export default function ReportsTab() {
  const [summary, setSummary] = useState(null);
  const [topProducts, setTopProducts] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [byStatus, setByStatus] = useState([]);
  const [byPayment, setByPayment] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Bộ lọc biểu đồ doanh thu
  const [from, setFrom] = useState(() => todayStr().slice(0, 7) + '-01');
  const [to, setTo] = useState(todayStr);
  const [group, setGroup] = useState('day');
  const [revenue, setRevenue] = useState([]);
  const [revenueLoading, setRevenueLoading] = useState(false);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [s, tp, ls, bs, pm] = await Promise.all([
        api.getReportSummary(),
        api.getTopProducts(10),
        api.getReportLowStock(5),
        api.getOrdersByStatus(),
        api.getPaymentsByMethod(),
      ]);
      setSummary(s);
      setTopProducts(tp || []);
      setLowStock(ls || []);
      setByStatus(bs || []);
      setByPayment(pm || []);
    } catch (e) {
      setError(e.message || 'Không tải được dữ liệu báo cáo');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRevenue = useCallback(async () => {
    setRevenueLoading(true);
    try {
      const data = await api.getRevenueReport({ from, to, group });
      setRevenue(data || []);
    } catch (e) {
      setRevenue([]);
    } finally {
      setRevenueLoading(false);
    }
  }, [from, to, group]);

  useEffect(() => { loadOverview(); }, [loadOverview]);
  useEffect(() => { loadRevenue(); }, [loadRevenue]);

  if (loading) return <p className="report-empty">Đang tải báo cáo…</p>;
  if (error) return <p className="report-empty" style={{ color: '#f09280' }}>{error}</p>;

  return (
    <div>
      {/* Thẻ tổng quan */}
      <div className="report-cards">
        <div className="report-card">
          <div className="lbl">Doanh thu hôm nay</div>
          <div className="val green">{fmtVND(summary.revenue_today)}</div>
        </div>
        <div className="report-card">
          <div className="lbl">Doanh thu tháng này</div>
          <div className="val green">{fmtVND(summary.revenue_month)}</div>
        </div>
        <div className="report-card">
          <div className="lbl">Đơn hôm nay</div>
          <div className="val">{summary.orders_today}</div>
        </div>
        <div className="report-card">
          <div className="lbl">Đơn chờ xử lý</div>
          <div className="val amber">{summary.orders_pending}</div>
        </div>
        <div className="report-card">
          <div className="lbl">SP sắp hết hàng</div>
          <div className="val red">{summary.products_low_stock_count}</div>
        </div>
        <div className="report-card">
          <div className="lbl">Khách hàng</div>
          <div className="val">{summary.customers_count}</div>
        </div>
      </div>

      {/* Biểu đồ doanh thu */}
      <h3 style={{ color: 'var(--cream)', marginBottom: 12 }}>Doanh thu theo thời gian</h3>
      <div className="filters">
        <label>
          Từ&nbsp;
          <input aria-label="Ô nhập" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          Đến&nbsp;
          <input aria-label="Ô nhập" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <select value={group} onChange={(e) => setGroup(e.target.value)}>
          <option value="day">Theo ngày</option>
          <option value="month">Theo tháng</option>
        </select>
      </div>
      {revenueLoading
        ? <div className="report-empty">Đang tải…</div>
        : <RevenueChart data={revenue} />}
      <p className="report-note">Chỉ tính các đơn đã giao thành công (đơn đã hủy không tính doanh thu).</p>

      {/* Bảng đơn theo trạng thái + thanh toán theo phương thức */}
      <div className="report-two-cols">
        <div>
          <h3 style={{ color: 'var(--cream)', marginBottom: 12 }}>Đơn hàng theo trạng thái</h3>
          <div className="table-scroll">
            <table className="data-table">
                        <thead><tr><th>Trạng thái</th><th style={{ textAlign: 'right' }}>Số đơn</th></tr></thead>
                        <tbody>
                          {byStatus.map((r) => (
                            <tr key={r.status}>
                              <td><span className={`status ${r.status}`}>{ORDER_STATUS[r.status] || r.status}</span></td>
                              <td style={{ textAlign: 'right' }}>{r.count}</td>
                            </tr>
                          ))}
                        </tbody>
            </table>
          </div>
        </div>
        <div>
          <h3 style={{ color: 'var(--cream)', marginBottom: 12 }}>Thanh toán theo phương thức</h3>
          {byPayment.length === 0
            ? <div className="report-empty">Chưa có giao dịch thanh toán nào</div>
            : (
              <div className="table-scroll">
                <table className="data-table">
                                <thead><tr><th>Phương thức</th><th style={{ textAlign: 'right' }}>Số GD</th><th style={{ textAlign: 'right' }}>Tổng tiền</th></tr></thead>
                                <tbody>
                                  {byPayment.map((r) => (
                                    <tr key={r.method}>
                                      <td>{METHOD_LABEL[r.method] || r.method}</td>
                                      <td style={{ textAlign: 'right' }}>{r.count}</td>
                                      <td style={{ textAlign: 'right' }}>{fmtVND(r.total)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                </table>
              </div>
            )}
        </div>
      </div>

      {/* Top sản phẩm bán chạy */}
      <h3 style={{ color: 'var(--cream)', marginBottom: 12 }}>Sản phẩm bán chạy nhất</h3>
      {topProducts.length === 0
        ? <div className="report-empty">Chưa có sản phẩm nào được bán (đơn delivered)</div>
        : (
          <div className="table-scroll">
            <table className="data-table" style={{ marginBottom: 24 }}>
                        <thead>
                          <tr><th>#</th><th>Sản phẩm</th><th style={{ textAlign: 'right' }}>Đã bán</th><th style={{ textAlign: 'right' }}>Doanh thu</th></tr>
                        </thead>
                        <tbody>
                          {topProducts.map((p, i) => (
                            <tr key={i}>
                              <td>{i + 1}</td>
                              <td>{p.product_name}</td>
                              <td style={{ textAlign: 'right' }}>{p.qty_sold}</td>
                              <td style={{ textAlign: 'right' }}>{fmtVND(p.revenue)}</td>
                            </tr>
                          ))}
                        </tbody>
            </table>
          </div>
        )}

      {/* Tồn kho thấp */}
      <h3 style={{ color: 'var(--cream)', marginBottom: 12 }}>Sắp hết hàng (≤ 5)</h3>
      {lowStock.length === 0
        ? <div className="report-empty">Kho ổn định, không có mặt hàng sắp hết</div>
        : (
          <div className="table-scroll">
            <table className="data-table">
                        <thead>
                          <tr><th>Sản phẩm</th><th>Loại</th><th>SKU</th><th style={{ textAlign: 'right' }}>Tồn kho</th></tr>
                        </thead>
                        <tbody>
                          {lowStock.map((s, i) => (
                            <tr key={i}>
                              <td>{s.product_name}</td>
                              <td>{s.type === 'variant' ? 'Biến thể' : 'Sản phẩm'}</td>
                              <td>{s.sku || '—'}</td>
                              <td style={{ textAlign: 'right', color: '#f09280', fontWeight: 700 }}>{s.stock}</td>
                            </tr>
                          ))}
                        </tbody>
            </table>
          </div>
        )}
    </div>
  );
}

/*
 * CÁC HÀM CẦN THÊM VÀO object `api` trong frontend/src/api.js (auth: true cho tất cả):
 *
 *   getReportSummary: () => request('/api/reports/summary', { auth: true }),
 *   getRevenueReport: ({ from, to, group }) => {
 *     const q = new URLSearchParams({ from, to, group }).toString();
 *     return request(`/api/reports/revenue?${q}`, { auth: true });
 *   },
 *   getTopProducts: (limit = 10) => request(`/api/reports/top-products?limit=${limit}`, { auth: true }),
 *   getLowStock: (threshold = 5) => request(`/api/reports/low-stock?threshold=${threshold}`, { auth: true }),
 *   getOrdersByStatus: () => request('/api/reports/orders-by-status', { auth: true }),
 *   getPaymentsByMethod: () => request('/api/reports/payments-by-method', { auth: true }),
 */
