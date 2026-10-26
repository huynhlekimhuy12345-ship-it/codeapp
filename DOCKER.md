# BI99 — Bộ file Docker deploy (BẢN NHÁP, chưa chạy thử)

Các file Docker (Dockerfile, docker-compose.yml, .env.example, .dockerignore)
đã nằm sẵn ở **thư mục gốc của repo** (ngang hàng `backend/`, `frontend/`),
làm theo các bước dưới. File `.env` tạo từ `.env.example` thì
**không commit lên git**.

## 1. Chạy lần đầu (máy host đã cài Docker, RAM >= 4GB)

```bash
cp .env.example .env
# mở .env điền MSSQL_SA_PASSWORD (mật khẩu mạnh) và JWT_SECRET
docker compose up -d --build
docker compose ps        # cả 2 container đều healthy/running mới xong
```

Mở web: `http://<địa-chỉ-máy-host>:5000`

## 2. Đưa dữ liệu cũ vào (chỉ làm 1 lần, chọn 1 trong 2 cách)

Dữ liệu thật hiện nằm ở SQL Server trên máy user (instance SQLEXPRESS),
KHÔNG tự bay sang container mới. Giữ nguyên instance cũ cho tới khi
container mới chạy ổn rồi mới tính dọn.

- **Cách A — file .bak:** trong SSMS, backup database LeatherShop ra
  file `.bak` -> copy file vào container
  (`docker cp LeatherShop.bak bi99-sqlserver:/var/opt/mssql/`) ->
  RESTORE DATABASE trong container.
- **Cách B — script .sql:** dùng file script chuyển đổi v2 đã có
  (`chuyen-du-lieu-sqlite-sang-sqlserver-v2.sql`) hoặc Generate Scripts
  (Schema and data) từ SSMS -> copy vào container -> chạy bằng sqlcmd
  (`docker exec bi99-sqlserver /opt/mssql-tools18/bin/sqlcmd -S localhost
  -U sa -P "$MSSQL_SA_PASSWORD" -C -i /var/opt/mssql/<file>.sql`).
  Lưu ý: script v2 là snapshot cũ (362 dòng lúc xuất); dữ liệu mới
  phát sinh sau đó (vd đơn #54) chỉ có ở instance hiện tại, nên nếu
  dùng cách B thì phải Generate Scripts lại từ instance hiện tại.

Kiểm chứng sau khi khôi phục: đăng nhập admin, thấy đủ sản phẩm /
đơn hàng / khách hàng; tạo 1 đơn test rồi kiểm tra trong container.

## 3. Sao lưu về sau

Dữ liệu nằm ở volume `sqlserver-data`, xóa container (`docker compose
down`) không mất, nhưng xóa volume (`docker compose down -v`) là mất.
Sao lưu định kỳ bằng BACKUP DATABASE ra file `.bak` rồi copy ra host
(`docker cp bi99-sqlserver:/var/opt/mssql/<file>.bak ./`), cất ở chỗ
riêng ngoài máy host càng tốt.

## 4. Những điểm dễ sai (đã ghi sẵn trong docker-compose.yml)

- **Không đặt DB_INSTANCE** khi chạy Docker: container SQL Server
  không có instance SQLEXPRESS; app nối qua `DB_SERVER=sqlserver` +
  `DB_PORT=1433`. Dùng lại file `.env` cũ có `DB_INSTANCE=SQLEXPRESS`
  là server sập ngay từ lúc khởi động.
- **Không mở cổng 1433 ra ngoài:** compose hiện không expose 1433.
  Muốn dùng SSMS từ host thì chỉ mở `127.0.0.1:1433`, tuyệt đối không
  mở SQL Server ra internet.
- **Mật khẩu SA yếu** là container SQL Server tự dừng sau khi khởi
  động — kiểm tra bằng `docker compose logs sqlserver`.
- **Đừng chạy 2 server cùng cổng 5000:** tắt bản chạy tay cũ trước khi
  `docker compose up`.

## 5. Giới hạn của bản nháp này

- Chưa chạy thử được ở phía agent (máy agent không có Docker) — lần
  chạy đầu tiên trên máy user/VPS chính là lần kiểm chứng, kẹt bước nào
  thì gửi log bước đó.
- Chưa gồm: tên miền + HTTPS (cần thêm reverse proxy khi muốn chạy
  thật ngoài internet), và chưa gồm bước merge nhánh `migrate/sqlserver`
  vào `main` — user quyết merge khi nào sau khi Docker chạy ổn.
